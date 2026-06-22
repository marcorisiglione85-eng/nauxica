// supabase/functions/concierge-inbound-sim/local-test.ts
// Sprint 016A — Local classifier + composer unit tests
//
// Tests classifyQuery and composeReply directly against a mock ConciergeContext
// using synthetic test data only. No real property, guest, or owner data.
// No DB, no Docker, no deployment.
//
// Run: deno run local-test.ts
// (from supabase/functions/concierge-inbound-sim/)

// ── Inline types (subset of concierge-resolver exports) ──────────────────

type SessionPhase  = 'pre_arrival' | 'check_in' | 'in_stay' | 'check_out' | 'post_stay'
type SessionStatus = 'active' | 'waiting' | 'closed' | 'escalated'
type BlockType =
  | 'emergency' | 'property_summary' | 'access' | 'check_in' | 'check_out'
  | 'wifi' | 'amenities' | 'house_rules' | 'local_area' | 'services'
  | 'maintenance' | 'tourist_tax' | 'booking_policy' | 'fallback_support'
type VisibilityScope = 'PUB' | 'GST' | 'PTR' | 'INT'
type KnowledgeMap = Record<BlockType, Record<string, unknown> | null>

interface EmergencyChunk {
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

interface EmergencyContact {
  contact_type:        string
  display_name:        string
  phone:               string
  available_hours:     string | null
  escalation_priority: number
}

interface ConciergeContext {
  session: {
    session_id:             string
    session_status:         SessionStatus
    session_phase:          SessionPhase
    detected_language:      string
    unresolved_query_count: number
    is_escalated:           boolean
    schema_version:         string
  }
  guest: {
    guest_name:          string
    guest_count:         number
    checkin_date:        string
    checkout_date:       string
    confirmation_number: string
    special_requests:    string | null
  }
  property: {
    property_id:      string
    display_name:     string
    property_type:    string
    address_locality: string
    nearest_airport:  string | null
    is_complete:      boolean
    schema_version:   string
    generated_at:     string
  }
  knowledge:          KnowledgeMap
  emergency:          EmergencyChunk
  emergency_contacts: EmergencyContact[]
  stay_context:       null
}

type QueryCategory =
  | 'CAT-01' | 'CAT-02' | 'CAT-03' | 'CAT-04' | 'CAT-05' | 'CAT-06'
  | 'CAT-07' | 'CAT-08' | 'CAT-09' | 'CAT-10' | 'CAT-11' | 'CAT-12'

interface ClassifierResult {
  category:   QueryCategory
  confidence: 'high' | 'medium' | 'low'
  block_hint: BlockType | null
}

interface ComposerResult {
  reply:         string
  matched_block: BlockType | null
  fallback:      boolean
}

// Inline — same value as exported SENTINEL from concierge-resolver
const SENTINEL = '[not yet available]'

// ── Classifier (copied verbatim from index.ts) ────────────────────────────

const CLASSIFIER_RULES: Array<{
  category:   QueryCategory
  block_hint: BlockType | null
  keywords:   readonly string[]
}> = [
  {
    category: 'CAT-01', block_hint: null,
    keywords: [
      'emergency', 'gas leak', 'i smell gas', 'gas smell', 'flooding', 'flood',
      'fire', 'on fire', 'smoke alarm', 'i smell smoke', 'injury', 'injured',
      'accident', 'bleeding', 'fainted', 'unconscious', 'ambulance', 'call 118',
      'call 112', 'medical emergency', 'need a doctor urgently',
      'heart attack', 'collapse', 'sos', 'please send help', 'need urgent help',
    ],
  },
  {
    category: 'CAT-02', block_hint: 'access',
    keywords: [
      'door code', 'key box', 'lockbox', 'lock box', 'lockbox code', 'lock code',
      'gate code', 'building code', 'entry code', 'how do i get in', 'how to get in',
      'locked out', 'get into the', 'access code', 'smart lock', 'key collection',
      'where is the key', 'how do i enter', 'how do i access',
    ],
  },
  {
    category: 'CAT-03', block_hint: 'check_in',
    keywords: [
      'check in', 'checkin', 'check-in', 'arriving', 'arrival', 'arrive',
      'when can i arrive', 'what time can i check', 'early check in', 'early arrival',
      'directions to', 'how to find the property', 'get to the property',
    ],
  },
  {
    category: 'CAT-04', block_hint: 'check_out',
    keywords: [
      'check out', 'checkout', 'check-out', 'leaving', 'departure time', 'when do i leave',
      'when must i leave', 'late check out', 'late checkout', 'key return',
      'what time do i have to leave', 'checkout time', 'how do i check out',
    ],
  },
  {
    category: 'CAT-10', block_hint: 'maintenance',
    keywords: [
      'not working', 'broken', 'something is broken', 'broken down', 'fault',
      'damage', 'damaged', 'no hot water', 'no water', 'no electricity', 'no power',
      'power out', 'power outage', 'leaking', 'burst pipe', 'report a problem',
      'there is a problem', 'issue with', 'something wrong',
    ],
  },
  {
    category: 'CAT-05', block_hint: 'wifi',
    keywords: [
      'wifi', 'wi-fi', 'wi fi', 'wifi password', 'wifi code', 'internet password',
      'network name', 'wifi network', 'how to connect', 'internet not working',
      'no internet', 'no wifi', 'wifi not working', 'internet connection',
    ],
  },
  {
    category: 'CAT-06', block_hint: 'amenities',
    keywords: [
      'washing machine', 'dishwasher', 'television', 'tv remote', 'smart tv',
      'air conditioning', 'air con', 'heating system', 'coffee machine',
      'swimming pool', 'pool hours', 'pool instructions', 'bbq', 'barbecue',
      'how do i use the', 'how does the', 'appliance', 'dryer',
    ],
  },
  {
    category: 'CAT-07', block_hint: 'house_rules',
    keywords: [
      'house rules', 'property rules', 'am i allowed', 'are pets allowed',
      'is smoking allowed', 'can i smoke', 'noise rules', 'quiet hours',
      'can i have visitors', 'extra guests', 'party rules', 'pet policy',
      'smoking policy', 'what are the rules',
    ],
  },
  {
    category: 'CAT-09', block_hint: 'services',
    keywords: [
      'can you book', 'can you arrange', 'book a taxi', 'book a tour',
      'arrange a transfer', 'book an experience', 'cooking class', 'boat trip',
      'restaurant reservation', 'can you organise', 'book for me',
    ],
  },
  {
    category: 'CAT-08', block_hint: 'local_area',
    keywords: [
      'restaurant', 'where to eat', 'things to do', 'local recommendations',
      'nearest supermarket', 'nearest beach', 'nearest pharmacy', 'what is nearby',
      'local area', 'local tips', 'what to visit', 'what to do around here',
      'sightseeing', 'best places', 'explore', 'things to see',
    ],
  },
  {
    category: 'CAT-11', block_hint: 'tourist_tax',
    keywords: [
      'tourist tax', 'tassa di soggiorno', 'city tax', 'local tax',
      'how much do i owe', 'tax payment', 'tourist fee', 'accommodation tax',
    ],
  },
  {
    category: 'CAT-12', block_hint: 'fallback_support',
    keywords: [
      'tell me about the property', 'about the property', 'what can you tell me',
      'what can i ask you', 'what do you know', 'property info', 'general info',
      'hello', 'hi', 'hey',
    ],
  },
]

function classifyQuery(message: string, _sessionPhase: SessionPhase): ClassifierResult {
  const lower = message.toLowerCase()
  const matchedCategories: QueryCategory[] = []

  for (const rule of CLASSIFIER_RULES) {
    for (const kw of rule.keywords) {
      if (lower.includes(kw)) {
        matchedCategories.push(rule.category)
        break
      }
    }
  }

  if (matchedCategories.length === 0) {
    return { category: 'CAT-12', confidence: 'low', block_hint: 'fallback_support' }
  }

  const best = matchedCategories[0]
  const rule = CLASSIFIER_RULES.find(r => r.category === best)!
  const confidence: 'high' | 'medium' | 'low' = matchedCategories.length === 1 ? 'high' : 'medium'
  return { category: best, confidence, block_hint: rule.block_hint }
}

// ── Composer (copied verbatim from index.ts) ──────────────────────────────

function str(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

function noBlock(propName: string, topic: string): ComposerResult {
  return {
    reply:         `I don't have ${topic} set up for ${propName} yet. I'll pass this to the property team and they'll get back to you shortly.`,
    matched_block: null,
    fallback:      true,
  }
}

function composeFallback(ctx: ConciergeContext, name: string, propName: string): ComposerResult {
  const block = ctx.knowledge.fallback_support
  if (block) {
    const b = block as Record<string, unknown>
    const content = str(b.fallback_message ?? b.message ?? b.notes)
    if (content) return { reply: content, matched_block: 'fallback_support', fallback: true }
  }
  return {
    reply:         `Hi ${name}! I'm Nauxica Concierge, your digital assistant for ${propName}. You can ask me about check-in/out times, WiFi, house rules, local recommendations, and more. How can I help?`,
    matched_block: 'fallback_support',
    fallback:      true,
  }
}

function composeReply(ctx: ConciergeContext, classified: ClassifierResult, _nowIso: string): ComposerResult {
  const phase    = ctx.session.session_phase
  const name     = ctx.guest.guest_name.split(' ')[0] || 'there'
  const propName = ctx.property.display_name

  if (classified.category === 'CAT-01') {
    const em    = ctx.emergency
    const lines = [
      `EMERGENCY — ${propName}`, '',
      'Italian emergency numbers:',
      '112 — General emergency (police / fire / ambulance)',
      '115 — Fire brigade',
      '118 — Medical emergency', '',
    ]
    if (em.owner_emergency_phone)  lines.push(`Owner emergency: ${em.owner_emergency_name || 'Property owner'} — ${em.owner_emergency_phone}`)
    if (em.nauxica_ops_phone)      lines.push(`Nauxica support: ${em.nauxica_ops_phone}`)
    if (em.nearest_hospital_name) {
      lines.push(`Nearest hospital: ${em.nearest_hospital_name}`)
      if (em.nearest_hospital_address)  lines.push(`Address: ${em.nearest_hospital_address}`)
      if (em.nearest_hospital_distance) lines.push(`Distance: ${em.nearest_hospital_distance}`)
    }
    if (em.gas_shutoff_instructions) lines.push('', `Gas shutoff: ${em.gas_shutoff_instructions}`)
    return { reply: lines.join('\n'), matched_block: null, fallback: false }
  }

  if (classified.category === 'CAT-02') {
    const block = ctx.knowledge.access
    if (!block) return noBlock(propName, 'access information')
    const b       = block as Record<string, unknown>
    const keyCode = str(b.key_box_code ?? b.lockbox_code)
    if (keyCode === SENTINEL) {
      const msg = phase === 'pre_arrival'
        ? `Hi ${name}! Access codes for ${propName} will be shared on your check-in day. I'll send them to you the morning of your arrival.`
        : `The access codes for ${propName} are no longer active — your stay has ended.`
      return { reply: msg, matched_block: 'access', fallback: false }
    }
    const lines = [`Hi ${name}! Here are the access details for ${propName}:`]
    const location = str(b.key_box_location ?? b.lockbox_location)
    if (location) lines.push(`\nKey box location: ${location}`)
    if (keyCode)  lines.push(`Key box code: ${keyCode}`)
    const entry = str(b.entry_instructions)
    if (entry)    lines.push(`\n${entry}`)
    const smart = str(b.smart_lock_instructions)
    if (smart)    lines.push(`\nSmart lock: ${smart}`)
    const parking = str(b.parking_instructions)
    if (parking)  lines.push(`\nParking: ${parking}`)
    return { reply: lines.join('\n'), matched_block: 'access', fallback: false }
  }

  if (classified.category === 'CAT-03') {
    const block = ctx.knowledge.check_in
    if (!block) return noBlock(propName, 'check-in information')
    const b      = block as Record<string, unknown>
    const from   = str(b.checkin_time_from ?? b.checkin_from)
    const to     = str(b.checkin_time_to   ?? b.checkin_to)
    const instr  = str(b.checkin_instructions)
    const welcome = str(b.checkin_welcome_message)
    const lines = [`Hi ${name}! Check-in details for ${propName}:`]
    if (from || to) {
      const timeStr = from && to ? `${from} – ${to}` : from || to
      lines.push(`\nCheck-in time: ${timeStr}`)
    }
    if (instr)   lines.push(`\n${instr}`)
    if (welcome) lines.push(`\n${welcome}`)
    return { reply: lines.join('\n'), matched_block: 'check_in', fallback: false }
  }

  if (classified.category === 'CAT-04') {
    const block = ctx.knowledge.check_out
    if (!block) return noBlock(propName, 'check-out information')
    const b            = block as Record<string, unknown>
    const checkoutTime = str(b.checkout_time)
    const instr        = str(b.checkout_instructions)
    const tasks        = b.checkout_tasks
    const keyReturn    = str(b.key_return_instructions)
    const lines = [`Hi ${name}! Check-out details for ${propName}:`]
    if (checkoutTime) lines.push(`\nCheck-out time: ${checkoutTime}`)
    if (instr)        lines.push(`\n${instr}`)
    if (Array.isArray(tasks) && tasks.length > 0) {
      lines.push('\nBefore you leave:')
      for (const t of tasks) lines.push(`• ${t}`)
    } else if (typeof tasks === 'string' && tasks) {
      lines.push(`\nBefore you leave: ${tasks}`)
    }
    if (keyReturn) lines.push(`\nKey return: ${keyReturn}`)
    return { reply: lines.join('\n'), matched_block: 'check_out', fallback: false }
  }

  if (classified.category === 'CAT-05') {
    const block = ctx.knowledge.wifi
    if (!block) return noBlock(propName, 'WiFi information')
    const b        = block as Record<string, unknown>
    const network  = str(b.wifi_network ?? b.wifi_ssid)
    const password = str(b.wifi_password ?? b.wifi_pass)
    if (password === SENTINEL) {
      const msg = phase === 'pre_arrival'
        ? `Hi ${name}! WiFi details for ${propName} will be shared on your check-in day.`
        : `The WiFi details for ${propName} are no longer active — your stay has ended.`
      return { reply: msg, matched_block: 'wifi', fallback: false }
    }
    const lines = [`Hi ${name}! WiFi details for ${propName}:`]
    if (network)  lines.push(`\nNetwork: ${network}`)
    if (password) lines.push(`Password: ${password}`)
    const backup = str(b.wifi_backup_notes)
    if (backup)   lines.push(`\nNote: ${backup}`)
    return { reply: lines.join('\n'), matched_block: 'wifi', fallback: false }
  }

  if (classified.category === 'CAT-06') {
    const block = ctx.knowledge.amenities
    if (!block) return noBlock(propName, 'amenity information')
    const b     = block as Record<string, unknown>
    const notes = str(b.amenity_notes ?? b.notes)
    const lines = [`Hi ${name}! Amenity information for ${propName}:`]
    if (notes) lines.push(`\n${notes}`)
    const pool = str(b.pool_instructions); if (pool) lines.push(`\nPool: ${pool}`)
    const tv   = str(b.tv_instructions);   if (tv)   lines.push(`\nTV: ${tv}`)
    const heat = str(b.heating_instructions); if (heat) lines.push(`\nHeating: ${heat}`)
    const cool = str(b.cooling_instructions); if (cool) lines.push(`\nCooling/AC: ${cool}`)
    return { reply: lines.join('\n'), matched_block: 'amenities', fallback: false }
  }

  if (classified.category === 'CAT-07') {
    const block = ctx.knowledge.house_rules
    if (!block) return noBlock(propName, 'house rules')
    const b     = block as Record<string, unknown>
    const rules = str(b.house_rules ?? b.rules ?? b.notes)
    const lines = [`Hi ${name}! House rules for ${propName}:`]
    if (rules) lines.push(`\n${rules}`)
    const qFrom = str(b.quiet_hours_from); const qTo = str(b.quiet_hours_to)
    if (qFrom && qTo) lines.push(`\nQuiet hours: ${qFrom} – ${qTo}`)
    const smoke = str(b.smoking_policy); if (smoke) lines.push(`Smoking: ${smoke}`)
    const pets  = str(b.pet_policy);    if (pets)  lines.push(`Pets: ${pets}`)
    return { reply: lines.join('\n'), matched_block: 'house_rules', fallback: false }
  }

  if (classified.category === 'CAT-08') {
    const block = ctx.knowledge.local_area
    if (!block) return noBlock(propName, 'local area information')
    const b     = block as Record<string, unknown>
    const area  = str(b.area_description); const tips = str(b.local_tips)
    const lines = [`Hi ${name}! Local recommendations near ${propName}:`]
    if (area)  lines.push(`\n${area}`)
    if (tips)  lines.push(`\n${tips}`)
    const market = str(b.nearest_supermarket); if (market) lines.push(`\nSupermarket: ${market}`)
    const beach  = str(b.nearest_beach);       if (beach)  lines.push(`Beach: ${beach}`)
    return { reply: lines.join('\n'), matched_block: 'local_area', fallback: false }
  }

  if (classified.category === 'CAT-09') {
    const block = ctx.knowledge.services
    if (!block) return noBlock(propName, 'service information')
    const b     = block as Record<string, unknown>
    const notes = str(b.notes ?? b.services_notes)
    const lines = [`Hi ${name}! Here's what I can help arrange near ${propName}:`]
    if (notes) lines.push(`\n${notes}`)
    else       lines.push("\nPlease describe what you'd like to arrange and I'll pass your request to the property team.")
    return { reply: lines.join('\n'), matched_block: 'services', fallback: false }
  }

  if (classified.category === 'CAT-10') {
    const block = ctx.knowledge.maintenance
    const em    = ctx.emergency
    const lines = [`Hi ${name}! Sorry to hear you're having an issue at ${propName}.`]
    if (block) {
      const b = block as Record<string, unknown>
      const note = str(b.maintenance_contact_notes ?? b.notes)
      if (note) lines.push(`\n${note}`)
    }
    if (em.owner_emergency_phone) lines.push(`\nFor urgent issues please contact: ${em.owner_emergency_phone}`)
    if (em.nauxica_ops_phone)     lines.push(`Nauxica support: ${em.nauxica_ops_phone}`)
    lines.push(`\nI've flagged this for the ${propName} team to follow up.`)
    return { reply: lines.join('\n'), matched_block: block ? 'maintenance' : null, fallback: !block }
  }

  if (classified.category === 'CAT-11') {
    const block = ctx.knowledge.tourist_tax
    if (!block) return noBlock(propName, 'tourist tax information')
    const b      = block as Record<string, unknown>
    const amount = b.tourist_tax_amount_eur; const nights = b.tourist_tax_max_nights
    const lines  = [`Hi ${name}! Tourist tax information for ${propName}:`]
    if (amount !== undefined && amount !== null) lines.push(`\nRate: €${amount} per person per night`)
    if (nights !== undefined && nights !== null) lines.push(`Maximum nights charged: ${nights}`)
    const exempt = str(b.tourist_tax_exemptions); if (exempt) lines.push(`Exemptions: ${exempt}`)
    return { reply: lines.join('\n'), matched_block: 'tourist_tax', fallback: false }
  }

  return composeFallback(ctx, name, propName)
}

// ── Mock ConciergeContext factory (synthetic test data only) ─────────────
// All values are placeholders. No real property, guest, owner, or location data.
// The 'gateOpen' flag simulates whether the access code gate has passed
// (in_stay = open, pre_arrival = closed).

function makeContext(phase: SessionPhase, gateOpen: boolean): ConciergeContext {
  return {
    session: {
      session_id:             '00000000-0000-0000-0000-000000000001',
      session_status:         'active',
      session_phase:          phase,
      detected_language:      'en',
      unresolved_query_count: 0,
      is_escalated:           false,
      schema_version:         '1.5',
    },
    guest: {
      guest_name:          'Test Guest',
      guest_count:         2,
      checkin_date:        '2026-06-12',
      checkout_date:       '2026-06-15',
      confirmation_number: 'BK-TEST-001',
      special_requests:    null,
    },
    property: {
      property_id:      '00000000-0000-0000-0000-000000000002',
      display_name:     'Test Property',
      property_type:    'villa',
      address_locality: 'Test City',
      nearest_airport:  'Test Airport (TST)',
      is_complete:      true,
      schema_version:   '1.0',
      generated_at:     new Date().toISOString(),
    },
    knowledge: {
      emergency:        null,
      property_summary: { display_name: 'Test Property', area_description: 'A test property used for Sprint 016A simulation.' },
      access: {
        key_box_location:     'Lockbox at the main entrance',
        key_box_code:         gateOpen ? '0000' : SENTINEL,
        entry_instructions:   'Enter through the main gate and follow the path to the front door.',
        parking_instructions: 'Park in the designated area inside the gate.',
      },
      check_in: {
        checkin_time_from:       '15:00',
        checkin_time_to:         '20:00',
        checkin_instructions:    'Please message us 30 minutes before arrival. Your access code will be sent on the morning of check-in day.',
        checkin_welcome_message: 'Welcome to Test Property! Enjoy your stay.',
      },
      check_out: {
        checkout_time:         '10:00',
        checkout_instructions: 'Please ensure all lights and appliances are switched off before leaving.',
        checkout_tasks: [
          'Strip the beds and leave linen on the bedroom floor',
          'Empty all bins into the outdoor recycling area',
          'Close all windows and shutters',
          'Return the key to the lockbox and spin the dial to lock',
        ],
        key_return_instructions: 'Place the key back in the lockbox at the main entrance and spin the dial.',
      },
      wifi: {
        wifi_network:      'TestProperty_5G',
        wifi_password:     gateOpen ? 'test-wifi-pass' : SENTINEL,
        wifi_backup_notes: 'If the main router is offline, a backup "TestProperty_2G" uses the same password.',
      },
      amenities:      null,
      house_rules:    null,
      local_area:     null,
      services:       null,
      maintenance:    null,
      tourist_tax:    null,
      booking_policy: null,
      fallback_support: {
        fallback_message: "Hi! I'm Nauxica Concierge, your digital assistant for Test Property. Ask me about check-in, WiFi, house rules, local tips, and more. How can I help?",
      },
    },
    emergency: {
      is_complete:                      true,
      owner_emergency_name:             'Test Owner',
      owner_emergency_phone:            '+39 333 000 0001',
      nauxica_ops_phone:                '+39 091 000 0001',
      nearest_hospital_name:            'Test Hospital',
      nearest_hospital_address:         'Via Test 1, Test City',
      nearest_hospital_distance:        '20 km (approx. 30 min)',
      gas_shutoff_instructions:         'Gas meter is in the cabinet on the side of the house. Turn the red lever 90° clockwise to shut off.',
      water_shutoff_instructions:       null,
      electricity_shutoff_instructions: null,
      evacuation_route_description:     null,
      evacuation_assembly_point:        'Road junction at Via Test, 50 m from the main gate',
      property_specific_hazards:        'Test hazard note for simulation only.',
    },
    emergency_contacts: [
      {
        contact_type:        'owner',
        display_name:        'Test Owner',
        phone:               '+39 333 000 0001',
        available_hours:     '08:00–22:00',
        escalation_priority: 1,
      },
    ],
    stay_context: null,
  }
}

// ── Test runner ────────────────────────────────────────────────────────────

const SEP = '─'.repeat(64)
const nowIso = new Date().toISOString()

function run(label: string, message: string, phase: SessionPhase, gateOpen: boolean) {
  const ctx        = makeContext(phase, gateOpen)
  const classified = classifyQuery(message, phase)
  const composed   = composeReply(ctx, classified, nowIso)

  const catLabels: Record<QueryCategory, string> = {
    'CAT-01': 'EMERGENCY',     'CAT-02': 'ACCESS',
    'CAT-03': 'CHECK-IN',      'CAT-04': 'CHECK-OUT',
    'CAT-05': 'WIFI',          'CAT-06': 'AMENITIES',
    'CAT-07': 'HOUSE RULES',   'CAT-08': 'LOCAL AREA',
    'CAT-09': 'SERVICES',      'CAT-10': 'MAINTENANCE',
    'CAT-11': 'TOURIST TAX',   'CAT-12': 'GENERAL FAQ / FALLBACK',
  }

  console.log(`\n${SEP}`)
  console.log(`TEST: ${label}`)
  console.log(SEP)
  console.log(`INPUT:      "${message}"`)
  console.log(`PHASE:      ${phase}  |  GATE: ${gateOpen ? 'open' : 'closed'}`)
  console.log(`CATEGORY:   ${classified.category} — ${catLabels[classified.category]}`)
  console.log(`BLOCK:      ${classified.block_hint ?? '(none — pulled from emergency chunk)'}`)
  console.log(`CONFIDENCE: ${classified.confidence}`)
  console.log(`FALLBACK:   ${composed.fallback}`)
  console.log(`\nREPLY:\n`)
  console.log(composed.reply)
}

// ── Execute test cases ─────────────────────────────────────────────────────

run(
  'TEST 1 — WiFi (in_stay, gate open)',
  'What is the wifi password?',
  'in_stay',
  true,
)

run(
  'TEST 2 — Check-in (pre_arrival)',
  'What time can I check in and how do I get to the property?',
  'pre_arrival',
  false,
)

run(
  'TEST 3 — Check-out (check_out phase)',
  'What time is checkout tomorrow?',
  'check_out',
  true,
)

run(
  'TEST 4 — Access code gated (pre_arrival, gate closed)',
  'How do I get in? Where is the key box?',
  'pre_arrival',
  false,
)

run(
  'TEST 5 — Emergency',
  'I smell gas, what do I do — medical emergency',
  'in_stay',
  true,
)

run(
  'TEST 6 — Unknown fallback (no keyword match, confidence:low)',
  'What is the best route from the airport to the property?',
  'in_stay',
  true,
)

console.log(`\n${SEP}`)
console.log('All 6 tests complete.')
console.log(SEP)
