// supabase/functions/intro-scheduler/index.ts
// Sprint 014B — Automated Concierge Intro Scheduler
//
// Extends Sprint 014A with a tick mode that automatically:
//   - Scans eligible reservations within a LOOKBACK_DAYS window
//   - Sends intro messages within PRE_SEND_WINDOW_HOURS of check-in
//   - Closes stale WhatsApp sessions after checkout
//
// Request body:
//   Manual: { "reservation_id": "uuid" }
//   Tick:   { "mode": "tick" }
//
// Tick flow per reservation: idempotency → timing check → process.
// Idempotency logic (conversations + messages) is unchanged from Sprint 014A.
// No schema changes required: 'closed' and 'post_stay' are valid per
// concierge-resolver SessionStatus / SessionPhase types.
//
// Uses service_role client only — bypasses RLS for all writes.
// Phone numbers and credentials are never logged in full.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const PRE_ARRIVAL_WINDOW_DAYS = 2   // evaluateSessionPhase: pre_arrival if within 2 days
const PRE_SEND_WINDOW_HOURS   = 2   // send intro this many hours before check-in time
const LOOKBACK_DAYS           = 2   // tick: scan back this many days to catch missed sends
const TICK_BATCH_LIMIT        = 50  // max reservations processed per tick invocation

// Knowledge block types loaded for intro context.
// 'access' is loaded but credentials are NEVER included in message text.
const INTRO_BLOCK_TYPES = [
  'property_summary',
  'check_in',
  'access',
  'house_rules',
  'tourist_tax',
  'fallback_support',
] as const

// ── Types ─────────────────────────────────────────────────────────────────

type SessionPhase  = 'pre_arrival' | 'check_in' | 'in_stay' | 'check_out' | 'post_stay'
// Canonical values from concierge-resolver — 'closed' confirmed as valid terminal state.
type SessionStatus = 'active' | 'waiting' | 'closed' | 'escalated'

type ProcessResult =
  | { ok: true; skipped: false; reservation_id: string; conversation_id: string; message_id: string; session_id: string; message_preview: string }
  | { ok: true; skipped: true; reason: string }
  | { ok: false; error: string; status: number; code?: string | null }

type TickSummary = {
  ok:              true
  mode:            'tick'
  processed:       number
  sent:            number
  skipped:         number
  too_early:       number
  errors:          number
  sessions_closed: number
}

// ── Helpers ───────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Phase evaluation — matches concierge-resolver evaluateSessionPhase exactly.
// todayStr must be a YYYY-MM-DD date string in Europe/Rome timezone.
function evaluateSessionPhase(
  checkinDate:  string,
  checkoutDate: string,
  todayStr:     string,
): SessionPhase {
  const today    = new Date(todayStr)
  const checkin  = new Date(checkinDate)
  const checkout = new Date(checkoutDate)
  const msPerDay = 86_400_000

  const daysToCheckin  = Math.round((checkin.getTime()  - today.getTime()) / msPerDay)
  const daysToCheckout = Math.round((checkout.getTime() - today.getTime()) / msPerDay)

  if (daysToCheckin > 0 && daysToCheckin <= PRE_ARRIVAL_WINDOW_DAYS) return 'pre_arrival'
  if (daysToCheckin === 0)                                            return 'check_in'
  if (daysToCheckin < 0 && daysToCheckout > 0)                       return 'in_stay'
  if (daysToCheckout === 0)                                           return 'check_out'
  return 'post_stay'
}

// Format a YYYY-MM-DD date string to a readable form: "Tuesday, 15 July 2026".
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T12:00:00Z')
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day:     'numeric',
      month:   'long',
      year:    'numeric',
    })
  } catch {
    return dateStr
  }
}

function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? fullName.trim()
  return first || fullName.trim()
}

function trimBulletList(text: string, maxLines = 3): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length <= maxLines) return lines.join('\n')
  return lines.slice(0, maxLines).join('\n') + '\n...'
}

