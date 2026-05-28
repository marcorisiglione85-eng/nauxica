# Cross-Reference Map

**Version:** 1.0
**Status:** Complete — Governance phase
**Scope:** Full docs/ directory · Document dependency and authority model
**Last updated:** 2026-05-28
**Audience:** Founder, system architect, documentation maintainers, AI documentation agents
**Related:** [documentation-consistency-audit.md](documentation-consistency-audit.md) · [document-glossary.md](document-glossary.md)

---

## Purpose

This document maps how every major document in the Nauxica documentation ecosystem connects to every other. It answers:

- Which document is the source of truth on a given subject?
- Which documents must be updated together (never diverge)?
- Which documents require founder approval before modification?
- Which documents are safe for AI documentation agents to update?
- Which documents require legal review before they can be finalised?

Use this map when making any change to an existing document, to understand what else may need updating.

---

## Document Authority Tiers

Documents are assigned one of four authority tiers:

| Tier | Label | Meaning |
|---|---|---|
| **T1** | Immutable Source of Truth | The canonical definition. Other documents defer to this. Changes require founder + architect sign-off. |
| **T2** | Operational Reference | Derived from T1 documents. Must stay consistent with T1. Changes require operator review. |
| **T3** | Implementation Guide | Explains how to do something. References T1 and T2. Lower risk of divergence. |
| **T4** | Informational / Legal-pending | Stubs, placeholders, or documents awaiting legal finalisation. Not yet authoritative. |

---

## Source-of-Truth Documents (Tier 1)

| Document | Authoritative on | Must not diverge from |
|---|---|---|
| `docs/architecture/data-visibility-model.md` | Visibility scope taxonomy (GUEST/PARTNER/OPERATOR/INTERNAL) | All field definitions across all schema documents |
| `docs/ai-concierge/whatsapp-session-anchor.md` | Session phase values, session resolution logic, access code delivery gates | `ai-runtime-orchestration.md`, `property-knowledge-schema.md`, `whatsapp-concierge-guidelines.md` |
| `docs/operations/service-request-flow.md` | ServiceRequest lifecycle states and ServiceRequest/PartnerRequest distinction | `partner-assignment-model.md`, `data-models.md`, `escalation-rules.md` |
| `docs/architecture/partner-assignment-model.md` | PartnerAssignment lifecycle, service type enum values | `partner-vetting.md`, `partner-onboarding.md`, `service-request-flow.md` |
| `docs/ai-concierge/escalation-rules.md` | Escalation trigger taxonomy (TRIGGER-01 through TRIGGER-11), SLA levels | `emergency-procedures.md`, `ai-runtime-orchestration.md`, `whatsapp-concierge-guidelines.md`, `operator-runbook.md` |
| `docs/ai-concierge/emergency-procedures.md` | Emergency response rules, Italian emergency numbers, emergency types | `whatsapp-concierge-guidelines.md`, `ai-knowledge-taxonomy.md`, `guest-safety.md` |
| `docs/backend/data-models.md` | Canonical field names, model structure, relationship definitions | All schema documents, API endpoint docs |
| `docs/legal/regulatory-compliance-checklist.md` | Italian regulatory obligations (CIR/CIN, tourist tax, Alloggiati Web, GDPR) | All legal documents, homeowner onboarding, ai-tone-guidelines |
| `docs/architecture/event-driven-architecture.md` | Event naming conventions, EventEnvelope structure, domain event taxonomy | `ai-runtime-orchestration.md`, `notification-system.md`, `service-request-flow.md` |
| `docs/architecture/security-model.md` | Authentication model, access boundary rules, secret management | `data-models.md`, `api/auth.md`, `data-visibility-model.md` |

---

## Document Dependency Graph

Read as: Row document depends on → Column document(s).

### AI Concierge Layer

