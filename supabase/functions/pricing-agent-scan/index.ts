// supabase/functions/pricing-agent-scan/index.ts
// Sprint 023B — Pricing Agent MVP: Occupancy Gap Detection
// Sprint 023C — Revenue Opportunity Alerts (ADR dip detection)
//
// Two independent detection passes over `reservations`, each writing its own
// timeline_events type:
//
//   1. occupancy_gap_detected — gaps of 2+ nights between a checkout and the
//      next checkin, within a 60-day look-ahead window (Sprint 023B).
//   2. revenue_value_dip_detected — a property's most recent valued
//      reservation priced 20%+ below the trailing average ADR of its own
//      prior history (Sprint 023C).
//
// Internal data only — no Airbnb/Booking.com data, no market scraping, no
// external APIs. Neither pass produces a pricing recommendation; both only
// detect and surface a pattern in the homeowner's own booking history.
//
// Trigger: manual POST only. No automation, no cron wiring in this sprint.
// Auth: service_role only — this is an internal/admin scan, not a homeowner-
// facing write proxy, so no homeowner JWT is required (same pattern as
// intro-scheduler).
//
// Logging policy: property_id, dates, and value/gap metrics are logged
// freely — no guest PII (name/phone/email) is read or logged by this
// function.

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

// Reservation statuses excluded from revenue/ADR history — these never
// represent a realized price.
const VALUE_EXCLUDED_STATUSES = ['cancelled', 'no_show']

const MIN_BASELINE_SAMPLE = 3     // minimum prior same-currency valued reservations required
const DIP_THRESHOLD_PCT   = 0.20  // candidate ADR must be at least this far below the baseline average

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

type ValuedReservationRow = {
  id:                         string
  property_id:                string
  checkin_date:               string
  nights:                     number
  reservation_value_amount:   number
  reservation_value_currency: string
}

