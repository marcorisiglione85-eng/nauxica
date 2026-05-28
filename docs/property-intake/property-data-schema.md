# Property Data Schema

**Version:** 1.1
**Status:** Draft — Architecture phase
**Scope:** Sicily launch
**Last updated:** 2026-05-28
**Related:** [property-intake-checklist.md](property-intake-checklist.md) · [property-knowledge-base-template.md](property-knowledge-base-template.md) · [data-models.md](../backend/data-models.md) · [data-visibility-model.md](../architecture/data-visibility-model.md)

---

## Purpose

This document defines the complete field schema for property records on the Nauxica platform. It is the authoritative reference for:

- Frontend form design (what fields to collect at onboarding)
- Backend data model implementation (what to store and how)
- AI concierge integration (what the AI may and may not access)
- Partner execution (what cleaners, maintenance, and service partners receive)
- API design (what endpoints expose)

---

## Visibility Levels

Every field carries one of four visibility levels. These levels must be enforced at the API layer — the AI concierge receives only a scope-filtered projection, never the raw record.

Full visibility rules, actor definitions, and AI safety boundaries are defined in [Data Visibility Model](../architecture/data-visibility-model.md). That document is the authoritative reference; the table below is a quick reference.

| Level | Symbol | Who can access | AI Concierge |
|---|---|---|---|
| **Public** | `PUB` | Anyone — pre-booking, unauthenticated, AI concierge, guest-facing pages | Can read and share |
| **Guest-only** | `GST` | Confirmed guest only, post-booking, via WhatsApp concierge | Can read and share with confirmed guests only |
| **Partner** | `PTR` | Assigned service partners (cleaner, maintenance, etc.) and homeowner | Can read to dispatch partners — must NOT share content with guests |
| **Internal** | `INT` | Homeowner account and Nauxica platform staff only | Cannot read or use |

**Default:** Any field without an explicit visibility tag is treated as `INT`.

---

## Property Lifecycle States

A property moves through a defined lifecycle. State controls AI concierge activation and data completeness enforcement.

| State | Description | AI Active | Notes |
|---|---|---|---|
| `draft` | Owner started setup. Incomplete data permitted. | No | |
| `onboarding` | Owner submitted for review. Nauxica is completing the record. | No | All required fields must be present at this transition. |
| `pending_activation` | Nauxica review complete. Awaiting owner confirmation. | No | |
| `active` | Fully operational. AI concierge enabled. | **Yes** | Emergency data must be complete before activation is permitted. |
| `suspended` | Temporarily deactivated. | No | Operator action or automated compliance trigger. |
| `archived` | Permanently removed from active service. | No | Data retained per retention policy. Operator action only. |