// Returns YYYY-MM-DD for dateStr minus the given number of days.
// Uses noon UTC to avoid any timezone edge cases near midnight.
function subtractDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Determine whether now is within the send window for a given check-in.
//
// Returns 'send' when:
//   - check-in date is in the past (catch-up send for missed ticks)
//   - check-in date is today and current Rome time >= (checkin_time - PRE_SEND_WINDOW_HOURS)
//   - check-in time is missing or unparseable (fail-safe: always send on check-in day)
//
// Returns 'too_early' when check-in is today but the threshold hasn't been reached,
// or when check-in date is in the future.
//
// checkinTime must be in HH:MM format (from properties.checkin_time).
// Time comparison is performed in Europe/Rome to avoid DST issues.
function isWithinSendWindow(
  checkinDateStr: string,   // YYYY-MM-DD, Rome date
  checkinTime:    string | null,
  todayStr:       string,   // YYYY-MM-DD, Rome date
  nowIso:         string,   // UTC ISO timestamp
): 'send' | 'too_early' {
  // Past check-in date: catch-up for outage resilience
  if (checkinDateStr < todayStr) return 'send'
  // Future check-in date: not yet eligible
  if (checkinDateStr > todayStr) return 'too_early'

  // Check-in is today — apply the PRE_SEND_WINDOW_HOURS threshold if time is known
  if (!checkinTime) return 'send'
  const match = checkinTime.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 'send'

  const checkinTotalMinutes = parseInt(match[1], 10) * 60 + parseInt(match[2], 10)
  const thresholdMinutes    = checkinTotalMinutes - PRE_SEND_WINDOW_HOURS * 60

  const nowRome  = new Date(nowIso).toLocaleTimeString('en-CA', {
    timeZone: 'Europe/Rome',
    hour:     '2-digit',
    minute:   '2-digit',
    hour12:   false,
  })
  const [nowH, nowM] = nowRome.split(':').map(Number)
  const nowMinutes   = nowH * 60 + nowM

  return nowMinutes >= thresholdMinutes ? 'send' : 'too_early'
}

// Build the intro message text from loaded context.
//
// Sprint 014A/014B rules:
//   - No credentials (key_box_code, wifi_password, gate/parking codes)
//   - Use guest first name if available
//   - Include check-in window (checkin_from / checkin_until) from KB check_in block
//   - Include top 3 house rules if present
//   - Always include 24/7 support statement
function buildIntroMessage(params: {
  guestName:         string
  propertyName:      string
  propertyType:      string
  checkinDate:       string
  checkoutDate:      string
  checkinFrom:       string | null
  checkinUntil:      string | null
  checkoutBy:        string | null
  houseRulesSummary: string | null
}): string {
  const {
    guestName,
    propertyName,
    checkinDate,
    checkoutDate,
    checkinFrom,
    checkinUntil,
    checkoutBy,
    houseRulesSummary,
  } = params

  const name     = guestName && guestName.trim() ? firstName(guestName) : null
  const greeting = name ? `Hello ${name}!` : 'Hello!'
  const lines: string[] = []

  lines.push(greeting)
  lines.push('')
  lines.push(`I am Nauxica, your AI concierge at ${propertyName} during your stay.`)
  lines.push('')

  let checkinLine = `Your check-in is on ${formatDate(checkinDate)}`
  if (checkinFrom && checkinUntil) {
    checkinLine += ` from ${checkinFrom} to ${checkinUntil}`
  } else if (checkinFrom) {
    checkinLine += ` from ${checkinFrom}`
  }
  lines.push(checkinLine + '.')

  let checkoutLine = `Your checkout is on ${formatDate(checkoutDate)}`
  if (checkoutBy) checkoutLine += ` by ${checkoutBy}`
  lines.push(checkoutLine + '.')

  if (houseRulesSummary && houseRulesSummary.trim()) {
    lines.push('')
    lines.push('A few things to keep in mind:')
    lines.push(trimBulletList(houseRulesSummary, 3))
  }

  lines.push('')
  lines.push(
    'I am available 24/7 throughout your stay for anything you need — ' +
    'property questions and appliance guides, local restaurant and activity recommendations, ' +
    'transfers and transport, and any other support.',
  )
  lines.push('')
  lines.push(`Looking forward to your visit at ${propertyName}!`)

  return lines.join('\n')
}

