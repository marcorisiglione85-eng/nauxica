// supabase/functions/session-handoff/index.ts
// Sprint 021A — Session Handoff Proxy
//
// Allows an authenticated homeowner to transition their own WhatsApp session
// between 'active' (AI handling) and 'escalated' (human handoff active).
//
// whatsapp_sessions has no homeowner UPDATE policy — all mutations are
// service_role only. This function proxies the write after validating
// that the requesting user owns the session's property.
//
// Auth flow:
//   1. Extract user JWT from Authorization header.
//   2. Anon client scoped to that JWT → auth.getUser() to verify identity.
//   3. Load session via service_role — return 404 if not found.
//   4. Verify ownership: query `properties` with user-scoped client (RLS gate).
//   5. UPDATE session_status via service_role.
//
// Permitted new_status values: 'active' | 'escalated'
// Homeowners may not set 'waiting' or 'closed' — those are AI/system states.
//
// Logging policy:
//   - Log session_id, property_id, new_status.
//   - Never log phone numbers, guest names, or JWT content.
//
// No migrations required. No changes to existing Edge Functions.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')              ?? ''
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')         ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Only these two transitions are homeowner-initiated.
// 'waiting' and 'closed' are AI/system states — never writable via this endpoint.
const PERMITTED_STATUSES = new Set<string>(['active', 'escalated'])

// ── Helper ────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// ── Handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  console.log('[sh] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error('[sh] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasAnonKey:     !!ANON_KEY,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  // ── 1. Verify JWT ──────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  console.log('[sh] auth header present:', authHeader.startsWith('Bearer '))
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  console.log('[sh] getUser', { userId: user?.id ?? null, err: authErr?.message ?? null })
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

  // ── 2. Parse and validate body ─────────────────────────────────────────
  let body: { session_id?: unknown; new_status?: unknown }
  try {
    body = await req.json()
  } catch {
    console.error('[sh] body parse failed')
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { session_id, new_status } = body

  if (!session_id || typeof session_id !== 'string') {
    return json({ error: 'session_id is required and must be a string' }, 400)
  }
  if (!new_status || typeof new_status !== 'string') {
    return json({ error: 'new_status is required and must be a string' }, 400)
  }
  if (!PERMITTED_STATUSES.has(new_status)) {
    console.log('[sh] rejected new_status', { new_status })
    return json({ error: "new_status must be 'active' or 'escalated'" }, 400)
  }

  console.log('[sh] payload valid', { session_id, new_status })

  // ── 3. Load session via service_role ──────────────────────────────────
  // service_role bypasses RLS — lets us distinguish "not found" from "forbidden".
  const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: session, error: sessErr } = await svcClient
    .from('whatsapp_sessions')
    .select('id, property_id, session_status')
    .eq('id', session_id)
    .maybeSingle()

  console.log('[sh] session lookup', {
    session_id,
    found:          !!session,
    property_id:    session?.property_id ?? null,
    current_status: session?.session_status ?? null,
    err:            sessErr?.message ?? null,
  })

  if (sessErr || !session) return json({ error: 'Session not found' }, 404)

  // ── 4. Ownership check ────────────────────────────────────────────────
  // Query `properties` via user-scoped client. RLS returns null if the
  // property does not belong to this homeowner.
  const { data: prop, error: propErr } = await userClient
    .from('properties')
    .select('id')
    .eq('id', session.property_id as string)
    .maybeSingle()

  console.log('[sh] ownership check', {
    property_id: session.property_id,
    owned:       !!prop,
    err:         propErr?.message ?? null,
  })

  if (propErr || !prop) return json({ error: 'Forbidden' }, 403)

  // ── 5. UPDATE session_status ──────────────────────────────────────────
  const { error: updateErr } = await svcClient
    .from('whatsapp_sessions')
    .update({ session_status: new_status })
    .eq('id', session_id)

  console.log('[sh] update', {
    session_id,
    property_id: session.property_id,
    new_status,
    err:         updateErr?.message ?? null,
  })

  if (updateErr) {
    console.error('[sh] update failed', {
      code:    updateErr.code,
      message: updateErr.message,
    })
    return json({ error: 'Failed to update session status' }, 500)
  }

  console.log('[sh] success', {
    session_id,
    property_id: session.property_id,
    new_status,
  })

  return json({ ok: true, session_id, new_status })
})
