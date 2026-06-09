# Service Request Flow

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · All service types
**Last updated:** 2026-06-05
**Related:** [partner-assignment-model.md](../architecture/partner-assignment-model.md) · [data-models.md](../backend/data-models.md) · [escalation-rules.md](../ai-concierge/escalation-rules.md) · [event-driven-architecture.md](../architecture/event-driven-architecture.md) · [notification-system.md](../architecture/notification-system.md)

---

## Purpose

This document defines the complete operational lifecycle of a `ServiceRequest` — from the moment a need is identified to the moment the job is completed, verified, and closed.

A `ServiceRequest` is the demand-side record: "someone needs something done at this property." It is distinct from a `PartnerRequest`, which is the supply-side record: "this specific partner has been asked to do this job." One `ServiceRequest` may generate one or more `PartnerRequest` records if the first partner declines.

This document covers: trigger sources, classification, routing, assignment, timeout handling, completion, proof-of-work, escalation, dispute transitions, cancellation, and the operational audit trail.

---

## Request States

A `ServiceRequest` moves through the following states. Every state transition is an event. No state can be skipped.

```
CREATED
    │
    ▼
CLASSIFIED
    │
    ▼
ROUTED ──────────────────────────────────────────────────┐
    │                                                     │
    ▼                                                     │
PENDING_ACCEPTANCE                                        │
    │                                                     │
    ├── (partner accepts) ──────────────────────────────── │
    │                                                     │
    ▼                                                     │
ASSIGNED                                                  │
    │                                                     │
    ▼                                                     │
IN_PROGRESS                                               │
    │                                                     │
    ▼                                                     │
COMPLETED ──────────────────────────────────────────────┐ │
    │                                                   │ │
    ▼                                                   │ │
VERIFIED                                                │ │
                                                        │ │
ESCALATED (from any state except VERIFIED/CANCELLED) ◄──┘ │
                                                          │
FAILED (from ROUTED if all partners exhausted) ◄──────────┘
    │
CANCELLED (from any state before COMPLETED)
```

| State | Meaning |
|---|---|
| `CREATED` | Request record exists. Not yet classified or routed. |
| `CLASSIFIED` | Urgency level and service type assigned. |
| `ROUTED` | A `PartnerRequest` has been sent to the first priority partner. Clock starts. |
| `PENDING_ACCEPTANCE` | Waiting for partner to accept or decline within the response window. |
| `ASSIGNED` | Partner has accepted. Full property address and access code delivered. |
| `IN_PROGRESS` | Partner has marked the job as started. |
| `COMPLETED` | Partner has marked the job as complete and uploaded proof-of-completion. |
| `VERIFIED` | Homeowner has reviewed completion. Terminal state — no further transitions. |
| `ESCALATED` | Human intervention required. AI pauses workflow. |
| `FAILED` | All available partners exhausted or timeout exceeded. Operator notified. |
| `CANCELLED` | Request cancelled before completion. Reason recorded. |

---

## 1. Trigger Sources

A `ServiceRequest` can be created by four actors. The trigger source is recorded on the request and affects routing priority and notification logic.

### 1.1 AI Concierge — `initiated_by: "ai_concierge"`

The AI creates a `ServiceRequest` in response to a guest message. Examples:
- Guest reports a maintenance issue ("the hot water isn't working")
- Guest requests a transfer for tomorrow morning
- Guest requests an experience booking
- Guest reports a cleaning issue mid-stay

**AI creation rule:** The AI must not create a `ServiceRequest` of type `MAINTENANCE_URGENT` or `EMERGENCY` autonomously. For urgent maintenance, the AI creates a standard `MAINTENANCE` request and simultaneously escalates via `TRIGGER-03 MAINTENANCE_URGENT`. For emergencies, the AI follows the emergency procedure — it does not create a ServiceRequest at all; it triggers an EscalationRecord with `trigger_type: EMERGENCY`.

