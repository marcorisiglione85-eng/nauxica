# Pre-Backend Checklist

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — implementation readiness gate
**Last updated:** 2026-05-28
**Related:** [launch-readiness.md](launch-readiness.md) · [implementation-roadmap.md](implementation-roadmap.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md) · [security-model.md](security-model.md) · [pre-approval-template.md](../agent-ops/pre-approval-template.md)

---

## Purpose

This document defines what must be true before backend implementation begins. It is not a development checklist — it is a readiness gate. An engineer should be able to read this document and know, unambiguously, whether it is safe to start writing production code.

If any item marked `[BLOCKED]` or `[DECISION]` is not resolved: **do not start backend implementation.** Resolve the blocker first.

This document is intended to be checked once, before Sprint 0 of the implementation roadmap. When all items are checked, the backend engineer has a safe foundation to build from.

---

## Status Key

| Status | Meaning |
|---|---|
| `[ ]` | Not yet verified |
| `[x]` | Verified — this item is satisfied |
| `[BLOCKED]` | Cannot proceed — prior decision or action required |
| `[DECISION]` | Requires founder/architect decision before this can be resolved |
| `[LEGAL]` | Requires legal review |

---

## SECTION 1 — CRITICAL ARCHITECTURE DECISIONS

**These two items must be resolved before any schema migration is written.**

Both are CRITICAL findings from [documentation-consistency-audit.md](documentation-consistency-audit.md). Every data model in the system depends on these decisions. Building before they are resolved means rebuilding after they are.

---

### `[DECISION]` ⛔ C-01 — Visibility Scope Taxonomy Designated

**Status:** BLOCKER / ARCHITECT DECISION REQUIRED
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-01

**What must happen:**

1. The founder/architect designates one visibility scope taxonomy as canonical:
   - Option A: `data-visibility-model.md` system — GUEST / PARTNER / OPERATOR / INTERNAL (add PUBLIC for pre-auth fields)
   - Option B: `data-models.md` shortcode system — PUB / GST / PTR / INT (reconcile OPERATOR vs INT distinction)

2. All documents that use the other system are updated to use the canonical system.

3. A note is added to `data-visibility-model.md` confirming the decision and date.

**Documents requiring update depending on decision:**
- `data-models.md` — uses System B shortcodes throughout
- `property-data-schema.md` — uses System B shortcodes
- `property-knowledge-schema.md` — uses System B shortcodes

**Why this cannot be deferred:** Every field in every schema carries a visibility scope. The KBB scope filter is built against one system. The access control middleware is built against one system. Building both systems and reconciling later is not a viable approach.

**Gate:** `[ ]` Decision documented. All conflicting documents updated. data-visibility-model.md is the single authoritative source.

---

### `[DECISION]` ⛔ C-02 — Service Type List Confirmed

**Status:** BLOCKER / ARCHITECT DECISION REQUIRED
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-02

**What must happen:**

1. The founder confirms which service types are active at Sicily launch:
   - Option A: 5 types only (CLEANING, MAINTENANCE, LAUNDRY, TRANSFER, EXPERIENCE) — update `partner-assignment-model.md` to mark 4 types as Post-MVP
   - Option B: All 9 types active at launch — update all onboarding and commercial documents to reflect the full list
   - Option C: Some hybrid (e.g. 7 types) — document the exact list

2. Canonical enum values confirmed as singular SCREAMING_SNAKE_CASE: `CLEANING`, `MAINTENANCE`, `LAUNDRY`, `TRANSFER`, `EXPERIENCE` (not plural).

3. The confirmed list is added as an appendix to `partner-assignment-model.md` as the single source of truth, with all other documents referencing it.

**Documents requiring update:**
- If Option A: `partner-assignment-model.md` — mark POOL_MAINTENANCE, GARDEN_MAINTENANCE, CONCIERGE_IN_PERSON, INSPECTION as Post-MVP
- If Option B: `partner-onboarding.md`, `subscription-plans.md`, `partner-vetting.md`, `data-models.md` — add 4 new service types
- All options: `data-models.md` Model 1 `partner_service_types` enum — update to match canonical list
- All options: Standardise singular enum codes in all documents

**Why this cannot be deferred:** The `PartnerAssignment` schema, partner registration form, vetting tiers, and dispatch logic all reference the service type enum. Building with one list and reconciling later requires schema migrations and data corrections.

**Gate:** `[ ]` Decision documented. Canonical list defined in partner-assignment-model.md. All documents updated.

---

## SECTION 2 — HIGH-PRIORITY NAMING CONFLICTS

These are HIGH findings from [documentation-consistency-audit.md](documentation-consistency-audit.md). They are not launch blockers like C-01/C-02, but must be resolved before the affected components are implemented.

### H-01 — Access Code Delivery Timing

**Status:** `[ ]` Resolve before implementing KBB Step 5 (Access Gate)
**Reference:** documentation-consistency-audit.md — Finding H-01

