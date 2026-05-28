# Property Knowledge Schema

**Version:** 1.1
**Status:** Draft — Architecture phase
**Scope:** AI concierge · Sicily launch · WhatsApp-first model
**Last updated:** 2026-05-28
**Related:** [knowledge-retrieval-model.md](knowledge-retrieval-model.md) · [property-data-schema.md](../property-intake/property-data-schema.md) · [data-models.md](../backend/data-models.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [ai-knowledge-taxonomy.md](ai-knowledge-taxonomy.md) · [whatsapp-session-anchor.md](whatsapp-session-anchor.md)

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

## Access Code Gating Rules

Access credentials (lockbox code, smart lock code, gate code, parking code) are `GST`-scoped
and pass the scope filter, but they carry an additional delivery gate. The gate determines
whether the actual value or a sentinel placeholder is included in the PropertyKnowledgeBlock.

### Gate conditions

| Credential field | Gate open when | Sentinel when gate is closed |
|---|---|---|
| `key_box_code` | `session_phase` IN (`check_in`, `in_stay`) OR (`pre_arrival` AND `checkin_date = today`) | `"[not yet available]"` |
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
future implementation), the gate opens 24 hours before `checkin_date` instead of on the
day. This is a homeowner-controlled setting with a default of `false`.

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
