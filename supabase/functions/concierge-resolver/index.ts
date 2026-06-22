// supabase/functions/concierge-resolver/index.ts
// Sprint 011A — Concierge Session Resolver
// Sprint 012C — Context Loader Layer (added)
// Sprint 019A.1 — resolveByPhone, ResolvedInput, SimError exported (added)
//
// Resolves an inbound WhatsApp message to a session + ConciergeContext object.
// Does NOT generate AI responses. Does NOT call any LLM.
// Does NOT implement dynamic instruction merge (Sprint 013).
// Does NOT implement language selection (Sprint 013).
// Does NOT create EscalationRecords (Sprint 013).
// Does NOT create ServiceRequests (Sprint 014).
//
// Sprint 011A flow (unchanged):
//   1. Normalise phone → E.164
//   2. Look for existing active/waiting/escalated session
//   3. Escalated → return hold state
//   4. Active → resume, re-evaluate phase, persist message
//   5. Waiting → disambiguation pending
//   6. No session → find reservation by phone + active stay window
//   7. No reservation → IDENTITY_UNRESOLVABLE
//   8. Single reservation → create session + conversation + persist message
//
// Sprint 012C additions (state = 'resolved' only):
//   10. Load active property_knowledge_blocks for this property
//   11. Load EmergencyData record (always — fallback if missing)
//   12. Load EmergencyContacts (guest_visible=true AND ai_usable=true AND is_active=true)
//   13. filterKnowledgeForGuest — scope filter (PUB/GST) + access code gate
//   14. filterKnowledgeByPhase — session_phase_gate column filter
//   15. buildConciergeContext — assemble full ConciergeContext
//   16. Attach concierge_context to resolved response
//
// Auth: service_role key only — bypasses RLS for session and message writes.
// Commission and partner financial data are never read or returned.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ─────────────────────────────────────────────────────────────

const PRE_ARRIVAL_WINDOW_DAYS = 2
const POST_STAY_GRACE_DAYS    = 1

// Sentinel value placed in credential fields when the access code gate is closed (KBB Step 5).
export const SENTINEL = '[not yet available]'

// Credential expiry: access codes become sentinel after checkout + this many hours.
const POST_CHECKOUT_CODE_EXPIRY_HOURS = 4

// Credential fields subject to the access code gate, per block type.
// Fields not listed are never gated (e.g. entry_instructions, key_box_location).
const CREDENTIAL_FIELDS: Partial<Record<BlockType, readonly string[]>> = {
  access: ['key_box_code', 'smart_lock_code', 'building_door_code', 'gate_code', 'parking_access_code'],
  wifi:   ['wifi_password'],
}

// All 14 canonical block types, in knowledge map order.
// Source: property-knowledge-schema.md v1.5 §Canonical Knowledge Block Type Registry
export const ALL_BLOCK_TYPES: readonly BlockType[] = [
  'emergency', 'property_summary', 'access', 'check_in', 'check_out',
  'wifi', 'amenities', 'house_rules', 'local_area', 'services',
  'maintenance', 'tourist_tax', 'booking_policy', 'fallback_support',
]

// ConciergeContext schema version — tracks property-knowledge-schema.md document version.
const CONTEXT_SCHEMA_VERSION = '1.5'

// ── Types ─────────────────────────────────────────────────────────────────

export type SessionStatus = 'active' | 'waiting' | 'closed' | 'escalated'
export type SessionPhase  = 'pre_arrival' | 'check_in' | 'in_stay' | 'check_out' | 'post_stay'

// 14 canonical block types (property-knowledge-schema.md §Canonical Registry).
export type BlockType =
  | 'emergency' | 'property_summary' | 'access' | 'check_in' | 'check_out'
  | 'wifi' | 'amenities' | 'house_rules' | 'local_area' | 'services'
  | 'maintenance' | 'tourist_tax' | 'booking_policy' | 'fallback_support'

export type VisibilityScope = 'PUB' | 'GST' | 'PTR' | 'INT'

// Raw block row from property_knowledge_blocks (migration 011).
export interface RawBlock {
  id:                 string
  property_id:        string
  block_type:         BlockType
  visibility_scope:   VisibilityScope
  // null = no phase restriction. Otherwise: comma-separated SessionPhase values.
  session_phase_gate: string | null
  content_jsonb:      Record<string, unknown>
  is_active:          boolean
}

// EmergencyData row from emergency_data table (migration 012, Correction A).
interface EmergencyDataRow {
  is_complete:                      boolean
  owner_emergency_name:             string
  owner_emergency_phone:            string
  nauxica_ops_phone:                string
  nearest_hospital_name:            string
  nearest_hospital_address:         string
  nearest_hospital_distance:        string | null
  gas_shutoff_instructions:         string | null
  water_shutoff_instructions:       string | null
  electricity_shutoff_instructions: string | null
  evacuation_route_description:     string | null
  evacuation_assembly_point:        string | null
  property_specific_hazards:        string | null
}

