# Documentation Consistency Audit

**Version:** 1.0
**Status:** Complete — Governance phase
**Scope:** Full docs/ directory · Sicily launch documentation ecosystem
**Last updated:** 2026-05-28
**Audience:** Founder, system architect, documentation maintainers
**Related:** [document-glossary.md](document-glossary.md) · [cross-reference-map.md](cross-reference-map.md)

---

## Audit Scope

Covers all 57 markdown files across 19 directories under `docs/`. Audit goals: identify referenced-but-missing files, conflicting definitions, inconsistent naming, duplicate responsibilities, broken cross-references, unresolved placeholders, and lifecycle state inconsistencies.

**Auditor note:** This audit does not redesign any existing architecture. Every recommended correction is editorial, naming-only, or clarification of an existing decision. No new platform layer or model is introduced.

---

## Audit Summary

| Severity | Count | Immediate action required |
|---|---|---|
| CRITICAL | 2 | Yes — implementation-blocking |
| HIGH | 3 | Yes — will cause confusion or bugs at build time |
| MEDIUM | 9 | Before first backend sprint |
| LOW | 7 | Before public documentation release |

---

## CRITICAL Findings

### C-01 — Visibility Scope Taxonomy Split

**Severity:** CRITICAL
**Status:** `RESOLVED` — Decision A applied (2026-05-28). PUB/GST/PTR/INT designated as canonical shortcodes. OPERATOR removed as a visibility scope and reclassified as an RBAC role. Changes applied to: `data-visibility-model.md` (scope taxonomy rewritten), `data-models.md` (Visibility Key updated, AI scope note added), `document-glossary.md` (visibility scope entries rewritten).
**Type:** Architectural — naming
**Affects:** `docs/architecture/data-visibility-model.md`, `docs/backend/data-models.md`, `docs/property-intake/property-data-schema.md`, `docs/ai-concierge/property-knowledge-schema.md`

**Finding:**

Two incompatible visibility scope systems coexist across the documentation:

| System | Scopes defined | Source |
|---|---|---|
| **System A** — full-word labels | `GUEST` / `PARTNER` / `OPERATOR` / `INTERNAL` | `data-visibility-model.md` |
| **System B** — shortcode labels | `PUB` / `GST` / `PTR` / `INT` | `data-models.md`, `property-data-schema.md`, `property-knowledge-schema.md` |

These are not equivalent:

- System A has no `PUB` scope. System B has no `OPERATOR` scope.
- System A's `GUEST` scope = "AI concierge and safe for guests." System B's `GST` = "confirmed guest, post-booking." These are close but not identical.
- System A's `INTERNAL` = "system only, no actors." System B's `INT` = "homeowner and Nauxica staff only."
- System B's `PUB` = "public, pre-authentication" — has no equivalent in System A.

A backend engineer implementing from `data-models.md` (System B) and an AI engineer implementing from `data-visibility-model.md` (System A) will build different access control logic.

**Why it matters:** Every field in every model carries one of these scope markers. If the two systems are implemented independently, data that should be internal to staff will be exposed to homeowners (or vice versa), and the AI concierge access boundary will be inconsistent.

**Recommended correction:**

1. Designate `data-visibility-model.md` as the authoritative scope taxonomy (System A — full-word labels are more readable and auditable).
2. Add `PUBLIC` as a fifth scope to `data-visibility-model.md` — for fields that are pre-authentication safe (property display name on a booking page, etc.).
3. Update `data-models.md` to use the full-word labels: `PUB → PUBLIC`, `GST → GUEST`, `PTR → PARTNER`, `INT → INTERNAL`, and note that `INT` fields visible to homeowners should be re-labelled `OPERATOR` or a new `HOMEOWNER` sub-scope.
4. Update `property-data-schema.md` and `property-knowledge-schema.md` to match.
5. Add a shortcode alias table to `data-visibility-model.md` for fields where shortcodes are needed in schema tables (e.g. `PUB = PUBLIC`, `GST = GUEST`).

**Note:** Do not implement the reconciliation without founder/architect sign-off — this is a schema-wide change.

---

### C-02 — Service Type Count Mismatch

**Severity:** CRITICAL
**Status:** `RESOLVED` — Founder architecture decision applied (2026-05-28). Five canonical MVP service types confirmed: `CLEANING`, `MAINTENANCE`, `LAUNDRY`, `TRANSFERS`, `EXPERIENCES`. `TRANSFERS` and `EXPERIENCES` are the canonical plural forms. `POOL_MAINTENANCE`, `GARDEN_MAINTENANCE`, `CONCIERGE_IN_PERSON`, and `INSPECTION` reclassified as post-MVP service subtypes; at MVP, pool/garden/inspection jobs are classified as `MAINTENANCE`. Changes applied to: `partner-assignment-model.md` (§2 taxonomy split into MVP types and post-MVP subtypes; response window and partner brief tables updated), `document-glossary.md` (service types table updated; Note on naming corrected), `partner-onboarding.md` (§2.1 table, §8.2 response windows, §9.1 payment note updated), `service-request-flow.md` (§1.2 homeowner examples, §2.1 urgency examples, §7.1 proof-of-completion table, §11 service_type field updated).
**Type:** Architectural — naming
**Affects:** `docs/onboarding/partner/partner-onboarding.md`, `docs/onboarding/homeowner/subscription-plans.md`, `docs/architecture/partner-assignment-model.md`, `docs/trust-safety/partner-vetting.md`, `docs/operations/service-request-flow.md`

