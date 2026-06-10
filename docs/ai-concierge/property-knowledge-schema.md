# Property Knowledge Schema

**Version:** 1.5
**Status:** Draft — Architecture Freeze (Sprint 012A) + Sprint 012B Corrective Patch
**Scope:** AI concierge · Sicily launch · WhatsApp-first model
**Last updated:** 2026-06-10
**Related:** [knowledge-retrieval-model.md](knowledge-retrieval-model.md) · [property-data-schema.md](../property-intake/property-data-schema.md) · [data-models.md](../backend/data-models.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md) · [whatsapp-session-anchor.md](whatsapp-session-anchor.md) · [emergency-procedures.md](emergency-procedures.md) · [escalation-rules.md](escalation-rules.md)

> **v1.5 changes (2026-06-10 — Sprint 012B Final Micro-Correction — pre-Supabase patch):**
> **Correction E:** `available_hours text NULL` added to `emergency_contacts` (migration 013 patched directly, before any Supabase application). Resolves the last remaining mismatch between `ConciergeContext.emergency_contacts` and the migration schema identified in the Sprint 012B consistency check. `available_hours` is informational — human-readable availability guidance (e.g. "24/7", "Emergency only"). It does not replace `escalation_priority`, does not affect RLS, and is included in context only for rows where `guest_visible=true AND ai_usable=true`. Sprint 012B as-built notes updated; gap documentation removed.

> **v1.4 changes (2026-06-10 — Sprint 012B Corrective Pass — pre-Supabase patch):**
> Applied after Sprint 012B Review Gate identified two critical blockers and two non-blocking findings. Migrations 011–013 were NOT yet applied to any Supabase database when these corrections were made; the migration files were patched directly (no migration 014 created).
>
> **Correction A (Blocker 1 — emergency_data schema mismatch):** The Sprint 012B migration for `emergency_data` originally consolidated all utility shutoff procedures into a single prose `emergency_instructions` field, which is incompatible with the `ConciergeContext.emergency` design contract frozen in v1.3 §Concierge Context Shape. Migration 012 has been patched to add the 7 individual named columns required by `buildEmergencyResponseContext()`: `gas_shutoff_instructions`, `water_shutoff_instructions`, `electricity_shutoff_instructions`, `evacuation_route_description`, `evacuation_assembly_point`, `property_specific_hazards`, `nearest_hospital_distance`. The `emergency_instructions` prose field is retained as a general supplement. Rule EM-04 below is now factually correct again.
>
> **Correction B (Blocker 2 — emergency_contacts missing visibility flags):** Migration 013 omitted `guest_visible` and `ai_usable` boolean columns. Without them, `loadEmergencyContacts()` cannot safely filter trade contacts (plumber, electrician, gas_provider) from guest-facing AI context. Migration 013 has been patched to add both columns with `DEFAULT false`.
>
> **Correction C (non-blocking — emergency_services enum guidance):** Added SQL comment in migration 013 clarifying that the `emergency_services` contact type enum value MUST NOT be stored as a row. Italian national numbers (112/113/115/118) are system prompt constants. The enum value is retained for schema completeness only.
>
> **Correction D (non-blocking — property_knowledge_blocks RLS deviation):** Migration 011 grants homeowner SELECT only on `property_knowledge_blocks`, not SELECT + UPDATE as originally stated in the v1.3 Sprint 012B readiness section. This deviation is intentional: all homeowner edits must go through a validated API endpoint using service_role (preventing homeowners from bypassing block-level validation). The Sprint 012B Implementation Readiness section below is updated to reflect this as-built state.

> **v1.3 changes (2026-06-09 — Sprint 012A — Knowledge Architecture Freeze):**
> PKS-1: Canonical Knowledge Block Type Registry added (§ Knowledge Block Types) — 14 block types with purpose, visibility, phase availability, guest-visible flag, AI-usable flag, and emergency-override flag. PKS-2: Emergency Model — AI Response Architecture section added — corrects the assumption that emergency bypasses AI entirely; AI responds first with context-loaded guidance, then escalates. PKS-3: Emergency Category Classification table added — 10 canonical categories (fire, gas, medical, police/security, water leak/flooding, electrical, lockout/access failure, structural risk, severe guest distress, other urgent safety issue). PKS-4: Emergency Contacts Domain added as a defined future model — 12 contact types, each with use case, guest visibility, AI usage, and escalation priority. PKS-5: Session Phase Knowledge Gate added — per-phase availability matrix for all 14 block types. PKS-6: Concierge Context Shape (Design Contract) added — defines the 7-section context object (session, guest, property, knowledge, emergency, emergency_contacts, stay_context) as a Sprint 012B design contract. PKS-7: AI Behaviour Rules (Consolidated) added — single canonical list replacing scattered rules. PKS-8: Sprint 012B Implementation Readiness section added — lists required migrations (property_knowledge_blocks, emergency_data, emergency_contacts) and backend helper contracts.

---

## Purpose

This document defines the technical schema for the `PropertyKnowledgeBlock` — the structured data object delivered to the AI concierge at the start of a guest conversation.

The knowledge block is a **curated, AI-safe projection** of property data. It contains only `PUBLIC` and `GUEST-ONLY` fields. It is pre-processed before delivery to the AI — the AI never queries the raw `Property` model or any other database model directly.

**Who uses this document:**
- Backend engineers implementing the knowledge block API endpoint
- AI integration team building the concierge prompt and retrieval layer
- Nauxica operations staff understanding what the AI knows

---

## Design Principles

1. **Completeness over inference** — if a field is missing, the AI falls back to a defined response, not a guess
2. **Prose over structured data for AI consumption** — instructions are written text, not arrays of raw values
3. **Separation from raw schema** — this block is a delivery artefact, not a database view; it may aggregate or reformat fields from the Property model
4. **Versioned** — the block carries a `schema_version` so the AI layer can handle format changes gracefully
5. **Minimal surface area** — only fields the AI may plausibly reference are included; everything else is excluded

---

## Transformation Architecture

### Raw Property Master Record vs PropertyKnowledgeBlock

The `Property` master record in the database is a **multi-scope operational record**. It contains
data across all four visibility scopes: public, guest-only, partner, and internal. It includes
access codes, financial details, compliance data, partner assignments, owner bank details, and
internal notes — none of which should ever reach the AI concierge.

The `PropertyKnowledgeBlock` is a **derived, scope-filtered, AI-ready projection** of the
property master. It is not a database view and not a direct API response from the Property model.
It is a transformation output built by the Knowledge Block Builder (see Backend notes below).

```
Property Master Record (all scopes, raw)
    │
    ▼
[Knowledge Block Builder]
    ├── Step 1: Scope filter        → exclude PTR, INT fields
    ├── Step 2: Activation gate     → return degraded block if property not ACTIVE
    ├── Step 3: Dynamic merge       → apply active DynamicInstruction overrides
    ├── Step 4: Language select     → pick correct language variant per session
    ├── Step 5: Access code gate    → redact credentials outside delivery window
    ├── Step 6: Emergency merge     → always attach full EmergencyData object
    └── Step 7: Chunk structure     → organise fields into retrieval chunks
    │
    ▼
PropertyKnowledgeBlock (GUEST-safe, session-scoped, ready for AI context)
```

**The AI concierge receives only the PropertyKnowledgeBlock output.** It never has access to
the Property master record, the User record, partner assignment data, or any financial data.
This is enforced at the API layer, not by prompt instruction.

### Transformation Step Detail

**Step 1 — Scope filter**
Every field in the Property master record is tagged with a visibility scope (per
[Data Visibility Model](../architecture/data-visibility-model.md)). The Knowledge Block Builder
passes only fields tagged `PUB` or `GST`. Any field without an explicit scope tag is treated
as `INT` and excluded. This is a blocklist approach — the safe default is exclusion.

**Step 2 — Activation gate**
If `Property.lifecycle_state` is not `active`, the Knowledge Block Builder returns a minimal
degraded block containing only:
- `property_id`, `display_name`, `is_complete: false`
- EmergencyData (always included regardless of activation state)
The AI uses the degraded mode fallback responses for all other queries.

**Step 3 — Dynamic instruction merge**
The builder checks `Property.dynamic_instructions` for any records where:
- `active_from <= today <= active_until`
- `scope = "guest"` (partner-scoped overrides are not applied to the guest block)

For each active instruction, the builder replaces the target field's value with
`override_text` in the appropriate language. The original field value is preserved in the
database — only the projection is altered.

**Step 4 — Language selection**
Every multilang text field (stored as `{en: "...", it: "...", de: null, fr: null}`) is
flattened to a single string using the session language priority chain:

```
1. WhatsAppSession.detected_language (if locked after 2+ messages)
2. Reservation.guest_preferred_language
3. "en"  (safe default)
4. "it"  (Sicily fallback if "en" is null)
```

If no language variant is available for a field: the field is set to `null` in the
projection. Null fields trigger the graceful fallback response — the AI does not invent a
translation.

**Step 5 — Access code gate**
Credentials (lockbox code, smart lock code, gate code, parking code) are `GST`-scoped and
pass the scope filter, but they are subject to a second delivery gate based on session phase
and timing (see Access Code Gating Rules below). Outside the delivery window, these fields
are set to `"[not yet available]"` in the projection. The AI is trained to interpret this
sentinel value and respond accordingly.

**Step 6 — Emergency data merge**
The full EmergencyData object for this property is always attached to the PropertyKnowledgeBlock
regardless of session phase or query type. The merge happens unconditionally — the only
way emergency data is absent from the block is if the EmergencyData record is incomplete
(`is_complete: false`), which blocks property activation anyway.

**Step 7 — Retrieval chunk structure**
The final block is not one flat object passed wholesale to the AI. It is divided into
named retrieval chunks aligned to the [AI Knowledge Taxonomy](ai-knowledge-taxonomy.md) categories.
See Retrieval Chunk Structure below.

---

## Visibility Key

Scopes align with the [Data Visibility Model](../architecture/data-visibility-model.md). The PropertyKnowledgeBlock contains only `PUB` and `GST` fields. `PTR` and `INT` fields are never included.

| Level | Symbol | Delivered to AI | Notes |
|---|---|---|---|
| Public | `PUB` | Yes — included for all sessions, including pre-arrival | Safe to share with any guest |
| Guest-only | `GST` | Yes — only for confirmed guests with an anchored session | Access codes, WiFi, entry instructions |
| Partner | `PTR` | **Never in PropertyKnowledgeBlock** | Delivered via a separate Partner Brief — not this document |
| Internal | `INT` | **Never** | Owner financials, compliance data, operator notes |

