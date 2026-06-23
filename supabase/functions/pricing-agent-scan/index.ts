// supabase/functions/pricing-agent-scan/index.ts
// Sprint 023B — Pricing Agent MVP: Occupancy Gap Detection
//
// Scans confirmed/checked-in reservations per property for gaps of 2+ nights
// between a checkout and the next checkin, within a 60-day look-ahead window,
// and records each gap as a timeline_events row for the homeowner to see.
//
// Internal data only — no Airbnb/Booking.com data, no market scraping, no
// external APIs. No pricing recommendation is produced; this only detects
// and surfaces the gap.
//
// Trigger: manual POST only. No automation, no cron wiring in this sprint.
// Auth: service_role only — this is an internal/admin scan, not a homeowner-
// facing write proxy, so no homeowner JWT is required (same pattern as
// intro-scheduler).
//
// Logging policy: property_id, dates, and gap metrics are logged freely —
// no guest PII (name/phone/email) is read or logged by this function.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')              ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Reservation statuses relevant to the forward-looking booking calendar.
// 'checked_in' is included because a currently-staying guest's checkout date
// still anchors a possible future gap.
const RELEVANT_STATUSES = ['confirmed', 'checked_in']

const LOOKAHEAD_DAYS  = 60   // only flag gaps that START within this window
const MIN_GAP_NIGHTS  = 2    // gaps shorter than this are not worth surfacing

// ── Types ────────────────────────────────────────────────────────────────

type ReservationRow = {
  id:            string
  property_id:   string
  checkin_date:  string
  checkout_date: string
}

type GapCandidate = {
  property_id:       string
  gap_start:         string
  gap_end:           string
  gap_nights:        number
  previous_checkout: string
  next_checkin:      string
}

// ── Helpers ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Whole-day difference between two YYYY-MM-DD date strings (b - a).
function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000
  const da = new Date(a + 'T00:00:00Z').getTime()
  const db = new Date(b + 'T00:00:00Z').getTime()
  return Math.round((db - da) / msPerDay)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Groups reservations by property_id, preserving the ascending checkin_date
// order they were fetched in.
function groupByProperty(rows: ReservationRow[]): Map<string, ReservationRow[]> {
  const map = new Map<string, ReservationRow[]>()
  for (const row of rows) {
    const list = map.get(row.property_id)
    if (list) list.push(row)
    else map.set(row.property_id, [row])
  }
  return map
}

// Walks consecutive reservation pairs per property and returns gap candidates
// of at least MIN_GAP_NIGHTS that start within the look-ahead window.
function findGaps(rows: ReservationRow[], windowEnd: string): GapCandidate[] {
  const gaps: GapCandidate[] = []
  const byProperty = groupByProperty(rows)

  for (const [propertyId, reservations] of byProperty) {
    for (let i = 0; i < reservations.length - 1; i++) {
      const prev = reservations[i]
      const next = reservations[i + 1]

      const gapNights = daysBetween(prev.checkout_date, next.checkin_date)
      if (gapNights < MIN_GAP_NIGHTS) continue
      if (prev.checkout_date > windowEnd) continue

      gaps.push({
        property_id:       propertyId,
        gap_start:         prev.checkout_date,
        gap_end:           next.checkin_date,
        gap_nights:        gapNights,
        previous_checkout: prev.checkout_date,
        next_checkin:      next.checkin_date,
      })
    }
  }

  return gaps
}

// ── Handler ──────────────────────────────────────────────────────────────

serve(async (req) => {
  console.log('[pas] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[pas] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const todayStr  = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const windowEnd = addDays(todayStr, LOOKAHEAD_DAYS)

  console.log('[pas] scan window', { todayStr, windowEnd, lookaheadDays: LOOKAHEAD_DAYS })

  // ── 1. Fetch reservations relevant to the forward-looking calendar ──────
  const { data: reservations, error: resErr } = await svcClient
    .from('reservations')
    .select('id, property_id, checkin_date, checkout_date')
    .in('reservation_status', RELEVANT_STATUSES)
    .gte('checkout_date', todayStr)
    .order('checkin_date', { ascending: true })

  if (resErr) {
    console.error('[pas] reservations query failed', { error: resErr.message })
    return json({ error: 'Failed to load reservations', details: resErr.message }, 500)
  }

  const rows = (reservations ?? []) as ReservationRow[]
  console.log('[pas] reservations loaded', { count: rows.length })

  // ── 2. Detect gap candidates ────────────────────────────────────────────
  const candidates = findGaps(rows, windowEnd)
  console.log('[pas] gap candidates found', { count: candidates.length })

  // ── 3. Dedup + insert ───────────────────────────────────────────────────
  let eventsCreated = 0
  let eventsSkipped  = 0
  const errors: string[] = []

  for (const gap of candidates) {
    const { data: existing, error: existErr } = await svcClient
      .from('timeline_events')
      .select('id')
      .eq('event_type', 'occupancy_gap_detected')
      .eq('property_id', gap.property_id)
      .eq('metadata->>gap_start', gap.gap_start)
      .eq('metadata->>gap_end', gap.gap_end)
      .maybeSingle()

    if (existErr) {
      console.error('[pas] dedup check failed', { property_id: gap.property_id, error: existErr.message })
      errors.push(`dedup check failed for ${gap.property_id}: ${existErr.message}`)
      continue
    }

    if (existing) {
      eventsSkipped++
      console.log('[pas] duplicate:skipped', { property_id: gap.property_id, gap_start: gap.gap_start, gap_end: gap.gap_end })
      continue
    }

    const { error: insertErr } = await svcClient
      .from('timeline_events')
      .insert({
        property_id:     gap.property_id,
        reservation_id:  null,
        conversation_id: null,
        task_id:         null,
        actor_id:        null,
        actor_type:      'ai',
        event_type:      'occupancy_gap_detected',
        event_title:     `Nauxica Pricing Agent: ${gap.gap_nights}-night occupancy gap detected`,
        metadata: {
          gap_start:         gap.gap_start,
          gap_end:           gap.gap_end,
          gap_nights:        gap.gap_nights,
          previous_checkout: gap.previous_checkout,
          next_checkin:      gap.next_checkin,
          source:            'pricing_agent',
        },
      })

    if (insertErr) {
      console.error('[pas] insert failed', { property_id: gap.property_id, error: insertErr.message })
      errors.push(`insert failed for ${gap.property_id}: ${insertErr.message}`)
      continue
    }

    eventsCreated++
    console.log('[pas] event created', { property_id: gap.property_id, gap_start: gap.gap_start, gap_end: gap.gap_end, gap_nights: gap.gap_nights })
  }

  console.log('[pas] scan complete', {
    properties_scanned: groupByProperty(rows).size,
    gaps_found:          candidates.length,
    events_created:      eventsCreated,
    events_skipped:      eventsSkipped,
    error_count:         errors.length,
  })

  return json({
    ok:                  true,
    properties_scanned:  groupByProperty(rows).size,
    gaps_found:          candidates.length,
    events_created:      eventsCreated,
    events_skipped:      eventsSkipped,
    errors:              errors.length ? errors : undefined,
  })
})
