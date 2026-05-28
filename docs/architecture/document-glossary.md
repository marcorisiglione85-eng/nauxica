# Document Glossary

**Version:** 1.0
**Status:** Complete — Governance phase
**Scope:** Platform-wide · All documentation and implementation
**Last updated:** 2026-05-28
**Audience:** All contributors — engineers, operations, documentation maintainers, AI agents
**Related:** [documentation-consistency-audit.md](documentation-consistency-audit.md) · [cross-reference-map.md](cross-reference-map.md) · [data-visibility-model.md](data-visibility-model.md) · [data-models.md](../backend/data-models.md)

---

## Purpose

This glossary defines every major term, object, role, and acronym used across the Nauxica documentation. It is the single source of truth for naming. When a term appears in any document, it must match the canonical form defined here.

**Prohibited terms** are names that have been used informally but must no longer appear in any documentation, code comment, or operational communication. They create ambiguity or conflict with the canonical naming.

---

## Actor Roles

### Homeowner

**Canonical:** Homeowner
**Prohibited alternatives:** property owner, host, owner, rental operator (in platform-role contexts)
**Definition:** The person or entity with a Nauxica account who manages one or more rental properties on the platform. Responsible for property data, partner assignments, compliance obligations, and subscription fees. Does not manage guest accounts — guests have no accounts.
**Where used:** All documents
**Domain:** Commercial, Operations, Legal

---

### Guest

**Canonical:** Guest
**Prohibited alternatives:** traveller, tenant, renter
**Definition:** A person staying at a Nauxica-managed property during a confirmed reservation. Has no Nauxica account. Interacts with the platform exclusively via WhatsApp. Identity is established by phone number matched to a reservation record.
**Where used:** All documents
**Domain:** Operations, AI Concierge

---

### Partner

**Canonical:** Partner (or "service partner" for full context)
**Prohibited alternatives:** vendor, contractor, supplier, service provider (in internal docs — use "partner")
**Definition:** A vetted independent service provider registered on the Nauxica marketplace. Provides one or more services (cleaning, maintenance, laundry, transfers, experiences). Has a Nauxica account. Invoices homeowners directly. Is not an employee of Nauxica.
**Where used:** All documents
**Domain:** Operations, Trust & Safety, Legal

---

### Operator

**Canonical:** Operator (capital O when referring to the platform role)
**Prohibited alternatives:** admin, Nauxica ops, support staff (do not use as synonyms for the access-control role)
**Definition:** A Nauxica staff member with elevated system access. Responsible for escalation response, platform health, partner approvals, and quality gates. At MVP, the operator is the founder. Operator is an RBAC role that grants elevated access to `INT`-scoped data — `OPERATOR` is not a visibility scope.
**Where used:** `operator-runbook.md`, `escalation-rules.md`
**Domain:** Operations, Security

> **Important:** Do not use "operator" to mean homeowner (e.g. "rental operator"). The term is reserved for the Nauxica staff access role. For the short-term rental industry meaning, use "short-term rental operator" only in contexts clearly not referring to platform roles.

---

### AI Concierge

**Canonical:** AI concierge (lowercase 'c')
**Prohibited alternatives:** GuestPal, Nauxica concierge, WhatsApp concierge, AI assistant, concierge AI, the bot
**Definition:** The automated WhatsApp guest assistant. Operates within a strict scope boundary defined by the data visibility model. Serves confirmed guests with property-specific information during their stay. Cannot be elevated by user prompt to access data outside its permitted scope.
**Where used:** All AI concierge documents, operations, onboarding
**Domain:** AI Concierge, Operations

---

## Core Data Objects

### PropertyKnowledgeBlock

**Canonical:** `PropertyKnowledgeBlock` (PascalCase in code and technical contexts; "property knowledge block" in prose)
**Prohibited alternatives:** knowledge base, knowledge block (ambiguous — always qualify with "property"), property data
**Definition:** The AI-safe, structured content layer derived from a property's raw data. Contains only guest-visible fields and AI-safe operational content. Constructed by the Knowledge Block Builder (KBB). The AI concierge reads exclusively from the `PropertyKnowledgeBlock` — never from raw property data.
**Source of truth:** `docs/ai-concierge/property-knowledge-schema.md`
**Domain:** AI Concierge, Data