**Activation gate:** A property cannot reach `active` state unless all fields marked **Required for Activation** are populated. See the [Activation Blocking Fields](#activation-blocking-fields) section.

**Suspension:** Moving a property from `active` to `suspended` immediately disables the AI concierge for all future sessions. In-progress WhatsApp sessions are handed to a human operator.

---

## Category A — Identity

Core identifiers and platform status. All internal.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `property_id` | string (slug) | `INT` | Yes | Used as retrieval key for knowledge block | Unique, immutable after creation. Format: `kebab-case`, e.g. `villa-mare` |
| `display_name` | string | `PUB` | Yes | Referenced in guest conversations | Max 60 characters |
| `internal_reference` | string | `INT` | Optional | None | Owner's own reference code, e.g. booking.com listing ID |
| `platform_status` | enum | `INT` | Yes | None | Values: `pending` / `active` / `suspended` / `archived` |
| `owner_id` | reference → User | `INT` | Yes | None | Foreign key to homeowner User record |
| `nauxica_plan_tier` | enum | `INT` | Yes | None | Values: `starter` / `professional` / `premium` |
| `created_at` | datetime (ISO 8601) | `INT` | Yes (auto) | None | Set on record creation |
| `updated_at` | datetime (ISO 8601) | `INT` | Yes (auto) | None | Updated on any field change |
| `activated_at` | datetime (ISO 8601) | `INT` | Conditional | None | Set when `platform_status` changes to `active` |

---

## Category B — Location

Property address and geographic context.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `address_street` | string | `GST` | Yes | Provided to guest on check-in | Full street name and number |
| `address_locality` | string | `PUB` | Yes | Referenced in area descriptions | Neighbourhood or district, e.g. "Ognina" |
| `address_municipality` | string | `PUB` | Yes | Referenced in area descriptions | City/town, e.g. "Catania" |
| `address_province` | string | `PUB` | Yes | None | Sicilian province code, e.g. "CT" |
| `address_postcode` | string | `INT` | Yes | None | Italian CAP, e.g. "95126" |
| `coordinates_lat` | decimal | `PUB` | Recommended | None | WGS 84, 6 decimal places |
| `coordinates_lng` | decimal | `PUB` | Recommended | None | WGS 84, 6 decimal places |
| `area_description` | text | `PUB` | Recommended | Used in guest orientation messages | 2–4 sentences, written as guest-facing prose |
| `nearest_airport` | string | `PUB` | Recommended | Provided for transfer and arrival questions | e.g. "Catania Fontanarossa (CTA), 15 min by car" |
| `nearest_port` | string | `PUB` | Optional | Provided for transfer and arrival questions | e.g. "Catania Port, 10 min by car" |
| `distance_to_beach` | string | `PUB` | Optional | Mentioned in local orientation | Free text, e.g. "8 min walk to Lido Azzurro" |
| `distance_to_centre` | string | `PUB` | Optional | Mentioned in local orientation | Free text, e.g. "12 min by bus" |

---

## Category C — Configuration

Physical property attributes and amenities.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `property_type` | enum | `PUB` | Yes | Referenced in property description | Values: `villa` / `apartment` / `house` / `penthouse` / `cottage` |
| `max_guests` | integer | `PUB` | Yes | Cited when guest asks about capacity | Hard limit for bookings |
| `bedrooms` | integer | `PUB` | Yes | Cited in descriptions | |
| `bathrooms` | integer | `PUB` | Yes | Cited in descriptions | |
| `beds_configuration` | text | `PUB` | Yes | Cited when asked about sleeping arrangements | e.g. "1 king bed, 2 single beds, 1 sofa bed" |
| `floor_level` | string | `PUB` | Recommended | Useful for arrival orientation | e.g. "3rd floor" |
| `has_elevator` | boolean | `PUB` | Recommended | Important for accessibility questions | |
| `has_pool` | boolean | `PUB` | Recommended | Cited in amenity summaries | |
| `pool_notes` | text | `PUB` | Conditional | Cited when pool asked about | Required if `has_pool` is true. e.g. hours, shared/private |
| `has_parking` | boolean | `PUB` | Recommended | Cited in arrival guidance | |
| `parking_notes` | text | `GST` | Conditional | Provided with arrival instructions | Required if `has_parking` is true. Location, access code |
| `has_air_conditioning` | boolean | `PUB` | Recommended | Cited in amenity summaries | |
| `has_washing_machine` | boolean | `PUB` | Recommended | Cited in amenity summaries | |
| `has_dishwasher` | boolean | `PUB` | Optional | Cited if asked | |
| `has_bbq` | boolean | `PUB` | Optional | Cited if asked | |
| `has_balcony_or_terrace` | boolean | `PUB` | Optional | Cited in descriptions | |
| `amenities_list` | array of strings | `PUB` | Recommended | Used to answer "what does the property have?" | Free-text list, e.g. `["espresso machine", "beach towels", "highchair"]` |
| `accessibility_notes` | text | `PUB` | Optional | Provided if guest asks about accessibility | e.g. "No step-free access. 14 stairs to entrance." |

---

## Category D — Access & Check-in

Entry instructions and access credentials. Guest-only fields are among the most sensitive in the schema.

> **Legal review required:** Access codes and entry credentials constitute personal-safety-relevant data. Confirm appropriate data retention periods and access logging requirements with legal counsel before implementation.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `checkin_time_from` | time (HH:MM) | `PUB` | Yes | Cited in pre-arrival messages | 24-hour format |
| `checkin_time_to` | time (HH:MM) | `PUB` | Yes | Cited in pre-arrival messages | 24-hour format |
| `checkout_time` | time (HH:MM) | `PUB` | Yes | Cited in checkout reminders | 24-hour format |
| `early_checkin_available` | boolean | `PUB` | Recommended | Cited if guest asks | |
| `early_checkin_notes` | text | `PUB` | Conditional | Cited if guest asks about early check-in | Required if `early_checkin_available` is true |
| `late_checkout_available` | boolean | `PUB` | Recommended | Cited if guest asks | |
| `late_checkout_notes` | text | `PUB` | Conditional | Cited if guest asks about late checkout | Required if `late_checkout_available` is true |
| `access_method` | enum | `PUB` | Yes | Mentioned in check-in overview | Values: `key-box` / `smart-lock` / `host-handover` / `concierge-desk` |
| `key_box_location` | text | `GST` | Conditional | Delivered as part of entry instructions | Required if `access_method` is `key-box`. Precise prose description. |
| `key_box_code` | string | `GST` | Conditional | Delivered only to confirmed guest, post-booking | Required if `access_method` is `key-box`. **Never returned in any public API response.** |
| `smart_lock_app` | string | `GST` | Conditional | Named when directing guest to app | Required if `access_method` is `smart-lock` |
| `smart_lock_instructions` | text | `GST` | Conditional | Delivered as part of entry instructions | Required if `access_method` is `smart-lock` |
| `host_handover_contact` | string | `GST` | Conditional | Given to guest for host-handover arrivals | Required if `access_method` is `host-handover`. Name and phone. |
| `building_door_code` | string | `GST` | Optional | Delivered as part of entry instructions | **Never returned in public API response.** |
| `parking_access_code` | string | `GST` | Optional | Delivered with arrival instructions | **Never returned in public API response.** |
| `entry_instructions` | text | `GST` | Yes | Core AI delivery — step-by-step arrival guide | Write as numbered steps. Precise, no assumptions. |

---

## Category E — In-Stay Information

Information guests need during their stay.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `wifi_network` | string | `GST` | Yes | Delivered on check-in message | Exact network name |
| `wifi_password` | string | `GST` | Yes | Delivered on check-in message | **Never returned in public API response.** |
| `wifi_backup_notes` | text | `GST` | Optional | Cited if WiFi problems reported | e.g. "Router is in the hallway cupboard — restart if needed" |
| `appliance_guides` | array of objects | `GST` | Recommended | Cited when guest asks about an appliance | Each object: `{appliance: string, instructions: text}` |
| `tv_instructions` | text | `GST` | Recommended | Cited when guest asks about TV | Include streaming services available |
| `heating_instructions` | text | `GST` | Recommended | Cited when guest asks about heating | |
| `cooling_instructions` | text | `GST` | Recommended | Cited when guest asks about AC | |
| `water_heater_instructions` | text | `GST` | Optional | Cited if hot water issues reported | |
| `trash_collection_days` | string | `GST` | Recommended | Cited proactively or when asked | e.g. "Monday and Thursday" |
| `trash_collection_notes` | text | `GST` | Recommended | Delivered with trash instructions | Bin colours, location, what goes where |
| `recycling_instructions` | text | `GST` | Recommended | Delivered with trash instructions | |
| `emergency_contact_name` | string | `GST` | Yes | Given for urgent issues | Owner or designated contact name |
| `emergency_contact_phone` | string | `GST` | Yes | Given for urgent issues | Italian format, e.g. "+39 333 000 0000" |
| `nearest_hospital_name` | string | `GST` | Yes | Given in emergency situations | |
| `nearest_hospital_address` | string | `GST` | Yes | Given in emergency situations | |
| `nearest_pharmacy_name` | string | `GST` | Recommended | Cited when asked | |
| `nearest_pharmacy_address` | string | `GST` | Recommended | Cited when asked | |
| `local_recommendations` | array of objects | `PUB` | Optional | Offered proactively or when guest asks | Each: `{type: string, name: string, description: text, distance: string}` |

---

## Category F — House Rules & Compliance

Guest-facing rules and Sicily-specific regulatory fields.

> **Legal review required:** CIR code, tourist tax collection, and alloggiati web registration are legal obligations under Italian and regional Sicilian law. These fields directly affect owner compliance. Do not treat as optional until legal review confirms scope.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `house_rules` | text | `PUB` | Yes | AI delivers condensed version to guests | Full version for listing; AI uses summarised version from knowledge template |
| `quiet_hours_from` | time (HH:MM) | `PUB` | Recommended | Cited when noise rules asked about | |
| `quiet_hours_to` | time (HH:MM) | `PUB` | Recommended | Cited when noise rules asked about | |
| `smoking_policy` | enum | `PUB` | Yes | Cited when asked | Values: `no-smoking` / `outdoor-only` / `designated-area` |
| `pet_policy` | enum | `PUB` | Yes | Cited when asked | Values: `no-pets` / `pets-allowed` / `pets-on-request` |
| `pet_policy_notes` | text | `PUB` | Conditional | Cited when pet policy asked about | Required if `pet_policy` is not `no-pets` |
| `party_policy` | enum | `PUB` | Yes | Cited if asked | Values: `no-events` / `small-gatherings-ok` |
| `min_stay_nights` | integer | `PUB` | Yes | None (booking-level constraint) | |
| `max_stay_nights` | integer | `PUB` | Optional | None | |
| `cir_code` | string | `PUB` | **Yes** | Not AI-delivered but required on all listings | **Legal review required.** Codice Identificativo Regionale — mandatory under Sicilian regional law. Must appear on listing pages. |
| `tourist_tax_amount_eur` | decimal | `PUB` | **Yes** | Cited when tourist tax asked about | Per person per night. **Legal review required.** Rate varies by municipality. |
| `tourist_tax_max_nights` | integer | `PUB` | Recommended | Cited when tourist tax asked about | Max nights tax is applied. Typically 7 in Sicily. |
| `tourist_tax_exemptions` | text | `PUB` | Recommended | Cited when exemptions asked about | e.g. "Children under 12 years old are exempt." |
| `alloggiati_web_required` | boolean | `INT` | Yes | None | **Legal review required.** Whether owner is obligated to register guests with the police (Polizia di Stato) via Alloggiati Web. |
| `alloggiati_web_registered_by` | enum | `INT` | Conditional | None | Required if `alloggiati_web_required` is true. Values: `owner` / `nauxica-assisted` |

---

## Category G — Commercial & Operations

Owner financial and platform configuration data. **Never accessible by the AI concierge or any guest-facing system.**

> **Legal review required:** Bank account data and financial processing details are subject to PSD2, GDPR data minimisation principles, and Italian banking regulations. Confirm storage, encryption, and access control requirements before implementation.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `owner_bank_iban` | string | `INT` | Conditional | **None — never** | Required if Nauxica processes any payments on owner's behalf. **Encrypted at rest.** |
| `billing_entity_name` | string | `INT` | Yes | None | Legal name for invoicing |
| `codice_fiscale_or_piva` | string | `INT` | Yes | None | Italian tax ID. **Legal review required** — required for tourist tax and compliance reporting. |
| `commission_rate_override` | decimal | `INT` | Optional | None | Overrides platform default for coordinated service jobs |
| `preferred_partner_ids` | array of references | `INT` | Optional | None | Pre-approved partners for this property |
| `maintenance_budget_limit_eur` | decimal | `INT` | Optional | None | Owner-set threshold above which maintenance jobs require approval |
| `internal_notes` | text | `INT` | Optional | None | Nauxica staff notes — never shown to owner or guests |
| `owner_notes` | text | `INT` | Optional | None | Owner's private notes on the property |
| `revenue_share_pct` | decimal | `INT` | Optional | None | For managed properties where Nauxica earns a revenue cut |

---

## Category H — Partner Access & Operational

Data required by assigned service partners to execute their jobs. **None of these fields may be shared with guests by the AI concierge.** See [Partner Assignment Model](../architecture/partner-assignment-model.md).

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `partner_entry_method` | enum | `PTR` | No | None | How partners access the property. Values: `same_as_guest` / `separate_key_safe` / `key_held_by_contact`. Defaults to `same_as_guest`. |
| `partner_key_safe_location` | text | `PTR` | Conditional | None | Required if `partner_entry_method` is `separate_key_safe`. Location of the partner-only key safe. |
| `partner_key_safe_code` | string | `PTR` | Conditional | None | Required if `partner_entry_method` is `separate_key_safe`. **Never expose to guests.** |
| `partner_entry_instructions` | text | `PTR` | Recommended | None | Step-by-step entry for partners. May differ from guest instructions. |
| `key_return_after_job` | text | `PTR` | Recommended | None | Where and how partners should return keys after completing a job. |
| `partner_wifi_password` | string | `PTR` | No | None | If the property uses a separate partner network (rare — most share guest WiFi). |
| `cleaning_inventory_notes` | text | `PTR` | Recommended | None | Location of cleaning supplies, mop, spare linen, bin bags, etc. |
| `linen_changeover_notes` | text | `PTR` | Recommended | None | Where clean linen is stored. Where used linen goes. Laundry instructions. |
| `property_quirks_for_partners` | text | `PTR` | Optional | None | Internal operational notes for partners: sticky locks, temperamental appliances, neighbour sensitivities, etc. |
| `maintenance_priority_items` | text | `PTR` | Optional | None | Recurring issues the maintenance partner should watch. |
| `partner_contact_on_arrival_name` | string | `PTR` | No | None | If a local contact must be present when a partner arrives. |
| `partner_contact_on_arrival_phone` | string | `PTR` | No | None | |
| `approved_partner_ids` | array of UUIDs | `INT` | No | None | Pre-approved partner account IDs for this property. Stored here as a reference; full detail in the [Partner Assignment Model](../architecture/partner-assignment-model.md). |

---

## Category I — Utility Controls & Emergency Infrastructure

Required for activation. Used by the AI concierge in emergency situations to direct guests to safety controls.
See [Emergency Procedures](../ai-concierge/emergency-procedures.md) for the full emergency data structure and retrieval rules.

| Field | Type | Visibility | Required | AI Usage | Notes |
|---|---|---|---|---|---|
| `gas_shutoff_location` | text | `GST` | **Yes** | Delivered immediately in gas emergency | Precise description — e.g. "Yellow lever on the left side of the external meter box, at ground level." |
| `water_shutoff_location` | text | `GST` | **Yes** | Delivered in flood/leak emergency | |
| `electricity_shutoff_location` | text | `GST` | **Yes** | Delivered in power or electrical emergency | Circuit breaker / fuse box location and how to trip it. |
| `boiler_location` | text | `GST` | No | Delivered if hot water issues | |
| `boiler_reset_instructions` | text | `GST` | No | Delivered if hot water or heating fails | |
| `fire_extinguisher_present` | boolean | `GST` | Recommended | Cited in fire emergency response | |
| `fire_extinguisher_location` | text | `GST` | Conditional | Delivered in fire emergency | Required if `fire_extinguisher_present` is true. |
| `fire_blanket_location` | text | `GST` | No | Delivered in fire emergency | |
| `smoke_detector_present` | boolean | `GST` | Recommended | Cited if asked about safety | |
| `carbon_monoxide_detector_present` | boolean | `GST` | Recommended | Cited if gas smell or CO concern | |
| `first_aid_kit_location` | text | `GST` | Recommended | Delivered in medical emergency | |
| `water_type` | enum | `GST` | No | Cited if water quality asked about | Values: `mains` / `tank` / `well` |
| `water_tank_refill_notes` | text | `GST` | Conditional | Delivered if water runs out | Required if `water_type` is `tank`. |
| `emergency_data_ref` | UUID | `INT` | **Yes** | Used to load the emergency object | Foreign key to the property's EmergencyData record. See [Emergency Procedures](../ai-concierge/emergency-procedures.md). |

---

## Category J — Dynamic Instructions

Homeowners can add temporary override instructions that the AI concierge uses preferentially over the base record. This allows real-time updates without editing permanent fields.

| Field | Type | Visibility | Notes |
|---|---|---|---|
| `dynamic_instructions` | array of DynamicInstruction | inherits from `scope` | See object definition below. |

**DynamicInstruction object:**

| Sub-field | Type | Notes |
|---|---|---|
| `instruction_id` | UUID | System-generated. |
| `target_field` | string | The field this overrides, using dot notation (e.g. `pool_notes`). Use `"freetext"` for additions that don't override a specific field. |
| `override_text` | multilang text | The replacement or additional text, in all available languages. |
| `active_from` | date | ISO 8601. Inclusive. |
| `active_until` | date | ISO 8601. Inclusive. After this date the instruction is ignored but not deleted. |
| `scope` | enum | `"guest"` or `"partner"`. Inherits base field scope. Cannot be elevated to a wider scope than the field it overrides. |
| `created_by_owner_id` | UUID | Owner who created this instruction. |
| `priority` | integer | If multiple overrides target the same field, highest priority wins. |

**Example — pool closed for maintenance:**
```json
{
  "target_field": "pool_notes",
  "override_text": {
    "en": "The pool is currently closed for maintenance until 7 June. We apologise for the inconvenience.",
    "it": "La piscina è chiusa per manutenzione fino al 7 giugno. Ci scusiamo per il disagio."
  },
  "active_from": "2025-06-01",
  "active_until": "2025-06-07",
  "scope": "guest",
  "priority": 10
}
```

**AI behaviour:** Before loading any field into the guest context window, the system checks for an active dynamic instruction targeting that field. If found, the override text replaces the base field value. The original field value is preserved in the database.

---

## Multi-Language Readiness

All fields marked `(multilang)` or categorised as `text` in GUEST or PARTNER scope should be stored as language-keyed objects at the backend level.

**Required languages at Sicily launch:** `en` (English), `it` (Italian).
**Planned languages:** `de` (German), `fr` (French). Nullable at launch.

**Storage format:**
```json
{
  "en": "The lockbox is on the wall to the right of the front door.",
  "it": "La cassetta delle chiavi è sul muro a destra della porta d'ingresso.",
  "de": null,
  "fr": null
}
```

**AI fallback chain:** If the guest's detected language is not available for a field: `guest_language → en → it → null`.
If all are null: the AI must not invent the content. It acknowledges the gap and escalates to the homeowner or operator.

**Translation ownership:** Translations must be homeowner-approved. The AI concierge must not auto-translate stored content into languages not provided by the homeowner.

---

## Activation Blocking Fields

A property cannot be moved from `pending_activation` to `active` unless all of the following fields are non-null and non-empty.

**Identity:** `display_name`, `property_type`, `owner_id`, `platform_status`
**Location:** `address_municipality`, `address_province`, `coordinates_lat`, `coordinates_lng`
**Capacity:** `max_guests`, `bedrooms`, `bathrooms`, `beds_configuration`
**Access:** `access_method` + all fields required by that `access_method` value
**In-Stay:** `wifi_network`, `wifi_password`, `emergency_contact_name`, `emergency_contact_phone`, `nearest_hospital_name`, `nearest_hospital_address`
**Utility Controls:** `gas_shutoff_location`, `water_shutoff_location`, `electricity_shutoff_location`
**Rules:** `checkin_time_from`, `checkin_time_to`, `checkout_time`, `smoking_policy`, `pet_policy`, `party_policy`, `house_rules`
**Instructions:** `entry_instructions`
**Emergency record:** `emergency_data_ref` must point to a complete EmergencyData record
**Compliance:** `cir_code`, `alloggiati_web_required`

---

## Schema Versioning

This schema uses a `schema_version` field on each property record to enable forward-compatible migrations.

| Version | Date | Notes |
|---|---|---|
| `1.0` | 2026-05-28 | Initial architecture schema — Sicily launch scope |
| `1.1` | 2026-05-28 | Added PARTNER visibility scope; lifecycle states; Category H (partner access); Category I (utility controls); Category J (dynamic instructions); multi-language readiness; activation blocking fields; references to data-visibility-model.md |

When fields are added, removed, or renamed: increment the version, update this document, and update [data-models.md](../backend/data-models.md).

---

## Related Documents

- [property-intake-checklist.md](property-intake-checklist.md) — Operational checklist for collecting these fields
- [property-knowledge-base-template.md](property-knowledge-base-template.md) — AI-ready content template (subset of this schema)
- [data-models.md](../backend/data-models.md) — Backend model definitions
- [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) — AI knowledge block structure
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Authoritative visibility scope definitions
- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — Partner assignment structure
- [emergency-procedures.md](../ai-concierge/emergency-procedures.md) — Emergency data structure and AI retrieval rules
- [ai-knowledge-taxonomy.md](../ai-concierge/ai-knowledge-taxonomy.md) — How property fields map to AI retrieval categories