**Absolute exclusions:** The following data categories must never enter the concierge context under any circumstances — not via a knowledge block, not via a dynamic instruction, not via a prompt injection, not via an emergency override:
- Owner financial data (IBAN, revenue, gross/net income)
- Commission or Nauxica fee data
- Partner earnings or payout records
- Homeowner codice fiscale, partita IVA, or billing identity
- Partner access codes (distinct from guest codes)
- Internal operational notes, onboarding notes, operator notes
- Any data from the `PartnerAssignment`, `CommissionRules`, or `PartnerRequest` models

---

## Canonical Knowledge Block Type Registry

This registry defines the 14 canonical block types that form the PropertyKnowledgeBlock. Each block type maps to a Knowledge Taxonomy category (see [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md)), carries a visibility scope, and has defined phase availability and usage flags.

**Implementation rule:** A block is included in the assembled PropertyKnowledgeBlock at context build time based on the rules in the "Always loaded" and "Phase-default" columns. On-demand blocks are loaded when the guest's query is classified into that block's category. Emergency is always pre-loaded, regardless of query.

| Block Type | Taxonomy | Purpose | Visibility | Always Loaded | Phase-Default | Guest Visible | AI Usable | Emergency Override |
|---|---|---|---|---|---|---|---|---|
| `emergency` | CAT-01 | Emergency contacts, utility shutoffs, evacuation routes, Italian national numbers | `GST` | **Yes** | All phases | Yes | Yes | N/A — overrides all other blocks |
| `property_summary` | CAT-12 | Property overview, type, capacity, area description | `PUB`+`GST` | **Yes** | All phases | Yes | Yes | No |
| `access` | CAT-02 | Entry method, instructions, credentials (gated by phase), lockout procedure | `GST` | No | `check_in` | Yes — credentials gated | Yes | Yes (lockout resolution) |
| `check_in` | CAT-03 | Arrival times, directions, early check-in rules, orientation text | `PUB`+`GST` | No | `pre_arrival`, `check_in` | Yes | Yes | No |
| `check_out` | CAT-04 | Departure time, checkout tasks, key return, late checkout | `PUB`+`GST` | No | `check_out` | Yes | Yes | No |
| `wifi` | CAT-05 | Network name, password (gated), backup/router instructions | `GST` | No | — | Yes — password gated | Yes | No |
| `amenities` | CAT-06 | Appliance guides, pool, BBQ, heating, cooling, garden | `GST` | No | — | Yes | Yes | Yes (if fault is safety-critical) |
| `house_rules` | CAT-07 | Rules summary, quiet hours, smoking policy, pet policy, party policy | `PUB` | No | — | Yes | Yes | No |
| `local_area` | CAT-08 | Recommendations, restaurants, beaches, transport, seasonal notes | `PUB`+`GST` | No | — | Yes | Yes | No |
| `services` | CAT-09 | Bookable experiences, transfers, taxi contacts, marketplace options | `PUB`+`GST` | No | — | Yes | Yes | No |
| `maintenance` | CAT-10 | Utility controls, appliance troubleshooting, issue self-resolution steps | `GST` | No | — | Yes | Yes | Yes (if issue has safety implication) |
| `tourist_tax` | CAT-11 | Tax rate, max nights, exemptions, collection method, municipality | `PUB` | No | — | Yes | Yes | No |
| `booking_policy` | — | Cancellation policy, modification rules, no-show terms | `PUB` | No | — | Yes — inform only, no changes | Yes | No |
| `fallback_support` | — | Nauxica ops contact, owner emergency contact, generic support text for degraded mode | `GST` | No | Degraded mode | Yes | Yes | Yes — always included in degraded mode |

### Block type notes

**`emergency`** — Pre-loaded unconditionally in every session. Must be available within 50ms from the emergency cache (see [knowledge-retrieval-model.md §7.3](knowledge-retrieval-model.md)). Italian national emergency numbers (112, 113, 115, 118, 1530) are static constants in the AI system prompt — not stored in this block — so they are available even if the property-specific emergency block is absent.

**`access`** — Credential fields within this block (`key_box_code`, `building_door_code`, `smart_lock_code`, `parking_access_code`) are subject to the Access Code Gate (see Access Code Gating Rules below). Outside the gate window, credentials are replaced by the sentinel value `"[not yet available]"`. The block itself is always loadable; only the credential values are conditionally revealed.

**`booking_policy`** — This block is informational only. The AI must never commit to, negotiate, or modify booking terms. If a guest requests a change, the AI informs them and escalates (TRIGGER-08).

**`fallback_support`** — Included automatically when the KBB returns `status = "degraded"`. Contains only the Nauxica ops number, owner emergency contact, and a standard acknowledgement message. The AI uses this block as its sole context source in full degraded mode.

---

## Schema Definition

Fields are grouped into sections matching the [property-knowledge-base-template.md](../property-intake/property-knowledge-base-template.md). Types describe semantic intent.

### Root

| Field | Type | Vis | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `schema_version` | string | — | Yes | Version check at load time | e.g. `"1.0"` |
| `property_id` | string | — | Yes | Retrieval key — not cited to guests | Must match `Property.property_id` |
| `display_name` | string | `PUB` | Yes | Referenced in greeting and all responses | Max 60 chars |
| `is_complete` | boolean | — | Yes | If false: AI uses degraded mode (see fallback section) | Set by Nauxica staff after quality review |
| `last_verified_at` | date | — | Recommended | Not cited to guests — used for staleness detection | ISO 8601 date |

---

### Section 1 — Property Summary

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `summary` | text | `PUB` | Yes | Cited in property orientation messages and when guest asks "what is this property?" |
| `property_type` | enum | `PUB` | Yes | Referenced in descriptions |
| `area_description` | text | `PUB` | Recommended | Cited in local orientation responses |
| `nearest_airport` | string | `PUB` | Recommended | Cited for transfer and arrival questions |
| `nearest_port` | string | `PUB` | Optional | Cited for transfer and arrival questions |

---

### Section 2 — Check-in and Checkout

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `checkin_from` | string (HH:MM) | `PUB` | Yes | Cited in pre-arrival and arrival messages |
| `checkin_until` | string (HH:MM) | `PUB` | Yes | Cited in pre-arrival messages |
| `checkout_by` | string (HH:MM) | `PUB` | Yes | Cited in checkout reminders |
| `early_checkin_available` | boolean | `PUB` | Recommended | Cited if guest asks about early check-in |
| `early_checkin_notes` | text | `PUB` | Conditional | Required if `early_checkin_available` is true |
| `late_checkout_available` | boolean | `PUB` | Recommended | Cited if guest asks about late checkout |
| `late_checkout_notes` | text | `PUB` | Conditional | Required if `late_checkout_available` is true |

---

### Section 3 — Access and Entry

These fields are `GUEST-ONLY`. They must not be included in any response to a guest whose booking has not been confirmed, or in any public-facing API response.

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `access_method` | enum | `PUB` | Yes | Mentioned in overview ("access is via key box") |
| `entry_instructions` | text | `GST` | Yes | Delivered in full on check-in message and on request |
| `key_box_location` | text | `GST` | Conditional | Included in entry instructions if `access_method` is `key-box` |
| `key_box_code` | string | `GST` | Conditional | Delivered once on check-in message. **Must not be repeated unnecessarily.** |
| `building_door_code` | string | `GST` | Optional | Included in entry instructions if applicable |
| `smart_lock_app` | string | `GST` | Conditional | Named if `access_method` is `smart-lock` |
| `smart_lock_instructions` | text | `GST` | Conditional | Delivered in entry instructions if `access_method` is `smart-lock` |
| `parking_instructions` | text | `GST` | Optional | Delivered if property has parking |
| `parking_access_code` | string | `GST` | Optional | Delivered with parking instructions |
| `lockout_instructions` | text | `GST` | Yes | What to do if the guest cannot get in — must always cite the emergency contact |

---

### Section 4 — WiFi & Connectivity

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `wifi_network` | string | `GST` | Yes | Delivered on check-in message |
| `wifi_password` | string | `GST` | Yes | Delivered on check-in message |
| `wifi_backup_note` | text | `GST` | Optional | Cited if guest reports connectivity issues |

---

### Section 5 — Appliance Guides

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `appliances` | array of objects | `GST` | Recommended | Cited when guest asks about a specific appliance |

Each appliance object:

| Sub-field | Type | Notes |
|---|---|---|
| `name` | string | Appliance identifier, e.g. `"Washing machine"`, `"Air conditioning"` |
| `model` | string | Optional. Helps with AI context. |
| `instructions` | text | Step-by-step prose. Used verbatim or paraphrased by AI. |

---

### Section 6 — House Rules

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `house_rules_summary` | text | `PUB` | Yes | Delivered as bullet list when guest asks about rules, or proactively on first contact |
| `quiet_hours` | string | `PUB` | Recommended | e.g. `"23:00 – 08:00"`. Cited when noise rules asked about. |
| `smoking_policy` | text | `PUB` | Yes | Cited when smoking asked about |
| `pet_policy` | text | `PUB` | Yes | Cited when pets asked about |

---

### Section 7 — Trash & Recycling

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `trash_collection_days` | string | `GST` | Recommended | e.g. `"Monday and Thursday"`. Cited when guest asks or proactively mid-stay. |
| `trash_instructions` | text | `GST` | Recommended | Full prose description of bin system and locations |

---

### Section 8 — Emergency Contacts

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `emergency_contact_name` | string | `GST` | Yes | Cited in emergency and escalation responses |
| `emergency_contact_phone` | string | `GST` | Yes | Cited in emergency and escalation responses |
| `emergency_services` | object | `GST` | Yes | Static numbers — delivered for medical/safety emergencies |

`emergency_services` object:

| Sub-field | Type | Value |
|---|---|---|
| `general` | string | `"112"` (EU unified) |
| `police` | string | `"113"` (Polizia di Stato) |
| `carabinieri` | string | `"112"` |
| `ambulance` | string | `"118"` |
| `fire` | string | `"115"` |

---

### Section 9 — Medical Facilities

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `nearest_hospital_name` | string | `GST` | Yes | Cited in emergency situations |
| `nearest_hospital_address` | string | `GST` | Yes | Cited in emergency situations |
| `nearest_pharmacy_name` | string | `GST` | Recommended | Cited when guest asks |
| `nearest_pharmacy_address` | string | `GST` | Recommended | Cited when guest asks |

---

### Section 10 — Tourist Tax

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `tourist_tax_amount_eur` | decimal | `PUB` | Yes | Cited when tourist tax asked about |
| `tourist_tax_max_nights` | integer | `PUB` | Recommended | Cited when tourist tax asked about |
| `tourist_tax_exemptions` | text | `PUB` | Recommended | Cited when exemptions asked about |
| `tourist_tax_collection_method` | text | `PUB` | Recommended | e.g. "Collected in cash at check-in by the owner." |

