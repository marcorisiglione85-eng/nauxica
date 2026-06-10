// supabase/functions/concierge-resolver/index.test.ts
// Sprint 012C — Context Loader Layer: unit tests
// Tests only pure exported functions — no DB connection required.
// Run: deno test supabase/functions/concierge-resolver/index.test.ts

import { assertEquals, assertExists } from 'https://deno.land/std@0.168.0/testing/asserts.ts'
import {
  isCredentialGateOpen,
  filterKnowledgeForGuest,
  filterKnowledgeByPhase,
  buildConciergeContext,
  SENTINEL,
  ALL_BLOCK_TYPES,
} from './index.ts'
import type {
  BlockType,
  RawBlock,
  EmergencyChunk,
  EmergencyContact,
  SessionStatus,
  SessionPhase,
} from './index.ts'

// ── Test fixtures ─────────────────────────────────────────────────────────

function makeBlock(blockType: BlockType, overrides: Partial<RawBlock> = {}): RawBlock {
  return {
    id:                 'block-' + blockType,
    property_id:        'prop-001',
    block_type:         blockType,
    visibility_scope:   'GST',
    session_phase_gate: null,
    content_jsonb:      { sample: 'data' },
    is_active:          true,
    ...overrides,
  }
}

function makeSessionRow(overrides: Partial<{
  id: string; session_status: SessionStatus; session_phase: SessionPhase
  detected_language: string | null; unresolved_query_count: number
}> = {}) {
  return {
    id:                     'sess-001',
    session_status:         'active' as SessionStatus,
    session_phase:          'in_stay' as SessionPhase,
    detected_language:      'en',
    unresolved_query_count: 0,
    ...overrides,
  }
}

function makeReservationRow(overrides: Partial<{
  guest_name: string; guest_count: number; checkin_date: string
  checkout_date: string; confirmation_number: string; special_requests: string | null
}> = {}) {
  return {
    guest_name:          'Luca Bianchi',
    guest_count:         2,
    checkin_date:        '2026-06-01',
    checkout_date:       '2026-06-08',
    confirmation_number: 'CONF-001',
    special_requests:    null,
    ...overrides,
  }
}

function makePropertyRow(overrides: Partial<{
  id: string; display_name: string; property_type: string
  address_city: string; nearest_airport: string | null
}> = {}) {
  return {
    id:            'prop-001',
    display_name:  'Villa Etna',
    property_type: 'villa',
    address_city:  'Nicolosi',
    nearest_airport: 'CTA',
    ...overrides,
  }
}

const FALLBACK_EMERGENCY: EmergencyChunk = {
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

const COMPLETE_EMERGENCY: EmergencyChunk = {
  is_complete:                      true,
  owner_emergency_name:             'Mario Rossi',
  owner_emergency_phone:            '+39333000111',
  nauxica_ops_phone:                '+39020000000',
  nearest_hospital_name:            'Ospedale Vittorio Emanuele',
  nearest_hospital_address:         'Via Plebiscito, Catania',
  nearest_hospital_distance:        '3 km',
  gas_shutoff_instructions:         'Turn valve left under sink',
  water_shutoff_instructions:       'Basement stopcock',
  electricity_shutoff_instructions: 'Main breaker in hallway panel',
  evacuation_route_description:     null,
  evacuation_assembly_point:        null,
  property_specific_hazards:        null,
}

// ── Sprint 012C Test Cases ────────────────────────────────────────────────

// TC-1: No knowledge blocks loaded → all 14 knowledge map entries are null.
// Verifies that buildConciergeContext always produces a complete KnowledgeMap.
Deno.test('TC-1: no knowledge blocks — all 14 knowledge entries are null', () => {
  const ctx = buildConciergeContext(
    makeSessionRow(),
    makeReservationRow(),
    makePropertyRow(),
    {},                  // empty filteredBlocks — no blocks loaded from DB
    FALLBACK_EMERGENCY,
    [],
  )

  assertEquals(ALL_BLOCK_TYPES.length, 14, 'Expected 14 canonical block types')
  for (const bt of ALL_BLOCK_TYPES) {
    assertEquals(ctx.knowledge[bt], null, `Expected knowledge[${bt}] to be null`)
  }
  assertEquals(ctx.stay_context, null)
})

// TC-2: GST-scoped active blocks pass through filterKnowledgeForGuest.
// Inactive blocks are excluded at DB level by loadPropertyKnowledge (is_active=true filter).
// This test confirms active GST blocks are included by the scope filter.
Deno.test('TC-2: active GST block passes through guest visibility filter', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    amenities: makeBlock('amenities', { visibility_scope: 'GST', is_active: true }),
  }

  const result = filterKnowledgeForGuest(
    blocks, 'in_stay', '2026-06-01', '2026-06-08', '2026-06-05T10:00:00Z',
  )

  assertExists(result['amenities'])
  assertEquals(result['amenities']!.block_type, 'amenities')
})