| Document | Depends on (reads from) | Must stay consistent with |
|---|---|---|
| `ai-runtime-orchestration.md` | `whatsapp-session-anchor.md`, `knowledge-retrieval-model.md`, `ai-knowledge-taxonomy.md`, `escalation-rules.md`, `emergency-procedures.md`, `property-knowledge-schema.md`, `event-driven-architecture.md` | All listed |
| `knowledge-retrieval-model.md` | `property-knowledge-schema.md`, `whatsapp-session-anchor.md`, `data-visibility-model.md` | `ai-runtime-orchestration.md`, `ai-knowledge-taxonomy.md` |
| `property-knowledge-schema.md` | `data-models.md`, `data-visibility-model.md` | `property-knowledge-base-template.md`, `knowledge-retrieval-model.md` |
| `ai-knowledge-taxonomy.md` | `property-knowledge-schema.md`, `data-visibility-model.md`, `whatsapp-session-anchor.md`, `escalation-rules.md` | `knowledge-retrieval-model.md`, `ai-runtime-orchestration.md` |
| `whatsapp-concierge-guidelines.md` | `whatsapp-session-anchor.md`, `ai-tone-guidelines.md`, `escalation-rules.md`, `emergency-procedures.md` | `whatsapp-session-anchor.md` (access code rules must match exactly) |
| `ai-tone-guidelines.md` | (standalone policy document) | Consistent with `whatsapp-concierge-guidelines.md` on tone and prohibited behaviours |
| `escalation-rules.md` | `data-models.md` (EscalationRecord), `emergency-procedures.md` | `ai-runtime-orchestration.md`, `whatsapp-concierge-guidelines.md`, `operator-runbook.md` |
| `emergency-procedures.md` | `escalation-rules.md`, `data-models.md` (EmergencyData) | `whatsapp-concierge-guidelines.md`, `ai-knowledge-taxonomy.md` |
| `whatsapp-session-anchor.md` | `data-models.md` (Reservation, WhatsAppSession, GuestStayContext) | `ai-runtime-orchestration.md`, `knowledge-retrieval-model.md` |

### Architecture Layer

| Document | Depends on | Must stay consistent with |
|---|---|---|
| `data-visibility-model.md` | (foundational — no dependencies) | All field definitions in all schema documents |
| `partner-assignment-model.md` | `data-models.md`, `data-visibility-model.md` | `service-request-flow.md`, `partner-vetting.md`, `partner-onboarding.md` |
| `event-driven-architecture.md` | `data-models.md` | `ai-runtime-orchestration.md`, `notification-system.md`, `service-request-flow.md` |
| `security-model.md` | `data-models.md`, `data-visibility-model.md` | `api/auth.md`, all authentication references |
| `notification-system.md` | `event-driven-architecture.md`, `data-models.md` | `whatsapp-concierge-guidelines.md`, `service-request-flow.md` |

### Backend Layer

| Document | Depends on | Must stay consistent with |
|---|---|---|
| `data-models.md` | `data-visibility-model.md` | All schema documents, API endpoint docs |
| `architecture-overview.md` | `data-models.md`, `event-driven-architecture.md` | `api-overview.md` |
| `auth-strategy.md` | `security-model.md` | `api/auth.md` |
| `api-overview.md` | `data-models.md`, `auth-strategy.md` | All `api/endpoints/*.md` |
| `api/endpoints/*.md` | `data-models.md`, `api-overview.md` | Each other (consistent endpoint patterns) |

### Operations Layer

| Document | Depends on | Must stay consistent with |
|---|---|---|
| `service-request-flow.md` | `partner-assignment-model.md`, `data-models.md`, `escalation-rules.md`, `event-driven-architecture.md` | `operator-runbook.md`, `first-job-walkthrough.md` |
| `operator-runbook.md` | `escalation-rules.md`, `emergency-procedures.md`, `service-request-flow.md`, `partner-vetting.md` | `operator-response-templates.md` |
| `homeowner-operations.md` | `service-request-flow.md`, `partner-assignment-model.md` | `homeowner-onboarding.md` |
| `partner-operations.md` | `service-request-flow.md`, `partner-assignment-model.md` | `partner-onboarding.md`, `first-job-walkthrough.md` |

### Onboarding Layer

| Document | Depends on | Must stay consistent with |
|---|---|---|
| `homeowner-onboarding.md` | `property-data-schema.md`, `regulatory-compliance-checklist.md`, `subscription-plans.md`, `property-activation-checklist.md` | `property-intake-checklist.md` |
| `property-activation-checklist.md` | `property-data-schema.md`, `property-knowledge-base-template.md`, `regulatory-compliance-checklist.md`, `emergency-procedures.md` | `homeowner-onboarding.md` |
| `partner-onboarding.md` | `partner-vetting.md`, `partner-assignment-model.md`, `subscription-plans.md` | `first-job-walkthrough.md`, `partner-vetting.md` |
| `first-job-walkthrough.md` | `service-request-flow.md`, `partner-assignment-model.md`, `dispute-resolution.md`, `partner-vetting.md` | `partner-onboarding.md` |
| `subscription-plans.md` | `regulatory-compliance-checklist.md`, `data-models.md` (plan fields), `terms-of-service.md` | `homeowner-onboarding.md`, `partner-onboarding.md` |