**Finding:**

The platform's canonical service type list is stated as **5 types** in all onboarding and commercial documents, but `partner-assignment-model.md` defines **9 types**:

| In onboarding/commercial docs (5) | In `partner-assignment-model.md` (9) |
|---|---|
| CLEANING | CLEANING |
| MAINTENANCE | MAINTENANCE |
| LAUNDRY | LAUNDRY |
| TRANSFER(S) | TRANSFER |
| EXPERIENCE(S) | EXPERIENCE |
| — | POOL_MAINTENANCE |
| — | GARDEN_MAINTENANCE |
| — | CONCIERGE_IN_PERSON |
| — | INSPECTION |

Additionally: singular vs plural inconsistency — onboarding uses "Transfers" and "Experiences" (plural), schema uses `TRANSFER` and `EXPERIENCE` (singular enum codes).

**Why it matters:** Partners registering on the platform see 5 types. The data model supports 9. A homeowner trying to request pool maintenance or a pre-activation inspection has no documented path. Partner vetting criteria cover only 5 types. Subscription plans reference "5 partner types."

**Recommended correction:**

1. Founder decision required: confirm which service types are in scope at Sicily launch.
2. If 5 types are correct for launch: update `partner-assignment-model.md` to mark `POOL_MAINTENANCE`, `GARDEN_MAINTENANCE`, `CONCIERGE_IN_PERSON`, and `INSPECTION` as "Post-MVP" and note they are defined but not activated at launch.
3. If additional types are in scope: update all onboarding and commercial documents to reflect the full list.
4. Standardise all enum codes to singular (`TRANSFER` not `TRANSFERS`, `EXPERIENCE` not `EXPERIENCES`) across all documents. The `partner-assignment-model.md` convention (singular, SCREAMING_SNAKE_CASE) should be canonical.

---

## HIGH Findings

### H-01 — Access Code Delivery Logic Conflict

**Severity:** HIGH
**Status:** `RESOLVED` — Decision E applied (2026-05-28). Authoritative sources: `property-knowledge-schema.md` (Step 5) and `knowledge-retrieval-model.md` (§5 + §11) together define the canonical KBB gate model. Structural enforcement supersedes conversational intent. Approved canonical rules: (1) Default delivery at `check_in_from` time on `checkin_date` (when session transitions to `check_in`). (2) Early delivery from midnight on `checkin_date` when `Property.early_access_code_delivery = true` (default `false`). (3) "Guest near property" is NOT a structural delivery trigger — handled via escalation to homeowner only; the AI cannot bypass the KBB sentinel gate. (4) Post-checkout expiry at `checkout_date + 4 hours`. `property-knowledge-schema.md`, `knowledge-retrieval-model.md`, and `whatsapp-concierge-guidelines.md` were already consistent with the gate model — no changes required to those files. Changes applied to `whatsapp-session-anchor.md §8` only: delivery table row corrected (near-property condition removed; early delivery window clarified as midnight on `checkin_date`); security principle rewritten (24h-relative rule replaced with absolute midnight-on-checkin-day rule; early arrival escalation path documented per `whatsapp-concierge-guidelines.md §11.4`).
**Type:** Operational — conflicting rule
**Affects:** `docs/ai-concierge/property-knowledge-schema.md`, `docs/ai-concierge/whatsapp-concierge-guidelines.md`, `docs/ai-concierge/whatsapp-session-anchor.md`

**Finding:**

Three documents define when access codes may be delivered to a guest, and they do not agree:

| Source | Rule |
|---|---|
| `property-knowledge-schema.md` — Access Code Gating | Allows delivery when `session_phase IN (check_in, in_stay)` OR when `pre_arrival AND checkin_date = today` |
| `whatsapp-concierge-guidelines.md` — §11 | "Pre-arrival: No — codes are not delivered before arrival day" |
| `whatsapp-session-anchor.md` — §8 | "Lockbox code / smart lock: On `check_in_from` time on `checkin_date`, or when guest confirms they are near the property" |

The conflict: `property-knowledge-schema.md` permits delivery in `pre_arrival` phase if `checkin_date = today`. `whatsapp-concierge-guidelines.md` says pre-arrival is blocked. `whatsapp-session-anchor.md` says delivery is tied to the `check_in_from` time on the day — not just the date.

**Why it matters:** This is a security-sensitive rule. If the AI runtime implements the most permissive version (`checkin_date = today`), codes could be sent hours before the agreed check-in window. If it implements the strictest version (`pre_arrival = always blocked`), guests arriving on time but before the session transitions would be locked out.

