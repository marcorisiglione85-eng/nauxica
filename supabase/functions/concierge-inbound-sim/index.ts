// supabase/functions/concierge-inbound-sim/index.ts
// Sprint 016A/016B — Inbound Concierge Simulation + Escalation Detection
// Sprint 019A.1 — resolveByPhone + DB loaders moved to concierge-resolver (extracted)
//
// Simulates an inbound guest message and returns a template-based AI reply.
// No LLM. No Twilio. No real WhatsApp. No external API calls of any kind.
// Query classification: rule-based keyword + priority matching (12 categories).
// Response: assembled from property_knowledge_blocks via ConciergeContext pipeline.
// Sprint 016B adds: escalation detection, task creation, conditional acknowledgement.
//
// Accepts:
//   mode:'simulate'      { reservation_id | conversation_id, guest_message, guest_phone?, mode:'simulate' }
//   mode:'inbound_phone' { guest_phone, guest_message, mode:'inbound_phone' } — resolves guest by phone number
// Returns:
//   SimResponse — reply + resolution metadata + persisted message IDs + escalation result
//
// Auth: service_role only — bypasses RLS for session, message, and task writes.
// Commission, partner, and financial data are never read or returned.
// guest_phone is never logged beyond first 5 chars.
//
// ── Non-fatal message INSERTs ─────────────────────────────────────────────
// Message persistence failures (guest + ai INSERTs) are intentionally
// non-fatal in simulation mode. Simulation is a dev/test tool — a DB write
// error must not mask the classifier/composer result, which is the primary
// output being validated. In the real inbound flow (Sprint 017+), message
// persistence will be promoted to fatal.
//
// ── created_by workaround (Sprint 016B) ──────────────────────────────────
// AI-created tasks use property.owner_id as created_by. This is a temporary
// workaround: tasks.created_by is NOT NULL FK → public.users.id, and
// public.users.account_type only allows 'homeowner' | 'partner'. A dedicated
// Nauxica Concierge system user requires adding 'system' to the account_type enum
// (one migration) and is deferred to Sprint 017. AI origin is marked via:
//   - tasks.description prefix: '[Nauxica Concierge]'
//   - timeline_events.actor_type: 'ai'
//   - timeline_events.metadata.source: 'guestpal_ai'  ← internal key, not changed
//
// ── Test payloads ────────────────────────────────────────────────────────
// Replace <RESERVATION_ID> and <CONVERSATION_ID> with real UUIDs.
//
// 1. reservation_id lookup — WiFi query (in_stay phase, gate open):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "What is the wifi password?", "mode": "simulate" }
//
// 2. conversation_id lookup — Check-out query:
//    POST /concierge-inbound-sim
//    { "conversation_id": "<CONVERSATION_ID>", "guest_message": "What time is checkout tomorrow?", "mode": "simulate" }
//
// 3. Access code — pre_arrival phase (expect SENTINEL response, no code shown):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "How do I get in? Where is the key box?", "mode": "simulate" }
//
// 4. Check-in query:
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "What time can I check in and how do I get to the property?", "mode": "simulate" }
//
// 5. Emergency query (expect emergency contacts + Italian numbers):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "I smell gas, what do I do — medical emergency", "mode": "simulate" }
//
// 6. House rules / unknown fallback (no keyword match → CAT-12):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "Hi, what can you tell me about this place?", "mode": "simulate" }
//
// 7. Check-out query (explicit checkout time):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "When do I have to leave and what are the checkout tasks?", "mode": "simulate" }
//
// 8. Unknown message (no keywords → CAT-12 fallback, confidence:low):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "Just saying hello", "mode": "simulate" }
//
// 9. Maintenance escalation (expect task created, acknowledgement appended):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "The hot water is not working in the shower", "mode": "simulate" }
//
// 10. Transfer escalation (expect guest_request task, category:transfer):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "Can you arrange a taxi to Catania airport at 7am tomorrow?", "mode": "simulate" }
//
// 11. Experience escalation (expect guest_request task, category:experience):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "Can you book a wine tasting tour for two people?", "mode": "simulate" }
//
// 12. Laundry escalation (expect laundry task):
//    POST /concierge-inbound-sim
//    { "reservation_id": "<RESERVATION_ID>", "guest_message": "We need extra towels and laundry service please", "mode": "simulate" }
//
// 13. inbound_phone — known guest (expect full concierge reply, session created/found):
//    POST /concierge-inbound-sim
//    { "guest_phone": "<GUEST_PHONE_E164>", "guest_message": "What is the WiFi password?", "mode": "inbound_phone" }
//
// 14. inbound_phone — unknown phone (expect neutral reply, unauthorized_guest_message event written):
//    POST /concierge-inbound-sim
//    { "guest_phone": "+39000000000", "guest_message": "What is the WiFi password?", "mode": "inbound_phone" }
//
// 15. inbound_phone — unverified guest (expect neutral reply, unverified_guest_message event written):
//    POST /concierge-inbound-sim
//    { "guest_phone": "<GUEST_PHONE_E164>", "guest_message": "What is the WiFi password?", "mode": "inbound_phone" }
//    (requires reservation with guest_phone_verified = false)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  evaluateSessionPhase,
  filterKnowledgeForGuest,
  filterKnowledgeByPhase,
  buildConciergeContext,
  normalizePhone,
  resolveByPhone,
  loadPropertyKnowledge,
  loadEmergencyData,
  loadEmergencyContacts,
  findOrCreateConversation,
} from '../concierge-resolver/index.ts'
import type {
  SessionStatus,
  SessionPhase,
  BlockType,
  VisibilityScope,
  RawBlock,
  EmergencyChunk,
  EmergencyContact,
  ConciergeContext,
  ResolvedInput,
  SimError,
} from '../concierge-resolver/index.ts'
import {
  classifyQuery,
  composeReply,
  detectEscalation,
  createTaskIfNeeded,
  writeNotificationEvents,
} from '../_shared/reply-engine.ts'
import type {
  QueryCategory,
  ClassifierResult,
  ComposerResult,
  EscalationMatch,
  EscalationResult,
  NotificationResult,
} from '../_shared/reply-engine.ts'