---

### KBB (Knowledge Block Builder)

**Canonical:** KBB (acronym), Knowledge Block Builder (full form)
**Prohibited alternatives:** knowledge pipeline, content processor
**Definition:** The 7-step transformation pipeline that converts raw property data into a `PropertyKnowledgeBlock`. Steps: scope filter → activation gate → dynamic instruction merge → language selection → access code gate → emergency data inject → chunk structure. Runs on-demand (triggered by message receipt) or on-schedule (nightly pre-computation for active properties).
**Source of truth:** `docs/ai-concierge/knowledge-retrieval-model.md`
**Domain:** AI Concierge, Data

---

### ServiceRequest

**Canonical:** `ServiceRequest` (PascalCase in code; "service request" in prose)
**Prohibited alternatives:** job request (in technical contexts), PartnerRequest (these are different objects — see below)
**Definition:** The demand-side record of a need at a property. Created when: a guest requests a service via the AI concierge, a homeowner creates a manual request, or a recurring schedule triggers. One `ServiceRequest` may generate multiple `PartnerRequest` records if the first partner declines. Lifecycle: `CREATED → CLASSIFIED → ROUTED → PENDING_ACCEPTANCE → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED` (plus `ESCALATED`, `FAILED`, `CANCELLED` terminal states).
**Source of truth:** `docs/operations/service-request-flow.md`
**Domain:** Operations, AI Concierge

---

### PartnerRequest

**Canonical:** `PartnerRequest` (PascalCase in code; "job request" in partner-facing prose)
**Prohibited alternatives:** ServiceRequest (these are different objects — see above)
**Definition:** The supply-side dispatch record. Created when a `ServiceRequest` is routed to a specific partner. Represents the ask to one specific partner for one specific job. The partner accepts or declines the `PartnerRequest`. If declined, a new `PartnerRequest` is created for the next partner in priority order. "Job request" is acceptable in partner-facing documents where the ServiceRequest/PartnerRequest distinction is not operationally relevant to the partner.
**Source of truth:** `docs/operations/service-request-flow.md`, `docs/backend/data-models.md`
**Domain:** Operations, Partner

---

### GuestStayContext

**Canonical:** `GuestStayContext`
**Prohibited alternatives:** stay context, guest context, check-in record
**Definition:** Operational check-in and checkout data for a specific stay. Linked to a `Reservation`. Tracks: actual check-in time, checkout time, guest-reported issues, mid-stay requests, and AI session events. Distinct from the `Reservation` record (which is the commercial/scheduling record).
**Source of truth:** `docs/backend/data-models.md`
**Domain:** Operations, AI Concierge

---

### WhatsAppSession

**Canonical:** `WhatsAppSession`
**Prohibited alternatives:** chat session, guest session, conversation record
**Definition:** The AI concierge conversation state bound to a specific guest, reservation, and property. Tracks: session phase, language preference, escalation state, unresolved query count, and message history. Lives for the duration of a stay plus the post-checkout grace period.
**Source of truth:** `docs/ai-concierge/whatsapp-session-anchor.md`, `docs/backend/data-models.md`
**Domain:** AI Concierge

---

### EmergencyData

**Canonical:** `EmergencyData`
**Prohibited alternatives:** emergency contacts, safety data
**Definition:** Property-level emergency contacts and procedures. Pre-loaded into every AI concierge session regardless of session phase. Contains: homeowner emergency contact, nearest hospital (name and address), gas/water/electricity shutoffs, fire extinguisher location, evacuation routes. An activation blocker — a property cannot activate without complete `EmergencyData`.
**Source of truth:** `docs/ai-concierge/emergency-procedures.md`, `docs/backend/data-models.md`
**Domain:** AI Concierge, Operations, Safety

---

### EscalationRecord