**Recommended correction:**

Designate `whatsapp-session-anchor.md` §8 as the authoritative source. The rule should be:

> Access codes are delivered when: `session_phase = check_in_day` AND `current_time >= check_in_from`. If the guest confirms they are at the property before `check_in_from`, operator judgement applies — the AI should not deliver the code automatically.

Update `property-knowledge-schema.md` and `whatsapp-concierge-guidelines.md` to reference `whatsapp-session-anchor.md §8` rather than re-stating the rule.

---

### H-02 — Session Phase Naming Inconsistency

**Severity:** HIGH
**Status:** `RESOLVED` — Decision B applied (2026-05-28). All session phase values standardised to `snake_case`. Canonical values (from `whatsapp-session-anchor.md` §4): `pre_arrival`, `check_in`, `in_stay`, `check_out`, `post_stay`. Changes applied to: `whatsapp-session-anchor.md` §3 query (hyphenated reservation_status values corrected), `document-glossary.md` Session Phases table (incorrect `check_in_day`, `checkout_day`, `post_checkout` corrected).
**Type:** Naming — implementation risk
**Affects:** `docs/ai-concierge/whatsapp-session-anchor.md`, `docs/ai-concierge/ai-knowledge-taxonomy.md`, `docs/ai-concierge/knowledge-retrieval-model.md`, `docs/backend/data-models.md`

**Finding:**

Session phase values are used across multiple documents with inconsistent casing and format:

| Source | Notation used | Example |
|---|---|---|
| `whatsapp-session-anchor.md` §3 | Hyphenated lowercase strings | `'pre-arrival'`, `'checked-in'` |
| `ai-knowledge-taxonomy.md` | Backtick snake_case | `pre_arrival`, `check_in` |
| `knowledge-retrieval-model.md` | Mixed — both formats appear | `pre_arrival` and `pre-arrival` in same document |

**Why it matters:** If a backend engineer implements phase values as `pre-arrival` (from whatsapp-session-anchor.md) and the AI runtime checks for `pre_arrival` (from ai-knowledge-taxonomy.md), the gate condition will never match. Access codes will never be delivered, and no emergency routing will trigger.

**Recommended correction:**

Standardise all session phase values to `snake_case` enum strings. Canonical values:

```
pre_arrival
check_in_day
in_stay
checkout_day
post_checkout
```

Update all documents to use this exact set. `whatsapp-session-anchor.md` §3 (the SQL-like query using `'pre-arrival'`, `'checked-in'`) must be updated first as it is the source of record for session resolution logic.

---

### H-03 — ServiceRequest vs PartnerRequest Used Interchangeably

**Severity:** HIGH
**Status:** `RESOLVED` — Decision C applied (2026-05-28). `ServiceRequest` is the demand-side record (always created first); `PartnerRequest` is the supply/dispatch record (created by the routing pipeline from a ServiceRequest). Changes applied to: `partner-assignment-model.md` §3 recurring schedule `auto_create_request` comment corrected to reference `ServiceRequest`.
**Type:** Naming — conceptual confusion
**Affects:** `docs/backend/data-models.md`, `docs/architecture/partner-assignment-model.md`, `docs/onboarding/partner/first-job-walkthrough.md`, `docs/operations/service-request-flow.md`, `docs/ai-concierge/escalation-rules.md`

**Finding:**

`service-request-flow.md` correctly distinguishes the two objects:

> "A `ServiceRequest` is the demand-side record: 'someone needs something done at this property.' It is distinct from a `PartnerRequest`, which is the supply-side record: 'this specific partner has been asked to do this job.'"

However, across other documents these terms are used interchangeably:
- `partner-assignment-model.md` recurring schedule definition: "If true, `PartnerRequest` is auto-created on schedule" — should be `ServiceRequest` (the demand-side trigger).
- `first-job-walkthrough.md` uses "job request" throughout without distinguishing which object is meant.
- `escalation-rules.md` uses "ServiceRequest" in one place and "service request" (lowercase, ambiguous) in others.

**Why it matters:** A developer reading the assignment model will think the recurring schedule auto-creates a `PartnerRequest` directly — skipping the `ServiceRequest` → classification → routing pipeline. This would bypass urgency classification and partner dispatch logic.

**Recommended correction:**

1. `ServiceRequest` = demand-side object, always created first. Auto-routing from a recurring schedule creates a `ServiceRequest` first, which then triggers `PartnerRequest` creation. Update `partner-assignment-model.md` §3 recurring schedule definition.
2. Use `ServiceRequest` consistently in technical contexts, "service request" (lowercase) in operational/homeowner-facing prose, and "job request" only in partner-facing prose where the distinction is not technically relevant.
3. Add a note to `data-models.md` and `service-request-flow.md` cross-referencing the distinction.

---

### H-04 — "Operator" Role Used with Two Different Meanings