**AI creation flow:**
1. AI classifies guest message as a service need
2. AI creates `ServiceRequest` with `initiated_by: "ai_concierge"`, `reservation_id`, `property_id`, `service_type`, `urgency`, and the guest's message in `description`
3. AI sends the guest an acknowledgement message: "I've submitted a [service type] request — [response window commitment]"
4. ServiceRequest enters `CREATED` state and moves to `CLASSIFIED` automatically

### 1.2 Homeowner — `initiated_by: "homeowner"`

Homeowner creates a request directly from the dashboard. Examples:
- Scheduling a post-checkout clean
- Requesting routine maintenance
- Scheduling routine maintenance (pool or garden maintenance is classified as MAINTENANCE at MVP)
- Requesting an inspection before a new reservation

Homeowner creation includes full job description, preferred date/time window, and optional notes for the partner.

### 1.3 Guest (via AI) — `initiated_by: "guest_direct"`

Distinct from AI-created requests when the guest's message is unambiguous and the AI is acting as a transparent pass-through rather than exercising judgment. Reserved for structured request forms (not currently available at MVP — all guest-triggered requests are `ai_concierge` at MVP).

**Post-MVP note:** When a self-service request form is added to the guest interface, `initiated_by: "guest_direct"` becomes meaningful. Do not implement this distinction at MVP — use `ai_concierge` for all AI-mediated requests.

### 1.4 Operator — `initiated_by: "operator"`

Nauxica team creates a request directly. Examples:
- Creating a maintenance request after an escalation is resolved
- Scheduling an inspection for a property returning from suspension
- Manually routing a job after a `FAILED` state is resolved

---

## 2. Classification Model

Classification happens immediately after `CREATED`. It assigns:
1. `service_type` — confirmed or inferred from trigger
2. `urgency` — based on content and classification rules below
3. `classification_source` — how urgency was determined

> **Enum casing note:** Enum values in this document use uppercase for readability (e.g. `EMERGENCY`, `URGENT`). Canonical SQL enum values are lowercase (e.g. `'emergency'`, `'urgent'`) as defined in [database-schema.md](../backend/database-schema.md) §2.

### 2.1 Urgency Levels

| Level | Code | Response time target | Examples |
|---|---|---|---|
| Emergency | `EMERGENCY` | Immediate (human, not partner) | Fire, flood, medical, gas leak |
| Urgent | `URGENT` | Partner response within 30 min | No hot water, broken lock, no electricity |
| High | `HIGH` | Partner response within 4 hours | Washing machine not working, pool pump failure |
| Normal | `NORMAL` | Partner response within 24 hours | AC unit servicing, minor repair, routine clean |
| Scheduled | `SCHEDULED` | Defined by homeowner at creation | Recurring maintenance visit, seasonal property service, pre-arrival property check |

**EMERGENCY classification:** If a `ServiceRequest` is classified as `EMERGENCY`, it is immediately escalated. No `PartnerRequest` is created. The request moves directly to `ESCALATED` state and an `EscalationRecord` of type `EMERGENCY` is created. The flow diverges from the standard path — see Section 8 (Escalation Flow).

### 2.2 Classification Rules

| Classification trigger | Assigned urgency |
|---|---|
| Keywords: "no hot water", "no electricity", "broken lock", "cannot enter" | `URGENT` |
| Keywords: "gas smell", "smoke", "fire", "flooding" | `EMERGENCY` |
| Keywords: "appliance not working", "pool not clean", "dirty" | `HIGH` |
| Homeowner explicitly sets urgency at creation | As specified |
| Standard post-checkout clean | `NORMAL` |
| Scheduled recurring job | `SCHEDULED` |
| AI cannot determine urgency | Default to `HIGH`, flag for human review |

### 2.3 Classification Source

| Value | Meaning |
|---|---|
| `ai_keyword_match` | AI matched known urgency keywords |
| `homeowner_specified` | Homeowner set urgency explicitly at creation |
| `operator_override` | Operator manually reclassified after creation |
| `default` | No classification rule matched; default applied |