// TC-3: Post-stay phase restrictions — blocks with gates not including post_stay are excluded.
// session_phase_gate is a comma-separated list of allowed phases or null (unrestricted).
Deno.test('TC-3: post-stay phase restrictions — gated blocks excluded', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    amenities:       makeBlock('amenities',       { session_phase_gate: 'check_in,in_stay,check_out' }),
    house_rules:     makeBlock('house_rules',     { session_phase_gate: 'pre_arrival,check_in,in_stay' }),
    property_summary: makeBlock('property_summary', { session_phase_gate: null }),
  }

  const result = filterKnowledgeByPhase(
    blocks, 'post_stay', '2026-06-01', '2026-06-08', '2026-06-09T10:00:00Z',
  )

  assertEquals(result['amenities'],   undefined, 'amenities gated out of post_stay')
  assertEquals(result['house_rules'], undefined, 'house_rules gated out of post_stay')
  assertExists(result['property_summary'], 'property_summary has no gate — always included')
})

// TC-4: Emergency and property_summary blocks have null gate → always available in all phases.
// null session_phase_gate = no restriction. Covers the Rule EM-01 phase invariant.
Deno.test('TC-4: emergency block always available in post-stay (null gate)', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    emergency:        makeBlock('emergency',        { session_phase_gate: null }),
    property_summary: makeBlock('property_summary', { session_phase_gate: null }),
    check_in:         makeBlock('check_in',         { session_phase_gate: 'pre_arrival,check_in' }),
  }

  const result = filterKnowledgeByPhase(
    blocks, 'post_stay', '2026-06-01', '2026-06-08', '2026-06-09T10:00:00Z',
  )

  assertExists(result['emergency'],        'emergency passes — no gate restriction')
  assertExists(result['property_summary'], 'property_summary passes — no gate restriction')
  assertEquals(result['check_in'], undefined, 'check_in excluded — post_stay not in gate')
})

// TC-5: Guest visibility filtering — PTR and INT blocks excluded, PUB and GST included.
// Source: data-visibility-model.md §Scope taxonomy
Deno.test('TC-5: guest visibility — PTR and INT blocks excluded, PUB and GST included', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    amenities:   makeBlock('amenities',   { visibility_scope: 'GST' }),
    house_rules: makeBlock('house_rules', { visibility_scope: 'PUB' }),
    services:    makeBlock('services',    { visibility_scope: 'PTR' }),
    maintenance: makeBlock('maintenance', { visibility_scope: 'INT' }),
  }

  const result = filterKnowledgeForGuest(
    blocks, 'in_stay', '2026-06-01', '2026-06-08', '2026-06-05T10:00:00Z',
  )

  assertExists(result['amenities'],   'GST block included for guest')
  assertExists(result['house_rules'], 'PUB block included for guest')
  assertEquals(result['services'],    undefined, 'PTR block excluded for guest')
  assertEquals(result['maintenance'], undefined, 'INT block excluded for guest')
})

