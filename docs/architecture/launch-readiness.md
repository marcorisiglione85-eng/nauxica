# Launch Readiness

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — pre-launch gate checklist
**Last updated:** 2026-05-28
**Related:** [pre-backend-checklist.md](pre-backend-checklist.md) · [mvp-boundaries.md](mvp-boundaries.md) · [implementation-roadmap.md](implementation-roadmap.md) · [security-model.md](security-model.md) · [documentation-consistency-audit.md](documentation-consistency-audit.md) · [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md)

---

## Purpose

This document consolidates every launch-blocking dependency across all Nauxica architecture documents into a single gate checklist.

A property cannot go live, and the AI concierge cannot serve a real guest, until every item in this document is either checked or has formal documented sign-off with an accepted risk statement.

This document does not set policy — it aggregates gates already defined in other documents. For detail on any item, follow the referenced source document.

---

## Status Key

| Status | Meaning |
|---|---|
| `[ ]` | Not yet complete |
| `[x]` | Complete — verified |
| `[BLOCKED]` | Cannot be completed until a prior decision is made |
| `[LEGAL]` | Requires legal review before this item can be checked |
| `[DECISION]` | Requires founder/architect decision |

---

## PART 1 — CRITICAL ARCHITECTURE BLOCKERS

These two items are CRITICAL findings from [documentation-consistency-audit.md](documentation-consistency-audit.md). No backend schema work can begin — and no launch can proceed — until both are resolved.

---

### ⛔ BLOCKER C-01 — Visibility Scope Taxonomy Split

**Status:** `[DECISION]` BLOCKER / ARCHITECT DECISION REQUIRED
**Blocks:** All data model implementation; KBB scope filter; access control layer; AI concierge security boundary
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-01

**The conflict:**
Two incompatible visibility scope systems exist across the documentation:

| System | Scopes | Source |
|---|---|---|
| System A | GUEST / PARTNER / OPERATOR / INTERNAL | `data-visibility-model.md` |
| System B | PUB / GST / PTR / INT / AI | `data-models.md`, `property-data-schema.md`, `property-knowledge-schema.md` |

These systems are not equivalent in boundary definition. A backend engineer implementing from System B will build different access control logic than one implementing from System A.

**Decision required:**
1. Designate one system as the canonical taxonomy (recommended: System A — `data-visibility-model.md`)
2. If System A: add `PUBLIC` scope for pre-authentication fields; reconcile all System B documents
3. If System B: reconcile `data-visibility-model.md` to match shortcode system and clarify OPERATOR vs INT
4. Document the decision in `data-visibility-model.md` before any schema migration is written

**Gate:** This item cannot be checked until the founder/architect makes and documents this decision and all conflicting documents are updated.

---

### ⛔ BLOCKER C-02 — Service Type Count Mismatch (5 vs 9)

**Status:** `[DECISION]` BLOCKER / ARCHITECT DECISION REQUIRED
**Blocks:** PartnerAssignment schema; partner registration form; partner vetting tiers; subscription plan scope; dispatch service
**Reference:** [documentation-consistency-audit.md](documentation-consistency-audit.md) — Finding C-02

**The conflict:**
Partner-facing and commercial documents define 5 service types. `partner-assignment-model.md` defines 9:

| Onboarding + commercial (5) | `partner-assignment-model.md` (9) |
|---|---|
| CLEANING | CLEANING |
| MAINTENANCE | MAINTENANCE |
| LAUNDRY | LAUNDRY |
| TRANSFERS | TRANSFER |
| EXPERIENCES | EXPERIENCE |
| — | POOL_MAINTENANCE |
| — | GARDEN_MAINTENANCE |
| — | CONCIERGE_IN_PERSON |
| — | INSPECTION |