---

## 3. Routing Logic

After classification, the system determines which partner to contact first.

### 3.1 Lookup sequence

```
1. Find all PartnerAssignments for:
   - property_id = ServiceRequest.property_id
   - service_type = ServiceRequest.service_type
   - assignment_status = "active"
   - valid_from ≤ today ≤ valid_until (or valid_until is null)

2. Check for ReservationPartnerOverride:
   - If reservation_id is set AND an active override exists for this service_type
   - Use override_partner_id as rank-1 dispatch target

3. Sort remaining by priority_rank ASC

4. Filter: partner.account_status = "active" AND partner.is_accepting_jobs = true

5. Select rank-1 partner from filtered list
```

### 3.2 No available partner

If no active, accepting partner is found:
- ServiceRequest moves to `FAILED` state if urgency is `NORMAL` or `SCHEDULED`
- ServiceRequest moves to `ESCALATED` state if urgency is `URGENT` or `HIGH`
- Homeowner and operator are notified immediately in both cases

### 3.3 Routing record

Each routing attempt is logged on the ServiceRequest with:
- `partner_id` — who was contacted
- `routed_at` — timestamp
- `response_deadline` — timestamp (routed_at + response window)
- `outcome` — `accepted` / `declined` / `timeout` / `pending`

---

## 4. Assignment Logic

### 4.1 PartnerRequest creation

When a partner is routed, a `PartnerRequest` is created:

| Field | Value |
|---|---|
| `service_request_id` | → ServiceRequest |
| `partner_id` | → Partner User |
| `property_id` | → Property |
| `status` | `pending` |
| `sent_at` | now() |
| `response_deadline` | now() + response_window |
| `job_date` | From ServiceRequest (if specified) |
| `description` | ServiceRequest.description |

The partner receives a notification (in-platform + SMS). ServiceRequest state is `PENDING_ACCEPTANCE`.

### 4.2 Partner accepts

- `PartnerRequest.status → accepted`
- `PartnerRequest.accepted_at` = now()
- `ServiceRequest.status → ASSIGNED`
- `ServiceRequest.assigned_partner_id` = partner_id
- Full property address revealed to partner
- Access code for service type delivered to partner via in-platform message
- `PartnerAssignment.access_granted = true`
- Homeowner notified: "[Service type] job accepted by your assigned partner. Expected arrival: [job date/time]."
- If `initiated_by = "ai_concierge"`: AI is notified to send guest a status update

### 4.3 Access code delivery at acceptance

Access code delivery is governed by [partner-assignment-model.md Section 7](../architecture/partner-assignment-model.md). Delivery happens once per `PartnerRequest`, at the moment `status = accepted`. It is not delivered at assignment time or before.

The access code delivered depends on `PartnerAssignment.access_type_granted`:
- `partner_code` — if property has a partner-specific code (Category H, Property schema)
- `guest_code` — fallback if no partner-specific code set
- `key_safe` — combination sent via in-platform message
- `in_person_handover` — contact information sent; no code applicable

**Security note:** Access codes are scoped to this `PartnerRequest` only. If the same partner performs multiple jobs at the same property, a new delivery event is logged for each. This supports rotation tracking.

---

## 5. Timeout and Reassignment

### 5.1 Response window monitoring

A background process monitors all `PartnerRequest` records with status `pending`:
- At `response_deadline`: if status is still `pending`, outcome = `timeout`
- PartnerRequest moves to `declined` (timed out)
- ServiceRequest remains in `ROUTED` state temporarily

### 5.2 Reassignment attempt

On timeout or explicit decline:

```
1. Mark current PartnerRequest as declined/timeout
2. Find next partner in priority_rank order (next after the current declined partner)
3. If next partner exists:
   - Create new PartnerRequest for next partner
   - ServiceRequest stays in PENDING_ACCEPTANCE state
   - Increment ServiceRequest.routing_attempt_count
4. If no next partner:
   - ServiceRequest → FAILED
   - Homeowner and operator notified immediately
```