// Emergency chunk for ConciergeContext.emergency.
// Always populated — fallback returned when no DB row exists (is_complete=false).
// Italian national emergency numbers (112/113/115/118) are NOT stored here —
// they are static constants in the AI system prompt.
// Source: property-knowledge-schema.md v1.5 §Concierge Context Shape
export interface EmergencyChunk {
  is_complete:                      boolean
  owner_emergency_name:             string
  owner_emergency_phone:            string
  nauxica_ops_phone:                string
  nearest_hospital_name:            string
  nearest_hospital_address:         string
  nearest_hospital_distance:        string | null
  gas_shutoff_instructions:         string | null
  water_shutoff_instructions:       string | null
  electricity_shutoff_instructions: string | null
  evacuation_route_description:     string | null
  evacuation_assembly_point:        string | null
  property_specific_hazards:        string | null
}

// Emergency contact entry for ConciergeContext.emergency_contacts.
// Field names match the ConciergeContext design contract, NOT the DB column names.
// DB column mapping handled in loadEmergencyContacts():
//   emergency_contacts.contact_name  → EmergencyContact.display_name
//   emergency_contacts.contact_phone → EmergencyContact.phone
export interface EmergencyContact {
  contact_type:        string
  display_name:        string
  phone:               string
  available_hours:     string | null
  escalation_priority: number
}

// All 14 block types, null when not loaded for this session + query.
// emergency and property_summary are always present in a valid context (non-null when DB has data).
export type KnowledgeMap = Record<BlockType, Record<string, unknown> | null>

// Full ConciergeContext assembled by buildConciergeContext().
// This is the input to the AI runtime. Never includes commission, partner earnings,
// payout, homeowner IBAN, internal notes, partner access codes, or guest_phone.
// Source: property-knowledge-schema.md v1.5 §Concierge Context Shape — Design Contract
export interface ConciergeContext {
  session: {
    session_id:             string
    session_status:         SessionStatus
    session_phase:          SessionPhase
    detected_language:      string        // ISO 639-1; defaults to 'en'
    unresolved_query_count: number
    is_escalated:           boolean       // derived: session_status === 'escalated'
    schema_version:         string
  }
  guest: {
    guest_name:          string
    guest_count:         number
    checkin_date:        string           // YYYY-MM-DD
    checkout_date:       string           // YYYY-MM-DD
    confirmation_number: string
    special_requests:    string | null
    // guest_phone NOT included — INT-scoped session anchor, not for AI
  }
  property: {
    property_id:      string
    display_name:     string
    property_type:    string
    address_locality: string             // Municipality only — not full address
    nearest_airport:  string | null
    is_complete:      boolean
    schema_version:   string
    generated_at:     string             // ISO 8601 timestamp
  }
  knowledge:          KnowledgeMap
  emergency:          EmergencyChunk    // Always populated. Separate from knowledge.emergency.
  emergency_contacts: EmergencyContact[] // Only guest_visible=true AND ai_usable=true
  stay_context:       null              // Reserved — Sprint 015
}

interface InboundMessage {
  raw_phone:    string
  message_text: string
  media_type?:  string
}

// Structured context returned to the caller.
// Never includes: commission, partner earnings, payout, homeowner IBAN,
// codice fiscale, partner access codes, internal_notes, or reservation_value_amount.
interface ResolvedContext {
  state: 'resolved' | 'escalated_hold' | 'disambiguation_needed' | 'unresolvable' | 'error'

  session?: {
    session_id:             string
    session_status:         SessionStatus
    session_phase:          SessionPhase
    is_escalated:           boolean
    unresolved_query_count: number
    detected_language:      string | null
  }

  guest?: {
    guest_name:               string
    guest_count:              number
    checkin_date:             string
    checkout_date:            string
    confirmation_number:      string
    special_requests:         string | null
    guest_preferred_language: string | null
  }

  property?: {
    property_id:   string
    property_code: string
    display_name:  string
    property_type: string
    city:          string
  }

  conversation_id?: string
  message_id?:      string

  // Sprint 012C: full AI context assembled after session resolution.
  // null if context loading fails — session resolution still succeeds.
  concierge_context?: ConciergeContext | null

  error_code?:   string
  error_detail?: string
}

// ResolvedInput — returned by resolveByPhone when a verified active reservation is found.
// Consumed by concierge-inbound-sim and, when Sprint 019A.2 is wired, by concierge-inbound.
export interface ResolvedInput {
  ok:             true
  sessionRow: {
    id:                     string
    session_status:         SessionStatus
    session_phase:          SessionPhase
    detected_language:      string | null
    unresolved_query_count: number
  }
  reservationRow: {
    id:                  string
    property_id:         string
    guest_name:          string
    guest_phone:         string
    guest_count:         number
    checkin_date:        string
    checkout_date:       string
    confirmation_number: string
    special_requests:    string | null
  }
  propertyRow: {
    id:            string
    display_name:  string
    property_type: string
    address_city:  string
    owner_id:      string
  }
  conversationId: string
}

