// supabase/functions/knowledge-writer/index.ts
// Sprint 013B — Knowledge Block Writer (rev 2)
//
// Accepts POST { property_id, blocks[] } from an authenticated homeowner
// browser session and upserts property_knowledge_blocks via service_role
// (homeowner RLS allows SELECT only; INSERT/UPDATE require bypassing RLS).
//
// Auth flow:
//   1. Extract user JWT from Authorization header.
//   2. Anon client scoped to that JWT → auth.getUser() to verify identity.
//   3. Query `properties` with user-scoped client — RLS enforces ownership.
//   4. Upsert rows via service_role client.
//
// Logging policy:
//   - Log method, auth presence, user id, property_id, block counts at each step.
//   - Log full Supabase error: code, message, details, hint.
//   - Never log content_jsonb values (may contain wifi passwords, access codes).
//
// Commission, partner, and financial data are never read or returned.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Env vars are auto-injected by Supabase. Use ?? '' so a missing var produces
// a clear startup error rather than silently passing undefined to createClient.
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')                ?? ''
const ANON_KEY         = Deno.env.get('SUPABASE_ANON_KEY')           ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')   ?? ''

// Human-readable title included on INSERT so the title column (NOT NULL)
// is never left empty. On UPDATE (conflict) the existing title is preserved
// because PostgREST's ON CONFLICT DO UPDATE only sets the provided columns.
const BLOCK_TITLES: Record<string, string> = {
  property_summary: 'Property Summary',
  wifi:             'WiFi Information',
  access:           'Access & Entry',
  check_in:         'Check-in',
  check_out:        'Check-out',
  house_rules:      'House Rules',
  amenities:        'Amenities',
  local_area:       'Local Area',
  services:         'Services',
  maintenance:      'Maintenance',
  tourist_tax:      'Tourist Tax',
  fallback_support: 'Fallback Support',
  emergency:        'Emergency Information',
}

const ALLOWED_BLOCK_TYPES = new Set(Object.keys(BLOCK_TITLES))

// Canonical visibility codes enforced by pkb_visibility_scope_check.
const CANONICAL_VISIBILITY = new Set(['PUB', 'GST', 'PTR', 'INT'])

// Maps long-form frontend strings AND canonical codes to the canonical form.
// Unknown strings are NOT present — callers must treat a missing entry as invalid.
const VISIBILITY_NORM: Record<string, string> = {
  public:   'PUB', PUB: 'PUB',
  guest:    'GST', GST: 'GST',
  partner:  'PTR', PTR: 'PTR',
  internal: 'INT', INT: 'INT',
}

