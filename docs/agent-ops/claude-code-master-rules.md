# Claude Code Master Rules

**Version:** 2.0
**Applies to:** All Claude Code agents working on the Nauxica project
**Authority:** These rules supersede agent-level preferences. They cannot be overridden by task instructions unless this document is explicitly updated.
**Last updated:** 2026-08-10

---

## What This Document Is

These are the universal operating rules for every Claude Code agent working on this project, regardless of specialisation (frontend, backend, docs, or other).

Read this document before reading any task instruction. If a task instruction conflicts with a rule here, follow the rule and flag the conflict.

---

## Rule 1 — Approval First, Always

**Before touching any file, you must provide a pre-approval summary and wait.**

Use the template in [pre-approval-template.md](pre-approval-template.md). Fill every field. Do not abbreviate.

Approval is required even for:
- Single-line changes
- Changes that "obviously" improve something
- Changes explicitly described in the task
- Fixes to something that is clearly broken

The only exception is a task that explicitly says "no approval needed, execute directly." That phrase must appear in the task. Your own judgment that a change is safe does not substitute for approval.

---

## Rule 2 — Read Before Write

Before editing any file, read the current version of that file in full (or the relevant section for large files). Do not rely on memory from earlier in the conversation. Use the Read tool.

**Why:** Files change between sessions. Code that looked safe to modify in a previous session may have been updated. A write without a read is a blind write.

Specifically:
- Read the target file before editing it
- Read files you are creating dependencies on (shared files, templates, data sources)
- If a file you need to read has already been read in this session, re-read it if more than 20 messages have passed

---

## Rule 3 — File Scope Discipline

**Only touch files listed in your approved pre-approval summary.**

If you discover during execution that you need to modify a file not in your approved list:
1. Stop
2. Report what you found
3. File a new pre-approval request for the additional file
4. Wait for approval before proceeding

Do not expand scope mid-task. Do not touch "nearby" files that seem related. If a file is not on the list, it is out of scope.

**Files that require explicit individual approval, regardless of task scope:**
- `PROJECT_RULES.md`
- `nauxica-demo-data.js`
- `nauxica-shared.js`
- `style.css`
- Any file not previously read in this session

---

## Rule 4 — No Speculative Refactors

Do not refactor code that is not directly required by the task.

If you notice:
- Duplicate code that could be consolidated
- A naming inconsistency
- A CSS class that could be cleaner
- JavaScript that could be restructured

→ Note it in your handoff report. Do not change it unless the task specifically asks for it.

**The rule:** Leave working code working. Change only what the task requires.

---

## Rule 5 — No Architecture Invention

Do not introduce new architectural patterns, structures, or systems that are not present in the codebase or the architecture documents in `docs/`.

Specifically:
- Do not add frameworks (no React, Vue, Alpine, Tailwind, etc.)
- Do not introduce module systems or bundlers
- Do not create new production data flow patterns outside the established Supabase architecture (Supabase Auth, database queries via the Supabase JS client, Edge Functions, Storage). Legacy demo dependencies (`nauxica-demo-data.js`, `localStorage`) may remain on pages that still use them but must not be extended into new production flows without explicit approval.
- Do not create new CSS systems or naming conventions not already in `style.css`
- Do not propose backend structures that contradict the architecture docs in `docs/backend/`, `docs/architecture/`, or `docs/ai-concierge/`

If the task requires something that needs a new pattern, stop and ask.

---

## Rule 6 — Phase Discipline

Before starting work, confirm which phase the task belongs to and whether that phase is approved.

Check [phase-control-log.md](phase-control-log.md) for the current phase status.

Do not work on a phase that is:
- Marked as blocked
- Not yet started
- Dependent on an incomplete prior phase

If the task's phase is unclear, ask before proceeding.

