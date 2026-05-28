# Partner Assignment Model

Defines how service partners are formally assigned to properties in Nauxica, how assignments
are scoped, how partners are dispatched when a service need arises, and what data partners
receive.

**Related:** [Property Data Schema](../property-intake/property-data-schema.md) · [Data Models](../backend/data-models.md) · [Data Visibility Model](data-visibility-model.md) · [Escalation Rules](../ai-concierge/escalation-rules.md)

---

## 1. Purpose

A `PartnerAssignment` is the formal record that links a vetted partner to a property for a
specific type of service. It is the pre-requisite for automated dispatch — without an
assignment, the system cannot route a ServiceRequest to a partner.

Assignments are created by the homeowner (selecting from vetted partners on the platform) or
by Nauxica operators during onboarding. They persist until explicitly ended or the validity
period expires.

---

## 2. Service Type Taxonomy

Every assignment covers exactly one service type. A property may have multiple assignments —
one per service type, or multiple assignments for the same type with different priority ranks.

| Service Type Code | Description | Typical trigger |
|---|---|---|
| `CLEANING` | Post-checkout deep clean, mid-stay refresh, emergency clean | Reservation checkout; mid-stay request; incident |
| `LAUNDRY` | Linen and towel changeover, washing, pressing | Attached to cleaning cycle or standalone |
| `MAINTENANCE` | Repairs, technical fixes, installations, inspections | ServiceRequest from guest or homeowner; scheduled inspection |
| `POOL_MAINTENANCE` | Pool cleaning, chemical balance, equipment checks | Scheduled (weekly/fortnightly); on-request |
| `GARDEN_MAINTENANCE` | Grounds, irrigation, landscaping | Scheduled; season-based |
| `TRANSFER` | Airport/port pickups and dropoffs, inter-city transfers | Guest arrival/departure; on-request via AI concierge |
| `EXPERIENCE` | Tours, boat trips, cooking classes, wine tastings, cultural visits | On-request via AI concierge; proactive recommendation |
| `CONCIERGE_IN_PERSON` | On-site personal concierge (premium tier only) | Pre-arranged; premium property package |
| `INSPECTION` | Pre-activation inspection, inventory check, damage assessment | Property activation; post-departure; incident |

---

## 3. Assignment Object

The complete `PartnerAssignment` record. This extends the summary definition in
[Data Models §8](../backend/data-models.md) with full operational detail.

| Field | Type | Visibility | Required | Notes |
|---|---|---|---|---|
| `id` | UUID | internal | Yes | |
| `property_id` | String → Property | internal | Yes | |
| `partner_id` | UUID → User | internal | Yes | Must be an active, vetted Nauxica partner account. |
| `service_type` | Enum | internal | Yes | One of the 9 service types above. |
| `assignment_status` | Enum | internal | Yes | `active` / `paused` / `ended` |
| `is_preferred` | Boolean | internal | Yes | If true, this partner is dispatched first when a ServiceRequest of this type is created. Default: true if only one assignment for this type. |
| `priority_rank` | Integer | internal | Yes | If multiple assignments for same service type: 1 = first dispatch attempt, 2 = backup, etc. |
| `valid_from` | Date | internal | Yes | ISO 8601. Inclusive. |
| `valid_until` | Date | internal | No | ISO 8601. Null = ongoing. Supports seasonal partner arrangements. |
| `schedule_type` | Enum | internal | No | `on_demand` / `scheduled_recurring` / `both`. For cleaning and maintenance, `on_demand` is standard. For pool/garden, `scheduled_recurring` is typical. |
| `recurring_schedule` | Object | internal | Conditional | Required if `schedule_type` includes `scheduled_recurring`. See recurring schedule object below. |
| `partner_briefed` | Boolean | internal | Yes | True when the partner has been given access to the property brief for their service type. |
| `partner_briefed_at` | Datetime | internal | Conditional | |
| `access_granted` | Boolean | internal | Yes | True when the partner has been given the relevant access code(s) for their service type. |
| `access_type_granted` | Enum | internal | Conditional | `guest_code` / `partner_code` / `key_safe` / `in_person_handover`. See Property Schema Category H. |
| `notes` | Text | partner | No | Operational notes visible to the assigned partner only. PARTNER visibility scope. |
| `homeowner_notes` | Text | internal | No | Notes visible only to the homeowner and operator. Not shared with partner. |
| `created_by` | UUID → User | internal | Yes | Homeowner or operator who created this assignment. |
| `created_at` | Datetime | internal | Yes | |
| `updated_at` | Datetime | internal | Yes | |
| `ended_at` | Datetime | internal | Conditional | Set when status transitions to `ended`. |
| `ended_reason` | String | internal | No | e.g. "Partner no longer operating in area", "Homeowner changed provider". |