// Find or create a conversations row for a reservation.
// Mirrors concierge-resolver findOrCreateConversation exactly.
async function findOrCreateConversation(
  svcClient:     SupabaseClient,
  reservationId: string,
  propertyId:    string,
  ownerId:       string,
): Promise<string | null> {
  const { data: existing } = await svcClient
    .from('conversations')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: created, error: createErr } = await svcClient
    .from('conversations')
    .insert({ reservation_id: reservationId, property_id: propertyId, owner_id: ownerId })
    .select('id')
    .single()

  if (createErr || !created) {
    console.error('[is] conversations INSERT error', {
      code:    createErr?.code    ?? null,
      message: createErr?.message ?? null,
    })
    return null
  }

  return created.id
}

// ── processReservation ────────────────────────────────────────────────────
//
// Core per-reservation logic. Called by both manual mode and tick mode.
//
// Amended Sprint 014B flow order:
//   1. Load + validate reservation
//   2. Idempotency check  ← exits immediately if intro already sent
//   3. Load property      ← needed for owner_id and checkin_time
//   4. Timing window      ← uses property.checkin_time (scheduling gate)
//   5. Load KB blocks     ← checkin_from/checkin_until used for message display
//   6. Load emergency context
//   7. Build message text
//   8. Find or create conversation
//   9. Insert message
//  10. Upsert WhatsApp session
//  11. Return structured result

