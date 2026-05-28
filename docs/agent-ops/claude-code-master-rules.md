# Claude Code Master Rules

**Version:** 1.0
**Applies to:** All Claude Code agents working on the Nauxica project
**Authority:** These rules supersede agent-level preferences. They cannot be overridden by task instructions unless this document is explicitly updated.
**Last updated:** 2026-05-28

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
- Do not create new data flow patterns not present in `nauxica-demo-data.js`
- Do not invent new localStorage key names or structures
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

---

## Rule 7 — Scope Boundary Awareness

Know which agent scope applies to your task and stay within it.

| Task type | Scope document to read |
|---|---|
| HTML, CSS, JavaScript | [frontend-agent-scope.md](frontend-agent-scope.md) |
| Backend design, API, database | [backend-agent-scope.md](backend-agent-scope.md) |
| Documentation in `docs/` | [docs-agent-scope.md](docs-agent-scope.md) |

Do not cross scope boundaries. A frontend agent must not edit architecture documents. A docs agent must not edit HTML files.

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
| Visual design and layout | `dashboard-homeowner.html` |
| Project rules and conventions | `PROJECT_RULES.md` |
| Shared data structure | `nauxica-demo-data.js` |
| Shared UI components and nav | `nauxica-shared.js` |
| CSS classes and design tokens | `style.css` |
| Data model architecture | `docs/backend/data-models.md` |
| AI concierge behaviour | `docs/ai-concierge/knowledge-retrieval-model.md` |
| Data visibility scoping | `docs/architecture/data-visibility-model.md` |
| Security boundaries | `docs/architecture/security-model.md` |
| Agent governance | `docs/agent-ops/claude-code-master-rules.md` (this file) |

---

## Rule 14 — Escalate, Don't Guess

When the answer to a question that affects your work is unknown:
- Do not guess
- Do not make the most plausible assumption and proceed
- Ask the question explicitly and wait for an answer

A wrong assumption that propagates through a codebase is harder to fix than a delay.

---

## Quick Reference — Before Any Task

```
1. Read this file (done — you're reading it)
2. Read the scope document for your task type
3. Read the relevant files you will touch
4. Fill out the pre-approval template
5. Wait for approval
6. Execute only what was approved
7. Run the testing checklist
8. File your handoff report
```