**Recurring schedule object:**
```
frequency: Enum  ("weekly" | "fortnightly" | "monthly" | "custom")
day_of_week: Array[String]  // e.g. ["monday", "thursday"] for twice-weekly
time_of_day: Time           // Preferred start time
duration_hours: Decimal     // Expected job duration
auto_create_request: Boolean // If true, PartnerRequest is auto-created on schedule
```

---

## 4. Assignment Lifecycle

```
DRAFT (homeowner selecting a partner)
    │
    ▼
ACTIVE (partner assigned, briefed, access granted)
    │
    ├── PAUSED (temporary — e.g. partner on holiday, property suspended)
    │       │
    │       └── ACTIVE (resumed when condition clears)
    │
    └── ENDED (permanent — partner leaves, homeowner changes provider)
```

**Transition rules:**
- `DRAFT → ACTIVE`: Homeowner selects partner from vetted marketplace. Partner accepts assignment.
- `ACTIVE → PAUSED`: Homeowner or operator action. Does not delete dispatch history.
- `PAUSED → ACTIVE`: Manual reactivation by homeowner or auto-reactivation if `valid_from` condition met.
- `ACTIVE → ENDED`: Homeowner terminates, partner terminates, or `valid_until` date passes.

**When an assignment ends:** ServiceRequests with status `open` or `assigned` that are linked to this partner are flagged for operator review. They are not automatically re-assigned.

---

## 5. Multi-Assignment and Priority Dispatch

A property may have more than one assignment per service type — typically one preferred partner
and one or more backups. This supports:
- Partner unavailability (illness, fully booked)
- Seasonal capacity changes
- Regional coverage gaps

**Dispatch priority rule:**
```
When a ServiceRequest is created:
  1. Find all ACTIVE PartnerAssignments for this property + service_type
  2. Order by priority_rank ASC (1 = highest priority)
  3. Attempt dispatch to rank 1 partner
  4. If rank 1 declines or does not respond within response window → attempt rank 2
  5. If all assignments exhausted → notify homeowner + operator
```

**Partner response window per service type:**

| Service Type | Response window before trying next partner |
|---|---|
| CLEANING | 2 hours |
| MAINTENANCE (routine) | 4 hours |
| MAINTENANCE (urgent) | 30 minutes |
| TRANSFER | 1 hour |
| EXPERIENCE | 4 hours |
| POOL / GARDEN | 24 hours |

---

## 6. What Partners Receive (The Partner Brief)

When a partner is assigned to a property and `partner_briefed = true`, they receive a
**Partner Brief** — a PARTNER-scoped data projection of the property record.

The Partner Brief contains:

| Data | Source | Notes |
|---|---|---|
| Property display name | Property.display_name | |
| City and area | Property.address_locality + municipality | Not full street address by default |
| Full street address | Property.address_street | Provided once assignment is active and first job is confirmed |
| Property type and capacity | Property.property_type, max_guests, bedrooms | Context for job scope |
| Access method and code | Property.partner_entry_method + relevant code | PARTNER scope. Shared only when job is confirmed, not at assignment time. |
| Partner entry instructions | Property.partner_entry_instructions | |
| Key return instructions | Property.key_return_after_job | |
| Service-specific instructions | Depends on service type — see below | |
| Assignment notes | PartnerAssignment.notes | |
| Emergency contact | Property.owner_emergency_name + phone | For partner to contact owner if they find a problem |

**Service-specific fields by type:**

| Service Type | Additional fields shared |
|---|---|
| CLEANING | `cleaning_inventory_notes`, `linen_changeover_notes`, `property_quirks_for_partners`, `checkout_tasks` (so cleaner knows what guest should have done) |
| MAINTENANCE | `property_quirks_for_partners`, `maintenance_priority_items`, `gas_shutoff_location`, `water_shutoff_location`, `electricity_shutoff_location` |
| POOL_MAINTENANCE | `pool_type`, `pool_instructions`, `pool_heated`, pool maintenance notes from `property_quirks_for_partners` |
| GARDEN_MAINTENANCE | `garden_instructions`, `garden_available` |
| TRANSFER | Pickup/dropoff address (from reservation, not property), guest name, guest count, flight/ferry details from reservation |
| EXPERIENCE | Relevant experience description, booking reference, guest count |
| INSPECTION | Full PARTNER brief + access to all Category H fields |

