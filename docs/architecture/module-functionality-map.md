# Module Functionality Map

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — module-level specification
**Last updated:** 2026-05-28
**Related:** [system-dependency-map.md](system-dependency-map.md) · [implementation-roadmap.md](implementation-roadmap.md) · [data-models.md](../backend/data-models.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md)

---

## Purpose

This document specifies what each platform module does, what data it reads and writes, whether it is AI-accessible, and whether it is required at MVP. It is the reference for backend engineers partitioning work across modules.

One entry per module. Each module maps to one or more backend services, API endpoint groups, or internal processes.

---

## ⚠️ Unresolved Blockers

The following CRITICAL conflicts must be resolved before any module that touches data models or service types can be implemented. See [documentation-consistency-audit.md](documentation-consistency-audit.md).

**BLOCKER — C-01:** Visibility scope taxonomy split (GUEST/PARTNER/OPERATOR/INTERNAL vs PUB/GST/PTR/INT). Affects every module that reads or writes model fields with visibility tags.

**BLOCKER — C-02:** Service type count mismatch (5 vs 9). Affects Partner module, Dispatch module, Assignment module, and ServiceRequest module.

---

## Module Entries

---

### Module: Auth

**Responsibility:** Identity verification, session management, and role enforcement for all human actors. Guests are excluded — they have no accounts.

| | Detail |
|---|---|
| **Inputs** | Registration form data, login credentials, refresh tokens, OTP codes |
| **Outputs** | JWT access token (15-min expiry), refresh token (30-day, rotated), email verification link, SMS OTP |
| **Data models read** | `User` (credential lookup) |
| **Data models written** | `User` (create, update `is_email_verified`, `is_phone_verified`, `account_status`) |
| **AI-accessible** | No |
| **External dependencies** | Email service (verification), SMS gateway (OTP), Secrets vault (JWT signing key) |
| **MVP required** | Yes — nothing else works without auth |

**Key behaviours:**
- Email + password login; bcrypt/Argon2id hashing; JWT issued on success
- Operator accounts require MFA — login blocked without second factor
- 5 failed attempts → 15-minute lockout; 10 cumulative → email unlock required
- JWT access tokens expire at 15 minutes; refresh tokens rotate on each use
- Homeowner and partner are distinct roles; role is embedded in JWT payload

**Source:** [security-model.md](security-model.md) §1–2

---

### Module: User Management

**Responsibility:** Homeowner and partner account lifecycle — creation, profile management, status changes, partner-specific vetting fields.

| | Detail |
|---|---|
| **Inputs** | Registration data, profile updates, partner vetting documents, admin status changes |
| **Outputs** | User record, partner profile (public), vetting status updates |
| **Data models read** | `User` |
| **Data models written** | `User` (all fields) |
| **AI-accessible** | No — `User` model is not accessible to the AI runtime |
| **External dependencies** | CDN (profile photo, ID document upload) |
| **MVP required** | Yes |

**Key behaviours:**
- `account_type` (homeowner / partner) is set at registration and cannot be changed
- Partner accounts require additional vetting fields: `is_identity_verified`, `background_check_status`, `insurance_document_url`
- `account_status` transitions: `pending → active → suspended → closed`
- Partner service types (see BLOCKER C-02 — count unresolved) set at registration

**Source:** [data-models.md](../backend/data-models.md) Model 1

---

### Module: Property Management

**Responsibility:** Full lifecycle for managed rental properties — creation, field editing, activation, suspension, schema versioning.

| | Detail |
|---|---|
| **Inputs** | Homeowner property form submissions, operator status changes |
| **Outputs** | Property record, activation status |
| **Data models read** | `Property`, `User` (owner validation) |
| **Data models written** | `Property` (all fields), triggers creation of `PropertyKnowledgeBlock` and `EmergencyData` on activation |
| **AI-accessible** | No — AI never reads the `Property` model directly |
| **External dependencies** | CDN (property photos) |
| **MVP required** | Yes |