Three documents give conflicting rules for when access codes may be delivered to guests. The implementation must follow a single rule. Designate `whatsapp-session-anchor.md §8` as authoritative: access codes delivered when `session_phase = check_in_day AND current_time >= check_in_from`. Update the other two documents to reference this rule rather than re-stating it.

**Gate:** `[ ]` Single rule designated. `property-knowledge-schema.md` and `whatsapp-concierge-guidelines.md` updated to defer to `whatsapp-session-anchor.md §8`.

---

### H-02 — Session Phase Naming Standardised

**Status:** `[ ]` Resolve before implementing WhatsApp Session module
**Reference:** documentation-consistency-audit.md — Finding H-02

Session phase values are expressed in three different formats across documents. Canonical values must be snake_case enum strings:

```
pre_arrival
check_in_day
in_stay
checkout_day
post_checkout
```

Update `whatsapp-session-anchor.md §3` (uses hyphenated lowercase), `knowledge-retrieval-model.md` (mixed formats), and any other document using the non-canonical format.

**Gate:** `[ ]` All session phase values in all documents use the canonical snake_case set above.

---

### H-03 — recurring schedule auto_create_request Field Corrected

**Status:** `[ ]` Resolve before implementing Partner dispatch recurring schedule
**Reference:** documentation-consistency-audit.md — Finding H-03

`partner-assignment-model.md` §3 recurring schedule defines `auto_create_request: Boolean // If true, PartnerRequest is auto-created on schedule`. This is incorrect — recurring schedules must auto-create a `ServiceRequest` first (demand side), which then triggers `PartnerRequest` dispatch (supply side). Skipping `ServiceRequest` bypasses urgency classification and routing logic.

**Gate:** `[ ]` Field comment updated to `// If true, ServiceRequest is auto-created on schedule, which triggers PartnerRequest dispatch via normal routing`.

---

### H-04 — "Operator" Role Disambiguation

**Status:** `[ ]` Resolve before implementing access control
**Reference:** documentation-consistency-audit.md — Finding H-04

"Operator" appears in two conflicting meanings. For backend implementation, `Operator` (capital O) means Nauxica staff with elevated access. "rental operator" / "property operator" in homeowner-facing docs means homeowner. Any code that checks the `operator` role must only match Nauxica staff accounts. No homeowner account should ever receive an `operator` JWT role.

**Gate:** `[ ]` Acknowledged. Access control middleware uses `operator` role = Nauxica staff only. Homeowner-facing documentation uses "homeowner" throughout.

---

## SECTION 3 — TECH STACK

### `[ ]` Tech Stack Decided and Documented

**What must be decided:**

| Layer | Decision needed | Notes |
|---|---|---|
| Backend language + framework | Python/FastAPI, Node.js/Express, Ruby/Rails, Go, other | Affects developer tooling, LLM library compatibility |
| Database | PostgreSQL (recommended for JSONB support on recurring_schedule), MySQL, other | PostgreSQL maps cleanly to JSONB for recurring schedule; also supports pgcrypto for encryption at rest |
| Event broker | Redis Streams (simpler, lower ops overhead) or RabbitMQ (more features) | Either works at MVP scale |
| Hosting / infrastructure | Cloud provider (AWS, GCP, Heroku, Render, Railway) | Affects deployment complexity and cost |
| Frontend build / deployment | No build step (current prototype), or add bundler | Phase 2 frontend may be served as static files |
| LLM provider | Anthropic (Claude), OpenAI (GPT-4), Mistral, other | Must be configurable via environment variable per ai-runtime-orchestration.md |
| Secrets vault | AWS Secrets Manager, HashiCorp Vault, Infisical, Doppler | Must be operational before Sprint 0 |

**Gate:** `[ ]` Tech stack documented in a decision record. All choices recorded with rationale.

---

## SECTION 4 — DOCUMENTATION COMPLETENESS

### `[ ]` All Architecture Documents Are Implementation-Ready

Before backend implementation begins, these authoritative source documents must be in their final, consistent state:

| Document | Role | Current conflicts |
|---|---|---|
| `data-visibility-model.md` | Visibility scope taxonomy | Conflicts with data-models.md (C-01 — must be resolved) |
| `data-models.md` | Canonical field definitions for all models | Uses System B scopes (C-01); duplicate model numbers present |
| `partner-assignment-model.md` | Service type taxonomy; assignment lifecycle | 9 vs 5 service type conflict (C-02); auto_create_request error (H-03) |
| `whatsapp-session-anchor.md` | Session resolution and phase logic | Session phase naming inconsistency (H-02) |
| `ai-runtime-orchestration.md` | AI runtime pipeline | Ready — no known conflicts |
| `knowledge-retrieval-model.md` | KBB specification | Mixed session phase format (H-02) |
| `security-model.md` | Auth and access boundaries | Ready — no known conflicts |
| `event-driven-architecture.md` | Event catalogue and broker spec | Ready — no known conflicts |
| `service-request-flow.md` | ServiceRequest state machine | Ready — no known conflicts |
| `notification-system.md` | Notification channels and SLAs | Ready — no known conflicts |

