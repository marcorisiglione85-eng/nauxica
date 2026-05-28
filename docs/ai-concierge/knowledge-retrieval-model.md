# Knowledge Retrieval Model

**Version:** 2.0
**Status:** Draft — Architecture phase
**Scope:** AI concierge · WhatsApp-first · Sicily launch
**Last updated:** 2026-05-28
**Related:** [property-knowledge-schema.md](property-knowledge-schema.md) · [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md) · [whatsapp-session-anchor.md](whatsapp-session-anchor.md) · [escalation-rules.md](escalation-rules.md) · [emergency-procedures.md](emergency-procedures.md) · [data-models.md](../backend/data-models.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [property-data-schema.md](../property-intake/property-data-schema.md)

---

## 1. Purpose and System Scope

This document is the **implementation contract** for the Nauxica knowledge retrieval system.
It defines the precise architecture, interfaces, failure states, and security boundaries that
govern how the AI concierge receives, processes, and responds with property knowledge.

**Audience:** Backend engineers building the retrieval service and API layer; AI integration
engineers building the concierge model and prompt layer; Nauxica operators understanding
what the AI can and cannot do.

**What this document contracts:**
- The complete path from an incoming WhatsApp message to a grounded AI response
- The interface of the Knowledge Block Builder (KBB): inputs, outputs, error states
- The cache architecture and invalidation model
- Emergency data availability guarantees
- Security boundaries the AI runtime must never cross
- Failure handling for every defined failure state

**What this document does not define:**
- Prompt engineering or model selection (AI integration team responsibility)
- WhatsApp Business API integration details (handled by the messaging layer)
- Database schema (see [data-models.md](../backend/data-models.md))
- Partner Brief generation (see [partner-assignment-model.md](../architecture/partner-assignment-model.md))

**Design constraints:**

| Constraint | Implication |
|---|---|
| Guests have no Nauxica account | Identity established by phone number matched to an active Reservation |
| AI is retrieval-constrained, not database-connected | AI receives only a pre-filtered PropertyKnowledgeBlock — never raw database access |
| Emergency data must be instantly available | Emergency cache is never expired by TTL alone |
| Access codes are safety-sensitive credentials | Gating is enforced in the KBB, not by AI prompt instruction |
| Multiple languages at launch | Language selection is resolved before chunks are built |
| The retrieval system is the operational trust boundary | Structural enforcement preferred over prompt-only controls |

---

## 2. Retrieval Architecture Overview

The system is structured in five discrete layers. Each layer has a single responsibility
and a defined interface to adjacent layers. No layer bypasses another.

```
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 1 — SESSION LAYER                                            │
│  WhatsApp Business API → Message Router → Session Resolver          │
│  Responsibility: receive messages, resolve session state             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ session_context object
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 2 — RESOLUTION LAYER                                         │
│  Phone → Reservation Lookup → Session Phase Determination           │
│  Responsibility: anchor session to a property and reservation        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ resolved_context object
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 3 — TRANSFORMATION LAYER (Knowledge Block Builder)           │
│  Property Master → Scope Filter → Dynamic Merge → Language Select   │
│  → Access Gate → Emergency Inject → Chunk Structure                 │
│  Responsibility: produce a safe, session-scoped knowledge projection │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ PropertyKnowledgeBlock (chunked)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 4 — RETRIEVAL LAYER                                          │
│  Query Classifier → Chunk Selector → Context Window Assembler       │
│  Responsibility: select the right chunks for the current query       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ assembled context window
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  LAYER 5 — AI RUNTIME LAYER                                         │
│  System Prompt + Session Context + Query Chunks → Response          │
│  Responsibility: generate a grounded, safe, language-correct reply  │
└─────────────────────────────────────────────────────────────────────┘
```

**Layer isolation rule:** No layer may directly access the resources of a non-adjacent layer.
The AI runtime (Layer 5) has no database access. The resolution layer (Layer 2) does not
build prompts. Separation is enforced by API contract, not by convention.

---

## 3. End-to-End Retrieval Flow

The complete path from incoming WhatsApp message to delivered AI response. Every branch and
failure state is defined. There are no undefined paths.

```
[1] WhatsApp message arrives
      │
      ▼
[2] Layer 1 — Message Router receives webhook event
      Extract: from_phone (E.164), message_text, message_timestamp, whatsapp_message_id
      │
      ▼
[3] Rate limit check
      ├── FAIL (>20 msg/min from same number) → silent drop + flag for operator review
      └── PASS → continue
      │
      ▼
[4] Layer 2 — Session Resolver
      Check WhatsAppSession table: active session exists for from_phone?
      │
      ├── YES, session_status = "escalated"
      │      → Send holding message (escalation template)
      │      → Do NOT pass to AI runtime
      │      → Log message against EscalationRecord
      │      └── END
      │
      ├── YES, session_status = "active" → RESUME SESSION (go to [8])
      │
      └── NO active session → RESOLVE ANCHOR (go to [5])
      │
      ▼
[5] Layer 2 — Reservation Anchor Resolution
      Query Reservation where:
        guest_phone = from_phone
        AND reservation_status IN ('pre_arrival', 'checked_in')
        AND checkin_date <= today + 2 days
        AND checkout_date >= today
      │
      ├── MULTI-MATCH → DISAMBIGUATION FLOW (see §3a)
      ├── NO MATCH → UNKNOWN GUEST FLOW (see §3b)
      └── SINGLE MATCH → continue
      │
      ▼
[6] Create or resume WhatsAppSession
      Set: session_status = "active"
      Set: reservation_id, property_id (denormalised)
      Set: session_phase (derive from reservation_status + current date/time)
      Set: detected_language = Reservation.guest_preferred_language (provisional)
      │
      ▼
[7] Layer 3 — Knowledge Block Builder
      Call KBB with: property_id + resolved_context (see §4 for full interface)
      │
      ├── KBB returns PropertyKnowledgeBlock → continue
      └── KBB FAIL → DEGRADED MODE (see §13)
      │
      ▼
[8] Emergency Pre-Check (runs on EVERY message before any other routing)
      Classify message_text against emergency signal patterns
      │
      ├── EMERGENCY DETECTED → EMERGENCY FLOW (see §9)
      └── NO EMERGENCY → continue
      │
      ▼
[9] Layer 4 — Query Classifier
      Classify message_text into Knowledge Taxonomy category (CAT-01 to CAT-12)
      Derive query_intent from category + session_phase
      │
      ▼
[10] Chunk Selector
      Load always-on chunks: "emergency", "summary"
      Load phase-default chunks based on session_phase
      Load query-specific chunk matching query_intent category
      Compose context window (ordered by priority)
      │
      ▼
[11] Language Detection
      If session.detected_language is not yet locked:
        Detect language from message_text
        If detection confidence >= threshold AND language is supported:
          Update WhatsAppSession.detected_language
          Lock language if >= 2 consecutive messages in same language
      │
      ▼
[12] Layer 5 — AI Runtime
      Input: system_prompt + session_context_object + assembled_context_window + message_text
      Generate: response_text
      │
      ▼
[13] Response Safety Check
      Check: does response_text contain any sentinel value `"[not yet available]"`?
        YES → Replace with fallback response for that field type
      Check: does response_text contain any pattern matching PTR/INT field content?
        YES → Flag for review, substitute generic response, notify operator
      │
      ▼
[14] Escalation Check
      Does response_text or query_intent trigger any escalation rule?
        YES → Create EscalationRecord, set session_status = "escalated",
               send AI response + holding message, notify operator
        NO → continue
      │
      ▼
[15] Deliver response via WhatsApp Business API
      Log: WhatsAppSession message count, last_message_at
      Log: retrieval audit record (see §14)
      │
      END
```

### 3a — Disambiguation Flow

Triggered when from_phone matches multiple active reservations.

```
[D1] Identify all matching active reservations
[D2] Send disambiguation message (display_name + checkin_date only — no property address, no codes)
[D3] Wait for guest reply
[D4] Match reply to a display_name → lock session.reservation_id
[D5] Continue from [6]
[D6] If guest reply does not match any option after 2 attempts → UNKNOWN GUEST FLOW
```

### 3b — Unknown Guest Flow

```
[U1] Send standard unknown guest response (see whatsapp-session-anchor.md §6)
[U2] Guest provides confirmation number?
      ├── YES → query Reservation by confirmation_number
      │          ├── MATCH → verify: does guest_phone broadly match? (country code at minimum)
      │          │             MATCH → create session, proceed from [6]
      │          │             NO MATCH → escalate to operator (possible identity concern)
      │          └── NO MATCH → "I couldn't find that booking. Please contact Nauxica support."
      └── NO → log UNKNOWN_CALLER session, end
```

---

## 4. Knowledge Block Builder Interface

The KBB is a server-side service. This section is its implementation contract.

### 4.1 Input Contract

```
KnowledgeBlockRequest {
    // Required
    property_id:        String          // Property slug, e.g. "villa-mare"
    session_phase:      Enum            // pre_arrival | check_in | in_stay | check_out | post_stay
    language:           String          // ISO 639-1, e.g. "en", "it"

    // Required for access code gating
    checkin_date:       Date            // ISO 8601
    checkout_date:      Date            // ISO 8601

    // Optional — affects chunk inclusion decisions
    session_id:         UUID | null     // For cache correlation
    request_timestamp:  Timestamp       // Used in timing gate for access codes
    chunks_requested:   Array[String]   // Specific chunk names if partial load requested
                                        // Empty array = build full block
}
```

### 4.2 Output Contract

```
KnowledgeBlockResponse {
    // Status
    status:                 Enum        // "ok" | "degraded" | "unavailable"
    degraded_reason:        String | null  // Populated only when status = "degraded"

    // Block metadata
    property_id:            String
    schema_version:         String      // e.g. "1.1"
    generated_at:           Timestamp
    language:               String
    session_phase:          Enum
    emergency_data_complete: Boolean    // Explicit flag — never assume from content

    // Always-present
    emergency:              EmergencyChunk      // Never null. If incomplete: use fallback emergency chunk.
    summary:                SummaryChunk        // Always present.

    // Phase-default chunks (populated if relevant to session_phase)
    check_in:               CheckInChunk | null
    check_out:              CheckOutChunk | null

    // On-demand chunks (null if not requested and not phase-default)
    access:                 AccessChunk | null
    wifi:                   WifiChunk | null
    amenities:              AmenitiesChunk | null
    rules:                  RulesChunk | null
    local_area:             LocalAreaChunk | null
    services:               ServicesChunk | null
    maintenance:            MaintenanceChunk | null
    tax:                    TaxChunk | null

    // Access code gate state (for audit)
    access_codes_gated:     Boolean     // True if any credential was replaced with sentinel
    dynamic_instructions_applied: Integer // Count of overrides applied
}
```

### 4.3 Failure States

The KBB must return a defined failure state for every error condition. It must never throw
an unhandled exception that leaves the session without a response path.

| Failure condition | status returned | Behaviour |
|---|---|---|
| `property_id` not found | `"unavailable"` | Session falls to generic unknown-property response + operator alert |
| Property lifecycle_state = `suspended` | `"unavailable"` | Operator and homeowner notified. Guest directed to Nauxica support. |
| Property lifecycle_state not `active` (any other state) | `"degraded"` | Degraded block with only `emergency` + `summary` populated |
| EmergencyData.is_complete = false | `"degraded"` + `emergency_data_complete: false` | Emergency chunk populated with static constants only (no property-specific data). Trigger operator alert. |
| Database read timeout (>500ms) | Return stale cached block if available, `"degraded"` if not | Log timeout. Alert if frequency exceeds threshold. |
| Cache miss + database unavailable | `"unavailable"` | Use last known emergency chunk from emergency cache. If not available: static constants only. |
| Partial database read (some fields returned, others not) | `"degraded"` | Return partial block with null fields. AI fallback responses apply to nulls. Log the partial read event. |
| Language has no content variants | `"ok"` with fields null | Language fallback chain applies (see §12). Not a block failure. |

---

## 5. PropertyKnowledgeBlock Assembly Pipeline

Seven sequential steps. Each step receives the output of the previous and produces a
transformed intermediate state. Steps are not reversible — the pipeline runs once per
request (or per cache miss).

### Step 1 — Scope Filter

Read all fields from the Property master record. Apply the visibility scope filter:

- PASS: `PUB` and `GST` fields
- REJECT: `PTR`, `INT`, and untagged fields (treated as `INT`)

**Critical exclusion enforcement:** The following fields must be in a hard-coded exclusion
list that the filter enforces regardless of their tagged scope. If any of these appear in the
output of Step 1, the pipeline aborts and returns `"unavailable"`:

```
owner_bank_iban, codice_fiscale_or_piva, billing_entity_name,
partner_access_code, partner_key_safe_code, partner_entry_instructions,
cleaning_inventory_notes, linen_changeover_notes, property_quirks_for_partners,
owner_internal_notes, operator_notes, onboarding_notes,
rental_licence_number, alloggiati_web_required,
owner_id, approved_partner_ids, commission_rate_override,
revenue_share_pct, maintenance_budget_limit_eur
```

### Step 2 — Activation Gate

Check `Property.lifecycle_state`:

- `active` → continue normally
- any other value → set `status = "degraded"`, skip Steps 3–7 for non-emergency fields, build minimal block, return

### Step 3 — Dynamic Instruction Merge

Query `Property.dynamic_instructions` where:
- `active_from <= request_date <= active_until`
- `scope = "guest"` (partner-scoped instructions are excluded from this pipeline)

For each matching instruction ordered by `priority DESC`:
- Find the field named in `target_field`
- Replace that field's value with `override_text` in the current working state
- If `target_field = "freetext"`: append the override_text to the relevant section

Increment `dynamic_instructions_applied` counter.

### Step 4 — Language Selection

For every multilang field (stored as language-keyed object), flatten to a single string
using the language resolution chain (see §12). Replace the multilang object with the
resolved string. If all language variants are null: set field to `null`.

### Step 5 — Access Code Gate

For each credential field, evaluate the delivery gate:

```
gate_open = (
    session_phase IN ('check_in', 'in_stay')
    OR (session_phase = 'pre_arrival' AND checkin_date = request_date AND Property.early_access_code_delivery = true)
)
```

If `gate_open = false`: replace credential value with sentinel string `"[not yet available]"`.
Set `access_codes_gated = true` in the response metadata.

Post-checkout gate: if `request_date > checkout_date`: set ALL credential fields to sentinel
regardless of session_phase.

Credential fields subject to gating:
`key_box_code`, `smart_lock_code`, `building_door_code`, `gate_code`, `parking_access_code`

Fields NOT subject to gating (structural access info the guest needs at any time):
`access_method`, `lockbox_location`, `entry_instructions`, `key_box_location`

### Step 6 — Emergency Data Injection

Fetch the EmergencyData record for this `property_id`. This fetch always happens
independently of the property master record fetch — it uses the emergency cache (see §7.3).

Merge the EmergencyData object into the block root as the `emergency` chunk.

If EmergencyData.is_complete = false OR EmergencyData record not found:
- Set `emergency_data_complete = false`
- Build fallback emergency chunk containing only static constants (Italian emergency numbers)
  and whatever property-specific fields are populated
- Trigger `EMERGENCY_DATA_INCOMPLETE` operator alert

### Step 7 — Chunk Generation

Re-organise the scope-filtered, merged, language-resolved field set into named retrieval
chunks aligned to the AI Knowledge Taxonomy. Each chunk contains only the fields relevant
to its knowledge category.

See §6 for the full chunk model and field assignments.

---

## 6. Retrieval Chunk Model

### 6.1 Chunk Registry

| Chunk ID | Taxonomy Ref | Always Loaded | Phase-Default | Priority |
|---|---|---|---|---|
| `emergency` | CAT-01 | **Yes** | — | 1 (highest) |
| `access` | CAT-02 | No | `check_in` phase | 2 |
| `check_in` | CAT-03 | No | `pre_arrival`, `check_in` | 3 |
| `check_out` | CAT-04 | No | `check_out` phase | 4 |
| `wifi` | CAT-05 | No | — | 5 |
| `amenities` | CAT-06 | No | — | 6 |
| `rules` | CAT-07 | No | — | 7 |
| `services` | CAT-09 | No | — | 8 |
| `local_area` | CAT-08 | No | — | 9 |
| `maintenance` | CAT-10 | No | — | 10 |
| `tax` | CAT-11 | No | — | 11 |
| `summary` | CAT-12 | **Yes** | — | 12 (lowest) |

### 6.2 Chunk Payload Format

Every chunk carries standard metadata alongside its content fields.

```
Chunk {
    chunk_id:       String          // e.g. "access"
    category_ref:   String          // e.g. "CAT-02"
    generated_at:   Timestamp
    ttl_seconds:    Integer         // Per-chunk TTL (see §7.2)
    language:       String
    is_complete:    Boolean         // False if any required field within this chunk is null
    content:        Object          // The actual field key-value pairs for this chunk
}
```

### 6.3 Structured vs Unstructured Content Per Chunk

The distinction matters for future retrieval strategy. Structured fields support exact lookup;
unstructured fields are candidates for semantic embedding.

| Chunk | Structured fields | Unstructured (prose) fields | Embedding candidate |
|---|---|---|---|
| `emergency` | All phone numbers, boolean flags | Utility shutoff instructions, evacuation route | Partial |
| `access` | `access_method`, credential strings | `entry_instructions`, `lockout_instructions` | Low |
| `check_in` | `checkin_from/until` (times) | `checkin_instructions`, `property_orientation` | Medium |
| `check_out` | `checkout_by` (time) | `checkout_instructions`, `checkout_tasks` | Low |
| `wifi` | `wifi_network`, `wifi_password` | `wifi_backup_note` | No |
| `amenities` | Boolean flags, enum values | `appliance_guides[].instructions`, `pool_instructions` | Medium |
| `rules` | Policy enums, time values | `house_rules_summary`, `custom_rules` | Medium |
| `local_area` | None | All fields — fully prose | **High** |
| `services` | `booking_via` enum | `experience_recommendations[].notes` | **High** |
| `maintenance` | None | `appliance_guides` (fault context), utility instructions | Medium |
| `tax` | Rate, max nights | `tourist_tax_exemptions`, `collection_method` | Low |
| `summary` | `property_type`, `max_guests`, counts | `summary`, `area_description` | Medium |

### 6.4 Semantic Retrieval Readiness

At MVP, chunk selection is rule-based (category classification from keywords). The chunk
structure is designed to be forward-compatible with vector search without modification.

**Future path:** Each unstructured prose field within a chunk becomes one embedding document,
tagged with `property_id + chunk_id + field_name + language`. Retrieval shifts from
"load this chunk" to "find the k nearest embedding documents to this query."

**Fields that must NOT be embedded at any stage:**
- Any credential field (`wifi_password`, `key_box_code`, all access codes)
- `guest_phone`, `guest_document_number`
- Any PARTNER, OPERATOR, or INTERNAL scoped field

---

## 7. Cache Architecture

Three distinct caches with different lifetimes, invalidation rules, and availability
requirements. They must not share storage — the emergency cache in particular requires
isolation to provide its availability guarantees.

### 7.1 Session Cache

**Purpose:** Stores the assembled context window for an active WhatsApp session.
Avoids rebuilding chunks on every message in an ongoing conversation.

**Cache key:** `session:{session_id}`
**Contents:** The last assembled context window for this session (all loaded chunks, language, phase)
**TTL:** 4 minutes (240 seconds). Slightly under the WhatsApp Business API 5-minute inactive
session threshold. Session cache expires before the API session does.
**Invalidation triggers:**
- Session phase changes (pre_arrival → check_in, etc.)
- A DynamicInstruction is created or expires for this property
- Guest changes language
- Operator re-enables AI after escalation (context must be rebuilt with resolution notes)
- Property suspended or archived

**On cache miss:** Re-fetch from property cache + reassemble context window.

### 7.2 Property Cache

**Purpose:** Stores the fully assembled PropertyKnowledgeBlock per property and language.
Avoids re-running the 7-step assembly pipeline on every session start.

**Cache key:** `property:{property_id}:{language}`
**Contents:** Complete PropertyKnowledgeBlock with all chunks
**TTL by session phase:**
- `in_stay` sessions: 300 seconds (5 minutes) — homeowner may update instructions during a live stay
- `pre_arrival` sessions: 3600 seconds (1 hour) — lower urgency
- `check_out` sessions: 300 seconds (5 minutes) — checkout tasks must be current
- `post_stay` sessions: 3600 seconds (1 hour)

**Per-chunk TTL override:** The `emergency` chunk within the property cache has its own TTL
of 300 seconds regardless of session phase. Emergency data must never be more than 5 minutes
stale in a live session.

**Invalidation triggers:**
- Any write to `Property` record fields with scope `PUB` or `GST`
- Any write to `Property.dynamic_instructions`
- Any write to `EmergencyData` for this property
- `Property.lifecycle_state` changes to `suspended` or `archived`
- Property knowledge block `is_complete` flag changes

**On cache miss:** Run the full 7-step assembly pipeline. Do not serve partial results.

### 7.3 Emergency Cache

**Purpose:** Dedicated isolated cache for EmergencyData only. Provides emergency data
availability independently of the property cache and general database health.

**Cache key:** `emergency:{property_id}`
**Contents:** The fully assembled `emergency` chunk including all EmergencyData fields
plus static Italian emergency constants
**TTL:** 600 seconds (10 minutes)
**Minimum availability requirement:** The emergency cache must be able to serve a read
within 50ms under any system load condition. This is the only hard latency SLA in the
retrieval architecture.

**Invalidation triggers:**
- Any write to `EmergencyData` record — **write-through** (cache is updated synchronously
  on every EmergencyData write, not on TTL expiry alone)
- `EmergencyData.is_complete` changes to `true` (triggers re-validation)
- `Property.lifecycle_state` changes to `suspended` (clears the cache entry)

**Warm-up:** On property activation (`lifecycle_state → active`), the emergency cache must
be pre-populated before activation is confirmed. A property cannot become ACTIVE with an
empty emergency cache entry.

**Cold start safety:** If the emergency cache is empty for a property that is ACTIVE, the
KBB falls back to a direct database read of EmergencyData with a 100ms timeout. If that
also fails, it serves the static Italian emergency constants only and triggers an
`EMERGENCY_CACHE_MISS` operator alert.

---

## 8. DynamicInstruction Invalidation Rules

DynamicInstructions are time-bounded property overrides created by homeowners. They affect
the PropertyKnowledgeBlock content and must propagate to active sessions promptly.

### 8.1 Write-Through Invalidation

When a homeowner creates, modifies, or manually expires a DynamicInstruction:

1. **Immediate:** Invalidate the property cache entry for `{property_id}:*` (all languages)
2. **Immediate:** Invalidate session cache entries for all active sessions on this property
3. **Next KBB call:** The 7-step pipeline re-runs, Step 3 picks up the new instruction
4. **In-flight sessions:** Active conversations receive updated chunks on their next message
   (not mid-message)

### 8.2 Expiry-Based Invalidation

When `active_until` date passes for a DynamicInstruction:

1. A background job runs at midnight (Europe/Rome timezone) to check for expired instructions
2. For each expired instruction: invalidate property cache as above
3. No immediate session cache invalidation — session cache expires naturally on TTL

**Implication:** An expired DynamicInstruction may remain visible in a session cache for
up to 240 seconds after midnight on its expiry date. This is acceptable for non-emergency
overrides. If a DynamicInstruction covers emergency or access data, its `active_until`
date should be set conservatively.

### 8.3 Propagation Timing Guarantee

The maximum time between a homeowner saving a DynamicInstruction and an in-stay guest
seeing the updated information in an AI response is:

```
max_propagation = property_cache_TTL + session_cache_TTL
                = 300s + 240s
                = 540 seconds (9 minutes)
```

This is acceptable at MVP. Future improvement: session-layer webhook from DynamicInstruction
writes to reduce propagation to under 60 seconds.

---

## 9. Emergency Retrieval Guarantees

Emergency data retrieval has a higher-priority contract than the general retrieval system.

### 9.1 Minimum Availability Requirements

| Requirement | Guarantee |
|---|---|
| Emergency chunk present in every PropertyKnowledgeBlock | Yes — by pipeline design (Step 6 is unconditional) |
| Italian national emergency numbers always available | Yes — static constants in AI system prompt, not retrieved |
| Emergency chunk read latency | < 50ms from emergency cache |
| Maximum emergency data staleness in active session | 300 seconds (property cache emergency chunk TTL) |
| Emergency data available when property DB is down | Yes — emergency cache serves independently |
| Emergency data available for suspended properties | Partial — static constants only; property-specific data cleared |

### 9.2 Fail-Safe Emergency Behaviour

If the KBB cannot produce a complete emergency chunk for any reason, the AI runtime must
still be able to respond to an emergency. The system provides two fallback tiers:

**Tier 1 — Partial emergency data available** (some property-specific fields missing)
The AI receives whatever is available plus static constants. It delivers what it has and
includes 112 prominently. Missing fields (e.g., hospital address) are acknowledged as missing
and the guest is instructed to call 118 who will direct them.

**Tier 2 — No property-specific emergency data** (cache miss + database unavailable)
The AI receives static constants only. System prompt instructs the AI to respond:

> "For any emergency, please call 112 immediately. For medical emergencies: 118.
> For fire: 115. I'm unable to provide property-specific emergency details right now —
> please call these numbers and they will assist you."

The AI must never refuse to respond to an emergency message, even in fully degraded mode.

### 9.3 Emergency Pre-Check as a Gate

The emergency pre-check (Step [8] in the end-to-end flow) runs on every message before
any chunk selection, routing, or AI generation. It is not a retrieval query — it is a
pattern match on the incoming message text.

**Pattern match sources:**
- Keyword list (maintained in the AI system prompt, not the database)
- Semantic patterns (contextual signals like "I need help" + distress markers)

The emergency pre-check operates on the static Italian emergency numbers and whatever is
in the emergency cache — it does not wait for the full KBB pipeline.

If a false positive occurs (guest is not in a real emergency), the impact is a slightly
over-cautious response that still provides helpful safety information. This is acceptable.
False negatives (missing a real emergency) are not acceptable.

---

## 10. AI Grounding Rules

These are the implementation-level constraints on how the AI runtime uses the assembled
context window. They supplement the grounding rules in
[property-knowledge-schema.md](property-knowledge-schema.md) with retrieval-layer specifics.

### 10.1 Mandatory Source Usage

The AI must treat the PropertyKnowledgeBlock as the exclusive authoritative source for all
property-specific claims. Every factual assertion about the property must be traceable to
a specific field in a loaded chunk.

**Implementation:** The system prompt must include an explicit instruction:
> "Your knowledge of this property comes exclusively from the property context provided.
> Do not supplement it with general knowledge about Italian apartments, Sicilian customs,
> or typical hospitality practices."

### 10.2 Unknown-State Handling

When a question maps to a knowledge category whose chunk is loaded, but the relevant field
within the chunk is null:

1. The AI uses the defined fallback response for that field type (see property-knowledge-schema.md §Fallback Behaviour)
2. The AI does not attempt to infer the answer from other loaded fields
3. The AI does not attempt to give a probabilistic answer ("it's probably...")
4. The AI offers to connect the guest with the homeowner or operator for that specific question

### 10.3 Prohibited Inference

The following inferences are explicitly prohibited regardless of what data is in the loaded context:

| Prohibited inference | Example | Why |
|---|---|---|
| Generalising from one appliance to another | "Since the washing machine is Bosch, the dishwasher probably has similar controls" | Wrong and confusing |
| Inferring partner availability | "Since there's a cleaning assignment, the place will probably be cleaned before you arrive" | AI has no access to assignment schedules |
| Estimating unlisted costs | "Tourist tax in this area is usually around €2" (when rate is null) | May be factually wrong and creates liability |
| Recommending unlisted venues | "There's usually a good supermarket near the beach in Sicily" | Not property-specific |
| Inferring checkout task completion | "The checkout tasks seem straightforward, shouldn't take long" | AI has no knowledge of property state |
| Status of previous service requests | "The maintenance issue you reported earlier has probably been fixed by now" | AI has no access to ServiceRequest status |

### 10.4 Confidence Thresholds

The AI maintains an implicit confidence state tracked via `WhatsAppSession.unresolved_query_count`:

- Count starts at 0 for each session
- Incremented when AI uses a fallback response (field is null or chunk is not loaded)
- Decremented by 1 when AI gives a successful grounded answer
- At count = 3: AI proactively offers human handoff (TRIGGER-05 soft escalation)
- At count = 5: Hard escalation, operator notified (TRIGGER-05 hard)

**Reset condition:** Count is NOT reset when an escalation is resolved and AI resumes. The
count represents cumulative knowledge gaps for this property, not just this conversation.
It resets only when the property knowledge block is updated and `is_complete` transitions
to `true` after a review.

### 10.5 Hallucination Prevention at the Retrieval Layer

Structural mechanisms (preferred over prompt-only controls):

| Mechanism | How it prevents hallucination |
|---|---|
| Sentinel values for gated credentials | AI never holds a live credential it might reveal early |
| Null fields for missing data | AI cannot cite a value that isn't there |
| Chunk isolation | AI only sees fields relevant to the current query — cannot mix data from different property sections |
| Field-level `is_complete` flag on chunks | AI knows whether a chunk is fully populated before citing it |
| Static emergency constants in system prompt | AI cannot hallucinate Italian emergency numbers — they are always correct |

---

## 11. Access Code Security Model

### 11.1 Reservation Gating

A credential is only deliverable to a guest if their session is anchored to a confirmed,
non-cancelled reservation. If the session anchor fails or the reservation is cancelled,
all credential fields become sentinel values in the block — regardless of session phase.

The reservation gate check happens in the Resolution Layer (Layer 2), before the KBB is
called. A failed resolution does not call the KBB at all.

### 11.2 Timing Gating

Timing gate is enforced in KBB Step 5 (Access Code Gate). See §5 Step 5 for the exact
gate conditions. Summary:

- Default: credentials available only in `check_in` and `in_stay` phases
- Early delivery option: available on `checkin_date` in `pre_arrival` phase (homeowner-controlled flag, default `false`)
- Post-checkout: all credentials become sentinels from `checkout_date + 4 hours`

### 11.3 Delivery Logging

Every time the KBB serves a block with `access_codes_gated = false` (i.e., live credentials
are included), the following is logged:

```
AccessCodeDeliveryEvent {
    property_id:        String
    session_id:         UUID
    reservation_id:     UUID
    credential_types:   Array[String]   // e.g. ["key_box_code", "wifi_password"]
    delivered_at:       Timestamp
    session_phase:      Enum
}
```

This log is retained for 90 days minimum and is used for security audits and dispute
resolution. It is `OPERATOR`-scoped — never visible to guests.

### 11.4 Future Rotation Support

The current schema stores one `key_box_code` per property. For production security, codes
should be unique per reservation.

**Planned model:** A `ReservationAccessCode` object (not yet designed) will override the
property-level `key_box_code` for a specific reservation. When this object exists for the
current reservation:
- KBB Step 5 checks for `ReservationAccessCode` first
- If found and within gate window: uses reservation-specific code
- If not found: falls back to property-level code

**Migration path:** The KBB pipeline interface does not need to change. Only Step 5 logic
changes. All other layers are unaffected.

### 11.5 Smart Lock Token Compatibility

Smart lock systems may issue time-limited tokens rather than static codes. The current
model assumes a static credential. For smart lock integration:

**Required additions (not yet specified):**
- A `SmartLockToken` object with `token_value`, `valid_from`, `valid_until`, `property_id`, `reservation_id`
- KBB Step 5 fetches the current valid token instead of the static code
- Token fetch must be a fast, cached operation (tokens should be pre-generated 24h ahead)
- Token expiry must align with checkout + grace period

Until smart lock integration is specified, the KBB delivers the static `smart_lock_code`
field with the same timing gate as lockbox codes.

---

## 12. Multi-Language Retrieval Architecture

### 12.1 Language Resolution Chain

For every multilang field in the property schema, the KBB applies the following resolution
chain in order, stopping at the first non-null value:

```
1. session.detected_language (locked after 2+ messages)
2. Reservation.guest_preferred_language
3. "en"   (English — global default)
4. "it"   (Italian — Sicily fallback)
5. First non-null variant in any supported language
6. null   (field is absent in all languages — fallback response applies)
```

### 12.2 Language Lock

Language is "locked" for a session when:
- The guest has sent 2 or more consecutive messages in the same detected language
- The AI has confirmed the language via a language-change acknowledgement

Before lock: language is re-detected on every message. After lock: the language is fixed
for the session unless the guest explicitly requests a change.

**Explicit language change request:** Detected by pattern matching ("please reply in Italian",
"rispondimi in italiano", "antworte mir auf Deutsch", etc.). On detection:
1. Update `WhatsAppSession.detected_language`
2. Invalidate session cache
3. Rebuild context window with new language
4. Acknowledge the change in the new language

### 12.3 Per-Chunk Language Handling

Language selection is applied once per field during KBB Step 4. The resulting chunk contains
only resolved strings — not multilang objects. If a field within a chunk resolves to null
(no content in any language for that field), the field is explicitly null in the chunk.

The AI runtime receives flattened strings. It does not perform language selection.

### 12.4 Emergency Language Exception

Emergency data is exempt from the standard fallback chain stopping at null. If the guest's
preferred language has no emergency content:
- The AI delivers the content in the best available language
- The AI prepends: "Important — [follows in English/Italian, the best available language]"
- Italian emergency numbers are delivered in their numeric form (they are universal)

Physical safety takes priority over language preference.

### 12.5 Supported Languages at Sicily Launch

| Code | Language | Required for PUB+GST fields | Notes |
|---|---|---|---|
| `it` | Italian | Yes | Primary language for many homeowners |
| `en` | English | Yes | Primary tourist language |
| `de` | German | No — nullable | German tourist market (secondary) |
| `fr` | French | No — nullable | French tourist market (secondary) |

If a guest writes in a language not in this list, the AI responds in English (default) and
offers to assist in English or Italian.

---

## 13. Failure Handling

Every failure state has a defined response. There are no undefined paths.

### 13.1 Property Unavailable

Cause: `property_id` not found, or `lifecycle_state` is `suspended` or `archived`.

Response to guest:
> "I'm sorry, I'm unable to access the property information right now. Please contact
> Nauxica support for assistance: [nauxica_ops_phone]."

Operator alert: `PROPERTY_UNAVAILABLE` with `property_id` and `session_id`.
Homeowner notification: Yes (for `suspended` only).
Log: `UNAVAILABLE` status in retrieval audit log.

### 13.2 Reservation Mismatch

Cause: `from_phone` does not match any active reservation, confirmation number provided but
does not match, or phone/name inconsistency on manual lookup.

Response to guest: Unknown guest flow (see §3b).
Operator alert: `RESERVATION_MISMATCH` if guest has provided a confirmation number that
does not match (potential booking error or guest using a different phone).
Log: `UNKNOWN_CALLER` session type.

### 13.3 Empty Retrieval

Cause: Query classified into a category but the corresponding chunk contains no populated
fields (all null).

Response: Use category-specific fallback message. Increment `unresolved_query_count`.
Do not alert operator for a single occurrence. At threshold: TRIGGER-05 escalation.

### 13.4 Stale Cache Served

Cause: Database is unreachable; stale cached block is returned.

Behaviour: Serve stale block if less than `2 × TTL` old. Log `STALE_CACHE_SERVED` event.
If stale block is older than `2 × TTL`: return `"degraded"` status and use degraded mode.
Operator alert if stale cache is served for more than 5 minutes continuously.

**Exception:** Emergency cache staleness above TTL triggers an immediate operator alert
even when the block is still served. Emergency data staleness is never silently accepted.

### 13.5 Partial Block Corruption

Cause: A chunk has `is_complete = false` due to a null field that is required.

Behaviour: Serve the block with the incomplete chunk. The `is_complete` flag on that chunk
tells the AI to use fallback responses for that chunk's required fields.
Log: `INCOMPLETE_CHUNK:{chunk_id}` in retrieval audit.
No guest-facing error unless the entire block is incomplete.

### 13.6 Degraded Mode Specification

When the KBB returns `status = "degraded"`, the AI operates in degraded mode:

| Query type | Degraded mode response |
|---|---|
| Emergency | Full response using whatever emergency data is available + static constants. Never degraded. |
| Access / entry | "I don't have the full details for this property. Please contact the owner: [emergency_contact_name] on [emergency_contact_phone]." |
| All other queries | "I don't have all the details for this property right now. Please contact [emergency_contact_name] on [emergency_contact_phone] or Nauxica support." |

The AI must not attempt to answer property-specific questions from general knowledge in
degraded mode. Degraded mode = honest acknowledgement + contact information.

---

## 14. Observability and Logging

### 14.1 Retrieval Audit Log

Every KBB call is logged. This log is the audit trail for all property knowledge
deliveries.

```
RetrievalAuditRecord {
    retrieval_id:                   UUID        // Unique per KBB call
    session_id:                     UUID
    property_id:                    String
    reservation_id:                 UUID | null
    language:                       String
    session_phase:                  Enum
    kbb_status:                     Enum        // "ok" | "degraded" | "unavailable"
    degraded_reason:                String | null
    schema_version:                 String
    emergency_data_complete:        Boolean
    access_codes_gated:             Boolean
    dynamic_instructions_applied:   Integer
    chunks_served:                  Array[String]
    cache_hit:                      Boolean     // property cache hit?
    emergency_cache_hit:            Boolean
    kbb_latency_ms:                 Integer
    generated_at:                   Timestamp
}
```

**Retention:** 90 days minimum. **(Legal review required)** Confirm whether retrieval logs
constitute personal data processing records under GDPR Article 30 (records of processing
activities).

### 14.2 Escalation Traces

Every escalation event is logged with a link to the retrieval audit record that was active
at the time. This allows post-incident reconstruction of exactly what knowledge the AI had
when the escalation was triggered.

```
EscalationTrace {
    escalation_id:          UUID
    retrieval_id:           UUID   // The KBB call active when escalation was triggered
    trigger_message_text:   String // The guest message that triggered escalation
    trigger_type:           Enum
    chunks_loaded_at_trigger: Array[String]
    unresolved_query_count_at_trigger: Integer
}
```

### 14.3 Hallucination Monitoring

Detecting hallucinations in a live system requires structured monitoring:

**Signal 1 — Sentinel value in AI response**
The response safety check (Step [13] in end-to-end flow) flags any response that contains
the literal string `"[not yet available]"`. This means the AI attempted to relay a sentinel
value rather than using the fallback response.

**Signal 2 — Unknown field reference**
If the AI response references a venue name, place, phone number, or instruction that cannot
be found in any loaded chunk field, flag for human review.
Implementation: post-generation response scanner (not blocking at MVP — flagging only).

**Signal 3 — Confidence threshold breaches**
`unresolved_query_count` reaching threshold is a proxy signal for the AI operating at the
edge of its grounded knowledge.

**Monitoring output:** A weekly hallucination monitoring report for the Nauxica operations
team covering signal counts, top trigger categories, and properties with high fallback rates.

### 14.4 Auditability Requirements

The following must be reconstructable from logs for any given guest interaction:

- What property knowledge block was loaded (schema_version, chunks, generated_at)
- Whether emergency data was complete at session time
- Whether access codes were gated or delivered
- What language was used
- Whether any escalation occurred and why
- Whether any DynamicInstructions were applied

**(Legal review required)** In a guest injury or dispute scenario, the ability to show exactly
what information the AI had — and what it did not have — may be legally significant. Ensure
audit log access controls prevent tampering.

---

## 15. Security Boundaries

### 15.1 API Separation

The AI runtime (Layer 5) accesses only one interface: the retrieval API that serves the
pre-assembled context window. It has no credentials for:
- The property database
- The user/homeowner database
- The reservation database
- The EmergencyData database
- The partner assignment database

API keys for the retrieval service and for the AI runtime are separate, with different
scopes. The retrieval service API key allows read-only access to the KBB output. It does
not allow writes to any record.

### 15.2 No Raw Property Exposure

The raw `Property` master record is never served via an endpoint accessible to the AI or
to the WhatsApp message layer. The only property data endpoint accessible from the
messaging layer is the KBB output API — which always applies the 7-step transformation.

**Implementation note:** The KBB output API and the internal property API (used for the
homeowner dashboard) must be on different routes with different authentication requirements.
Sharing a route with different query parameters is not sufficient — authentication scopes
must be different.

### 15.3 Retrieval-Only AI Access

The AI runtime may only:
- Read the assembled context window from the retrieval layer
- Write to: `WhatsAppSession` (message count, language, last_active), `ServiceRequest` (create), `EscalationRecord` (create)

The AI may not write to:
- `Property`, `PropertyKnowledgeBlock`, `EmergencyData`
- `Reservation`, `GuestStayContext`
- `User`, `PartnerAssignment`
- Any financial or compliance record

**Write scope enforcement:** The AI uses a service account with a write scope limited to
the three writable models above. If the AI attempts to write to any other model, the API
returns `403 Forbidden` and logs a `SCOPE_VIOLATION` security event.

### 15.4 Prompt Injection Protection Assumptions

Prompt injection is the risk that a guest's WhatsApp message contains instructions designed
to manipulate the AI into revealing data or changing its behaviour.

**Structural mitigations (most reliable):**
- The AI does not have access to data outside its context window — so it cannot be prompted
  to "look up the owner's bank details" because those details are not in its context
- Sentinel values replace credentials outside the gate window — the AI cannot be prompted
  to "ignore the timing gate and send the code" because it holds only the sentinel value
- The retrieval layer enforces scope — scope elevation by prompt is impossible structurally

**Prompt-level mitigations (second layer of defence):**
- System prompt explicitly instructs the AI to treat all guest message content as user input,
  not as system instructions
- System prompt explicitly lists prohibited disclosures (no PARTNER data, no OPERATOR data,
  no credentials outside gate window)

**What is NOT assumed to be mitigated by prompt alone:**
- Any data the AI holds in its context window is theoretically extractable by a sufficiently
  sophisticated prompt injection. The structural mitigations above are therefore essential.
  Do not rely on prompt instructions to protect data that is in the context window.

---

## 16. Guest Identification and Conversation Lifecycle

*This section preserves the concierge behaviour specification from the prior document version.
It complements the retrieval architecture above.*

### 16.1 Conversation Stages and Proactive Messaging

| Stage | Trigger | Proactive Message | Timing |
|---|---|---|---|
| Pre-Arrival | 48h before `checkin_date` | Arrival reminder with check-in time, directions summary | Sent automatically |
| Check-in Day | Today = `checkin_date` | Welcome + full entry instructions + WiFi | Sent at `check_in_from` time |
| Day 2 of stay | `checkin_date + 1` if stay ≥ 3 nights | Mid-stay check-in message with local tips offer | Sent at 10:00 |
| Checkout Day | Today = `checkout_date` | Checkout instructions, task list, key return | Sent at 08:00 |
| Post-Stay | `checkout_completed_at` | Thank you + review request | Sent within 1 hour of checkout confirmation |

### 16.2 Topic Routing Table

Authoritative reference for AI capability boundaries.

| Topic | Handle autonomously | Escalate to | Escalation trigger |
|---|---|---|---|
| Check-in time | Yes | — | — |
| Entry instructions | Yes | Emergency contact | Guest cannot get in after following instructions |
| Access codes | Yes (confirmed guest, gate open) | — | — |
| WiFi | Yes | Emergency contact | WiFi completely non-functional |
| Appliance guides | Yes | Homeowner | Appliance appears broken or damaged |
| House rules | Yes | Homeowner | Guest disputes or refuses a rule |
| Tourist tax | Yes (inform only) | Homeowner | Guest refuses to pay |
| Local recommendations | Yes | — | — |
| Medical / pharmacy | Yes (inform + direct to 118) | Emergency services | Any medical urgency |
| Transfer / taxi requests | Yes (refer to info or create ServiceRequest) | — | — |
| Maintenance issue | Acknowledge + create ServiceRequest | Partner via ServiceRequest | All maintenance issues |
| Booking change / extension | Refer to owner | Homeowner | Always |
| Cancellation / refund | Refer to owner | Homeowner | Always |
| Guest complaint | Acknowledge only | Homeowner + Nauxica support | All complaints |
| Medical emergency | Give 112/118 immediately | Emergency services + emergency contact | Always |
| Fire / gas | Give 112/115 immediately | Emergency services | Always |
| Safety threat | Give 112 immediately | Emergency services + emergency contact | Always |
| Property damage by guest | Acknowledge | Homeowner + Nauxica support | Always |
| Abusive language | End politely | Nauxica support | Always |
| Unknown information request | Fallback response | — | — |

---

## 17. Future Scalability Layer

### 17.1 Vector Search Compatibility

The chunk structure and field design are forward-compatible with vector search. Migration
path when scale requires it:

1. Each unstructured prose field within a chunk becomes an embedding document
2. Documents are tagged: `{property_id}_{chunk_id}_{field_name}_{language}`
3. At query time: embed the guest's message, retrieve top-k documents by cosine similarity
4. Filter results to GUEST scope before loading into context
5. Chunk selection becomes "retrieve relevant embedding documents" rather than "load this chunk"

**No schema changes required.** The PropertyKnowledgeBlock format supports this migration
without modification because:
- Fields are already isolated by topic (chunk) and type (structured vs unstructured)
- Credentials are already sentinel-valued (safe to embed without leaking live codes)
- Language variants are already explicit (one embedding per language variant)

### 17.2 Semantic Retrieval for Local Area

`local_area` and `services` chunks are the most immediate candidates for semantic retrieval
(§6.3). When the property knowledge base grows beyond ~20 recommendations per property,
rule-based retrieval becomes less precise. At that threshold:

- Pre-generate embeddings for all `local_tips[]` and `experience_recommendations[]` entries
- At query time: embed the guest's request, retrieve top-3 semantically similar entries
- Load only those 3 entries into the `local_area` context window, not the full list

### 17.3 Portfolio-Wide Memory Systems

Future: a homeowner managing multiple properties may benefit from cross-property knowledge
(e.g., the same transfer partner serves all their properties; the same house rules apply
everywhere). A portfolio-level `HomeownerKnowledgeBlock` could provide a shared layer that
individual property blocks extend or override.

**Design requirement:** The retrieval architecture must preserve the property-level
isolation guarantee. Cross-property data must never flow into a guest session for the wrong
property. Portfolio knowledge is additive, never substitutive.

### 17.4 Predictive Retrieval

A future optimisation: pre-load likely chunks before the guest asks. Based on session phase
and time of day, the system could warm the session cache with chunks that have high query
probability (e.g., load `check_in` chunk when session_phase transitions to `pre_arrival`
automatically, rather than waiting for the first check-in question).

This is a performance optimisation only and does not change the security or grounding model.

---

## 18. Open Gaps and Implementation Dependencies

| Gap | Blocking? | Notes |
|---|---|---|
| **WhatsApp Business API integration spec** | Yes — for production | The retrieval architecture assumes a webhook from the WhatsApp API but does not specify the integration layer. Message Router (Layer 1) implementation is undefined. |
| **ReservationAccessCode model** | High priority | Current schema uses one static code per property. Per-reservation code rotation requires a new model (see §11.4). |
| **Smart lock token model** | Medium | KBB Step 5 is designed with a placeholder for token-based credentials. Full spec not yet defined (see §11.5). |
| **DynamicInstruction write-through mechanism** | Medium | Cache invalidation on DynamicInstruction creation requires an event-driven architecture (message queue or database trigger). Implementation not specified. |
| **Post-stay block destruction** | Medium | Mechanism for anonymising or deleting cached blocks after checkout + retention period not specified. |
| **Response safety check implementation** | High priority | The post-generation sentinel scan and PTR/INT pattern check (Step [13]) requires an implementation spec. |
| **Hallucination monitoring scanner** | Low — post-MVP | Post-generation response scanner for unknown field references not yet designed. |
| **Retrieval audit log retention and access controls** | High — legal | **(Legal review required)** GDPR Article 30 applicability, retention period, and storage jurisdiction not yet confirmed. |
| **KBB latency SLA** | High — operational | Only the emergency cache has a defined latency SLA (50ms). The full KBB pipeline SLA for in-stay sessions is not yet defined. Recommended target: < 200ms p95. |
| **whatsapp-concierge-guidelines.md** | Medium | The WhatsApp Business API messaging window (24-hour rule), template message requirements, and opt-in model for proactive messages need specification before proactive messaging can be implemented. |

---

## Related Documents

- [property-knowledge-schema.md](property-knowledge-schema.md) — PropertyKnowledgeBlock schema, assembly pipeline detail, and response grounding rules
- [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md) — 12-category taxonomy that governs chunk selection
- [whatsapp-session-anchor.md](whatsapp-session-anchor.md) — Session resolution flow and context object
- [escalation-rules.md](escalation-rules.md) — 11 escalation triggers and EscalationRecord model
- [emergency-procedures.md](emergency-procedures.md) — EmergencyData structure and AI emergency rules
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Scope definitions governing Step 1 of the pipeline
- [property-data-schema.md](../property-intake/property-data-schema.md) — Property master record — raw input to the KBB
- [data-models.md](../backend/data-models.md) — WhatsAppSession, Reservation, ServiceRequest, EscalationRecord models
- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — Partner Brief (the PTR-scoped counterpart to the PropertyKnowledgeBlock)
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Voice, tone, and language rules for AI responses