**Canonical:** `EscalationRecord`
**Prohibited alternatives:** escalation ticket, support ticket, incident record
**Definition:** The record created when the AI concierge hands off a conversation to a human operator. Contains: trigger type, timestamp, conversation context, resolution state, and operator notes. Lifecycle: `PENDING → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED`.
**Source of truth:** `docs/ai-concierge/escalation-rules.md`, `docs/backend/data-models.md`
**Domain:** AI Concierge, Operations

---

### PartnerAssignment

**Canonical:** `PartnerAssignment`
**Prohibited alternatives:** partner contract, partner booking, service assignment
**Definition:** The formal record linking a vetted partner to a property for a specific service type. Created by the homeowner (or operator during onboarding). Prerequisite for automated dispatch — without a `PartnerAssignment`, no `PartnerRequest` can be routed. Lifecycle: `DRAFT → ACTIVE → PAUSED → ENDED`.
**Source of truth:** `docs/architecture/partner-assignment-model.md`
**Domain:** Operations, Partner

---

### DynamicInstruction

**Canonical:** `DynamicInstruction`
**Prohibited alternatives:** override instruction, temporary note, homeowner override
**Definition:** A time-bounded instruction set by the homeowner that temporarily overrides or supplements a property knowledge field. Example: "Pool closed for maintenance until Saturday — tell guests not to use it." Merged into the `PropertyKnowledgeBlock` by the KBB during its dynamic instruction merge step. Expires at the set date or when manually removed.
**Source of truth:** `docs/ai-concierge/property-knowledge-schema.md`, `docs/ai-concierge/knowledge-retrieval-model.md`
**Domain:** AI Concierge, Operations

---

### EventEnvelope

**Canonical:** `EventEnvelope`
**Prohibited alternatives:** event wrapper, event payload, message envelope
**Definition:** The standard container for all domain events in the Nauxica event system. Fields: `event_id` (UUID), `event_type` (namespaced string), `aggregate_id`, `aggregate_type`, `occurred_at` (UTC), `schema_version`, `payload`, `correlation_id`. All events published to the queue are wrapped in an `EventEnvelope`.
**Source of truth:** `docs/architecture/event-driven-architecture.md`
**Domain:** Architecture, Backend

---

### Partner Brief

**Canonical:** Partner Brief (title case as a named artifact)
**Prohibited alternatives:** job brief, property brief (can cause confusion with general property docs)
**Definition:** The curated, service-type-scoped summary of property information delivered to a partner when they accept a `PartnerRequest`. Derived from the `PropertyKnowledgeBlock` but scoped to partner-relevant fields only. Contains: property address, access instructions, access code, relevant property-specific instructions for the service type, emergency contact. Never includes guest data or commercial terms.
**Source of truth:** `docs/onboarding/partner/first-job-walkthrough.md` §5
**Domain:** Operations, Partner

---

## Visibility Scopes

The canonical visibility scope identifiers are shortcodes (`PUB`, `GST`, `PTR`, `INT`). These are the authoritative forms in schema tables and implementation. Prose descriptions may use the full-word equivalents.

### PUB (Public) scope

**Canonical:** `PUB` (schema tables); "public" or "publicly visible" (prose)
**Full form:** PUBLIC
**Definition:** Data safe to expose before any authentication — visible on public-facing surfaces such as a booking landing page or property listing.
**Examples:** Property display name, property type, general location (municipality), partner public ratings, aggregate review scores.
**Source of truth:** `docs/architecture/data-visibility-model.md`

---

### GST (Guest) scope

**Canonical:** `GST` (schema tables); "guest-visible" or "guest-scoped" (prose)
**Full form:** GUEST
**Prohibited alternatives:** public, open, readable
**Definition:** Data visible to the AI concierge and safe to surface to a confirmed guest in a WhatsApp conversation. The AI concierge may read and share GST-scoped data freely. All authenticated actors can read GST-scoped data.
**Examples:** WiFi password, check-in instructions, house rules, emergency numbers, local recommendations.
**Source of truth:** `docs/architecture/data-visibility-model.md`