**Severity:** HIGH
**Status:** `RESOLVED` — Decision D applied (2026-05-28). `Operator` (capital O) is reserved exclusively for Nauxica staff with elevated system access. `OPERATOR` as a visibility scope has been removed — data formerly labelled OPERATOR is INT-scoped, with operator access governed by RBAC. Changes applied to: `data-visibility-model.md` (OPERATOR scope removed, RBAC clarification note added), `document-glossary.md` (Operator actor definition updated, visibility scope entries updated).
**Type:** Naming — conceptual confusion
**Affects:** `docs/architecture/data-visibility-model.md`, `docs/operations/operator-runbook.md`, multiple partner and homeowner docs

**Finding:**

The word "operator" appears in two distinct, unrelated contexts:

| Context | Meaning | Source |
|---|---|---|
| Data visibility model | An actor type with elevated system access (Nauxica staff) | `data-visibility-model.md` §2 |
| General usage | A homeowner who "operates" a rental property | Scattered across homeowner-facing docs |

Examples of homeowner-as-operator usage: "property operators", "rental operators", "short-term rental operator." These appear in `homeowner-onboarding.md`, `property-intake-checklist.md`, and scattered regulatory references.

**Why it matters:** `data-visibility-model.md` defines `OPERATOR` scope as a specific elevated-access role meaning Nauxica staff. If documentation uses "operator" to mean homeowner, any developer reading a sentence like "operators can access this data" will implement incorrect access control.

**Recommended correction:**

Reserve `Operator` (capital O) exclusively for Nauxica staff with elevated system access. Use `homeowner` for all property owner references. When referring to the category of short-term rental businesses, use "short-term rental operator" only where the industry context is clearly not about platform roles. Add a clarification note to `data-visibility-model.md` §2.

---

## MEDIUM Findings

### M-01 — AI Concierge Name Used Inconsistently

**Severity:** MEDIUM
**Status:** `RESOLVED` — Decision F applied (2026-05-29). Canonical name: Nauxica Concierge. Changes: `document-glossary.md` (canonical updated from "AI concierge" to "Nauxica Concierge"; "Nauxica concierge" removed from prohibited list — it is now the canonical form); `ai-tone-guidelines.md` (disclosure script: "AI assistant" → "Nauxica Concierge"); `whatsapp-concierge-guidelines.md` §9 Rules T-01 and T-02 (self-identification strings capitalised); `first-job-walkthrough.md` (two partner-facing references updated). Generic descriptor "AI concierge" remains acceptable in technical/architectural prose.
**Type:** Naming — brand and operational
**Affects:** Multiple documents across `ai-concierge/`, `onboarding/`, `operations/`

**Finding:**

The platform's AI guest assistant is referred to by at least six different names across the documentation:

| Name variant | Source |
|---|---|
| "AI concierge" | Most common — used in `escalation-rules.md`, `emergency-procedures.md`, `knowledge-retrieval-model.md` |
| "Nauxica concierge" | `whatsapp-concierge-guidelines.md` §7.1 |
| "WhatsApp concierge" | `whatsapp-concierge-guidelines.md` title |
| "concierge" (alone) | Scattered references |
| "AI assistant" | `ai-tone-guidelines.md` |
| "GuestPal" | Referenced in legacy CLAUDE.md (ETNA-AI/AMOS project notes) |

**Recommended correction:**

Canonical name: **AI concierge** (lowercase 'c', no product-name capitalisation at this stage).
Use "the AI concierge" in all operational and technical contexts.
"GuestPal" should not appear in the Nauxica documentation — it belongs to the AMOS prototype naming.
Update `ai-tone-guidelines.md` to replace "AI assistant" with "AI concierge" in all descriptive contexts.

---

### M-02 — "Homeowner" vs "Property Owner" vs "Host"

**Severity:** MEDIUM
**Status:** `RESOLVED` — Decision F applied (2026-05-29). Canonical platform role: Homeowner. Changes: `ai-tone-guidelines.md` disclosure script ("property owner" → "homeowner"); `whatsapp-concierge-guidelines.md` §9 Rule T-02 ("owner" → "homeowner") and §14 Media Handling ("property owner" → "homeowner"); `emergency-procedures.md` lockout template ("property owner" → "homeowner"); `ai-runtime-orchestration.md` two AI response templates ("host" removed — one replaced with "homeowner", one simplified to "a partner"). Retained: "Pretending to be the property owner" in whatsapp-concierge-guidelines.md §15 prohibited-behaviours table (acceptable descriptive prose).
**Type:** Naming — consistency
**Affects:** `docs/ai-concierge/ai-tone-guidelines.md`, `docs/ai-concierge/emergency-procedures.md`, `docs/ai-concierge/whatsapp-concierge-guidelines.md`

**Finding:**

Three terms are used for the same actor:
- "homeowner" — canonical, used in most documents
- "property owner" — appears in `ai-tone-guidelines.md` and `emergency-procedures.md`
- "host" — appears in `whatsapp-concierge-guidelines.md`

