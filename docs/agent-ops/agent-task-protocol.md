# Agent Task Protocol

**Version:** 1.0
**Applies to:** All Claude Code agents working on the Nauxica project
**Prerequisite:** Read [claude-code-master-rules.md](claude-code-master-rules.md) first
**Last updated:** 2026-05-28

---

## Purpose

This document defines the exact sequence every agent follows when receiving and executing a task. It is a process spec, not a suggestion. Follow each step in order.

---

## Step 1 — Receive the Task

Read the task instruction in full before doing anything else. Do not begin analysis during reading. Finish reading first.

After reading, identify:

**A. Task type**
- Frontend (HTML/CSS/JS changes)
- Documentation (changes to `docs/`)
- Backend design (architecture work — no code yet)
- Mixed (requires both frontend and documentation changes)

**B. Phase**
- Which phase does this task belong to?
- Check [phase-control-log.md](phase-control-log.md)
- Is the phase currently open? If not: stop and report.

**C. Explicit vs implied scope**
- What does the task explicitly ask for?
- What does the task imply but not explicitly state?
- Do the implied items require approval separately?

---

## Step 2 — Scope Analysis

Do not touch any files yet. Analyse only.

**2.1 Read the master rules**
Confirm you have read [claude-code-master-rules.md](claude-code-master-rules.md) this session.

**2.2 Read the scope document for your task type**
- Frontend task → read [frontend-agent-scope.md](frontend-agent-scope.md)
- Documentation task → read [docs-agent-scope.md](docs-agent-scope.md)
- Backend design → read [backend-agent-scope.md](backend-agent-scope.md)

**2.3 Identify every file the task requires you to touch**

List them explicitly. Include:
- Files to be modified
- Files to be created (if any)
- Files to be read for context (these do not require approval, but note them)
- Shared files that may be affected indirectly

**2.4 Flag sensitive files**

Check whether any file on your list is a sensitive file requiring explicit individual approval:
- `PROJECT_RULES.md` — requires explicit named approval
- `nauxica-demo-data.js` — requires explicit named approval
- `nauxica-shared.js` — requires explicit named approval
- `style.css` — requires explicit named approval
- Any architecture document in `docs/` — requires explicit named approval

**2.5 Identify risks**

For each file you plan to modify:
- What existing functionality could break?
- What does this file connect to?
- Is there a shared component or import that depends on it?

---

## Step 3 — Read the Files

Read every file you plan to modify before writing the pre-approval request.

**Why read before writing the pre-approval:** You cannot accurately describe what you will change without seeing the current state. A pre-approval based on assumption is incomplete.

For large files, read at minimum:
- The full section you plan to modify
- The imports or dependencies at the top of the file
- Any shared variables or functions referenced in your target section

---

## Step 4 — Request Pre-Approval

Fill out the pre-approval template from [pre-approval-template.md](pre-approval-template.md) completely.

Every field is required. Do not submit a partial template.

**The pre-approval request must include:**
- Task ID or description (from the task you received)
- Exact list of files to be modified (file paths, not descriptions)
- For each file: what specifically will change (section, function, element)
- Rationale: why this change is needed
- Risk assessment: what could break
- Test plan: which checklist items you will run after
- Explicit statement of what you will NOT do

Submit the completed template and **stop**. Wait for explicit approval before proceeding to Step 5.

---

## Step 5 — Execute (After Approval)

You have explicit approval. Execute only what was approved.

**Execution rules:**
- Change only the files listed in your approved pre-approval
- Change only the sections described in your approved pre-approval
- If you discover during execution that you need to change something not in the approved list: stop, report, request approval for the addition
- Do not make "while I'm here" improvements
- Do not fix things that are not broken
- Do not refactor surrounding code

**Execution sequence for frontend tasks:**
1. Make the change
2. Verify the file is syntactically valid (no unclosed tags, no broken JS syntax)
3. Cross-check against `dashboard-homeowner.html` for visual consistency (if layout change)
4. Cross-check against `nauxica-demo-data.js` for any data dependencies (if data change)
5. Cross-check against `nauxica-shared.js` for any shared component conflicts

**Execution sequence for documentation tasks:**
1. Write or update the document
2. Verify all internal links are accurate
3. Verify cross-references to other documents are correct
4. Check that any legal/compliance notes are marked `⚠️ Legal review required`

---

## Step 6 — Run the Testing Checklist

Open [testing-checklist.md](testing-checklist.md) and run every applicable item for your task type.

Record each result: Pass / Fail / Not applicable.

If any item fails:
- Fix the failure if it is within the scope of your approved change
- If fixing the failure requires touching a file not in your approved list: stop and report

Do not proceed to Step 7 until all applicable checklist items pass.

---

## Step 7 — File the Handoff Report

Fill out the handoff report template from [handoff-report-template.md](handoff-report-template.md) completely.

Every field is required. Do not submit a partial report.

**The handoff report must include:**
- All files changed (with line ranges or sections modified)
- Summary of each change made
- Testing checklist results
- Any additional changes made that were not in the original pre-approval
- Known risks or regressions to watch
- Open questions or blockers discovered during execution
- Recommended next step

Submit the handoff report and stop. Your task is complete.

---

## Step 8 — Stop

After filing the handoff report, your task is complete. Do not:
- Make additional changes "just to round things off"
- Fix something you noticed while writing the report
- Start the next task without receiving a new task instruction

Wait for the next task instruction.

---

## Interruption Protocol

If you must stop before completing a task (blocked, interrupted, scope exceeds approval), follow this sequence:

1. Do not leave files in a partially edited state. If you have started editing a file:
   - Either complete the edit to a valid, working state
   - Or revert the edit entirely
   - Never leave a broken file
2. File an interrupted handoff report using the handoff template, marking status as `INTERRUPTED`
3. Document: what you completed, what you did not complete, what the blocker was
4. The next agent can resume from the interrupted handoff report

---

## Decision Tree — When Uncertain

```
Task received
    │
    ├── Is the task type clear?
    │       NO → Ask before proceeding
    │       YES ↓
    │
    ├── Is the phase open?
    │       NO → Stop and report
    │       YES ↓
    │
    ├── Are all files I need to touch within my scope?
    │       NO → Report conflict, ask how to proceed
    │       YES ↓
    │
    ├── Have I read all files I plan to modify?
    │       NO → Read them now
    │       YES ↓
    │
    ├── Have I filed a pre-approval and received approval?
    │       NO → File pre-approval and wait
    │       YES ↓
    │
    ├── During execution: is everything within my approved scope?
    │       NO → Stop, report, request expanded approval
    │       YES ↓
    │
    ├── Do all testing checklist items pass?
    │       NO → Fix failures within scope; report out-of-scope failures
    │       YES ↓
    │
    └── File handoff report and stop
```
