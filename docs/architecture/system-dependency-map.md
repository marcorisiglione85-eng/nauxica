# System Dependency Map

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — component dependencies
**Last updated:** 2026-05-28
**Related:** [module-functionality-map.md](module-functionality-map.md) · [implementation-roadmap.md](implementation-roadmap.md) · [event-driven-architecture.md](event-driven-architecture.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) · [security-model.md](security-model.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md)

---

## Purpose

This document maps all component dependencies for the Nauxica platform: what each component requires before it can function, which components depend on which external services, and what the critical path to first-property-live looks like.

This is the reference for implementation ordering. No component should be built before its dependencies are understood and addressed.

---

## ⚠️ Unresolved Blockers

Two CRITICAL architecture conflicts must be resolved before any data-layer components can be implemented. See [documentation-consistency-audit.md](documentation-consistency-audit.md) for full detail.

**BLOCKER — C-01: Visibility Scope Taxonomy Split**
Every data model field carries a visibility scope. Two incompatible systems exist (GUEST/PARTNER/OPERATOR/INTERNAL vs PUB/GST/PTR/INT). No schema implementation can begin until the authoritative system is designated.

**BLOCKER — C-02: Service Type Count Mismatch (5 vs 9)**
The PartnerAssignment schema, partner vetting flow, and subscription plan all reference a service type list. Two incompatible lists exist (5 types in onboarding docs, 9 types in `partner-assignment-model.md`). The PartnerAssignment model and dispatch logic cannot be implemented until the authoritative list is designated.

---

## Component Catalogue

| Component | Type | Description |
|---|---|---|
| **Auth service** | Internal | Registration, login, JWT issuance, token refresh, MFA (operator) |
| **User model** | Data | Homeowner + partner accounts |
| **Property model** | Data | Managed rental properties |
| **PropertyKnowledgeBlock model** | Data | AI-ready content layer per property |
| **EmergencyData model** | Data | Property emergency contacts and procedures |
| **Reservation model** | Data | Guest stays |
| **GuestStayContext model** | Data | Per-stay operational state |
| **WhatsAppSession model** | Data | Active AI concierge sessions |
| **EscalationRecord model** | Data | Human takeover records |
| **PartnerAssignment model** | Data | Service partner assignments per property |
| **ServiceRequest model** | Data | Demand-side service requests |
| **PartnerRequest model** | Data | Supply-side job records |
| **Task model** | Data | Homeowner operational to-do items |
| **Message model** | Data | In-platform messaging (homeowner ↔ partner) |
| **Review model** | Data | Post-stay and post-job ratings |
| **Knowledge Block Builder (KBB)** | Internal service | 7-step PropertyKnowledgeBlock transformation |
| **AI Runtime Orchestrator** | Internal service | 13-step guest message processing pipeline |
| **Partner dispatch service** | Internal service | ServiceRequest → PartnerRequest routing logic |
| **Notification service** | Internal service | 4-channel (dashboard / email / SMS / WhatsApp-future) |
| **Event broker** | Infrastructure | At-least-once event delivery (Redis Streams or RabbitMQ at MVP) |
| **Homeowner dashboard** | Frontend | Property management, reservation tracking, partner oversight |
| **Partner dashboard** | Frontend | Job queue, availability, earnings |
| **Operator dashboard** | Frontend | Full platform visibility, escalation handling |
| **WhatsApp Business API** | External | Inbound message webhooks + outbound message delivery |
| **LLM provider** | External | Language model for AI response generation |
| **Email service** | External | Transactional email (verification, notifications) |
| **SMS gateway** | External | Phone verification OTP + CRITICAL/HIGH notifications |
| **Payment processor (Stripe)** | External | Subscription billing |
| **CDN / media storage** | External | Completion photos, ID documents, profile images |
| **Secrets vault** | Infrastructure | API keys, database credentials, JWT secrets |
| **Database** | Infrastructure | Persistent relational store (PostgreSQL at MVP) |

---

## Dependency Graph

### Tier 0 — Infrastructure (No Dependencies)

These must exist before any application layer is built.

```
Secrets vault          ← no dependencies
Database               ← no dependencies
Event broker           ← no dependencies
CDN / media storage    ← no dependencies
```

### Tier 1 — External Service Dependencies