// SimError — returned by resolveByPhone when resolution fails.
export interface SimError {
  ok:     false
  error:  string
  code?:  string
  status: number
}

// ── Phone normalisation ───────────────────────────────────────────────────

// Accepts E.164 (+391234567890), Italian 00-prefix (0039...), or Italian mobile
// starting with 3 (10-digit). Returns E.164 or null if unparseable.
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\.\(\)]/g, '')
  if (/^\+\d{7,15}$/.test(cleaned))  return cleaned
  if (/^00\d{7,13}$/.test(cleaned))  return '+' + cleaned.slice(2)
  if (/^[3]\d{9}$/.test(cleaned))    return '+39' + cleaned
  return null
}

// ── Session phase evaluation ──────────────────────────────────────────────

// Evaluates the current phase based on checkin/checkout dates relative to today.
// todayStr must be a YYYY-MM-DD date in Europe/Rome timezone.
export function evaluateSessionPhase(
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

// ── Conversation: create or reuse ─────────────────────────────────────────

export async function findOrCreateConversation(
  supabase:      SupabaseClient,
  reservationId: string,
  propertyId:    string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('reservation_id', reservationId)
    .maybeSingle()

  if (existing?.id) return existing.id

  // Need owner_id from properties — conversations.owner_id is NOT NULL
  const { data: property } = await supabase
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single()

  if (!property?.owner_id) return null

  const { data: created } = await supabase
    .from('conversations')
    .insert({ reservation_id: reservationId, property_id: propertyId, owner_id: property.owner_id })
    .select('id')
    .single()

  return created?.id ?? null
}

// ── Sprint 012C: Access code gate ─────────────────────────────────────────

// Returns true if credential fields should be delivered in clear text (gate open).
//
// Gate is open when:
//   - session_phase is 'check_in' or 'in_stay'
//   AND
//   - request is before checkout_date + POST_CHECKOUT_CODE_EXPIRY_HOURS
//
// The early_access_code_delivery homeowner flag (pre_arrival exception) is not yet
// implemented — defaults to false. See property-knowledge-schema.md §Access Code Gating Rules.
export function isCredentialGateOpen(
  sessionPhase:     SessionPhase,
  checkoutDate:     string,
  requestTimestamp: string,
): boolean {
  const expiryMs =
    new Date(checkoutDate).getTime() + POST_CHECKOUT_CODE_EXPIRY_HOURS * 60 * 60 * 1000
  if (new Date(requestTimestamp).getTime() >= expiryMs) return false
  return sessionPhase === 'check_in' || sessionPhase === 'in_stay'
}

// ── Sprint 012C: Load functions ───────────────────────────────────────────

// Loads active property_knowledge_blocks from the DB.
// blockTypes: empty array = load all active blocks for this property.
// Only is_active=true rows are returned — inactive blocks are excluded at DB level.
// Output: partial record — only block types found in the DB are present.
export async function loadPropertyKnowledge(
  supabase:   SupabaseClient,
  propertyId: string,
  blockTypes: BlockType[],
): Promise<Partial<Record<BlockType, RawBlock>>> {
  let query = supabase
    .from('property_knowledge_blocks')
    .select('id, property_id, block_type, visibility_scope, session_phase_gate, content_jsonb, is_active')
    .eq('property_id', propertyId)
    .eq('is_active', true)

  if (blockTypes.length > 0) {
    query = query.in('block_type', blockTypes)
  }

  const { data, error } = await query
  if (error || !data) return {}

  const result: Partial<Record<BlockType, RawBlock>> = {}
  for (const row of data) {
    result[row.block_type as BlockType] = row as RawBlock
  }
  return result
}

// Loads EmergencyData for this property.
// NEVER returns null — returns a fallback EmergencyChunk with is_complete=false
// when no DB row exists, satisfying Rule EM-01 (emergency data always present).
// The AI runtime uses static Italian emergency constants (112/113/115/118) from
// the system prompt regardless of whether this data is complete.
export async function loadEmergencyData(
  supabase:   SupabaseClient,
  propertyId: string,
): Promise<EmergencyChunk> {
  const fallback: EmergencyChunk = {
    is_complete:                      false,
    owner_emergency_name:             '',
    owner_emergency_phone:            '',
    nauxica_ops_phone:                '',
    nearest_hospital_name:            '',
    nearest_hospital_address:         '',
    nearest_hospital_distance:        null,
    gas_shutoff_instructions:         null,
    water_shutoff_instructions:       null,
    electricity_shutoff_instructions: null,
    evacuation_route_description:     null,
    evacuation_assembly_point:        null,
    property_specific_hazards:        null,
  }

  const { data, error } = await supabase
    .from('emergency_data')
    .select('is_complete, owner_emergency_name, owner_emergency_phone, nauxica_ops_phone, nearest_hospital_name, nearest_hospital_address, nearest_hospital_distance, gas_shutoff_instructions, water_shutoff_instructions, electricity_shutoff_instructions, evacuation_route_description, evacuation_assembly_point, property_specific_hazards')
    .eq('property_id', propertyId)
    .maybeSingle()

  if (error || !data) return fallback

  // Type annotation (not a cast) — valid when the untyped client returns data as any.
  const row: EmergencyDataRow = data
  return {
    is_complete:                      row.is_complete,
    owner_emergency_name:             row.owner_emergency_name  ?? '',
    owner_emergency_phone:            row.owner_emergency_phone ?? '',
    nauxica_ops_phone:                row.nauxica_ops_phone     ?? '',
    nearest_hospital_name:            row.nearest_hospital_name    ?? '',
    nearest_hospital_address:         row.nearest_hospital_address ?? '',
    nearest_hospital_distance:        row.nearest_hospital_distance        ?? null,
    gas_shutoff_instructions:         row.gas_shutoff_instructions         ?? null,
    water_shutoff_instructions:       row.water_shutoff_instructions       ?? null,
    electricity_shutoff_instructions: row.electricity_shutoff_instructions ?? null,
    evacuation_route_description:     row.evacuation_route_description     ?? null,
    evacuation_assembly_point:        row.evacuation_assembly_point        ?? null,
    property_specific_hazards:        row.property_specific_hazards        ?? null,
  }
}

// Loads emergency contacts where guest_visible=true AND ai_usable=true AND is_active=true.
// Sorted: escalation_priority ASC, contact_type ASC, created_at ASC.
// Maps DB column names to ConciergeContext field names:
//   contact_name  → display_name
//   contact_phone → phone
// Returns empty array (never null) when no contacts match the filter.
// Source: property-knowledge-schema.md v1.5 §loadEmergencyContacts() contract
export async function loadEmergencyContacts(
  supabase:   SupabaseClient,
  propertyId: string,
): Promise<EmergencyContact[]> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('contact_type, contact_name, contact_phone, available_hours, escalation_priority')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .eq('guest_visible', true)
    .eq('ai_usable', true)
    .order('escalation_priority', { ascending: true })
    .order('contact_type', { ascending: true })
    .order('created_at', { ascending: true })

  if (error || !data) return []

  return (data as Array<{
    contact_type:        string
    contact_name:        string
    contact_phone:       string
    available_hours:     string | null
    escalation_priority: number
  }>).map(row => ({
    contact_type:        row.contact_type,
    display_name:        row.contact_name,   // DB column → ConciergeContext field
    phone:               row.contact_phone,  // DB column → ConciergeContext field
    available_hours:     row.available_hours ?? null,
    escalation_priority: row.escalation_priority,
  }))
}

