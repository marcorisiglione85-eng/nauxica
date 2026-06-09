# Data Models

**Version:** 1.7
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — pre-backend implementation reference
**Last updated:** 2026-06-09
**Related:** [property-data-schema.md](../property-intake/property-data-schema.md) · [api-overview.md](../api/api-overview.md) · [localStorage-to-backend-migration.md](localStorage-to-backend-migration.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [auth-strategy.md](auth-strategy.md)

> **v1.7 changes (2026-06-09):** Sprint 010A Documentation Alignment. DM-1: `reservation_value_amount` and `reservation_value_currency` added to Model 4 (Reservation) — from migration 007. DM-2: `reservation_id`, `task_value_amount`, and `task_value_currency` added to Model 10 (Task) — from migrations 002 and 006. DM-3: `task_type` enum corrected to live values (`cleaning`, `maintenance`, `inspection`, `laundry`, `guest_request`, `other`); `priority` enum corrected (`important` → `high`); `status` enum corrected to live values (`open`, `assigned`, `accepted`, `in_progress`, `completed`, `cancelled`). DM-4: New Model 14 (CommissionRules) added — from migration 009; commission applies only between Nauxica and partner; homeowner-facing pages must never reference this model.

> **v1.6 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-1: `codice_fiscale_or_piva` in Model 1 (User) changed from Required to Optional — nullable at registration; collected during onboarding/account verification; no placeholder value. CB-NEW-2: `plan_started_at` and `plan_renews_at` in Model 1 changed from Required to Optional — nullable at MVP until Stripe billing module is implemented; not client-provided. CB-NEW-3: `property_code` in Model 2 (Property) notes extended with server-side generation strategy. CB-NEW-4: `confirmation_number` in Model 4 (Reservation) notes extended with server-side generation strategy.

> **v1.5 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-A: `password_hash` removed from Model 1 (User) — Supabase Auth (GoTrue) manages password storage in `auth.users`; `public.users` is the application profile table only (source: auth-strategy.md §9.1). CB-C: `guest_nationality` made nullable (Optional) in Model 4 (Reservation) — Add Guest wizard does not collect nationality at MVP; Alloggiati Web compliance deferred to a later module.

> **v1.4 changes (2026-06-05):** Property identity model realigned with implemented frontend. `property_id` text slug removed as FK anchor and as a field on the Property model. `property_code` (NAU-XXXXX format) added to Property model as immutable human-readable reference — never used as a foreign key. All child model `property_id` fields updated from `string → Property` to `uuid → Property.id`, reflecting UUID FK anchor on `properties.id`.

> **v1.3 changes (2026-06-05):** ServiceRequest urgency and status enums updated to approved operational values (supersedes earlier draft values). ServiceRequest routing FK model aligned with database-schema.md dual-FK resolution. Property platform_status lifecycle extended with draft/onboarding/pending_activation states. availability_status field added to Property model. User model clarified: two public account types (homeowner, partner) only; operator and ai_runtime are not public account types. EscalationRecord operator FK noted as post-MVP internal field.

---

## Purpose

This document defines the logical data models for the Nauxica backend — what entities exist, what fields they carry, how they relate to each other, and which fields are AI-accessible. It is the authoritative reference for backend implementation, API design, and database schema work.

This is an architecture document, not code. Field names use `snake_case`. Types describe intent, not specific database column types.

---

## Visibility Key

Visibility scopes align with the [Data Visibility Model](../architecture/data-visibility-model.md), which is the authoritative reference. This table is a quick summary.

| Symbol | Meaning |
|---|---|
| `PUB` | Public — accessible pre-authentication, AI concierge may share with guests |
| `GST` | Guest-only — confirmed guest, post-booking, via WhatsApp concierge |
| `PTR` | Partner-only — assigned service partners (cleaners, maintenance, etc.). AI may read to dispatch partners but must never share with guests. |
| `INT` | Internal — homeowner (own data) and Nauxica staff only. AI cannot read. |

**Note on AI visibility:** `AI` is not a visibility scope. Whether a field is accessible to the AI concierge is determined by the `PropertyKnowledgeBlock` construction pipeline (KBB), which filters fields by scope. Fields marked `PUB` or `GST` are eligible for inclusion in the knowledge block; `PTR` and `INT` fields are not. See [data-visibility-model.md](../architecture/data-visibility-model.md) for the authoritative scope taxonomy.

**Note on OPERATOR scope:** An `OPERATOR` scope appeared in an earlier version of `data-visibility-model.md`. It has been removed. Data formerly described as `OPERATOR`-scoped is `INT`-scoped; access control for Nauxica staff is enforced by RBAC, not by a separate scope.

---

## Model Overview

| Model | Description | Primary actor(s) |
|---|---|---|
| `User` | Homeowner or partner account | Homeowner, Partner |
| `Property` | A managed rental property | Homeowner |
| `PropertyKnowledgeBlock` | AI-ready content layer for a property | AI concierge, Nauxica staff |
| `Reservation` | A guest stay linked to a property (replaces Booking) | Homeowner, Guest (no account) |
| `GuestStayContext` | Operational check-in/check-out data for a specific stay | AI concierge, Homeowner |
| `WhatsAppSession` | Active WhatsApp conversation bound to a reservation | AI concierge |
| `EmergencyData` | Property-level emergency contacts and procedures | AI concierge, Operator |
| `EscalationRecord` | Human takeover state for an AI conversation | Operator |
| `PartnerAssignment` | A partner assigned to a property for a service type | Homeowner, Partner |
| `ServiceRequest` | A guest-initiated or AI-triggered service request | AI concierge, Partner, Homeowner |
| `Task` | An operational to-do item on a property | Homeowner |
| `PartnerRequest` | A service job request from homeowner to partner | Homeowner, Partner |
| `Message` | An in-platform message between platform users | Homeowner, Partner |
| `Review` | A post-stay or post-job rating and comment | Homeowner, Partner, Guest |
| `CommissionRules` | Platform commission rate table (Nauxica ↔ Partner only) | Nauxica (internal) |

**Note on Booking vs Reservation:** The former `Booking` model has been renamed `Reservation` and expanded to include full guest stay operational data. The term "Booking" referred to the commercial act; "Reservation" reflects the full stay lifecycle including check-in, check-out, and AI session context.

---

## Model 1 — User

Represents a homeowner or service partner account. There are two public account types: `homeowner` and `partner`. No other public account types exist at MVP.

- **Guests** have no User accounts. Guest identity is anchored to the `Reservation` record via `guest_phone`. See Model 4 and [auth-strategy.md](auth-strategy.md) §5.
- **AI runtime** is a service role operating via API key — it is not a User account. See [auth-strategy.md](auth-strategy.md) §6.
- **Internal Nauxica administration** is outside the public account model at MVP. No `operator` account_type exists. See [auth-strategy.md](auth-strategy.md) §7.

| Field | Type | Visibility | Required | Notes |
|---|---|---|---|---|
| `id` | uuid | `INT` | Yes (auto) | Primary key |
| `email` | string | `INT` | Yes | Unique. Used for login and notifications. |
| `account_type` | enum | `INT` | Yes | Values: `homeowner` / `partner`. These are the only public account types at MVP. No `operator` or `guest` value exists. Operator-related FK fields in other models (e.g. `escalation_records.assigned_operator_id`) are internal post-MVP fields — see [auth-strategy.md](auth-strategy.md) §7. |
| `full_name` | string | `INT` | Yes | Legal name |
| `display_name` | string | `PUB` | Recommended | Shown on reviews and partner listings |
| `phone_number` | string | `INT` | Yes | Italian format (+39...). Verified on registration. |
| `codice_fiscale_or_piva` | string | `INT` | No | ⚠️ **Legal review required** — tax ID, encrypted at rest. Nullable at registration — collected during onboarding/account verification. Must not be inserted as a placeholder. |
| `business_type` | enum | `INT` | Conditional | Required for partners. Values: `individual` / `sole-trader` / `company` |
| `profile_photo_url` | string | `PUB` | Optional | CDN URL |
| `is_email_verified` | boolean | `INT` | Yes | Set on email confirmation |
| `is_phone_verified` | boolean | `INT` | Yes | Set on SMS confirmation |
| `is_identity_verified` | boolean | `INT` | Yes | Set after ID document review (partners) |
| `nauxica_plan_tier` | enum | `INT` | Yes | Values: `starter` / `professional` / `premium` |
| `plan_started_at` | datetime | `INT` | No | Nullable at MVP — managed by Stripe billing module. Not sent by client; server-generated when subscription activates. |
| `plan_renews_at` | datetime | `INT` | No | Nullable at MVP — managed by Stripe billing module. Not sent by client; server-generated when subscription activates. |
| `account_status` | enum | `INT` | Yes | Values: `pending` / `active` / `suspended` / `closed` |
| `preferred_language` | string | `INT` | Recommended | ISO 639-1 code, e.g. `it`, `en` |
| `created_at` | datetime | `INT` | Yes (auto) | |
| `updated_at` | datetime | `INT` | Yes (auto) | |

**Partner-specific fields** (only present when `account_type` is `partner`):

| Field | Type | Visibility | Required | Notes |
|---|---|---|---|---|
| `partner_service_types` | array of enum | `PUB` | Yes | Values: `cleaning` / `maintenance` / `transfers` / `experiences` / `laundry` |
| `operating_areas` | array of strings | `PUB` | Yes | Municipalities or provinces covered |
| `average_rating` | decimal | `PUB` | Computed | Derived from Review records |
| `total_jobs_completed` | integer | `PUB` | Computed | |
| `insurance_document_url` | string | `INT` | Conditional | Required for maintenance partners |
| `id_document_url` | string | `INT` | Yes | Uploaded during vetting. Not exposed via API. |
| `background_check_status` | enum | `INT` | Yes | Values: `not-started` / `submitted` / `approved` / `rejected` |
| `is_accepting_jobs` | boolean | `PUB` | Yes | Toggled by partner for availability |

---

## Model 2 — Property

The central model. Full field specification in [property-data-schema.md](../property-intake/property-data-schema.md). This model summarises structural relationships and key constraints.

| Field | Type | Visibility | Required | Notes |
|---|---|---|---|---|
| `id` | uuid | `INT` | Yes (auto) | Primary key. UUID FK anchor for all child records. |
| `property_code` | text | `INT` | Yes | Immutable human-readable reference, format `NAU-XXXXX`. Generated server-side at property creation using a PostgreSQL sequence or equivalent atomic database-side counter. Unique, never reused, never client-generated in production. Frontend localStorage generation (wizard prototype) is prototype-only. Used for display, support, search, and communications. Never used as a foreign key. |
| `owner_id` | uuid → User | `INT` | Yes | Foreign key |
| `schema_version` | string | `INT` | Yes | For migration compatibility, e.g. `1.0` |
| `platform_status` | enum | `INT` | Yes | Values: `draft` / `onboarding` / `pending_activation` / `active` / `suspended` / `archived`. See lifecycle transitions below. |
| `availability_status` | enum | `INT` | Conditional | Values: `available` / `unavailable` / `maintenance`. Controls booking availability for active properties. Only meaningful when `platform_status = 'active'`. Default: `available` when property first transitions to `active`. Set by homeowner. See availability model below. |
| `nauxica_plan_tier` | enum | `INT` | Yes | Inherited from owner User at creation; can be overridden |
| `created_at` | datetime | `INT` | Yes (auto) | |
| `activated_at` | datetime | `INT` | Conditional | Set when status transitions to `active` |
| `updated_at` | datetime | `INT` | Yes (auto) | |
| `…all fields from property-data-schema.md` | various | various | various | See full schema reference |

**Relationships:**
- A `User` (homeowner) has zero or many `Property` records
- A `Property` has exactly one `PropertyKnowledgeBlock`
- A `Property` has zero or many `Reservation` records
- A `Property` has zero or many `Task` records
- A `Property` has zero or many `PartnerRequest` records
- A `Property` has zero or many `Review` records (from guests)

**Property lifecycle — `platform_status` transitions:**

| From | To | Trigger |
|---|---|---|
| *(new)* | `draft` | Property record created by homeowner |
| `draft` | `onboarding` | Homeowner begins the activation checklist (minimum identifier fields present) |
| `onboarding` | `pending_activation` | Homeowner submits for Nauxica review; Category A blockers must all pass before submission is permitted |
| `pending_activation` | `active` | Nauxica review passes all required categories; `activated_at` is set |
| `pending_activation` | `onboarding` | Nauxica review fails; property returned to homeowner with blocking items identified |
| `active` | `suspended` | Operator action — compliance, quality, or safety issue; full Category D re-check required before reinstatement |
| `active` | `archived` | Homeowner closure request or operator-initiated permanent deactivation; terminal state |
| `suspended` | `active` | Suspension resolved; operator lifts suspension after issue confirmed resolved |
| any state | `archived` | Terminal — no further transitions. Data retained per retention schedule. |

**Property availability model — `availability_status`:**

`availability_status` is independent of `platform_status`. It controls whether an active property accepts new reservations. It is only meaningful when `platform_status = 'active'`.

| Value | Meaning | Who sets |
|---|---|---|
| `available` | Property accepts new reservations. Default on activation. | Homeowner |
| `unavailable` | Owner has paused new bookings (renovation, personal use, etc.). Active stays proceed unaffected. | Homeowner |
| `maintenance` | Property blocked for a maintenance window. No new reservations; active stays continue. | Homeowner or operator |

- When `platform_status != 'active'`, `availability_status` is ignored by the reservation engine regardless of its value.
- When `platform_status = 'suspended'`, the suspension overrides availability — no new reservations are accepted even if `availability_status = 'available'`.
- `availability_status` is not reset when `platform_status` changes — it retains its value and takes effect when the property returns to `active`.

---

## Model 3 — PropertyKnowledgeBlock

The AI-ready content layer for a property. A curated, guest-safe subset of the full Property record, written in prose for AI consumption. Stored separately from the Property model to allow independent versioning and update cycles.

Full schema: [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md)

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | Primary key |
| `property_id` | uuid → Property.id | `INT` | No | Yes | Foreign key. |
| `schema_version` | string | `INT` | No | Yes | Knowledge block version |
| `is_complete` | boolean | `INT` | No | Yes | Set to true after quality review |
| `last_reviewed_at` | datetime | `INT` | No | Recommended | Date Nauxica staff last verified accuracy |
| `…all fields from property-knowledge-schema.md` | various | `GST` or `PUB` | Yes | various | See full schema reference |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |

**Relationships:**
- One `Property` has exactly one `PropertyKnowledgeBlock`
- The `PropertyKnowledgeBlock` is the only model the AI concierge reads from — it never queries the `Property` model directly

---

## Model 4 — Reservation

Represents a confirmed guest stay linked to a property. Guests do not have User accounts — guest identity is captured on the reservation record only. This is the primary anchor for the AI concierge session context.

**Terminology note — Guest vs Reservation:** The frontend uses the term "Guests" in operational views (guest list, guest detail pages). The canonical backend entity is `Reservation`. Guest-labelled UI views are operational views of `Reservation` records. The guest is not a separate model — they are represented by the fields `guest_name`, `guest_phone`, and related fields on this record. Backend code, API responses, and all data models use `Reservation` terminology.

> ⚠️ **Legal review required:** Guest personal data (name, phone, nationality, document number) is subject to GDPR and Alloggiati Web reporting obligations. Confirm data retention period, deletion schedule, and encryption requirements before implementation.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | Primary key |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `confirmation_number` | string | `GST` | Yes | Yes | Human-readable reference, format `NX-YYYY-NNNNN`. Auto-generated server-side using a PostgreSQL sequence if not provided by client. Unique, immutable, never reused. Shared with guest on booking. |
| `guest_name` | string | `GST` | Yes | Yes | Full name of lead guest. Used by AI to personalise messages. |
| `guest_phone` | string | `INT` | Yes | Yes | WhatsApp-registered phone number. The primary AI session anchor — used to resolve guest identity. **Normalised to E.164 format.** |
| `guest_phone_verified` | boolean | `INT` | No | Yes | Set to true when number confirmed as active WhatsApp contact. |
| `guest_email` | string | `INT` | No | No | For booking confirmation only. |
| `guest_preferred_language` | string | `GST` | Yes | Recommended | ISO 639-1 code detected or collected at booking. Used by AI concierge for language selection. Default: `en`. |
| `guest_nationality` | string | `INT` | No | No | ISO 3166-1 alpha-2. Nullable at MVP — Alloggiati Web compliance deferred to a later module. |
| `guest_document_type` | enum | `INT` | No | Conditional | ⚠️ Required for Alloggiati Web. Values: `passport` / `id-card` / `driving-licence` |
| `guest_document_number` | string | `INT` | No | Conditional | ⚠️ Required for Alloggiati Web. **Encrypted at rest.** |
| `guest_count` | integer | `GST` | Yes | Yes | Total number of guests in party. AI uses this for capacity and rule checks. |
| `guest_count_adults` | integer | `INT` | No | Recommended | For tourist tax calculation. |
| `guest_count_children_under_12` | integer | `INT` | No | Recommended | For tourist tax exemption calculation. |
| `checkin_date` | date | `GST` | Yes | Yes | ISO 8601. Used by AI to determine pre-arrival vs in-stay vs post-stay context. |
| `checkout_date` | date | `GST` | Yes | Yes | ISO 8601. |
| `nights` | integer | `INT` | No | Yes (computed) | `checkout_date` - `checkin_date`. |
| `tourist_tax_total_eur` | decimal | `INT` | No | Computed | Based on adults × nights × rate (capped at municipality max nights). |
| `tourist_tax_collected` | boolean | `INT` | No | Yes | Marked true when owner confirms collection. |
| `alloggiati_registered` | boolean | `INT` | No | Conditional | ⚠️ Required tracking field if property has Alloggiati Web obligation. |
| `booking_source` | enum | `INT` | No | Recommended | Values: `direct` / `airbnb` / `booking-com` / `vrbo` / `other` |
| `special_requests` | text | `GST` | Yes | Optional | Guest notes at booking time. AI uses this for personalisation. |
| `internal_notes` | text | `INT` | No | Optional | Homeowner/operator notes. AI cannot read. |
| `reservation_value_amount` | decimal | `INT` | No | Optional | Gross reservation value as entered by homeowner. Used for Financial Summary margin calculation (guest-detail view). Never exposed to guests or partners. Added: migration 007. |
| `reservation_value_currency` | string | `INT` | No | Optional | ISO 4217 currency code. Default: `EUR`. Must match `task_value_currency` on linked tasks for margin calculations to be valid — currency mismatch is flagged at the application layer. Added: migration 007. |
| `reservation_status` | enum | `INT` | No | Yes | Values: `confirmed` / `pre_arrival` / `checked_in` / `checked_out` / `cancelled` / `no_show` |
| `checkin_completed_at` | datetime | `INT` | No | Conditional | Set when check-in is confirmed. |
| `checkout_completed_at` | datetime | `INT` | No | Conditional | Set when checkout is confirmed. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |

**Reservation status transitions:**
- `confirmed → pre_arrival`: Automated — set when today = `checkin_date` minus 48 hours.
- `pre_arrival → checked_in`: Set by homeowner or triggered when lockbox code is first delivered.
- `checked_in → checked_out`: Set by homeowner or automated on `checkout_date + 1`.
- Any state `→ cancelled`: Homeowner or operator action.

**Relationships:**
- A `Property` has zero or many `Reservation` records. Overlapping dates must be blocked at the API layer.
- A `Reservation` has exactly one `GuestStayContext` (created at check-in time).
- A `Reservation` has zero or one active `WhatsAppSession`.
- A `Reservation` may have zero or many `Review` records.

---

## Model 4b — GuestStayContext

Operational check-in and check-out data for a specific stay. Created when a reservation moves to `checked-in` status. Keeps transient stay data separate from the permanent reservation record.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `reservation_id` | uuid → Reservation | `INT` | No | Yes | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | Denormalised for fast lookup. |
| `access_code_delivered` | boolean | `INT` | No | Yes | True when lockbox/smart lock code has been sent to the guest. |
| `access_code_delivered_at` | datetime | `INT` | No | Conditional | |
| `welcome_message_sent` | boolean | `INT` | No | Yes | True when the AI welcome message was sent on arrival day. |
| `welcome_message_sent_at` | datetime | `INT` | No | Conditional | |
| `checkin_confirmed_by_guest` | boolean | `INT` | No | No | Optional: guest replies confirming successful entry. |
| `checkin_issues_reported` | boolean | `INT` | No | No | True if guest reported an issue during check-in. |
| `checkin_issue_notes` | text | `INT` | No | Conditional | |
| `checkout_reminder_sent` | boolean | `INT` | No | Yes | True when the day-before checkout reminder was sent. |
| `checkout_tasks_acknowledged` | boolean | `INT` | No | No | True if guest confirmed checkout tasks. |
| `checkout_completed_confirmed` | boolean | `INT` | No | No | True if homeowner confirmed checkout and key return. |
| `key_returned` | boolean | `INT` | No | Conditional | If access method requires key return. |
| `key_return_confirmed_at` | datetime | `INT` | No | Conditional | |
| `active_service_requests` | array of UUIDs → ServiceRequest | `INT` | No | No | In-progress service requests during this stay. |
| `active_escalation_id` | uuid → EscalationRecord | `INT` | No | No | Populated if the session is currently under human takeover. |
| `feedback_requested` | boolean | `INT` | No | Yes | True when review request has been sent post-checkout. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |

---

## Model 5 — WhatsAppSession

Represents an active or historical WhatsApp conversation between the AI concierge and a guest. Created on first message from a guest phone number that resolves to an active reservation.

See [WhatsApp Session Anchor](../ai-concierge/whatsapp-session-anchor.md) for the full resolution and context binding model.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `guest_phone` | string | `INT` | No | Yes | Normalised E.164. The lookup key. |
| `reservation_id` | uuid → Reservation | `INT` | No | Yes | Resolved reservation. |
| `property_id` | uuid → Property.id | `INT` | No | Yes | Denormalised for fast context loading. |
| `session_status` | enum | `INT` | No | Yes | Values: `active` / `escalated` / `closed` |
| `context_loaded_at` | datetime | `INT` | No | Yes | When the property knowledge block was loaded into context. |
| `detected_language` | string | `INT` | Yes | Recommended | ISO 639-1 code detected from guest messages. |
| `message_count` | integer | `INT` | No | Yes (computed) | Total messages in session. |
| `last_message_at` | datetime | `INT` | No | Yes | Last activity timestamp. Used for session timeout. |
| `session_phase` | enum | `INT` | Yes | Yes | Values: `pre_arrival` / `check_in` / `in_stay` / `check_out` / `post_stay`. Drives AI response context. |
| `unresolved_query_count` | integer | `INT` | No | Yes | Count of consecutive unanswered questions. Triggers escalation at threshold. |
| `escalation_trigger` | string | `INT` | No | Conditional | Reason code if session was escalated. |
| `human_takeover_at` | datetime | `INT` | No | Conditional | When an operator took over. |
| `session_closed_at` | datetime | `INT` | No | Conditional | |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

---

## Model 6 — EmergencyData

Property-level emergency contacts, utility controls, and procedures. Always pre-loaded into the AI concierge session context regardless of query type. See [Emergency Procedures](../ai-concierge/emergency-procedures.md) for the full structure.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | One-to-one relationship. |
| `is_complete` | boolean | `INT` | No | Yes | Blocking flag — property cannot activate until this is true. |
| `owner_emergency_name` | string | `GST` | Yes | Yes | Name of owner or designated emergency contact. |
| `owner_emergency_phone` | string | `GST` | Yes | Yes | Always available to AI. Italian E.164 format. |
| `nauxica_ops_phone` | string | `GST` | Yes | Yes | Nauxica 24/7 operations number. |
| `local_emergency_number` | string | `GST` | Yes | Yes | Always 112 in Italy (EU general emergency). |
| `police_number` | string | `GST` | Yes | Yes | 113 (Polizia di Stato). |
| `fire_brigade_number` | string | `GST` | Yes | Yes | 115 (Vigili del Fuoco). |
| `medical_emergency_number` | string | `GST` | Yes | Yes | 118 (Emergenza Sanitaria). |
| `nearest_hospital_name` | string | `GST` | Yes | Yes | |
| `nearest_hospital_address` | string | `GST` | Yes | Yes | |
| `nearest_hospital_distance` | string | `GST` | Yes | Recommended | e.g. "8 min by car". |
| `nearest_pharmacy_name` | string | `GST` | Yes | Recommended | |
| `nearest_pharmacy_address` | string | `GST` | Yes | Recommended | |
| `gas_shutoff_instructions` | text | `GST` | Yes | Yes | Step-by-step. Pre-loaded into AI context. |
| `water_shutoff_instructions` | text | `GST` | Yes | Yes | |
| `electricity_shutoff_instructions` | text | `GST` | Yes | Yes | |
| `evacuation_assembly_point` | text | `GST` | Yes | Recommended | Where guests should go if they must evacuate. |
| `property_specific_hazards` | text | `GST` | Yes | No | Any specific risks the owner has flagged (e.g. steep external staircase, no handrail on terrace). |
| `updated_at` | datetime | `INT` | No | Yes (auto) | Changes trigger a re-validation of the `is_complete` flag. |

---

## Model 7 — EscalationRecord

Captures the state when the AI concierge hands a conversation to a human operator. See [Escalation Rules](../ai-concierge/escalation-rules.md) for triggers and flow.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `session_id` | uuid → WhatsAppSession | `INT` | No | Yes | |
| `reservation_id` | uuid → Reservation | `INT` | No | Yes | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `trigger_type` | enum | `INT` | No | Yes | See escalation trigger taxonomy in [Escalation Rules](../ai-concierge/escalation-rules.md). |
| `trigger_detail` | text | `INT` | No | Recommended | The specific message or condition that triggered escalation. |
| `escalation_status` | enum | `INT` | No | Yes | Values: `pending` / `acknowledged` / `in_progress` / `resolved` / `auto_closed` |
| `assigned_operator_id` | uuid → User | `INT` | No | Conditional | The operator handling this escalation. ⚠️ **MVP note:** Internal Nauxica administration is outside the public account model at MVP. This field is a future-facing reference; it does not correspond to any public registration path at Sicily launch. See [auth-strategy.md](auth-strategy.md) §7. |
| `acknowledged_at` | datetime | `INT` | No | Conditional | |
| `resolved_at` | datetime | `INT` | No | Conditional | |
| `resolution_notes` | text | `INT` | No | Optional | |
| `ai_resumed_at` | datetime | `INT` | No | Conditional | If AI was re-enabled after operator resolved the issue. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

---

## Model 8 — PartnerAssignment

A formal assignment of a service partner to a property for a specific service type. See [Partner Assignment Model](../architecture/partner-assignment-model.md) for the full model.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `partner_id` | uuid → User | `INT` | No | Yes | |
| `service_type` | enum | `INT` | No | Yes | Values: `cleaning` / `maintenance` / `transfers` / `experiences` / `laundry`. Post-MVP subtypes (`pool_maintenance`, `garden_maintenance`, `concierge_in_person`, `inspection`) are not active at Sicily launch — see [partner-assignment-model.md](../architecture/partner-assignment-model.md) §2. |
| `assignment_status` | enum | `INT` | No | Yes | Values: `active` / `paused` / `ended` |
| `valid_from` | date | `INT` | No | Yes | |
| `valid_until` | date | `INT` | No | No | Null = ongoing. |
| `is_preferred` | boolean | `INT` | No | Yes | If multiple assignments exist for same service type, preferred partner is dispatched first. |
| `notes` | text | `PTR` | No | Optional | Instructions visible to partner only. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

---

## Model 9 — ServiceRequest

A request for a service action, which can be initiated by: the AI concierge (on behalf of a guest), a homeowner, or a Nauxica operator. ServiceRequests are distinct from PartnerRequests — a ServiceRequest is the demand side; a PartnerRequest is the supply/execution side.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `reservation_id` | uuid → Reservation | `INT` | No | Conditional | Required if initiated during a stay. |
| `initiated_by` | enum | `INT` | No | Yes | Values: `ai_concierge` / `guest_direct` / `homeowner` / `operator` |
| `service_type` | enum | `INT` | No | Yes | Values: `cleaning` / `maintenance` / `laundry` / `transfers` / `experiences`. Emergency-level requests use the `urgency` field, not `service_type`. Pool and garden maintenance are classified as `maintenance` at MVP — see [partner-assignment-model.md](../architecture/partner-assignment-model.md). |
| `urgency` | enum | `INT` | Yes | Yes | Values: `emergency` / `urgent` / `high` / `normal` / `scheduled`. **Updated 2026-05-29:** supersedes earlier draft values (`routine`, `same_day`, `urgent`, `emergency`). Authoritative reference: [service-request-flow.md](../operations/service-request-flow.md) §2.1. AI uses this to determine response tone and escalation. |
| `description` | text | `INT` | No | Yes | Internal description of what's needed. |
| `guest_message` | text | `GST` | Yes | Conditional | The original guest message that triggered this request. Visible to AI for context. |
| `status` | enum | `INT` | No | Yes | Values: `created` / `classified` / `routed` / `pending_acceptance` / `assigned` / `in_progress` / `completed` / `verified` / `escalated` / `failed` / `cancelled`. **Updated 2026-05-29:** supersedes earlier 5-state set (`open`, `assigned`, `in_progress`, `completed`, `cancelled`). Full state machine: [service-request-flow.md](../operations/service-request-flow.md) §1. |
| `linked_partner_request_id` | uuid → PartnerRequest | `INT` | No | Conditional | First PartnerRequest created for this ServiceRequest. Set at initial routing; retained for traceability and audit. **Not updated** when routing moves to a backup partner. |
| `active_partner_request_id` | uuid → PartnerRequest | `INT` | No | Conditional | Current PartnerRequest for live routing. Updated each time routing moves to a new partner. Points to whichever PartnerRequest is currently `pending_acceptance`, `accepted`, or `in_progress`. Null until routing begins. |
| `guest_status_message` | text | `GST` | Yes | No | AI-safe status update to share with the guest (e.g. "A maintenance partner has been notified and will contact you shortly.") |
| `resolved_at` | datetime | `INT` | No | Conditional | |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

---

## Model 10 — Task

An operational to-do item tied to a property, owned by the homeowner.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `owner_id` | uuid → User | `INT` | No | Yes | |
| `title` | string | `INT` | No | Yes | |
| `description` | text | `INT` | No | Optional | |
| `task_type` | enum | `INT` | No | Yes | Values: `cleaning` / `maintenance` / `inspection` / `laundry` / `guest_request` / `other`. Updated: migration 002 live schema. |
| `priority` | enum | `INT` | No | Yes | Values: `low` / `normal` / `high` / `urgent`. Note: earlier draft used `important`; live schema uses `high`. |
| `status` | enum | `INT` | No | Yes | Values: `open` / `assigned` / `accepted` / `in_progress` / `completed` / `cancelled`. Full partner lifecycle status. Updated: migration 004 (`accepted` added). |
| `due_date` | date | `INT` | No | Optional | |
| `reservation_id` | uuid → Reservation | `INT` | No | Optional | Optional link to the reservation this task supports. `ON DELETE SET NULL` — task is retained if reservation is deleted. Set at task creation when homeowner selects a related reservation. Added: migration 002. |
| `task_value_amount` | decimal | `INT` | No | Optional | Gross service charge for the task. This is the homeowner's operational cost for the task. Never modified by commission logic. Used in guest-detail Financial Summary (Operational Cost) and by partner-facing earning calculation. Added: migration 006. |
| `task_value_currency` | string | `INT` | No | Optional | ISO 4217 currency code. Default: `EUR`. Added: migration 006. |
| `assigned_partner_id` | uuid → User (partner) | `INT` | No | Optional | Partner assigned to this task. Set when status transitions to `assigned`. Note: live schema uses `assigned_partner_id` (direct User FK) rather than `assigned_partner_request_id`. |
| `assigned_partner_request_id` | uuid → PartnerRequest | `INT` | No | Optional | If task resulted in a PartnerRequest job. Dormant at MVP — `assigned_partner_id` is the active assignment FK. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |
| `completed_at` | datetime | `INT` | No | Conditional | Set when status transitions to `completed`. |

**Visibility note on `task_value_amount`:** Homeowner-facing views show this as full task cost. Partner-facing views must never display the gross amount — partners see only their net earning derived as `task_value_amount × (1 − commission_rate)`, sourced from `CommissionRules`.

**localStorage equivalent:** `tasks` array in `nauxicaDemoState`

---

## Model 11 — PartnerRequest

A service job request created by a homeowner and sent to a partner. The central model for the operations workflow. Represents the execution side of a service job (see ServiceRequest for the demand side).

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `property_id` | uuid → Property.id | `INT` | No | Yes | |
| `homeowner_id` | uuid → User | `INT` | No | Yes | |
| `partner_id` | uuid → User | `INT` | No | Conditional | Null until partner accepts or is assigned. |
| `service_request_id` | uuid → ServiceRequest | `INT` | No | Optional | Set if this was triggered by a ServiceRequest. |
| `service_type` | enum | `INT` | No | Yes | Values: `cleaning` / `maintenance` / `transfers` / `experiences` / `laundry` |
| `title` | string | `INT` | No | Yes | Short description of the job. |
| `description` | text | `INT` | No | Recommended | Full details for the partner. |
| `priority` | enum | `INT` | No | Yes | Values: `low` / `normal` / `important` / `urgent` |
| `requested_date` | date | `INT` | No | Yes | Date the job should happen. |
| `requested_time` | time | `INT` | No | Recommended | Preferred start time. |
| `notes_for_partner` | text | `PTR` | No | Optional | Additional instructions visible to partner only. |
| `agreed_payout_eur` | decimal | `INT` | No | Recommended | Direct billing amount (homeowner pays partner directly). |
| `nauxica_commission_eur` | decimal | `INT` | No | Conditional | Only if Nauxica coordinates this job and earns a commission. |
| `status` | enum | `INT` | No | Yes | Values: `new` / `accepted` / `declined` / `in-progress` / `completed` / `disputed` |
| `partner_completion_notes` | text | `PTR` | No | Optional | Partner's notes on job completion. |
| `completion_photo_urls` | array of strings | `INT` | No | Optional | CDN URLs of completion photos. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |
| `accepted_at` | datetime | `INT` | No | Conditional | |
| `completed_at` | datetime | `INT` | No | Conditional | |

**localStorage equivalent:** `partnerRequests` array in `nauxicaDemoState`

---

## Model 12 — Message

An in-platform message record. Supports homeowner–partner communication. Does not model WhatsApp guest messages (those are external to the platform at MVP and stored in WhatsAppSession).

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `sender_id` | uuid → User | `INT` | No | Yes | |
| `recipient_id` | uuid → User | `INT` | No | Yes | |
| `account_type_context` | enum | `INT` | No | Yes | Renders correct UI view. Values: `homeowner` / `partner` |
| `message_type` | enum | `INT` | No | Yes | Values: `partner` / `nauxica` / `system` |
| `subject` | string | `INT` | No | Optional | |
| `body` | text | `INT` | No | Yes | |
| `is_read` | boolean | `INT` | No | Yes | Default: false. |
| `is_archived` | boolean | `INT` | No | Yes | Default: false. |
| `related_partner_request_id` | uuid → PartnerRequest | `INT` | No | Optional | If message is about a specific job. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

**localStorage equivalent:** `messages` array in `nauxicaDemoState`

---

## Model 13 — Review

A rating and comment record. Reviews can be: guest → property (post-stay), homeowner → partner (post-job), partner → homeowner (post-job).

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | |
| `review_type` | enum | `INT` | No | Yes | Values: `guest-to-property` / `homeowner-to-partner` / `partner-to-homeowner` |
| `reviewer_id` | uuid → User | `INT` | No | Conditional | Null for guest reviews (no account). |
| `reviewer_name` | string | `PUB` | No | Yes | Display name. |
| `reviewer_guest_phone` | string | `INT` | No | Conditional | For guest reviews only. ⚠️ **Legal review required** — retention and anonymisation policy needed. |
| `subject_id` | uuid | `INT` | No | Yes | References User (for partner reviews) or Property (for property reviews). |
| `reservation_id` | uuid → Reservation | `INT` | No | Conditional | Required for guest-to-property reviews. |
| `partner_request_id` | uuid → PartnerRequest | `INT` | No | Conditional | Required for partner/homeowner mutual reviews. |
| `rating` | integer | `PUB` | No | Yes | 1–5. |
| `comment` | text | `PUB` | No | Recommended | |
| `is_visible` | boolean | `PUB` | No | Yes | Default: true. Can be set false if disputed and under review. |
| `created_at` | datetime | `INT` | No | Yes (auto) | |

**localStorage equivalent:** `reviews` array in `nauxicaDemoState`

---

## Model 14 — CommissionRules

Platform commission rate table. Defines the rate Nauxica retains from each task's gross service charge before the remainder is paid to the partner.

> ⚠️ **Access restriction:** This model is an internal Nauxica–Partner financial contract. Homeowner-facing pages must **never** reference this table, display the commission rate, show Nauxica fee, partner earning, or payout. The homeowner's view of cost is always `task_value_amount` (the full gross charge) — commission is invisible to them.

| Field | Type | Visibility | AI | Required | Notes |
|---|---|---|---|---|---|
| `id` | uuid | `INT` | No | Yes (auto) | Primary key |
| `scope_type` | string | `INT` | No | Yes | Scope of this rule. MVP value: `global`. Post-MVP values: `homeowner`, `partner`, `property`, `task_type`. Resolution order: most-specific scope wins. |
| `scope_id` | uuid | `INT` | No | No | References the relevant entity for scoped rules. NULL for the global rule. |
| `rate` | decimal (5,4) | `INT` | No | Yes | Commission fraction. Example: `0.1500` = 15%. Applied as: `partnerEarning = task_value_amount × (1 − rate)`. |
| `valid_from` | date | `INT` | No | Yes | Inclusive effective date. Default: current date at insert. |
| `valid_to` | date | `INT` | No | No | Exclusive end date. NULL = open-ended (rule is currently active). |
| `created_at` | datetime | `INT` | No | Yes (auto) | |
| `updated_at` | datetime | `INT` | No | Yes (auto) | |

**MVP seed row:** `scope_type = 'global'`, `scope_id = NULL`, `rate = 0.1500`, `valid_to = NULL`.

**RLS:** Authenticated users may SELECT. No INSERT, UPDATE, or DELETE for authenticated role — mutations require service_role (Supabase dashboard or backend function only).

**Relationship to `partner_requests.nauxica_commission_eur`:** The `partner_requests` table retains a legacy `nauxica_commission_eur` column for the ServiceRequest/PartnerRequest workflow (dormant at MVP). `CommissionRules` is the canonical rate table for the Task workflow. The two mechanisms operate on different records and do not conflict.

**Source:** migration 009

---

## Model Relationships Summary

```
User (homeowner) ──< Property >──1── PropertyKnowledgeBlock
                                 >──1── EmergencyData
                                 >──<── PartnerAssignment >──── User (partner)
                                 >──<── Reservation
                                        └──1── GuestStayContext
                                        └──0-1── WhatsAppSession
                                                 └──0-1── EscalationRecord
                                        └──<── ServiceRequest >──── PartnerRequest
                                        └──<── Review (guest-to-property)
                                 >──<── Task ──0-1──► Reservation (optional link)
                                 >──<── PartnerRequest >──── User (partner)
User (homeowner) ──< Message >── User (partner)
PartnerRequest ──< Review (homeowner-to-partner, partner-to-homeowner)

CommissionRules  (standalone lookup — no FK from other tables at MVP)
```

Key cardinalities:
- One homeowner User → many Properties
- One Property → exactly one PropertyKnowledgeBlock
- One Property → exactly one EmergencyData record
- One Property → many PartnerAssignments (one per active service type)
- One Property → many Reservations (non-overlapping dates enforced at API layer)
- One Reservation → one guest (no guest User account)
- One Reservation → exactly one GuestStayContext (created at check-in)
- One Reservation → zero or one active WhatsAppSession
- One WhatsAppSession → zero or one active EscalationRecord
- One PartnerRequest → zero or one partner User (unassigned until accepted)
- One ServiceRequest → zero or one PartnerRequest (the execution record)
- One Task → zero or one Reservation (optional operational link; `ON DELETE SET NULL`)
- CommissionRules → no FK relationship with other tables; read at render time by partner-facing views

---

## AI Concierge Data Access Summary

The AI concierge reads from a tightly controlled set of models and fields. It never queries the full Property record, User records, financial data, or compliance data.

| Model | AI access | What it uses |
|---|---|---|
| `PropertyKnowledgeBlock` | Read (scope-filtered projection) | All `PUB` and `GST` fields. The primary knowledge source. |
| `EmergencyData` | Read (always pre-loaded) | All fields — all are `GST` scope. Pre-loaded regardless of query type. |
| `Reservation` | Read (session context only) | `guest_name`, `guest_preferred_language`, `checkin_date`, `checkout_date`, `confirmation_number`, `guest_count`, `special_requests` |
| `GuestStayContext` | Read (session phase determination) | `session_phase` equivalent fields to set response context. |
| `WhatsAppSession` | Read + Write | Reads `session_phase`, `detected_language`, `unresolved_query_count`. Writes message count and last activity. |
| `ServiceRequest` | Write (creates on guest request) | Creates new records with `urgency`, `description`, `guest_message`, `guest_status_message`. |
| `EscalationRecord` | Write (creates on trigger) | Creates escalation records. Cannot modify or read other escalation records. |
| `Property` | None | — |
| `User` | None | — |
| `PartnerAssignment` | None directly | Partner existence is referenced via PropertyKnowledgeBlock (e.g., "a cleaner is assigned") but details are not exposed. |
| `Task` | None | — |
| `PartnerRequest` | None | — |
| `Message` | None | — |
| `Review` | None | — |

---

## localStorage to Backend Migration Notes

The current demo state uses `nauxicaDemoState` in localStorage. The mapping to backend models is:

| localStorage key | Backend model | Migration note |
|---|---|---|
| `properties[]` | `Property` | Minimal fields only — extend to full schema |
| `tasks[]` | `Task` | Add `owner_id`, timestamps, `task_type` |
| `partnerRequests[]` | `PartnerRequest` | Add `homeowner_id`, `partner_id`, financial fields |
| `notifications[]` | No direct model — use in-app notification layer | Define separately in Phase 2 |
| `messages[]` | `Message` | Add proper sender/recipient user references |
| `calendarEvents[]` | Derived from `Reservation` + `Task` | Do not create a separate CalendarEvent model. Former `Booking` is now `Reservation`. |
| `reviews[]` | `Review` | Add `review_type`, proper subject references |
| `accountType` | `User.account_type` | Session/auth token replaces localStorage flag |

Full migration detail: [localStorage-to-backend-migration.md](localStorage-to-backend-migration.md)

---

## Related Documents

- [property-data-schema.md](../property-intake/property-data-schema.md) — Full Property field definitions
- [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) — PropertyKnowledgeBlock field definitions
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Visibility scope definitions
- [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) — Session anchor and context binding model
- [emergency-procedures.md](../ai-concierge/emergency-procedures.md) — EmergencyData full structure
- [escalation-rules.md](../ai-concierge/escalation-rules.md) — EscalationRecord triggers and flow
- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — PartnerAssignment full model
- [api-overview.md](../api/api-overview.md) — API layer built on these models
- [auth-strategy.md](auth-strategy.md) — Authentication and session model
- [localStorage-to-backend-migration.md](localStorage-to-backend-migration.md) — Frontend-to-backend transition plan
