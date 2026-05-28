# MVP Boundaries

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — platform scope definition
**Last updated:** 2026-05-28
**Related:** [launch-readiness.md](launch-readiness.md) · [implementation-roadmap.md](implementation-roadmap.md) · [pre-backend-checklist.md](pre-backend-checklist.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md)

---

## Purpose

This document defines what is and is not included in the Nauxica Sicily launch MVP. It separates prototype-only features from production MVP, and MVP from post-MVP pilot and scale phases.

Without clear scope boundaries, implementation effort spreads into low-value or premature features. This document is the canonical reference for any scope question during backend development.

---

## ⚠️ Unresolved Blockers Affecting Scope

Before MVP boundaries can be finalised, two CRITICAL architecture conflicts must be resolved. These are documented in detail in [documentation-consistency-audit.md](documentation-consistency-audit.md).

---

### BLOCKER — C-01: Visibility Scope Taxonomy

**Status:** BLOCKER / ARCHITECT DECISION REQUIRED
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-01

Two incompatible visibility scope systems are in use across the documentation. The correct system must be designated before any field-level data model work begins.

| | System A | System B |
|---|---|---|
| **Source** | `data-visibility-model.md` | `data-models.md`, `property-data-schema.md` |
| **Scopes** | GUEST / PARTNER / OPERATOR / INTERNAL | PUB / GST / PTR / INT / AI |
| **Conflict** | No PUB scope; INTERNAL = system only | No OPERATOR scope; INT = homeowner + staff |

**Impact on MVP scope:** Every field in every model carries a visibility scope. No data model implementation can begin until this is resolved. If left unresolved, the AI concierge access boundary and the homeowner/operator data separation will be inconsistent.

**Required action:** Founder/architect designates one system as authoritative and reconciles all documents to it before Sprint 1 of backend implementation.

---

### BLOCKER — C-02: Service Type Count

**Status:** BLOCKER / ARCHITECT DECISION REQUIRED
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-02

Two incompatible service type lists exist across the documentation:

| | Onboarding/commercial docs | `partner-assignment-model.md` |
|---|---|---|
| **Count** | 5 types | 9 types |
| **Defined types** | CLEANING, MAINTENANCE, LAUNDRY, TRANSFERS, EXPERIENCES | Adds: POOL_MAINTENANCE, GARDEN_MAINTENANCE, CONCIERGE_IN_PERSON, INSPECTION |

**Impact on MVP scope:** Partner vetting, subscription plan pricing, assignment model, and partner registration all reference the service type list. An inconsistent list means partners register against a different set than the system dispatches against.

**Required action:** Founder decision required — confirm which service types are active at Sicily launch. The decision gates partner-facing documentation, vetting flows, and the PartnerAssignment schema.

---

## Scope Tier Definitions

| Tier | Definition |
|---|---|
| **Prototype** | HTML/CSS/JS demo only — not production-ready. No backend, no real auth, no real data. |
| **MVP** | First real deployed system. Single-operator, Sicily launch. Everything listed as MVP in this document. |
| **Pilot** | MVP running with 3–10 homeowners and their properties. Performance and reliability improvements in scope. |
| **Scale** | Multi-operator, multi-region, fully automated. No scope at this stage. |

---

## MVP Scope — What Is Included

### Accounts and Auth

| Feature | MVP? | Notes |
|---|---|---|
| Homeowner registration + login | Yes | Email + password, JWT, email verification |
| Partner registration + login | Yes | Email + password, JWT, email verification |
| Phone number verification (SMS OTP) | Yes | Required at registration |
| Operator account | Yes | Single founder account, MFA required |
| Homeowner MFA | Optional | Recommended, not enforced at MVP |
| Partner MFA | No | Post-MVP |
| Social auth (Google, Apple) | No | Post-MVP |

### Properties

| Feature | MVP? | Notes |
|---|---|---|
| Single property activation per homeowner | Yes | No hard limit on properties, but MVP assumes 1–3 |
| Full property data schema entry | Yes | All fields from property-data-schema.md |
| PropertyKnowledgeBlock creation and review | Yes | Required before property can go live |
| EmergencyData completion | Yes | Launch blocker — property cannot activate without this |
| DynamicInstruction overrides | Yes | Time-bounded homeowner AI knowledge overrides |
| Multi-property portfolio management | No | Post-MVP — no PropertyGroup model at MVP |

### AI Concierge

| Feature | MVP? | Notes |
|---|---|---|
| WhatsApp Business API integration (single number) | Yes | One WhatsApp number per property at MVP |
| Guest session resolution (phone → reservation) | Yes | Core functionality |
| Emergency pre-check (keyword scan, hardcoded numbers) | Yes | Non-negotiable — must be in place before first guest |
| Multilingual response (Italian + English) | Yes | Additional language detection at runtime |
| LLM-based response generation | Yes | Via external provider (environment variable) |
| Access code gating | Yes | Via session phase + time window |
| Service request creation | Yes | AI creates ServiceRequest on guest request |
| Escalation to operator | Yes | All 11 TRIGGER codes active |
| AI learns from past conversations | No | No cross-session memory at MVP |
| Voice message handling | No | Fallback message only — text description requested |
| Image/media processing | No | Fallback only at MVP |
| Guest-initiated review via WhatsApp | No | Post-MVP |

### Partner Operations

