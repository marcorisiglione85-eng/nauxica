// supabase/functions/intro-scheduler/index.ts
// Sprint 014A — Manual Concierge Intro Composer
//
// Manually triggered via HTTP POST. Generates and persists the concierge welcome
// message for a confirmed reservation. Does NOT send real WhatsApp messages.
// Does NOT use OpenAI. Does NOT use cron. Does NOT create migrations.
//
// Request body: { "reservation_id": "uuid" }
//
// Flow:
//   1. Validate POST + env vars
//   2. Load reservation → reject if not found / wrong status / missing phone or property
//   3. Load linked property
//   4. Idempotency check: if conversation already has AI intro message, return skipped
//   5. Load property_knowledge_blocks (6 types: property_summary, check_in, access,
//      house_rules, tourist_tax, fallback_support)
//   6. Load emergency_data and emergency_contacts (parallel)
//   7. Build intro message text — NO credentials included (Sprint 014A safe default)
//   8. Find or create conversations row
//   9. Insert messages row (sender_type='ai')
//  10. Upsert whatsapp_sessions (active, correct phase)
//  11. Log WhatsApp placeholder (no real send — Sprint 015)
//  12. Return structured response
//
// Uses service_role client only — bypasses RLS for all writes.
// Commission, partner, revenue, and financial data are never read or returned.
// Phone numbers and credentials are never logged in full.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const PRE_ARRIVAL_WINDOW_DAYS = 2

// Knowledge block types to load for intro context.
// 'access' is loaded but credentials are NEVER included in Sprint 014A message text.
const INTRO_BLOCK_TYPES = [
  'property_summary',
  'check_in',
  'access',
  'house_rules',
  'tourist_tax',
  'fallback_support',
] as const

// ── Types ─────────────────────────────────────────────────────────────────

type SessionPhase = 'pre_arrival' | 'check_in' | 'in_stay' | 'check_out' | 'post_stay'

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
// Uses noon UTC to avoid timezone edge cases near midnight.
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

// Extract the first name from a full name string.
// Returns the full name trimmed if splitting produces nothing useful.
function firstName(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0] ?? fullName.trim()
  return first || fullName.trim()
}

// Trim a multi-line bullet list to the first maxLines lines.
// Appends a continuation note if lines were truncated.
function trimBulletList(text: string, maxLines = 3): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length <= maxLines) return lines.join('\n')
  return lines.slice(0, maxLines).join('\n') + '\n...'
}