// ── Sprint 012C: Filter functions ─────────────────────────────────────────

// Applies the KBB visibility scope filter (Step 1) and access code gate (Step 5).
//
// Scope filter: excludes PTR and INT scoped blocks — only PUB and GST pass.
// Access code gate: when the gate is closed, credential fields in 'access' and 'wifi'
// blocks are replaced with the SENTINEL value '[not yet available]'.
// Inactive blocks are already excluded by loadPropertyKnowledge — not re-checked here.
//
// See: property-knowledge-schema.md v1.5 §Access Code Gating Rules
export function filterKnowledgeForGuest(
  blocks:           Partial<Record<BlockType, RawBlock>>,
  sessionPhase:     SessionPhase,
  checkinDate:      string,
  checkoutDate:     string,
  requestTimestamp: string,
): Partial<Record<BlockType, RawBlock>> {
  const result: Partial<Record<BlockType, RawBlock>> = {}
  const gateOpen = isCredentialGateOpen(sessionPhase, checkoutDate, requestTimestamp)

  for (const key of Object.keys(blocks) as BlockType[]) {
    const block = blocks[key]
    if (!block) continue

    // Scope filter: exclude PTR and INT
    if (block.visibility_scope !== 'PUB' && block.visibility_scope !== 'GST') continue

    const credFields = CREDENTIAL_FIELDS[key] ?? []
    if (credFields.length > 0 && !gateOpen) {
      const gatedContent: Record<string, unknown> = { ...block.content_jsonb }
      for (const field of credFields) {
        if (field in gatedContent) gatedContent[field] = SENTINEL
      }
      result[key] = { ...block, content_jsonb: gatedContent }
    } else {
      result[key] = block
    }
  }

  return result
}