> ⚠️ Legal review required: tourist tax rates are set per municipality. Confirm that the AI is not the point of collection — it informs only.

---

### Section 11 — Local Area Tips

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `local_tips` | array of objects | `PUB` | Optional | Offered proactively or when guest asks for recommendations |

Each tip object:

| Sub-field | Type | Notes |
|---|---|---|
| `type` | enum | `restaurant` / `beach` / `market` / `transport` / `pharmacy` / `experience` / `other` |
| `name` | string | Venue or tip name |
| `description` | string | One sentence |
| `distance` | string | e.g. `"5 min walk"`, `"10 min by car"` |

---

### Section 12 — Seasonal Notes

| Field | Type | Vis | Required | AI Usage |
|---|---|---|---|---|
| `seasonal_notes` | array of objects | `GST` | Optional | Included if the current month matches a note's scope |

Each seasonal note object:

| Sub-field | Type | Notes |
|---|---|---|
| `months_applicable` | array of integers | e.g. `[6, 7, 8]` for June–August |
| `note` | text | Guest-facing prose |

---

## Emergency Data Inclusion Rules

The EmergencyData object is merged into every PropertyKnowledgeBlock regardless of session
phase or query type. These rules govern how it appears in the block.

**Rule EM-01 — Always present**
The emergency block is never omitted, never lazy-loaded, never conditional on the guest's
query. It is attached at build time before the block is delivered to the AI.

**Rule EM-02 — Always at root level**
Emergency data is not nested inside a section. It sits at the root of the
PropertyKnowledgeBlock so the AI can access it with a single lookup, not a nested path
traversal.

**Rule EM-03 — Italian national numbers are static constants, not property data**
The numbers 112, 113, 115, 118, and 1530 are built into the AI system prompt, not stored
per-property. The EmergencyData merge adds property-specific fields on top of these constants.
An incomplete EmergencyData record can never result in missing emergency numbers.

**Rule EM-04 — Utility shutoffs are duplicated from Category I**
`gas_shutoff_instructions`, `water_shutoff_instructions`, and `electricity_shutoff_instructions`
exist in both the Property schema (Category I) and the EmergencyData object. The EmergencyData
copy is the authoritative version for AI use. If the two diverge (stale sync), the
EmergencyData copy takes precedence.

> **v1.4 note (Correction A):** The Sprint 012B migration draft temporarily consolidated these three fields into a single `emergency_instructions` prose block, which made EM-04 factually incorrect. Migration 012 has been patched to restore the individual named columns. EM-04 is now accurate as written.

**Rule EM-05 — No language gate on emergency data**
Emergency fields are not subject to language fallback rules. If the English version is populated
but Italian is null, the AI delivers the English version to an Italian-speaking guest in an
emergency. Physical safety overrides language preference.

**Rule EM-06 — Incomplete emergency data triggers degraded mode**
If `EmergencyData.is_complete = false`, the AI must not serve the property at all (the
property cannot be activated). If somehow an active property has `is_complete = false` on
its EmergencyData (e.g., data was corrupted post-activation), the Knowledge Block Builder
flags this with `emergency_data_incomplete: true` in the root of the block, and the AI
escalates all emergency queries immediately to the Nauxica ops number (hard-coded in the
system prompt) rather than relying on property-specific data.

---

## Emergency Model — AI Response Architecture

> **Sprint 012A correction:** This section supersedes any prior implicit assumption that emergency detection routes the message silently to a human without AI response. The correct model is defined here.

### Core principle: AI responds first, then escalates

Emergency messages do **not** bypass the AI concierge. The AI is the first responder in every emergency scenario. The sequence is:

```
1. Inbound message arrives
2. Emergency pre-check runs (before any other routing)
3. Emergency intent detected → emergency context loaded immediately from emergency cache
4. AI generates a guarded, context-based emergency response
   — Includes property-specific instructions from emergency_data
   — Always includes Italian national emergency numbers (static constants)
   — Uses the correct emergency response template for the detected category
   — May offer to contact or escalate to owner/caretaker/Nauxica if issue unresolved
5. EscalationRecord created in parallel with the AI response (not after)
6. Operator and/or homeowner notified per escalation-rules.md §2 (TRIGGER-01)
7. Session status set to "escalated"
8. AI does not respond to subsequent messages — operator takes over
```

The AI response in step 4 is always practical, direct, and grounded in the loaded emergency context. It is not a holding message. It is not a "we are looking into it" deflection. It is the most complete, accurate safety information the system can provide.

**Why the AI responds before escalating:** In a genuine emergency (fire, gas, medical), the guest may not be able to make a call. The AI's WhatsApp response may be the only immediately available guidance. Routing to a human first would introduce a dangerous latency window. The AI reduces that risk.

**Why the AI stops responding after the first emergency reply:** Once the EscalationRecord is created and the operator is notified, the conversation must be held for human judgment. The AI cannot follow up on whether the guest is safe, whether the fire brigade arrived, or whether the gas has been shut off. A human operator can and must.

### Emergency response structure (all categories)

Every emergency AI response must contain, in this order:

1. **Immediate action** — what to do right now (before anything else)
2. **National emergency number(s)** — 112 always; 118 for medical; 115 for fire/gas
3. **Property-specific instruction** — from `emergency_data` fields (e.g. gas shutoff location, evacuation route)
4. **Owner/ops contact** — `owner_emergency_name` + `owner_emergency_phone`, `nauxica_ops_phone`
5. **Escalation confirmation** — "I've alerted our operations team."

The AI must not open with an acknowledgement or apology (Rule E-04 from [emergency-procedures.md](emergency-procedures.md)). Lead with the action.

### Emergency handling logging requirements

Every emergency session must generate:
- An `EscalationRecord` with `trigger_type = EMERGENCY` and `trigger_detail` = verbatim guest message
- A retrieval audit record (see knowledge-retrieval-model.md §14.1) noting `emergency_data_complete` status
- An `EscalationTrace` linking the retrieval state active when the emergency was handled

---

## Emergency Category Classification

The AI classifies each detected emergency into one of 10 canonical categories. Classification determines which emergency response template to use, which utility shutoff fields to include, and the operator notification urgency. All 10 categories trigger TRIGGER-01 escalation (see [escalation-rules.md](escalation-rules.md)) except where noted.

| Category | Trigger signals | Immediate AI action | Key knowledge block fields used | Operator SLA |
|---|---|---|---|---|
| `fire` | fire, smoke, flames, burning, burning smell | Evacuate immediately. Do not use lift. | `evacuation_route_description`, `evacuation_assembly_point`, `fire_extinguisher_location` | Immediate (0–5 min) |
| `gas` | gas smell, gas leak, sulphur, rotten eggs | Do not touch switches. Open windows. Leave building. | `gas_shutoff_instructions`, `gas_meter_location_description` | Immediate (0–5 min) |
| `medical` | injury, ill, sick, unconscious, chest pain, breathing difficulty, blood, accident, fell | Call 118. Hospital name and address. First aid kit. | `nearest_hospital_name`, `nearest_hospital_address`, `nearest_hospital_distance` | Immediate (0–5 min) |
| `police_security` | intruder, break-in, theft, robbery, threatening, someone in property | Call 113 or 112. Leave if safe. Do not confront. | `owner_emergency_phone`, `nauxica_ops_phone` | Immediate (0–5 min) |
| `water_leak_flooding` | flood, pipe burst, water everywhere, ceiling dripping, water leak | Water shutoff first. Electricity shutoff if water near sockets. | `water_shutoff_instructions`, `electricity_shutoff_instructions` | Urgent (0–30 min) |
| `electrical` | no electricity, power cut, lights out, fuse, power off, electric shock | Check breaker location. If full building: likely external outage. If shock involved: 118. | `electricity_shutoff_instructions`, `fuse_box_location_description` | Routine / Urgent if safety risk |
| `lockout_access_failure` | locked out, can't get in, lost key, key not working, door won't open | Re-send entry instructions + code if in delivery window. Owner contact. | `entry_instructions`, `key_box_code` (gated), `lockout_instructions` | Urgent if after 22:00 |
| `structural_risk` | crack in wall, ceiling collapsed, structural damage, earthquake, building collapse | Leave immediately. Assembly point. Call 115. | `evacuation_route_description`, `evacuation_assembly_point` | Immediate (0–5 min) |
| `severe_guest_distress` | I can't cope, I'm not ok, distress signals without explicit emergency keyword | Acknowledge calmly. 112 for immediate danger. Telefono Amico. | `owner_emergency_phone`, `nauxica_ops_phone` | Immediate (0–5 min) |
| `other_urgent_safety` | general safety concern not matching above categories | Provide 112. Owner contact. Escalate. | `owner_emergency_phone`, `nauxica_ops_phone` | Urgent (0–30 min) |

**Classification errs toward false positives.** A message that might be an emergency is treated as one. A slightly over-cautious response in a non-emergency costs nothing; a missed emergency is unacceptable.

---

## Emergency Contacts Domain

> **Sprint 012A — future model definition.** The current EmergencyData model (Model 6 in [data-models.md](../backend/data-models.md)) stores a limited set of emergency contacts. This section defines the richer `emergency_contacts` domain that will be implemented in Sprint 012B. The domain replaces the flat contact fields in EmergencyData with a structured, typed contact registry per property.

### Purpose

A property may have multiple people and services to contact depending on the nature of an emergency. The current model only stores one owner contact and the Nauxica ops number. The `emergency_contacts` table will allow homeowners to register a full contact directory — people and services — with typed roles, availability hours, and explicit AI/guest visibility per contact.

### Contact Types

| Contact Type | Use Case | Guest Visible | AI Usage | Escalation Priority |
|---|---|---|---|---|
| `owner` | Primary property owner. First human contact for any property issue. | Yes | Yes — cited as primary contact | P1 (first call) |
| `property_manager` | On-behalf property manager if owner is unavailable or remote. | Yes | Yes — cited as alternative if owner unavailable | P1 (alongside owner) |
| `caretaker` | On-site or local caretaker. Physical presence possible. | Yes | Yes — cited for access, lockout, local issues | P1 (for access/on-site issues) |
| `maintenance` | General maintenance contact for the property. | No | Yes — AI creates ServiceRequest, does not relay number directly to guest | P2 (after owner) |
| `plumber` | Specific plumber for water/pipe emergencies. | No | Yes — AI creates ServiceRequest; operator relays | P2 |
| `electrician` | Specific electrician for electrical faults. | No | Yes — AI creates ServiceRequest; operator relays | P2 |
| `gas_provider` | Gas company for leaks or meter issues. | No | Yes — AI provides 115 first; gas provider for follow-up | P2 |
| `emergency_services` | Italian national emergency services (112, 113, 115, 118). Static constants — not stored per property. **MUST NOT be inserted as a row in `emergency_contacts`.** | Yes | Yes — always included via system prompt, not database | N/A (static) |
| `local_police` | Local Carabinieri or Polizia di Stato station if specific local number is relevant. | Yes | Yes — for security incidents where local station is preferable to 113 | P1 (security) |
| `local_fire` | Local Vigili del Fuoco station if specific local number differs from 115. | Yes | Yes — for fire/gas incidents | P1 (fire/gas) |
| `local_medical` | Nearest hospital or pronto soccorso direct number. Supplements 118. | Yes | Yes — cited with address and distance | P1 (medical) |
| `nauxica_operator` | Nauxica 24/7 operations duty line. Inserted by Nauxica at property onboarding. | Yes | Yes — always cited as the escalation backstop | P0 (backstop) |