**Maximum reassignment attempts:** No hard cap. The system exhausts all available, accepting partners before failing. In practice, most properties have 1–2 assigned partners per service type at MVP.

### 5.3 Reassignment notifications

| Event | Who is notified |
|---|---|
| First partner declines | No homeowner notification (handled silently — next partner contacted) |
| All partners exhausted | Homeowner and operator notified |
| URGENT job has no partner coverage | Operator notified within 5 minutes |

---

## 6. In-Progress and Completion Flow

### 6.1 In-progress marking

When the partner arrives at the property and begins work:
- Partner taps **Start job** in the platform dashboard
- `PartnerRequest.status → in_progress`
- `PartnerRequest.started_at` = now()
- `ServiceRequest.status → IN_PROGRESS`
- Homeowner optionally notified (configurable — default: notify for URGENT/HIGH only)

### 6.2 Job completion

When the partner finishes the job:
1. Partner taps **Mark as complete** in the dashboard
2. Platform prompts for completion photo(s) — required for CLEANING and MAINTENANCE
3. Partner adds optional completion note
4. `PartnerRequest.status → completed`
5. `PartnerRequest.completed_at` = now()
6. `ServiceRequest.status → COMPLETED`
7. Homeowner receives completion notification with photo(s) and note

If a guest was waiting on this job (service_request created by AI):
- `ServiceRequest.guest_status_message` is updated to reflect completion
- If the session is still active: AI sends the guest a completion message

---

## 7. Proof-of-Completion Model

### 7.1 What constitutes valid completion evidence

Completion evidence requirements vary by service type:

| Service type | Required evidence | Optional |
|---|---|---|
| CLEANING | ≥ 4 photos covering bedrooms, bathrooms, kitchen, living area | Completion note |
| MAINTENANCE | Before photo + after photo of the fixed item | During-work photo, materials note |
| LAUNDRY | Photo of cleaned/pressed linen bagged or returned | |
| TRANSFERS | Arrival confirmation (passenger safely delivered) — text confirmation | Screenshot of navigation |
| EXPERIENCES | Completion note confirming activity took place and guest count | Photo of activity |
| POOL_MAINTENANCE *(Post-MVP subtype)* | Photo of pool and water, plus reading notes if applicable | |
| INSPECTION *(Post-MVP subtype)* | Structured checklist completed in platform, minimum 6 photos | Full written report |

### 7.2 Photo requirements

- Minimum resolution: 800×600
- Must be uploaded via the platform (not sent via WhatsApp or external channel)
- Photos are stored in the platform with the job record — not deleted when the job closes
- Photos are PARTNER-scoped: visible to partner, homeowner, and operator. Not visible to guests.

### 7.3 Missing evidence

If a partner marks complete without required evidence:
- Platform blocks completion submission and prompts for missing photos
- If the partner bypasses via API (future concern): the completion is accepted but flagged for manual review

### 7.4 Verification state

After `COMPLETED`:
- ServiceRequest enters `COMPLETED` state pending homeowner review
- Homeowner is prompted to verify: "Did [service] complete satisfactorily?"
- Homeowner options: **Verify** / **Report an issue**

If homeowner verifies: `ServiceRequest → VERIFIED`. Terminal.
If homeowner reports an issue: dispute transition (see Section 10).
If homeowner takes no action within 48 hours: auto-verify. `ServiceRequest → VERIFIED`. This prevents open jobs accumulating indefinitely.

---

## 8. Escalation Flow

A ServiceRequest enters `ESCALATED` state when a resolution cannot be reached through the normal partner dispatch path.

### 8.1 Escalation triggers from service request context

| Trigger | Condition |
|---|---|
| EMERGENCY classification | ServiceRequest.urgency = EMERGENCY — immediately, no partner dispatch |
| All partners exhausted and urgency = URGENT | FAILED state → ESCALATED |
| Homeowner explicitly escalates | Dashboard action on any open request |
| Operator overrides | Manual flag |
| Unresolved after 3× response window (URGENT) | Auto-escalate |