// Applies the session_phase_gate column from property_knowledge_blocks.
//
// If session_phase_gate is null: block is available in all phases (no restriction).
// If session_phase_gate is a comma-separated list: block is only included if
// the current sessionPhase is in the allowed list.
//
// checkinDate, checkoutDate, requestTimestamp are included for contract completeness
// (post-checkout edge cases are handled in filterKnowledgeForGuest's access code gate).
//
// See: property-knowledge-schema.md v1.5 §Session Phase Knowledge Gate
export function filterKnowledgeByPhase(
  blocks:             Partial<Record<BlockType, RawBlock>>,
  sessionPhase:       SessionPhase,
  _checkinDate:       string,
  _checkoutDate:      string,
  _requestTimestamp:  string,
): Partial<Record<BlockType, RawBlock>> {
  const result: Partial<Record<BlockType, RawBlock>> = {}

  for (const key of Object.keys(blocks) as BlockType[]) {
    const block = blocks[key]
    if (!block) continue

    const gate = block.session_phase_gate
    if (!gate) {
      // No restriction — include in all phases
      result[key] = block
      continue
    }

    const allowedPhases = gate.split(',').map(p => p.trim())
    if (allowedPhases.includes(sessionPhase)) result[key] = block
    // else: excluded for this phase
  }

  return result
}

// ── Sprint 012C: Context assembly ─────────────────────────────────────────

// Assembles the full ConciergeContext from its component parts.
// Design contract: property-knowledge-schema.md v1.5 §Concierge Context Shape.
//
// Knowledge map: all 14 block types present — null for any type not in filteredBlocks.
// emergency and property_summary should always be non-null in a valid property setup.
//
// Excluded from context: commission, partner data, owner financials, guest_phone,
// reservation_id (raw UUID), homeowner identity.
export function buildConciergeContext(
  sessionRow: {
    id: string; session_status: SessionStatus; session_phase: SessionPhase
    detected_language: string | null; unresolved_query_count: number
  },
  reservationRow: {
    guest_name: string; guest_count: number; checkin_date: string
    checkout_date: string; confirmation_number: string; special_requests: string | null
  },
  propertyRow: {
    id: string; display_name: string; property_type: string
    address_city: string; nearest_airport?: string | null
  },
  filteredBlocks:    Partial<Record<BlockType, RawBlock>>,
  emergencyData:     EmergencyChunk,
  emergencyContacts: EmergencyContact[],
): ConciergeContext {
  // Build knowledge map: all 14 types, null where not loaded
  const knowledge = {} as KnowledgeMap
  for (const bt of ALL_BLOCK_TYPES) {
    knowledge[bt] = filteredBlocks[bt]?.content_jsonb ?? null
  }

  return {
    session: {
      session_id:             sessionRow.id,
      session_status:         sessionRow.session_status,
      session_phase:          sessionRow.session_phase,
      detected_language:      sessionRow.detected_language ?? 'en',
      unresolved_query_count: sessionRow.unresolved_query_count,
      is_escalated:           sessionRow.session_status === 'escalated',
      schema_version:         CONTEXT_SCHEMA_VERSION,
    },
    guest: {
      guest_name:          reservationRow.guest_name,
      guest_count:         reservationRow.guest_count,
      checkin_date:        reservationRow.checkin_date,
      checkout_date:       reservationRow.checkout_date,
      confirmation_number: reservationRow.confirmation_number,
      special_requests:    reservationRow.special_requests ?? null,
    },
    property: {
      property_id:      propertyRow.id,
      display_name:     propertyRow.display_name,
      property_type:    propertyRow.property_type,
      address_locality: propertyRow.address_city,
      nearest_airport:  propertyRow.nearest_airport ?? null,
      is_complete:      emergencyData.is_complete,
      schema_version:   '1.0',
      generated_at:     new Date().toISOString(),
    },
    knowledge,
    emergency:          emergencyData,
    emergency_contacts: emergencyContacts,
    stay_context:       null,
  }
}

// Runs all Sprint 012C load + filter + assemble steps.
// Returns null on any loading failure so context errors do not block session resolution.
async function loadAndBuildContext(
  supabase:      SupabaseClient,
  sessionRow:    {
    id: string; session_status: SessionStatus; session_phase: SessionPhase
    detected_language: string | null; unresolved_query_count: number
  },
  reservationRow: {
    id: string; property_id: string; guest_name: string; guest_count: number
    checkin_date: string; checkout_date: string; confirmation_number: string
    special_requests: string | null
  },
  propertyRow: {
    id: string; display_name: string; property_type: string
    address_city: string; nearest_airport?: string | null
  },
  requestTimestamp: string,
): Promise<ConciergeContext | null> {
  try {
    const phase = sessionRow.session_phase

    // All three loads run in parallel — independent of each other
    const [rawBlocks, emergencyData, emergencyContacts] = await Promise.all([
      loadPropertyKnowledge(supabase, reservationRow.property_id, []),
      loadEmergencyData(supabase, reservationRow.property_id),
      loadEmergencyContacts(supabase, reservationRow.property_id),
    ])

    const guestBlocks = filterKnowledgeForGuest(
      rawBlocks, phase, reservationRow.checkin_date, reservationRow.checkout_date, requestTimestamp,
    )

    const phaseBlocks = filterKnowledgeByPhase(
      guestBlocks, phase, reservationRow.checkin_date, reservationRow.checkout_date, requestTimestamp,
    )

    return buildConciergeContext(
      sessionRow, reservationRow, propertyRow, phaseBlocks, emergencyData, emergencyContacts,
    )
  } catch {
    return null
  }
}