// TC-6: Emergency contacts field mapping preserved in buildConciergeContext.
// loadEmergencyContacts maps DB columns (contact_name→display_name, contact_phone→phone).
// buildConciergeContext passes the already-mapped contacts through unchanged.
Deno.test('TC-6: emergency contacts — field mapping and pass-through verified', () => {
  const contacts: EmergencyContact[] = [
    {
      contact_type:        'nauxica_operator',
      display_name:        'Nauxica Support',
      phone:               '+39020000000',
      available_hours:     '24/7',
      escalation_priority: 0,
    },
    {
      contact_type:        'owner',
      display_name:        'Mario Rossi',
      phone:               '+39333000111',
      available_hours:     null,
      escalation_priority: 1,
    },
  ]

  const ctx = buildConciergeContext(
    makeSessionRow(),
    makeReservationRow(),
    makePropertyRow(),
    {},
    COMPLETE_EMERGENCY,
    contacts,
  )

  assertEquals(ctx.emergency_contacts.length, 2)
  assertEquals(ctx.emergency_contacts[0].display_name,        'Nauxica Support')
  assertEquals(ctx.emergency_contacts[0].phone,               '+39020000000')
  assertEquals(ctx.emergency_contacts[0].contact_type,        'nauxica_operator')
  assertEquals(ctx.emergency_contacts[0].available_hours,     '24/7')
  assertEquals(ctx.emergency_contacts[0].escalation_priority, 0)
  assertEquals(ctx.emergency_contacts[1].display_name,        'Mario Rossi')
  assertEquals(ctx.emergency_contacts[1].available_hours,     null)
})

// TC-7: Missing emergency data → is_complete=false in both emergency and property sections.
// Rule EM-01: loadEmergencyData never returns null — returns fallback with is_complete=false.
// buildConciergeContext propagates is_complete to property.is_complete.
Deno.test('TC-7: missing emergency data — is_complete=false in emergency and property', () => {
  const ctx = buildConciergeContext(
    makeSessionRow(),
    makeReservationRow(),
    makePropertyRow(),
    {},
    FALLBACK_EMERGENCY,  // is_complete: false — no DB row found
    [],
  )

  assertEquals(ctx.emergency.is_complete, false)
  assertEquals(ctx.property.is_complete,  false)
  assertEquals(ctx.emergency.owner_emergency_name,  '')
  assertEquals(ctx.emergency.nauxica_ops_phone,     '')
})

// TC-8: Multiple contacts with same escalation priority — order preserved as received.
// Ordering (escalation_priority ASC, contact_type ASC, created_at ASC) is done by
// loadEmergencyContacts at the DB level. buildConciergeContext preserves the input order.
Deno.test('TC-8: multiple contacts same priority — order preserved as received', () => {
  const contacts: EmergencyContact[] = [
    { contact_type: 'caretaker', display_name: 'Alfonso', phone: '+39333001001', available_hours: null, escalation_priority: 2 },
    { contact_type: 'caretaker', display_name: 'Beatrice', phone: '+39333001002', available_hours: null, escalation_priority: 2 },
    { contact_type: 'caretaker', display_name: 'Carlo',   phone: '+39333001003', available_hours: null, escalation_priority: 2 },
  ]

  const ctx = buildConciergeContext(
    makeSessionRow(),
    makeReservationRow(),
    makePropertyRow(),
    {},
    COMPLETE_EMERGENCY,
    contacts,
  )

  assertEquals(ctx.emergency_contacts.length, 3)
  assertEquals(ctx.emergency_contacts[0].display_name, 'Alfonso')
  assertEquals(ctx.emergency_contacts[1].display_name, 'Beatrice')
  assertEquals(ctx.emergency_contacts[2].display_name, 'Carlo')
})

// ── Bonus: isCredentialGateOpen ───────────────────────────────────────────

Deno.test('BONUS-1: isCredentialGateOpen — open during check_in before expiry', () => {
  assertEquals(
    isCredentialGateOpen('check_in', '2026-06-08', '2026-06-07T10:00:00Z'),
    true,
  )
})

Deno.test('BONUS-2: isCredentialGateOpen — open during in_stay before expiry', () => {
  assertEquals(
    isCredentialGateOpen('in_stay', '2026-06-08', '2026-06-05T10:00:00Z'),
    true,
  )
})

Deno.test('BONUS-3: isCredentialGateOpen — closed in pre_arrival regardless of timestamp', () => {
  assertEquals(
    isCredentialGateOpen('pre_arrival', '2026-06-08', '2026-06-06T10:00:00Z'),
    false,
  )
})