**Key behaviours:**
- `property_id` (slug) is immutable after activation — human-readable, unique
- `platform_status` transitions: `pending → active → suspended → archived`
- Activation gate: `EmergencyData.is_complete = true` required before status can become `active`
- Operator approval required before first activation
- Full field specification in [property-data-schema.md](../property-intake/property-data-schema.md)

**Source:** [data-models.md](../backend/data-models.md) Model 2

---

### Module: PropertyKnowledgeBlock (PKB)

**Responsibility:** Creation and maintenance of the AI-ready content layer for each property. This is what the AI concierge reads — not the Property model.

| | Detail |
|---|---|
| **Inputs** | Property data, homeowner-authored prose content, DynamicInstruction overrides |
| **Outputs** | Scope-filtered knowledge block delivered to KBB; `compliance.KnowledgeBlock.Updated` event on update |
| **Data models read** | `Property` (source data), `Reservation` (for DynamicInstruction context) |
| **Data models written** | `PropertyKnowledgeBlock` |
| **AI-accessible** | Yes — the primary AI read source. Scope-filtered before delivery by KBB. |
| **External dependencies** | None |
| **MVP required** | Yes |

**Key behaviours:**
- One `PropertyKnowledgeBlock` per property — created when property is activated
- `is_complete` flag must be true before the AI concierge can serve that property
- DynamicInstructions are time-bounded overrides — `active_from` / `active_until` enforced by KBB
- Changes to the PKB emit `compliance.KnowledgeBlock.Updated` → KBB cache invalidation

**Source:** [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) · [data-models.md](../backend/data-models.md) Model 3

---

### Module: Emergency Data

**Responsibility:** Property-level emergency contacts, utility shutoffs, nearest medical services. Always pre-loaded into AI context regardless of query type.

| | Detail |
|---|---|
| **Inputs** | Homeowner entry of emergency contacts, local medical/utility info |
| **Outputs** | Pre-loaded context block injected into every AI session |
| **Data models read** | `EmergencyData` |
| **Data models written** | `EmergencyData` (homeowner and operator can update) |
| **AI-accessible** | Yes — always pre-loaded, no scope filtering needed (all fields are GUEST scope) |
| **External dependencies** | None |
| **MVP required** | Yes — property activation blocked until `is_complete = true` |

**Key behaviours:**
- `EmergencyData.is_complete` is a hard activation gate — a property with incomplete emergency data cannot go live
- All fields are GUEST scope — no scope filtering needed for AI injection
- Changes emit `compliance.EmergencyData.Updated` → KBB cache write-through (TTL override)
- Hardcoded Italian numbers (112, 113, 115, 118) are pre-loaded by the AI runtime regardless of property data

**Source:** [data-models.md](../backend/data-models.md) Model 6 · [emergency-procedures.md](../ai-concierge/emergency-procedures.md)

---

### Module: Knowledge Block Builder (KBB)

**Responsibility:** 7-step transformation service that converts the raw `PropertyKnowledgeBlock` into a session-scoped, scope-filtered, AI-safe data package.

| | Detail |
|---|---|
| **Inputs** | `property_id`, `session_phase`, `guest_language`, `guest_phone` (for access gate) |
| **Outputs** | Scoped, chunked knowledge block ready for AI context window |
| **Data models read** | `PropertyKnowledgeBlock`, `EmergencyData`, `Reservation` (for DynamicInstruction context) |
| **Data models written** | None (KBB is read-only) |
| **AI-accessible** | N/A — KBB is the delivery mechanism; it is not accessible to the AI directly |
| **External dependencies** | None (internal service) |
| **MVP required** | Yes |

**7-step transformation pipeline:**
1. **Scope Filter** — whitelist-based: include only GUEST-scoped fields. Never blacklist — always whitelist.
2. **Activation Gate** — check `PropertyKnowledgeBlock.is_complete`; reject if false
3. **Dynamic Merge** — apply active `DynamicInstruction` overrides within their validity window
4. **Language Select** — select the guest's language variant for multilingual fields
5. **Access Gate** — check session phase and time window before including access codes
6. **Emergency Inject** — prepend `EmergencyData` block regardless of query type
7. **Chunk Generate** — split result into retrieval-optimised chunks