**Reconciliation clause:** `phase-control-log.md` may not reflect the current state of the platform. If phase records appear inconsistent with the current repository state, git history, or architecture documentation, do not treat stale phase records as authoritative. Reconcile against: (1) current architecture documents in `docs/architecture/`, (2) `git log`, and (3) the human operator. Flag the inconsistency and ask before proceeding.

---

## Rule 7 — Scope Boundary Awareness

Know which agent scope applies to your task and stay within it.

| Task type / role | Scope document to read |
|---|---|
| HTML, CSS, JavaScript | [frontend-agent-scope.md](frontend-agent-scope.md) |
| Backend design, API, database | [backend-agent-scope.md](backend-agent-scope.md) |
| Documentation in `docs/` | [docs-agent-scope.md](docs-agent-scope.md) |
| Architecture planning, sprint design | Architect role — `docs/agent-ops/` (definition to be created) |
| Sprint execution (approved file list only) | Implementer role — `docs/agent-ops/` (definition to be created) |
| Output review | Reviewer role — `docs/agent-ops/` (definition to be created) |
| Migrations, RLS, Auth triggers, Edge Functions, Storage policies | Security/Supabase role — `docs/agent-ops/` (definition to be created) |

Do not cross scope boundaries. A frontend agent must not edit architecture documents. A docs agent must not edit HTML files. An Architect must not edit any implementation file. A Reviewer must not silently fix its own findings.

---

## Rule 8 — Testing Expectations

After any edit, run the verification checks in [testing-checklist.md](testing-checklist.md) that apply to your task type. Report the results in your handoff report.

You cannot mark a task complete without completing the applicable checklist. "I believe it works" without checklist evidence is not acceptable.

For frontend tasks: all checklist items in the Frontend section must pass.
For documentation tasks: all checklist items in the Documentation section must pass.

---

## Rule 9 — Handoff Expectations

At the end of every task — including tasks interrupted by a blocker — produce a handoff report using the template in [handoff-report-template.md](handoff-report-template.md).

A handoff report is required even if the task was not completed. An incomplete handoff report is a failure state — it leaves the next agent with no context.

---

## Rule 10 — When to Stop

Stop immediately and report if any of the following are true:

- You have discovered that completing the task requires touching a file not in your approved list
- You have found that the task as described is inconsistent with the codebase state
- You have found a conflict between the task instruction and a rule in this document
- You are about to make a change you cannot reverse
- You are unsure whether a change is safe
- You have encountered an error you cannot resolve without additional information

**Stopping is not failure.** Stopping with a clear report is the correct response to uncertainty. Continuing through uncertainty is the failure mode.

---

## Rule 11 — No Silent Changes

Every change must be traceable. Do not make changes that are not described in your pre-approval summary or handoff report.

If you make an additional change during execution (even a small one, even a typo fix), declare it in the handoff report under "additional changes made."

---

## Rule 12 — Preserve Working State

Never break something that is currently working in order to make something else work.

If a task requires breaking an existing feature to implement a new one:
1. Stop
2. Describe the conflict
3. Ask how to proceed

"The old feature was buggy anyway" is not a valid justification. Leave the working state intact unless explicitly told otherwise.

---

## Rule 13 — Master Reference Files

The following files are the authoritative source of truth for their domain. When in doubt, defer to them:

| Domain | Source of truth |
|---|---|
| Execution entry point (auto-loaded by Claude Code) | `CLAUDE.md` (repository root) |
| Universal agent governance | `docs/agent-ops/claude-code-master-rules.md` (this file) |
| Architecture and product decisions | `docs/architecture/` |
| Backend implementation references | `docs/backend/` |
| Database evolution | `supabase/migrations/` — applied in chronological order |
| Security architecture | `docs/architecture/security-model.md` |
| Data visibility scoping | `docs/architecture/data-visibility-model.md` |
| Data model architecture | `docs/backend/data-models.md` |
| AI concierge behaviour | `docs/ai-concierge/knowledge-retrieval-model.md` |
| Visual design and layout | `dashboard-homeowner.html` |
| Shared UI components and nav | `nauxica-shared.js` |
| CSS classes and design tokens | `style.css` |
| Legacy frontend conventions | `PROJECT_RULES.md` — frontend layout reference only; governance sections are deprecated |
| Application data (production) | Supabase database — queried via the Supabase JS client or Edge Functions |
| Session continuity | Memory system — non-authoritative for architecture or schema |