**Recommended correction:** Use "homeowner" throughout. Reserve "property owner" only in legal contexts where the property title ownership distinction matters. Remove "host" — it carries Airbnb connotations inconsistent with Nauxica's positioning.

---

### M-03 — Escalation Trigger Naming Inconsistency

**Severity:** MEDIUM
**Status:** `RESOLVED` — Decision F applied (2026-05-29). E-XX and EM-XX marked as legacy prefixes; no canonical replacement prefix defined yet. Legacy notation notes added to: `emergency-procedures.md §5` (before Rule E-01), `whatsapp-concierge-guidelines.md §13` (before Rule EM-01), `document-glossary.md` Escalation Triggers section (after TRIGGER-08 note), `cross-reference-map.md` Group 2 (inline annotations on both references). Consolidation under a single prefix is required in a future editorial sprint.
**Type:** Naming — operational
**Affects:** `docs/ai-concierge/escalation-rules.md`, `docs/ai-concierge/emergency-procedures.md`, `docs/ai-concierge/whatsapp-concierge-guidelines.md`

**Finding:**

Emergency response rules in `emergency-procedures.md` use the prefix `E-` (E-01 through E-07). The same rules in `whatsapp-concierge-guidelines.md` use the prefix `EM-` (EM-01 through EM-07). Escalation triggers in `escalation-rules.md` use `TRIGGER-XX` notation.

These three naming systems exist in the same operational domain and are frequently referenced together.

**Recommended correction:** Standardise to the `escalation-rules.md` convention (`TRIGGER-XX`) for escalation triggers. For emergency-specific AI rules, use `ER-XX` (Emergency Rule) to distinguish from general escalation triggers. Update cross-references in both documents.

---

### M-04 — Unresolved Legal Review Flags

**Severity:** MEDIUM
**Status:** `RESOLVED` — 2026-05-29. `docs/legal/legal-review-tracker.md` created. All 35 legal review items across six source documents consolidated into a single tracker with: item IDs (LR-01 through LR-35), risk level (CRITICAL/HIGH/MEDIUM/LOW), MVP/Pilot/Scale gate classification, owner, status, and next action. Legal Readiness Dashboard with gate summaries and recommended sequencing included. Cross-reference map to launch-readiness.md L-01 through L-17 gates included. No source documents were modified — the tracker is an aggregation document only.
**Type:** Legal — compliance
**Affects:** `docs/backend/data-models.md`, `docs/legal/regulatory-compliance-checklist.md`, `docs/ai-concierge/whatsapp-concierge-guidelines.md`, `docs/ai-concierge/knowledge-retrieval-model.md`, multiple others

**Finding:** 12 instances of `⚠️ Legal review required` across the documentation, all unresolved. These are not documentation issues — they are pre-launch dependencies. But they are not tracked in a single place, which means they risk being overlooked.

| Document | Issue | Category |
|---|---|---|
| `data-models.md` | `codice_fiscale_or_piva` encryption and storage | Data protection |
| `regulatory-compliance-checklist.md` | CIR/CIN code confirmation for platform | Regulatory |
| `regulatory-compliance-checklist.md` | GDPR lawful basis for WhatsApp opt-in | GDPR |
| `whatsapp-concierge-guidelines.md` | Meta opt-in requirements for guest consent | Platform T&C |
| `whatsapp-concierge-guidelines.md` | Message log retention and deletion | GDPR |
| `subscription-plans.md` | Price change notification under Codice del Consumo | Consumer law |
| `subscription-plans.md` | Commission model legal basis (agency vs intermediation) | Commercial law |
| `subscription-plans.md` | Cancellation refund policy | Consumer law |
| `dispute-resolution.md` | Dispute resolution clause in Terms of Service | Contract law |
| `partner-vetting.md` | Background check permissibility under Italian law | Employment law |
| `partner-agreement.md` | Commission VAT treatment | Tax law |
| `terms-of-service.md` | Trial period and subscription auto-renewal | Consumer law |

**Recommended correction:** Create a legal dependency tracker (either a dedicated section in `regulatory-compliance-checklist.md` or a standalone `docs/legal/legal-review-tracker.md`). All ⚠️ items should be registered there with owner, priority, and status fields.

---

### M-05 — Unresolved Placeholder Values

**Severity:** MEDIUM
**Status:** `RESOLVED` — Decision F applied (2026-05-29). All undecided placeholder values replaced with `[FOUNDER_DECISION_REQUIRED]`. Changes: `subscription-plans.md` (all price, commission, and founding-member count placeholders — 11 replacements); `homeowner-onboarding.md` (`[platform URL]`); `partner-onboarding.md` (`[platform URL]`, `[contact method]`); `first-job-walkthrough.md` (`[contact method]`). Dynamic template variables (e.g. `[municipality]`, `[emergency_contact_phone]`) retained as-is — those are runtime data fields, not undecided values.
**Type:** Editorial — operational completeness
**Affects:** `docs/onboarding/homeowner/subscription-plans.md`, `docs/onboarding/partner/partner-onboarding.md`, `docs/onboarding/partner/first-job-walkthrough.md`