**Cache:** Property knowledge cache TTL: 300s (inactive) to 3600s (active stay). Emergency cache: 600s with write-through on update.

**Security note:** The scope filter at Step 1 is structural exclusion — not prompt instruction. The KBB never passes PARTNER, OPERATOR, or INTERNAL fields to the AI context window, regardless of what the AI requests.

**Source:** [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) · [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md)

---

### Module: Reservation Management

**Responsibility:** Guest stay lifecycle — creation, check-in, check-out, guest data capture, Alloggiati Web tracking, tourist tax calculation.

| | Detail |
|---|---|
| **Inputs** | Homeowner manual reservation entry (no OTA sync at MVP), check-in / check-out confirmations |
| **Outputs** | Reservation record, GuestStayContext, tourist tax calculation |
| **Data models read** | `Reservation`, `GuestStayContext`, `Property` |
| **Data models written** | `Reservation`, `GuestStayContext` (created at check-in) |
| **AI-accessible** | Partially — AI reads: `guest_name`, `guest_preferred_language`, `checkin_date`, `checkout_date`, `confirmation_number`, `guest_count`, `special_requests`. Not financial or compliance fields. |
| **External dependencies** | None at MVP (no OTA calendar sync) |
| **MVP required** | Yes |

**Key behaviours:**
- Overlapping reservation dates must be blocked at the API layer
- `Reservation` status: `confirmed → pre-arrival → checked-in → checked-out → cancelled`
- `WhatsAppSession` created on first guest message during the stay window
- Alloggiati Web obligation: platform tracks fields; homeowner submits to Alloggiati Web directly at MVP
- Tourist tax: platform calculates and displays; homeowner collects and remits

**Source:** [data-models.md](../backend/data-models.md) Model 4–4b

---

### Module: WhatsApp Session

**Responsibility:** Guest session creation, resolution (phone → reservation), and state management for the AI concierge interaction lifecycle.

| | Detail |
|---|---|
| **Inputs** | Inbound message from WhatsApp Business API, session phase updates |
| **Outputs** | `WhatsAppSession` record, session phase, guest context for AI runtime |
| **Data models read** | `Reservation` (lookup by guest_phone), `GuestStayContext` |
| **Data models written** | `WhatsAppSession` (create + update message count, last activity, session phase, detected language) |
| **AI-accessible** | Read + Write — AI reads session_phase, detected_language, unresolved_query_count. AI writes message count and last activity. |
| **External dependencies** | WhatsApp Business API (inbound webhook) |
| **MVP required** | Yes |

