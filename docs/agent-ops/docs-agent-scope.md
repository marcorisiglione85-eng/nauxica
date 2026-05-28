# Docs Agent Scope

**Version:** 1.0
**Applies to:** Claude Code agents creating or updating documentation in `docs/`
**Prerequisite:** Read [claude-code-master-rules.md](claude-code-master-rules.md) first
**Last updated:** 2026-05-28

---

## What Docs Agents Do

Docs agents create and maintain the architecture, operational, and governance documentation that lives in `docs/`. Their work is not product content — it is the implementation contract, operational playbook, and architectural record of the platform.

Docs agents do not touch code. A docs agent that edits an HTML, CSS, or JavaScript file is out of scope.

---

## Files a Docs Agent May Modify

Any file in the `docs/` directory, subject to the rules below.

**Files a docs agent must NOT modify:**
- `PROJECT_RULES.md` — this is project governance, not documentation
- Any HTML, CSS, or JavaScript file
- `nauxica-demo-data.js`
- `nauxica-shared.js`

---

## Directory Structure

Understand the existing directory structure before creating any new file. New documents must be placed in the correct folder.

```
docs/
├── agent-ops/          ← Agent governance (this folder)
├── ai-concierge/       ← AI concierge behaviour, knowledge, guidelines
├── ai-runtime/         ← AI runtime orchestration
├── api/                ← API overview and endpoint docs
├── architecture/       ← Platform architecture (data model, events, security, etc.)
├── backend/            ← Backend design (data models, auth, migrations)
├── brand/              ← Brand guidelines, tone of voice
├── faq/                ← FAQ content for guests, homeowners, partners
├── legal/              ← Terms, privacy, compliance, partner agreement
├── onboarding/
│   ├── homeowner/      ← Homeowner onboarding
│   ├── partner/        ← Partner onboarding
│   └── guest/          ← Guest welcome
├── operations/
│   ├── homeowner/      ← Homeowner operational lifecycle
│   └── partner/        ← Partner operational lifecycle
│   (+ service-request-flow.md, operator-runbook.md at root)
├── property-intake/    ← Property data schema, intake checklist, knowledge base template
└── trust-safety/       ← Dispute resolution, partner vetting, guest safety
```

**Before creating a new file:**
1. Confirm no existing document covers the same topic
2. Identify the correct directory for the new file
3. Check that the file name follows the naming convention (see below)
4. Include it in your pre-approval request

---

## Naming Conventions

All documentation files use `kebab-case.md`.

**File name format:**
```
[topic-description].md

Examples:
  homeowner-onboarding.md       ✓
  service-request-flow.md       ✓
  AIRuntime.md                  ✗  (wrong case)
  service_request_flow.md       ✗  (underscores)
  HomeownerOnboarding.md        ✗  (PascalCase)
```

**Be specific in the file name.** A file called `architecture.md` is too vague. A file called `event-driven-architecture.md` is correct.

---

## Document Header Standard

Every documentation file must open with a metadata block:

```markdown
# [Document Title]

**Version:** 1.0
**Status:** [Draft — Architecture phase | Complete — Architecture phase | Active]
**Scope:** [Sicily launch · Audience description]
**Last updated:** [YYYY-MM-DD]
**Related:** [doc1.md](relative-path) · [doc2.md](relative-path)
```

Every document must have a **Purpose** or **Overview** section immediately after the header.

---

## Document Version and Status

**Version numbering:**
- Start at `1.0`
- Increment the minor version (1.1, 1.2) for content additions that don't change the fundamental structure
- Increment the major version (2.0) for structural rewrites or fundamental changes

**Status values:**
- `Draft — Architecture phase` — initial creation, not yet complete
- `Complete — Architecture phase` — fully developed, pre-backend
- `Active` — in use by a live system (post-backend phase only)
- `Deprecated` — superseded by another document; retain but do not update

When updating an existing document: increment the version number and update `Last updated`.

---

## Avoiding Duplicate Architecture

Before writing any new architectural content, search for it in existing documents.

**Required checks before creating a new document:**
1. Search for the topic across existing docs using grep or search
2. If a document partially covers the topic: extend it rather than creating a new one
3. If a document fully covers the topic: do not create a duplicate — link to the existing document instead
4. If the topic is new but related to an existing document: add a section to the existing document first, only creating a new file if the addition would make the document unwieldy (> ~600 lines)

