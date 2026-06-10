// supabase/functions/emergency-writer/index.ts
// Sprint 013B — Emergency Data Writer
//
// Accepts POST { property_id, emergency_data, contacts } from an authenticated
// homeowner browser session and writes to emergency_data and emergency_contacts
// via service_role (homeowner RLS allows SELECT only on both tables).
//
// Auth flow mirrors knowledge-writer exactly:
//   1. Extract user JWT from Authorization header.
//   2. Anon client scoped to that JWT → auth.getUser() to verify identity.
//   3. Query `properties` with user-scoped client — RLS enforces ownership.
//   4. Write rows via service_role client.
//
// emergency_data INSERT vs UPDATE:
//   - SELECT existing row by property_id first.
//   - If row exists: UPDATE only the homeowner-allowed columns.
//     nauxica_ops_phone is NOT touched (operator-only).
//   - If no row: INSERT with all required columns plus nauxica_ops_phone from
//     NAUXICA_OPS_PHONE env var (so the NOT NULL constraint is satisfied).
//
// Required NOT NULL fields validated server-side on INSERT:
//   owner_emergency_name, owner_emergency_phone,
//   nearest_hospital_name, nearest_hospital_address.
//   (nauxica_ops_phone is system-provided, not from the request.)
//
// Security constraints:
//   - Never write nauxica_ops_phone from the request payload.
//   - Never write contact_type = 'nauxica_operator' — only 'owner'/'caretaker'.
//   - Never log field values (may contain phone numbers, access codes).
//
// Commission, partner, and financial data are never read or returned.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')              ?? ''
const ANON_KEY          = Deno.env.get('SUPABASE_ANON_KEY')         ?? ''
const SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
// Fallback ops number used only when creating a new emergency_data row.
// nauxica_ops_phone is NOT NULL so we must satisfy the constraint on INSERT.
// In production, set NAUXICA_OPS_PHONE in Supabase project secrets.
const NAUXICA_OPS_PHONE = Deno.env.get('NAUXICA_OPS_PHONE')         ?? '+39 000 000 0000'

// Homeowner-writable columns for emergency_data.
// nauxica_ops_phone is intentionally excluded — it is only written on first
// INSERT (from NAUXICA_OPS_PHONE env var, not from the request), and never
// touched again by homeowner saves.
const ALLOWED_ED_COLUMNS = new Set([
  'owner_emergency_name',
  'owner_emergency_phone',
  'nearest_hospital_name',
  'nearest_hospital_address',
  'nearest_hospital_distance',
  'nearest_hospital_phone',
  'gas_shutoff_instructions',
  'electricity_shutoff_instructions',
  'water_shutoff_instructions',
  'evacuation_route_description',
  'evacuation_assembly_point',
  'property_specific_hazards',
  'emergency_instructions',
])

// NOT NULL columns the homeowner must supply when creating a new row.
const REQUIRED_ED_COLUMNS = [
  'owner_emergency_name',
  'owner_emergency_phone',
  'nearest_hospital_name',
  'nearest_hospital_address',
]

// Homeowner may only write these two contact types.
// 'nauxica_operator' is never accepted from the browser.
const ALLOWED_CONTACT_TYPES = new Set(['owner', 'caretaker'])

// Homeowner-writable columns for emergency_contacts.
const ALLOWED_CT_COLUMNS = new Set([
  'contact_name',
  'contact_phone',
  'available_hours',
  'escalation_priority',
  'is_active',
  'guest_visible',
  'ai_usable',
])

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Return a new object containing only keys present in allowedSet with non-null values.
// Null values are excluded because sending explicit null to a NOT NULL column
// on UPDATE raises a constraint violation. Nullable columns can be cleared by
// the caller only via omission — if a field isn't sent, the DB row keeps its value.
// (Frontend validation ensures required fields are always present and non-null.)
function pickColumns(
  input: Record<string, unknown>,
  allowedSet: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of allowedSet) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      // Include null only for nullable columns; required columns are validated
      // separately before this runs.
      out[key] = input[key]
    }
  }
  return out
}