// Per-block-type canonical default used when the incoming value is absent.
const BLOCK_VISIBILITY: Record<string, string> = {
  property_summary: 'PUB',
  wifi:             'GST',
  access:           'GST',
  check_in:         'PUB',
  check_out:        'PUB',
  house_rules:      'PUB',
  amenities:        'GST',
  local_area:       'GST',
  services:         'GST',
  maintenance:      'GST',
  tourist_tax:      'PUB',
  fallback_support: 'GST',
  emergency:        'INT',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  console.log('[kw] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  // ── Startup env check ────────────────────────────────────────────────
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error('[kw] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasAnonKey:     !!ANON_KEY,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  console.log('[kw] auth header present:', authHeader.startsWith('Bearer '))
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  try {
    // ── 1. Verify JWT ──────────────────────────────────────────────────
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    console.log('[kw] getUser', { userId: user?.id ?? null, err: authErr?.message ?? null })
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // ── 2. Parse body ──────────────────────────────────────────────────
    let body: { property_id?: string; blocks?: unknown[] }
    try {
      body = await req.json()
    } catch {
      console.error('[kw] body parse failed')
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { property_id, blocks } = body
    console.log('[kw] payload', {
      property_id:  property_id ?? null,
      blocksIsArray: Array.isArray(blocks),
      blockCount:   Array.isArray(blocks) ? blocks.length : 'n/a',
    })
    if (!property_id || !Array.isArray(blocks) || !blocks.length) {
      return json({ error: 'Invalid payload: property_id and blocks[] required' }, 400)
    }

    // ── 3. Ownership check (RLS on properties enforces access) ─────────
    const { data: prop, error: propErr } = await userClient
      .from('properties')
      .select('id')
      .eq('id', property_id)
      .single()
    console.log('[kw] ownership check', { found: !!prop, err: propErr?.message ?? null })
    if (propErr || !prop) return json({ error: 'Forbidden' }, 403)

    // ── 4. Filter and build rows ───────────────────────────────────────
    const allowed:  string[] = []
    const rejected: string[] = []
    ;(blocks as Record<string, unknown>[]).forEach(b => {
      const bt = typeof b.block_type === 'string' ? b.block_type : '(non-string)'
      if (typeof b.block_type === 'string' && ALLOWED_BLOCK_TYPES.has(b.block_type)) {
        allowed.push(bt)
      } else {
        rejected.push(bt)
      }
    })
    console.log('[kw] block filter', { allowed, rejected })

    const allowedBlocks = (blocks as Record<string, unknown>[])
      .filter(b => typeof b.block_type === 'string' && ALLOWED_BLOCK_TYPES.has(b.block_type))

    if (!allowedBlocks.length) {
      console.warn('[kw] all blocks rejected by type filter', { rejected })
      return json({ error: 'No valid block types in payload', rejected }, 400)
    }

    // Normalize and validate visibility_scope for every block before upsert.
    // Collect all errors so the caller sees the full list in one response.
    const scopeErrors: string[] = []
    const rows = allowedBlocks.map(b => {
      const blockType = b.block_type as string
      const rawScope  = typeof b.visibility_scope === 'string' ? b.visibility_scope : ''
      // If a value was supplied, normalize it; if absent/empty, use the per-block default.
      const scope: string | undefined = rawScope
        ? VISIBILITY_NORM[rawScope]
        : BLOCK_VISIBILITY[blockType]

      if (!scope || !CANONICAL_VISIBILITY.has(scope)) {
        scopeErrors.push(`block '${blockType}': unrecognised visibility_scope '${rawScope}'`)
      }

      return {
        property_id,
        block_type:         blockType,
        // title is NOT NULL; derive from block_type for INSERT rows.
        // On UPDATE, ON CONFLICT DO UPDATE only sets the explicitly listed columns,
        // so the existing title is preserved in the row.
        title:              BLOCK_TITLES[blockType] ?? blockType,
        content_jsonb:      (b.content_jsonb && typeof b.content_jsonb === 'object') ? b.content_jsonb : {},
        is_active:          b.is_active !== false,
        visibility_scope:   scope ?? BLOCK_VISIBILITY[blockType] ?? 'PUB', // fallback kept safe; never reaches DB if scopeErrors set
        session_phase_gate: (typeof b.session_phase_gate === 'string' && b.session_phase_gate) ? b.session_phase_gate : null,
      }
    })

    if (scopeErrors.length) {
      console.error('[kw] invalid visibility_scope', { errors: scopeErrors })
      return json({ error: 'Invalid visibility_scope value(s)', details: scopeErrors.join('; ') }, 400)
    }

    console.log('[kw] visibility_scope values', rows.map(r => ({ type: r.block_type, scope: r.visibility_scope })))

    // ── 5. Upsert via service_role ────────────────────────────────────
    const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    console.log('[kw] upserting', { rowCount: rows.length, types: rows.map(r => r.block_type) })

    const { error: upsertErr } = await svcClient
      .from('property_knowledge_blocks')
      .upsert(rows, { onConflict: 'property_id,block_type' })

    if (upsertErr) {
      console.error('[kw] upsert error', {
        code:    upsertErr.code,
        message: upsertErr.message,
        details: upsertErr.details,
        hint:    upsertErr.hint,
      })
      return json({
        error:   upsertErr.message,
        code:    upsertErr.code,
        hint:    upsertErr.hint ?? null,
        details: upsertErr.details ?? null,
      }, 500)
    }

    console.log('[kw] success', { saved: rows.length })
    return json({ ok: true, saved: rows.length })

  } catch (err) {
    console.error('[kw] unhandled exception', String(err))
    return json({ error: String(err) }, 500)
  }
})
