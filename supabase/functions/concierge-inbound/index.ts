// supabase/functions/concierge-inbound/index.ts
// Sprint 019A.2 — Twilio WhatsApp Inbound Webhook + HMAC-SHA1 signature verification
// Sprint 019B  — Full reply pipeline (classifier / composer / escalation / persistence)
// Sprint 020A  — Idempotency: early claim in twilio_webhook_events before any DB write
//
// Entry point for live Twilio WhatsApp webhook POSTs.
// Verifies HMAC-SHA1 signature, claims MessageSid idempotency slot, resolves guest,
// runs reply pipeline, returns TwiML.
//
// Auth: TWILIO_AUTH_TOKEN (X-Twilio-Signature HMAC-SHA1 verification).
// DB writes use service_role key — bypasses RLS for session, message, and task writes.
//
// Idempotency (Sprint 020A):
//   MessageSid is claimed in twilio_webhook_events before resolveByPhone runs.
//   Duplicate deliveries (Twilio retries) conflict on PRIMARY KEY (23505) and
//   return twimlEmpty() without executing any downstream logic.
//   Status lifecycle: processing → processed | failed
//
// Logged: MessageSid, phone prefix (first 6 chars), message length, result type.
// Never logged: message content, full phone number, auth token, service role key.
//
// Environment variables required:
//   TWILIO_AUTH_TOKEN         — Twilio auth token for signature verification
//   WEBHOOK_URL               — exact URL this function is registered at in Twilio console
//   SUPABASE_URL              — built-in Supabase Edge Function env var
//   SUPABASE_SERVICE_ROLE_KEY — built-in Supabase Edge Function env var

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  resolveByPhone,
  normalizePhone,
  loadPropertyKnowledge,
  loadEmergencyData,
  loadEmergencyContacts,
  filterKnowledgeForGuest,
  filterKnowledgeByPhase,
  buildConciergeContext,
} from '../concierge-resolver/index.ts'
import type { ResolvedInput, SimError } from '../concierge-resolver/index.ts'
import {
  classifyQuery,
  composeReply,
  detectEscalation,
  createTaskIfNeeded,
  writeNotificationEvents,
} from '../_shared/reply-engine.ts'

// ── TwiML helpers ─────────────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;')
}

function twiml(message: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
  return new Response(xml, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}

function twimlEmpty(): Response {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    { status: 200, headers: { 'Content-Type': 'text/xml' } },
  )
}

// ── Twilio signature verification ─────────────────────────────────────────

// Constant-time string comparison — prevents timing attacks on HMAC digest comparison.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

// Verifies the X-Twilio-Signature header against the expected HMAC-SHA1 digest.
//
// String to sign: webhookUrl + POST params sorted alphabetically by key,
// concatenated as key1value1key2value2... (no separator between pairs).
// Signature: base64(HMAC-SHA1(authToken, strToSign))
//
// Source: https://www.twilio.com/docs/usage/webhooks/webhooks-security#validating-signatures-from-twilio
async function verifyTwilioSignature(
  authToken:  string,
  webhookUrl: string,
  params:     Record<string, string>,
  signature:  string,
): Promise<boolean> {
  const sortedKeys = Object.keys(params).sort()
  let strToSign = webhookUrl
  for (const key of sortedKeys) {
    strToSign += key + (params[key] ?? '')
  }

  const encoder   = new TextEncoder()
  const keyData   = encoder.encode(authToken)
  const msgData   = encoder.encode(strToSign)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'],
  )
  const sigBytes = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))

  return timingSafeEqual(computed, signature)
}