**What partners must NOT receive:**
- Full property owner personal details beyond the designated emergency contact
- Financial data (owner bank details, commission rates, revenue data)
- Other guests' reservation details (only the specific reservation being served)
- Internal Nauxica operator notes
- Other partner assignments for the same property

---

## 7. Access Code Delivery to Partners

Access codes are delivered to partners at job confirmation time — not at assignment time.

| Access type | Delivered when | Mechanism |
|---|---|---|
| Guest lockbox code (shared) | When PartnerRequest status = `accepted` | Sent via in-platform message or push notification |
| Partner-specific code (if set) | When PartnerRequest status = `accepted` | Sent via in-platform message |
| Key safe combination | When PartnerRequest status = `accepted` | Sent via in-platform message |
| In-person key handover contact | At assignment briefing | Included in Partner Brief |

**Security rule:** Access codes for partner use are PARTNER scope. They must never appear in
guest-facing messages or in AI concierge responses. If a guest asks "what code does the cleaner
use?", the AI must not answer.

**(Legal review required)** Partner access to the property using security credentials constitutes
a form of authorised access. The assignment record and access code delivery log should be
retained as evidence of authorisation, particularly relevant for insurance and dispute purposes.

---

## 8. Reservation-Level Assignment Overrides

In some cases, a homeowner may want to use a different partner for a specific reservation —
for example, when the regular cleaner is unavailable for a specific date, or a guest has
specifically requested a different experience provider.

**Override model:**
```
ReservationPartnerOverride {
    reservation_id: UUID
    service_type: Enum
    override_partner_id: UUID → User
    override_reason: String  // internal only
    created_by: UUID → User
}
```

When a ServiceRequest is created for a reservation that has an active override for that service type, the dispatch flow uses the override partner instead of the priority-ranked assignment.

Overrides are one-time — they apply to the specific reservation only and do not modify the base PartnerAssignment.

---

## 9. AI Concierge Interaction Rules

The AI concierge is aware of partner assignments at a functional level — but never shares partner identity or contact details with guests.

**What the AI can say:**
- "We have a cleaning team assigned to this property."
- "I've submitted a maintenance request — a partner will be in touch shortly."
- "We can arrange a transfer for your arrival — shall I request one?"
- "A maintenance partner has been notified and will contact you within [response window for service type]."

**What the AI must NOT say:**
- Partner's name
- Partner's phone number
- Partner's company name
- Which specific partner is assigned
- Any details from PartnerAssignment.notes

**How the AI creates service requests that trigger partner dispatch:**

1. Guest requests a service (transfer, experience, maintenance report)
2. AI creates a `ServiceRequest` with `initiated_by = ai_concierge`
3. System looks up the relevant `PartnerAssignment` for the property
4. A `PartnerRequest` is auto-created and sent to the preferred partner
5. The AI tells the guest the request has been submitted and gives a realistic ETA based on
   the response window for that service type

---

## 10. Partner Visibility Rules Summary

Visibility scopes in this model follow the [Data Visibility Model](data-visibility-model.md).

| Data type | Visibility | AI concierge |
|---|---|---|
| Assignment existence for a service type | internal | May acknowledge ("we have a cleaner") |
| Partner identity (name, company) | internal | Must NOT share |
| Partner contact details | partner | Must NOT share |
| Access codes delivered to partners | partner | Must NOT share |
| Assignment notes | partner | Must NOT share |
| Job status once dispatched | guest (status message only) | May share via `ServiceRequest.guest_status_message` |
| Partner rating and profile (on platform) | public | May reference ("our partners are vetted and rated") |

---

## 11. Future Database Readiness Notes

- `PartnerAssignment` maps cleanly to a dedicated table with composite index on
  `(property_id, service_type, assignment_status)` for fast dispatch lookups.
- `recurring_schedule` maps to a JSONB column in PostgreSQL or a nested document in MongoDB.
- `ReservationPartnerOverride` is a lightweight junction table: `(reservation_id, service_type)` → `override_partner_id`.
- Partner dispatch audit logs (who was notified, when, what they responded) should be a
  separate `DispatchEvent` table, not embedded in PartnerRequest, to support future
  partner performance analytics.
- Access code delivery events should be logged in a separate `AccessCodeDeliveryLog` table
  for security audit purposes.
- When multi-property management is supported (homeowners managing multiple properties),
  consider a `PropertyGroup` model that allows a single assignment to cover a portfolio —
  but do not build this at MVP.
