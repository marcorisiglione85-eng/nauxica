# Documentation Alignment Audit

**Version:** 1.0
**Status:** Complete — Backend Readiness phase
**Scope:** Sicily launch · Cross-document alignment between data-models.md, database-schema.md, and auth-strategy.md
**Date:** 2026-06-05
**Audience:** Founder, Lead Backend Architect
**Related:** [data-models.md](../backend/data-models.md) · [database-schema.md](../backend/database-schema.md) · [auth-strategy.md](../backend/auth-strategy.md) · [security-model.md](security-model.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md)

---

## Audit Purpose

This audit compares `data-models.md`, `database-schema.md`, and `auth-strategy.md` against each other and against the current MVP product direction. It identifies documentation inconsistencies that would create implementation problems, migration risks, or RLS design failures when moving from the MVP frontend to a production backend.

Supporting documents consulted: `security-model.md`, `data-visibility-model.md`, `service-request-flow.md`, `property-activation-checklist.md`, `documentation-consistency-audit.md`.

**Scope:** Documentation review only. No schema changes, no backend code, no migration scripts, no Supabase configuration.

---

## Findings Summary

| ID | Severity | Area | Status |
|---|---|---|---|
| C-01 | Critical | Authentication | Open |
| C-02 | Critical | Roles | Open |
| C-03 | Critical | Service Request | Open |
| H-01 | High | Property Lifecycle | Open |
| H-02 | High | Service Request | Open |
| H-03 | High | Service Request / PartnerRequest | Open |
| M-01 | Medium | Availability Model | Open |
| M-02 | Medium | Service Request | Open |
| M-03 | Medium | Reservation / Session | Open |
| M-04 | Medium | Data Integrity | Open |
| M-05 | Medium | Plan Tier Logic | Open |
| M-06 | Medium | Property Identity | Open |
| L-01 | Low | Service Request | Open |
| L-02 | Low | Supabase Readiness | Open |
| L-03 | Low | Session Management | Open |
| L-04 | Low | API Documentation | Open |

---

## Critical Findings

---

### Finding C-01

**Severity:** Critical

**Affected documents:**
- `docs/backend/auth-strategy.md`
- `docs/api/auth.md`

**Description:**

Both `auth-strategy.md` and `docs/api/auth.md` are documentation stubs. Each file contains only a title and a one-sentence description placeholder — no content has been written.

`auth-strategy.md` (in full):
> *Planned approach for user authentication and session management on Nauxica, covering homeowner, partner, and guest roles.*

`docs/api/auth.md` (in full):
> *Documentation for API authentication endpoints, token handling, refresh flows, and role-based access control.*

All substantive authentication documentation currently lives in `security-model.md` (§1–3), which is a security architecture document — not an implementation reference. `security-model.md` was not designed to be the auth integration document for the backend or API teams.

**Impact:**

- There is no dedicated document defining the JWT access/refresh token flow that backend developers can implement from.
- There is no document describing the API-layer authentication endpoints (`POST /auth/login`, `POST /auth/refresh`, etc.) that frontend developers can call.
- When Supabase implementation begins, the team has no documented auth strategy to guide whether Supabase Auth (GoTrue) is used natively, wrapped, or bypassed in favour of a custom JWT implementation.
- `security-model.md` §1.1 defines token parameters (15-minute access, 30-day refresh, rotation on use) but these details are not linked from any backend implementation document.

**Recommendation:**

Populate `auth-strategy.md` as the canonical backend auth implementation reference. At minimum, it should document: token format and lifetimes, refresh flow, MFA enforcement by role, account lockout rules, guest session model (phone-number anchor, no token), AI runtime service key scoping, and a decision on Supabase Auth vs custom JWT. Reference `security-model.md` §1–3 as the source of the security design decisions that auth-strategy.md implements.

Populate `docs/api/auth.md` with the API endpoint specifications for login, refresh, logout, and MFA flows.

**Status:** Open

---

### Finding C-02

**Severity:** Critical

**Affected documents:**
- `docs/backend/data-models.md` (Model 1 — User)
- `docs/backend/database-schema.md` (§3.1 users, §3.8 escalation_records, §3.15 dispute_records)
- `docs/architecture/security-model.md` (§1.2, §2)

**Description:**

The `users` table `account_type` enum only permits two values: `homeowner` and `partner`. However, `security-model.md` §2 defines four roles on the platform: `homeowner`, `partner`, `operator`, and `ai_runtime`. The `operator` role is described in detail:

> §1.2 — Operator authentication: "each operator must have a unique credential," MFA is required, session tokens expire after 8 hours.

> §2 — Role Scopes: "Operator — Nauxica team (founder + staff) — Full platform dashboard — All API endpoints — All data."

Two production tables carry FKs into `users` for operator-assigned records:

- `escalation_records.assigned_operator_id uuid → users.id`
- `dispute_records.assigned_operator_id uuid → users.id`

