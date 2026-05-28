# Implementation Roadmap

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — ordered backend implementation plan
**Last updated:** 2026-05-28
**Related:** [system-dependency-map.md](system-dependency-map.md) · [module-functionality-map.md](module-functionality-map.md) · [mvp-boundaries.md](mvp-boundaries.md) · [pre-backend-checklist.md](pre-backend-checklist.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md)

---

## Purpose

This document defines the implementation order for the Nauxica backend, derived from the dependency graph in [system-dependency-map.md](system-dependency-map.md).

The roadmap is not a time estimate — it is an ordering constraint. Sprints may be compressed, parallelised, or split, but the ordering within each phase must be respected.

---

## ⚠️ Pre-Roadmap Blockers

**BLOCKER — C-01: Visibility Scope Taxonomy Split**
**BLOCKER — C-02: Service Type Count Mismatch (5 vs 9)**

Both of these CRITICAL conflicts, identified in [documentation-consistency-audit.md](documentation-consistency-audit.md), must be resolved before Sprint 1 begins. No data model implementation can start until the canonical visibility scope taxonomy and the canonical service type list are designated.

These are not implementation tasks — they are architect decisions. Once the decisions are made, the relevant documents must be updated before any engineer touches a schema.

Additionally, the following pre-implementation requirements must be satisfied before Sprint 1 (see [pre-backend-checklist.md](pre-backend-checklist.md) for the complete gate):
- Tech stack selected and documented
- Development environment provisioned
- Secrets vault configured
- External service accounts opened (WhatsApp Business API, LLM provider, email, SMS)
- GDPR Data Processing Agreements initiated with Meta and LLM provider

---

## Phase Definitions

| Phase | Name | Goal | Exit criterion |
|---|---|---|---|
| Pre-roadmap | Architecture gate | All blockers resolved, stack decided, environment ready | pre-backend-checklist.md fully checked |
| Sprint 0 | Infrastructure | Deployable empty shell | Auth service accepts a login; database migrations run |
| Sprint 1 | Auth and user layer | Real accounts, roles, JWT | Homeowner and partner can register, log in, and receive a valid JWT |
| Sprint 2 | Core data layer | All primary models | Property can be created and activated by a homeowner; EmergencyData complete |
| Sprint 3 | Reservation layer | Stays and guest sessions | A reservation can be created; WhatsApp session resolves correctly |
| Sprint 4 | Partner layer | Assignments, dispatch, job lifecycle | ServiceRequest routes to a partner; partner accepts; job completes |
| Sprint 5 | AI concierge | KBB + AI runtime + WhatsApp | First end-to-end guest message → AI response |
| Sprint 6 | Notifications and events | Event broker live; all channels active | CRITICAL escalation delivers SMS < 60s |
| Sprint 7 | Dashboards | All three dashboards connected to backend | Homeowner, partner, and operator dashboards show real data |
| MVP milestone | First property live | Real guest, real AI concierge | All launch-readiness gates passed |

---

## Pre-Roadmap — Architecture Gate

**Goal:** All decisions and environments are ready for implementation to begin.
**Parallel with:** Nothing — this must complete first.

| Task | Owner | Depends on | Notes |
|---|---|---|---|
| Resolve C-01 — designate authoritative visibility scope taxonomy | Architect / Founder | — | Updates: data-visibility-model.md (authoritative); data-models.md, property-data-schema.md, property-knowledge-schema.md (reconciled) |
| Resolve C-02 — confirm service types at Sicily launch | Architect / Founder | — | Updates: partner-assignment-model.md OR all onboarding/commercial docs |
| Select tech stack | Architect / Founder | — | Must be documented before Sprint 0 |
| Provision development environment | Engineer | Tech stack decided | Servers, domain, SSL, secrets vault |
| Configure secrets vault | Engineer | Environment provisioned | All production secrets stored here — no .env files committed |
| Open WhatsApp Business API account | Founder | — | Meta approval timeline: 2–4 weeks — open immediately |
| Open LLM provider account + initiate GDPR DPA | Founder | — | ⚠️ Legal review required — no PII to LLM without DPA |
| Open email service account (transactional) | Founder | — | Domain verification required |
| Open SMS gateway account (Italian number) | Founder | — | Italian number provisioning may take several days |
| Open Stripe account | Founder | — | Business verification required |
| Initiate legal review: GDPR DPA with Meta | Legal | — | ⚠️ Cannot use WhatsApp Business API for guest data without this |
| Initiate legal review: subscription T&Cs | Legal | — | Consumer law review (M-04 from audit) |