### 8.2 Escalation state during a service request

When a ServiceRequest is escalated:
- An `EscalationRecord` is created (see [escalation-rules.md](../ai-concierge/escalation-rules.md))
- The ServiceRequest is linked to the EscalationRecord
- The AI concierge stops sending autonomous messages about this service request
- Operator is notified according to escalation SLA
- Homeowner is notified

### 8.3 Post-escalation resolution

When the escalation is resolved:
- Operator creates a new `PartnerRequest` directly (bypassing normal dispatch)
- Or: operator marks the ServiceRequest as CANCELLED with reason "handled_outside_platform"
- EscalationRecord is updated to `RESOLVED`
- Homeowner is notified of outcome

---

## 9. Cancellation Logic

A ServiceRequest can be cancelled before it reaches `COMPLETED` or `VERIFIED` state.

### 9.1 Who can cancel

| Actor | When | Condition |
|---|---|---|
| Homeowner | Any time before COMPLETED | Via dashboard |
| Operator | Any time before VERIFIED | Via admin tools |
| AI concierge | Not permitted — AI cannot cancel requests it creates |
| Partner | Not permitted — partner declines (before ASSIGNED) or reports issue (after ASSIGNED) |

### 9.2 Cancellation states

| Prior state | Effect |
|---|---|
| CREATED / CLASSIFIED | Cancel with no partner notification |
| ROUTED / PENDING_ACCEPTANCE | Cancel pending PartnerRequest; notify partner that request is withdrawn |
| ASSIGNED | Notify partner; cancellation fee logic (see Partner Agreement) applies |
| IN_PROGRESS | Notify partner; cancellation fee likely applies; operator review recommended |

### 9.3 Cancellation reasons

| Code | Description |
|---|---|
| `homeowner_no_longer_needed` | Issue resolved by other means |
| `guest_cancelled_stay` | Reservation cancelled — all related requests cancelled |
| `handled_outside_platform` | Homeowner arranged service directly |
| `duplicate_request` | Accidental duplicate |
| `operator_override` | Operator cancelled for operational reason |

---

## 10. Dispute Transition

A dispute on a ServiceRequest arises when the homeowner reports an issue at the verification stage.

### 10.1 Dispute trigger

Homeowner taps **Report an issue** at the verification prompt:
- ServiceRequest.status remains `COMPLETED` (not reverted)
- A `Dispute` record is created (see [dispute-resolution.md](../trust-safety/dispute-resolution.md))
- The ServiceRequest is linked to the Dispute
- ServiceRequest enters a suspended verification hold — auto-verify timer is paused

### 10.2 Types of completion disputes

| Type | Example |
|---|---|
| Quality dispute | "The apartment wasn't properly cleaned" |
| Scope dispute | "The partner didn't do everything I requested" |
| Damage dispute | "Something was broken after the job" |
| No-show dispute | "Partner accepted but never arrived" |

### 10.3 Evidence in dispute context

The `ServiceRequest` audit trail — routing history, PartnerRequest timestamps, completion photos, partner notes — is the primary evidence set in any dispute. This is why the audit trail (Section 12) is non-optional.

---

## 11. ServiceRequest Data Model (Extended)