### Trust & Safety Layer

| Document | Depends on | Must stay consistent with |
|---|---|---|
| `partner-vetting.md` | `partner-assignment-model.md`, `data-models.md`, `regulatory-compliance-checklist.md` | `partner-onboarding.md`, `first-job-walkthrough.md` |
| `dispute-resolution.md` | `data-models.md`, `escalation-rules.md`, `partner-agreement.md` | `partner-vetting.md`, `first-job-walkthrough.md` |
| `guest-safety.md` | `emergency-procedures.md`, `escalation-rules.md` | `whatsapp-concierge-guidelines.md` |

---

## Document Groups: Never Diverge

These document pairs/groups contain overlapping content definitions. Any change to one requires a review of all others in the group.

### Group 1 — Access Code Delivery Rules

Must stay consistent:
- `docs/ai-concierge/whatsapp-session-anchor.md` §8 (authoritative)
- `docs/ai-concierge/property-knowledge-schema.md` (access code gating section)
- `docs/ai-concierge/whatsapp-concierge-guidelines.md` §11

Ownership: AI concierge architect

---

### Group 2 — Emergency Response Rules

Must stay consistent:
- `docs/ai-concierge/emergency-procedures.md` §5 (AI rules E-01 through E-07) (authoritative)
- `docs/ai-concierge/whatsapp-concierge-guidelines.md` §13 (EM-01 through EM-07)

Ownership: AI concierge architect

---

### Group 3 — Service Type Taxonomy

Must stay consistent:
- `docs/architecture/partner-assignment-model.md` §2 (authoritative)
- `docs/trust-safety/partner-vetting.md` (vetting tier table)
- `docs/onboarding/partner/partner-onboarding.md` (service types section)
- `docs/onboarding/homeowner/subscription-plans.md` (partner marketplace references)
- `docs/architecture/document-glossary.md` (service types table)

Ownership: Founder (commercial scope decision)

---

### Group 4 — Session Phase Values

Must stay consistent:
- `docs/ai-concierge/whatsapp-session-anchor.md` (authoritative)
- `docs/ai-concierge/ai-knowledge-taxonomy.md` (all category trigger sections)
- `docs/ai-concierge/knowledge-retrieval-model.md` (KBB pipeline references)
- `docs/ai-runtime/ai-runtime-orchestration.md` (Step 2 and all phase-gated logic)
- `docs/backend/data-models.md` (WhatsAppSession, GuestStayContext phase fields)

Ownership: Backend architect

---

### Group 5 — Escalation SLAs and Trigger Taxonomy

Must stay consistent:
- `docs/ai-concierge/escalation-rules.md` (authoritative)
- `docs/ai-runtime/ai-runtime-orchestration.md` (Step 10)
- `docs/ai-concierge/whatsapp-concierge-guidelines.md` (escalation messaging sections)
- `docs/operations/operator-runbook.md` (SLA response targets)
- `docs/operations/operator-response-templates.md` (response template triggers)

Ownership: Operator / founder

---

### Group 6 — Visibility Scope Definitions

Must stay consistent:
- `docs/architecture/data-visibility-model.md` (authoritative)
- `docs/backend/data-models.md` (visibility column in all model tables)
- `docs/property-intake/property-data-schema.md` (visibility column)
- `docs/ai-concierge/property-knowledge-schema.md` (field visibility annotations)

Ownership: Backend architect

---

## Modification Authority

### Require founder approval before any change

- `docs/onboarding/homeowner/subscription-plans.md` (pricing, plan scope, commission rates)
- `docs/legal/terms-of-service.md`
- `docs/legal/partner-agreement.md`
- `docs/legal/privacy-policy.md`
- `docs/legal/regulatory-compliance-checklist.md` (legal obligation definitions)
- `docs/agent-ops/claude-code-master-rules.md`
- `docs/agent-ops/agent-task-protocol.md`
- `docs/agent-ops/frontend-agent-scope.md`
- `docs/architecture/security-model.md` (authentication or access boundary changes)
- `docs/architecture/data-visibility-model.md` (scope taxonomy changes)

### Require architect + operator review before change

- All Tier 1 source-of-truth documents
- `docs/ai-concierge/escalation-rules.md`
- `docs/ai-concierge/emergency-procedures.md`
- `docs/ai-runtime/ai-runtime-orchestration.md`
- `docs/architecture/event-driven-architecture.md`
- `docs/backend/data-models.md`

### Safe for AI documentation agents to update (with human review after)

Documents that are operational guides or onboarding content — where the agent is correcting prose, fixing broken links, updating cross-references, or adding clarifying notes. The agent must not alter architectural decisions or definitions.