---

## Sprint 0 — Infrastructure

**Goal:** Deployable empty shell. No features — just the backbone.
**Can parallelise with:** Nothing — must be first.

| Task | Module | Notes |
|---|---|---|
| Database schema: create initial migrations | Database | Start from data-models.md after C-01 resolved |
| Auth service: JWT signing, token issuance | Auth | Secrets from vault |
| API framework skeleton | API | Route registration, middleware, error handling |
| Event broker setup | Event system | Redis Streams or RabbitMQ; configure topics |
| CDN / media storage bucket | Infrastructure | Separate buckets: profiles, documents, photos |
| Health check endpoints | API | `/health` endpoint for each service |
| Logging and basic observability | Infrastructure | Structured logging; request IDs on all events |

**Sprint 0 exit criterion:** Empty API responds to authenticated requests; database accepts migrations; event broker receives a test event.

---

## Sprint 1 — Auth and User Layer

**Goal:** Real accounts, working authentication, role-based access.
**Can parallelise with:** WhatsApp account setup, legal DPA initiation.

| Task | Module | Notes |
|---|---|---|
| User model migration | User Management | After C-01 resolved |
| Registration endpoint: homeowner | Auth | Email + password + phone OTP |
| Registration endpoint: partner | Auth | Additional vetting fields |
| Email verification flow | Auth | Requires email service |
| Phone OTP verification flow | Auth | Requires SMS gateway |
| Login endpoint | Auth | Returns JWT access + refresh tokens |
| Token refresh endpoint | Auth | Rotates refresh token on use |
| Operator account creation (manual/seed) | Auth | Operator requires MFA — implement TOTP |
| Operator MFA enforcement | Auth | JWT blocked for operator role without second factor |
| Account lockout (5 failed → 15min) | Auth | Requires Redis or in-memory rate limiter |
| Role-based middleware | API | Applies to all subsequent endpoints |
| Partner profile fields: service types, areas | User Management | See BLOCKER C-02 — confirm service type list first |

**Sprint 1 exit criterion:** Homeowner registers, verifies email + phone, logs in, receives JWT with correct role. Operator logs in with MFA enforced.

---

## Sprint 2 — Core Data Layer

**Goal:** Property, PropertyKnowledgeBlock, and EmergencyData models operational.
**Can parallelise with:** Sprint 3 partial setup.

| Task | Module | Notes |
|---|---|---|
| Property model migration | Property Management | All fields from property-data-schema.md |
| Property CRUD endpoints | Property Management | Create, read, update; homeowner-scoped |
| Property activation gate logic | Property Management | Blocked until EmergencyData.is_complete + PKB.is_complete |
| EmergencyData model migration | Emergency Data | One-to-one with Property |
| EmergencyData CRUD endpoints | Emergency Data | Homeowner can edit; operator can review |
| EmergencyData completeness checker | Emergency Data | Auto-sets is_complete when all required fields present |
| PropertyKnowledgeBlock model migration | PKB Module | |
| PropertyKnowledgeBlock editor (API) | PKB Module | Homeowner updates prose content per category |
| PropertyKnowledgeBlock review flag | PKB Module | Operator sets is_complete = true after review |
| compliance.KnowledgeBlock.Updated event | PKB Module → Event system | Triggers KBB cache invalidation |
| compliance.EmergencyData.Updated event | Emergency Data → Event system | Triggers KBB write-through |

**Sprint 2 exit criterion:** Homeowner creates a property, completes EmergencyData, completes PropertyKnowledgeBlock, and an operator can activate the property.

---

## Sprint 3 — Reservation Layer

**Goal:** Guest stay records, session anchoring, WhatsApp session resolution.
**Can parallelise with:** Sprint 4 partial setup (PartnerAssignment can be built before session anchor is live).

| Task | Module | Notes |
|---|---|---|
| Reservation model migration | Reservation Management | Guest personal data fields encrypted at rest |
| Reservation CRUD endpoints | Reservation Management | Homeowner creates; date overlap validation required |
| Reservation status state machine | Reservation Management | confirmed → pre-arrival → checked-in → checked-out |
| GuestStayContext model migration | Reservation Management | Created at check-in |
| Tourist tax calculation | Reservation Management | Display only — homeowner collects |
| Alloggiati Web tracking fields | Reservation Management | ⚠️ Legal review required — reporting obligation |
| WhatsApp session anchor (phone → reservation lookup) | WhatsApp Session | The core resolution query |
| WhatsAppSession model migration | WhatsApp Session | |
| Session phase determination logic | WhatsApp Session | pre_arrival / check_in_day / in_stay / check_out / post_stay |
| WhatsApp webhook receiver endpoint | WhatsApp Session | HMAC signature verification required |