### Contact Record Shape (design contract — not yet implemented)

```
EmergencyContact {
    id:                 uuid
    property_id:        uuid → Property.id
    contact_type:       enum (see Contact Types above)
    display_name:       string          // e.g. "Marco Bianchi (owner)"
    phone:              string          // E.164
    whatsapp_number:    string | null   // E.164, if different from phone
    available_hours:    string | null   // e.g. "08:00–22:00" or "24/7"
    notes:              string | null   // INT scoped — not visible to AI or guest
    guest_visible:      boolean         // Governs whether AI may share phone with guest
    ai_usable:          boolean         // If false: AI acknowledges contact exists but does not provide number
    escalation_priority: integer        // 0 (backstop) to 3 (secondary)
    is_active:          boolean
    created_at:         timestamptz
    updated_at:         timestamptz
}
```

### Visibility rules for emergency contacts

- Contacts with `guest_visible = true` and `ai_usable = true`: AI may provide the phone number directly to the guest.
- Contacts with `guest_visible = false`: AI must not provide the number. It may acknowledge that "our maintenance team will be in touch" without naming or numbering the contact.
- Contacts with `ai_usable = false`: exist for operator reference only. AI is not aware of them.
- `nauxica_operator` contact: always `guest_visible = true`, always `ai_usable = true`, `escalation_priority = 0`. Cannot be edited by homeowner.

### How emergency_contacts replaces existing EmergencyData flat fields

When `emergency_contacts` is implemented in Sprint 012B, the following flat fields from EmergencyData will be logically migrated:

| EmergencyData field (current) | Replaced by contact_type |
|---|---|
| `owner_emergency_name` + `owner_emergency_phone` | `owner` type contact |
| `nauxica_ops_phone` | `nauxica_operator` type contact |
| `nearest_hospital_name` + `nearest_hospital_address` | `local_medical` type contact |

The flat fields in EmergencyData remain as the primary store during Sprint 012B and are not removed until the `emergency_contacts` table is fully populated and validated.

---

## Access Code Gating Rules

Access credentials (lockbox code, smart lock code, gate code, parking code) are `GST`-scoped
and pass the scope filter, but they carry an additional delivery gate. The gate determines
whether the actual value or a sentinel placeholder is included in the PropertyKnowledgeBlock.

### Gate conditions

| Credential field | Gate open when | Sentinel when gate is closed |
|---|---|---|
| `key_box_code` | `session_phase` IN (`check_in`, `in_stay`) OR (`pre_arrival` AND `checkin_date = today` AND `Property.early_access_code_delivery = true`) | `"[not yet available]"` |
| `smart_lock_instructions` (code component) | Same as above | `"[not yet available]"` |
| `building_door_code` | Same as above | `"[not yet available]"` |
| `parking_access_code` | Same as above + guest has indicated they have a vehicle | `"[not yet available]"` |
| `entry_instructions` (prose) | All phases | Always included — instructions don't contain the code, they reference it |

### What the AI does with a sentinel value

When a credential field contains `"[not yet available]"`, the AI responds:

> "I'll send you the entry details on the morning of your arrival, [checkin_date].
> Everything will be ready when you get there. Is there anything else I can help
> you with in the meantime?"

The AI must not:
- Suggest the guest try to find the code another way
- Offer to send the code "a bit earlier" outside the gate window
- Acknowledge that a code exists but "can't be shared yet" (which confirms a code exists — a
  minor security leak)

### Early delivery exception

If the homeowner has set `Property.early_access_code_delivery = true` (a planned field for
future implementation), the gate opens during the `pre_arrival` phase on `checkin_date`
(before `check_in_from` time). This is a homeowner-controlled setting with a default of `false`.
See [whatsapp-session-anchor.md §8](whatsapp-session-anchor.md) for the authoritative delivery rules.

### Post-checkout code expiry

After `checkout_date + 4 hours`, all credential fields revert to sentinel values in the
PropertyKnowledgeBlock. This happens even if the session is still technically open (post-stay
grace period). A guest who has checked out must not be able to retrieve a still-valid code
for a property they no longer occupy.

---

## Retrieval Chunk Structure

The PropertyKnowledgeBlock is not passed to the AI as a single monolithic object. It is
divided into **retrieval chunks** — named sections that the AI loads selectively based on
the guest's query category (per [AI Knowledge Taxonomy](ai-knowledge-taxonomy.md)).

This keeps the AI's active context window relevant, prevents unrelated data from being
cited, and allows for future vector-based retrieval without restructuring.

### Chunk definitions

| Chunk name | Knowledge Taxonomy ref | Fields included | Always loaded |
|---|---|---|---|
| `emergency` | CAT-01 | Full EmergencyData object + utility shutoffs | **Yes** |
| `access` | CAT-02 | `access_method`, `entry_instructions`, all credential fields (gated), `lockout_instructions` | No — loaded on access/entry queries |
| `check_in` | CAT-03 | `checkin_from`, `checkin_until`, `early_checkin_*`, `checkin_instructions`, `property_orientation`, `first_night_essentials`, arrival landmark, nearest airport/port | Loaded on `pre_arrival` and `check_in` session phases |
| `check_out` | CAT-04 | `checkout_by`, `late_checkout_*`, `checkout_instructions`, `checkout_tasks`, `key_return_instructions` | Loaded on `check_out` session phase |
| `wifi` | CAT-05 | `wifi_network`, `wifi_password` (gated), `wifi_backup_note`, `mobile_coverage_notes` | No — loaded on connectivity queries |
| `amenities` | CAT-06 | `appliances`, `heating_instructions`, `cooling_instructions`, `pool_*`, `bbq_instructions`, `amenity_list`, `amenity_notes` | No — loaded on amenity/appliance queries |
| `rules` | CAT-07 | `house_rules_summary`, `quiet_hours`, `smoking_policy`, `pet_policy`, `party_policy`, `checkout_tasks` | No — loaded on rules queries |
| `local_area` | CAT-08 | `local_tips`, `area_description`, `nearest_*`, `getting_around_notes`, `seasonal_notes` | No — loaded on local/recommendation queries |
| `services` | CAT-09 | `experience_recommendations`, `nearest_taxi_or_transfer`, bookable `restaurant_recommendations` | No — loaded on service/booking queries |
| `maintenance` | CAT-10 | `appliances` (relevant item), `wifi_backup_note`, utility controls, `boiler_*` | No — loaded on issue/fault queries |
| `tax` | CAT-11 | `tourist_tax_amount_eur`, `tourist_tax_max_nights`, `tourist_tax_exemptions`, `tourist_tax_collection_method` | No — loaded on tax queries |
| `summary` | CAT-12 | `display_name`, `property_type`, `summary`, `area_description`, `max_guests`, `bedrooms`, `bathrooms`, `beds_configuration`, `amenity_list` | Loaded for all sessions as a thin baseline |

### Loading sequence

```
For every session, at context build time:
  1. Always load: `emergency` chunk + `summary` chunk
  2. Load phase-appropriate chunks:
     - pre_arrival:  + check_in chunk (directions only, no codes)
     - check_in:     + check_in chunk + access chunk (codes gated open)
     - in_stay:      no additional auto-load
     - check_out:    + check_out chunk
     - post_stay:    summary chunk only (no operational data)
  3. On each guest message:
     - Classify query into Knowledge Taxonomy category
     - Load the corresponding chunk if not already loaded
     - Merged chunk is appended to the AI's context for this response
```

### Chunk freshness

Each chunk carries a `generated_at` timestamp. If a chunk was generated more than
`chunk_ttl` seconds ago (recommended: 300 seconds / 5 minutes for in-stay sessions, 3600
seconds / 1 hour for pre-arrival), it is re-generated from the Property master record before
being served. This ensures dynamic instruction overrides and homeowner updates propagate to
the AI within a predictable window.

---

## Session Phase Knowledge Gate

This section is the authoritative matrix governing which knowledge blocks are available during each session phase. It supplements the loading sequence in the Retrieval Chunk Structure above with explicit availability and restriction notes.

**Key:** ✅ Available · ⚠️ Available with restrictions · 🔒 Blocked · ✴️ Always (phase-independent)

| Block Type | `pre_arrival` | `check_in` | `in_stay` | `check_out` | `post_stay` | Notes |
|---|---|---|---|---|---|---|
| `emergency` | ✴️ | ✴️ | ✴️ | ✴️ | ✴️ | Always pre-loaded. No phase restriction. |
| `property_summary` | ✴️ | ✴️ | ✴️ | ✴️ | ✴️ | Always pre-loaded as thin baseline. |
| `access` | ⚠️ | ✅ | ✅ | ✅ | 🔒 | Pre-arrival: loadable but credentials are sentinel. Check-in+: credentials open. Post-stay: blocked entirely after checkout + 4h. |
| `check_in` | ✅ | ✅ | ⚠️ | ⚠️ | 🔒 | Pre-arrival + check-in: phase-default. In-stay/check-out: loadable on direct question only. Post-stay: blocked. |
| `check_out` | 🔒 | ⚠️ | ⚠️ | ✅ | ⚠️ | Check-out: phase-default. Pre-arrival: blocked. In-stay: loadable on direct question. Post-stay: loadable for late queries only. |
| `wifi` | ⚠️ | ✅ | ✅ | ✅ | 🔒 | Pre-arrival: loadable but password is sentinel. Check-in+: password open. Post-stay: blocked. |
| `amenities` | 🔒 | ✅ | ✅ | ⚠️ | 🔒 | Pre-arrival: not relevant. Check-out: loadable only if directly asked. Post-stay: blocked. |
| `house_rules` | ✅ | ✅ | ✅ | ✅ | 🔒 | Available all stay phases on demand. Post-stay: blocked. |
| `local_area` | ⚠️ | ✅ | ✅ | ✅ | 🔒 | Pre-arrival: loadable if guest asks; recommendations are general arrival tips only. |
| `services` | 🔒 | ⚠️ | ✅ | ⚠️ | 🔒 | Pre-arrival: not available (guest not yet in-stay). Check-in/check-out: limited to transfer/arrival services. |
| `maintenance` | 🔒 | ⚠️ | ✅ | ✅ | 🔒 | Pre-arrival: blocked. Check-in: loadable for property orientation only. In-stay: fully available on issue report. |
| `tourist_tax` | ✅ | ✅ | ✅ | ✅ | 🔒 | Available all stay phases — guests may ask at any time during the stay. |
| `booking_policy` | ✅ | ✅ | ✅ | ✅ | ⚠️ | Available all phases — policy is always relevant. Post-stay: available but AI must note changes require contacting team. |
| `fallback_support` | ✴️ | ✴️ | ✴️ | ✴️ | ✴️ | Always available. Only activated as a response context when KBB status = "degraded". |