Deno.test('BONUS-4: isCredentialGateOpen — closed after checkout + 4h even if phase is in_stay', () => {
  // checkout '2026-06-08' → expiry 2026-06-08T04:00:00.000Z
  // request at 2026-06-08T05:00:00Z is past expiry → gate closed
  assertEquals(
    isCredentialGateOpen('in_stay', '2026-06-08', '2026-06-08T05:00:00.000Z'),
    false,
  )
})

Deno.test('BONUS-5: isCredentialGateOpen — closed in post_stay', () => {
  assertEquals(
    isCredentialGateOpen('post_stay', '2026-06-08', '2026-06-09T10:00:00Z'),
    false,
  )
})

// ── Bonus: credential sentinel replacement ────────────────────────────────

// Credential fields in 'access' and 'wifi' blocks are replaced with SENTINEL
// when the gate is closed (pre_arrival, check_out, post_stay phases).
// Non-credential fields in the same block are not modified.
Deno.test('BONUS-6: credential sentinel — access credential fields replaced when gate closed', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    access: makeBlock('access', {
      visibility_scope: 'GST',
      content_jsonb: {
        key_box_code:        '1234',
        smart_lock_code:     '5678',
        building_door_code:  '9999',
        gate_code:           '0000',
        parking_access_code: 'PARK1',
        key_box_location:    'Front door right side',
        entry_instructions:  'Ring bell then enter',
      },
    }),
  }

  const result = filterKnowledgeForGuest(
    blocks, 'pre_arrival', '2026-06-01', '2026-06-08', '2026-05-30T10:00:00Z',
  )

  const accessBlock = result['access']
  assertExists(accessBlock)
  assertEquals(accessBlock.content_jsonb['key_box_code'],        SENTINEL)
  assertEquals(accessBlock.content_jsonb['smart_lock_code'],     SENTINEL)
  assertEquals(accessBlock.content_jsonb['building_door_code'],  SENTINEL)
  assertEquals(accessBlock.content_jsonb['gate_code'],           SENTINEL)
  assertEquals(accessBlock.content_jsonb['parking_access_code'], SENTINEL)
  // Non-credential fields preserved unchanged
  assertEquals(accessBlock.content_jsonb['key_box_location'],    'Front door right side')
  assertEquals(accessBlock.content_jsonb['entry_instructions'],  'Ring bell then enter')
})

Deno.test('BONUS-7: credential sentinel — wifi_password replaced, network name preserved', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    wifi: makeBlock('wifi', {
      visibility_scope: 'GST',
      content_jsonb: {
        wifi_network_name: 'VillaEtna_5G',
        wifi_password:     'secretpass123',
      },
    }),
  }

  const result = filterKnowledgeForGuest(
    blocks, 'pre_arrival', '2026-06-01', '2026-06-08', '2026-05-30T10:00:00Z',
  )

  const wifiBlock = result['wifi']
  assertExists(wifiBlock)
  assertEquals(wifiBlock.content_jsonb['wifi_password'],     SENTINEL)
  assertEquals(wifiBlock.content_jsonb['wifi_network_name'], 'VillaEtna_5G')
})

Deno.test('BONUS-8: credential fields delivered in clear text when gate is open (in_stay)', () => {
  const blocks: Partial<Record<BlockType, RawBlock>> = {
    access: makeBlock('access', {
      visibility_scope: 'GST',
      content_jsonb: {
        key_box_code:     '1234',
        key_box_location: 'Front door',
      },
    }),
    wifi: makeBlock('wifi', {
      visibility_scope: 'GST',
      content_jsonb: {
        wifi_network_name: 'VillaEtna_5G',
        wifi_password:     'secretpass123',
      },
    }),
  }

  const result = filterKnowledgeForGuest(
    blocks, 'in_stay', '2026-06-01', '2026-06-08', '2026-06-05T10:00:00Z',
  )

  assertExists(result['access'])
  assertEquals(result['access']!.content_jsonb['key_box_code'], '1234')
  assertExists(result['wifi'])
  assertEquals(result['wifi']!.content_jsonb['wifi_password'], 'secretpass123')
})