**Sprint 3 exit criterion:** Homeowner creates a reservation; WhatsApp session resolves correctly for that guest's phone number.

---

## Sprint 4 — Partner Layer

**Goal:** Partner assignments, service request creation, partner dispatch, and job lifecycle.

| Task | Module | Notes |
|---|---|---|
| PartnerAssignment model migration | Partner Management | After C-02 resolved — service type enum must be canonical |
| PartnerAssignment CRUD endpoints | Partner Management | Homeowner creates; partner accepts |
| Partner marketplace listing endpoint | Partner Management | Public profiles, filter by service type + area |
| Partner Brief construction (PARTNER-scoped projection) | Partner Management | Whitelist-based — not full dump |
| Partner vetting workflow | Partner Management | Document upload, approval state machine |
| ServiceRequest model migration | Service Request | After C-02 resolved |
| ServiceRequest CRUD endpoints | Service Request | AI creates; homeowner + operator read |
| ServiceRequest state machine | Service Request | Full 11-state lifecycle |
| PartnerRequest model migration | Service Request | |
| PartnerRequest CRUD endpoints | Service Request | Partner accepts/declines/completes |
| Partner dispatch service | Service Request | Listens to ServiceRequest.Created; priority-rank dispatch |
| Response window monitor | Service Request | Timeout → next partner; exhausted → notify homeowner |
| Access code delivery (at PartnerRequest.accepted) | Partner Management | PARTNER scope — never earlier |
| ReservationPartnerOverride model | Partner Management | Per-reservation partner substitution |

**Sprint 4 exit criterion:** A ServiceRequest is created, dispatches to the preferred partner, partner accepts, receives access code, completes the job with photos, homeowner verifies.

---

## Sprint 5 — AI Concierge

**Goal:** Knowledge Block Builder operational; AI Runtime Orchestrator handling real guest messages end-to-end.

This is the highest-risk sprint — it integrates multiple external services (WhatsApp API, LLM provider) and implements the security-critical KBB scope filter.

| Task | Module | Notes |
|---|---|---|
| KBB service: Step 1 — Scope Filter | KBB | Whitelist-based; PARTNER/OPERATOR/INTERNAL fields never reach AI |
| KBB service: Step 2 — Activation Gate | KBB | Reject if PropertyKnowledgeBlock.is_complete = false |
| KBB service: Step 3 — Dynamic Merge | KBB | Apply active DynamicInstruction overrides |
| KBB service: Step 4 — Language Select | KBB | Multilingual field variant selection |
| KBB service: Step 5 — Access Gate | KBB | Session phase + time window check |
| KBB service: Step 6 — Emergency Inject | KBB | Always prepend EmergencyData |
| KBB service: Step 7 — Chunk Generate | KBB | Retrieval-optimised chunks |
| KBB cache layer | KBB | Session 240s; property 300–3600s; emergency 600s write-through |
| AI Runtime: Step 1 — Message Intake | AI Runtime | Normalise webhook; idempotency check (48h dedup cache) |
| AI Runtime: Step 2 — Session Resolution | AI Runtime | Delegates to WhatsApp Session module |
| AI Runtime: Step 3 — Emergency Pre-Check | AI Runtime | Deterministic keyword scan <100ms; hardcoded Italian numbers |
| AI Runtime: Steps 4–8 — Classification → Response | AI Runtime | LLM call: temp 0.2, max 400 tokens, 8s timeout |
| AI Runtime: Steps 9–10 — Confidence + Action | AI Runtime | Threshold gates; ServiceRequest creation |
| AI Runtime: Steps 11–13 — Escalation + Delivery | AI Runtime | EscalationRecord creation; outbound WhatsApp send |
| SCOPE_VIOLATION security event logging | AI Runtime | Any write attempt to prohibited model = security event |
| LLM API integration | AI Runtime | Environment variable for model selection |
| WhatsApp outbound API integration | AI Runtime | Message send + delivery receipts |

**Sprint 5 exit criterion:** First end-to-end test: guest sends message → AI responds with correct scoped content → access code delivered at correct session phase → emergency pre-check intercepting test keyword.