// ── Types ─────────────────────────────────────────────────────────────────

interface SimRequest {
  reservation_id?:  string
  conversation_id?: string
  guest_message:    string
  guest_phone?:     string
  mode:             string
}

interface SimResponse {
  ok:                   true
  mode:                 string
  conversation_id:      string
  reservation_id:       string
  session_id:           string
  guest_message_id:     string | null
  assistant_message_id: string | null
  reply:                string
  resolution: {
    matched_block:    BlockType | null
    visibility_scope: VisibilityScope | null
    confidence:       'high' | 'medium' | 'low'
    fallback:         boolean
  }
  escalation:    EscalationResult
  notifications: NotificationResult[]
}

// ── Input resolver ────────────────────────────────────────────────────────

async function resolveSimInput(
  svcClient:      SupabaseClient,
  reservationId:  string | undefined,
  conversationId: string | undefined,
  todayStr:       string,
): Promise<ResolvedInput | SimError> {

  let resolvedReservationId  = reservationId
  let resolvedConversationId = conversationId

  // When only conversation_id provided, resolve reservation_id from it
  if (!resolvedReservationId && resolvedConversationId) {
    const { data: conv, error: convErr } = await svcClient
      .from('conversations')
      .select('reservation_id')
      .eq('id', resolvedConversationId)
      .maybeSingle()

    if (convErr || !conv) {
      return { ok: false, error: 'conversation_id not found', code: 'CONVERSATION_NOT_FOUND', status: 404 }
    }
    resolvedReservationId = conv.reservation_id
  }

  if (!resolvedReservationId) {
    return { ok: false, error: 'reservation_id or conversation_id is required', code: 'MISSING_INPUT', status: 400 }
  }

  // Load reservation
  const { data: reservation, error: resErr } = await svcClient
    .from('reservations')
    .select('id, property_id, guest_name, guest_phone, guest_count, checkin_date, checkout_date, confirmation_number, special_requests')
    .eq('id', resolvedReservationId)
    .maybeSingle()

  if (resErr || !reservation) {
    return { ok: false, error: 'reservation not found', code: 'RESERVATION_NOT_FOUND', status: 404 }
  }

  // Load property
  const { data: property, error: propErr } = await svcClient
    .from('properties')
    .select('id, display_name, property_type, address_city, owner_id')
    .eq('id', reservation.property_id)
    .maybeSingle()

  if (propErr || !property) {
    return { ok: false, error: 'property not found', code: 'PROPERTY_NOT_FOUND', status: 404 }
  }

  // Find or create conversation
  const convId = await findOrCreateConversation(svcClient, resolvedReservationId, reservation.property_id)
  if (!convId) {
    return { ok: false, error: 'failed to resolve conversation', code: 'CONVERSATION_ERROR', status: 500 }
  }
  resolvedConversationId = convId

  // Derive session phase
  const phase = evaluateSessionPhase(reservation.checkin_date, reservation.checkout_date, todayStr)

  // Look for an open session for this reservation
  const { data: existingSession } = await svcClient
    .from('whatsapp_sessions')
    .select('id, session_status, session_phase, detected_language, unresolved_query_count')
    .eq('reservation_id', resolvedReservationId)
    .in('session_status', ['active', 'waiting', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sessionRow: ResolvedInput['sessionRow']

  if (existingSession) {
    sessionRow = {
      id:                     existingSession.id,
      session_status:         existingSession.session_status as SessionStatus,
      session_phase:          phase,
      detected_language:      existingSession.detected_language ?? null,
      unresolved_query_count: existingSession.unresolved_query_count ?? 0,
    }
    // Re-evaluate phase in DB (non-fatal)
    svcClient
      .from('whatsapp_sessions')
      .update({ session_phase: phase, last_message_at: new Date().toISOString() })
      .eq('id', existingSession.id)
      .then(() => {/* non-fatal */})
  } else {
    const { data: newSession, error: sessErr } = await svcClient
      .from('whatsapp_sessions')
      .insert({
        reservation_id:         resolvedReservationId,
        property_id:            reservation.property_id,
        guest_phone:            reservation.guest_phone,
        session_status:         'active',
        session_phase:          phase,
        detected_language:      'en',
        unresolved_query_count: 0,
        last_message_at:        new Date().toISOString(),
      })
      .select('id, session_status, session_phase, detected_language, unresolved_query_count')
      .single()

    if (sessErr || !newSession) {
      return { ok: false, error: 'failed to create session', code: 'SESSION_CREATE_FAILED', status: 500 }
    }

    sessionRow = {
      id:                     newSession.id,
      session_status:         newSession.session_status  as SessionStatus,
      session_phase:          newSession.session_phase   as SessionPhase,
      detected_language:      newSession.detected_language ?? null,
      unresolved_query_count: newSession.unresolved_query_count ?? 0,
    }
  }

  return {
    ok: true,
    sessionRow,
    reservationRow: {
      id:                  reservation.id,
      property_id:         reservation.property_id,
      guest_name:          reservation.guest_name,
      guest_phone:         reservation.guest_phone,
      guest_count:         reservation.guest_count,
      checkin_date:        reservation.checkin_date,
      checkout_date:       reservation.checkout_date,
      confirmation_number: reservation.confirmation_number,
      special_requests:    reservation.special_requests ?? null,
    },
    propertyRow: {
      id:            property.id,
      display_name:  property.display_name,
      property_type: property.property_type,
      address_city:  property.address_city,
      owner_id:      property.owner_id,
    },
    conversationId: resolvedConversationId,
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────

function errResponse(e: SimError): Response {
  return new Response(JSON.stringify({ ok: false, error: e.error, code: e.code ?? null }), {
    status:  e.status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing environment configuration' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const svcClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  let body: SimRequest
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.mode !== 'simulate' && body.mode !== 'inbound_phone') {
    return new Response(JSON.stringify({ ok: false, error: 'mode must be "simulate" or "inbound_phone"' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!body.guest_message || typeof body.guest_message !== 'string' || !body.guest_message.trim()) {
    return new Response(JSON.stringify({ ok: false, error: 'guest_message is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.mode === 'inbound_phone') {
    if (!body.guest_phone || typeof body.guest_phone !== 'string' || !body.guest_phone.trim()) {
      return new Response(JSON.stringify({ ok: false, error: 'guest_phone is required for mode inbound_phone' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
    if (body.reservation_id || body.conversation_id) {
      return new Response(JSON.stringify({ ok: false, error: 'reservation_id and conversation_id must not be provided for mode inbound_phone' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
  } else {
    if (!body.reservation_id && !body.conversation_id) {
      return new Response(JSON.stringify({ ok: false, error: 'reservation_id or conversation_id is required' }), {
        status: 400, headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const nowIso   = new Date().toISOString()
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

  // Resolve input → session + reservation + property + conversation
  let resolved: ResolvedInput | SimError
  if (body.mode === 'inbound_phone') {
    resolved = await resolveByPhone(svcClient, body.guest_phone!, todayStr)
    if (!resolved.ok) {
      const simErr = resolved as SimError
      if (simErr.code === 'UNAUTHORIZED_GUEST') {
        const normalizedPhone = normalizePhone(body.guest_phone!)
        // If format was invalid, normalizedPhone is null — fall back to first 6 chars of raw input
        const phonePrefix = (normalizedPhone ?? body.guest_phone!.trim()).slice(0, 6)
        await svcClient
          .from('timeline_events')
          .insert({
            property_id:     null,
            reservation_id:  null,
            conversation_id: null,
            task_id:         null,
            actor_id:        null,
            actor_type:      'system',
            event_type:      'unauthorized_guest_message',
            event_title:     'Concierge: inbound message from unrecognised phone number',
            metadata: {
              phone_prefix: phonePrefix,
              source:       'guestpal_ai',
            },
          })
        return new Response(JSON.stringify({
          ok:            true,
          mode:          'inbound_phone',
          reply:         "I'm sorry, I wasn't able to find an active booking linked to your number. Please contact your host directly for assistance.",
          notifications: [{ event_type: 'unauthorized_guest_message' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
      }
      if (simErr.code === 'UNVERIFIED_GUEST') {
        return new Response(JSON.stringify({
          ok:            true,
          mode:          'inbound_phone',
          reply:         "Thanks for your message. Your booking contact details are still awaiting confirmation by the host. Please contact your host directly if you need immediate assistance.",
          notifications: [{ event_type: 'unverified_guest_message' }],
        }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } })
      }
      return errResponse(simErr)
    }
  } else {
    resolved = await resolveSimInput(svcClient, body.reservation_id, body.conversation_id, todayStr)
    if (!resolved.ok) return errResponse(resolved as SimError)
  }

  const { sessionRow, reservationRow, propertyRow, conversationId } = resolved as ResolvedInput

  // Load ConciergeContext (three DB loads in parallel)
  const [rawBlocks, emergencyData, emergencyContacts] = await Promise.all([
    loadPropertyKnowledge(svcClient, reservationRow.property_id, []),
    loadEmergencyData(svcClient, reservationRow.property_id),
    loadEmergencyContacts(svcClient, reservationRow.property_id),
  ])

  const guestBlocks = filterKnowledgeForGuest(
    rawBlocks, sessionRow.session_phase,
    reservationRow.checkin_date, reservationRow.checkout_date, nowIso,
  )
  const phaseBlocks = filterKnowledgeByPhase(
    guestBlocks, sessionRow.session_phase,
    reservationRow.checkin_date, reservationRow.checkout_date, nowIso,
  )
  const ctx = buildConciergeContext(
    sessionRow, reservationRow, propertyRow, phaseBlocks, emergencyData, emergencyContacts,
  )

  // Classify + compose
  const classified = classifyQuery(body.guest_message, sessionRow.session_phase)
  const composed   = composeReply(ctx, classified, nowIso)

  // Visibility scope from the raw (unfiltered) block
  const matchedRawBlock = classified.block_hint ? rawBlocks[classified.block_hint] : null
  const visibilityScope = matchedRawBlock?.visibility_scope ?? null

  // Escalation detection + task creation (016B)
  const escalationMatch = detectEscalation(body.guest_message, classified.category)
  const escalation      = await createTaskIfNeeded(
    svcClient, resolved as ResolvedInput, body.guest_message, escalationMatch, conversationId,
  )

  // Host notification events (017A) — runs after escalation, non-fatal
  const notifications = await writeNotificationEvents(
    svcClient, resolved as ResolvedInput, body.guest_message,
    classified, composed, escalationMatch, escalation, conversationId,
  )

  // Acknowledgement appended when either escalation OR human_handoff persisted a task
  const handoffCreated = notifications.some(
    n => n.event_type === 'human_handoff_required' && n.task_id !== null,
  )
  const finalReply = (escalation.triggered || handoffCreated)
    ? `${composed.reply}\n\nI've flagged this with the property team and they'll follow up with you shortly.`
    : composed.reply

  // Persist both messages (non-fatal — DB errors are logged, not surfaced)
  let guestMessageId:     string | null = null
  let assistantMessageId: string | null = null

  const { data: guestMsg, error: guestMsgErr } = await svcClient
    .from('messages')
    .insert({ conversation_id: conversationId, sender_type: 'guest', message_text: body.guest_message })
    .select('id')
    .single()
  if (guestMsgErr) console.warn('[cis] guest message insert failed:', guestMsgErr.message)
  else             guestMessageId = guestMsg?.id ?? null

  const { data: aiMsg, error: aiMsgErr } = await svcClient
    .from('messages')
    .insert({ conversation_id: conversationId, sender_type: 'ai', message_text: finalReply })
    .select('id')
    .single()
  if (aiMsgErr) console.warn('[cis] ai message insert failed:', aiMsgErr.message)
  else          assistantMessageId = aiMsg?.id ?? null

  const response: SimResponse = {
    ok:                   true,
    mode:                 body.mode === 'inbound_phone' ? 'inbound_phone' : 'inbound_simulation',
    conversation_id:      conversationId,
    reservation_id:       reservationRow.id,
    session_id:           sessionRow.id,
    guest_message_id:     guestMessageId,
    assistant_message_id: assistantMessageId,
    reply:                finalReply,
    resolution: {
      matched_block:    composed.matched_block,
      visibility_scope: visibilityScope,
      confidence:       classified.confidence,
      fallback:         composed.fallback,
    },
    escalation,
    notifications,
  }

  return new Response(JSON.stringify(response), {
    status:  200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

if (import.meta.main) {
  serve(handler)
}