- `docs/onboarding/homeowner/homeowner-onboarding.md`
- `docs/onboarding/homeowner/property-activation-checklist.md`
- `docs/onboarding/partner/partner-onboarding.md`
- `docs/onboarding/partner/first-job-walkthrough.md`
- `docs/property-intake/property-knowledge-base-template.md`
- `docs/operations/operator-response-templates.md`
- `docs/help-center/common-issue-playbooks.md`
- `docs/faq/*.md`
- `docs/brand/*.md`

### Safe for AI documentation agents to update (no human review required for minor edits)

Documentation governance documents maintained by this audit process:

- `docs/architecture/documentation-consistency-audit.md` (update when new findings identified)
- `docs/architecture/document-glossary.md` (update when new terms introduced)
- `docs/architecture/cross-reference-map.md` (update when new documents added)

---

## Documents Requiring Legal Review Before Finalisation

| Document | Outstanding issues | Can be shown to? |
|---|---|---|
| `docs/legal/terms-of-service.md` | Full legal review needed | Internal only until reviewed |
| `docs/legal/partner-agreement.md` | Commission structure, VAT, dispute clause | Internal only until reviewed |
| `docs/legal/privacy-policy.md` | GDPR compliance, data retention | Internal only until reviewed |
| `docs/legal/cookie-policy.md` | ePrivacy compliance | Internal only until reviewed |
| `docs/legal/regulatory-compliance-checklist.md` | CIR/CIN confirmation, background check law | Internal reference; not shown to partners as advice |
| `docs/onboarding/homeowner/subscription-plans.md` | Price change notice requirements, refund policy | Internal until prices set and legal reviewed |

---

## Documents Safe as Implementation References (Stable Architecture)

These documents are architecturally stable and can be used directly by backend engineers and AI system builders without additional review:

- `docs/architecture/data-visibility-model.md`
- `docs/architecture/event-driven-architecture.md`
- `docs/architecture/partner-assignment-model.md`
- `docs/architecture/security-model.md`
- `docs/architecture/notification-system.md`
- `docs/ai-runtime/ai-runtime-orchestration.md`
- `docs/ai-concierge/knowledge-retrieval-model.md`
- `docs/ai-concierge/property-knowledge-schema.md`
- `docs/ai-concierge/whatsapp-session-anchor.md`
- `docs/ai-concierge/ai-knowledge-taxonomy.md`
- `docs/operations/service-request-flow.md`
- `docs/backend/data-models.md`
- `docs/backend/architecture-overview.md`
- `docs/backend/auth-strategy.md`
- `docs/api/api-overview.md`
- `docs/api/auth.md`
- `docs/api/endpoints/*.md`

---

## Documents Currently Stubs or Incomplete

| Document | Status | Blocking what |
|---|---|---|
| `docs/agent-ops/phase-control-log.md` | Missing | Agent-ops workflows cannot execute |
| `docs/agent-ops/pre-approval-template.md` | Missing | Agent-ops workflows cannot execute |
| `docs/agent-ops/testing-checklist.md` | Missing | Agent-ops workflows cannot execute |
| `docs/agent-ops/handoff-report-template.md` | Missing | Agent-ops workflows cannot execute |
| `docs/agent-ops/docs-agent-scope.md` | Missing | Docs agent scope undefined |
| `docs/agent-ops/backend-agent-scope.md` | Missing | Backend agent scope undefined |
| `docs/legal/terms-of-service.md` | Stub / legal-pending | Homeowner and partner onboarding finalisation |
| `docs/legal/partner-agreement.md` | Stub / legal-pending | Partner activation |
| `docs/legal/privacy-policy.md` | Stub / legal-pending | Platform launch |
| `docs/legal/cookie-policy.md` | Stub / legal-pending | Platform launch |
| `docs/onboarding/guest/guest-welcome.md` | Complete or near-complete | Guest onboarding |

---

## New Document Registration

When a new document is added to `docs/`:

1. Determine its authority tier (T1–T4)
2. Identify which T1 documents it depends on
3. Add it to the relevant section of this cross-reference map
4. Add it to the appropriate document groups if it re-states any rules from an existing T1 document
5. Add it to `docs/README.md`

---

## Related Documents

- [documentation-consistency-audit.md](documentation-consistency-audit.md) — Detailed findings with severities and corrections
- [document-glossary.md](document-glossary.md) — Canonical term definitions
- [data-visibility-model.md](data-visibility-model.md) — Foundational visibility scope taxonomy