### Phase gate enforcement notes

- **Access code gate takes precedence over phase availability.** Even if the `access` block is marked ✅ for a phase, credential fields within it remain sentinel if the timing gate is not open (see Access Code Gating Rules).
- **Emergency knowledge is never gated.** No entry in the table above may block or delay the `emergency` block. If a phase gate conflict exists, emergency always wins.
- **Post-stay is a restricted session.** Once `checkout_date + 4 hours` has passed, only `emergency`, `property_summary`, `booking_policy` (for final queries), and `fallback_support` remain loadable. All operational blocks are blocked. The guest's stay is over.
- **Access code expiry is post-checkout-based, not post-stay-session-based.** Even if the WhatsApp session is still technically open (within the 24h post-stay grace period), credential fields return to sentinel from `checkout_date + 4 hours`. A checked-out guest cannot retrieve valid entry codes.

---

## Complete Example — Villa Mare

```yaml
schema_version: "1.0"
property_id: "villa-mare"
display_name: "Villa Mare"
is_complete: true
last_verified_at: "2026-05-20"

summary: >
  Villa Mare is a bright two-bedroom apartment on the third floor of a liberty-style
  building in the Ognina district of Catania. It sits 300 metres from the sea and
  15 minutes by car from the historic centre. The building has a lift and private parking.

property_type: "apartment"
area_description: >
  Ognina is a quiet residential neighbourhood on the northern edge of Catania, known
  for its small harbour and seafront promenade. There are several cafés, restaurants,
  and a supermarket within a 5-minute walk.
nearest_airport: "Catania Fontanarossa (CTA), 20 minutes by car or taxi"
nearest_port: "Catania Port, 15 minutes by car"

checkin_from: "15:00"
checkin_until: "20:00"
checkout_by: "10:00"
early_checkin_available: false
late_checkout_available: true
late_checkout_notes: "Late checkout until 12:00 is available on request — please ask at least the evening before."

access_method: "key-box"
entry_instructions: >
  1. Walk along Via Scammacca until you reach the beige building at number 22.
     Look for the green front gate with a brass letter box.
  2. The key box is on the left side of the gate at shoulder height. It has an orange sticker.
  3. Enter the code (sent separately) and lift the cover to open.
  4. Take the key labelled FRONT DOOR.
  5. Enter the building, take the lift to the 3rd floor. Apartment 3B is on the right.
  6. At checkout, return the key to the key box and close it securely.
key_box_location: "Left side of the green gate at Via Scammacca 22, at shoulder height, orange sticker"
key_box_code: "[REDACTED — delivered securely post-booking]"
building_door_code: null
parking_instructions: "Private parking is in the courtyard behind the building. Enter from Via Caracciolo. Space number 7 is reserved for Villa Mare guests."
parking_access_code: "[REDACTED — delivered securely post-booking]"
lockout_instructions: "If you cannot get in, call Marco on +39 333 000 0000. Do not force the lock. If Marco is unreachable, contact Nauxica support."

wifi_network: "VillaMare-Guests"
wifi_password: "[REDACTED — delivered securely post-booking]"
wifi_backup_note: "The router is in the hallway cupboard. If the connection drops, switch it off at the wall, wait 30 seconds, and switch it back on."

appliances:
  - name: "Washing machine"
    model: "Bosch Serie 4"
    instructions: >
      The machine is in the bathroom. Load clothes, close the door firmly.
      Add detergent to drawer compartment II.
      Select programme 3 for colours or 6 for whites.
      Press Start — a standard wash takes about 90 minutes.
  - name: "Air conditioning"
    model: "Daikin split unit"
    instructions: >
      Use the white remote on the bedside table. Press the power button (top left).
      Use the arrows to set temperature — we recommend 24°C in summer.
      Press MODE to switch between cooling (snowflake) and heating (sun).
      Please switch off when leaving the apartment.
  - name: "TV"
    model: "Samsung 55 Smart TV"
    instructions: >
      Use the black Samsung remote. Netflix is pre-loaded — select the Guests profile.
      To switch to the Apple TV, press Source and select HDMI 1.
      The small silver remote is for the Apple TV.

house_rules_summary: >
  • No smoking inside. Smoking is permitted on the terrace only.
  • No parties or events. Maximum 4 guests at any time.
  • Quiet hours: 23:00 – 08:00.
  • Pets are not permitted.
  • Please switch off the air conditioning and close all windows when leaving.
  • Return the key to the key box at checkout.
  • Report any damage immediately to the emergency contact.
quiet_hours: "23:00 – 08:00"
smoking_policy: "No smoking inside the property. Smoking is permitted on the terrace."
pet_policy: "Pets are not permitted at this property."

trash_collection_days: "Monday and Thursday"
trash_instructions: >
  Bins are in the cupboard under the kitchen sink.
  Grey bin: general waste. Blue bin: plastic and metal. White bin: paper and cardboard.
  Glass goes in the public glass container on the corner of Via Scammacca and Via Roma.
  Please leave tied bags outside the building entrance by 07:00 on collection days.

emergency_contact_name: "Marco Bianchi (owner)"
emergency_contact_phone: "+39 333 000 0000"
emergency_services:
  general: "112"
  police: "113"
  carabinieri: "112"
  ambulance: "118"
  fire: "115"

nearest_hospital_name: "Ospedale Garibaldi – Centro"
nearest_hospital_address: "Piazza Santa Maria di Gesù, 95124 Catania CT"
nearest_pharmacy_name: "Farmacia Etna"
nearest_pharmacy_address: "Via Etnea 12, Catania (open Mon–Sat 09:00–20:00; farmacia di turno 24h on Via X)"

tourist_tax_amount_eur: 2.00
tourist_tax_max_nights: 7
tourist_tax_exemptions: "Children under 12 years old are exempt. Guests with a certified disability are exempt."
tourist_tax_collection_method: "Collected in cash at check-in by the property owner."

local_tips:
  - type: restaurant
    name: "Trattoria del Porto"
    description: "Excellent fresh fish and seafood, right on the Ognina harbour."
    distance: "3 min walk"
  - type: market
    name: "La Pescheria"
    description: "Catania's famous fish market — a must-see, open mornings only."
    distance: "15 min by bus"
  - type: beach
    name: "Lido Azzurro"
    description: "Popular lido with sun lounger hire, bar, and sea access."
    distance: "8 min walk"
  - type: transport
    name: "Bus 457 stop"
    description: "Connects Ognina to Catania centre and the main bus station."
    distance: "2 min walk"

seasonal_notes:
  - months_applicable: [6, 7, 8]
    note: >
      In summer the apartment can get warm during the day. We recommend keeping shutters
      closed from midday and opening windows in the evening. The AC works best with windows closed.
  - months_applicable: [8]
    note: >
      During the week of 15 August (Ferragosto), many local shops close.
      The Despar supermarket on Via Roma stays open every day.
```

---

## Fallback Behaviour — Missing Fields

The AI concierge must handle incomplete knowledge blocks gracefully. Define fallbacks per field type:

| Scenario | AI response |
|---|---|
| `is_complete` is false | "I don't have all the details for this property yet. Please contact the owner or Nauxica support." |
| `entry_instructions` is empty | "I don't have the entry instructions for your property. Please contact [emergency_contact_name] on [emergency_contact_phone]." |
| `wifi_password` is empty | "I don't have the WiFi details on hand. Please check your booking confirmation or contact the owner." |
| `appliances` array is empty | "I don't have appliance guides for this property. The owner's contact is [emergency_contact_name] on [emergency_contact_phone]." |
| `tourist_tax_amount_eur` is empty | "I don't have the tourist tax details for this property. Please ask the owner at check-in." |
| `local_tips` is empty | Generic local area suggestions based on `address_municipality` only — do not fabricate specific venue names. |
| Guest phone not matched to booking | "I couldn't find a booking linked to your number. Could you share your confirmation number? It looks like NX-2026-XXXXX." |

---

## AI Response Grounding Rules

These rules define how the AI must use the PropertyKnowledgeBlock when formulating a
response. They are the contract between the knowledge schema and the AI behaviour layer.

**Rule G-01 — Ground every claim in a loaded chunk**
Every factual statement the AI makes about the property must be derivable from a field in
the currently loaded PropertyKnowledgeBlock. The AI must not make claims that go beyond
what is explicitly written in the block.

**Rule G-02 — Quote, do not paraphrase, for credentials**
WiFi passwords, lockbox codes, and access codes must be delivered verbatim, not paraphrased
or shortened. "The code is 4821" is correct. "The code starts with 4 and has four digits"
is incorrect and unhelpful.

**Rule G-03 — Do not blend property data with general knowledge**
The AI must not supplement property data with general knowledge about Italian hospitality,
Sicilian customs, or standard apartment features. If a field is missing, the fallback
response applies — not a reasonable guess. The guest is at a specific property; generic
advice may be wrong for that property.

**Rule G-04 — Session phase shapes what is volunteered, not what is answered**
The AI should proactively share phase-appropriate information (arrival instructions in
pre_arrival, checkout reminders in check_out). But if a guest asks an out-of-phase question
(e.g., "what's the WiFi password?" during pre_arrival), the AI loads the wifi chunk and
answers it — the phase does not block answers to direct questions.

**Rule G-05 — Recommend, do not promise, for local area**
Recommendations from `local_tips` and `experience_recommendations` are suggestions, not
guarantees. The AI must use recommendation language: "the owner recommends", "guests
often enjoy", "nearby options include". It must not say "you should go to X" or "the
best restaurant is X" as absolute statements.

**Rule G-06 — Tourist tax: inform, do not collect**
The AI provides tourist tax information (rate, exemptions, collection method) but never
positions itself as the collection mechanism. It always directs payment to the homeowner.
The AI must not say "please pay me the tourist tax" or any equivalent.

