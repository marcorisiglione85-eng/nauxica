# Database Schema

**Version:** 1.5
**Status:** Draft — Backend Readiness Freeze
**Scope:** Sicily launch — PostgreSQL implementation reference
**Last updated:** 2026-06-09
**Related:** [data-models.md](data-models.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [partner-assignment-model.md](../architecture/partner-assignment-model.md) · [service-request-flow.md](../operations/service-request-flow.md) · [dispute-resolution.md](../trust-safety/dispute-resolution.md) · [property-data-schema.md](../property-intake/property-data-schema.md) · [auth-strategy.md](auth-strategy.md)

> **Source of truth:** This document is derived from `data-models.md` v1.7 (primary), with extended field definitions from `partner-assignment-model.md` §3 and `service-request-flow.md` §11. Where those documents explicitly state they extend a base model, their fields are included here. No new entities or fields have been invented. All ambiguities resolved by founder decision on 2026-05-29 are noted inline.

> **v1.5 changes (2026-06-09):** Sprint 010A Documentation Alignment. DS-1: `reservation_value_amount` and `reservation_value_currency` columns added to §3.4 (`reservations`) — from migration 007. DS-2: `reservation_id`, `task_value_amount`, and `task_value_currency` columns added to §3.11 (`tasks`); FK constraint and index added — from migrations 002 and 006. DS-3: `task_type` enum corrected to live values; `task_priority` corrected (`important` → `high`); `task_status` corrected to live 6-state lifecycle — all in §2. DS-4: New §3.19 `commission_rules` table added — from migration 009; RLS policy noted; commission applies only between Nauxica and partner. DS-5: §4 relationship diagram, §5 index strategy, §6 MVP fields, §7 migration notes, and §8 validation checklist updated.

> **v1.4 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-1: `codice_fiscale_or_piva` changed from `NOT NULL` to nullable — not collected at registration; collected during onboarding/account verification; no placeholder value. CB-NEW-2: `plan_started_at` and `plan_renews_at` changed from `NOT NULL` to nullable at MVP — managed by Stripe billing module; not set at registration. CB-NEW-3: `property_code` generation strategy documented — server-side PostgreSQL sequence, never client-generated in production. CB-NEW-4: `confirmation_number` generation strategy documented — server-side PostgreSQL sequence in format `NX-YYYY-NNNNN`. Sprint readiness note added (§7/§8). (source: data-models.md v1.6, auth-strategy.md v1.2, api/endpoints/properties.md v1.1, api/endpoints/reservations.md v1.2)

> **v1.3 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-A: `password_hash` column removed from `users` table — GoTrue manages password storage in `auth.users`; this column was a security antipattern in `public.users` (source: data-models.md v1.5, auth-strategy.md §9.1). CB-C: `guest_nationality` column in `reservations` table changed from `NOT NULL` to nullable — Add Guest wizard does not collect nationality at MVP; Alloggiati Web compliance deferred to a later module (source: data-models.md v1.5).

> **v1.2 changes (2026-06-05):** Property identity model realigned with frontend. `property_id` text slug removed from `properties` table and as FK anchor across all 13 child tables. `property_code` (`NAU-XXXXX`) added to `properties` as immutable human-readable reference — never used as FK. All child table `property_id` columns changed from `text REFERENCES properties(property_id)` to `uuid REFERENCES properties(id)`. `auth-strategy.md` §9.2 and §9.4 RLS patterns updated accordingly. Source document updated to data-models.md v1.4.

> **v1.1 changes (2026-06-05):** `platform_status` enum extended with `draft`, `onboarding`, `pending_activation` states. New `availability_status` enum and column added to `properties`. `assigned_operator_id` fields in `escalation_records` and `dispute_records` noted as post-MVP internal fields. Source document updated to data-models.md v1.3.

---

## 1. Database Principles

**Target database:** PostgreSQL 15 or later.

**Primary keys:** All tables use `uuid` primary keys, generated via `gen_random_uuid()`.

**Timestamp conventions:**
- All timestamps are `TIMESTAMPTZ` (timestamp with time zone), stored in UTC.
- `created_at`: set automatically at `INSERT`, never updated.
- `updated_at`: set automatically at `INSERT` and on every `UPDATE` via trigger. Not all tables have `updated_at` — follow the per-table definition.
- Date-only fields (`checkin_date`, `checkout_date`, etc.) use `DATE` type (no time component).
- Time-only fields (`requested_time`) use `TIME` type.

**Soft-delete strategy:** No soft-delete at MVP. Records are not deleted via application logic. Status enums (`account_status`, `platform_status`, `assignment_status`, etc.) represent the lifecycle state. Hard deletion is an operator-only action for data-subject erasure requests under GDPR.

**Visibility scopes:** Every column note references one of four visibility scopes defined in [data-visibility-model.md](../architecture/data-visibility-model.md). Scopes are enforced by the API layer and AI concierge access rules — they are not enforced by database-level row security at MVP (post-MVP candidate).

| Scope | Meaning |
|---|---|
| `PUB` | Public — readable pre-authentication. AI concierge may share with guests. |
| `GST` | Guest — confirmed guest via WhatsApp concierge. |
| `PTR` | Partner — assigned service partners only. AI may read to dispatch but must never share with guests. |
| `INT` | Internal — homeowner (own data) and Nauxica operators only. AI cannot read. |

**Naming conventions:**
- Tables: `snake_case`, plural (e.g., `users`, `partner_assignments`).
- Columns: `snake_case`.
- Enum type names: `snake_case`, prefixed with context where disambiguation is needed (e.g., `service_request_status` vs `partner_request_status`).
- Foreign key columns: match the referenced table's PK name (e.g., `reservation_id` references `reservations.id`, `property_id` references `properties.id`).

**Enum value normalisation:** Enum values in source documents that use hyphens have been normalised to underscores for SQL compatibility. Both the source form and the SQL form are documented in the enum definitions below.

---

## 2. Enum Definitions

Defined once here; referenced by column definitions throughout §4. All values are lowercase unless noted.

### `account_type`
```sql
CREATE TYPE account_type AS ENUM ('homeowner', 'partner');
```

### `business_type`
```sql
CREATE TYPE business_type AS ENUM ('individual', 'sole_trader', 'company');
-- Source values: 'individual' / 'sole-trader' / 'company' — 'sole-trader' normalised to 'sole_trader'
```

### `nauxica_plan_tier`
```sql
CREATE TYPE nauxica_plan_tier AS ENUM ('starter', 'professional', 'premium');
-- Applies to homeowners. Partner plan tiers (basic/professional) are not modelled in data-models.md v1.2.
-- ⚠️ Gap: partner plan tier enum is not defined. Founder decision required before partner subscription billing is implemented.
```

### `account_status`
```sql
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended', 'closed');
```

### `background_check_status`
```sql
CREATE TYPE background_check_status AS ENUM ('not_started', 'submitted', 'approved', 'rejected');
-- Source values: 'not-started' / 'submitted' / 'approved' / 'rejected' — 'not-started' normalised to 'not_started'
```

### `service_type`
```sql
CREATE TYPE service_type AS ENUM ('cleaning', 'maintenance', 'laundry', 'transfers', 'experiences');
-- 5 canonical MVP values. Post-MVP subtypes (pool_maintenance, garden_maintenance,
-- concierge_in_person, inspection) are NOT enum values at Sicily launch.
-- Pool and garden maintenance are classified as 'maintenance' at MVP.
```

### `platform_status`
```sql
CREATE TYPE platform_status AS ENUM (
  'draft',
  'onboarding',
  'pending_activation',
  'active',
  'suspended',
  'archived'
);
-- 'draft': Property record created; homeowner is building the profile. Not yet submitted for review.
-- 'onboarding': Homeowner is completing the activation checklist. Data entry in progress.
-- 'pending_activation': Homeowner has submitted for Nauxica review. Awaiting go/no-go decision.
-- 'active': Property is live. AI concierge enabled. New reservations accepted per availability_status.
-- 'suspended': Property removed from service by operator action (compliance, quality, or safety).
--              Full Category D re-check required before reinstatement.
-- 'archived': Property permanently deactivated. Terminal state — no further transitions.
-- Updated 2026-06-05: 'pending', formerly the only pre-active state, is superseded by 'draft',
-- 'onboarding', and 'pending_activation'. No existing production data uses the old value.
```

### `availability_status`
```sql
CREATE TYPE availability_status AS ENUM ('available', 'unavailable', 'maintenance');
-- 'available': Property accepts new reservations. Default when platform_status transitions to 'active'.
-- 'unavailable': Owner has paused new bookings (renovation, personal use, etc.). Active stays unaffected.
-- 'maintenance': Property blocked for a maintenance window. No new bookings; active stays continue.
-- Note: availability_status is only meaningful when platform_status = 'active'.
-- When platform_status != 'active', availability_status is ignored by the reservation engine.
-- Set by homeowner via dashboard, or by operator for maintenance windows.
```

### `guest_document_type`
```sql
CREATE TYPE guest_document_type AS ENUM ('passport', 'id_card', 'driving_licence');
-- Source values: 'passport' / 'id-card' / 'driving-licence' — hyphens normalised to underscores
```

### `reservation_status`
```sql
CREATE TYPE reservation_status AS ENUM (
  'confirmed', 'pre_arrival', 'checked_in', 'checked_out', 'cancelled', 'no_show'
);
```

### `booking_source`
```sql
CREATE TYPE booking_source AS ENUM ('direct', 'airbnb', 'booking_com', 'vrbo', 'other');
-- Source: 'booking-com' normalised to 'booking_com'
```

### `session_status`
```sql
CREATE TYPE session_status AS ENUM ('active', 'escalated', 'closed');
```

### `session_phase`
```sql
CREATE TYPE session_phase AS ENUM (
  'pre_arrival', 'check_in', 'in_stay', 'check_out', 'post_stay'
);
```

### `escalation_status`
```sql
CREATE TYPE escalation_status AS ENUM (
  'pending', 'acknowledged', 'in_progress', 'resolved', 'auto_closed'
);
```

### `escalation_trigger_type`
```sql
CREATE TYPE escalation_trigger_type AS ENUM (
  'emergency',
  'maintenance_urgent',
  'complaint',
  'safety_concern',
  'legal_claim',
  'identity_conflict',
  'access_denied',
  'reservation_modification',    -- TRIGGER-08 in escalation-rules.md retains the legacy name
                                  -- BOOKING_MODIFICATION_REQUEST. This enum uses the canonical
                                  -- operational name. See documentation-consistency-audit.md L-02.
  'repeated_unanswered',
  'abuse',
  'identity_unresolvable'
);
-- Source: module-functionality-map.md trigger list + escalation-rules.md
```

### `assignment_status`
```sql
CREATE TYPE assignment_status AS ENUM ('active', 'paused', 'ended');
```

### `schedule_type`
```sql
CREATE TYPE schedule_type AS ENUM ('on_demand', 'scheduled_recurring', 'both');
-- Source: partner-assignment-model.md §3
```

### `access_type_granted`
```sql
CREATE TYPE access_type_granted AS ENUM (
  'guest_code', 'partner_code', 'key_safe', 'in_person_handover'
);
-- Source: partner-assignment-model.md §3
```

### `initiated_by`
```sql
CREATE TYPE initiated_by AS ENUM ('ai_concierge', 'guest_direct', 'homeowner', 'operator');
```

### `service_request_urgency`
```sql
CREATE TYPE service_request_urgency AS ENUM (
  'emergency', 'urgent', 'high', 'normal', 'scheduled'
);
-- APPROVED 2026-05-29: operational values from service-request-flow.md §2.1.
-- Supersedes compressed set in data-models.md v1.2 (routine/same_day/urgent/emergency).
-- 'scheduled' required for recurring jobs. 'high' required for intermediate urgency tier.
```

### `service_request_status`
```sql
CREATE TYPE service_request_status AS ENUM (
  'created',
  'classified',
  'routed',
  'pending_acceptance',
  'assigned',
  'in_progress',
  'completed',
  'verified',
  'escalated',
  'failed',
  'cancelled'
);
-- APPROVED 2026-05-29: full 11-state machine from service-request-flow.md §1.
-- Supersedes compressed 5-state set in data-models.md v1.2 (open/assigned/in_progress/completed/cancelled).
-- 'verified', 'routed', 'pending_acceptance', 'escalated', 'failed' are required by the
-- routing and verification workflows in service-request-flow.md.
```

### `classification_source`
```sql
CREATE TYPE classification_source AS ENUM (
  'ai_keyword_match', 'homeowner_specified', 'operator_override', 'default'
);
-- Source: service-request-flow.md §2.3
```

### `verified_by_type`
```sql
CREATE TYPE verified_by_type AS ENUM ('homeowner', 'auto', 'operator');
-- Source: service-request-flow.md §11
```

### `cancellation_reason`
```sql
CREATE TYPE cancellation_reason AS ENUM (
  'homeowner_no_longer_needed',
  'guest_cancelled_stay',
  'handled_outside_platform',
  'duplicate_request',
  'operator_override'
);
-- Source: service-request-flow.md §9.3
```

### `task_type`
```sql
CREATE TYPE task_type AS ENUM (
  'cleaning', 'maintenance', 'inspection', 'laundry', 'guest_request', 'other'
);
-- UPDATED DS-3 (2026-06-09): earlier draft values ('check_in', 'admin') replaced by live schema values.
-- Source: migrations/002_tasks.sql + frontend TASK_TYPE_LABELS in tasks.html, operations.html, dashboard-partner.html.
```

### `task_priority`
```sql
CREATE TYPE task_priority AS ENUM ('low', 'normal', 'high', 'urgent');
-- UPDATED DS-3 (2026-06-09): 'important' corrected to 'high' to match live schema.
```

### `task_status`
```sql
CREATE TYPE task_status AS ENUM (
  'open', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled'
);
-- UPDATED DS-3 (2026-06-09): earlier draft values ('pending') replaced by live 6-state partner lifecycle.
-- 'open': task created, no partner assigned.
-- 'assigned': homeowner has assigned a partner; awaiting partner acceptance.
-- 'accepted': partner accepted the job.
-- 'in_progress': partner has started work.
-- 'completed': job finished.
-- 'cancelled': task cancelled by homeowner.
-- 'accepted' value added in migration 004.
```

### `partner_request_status`
```sql
CREATE TYPE partner_request_status AS ENUM (
  'new', 'accepted', 'declined', 'in_progress', 'completed', 'disputed'
);
-- Source: 'in-progress' normalised to 'in_progress'
```

### `message_type`
```sql
CREATE TYPE message_type AS ENUM ('partner', 'nauxica', 'system');
```

### `account_type_context`
```sql
CREATE TYPE account_type_context AS ENUM ('homeowner', 'partner');
```

### `review_type`
```sql
CREATE TYPE review_type AS ENUM (
  'guest_to_property', 'homeowner_to_partner', 'partner_to_homeowner'
);
-- Source: 'guest-to-property' / 'homeowner-to-partner' / 'partner-to-homeowner' — hyphens normalised
```

### `dispute_status`
```sql
CREATE TYPE dispute_status AS ENUM (
  'reported',
  'evidence_collection',
  'under_review',
  'escalated_to_parties',
  'resolved',
  'referred_to_court',
  'closed'
);
-- Source: dispute-resolution.md Resolution Lifecycle
```

### `dispute_type`
```sql
CREATE TYPE dispute_type AS ENUM (
  'd_01', 'd_02', 'd_03', 'd_04', 'd_05',
  'd_06', 'd_07', 'd_08', 'd_09', 'd_10'
);
-- Source: dispute-resolution.md Dispute Type Taxonomy
-- d_01: Guest vs Property (service failure / misrepresentation)
-- d_02: Guest vs Property (damage claim)
-- d_03: Guest vs Property (tourist tax)
-- d_04: Guest vs Platform (AI error / platform failure)
-- d_05: Homeowner vs Partner (job quality failure)
-- d_06: Homeowner vs Partner (no-show)
-- d_07: Homeowner vs Partner (property damage by partner)
-- d_08: Partner vs Homeowner (payment not received)
-- d_09: Homeowner vs Guest (damage to property)
-- d_10: Any party vs Nauxica (platform conduct)
```

### `resolution_type`
```sql
CREATE TYPE resolution_type AS ENUM (
  'accepted', 'partial_refund', 'full_refund', 'no_action', 'referred', 'platform_credit'
);
-- Source: dispute-resolution.md — hyphens normalised ('partial-refund' → 'partial_refund', etc.)
```

---

## 3. Table Definitions

### 3.1 — `users`

**Purpose:** Homeowner and partner accounts. Guests have no user account on Nauxica (WhatsApp-only model — identity anchored to `reservations.guest_phone`).

**Source:** data-models.md Model 1

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `email` | `text` | NO | YES | — | INT | |
| `account_type` | `account_type` | NO | NO | — | INT | |
| `full_name` | `text` | NO | NO | — | INT | Legal name |
| `display_name` | `text` | YES | NO | — | PUB | Shown on reviews and partner listings |
| `phone_number` | `text` | NO | NO | — | INT | E.164 format. Verified on registration. |
| `codice_fiscale_or_piva` | `text` | YES | NO | — | INT | ⚠️ Legal review required. Encrypted at rest. Nullable at registration — collected during onboarding/account verification. No placeholder value. |
| `business_type` | `business_type` | YES | NO | — | INT | Required when `account_type = 'partner'` |
| `profile_photo_url` | `text` | YES | NO | — | PUB | CDN URL |
| `is_email_verified` | `boolean` | NO | NO | `false` | INT | |
| `is_phone_verified` | `boolean` | NO | NO | `false` | INT | |
| `is_identity_verified` | `boolean` | NO | NO | `false` | INT | Set after ID document review (partners) |
| `nauxica_plan_tier` | `nauxica_plan_tier` | NO | NO | — | INT | ⚠️ Applies to homeowner plans (starter/professional/premium). Partner plan tier not modelled in v1.2 — see enum note above. |
| `plan_started_at` | `timestamptz` | YES | NO | — | INT | Nullable at MVP — managed by Stripe billing module. Null until subscription billing is implemented. Not set at registration. |
| `plan_renews_at` | `timestamptz` | YES | NO | — | INT | Nullable at MVP — managed by Stripe billing module. Null until subscription billing is implemented. Not set at registration. |
| `account_status` | `account_status` | NO | NO | `'pending'` | INT | |
| `preferred_language` | `text` | YES | NO | `'en'` | INT | ISO 639-1 |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `partner_service_types` | `service_type[]` | YES | NO | — | PUB | Partner only. Null when `account_type = 'homeowner'`. |
| `operating_areas` | `text[]` | YES | NO | — | PUB | Partner only. Municipalities or provinces. |
| `average_rating` | `numeric(3,2)` | YES | NO | — | PUB | Partner only. COMPUTED — derived from reviews. Not stored; calculated on read. |
| `total_jobs_completed` | `integer` | YES | NO | — | PUB | Partner only. COMPUTED — derived from partner_requests. |
| `insurance_document_url` | `text` | YES | NO | — | INT | Partner only. Required for maintenance partners. |
| `id_document_url` | `text` | YES | NO | — | INT | Partner only. Uploaded during vetting. |
| `background_check_status` | `background_check_status` | YES | NO | `'not_started'` | INT | Partner only. |
| `is_accepting_jobs` | `boolean` | YES | NO | `true` | PUB | Partner only. Toggled for availability. |
| `trust_score` | `integer` | YES | NO | — | INT | Partner only. 0–100. Operator-assessed. See scoring-model.md. |
| `reliability_score` | `integer` | YES | NO | — | INT | Partner only. 0–100. Operator-assessed. See scoring-model.md. |

**Constraints:**
```sql
ALTER TABLE users
  ADD CONSTRAINT users_email_unique UNIQUE (email),
  ADD CONSTRAINT users_rating_range CHECK (average_rating BETWEEN 1.0 AND 5.0),
  ADD CONSTRAINT users_trust_score_range CHECK (trust_score BETWEEN 0 AND 100),
  ADD CONSTRAINT users_reliability_score_range CHECK (reliability_score BETWEEN 0 AND 100),
  -- Partner-specific fields must be non-null for partners:
  ADD CONSTRAINT users_partner_service_types_required
    CHECK (account_type != 'partner' OR partner_service_types IS NOT NULL),
  ADD CONSTRAINT users_partner_background_check_required
    CHECK (account_type != 'partner' OR background_check_status IS NOT NULL);
```

**Indexes:**
- `users_pkey` — PRIMARY KEY on `id`
- `users_email_idx` — UNIQUE on `email`
- `users_account_type_status_idx` — on `(account_type, account_status)` — partner availability lookups

---

### 3.2 — `properties`

**Purpose:** A managed rental property owned by a homeowner.

**Source:** data-models.md Model 2. Full field specification deferred to [property-data-schema.md](../property-intake/property-data-schema.md). This table definition covers structural and FK fields only.

**Note on property identity:** `properties` has two identifiers: `id` (UUID primary key, FK anchor for all child tables) and `property_code` (immutable human-readable reference, format `NAU-XXXXX`). All child tables reference `properties.id` via a `property_id uuid` column. `property_code` is never used as a foreign key — it is used for display, support, search, confirmation communications, and human reference only.

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key. UUID FK anchor for all child tables. |
| `property_code` | `text` | NO | YES | — | INT | Immutable human-readable reference, format `NAU-XXXXX`. Generated server-side at property creation using a PostgreSQL sequence or equivalent atomic database-side counter. Unique, never reused, never client-generated in production. Any `property_code` in the request body is ignored. Frontend localStorage generation (wizard prototype) is prototype-only. Used for display, support, search, and communications. Never used as a foreign key. |
| `owner_id` | `uuid` | NO | NO | — | INT | → `users.id` |
| `schema_version` | `text` | NO | NO | `'1.0'` | INT | For migration compatibility |
| `platform_status` | `platform_status` | NO | NO | `'draft'` | INT | Lifecycle state. See enum definition in §2 for all values and transitions. |
| `availability_status` | `availability_status` | YES | NO | `NULL` | INT | Set to `'available'` when platform_status first transitions to `'active'`. Null for non-active properties. Controls booking availability independently of platform lifecycle. |
| `nauxica_plan_tier` | `nauxica_plan_tier` | NO | NO | — | INT | Inherited from owner at creation; can be overridden |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `activated_at` | `timestamptz` | YES | NO | — | INT | Set when status transitions to `active` |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

> **Extended fields:** All category A–J fields from [property-data-schema.md](../property-intake/property-data-schema.md) are stored in this table. Backend developers must read that document for the complete column list before implementing the `properties` table migration.
>
> **`dynamic_instructions` column:** `jsonb nullable`. Stores homeowner-created time-bounded override instructions applied by KBB Step 3 (Dynamic Instruction Merge). Each instruction object has shape: `{target_field, override_text, scope, active_from, active_until, priority}`. When an instruction matches the session date and `scope = "guest"`, the KBB replaces the named field's value with `override_text`. Instructions with `scope = "partner"` are excluded from the AI concierge pipeline. Post-MVP candidate: migrate to a separate `dynamic_instructions` table if homeowners require more than ~20 concurrent overrides or if per-instruction audit trail becomes required. See knowledge-retrieval-model.md §5 Step 3 and §8.

**Constraints:**
```sql
ALTER TABLE properties
  ADD CONSTRAINT properties_property_code_unique UNIQUE (property_code),
  ADD CONSTRAINT properties_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id);
```

**Indexes:**
- `properties_pkey` — PRIMARY KEY on `id`
- `properties_property_code_idx` — UNIQUE on `property_code` — human reference lookup (support, search, confirmation communications)
- `properties_owner_id_idx` — on `owner_id` — homeowner dashboard queries

---

### 3.3 — `property_knowledge_blocks`

**Purpose:** AI-ready content layer for a property. One per property. The only model the AI concierge reads from — it never queries the `properties` table directly.

**Source:** data-models.md Model 3. Content fields deferred to [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md).

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | YES | — | INT | → `properties.id`. One-to-one. |
| `schema_version` | `text` | NO | NO | `'1.0'` | INT | Knowledge block version |
| `is_complete` | `boolean` | NO | NO | `false` | INT | Must be `true` before property can activate |
| `last_reviewed_at` | `timestamptz` | YES | NO | — | INT | When Nauxica staff last verified accuracy |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

> **Extended fields:** All GST/PUB-scoped content fields from [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) are stored in this table. Backend developers must read that document for the complete column list.

**Constraints:**
```sql
ALTER TABLE property_knowledge_blocks
  ADD CONSTRAINT pkb_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT pkb_property_id_unique UNIQUE (property_id);
```

**Indexes:**
- `property_knowledge_blocks_pkey` — PRIMARY KEY on `id`
- `pkb_property_id_idx` — UNIQUE on `property_id` — AI concierge context loading

---

### 3.4 — `reservations`

**Purpose:** A confirmed guest stay linked to a property. The primary anchor for AI concierge session context. Guests have no user accounts — identity is captured on this record.

**Source:** data-models.md Model 4

⚠️ **Legal review required:** Guest personal data (name, phone, nationality, document number) is subject to GDPR and Alloggiati Web reporting obligations. Confirm retention period, deletion schedule, and encryption requirements before implementation.

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key. Referred to as `reservation_id` in FK columns throughout. |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `confirmation_number` | `text` | NO | YES | — | GST | Human-readable reference, format `NX-YYYY-NNNNN`. Auto-generated server-side using a PostgreSQL sequence if not provided by client. Unique, immutable, never reused. |
| `guest_name` | `text` | NO | NO | — | GST | Lead guest full name |
| `guest_phone` | `text` | NO | NO | — | INT | E.164. WhatsApp session anchor. |
| `guest_phone_verified` | `boolean` | NO | NO | `false` | INT | |
| `guest_email` | `text` | YES | NO | — | INT | For booking confirmation only |
| `guest_preferred_language` | `text` | YES | NO | `'en'` | GST | ISO 639-1 |
| `guest_nationality` | `text` | YES | NO | — | INT | ISO 3166-1 alpha-2. Nullable at MVP — Alloggiati Web compliance deferred to a later module. |
| `guest_document_type` | `guest_document_type` | YES | NO | — | INT | Required for Alloggiati Web. |
| `guest_document_number` | `text` | YES | NO | — | INT | Required for Alloggiati Web. Encrypted at rest. |
| `guest_count` | `integer` | NO | NO | — | GST | |
| `guest_count_adults` | `integer` | YES | NO | — | INT | For tourist tax calculation |
| `guest_count_children_under_12` | `integer` | YES | NO | — | INT | For tourist tax exemption |
| `checkin_date` | `date` | NO | NO | — | GST | |
| `checkout_date` | `date` | NO | NO | — | GST | |
| `nights` | `integer` | YES | NO | — | INT | COMPUTED: `checkout_date - checkin_date`. May be implemented as a generated column: `GENERATED ALWAYS AS (checkout_date - checkin_date) STORED`. |
| `tourist_tax_total_eur` | `numeric(10,2)` | YES | NO | — | INT | COMPUTED from adults × nights × rate |
| `tourist_tax_collected` | `boolean` | NO | NO | `false` | INT | |
| `alloggiati_registered` | `boolean` | YES | NO | `false` | INT | Required tracking field where Alloggiati Web obligation exists |
| `booking_source` | `booking_source` | YES | NO | — | INT | |
| `special_requests` | `text` | YES | NO | — | GST | Guest notes. AI uses for personalisation. |
| `internal_notes` | `text` | YES | NO | — | INT | Homeowner/operator notes. AI cannot read. |
| `reservation_value_amount` | `numeric(10,2)` | YES | NO | — | INT | Gross reservation value entered by homeowner. Used for Financial Summary margin calculation (guest-detail view). Never exposed to guests or partners. Added: migration 007. |
| `reservation_value_currency` | `text` | NO | NO | `'EUR'` | INT | ISO 4217 currency code. Default: `EUR`. Must match `task_value_currency` on linked tasks for margin calculations to be valid — currency mismatch is application-layer responsibility. Added: migration 007. |
| `reservation_status` | `reservation_status` | NO | NO | `'confirmed'` | INT | |
| `checkin_completed_at` | `timestamptz` | YES | NO | — | INT | |
| `checkout_completed_at` | `timestamptz` | YES | NO | — | INT | |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE reservations
  ADD CONSTRAINT reservations_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT reservations_confirmation_number_unique UNIQUE (confirmation_number),
  ADD CONSTRAINT reservations_guest_count_positive CHECK (guest_count > 0),
  ADD CONSTRAINT reservations_dates_valid CHECK (checkout_date > checkin_date);
-- Overlapping reservation dates for the same property must be prevented at the API layer.
-- A partial index or application-level lock is required — not enforced by a simple constraint.
```

**Indexes:**
- `reservations_pkey` — PRIMARY KEY on `id`
- `reservations_property_id_idx` — on `property_id` — property-level reservation queries
- `reservations_guest_phone_idx` — on `guest_phone` — WhatsApp session resolution (primary lookup path for the AI concierge)
- `reservations_status_checkin_idx` — on `(reservation_status, checkin_date)` — active stay lookups
- `reservations_confirmation_number_idx` — UNIQUE on `confirmation_number`

---

### 3.5 — `guest_stay_contexts`

**Purpose:** Operational check-in and check-out tracking for a specific stay. Created when a reservation moves to `checked_in`. One per reservation.

**Source:** data-models.md Model 4b

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `reservation_id` | `uuid` | NO | YES | — | INT | → `reservations.id`. One-to-one. |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id`. Denormalised for fast lookup. |
| `access_code_delivered` | `boolean` | NO | NO | `false` | INT | |
| `access_code_delivered_at` | `timestamptz` | YES | NO | — | INT | |
| `welcome_message_sent` | `boolean` | NO | NO | `false` | INT | |
| `welcome_message_sent_at` | `timestamptz` | YES | NO | — | INT | |
| `checkin_confirmed_by_guest` | `boolean` | NO | NO | `false` | INT | |
| `checkin_issues_reported` | `boolean` | NO | NO | `false` | INT | |
| `checkin_issue_notes` | `text` | YES | NO | — | INT | |
| `checkout_reminder_sent` | `boolean` | NO | NO | `false` | INT | |
| `checkout_tasks_acknowledged` | `boolean` | NO | NO | `false` | INT | |
| `checkout_completed_confirmed` | `boolean` | NO | NO | `false` | INT | |
| `key_returned` | `boolean` | YES | NO | — | INT | Conditional — only applicable if access method requires key return |
| `key_return_confirmed_at` | `timestamptz` | YES | NO | — | INT | |
| `active_service_requests` | `uuid[]` | YES | NO | — | INT | References `service_requests.id`. FK integrity not enforced at DB level on array elements (PostgreSQL limitation). Enforced at application layer. Post-MVP candidate: replace with junction table if referential integrity becomes required. GIN index applied. |
| `active_escalation_id` | `uuid` | YES | NO | — | INT | → `escalation_records.id`. Populated if session is under human takeover. |
| `feedback_requested` | `boolean` | NO | NO | `false` | INT | |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE guest_stay_contexts
  ADD CONSTRAINT gsc_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT gsc_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT gsc_escalation_fk FOREIGN KEY (active_escalation_id) REFERENCES escalation_records (id),
  ADD CONSTRAINT gsc_reservation_unique UNIQUE (reservation_id);
```

**Indexes:**
- `guest_stay_contexts_pkey` — PRIMARY KEY on `id`
- `gsc_reservation_id_idx` — UNIQUE on `reservation_id`
- `gsc_property_id_idx` — on `property_id`
- `gsc_active_service_requests_idx` — GIN on `active_service_requests` — fast array membership queries

---

### 3.6 — `whatsapp_sessions`

**Purpose:** An active or historical WhatsApp conversation between the AI concierge and a guest. Created on first message from a guest phone number that resolves to an active reservation.

**Source:** data-models.md Model 5

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `guest_phone` | `text` | NO | NO | — | INT | E.164. The lookup key. |
| `reservation_id` | `uuid` | NO | NO | — | INT | → `reservations.id` |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id`. Denormalised for fast context loading. |
| `session_status` | `session_status` | NO | NO | `'active'` | INT | |
| `context_loaded_at` | `timestamptz` | NO | NO | — | INT | When the property knowledge block was loaded into context |
| `detected_language` | `text` | YES | NO | — | INT | ISO 639-1. AI-detected from guest messages. |
| `message_count` | `integer` | NO | NO | `0` | INT | COMPUTED — incremented on each message. |
| `last_message_at` | `timestamptz` | NO | NO | — | INT | Last activity. Used for session timeout. |
| `session_phase` | `session_phase` | NO | NO | — | INT | Drives AI response context. |
| `unresolved_query_count` | `integer` | NO | NO | `0` | INT | Triggers escalation at threshold. |
| `escalation_trigger` | `text` | YES | NO | — | INT | Reason code if session was escalated |
| `human_takeover_at` | `timestamptz` | YES | NO | — | INT | |
| `session_closed_at` | `timestamptz` | YES | NO | — | INT | |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE whatsapp_sessions
  ADD CONSTRAINT ws_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT ws_property_fk FOREIGN KEY (property_id) REFERENCES properties (id);
```

**Indexes:**
- `whatsapp_sessions_pkey` — PRIMARY KEY on `id`
- `ws_guest_phone_status_idx` — on `(guest_phone, session_status)` — primary AI concierge session resolution path (most frequent lookup in the system)
- `ws_reservation_id_idx` — on `reservation_id`
- `ws_property_id_status_idx` — on `(property_id, session_status)` — homeowner active session views

---

### 3.7 — `emergency_data`

**Purpose:** Property-level emergency contacts, utility controls, and procedures. One row per property. Always pre-loaded into the AI concierge session context regardless of query type.

**Source:** data-models.md Model 6

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | YES | — | INT | → `properties.id`. One-to-one. |
| `is_complete` | `boolean` | NO | NO | `false` | INT | Blocking flag — property cannot activate until `true` |
| `owner_emergency_name` | `text` | NO | NO | — | GST | Name of owner or designated emergency contact |
| `owner_emergency_phone` | `text` | NO | NO | — | GST | Always available to AI. E.164 format. |
| `nauxica_ops_phone` | `text` | NO | NO | — | GST | Nauxica Support contact number. Field name is schema canonical — not renamed. |
| `local_emergency_number` | `text` | NO | NO | `'112'` | GST | Always 112 in Italy |
| `police_number` | `text` | NO | NO | `'113'` | GST | Polizia di Stato |
| `fire_brigade_number` | `text` | NO | NO | `'115'` | GST | Vigili del Fuoco |
| `medical_emergency_number` | `text` | NO | NO | `'118'` | GST | Emergenza Sanitaria |
| `nearest_hospital_name` | `text` | NO | NO | — | GST | |
| `nearest_hospital_address` | `text` | NO | NO | — | GST | |
| `nearest_hospital_distance` | `text` | YES | NO | — | GST | e.g. "8 min by car" |
| `nearest_pharmacy_name` | `text` | YES | NO | — | GST | |
| `nearest_pharmacy_address` | `text` | YES | NO | — | GST | |
| `gas_shutoff_instructions` | `text` | NO | NO | — | GST | Step-by-step. Pre-loaded into AI context. |
| `water_shutoff_instructions` | `text` | NO | NO | — | GST | |
| `electricity_shutoff_instructions` | `text` | NO | NO | — | GST | |
| `evacuation_assembly_point` | `text` | YES | NO | — | GST | |
| `property_specific_hazards` | `text` | YES | NO | — | GST | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | Changes trigger re-validation of `is_complete`. No `created_at` column — per data-models.md v1.2 Model 6. |

**Constraints:**
```sql
ALTER TABLE emergency_data
  ADD CONSTRAINT ed_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT ed_property_id_unique UNIQUE (property_id);
```

**Indexes:**
- `emergency_data_pkey` — PRIMARY KEY on `id`
- `ed_property_id_idx` — UNIQUE on `property_id` — AI concierge emergency context pre-load

---

### 3.8 — `escalation_records`

**Purpose:** Captures state when the AI concierge hands a conversation to a human operator.

**Source:** data-models.md Model 7

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `session_id` | `uuid` | NO | NO | — | INT | → `whatsapp_sessions.id` |
| `reservation_id` | `uuid` | NO | NO | — | INT | → `reservations.id` |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `trigger_type` | `escalation_trigger_type` | NO | NO | — | INT | Escalation trigger code |
| `trigger_detail` | `text` | YES | NO | — | INT | The specific message or condition that triggered escalation |
| `escalation_status` | `escalation_status` | NO | NO | `'pending'` | INT | |
| `assigned_operator_id` | `uuid` | YES | NO | — | INT | → `users.id`. The operator handling this escalation. ⚠️ **MVP note:** Internal Nauxica administration is outside the public account model at MVP. This field is a future-facing internal reference — no `operator` account_type exists in the `users` table at Sicily launch. Null at MVP; managed via out-of-band tooling. See [auth-strategy.md](auth-strategy.md) §7. |
| `acknowledged_at` | `timestamptz` | YES | NO | — | INT | |
| `resolved_at` | `timestamptz` | YES | NO | — | INT | |
| `resolution_notes` | `text` | YES | NO | — | INT | |
| `ai_resumed_at` | `timestamptz` | YES | NO | — | INT | Set if AI was re-enabled after operator resolved the issue |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE escalation_records
  ADD CONSTRAINT er_session_fk FOREIGN KEY (session_id) REFERENCES whatsapp_sessions (id),
  ADD CONSTRAINT er_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT er_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT er_operator_fk FOREIGN KEY (assigned_operator_id) REFERENCES users (id);
```

**Indexes:**
- `escalation_records_pkey` — PRIMARY KEY on `id`
- `er_status_idx` — on `(escalation_status, created_at DESC)` — open escalation queue for operator dashboard
- `er_session_id_idx` — on `session_id`
- `er_property_id_idx` — on `property_id`

---

### 3.9 — `partner_assignments`

**Purpose:** A formal assignment of a service partner to a property for a specific service type. Required before automated dispatch can route a ServiceRequest to a partner.

**Source:** data-models.md Model 8 (base) + partner-assignment-model.md §3 (extended fields — document header states: *"This extends the summary definition in Data Models §8 with full operational detail."*)

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `partner_id` | `uuid` | NO | NO | — | INT | → `users.id`. Must be an active, vetted partner account. |
| `service_type` | `service_type` | NO | NO | — | INT | One of the 5 MVP service types |
| `assignment_status` | `assignment_status` | NO | NO | `'active'` | INT | |
| `valid_from` | `date` | NO | NO | — | INT | Inclusive |
| `valid_until` | `date` | YES | NO | — | INT | Null = ongoing. Supports seasonal arrangements. |
| `is_preferred` | `boolean` | NO | NO | `true` | INT | True = dispatched first when a ServiceRequest of this type is created |
| `notes` | `text` | YES | NO | — | PTR | Instructions visible to the assigned partner only |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `priority_rank` | `integer` | NO | NO | `1` | INT | Dispatch order when multiple assignments exist for same service type. 1 = highest priority. |
| `schedule_type` | `schedule_type` | YES | NO | — | INT | |
| `recurring_schedule` | `jsonb` | YES | NO | — | INT | Required when `schedule_type` includes `scheduled_recurring`. Structure: `{frequency, day_of_week, time_of_day, duration_hours, auto_create_request}` |
| `partner_briefed` | `boolean` | NO | NO | `false` | INT | True when partner has been given access to the property brief for their service type |
| `partner_briefed_at` | `timestamptz` | YES | NO | — | INT | |
| `access_granted` | `boolean` | NO | NO | `false` | INT | True when partner has been given relevant access codes |
| `access_type_granted` | `access_type_granted` | YES | NO | — | INT | |
| `homeowner_notes` | `text` | YES | NO | — | INT | Notes visible only to homeowner and operator. Not shared with partner. |
| `created_by` | `uuid` | NO | NO | — | INT | → `users.id`. Homeowner or operator who created this assignment. |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `ended_at` | `timestamptz` | YES | NO | — | INT | Set when `assignment_status` transitions to `ended` |
| `ended_reason` | `text` | YES | NO | — | INT | |

**Constraints:**
```sql
ALTER TABLE partner_assignments
  ADD CONSTRAINT pa_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT pa_partner_fk FOREIGN KEY (partner_id) REFERENCES users (id),
  ADD CONSTRAINT pa_created_by_fk FOREIGN KEY (created_by) REFERENCES users (id),
  ADD CONSTRAINT pa_priority_rank_positive CHECK (priority_rank > 0),
  ADD CONSTRAINT pa_dates_valid CHECK (valid_until IS NULL OR valid_until > valid_from);
```

**Indexes:**
- `partner_assignments_pkey` — PRIMARY KEY on `id`
- `pa_dispatch_lookup_idx` — on `(property_id, service_type, assignment_status)` — primary dispatch lookup path (queried on every ServiceRequest routing)
- `pa_partner_id_idx` — on `partner_id` — partner's own assignment list
- `pa_priority_idx` — on `(property_id, service_type, priority_rank)` WHERE `assignment_status = 'active'` — ordered dispatch

---

### 3.10 — `service_requests`

**Purpose:** Demand-side record of a service need. Distinct from `partner_requests` — a ServiceRequest is "something needs to be done"; a PartnerRequest is "this partner has been asked to do it."

**Source:** data-models.md Model 9 (base) + service-request-flow.md §11 (extended fields — document header states: *"The following extends data-models.md Model 9 with full operational fields."*)

**Note:** `urgency` and `status` enums use values approved on 2026-05-29 (see §2 enum definitions). `updated_at` is included as a standard operational requirement not listed in data-models.md v1.2 Model 9 — all mutable operational records require update tracking.

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. Null for homeowner-created requests not linked to a stay. |
| `initiated_by` | `initiated_by` | NO | NO | — | INT | |
| `service_type` | `service_type` | NO | NO | — | INT | |
| `urgency` | `service_request_urgency` | NO | NO | — | INT | |
| `description` | `text` | NO | NO | — | INT | Internal description. AI-created requests include the guest's message. |
| `guest_message` | `text` | YES | NO | — | GST | The exact guest message that triggered this request (AI-created only) |
| `status` | `service_request_status` | NO | NO | `'created'` | INT | |
| `linked_partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. First PartnerRequest created for this ServiceRequest. Set at initial routing; retained for traceability and audit. Not updated when routing moves to a backup partner. |
| `guest_status_message` | `text` | YES | NO | — | GST | AI-safe status update to share with the guest. Updated at key transitions. |
| `resolved_at` | `timestamptz` | YES | NO | — | INT | |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `classification_source` | `classification_source` | YES | NO | — | INT | How urgency was determined |
| `assigned_partner_id` | `uuid` | YES | NO | — | INT | → `users.id`. Set when `status = 'assigned'`. |
| `routing_attempt_count` | `integer` | NO | NO | `0` | INT | Number of partners contacted. Incremented on each routing attempt. |
| `routing_history` | `jsonb` | YES | NO | — | INT | Array of routing attempt objects. Each entry: `{partner_id, routed_at, response_deadline, outcome}` |
| `active_partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. Current PartnerRequest for live routing. Updated each time routing moves to a new partner. Points to whichever PartnerRequest is currently `pending_acceptance`, `accepted`, or `in_progress`. |
| `escalation_id` | `uuid` | YES | NO | — | INT | → `escalation_records.id` |
| `dispute_id` | `uuid` | YES | NO | — | INT | → `dispute_records.id` |
| `completion_notes` | `text` | YES | NO | — | INT | Partner's completion note |
| `completion_photos` | `text[]` | YES | NO | — | INT | CDN URLs. PTR-scoped — visible to partner, homeowner, operator. Not guest-visible. |
| `verified_at` | `timestamptz` | YES | NO | — | INT | When homeowner verified or auto-verified |
| `verified_by` | `verified_by_type` | YES | NO | — | INT | |
| `cancelled_at` | `timestamptz` | YES | NO | — | INT | |
| `cancellation_reason` | `cancellation_reason` | YES | NO | — | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE service_requests
  ADD CONSTRAINT sr_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT sr_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT sr_assigned_partner_fk FOREIGN KEY (assigned_partner_id) REFERENCES users (id),
  ADD CONSTRAINT sr_linked_partner_request_fk FOREIGN KEY (linked_partner_request_id) REFERENCES partner_requests (id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT sr_active_partner_request_fk FOREIGN KEY (active_partner_request_id) REFERENCES partner_requests (id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT sr_escalation_fk FOREIGN KEY (escalation_id) REFERENCES escalation_records (id),
  ADD CONSTRAINT sr_dispute_fk FOREIGN KEY (dispute_id) REFERENCES dispute_records (id);
-- Note: sr_linked_partner_request_fk and sr_active_partner_request_fk are DEFERRABLE because
-- service_requests and partner_requests have a circular FK dependency. Resolve at insert time
-- by inserting service_request first with null, then partner_request, then updating the FK.
```

**Indexes:**
- `service_requests_pkey` — PRIMARY KEY on `id`
- `sr_property_status_idx` — on `(property_id, status)` — homeowner dashboard active requests
- `sr_reservation_id_idx` — on `reservation_id`
- `sr_status_urgency_idx` — on `(status, urgency)` — operator queue: open urgent requests
- `sr_created_at_idx` — on `created_at DESC` — chronological request feed
- `sr_escalation_id_idx` — on `escalation_id` WHERE `escalation_id IS NOT NULL` — escalation-linked request lookups

---

### 3.11 — `tasks`

**Purpose:** An operational to-do item tied to a property, owned by the homeowner.

**Source:** data-models.md Model 10

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `owner_id` | `uuid` | NO | NO | — | INT | → `users.id` |
| `title` | `text` | NO | NO | — | INT | |
| `description` | `text` | YES | NO | — | INT | |
| `task_type` | `task_type` | NO | NO | — | INT | |
| `priority` | `task_priority` | NO | NO | `'normal'` | INT | |
| `status` | `task_status` | NO | NO | `'pending'` | INT | |
| `due_date` | `date` | YES | NO | — | INT | |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. Optional link to the reservation this task supports. `ON DELETE SET NULL` — task is retained if reservation is deleted. Set at task creation when homeowner selects a related reservation. Added: migration 002. |
| `task_value_amount` | `numeric(10,2)` | YES | NO | — | INT | Gross service charge for the task. This is the homeowner's operational cost. Never modified by commission logic. Homeowner-facing views display this as full task cost. Partner-facing views must never display this — partners see only net earning derived from `commission_rules`. Added: migration 006. |
| `task_value_currency` | `text` | NO | NO | `'EUR'` | INT | ISO 4217 currency code. Default: `EUR`. Added: migration 006. |
| `assigned_partner_id` | `uuid` | YES | NO | — | INT | → `users.id`. Partner assigned to this task. Set when status transitions to `assigned`. Live FK anchor for partner assignment (replaces the draft-era `assigned_partner_request_id` as the active assignment mechanism). |
| `assigned_partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. If task resulted in a PartnerRequest job. Dormant at MVP — `assigned_partner_id` is the active assignment FK. |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `completed_at` | `timestamptz` | YES | NO | — | INT | Set when `status` transitions to `completed` |

**Constraints:**
```sql
ALTER TABLE tasks
  ADD CONSTRAINT tasks_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT tasks_owner_fk FOREIGN KEY (owner_id) REFERENCES users (id),
  ADD CONSTRAINT tasks_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id) ON DELETE SET NULL,
  ADD CONSTRAINT tasks_assigned_partner_fk FOREIGN KEY (assigned_partner_id) REFERENCES users (id),
  ADD CONSTRAINT tasks_partner_request_fk FOREIGN KEY (assigned_partner_request_id) REFERENCES partner_requests (id),
  ADD CONSTRAINT tasks_value_amount_positive CHECK (task_value_amount IS NULL OR task_value_amount >= 0);
```

**Indexes:**
- `tasks_pkey` — PRIMARY KEY on `id`
- `tasks_property_status_idx` — on `(property_id, status)` — homeowner task list
- `tasks_owner_id_idx` — on `owner_id`
- `tasks_reservation_id_idx` — on `reservation_id` — reservation-linked task lookups and Financial Summary aggregation
- `tasks_assigned_partner_id_idx` — on `(assigned_partner_id, status)` — partner's assigned task queue
- `tasks_due_date_idx` — on `(due_date, status)` WHERE `status IN ('open', 'assigned', 'accepted', 'in_progress')` — upcoming task reminders

---

### 3.12 — `partner_requests`

**Purpose:** Supply-side execution record — a specific service job sent to a specific partner. The central model for the operations workflow.

**Source:** data-models.md Model 11 (base) + service-request-flow.md §4.1 and §6.1 (extended timing fields)

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `homeowner_id` | `uuid` | NO | NO | — | INT | → `users.id` |
| `partner_id` | `uuid` | YES | NO | — | INT | → `users.id`. Null until partner accepts or is assigned. |
| `service_request_id` | `uuid` | YES | NO | — | INT | → `service_requests.id`. Set if triggered by a ServiceRequest. |
| `service_type` | `service_type` | NO | NO | — | INT | |
| `title` | `text` | NO | NO | — | INT | Short description of the job |
| `description` | `text` | YES | NO | — | INT | Full details for the partner |
| `priority` | `task_priority` | NO | NO | `'normal'` | INT | |
| `requested_date` | `date` | NO | NO | — | INT | Date the job should happen |
| `requested_time` | `time` | YES | NO | — | INT | Preferred start time |
| `notes_for_partner` | `text` | YES | NO | — | PTR | Additional instructions visible to partner only |
| `agreed_payout_eur` | `numeric(10,2)` | YES | NO | — | INT | Direct billing amount (homeowner pays partner directly) |
| `nauxica_commission_eur` | `numeric(10,2)` | YES | NO | — | INT | Only if Nauxica coordinates this job |
| `status` | `partner_request_status` | NO | NO | `'new'` | INT | |
| `partner_completion_notes` | `text` | YES | NO | — | PTR | Partner's notes on job completion |
| `completion_photo_urls` | `text[]` | YES | NO | — | INT | CDN URLs |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `accepted_at` | `timestamptz` | YES | NO | — | INT | |
| `completed_at` | `timestamptz` | YES | NO | — | INT | |
| `sent_at` | `timestamptz` | YES | NO | — | INT | When the PartnerRequest was dispatched to the partner |
| `response_deadline` | `timestamptz` | YES | NO | — | INT | `sent_at` + response window for service type. Background process monitors this. |
| `started_at` | `timestamptz` | YES | NO | — | INT | When partner tapped "Start job" |

**Constraints:**
```sql
ALTER TABLE partner_requests
  ADD CONSTRAINT pr_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT pr_homeowner_fk FOREIGN KEY (homeowner_id) REFERENCES users (id),
  ADD CONSTRAINT pr_partner_fk FOREIGN KEY (partner_id) REFERENCES users (id),
  ADD CONSTRAINT pr_service_request_fk FOREIGN KEY (service_request_id) REFERENCES service_requests (id) DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT pr_payout_positive CHECK (agreed_payout_eur IS NULL OR agreed_payout_eur >= 0),
  ADD CONSTRAINT pr_commission_positive CHECK (nauxica_commission_eur IS NULL OR nauxica_commission_eur >= 0);
```

**Indexes:**
- `partner_requests_pkey` — PRIMARY KEY on `id`
- `pr_partner_status_idx` — on `(partner_id, status)` — partner's job queue
- `pr_property_id_idx` — on `property_id`
- `pr_service_request_id_idx` — on `service_request_id`
- `pr_response_deadline_idx` — on `response_deadline` WHERE `status = 'new'` — timeout monitoring background process

---

### 3.13 — `messages`

**Purpose:** In-platform messages between homeowners and partners. Does not model WhatsApp guest messages (those are external at MVP, tracked via `whatsapp_sessions`).

**Source:** data-models.md Model 12

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `sender_id` | `uuid` | NO | NO | — | INT | → `users.id` |
| `recipient_id` | `uuid` | NO | NO | — | INT | → `users.id` |
| `account_type_context` | `account_type_context` | NO | NO | — | INT | Renders correct UI view |
| `message_type` | `message_type` | NO | NO | — | INT | |
| `subject` | `text` | YES | NO | — | INT | |
| `body` | `text` | NO | NO | — | INT | |
| `is_read` | `boolean` | NO | NO | `false` | INT | |
| `is_archived` | `boolean` | NO | NO | `false` | INT | |
| `related_partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. If message is about a specific job. |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_fk FOREIGN KEY (sender_id) REFERENCES users (id),
  ADD CONSTRAINT messages_recipient_fk FOREIGN KEY (recipient_id) REFERENCES users (id),
  ADD CONSTRAINT messages_partner_request_fk FOREIGN KEY (related_partner_request_id) REFERENCES partner_requests (id),
  ADD CONSTRAINT messages_sender_recipient_diff CHECK (sender_id != recipient_id);
```

**Indexes:**
- `messages_pkey` — PRIMARY KEY on `id`
- `messages_recipient_read_idx` — on `(recipient_id, is_read, created_at DESC)` — inbox unread count and list
- `messages_sender_id_idx` — on `sender_id`
- `messages_partner_request_id_idx` — on `related_partner_request_id`

---

### 3.14 — `reviews`

**Purpose:** Rating and comment records. Three review directions: guest → property (post-stay), homeowner → partner (post-job), partner → homeowner (post-job).

**Source:** data-models.md Model 13

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `review_type` | `review_type` | NO | NO | — | INT | |
| `reviewer_id` | `uuid` | YES | NO | — | INT | → `users.id`. Null for guest reviews (no account). |
| `reviewer_name` | `text` | NO | NO | — | PUB | Display name |
| `reviewer_guest_phone` | `text` | YES | NO | — | INT | For guest reviews only. ⚠️ Legal review required — retention and anonymisation policy needed. |
| `subject_id` | `uuid` | NO | NO | — | INT | References `users.id` (for partner reviews) or `properties.id` (for property reviews). No FK constraint — polymorphic reference. |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. Required for `guest_to_property` reviews. |
| `partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. Required for `homeowner_to_partner` and `partner_to_homeowner` reviews. |
| `rating` | `integer` | NO | NO | — | PUB | 1–5 |
| `comment` | `text` | YES | NO | — | PUB | |
| `is_visible` | `boolean` | NO | NO | `true` | PUB | False if disputed and under review |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE reviews
  ADD CONSTRAINT reviews_reviewer_fk FOREIGN KEY (reviewer_id) REFERENCES users (id),
  ADD CONSTRAINT reviews_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT reviews_partner_request_fk FOREIGN KEY (partner_request_id) REFERENCES partner_requests (id),
  ADD CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  -- Guest reviews require reservation_id; partner/homeowner reviews require partner_request_id:
  ADD CONSTRAINT reviews_guest_reservation_required
    CHECK (review_type != 'guest_to_property' OR reservation_id IS NOT NULL),
  ADD CONSTRAINT reviews_partner_request_required
    CHECK (review_type = 'guest_to_property' OR partner_request_id IS NOT NULL);
-- subject_id is a polymorphic reference and does not have a DB-level FK constraint.
-- Application layer must validate: guest_to_property → subject_id = properties.id;
-- homeowner_to_partner / partner_to_homeowner → subject_id = users.id
```

**Indexes:**
- `reviews_pkey` — PRIMARY KEY on `id`
- `reviews_subject_id_type_idx` — on `(subject_id, review_type)` — partner/property rating aggregation
- `reviews_reservation_id_idx` — on `reservation_id`
- `reviews_partner_request_id_idx` — on `partner_request_id`

---

### 3.15 — `dispute_records`

**Purpose:** Tracks disputes between platform actors. Created when a homeowner reports an issue at job verification, or when any party files a formal dispute. One dispute per incident.

**Source:** dispute-resolution.md (Incident Logging Requirements + Resolution Lifecycle). Added to schema by founder decision on 2026-05-29 to resolve the orphan `dispute_id` reference on `service_requests`.

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key. Referenced as `dispute_id` in FK columns. |
| `dispute_type` | `dispute_type` | NO | NO | — | INT | D-01 through D-10 — see enum definition in §2 |
| `reported_by` | `text` | NO | NO | — | INT | `users.id` (as text) for authenticated users, or `guest_phone_hash` for guest reporters. Text type to support both cases. |
| `reported_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. If applicable. |
| `service_request_id` | `uuid` | YES | NO | — | INT | → `service_requests.id`. If triggered by a service request. |
| `partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. Required for D-05 through D-08. |
| `status` | `dispute_status` | NO | NO | `'reported'` | INT | |
| `description` | `text` | NO | NO | — | INT | Submitting party's account |
| `evidence_urls` | `text[]` | YES | NO | — | INT | CDN URLs. Populated once evidence is collected. |
| `assigned_operator_id` | `uuid` | YES | NO | — | INT | → `users.id`. Assigned at `under_review` status. ⚠️ **MVP note:** Future-facing internal field — no `operator` account_type exists at MVP. Null at Sicily launch. See [auth-strategy.md](auth-strategy.md) §7. |
| `resolution_summary` | `text` | YES | NO | — | INT | Required when status transitions to `resolved` |
| `resolution_type` | `resolution_type` | YES | NO | — | INT | |
| `resolved_at` | `timestamptz` | YES | NO | — | INT | |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE dispute_records
  ADD CONSTRAINT dr_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT dr_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT dr_service_request_fk FOREIGN KEY (service_request_id) REFERENCES service_requests (id),
  ADD CONSTRAINT dr_partner_request_fk FOREIGN KEY (partner_request_id) REFERENCES partner_requests (id),
  ADD CONSTRAINT dr_operator_fk FOREIGN KEY (assigned_operator_id) REFERENCES users (id);
```

**Indexes:**
- `dispute_records_pkey` — PRIMARY KEY on `id`
- `dr_status_idx` — on `(status, reported_at DESC)` — operator dispute queue
- `dr_property_id_idx` — on `property_id`
- `dr_partner_request_id_idx` — on `partner_request_id` — partner dispute history
- `dr_service_request_id_idx` — on `service_request_id`

---

### 3.16 — `access_code_delivery_logs`

**Purpose:** Audit log for every credential delivery event. Populated by the KBB whenever a block is served with live guest credentials, and by the partner dispatch layer whenever access codes are delivered to a partner. Retained 90 days minimum for security audit and dispute resolution.

**Source:** knowledge-retrieval-model.md §11.3 · security-model.md §11 · partner-assignment-model.md §11

⚠️ **(Legal review required)** Access code delivery logs constitute a record of credential issuance and must be retained as evidence of authorisation for insurance and dispute purposes. Confirm retention period and access controls before implementation.

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `session_id` | `uuid` | YES | NO | — | INT | → `whatsapp_sessions.id`. Present for guest deliveries; null for partner deliveries. |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. Present for guest deliveries. |
| `partner_id` | `uuid` | YES | NO | — | INT | → `users.id`. Present for partner access code deliveries; null for guest deliveries. |
| `partner_request_id` | `uuid` | YES | NO | — | INT | → `partner_requests.id`. Present when delivery is triggered by a confirmed PartnerRequest. |
| `code_type` | `text` | NO | NO | — | INT | Delivery context. Values: `'guest_whatsapp'` (guest credential via AI concierge), `'partner_message'` (partner code via in-platform message), `'partner_brief'` (included in assignment briefing). |
| `credential_types` | `text[]` | NO | NO | — | INT | Names of credential fields delivered. e.g. `{key_box_code,wifi_password}`. From knowledge-retrieval-model.md §11.3. |
| `delivered_at` | `timestamptz` | NO | NO | — | INT | When the delivery event occurred |
| `session_phase` | `session_phase` | YES | NO | — | INT | Session phase at time of delivery. Present for guest deliveries; null for partner deliveries. |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |

**Constraints:**
```sql
ALTER TABLE access_code_delivery_logs
  ADD CONSTRAINT acdl_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT acdl_session_fk FOREIGN KEY (session_id) REFERENCES whatsapp_sessions (id),
  ADD CONSTRAINT acdl_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT acdl_partner_fk FOREIGN KEY (partner_id) REFERENCES users (id),
  ADD CONSTRAINT acdl_partner_request_fk FOREIGN KEY (partner_request_id) REFERENCES partner_requests (id),
  ADD CONSTRAINT acdl_code_type_check CHECK (code_type IN ('guest_whatsapp', 'partner_message', 'partner_brief'));
```

**Indexes:**
- `access_code_delivery_logs_pkey` — PRIMARY KEY on `id`
- `acdl_property_delivered_idx` — on `(property_id, delivered_at DESC)` — property-level delivery audit
- `acdl_reservation_id_idx` — on `reservation_id` — per-reservation delivery history
- `acdl_partner_request_id_idx` — on `partner_request_id` — partner access audit

---

### 3.17 — `retrieval_audit_records`

**Purpose:** Audit log for every KBB call. Records what property knowledge was served to the AI concierge, in what state, and with what result. Used for observability, hallucination monitoring, and legal auditability.

**Source:** knowledge-retrieval-model.md §14.1

⚠️ **(Legal review required)** Confirm whether retrieval logs constitute personal data processing records under GDPR Article 30. Retention period must be defined before implementation. See [legal-review-tracker.md](../legal/legal-review-tracker.md).

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `retrieval_id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key. Named `retrieval_id` to match the source object in knowledge-retrieval-model.md §14.1 and for clarity in FK references from `escalation_traces`. |
| `session_id` | `uuid` | NO | NO | — | INT | → `whatsapp_sessions.id` |
| `property_id` | `uuid` | NO | NO | — | INT | → `properties.id` |
| `reservation_id` | `uuid` | YES | NO | — | INT | → `reservations.id`. Null for pre-anchor calls. |
| `language` | `text` | NO | NO | — | INT | ISO 639-1 language code used for this retrieval |
| `session_phase` | `session_phase` | NO | NO | — | INT | Session phase at time of KBB call |
| `kbb_status` | `text` | NO | NO | — | INT | KBB outcome. Values: `'ok'`, `'degraded'`, `'unavailable'`. Enforced by CHECK constraint below. |
| `degraded_reason` | `text` | YES | NO | — | INT | Populated when `kbb_status = 'degraded'` or `'unavailable'` |
| `schema_version` | `text` | NO | NO | — | INT | PropertyKnowledgeBlock schema version served |
| `emergency_data_complete` | `boolean` | NO | NO | — | INT | Whether EmergencyData was complete at time of call |
| `access_codes_gated` | `boolean` | NO | NO | — | INT | True if any credential was replaced with sentinel value |
| `dynamic_instructions_applied` | `integer` | NO | NO | `0` | INT | Count of DynamicInstruction overrides applied in KBB Step 3 |
| `chunks_served` | `text[]` | NO | NO | — | INT | Names of chunks included in the assembled block |
| `cache_hit` | `boolean` | NO | NO | — | INT | True if property cache was hit (7-step pipeline did not re-run) |
| `emergency_cache_hit` | `boolean` | NO | NO | — | INT | True if emergency cache was hit |
| `kbb_latency_ms` | `integer` | NO | NO | — | INT | End-to-end KBB pipeline latency in milliseconds |
| `generated_at` | `timestamptz` | NO | NO | — | INT | When the KBB call completed |

**Constraints:**
```sql
ALTER TABLE retrieval_audit_records
  ADD CONSTRAINT rar_session_fk FOREIGN KEY (session_id) REFERENCES whatsapp_sessions (id),
  ADD CONSTRAINT rar_property_fk FOREIGN KEY (property_id) REFERENCES properties (id),
  ADD CONSTRAINT rar_reservation_fk FOREIGN KEY (reservation_id) REFERENCES reservations (id),
  ADD CONSTRAINT rar_kbb_status_check CHECK (kbb_status IN ('ok', 'degraded', 'unavailable'));
```

**Indexes:**
- `retrieval_audit_records_pkey` — PRIMARY KEY on `retrieval_id`
- `rar_session_id_idx` — on `session_id` — session-level retrieval history
- `rar_property_id_idx` — on `(property_id, generated_at DESC)` — property-level monitoring
- `rar_generated_at_idx` — on `generated_at DESC` — chronological audit log access

---

### 3.18 — `escalation_traces`

**Purpose:** Links each escalation event to the exact KBB retrieval record active when escalation was triggered. Enables post-incident reconstruction of exactly what knowledge the AI had at the moment it escalated.

**Source:** knowledge-retrieval-model.md §14.2

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `escalation_id` | `uuid` | NO | YES | — | INT | → `escalation_records.id`. One trace per escalation. |
| `retrieval_id` | `uuid` | NO | NO | — | INT | → `retrieval_audit_records.retrieval_id`. The KBB call active when escalation was triggered. |
| `trigger_message_text` | `text` | NO | NO | — | INT | The guest message that triggered escalation. ⚠️ Contains guest-provided text — subject to GDPR data minimisation review. |
| `trigger_type` | `escalation_trigger_type` | NO | NO | — | INT | Escalation trigger code |
| `chunks_loaded_at_trigger` | `text[]` | NO | NO | — | INT | Chunks loaded in the context window at trigger time |
| `unresolved_query_count_at_trigger` | `integer` | NO | NO | — | INT | Value of `whatsapp_sessions.unresolved_query_count` at trigger time |

**Constraints:**
```sql
ALTER TABLE escalation_traces
  ADD CONSTRAINT et_escalation_fk FOREIGN KEY (escalation_id) REFERENCES escalation_records (id),
  ADD CONSTRAINT et_retrieval_fk FOREIGN KEY (retrieval_id) REFERENCES retrieval_audit_records (retrieval_id),
  ADD CONSTRAINT et_escalation_unique UNIQUE (escalation_id);
```

**Indexes:**
- `escalation_traces_pkey` — PRIMARY KEY on `id`
- `et_escalation_id_idx` — UNIQUE on `escalation_id` — one trace per escalation
- `et_retrieval_id_idx` — on `retrieval_id`

---

### 3.19 — `commission_rules`

**Purpose:** Platform commission rate table. Defines the fraction of `task_value_amount` that Nauxica retains from each task's gross service charge; the remainder is paid to the partner. MVP has a single global row. Post-MVP supports per-homeowner, per-partner, per-property, and per-task-type overrides resolved by specificity order.

**Source:** data-models.md Model 14 · migration 009

> ⚠️ **Access restriction:** Commission rules are an internal Nauxica–Partner financial contract. Homeowner-facing pages must **never** reference this table. No homeowner view may display commission rate, Nauxica fee, partner earning, or payout. The homeowner's cost is always `task_value_amount` (full gross charge). See [data-visibility-model.md](../architecture/data-visibility-model.md).

| Column | Type | Nullable | Unique | Default | Visibility | Notes |
|---|---|---|---|---|---|---|
| `id` | `uuid` | NO | YES | `gen_random_uuid()` | INT | Primary key |
| `scope_type` | `text` | NO | NO | — | INT | Scope of this rule. MVP value: `'global'`. Post-MVP: `'homeowner'`, `'partner'`, `'property'`, `'task_type'`. |
| `scope_id` | `uuid` | YES | NO | — | INT | References the relevant entity for scoped rules. NULL for the global rule. No DB-level FK — polymorphic reference resolved at application layer. |
| `rate` | `numeric(5,4)` | NO | NO | — | INT | Commission fraction. Example: `0.1500` = 15%. Partner earning = `task_value_amount × (1 − rate)`. |
| `valid_from` | `date` | NO | NO | `CURRENT_DATE` | INT | Inclusive effective date. |
| `valid_to` | `date` | YES | NO | — | INT | Exclusive end date. NULL = open-ended (currently active). |
| `created_at` | `timestamptz` | NO | NO | `now()` | INT | |
| `updated_at` | `timestamptz` | NO | NO | `now()` | INT | |

**MVP seed row:**
```sql
INSERT INTO public.commission_rules (scope_type, scope_id, rate, valid_from, valid_to)
  VALUES ('global', NULL, 0.1500, CURRENT_DATE, NULL);
```

**RLS:**
```sql
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_authenticated_read"
  ON public.commission_rules
  FOR SELECT
  TO authenticated
  USING (true);
-- No INSERT / UPDATE / DELETE policies for authenticated role.
-- Mutations require service_role (Supabase dashboard or backend function only).
```

**Constraints:**
```sql
ALTER TABLE commission_rules
  ADD CONSTRAINT commission_rules_rate_range CHECK (rate >= 0 AND rate < 1),
  ADD CONSTRAINT commission_rules_dates_valid CHECK (valid_to IS NULL OR valid_to > valid_from);
```

**Indexes:**
- `commission_rules_pkey` — PRIMARY KEY on `id`
- `idx_commission_rules_scope` — on `(scope_type, scope_id, valid_from)` — primary resolution query: find active rule for a given scope

---

## 4. Relationship Diagram

```
users (homeowner)
└── properties
    ├── property_knowledge_blocks  (one-to-one)
    ├── emergency_data             (one-to-one)
    ├── partner_assignments ──────► users (partner)
    ├── reservations
    │   ├── guest_stay_contexts    (one-to-one, created at check-in)
    │   ├── whatsapp_sessions      (zero or one active per reservation)
    │   │   └── escalation_records (zero or one active per session)
    │   ├── service_requests ─────► escalation_records
    │   │   └── dispute_records
    │   ├── partner_requests ─────► users (partner)
    │   └── reviews (guest_to_property)
    └── tasks ──────0-1──────────► reservations (optional link, ON DELETE SET NULL)

users (homeowner) ──► messages ◄── users (partner)
partner_requests ──► reviews (homeowner_to_partner, partner_to_homeowner)
service_requests ──► partner_requests  (via linked_partner_request_id)
partner_requests ──► service_requests  (via service_request_id — circular, DEFERRABLE FK)

commission_rules  (standalone lookup table — no FK from other tables at MVP;
                   read at render time by partner-facing views only)
```

**Key cardinalities:**
- `users (homeowner)` → many `properties`
- `properties` → exactly one `property_knowledge_blocks`
- `properties` → exactly one `emergency_data`
- `properties` → many `partner_assignments` (up to one active per service type, or multiple with priority ranks)
- `properties` → many `reservations` (non-overlapping dates enforced at API layer)
- `reservations` → exactly one `guest_stay_contexts` (created at check-in)
- `reservations` → zero or one active `whatsapp_sessions`
- `whatsapp_sessions` → zero or one active `escalation_records`
- `service_requests` → one or many `partner_requests` (one per routing attempt)
- `partner_requests` → zero or one `users (partner)` (null until accepted)
- `partner_requests` → zero or many `reviews`
- `service_requests` → zero or one `dispute_records`

---

## 5. Index Strategy

| Index | Table | Columns | Type | Why |
|---|---|---|---|---|
| `ws_guest_phone_status_idx` | `whatsapp_sessions` | `(guest_phone, session_status)` | B-tree | Most frequent lookup in the system. Every inbound WhatsApp message resolves the active session by phone number. |
| `reservations_guest_phone_idx` | `reservations` | `guest_phone` | B-tree | Session resolution fallback — when no session exists, find active reservation by phone. |
| `reservations_status_checkin_idx` | `reservations` | `(reservation_status, checkin_date)` | B-tree | Active stay queries; pre-arrival transition processing. |
| `pa_dispatch_lookup_idx` | `partner_assignments` | `(property_id, service_type, assignment_status)` | B-tree | Hit on every ServiceRequest routing call. Must be fast. |
| `pa_priority_idx` | `partner_assignments` | `(property_id, service_type, priority_rank)` WHERE `assignment_status = 'active'` | Partial B-tree | Secondary dispatch sort. Partial index keeps it small. |
| `er_status_idx` | `escalation_records` | `(escalation_status, created_at DESC)` | B-tree | Operator dashboard: open escalation queue. |
| `pr_response_deadline_idx` | `partner_requests` | `response_deadline` WHERE `status = 'new'` | Partial B-tree | Background timeout monitor. Scans only unresponded requests. |
| `sr_status_urgency_idx` | `service_requests` | `(status, urgency)` | B-tree | Operator queue: open urgent requests. |
| `gsc_active_service_requests_idx` | `guest_stay_contexts` | `active_service_requests` | GIN | Array membership query: "does this stay have a pending service request?" |
| `dr_status_idx` | `dispute_records` | `(status, reported_at DESC)` | B-tree | Operator dispute queue. |
| `reviews_subject_id_type_idx` | `reviews` | `(subject_id, review_type)` | B-tree | Partner and property rating aggregation. |
| `messages_recipient_read_idx` | `messages` | `(recipient_id, is_read, created_at DESC)` | B-tree | Inbox unread count and sorted message list. |
| `pkb_property_id_idx` | `property_knowledge_blocks` | `property_id` | UNIQUE B-tree | AI concierge context loading — direct UUID lookup; enforces one knowledge block per property. |
| `sr_escalation_id_idx` | `service_requests` | `escalation_id` | Partial B-tree | Finds all service requests linked to a given escalation. Enables reverse lookup when an escalation is closed and linked open requests must be reviewed. WHERE `escalation_id IS NOT NULL`. |
| `tasks_reservation_id_idx` | `tasks` | `reservation_id` | B-tree | Reservation-linked task lookups; used by Financial Summary to aggregate operational costs per reservation. |
| `tasks_assigned_partner_id_idx` | `tasks` | `(assigned_partner_id, status)` | B-tree | Partner's assigned task queue on dashboard-partner.html. |
| `idx_commission_rules_scope` | `commission_rules` | `(scope_type, scope_id, valid_from)` | B-tree | Primary resolution query for active commission rate; scanned once at partner dashboard page load. |

---

## 6. MVP vs Post-MVP Fields

### MVP-required (block activation if absent)

| Table | Column | Blocking condition |
|---|---|---|
| `emergency_data` | `is_complete = true` | Property cannot activate |
| `property_knowledge_blocks` | `is_complete = true` | Property cannot activate |
| `users` | `is_identity_verified = true` | Partner cannot be activated |
| `users` | `background_check_status = 'approved'` | Tier-2 partner cannot be activated |

### Post-MVP fields (present in schema, dormant at MVP)

| Table | Column | Post-MVP purpose |
|---|---|---|
| `service_requests` | `routing_history` jsonb | Full dispatch audit log — MVP: populate but not surfaced in UI |
| `partner_assignments` | `schedule_type`, `recurring_schedule` | Auto-scheduling — MVP: schema present, logic not implemented |
| `users` | `trust_score`, `reliability_score` | Operator-assessed manually at MVP; automated calculation is post-MVP |
| `partner_requests` | `nauxica_commission_eur` | Commission tracking for the ServiceRequest/PartnerRequest workflow — MVP: dormant; manual invoice. Note: the `commission_rules` table is the canonical rate mechanism for the Task workflow. The two do not conflict — they operate on different record types. |
| `tasks` | `assigned_partner_request_id` | Links task to a PartnerRequest job — dormant at MVP; `assigned_partner_id` is the active assignment FK. |
| `reviews` | `reviewer_guest_phone` | ⚠️ Legal review required — anonymisation policy needed before this column is populated |

### Fields requiring founder decision before implementation

| Table | Column | Open decision |
|---|---|---|
| `users` | `nauxica_plan_tier` | Partner plan tiers (basic/professional) are not modelled in v1.2. Founder must confirm whether to extend this enum or add a `partner_plan_tier` column before partner billing is implemented. |
| `service_requests` | `guest_message` | Data retention period for raw guest messages not yet defined — see legal-review-tracker.md LR-04. |
| `dispute_records` | `reported_by` | Polymorphic text field for user ID or guest_phone_hash — confirm approach with legal for GDPR data minimisation. |

---

## 7. Migration Notes

The following changes from prior prototype and documentation states are reflected in this schema. Backend developers starting from any pre-v1.2 data-models.md reference must apply these corrections.

| Change | Status | Details |
|---|---|---|
| `password_hash` removed from `users` | COMPLETE 2026-06-07 | GoTrue manages password hashing and storage in `auth.users`. The `public.users` table must not contain `password_hash` — it is the application profile table only. Source: data-models.md v1.5, auth-strategy.md v1.2 §9.1. |
| `guest_nationality` made nullable | COMPLETE 2026-06-07 | Changed from `NOT NULL` to nullable (`YES`) in `reservations` table. The Add Guest wizard does not collect nationality at MVP. Alloggiati Web compliance is deferred to a later module. No default value. Source: data-models.md v1.5 Model 4. |
| `Booking` → `Reservation` | COMPLETE | The entity is named `reservations`. The PK is `id`. All child tables use `reservation_id` as the FK column name. |
| `booking_id` → `reservation_id` | COMPLETE | No column named `booking_id` exists in this schema. All FK references to reservations use `reservation_id`. |
| Service type enum values | COMPLETE | 5 canonical MVP values: `cleaning`, `maintenance`, `laundry`, `transfers`, `experiences`. No other values in the `service_type` enum. |
| Post-MVP service subtypes | COMPLETE | `pool_maintenance`, `garden_maintenance`, `concierge_in_person`, `inspection` are NOT `service_type` values. At MVP, pool and garden maintenance jobs use `service_type = 'maintenance'`. |
| `service_request_urgency` enum | RESOLVED 2026-05-29 | Approved values: `emergency`, `urgent`, `high`, `normal`, `scheduled`. The earlier compressed set (`routine`, `same_day`, `urgent`, `emergency`) from data-models.md v1.2 Model 9 is superseded. |
| `service_request_status` enum | RESOLVED 2026-05-29 | Approved 11-state machine. The earlier 5-state set from data-models.md v1.2 Model 9 is superseded. |
| TRIGGER-08 legacy name | INTENTIONAL | `escalation_trigger_type` enum uses `reservation_modification` as the canonical value. The trigger code `BOOKING_MODIFICATION_REQUEST` in `escalation-rules.md` is retained as intentional legacy — founder decision 2026-05-29. The enum value here is the canonical operational form. |
| Enum hyphens → underscores | COMPLETE | SQL enum values use underscores throughout. See §2 for source form and SQL form mapping. |
| `dispute_records` table | ADDED | New table. Added by founder decision 2026-05-29 to support referential integrity for `dispute_id` on `service_requests`. |
| `property_id` slug FK model removed | COMPLETE 2026-06-05 | `property_id` text slug column removed from `properties` table. `property_code` (`NAU-XXXXX`) added as immutable human reference — never FK. All 13 child table `property_id` columns changed from `TEXT REFERENCES properties(property_id)` to `UUID REFERENCES properties(id)`. Source: Property Identity Realignment Sprint (data-models.md v1.4). |
| `codice_fiscale_or_piva` made nullable | COMPLETE 2026-06-07 | Column changed from `NOT NULL` to nullable. Not collected at registration — set during onboarding/account verification. No placeholder value should be inserted. Source: data-models.md v1.6. |
| `plan_started_at` made nullable | COMPLETE 2026-06-07 | Column changed from `NOT NULL` to nullable at MVP. Managed by Stripe billing module. Not set at registration. Source: data-models.md v1.6. |
| `plan_renews_at` made nullable | COMPLETE 2026-06-07 | Column changed from `NOT NULL` to nullable at MVP. Same rationale as `plan_started_at`. Managed by Stripe billing module. Source: data-models.md v1.6. |
| `property_code` generation strategy documented | COMPLETE 2026-06-07 | Generation strategy clarified: server-side PostgreSQL sequence, unique, immutable, never reused, never client-generated in production. Frontend localStorage prototype generation is prototype-only. Source: database-schema.md §3.2, api/endpoints/properties.md v1.1. |
| `confirmation_number` generation strategy documented | COMPLETE 2026-06-07 | Generation strategy clarified: server-side PostgreSQL sequence in format `NX-YYYY-NNNNN`. Unique, immutable, never reused. `booking_reference` from localStorage preserved only if non-null, unique, and conforming to format. Source: database-schema.md §3.4, api/endpoints/reservations.md v1.2. |
| `tasks.reservation_id` FK added; `tasks.task_value_amount` and `task_value_currency` added | COMPLETE 2026-06-09 | **Migration 002** added `reservation_id uuid NULL REFERENCES public.reservations(id) ON DELETE SET NULL` and `idx_tasks_reservation_id` index to `tasks`. **Migration 006** added `task_value_amount numeric(10,2) NULL` and `task_value_currency text NOT NULL DEFAULT 'EUR'`. `task_value_amount` is the gross service charge — homeowner's operational cost. Never shown to guests or modified by commission logic. Source: migrations/002_tasks.sql, migrations/006_task_value.sql, data-models.md v1.7 Model 10. |
| `reservations.reservation_value_amount` and `reservation_value_currency` added | COMPLETE 2026-06-09 | **Migration 007** added `reservation_value_amount numeric(10,2) NULL` and `reservation_value_currency text NOT NULL DEFAULT 'EUR'` to `reservations`. Used for Financial Summary margin calculation in guest-detail view. Never exposed to guests or partners. Source: migrations/007_reservation_value.sql, data-models.md v1.7 Model 4. |
| `commission_rules` table created | COMPLETE 2026-06-09 | **Migration 009** created `public.commission_rules` with global default rate `0.1500` (15%). RLS: authenticated SELECT only; no authenticated INSERT/UPDATE/DELETE. Commission applies only between Nauxica and partner — homeowner-facing pages must never reference this table. Source: migrations/009_commission_rules.sql, data-models.md v1.7 Model 14. |
| `task_type`, `task_priority`, `task_status` enums corrected | COMPLETE 2026-06-09 | Live schema values documented in §2. `task_type` corrected to `cleaning, maintenance, inspection, laundry, guest_request, other`. `task_priority` corrected (`important` → `high`). `task_status` corrected to 6-state lifecycle: `open, assigned, accepted, in_progress, completed, cancelled` (`accepted` added in migration 004). Source: data-models.md v1.7 DM-3. |

---

## 8. Validation Checklist

| Check | Status |
|---|---|
| Every table maps to a canonical model in data-models.md v1.7 (or dispute-resolution.md for dispute_records) | ✓ 19 tables; 14 from data-models.md + 1 from dispute-resolution.md by founder decision + 3 audit/logging tables (access_code_delivery_logs, retrieval_audit_records, escalation_traces) + 1 commission_rules (migration 009, Model 14) |
| Every FK column points to a table defined in this schema | ✓ All FKs resolved. Circular FK between service_requests and partner_requests is marked DEFERRABLE. |
| Every enum has values from source documentation | ✓ All enums traced to source document. Source forms and SQL forms both documented in §2. |
| No `booking_id` columns remain | ✓ All reservation FKs use `reservation_id`. |
| `service_requests` and `partner_assignments` use only the 5 approved MVP service types | ✓ Both tables reference the `service_type` enum which contains only the 5 MVP values. |
| No duplicate tables | ✓ 18 unique tables. |
| Relationship diagram matches schema FKs | ✓ All relationships in §4 correspond to FK constraints defined in §3. |
| No placeholder values remain | ✓ All founder decisions documented and resolved. Remaining open items are explicitly flagged in §6. |
| `TRIGGER-08` legacy name documented | ✓ §2 escalation_trigger_type enum includes inline note. §7 migration notes include entry. |
| `platform_status` enum extended with `draft`, `onboarding`, `pending_activation` states | ✓ Enum updated to 6 states; `properties` table default changed from `'pending'` to `'draft'`. Source: data-models.md v1.3. |
| `availability_status` enum and column added to `properties` | ✓ New enum and nullable column added. Controls booking availability independent of `platform_status`. Null until activation. |
| `property_id` slug FK model removed; `property_code` UUID FK model applied | ✓ `property_id` text column removed from `properties`. `property_code` (NAU-XXXXX) added with UNIQUE constraint. All 13 child table `property_id` columns are now `uuid REFERENCES properties(id)`. Source: data-models.md v1.4. |
| `password_hash` removed from `users` table | ✓ Column removed. GoTrue manages credentials in `auth.users`. `public.users` is the application profile table only. Source: data-models.md v1.5. |
| `guest_nationality` is nullable in `reservations` table | ✓ Changed from `NOT NULL` to nullable. Alloggiati Web compliance deferred to a later module. Source: data-models.md v1.5. |
| `codice_fiscale_or_piva` is nullable in `users` table | ✓ Column nullable. Not collected at registration. Set during onboarding/account verification. No placeholder value. Source: data-models.md v1.6. |
| `plan_started_at` and `plan_renews_at` are nullable in `users` table | ✓ Both columns nullable at MVP. Managed by Stripe billing module. Not set at registration. Source: data-models.md v1.6. |
| `property_code` generation strategy documented | ✓ Server-side PostgreSQL sequence. Format `NAU-XXXXX`. Unique, immutable, never client-generated in production. See §3.2 and §7. |
| `confirmation_number` generation strategy documented | ✓ Server-side PostgreSQL sequence. Format `NX-YYYY-NNNNN`. Auto-generated if not provided by client. See §3.4 and §7. |
| `reservations.reservation_value_amount` and `reservation_value_currency` present in schema | ✓ Added in §3.4. Source: migration 007. |
| `tasks.reservation_id` FK present; `ON DELETE SET NULL` behaviour documented | ✓ Added in §3.11 with FK constraint and `tasks_reservation_id_idx` index. Source: migration 002. |
| `tasks.task_value_amount` and `task_value_currency` present in schema | ✓ Added in §3.11. Visibility rule documented: homeowner sees full amount; partner-facing views derive net earning only. Source: migration 006. |
| `commission_rules` table present as §3.19 | ✓ Full column table, constraints, RLS policy, seed row, and index documented. Commission applies only between Nauxica and partner. Source: migration 009. |
| `task_type` enum matches live schema | ✓ Updated in §2: `cleaning, maintenance, inspection, laundry, guest_request, other`. Source: DS-3 (2026-06-09). |
| `task_priority` enum matches live schema | ✓ Updated in §2: `low, normal, high, urgent` (`important` removed). Source: DS-3 (2026-06-09). |
| `task_status` enum matches live 6-state lifecycle | ✓ Updated in §2: `open, assigned, accepted, in_progress, completed, cancelled`. Source: DS-3 (2026-06-09). |
| No duplicate tables | ✓ 19 unique tables. |

---

## 9. Related Documents

- [data-models.md](data-models.md) — Logical model definitions (primary source of truth, v1.7)
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Visibility scope taxonomy (PUB/GST/PTR/INT)
- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — partner_assignments extended field definitions (§3)
- [service-request-flow.md](../operations/service-request-flow.md) — service_requests and partner_requests extended field definitions (§11)
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — dispute_records field definitions
- [scoring-model.md](../trust-safety/scoring-model.md) — trust_score and reliability_score operational definitions
- [property-data-schema.md](../property-intake/property-data-schema.md) — Full properties column list
- [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) — Full property_knowledge_blocks column list
- [legal-review-tracker.md](../legal/legal-review-tracker.md) — Legal review status for schema-level obligations