**Finding:**

Multiple documents contain placeholder values not yet resolved:

| Document | Placeholder | Context |
|---|---|---|
| `subscription-plans.md` | `€[X]/mo`, `€[XX]/mo`, `€[XXX]/mo` | All homeowner plan prices |
| `subscription-plans.md` | `€[X×10]/yr` | Annual prices |
| `subscription-plans.md` | `[X]%` | Commission rates |
| `subscription-plans.md` | `[N]` (founding member count) | Grandfathering policy |
| `partner-onboarding.md` | `[platform URL]` | Registration URL |
| `partner-onboarding.md` | `[contact method]` | Support contact |
| `first-job-walkthrough.md` | `[contact method]` | Escalation contact |

**Recommended correction:** These are founder decisions, not documentation issues. Flag each placeholder to the founder for resolution before the documents are shown to any external party (partners, homeowners, investors).

---

### M-06 — Missing Agent-Ops Template Files

**Severity:** MEDIUM
**Status:** `RESOLVED` — 2026-05-29. M-06 Resolution Sprint completed. All six files cited as missing now exist and are complete. Full audit documented in `docs/agent-ops/agent-ops-audit.md`. All 10 governance files in `docs/agent-ops/` verified: each has a complete metadata header, full content, no unresolved placeholders, and all internal cross-references resolve. Stale "Missing" entries in `cross-reference-map.md` corrected. No governance files were modified — audit and remediation only.
**Type:** Operational — missing files
**Affects:** `docs/agent-ops/agent-task-protocol.md`, `docs/agent-ops/claude-code-master-rules.md`

**Finding:**

Four files referenced in agent-ops documents do not exist:
- `docs/agent-ops/phase-control-log.md` (referenced in `agent-task-protocol.md` and `claude-code-master-rules.md`)
- `docs/agent-ops/pre-approval-template.md` (referenced in both)
- `docs/agent-ops/testing-checklist.md` (referenced in both)
- `docs/agent-ops/handoff-report-template.md` (referenced in both)
- `docs/agent-ops/docs-agent-scope.md` and `docs/agent-ops/backend-agent-scope.md` (referenced in `agent-task-protocol.md` — only `frontend-agent-scope.md` exists)

**Recommended correction:** Create the missing agent-ops files, or update the referencing documents to remove the broken links if the templates will not be created.

---

### M-07 — Partner-Assignment-Model: Recurring Schedule Creates Wrong Object

**Severity:** MEDIUM
**Status:** `RESOLVED` — Applied as part of H-03 sprint (2026-05-28). The `auto_create_request` field comment in `partner-assignment-model.md §3` already references `ServiceRequest` (corrected during H-03 execution). No further action required.
**Type:** Operational — implementation error risk
**Affects:** `docs/architecture/partner-assignment-model.md`

**Finding:**

`partner-assignment-model.md` §3 recurring schedule definition states:

> `auto_create_request: Boolean // If true, PartnerRequest is auto-created on schedule`

Per `service-request-flow.md`, `PartnerRequest` is the supply-side dispatch record. Demand-side requests are always `ServiceRequest`. A recurring schedule (e.g. weekly pool maintenance) should auto-create a `ServiceRequest`, which then routes to a `PartnerRequest`.

**Recommended correction:** Change the field comment to: `// If true, ServiceRequest is auto-created on schedule, which triggers PartnerRequest dispatch`. Update any related event definitions.

---

### M-08 — "AI" Visibility Scope in data-models.md

**Severity:** MEDIUM
**Status:** `RESOLVED` — Applied as part of C-01 sprint (2026-05-28). The `AI` scope row was removed from the `data-models.md` Visibility Key; a note was added clarifying that AI access is governed by the `PropertyKnowledgeBlock` construction pipeline (a retrieval flag, not a visibility scope). No further action required.
**Type:** Naming — schema inconsistency
**Affects:** `docs/backend/data-models.md`

**Finding:**

`data-models.md` visibility key includes a fifth value `AI`: "May be included in AI concierge knowledge block (used in PropertyKnowledgeBlock only)." This scope does not exist in `data-visibility-model.md`, which is the authoritative source.

**Why it matters:** The `AI` scope is not a visibility boundary — it is a retrieval flag. Treating it as a scope alongside `GST/PTR/INT/PUB` implies the AI can access fields regardless of their visibility scope, which would break the access control model.

**Recommended correction:** Remove `AI` as a visibility scope. Replace with a boolean flag `ai_visible: true/false` on relevant fields in the knowledge schema. Clarify in `data-models.md` that AI access is governed by `PropertyKnowledgeBlock` construction, not by a visibility scope override.

---

### M-09 — Undefined Acronyms

**Severity:** MEDIUM
**Status:** `RESOLVED` — Pre-existing (2026-05-29). All 8 acronyms listed in this finding (MVP, CET, CEST, p95, p99, DLQ, OTP, ADR, FIFO, TTL) are already defined in `document-glossary.md` Acronym Index. No changes required.
**Type:** Editorial — readability
**Affects:** Multiple documents