async function processReservation(
  svcClient:     SupabaseClient,
  reservationId: string,
  todayStr:      string,
  nowIso:        string,
): Promise<ProcessResult> {

  // ── 1. Load + validate reservation ───────────────────────────────────────
  const { data: reservation, error: resErr } = await svcClient
    .from('reservations')
    .select('id, property_id, guest_name, guest_phone, guest_count, checkin_date, checkout_date, confirmation_number, reservation_status, special_requests')
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    console.error('[is] reservation not found', { reservation_id: reservationId })
    return { ok: false, error: 'Reservation not found', status: 404 }
  }

  if (!['confirmed', 'pre_arrival', 'checked_in'].includes(reservation.reservation_status)) {
    console.log('[is] reservation not eligible', {
      reservation_id: reservationId,
      status:         reservation.reservation_status,
    })
    return {
      ok:     false,
      error:  `Reservation status '${reservation.reservation_status}' is not eligible for intro message`,
      status: 422,
    }
  }

  if (!reservation.guest_phone) {
    return { ok: false, error: 'Reservation is missing guest_phone', status: 422 }
  }
  if (!reservation.property_id) {
    return { ok: false, error: 'Reservation is missing property_id', status: 422 }
  }

  const propertyId = reservation.property_id as string
  console.log('[is] reservation loaded', { reservation_id: reservationId, property_id: propertyId })

  // ── 2. Idempotency check ──────────────────────────────────────────────────
  // Exits immediately if a conversation for this reservation already has an AI message.
  // Must run before loading KB blocks or performing any further work.
  const { data: existingConv } = await svcClient
    .from('conversations')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (existingConv?.id) {
    const { data: existingIntro } = await svcClient
      .from('messages')
      .select('id')
      .eq('conversation_id', existingConv.id)
      .eq('sender_type', 'ai')
      .limit(1)
      .maybeSingle()

    if (existingIntro?.id) {
      console.log('[is] intro already sent, skipping', { reservation_id: reservationId })
      return { ok: true, skipped: true, reason: 'welcome_already_sent' }
    }
  }

  // ── 3. Load property ──────────────────────────────────────────────────────
  // checkin_time is used as the scheduling gate in the timing window check.
  const { data: property, error: propErr } = await svcClient
    .from('properties')
    .select('id, owner_id, display_name, property_type, address_city, checkin_time')
    .eq('id', propertyId)
    .single()

  if (propErr || !property) {
    console.error('[is] property not found', { property_id: propertyId })
    return { ok: false, error: 'Property not found', status: 404 }
  }

  // ── 4. Timing window check ────────────────────────────────────────────────
  // Uses property.checkin_time (HH:MM) as the scheduling gate.
  // KB check_in.checkin_from is used later for message display only.
  // Fail-safe: if checkin_time is null or unparseable, proceed immediately.
  const windowDecision = isWithinSendWindow(
    reservation.checkin_date as string,
    (property.checkin_time as string | null) ?? null,
    todayStr,
    nowIso,
  )

  if (windowDecision === 'too_early') {
    console.log('[is] too early, skipping', {
      reservation_id: reservationId,
      checkin_date:   reservation.checkin_date,
      checkin_time:   property.checkin_time ?? null,
    })
    return { ok: true, skipped: true, reason: 'too_early' }
  }

  // ── 5. Load knowledge blocks ──────────────────────────────────────────────
  // PTR and INT visibility scopes are never exposed in guest context.
  const { data: kbRows, error: kbErr } = await svcClient
    .from('property_knowledge_blocks')
    .select('block_type, content_jsonb, visibility_scope')
    .eq('property_id', propertyId)
    .in('block_type', INTRO_BLOCK_TYPES)
    .eq('is_active', true)

  if (kbErr) {
    console.warn('[is] knowledge blocks load error', {
      code:    kbErr.code,
      message: kbErr.message,
    })
  }

  const blocks: Record<string, Record<string, unknown>> = {}
  for (const row of (kbRows ?? [])) {
    if (row.visibility_scope === 'PTR' || row.visibility_scope === 'INT') continue
    blocks[row.block_type as string] = row.content_jsonb as Record<string, unknown>
  }

  console.log('[is] knowledge blocks loaded', {
    property_id: propertyId,
    block_types: Object.keys(blocks),
  })

  // ── 6. Load emergency context (parallel) ─────────────────────────────────
  const [edResult, ecResult] = await Promise.allSettled([
    svcClient
      .from('emergency_data')
      .select('is_complete, owner_emergency_name, owner_emergency_phone')
      .eq('property_id', propertyId)
      .maybeSingle(),
    svcClient
      .from('emergency_contacts')
      .select('contact_type, contact_name, contact_phone, escalation_priority')
      .eq('property_id', propertyId)
      .eq('is_active', true)
      .eq('guest_visible', true)
      .eq('ai_usable', true)
      .order('escalation_priority', { ascending: true }),
  ])

  const emergencyData         = edResult.status === 'fulfilled' ? edResult.value.data : null
  const emergencyContactCount = ecResult.status === 'fulfilled' ? (ecResult.value.data?.length ?? 0) : 0

  console.log('[is] emergency context loaded', {
    property_id:         propertyId,
    emergency_complete:  emergencyData?.is_complete ?? false,
    guest_contact_count: emergencyContactCount,
  })

  // ── 7. Build intro message text ───────────────────────────────────────────
  // checkin_from / checkin_until / checkout_by come from KB check_in block (display values).
  // property.checkin_time was used only for the scheduling gate above — not used here.
  const checkInBlock    = blocks['check_in']    as Record<string, unknown> | undefined
  const houseRulesBlock = blocks['house_rules'] as Record<string, unknown> | undefined

  const introText = buildIntroMessage({
    guestName:         (reservation.guest_name as string) ?? '',
    propertyName:      property.display_name as string,
    propertyType:      (property.property_type as string) ?? '',
    checkinDate:       reservation.checkin_date as string,
    checkoutDate:      reservation.checkout_date as string,
    checkinFrom:       (checkInBlock?.checkin_from    as string | null | undefined) ?? null,
    checkinUntil:      (checkInBlock?.checkin_until   as string | null | undefined) ?? null,
    checkoutBy:        (checkInBlock?.checkout_by     as string | null | undefined) ?? null,
    houseRulesSummary: (houseRulesBlock?.house_rules_summary as string | null | undefined) ?? null,
  })

  // ── 8. Find or create conversation ───────────────────────────────────────
  const conversationId = await findOrCreateConversation(
    svcClient, reservationId, propertyId, property.owner_id as string,
  )

  if (!conversationId) {
    return { ok: false, error: 'Failed to find or create conversation', status: 500 }
  }

  // ── 9. Insert message ─────────────────────────────────────────────────────
  const { data: messageRow, error: msgErr } = await svcClient
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type:     'ai',
      message_text:    introText,
    })
    .select('id')
    .single()

  if (msgErr || !messageRow) {
    console.error('[is] messages INSERT error', {
      code:    msgErr?.code    ?? null,
      message: msgErr?.message ?? null,
      details: msgErr?.details ?? null,
      hint:    msgErr?.hint    ?? null,
    })
    return {
      ok:     false,
      error:  msgErr?.message ?? 'Failed to insert intro message',
      code:   msgErr?.code    ?? null,
      status: 500,
    }
  }

  const messageId = messageRow.id as string
  console.log('[is] intro message inserted', {
    message_id: messageId,
    char_count: introText.length,
  })

  // ── 10. Upsert WhatsApp session ───────────────────────────────────────────
  const phase = evaluateSessionPhase(
    reservation.checkin_date as string,
    reservation.checkout_date as string,
    todayStr,
  )
  console.log('[is] session phase', { phase, reservation_id: reservationId })

  const { data: existingSession } = await svcClient
    .from('whatsapp_sessions')
    .select('id, session_status')
    .eq('guest_phone', reservation.guest_phone)
    .eq('reservation_id', reservationId)
    .in('session_status', ['active', 'waiting', 'escalated'])
    .maybeSingle()

  let sessionId: string

  if (existingSession) {
    const { error: sessUpdErr } = await svcClient
      .from('whatsapp_sessions')
      .update({
        session_status:  'active' as SessionStatus,
        session_phase:   phase,
        last_message_at: nowIso,
      })
      .eq('id', existingSession.id)

    if (sessUpdErr) {
      console.warn('[is] whatsapp_sessions UPDATE error', {
        code:    sessUpdErr.code,
        message: sessUpdErr.message,
      })
    }

    sessionId = existingSession.id as string
    console.log('[is] whatsapp_sessions updated to active', { session_id: sessionId, phase })
  } else {
    const { data: newSession, error: sessInsErr } = await svcClient
      .from('whatsapp_sessions')
      .insert({
        guest_phone:     reservation.guest_phone,
        reservation_id:  reservationId,
        property_id:     propertyId,
        session_status:  'active' as SessionStatus,
        session_phase:   phase,
        last_message_at: nowIso,
      })
      .select('id')
      .single()

    if (sessInsErr || !newSession) {
      console.error('[is] whatsapp_sessions INSERT error', {
        code:    sessInsErr?.code    ?? null,
        message: sessInsErr?.message ?? null,
      })
      return { ok: false, error: 'Failed to create WhatsApp session', status: 500 }
    }

    sessionId = newSession.id as string
    console.log('[is] whatsapp_sessions created', { session_id: sessionId, phase })
  }

  // ── 11. WhatsApp send placeholder (Sprint 015: replace with Twilio) ───────
  const phonePfx = (reservation.guest_phone as string).slice(0, 5)
  console.log('[is] PLACEHOLDER intro message queued — real Twilio send deferred to Sprint 015', {
    phone_prefix: phonePfx,
    char_count:   introText.length,
  })

  console.log('[is] success', {
    reservation_id: reservationId,
    property_id:    propertyId,
    phase,
    skipped:        false,
    sent:           true,
  })

  return {
    ok:              true,
    skipped:         false,
    reservation_id:  reservationId,
    conversation_id: conversationId,
    message_id:      messageId,
    session_id:      sessionId,
    message_preview: introText.slice(0, 300),
  }
}