The following extends [data-models.md Model 9](../backend/data-models.md) with full operational fields.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `property_id` | String → Property | |
| `reservation_id` | UUID → Reservation | Nullable — homeowner-created requests may not link to a reservation |
| `service_type` | Enum | One of 5 MVP service types: `CLEANING` / `MAINTENANCE` / `LAUNDRY` / `TRANSFERS` / `EXPERIENCES` — see [partner-assignment-model.md](../architecture/partner-assignment-model.md) |
| `initiated_by` | Enum | `ai_concierge` / `homeowner` / `guest_direct` / `operator` |
| `urgency` | Enum | `EMERGENCY` / `URGENT` / `HIGH` / `NORMAL` / `SCHEDULED` |
| `classification_source` | Enum | `ai_keyword_match` / `homeowner_specified` / `operator_override` / `default` |
| `status` | Enum | 11 states as defined in Section 1 |
| `description` | Text | Nature of the request. AI-created requests include the guest's message. |
| `guest_message` | Text | The exact guest message that triggered the request (AI-created only) |
| `guest_status_message` | Text | What the AI told the guest about this request. Updated at key transitions. |
| `assigned_partner_id` | UUID → User | Set when ASSIGNED state is reached |
| `routing_attempt_count` | Integer | Number of partners contacted. Starts at 0. |
| `routing_history` | Array of objects | One entry per routing attempt — see routing record in Section 3.3 |
| `linked_partner_request_id` | UUID → PartnerRequest | First PartnerRequest created. Set at initial routing; retained for traceability. Not updated on reassignment. |
| `active_partner_request_id` | UUID → PartnerRequest | Current PartnerRequest for live routing. Updated each time routing moves to a new partner. |
| `escalation_id` | UUID → EscalationRecord | Populated if request is escalated |
| `dispute_id` | UUID → Dispute | Populated if a dispute is opened |
| `completion_notes` | Text | Partner's completion note |
| `completion_photos` | Array of URLs | CDN links to proof-of-completion photos |
| `verified_at` | Datetime | When homeowner verified OR auto-verified |
| `verified_by` | Enum | `homeowner` / `auto` / `operator` |
| `cancelled_at` | Datetime | If cancelled |
| `cancellation_reason` | Enum | As defined in Section 9.3 |
| `created_at` | Datetime | |
| `updated_at` | Datetime | |

---

## 12. Operational Audit Trail

Every ServiceRequest generates a structured event log. This log is append-only — no event can be deleted or overwritten.

### 12.1 Events logged

| Event | Logged when |
|---|---|
| `sr.created` | Request created — includes initiator, trigger, initial description |
| `sr.classified` | Urgency and service_type assigned — includes classification_source |
| `sr.routed` | PartnerRequest sent — includes partner_id, response_deadline |
| `sr.partner_declined` | Partner declined or timed out — includes reason |
| `sr.assigned` | Partner accepted — includes partner_id, accepted_at |
| `sr.access_code_delivered` | Access code sent to partner — includes code_type, delivery_mechanism |
| `sr.in_progress` | Partner marked started |
| `sr.completed` | Partner marked complete — includes photo URLs, completion_note |
| `sr.verified` | Homeowner verified — includes verifier_type |
| `sr.auto_verified` | Auto-verified after 48h timeout |
| `sr.escalated` | Escalation triggered — includes escalation_id, trigger_reason |
| `sr.dispute_opened` | Homeowner reported issue at verification |
| `sr.cancelled` | Cancelled — includes actor, reason |
| `sr.failed` | All partners exhausted — includes routing_attempt_count |

### 12.2 Audit record format

Each entry includes:
- `event_type` — one of the types above
- `occurred_at` — timestamp (UTC, stored as ISO 8601)
- `actor` — who triggered the event (`system` / `partner_id` / `homeowner_id` / `operator_id`)
- `metadata` — event-specific payload (partner_id, reason code, photo count, etc.)

Audit records are retained for a minimum of 3 years post-request closure. This supports insurance claims, dispute resolution, and regulatory audit requirements.

---

## 13. Homeowner Notification Flow

Homeowners are notified at key transitions. Notification channel is determined by [notification-system.md](../architecture/notification-system.md).