**Finding:**

The following acronyms are used in technical documents without being defined at first use:

| Acronym | Definition | Documents affected |
|---|---|---|
| MVP | Minimum Viable Product | Ubiquitous — defined nowhere explicitly |
| CET/CEST | Central European Time / Summer Time | `whatsapp-concierge-guidelines.md` |
| p95/p99 | 95th/99th percentile response time | `ai-runtime-orchestration.md` |
| DLQ | Dead Letter Queue | `event-driven-architecture.md` |
| OTP | One-Time Password | `partner-onboarding.md`, `security-model.md` |
| ADR | Average Daily Rate | `subscription-plans.md` |
| FIFO | First In First Out | `event-driven-architecture.md` |
| TTL | Time To Live | `knowledge-retrieval-model.md` |

**Recommended correction:** Add a parenthetical definition at first use in each document, or reference `document-glossary.md` for all acronyms. MVP should be defined explicitly in `docs/README.md` or a project glossary.

---

## LOW Findings

### L-01 — Inconsistent Section Numbering Styles

**Severity:** LOW
**Type:** Editorial — navigation consistency
**Affects:** `docs/ai-concierge/` directory (5 documents)

**Finding:** Documents in `ai-concierge/` use inconsistent heading structures. `ai-tone-guidelines.md` uses unnumbered sections with named headings. `escalation-rules.md` uses numbered sections with mixed notation (`§5`, `Step 1`, numbered lists). `emergency-procedures.md` uses structured numbered sections. `knowledge-retrieval-model.md` uses four-level deep nesting. `ai-knowledge-taxonomy.md` uses `CAT-XX` prefix codes.

**Recommended correction:** Not urgent. At next major revision of each document, standardise to: numbered top-level sections (`## 1.`, `## 2.`), numbered subsections (`### 1.1`), named categories within sections (e.g. `CAT-XX`, `TRIGGER-XX`). Do not refactor prematurely.

---

### L-02 — "Booking" Used in Some Documents Despite Rename to "Reservation"

**Severity:** LOW
**Type:** Naming — stale reference
**Affects:** `docs/ai-concierge/escalation-rules.md`, scattered references

**Finding:** `data-models.md` explicitly notes: "The former `Booking` model has been renamed `Reservation`." However, `escalation-rules.md` trigger TRIGGER-08 is titled "BOOKING_MODIFICATION_REQUEST." Several other documents retain "booking" in informal prose.

**Recommended correction:** Update `TRIGGER-08` in `escalation-rules.md` to `RESERVATION_MODIFICATION_REQUEST`. Update informal prose references to use "reservation" consistently. "Booking" is acceptable in guest-facing UX copy (guests say "my booking") but should not appear in technical model references.

**RESOLVED — 2026-05-29.** All model-layer renames complete across three sprints: `data-models.md` Review model `booking_id` → `reservation_id` (Data Models Cleanup Sprint); `dispute-resolution.md` DisputeRecord `booking_id` → `reservation_id` (L-02 Final Cleanup Sprint); `module-functionality-map.md` trigger list `BOOKING_MODIFICATION` → `RESERVATION_MODIFICATION` (L-02 Final Cleanup Sprint). TRIGGER-08 in `escalation-rules.md` retains `BOOKING_MODIFICATION_REQUEST` as intentional legacy terminology — founder decision, 2026-05-29; this is the only remaining Booking-form identifier and its retention is deliberate. "Booking" in guest-facing prose and the `booking_source` field on Reservation are acceptable per the original finding's own exception.

---

### L-03 — "Trust Score" and "Reliability Score" Referenced but Not Defined

**Severity:** LOW
**Type:** Architectural — incomplete definition
**Affects:** `docs/trust-safety/partner-vetting.md`

**Finding:** `partner-vetting.md` references a "trust score" and "reliability score" as part of ongoing partner monitoring, but neither is defined as a calculated metric anywhere in the documentation.

**Recommended correction:** Either define these scores in `partner-vetting.md` (formula, inputs, scale) or note explicitly that they are post-MVP features and remove references from MVP-scope documents.

**RESOLVED — 2026-05-29.** `docs/trust-safety/scoring-model.md` created. Trust Score and Reliability Score defined as manual MVP assessments (range 0–100; no automated calculation; no automated suspension without operator review). Source of truth in `document-glossary.md` updated to `scoring-model.md` for both entries.

---

### L-04 — "Concierge" vs "Concierge AI" vs "AI Concierge"

**Severity:** LOW
**Type:** Naming — capitalisation consistency
**Affects:** Multiple documents

**Finding:** Beyond the name variant issue in M-01, there is also capitalisation inconsistency. Some documents write "AI Concierge" (capitalised), others write "AI concierge" (lowercase), and one section writes "Concierge AI."

**Recommended correction:** Lowercase: "AI concierge" (not capitalised — it is a feature description, not a product name). Use this consistently.

