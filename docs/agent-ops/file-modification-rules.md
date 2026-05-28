# File Modification Rules

**Version:** 1.0
**Applies to:** All Claude Code agents working on the Nauxica project
**Prerequisite:** Read [claude-code-master-rules.md](claude-code-master-rules.md) first
**Last updated:** 2026-05-28

---

## Purpose

This document specifies the rules for every file operation: what is allowed to be modified, when to create new files, when to update existing ones, and when to stop.

---

## Allowed Modifications

### Always allowed (with approval)
- Any HTML page listed in [frontend-agent-scope.md](frontend-agent-scope.md)
- Any file in `docs/` that is not an agent-ops governance file
- `style.css` — with explicit individual approval
- `nauxica-shared.js` — with explicit individual approval
- `nauxica-demo-data.js` — with explicit individual approval

### Always allowed (no approval needed, read-only)
- Reading any file for context
- Reading `PROJECT_RULES.md`
- Reading architecture documents in `docs/`
- Reading the source of truth files listed in the master rules

### Forbidden — no approval can override these
- Creating backend code (server-side scripts, SQL, API implementations)
- Modifying `PROJECT_RULES.md` unless explicitly instructed in the task and the task explicitly names this file
- Deleting any file
- Renaming any file
- Moving any file to a different directory
- Adding external libraries, CDN links (for new libraries), or package files
- Creating duplicate HTML pages for shared-page patterns (e.g. `messages-homeowner.html`)

---

## Modifying Existing Files

### Before modifying any file

1. **Read it.** Use the Read tool. Do not rely on memory.
2. **Identify the minimum change.** Make the smallest change that achieves the task. Do not edit surrounding areas.
3. **Identify the impact.** What does this file connect to? What imports it? What data does it depend on?
4. **File a pre-approval request** covering this specific file.

### During modification

- Edit only the section described in your pre-approval
- Do not reformat code you are not changing (no whitespace cleanup, no comment reformatting)
- Do not rename variables or functions that are not part of the task
- Do not move code blocks to different locations unless the task requires it
- Preserve all existing comments unless the task explicitly asks you to remove them

### Verification after modification

After editing any file, verify:
- The file is syntactically valid (no unclosed HTML tags, no broken JavaScript, no orphaned Markdown headers)
- The file's existing functionality still works (to the extent verifiable without running a full test)
- The change matches what was described in your pre-approval

---

## Sensitive File Rules

These files have additional restrictions beyond the standard modification rules.

### `nauxica-demo-data.js`

| Allowed | Forbidden |
|---|---|
| Adding new data entries to existing arrays | Renaming localStorage keys |
| Adding new fields to existing objects (if backwards-compatible) | Changing the shape of existing objects |
| Adding new top-level state keys (with explicit approval) | Removing any existing data property |
| Updating demo values | Adding a `loadState()` call that resets user state |

**Backwards-compatible addition:** Adding a new field to an existing object is backwards-compatible if existing code that reads the object still works when the new field is absent or when it has its initial value. Adding a required field that existing read operations do not handle is not backwards-compatible.

### `nauxica-shared.js`

| Allowed | Forbidden |
|---|---|
| Adding new helper functions | Removing or renaming existing functions |
| Extending existing helpers with optional parameters | Changing the signature of any function called from other pages |
| Adding new shared UI components | Adding page-specific logic |

**Before editing:** Run a search for all call sites of any function you are modifying. Every call site must still work after your change.

### `style.css`

| Allowed | Forbidden |
|---|---|
| Adding new rule blocks for new components | Removing existing rule blocks |
| Extending existing classes with new states/variants | Renaming existing CSS classes |
| Adding rules that use existing CSS custom properties | Introducing new CSS custom property names |
| Using `!important` with documented justification | Adding `@import` for new external stylesheets |

**Before editing:** Search the file for an existing class that already does what you need. If one exists, use it instead of creating a new one.