**Decision required:**
1. Confirm which service types are active at Sicily launch
2. If 5 types: update `partner-assignment-model.md` to mark the 4 additional types as "Post-MVP / defined but not activated"
3. If more types: update all onboarding and commercial documents to reflect the full list
4. Confirm canonical enum format (singular SCREAMING_SNAKE_CASE: `CLEANING`, `MAINTENANCE`, `TRANSFER`, `EXPERIENCE`, `LAUNDRY`)

**Gate:** This item cannot be checked until the founder makes this decision and all documents are reconciled.

---

## PART 2 — SECURITY GATES

All items derived from [security-model.md](security-model.md).

| # | Gate | Status | Source |
|---|---|---|---|
| S-01 | JWT signing key stored in secrets vault — not in code or .env file committed to repository | `[ ]` | security-model.md §1.1 |
| S-02 | Separate secrets vault environments for development, staging, and production | `[ ]` | security-model.md §5 |
| S-03 | Database credentials not hardcoded — sourced from secrets vault at runtime | `[ ]` | security-model.md §5 |
| S-04 | Operator MFA enforced — login blocked without second factor (no exceptions) | `[ ]` | security-model.md §1.2 |
| S-05 | Passwords stored as bcrypt or Argon2id hashes — never plaintext | `[ ]` | security-model.md §1.1 |
| S-06 | KBB scope filter is structural (whitelist) — not enforced by prompt instruction alone | `[ ]` | security-model.md §4; knowledge-retrieval-model.md |
| S-07 | AI runtime write permissions restricted: WhatsAppSession, ServiceRequest (create), EscalationRecord (create) only | `[ ]` | security-model.md §2; ai-runtime-orchestration.md |
| S-08 | SCOPE_VIOLATION security event logged if AI attempts a prohibited write | `[ ]` | ai-runtime-orchestration.md |
| S-09 | Encrypted at rest: codice_fiscale_or_piva, guest_document_number, password_hash, access codes, id_document_url, insurance_document_url | `[ ]` | security-model.md §6 |
| S-10 | WhatsApp webhook HMAC signature verified on every inbound webhook | `[ ]` | security-model.md §7 |
| S-11 | Replay prevention on webhooks: timestamp window ≤ 5 minutes | `[ ]` | security-model.md §7 |
| S-12 | Account lockout: 5 failed login attempts → 15-minute lockout | `[ ]` | security-model.md §1.1 |
| S-13 | Access codes delivered to partners only at PartnerRequest.accepted — never at assignment time | `[ ]` | partner-assignment-model.md §7 |
| S-14 | Access codes for partners are PARTNER-scoped — never appear in AI concierge responses | `[ ]` | data-visibility-model.md; knowledge-retrieval-model.md |
| S-15 | Emergency pre-check runs deterministically before LLM — cannot be bypassed or skipped | `[ ]` | ai-runtime-orchestration.md §Step 3 |

---

## PART 3 — LEGAL AND REGULATORY GATES

All items require legal review. Items derived from [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) and from ⚠️ markers across the documentation.