// ── HTTP handler ──────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // ── Environment ────────────────────────────────────────────────────────
  const authToken   = Deno.env.get('TWILIO_AUTH_TOKEN')
  const webhookUrl  = Deno.env.get('WEBHOOK_URL')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!authToken || !webhookUrl || !supabaseUrl || !serviceKey) {
    console.error('[ci] missing required environment variables')
    return twimlEmpty()
  }

  // ── Parse body ─────────────────────────────────────────────────────────
  let bodyText: string
  try {
    bodyText = await req.text()
  } catch {
    console.warn('[ci] failed to read request body')
    return twimlEmpty()
  }
  const params = Object.fromEntries(new URLSearchParams(bodyText))

  // ── Signature verification ─────────────────────────────────────────────
  const signature = req.headers.get('x-twilio-signature') ?? ''
  if (!signature) {
    return new Response('Forbidden', { status: 403 })
  }

  const valid = await verifyTwilioSignature(authToken, webhookUrl, params, signature)
  if (!valid) {
    console.warn('[ci] signature verification failed')
    return new Response('Forbidden', { status: 403 })
  }

  // ── Extract Twilio params ──────────────────────────────────────────────
  const fromRaw      = params['From']       ?? ''
  const guestMessage = params['Body']       ?? ''
  const messageSid   = params['MessageSid'] ?? ''

  if (!fromRaw || !guestMessage || !messageSid) {
    console.warn('[ci] missing required Twilio params', { hasSid: !!messageSid, hasFrom: !!fromRaw, hasBody: !!guestMessage })
    return twimlEmpty()
  }

  // ── Strip whatsapp: prefix ─────────────────────────────────────────────
  // Twilio delivers From as "whatsapp:+391234567890". Strip the scheme prefix
  // before passing to resolveByPhone, which calls normalizePhone internally.
  const fromStripped = fromRaw.replace(/^whatsapp:/i, '')
  const phonePrefix  = fromStripped.slice(0, 6)
  console.log('[ci] inbound', { messageSid, phonePrefix, bodyLen: guestMessage.length })

  // ── DB client (needed for idempotency claim before resolveByPhone) ─────
  const svcClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── Idempotency claim (Sprint 020A) ───────────────────────────────────
  // INSERT-first: PRIMARY KEY conflict (23505) = duplicate Twilio delivery.
  // Any other INSERT error = DB unavailable; fail safe without processing.
  // The claim is the first DB write — no business logic runs before this.
  const { error: claimErr } = await svcClient
    .from('twilio_webhook_events')
    .insert({ message_sid: messageSid, status: 'processing', phone_prefix: phonePrefix })

  if (claimErr) {
    if (claimErr.code === '23505') {
      console.log('[ci] duplicate:ignored', { messageSid, phonePrefix })
    } else {
      console.error('[ci] idempotency claim failed', { messageSid, error: claimErr.message })
    }
    return twimlEmpty()
  }

  // Non-fatal fire-and-forget status finaliser.
  // Called at every exit path after a successful claim.
  const finalise = (status: 'processed' | 'failed', errorMessage?: string) => {
    svcClient
      .from('twilio_webhook_events')
      .update({
        status,
        processed_at:  status === 'processed' ? new Date().toISOString() : null,
        error_message: errorMessage ?? null,
      })
      .eq('message_sid', messageSid)
      .then(() => { /* non-fatal */ })
  }

  // ── Post-claim pipeline ───────────────────────────────────────────────
  // Wrapped in try/catch so unhandled exceptions update the claim to 'failed'
  // rather than leaving it stuck as 'processing'.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })
  const nowIso   = new Date().toISOString()

  try {

    // ── Guest resolution ──────────────────────────────────────────────
    const resolved: ResolvedInput | SimError = await resolveByPhone(svcClient, fromStripped, todayStr)

    if (!resolved.ok) {
      const simErr = resolved as SimError

      if (simErr.code === 'UNAUTHORIZED_GUEST') {
        // Handler-layer responsibility: write unauthorized_guest_message timeline event.
        // (UNVERIFIED_GUEST event is written inside resolveByPhone — not duplicated here.)
        const normalized     = normalizePhone(fromStripped)
        const phoneLogPrefix = (normalized ?? fromStripped.trim()).slice(0, 6)
        await svcClient.from('timeline_events').insert({
          property_id:     null,
          reservation_id:  null,
          conversation_id: null,
          task_id:         null,
          actor_id:        null,
          actor_type:      'system',
          event_type:      'unauthorized_guest_message',
          event_title:     'Concierge: inbound message from unrecognised phone number',
          metadata:        { phone_prefix: phoneLogPrefix, source: 'guestpal_ai' },
        })
        console.log('[ci] result:unauthorized_guest', { messageSid, phonePrefix })
        finalise('processed')
        return twiml("I'm sorry, I wasn't able to find an active booking linked to your number. Please contact your host directly for assistance.")
      }

      if (simErr.code === 'UNVERIFIED_GUEST') {
        // Timeline event already written inside resolveByPhone.
        console.log('[ci] result:unverified_guest', { messageSid, phonePrefix })
        finalise('processed')
        return twiml("Thanks for your message. Your booking contact details are still awaiting confirmation by the host. Please contact your host directly if you need immediate assistance.")
      }

      // All other resolution errors: empty TwiML prevents Twilio retry storms.
      console.error('[ci] resolve error', { messageSid, code: simErr.code })
      finalise('failed', simErr.code ?? 'resolve_error')
      return twimlEmpty()
    }

    // ── Verified guest — full reply pipeline ────────────────────────────
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
    const classified = classifyQuery(guestMessage, sessionRow.session_phase)
    const composed   = composeReply(ctx, classified, nowIso)

    // Escalation detection + task creation
    const escalationMatch = detectEscalation(guestMessage, classified.category)
    const escalation      = await createTaskIfNeeded(
      svcClient, resolved as ResolvedInput, guestMessage, escalationMatch, conversationId,
    )

    // Host notification events (non-fatal)
    const notifications = await writeNotificationEvents(
      svcClient, resolved as ResolvedInput, guestMessage,
      classified, composed, escalationMatch, escalation, conversationId,
    )

    // Append acknowledgement if escalation persisted a task
    const handoffCreated = notifications.some(
      n => n.event_type === 'human_handoff_required' && n.task_id !== null,
    )
    const finalReply = (escalation.triggered || handoffCreated)
      ? `${composed.reply}\n\nI've flagged this with the property team and they'll follow up with you shortly.`
      : composed.reply

    // Persist both messages (non-fatal)
    const { data: guestMsg, error: guestMsgErr } = await svcClient
      .from('messages')
      .insert({ conversation_id: conversationId, sender_type: 'guest', message_text: guestMessage })
      .select('id')
      .single()
    if (guestMsgErr) console.warn('[ci] guest message insert failed:', guestMsgErr.message)

    const { data: aiMsg, error: aiMsgErr } = await svcClient
      .from('messages')
      .insert({ conversation_id: conversationId, sender_type: 'ai', message_text: finalReply })
      .select('id')
      .single()
    if (aiMsgErr) console.warn('[ci] ai message insert failed:', aiMsgErr.message)

    console.log('[ci] result:verified_guest', {
      messageSid,
      phonePrefix,
      reservationId: reservationRow.id,
      category:      classified.category,
      confidence:    classified.confidence,
      escalated:     escalation.triggered,
      guestMsgId:    guestMsg?.id ?? null,
      aiMsgId:       aiMsg?.id ?? null,
    })

    finalise('processed')
    return twiml(finalReply)

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('[ci] unhandled error', { messageSid, error: errMsg })
    // Awaited (not fire-and-forget) — persist 'failed' before isolate tears down.
    await svcClient
      .from('twilio_webhook_events')
      .update({ status: 'failed', error_message: errMsg })
      .eq('message_sid', messageSid)
    return twimlEmpty()
  }
}

if (import.meta.main) {
  serve(handler)
}