| Transition | Notification | Channel |
|---|---|---|
| ServiceRequest created (AI-created) | "Your guest reported [issue type] — we've notified your partner" | Email / Dashboard |
| ASSIGNED | "[Service] job accepted — expected [date/time]" | Email / Dashboard |
| All partners declined | "[Service] job unassigned — action required" | Email + SMS |
| IN_PROGRESS (URGENT/HIGH only) | "Your partner has arrived and started work" | Dashboard |
| COMPLETED | "[Service] complete — photos attached. Please verify." | Email / Dashboard |
| Auto-verified (48h) | "Your job was auto-verified — no action needed" | Email |
| ESCALATED | "Your service request has been escalated — Nauxica is managing it" | Email + SMS |
| FAILED | "No available partner found for [service] — urgent attention required" | Email + SMS |
| CANCELLED by partner (after ASSIGNED) | "Your partner cancelled the job — reassigning" | Email / Dashboard |

---

## 14. Metrics Generated

These metrics are derived from ServiceRequest records. They feed the homeowner dashboard, partner monitoring, and Nauxica operational reporting.

### 14.1 Property-level metrics

| Metric | Derived from |
|---|---|
| Total requests this period | Count of ServiceRequests by property_id in date range |
| Requests by service type | Group by service_type |
| Average response time (partner acceptance) | Mean of (accepted_at − sent_at) across all requests |
| Average completion time | Mean of (completed_at − created_at) across COMPLETED requests |
| Unverified completion rate | Count of auto-verified / total VERIFIED |
| Dispute rate | Count of requests with dispute_id / total VERIFIED |
| FAILED rate | Count of FAILED requests / total requests |

### 14.2 Partner-level metrics

| Metric | Derived from |
|---|---|
| Response rate | Accepted + Declined within window / total PartnerRequests |
| Acceptance rate | Accepted / (Accepted + Declined) |
| Job completion rate | COMPLETED / ASSIGNED |
| Average job rating | Mean rating from Review records |
| Dispute rate (as the partner) | Count of disputes opened where partner is the assigned_partner |
| No-show rate | CANCELLED after ASSIGNED at partner's action |

### 14.3 Platform-level metrics (Nauxica ops)

| Metric | Threshold / purpose |
|---|---|
| FAILED request rate by service type | Signals partner coverage gap for that type or area |
| Average time to assignment (URGENT) | SLA monitoring — target < 30min |
| Escalation rate | High rate = systemic issue |
| Routing attempt count distribution | > 2 routing attempts = limited partner coverage in that area |

---

## 15. Edge Cases and Exception Handling

| Scenario | Handling |
|---|---|
| Reservation is cancelled while an open ServiceRequest exists | All ServiceRequests linked to that reservation_id are auto-cancelled with reason `guest_cancelled_stay` |
| Partner account suspended while a job is IN_PROGRESS | Job is not interrupted. Job is flagged for homeowner awareness. No new requests are routed to the partner. |
| Property moves to `suspended` state mid-request | Active IN_PROGRESS jobs are not interrupted. New ServiceRequests for this property are blocked until re-activation. |
| Duplicate ServiceRequest created (e.g. AI and homeowner both create a cleaning request for the same checkout) | Platform checks for existing open requests of the same service_type + reservation_id before creating. If one exists, return it rather than creating a duplicate. |
| Partner accepts, then finds no access code is available | Partner reports via issue flow. ServiceRequest does NOT auto-fail — it escalates. Operator resolves access issue and confirms access to partner. |
| Completion photos uploaded but of the wrong property | Identified at verification. Homeowner disputes. Dispute resolution process applies. |

---

## Related Documents

- [partner-assignment-model.md](../architecture/partner-assignment-model.md) — Assignment lifecycle and dispatch logic
- [data-models.md](../backend/data-models.md) — ServiceRequest and PartnerRequest model definitions
- [escalation-rules.md](../ai-concierge/escalation-rules.md) — Full escalation trigger and state machine
- [event-driven-architecture.md](../architecture/event-driven-architecture.md) — Events emitted by ServiceRequest lifecycle
- [notification-system.md](../architecture/notification-system.md) — Notification routing for all transitions
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — Dispute handling after completion
- [partner-vetting.md](../trust-safety/partner-vetting.md) — Metrics feeding partner monitoring model