| # | Gate | Status | Source |
|---|---|---|---|
| L-01 | GDPR Data Processing Agreement signed with Meta (WhatsApp Business API) | `[LEGAL]` | documentation-consistency-audit.md M-04; security-model.md §1.3 |
| L-02 | GDPR Data Processing Agreement signed with LLM provider | `[LEGAL]` | documentation-consistency-audit.md M-04; ai-runtime-orchestration.md |
| L-03 | Lawful basis for WhatsApp guest opt-in documented | `[LEGAL]` | documentation-consistency-audit.md M-04; whatsapp-concierge-guidelines.md |
| L-04 | Guest data retention periods and deletion schedule defined | `[LEGAL]` | data-models.md Model 4; data-visibility-model.md §9 |
| L-05 | CIR/CIN code registration confirmed for platform-mediated reservations | `[LEGAL]` | regulatory-compliance-checklist.md |
| L-06 | Alloggiati Web reporting obligations confirmed per property | `[LEGAL]` | data-models.md Model 4; homeowner-operations.md |
| L-07 | Tourist tax remittance obligations confirmed per municipality | `[LEGAL]` | data-models.md Model 4 |
| L-08 | Partner background check permissibility under Italian employment law confirmed | `[LEGAL]` | documentation-consistency-audit.md M-04; partner-vetting.md |
| L-09 | Commission VAT treatment confirmed (agency vs intermediation distinction) | `[LEGAL]` | documentation-consistency-audit.md M-04; partner-agreement.md |
| L-10 | Homeowner subscription auto-renewal terms compliant with Codice del Consumo | `[LEGAL]` | documentation-consistency-audit.md M-04; subscription-plans.md |
| L-11 | Terms of Service reviewed and legally approved | `[LEGAL]` | terms-of-service.md |
| L-12 | Partner Agreement reviewed and legally approved | `[LEGAL]` | partner-agreement.md |
| L-13 | Privacy Policy reviewed and legally approved | `[LEGAL]` | privacy-policy.md |
| L-14 | Dispute resolution clause in Terms of Service approved by legal | `[LEGAL]` | documentation-consistency-audit.md M-04; dispute-resolution.md |
| L-15 | WhatsApp message log retention and deletion policy defined | `[LEGAL]` | documentation-consistency-audit.md M-04; whatsapp-concierge-guidelines.md |
| L-16 | Guest codice_fiscale_or_piva encryption and storage reviewed | `[LEGAL]` | data-models.md Model 1 |
| L-17 | Breach notification obligation acknowledged (GDPR Art. 33 — 72h to Garante) | `[LEGAL]` | security-model.md §9 |

---

## PART 4 — OPERATIONAL GATES

Per-property requirements that must be satisfied before a specific property goes live.

| # | Gate | Status per property | Source |
|---|---|---|---|
| O-01 | EmergencyData.is_complete = true and operator-verified | `[ ]` | emergency-procedures.md; data-models.md Model 6 |
| O-02 | PropertyKnowledgeBlock.is_complete = true and operator-reviewed | `[ ]` | property-knowledge-schema.md; data-models.md Model 3 |
| O-03 | At least one active PartnerAssignment for CLEANING service type | `[ ]` | partner-assignment-model.md |
| O-04 | Homeowner has completed full onboarding checklist | `[ ]` | homeowner-onboarding.md; property-activation-checklist.md |
| O-05 | Homeowner has acknowledged legal agreements (ToS, Privacy Policy) | `[ ]` | onboarding flow |
| O-06 | Homeowner has confirmed understanding of Alloggiati Web obligation | `[ ]` | homeowner-operations.md |
| O-07 | Homeowner SLA acknowledgement: EMERGENCY = immediate; MAINTENANCE_URGENT = 30 min | `[ ]` | homeowner-operations.md |
| O-08 | Operator is reachable 24/7 during first active reservation period | `[ ]` | operator-runbook.md |
| O-09 | Italian emergency numbers confirmed accurate for property municipality (112, 113, 115, 118) | `[ ]` | emergency-procedures.md |
| O-10 | DynamicInstruction test: homeowner can create, activate, and deactivate a time-bounded instruction | `[ ]` | property-knowledge-schema.md |

---

## PART 5 — TECHNICAL GATES

Platform-level technical requirements before any property goes live.