---

### PTR (Partner) scope

**Canonical:** `PTR` (schema tables); "partner-scoped" (prose)
**Full form:** PARTNER
**Definition:** Data that assigned service partners need to perform their job, but that guests must not see. The AI concierge may read PTR-scoped data to trigger dispatch but must never relay it to a guest.
**Examples:** Cleaner-specific access code, cleaning notes with internal observations, partner contact details, job-specific instructions.
**Source of truth:** `docs/architecture/data-visibility-model.md`

---

### INT (Internal) scope

**Canonical:** `INT` (schema tables); "internal" (prose)
**Full form:** INTERNAL
**Definition:** Authenticated-system data. Never exposed to guests or partners. Homeowners can access their own INT-scoped data; Nauxica operators have broader INT-scoped access. The distinction is enforced by RBAC permission checks, not by a separate scope value.
**Examples:** Raw database IDs, hashed passwords, Stripe customer IDs, webhook secrets, system audit logs, homeowner financial details, subscription tier, compliance flags, account suspension reasons.
**Source of truth:** `docs/architecture/data-visibility-model.md`

---

> **Note on OPERATOR scope:** `OPERATOR` is not a visibility scope — it is an RBAC role. Data formerly described as `OPERATOR`-scoped is `INT`-scoped. See the [[Operator]] actor role definition and `docs/architecture/data-visibility-model.md` §3 for the full rationale. (Resolves audit finding C-01.)

---

## Session Phases

Session phases are `snake_case` enum values used in the `WhatsAppSession` and `GuestStayContext` models. The canonical values are:

| Phase | Canonical value | Meaning |
|---|---|---|
| Pre-arrival | `pre_arrival` | Reservation confirmed; guest has not yet arrived |
| Check-in | `check_in` | Today is the guest's check-in date |
| In-stay | `in_stay` | Guest is checked in; active stay |
| Check-out | `check_out` | Today is the guest's checkout date |
| Post-stay | `post_stay` | Guest has departed; grace period active (AI session winds down) |

**Prohibited alternatives:** `pre-arrival` (hyphenated), `checked-in`, `checked_in`, `checkin`, `check_in_day`, `checkout_day`, `post_checkout` (incorrect values — use `check_in`, `check_out`, `post_stay`)

**Source of truth:** `docs/ai-concierge/whatsapp-session-anchor.md`

---

## Assignment Lifecycle States

`PartnerAssignment` states are `SCREAMING_SNAKE_CASE`:

| State | Meaning |
|---|---|
| `DRAFT` | Homeowner is in the process of selecting a partner |
| `ACTIVE` | Partner is assigned, briefed, and access-granted |
| `PAUSED` | Temporarily inactive (partner on leave, property suspended) |
| `ENDED` | Permanently closed |

**Source of truth:** `docs/architecture/partner-assignment-model.md`

---

## ServiceRequest Lifecycle States

`ServiceRequest` states are `SCREAMING_SNAKE_CASE`:

| State | Meaning |
|---|---|
| `CREATED` | Request exists, not yet classified |
| `CLASSIFIED` | Service type confirmed, urgency set |
| `ROUTED` | Dispatched to first partner in priority order |
| `PENDING_ACCEPTANCE` | Awaiting partner response |
| `ASSIGNED` | Partner has accepted |
| `IN_PROGRESS` | Partner has begun the job |
| `COMPLETED` | Partner has marked job complete |
| `VERIFIED` | Homeowner has verified completion |
| `ESCALATED` | Escalated due to no-show, quality issue, or safety concern |
| `FAILED` | All partners exhausted without acceptance |
| `CANCELLED` | Cancelled before completion |

**Source of truth:** `docs/operations/service-request-flow.md`

---

## EscalationRecord Lifecycle States

| State | Meaning |
|---|---|
| `PENDING` | Escalation created; operator not yet notified or acknowledged |
| `ACKNOWLEDGED` | Operator has seen the escalation |
| `IN_PROGRESS` | Operator is actively resolving |
| `RESOLVED` | Issue resolved; AI may resume if appropriate |
| `CLOSED` | Record archived |