**Gate:** `[ ]` All documents in the table above have their known conflicts resolved. No document has contradictory definitions in another document for the same concept.

### `[ ]` data-models.md Duplicate Model Numbers Corrected

**Note:** `data-models.md` contains duplicate numbered model sections (Task appears as both Model 5 and Model 10; PartnerRequest as Model 6 and Model 11; Message as Model 7 and Model 12; Review as Model 8 and Model 13). The later entries (Models 10–13) appear to be the more complete versions. This should be resolved before the document is used as an implementation reference — the earlier duplicates removed, and the canonical model numbers assigned consistently.

**Gate:** `[ ]` Duplicate model entries removed from data-models.md. Each model has exactly one entry with a unique model number.

---

## SECTION 5 — LEGAL AND COMPLIANCE READINESS

These items must be initiated — not necessarily completed — before backend implementation begins. Some have long lead times and must be started in parallel with implementation.

| # | Item | Status | Lead time |
|---|---|---|---|
| LE-01 | GDPR DPA with Meta (WhatsApp Business API) initiated | `[LEGAL]` | 2–6 weeks — start immediately |
| LE-02 | GDPR DPA with LLM provider initiated | `[LEGAL]` | 1–4 weeks |
| LE-03 | WhatsApp Business API account applied for and under review | `[ ]` | 2–4 weeks — start immediately |
| LE-04 | Legal review of Terms of Service initiated | `[LEGAL]` | 2–4 weeks |
| LE-05 | Legal review of Partner Agreement initiated | `[LEGAL]` | 2–4 weeks |
| LE-06 | Regulatory compliance checklist reviewed with Italian legal counsel | `[LEGAL]` | Variable — start early |
| LE-07 | Data retention schedule defined and agreed with legal counsel | `[LEGAL]` | Needed before first reservation data is stored |

**Note on WhatsApp Business API:** Meta's approval process can take 2–4 weeks. If the WhatsApp account is not approved before Sprint 5 (AI concierge), the AI runtime cannot be tested against real guest messages. Open the account immediately — in parallel with pre-roadmap architecture decisions.

---

## SECTION 6 — ENVIRONMENT READINESS

| # | Item | Status |
|---|---|---|
| E-01 | Development environment provisioned | `[ ]` |
| E-02 | Staging environment provisioned (matches production architecture) | `[ ]` |
| E-03 | Secrets vault operational in all environments | `[ ]` |
| E-04 | Database provisioned in development and staging | `[ ]` |
| E-05 | Event broker provisioned in development and staging | `[ ]` |
| E-06 | CDN / media storage buckets created | `[ ]` |
| E-07 | CI/CD pipeline configured (automated tests on push) | `[ ]` |
| E-08 | Structured logging configured (request IDs, correlation IDs on all events) | `[ ]` |
| E-09 | No secrets in version control — .env files gitignored, pre-commit hook in place | `[ ]` |

---

## SECTION 7 — TEAM AND CAPACITY

| # | Item | Status |
|---|---|---|
| TC-01 | Backend developer identified and available to start Sprint 0 | `[ ]` |
| TC-02 | Operator (founder) available for 24/7 coverage during first active reservation | `[ ]` |
| TC-03 | Legal counsel identified for Italian regulatory review | `[ ]` |
| TC-04 | All platform decisions made by the same person who will approve production data — no deferred accountability | `[ ]` |

---

## Checklist Summary

| Section | Gates | Complete | Blocked |
|---|---|---|---|
| 1 — Critical architecture decisions | 2 | 0 | 2 |
| 2 — High-priority naming conflicts | 4 | 0 | 0 |
| 3 — Tech stack | 1 | 0 | 0 |
| 4 — Documentation completeness | 2 | 0 | 0 |
| 5 — Legal and compliance | 7 | 0 | 0 |
| 6 — Environment readiness | 9 | 0 | 0 |
| 7 — Team and capacity | 4 | 0 | 0 |
| **Total** | **29** | **0** | **2** |

**Current status: BLOCKED — 2 critical architecture decisions outstanding.**

The 2 BLOCKED items in Section 1 (C-01 and C-02) must be resolved before any backend implementation begins. All other items can be worked in parallel once the decision process is underway.

---

## Related Documents

- [launch-readiness.md](launch-readiness.md) — Full launch gate checklist (broader scope — all launch dependencies)
- [implementation-roadmap.md](implementation-roadmap.md) — What to build and in what order (starts after this checklist is clear)
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — Full detail on all conflicts, blockers, and recommended corrections
- [mvp-boundaries.md](mvp-boundaries.md) — What is in and out of scope for MVP
- [data-visibility-model.md](data-visibility-model.md) — Visibility scope source of record (pending C-01 resolution)
- [partner-assignment-model.md](partner-assignment-model.md) — Service type source of record (pending C-02 resolution)
