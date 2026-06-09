# localStorage to Backend Migration

**Version:** 1.3
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Frontend-to-backend data migration contract
**Last updated:** 2026-06-07

> **v1.3 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-3: §2 updated — `property_code` generation note added; prototype-generated codes must be verified or replaced with production-sequence codes. CB-NEW-4: OQ-2 in §3 updated — `booking_reference` carried forward as `confirmation_number` only if non-null, unique, and conforming to `NX-YYYY-NNNNN` format; non-conforming values replaced by server-generated code. §13 added: Backend Readiness Note — distinguishes schema-foundation blockers from production-launch blockers.

> **v1.2 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-C: OQ-5 resolved — `guest_nationality` is now nullable at MVP (source: database-schema.md v1.3 §3.4, data-models.md v1.5 Model 4). Alloggiati Web compliance deferred to a later module; no default value. OQ-5 entry in §12 updated to resolved.

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. §4: `homeowner_id` corrected to `owner_id` in tasks migration-time fields (source: `tasks.owner_id` in database-schema.md §3.11). §4.1: priority mapping corrected — `High → important`, `Medium → normal`, `Urgent → urgent` (source: `task_priority` enum in database-schema.md §2). §5: status normalisation note added for `partner_request_status` enum; `linked_service_request_id` renamed to `service_request_id`. §6: `date → sent_at` corrected to `date → created_at`; `homeowner_id` removed; `sender_id`, `recipient_id`, `account_type_context` migration notes added. §6.1: `guest → nauxica` (source: `message_type` enum in database-schema.md §2). §7: `date → review_date` corrected to `date → created_at`; `homeowner_id` and `platform` removed; `review_type` and `subject_id` migration notes added. OQ-5 added: `guest_nationality` NOT NULL in schema but not collected by wizard.
**Related:** [data-models.md](data-models.md) · [database-schema.md](database-schema.md) · [api/api-overview.md](../api/api-overview.md) · [api/endpoints/properties.md](../api/endpoints/properties.md) · [api/endpoints/reservations.md](../api/endpoints/reservations.md)

---

## Purpose

This document defines the mapping between the frontend's `nauxicaDemoState` localStorage structure and the canonical Supabase backend tables. It is the implementation contract for the one-time migration from local demo state to a live multi-tenant backend.

This document covers: field renaming, type transformations, enum normalisation, records that cannot be migrated, and the required migration order.

---

## 1. localStorage State Structure

The frontend stores all demo data in a single key:

```
localStorage key: nauxicaDemoState
```

The value is a JSON object with the following top-level arrays:

| Array key | Maps to backend table | Migrated |
|---|---|---|
| `properties` | `properties` | Yes |
| `guests` | `reservations` | Yes |
| `tasks` | `tasks` | Yes |
| `partnerRequests` | `partner_requests` | Yes |
| `messages` | `messages` | Yes |
| `reviews` | `reviews` | Yes |
| `notifications` | — | No — no backend table |
| `calendarEvents` | — | No — derived view |

---

## 2. Field Mapping: `state.properties` → `properties`