**Source of truth:** `docs/ai-concierge/escalation-rules.md`

---

## Escalation Severity Levels

Used in `EscalationRecord` and operator notifications:

| Level | Label | Response SLA | Examples |
|---|---|---|---|
| 1 | `CRITICAL` | 0–5 minutes | Active medical emergency, fire, gas leak |
| 2 | `URGENT` | 0–30 minutes | Guest locked out after 22:00, suspected security threat |
| 3 | `HIGH` | 0–2 hours | Urgent maintenance needed, partner no-show for imminent checkout |
| 4 | `NORMAL` | Next business day | Non-urgent complaints, routine quality flags |

**Source of truth:** `docs/ai-concierge/escalation-rules.md`

---

## Escalation Triggers

Used in `EscalationRecord.trigger_type`. All 11 canonical triggers:

| Code | Name | Meaning |
|---|---|---|
| `TRIGGER-01` | `EMERGENCY` | Life-safety event detected |
| `TRIGGER-02` | `SAFETY_CONCERN` | Non-immediate safety risk (e.g. faulty appliance) |
| `TRIGGER-03` | `MAINTENANCE_URGENT` | Urgent repair needed — cannot wait for standard routing |
| `TRIGGER-04` | `HUMAN_REQUESTED` | Guest explicitly requested a human |
| `TRIGGER-05` | `CONFIDENCE_THRESHOLD` | 3 unresolved queries in a session |
| `TRIGGER-06` | `COMPLAINT_ESCALATION` | Guest complaint escalated beyond AI handling |
| `TRIGGER-07` | `LEGAL_LIABILITY` | Legal or dispute language detected |
| `TRIGGER-08` | `RESERVATION_MODIFICATION_REQUEST` | Guest attempting to modify booking terms |
| `TRIGGER-09` | `PAYMENT_DISPUTE` | Payment or refund dispute raised |
| `TRIGGER-10` | `ABUSE_DETECTED` | Threatening or abusive message behaviour |
| `TRIGGER-11` | `IDENTITY_UNRESOLVABLE` | Cannot match phone number to any reservation |

**Source of truth:** `docs/ai-concierge/escalation-rules.md`
**Note:** `TRIGGER-08` was formerly `BOOKING_MODIFICATION_REQUEST` — renamed in line with the Booking→Reservation rename.

---

## Service Types

Canonical enum values for partner service types. All `SCREAMING_SNAKE_CASE`. Values marked **MVP** are in scope at Sicily launch. Values marked **Post-MVP** are defined in the data model but not activated at launch.

| Code | Label | Vetting tier | MVP? |
|---|---|---|---|
| `CLEANING` | Cleaning | Tier 2 — High | MVP |
| `MAINTENANCE` | Maintenance | Tier 2 — High | MVP |
| `LAUNDRY` | Laundry | Tier 1 — Standard | MVP |
| `TRANSFER` | Transfer | Tier 1 — Standard | MVP |
| `EXPERIENCE` | Experience | Tier 1 — Standard | MVP |
| `POOL_MAINTENANCE` | Pool Maintenance | Tier 2 — High | Post-MVP |
| `GARDEN_MAINTENANCE` | Garden Maintenance | Tier 1 — Standard | Post-MVP |
| `CONCIERGE_IN_PERSON` | In-Person Concierge | Tier 2 — High | Post-MVP |
| `INSPECTION` | Inspection | Tier 2 — High | Post-MVP |

**Source of truth:** `docs/architecture/partner-assignment-model.md`
**Note on naming:** Always singular (`TRANSFER` not `TRANSFERS`). Partner-facing prose may use plural ("transfers partner", "experiences") — but enum values are singular.

---

## Architecture Terms

### DLQ (Dead Letter Queue)