type DipCandidate = {
  property_id:        string
  reservation_id:     string
  current_adr:        number
  historical_avg_adr: number
  delta_pct:          number
  sample_size:        number
  currency:           string
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

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// Groups rows by property_id, preserving the ascending checkin_date order
// they were fetched in. Generic over both reservation row shapes used here.
function groupByProperty<T extends { property_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
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

// For each property, evaluates only the single most recent valued reservation
// (by checkin_date) as a candidate against the trailing average ADR of its
// prior same-currency history. Requires at least MIN_BASELINE_SAMPLE prior
// reservations in that currency — properties without enough history are
// skipped entirely, not flagged with a low-confidence guess.
//
// TODO(023C MVP): "candidate" is the furthest-future checkin_date, not the
// most-recently-booked reservation — there's no created_at ordering here.
// Accepted as-is for this sprint; revisit if "most recent" should mean
// most-recently-booked instead of furthest-upcoming.
function findRevenueDips(rows: ValuedReservationRow[]): DipCandidate[] {
  const dips: DipCandidate[] = []
  const byProperty = groupByProperty(rows)

  for (const [propertyId, reservations] of byProperty) {
    if (reservations.length < MIN_BASELINE_SAMPLE + 1) continue

    const candidate = reservations[reservations.length - 1]
    const priors = reservations
      .slice(0, -1)
      .filter(r => r.reservation_value_currency === candidate.reservation_value_currency)

    if (priors.length < MIN_BASELINE_SAMPLE) continue

    const candidateAdr = candidate.reservation_value_amount / candidate.nights
    const baselineAvg  = priors.reduce((sum, r) => sum + r.reservation_value_amount / r.nights, 0) / priors.length

    if (baselineAvg <= 0) continue

    const deltaPct = (candidateAdr - baselineAvg) / baselineAvg
    if (deltaPct > -DIP_THRESHOLD_PCT) continue

    dips.push({
      property_id:        propertyId,
      reservation_id:     candidate.id,
      current_adr:        round2(candidateAdr),
      historical_avg_adr: round2(baselineAvg),
      delta_pct:          round2(deltaPct * 100),
      sample_size:        priors.length,
      currency:           candidate.reservation_value_currency,
    })
  }

  return dips
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

  // ── 4. Fetch valued reservations for revenue-dip detection ─────────────
  // Full non-cancelled/non-no_show history (past + future) — this builds
  // each property's own baseline ADR, not just the forward-looking window.
  const { data: valuedReservations, error: valErr } = await svcClient
    .from('reservations')
    .select('id, property_id, checkin_date, nights, reservation_value_amount, reservation_value_currency')
    .not('reservation_status', 'in', `(${VALUE_EXCLUDED_STATUSES.join(',')})`)
    .not('reservation_value_amount', 'is', null)
    .order('checkin_date', { ascending: true })

  if (valErr) {
    console.error('[pas] valued reservations query failed', { error: valErr.message })
    return json({ error: 'Failed to load valued reservations', details: valErr.message }, 500)
  }

  const valuedRows = (valuedReservations ?? []) as ValuedReservationRow[]
  console.log('[pas] valued reservations loaded', { count: valuedRows.length })

  // ── 5. Detect revenue dip candidates ────────────────────────────────────
  const dipCandidates = findRevenueDips(valuedRows)
  console.log('[pas] dip candidates found', { count: dipCandidates.length })

  // ── 6. Dedup + insert revenue dip events ────────────────────────────────
  let dipEventsCreated = 0
  let dipEventsSkipped = 0

  for (const dip of dipCandidates) {
    const { data: existingDip, error: existDipErr } = await svcClient
      .from('timeline_events')
      .select('id')
      .eq('event_type', 'revenue_value_dip_detected')
      .eq('property_id', dip.property_id)
      .eq('reservation_id', dip.reservation_id)
      .maybeSingle()

    if (existDipErr) {
      console.error('[pas] dip dedup check failed', { property_id: dip.property_id, error: existDipErr.message })
      errors.push(`dip dedup check failed for ${dip.property_id}: ${existDipErr.message}`)
      continue
    }

    if (existingDip) {
      dipEventsSkipped++
      console.log('[pas] dip duplicate:skipped', { property_id: dip.property_id, reservation_id: dip.reservation_id })
      continue
    }

    const { error: dipInsertErr } = await svcClient
      .from('timeline_events')
      .insert({
        property_id:     dip.property_id,
        reservation_id:  dip.reservation_id,
        conversation_id: null,
        task_id:         null,
        actor_id:        null,
        actor_type:      'ai',
        event_type:      'revenue_value_dip_detected',
        event_title:     `Nauxica Pricing Agent: revenue dip detected (${Math.abs(dip.delta_pct).toFixed(1)}% below average)`,
        metadata: {
          current_adr:        dip.current_adr,
          historical_avg_adr: dip.historical_avg_adr,
          delta_pct:          dip.delta_pct,
          sample_size:        dip.sample_size,
          currency:           dip.currency,
          source:             'pricing_agent',
        },
      })

    if (dipInsertErr) {
      console.error('[pas] dip insert failed', { property_id: dip.property_id, error: dipInsertErr.message })
      errors.push(`dip insert failed for ${dip.property_id}: ${dipInsertErr.message}`)
      continue
    }

    dipEventsCreated++
    console.log('[pas] dip event created', { property_id: dip.property_id, reservation_id: dip.reservation_id, delta_pct: dip.delta_pct })
  }

  console.log('[pas] scan complete', {
    properties_scanned: groupByProperty(rows).size,
    gaps_found:          candidates.length,
    events_created:      eventsCreated,
    events_skipped:      eventsSkipped,
    dips_found:          dipCandidates.length,
    dip_events_created:  dipEventsCreated,
    dip_events_skipped:  dipEventsSkipped,
    error_count:         errors.length,
  })

  return json({
    ok:                  true,
    properties_scanned:  groupByProperty(rows).size,
    gaps_found:          candidates.length,
    events_created:      eventsCreated,
    events_skipped:      eventsSkipped,
    dips_found:          dipCandidates.length,
    dip_events_created:  dipEventsCreated,
    dip_events_skipped:  dipEventsSkipped,
    errors:              errors.length ? errors : undefined,
  })
})