**Specific duplication risks to watch:**
- Data model fields: always defined in `docs/backend/data-models.md` — do not redefine model fields in operational docs
- Visibility scope rules: always defined in `docs/architecture/data-visibility-model.md` — other docs reference it, do not re-specify scope rules
- Escalation triggers: always defined in `docs/ai-concierge/escalation-rules.md`
- Emergency procedures: always defined in `docs/ai-concierge/emergency-procedures.md`
- Security boundaries: always defined in `docs/architecture/security-model.md`
- Event definitions: always defined in `docs/architecture/event-driven-architecture.md`

---

## Cross-Reference Rules

When a document references content in another document, use a relative Markdown link:

```markdown
See [escalation-rules.md](../ai-concierge/escalation-rules.md) for full trigger definitions.
```

**Cross-reference rules:**
- Use relative paths from the current file's location
- Include the file name and a brief description of what is being referenced
- When adding a new document that is referenced by existing documents: update the existing documents' Related section to include the new file
- When updating a document that is referenced by others: ensure the section heading or content you are changing is not linked directly by other documents; if it is, check whether the link still works

---

## Legal Review Required Marking

Any section containing legal or regulatory content must be marked:

```markdown
> ⚠️ **Legal review required:** [Brief description of the legal/regulatory issue]
```

**Topics that always require this marking:**
- GDPR and Italian data protection law (D.Lgs. 196/2003)
- CIR/CIN registration requirements
- Tourist tax (tassa di soggiorno) obligations
- Alloggiati Web registration
- Partner background check processes
- Insurance minimum coverage amounts
- Criminal record check permissibility
- Tourism guide licence requirements
- Anti-discrimination law (rejection criteria)
- Data retention schedules
- Consent and data processing agreements

Do not remove existing legal review markers. If legal review has been completed on a section, add a note: `Legal review completed: [date]`.

---

## Architecture Consistency Rules

Architecture documents are an integrated system. Changes in one document can break consistency with others.

**Before finalising any architecture document change:**
1. Identify which other documents reference the content you are changing
2. Verify the change is consistent with those documents
3. Update cross-references if needed
4. List any documents that may need updating as part of your handoff report

**Key consistency dependencies:**
- Data model changes (data-models.md) → must be consistent with property-data-schema.md, property-knowledge-schema.md, knowledge-retrieval-model.md
- Escalation rule changes (escalation-rules.md) → must be consistent with ai-runtime-orchestration.md, operator-runbook.md
- Event changes (event-driven-architecture.md) → must be consistent with service-request-flow.md, notification-system.md, ai-runtime-orchestration.md
- Security model changes (security-model.md) → must be consistent with data-visibility-model.md, ai-runtime-orchestration.md, partner-assignment-model.md

---

## Document Completeness Standard

A document is considered complete when:
- All sections defined in the document's initial outline are populated
- No section contains placeholder text like "TBD", "TODO", or "fill in later"
- All cross-references link to files that exist
- All required legal review markers are present
- The metadata block is complete (version, status, last updated, related)
- Status is set to `Complete — Architecture phase`

A document with status `Draft — Architecture phase` is not complete. Do not reference it as authoritative.

---

## Agent-Ops Documents (This Folder)

Documents in `docs/agent-ops/` govern agent behaviour. They have a special status:

- They apply to all agents, including docs agents
- A docs agent may update agent-ops documents if explicitly tasked
- A docs agent may NOT unilaterally modify rules in agent-ops documents to make their work easier
- Any change to a rule in `claude-code-master-rules.md` must be explicitly requested by the human operator

---

## Docs Agent Quick Reference

```
BEFORE CREATING A NEW DOC:
✓ Search for existing coverage of the topic
✓ Identify the correct directory
✓ Confirm the naming convention
✓ Pre-approval required

WHILE WRITING:
✓ Use the document header standard
✓ Mark all legal/compliance sections
✓ Use relative links for cross-references
✓ Do not re-define content from other documents — reference them

AFTER WRITING:
✓ Check all links resolve to existing files
✓ Check for duplication with existing docs
✓ Update Related sections in connected docs
✓ File handoff report
```