The frontend `state.properties` array stores property records created by the wizard. The wizard generates both `id` (UUID) and `property_code` (NAU-XXXXX) at creation time.

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over. Already UUID from `crypto.randomUUID()`. |
| `property_code` | `property_code` | Direct carry-over. Format `NAU-XXXXX`. |
| `display_name` | `display_name` | Direct carry-over. |
| `property_type` | `property_type` | Direct carry-over. Enum: `apartment`, `villa`, `house`, `room`, `studio`. |
| `area_description` | `area_description` | Direct carry-over. |
| `address_street` | `address_street` | Direct carry-over. |
| `address_city` | `address_city` | Direct carry-over. |
| `address_province` | `address_province` | Direct carry-over. |
| `address_postal_code` | `address_postal_code` | Direct carry-over. |
| `address_country` | `address_country` | Default `IT` if absent. |
| `max_guests` | `max_guests` | Direct carry-over. Integer. |
| `bedrooms` | `bedrooms` | Direct carry-over. Integer. |
| `bathrooms` | `bathrooms` | Direct carry-over. Integer. |
| `beds_configuration` | `beds_configuration` | Direct carry-over. JSONB. |
| `amenities` | `amenities` | Direct carry-over. Text array. |
| `checkin_time` | `checkin_time` | Direct carry-over. Format `HH:MM`. |
| `checkout_time` | `checkout_time` | Direct carry-over. Format `HH:MM`. |
| `access_method` | `access_method` | Direct carry-over. |
| `house_rules` | `house_rules` | Direct carry-over. Text. |
| `cancellation_policy` | `cancellation_policy` | Direct carry-over. Text. |
| `cir_code` | `cir_code` | Direct carry-over. Nullable. |
| `alloggiati_web_required` | `alloggiati_web_required` | Direct carry-over. Boolean. |
| `tourist_tax_enabled` | `tourist_tax_enabled` | Direct carry-over. Boolean. |
| `tourist_tax_amount_eur` | `tourist_tax_amount_eur` | Direct carry-over. Decimal. |
| `tourist_tax_exemptions` | `tourist_tax_exemptions` | Direct carry-over. JSONB. |
| `listing_channels` | `listing_channels` | Direct carry-over. Text array. |
| `listing_urls` | `listing_urls` | Direct carry-over. JSONB. |
| `availability_status` | `availability_status` | Default `available` if absent. Enum: `available`, `unavailable`, `maintenance`. |
| `owner_notes` | `owner_notes` | Direct carry-over. Nullable text. |
| `owner_id` | `owner_id` | Set to the authenticated homeowner's `auth.uid()` at migration time. |
| `platform_status` | `platform_status` | Set to `active` for all migrated properties. |
| `created_at` | `created_at` | Carry over if present; set to migration timestamp otherwise. |
| `updated_at` | `updated_at` | Set to migration timestamp. |

**Note on demo seed properties:** Properties created before the wizard was implemented (demo seed data with slug-style IDs such as `"prop-001"`) do not have `property_code`. These records require a new UUID `id` and a new `property_code` generated at migration time. The migration tool must query the highest existing `property_code` sequence number to avoid collisions.

> **Open question OQ-1:** Demo seed properties may have non-UUID `id` values (e.g. `"prop-001"`). The migration tool must detect non-UUID IDs and replace them, updating all child record `property_id` references accordingly. The founding owner must confirm which seed properties represent real properties before migration runs.

> **Note on `property_code` generation:** The localStorage prototype wizard generates `property_code` values locally using a `property_code_sequence` counter stored in localStorage. In production, `property_code` is generated server-side by a PostgreSQL sequence. Prototype-generated codes must be verified as non-colliding against the production sequence before migration, or replaced with new production-generated codes. See [database-schema.md](database-schema.md) §3.2 and [api/endpoints/properties.md](../api/endpoints/properties.md) POST behaviour.

---

## 3. Field Mapping: `state.guests` → `reservations`

The frontend labels this data as "Guests" but the backend canonical entity is `Reservation`. See §7 for the terminology note.

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over if UUID. Regenerate as UUID if not. |
| `first_name` + `last_name` | `guest_name` | Concatenate: `first_name + " " + last_name`. |
| `phone_number` | `guest_phone` | Normalise to E.164. Strip spaces, dashes, and brackets. Prepend `+39` if Italian number without country code. |
| `email` | `guest_email` | Direct carry-over. Nullable. |
| `check_in_date` | `checkin_date` | Rename only. Date string `YYYY-MM-DD`. |
| `check_out_date` | `checkout_date` | Rename only. Date string `YYYY-MM-DD`. |
| `number_of_guests` | `guest_count` | Rename only. Integer. |
| `booking_reference` | `confirmation_number` | Rename only. See note below. |
| `channel` | `booking_source` | Enum normalisation — see §3.1. |
| `property_id` | `property_id` | Direct carry-over. Frontend wizard already stores as UUID. Verify FK integrity against migrated `properties.id`. |
| `manual_status_override` | `reservation_status` | Enum mapping — see §3.2. |
| `created_at` | `created_at` | Carry over if present; set to migration timestamp otherwise. |
| `updated_at` | `updated_at` | Set to migration timestamp. |