**Rule G-07 — House rules: state, do not enforce**
The AI states house rules clearly when asked, and can proactively mention them if a
guest's request appears to conflict with a rule (e.g., "I'm bringing my dog"). The AI
does not threaten penalties, does not accuse guests of breaking rules, and does not
engage in an argument about rules. If a guest persists in requesting something against
the rules, the AI escalates to the homeowner.

**Rule G-08 — Safety information: be specific, be direct**
In emergency situations, the AI must not be vague. "The gas shutoff is somewhere near the
entrance" is dangerous. The AI must deliver the exact text from `gas_shutoff_instructions`
verbatim, then add 115 and 112.

**Rule G-09 — Do not confirm what you cannot confirm**
If a guest asks "has the cleaning been done?", "has maintenance been fixed?", "is the pool
heated today?" — these are operational states the AI does not have access to. The AI
must not guess, must not say "it should be fine", and must not invent an operational status.
It acknowledges the question and offers to check with the team (which triggers an escalation
or ServiceRequest as appropriate).

**Rule G-10 — Seasonal notes are additive, not replacements**
Seasonal notes from `seasonal_notes` supplement base property information — they do not
override it. If a seasonal note conflicts with a base field, the base field is authoritative
unless a DynamicInstruction override has been applied.

---

## Hallucination Prevention Rules

Hallucination — generating plausible but invented information — is the most dangerous AI
failure mode in a hospitality context. A guest given a wrong address for a hospital, a
wrong lockbox code, or a wrong checkout time can have their stay meaningfully harmed.

These rules define the specific conditions where hallucination risk is highest and the
mitigations that must be in place.

**Rule H-01 — Null field = escalate to fallback, never invent**
If a field relevant to the guest's query is null, empty, or absent from the loaded chunk:
the AI must use the defined fallback response for that field type (see Fallback Behaviour).
It must never synthesise an answer from related fields or general knowledge.

| High-risk null scenario | Forbidden AI behaviour | Required AI behaviour |
|---|---|---|
| `entry_instructions` is null | "The entry is usually via a key box — try looking near the door" | Use entry_instructions fallback response |
| `nearest_hospital_address` is null | "There's usually a hospital in the city centre" | "I don't have the hospital address — please call 118 for the nearest facility" |
| `wifi_password` is null | "The password might be on a card near the router" | Use wifi fallback response |
| `tourist_tax_amount_eur` is null | "Tourist tax in Sicily is usually €2–3 per night" | "Please ask the owner about the tourist tax at check-in" |
| `checkout_tasks` is empty | "Usually you'd take out the rubbish and strip the beds" | "I don't have a specific checkout list for this property — please ask [emergency_contact_name] if you're unsure" |

**Rule H-02 — Do not extrapolate from partial data**
If the `checkin_from` time is populated but `late_checkin_available` is null, the AI must
not say "late check-in should be possible". It must say "I don't have information about late
check-in — please contact the owner to confirm."

**Rule H-03 — Local area recommendations must come from `local_tips` only**
The AI must not recommend restaurants, beaches, or experiences based on general knowledge
of Sicily. If `local_tips` is empty, the AI says: "I don't have specific recommendations
for this property, but [address_municipality] has plenty to explore — would you like general
tips about the area?" The subsequent general response is clearly framed as general, not
property-specific.

**Rule H-04 — Never infer partner information**
The AI does not have access to partner assignment data. It must never speculate about who
the cleaner is, when they typically arrive, whether maintenance has been arranged, or which
transfer service operates in the area. These are operational facts the AI cannot know.

**Rule H-05 — Appliance instructions must match the specific model**
If `appliances[name="Washing machine"].model` is "Bosch Serie 4" and the guest asks how to
do a quick wash, the AI delivers the instructions for that specific appliance. It must not
substitute generic washing machine instructions if the stored instructions differ from
general knowledge about that model.

**Rule H-06 — Dates and times are always sourced from the session context**
The AI must not calculate relative dates (e.g., "your checkout is in 2 days") from general
knowledge of the current date. Dates in the session context come from the Reservation record,
and times come from property fields. The AI must use those values, not infer them.

**Rule H-07 — The property is unique — do not compare to other properties**
The AI must not say "most properties in Sicily have..." or "at other Nauxica properties, 
the rule is...". The guest is in this specific property. All claims must reference this
property's data only.

---

## Guest-Safe Projection Rules Summary

A field is included in the PropertyKnowledgeBlock if and only if it meets ALL of:

| Condition | Requirement |
|---|---|
| Visibility scope | `PUB` or `GST` only |
| Property lifecycle state | `active` (or emergency fields, which bypass this gate) |
| Access code gate | Delivery window is open (or field is non-credential) |
| Language availability | At least one non-null language variant exists |
| Not overridden | No active `DynamicInstruction` targeting this field with a null override text |

A field is **excluded** from the PropertyKnowledgeBlock if any of:
- Scope is `PTR` (partner data)
- Scope is `INT` or untagged (operator/system data)
- Field is a `PTR` partner-access credential
- Field is a financial or compliance record
- Field is an internal note

**Critical exclusion list** — these fields must never appear in a PropertyKnowledgeBlock under any circumstances:

- `owner_bank_iban`, `codice_fiscale_or_piva`, `billing_entity_name`
- `commission_rate_override`, `revenue_share_pct`, `maintenance_budget_limit_eur`
- `partner_access_code`, `partner_key_safe_code`, `partner_entry_instructions`
- `cleaning_inventory_notes`, `linen_changeover_notes`, `property_quirks_for_partners`
- `owner_internal_notes`, `operator_notes`, `onboarding_notes`
- `rental_licence_number`, `alloggiati_web_required`, `alloggiati_web_registered_by`
- `owner_id`, `approved_partner_ids`, `incident_log_refs`
- Any field from the `PartnerAssignment` model

---

## Partner Brief vs PropertyKnowledgeBlock

The PropertyKnowledgeBlock is a guest-facing projection. A separate **Partner Brief** is
a partner-facing projection of the same property master record.

| Attribute | PropertyKnowledgeBlock | Partner Brief |
|---|---|---|
| Audience | AI concierge → guest | Platform → assigned partner |
| Scope filter | PUB + GST | PTR (+ PUB where relevant) |
| Access codes | Guest codes (gated by timing) | Partner-specific codes (gated by job confirmation) |
| Cleaning notes | Excluded | Included |
| Owner emergency contact | Included | Included |
| Partner contact details | Excluded | Included |
| Delivery mechanism | Loaded into AI session context | Sent via in-platform PartnerRequest message |
| Defined in this document? | Yes | See [Partner Assignment Model §6](../architecture/partner-assignment-model.md) |

These two projections must never be mixed. A PropertyKnowledgeBlock must not contain PTR
fields, and a Partner Brief must not be delivered to the AI session.

---

## Concierge Context Shape — Design Contract

> **Sprint 012A — design contract only.** This section defines the shape of the full concierge context object that the AI runtime will receive when Sprint 012B is implemented. It is not yet built. No migration, no Edge Function, and no resolver change should reference this shape until Sprint 012B is approved and scoped.

The context object is the assembled input to the AI runtime. It is built by `buildConciergeContext()` (defined in Sprint 012B Implementation Readiness below) and passed to the AI model as a structured object, not as a flat string. The AI never constructs this object — it receives it.

```
ConciergeContext {

    // ── Session ──────────────────────────────────────────────────────
    session: {
        session_id:             uuid
        session_status:         enum    // active | waiting | escalated
        session_phase:          enum    // pre_arrival | check_in | in_stay | check_out | post_stay
        detected_language:      string  // ISO 639-1; "en" default
        unresolved_query_count: integer
        is_escalated:           boolean // derived: session_status === "escalated"
        schema_version:         string  // version of this context shape
    }

    // ── Guest ─────────────────────────────────────────────────────────
    // GST-scoped only. No document data (passport, nationality).
    // No financial data. No other guests' data.
    guest: {
        guest_name:             string
        guest_count:            integer
        checkin_date:           date    // ISO 8601
        checkout_date:          date    // ISO 8601
        confirmation_number:    string
        special_requests:       string | null
        // Note: guest_phone is NOT included — it is INT-scoped session state only
    }

    // ── Property ─────────────────────────────────────────────────────
    // PUB-scoped fields only. No owner identity, no financial data, no partner data.
    property: {
        property_id:            uuid
        display_name:           string
        property_type:          string
        address_locality:       string  // Municipality only — not full address
        nearest_airport:        string | null
        is_complete:            boolean
        schema_version:         string  // PropertyKnowledgeBlock schema version
        generated_at:           timestamp
    }

    // ── Knowledge ─────────────────────────────────────────────────────
    // Chunked knowledge blocks. Only loaded chunks are non-null.
    // emergency and summary are always present (never null in a valid context).
    // All other chunks: null if not loaded for this session + query.
    knowledge: {
        emergency:              EmergencyChunk          // Always present
        property_summary:       SummaryChunk            // Always present
        access:                 AccessChunk | null
        check_in:               CheckInChunk | null
        check_out:              CheckOutChunk | null
        wifi:                   WifiChunk | null
        amenities:              AmenitiesChunk | null
        house_rules:            RulesChunk | null
        local_area:             LocalAreaChunk | null
        services:               ServicesChunk | null
        maintenance:            MaintenanceChunk | null
        tourist_tax:            TaxChunk | null
        booking_policy:         BookingPolicyChunk | null
        fallback_support:       FallbackSupportChunk | null
        // access_codes_gated: boolean  // true if any credential is sentinel value
        // dynamic_instructions_applied: integer
    }

    // ── Emergency ─────────────────────────────────────────────────────
    // Always populated. Separate from knowledge.emergency for clarity and
    // to allow the AI to locate emergency data without chunk traversal.
    emergency: {
        is_complete:                boolean
        owner_emergency_name:       string
        owner_emergency_phone:      string
        nauxica_ops_phone:          string
        nearest_hospital_name:      string
        nearest_hospital_address:   string
        nearest_hospital_distance:  string | null
        gas_shutoff_instructions:   text
        water_shutoff_instructions: text
        electricity_shutoff_instructions: text
        evacuation_route_description: text | null
        evacuation_assembly_point:  text | null
        property_specific_hazards:  text | null
        // Italian national emergency numbers: NOT stored here.
        // They are static constants in the AI system prompt.
    }

    // ── Emergency Contacts ────────────────────────────────────────────
    // Populated from emergency_contacts table (Sprint 012B).
    // At Sprint 012A: populated from flat EmergencyData fields as a compatibility shim.
    // Only contacts with guest_visible=true and ai_usable=true are included.
    emergency_contacts: [
        {
            contact_type:       enum    // owner | caretaker | property_manager | nauxica_operator | local_medical | ...
            display_name:       string
            phone:              string  // E.164
            available_hours:    string | null
            escalation_priority: integer
        }
        // ... one entry per guest-visible, AI-usable contact for this property
    ]

    // ── Stay Context (placeholder) ────────────────────────────────────
    // Populated in Sprint 015 (GuestStayContext model).
    // At Sprint 012A: always null. Reserved field — do not use.
    stay_context:           null
}
```