// ── Phone-based identity resolver ─────────────────────────────────────────
// Resolves an inbound phone number to a ResolvedInput (session + reservation +
// property + conversation) for use by concierge-inbound-sim and concierge-inbound.
// Resolution order:
//   1. Normalize phone via normalizePhone (E.164, returns null on invalid)
//   2. Active whatsapp_session with matching guest_phone → use its reservation
//   3. Active reservation with matching guest_phone (status confirmed|pre_arrival|checked_in)
//   4. Check guest_phone_verified on matched reservation (always — even when existing session found)
//      → false: write unverified_guest_message timeline event, return UNVERIFIED_GUEST
//   5. Create new session with phone populated (only when verified)
//   6. Invalid format or no match → UNAUTHORIZED_GUEST (caller writes event, neutral reply)

export async function resolveByPhone(
  svcClient:  SupabaseClient,
  guestPhone: string,
  todayStr:   string,
): Promise<ResolvedInput | SimError> {
  const normalized = normalizePhone(guestPhone)
  if (normalized === null) {
    return { ok: false, error: 'invalid phone number format', code: 'UNAUTHORIZED_GUEST', status: 401 }
  }

  // Step 1: look for an active session for this phone
  const { data: existingSession } = await svcClient
    .from('whatsapp_sessions')
    .select('id, reservation_id, session_status, session_phase, detected_language, unresolved_query_count')
    .eq('guest_phone', normalized)
    .in('session_status', ['active', 'waiting', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Step 2: if no session, find an active reservation by phone
  let reservationId: string
  if (existingSession) {
    reservationId = existingSession.reservation_id as string
  } else {
    const { data: matchedRes } = await svcClient
      .from('reservations')
      .select('id')
      .eq('guest_phone', normalized)
      .in('reservation_status', ['confirmed', 'pre_arrival', 'checked_in'])
      .order('checkin_date', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!matchedRes) {
      return { ok: false, error: 'no active reservation found for phone', code: 'UNAUTHORIZED_GUEST', status: 401 }
    }
    reservationId = matchedRes.id as string
  }

  // Load full reservation row
  const { data: reservation, error: resErr } = await svcClient
    .from('reservations')
    .select('id, property_id, guest_name, guest_phone, guest_phone_verified, guest_count, checkin_date, checkout_date, confirmation_number, special_requests')
    .eq('id', reservationId)
    .maybeSingle()

  if (resErr || !reservation) {
    return { ok: false, error: 'reservation not found', code: 'RESERVATION_NOT_FOUND', status: 404 }
  }

  // Verification gate — always checked, even when an existing session was found
  if (!reservation.guest_phone_verified) {
    await svcClient.from('timeline_events').insert({
      property_id:     reservation.property_id,
      reservation_id:  reservation.id,
      conversation_id: null,
      task_id:         null,
      actor_id:        null,
      actor_type:      'system',
      event_type:      'unverified_guest_message',
      event_title:     'Concierge: inbound message from guest with unverified phone',
      metadata:        { source: 'guestpal_ai', phone_verified: false },
    })
    return { ok: false, error: 'guest phone not verified by host', code: 'UNVERIFIED_GUEST', status: 403 }
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
  const convId = await findOrCreateConversation(svcClient, reservation.id, reservation.property_id)
  if (!convId) {
    return { ok: false, error: 'failed to resolve conversation', code: 'CONVERSATION_ERROR', status: 500 }
  }

  const phase = evaluateSessionPhase(reservation.checkin_date, reservation.checkout_date, todayStr)

  let sessionRow: ResolvedInput['sessionRow']

  if (existingSession) {
    sessionRow = {
      id:                     existingSession.id as string,
      session_status:         existingSession.session_status as SessionStatus,
      session_phase:          phase,
      detected_language:      existingSession.detected_language as string | null ?? null,
      unresolved_query_count: (existingSession.unresolved_query_count as number) ?? 0,
    }
    svcClient
      .from('whatsapp_sessions')
      .update({ session_phase: phase, last_message_at: new Date().toISOString() })
      .eq('id', existingSession.id as string)
      .then(() => {/* non-fatal */})
  } else {
    const { data: newSession, error: sessErr } = await svcClient
      .from('whatsapp_sessions')
      .insert({
        reservation_id:         reservation.id,
        property_id:            reservation.property_id,
        guest_phone:            normalized,
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
    conversationId: convId,
  }
}

// ── Core resolver ─────────────────────────────────────────────────────────

async function resolveSession(
  supabase: SupabaseClient,
  inbound:  InboundMessage,
  todayStr: string,
): Promise<ResolvedContext> {

  const requestTimestamp = new Date().toISOString()

  // ── STEP 1: Normalise phone ──────────────────────────────────────────
  const phone = normalizePhone(inbound.raw_phone)
  if (!phone) {
    return { state: 'error', error_code: 'INVALID_PHONE', error_detail: `Cannot normalise: ${inbound.raw_phone}` }
  }

  // ── STEP 2: Look for existing live session ───────────────────────────
  const { data: sessions, error: sessLookupErr } = await supabase
    .from('whatsapp_sessions')
    .select('id, session_status, session_phase, unresolved_query_count, detected_language, reservation_id, property_id')
    .eq('guest_phone', phone)
    .in('session_status', ['active', 'waiting', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)

  if (sessLookupErr) {
    return { state: 'error', error_code: 'DB_SESSION_LOOKUP', error_detail: sessLookupErr.message }
  }

  const session = sessions?.[0] ?? null

  // ── STEP 3: Escalated — hold, no AI ─────────────────────────────────
  if (session?.session_status === 'escalated') {
    await supabase
      .from('whatsapp_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', session.id)

    return {
      state: 'escalated_hold',
      session: {
        session_id:             session.id,
        session_status:         'escalated',
        session_phase:          session.session_phase,
        is_escalated:           true,
        unresolved_query_count: session.unresolved_query_count,
        detected_language:      session.detected_language,
      },
    }
  }

  // ── STEP 5 (variation): Waiting — disambiguation in progress ─────────
  if (session?.session_status === 'waiting') {
    const conversationId = await findOrCreateConversation(supabase, session.reservation_id, session.property_id)
    let messageId: string | undefined

    if (conversationId) {
      const { data: msgRow } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_type: 'guest', message_text: inbound.message_text })
        .select('id')
        .single()
      messageId = msgRow?.id
    }

    await supabase
      .from('whatsapp_sessions')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', session.id)

    return {
      state: 'disambiguation_needed',
      session: {
        session_id:             session.id,
        session_status:         'waiting',
        session_phase:          session.session_phase,
        is_escalated:           false,
        unresolved_query_count: session.unresolved_query_count,
        detected_language:      session.detected_language,
      },
      conversation_id: conversationId ?? undefined,
      message_id:      messageId,
    }
  }

  // ── STEP 4: Active session — resume ──────────────────────────────────
  if (session?.session_status === 'active') {
    const { data: reservation } = await supabase
      .from('reservations')
      .select('id, guest_name, guest_count, checkin_date, checkout_date, confirmation_number, special_requests, guest_preferred_language, property_id')
      .eq('id', session.reservation_id)
      .single()

    const { data: property } = await supabase
      .from('properties')
      .select('id, property_code, display_name, property_type, address_city, nearest_airport')
      .eq('id', session.property_id)
      .single()

    const currentPhase = reservation
      ? evaluateSessionPhase(reservation.checkin_date, reservation.checkout_date, todayStr)
      : session.session_phase

    await supabase
      .from('whatsapp_sessions')
      .update({ session_phase: currentPhase, last_message_at: new Date().toISOString() })
      .eq('id', session.id)

    const conversationId = reservation
      ? await findOrCreateConversation(supabase, reservation.id, session.property_id)
      : null

    let messageId: string | undefined
    if (conversationId) {
      const { data: msgRow } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_type: 'guest', message_text: inbound.message_text })
        .select('id')
        .single()
      messageId = msgRow?.id
    }

    const sessionRowForCtx = {
      id:                     session.id,
      session_status:         'active' as SessionStatus,
      session_phase:          currentPhase,
      detected_language:      session.detected_language,
      unresolved_query_count: session.unresolved_query_count,
    }

    const conciergeContext = (reservation && property)
      ? await loadAndBuildContext(supabase, sessionRowForCtx, reservation, property, requestTimestamp)
      : null

    return {
      state: 'resolved',
      session: {
        session_id:             session.id,
        session_status:         'active',
        session_phase:          currentPhase,
        is_escalated:           false,
        unresolved_query_count: session.unresolved_query_count,
        detected_language:      session.detected_language,
      },
      guest: reservation ? {
        guest_name:               reservation.guest_name,
        guest_count:              reservation.guest_count,
        checkin_date:             reservation.checkin_date,
        checkout_date:            reservation.checkout_date,
        confirmation_number:      reservation.confirmation_number,
        special_requests:         reservation.special_requests ?? null,
        guest_preferred_language: reservation.guest_preferred_language ?? null,
      } : undefined,
      property: property ? {
        property_id:   property.id,
        property_code: property.property_code,
        display_name:  property.display_name,
        property_type: property.property_type,
        city:          property.address_city,
      } : undefined,
      conversation_id:   conversationId ?? undefined,
      message_id:        messageId,
      concierge_context: conciergeContext,
    }
  }

  // ── No existing session — resolve from reservation ────────────────────

  const windowStart = new Date(todayStr)
  windowStart.setDate(windowStart.getDate() - POST_STAY_GRACE_DAYS)
  const windowEnd = new Date(todayStr)
  windowEnd.setDate(windowEnd.getDate() + PRE_ARRIVAL_WINDOW_DAYS)

  const winStartStr = windowStart.toISOString().split('T')[0]
  const winEndStr   = windowEnd.toISOString().split('T')[0]

  const { data: reservations, error: resErr } = await supabase
    .from('reservations')
    .select('id, property_id, guest_name, guest_count, checkin_date, checkout_date, confirmation_number, special_requests, guest_preferred_language, reservation_status')
    .eq('guest_phone', phone)
    .in('reservation_status', ['confirmed', 'pre_arrival', 'checked_in'])
    .lte('checkin_date', winEndStr)
    .gte('checkout_date', winStartStr)

  if (resErr) {
    return { state: 'error', error_code: 'DB_RESERVATION_LOOKUP', error_detail: resErr.message }
  }

  if (!reservations || reservations.length === 0) {
    return { state: 'unresolvable', error_code: 'IDENTITY_UNRESOLVABLE' }
  }

  // ── Disambiguation: multiple reservations ─────────────────────────────
  if (reservations.length > 1) {
    const first = reservations[0]
    const phase = evaluateSessionPhase(first.checkin_date, first.checkout_date, todayStr)

    await supabase
      .from('whatsapp_sessions')
      .insert({
        guest_phone:     phone,
        reservation_id:  first.id,
        property_id:     first.property_id,
        session_status:  'waiting',
        session_phase:   phase,
        last_message_at: new Date().toISOString(),
        session_cache:   { disambiguation_reservation_ids: reservations.map((r: { id: string }) => r.id) },
      })

    return {
      state:        'disambiguation_needed',
      error_code:   'MULTIPLE_RESERVATIONS',
      error_detail: `${reservations.length} reservations match this phone number in the active window`,
    }
  }

  // ── STEP 8: Single reservation — create session ───────────────────────
  const reservation = reservations[0]
  const phase = evaluateSessionPhase(reservation.checkin_date, reservation.checkout_date, todayStr)

  const { data: newSession, error: createErr } = await supabase
    .from('whatsapp_sessions')
    .insert({
      guest_phone:     phone,
      reservation_id:  reservation.id,
      property_id:     reservation.property_id,
      session_status:  'active',
      session_phase:   phase,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (createErr || !newSession) {
    return { state: 'error', error_code: 'SESSION_CREATE_FAILED', error_detail: createErr?.message }
  }

  const conversationId = await findOrCreateConversation(supabase, reservation.id, reservation.property_id)

  let messageId: string | undefined
  if (conversationId) {
    const { data: msgRow } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, sender_type: 'guest', message_text: inbound.message_text })
      .select('id')
      .single()
    messageId = msgRow?.id
  }

  const { data: property } = await supabase
    .from('properties')
    .select('id, property_code, display_name, property_type, address_city, nearest_airport')
    .eq('id', reservation.property_id)
    .single()

  // ── Sprint 012C: Build ConciergeContext ───────────────────────────────
  const sessionRowForCtx = {
    id:                     newSession.id,
    session_status:         'active' as SessionStatus,
    session_phase:          phase,
    detected_language:      null as string | null,
    unresolved_query_count: 0,
  }

  const conciergeContext = property
    ? await loadAndBuildContext(supabase, sessionRowForCtx, reservation, property, requestTimestamp)
    : null

  return {
    state: 'resolved',
    session: {
      session_id:             newSession.id,
      session_status:         'active',
      session_phase:          phase,
      is_escalated:           false,
      unresolved_query_count: 0,
      detected_language:      null,
    },
    guest: {
      guest_name:               reservation.guest_name,
      guest_count:              reservation.guest_count,
      checkin_date:             reservation.checkin_date,
      checkout_date:            reservation.checkout_date,
      confirmation_number:      reservation.confirmation_number,
      special_requests:         reservation.special_requests ?? null,
      guest_preferred_language: reservation.guest_preferred_language ?? null,
    },
    property: property ? {
      property_id:   property.id,
      property_code: property.property_code,
      display_name:  property.display_name,
      property_type: property.property_type,
      city:          property.address_city,
    } : undefined,
    conversation_id:   conversationId ?? undefined,
    message_id:        messageId,
    concierge_context: conciergeContext,
  }
}

// ── HTTP handler ──────────────────────────────────────────────────────────

const handler = async (req: Request): Promise<Response> => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: 'Missing environment configuration' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Service role client — bypasses RLS for session and message writes.
  // Commission and partner data are never queried from this function.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  let body: InboundMessage
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.raw_phone || !body.message_text) {
    return new Response(JSON.stringify({ error: 'raw_phone and message_text are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Today's date in Europe/Rome timezone — required for correct phase evaluation.
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })

  const context = await resolveSession(supabase, body, todayStr)

  return new Response(JSON.stringify(context), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

// Only start the HTTP server when running as the main module (not when imported for tests).
if (import.meta.main) {
  serve(handler)
}