These FK references are only meaningful if operator accounts exist in the `users` table. But the `account_type` enum — `CREATE TYPE account_type AS ENUM ('homeowner', 'partner')` — has no value for `operator`. An operator cannot be inserted into the `users` table without violating the enum constraint.

`data-models.md` Model 1 (User) reinforces this gap: the `account_type` field documentation lists only `homeowner` and `partner` as values, with no mention of operators.

**Impact:**

- Operators cannot have user accounts in the current documented schema. The two FK columns (`escalation_records.assigned_operator_id`, `dispute_records.assigned_operator_id`) reference a row type that cannot be inserted.
- Authentication documentation (`security-model.md`) describes a fully operational `operator` account type with specific session, MFA, and access rules — but no corresponding data model supports it.
- Supabase RLS policies that rely on `account_type` to distinguish operator access from homeowner/partner access have no value to match against.
- At MVP, the founder is the sole operator. Without documenting how operator accounts are created and stored, first-day platform setup is undocumented.

**Recommendation:**

Document a resolution for operator account storage. The most direct option is to add `operator` to the `account_type` enum in both `data-models.md` and `database-schema.md`. Alternatively, document operator accounts as a separate `operator_accounts` table if operators should be fully isolated from homeowner/partner user records. Either way, the resolution must be reflected consistently in: the `account_type` enum definition, `data-models.md` Model 1 field notes, `database-schema.md` §3.1 constraints, and `security-model.md` §2 role scope table.

**Status:** Open — Founder decision required

---

### Finding C-03

**Severity:** Critical

**Affected documents:**
- `docs/backend/data-models.md` (Model 9 — ServiceRequest)
- `docs/backend/database-schema.md` (§2 — service_request_urgency, service_request_status enums)

**Description:**

`database-schema.md` explicitly supersedes two enums from `data-models.md` v1.2, but `data-models.md` has not been updated. The document declared as the primary source of truth contains stale enum values.

`database-schema.md` §7 Migration Notes records:

> `service_request_urgency` enum — RESOLVED 2026-05-29: Approved values: `emergency`, `urgent`, `high`, `normal`, `scheduled`. The earlier compressed set (`routine`, `same_day`, `urgent`, `emergency`) from data-models.md v1.2 Model 9 is **superseded**.

> `service_request_status` enum — RESOLVED 2026-05-29: Approved 11-state machine. The earlier 5-state set from data-models.md v1.2 Model 9 is **superseded**.

`data-models.md` Model 9 still documents:
- `urgency` values: `routine` / `same_day` / `urgent` / `emergency` (4 values — stale)
- `status` values: `open` / `assigned` / `in_progress` / `completed` / `cancelled` (5 values — stale)

The current approved values are:
- `urgency`: `emergency` / `urgent` / `high` / `normal` / `scheduled` (5 values)
- `status`: `created` / `classified` / `routed` / `pending_acceptance` / `assigned` / `in_progress` / `completed` / `verified` / `escalated` / `failed` / `cancelled` (11 values)

`database-schema.md` preamble states: "This document is derived from `data-models.md` v1.2 (primary)." If `data-models.md` is primary, its values for these enums must be authoritative — but they are wrong.

**Impact:**

- A developer implementing the AI concierge urgency classification from `data-models.md` (the stated source of truth) will build a 4-value urgency model. The database schema requires 5 values, and `service-request-flow.md` requires the full 5-level model including `high` and `scheduled`.
- The status state machine in `data-models.md` (5 states) is incompatible with the `service_requests` table (11 states). Code written against data-models.md will miss the `classified`, `routed`, `pending_acceptance`, `verified`, `escalated`, and `failed` states entirely — bypassing the entire routing and verification pipeline.
- Any AI runtime component that creates `ServiceRequest` records using the old `open` initial status will be rejected by the database (valid initial status is `created`).

**Recommendation:**

Update `data-models.md` Model 9 to reflect the approved enum values from the 2026-05-29 founder decisions. Add a version note: "Urgency and status enum values updated to approved operational set — supersedes earlier draft values. Authoritative source for both enums: `service-request-flow.md` §2.1 (urgency) and §1 (status)." Mark `data-models.md` version as 1.3 after this update.

**Status:** Open

---

## High Findings

---

### Finding H-01

**Severity:** High

**Affected documents:**
- `docs/backend/data-models.md` (Model 2 — Property, `platform_status` enum)
- `docs/backend/database-schema.md` (§2 — `platform_status` enum, §3.2 properties)
- `docs/onboarding/homeowner/property-activation-checklist.md`

**Description:**

The `platform_status` enum has four values: `pending` / `active` / `suspended` / `archived`. The property-activation-checklist.md describes a multi-stage activation workflow that the four-state enum cannot represent:

1. **Homeowner creates property** — begins filling in data
2. **Homeowner completes intake** — all required fields present
3. **Homeowner submits for activation review** — requests Nauxica approval
4. **Nauxica reviews** — Category A–E checks performed
5. **Nauxica approves** — status → `active`
6. **Nauxica rejects** — status → ??? (returns to `pending`? back to homeowner with issues?)

Steps 3 and 4 have no corresponding `platform_status` value. There is no `draft`, `onboarding`, `activation_requested`, or `under_review` state. The current enum conflates all pre-active states into `pending`.

Additionally, `property-activation-checklist.md` Activation Scoring Summary includes a "Conditional — activate with advisory note" outcome (Category B score 28–31), implying a probationary active state that the current enum also cannot represent.

**Impact:**

- The operator's queue for "properties awaiting activation review" cannot be derived from `platform_status` alone. Both a newly created empty property and one that has passed all checklist items and is waiting for Nauxica sign-off would show the same `pending` status.
- There is no documented trigger for when a homeowner has completed intake and explicitly requested activation — this action exists in the onboarding flow but has no backing data state.
- Conditional activation (activate with advisory) has no distinct persisted state, making follow-up quality monitoring (e.g., "activate with flag to re-check within 7 days") impossible to implement.
- Post-MVP: when activation is more automated, the absence of intermediate states will require a schema change.

**Recommendation:**

Document the full property lifecycle state machine explicitly in `data-models.md` and `database-schema.md`. Candidate additional states: `draft` (homeowner building the property profile), `activation_requested` (homeowner has submitted; awaiting Nauxica review), and optionally `conditional` (activated with an advisory flag). The document does not need to add all of these immediately — but the gap must be acknowledged and a decision recorded. At minimum, distinguish `pending` (incomplete, not yet submitted) from `activation_requested` (ready for review).

**Status:** Open — Founder decision required

---

### Finding H-02

**Severity:** High

**Affected documents:**
- `docs/backend/data-models.md` (Model 9 — ServiceRequest, `initiated_by` field)
- `docs/backend/database-schema.md` (§2 — `initiated_by` enum)
- `docs/operations/service-request-flow.md` (§1.3)

**Description:**

The `initiated_by` enum has a three-way inconsistency across documents for the guest-initiated value:

| Document | Value used |
|---|---|
| `data-models.md` Model 9 | `guest_direct` |
| `database-schema.md` §2 enum | `guest_direct` |
| `service-request-flow.md` §1.3 | `guest` |

`service-request-flow.md` §1.3 states:
> "`initiated_by: "guest"` — distinct from AI-created requests when the guest's message is unambiguous..."

The schema enum `CREATE TYPE initiated_by AS ENUM ('ai_concierge', 'guest_direct', 'homeowner', 'operator')` contains `guest_direct`, not `guest`.

`service-request-flow.md` also notes that `initiated_by: "guest"` is a post-MVP distinction. At MVP, all guest-triggered requests use `ai_concierge`. This makes the inconsistency dormant at MVP — but it will surface when the guest self-service form is built.

**Impact:**

- A backend developer implementing from `service-request-flow.md` (the authoritative document for ServiceRequest lifecycle per `documentation-consistency-audit.md`) will use `"guest"` as the enum value. The database will reject it — valid value is `"guest_direct"`.
- A developer implementing from `data-models.md` or `database-schema.md` will use `"guest_direct"` but the service-request-flow.md operational documentation will not match their implementation.
- Even though this value is post-MVP, the inconsistency should be resolved before it appears in code.

**Recommendation:**

Align all three documents to a single value. The schema enum (`guest_direct`) and the primary data model document (`data-models.md`) agree — update `service-request-flow.md` §1.3 to use `initiated_by: "guest_direct"` consistently. Add a note in `service-request-flow.md` §1.3 referencing the enum definition in `database-schema.md`.

**Status:** Open

---

### Finding H-03

**Severity:** High

**Affected documents:**
- `docs/backend/data-models.md` (Model 9 — ServiceRequest, `linked_partner_request_id` field)
- `docs/backend/database-schema.md` (§3.10 service_requests)
- `docs/operations/service-request-flow.md` (§11)

**Description:**

The three documents model the ServiceRequest → PartnerRequest link differently:

**data-models.md** Model 9 defines a single FK field:
> `linked_partner_request_id uuid → PartnerRequest` — "Set when a PartnerRequest is created to fulfil this ServiceRequest."

**service-request-flow.md** §11 defines an array field:
> `linked_partner_requests: Array of UUIDs → PartnerRequest` — "All PartnerRequests created for this ServiceRequest."

**database-schema.md** §3.10 resolves this with two separate fields:
- `linked_partner_request_id` — "First PartnerRequest created for this ServiceRequest. Set at initial routing; retained for traceability and audit. **Not updated** when routing moves to a backup partner."
- `active_partner_request_id` — "Current PartnerRequest for live routing. **Updated each time** routing moves to a new partner."