// ── closeStaleSessions ────────────────────────────────────────────────────
//
// Closes all active/waiting/escalated WhatsApp sessions whose linked
// reservation checkout_date has strictly passed (i.e. < todayStr).
// Sets session_status = 'closed' and session_phase = 'post_stay'.
// Returns the number of sessions closed.

async function closeStaleSessions(
  svcClient: SupabaseClient,
  todayStr:  string,
): Promise<number> {
  // Step 1: collect reservation IDs whose checkout date has passed
  const { data: staleRes, error: resErr } = await svcClient
    .from('reservations')
    .select('id')
    .lt('checkout_date', todayStr)
    .limit(200)

  if (resErr) {
    console.warn('[is] closeStaleSessions: reservations query failed', {
      code:    resErr.code,
      message: resErr.message,
    })
    return 0
  }

  if (!staleRes?.length) return 0

  const staleIds = (staleRes as { id: string }[]).map(r => r.id)

  // Step 2: bulk-close their sessions
  const { data: closed, error: closeErr } = await svcClient
    .from('whatsapp_sessions')
    .update({
      session_status: 'closed' as SessionStatus,
      session_phase:  'post_stay' as SessionPhase,
      updated_at:     new Date().toISOString(),
    })
    .in('session_status', ['active', 'waiting', 'escalated'])
    .in('reservation_id', staleIds)
    .select('id')

  if (closeErr) {
    console.warn('[is] closeStaleSessions: UPDATE failed', {
      code:    closeErr.code,
      message: closeErr.message,
    })
    return 0
  }

  const count = (closed as { id: string }[] | null)?.length ?? 0
  if (count > 0) {
    console.log('[is] stale sessions closed', { count, today: todayStr })
  }
  return count
}