// Build the intro message text from loaded context.
//
// Sprint 014A rules:
//   - No credentials (key_box_code, wifi_password) — always closed gate
//   - No access codes, gate codes, or parking codes
//   - Use guest name for greeting if available
//   - Include check-in time if present in check_in block
//   - Include top 3 house rules if present
//   - Always include 24/7 support statement
function buildIntroMessage(params: {
  guestName:       string
  propertyName:    string
  propertyType:    string
  checkinDate:     string
  checkoutDate:    string
  checkinFrom:     string | null
  checkinUntil:    string | null
  checkoutBy:      string | null
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

  const name = guestName && guestName.trim() ? firstName(guestName) : null
  const greeting = name ? `Hello ${name}!` : 'Hello!'

  const checkinFormatted  = formatDate(checkinDate)
  const checkoutFormatted = formatDate(checkoutDate)

  const lines: string[] = []

  lines.push(greeting)
  lines.push('')
  lines.push(`I am Nauxica, your AI concierge at ${propertyName} during your stay.`)
  lines.push('')

  // Check-in details
  let checkinLine = `Your check-in is on ${checkinFormatted}`
  if (checkinFrom && checkinUntil) {
    checkinLine += ` from ${checkinFrom} to ${checkinUntil}`
  } else if (checkinFrom) {
    checkinLine += ` from ${checkinFrom}`
  }
  checkinLine += '.'
  lines.push(checkinLine)

  // Checkout date
  let checkoutLine = `Your checkout is on ${checkoutFormatted}`
  if (checkoutBy) {
    checkoutLine += ` by ${checkoutBy}`
  }
  checkoutLine += '.'
  lines.push(checkoutLine)

  // House rules (top 3)
  if (houseRulesSummary && houseRulesSummary.trim()) {
    lines.push('')
    lines.push('A few things to keep in mind:')
    lines.push(trimBulletList(houseRulesSummary, 3))
  }

  // 24/7 support
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
// Returns the conversation id, or null on failure.
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

// ── Main handler ──────────────────────────────────────────────────────────

serve(async (req) => {
  console.log('[is] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  // ── 1. Env check ──────────────────────────────────────────────────────
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[is] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  // parse body (step 1 continued)
  let body: { reservation_id?: string }
  try {
    body = await req.json()
  } catch {
    console.error('[is] body parse failed')
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const reservationId = body.reservation_id
  if (!reservationId || typeof reservationId !== 'string') {
    return json({ error: 'reservation_id is required' }, 400)
  }

  const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const nowStr   = new Date().toISOString()

  // ── 2. Load reservation ────────────────────────────────────────────────
  const { data: reservation, error: resErr } = await svcClient
    .from('reservations')
    .select('id, property_id, guest_name, guest_phone, guest_count, checkin_date, checkout_date, confirmation_number, reservation_status, special_requests')
    .eq('id', reservationId)
    .single()

  if (resErr || !reservation) {
    console.error('[is] reservation not found', { reservation_id: reservationId })
    return json({ error: 'Reservation not found' }, 404)
  }

  if (!['confirmed', 'pre_arrival'].includes(reservation.reservation_status)) {
    console.log('[is] reservation not eligible', {
      reservation_id: reservationId,
      status:         reservation.reservation_status,
    })
    return json({
      error:  `Reservation status '${reservation.reservation_status}' is not eligible for intro message`,
      status: reservation.reservation_status,
    }, 422)
  }

  if (!reservation.guest_phone) {
    return json({ error: 'Reservation is missing guest_phone' }, 422)
  }

  if (!reservation.property_id) {
    return json({ error: 'Reservation is missing property_id' }, 422)
  }

  const propertyId = reservation.property_id as string
  console.log('[is] reservation loaded', { reservation_id: reservationId, property_id: propertyId })

  // ── 3. Load linked property ────────────────────────────────────────────
  const { data: property, error: propErr } = await svcClient
    .from('properties')
    .select('id, owner_id, display_name, property_type, address_city')
    .eq('id', propertyId)
    .single()

  if (propErr || !property) {
    console.error('[is] property not found', { property_id: propertyId })
    return json({ error: 'Property not found' }, 404)
  }

  // ── 4. Idempotency check ───────────────────────────────────────────────
  // guest_stay_contexts does not exist in the live schema.
  // Use conversations + messages: if a conversation for this reservation already
  // has an AI message (sender_type='ai'), the intro was already sent — skip.
  const { data: existingConvCheck } = await svcClient
    .from('conversations')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (existingConvCheck?.id) {
    const { data: existingIntro } = await svcClient
      .from('messages')
      .select('id')
      .eq('conversation_id', existingConvCheck.id)
      .eq('sender_type', 'ai')
      .limit(1)
      .maybeSingle()

    if (existingIntro?.id) {
      console.log('[is] intro already sent, skipping', { reservation_id: reservationId })
      return json({ ok: true, skipped: true, reason: 'welcome_already_sent' })
    }
  }

  // ── 5. Load property_knowledge_blocks ─────────────────────────────────
  // Only PUB and GST scoped, only is_active=true rows.
  // PTR and INT blocks are filtered out — never exposed in guest context.
  const { data: kbRows, error: kbErr } = await svcClient
    .from('property_knowledge_blocks')
    .select('block_type, content_jsonb, visibility_scope')
    .eq('property_id', propertyId)
    .in('block_type', INTRO_BLOCK_TYPES)
    .eq('is_active', true)

  if (kbErr) {
    // Non-fatal: log and continue. Intro will be built with fewer details.
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
    property_id:  propertyId,
    block_types:  Object.keys(blocks),
  })

  // ── 6. Load emergency_data and emergency_contacts (parallel) ──────────
  // These are loaded to satisfy the full context contract, and for future use
  // (emergency contacts not included in Sprint 014A intro text).
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

  const emergencyData = edResult.status === 'fulfilled' ? edResult.value.data : null
  const emergencyContactCount =
    ecResult.status === 'fulfilled' ? (ecResult.value.data?.length ?? 0) : 0

  console.log('[is] emergency context loaded', {
    property_id:           propertyId,
    emergency_complete:    emergencyData?.is_complete ?? false,
    guest_contact_count:   emergencyContactCount,
  })

  // ── 7. Build intro message text ────────────────────────────────────────
  // Source fields from knowledge blocks (never from DB — only what the KBB exposes).
  // Sprint 014A: NO credentials are included (key_box_code, wifi_password, gate codes).
  const checkInBlock    = blocks['check_in']        as Record<string, unknown> | undefined
  const houseRulesBlock = blocks['house_rules']     as Record<string, unknown> | undefined

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

  // ── 8. Find or create conversations row ───────────────────────────────
  const conversationId = await findOrCreateConversation(
    svcClient,
    reservationId,
    propertyId,
    property.owner_id as string,
  )

  if (!conversationId) {
    return json({ error: 'Failed to find or create conversation' }, 500)
  }

  // ── 9. Insert messages row ─────────────────────────────────────────────
  // Uses the WhatsApp conversation messages schema (not the in-platform messages table).
  // Column names match concierge-resolver exactly: conversation_id, sender_type, message_text.
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
    return json({
      error:   msgErr?.message ?? 'Failed to insert intro message',
      code:    msgErr?.code    ?? null,
      hint:    msgErr?.hint    ?? null,
      details: msgErr?.details ?? null,
    }, 500)
  }

  const messageId = messageRow.id as string
  console.log('[is] intro message inserted', {
    message_id: messageId,
    char_count: introText.length,
    // message content is never logged — may contain property-specific info
  })

  // ── 10. Upsert whatsapp_sessions ──────────────────────────────────────
  // The unique partial index is: (guest_phone, reservation_id)
  //   WHERE session_status IN ('active', 'waiting', 'escalated')
  // We SELECT first to distinguish insert vs update, then act accordingly.
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
        session_status:  'active',
        session_phase:   phase,
        last_message_at: nowStr,
      })
      .eq('id', existingSession.id)

    if (sessUpdErr) {
      // Non-fatal: session state is a best-effort update at this stage
      console.warn('[is] whatsapp_sessions UPDATE error', {
        code:    sessUpdErr.code,
        message: sessUpdErr.message,
      })
    }

    sessionId = existingSession.id as string
    console.log('[is] whatsapp_sessions updated to active', {
      session_id: sessionId,
      phase,
    })
  } else {
    const { data: newSession, error: sessInsErr } = await svcClient
      .from('whatsapp_sessions')
      .insert({
        guest_phone:     reservation.guest_phone,
        reservation_id:  reservationId,
        property_id:     propertyId,
        session_status:  'active',
        session_phase:   phase,
        last_message_at: nowStr,
      })
      .select('id')
      .single()

    if (sessInsErr || !newSession) {
      console.error('[is] whatsapp_sessions INSERT error', {
        code:    sessInsErr?.code    ?? null,
        message: sessInsErr?.message ?? null,
      })
      return json({ error: 'Failed to create WhatsApp session' }, 500)
    }

    sessionId = newSession.id as string
    console.log('[is] whatsapp_sessions created', {
      session_id: sessionId,
      phase,
    })
  }

  // ── 11. WhatsApp send placeholder (Sprint 014A: log only) ──────────────
  // Sprint 015: replace this stub with Twilio Conversations API call.
  // Never log the full guest phone number — use first 5 chars only.
  const phonePfx = (reservation.guest_phone as string).slice(0, 5)
  console.log('[is] PLACEHOLDER intro message queued — real Twilio send deferred to Sprint 015', {
    phone_prefix: phonePfx,
    char_count:   introText.length,
  })

  // ── 12. Success ────────────────────────────────────────────────────────
  console.log('[is] success', {
    reservation_id: reservationId,
    property_id:    propertyId,
    phase,
    skipped:        false,
    sent:           true,
  })

  return json({
    ok:              true,
    reservation_id:  reservationId,
    conversation_id: conversationId,
    message_id:      messageId,
    session_id:      sessionId,
    message_preview: introText.slice(0, 300),
  })
})