**RESOLVED — 2026-05-29.** Investigation confirmed the inverted form "Concierge AI" is absent from all content files. All instances of "AI Concierge" capitalised appear in section headings or table headers (conventional markdown title-case formatting). Running prose uses "AI concierge" (lowercase). Canonical rule: "AI concierge" in prose; title-case in headings is acceptable. No file changes required.

---

### L-05 — Missing help-center Directory (Now Created)

**Severity:** LOW
**Type:** Structural — directory completeness
**Finding:** The `docs/help-center/` directory did not exist before this audit. `common-issue-playbooks.md` has been created as part of this audit. No other action needed.

**RESOLVED (noted at audit time).** `docs/help-center/common-issue-playbooks.md` created during this audit. Confirmed present and non-empty. No further action required.

---

### L-06 — "Nauxica Ops" vs "Nauxica Team" vs "Nauxica Support"

**Severity:** LOW
**Type:** Naming — internal clarity
**Affects:** Scattered references across multiple documents

**Finding:** The Nauxica operational function is referred to variously as "the Nauxica team," "Nauxica ops," "Nauxica support," and "the founder." At MVP these are all the same person. Post-MVP they will diverge.

**Recommended correction:** Use "Nauxica operator" (or "the operator" in context) for the human escalation and support function. "Nauxica team" is acceptable for general platform references. Add a note in `operator-runbook.md` §1.2 that all three terms converge to the founder at MVP.

**RESOLVED — 2026-05-29.** "Nauxica ops" replaced with "Nauxica Support" in all guest-facing AI script sections of `escalation-rules.md` (10 instances) and `emergency-procedures.md` (4 instances). "Nauxica support" (lowercase s) corrected to "Nauxica Support" in `escalation-rules.md` (2 instances). Terminology disambiguation paragraph added to `operator-runbook.md` §1.2. "Nauxica team" retained in homeowner/partner prose as acceptable informal usage at MVP. Technical field names `nauxica_ops_phone` and `nauxica_ops_whatsapp` unchanged.

---

### L-07 — Cross-Reference to Non-Existent Legal Docs

**Severity:** LOW (currently)
**Type:** Structural — missing files
**Affects:** Multiple onboarding and trust-safety documents

**Finding:** The following legal documents are referenced but are stubs or incomplete:
- `docs/legal/terms-of-service.md` — referenced from 8+ documents
- `docs/legal/partner-agreement.md` — referenced from 6+ documents
- `docs/legal/privacy-policy.md` — referenced from 5+ documents

These are noted as "legal review required" and expected to be incomplete at architecture phase. No immediate action — but flag that activation of the platform requires these to be legally reviewed and completed before any homeowner or partner accepts them.

**RESOLVED (partially) — 2026-05-29.** `legal-review-tracker.md` added to Related sections of `subscription-plans.md`, `partner-onboarding.md`, `partner-vetting.md`, and `dispute-resolution.md`. Legal stub documents (ToS, Partner Agreement, Privacy Policy) remain as stubs — their completion is tracked in `legal-review-tracker.md` under the relevant LR items. Full legal review required before platform activation.

---

## Referenced-but-Missing Files (Complete List)

| File | Referenced by | Status |
|---|---|---|
| `docs/architecture/partner-profile-guide.md` | Referenced implicitly by partner-vetting | Missing |
| `docs/legal/legal-review-tracker.md` | Recommended by this audit | Created — 35 items, LR-01 through LR-35 |

*Note: Six agent-ops files previously listed as Missing (`phase-control-log.md`, `pre-approval-template.md`, `testing-checklist.md`, `handoff-report-template.md`, `docs-agent-scope.md`, `backend-agent-scope.md`) have been created and are complete. Confirmed by `docs/agent-ops/agent-ops-audit.md` (M-06 Resolution Sprint, 2026-05-29).*

---

## Immutable Source-of-Truth Documents

The following documents should be treated as authoritative on their subject. Other documents referencing the same subject should defer to these and not re-state the rules.

| Document | Authoritative on |
|---|---|
| `docs/architecture/data-visibility-model.md` | Visibility scope taxonomy |
| `docs/ai-concierge/whatsapp-session-anchor.md` | Session phase values and access code delivery gates |
| `docs/operations/service-request-flow.md` | ServiceRequest / PartnerRequest lifecycle and state machine |
| `docs/architecture/partner-assignment-model.md` | Assignment lifecycle and service type taxonomy |
| `docs/ai-concierge/escalation-rules.md` | Escalation trigger taxonomy and SLA levels |
| `docs/ai-concierge/emergency-procedures.md` | Emergency response rules and Italian emergency numbers |
| `docs/backend/data-models.md` | Canonical field names and types for all models |
| `docs/legal/regulatory-compliance-checklist.md` | Italian regulatory obligations and legal flags |

---

## Related Documents

- [document-glossary.md](document-glossary.md) — Canonical term definitions for all major platform concepts
- [cross-reference-map.md](cross-reference-map.md) — Map of document dependencies and update rules