---

## Sprint 6 — Notifications and Events

**Goal:** Full event broker live; all notification channels operational; quiet hours and severity routing working.

| Task | Module | Notes |
|---|---|---|
| Event broker topic configuration | Event system | All domain.Entity.Verb topics registered |
| Dead Letter Queue + retry policy | Event system | 5-attempt retry; DLQ after exhaustion |
| Notification service: dashboard channel | Notification | Synchronous |
| Notification service: email channel | Notification | Async, <2min SLA; requires email service |
| Notification service: SMS channel | Notification | Async, <60s SLA; CRITICAL/HIGH only |
| Quiet hours enforcement (22:00–07:00 Europe/Rome) | Notification | CRITICAL/HIGH override |
| Anti-spam deduplication (1h window) | Notification | Except CRITICAL |
| Notification batching (NORMAL/LOW, max 15min window) | Notification | Max 5 per batch |
| KBB cache invalidation consumer | Event system | Listens to compliance.KnowledgeBlock.Updated |
| Partner dispatch event consumer | Event system | Listens to service_request.ServiceRequest.Created |
| Response window monitor consumer | Event system | Listens to partner.PartnerRequest.Dispatched |
| Audit log consumer | Event system | Listens to all events; append-only 3-year retention |

**Sprint 6 exit criterion:** CRITICAL escalation emits event → SMS delivered to operator within 60 seconds; quiet hours suppress NORMAL notification and hold until 07:00.

---

## Sprint 7 — Dashboards

**Goal:** All three dashboards (homeowner, partner, operator) connected to the real backend.

| Task | Module | Notes |
|---|---|---|
| API endpoints: homeowner dashboard data | Homeowner Dashboard | Properties, reservations, partner requests, tasks, messages |
| API endpoints: partner dashboard data | Partner Dashboard | Job queue, messages, ratings, earnings summary |
| API endpoints: operator dashboard data | Operator Dashboard | All platform data; escalation queue; partner approval |
| Frontend integration: replace localStorage with API calls | All dashboards | Phase 2 frontend consistency must be complete first |
| localStorage migration path | All dashboards | Per data-models.md migration notes |
| Session/auth token replaces localStorage accountType flag | Auth integration | |
| End-to-end UI smoke tests | All dashboards | All major flows working in integrated environment |

**Sprint 7 exit criterion:** All three dashboards show real backend data. No localStorage-based auth or data.

---

## MVP Milestone — First Property Live

**Goal:** Real guest served by the AI concierge at a real property.

This milestone is not a sprint — it is a readiness gate. Work can be considered "done" in Sprint 5 from a code perspective, but the first property live requires:

- [ ] All launch-readiness gates in [launch-readiness.md](launch-readiness.md) passed
- [ ] EmergencyData complete and operator-verified for the property
- [ ] PropertyKnowledgeBlock complete and operator-reviewed for the property
- [ ] At least one active PartnerAssignment (CLEANING) for the property
- [ ] Homeowner has completed onboarding and acknowledged legal agreements
- [ ] GDPR DPAs signed with Meta and LLM provider
- [ ] Legal review of Terms of Service and Partner Agreement complete
- [ ] Operator (founder) available 24/7 for the first week
- [ ] First test reservation created with known guest phone number
- [ ] AI concierge end-to-end test passed

---

## Parallel Workstream Summary

The following can be built in parallel:

| Workstream A | Workstream B | Can run simultaneously? |
|---|---|---|
| Sprint 0–1 (auth + user) | External account setup (WhatsApp, LLM, Stripe) | Yes |
| Sprint 2 (data layer) | Sprint 3 partial (reservation model) | Yes — after C-01 resolved |
| Sprint 4 (partner layer) | Sprint 5 setup (KBB scaffolding) | Yes — after sprint 2 complete |
| Sprint 6 (notifications) | Sprint 7 (dashboards) | Yes — both depend on sprint 4–5 being complete |
| Legal review work | All sprints | Yes — legal is on a separate track |

---

## Related Documents

- [pre-backend-checklist.md](pre-backend-checklist.md) — What must be true before Sprint 0 begins
- [system-dependency-map.md](system-dependency-map.md) — Component dependency graph
- [module-functionality-map.md](module-functionality-map.md) — What each module does
- [mvp-boundaries.md](mvp-boundaries.md) — What is and is not in scope
- [launch-readiness.md](launch-readiness.md) — Launch gate checklist
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — C-01 and C-02 blockers