// ── runTick ───────────────────────────────────────────────────────────────
//
// Tick mode entry point. Called when body.mode === 'tick'.
//
// 1. Broad eligibility scan: checkin_date in [today - LOOKBACK_DAYS, today]
//    with status in (confirmed, pre_arrival, checked_in).
//    The look-back window ensures missed ticks are caught on recovery.
//
// 2. For each candidate: call processReservation(), which applies
//    idempotency and timing checks before doing any work.
//
// 3. Close stale sessions where checkout_date < today.

async function runTick(
  svcClient: SupabaseClient,
  todayStr:  string,
  nowIso:    string,
): Promise<TickSummary> {
  const windowStart = subtractDays(todayStr, LOOKBACK_DAYS)

  console.log('[is] tick start', {
    today:        todayStr,
    window_start: windowStart,
    limit:        TICK_BATCH_LIMIT,
  })

  const { data: candidates, error: scanErr } = await svcClient
    .from('reservations')
    .select('id')
    .in('reservation_status', ['confirmed', 'pre_arrival', 'checked_in'])
    .gte('checkin_date', windowStart)
    .lte('checkin_date', todayStr)
    .limit(TICK_BATCH_LIMIT)

  if (scanErr) {
    console.error('[is] tick: reservations scan failed', {
      code:    scanErr.code,
      message: scanErr.message,
    })
    return {
      ok: true, mode: 'tick',
      processed: 0, sent: 0, skipped: 0, too_early: 0, errors: 1, sessions_closed: 0,
    }
  }

  const summary: TickSummary = {
    ok: true, mode: 'tick',
    processed: 0, sent: 0, skipped: 0, too_early: 0, errors: 0, sessions_closed: 0,
  }

  for (const { id } of ((candidates ?? []) as { id: string }[])) {
    summary.processed++
    const result = await processReservation(svcClient, id, todayStr, nowIso)

    if (!result.ok) {
      summary.errors++
      console.warn('[is] tick: reservation error', {
        reservation_id: id,
        error:          result.error,
      })
    } else if (result.skipped) {
      if (result.reason === 'too_early') {
        summary.too_early++
      } else {
        summary.skipped++
      }
    } else {
      summary.sent++
    }
  }

  summary.sessions_closed = await closeStaleSessions(svcClient, todayStr)

  console.log('[is] tick complete', summary)
  return summary
}

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  console.log('[is] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[is] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  let body: { reservation_id?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    console.error('[is] body parse failed')
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const nowIso   = new Date().toISOString()

  // ── Tick mode ─────────────────────────────────────────────────────────
  if (body.mode === 'tick') {
    console.log('[is] tick mode invoked', { today: todayStr })
    const summary = await runTick(svcClient, todayStr, nowIso)
    return json(summary)
  }

  // ── Manual mode ───────────────────────────────────────────────────────
  const reservationId = body.reservation_id
  if (!reservationId || typeof reservationId !== 'string') {
    return json({ error: 'reservation_id is required, or pass {"mode":"tick"}' }, 400)
  }

  console.log('[is] manual mode', { reservation_id: reservationId })
  const result = await processReservation(svcClient, reservationId, todayStr, nowIso)

  if (!result.ok) {
    return json({ error: result.error, code: result.code ?? undefined }, result.status)
  }

  // Manual mode returns the same shape as Sprint 014A for backward compatibility.
  return json(result)
})
