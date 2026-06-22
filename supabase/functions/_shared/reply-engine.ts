// supabase/functions/_shared/reply-engine.ts
// Sprint 019B — Shared reply pipeline extracted from concierge-inbound-sim
//
// Exports the rule-based classifier, composer, escalation detector, task creation,
// and notification event writer used by both concierge-inbound-sim and concierge-inbound.
// No LLM. No external API calls. DB writes only in createTaskIfNeeded and writeNotificationEvents.
//
// Types: QueryCategory, ClassifierResult, ComposerResult, EscalationMatch,
//        EscalationResult, NotificationResult
// Functions: classifyQuery, composeReply, detectEscalation, createTaskIfNeeded,
//            writeNotificationEvents

import { SENTINEL } from '../concierge-resolver/index.ts'
import type { SessionPhase, BlockType, ConciergeContext, ResolvedInput } from '../concierge-resolver/index.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────────────────

export type QueryCategory =
  | 'CAT-01' | 'CAT-02' | 'CAT-03' | 'CAT-04' | 'CAT-05' | 'CAT-06'
  | 'CAT-07' | 'CAT-08' | 'CAT-09' | 'CAT-10' | 'CAT-11' | 'CAT-12'

export interface ClassifierResult {
  category:   QueryCategory
  confidence: 'high' | 'medium' | 'low'
  block_hint: BlockType | null
}

export interface ComposerResult {
  reply:         string
  matched_block: BlockType | null
  fallback:      boolean
}

export interface EscalationMatch {
  escalatable:            boolean
  task_type:              string | null
  guest_request_category: string | null
}

export interface EscalationResult {
  triggered:         boolean
  task_id:           string | null
  task_type:         string | null
  timeline_event_id: string | null
  reason:            string | null
}

export interface NotificationResult {
  event_type:        string
  timeline_event_id: string | null
  task_id:           string | null
  reason:            string | null
}

// ── Query classifier ──────────────────────────────────────────────────────

// Priority order: CAT-01 → 02 → 03 → 04 → 10 → 05 → 06 → 07 → 09 → 08 → 11 → 12
// Source: ai-knowledge-taxonomy.md §3 Category Priority Hierarchy
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

export function classifyQuery(message: string, _sessionPhase: SessionPhase): ClassifierResult {
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

  // CLASSIFIER_RULES is ordered by priority — first match wins
  const best = matchedCategories[0]
  const rule = CLASSIFIER_RULES.find(r => r.category === best)!
  const confidence: 'high' | 'medium' | 'low' = matchedCategories.length === 1 ? 'high' : 'medium'

  return { category: best, confidence, block_hint: rule.block_hint }
}

// ── Escalation detection ──────────────────────────────────────────────────
// Runs after classification. Determines whether a task should be created and
// what type. Independent of the reply composition — a message can escalate
// without changing its classifier category or reply template.
//
// task_type values are constrained by tasks CHECK:
//   ('cleaning','maintenance','inspection','laundry','guest_request','other')
// 'transfer' and 'experience' are NOT valid task_types — stored as
// guest_request_category inside the timeline_events.metadata jsonb instead.

const MAINTENANCE_CATEGORIES: readonly QueryCategory[] = ['CAT-10']

const TRANSFER_KEYWORDS: readonly string[] = [
  'taxi', 'transfer', 'airport transfer', 'shuttle', 'pick up', 'pickup',
  'car service', 'arrange a ride', 'book a ride', 'book a transfer',
  'arrange a transfer', 'arrange transport', 'need a taxi', 'need a ride',
]

const EXPERIENCE_KEYWORDS: readonly string[] = [
  'tour', 'excursion', 'boat trip', 'cooking class', 'wine tasting',
  'guided tour', 'day trip', 'book a tour', 'book an experience',
  'book an activity', 'wine tour', 'food tour', 'cooking experience',
]

const CLEANING_KEYWORDS: readonly string[] = [
  'need cleaning', 'needs cleaning', 'extra cleaning', 'request cleaning',
  'housekeeping', 'not clean', 'dirty', 'needs a clean',
]