| # | Gate | Status | Source |
|---|---|---|---|
| T-01 | End-to-end AI concierge test: guest message → correct scoped response, no data leakage | `[ ]` | ai-runtime-orchestration.md |
| T-02 | Emergency pre-check test: Italian + English emergency keywords all trigger immediate response | `[ ]` | emergency-procedures.md |
| T-03 | Scope isolation test: PARTNER-scoped field does not appear in any AI response | `[ ]` | data-visibility-model.md; knowledge-retrieval-model.md |
| T-04 | OPERATOR-scoped field does not appear in any API response to homeowner or partner | `[ ]` | data-visibility-model.md |
| T-05 | Access code gate test: code not delivered before check_in_from time on checkin_date | `[ ]` | whatsapp-session-anchor.md §8; property-knowledge-schema.md |
| T-06 | Escalation test: AI triggers escalation → operator notified by SMS within 60s | `[ ]` | escalation-rules.md; notification-system.md |
| T-07 | Session resolution test: unknown phone number returns unknown-guest message, no data exposed | `[ ]` | whatsapp-session-anchor.md §5 |
| T-08 | Unknown guest message does not expose any property or reservation data | `[ ]` | ai-runtime-orchestration.md Step 2 |
| T-09 | Idempotency test: duplicate webhook with same message_id does not create duplicate session or response | `[ ]` | ai-runtime-orchestration.md Step 1 |
| T-10 | Payment processor integration test: subscription creates, renews, and fails correctly | `[ ]` | subscription-plans.md |
| T-11 | CRITICAL notification test: SMS delivery confirmed < 60s outside quiet hours | `[ ]` | notification-system.md |
| T-12 | CRITICAL notification test: quiet hours (22:00–07:00) do NOT suppress CRITICAL | `[ ]` | notification-system.md |
| T-13 | Audit log test: all security events are logged append-only and cannot be deleted | `[ ]` | security-model.md §8 |

---

## PART 6 — CONTENT GATES

Platform content requirements that are not technical but must be in place before launch.

| # | Gate | Status | Source |
|---|---|---|---|
| C-01 | All placeholder values in subscription-plans.md resolved (€[X]/mo prices, commission %) | `[ ]` | documentation-consistency-audit.md M-05 |
| C-02 | All placeholder URLs in partner onboarding resolved ([platform URL], [contact method]) | `[ ]` | documentation-consistency-audit.md M-05 |
| C-03 | [platform URL] values confirmed and accessible | `[ ]` | partner-onboarding.md; first-job-walkthrough.md |
| C-04 | Terms of Service, Partner Agreement, Privacy Policy have final content (no stub text) | `[ ]` | legal/ directory |
| C-05 | Help centre articles reviewed and accurate for MVP feature set | `[ ]` | help-center/ directory |

---

## PART 7 — OPEN ARCHITECTURE CONFLICTS

These are HIGH findings from [documentation-consistency-audit.md](documentation-consistency-audit.md) that are not launch blockers but should be resolved before backend implementation of the affected areas.

| # | Conflict | Blocks | Source |
|---|---|---|---|
| H-01 | Access code delivery timing — three documents give conflicting rules | Access code gating implementation | audit Finding H-01 |
| H-02 | Session phase naming — hyphenated vs snake_case across docs | Session phase enum implementation | audit Finding H-02 |
| H-03 | ServiceRequest vs PartnerRequest — used interchangeably in partner-assignment-model.md §3 | Recurring schedule auto-creation logic | audit Finding H-03 |
| H-04 | "Operator" role — used to mean both Nauxica staff AND rental operators (homeowners) | Access control implementation | audit Finding H-04 |

---

## Launch Readiness Summary

| Category | Total gates | Complete | Blocked/Decision | Legal review needed |
|---|---|---|---|---|
| Critical architecture blockers | 2 | 0 | 2 | 0 |
| Security | 15 | 0 | 0 | 0 |
| Legal / regulatory | 17 | 0 | 0 | 17 |
| Operational (per property) | 10 | 0 | 0 | 0 |
| Technical | 13 | 0 | 0 | 0 |
| Content | 5 | 0 | 0 | 0 |

**No property may go live until all Part 1 blockers are resolved and all other gates are checked or have formal documented acceptance.**

---

## Related Documents

- [pre-backend-checklist.md](pre-backend-checklist.md) — Gates that must pass before backend implementation begins
- [mvp-boundaries.md](mvp-boundaries.md) — What is and is not in scope at launch
- [documentation-consistency-audit.md](documentation-consistency-audit.md) — All known conflicts and their severity
- [security-model.md](security-model.md) — Security architecture source of record
- [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) — Regulatory obligations source of record
- [operator-runbook.md](../operations/operator-runbook.md) — Operator readiness requirements