### What is NOT in ConciergeContext

The following must never appear in the context object passed to the AI runtime:

| Excluded data | Why |
|---|---|
| `guest_phone` | INT-scoped. AI doesn't need to know its own session anchor. |
| `reservation_id`, `property_id` (raw UUIDs) | INT-scoped. Not cited to guests. |
| `owner_id`, `owner_name` (full owner profile) | INT-scoped. Owner emergency contact is shared via `emergency`, not owner profile. |
| Commission data, revenue data, Nauxica fee | INT-scoped. Absolutely never in guest context. |
| Partner contact details, partner access codes | PTR-scoped. |
| Internal notes, operator notes | INT-scoped. |
| Guest passport / nationality / document number | INT-scoped. Compliance data. |
| Other guests' data, other sessions | Isolation requirement. |
| Historical reservation data | Current stay only. |
| ServiceRequest status (past) | INT-scoped. AI does not have visibility into past request resolution. |

### Context size guidance

The assembled ConciergeContext will be passed as part of the AI model's prompt. Size must be managed:

- Always-loaded chunks (`emergency`, `property_summary`): target < 2,000 tokens
- Phase-default chunks: target < 1,500 tokens each
- On-demand chunks (one per query): target < 1,000 tokens each
- Total assembled context window: target < 8,000 tokens (leaving headroom for system prompt + conversation history)

These are design targets, not hard limits. If a knowledge block exceeds these targets, it must be chunked further before being added to the context.

---

## AI Behaviour Rules — Consolidated

This section is the single canonical reference for how the AI concierge must behave when using the PropertyKnowledgeBlock. It consolidates and supersedes individual rules scattered across earlier sections of this document. When a rule here conflicts with a rule in another section of this document, this section takes precedence.

### Grounding

**AIB-01 — Use only supplied context.** Every factual claim about this property must be traceable to a field in a loaded knowledge chunk. The AI must not supplement context with general knowledge about Italian apartments, Sicilian hospitality, or similar properties.

**AIB-02 — Quote credentials verbatim.** WiFi passwords, lockbox codes, and access codes must be delivered as-is, not paraphrased. "The code is 4821" is correct. "The code starts with 4" is not.

**AIB-03 — Null field = fallback response, not a guess.** If a field relevant to the guest's question is null or absent, the AI uses the defined fallback for that field type. It does not infer from related fields, does not estimate, does not give a probabilistic answer.

**AIB-04 — Ask clarifying questions when the query is ambiguous.** If a guest's question cannot be classified with confidence, the AI asks one clarifying question. It does not assume and proceed.

**AIB-05 — Do not compare this property to other properties.** The AI must not say "most properties in Sicily have..." or "at other Nauxica properties, the usual approach is...". Every claim is about this specific property only.

### Escalation and safety

**AIB-06 — Escalate when uncertain or safety-critical.** If the AI cannot answer a question that has safety implications (gas shutoff location is missing, hospital address is null), it escalates immediately (TRIGGER-05 hard) rather than waiting for the confidence threshold.

**AIB-07 — Emergency: provide calm, practical steps.** In any emergency category, the AI responds immediately with: the national emergency number (112 first), property-specific procedure from the emergency block, and the owner/ops contact. Tone is calm and direct. No preamble. No apology.

**AIB-08 — Offer escalation for unresolved issues.** If a guest's issue is not resolved by the AI's first response, the AI offers to involve the owner or Nauxica operations. It does not keep attempting to resolve indefinitely.

### Data boundaries

**AIB-09 — Never expose internal data.** Scope `INT` and scope `PTR` data must never appear in any guest-facing response. If the AI references data the guest should not see, the response safety check (see knowledge-retrieval-model.md §3 step [13]) must flag it before delivery.

**AIB-10 — Never mention commission, payout, partner earnings, or Nauxica fee.** These are INT-scoped and must never enter any guest-facing context. If a guest asks about fees beyond tourist tax, the AI directs them to the homeowner for financial discussions.

**AIB-11 — Never infer operational state.** The AI does not know whether the cleaner has been, whether the maintenance issue was fixed, or whether the pool is heated today. If asked, it acknowledges it cannot confirm current operational state and offers to check via the homeowner.

**AIB-12 — Do not confirm or deny data it has not been given.** If the AI lacks a field, it must not say "it should be..." or "I believe there is...". Uncertainty must be stated plainly: "I don't have that detail — please contact [name] on [phone]."

### Communication

**AIB-13 — Local area: recommend, do not guarantee.** Recommendations from `local_tips` are framed as suggestions: "the owner recommends", "guests often enjoy". Not as absolutes: "the best restaurant is X".

**AIB-14 — Tourist tax: inform, do not collect.** The AI provides tax information (rate, exemptions, collection method) and always directs payment to the homeowner. It never represents itself as the collection mechanism.

**AIB-15 — House rules: state, do not enforce.** The AI states rules clearly. It does not threaten, accuse, or argue. If a guest persists in requesting something that violates a rule, the AI escalates.

---

## Backend and API Implementation Notes

These notes are for the backend engineering team implementing the Knowledge Block Builder.
They are architecture guidance, not code.

**The Knowledge Block Builder is a server-side transformation service, not a database view.**
It should run as a dedicated service or module with a clear interface:
- Input: `property_id` + `session_context` (session phase, language, checkin_date)
- Output: `PropertyKnowledgeBlock` (the full assembled object)

**Caching strategy**
The PropertyKnowledgeBlock should be cached per `property_id` + `session_language` with
a TTL aligned to chunk freshness rules (5 minutes for in-stay, 1 hour for pre-arrival).
Homeowner updates to DynamicInstructions must invalidate the cache for the affected property
immediately — not on TTL expiry.

**Access code gating must be enforced server-side**
The gate condition (session phase + checkin_date check) must be evaluated in the Knowledge
Block Builder, not in the AI prompt. Do not pass the raw credential to the AI and instruct
it not to share it — pass the sentinel value. The AI cannot be trusted to withhold data it
has seen.

**Emergency data must be injected unconditionally**
Do not make the EmergencyData fetch conditional on a session query or a flag. Build it into
the root of every call to the Knowledge Block Builder. The cost of one extra read per session
is trivially small compared to the cost of emergency data being unavailable.

**The transformation output must be schema-versioned**
The PropertyKnowledgeBlock must carry `schema_version` at root level. When the AI prompt
is updated to use a new block format, the version allows the system to validate compatibility.
Old blocks in cache must be invalidated when the schema version changes.

**Audit logging**
Every call to the Knowledge Block Builder should be logged with: `property_id`, `session_id`,
`schema_version`, `language`, `access_codes_gated` (boolean), `emergency_data_complete` (boolean),
`generated_at`. This audit trail supports debugging, incident investigation, and compliance review.

**Do not expose the raw PropertyKnowledgeBlock via a public API endpoint**
The block is an internal AI input artefact. It must not be served via an endpoint that a
client application can call directly. If the guest-facing app needs property data (e.g.,
for a pre-booking page), it uses a separate public-scope property API that only returns
`PUB` fields — not this object.

---

## Sprint 012B — Implementation Readiness

> **Sprint 012A output:** This section was originally the handoff document for Sprint 012B, defining the required migrations, Edge Function helpers, and dependency order. It has been updated in v1.4 to reflect the actual as-built state after Sprint 012B migrations were written and reviewed. The as-built deviations from the original spec are noted inline.

### Required migrations — as built (Sprint 012B)

The following three tables were created in migration files 011–013. All three migrations have been written but **not yet applied to any Supabase database** as of v1.4. They are listed in dependency order.

**Migration 011 — `property_knowledge_blocks`** ✅ Written

As built:
- One row per `(property_id, block_type)` — UNIQUE constraint on `(property_id, block_type)` ✅
- Content stored as `content_jsonb jsonb NOT NULL DEFAULT '{}'` (single JSONB column, not per-field columns) ✅
- Provenance stored as `source_jsonb jsonb NOT NULL DEFAULT '{}'` (provenance metadata — not a separate audit table) ✅
- `is_active` boolean per block (not `is_complete` — completeness is managed by the API layer, not the database) ✅
- `session_phase_gate` text column (nullable; comma-separated phase values) ✅
- `visibility_scope` text column with CHECK constraint: PUB / GST / PTR / INT ✅
- **RLS deviation (Correction D):** Homeowner may SELECT only — not UPDATE. All homeowner mutations go through a validated API endpoint using service_role. This is more restrictive than the v1.3 spec ("homeowner may SELECT and UPDATE"). It prevents homeowners from writing raw JSON to `content_jsonb` without schema validation. The API endpoint validates content, updates `source_jsonb` provenance, and re-runs the KBB pipeline.

**Migration 012 — `emergency_data`** ✅ Written (patched — Correction A)

As built (after Correction A patch):
- All individual named procedure columns are present: `gas_shutoff_instructions`, `water_shutoff_instructions`, `electricity_shutoff_instructions`, `evacuation_route_description`, `evacuation_assembly_point`, `property_specific_hazards` ✅
- `nearest_hospital_distance` text column for travel time in natural language ✅
- `emergency_instructions` prose field retained as a general supplement ✅
- `is_complete` boolean set by the API layer on save (not a database trigger) ✅
- RLS: homeowner SELECT + UPDATE; INSERT/DELETE: service_role only ✅
- `nauxica_ops_phone`: RLS allows homeowner UPDATE on the row, but the homeowner API endpoint strips this field from the request body before writing ✅

**Migration 013 — `emergency_contacts`** ✅ Written (patched — Corrections B and C)

As built (after Corrections B and C):
- `contact_type` as `emergency_contact_type` PostgreSQL ENUM (12 values) ✅
- `guest_visible boolean NOT NULL DEFAULT false` — controls whether AI may share phone with guests ✅
- `ai_usable boolean NOT NULL DEFAULT false` — controls whether AI may use contact in emergency response ✅
- `available_hours text NULL` — human-readable availability guidance; informational only ✅ (Correction E)
- `escalation_priority` integer (0–3) with CHECK constraint ✅
- `nauxica_operator` type protected by INSERT and UPDATE RLS policies — homeowners cannot create or modify nauxica_operator rows ✅
- `emergency_services` enum value: present in the enum for schema completeness but MUST NOT be stored as a row — Italian national numbers are system prompt constants (see Correction C SQL comment in migration 013) ✅
- **Column name note:** The database uses `contact_name` and `contact_phone`. The `ConciergeContext.emergency_contacts` design contract uses `display_name` and `phone`. This mapping is handled in `loadEmergencyContacts()` when implemented in Sprint 012C.
- RLS: homeowner SELECT (all contacts including nauxica_operator); homeowner INSERT + UPDATE (non-nauxica_operator only); no homeowner DELETE policy ✅

