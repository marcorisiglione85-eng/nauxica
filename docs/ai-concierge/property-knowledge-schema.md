# Property Knowledge Schema

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** AI concierge · Sicily launch · WhatsApp-first model
**Last updated:** 2026-05-28
**Related:** [knowledge-retrieval-model.md](knowledge-retrieval-model.md) · [property-data-schema.md](../property-intake/property-data-schema.md) · [property-knowledge-base-template.md](../property-intake/property-knowledge-base-template.md) · [data-models.md](../backend/data-models.md)

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

## Visibility Key

| Level | Symbol | Delivered to AI |
|---|---|---|
| Public | `PUB` | Yes — also visible pre-booking |
| Guest-only | `GST` | Yes — only for confirmed guests |
| Internal | `INT` | **Never** |

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

## Schema Versioning

| Version | Date | Changes |
|---|---|---|
| `1.0` | 2026-05-28 | Initial schema — Sicily launch scope |

When a new field is added: increment the minor version (e.g. `1.1`). When field structure changes in a breaking way: increment the major version (e.g. `2.0`) and maintain backward compatibility for at least one version cycle.

---

## Related Documents

- [knowledge-retrieval-model.md](knowledge-retrieval-model.md) — How the AI fetches this block
- [property-data-schema.md](../property-intake/property-data-schema.md) — Source of truth for all property fields
- [property-knowledge-base-template.md](../property-intake/property-knowledge-base-template.md) — Human-authored content that populates this schema
- [data-models.md](../backend/data-models.md) — Backend `PropertyKnowledgeBlock` model
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Voice and tone for AI responses