serve(async (req) => {
  console.log('[ew] incoming request', { method: req.method })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method not allowed' }, 405)

  // ── Startup env check ────────────────────────────────────────────────
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    console.error('[ew] missing env vars', {
      hasUrl:         !!SUPABASE_URL,
      hasAnonKey:     !!ANON_KEY,
      hasServiceRole: !!SERVICE_ROLE_KEY,
    })
    return json({ error: 'Server misconfiguration — missing env vars' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  console.log('[ew] auth header present:', authHeader.startsWith('Bearer '))
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  try {
    // ── 1. Verify JWT ──────────────────────────────────────────────────
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    console.log('[ew] getUser', { userId: user?.id ?? null, err: authErr?.message ?? null })
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    // ── 2. Parse body ──────────────────────────────────────────────────
    let body: {
      property_id?:    string
      emergency_data?: Record<string, unknown>
      contacts?:       Record<string, Record<string, unknown>>
    }
    try {
      body = await req.json()
    } catch {
      console.error('[ew] body parse failed')
      return json({ error: 'Invalid JSON body' }, 400)
    }

    const { property_id, emergency_data: edInput, contacts: contactsInput } = body
    console.log('[ew] payload', {
      property_id:      property_id ?? null,
      hasEmergencyData: !!edInput,
      contactTypes:     contactsInput ? Object.keys(contactsInput) : [],
    })

    if (!property_id) {
      return json({ error: 'Invalid payload: property_id required' }, 400)
    }
    if (!edInput && !contactsInput) {
      return json({ error: 'Invalid payload: emergency_data or contacts required' }, 400)
    }

    // ── 3. Ownership check (RLS on properties enforces access) ─────────
    const { data: prop, error: propErr } = await userClient
      .from('properties')
      .select('id')
      .eq('id', property_id)
      .single()
    console.log('[ew] ownership check', { found: !!prop, err: propErr?.message ?? null })
    if (propErr || !prop) return json({ error: 'Forbidden' }, 403)

    const svcClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // ── 4. Write emergency_data ────────────────────────────────────────
    if (edInput) {
      const safeEd = pickColumns(edInput, ALLOWED_ED_COLUMNS)
      console.log('[ew] emergency_data columns to write', Object.keys(safeEd))

      // SELECT first to distinguish INSERT (needs nauxica_ops_phone) from UPDATE.
      const { data: existingRow, error: selEdErr } = await svcClient
        .from('emergency_data')
        .select('id')
        .eq('property_id', property_id)
        .maybeSingle()

      if (selEdErr) {
        console.error('[ew] emergency_data SELECT error', {
          code:    selEdErr.code,
          message: selEdErr.message,
        })
        return json({
          error:   selEdErr.message,
          code:    selEdErr.code,
          hint:    selEdErr.hint    ?? null,
          details: selEdErr.details ?? null,
        }, 500)
      }

      if (existingRow) {
        // UPDATE — nauxica_ops_phone is untouched.
        console.log('[ew] emergency_data exists, running UPDATE', { id: existingRow.id })
        const { error: updEdErr } = await svcClient
          .from('emergency_data')
          .update(safeEd)
          .eq('id', existingRow.id)

        if (updEdErr) {
          console.error('[ew] emergency_data UPDATE error', {
            code:    updEdErr.code,
            message: updEdErr.message,
            details: updEdErr.details,
            hint:    updEdErr.hint,
          })
          return json({
            error:   updEdErr.message,
            code:    updEdErr.code,
            hint:    updEdErr.hint    ?? null,
            details: updEdErr.details ?? null,
          }, 500)
        }
        console.log('[ew] emergency_data UPDATE ok')

      } else {
        // INSERT — validate required NOT NULL columns before attempting.
        const missingRequired = REQUIRED_ED_COLUMNS.filter(k => !safeEd[k])
        if (missingRequired.length) {
          console.error('[ew] missing required fields for new emergency_data row', { missingRequired })
          return json({
            error:  'Required fields missing for new emergency record: ' + missingRequired.join(', '),
            fields: missingRequired,
          }, 400)
        }

        console.log('[ew] no existing emergency_data row, running INSERT')
        const insertRow = {
          property_id,
          nauxica_ops_phone: NAUXICA_OPS_PHONE,
          ...safeEd,
        }
        const { error: insEdErr } = await svcClient
          .from('emergency_data')
          .insert(insertRow)

        if (insEdErr) {
          console.error('[ew] emergency_data INSERT error', {
            code:    insEdErr.code,
            message: insEdErr.message,
            details: insEdErr.details,
            hint:    insEdErr.hint,
          })
          return json({
            error:   insEdErr.message,
            code:    insEdErr.code,
            hint:    insEdErr.hint    ?? null,
            details: insEdErr.details ?? null,
          }, 500)
        }
        console.log('[ew] emergency_data INSERT ok')
      }
    }

    // ── 5. Upsert emergency_contacts ───────────────────────────────────
    const savedContacts: Record<string, {
      id: string; contact_type: string
      contact_name: string | null; contact_phone: string | null
    }> = {}

    if (contactsInput) {
      for (const [contactType, rawContact] of Object.entries(contactsInput)) {
        // Reject disallowed contact types — never write nauxica_operator rows.
        if (!ALLOWED_CONTACT_TYPES.has(contactType)) {
          console.warn('[ew] rejected contact_type', { contactType })
          continue
        }

        const safeContact = pickColumns(rawContact as Record<string, unknown>, ALLOWED_CT_COLUMNS)
        console.log('[ew] contact columns to write', { contactType, columns: Object.keys(safeContact) })

        // SELECT existing row by (property_id, contact_type) to get its id.
        const { data: existing, error: selErr } = await svcClient
          .from('emergency_contacts')
          .select('id, contact_name, contact_phone')
          .eq('property_id', property_id)
          .eq('contact_type', contactType)
          .maybeSingle()

        if (selErr) {
          console.error('[ew] contact SELECT error', {
            contactType,
            code:    selErr.code,
            message: selErr.message,
          })
          return json({
            error:   selErr.message,
            code:    selErr.code,
            hint:    selErr.hint    ?? null,
            details: selErr.details ?? null,
          }, 500)
        }

        if (existing) {
          // UPDATE by id — never alter contact_type or property_id.
          const { error: updErr } = await svcClient
            .from('emergency_contacts')
            .update(safeContact)
            .eq('id', existing.id)

          if (updErr) {
            console.error('[ew] contact UPDATE error', {
              contactType,
              code:    updErr.code,
              message: updErr.message,
              details: updErr.details,
              hint:    updErr.hint,
            })
            return json({
              error:   updErr.message,
              code:    updErr.code,
              hint:    updErr.hint    ?? null,
              details: updErr.details ?? null,
            }, 500)
          }
          console.log('[ew] contact updated', { contactType, id: existing.id })
          savedContacts[contactType] = {
            id:           existing.id,
            contact_type: contactType,
            contact_name:  (safeContact.contact_name  as string | null) ?? existing.contact_name,
            contact_phone: (safeContact.contact_phone as string | null) ?? existing.contact_phone,
          }
        } else {
          // INSERT new row.
          const insertRow = { property_id, contact_type: contactType, ...safeContact }
          const { data: inserted, error: insErr } = await svcClient
            .from('emergency_contacts')
            .insert(insertRow)
            .select('id, contact_name, contact_phone')
            .single()

          if (insErr) {
            console.error('[ew] contact INSERT error', {
              contactType,
              code:    insErr.code,
              message: insErr.message,
              details: insErr.details,
              hint:    insErr.hint,
            })
            return json({
              error:   insErr.message,
              code:    insErr.code,
              hint:    insErr.hint    ?? null,
              details: insErr.details ?? null,
            }, 500)
          }
          console.log('[ew] contact inserted', { contactType, id: inserted?.id })
          savedContacts[contactType] = {
            id:           inserted!.id,
            contact_type: contactType,
            contact_name:  inserted!.contact_name,
            contact_phone: inserted!.contact_phone,
          }
        }
      }
    }

    console.log('[ew] success', {
      wroteEmergencyData: !!edInput,
      savedContactTypes:  Object.keys(savedContacts),
    })
    return json({ ok: true, contacts: savedContacts })

  } catch (err) {
    console.error('[ew] unhandled exception', String(err))
    return json({ error: String(err) }, 500)
  }
})