const LAUNDRY_KEYWORDS: readonly string[] = [
  'laundry', 'extra towels', 'clean towels', 'fresh towels', 'more towels',
  'bed linen', 'change the sheets', 'change sheets', 'new sheets',
  'fresh sheets', 'washing service', 'laundry service',
]

export function detectEscalation(message: string, category: QueryCategory): EscalationMatch {
  // CAT-10 maintenance — always escalate
  if ((MAINTENANCE_CATEGORIES as QueryCategory[]).includes(category)) {
    return { escalatable: true, task_type: 'maintenance', guest_request_category: null }
  }

  const lower = message.toLowerCase()

  // Cleaning (keyword-driven, category-independent)
  if (CLEANING_KEYWORDS.some(kw => lower.includes(kw))) {
    return { escalatable: true, task_type: 'cleaning', guest_request_category: null }
  }

  // Laundry (keyword-driven, category-independent)
  if (LAUNDRY_KEYWORDS.some(kw => lower.includes(kw))) {
    return { escalatable: true, task_type: 'laundry', guest_request_category: null }
  }

  // Transfer (keyword-driven)
  if (TRANSFER_KEYWORDS.some(kw => lower.includes(kw))) {
    return { escalatable: true, task_type: 'guest_request', guest_request_category: 'transfer' }
  }

  // Experience (keyword-driven)
  if (EXPERIENCE_KEYWORDS.some(kw => lower.includes(kw))) {
    return { escalatable: true, task_type: 'guest_request', guest_request_category: 'experience' }
  }

  // CAT-09 services with no specific sub-keyword — generic service request
  if (category === 'CAT-09') {
    return { escalatable: true, task_type: 'guest_request', guest_request_category: 'other_request' }
  }

  return { escalatable: false, task_type: null, guest_request_category: null }
}

// ── Task creation ─────────────────────────────────────────────────────────
// Creates a tasks row + timeline_events row for escalatable messages.
// Returns EscalationResult with triggered=false if INSERT fails.
// The HTTP handler appends the guest acknowledgement ONLY if triggered=true.
//
// created_by uses property.owner_id as a temporary workaround — see concierge-inbound-sim header.

export async function createTaskIfNeeded(
  svcClient:      SupabaseClient,
  resolved:       ResolvedInput,
  guestMessage:   string,
  match:          EscalationMatch,
  conversationId: string,
): Promise<EscalationResult> {
  if (!match.escalatable || !match.task_type) {
    return { triggered: false, task_id: null, task_type: null, timeline_event_id: null, reason: 'not_escalatable' }
  }

  const { reservationRow, propertyRow } = resolved

  const categoryLabel = match.task_type === 'guest_request' && match.guest_request_category
    ? `Guest request (${match.guest_request_category})`
    : match.task_type.charAt(0).toUpperCase() + match.task_type.slice(1)

  const truncatedMessage = guestMessage.slice(0, 60).trim()
  const title            = `[Nauxica Concierge] ${categoryLabel}: ${truncatedMessage}`.slice(0, 255)
  const description      = match.guest_request_category
    ? `[Nauxica Concierge] Guest requested: ${match.guest_request_category} | Message: ${guestMessage}`
    : `[Nauxica Concierge] Guest reported: ${guestMessage}`

  const { data: taskData, error: taskErr } = await svcClient
    .from('tasks')
    .insert({
      property_id:    propertyRow.id,
      reservation_id: reservationRow.id,
      title,
      description,
      task_type:      match.task_type,
      priority:       'normal',
      status:         'open',
      created_by:     propertyRow.owner_id,
    })
    .select('id')
    .single()

  if (taskErr || !taskData) {
    console.warn('[re] task insert failed:', taskErr?.message)
    return { triggered: false, task_id: null, task_type: match.task_type, timeline_event_id: null, reason: 'task_insert_failed' }
  }

  const taskId = taskData.id

  const metadata: Record<string, unknown> = {
    task_type:             match.task_type,
    priority:              'normal',
    source:                'guestpal_ai',
    guest_message_preview: guestMessage.slice(0, 100),
  }
  if (match.guest_request_category) {
    metadata.guest_request_category = match.guest_request_category
  }

  const { data: eventData, error: eventErr } = await svcClient
    .from('timeline_events')
    .insert({
      property_id:     propertyRow.id,
      reservation_id:  reservationRow.id,
      task_id:         taskId,
      conversation_id: conversationId,
      actor_id:        null,
      actor_type:      'ai',
      event_type:      'task_created',
      event_title:     `Task created by Nauxica Concierge: ${title}`.slice(0, 255),
      metadata,
    })
    .select('id')
    .single()

  if (eventErr) {
    console.warn('[re] timeline event insert failed:', eventErr.message)
  }

  return {
    triggered:         true,
    task_id:           taskId,
    task_type:         match.task_type,
    timeline_event_id: eventData?.id ?? null,
    reason:            `escalation:${match.task_type}${match.guest_request_category ? `:${match.guest_request_category}` : ''}`,
  }
}