**Fields set at migration time (not in localStorage):**
- `homeowner_id` → set to the authenticated homeowner's `auth.uid()`
- `guest_document_type` → null
- `guest_document_number` → null
- `guest_preferred_language` → default `it`
- `special_requests` → null
- `internal_notes` → null

> **Updated OQ-2:** `booking_reference` is carried forward as `confirmation_number` only if the value is non-null, unique across all reservations, and conforms to the `NX-YYYY-NNNNN` format. Non-conforming or non-unique values are replaced with a new server-generated `confirmation_number`. New records created post-migration always use the canonical server-generated format. See [database-schema.md](database-schema.md) §3.4.

### 3.1 `channel` → `booking_source` enum mapping

| localStorage value | Backend enum value |
|---|---|
| `Airbnb` | `airbnb` |
| `Booking.com` | `booking_com` |
| `VRBO` | `vrbo` |
| `Direct` | `direct` |
| `direct` | `direct` |
| Any other value | `other` |

### 3.2 `manual_status_override` → `reservation_status` mapping

The frontend stores a single display-level override. The backend uses a lifecycle enum.

| localStorage value | Backend enum value | Condition |
|---|---|---|
| `upcoming` | `pre_arrival` | `checkin_date` is within 7 days |
| `upcoming` | `confirmed` | `checkin_date` is more than 7 days in the future |
| `in_house` | `checked_in` | — |
| `checked_out` | `checked_out` | — |
| absent / null | `confirmed` | Default for records with future check-in |

---

## 4. Field Mapping: `state.tasks` → `tasks`

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over if UUID. Regenerate (e.g. `task-001`) as UUID if not. |
| `title` | `title` | Direct carry-over. |
| `description` | `description` | Direct carry-over. Nullable. |
| `property` (name string) | `property_id` | **Lookup required.** The frontend stores the property display name as a string. The migration must look up `properties.id` where `properties.display_name = task.property`. If no match, skip record and log warning. |
| `due_date` | `due_date` | Direct carry-over. Date string `YYYY-MM-DD`. |
| `status` | `status` | Enum normalisation — see §4.1. |
| `priority` | `priority` | Enum normalisation — see §4.1. |
| `created_at` | `created_at` | Carry over if present; set to migration timestamp otherwise. |
| `updated_at` | `updated_at` | Set to migration timestamp. |

**Fields set at migration time:**
- `owner_id` → set to the authenticated homeowner's `auth.uid()`
- `assigned_partner_id` → null
- `completed_at` → null

### 4.1 Task enum normalisation

All backend enum values are lowercase. Demo seed data may use mixed case. The canonical `task_priority` enum is `low / normal / important / urgent` — demo data may use legacy values `medium` and `high` which must be remapped.

| Field | Demo value examples | Backend value |
|---|---|---|
| `status` | `Pending`, `pending` | `pending` |
| `status` | `In Progress`, `in_progress` | `in_progress` |
| `status` | `Complete`, `completed` | `completed` |
| `priority` | `Urgent`, `urgent` | `urgent` |
| `priority` | `High`, `high` | `important` |
| `priority` | `Medium`, `medium` | `normal` |
| `priority` | `Low`, `low` | `low` |

---

## 5. Field Mapping: `state.partnerRequests` → `partner_requests`

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over if UUID. Regenerate (e.g. `req-001`) as UUID if not. |
| `service` | `title` | Rename only. |
| `partnerType` | `service_type` | Rename and normalise to lowercase snake_case. |
| `payout` | `agreed_payout_eur` | Rename only. Decimal. |
| `notes` | `notes_for_partner` | Rename only. Nullable text. |
| `date` | `requested_date` | Resolve relative values: `"Today"` → migration date, `"Tomorrow"` → migration date + 1 day. Convert to `YYYY-MM-DD`. |
| `status` | `status` | Enum normalisation — see §5.1. |
| `property_id` | `property_id` | Direct carry-over if UUID. If name string, resolve via property name lookup. |
| `createdAt` | `created_at` | Rename to snake_case. |
| `updatedAt` | `updated_at` | Rename to snake_case. |