### Required backend helper contracts

These helpers form the implementation layer of the Knowledge Block Builder. They are listed as function contracts — name, inputs, outputs, and responsibility boundary. Implementations are written in Sprint 012B.

---

**`loadPropertyKnowledge(property_id, block_types[])`**

Responsibility: Read property_knowledge_blocks from the database for the requested block types. Returns raw block content before any scope filtering or language resolution. Used by the KBB pipeline in Steps 1–4.

Input: `property_id: uuid`, `block_types: string[]` (empty array = all blocks)
Output: `Record<BlockType, RawBlockContent>` — null for any block type not found

---

**`loadEmergencyData(property_id)`**

Responsibility: Fetch the EmergencyData record for this property from the emergency cache first, falling back to database read. Must complete within 50ms SLA (emergency cache read). Must never return null — returns a fallback emergency block with static Italian constants if property-specific data is unavailable.

Input: `property_id: uuid`
Output: `EmergencyChunk` — always non-null; `is_complete: false` if using fallback

---

**`loadEmergencyContacts(property_id)`**

Responsibility: Fetch all emergency contacts for this property where `guest_visible = true` AND `ai_usable = true`. Returns contacts sorted by `escalation_priority ASC` (priority 0 first).

Input: `property_id: uuid`
Output: `EmergencyContact[]` — empty array if no contacts found (not null)

---

**`filterKnowledgeForGuest(rawBlocks, session_phase, checkin_date, checkout_date, request_timestamp)`**

Responsibility: Apply the visibility scope filter (Step 1), activation gate (Step 2), and access code gate (Step 5) from the KBB pipeline. Returns a filtered block set with credential fields replaced by sentinel values where appropriate.

Input: Raw blocks from `loadPropertyKnowledge()` + session context for gate evaluation
Output: `FilteredBlockSet` — same structure as input but with PTR/INT fields removed and gated credentials sentinel-valued

---

**`buildConciergeContext(session, reservation, filtered_blocks, emergency_data, emergency_contacts)`**

Responsibility: Assemble the full `ConciergeContext` object (see Concierge Context Shape above) from its component parts. Apply language resolution (Step 4) and dynamic instruction merge (Step 3). Return the context object ready for the AI runtime.

Input: WhatsAppSession, Reservation, output of `filterKnowledgeForGuest()`, `loadEmergencyData()`, `loadEmergencyContacts()`
Output: `ConciergeContext` — the complete object as defined in the design contract

---

**`detectEmergencyIntent(message_text)`**

Responsibility: Classify an incoming message as emergency or non-emergency using keyword and semantic pattern matching against the 10 emergency categories. Must run in under 10ms (it is the first check on every message). Errs toward false positives.

Input: `message_text: string`
Output: `{ is_emergency: boolean, category: EmergencyCategory | null, confidence: number }`

---

**`buildEmergencyResponseContext(emergency_data, emergency_contacts, category)`**

Responsibility: Assemble a minimal, focused context object for emergency AI responses. Includes emergency chunk + matching category template metadata + prioritised contact list. Does not load non-emergency knowledge blocks (speed and focus).

Input: `EmergencyChunk`, `EmergencyContact[]`, `EmergencyCategory`
Output: `EmergencyResponseContext` — a subset of `ConciergeContext.emergency` + contacts, structured for fast AI response generation

---

### Dependency order for Sprint 012B implementation

```
1. Migration 011 — property_knowledge_blocks
   ↓
2. Migration 012 — emergency_data
   ↓
3. Migration 013 — emergency_contacts
   ↓
4. loadPropertyKnowledge() + loadEmergencyData() + loadEmergencyContacts()
   (can be built in parallel after migrations 011–013 exist)
   ↓
5. filterKnowledgeForGuest()
   (depends on loadPropertyKnowledge())
   ↓
6. detectEmergencyIntent()
   (independent — can be built at any time; needed before any AI response)
   ↓
7. buildEmergencyResponseContext()
   (depends on loadEmergencyData() + loadEmergencyContacts())
   ↓
8. buildConciergeContext()
   (depends on all load + filter helpers)
   ↓
9. Resolver update — wire helpers into concierge-resolver/index.ts
   (Sprint 012B resolver task — outside Sprint 012A scope)
```

---

## Open Gaps and Legal Review Notes

The following items are not yet resolved and must be addressed before backend implementation.

| Gap | Risk | Notes |
|---|---|---|
| **Access code rotation** | High | Lockbox codes should be rotated between guests. The schema stores a single `key_box_code` per property. The Knowledge Block Builder currently has no mechanism to know which code is current for which reservation. A `reservation_access_code` override model is needed. |
| **Multi-language null fallback for non-critical fields** | Medium | The current rule is: if a field is null in all languages, use the fallback response. But for low-stakes fields (e.g., `seasonal_notes`), null is acceptable — the fallback response would be noisy. A field-level `nullable_ok` flag would allow the AI to silently omit unimportant null fields rather than acknowledge the gap. |
| **Chunk invalidation on DynamicInstruction creation** | Medium | When a homeowner creates a DynamicInstruction, the relevant cached chunk must be invalidated immediately. The mechanism for cache invalidation (event-driven vs polling) is not yet specified. |
| **PropertyKnowledgeBlock sync with EmergencyData updates** | High | EmergencyData is a separate record. If a homeowner updates an emergency contact phone number, the cached PropertyKnowledgeBlock must be invalidated. The sync mechanism needs to be specified. |
| **Access code gate and smart lock token expiry** | Medium | Smart lock systems may use time-limited tokens rather than static codes. The gating model assumes a static code. Token-based smart lock integration needs a separate access code delivery model. |
| **Alloggiati Web and guest document data** | High | **(Legal review required)** Guest document data (passport number, nationality) is collected at booking for Alloggiati Web compliance but must never reach the AI. Confirm that no pathway exists for this data to appear in any AI-facing object. |
| **GDPR retention for PropertyKnowledgeBlock cache** | Medium | **(Legal review required)** Cached blocks contain guest names, phone numbers (indirectly via session context), and stay details. Confirm whether cached blocks constitute personal data under GDPR and establish a retention/deletion policy. |
| **Post-stay block destruction** | Medium | After `checkout_date + 24 hours`, the cached PropertyKnowledgeBlock for that session should be invalidated or anonymised. Define the exact destruction trigger and mechanism. |

---

## Schema Versioning

| Version | Date | Changes |
|---|---|---|
| `1.0` | 2026-05-28 | Initial schema — Sicily launch scope |
| `1.1` | 2026-05-28 | Added PARTNER (PTR) scope to visibility key; Transformation Architecture section (7-step Knowledge Block Builder flow); Emergency Data Inclusion Rules; Access Code Gating Rules; Retrieval Chunk Structure aligned to AI Knowledge Taxonomy; AI Response Grounding Rules (G-01 to G-10); Hallucination Prevention Rules (H-01 to H-07); Guest-Safe Projection summary; Partner Brief vs PropertyKnowledgeBlock distinction; Backend/API Implementation Notes; Open Gaps and Legal Review Notes |
| `1.2` | 2026-05-28 | Minor corrections — visibility key notes; schema section reorganisation. (see git history for detail) |
| `1.3` | 2026-06-09 | **Sprint 012A — Knowledge Architecture Freeze.** Added: Canonical Knowledge Block Type Registry (14 types with full attribute matrix); Emergency Model — AI Response Architecture (corrects assumption that emergency bypasses AI); Emergency Category Classification (10 categories); Emergency Contacts Domain (12 contact types, future model design contract); Session Phase Knowledge Gate (per-phase availability matrix for all 14 block types); Concierge Context Shape design contract (7-section ConciergeContext object); AI Behaviour Rules — Consolidated (AIB-01 to AIB-15); Sprint 012B Implementation Readiness (3 required migrations, 7 helper contracts, dependency order). |
| `1.4` | 2026-06-10 | **Sprint 012B Corrective Pass (pre-Supabase).** Correction A: documented that migration 012 was patched to add 7 individual named procedure columns (`gas_shutoff_instructions`, `water_shutoff_instructions`, `electricity_shutoff_instructions`, `evacuation_route_description`, `evacuation_assembly_point`, `property_specific_hazards`, `nearest_hospital_distance`) — restoring compatibility with the ConciergeContext.emergency design contract; EM-04 annotation added. Correction B: documented that migration 013 was patched to add `guest_visible` and `ai_usable` boolean columns required by `loadEmergencyContacts()`. Correction C: `emergency_services` enum value clarified as MUST NOT be stored as a row — static system prompt constants. Correction D: `property_knowledge_blocks` homeowner UPDATE RLS deviation documented — homeowner SELECT only; all mutations via validated API endpoint with service_role. Sprint 012B Implementation Readiness section updated to as-built state. |
| `1.5` | 2026-06-10 | **Sprint 012B Final Micro-Correction (pre-Supabase).** Correction E: `available_hours text NULL` added to migration 013 (`emergency_contacts`) — resolves the last mismatch between `ConciergeContext.emergency_contacts` and the migration schema. `available_hours` is informational only (human-readable availability guidance); does not affect `escalation_priority`, RLS, or dispatch logic. As-built notes updated; gap documentation removed. `ConciergeContext.emergency_contacts` now fully matched by the migration. |

When a new field is added: increment the minor version (e.g. `1.1`). When field structure changes in a breaking way: increment the major version (e.g. `2.0`) and maintain backward compatibility for at least one version cycle.

---

## Related Documents

- [knowledge-retrieval-model.md](knowledge-retrieval-model.md) — How the AI fetches this block
- [property-data-schema.md](../property-intake/property-data-schema.md) — Source of truth for all property fields (the raw input to the transformation)
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Authoritative visibility scope definitions (governs scope filter in Step 1)
- [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md) — Knowledge categories that determine retrieval chunk structure
- [whatsapp-session-anchor.md](whatsapp-session-anchor.md) — Session context object that determines phase, language, and code gating
- [emergency-procedures.md](emergency-procedures.md) — EmergencyData structure merged in Step 6
- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — Partner Brief (the PTR-scoped counterpart to this document)
- [data-models.md](../backend/data-models.md) — Backend `PropertyKnowledgeBlock` model definition
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Voice and tone for AI responses