// ── Host notification events ──────────────────────────────────────────────
// Writes zero or more timeline_events after reply assembly to notify the host.
// Three categories — all non-fatal, none block the guest reply:
//
//   low_confidence_response
//     When: classified.confidence === 'low' (CAT-12, no keyword matched)
//     Action: timeline_event only, no task
//
//   knowledge_gap_detected
//     When: composed.fallback === true AND category !== CAT-12
//     The AI identified a category but had no knowledge block for it.
//     Action: timeline_event only, no task
//
//   human_handoff_required
//     When: escalationMatch.escalatable === true AND escalation.triggered === false
//     An actionable guest request was detected but task creation failed.
//     Action: timeline_event only, no task
//     Does NOT fire when escalation already created a task.

export async function writeNotificationEvents(
  svcClient:       SupabaseClient,
  resolved:        ResolvedInput,
  guestMessage:    string,
  classified:      ClassifierResult,
  composed:        ComposerResult,
  escalationMatch: EscalationMatch,
  escalation:      EscalationResult,
  conversationId:  string,
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = []
  const { reservationRow, propertyRow } = resolved
  const preview = guestMessage.slice(0, 100)

  // 1. low_confidence_response — no keyword matched, CAT-12 fallback
  if (classified.confidence === 'low') {
    const { data, error } = await svcClient
      .from('timeline_events')
      .insert({
        property_id:     propertyRow.id,
        reservation_id:  reservationRow.id,
        conversation_id: conversationId,
        actor_id:        null,
        actor_type:      'ai',
        event_type:      'low_confidence_response',
        event_title:     'Nauxica Concierge: low confidence reply — host review recommended',
        metadata: {
          category:              classified.category,
          confidence:            classified.confidence,
          guest_message_preview: preview,
          source:                'guestpal_ai',
        },
      })
      .select('id')
      .single()
    if (error) console.warn('[re] low_confidence_response event failed:', error.message)
    results.push({
      event_type:        'low_confidence_response',
      timeline_event_id: data?.id ?? null,
      task_id:           null,
      reason:            error ? 'insert_failed' : 'confidence_low',
    })
    return results // low_confidence implies CAT-12 — no further checks apply
  }

  // 2. knowledge_gap_detected — known category but no knowledge block
  if (composed.fallback && classified.category !== 'CAT-12') {
    const { data, error } = await svcClient
      .from('timeline_events')
      .insert({
        property_id:     propertyRow.id,
        reservation_id:  reservationRow.id,
        conversation_id: conversationId,
        actor_id:        null,
        actor_type:      'ai',
        event_type:      'knowledge_gap_detected',
        event_title:     `Nauxica Concierge: knowledge gap — ${classified.block_hint ?? classified.category} not configured`,
        metadata: {
          category:              classified.category,
          block_hint:            classified.block_hint,
          confidence:            classified.confidence,
          guest_message_preview: preview,
          source:                'guestpal_ai',
        },
      })
      .select('id')
      .single()
    if (error) console.warn('[re] knowledge_gap_detected event failed:', error.message)
    results.push({
      event_type:        'knowledge_gap_detected',
      timeline_event_id: data?.id ?? null,
      task_id:           null,
      reason:            error ? 'insert_failed' : `block_hint:${classified.block_hint ?? classified.category}`,
    })
  }

  // 3. human_handoff_required — escalation was attempted but task INSERT failed.
  // Write a timeline_event only. No second task is created. No guest acknowledgement.
  if (escalationMatch.escalatable && !escalation.triggered) {
    const { data, error } = await svcClient
      .from('timeline_events')
      .insert({
        property_id:     propertyRow.id,
        reservation_id:  reservationRow.id,
        conversation_id: conversationId,
        actor_id:        null,
        actor_type:      'ai',
        event_type:      'human_handoff_required',
        event_title:     'Nauxica Concierge: human handoff required — original task creation failed',
        metadata: {
          reason:                'task_insert_failed',
          original_task_type:    escalationMatch.task_type,
          category:              classified.category,
          guest_message_preview: preview,
          source:                'guestpal_ai',
        },
      })
      .select('id')
      .single()
    if (error) console.warn('[re] human_handoff_required event failed:', error.message)
    results.push({
      event_type:        'human_handoff_required',
      timeline_event_id: data?.id ?? null,
      task_id:           null,
      reason:            'task_insert_failed',
    })
  }

  return results
}