| Feature | MVP? | Notes |
|---|---|---|
| Partner marketplace listing | Yes | Public profiles, ratings, operating areas |
| Partner vetting flow | Yes | Tier 1 (1–2 day) and Tier 2 (3–5 day) per partner-vetting.md |
| Partner assignment to property | Yes | Homeowner selects from vetted marketplace |
| Automated partner dispatch (ServiceRequest → PartnerRequest) | Yes | Priority-ranked dispatch per assignment model |
| Partner access code delivery at job acceptance | Yes | PARTNER-scoped, gated to accepted status |
| Proof-of-completion (photos) | Yes | Required for CLEANING and MAINTENANCE |
| Partner performance scoring | Yes | Quality score: rating + completion + response + dispute |
| Dispute handling | Yes | Basic dispute record creation and review |
| In-person concierge service (CONCIERGE_IN_PERSON) | Depends on C-02 decision | Not in 5-type list. Status pending architect decision. |
| Pool and garden maintenance service types | Depends on C-02 decision | Not in 5-type list. Status pending architect decision. |
| Pre-activation inspection service type | Depends on C-02 decision | Not in 5-type list. Status pending architect decision. |

### Reservations and Guest Data

| Feature | MVP? | Notes |
|---|---|---|
| Reservation creation by homeowner | Yes | Manual entry at MVP — no OTA sync |
| Guest data capture (Alloggiati fields) | Yes | Required for regulatory compliance |
| Alloggiati Web reporting | Homeowner-managed | Platform tracks fields; actual submission is homeowner responsibility at MVP |
| Tourist tax tracking | Yes | Platform calculates; homeowner collects and remits |
| OTA calendar sync (Airbnb, Booking.com) | No | Post-MVP — no iCal or API sync at MVP. Homeowner enters manually. |
| Direct booking widget | No | Post-MVP |

### Notifications

| Feature | MVP? | Notes |
|---|---|---|
| Dashboard notifications | Yes | Synchronous, all users |
| Email notifications | Yes | Async, <2 minute SLA |
| SMS notifications (CRITICAL/HIGH) | Yes | For emergency and urgent alerts |
| WhatsApp notifications (homeowner/partner) | No | Post-MVP channel |
| Quiet hours enforcement | Yes | 22:00–07:00 Europe/Rome; CRITICAL overrides |

### Payments and Billing

| Feature | MVP? | Notes |
|---|---|---|
| Homeowner subscription billing (Stripe) | Yes | Monthly/annual, 3 tiers |
| Partner commission calculation (12%) | Yes | Computed and recorded on marketplace-facilitated jobs |
| Automated partner payout | No | Post-MVP — manual payout at MVP |
| Invoice generation for partners | No | Post-MVP — partners issue own invoices at MVP |
| Tourist tax calculation display | Yes | For homeowner reference — collection and remittance is homeowner's responsibility |

### Operator Tools

| Feature | MVP? | Notes |
|---|---|---|
| Full platform dashboard | Yes | All data, all properties |
| Escalation handling UI | Yes | Acknowledge, resolve, resume AI |
| Property activation approval | Yes | Operator reviews before activation |
| Partner approval (vetting complete) | Yes | Operator marks background check passed |
| AI supervision tools (session sampling) | Yes | Operator can review any AI session |
| Advanced analytics / BI dashboards | No | Post-MVP — raw event logs and basic counts only |

---

## Prototype-Only Features (Not For Production)

The following exist in the HTML prototype but must not be carried into the backend as-is:

| Prototype feature | Production status | Reason |
|---|---|---|
| `localStorage` for all state | Replace with real database | Demo scaffolding only |
| `nauxicaDemoState` data structure | Replace with API calls | Mock data only |
| `accountType` flag in localStorage | Replace with JWT + server-side role | No real auth in prototype |
| Hardcoded partner and reservation data | Replace with real model layer | Demo data only |
| Mock notification popups | Replace with real notification service | UI placeholder only |
| Auto-login / session bypass | Remove entirely | Security gap |
| All `nauxica-demo-data.js` demo data | Replace with real data | Prototype only |

---

## Post-MVP Features (Explicitly Out of Scope for Launch)

| Feature | Target tier |
|---|---|
| Multi-property portfolio management (PropertyGroup) | Pilot |
| OTA calendar sync | Pilot |
| Direct booking widget | Pilot |
| Automated partner payouts | Pilot |
| WhatsApp notifications for homeowners/partners | Pilot |
| Homeowner MFA enforcement | Pilot |
| AI cross-session memory (learn guest preferences) | Scale |
| Multi-language property knowledge (beyond IT + EN) | Scale |
| Multi-operator / multi-region support | Scale |
| Public guest-facing review system | Scale |
| Partner invoice generation | Pilot |
| Advanced BI / analytics dashboards | Pilot |
| Guest-initiated WhatsApp service requests (direct, no AI) | Post-scale |
| Marketplace for guests to browse experiences | Scale |

---

## MVP Exit Criteria

The MVP is complete when the following are true:

- [ ] At least one property is live and serving real guests via WhatsApp AI concierge
- [ ] At least one homeowner has completed the full onboarding and activation flow
- [ ] At least one partner has been vetted, assigned, and completed a real job
- [ ] The operator has successfully handled at least one escalation end-to-end
- [ ] EmergencyData is complete and verified for every active property
- [ ] All legal review items marked in launch-readiness.md are resolved or have formal legal sign-off
- [ ] No CRITICAL or HIGH findings from documentation-consistency-audit.md remain unresolved

---

## Related Documents

- [launch-readiness.md](launch-readiness.md) — Complete list of launch-blocking dependencies
- [pre-backend-checklist.md](pre-backend-checklist.md) — What must be true before backend starts
- [implementation-roadmap.md](implementation-roadmap.md) — Ordered implementation plan
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — Open architecture conflicts
- [partner-assignment-model.md](partner-assignment-model.md) — Service type taxonomy source of record
- [data-visibility-model.md](data-visibility-model.md) — Visibility scope taxonomy source of record