These require external accounts, contracts, or onboarding before the platform can use them.

```
WhatsApp Business API  ← Meta Business account, phone number approval, webhook endpoint
LLM provider           ← Provider account, API key, usage agreement
                         ⚠️ Legal review required: GDPR DPA with LLM provider
Email service          ← Provider account, sending domain verified
SMS gateway            ← Provider account (e.g. Twilio), Italian number
Payment processor      ← Stripe account, business verification
                         ⚠️ Legal review required: subscription terms, consumer law
```

### Tier 2 — Auth Layer

```
Auth service
  ├── REQUIRES: Database (users table)
  ├── REQUIRES: Secrets vault (JWT signing key)
  ├── REQUIRES: Email service (verification emails)
  └── REQUIRES: SMS gateway (phone OTP)

User model
  ├── REQUIRES: Auth service
  └── REQUIRES: C-01 resolved (visibility scope per field)
```

### Tier 3 — Core Data Models

```
Property model
  ├── REQUIRES: User model (owner_id → User)
  └── REQUIRES: C-01 resolved

PropertyKnowledgeBlock model
  ├── REQUIRES: Property model (property_id → Property)
  └── REQUIRES: C-01 resolved

EmergencyData model
  ├── REQUIRES: Property model
  └── REQUIRES: C-01 resolved

PartnerAssignment model
  ├── REQUIRES: User model (partner_id → User)
  ├── REQUIRES: Property model (property_id → Property)
  ├── REQUIRES: C-01 resolved (visibility scopes)
  └── REQUIRES: C-02 resolved (service type taxonomy)

Reservation model
  ├── REQUIRES: Property model
  └── REQUIRES: C-01 resolved

GuestStayContext model
  └── REQUIRES: Reservation model

WhatsAppSession model
  └── REQUIRES: Reservation model

EscalationRecord model
  └── REQUIRES: WhatsAppSession model

ServiceRequest model
  ├── REQUIRES: Property model
  ├── REQUIRES: Reservation model (conditional)
  └── REQUIRES: C-02 resolved (service type taxonomy)

PartnerRequest model
  ├── REQUIRES: ServiceRequest model (linked)
  ├── REQUIRES: PartnerAssignment model (dispatch lookup)
  └── REQUIRES: C-02 resolved (service type taxonomy)

Task model
  └── REQUIRES: Property model, User model

Message model
  └── REQUIRES: User model

Review model
  ├── REQUIRES: User model
  └── REQUIRES: Reservation model (guest-to-property reviews)
```

### Tier 4 — Internal Services

```
Knowledge Block Builder (KBB)
  ├── REQUIRES: PropertyKnowledgeBlock model (read)
  ├── REQUIRES: EmergencyData model (read, always inject)
  ├── REQUIRES: Reservation model (session context read)
  └── REQUIRES: C-01 resolved (scope filter must know which system to apply)

Partner dispatch service
  ├── REQUIRES: PartnerAssignment model (dispatch lookup)
  ├── REQUIRES: ServiceRequest model (triggers on state change)
  ├── REQUIRES: PartnerRequest model (creates)
  ├── REQUIRES: Event broker (listens to service_request.ServiceRequest.Created)
  └── REQUIRES: C-02 resolved (service type must match assignment type)

Notification service
  ├── REQUIRES: User model (notification targets)
  ├── REQUIRES: Email service (email channel)
  ├── REQUIRES: SMS gateway (CRITICAL/HIGH SMS channel)
  └── REQUIRES: Event broker (listens to notification events)

AI Runtime Orchestrator
  ├── REQUIRES: KBB (Tier 4 — must be operational first)
  ├── REQUIRES: WhatsApp Business API (inbound + outbound)
  ├── REQUIRES: LLM provider (response generation)
  ├── REQUIRES: WhatsAppSession model (read/write)
  ├── REQUIRES: ServiceRequest model (write — creates on request)
  ├── REQUIRES: EscalationRecord model (write — creates on trigger)
  └── REQUIRES: Notification service (escalation alerts)

Event broker (consumer registrations)
  ├── AI Runtime: listens to guest.WhatsAppMessage.Received
  ├── KBB Cache Invalidator: listens to compliance.KnowledgeBlock.Updated
  ├── Partner dispatch: listens to service_request.ServiceRequest.Created
  ├── Notification service: listens to escalation, partner, and compliance events
  ├── Response window monitor: listens to partner.PartnerRequest.Dispatched
  └── Audit log: listens to all events
```