**Definition:** A secondary queue that receives messages which could not be processed after the maximum retry count. Every domain queue has a corresponding DLQ. DLQ depth is monitored by the operator. A growing DLQ indicates a processing failure that requires investigation.
**Source of truth:** `docs/architecture/event-driven-architecture.md`

---

### AI Runtime

**Canonical:** AI Runtime (or "AI runtime orchestrator" in full)
**Prohibited alternatives:** AI engine, inference service, LLM layer
**Definition:** The backend service that processes inbound WhatsApp messages, runs the full orchestration pipeline (Steps 1–11 in the orchestration document), calls the LLM API, and produces outbound responses and action records. Triggered exclusively by `guest.WhatsAppMessage.Received` events. Cannot be called directly via API.
**Source of truth:** `docs/ai-runtime/ai-runtime-orchestration.md`
**Domain:** AI, Backend

---

### Trust Score

**Canonical:** Trust Score (operational concept, not yet a formal metric)
**Definition:** A composite measure of a partner's reliability and conduct on the platform. Inputs include: response rate, acceptance rate, completion rate, homeowner rating, and dispute history. Currently assessed manually by the operator. Formal automated calculation is a post-MVP feature.
**Source of truth:** `docs/trust-safety/partner-vetting.md`

---

### Reliability Score

**Canonical:** Reliability Score (operational concept, not yet a formal metric)
**Definition:** A partner-specific measure focused on operational dependability: response rate, no-show rate, and completion-on-time rate. Distinct from Trust Score in that it measures operational reliability only, not overall conduct.
**Note:** Neither Trust Score nor Reliability Score is formally calculated at MVP. Both are assessed manually. The distinction should be preserved for post-MVP implementation.
**Source of truth:** `docs/trust-safety/partner-vetting.md`

---

## Acronym Index

| Acronym | Full form | Defined in |
|---|---|---|
| ADR | Average Daily Rate | `subscription-plans.md` |
| API | Application Programming Interface | general |
| CET | Central European Time | `whatsapp-concierge-guidelines.md` |
| CEST | Central European Summer Time | `whatsapp-concierge-guidelines.md` |
| CIR | Codice Identificativo di Riferimento | `regulatory-compliance-checklist.md` |
| CIN | Codice Identificativo Nazionale | `regulatory-compliance-checklist.md` |
| DLQ | Dead Letter Queue | `event-driven-architecture.md` |
| E.164 | International phone number format standard | `whatsapp-session-anchor.md` |
| FIFO | First In First Out | `event-driven-architecture.md` |
| GDPR | General Data Protection Regulation | `regulatory-compliance-checklist.md` |
| JWT | JSON Web Token | `security-model.md` |
| KBB | Knowledge Block Builder | `knowledge-retrieval-model.md` |
| LLM | Large Language Model | `ai-runtime-orchestration.md` |
| MVP | Minimum Viable Product | All documents — first use should define as "Sicily launch phase" |
| OTA | Online Travel Agency | `subscription-plans.md` |
| OTP | One-Time Password | `partner-onboarding.md`, `security-model.md` |
| p95 | 95th percentile | `ai-runtime-orchestration.md` |
| p99 | 99th percentile | `ai-runtime-orchestration.md` |
| P.IVA | Partita IVA (Italian VAT number) | `regulatory-compliance-checklist.md` |
| RC Terzi | Responsabilità Civile verso Terzi (Third-party liability insurance) | `partner-vetting.md` |
| SLA | Service Level Agreement | `escalation-rules.md` |
| TTL | Time To Live | `knowledge-retrieval-model.md` |
| UUID | Universally Unique Identifier | `data-models.md` |
| VAT | Value Added Tax (IVA in Italian) | `regulatory-compliance-checklist.md` |

---

## Related Documents

- [documentation-consistency-audit.md](documentation-consistency-audit.md) — Full audit findings with severities and recommended corrections
- [cross-reference-map.md](cross-reference-map.md) — How documents connect and which must stay in sync
- [data-visibility-model.md](data-visibility-model.md) — Authoritative visibility scope definitions
- [data-models.md](../backend/data-models.md) — Authoritative field names and model definitions