The schema's dual-FK resolution is sound operationally — it satisfies both the audit trail requirement (retain the first FK) and the live routing requirement (track the current FK). However, this resolution exists only in `database-schema.md`. The primary source document (`data-models.md`) still describes a single FK, and the operational flow document (`service-request-flow.md`) describes an array that doesn't exist in the schema.

**Impact:**

- A developer implementing ServiceRequest creation from `data-models.md` will set `linked_partner_request_id` and consider the FK relationship complete. They will not set `active_partner_request_id`, breaking all live routing queries that depend on it.
- The routing reassignment logic in `service-request-flow.md` §5.2 depends on the ability to track "all partners attempted" — this requires either the array field (which doesn't exist in the schema) or the `routing_history` JSONB field. The relationship between these two is not cross-referenced.
- `service-request-flow.md` §11 field `linked_partner_requests` (array) directly contradicts the schema definition. A developer following either document but not the other will build incorrect data access patterns.

**Recommendation:**

Update `data-models.md` Model 9 to replace the single `linked_partner_request_id` with the two-field resolution from `database-schema.md`: document both `linked_partner_request_id` (first partner request, immutable after routing) and `active_partner_request_id` (current active routing, updated on reassignment). Update `service-request-flow.md` §11 to remove the array field and reference the dual-FK pattern, noting that full routing history is tracked via `routing_history` (JSONB).

**Status:** Open

---

## Medium Findings

---

### Finding M-01

**Severity:** Medium

**Affected documents:**
- `docs/backend/data-models.md` (Model 2 — Property)
- `docs/backend/database-schema.md` (§2 — `platform_status` enum)
- `docs/operations/service-request-flow.md` (§15 edge cases)

**Description:**

The `platform_status` enum (`pending` / `active` / `suspended` / `archived`) represents both administrative platform status and operational guest availability as a single field. There is no documented mechanism for a property that is `active` on the platform but temporarily unavailable to guests.

Real operational scenarios that the current model cannot represent cleanly:

- Property is active but the owner is doing renovation and does not want to accept new reservations
- Property is active but a maintenance block has been placed over a specific period
- Property is active but the owner wants to pause AI concierge interactions during a manual review

`service-request-flow.md` §15 compounds this by treating `suspended` as the mechanism for mid-request property state changes:
> "Property moves to `suspended` state mid-request: Active IN_PROGRESS jobs are not interrupted. New ServiceRequests for this property are blocked until re-activation."

This conflates a platform administrative action (suspension for policy violations) with an operational availability control (owner-initiated temporary pause). Using `suspended` for both creates ambiguity: an operator cannot distinguish between "suspended due to compliance issue" and "suspended at owner's request for renovation."

**Impact:**

- Homeowners have no documented data pathway to temporarily pause their property without triggering the full suspension/reinstatement workflow.
- The operator queue cannot distinguish properties suspended for compliance reasons from properties paused at the owner's request.
- Reservation availability queries must use `platform_status = 'active'` as a proxy for "accepting new bookings" — which is not semantically equivalent.

**Recommendation:**

Document the intended approach for owner-controlled operational availability. Two options should be evaluated and one selected: (1) Add a separate `operational_status` or `is_accepting_reservations` boolean field to the Property model, independent of `platform_status`. (2) Define `platform_status` values more precisely, with `suspended` restricted to platform administrative actions and a new `paused` value for owner-controlled temporary unavailability. Document the decision in `data-models.md` Model 2.

**Status:** Open — Founder decision required

---

### Finding M-02

**Severity:** Medium

**Affected documents:**
- `docs/operations/service-request-flow.md` (§1–9, §11)
- `docs/backend/database-schema.md` (§2 enums)

**Description:**

`service-request-flow.md` uses uppercase enum values throughout, while `database-schema.md` uses lowercase. Both documents cover the same fields and values.

Examples:

| Field | service-request-flow.md | database-schema.md |
|---|---|---|
| service_type | `CLEANING`, `MAINTENANCE` | `cleaning`, `maintenance` |
| urgency | `EMERGENCY`, `URGENT`, `HIGH` | `emergency`, `urgent`, `high` |
| status | `CREATED`, `ASSIGNED`, `COMPLETED` | `created`, `assigned`, `completed` |

`database-schema.md` §1 states: "Enum value normalisation: Enum values in source documents that use hyphens have been normalised to underscores for SQL compatibility." It handles the hyphen normalisation but not the case discrepancy from `service-request-flow.md`.

**Impact:**

- A developer reading `service-request-flow.md` for operational reference and `database-schema.md` for schema reference will encounter constant case-switching, increasing implementation risk.
- Code that compares a value from `service-request-flow.md` documentation directly to a database query result will fail if the developer copies the uppercase form into application code.
- The inconsistency will be especially error-prone in the urgency classification code path, where keyword matching (§2.2) assigns urgency values that must match the enum.

**Recommendation:**

Add a note to `service-request-flow.md` §1 (or its header) stating that all enum values shown in this document use uppercase for readability, and that the canonical SQL enum values are lowercase as defined in `database-schema.md` §2. Alternatively, update `service-request-flow.md` to use lowercase values consistent with the schema. Either approach is acceptable; the key requirement is that the document acknowledges the case convention explicitly.

**Status:** Open

---

### Finding M-03

**Severity:** Medium

**Affected documents:**
- `docs/backend/data-models.md` (Model 4 — Reservation, Model 5 — WhatsAppSession)
- `docs/backend/database-schema.md` (§3.4 reservations, §3.6 whatsapp_sessions)

**Description:**

`Reservation.reservation_status` and `WhatsAppSession.session_phase` both track the temporal state of a guest's stay, and they must remain semantically consistent. However, no document defines the synchronisation rule between them.

Potential divergence points:

| Scenario | Expected reservation_status | Expected session_phase |
|---|---|---|
| 3 days before checkin, guest sends first WhatsApp message | `confirmed` or `pre_arrival` | `pre_arrival` |
| On checkin_date, before check_in_from time | `pre_arrival` | `check_in` |
| Reservation moves to `checked_in` | `checked_in` | `in_stay` (or `check_in`?) |

`data-models.md` Reservation transitions state:
> "`confirmed → pre_arrival`: Automated — set when today = checkin_date minus 48 hours."

But `WhatsAppSession.session_phase` transitions are governed by `whatsapp-session-anchor.md`, which defines phase transitions based on message timing and explicit check-in signals. There is no document that explicitly states: "when `reservation_status` transitions to X, `session_phase` must be set to Y."

The `GuestStayContext` is described as "created when a reservation moves to `checked_in` status." This implies the GuestStayContext creation is triggered by the `reservation_status` transition — but the AI concierge reads `session_phase` from `WhatsAppSession`, not `reservation_status`. If the session phase and the reservation status diverge, the AI will serve contextually incorrect responses.

**Impact:**

- An AI concierge serving `pre_arrival` phase content while the reservation has moved to `checked_in` would not deliver access codes, even if the guest is at the door.
- A background process that advances `reservation_status` based on dates may not trigger a corresponding `session_phase` update if no WhatsApp session is active yet.
- The creation trigger for `GuestStayContext` — "at check-in time" vs "when reservation_status = checked_in" — is ambiguous. These may not be simultaneous.

**Recommendation:**

Document the explicit synchronisation contract between `reservation_status` and `session_phase`. Specifically: define which transitions in one trigger required transitions in the other, which can diverge (and why), and what the authority is when they conflict. This can be a new section in `data-models.md` or a cross-reference to `whatsapp-session-anchor.md`. The GuestStayContext creation trigger should also be made explicit (date-based, status-based, or event-based).

**Status:** Open

---

### Finding M-04

**Severity:** Medium

**Affected documents:**
- `docs/backend/data-models.md` (Model 4b — GuestStayContext)
- `docs/backend/database-schema.md` (§3.5 guest_stay_contexts)

**Description:**

`GuestStayContext.active_service_requests` is a `uuid[]` array column. Both documents acknowledge that PostgreSQL cannot enforce FK integrity on array elements:

> database-schema.md §3.5: "FK integrity not enforced at DB level on array elements (PostgreSQL limitation). Enforced at application layer."

However, no document defines what "enforced at application layer" means in practice — no application-layer rules, patterns, or validation logic are documented anywhere in the codebase documentation. The note acknowledges a known integrity gap but delegates resolution to implementation without providing guidance.

**Impact:**

- Each developer implementing a path that modifies `active_service_requests` will invent their own consistency check. Without a shared reference, implementations will diverge.
- A service request deleted or archived while still referenced in an array will leave orphaned UUIDs with no detection mechanism.
- The post-MVP note suggests migrating to a junction table — but there is no documented trigger condition or migration plan. Without clear criteria, this migration will be indefinitely deferred.

**Recommendation:**

Document the application-layer enforcement contract for `active_service_requests`. At minimum: which operations must validate array membership before modifying it, how orphaned references are detected, and what the cleanup path is. If the junction table migration has a triggering condition (e.g., "more than N concurrent service requests per stay"), document it so the decision point is explicit.

**Status:** Open

---

### Finding M-05

**Severity:** Medium

**Affected documents:**
- `docs/backend/data-models.md` (Model 1 — User, Model 2 — Property)
- `docs/backend/database-schema.md` (§3.1 users, §3.2 properties)

**Description:**

`nauxica_plan_tier` appears on both the `users` table and the `properties` table. `data-models.md` Model 2 notes:

> "Inherited from owner User at creation; can be overridden."

Neither `data-models.md` nor `database-schema.md` documents: who can override the property-level tier, when overrides are valid, what happens when the owner's tier changes after a property override exists, or whether the plan tier on the property (rather than the user) drives feature gating.

Additionally, `database-schema.md` §3.1 notes:

> "⚠️ Applies to homeowner plans (starter/professional/premium). Partner plan tier not modelled in v1.2 — see enum note above."
> "Founder must confirm whether to extend this enum or add a `partner_plan_tier` column before partner billing is implemented."

The partner plan tier gap is documented as an open decision, but its interaction with partner feature gates is not documented anywhere.

**Impact:**

- API endpoints that check plan-tier permissions (e.g., "OTA sync available for Professional and above") have no documented authoritative source: user.nauxica_plan_tier or property.nauxica_plan_tier?
- If a homeowner downgrades their plan, it is unclear whether property-level plan tiers should be automatically downgraded or whether overrides persist.
- Supabase RLS policies that gate access by plan tier will need to reference one of these fields — there is no guidance on which one to use.
- Partner feature gating is entirely undocumented pending a founder decision that has no deadline or tracking entry.

**Recommendation:**

Document the authoritative source for plan-tier feature gating (user-level or property-level), the conditions under which property-level overrides are valid, and the cascade behaviour on owner plan changes. The open partner plan tier decision should be logged in `docs/legal/legal-review-tracker.md` or a new decisions-tracker with a documented deadline.

**Status:** Open — Founder decision required

---

### Finding M-06

**Severity:** Medium

**Affected documents:**
- `docs/backend/data-models.md` (Model 2 — Property, `property_id` field)
- `docs/backend/database-schema.md` (§3.2 properties, `property_id` column)

**Description:**

`property_id` is the slug that acts as the FK anchor for every child table in the schema. Its constraints are documented as: text, unique, immutable after activation. No document specifies:

- Allowed character set (lowercase only? hyphens allowed? underscores? Unicode?)
- Minimum and maximum length
- Generation algorithm (auto-generated from property name? manually entered by homeowner? by Nauxica staff?)
- Collision handling (if `villa-mare` already exists, what is the fallback? `villa-mare-2`? reject and prompt?)
- Whether slugs are case-sensitive

The schema `database-schema.md` §3.2 describes the slug as "e.g. `villa-mare`" — implying lowercase with hyphens — but this is an example, not a specification.

**Impact:**

- Without format rules, two properties could have slugs that are semantically identical but technically distinct (`villa_mare` vs `villa-mare`), breaking human-readable reference consistency.
- The immutability constraint makes slug format errors especially costly — a badly formed slug cannot be corrected after activation without cascading FK updates across all child tables.
- Supabase RLS policies using the slug in queries need to know whether to apply `LOWER()` normalization or case-sensitive matching.
- The generation algorithm determines whether slug assignment is a homeowner action, a Nauxica staff action, or an automated system action — each has different UX and operational implications.

**Recommendation:**

Add a `property_id` slug specification section to `data-models.md` Model 2 or `database-schema.md` §3.2. It should define: character set and casing rules, length constraints, generation source (automated vs manual), collision resolution policy, and whether legacy slug changes are ever permitted (with what operator process). This is low implementation effort but high documentation value before any migration is written.

**Status:** Open

---

## Low Findings

---

### Finding L-01

**Severity:** Low

**Affected documents:**
- `docs/operations/service-request-flow.md` (§11)
- `docs/backend/database-schema.md` (§3.15 dispute_records)

**Description:**

`service-request-flow.md` §11 defines the `dispute_id` FK field as:
> `dispute_id: UUID → Dispute`

The referenced model name is `Dispute`. In `database-schema.md`, the actual table is named `dispute_records`, and the model in `documentation-consistency-audit.md` references `dispute_records` consistently. The logical model name implied by `service-request-flow.md` (`Dispute`) does not match the canonical table name (`dispute_records`) or the data model naming convention (all models in `data-models.md` use singular nouns: `Reservation`, `ServiceRequest`, `PartnerRequest`).

**Impact:**

Low — this is a naming discrepancy with no functional consequence at the current documentation stage. It could cause confusion if a developer searches for a `Dispute` model and finds none.

**Recommendation:**

Update `service-request-flow.md` §11 to reference `dispute_id: UUID → DisputeRecord` (matching the model pattern) or `→ dispute_records` (matching the table name). Consistent use of `DisputeRecord` as the model name and `dispute_records` as the table name would align with the broader naming convention.

**Status:** Open

---

### Finding L-02

**Severity:** Low

**Affected documents:**
- `docs/backend/database-schema.md` (§1 Naming Conventions, §3 all tables using `property_id` FK)
- `docs/architecture/security-model.md` (§1–3)

**Description:**

All FK references to `properties` use the text slug `property_id`, not the UUID `id`. This is documented as intentional in `database-schema.md` §3.2:

> "All foreign key references from other tables use `property_id` (the slug) — not the uuid `id`. This convention follows data-models.md v1.2 and allows human-readable references in operational records."

This design choice has specific implications for Supabase Row Level Security that are not documented anywhere. In standard Supabase RLS patterns, policies use `auth.uid()` (a UUID) matched against a UUID column — typically `owner_id` or similar. Using a text slug as the FK anchor for all child tables means:

- RLS policies protecting child records (e.g., "a homeowner can only see their own reservations") cannot use a direct UUID comparison against `property_id`. They must join through `properties` to reach `owner_id`.
- Any direct-insert RLS policy on tables like `service_requests`, `reservations`, or `partner_assignments` must validate `property_id` against the authenticated user's owned properties — a join-dependent check, not a simple equality check.
- If Supabase's RLS policy builder or automatic policy generation tools are used, they will not produce correct policies for slug-anchored FKs without manual customisation.

**Impact:**

Low at the current documentation phase — RLS is explicitly deferred to post-MVP. The risk becomes high at the point Supabase RLS implementation begins and there is no pre-existing documentation warning about this pattern.

**Recommendation:**

Add a note to `database-schema.md` §1 (Database Principles) or a new §8 (Supabase Readiness Notes) acknowledging the RLS implications of slug-based FKs. The note should state the intended RLS policy pattern: that policies on child tables will join through `properties` to validate `owner_id = auth.uid()`. This prevents the RLS implementation team from discovering this constraint mid-implementation.

**Status:** Open

---

### Finding L-03

**Severity:** Low

**Affected documents:**
- `docs/architecture/security-model.md` (§1.1)
- `docs/backend/auth-strategy.md` (stub)

**Description:**

`security-model.md` §1.1 documents a custom JWT-based session management approach: 15-minute access tokens, 30-day refresh tokens, rotation on use. This is a fully designed custom implementation.

Supabase provides its own authentication layer (GoTrue) with built-in session management, JWT generation, and refresh token rotation. These two approaches are not compatible without a documented integration strategy — one must either replace the other or the custom JWT layer must be built on top of Supabase Auth's tokens.

No document acknowledges this choice point or records a decision. If `auth-strategy.md` were populated (see C-01), this would be a natural section within it. Because `auth-strategy.md` is a stub, the decision is entirely absent from the documentation system.

**Impact:**

Low now — it is an undocumented future decision. High at implementation time if the team begins building a custom JWT layer without knowing whether Supabase Auth is intended to replace it.

**Recommendation:**

When `auth-strategy.md` is populated (per C-01), include an explicit section on the Supabase Auth integration decision: whether Supabase GoTrue is used natively (simplifying implementation but constraining customisation), whether it is extended with custom claims (moderate complexity), or whether a fully custom JWT layer is built using Supabase's service key (highest complexity, highest flexibility). Record the decision and rationale.

**Status:** Open

---

### Finding L-04

**Severity:** Low

**Affected documents:**
- `docs/api/auth.md` (stub — covered in C-01)
- `docs/api/endpoints/properties.md`
- `docs/api/endpoints/reservations.md`
- `docs/api/endpoints/tasks.md`
- `docs/api/endpoints/partner-requests.md`
- `docs/api/endpoints/messages.md`
- `docs/api/endpoints/reviews.md`

**Description:**

The API endpoint documentation files were not reviewed in full for this audit. However, the pattern established by `api/auth.md` (confirmed stub) raises a documentation readiness concern for the broader API layer. If the endpoint files follow the same stub pattern as `api/auth.md`, the API layer has no implementation-ready documentation.

This is noted as Low severity because the endpoint files were not confirmed as stubs — they may be complete. The finding is conditional.

**Impact:**

Conditional — low if endpoint files are substantive, high if they are also stubs. Frontend-to-backend migration cannot begin without API endpoint documentation that matches the finalised data models.

**Recommendation:**

Review each API endpoint file for substantive content before the first backend sprint begins. If any are stubs, prioritise them alongside C-01 (`auth-strategy.md`) as a pre-sprint documentation deliverable. Cross-reference each endpoint against the corresponding data model in `data-models.md` to confirm alignment.

**Status:** Open — verification required

---

## Review Areas Summary

### 1. Property Identity Model

The dual-identifier pattern (`id` as UUID primary key, `property_id` as slug FK anchor) is consistently documented across `data-models.md` and `database-schema.md`. The design rationale (human-readable operational references) is stated. No inconsistency between the two documents.

**Risks identified (see L-02):** Slug-as-FK creates non-standard Supabase RLS patterns. Slug validation rules are undocumented (see M-06). Slug immutability after activation creates a correction risk if slug format rules are not defined before implementation.

---

### 2. Property Lifecycle

The `platform_status` enum (`pending` / `active` / `suspended` / `archived`) is consistently documented. The inconsistency is between what the enum can represent and what the `property-activation-checklist.md` describes as a multi-stage activation review workflow. **See H-01.**

---

### 3. Availability Model

No operational availability model exists independent of `platform_status`. The current design conflates administrative platform status with operational guest-facing availability. **See M-01.**

---

### 4. Authentication and Roles

`auth-strategy.md` and `api/auth.md` are stubs. **See C-01.** The `operator` role is defined in `security-model.md` but has no `account_type` value in the `users` table. **See C-02.**

The `homeowner` and `partner` roles are consistently documented across `data-models.md`, `database-schema.md`, and `security-model.md`. The `ai_runtime` role is documented in `security-model.md` with a clear permission boundary but has no corresponding user record model — it is an API key, not a user account. This distinction is implicit but not stated explicitly in `data-models.md`.

Escalation and dispute workflows both reference `assigned_operator_id → users.id` — these FKs are contingent on resolving C-02.

---

### 5. Reservation and Guest Lifecycle

`Reservation`, `GuestStayContext`, and `WhatsAppSession` models are consistently documented between `data-models.md` and `database-schema.md`. Reservation status values and GuestStayContext fields align across both documents.

**Gap identified (see M-03):** The synchronisation contract between `reservation_status` and `WhatsAppSession.session_phase` is not documented. The GuestStayContext creation trigger is ambiguous.

---

### 6. Service Request Lifecycle

This is the area with the most documentation misalignment.

- **C-03:** `urgency` and `status` enums in `data-models.md` are stale; superseded values are in `database-schema.md` only.
- **H-02:** `initiated_by` value mismatch (`guest` vs `guest_direct`) across `data-models.md`, `database-schema.md`, and `service-request-flow.md`.
- **H-03:** `linked_partner_request_id` (single FK) vs `linked_partner_requests` (array) vs dual-FK resolution in schema — three inconsistent descriptions.
- **M-02:** Uppercase enum values in `service-request-flow.md` vs lowercase in `database-schema.md`.
- **L-01:** `dispute_id → Dispute` vs `dispute_id → dispute_records` naming mismatch.

**Authoritative source:** `database-schema.md` §2–3 contains the resolved and approved values for all service request enums. `service-request-flow.md` is the authoritative source for the operational state machine logic. `data-models.md` must be updated to reflect the approved enum resolutions.

---

### 7. Future Supabase Readiness

| Risk area | Finding | Severity |
|---|---|---|
| Auth strategy undefined | C-01 | Critical |
| Operator role not in user table | C-02 | Critical |
| Slug-based FKs create non-standard RLS patterns | L-02 | Low |
| Session management — GoTrue vs custom JWT — undocumented decision | L-03 | Low |
| `active_service_requests` array FK integrity gap | M-04 | Medium |
| Plan-tier feature gating source undocumented | M-05 | Medium |
| Stale enum values in data-models.md will seed wrong implementations | C-03 | Critical |
| Property lifecycle states insufficient for activation queue | H-01 | High |

The most consequential Supabase readiness gap is the absence of a documented auth strategy. Supabase's RLS system is tightly coupled to its authentication model. Without knowing whether Supabase Auth, custom JWT, or a hybrid approach is used, RLS policy design cannot begin. This is a blocker for the Supabase implementation sprint.

---

## Finding Count

| Severity | Count |
|---|---|
| **Critical** | **3** |
| **High** | **3** |
| **Medium** | **6** |
| **Low** | **4** |
| **Total** | **16** |

---

## Recommended Next Documentation Sprint

**Sprint name:** Auth and Enum Alignment Sprint

**Priority order:**

1. **Populate `auth-strategy.md`** (C-01) — Blocks Supabase auth design. Write the implementation-level auth document using `security-model.md` §1–3 as the source of design decisions. Include a Supabase Auth integration decision (C-01, L-03).

2. **Resolve operator account type** (C-02) — Requires a founder decision on whether `operator` is added to the `account_type` enum or given a separate table. Once decided, update `data-models.md`, `database-schema.md`, and `security-model.md` consistently.

3. **Update `data-models.md` ServiceRequest enums** (C-03) — Apply the approved 2026-05-29 urgency and status enum values to `data-models.md` Model 9. Version bump to 1.3. No schema changes required.

4. **Align `initiated_by` enum** (H-02) — One-line fix in `service-request-flow.md` §1.3. Low effort, high clarity value.

5. **Document `linked_partner_request_id` dual-FK resolution** (H-03) — Update `data-models.md` Model 9 and `service-request-flow.md` §11 to match the approved dual-FK pattern in `database-schema.md`.

6. **Document property lifecycle intermediate states** (H-01) — Founder decision required on whether `draft`, `activation_requested`, or similar states are added to the `platform_status` enum. Document the decision regardless of outcome.

**Estimated effort:** 1 documentation sprint (1–2 days). Items 3, 4, and 5 are editorial fixes (under 30 minutes each). Items 1, 2, and 6 require founder decisions first.

**Blocking condition:** Items 1 and 2 are blockers for the Supabase implementation sprint. Items 3–6 are blockers for any developer beginning backend work on ServiceRequest routing or property management.