// ── Response composer ─────────────────────────────────────────────────────

function str(value: unknown): string {
  return typeof value === 'string' && value.length > 0 ? value : ''
}

function noBlock(propName: string, topic: string): ComposerResult {
  return {
    reply:         `I don't have ${topic} set up for ${propName} yet.`,
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

export function composeReply(
  ctx:        ConciergeContext,
  classified: ClassifierResult,
  _nowIso:    string,
): ComposerResult {
  const phase    = ctx.session.session_phase
  const name     = ctx.guest.guest_name.split(' ')[0] || 'there'
  const propName = ctx.property.display_name

  // CAT-01 EMERGENCY — pulled from ctx.emergency (guaranteed non-null)
  if (classified.category === 'CAT-01') {
    const em    = ctx.emergency
    const lines = [
      `EMERGENCY — ${propName}`,
      '',
      'Italian emergency numbers:',
      '112 — General emergency (police / fire / ambulance)',
      '115 — Fire brigade',
      '118 — Medical emergency',
      '',
    ]
    if (em.owner_emergency_phone) {
      lines.push(`Owner emergency: ${em.owner_emergency_name || 'Property owner'} — ${em.owner_emergency_phone}`)
    }
    if (em.nauxica_ops_phone) {
      lines.push(`Nauxica support: ${em.nauxica_ops_phone}`)
    }
    if (em.nearest_hospital_name) {
      lines.push(`Nearest hospital: ${em.nearest_hospital_name}`)
      if (em.nearest_hospital_address)  lines.push(`Address: ${em.nearest_hospital_address}`)
      if (em.nearest_hospital_distance) lines.push(`Distance: ${em.nearest_hospital_distance}`)
    }
    if (em.gas_shutoff_instructions) {
      lines.push('', `Gas shutoff: ${em.gas_shutoff_instructions}`)
    }
    return { reply: lines.join('\n'), matched_block: null, fallback: false }
  }

  // CAT-02 ACCESS
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

  // CAT-03 CHECK-IN
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

  // CAT-04 CHECK-OUT
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

  // CAT-05 WIFI
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

  // CAT-06 AMENITIES
  if (classified.category === 'CAT-06') {
    const block = ctx.knowledge.amenities
    if (!block) return noBlock(propName, 'amenity information')

    const b     = block as Record<string, unknown>
    const notes = str(b.amenity_notes ?? b.notes)
    const lines = [`Hi ${name}! Amenity information for ${propName}:`]
    if (notes) lines.push(`\n${notes}`)
    const pool = str(b.pool_instructions)
    if (pool)  lines.push(`\nPool: ${pool}`)
    const tv   = str(b.tv_instructions)
    if (tv)    lines.push(`\nTV: ${tv}`)
    const heat = str(b.heating_instructions)
    if (heat)  lines.push(`\nHeating: ${heat}`)
    const cool = str(b.cooling_instructions)
    if (cool)  lines.push(`\nCooling/AC: ${cool}`)

    return { reply: lines.join('\n'), matched_block: 'amenities', fallback: false }
  }

  // CAT-07 HOUSE RULES
  if (classified.category === 'CAT-07') {
    const block = ctx.knowledge.house_rules
    if (!block) return noBlock(propName, 'house rules')

    const b     = block as Record<string, unknown>
    const rules = str(b.house_rules ?? b.rules ?? b.notes)
    const lines = [`Hi ${name}! House rules for ${propName}:`]
    if (rules) lines.push(`\n${rules}`)
    const qFrom = str(b.quiet_hours_from)
    const qTo   = str(b.quiet_hours_to)
    if (qFrom && qTo) lines.push(`\nQuiet hours: ${qFrom} – ${qTo}`)
    const smoke = str(b.smoking_policy)
    if (smoke)  lines.push(`Smoking: ${smoke}`)
    const pets  = str(b.pet_policy)
    if (pets)   lines.push(`Pets: ${pets}`)

    return { reply: lines.join('\n'), matched_block: 'house_rules', fallback: false }
  }

  // CAT-08 LOCAL AREA
  if (classified.category === 'CAT-08') {
    const block = ctx.knowledge.local_area
    if (!block) return noBlock(propName, 'local area information')

    const b     = block as Record<string, unknown>
    const area  = str(b.area_description)
    const tips  = str(b.local_tips)
    const lines = [`Hi ${name}! Local recommendations near ${propName}:`]
    if (area)  lines.push(`\n${area}`)
    if (tips)  lines.push(`\n${tips}`)
    const market = str(b.nearest_supermarket)
    if (market)  lines.push(`\nSupermarket: ${market}`)
    const beach  = str(b.nearest_beach)
    if (beach)   lines.push(`Beach: ${beach}`)

    return { reply: lines.join('\n'), matched_block: 'local_area', fallback: false }
  }

  // CAT-09 SERVICES
  if (classified.category === 'CAT-09') {
    const block = ctx.knowledge.services
    if (!block) return noBlock(propName, 'service information')

    const b     = block as Record<string, unknown>
    const notes = str(b.notes ?? b.services_notes)
    const lines = [`Hi ${name}! Here's what I can help arrange near ${propName}:`]
    if (notes) lines.push(`\n${notes}`)
    else       lines.push('\nPlease describe what you\'d like to arrange and I\'ll pass your request to the property team.')

    return { reply: lines.join('\n'), matched_block: 'services', fallback: false }
  }

  // CAT-10 MAINTENANCE
  if (classified.category === 'CAT-10') {
    const block = ctx.knowledge.maintenance
    const em    = ctx.emergency
    const lines = [`Hi ${name}! Sorry to hear you're having an issue at ${propName}.`]

    if (block) {
      const b    = block as Record<string, unknown>
      const note = str(b.maintenance_contact_notes ?? b.notes)
      if (note) lines.push(`\n${note}`)
    }
    if (em.owner_emergency_phone) {
      lines.push(`\nFor urgent issues please contact: ${em.owner_emergency_phone}`)
    }
    if (em.nauxica_ops_phone) {
      lines.push(`Nauxica support: ${em.nauxica_ops_phone}`)
    }
    // Acknowledgement NOT added here — handler appends only after successful task INSERT

    return { reply: lines.join('\n'), matched_block: block ? 'maintenance' : null, fallback: !block }
  }

  // CAT-11 TOURIST TAX
  if (classified.category === 'CAT-11') {
    const block = ctx.knowledge.tourist_tax
    if (!block) return noBlock(propName, 'tourist tax information')

    const b      = block as Record<string, unknown>
    const amount = b.tourist_tax_amount_eur
    const nights = b.tourist_tax_max_nights
    const lines  = [`Hi ${name}! Tourist tax information for ${propName}:`]
    if (amount !== undefined && amount !== null) lines.push(`\nRate: €${amount} per person per night`)
    if (nights !== undefined && nights !== null) lines.push(`Maximum nights charged: ${nights}`)
    const exempt = str(b.tourist_tax_exemptions)
    if (exempt) lines.push(`Exemptions: ${exempt}`)

    return { reply: lines.join('\n'), matched_block: 'tourist_tax', fallback: false }
  }

  // CAT-12 GENERAL FAQ — catch-all
  return composeFallback(ctx, name, propName)
}