---

## Rule 14 — Escalate, Don't Guess

When the answer to a question that affects your work is unknown:
- Do not guess
- Do not make the most plausible assumption and proceed
- Ask the question explicitly and wait for an answer

A wrong assumption that propagates through a codebase is harder to fix than a delay.

---

## Rule 15 — Database and Migration Safety

The Nauxica database is a live production system. Mistakes here cannot be undone by reverting a file.

- **Never modify a migration that has already been applied to production.** Applied migrations are immutable. If a migration contains an error, write a new corrective migration.
- **Schema changes require a new migration file** in `supabase/migrations/`. Never apply schema changes directly in the SQL Editor without a corresponding migration file in the repository.
- **The following require Security/Supabase review before being applied to production:**
  - Auth triggers (`handle_new_user` or any function on `auth.users`)
  - RLS policy additions, removals, or modifications
  - SECURITY DEFINER function additions or changes
  - Storage bucket policy changes
  - Database triggers on any table
- **`service_role` credentials must never appear in browser-facing code.** They bypass RLS entirely. They belong only in Edge Functions and server-side administrative tooling.
- **RLS must not be bypassed from frontend JavaScript.** Authorization enforcement belongs at the database (RLS) or Edge Function layer, not in client-side conditional logic.

---

## Rule 16 — Deployment and Git Authority

These operations affect shared production systems. They require explicit human instruction per occurrence. A general instruction ("you may push when ready") does not constitute per-operation approval.

- No `git add` / `git commit` / `git push` without explicit human instruction
- No `supabase db push` without explicit human instruction
- No `supabase functions deploy` without explicit human instruction
- No destructive production SQL (`DELETE`, `DROP`, `TRUNCATE` against production data) without explicit human instruction per operation

**Stopping point before each of these is mandatory.** Do not chain them. Do not assume approval from a previous deployment carries forward.

---

## Rule 17 — Agent Workflow

Four roles operate in this project. Each has a defined permission boundary.

| Role | May read files | May edit files | May commit / push / deploy |
|---|---|---|---|
| **Architect** | Yes — all files | No | No |
| **Implementer** | Yes — all files | Yes — approved sprint list only | No |
| **Reviewer** | Yes — all files | No | No |
| **Security/Supabase** | Yes — migrations, Edge Functions, architecture docs | No | No |

**Workflow sequence:**

```
Architect (read-only: produces sprint plan)
  → Human approval (required before implementation begins)
  → Implementer (edits approved files only)
  → Reviewer (read-only: produces findings report)
  → Security/Supabase review (when applicable — migrations, RLS, Auth, Edge Functions)
  → Human deployment (supabase db push / supabase functions deploy)
  → Human commit / push
```

No stage advances automatically. The human controls every transition between stages.

Agent role definitions (permitted actions, output templates, handoff rules) will be documented in `docs/agent-ops/` in a later sprint. Until those files exist, use the role boundary table above as the authority.

---

## Quick Reference — Before Any Task

```
1. Read CLAUDE.md (auto-loaded — confirms you are on the Nauxica project)
2. Read this file (done — you're reading it)
3. Read the scope document for your role / task type (Rule 7)
4. Read the relevant files you will touch (Rule 2)
5. Fill out the pre-approval template
6. Wait for approval (Rule 1)
7. Execute only what was approved (Rules 3, 15, 16, 17)
8. Run the testing checklist (Rule 8)
9. File your handoff report (Rule 9)
```