**Fields set at migration time:**
- `homeowner_id` → set to the authenticated homeowner's `auth.uid()`
- `partner_id` → null
- `reservation_id` → null
- `service_request_id` → null

### 5.1 `status` → `partner_request_status` enum mapping

The canonical `partner_request_status` enum is `new / accepted / declined / in_progress / completed / disputed`. Demo data may use `pending` (maps to `new`) or other non-canonical values.

| localStorage value | Backend enum value |
|---|---|
| `new` | `new` |
| `pending` | `new` |
| `accepted` | `accepted` |
| `declined` | `declined` |
| `in_progress` | `in_progress` |
| `completed` | `completed` |
| `disputed` | `disputed` |
| Any unrecognised value | `new` — flag for founding owner review |

---

## 6. Field Mapping: `state.messages` → `messages`

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over if UUID. Regenerate (e.g. `msg-001`) as UUID if not. |
| `title` | `subject` | Rename only. |
| `content` | `body` | Rename only. |
| `type` | `message_type` | Enum mapping — see §6.1. |
| `read` | `is_read` | Rename only. Boolean. |
| `archived` | `is_archived` | Rename only. Boolean. |
| `date` | `created_at` | Rename only. ISO 8601 timestamp. |

**Fields set at migration time:**
- `sender_id` → homeowner UUID for outbound messages; null for inbound/system messages where sender is not a known user
- `recipient_id` → homeowner UUID for inbound messages; null for outbound where recipient is not yet a backend user

> **Migration note:** Demo messages do not carry structured sender/recipient UUIDs. The `messages` schema requires `sender_id` and `recipient_id` for proper routing. Demo message records are partially non-migratable: inbound messages from partners lack a valid `sender_id` (no partner accounts exist yet), and the `account_type_context` field cannot be reliably inferred. The founding owner should review demo messages and decide whether to carry them over as historical records with null sender/recipient, or drop them.

**Fields set at migration time:**
- `account_type_context` → infer from `message_type`: `partner` type → `partner`; `nauxica`/`system` → `homeowner`

### 6.1 `type` → `message_type` enum mapping

| localStorage value | Backend enum value |
|---|---|
| `owner` | `partner` |
| `guest` | `nauxica` |
| `general` | `system` |
| `system` | `system` |

---

## 7. Field Mapping: `state.reviews` → `reviews`

| localStorage field | Backend column | Transformation |
|---|---|---|
| `id` | `id` | Direct carry-over if UUID. Regenerate (e.g. `rev-001`) as UUID if not. |
| `text` | `comment` | Rename only. |
| `guest` | `reviewer_name` | Rename only. |
| `rating` | `rating` | Round to nearest integer (1–5). Demo data may use decimals such as `4.9`. |
| `date` | `created_at` | Rename only. ISO 8601 timestamp or date string — normalise to timestamp. |
| `property_id` | `subject_id` | For `guest_to_property` reviews: carry over `property_id` as `subject_id`. For other review types: set to the appropriate `users.id`. |

**Fields set at migration time:**
- `review_type` → cannot be inferred from demo data; see OQ-3
- `reservation_id` → null (cannot be inferred from demo data)
- `partner_request_id` → null (cannot be inferred from demo data)

> **Open question OQ-3:** `review_type` and `subject_id` (both NOT NULL in schema) cannot be reliably inferred from demo data. Demo reviews most likely represent guest reviews of properties (`guest_to_property`), in which case `subject_id = property_id`. The founding owner must confirm the type for each migrated review before migration runs — these records cannot be inserted without a valid `review_type`.

---

## 8. Non-Migrating Collections

### 8.1 `state.notifications`

There is no `notifications` table in the backend schema. Notifications are generated at runtime by backend events. Demo notification records are dropped on migration.

### 8.2 `state.calendarEvents`

There is no `calendar_events` table in the backend schema. The calendar view is a derived aggregation of:

- `reservations` (check-in/check-out dates)
- `tasks` (due dates)
- `partner_requests` (requested dates)

Demo `calendarEvents` records are dropped on migration. The calendar page must be updated post-migration to compose from these three API sources.