### Tier 5 — Dashboards

```
Homeowner dashboard
  ├── REQUIRES: Auth service
  ├── REQUIRES: Property model (read/write)
  ├── REQUIRES: PropertyKnowledgeBlock model (read)
  ├── REQUIRES: Reservation model (read/write)
  ├── REQUIRES: PartnerAssignment model (read/write)
  ├── REQUIRES: ServiceRequest model (read)
  ├── REQUIRES: PartnerRequest model (read)
  ├── REQUIRES: Message model (read/write)
  ├── REQUIRES: Review model (read)
  └── REQUIRES: Notification service

Partner dashboard
  ├── REQUIRES: Auth service
  ├── REQUIRES: PartnerAssignment model (read — own)
  ├── REQUIRES: PartnerRequest model (read/write — own)
  ├── REQUIRES: Message model (read/write — own)
  ├── REQUIRES: Review model (read — own)
  └── REQUIRES: Notification service

Operator dashboard
  ├── REQUIRES: Auth service (operator role, MFA)
  ├── REQUIRES: All data models (read)
  ├── REQUIRES: EscalationRecord model (read/write)
  └── REQUIRES: Notification service
```

---

## Critical Path to First Property Live

The shortest path from zero to a working AI concierge for one property:

```
1.  Secrets vault + Database + Event broker           [Tier 0]
2.  External accounts: WhatsApp API, LLM, Email, SMS  [Tier 1 — run in parallel with Tier 0]
3.  C-01 resolved (visibility scope)                  [BLOCKER — must precede all data models]
4.  C-02 resolved (service type count)                [BLOCKER — must precede PartnerAssignment + dispatch]
5.  Auth service + User model                         [Tier 2]
6.  Property + EmergencyData + KnowledgeBlock models  [Tier 3 — partial]
7.  Reservation model + WhatsAppSession model         [Tier 3 — partial]
8.  KBB service                                       [Tier 4 — partial]
9.  AI Runtime Orchestrator                           [Tier 4 — core]
10. EmergencyData complete for the test property      [Property content requirement]
11. PropertyKnowledgeBlock complete and reviewed      [Property content requirement]
12. First test reservation created                    [Data requirement]
13. AI concierge end-to-end test                      [Validation gate]
```

Partner dispatch, homeowner dashboard, and operator dashboard can be built in parallel with steps 6–9, but are not required for the AI concierge to handle a first test guest conversation.

---

## External Service Dependency Summary

| Service | Required for MVP | Requires legal review | Key risk |
|---|---|---|---|
| WhatsApp Business API (Meta) | Yes | Yes — GDPR DPA required | Meta approval timeline (can take 2–4 weeks) |
| LLM provider | Yes | Yes — GDPR DPA required | Provider selection + data processing agreement |
| Email service (transactional) | Yes | No | Minimal |
| SMS gateway | Yes | No | Italian number provisioning |
| Payment processor (Stripe) | Yes | Yes — consumer law review | Stripe business verification |
| CDN / media storage | Yes | No | Minimal |

---

## Circular Dependency Analysis

No circular dependencies exist between the data models as defined. The dependency graph is a directed acyclic graph (DAG) with User and Property as the roots.

One potential cycle risk: the `Notification service` references `User` for notification targets, and `User` account events emit notifications. This is not a circular dependency in the data layer — it is a circular event flow that must be handled by the event broker (idempotency + at-least-once delivery with deduplication).

The `AI Runtime Orchestrator` creates `ServiceRequest` records, which trigger partner dispatch events. Partner dispatch creates `PartnerRequest` records, which trigger homeowner notifications. This chain is event-driven and non-circular because each step reads and writes different models.

---

## Related Documents

- [module-functionality-map.md](module-functionality-map.md) — What each module does
- [implementation-roadmap.md](implementation-roadmap.md) — Build order
- [event-driven-architecture.md](event-driven-architecture.md) — Event catalogue and broker specs
- [data-models.md](../backend/data-models.md) — Canonical model field definitions
- [security-model.md](security-model.md) — Auth and access boundaries per component
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — C-01 and C-02 blockers