**Session phases:** `pre_arrival` / `check_in_day` / `in_stay` / `check_out` / `post_stay`
**Note on phase naming:** A naming inconsistency exists across documents (H-02 in consistency audit). Canonical values are `snake_case` as listed above. See [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-02.

**Resolution query window:**
- `checkin_date <= today + 2 days`
- `checkout_date >= today - 1 day` (24-hour post-checkout grace period)

**Source:** [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) · [data-models.md](../backend/data-models.md) Model 5

---

### Module: AI Runtime Orchestrator

**Responsibility:** Full 13-step pipeline from inbound WhatsApp message to outbound response. The execution engine of the AI concierge.

| | Detail |
|---|---|
| **Inputs** | Inbound WhatsApp message (via `guest.WhatsAppMessage.Received` event) |
| **Outputs** | Outbound WhatsApp message, ServiceRequest (if needed), EscalationRecord (if triggered) |
| **Data models read** | `PropertyKnowledgeBlock` (via KBB), `EmergencyData` (via KBB), `Reservation` (scoped fields only), `WhatsAppSession` |
| **Data models written** | `WhatsAppSession` (updates only), `ServiceRequest` (creates only), `EscalationRecord` (creates only) |
| **AI-accessible** | This module IS the AI — it orchestrates the LLM call |
| **External dependencies** | LLM provider (response generation), WhatsApp Business API (outbound), KBB (knowledge retrieval) |
| **MVP required** | Yes |

**13-step pipeline summary:**
1. Message intake — normalise webhook payload, idempotency check
2. Session resolution — phone → reservation → session
3. Emergency pre-check — deterministic keyword scan (< 100ms, before LLM)
4. Intent classification — LLM-based categorisation against knowledge taxonomy
5. Retrieval orchestration — KBB call with session context
6. Access code gating — session phase + time window check
7. Multilingual orchestration — language detection and variant selection
8. Response assembly — LLM call (temperature 0.2, max 400 tokens, 8s timeout)
9. Confidence evaluation — ≥0.80 proceed; 0.60–0.79 proceed with hedge; <0.60 clarify
10. Action execution — create ServiceRequest or EscalationRecord if needed
11. Operator handoff holding — suppress AI response if escalated
12. Post-escalation recovery — re-enable AI after operator resolves
13. Message delivery and session update — send via WhatsApp, update session state

**Write permission boundary:** The AI runtime MUST NOT write to any model other than the three listed. Any write attempt to a prohibited model should be logged as a SCOPE_VIOLATION security event.

**Performance targets:** Total pipeline < 4s p95; KBB < 200ms; emergency pre-check < 100ms; LLM < 3s; session resolution < 50ms cached.

**Source:** [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md)

---

### Module: Partner Management

**Responsibility:** Partner onboarding, vetting, assignment to properties, and lifecycle management of the PartnerAssignment record.

| | Detail |
|---|---|
| **Inputs** | Partner registration data, vetting documents, homeowner assignment selections, operator approval actions |
| **Outputs** | Partner profile, `PartnerAssignment` records, Partner Brief (PARTNER-scoped projection) |
| **Data models read** | `User` (partner), `PartnerAssignment`, `Property` |
| **Data models written** | `User` (vetting fields), `PartnerAssignment` (all lifecycle states) |
| **AI-accessible** | No — partner identity and assignment details are not accessible to the AI |
| **External dependencies** | CDN (documents, photos) |
| **MVP required** | Yes |

**Key behaviours:**
- Tier 1 partners (TRANSFER, EXPERIENCE, LAUNDRY) — 24–48h approval
- Tier 2 partners (CLEANING, MAINTENANCE) — 3–5 day approval (criminal record certificate + insurance)
- `PartnerAssignment` states: DRAFT → ACTIVE → PAUSED → ENDED
- `partner_briefed` flag must be true before partner can receive job-specific data
- Partner Brief is a PARTNER-scoped whitelist projection of the property record — not a full dump
- Access codes delivered at job acceptance (`PartnerRequest.status = accepted`), never at assignment time
- See BLOCKER C-02: service type list for partner registration is currently inconsistent

**Source:** [partner-assignment-model.md](partner-assignment-model.md) · [partner-vetting.md](../trust-safety/partner-vetting.md)

---

### Module: Service Request and Dispatch

**Responsibility:** End-to-end lifecycle of a service need: from creation (demand side) through dispatch to a partner (supply side), completion, and verification.

| | Detail |
|---|---|
| **Inputs** | AI concierge action, homeowner submission, or operator action; partner acceptance/completion updates |
| **Outputs** | `ServiceRequest`, `PartnerRequest`, dispatch notifications to partner |
| **Data models read** | `ServiceRequest`, `PartnerRequest`, `PartnerAssignment` (dispatch lookup), `Reservation` |
| **Data models written** | `ServiceRequest` (state machine), `PartnerRequest` (create, accept, complete) |
| **AI-accessible** | Partially — AI creates `ServiceRequest` only. AI reads `ServiceRequest.guest_status_message` only. |
| **External dependencies** | Notification service (partner dispatch alerts), Event broker |
| **MVP required** | Yes |

**ServiceRequest state machine:** CREATED → CLASSIFIED → ROUTED → PENDING_ACCEPTANCE → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED (or ESCALATED / FAILED / CANCELLED)

**Dispatch priority:** On `ServiceRequest.CREATED`, find all active `PartnerAssignment` records for `(property_id, service_type)`, order by `priority_rank ASC`, attempt rank 1. If decline or no response within response window → attempt rank 2. If all exhausted → notify homeowner + operator.

**Response windows:** CLEANING: 2h; MAINTENANCE routine: 4h; MAINTENANCE urgent: 30min; TRANSFER: 1h; EXPERIENCE: 4h; POOL/GARDEN: 24h.

**Conceptual distinction:** `ServiceRequest` = demand-side ("something needs to happen"). `PartnerRequest` = supply-side ("this specific partner has been asked"). They are always separate objects. See also [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-03.

**Source:** [service-request-flow.md](../operations/service-request-flow.md)

---

### Module: Escalation

**Responsibility:** AI-to-human handoff when the AI concierge reaches a trigger condition. Human operator takes over the conversation; AI is suppressed until operator releases.

| | Detail |
|---|---|
| **Inputs** | Escalation trigger from AI Runtime (11 trigger codes), operator acknowledgement and resolution |
| **Outputs** | `EscalationRecord`, operator notification (CRITICAL severity, no quiet hours), AI suppression flag on `WhatsAppSession` |
| **Data models read** | `EscalationRecord`, `WhatsAppSession` |
| **Data models written** | `EscalationRecord` (AI creates only; operator updates status and resolution notes) |
| **AI-accessible** | Write-only — AI creates the record and cannot read or modify it after creation |
| **External dependencies** | Notification service (operator alert) |
| **MVP required** | Yes |

**11 escalation triggers:** EMERGENCY, MAINTENANCE_URGENT, COMPLAINT, SAFETY_CONCERN, LEGAL_CLAIM, IDENTITY_CONFLICT, ACCESS_DENIED, RESERVATION_MODIFICATION, REPEATED_UNANSWERED, ABUSE, IDENTITY_UNRESOLVABLE.

**SLA:** Operator acknowledgement within the SLA defined per trigger type. EMERGENCY: 5 minutes. COMPLAINT: 2 hours.

**Source:** [escalation-rules.md](../ai-concierge/escalation-rules.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md)

---

### Module: Notification Service

**Responsibility:** Multi-channel notification delivery with severity-based routing and quiet hours enforcement.

| | Detail |
|---|---|
| **Inputs** | Notification events from all modules via event broker |
| **Outputs** | Dashboard notifications, emails, SMS messages |
| **Data models read** | `User` (notification targets), notification templates |
| **Data models written** | Notification log (delivery records) |
| **AI-accessible** | No |
| **External dependencies** | Email service, SMS gateway |
| **MVP required** | Yes |

**4 channels:** Dashboard (synchronous), Email (async, < 2 min), SMS (async, < 60s), WhatsApp (post-MVP).

**Severity routing:**
- CRITICAL: Dashboard + SMS (no quiet hours)
- HIGH: Dashboard + Email + SMS (no quiet hours)
- NORMAL: Dashboard + Email (quiet hours apply)
- LOW: Dashboard only (quiet hours apply)

**Quiet hours:** 22:00–07:00 Europe/Rome. CRITICAL and HIGH override quiet hours.

**Anti-spam:** Same notification for same entity within 1 hour → deduplicate (except CRITICAL).

**Source:** [notification-system.md](notification-system.md)

---

### Module: Event System

**Responsibility:** At-least-once event delivery between all platform modules. Decouples producers from consumers; enables audit trail; drives cache invalidation and async processing.

| | Detail |
|---|---|
| **Inputs** | Events emitted by any module (`domain.Entity.Verb` format) |
| **Outputs** | Delivered events to registered consumers; Dead Letter Queue on repeated failure |
| **Data models read** | Event envelope (metadata only) |
| **Data models written** | Event log (append-only, 7-day retention at MVP; 3-year for audit events) |
| **AI-accessible** | No |
| **External dependencies** | Event broker (Redis Streams or RabbitMQ at MVP) |
| **MVP required** | Yes |

**Event naming:** `domain.Entity.Verb` — e.g. `service_request.ServiceRequest.Created`, `guest.WhatsAppMessage.Received`, `compliance.KnowledgeBlock.Updated`.

**Retry policy:** 5 attempts: 30s → 2min → 10min → 30min → 60min, then Dead Letter Queue.

**Source:** [event-driven-architecture.md](event-driven-architecture.md)

---

### Module: Homeowner Dashboard

**Responsibility:** Homeowner-facing web application: property management, reservation tracking, partner assignment oversight, AI supervision, escalation review, and service request history.

| | Detail |
|---|---|
| **Inputs** | Homeowner UI interactions |
| **Outputs** | Rendered views of homeowner data; state mutations via API calls |
| **Data models read** | Property, PropertyKnowledgeBlock, Reservation, PartnerAssignment, ServiceRequest, PartnerRequest, Message, Review, EscalationRecord (status only) |
| **Data models written** | Property, PropertyKnowledgeBlock (DynamicInstructions), Reservation, PartnerAssignment, Message |
| **AI-accessible** | No (the dashboard is for human homeowners) |
| **External dependencies** | Auth service |
| **MVP required** | Yes |

**Current state:** HTML prototype exists at `dashboard-homeowner.html` and related pages. Frontend prototype consistency (Phase 2) is in progress before backend integration.

---

### Module: Partner Dashboard

**Responsibility:** Partner-facing web application: job queue, availability toggle, job acceptance/completion, messaging, earnings view.

| | Detail |
|---|---|
| **Inputs** | Partner UI interactions |
| **Outputs** | Rendered partner-scoped views; state mutations via API calls |
| **Data models read** | PartnerAssignment (own), PartnerRequest (own), Message, Review (own) |
| **Data models written** | PartnerRequest (accept, complete, add notes, upload photos), Message |
| **AI-accessible** | No |
| **External dependencies** | Auth service, CDN (photo uploads) |
| **MVP required** | Yes |

---

### Module: Operator Dashboard

**Responsibility:** Full-platform visibility for Nauxica staff (founder at MVP). Escalation handling, partner approval, property activation, AI session review, platform-wide metrics.

| | Detail |
|---|---|
| **Inputs** | Operator UI interactions |
| **Outputs** | Full platform data views; all model updates within operator permissions |
| **Data models read** | All models |
| **Data models written** | User (account status, vetting), Property (activation, suspension), EscalationRecord (acknowledge, resolve) |
| **AI-accessible** | No |
| **External dependencies** | Auth service (MFA required) |
| **MVP required** | Yes |

---

## Module Dependency Summary

| Module | Must be built before... |
|---|---|
| Auth | Everything |
| User Management | Property Management, Partner Management |
| Emergency Data | AI Runtime Orchestrator |
| PropertyKnowledgeBlock | KBB, AI Runtime Orchestrator |
| KBB | AI Runtime Orchestrator |
| WhatsApp Session | AI Runtime Orchestrator |
| Reservation Management | WhatsApp Session, Service Request |
| Partner Management | Service Request and Dispatch |
| Service Request and Dispatch | AI Runtime Orchestrator (partially — AI creates ServiceRequests) |
| Event System | Notification Service, KBB cache invalidation, Dispatch |
| Notification Service | Escalation, Dispatch, all async workflows |
| Escalation | AI Runtime Orchestrator |

---

## Related Documents

- [system-dependency-map.md](system-dependency-map.md) — Component dependency graph
- [implementation-roadmap.md](implementation-roadmap.md) — Build order
- [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) — AI Runtime full pipeline
- [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) — KBB full specification
- [service-request-flow.md](../operations/service-request-flow.md) — ServiceRequest lifecycle
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — C-01 and C-02 blockers