> **Open question OQ-4:** The calendar page currently reads `state.calendarEvents` directly. Post-migration, it will need to call three separate API endpoints or a single aggregation endpoint. Founder decision required on whether to build an aggregation endpoint or handle composition client-side.

---

## 9. Migration Order

Records must be migrated in the following order to satisfy foreign key constraints:

```
1. users            (homeowner account — auth.uid() anchor)
2. properties       (depends on: users.id)
3. reservations     (depends on: properties.id)
4. tasks            (depends on: properties.id)
5. partner_requests (depends on: properties.id, reservations.id)
6. messages         (depends on: users.id)
7. reviews          (depends on: properties.id, reservations.id)
```

---

## 10. ID Regeneration Policy

Demo seed records use non-UUID string IDs (e.g. `task-001`, `req-001`, `msg-001`, `rev-001`). These are invalid for UUID primary keys.

All non-UUID IDs must be regenerated as UUIDs using `crypto.randomUUID()` at migration time. There are no cross-references between collections in the demo state that depend on these IDs being stable, so regeneration is safe.

Records created by the wizard already use `crypto.randomUUID()` and do not need regeneration.

---

## 11. Guests UI Terminology Note

The frontend labels the `state.guests` collection as "Guests" and surfaces it in the Guests dashboard page and guest detail pages. The backend canonical entity is `Reservation`. There is no separate `guests` table and no `/guests` API endpoint.

Post-migration, all "Guests" frontend views must be updated to consume the `/v1/reservations` API endpoint. The guest's name, phone number, and stay details are fields within the `Reservation` record.

See [auth-strategy.md §5.3](auth-strategy.md) for the full terminology specification.

---

## 12. Open Questions Summary

| ID | Question | Who decides |
|---|---|---|
| OQ-1 | Demo seed properties with non-UUID IDs — which are real? What are the correct `property_code` values? | Founding owner |
| ~~OQ-2~~ | ~~Existing `booking_reference` values in non-NX format — carry over as-is or reformat?~~ **RESOLVED 2026-06-07:** `booking_reference` is carried forward as `confirmation_number` only if the value is non-null, unique, and conforms to `NX-YYYY-NNNNN` format. Non-conforming or non-unique values are replaced with a new server-generated `confirmation_number`. | Resolved |
| OQ-3 | `review_type` for migrated demo reviews — what type applies? Records cannot be inserted without it. | Founding owner |
| OQ-4 | Calendar page post-migration — aggregation endpoint or client-side composition? | Technical decision |
| ~~OQ-5~~ | ~~`guest_nationality` is `NOT NULL` in the `reservations` schema but the registration wizard and `state.guests` do not collect it.~~ **RESOLVED 2026-06-07:** `guest_nationality` is nullable at MVP. No default value. The Alloggiati Web compliance module (future sprint) will collect and validate nationality. Migration tool should set `guest_nationality = null` for all migrated records. | Resolved |

These questions do not block documentation. They must be resolved before the migration tool is built.

---

## 13. Backend Readiness Note

The schema foundation (tables, columns, constraints, indexes) can be implemented from this document and the referenced schema files before the following components are operational. These components are **not blockers for schema implementation** but are **required before the platform can serve live production traffic**:

| Component | Required for | Status |
|---|---|---|
| SMTP configuration | Email verification on registration; password reset flows | Pre-launch |
| SMS gateway | Phone OTP verification on registration | Pre-launch |
| Event broker / background scheduler | `reservation.PreArrivalWindowOpened` and `reservation.AlloggiatiWebReminderDue` time-triggered events; `partner_requests.response_deadline` timeout monitoring | Pre-launch |
| `EmergencyData` population | Property activation (`is_complete = true` required per property) | Per-property |
| `PropertyKnowledgeBlock` population | Property activation (`is_complete = true` required per property) | Per-property |
| Stripe billing module | `plan_started_at` / `plan_renews_at` population; subscription lifecycle management | Post-MVP |
| Operator activation endpoints | `assigned_operator_id` on escalation and dispute records | Post-MVP |

Schema migrations and the migration tool defined in this document can proceed independently of the items above.