### `PROJECT_RULES.md`

This file may only be modified when:
1. The task instruction explicitly says "modify PROJECT_RULES.md"
2. The task instruction explicitly names the specific change to be made
3. A pre-approval request covering this file has been approved

Do not modify `PROJECT_RULES.md` to add rules that make your current task easier. That is a circular workaround.

---

## Creating New Files

### When to create a new file

Create a new file when:
- The task explicitly asks for a new file
- A new documentation document is needed that has no reasonable home in an existing file
- A new HTML page is required for a feature that has no existing page

### When NOT to create a new file

Do not create a new file when:
- The content could be added as a section to an existing file
- You are creating a page-variant for a shared page (e.g. `calendar-homeowner.html`)
- You are creating a utility or helper that could live in `nauxica-shared.js`
- You want to separate "old" and "new" versions of a file (do not keep both — edit in place)

### Rules for new HTML pages

Before creating a new HTML page:
1. Check whether an existing shared page could be extended to cover the use case
2. Confirm the page follows the master layout from `dashboard-homeowner.html`
3. Confirm it uses the existing CSS classes and component structure
4. Confirm it will be added to the relevant sidebar nav and linked from the dashboard

### Rules for new documentation files

Before creating a new document:
1. Confirm the directory is correct (see [docs-agent-scope.md](docs-agent-scope.md))
2. Confirm the naming convention is correct (`kebab-case.md`)
3. Confirm no existing document already covers the content
4. Fill the document header completely before adding body content

---

## When to Stop

Stop immediately — do not continue — if any of the following are true:

**Scope creep discovered:**
You have found that completing the task as described requires modifying a file not in your approved list. → Stop. Report. Request approval for the additional file.

**Conflict with master rules:**
You are about to do something that violates a rule in `claude-code-master-rules.md`. → Stop. Report the conflict. Do not proceed.

**Conflict with existing code:**
The change you are about to make will break something that currently works, and fixing it would require going out of scope. → Stop. Report the conflict and the options.

**Inconsistency discovered:**
You have found that the file's current state is inconsistent with the task description (e.g. the code has already been changed, or the bug described in the task is not present). → Stop. Report what you found.

**Irreversible action:**
You are about to take an action that cannot be undone (deleting content, overwriting a file wholesale). → Stop. Confirm explicitly before proceeding.

**You are guessing:**
You are not sure whether the change you are about to make is correct. → Stop. Ask. Do not proceed on an assumption.

---

## When to Ask

Ask (rather than proceeding with your best guess) when:

- The task description is ambiguous about which file to modify
- Two documents or files contradict each other on a point that affects your task
- A file you need to read is missing or not found
- The change you need to make would require touching a sensitive file in a way not described in the task
- You have found a bug or inconsistency that is related to your task but not part of it — and fixing it would change your scope

**Asking is not a failure.** A question that prevents a wrong change is more valuable than a wrong change made quickly.

---

## File Operation Decision Tree

```
I need to modify or create a file
    │
    ├── Is it in the forbidden list?
    │       YES → Do not proceed. Report.
    │       NO ↓
    │
    ├── Have I read the current version of the file?
    │       NO → Read it first
    │       YES ↓
    │
    ├── Is it a sensitive file (nauxica-demo-data.js, nauxica-shared.js, style.css, PROJECT_RULES.md)?
    │       YES → Ensure it is explicitly named in the pre-approval. Check additional rules above.
    │       NO ↓
    │
    ├── Is the modification within my approved scope?
    │       NO → Stop. File a new pre-approval for the additional change.
    │       YES ↓
    │
    ├── Is the change the minimum required to achieve the task?
    │       NO → Reduce scope. Remove anything that is not directly required.
    │       YES ↓
    │
    ├── After the change, does the file remain syntactically valid?
    │       NO → Fix before proceeding to the next file.
    │       YES ↓
    │
    └── Proceed. Record in handoff report.
```
