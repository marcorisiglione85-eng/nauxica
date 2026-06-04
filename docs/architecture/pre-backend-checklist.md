# Pre-Backend Checklist

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — implementation readiness gate
**Last updated:** 2026-06-02
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

## SECTION 1 — CRITICAL ARCHITECTURE DECISIONS — RESOLVED

**Both items were resolved on 2026-05-28 before any schema migration was written.**

Both are CRITICAL findings from [documentation-consistency-audit.md](documentation-consistency-audit.md). Both decisions have been made and all conflicting documents updated.

---

### `[x]` ✅ C-01 — Visibility Scope Taxonomy Designated

**Status:** RESOLVED — Decision A applied (2026-05-28). PUB/GST/PTR/INT designated as canonical shortcodes. OPERATOR removed as a visibility scope and reclassified as an RBAC role. Changes applied to `data-visibility-model.md`, `data-models.md`, and `document-glossary.md`.
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-01

**Resolution:** `data-visibility-model.md` is the single authoritative source. All conflicting documents updated to use the PUB/GST/PTR/INT canonical shortcodes.

**Gate:** `[x]` Decision documented. All conflicting documents updated. `data-visibility-model.md` is the single authoritative source.

---

### `[x]` ✅ C-02 — Service Type List Confirmed

**Status:** RESOLVED — Founder decision applied (2026-05-28). Five canonical MVP service types confirmed.
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-02

**Resolution:** Five canonical MVP service types active at Sicily launch:
- `cleaning`
- `maintenance`
- `laundry`
- `transfers`
- `experiences`

Post-MVP subtypes (`pool_maintenance`, `garden_maintenance`, `concierge_in_person`, `inspection`) are not active at Sicily launch. Pool and garden maintenance jobs are classified as `maintenance` at MVP. Changes applied to `partner-assignment-model.md`, `service-request-flow.md`, `partner-onboarding.md`, and `document-glossary.md`.

**Gate:** `[x]` Decision documented. Canonical list defined in `partner-assignment-model.md`. All documents updated.

---

## SECTION 2 — HIGH-PRIORITY NAMING CONFLICTS — RESOLVED

These HIGH findings from [documentation-consistency-audit.md](documentation-consistency-audit.md) were resolved on 2026-05-28. They are recorded here for traceability. All four gates are confirmed closed.

### H-01 — Access Code Delivery Timing

**Status:** `[x]` RESOLVED — Decision E applied (2026-05-28). See [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-01.

Access code delivery gate: `session_phase = check_in AND current_time >= check_in_from`. Early delivery from midnight on `checkin_date` when `Property.early_access_code_delivery = true`. "Guest near property" is not a structural delivery trigger. `whatsapp-session-anchor.md §8` is the authoritative source.

**Gate:** `[x]` Single rule designated. Changes applied to `whatsapp-session-anchor.md §8` only.

---

### H-02 — Session Phase Naming Standardised

**Status:** `[x]` RESOLVED — Decision B applied (2026-05-28). See [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-02.

Canonical session phase values (snake_case enum strings):

```
pre_arrival
check_in
in_stay
check_out
post_stay
```

Changes applied to `whatsapp-session-anchor.md §3` and `document-glossary.md`.

**Gate:** `[x]` All session phase values in all documents use the canonical snake_case set above.

---

### H-03 — recurring schedule auto_create_request Field Corrected

**Status:** `[x]` RESOLVED — Applied as part of H-03 sprint (2026-05-28). See [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-03.

`partner-assignment-model.md §3` `auto_create_request` field comment corrected. Recurring schedules auto-create a `ServiceRequest` first (demand side), which then triggers `PartnerRequest` dispatch (supply side) via the normal routing pipeline.

**Gate:** `[x]` Field comment updated. `ServiceRequest` is auto-created on schedule; `PartnerRequest` dispatch follows via normal routing.

---

### H-04 — "Operator" Role Disambiguation

**Status:** `[x]` RESOLVED — Decision D applied (2026-05-28). See [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding H-04.

`Operator` (capital O) is reserved exclusively for Nauxica staff with elevated system access. `OPERATOR` as a visibility scope has been removed — data formerly labelled OPERATOR is INT-scoped; operator access governed by RBAC. Homeowner-facing documentation uses "homeowner" throughout.

**Gate:** `[x]` Acknowledged. Access control middleware uses `operator` role = Nauxica staff only. Homeowner-facing documentation uses "homeowner" throughout.

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
| `data-visibility-model.md` | Visibility scope taxonomy | C-01 resolved — PUB/GST/PTR/INT canonical. `data-visibility-model.md` is the single authoritative source. |
| `data-models.md` | Canonical field definitions for all models | C-01 resolved — scope system reconciled. ⚠️ Duplicate model numbers may still be present — verify before implementation. |
| `partner-assignment-model.md` | Service type taxonomy; assignment lifecycle | C-02 resolved — 5 MVP service types confirmed. H-03 resolved — `auto_create_request` comment corrected. |
| `whatsapp-session-anchor.md` | Session resolution and phase logic | H-02 resolved — canonical snake_case phase values applied to §3 and §8. |
| `ai-runtime-orchestration.md` | AI runtime pipeline | Ready — no known conflicts. |
| `knowledge-retrieval-model.md` | KBB specification | H-02 resolved — canonical snake_case phase values applied. |
| `security-model.md` | Auth and access boundaries | Ready — no known conflicts. |
| `event-driven-architecture.md` | Event catalogue and broker spec | Ready — no known conflicts. |
| `service-request-flow.md` | ServiceRequest state machine | Ready — no known conflicts. |
| `notification-system.md` | Notification channels and SLAs | Ready — no known conflicts. |

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
| 1 — Critical architecture decisions | 2 | 2 | 0 |
| 2 — High-priority naming conflicts | 4 | 4 | 0 |
| 3 — Tech stack | 1 | 0 | 0 |
| 4 — Documentation completeness | 2 | 0 | 0 |
| 5 — Legal and compliance | 7 | 0 | 0 |
| 6 — Environment readiness | 9 | 0 | 0 |
| 7 — Team and capacity | 4 | 0 | 0 |
| **Total** | **29** | **6** | **0** |

**Current status: Architecture decisions resolved (2026-05-28). No architecture blockers remain. Remaining 23 gates are technical, environmental, and legal. Backend implementation may proceed once Phase 2 (Frontend Prototype Consistency) is complete and environment provisioning begins.**

---

## Related Documents

- [launch-readiness.md](launch-readiness.md) — Full launch gate checklist (broader scope — all launch dependencies)
- [implementation-roadmap.md](implementation-roadmap.md) — What to build and in what order (starts after this checklist is clear)
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — Full detail on all conflicts, blockers, and recommended corrections
- [mvp-boundaries.md](mvp-boundaries.md) — What is in and out of scope for MVP
- [data-visibility-model.md](data-visibility-model.md) — Visibility scope source of record (C-01 resolved — PUB/GST/PTR/INT canonical)
- [partner-assignment-model.md](partner-assignment-model.md) — Service type source of record (C-02 resolved — 5 MVP types confirmed)
