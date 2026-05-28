# Handoff Report Template

**Version:** 1.0
**Applies to:** All Claude Code agents — filed at end of every task
**Last updated:** 2026-05-28

---

## How to Use This Template

Copy the template below and fill in every field at the end of your task.

A handoff report is required even if:
- The task was not completed
- You were blocked and stopped early
- The task was a single-line change
- You think the next agent will figure it out

Do not skip fields. An incomplete handoff report leaves the next agent without context and will cause rework.

---

## Template

```
## HANDOFF REPORT

### Task Reference
[Paste or briefly describe the task you received]

### Agent Type
[ ] Frontend agent
[ ] Backend / Architecture agent
[ ] Docs agent
[ ] Other: ___________

### Status
[ ] COMPLETE — all changes made, all tests passed
[ ] PARTIAL — some changes made, task not complete (explain in Blockers)
[ ] INTERRUPTED — stopped before starting execution (explain in Blockers)
[ ] BLOCKED — could not complete due to conflict or missing information

---

### Files Changed

List every file that was modified. Do not list files that were only read.

| # | File path | Status | Sections / lines changed |
|---|---|---|---|
| 1 | | Modified / Created / No change | |
| 2 | | Modified / Created / No change | |

---

### Summary of Changes

For each file changed, provide a brief description of what was actually done.

**File 1: [filename]**
[Describe what changed. Be specific enough that someone who didn't watch you work can understand what is different from before.]

**File 2: [filename]**
[Repeat]

---

### Additional Changes Made

List any changes you made that were NOT in your original pre-approval request.
(If none: write "None.")

These should be small, incidental changes. If you made a substantial change outside your approved scope, explain why.

[Write here]

---

### Testing Checklist Results

| Item | Result | Notes |
|---|---|---|
| [e.g. F-01 — Page loads without console errors] | Pass / Fail / N/A | |
| | | |
| | | |

Overall testing result: [ ] All pass  [ ] Failures present (see notes)

---

### Known Risks and Regressions

List anything that could break as a result of your changes, even if you believe it is unlikely.

| Risk | Area affected | Mitigation / recommendation |
|---|---|---|
| | | |

If you found issues that you did NOT fix (out of scope, not approved), list them here:

| Issue found | File | Recommendation |
|---|---|---|
| | | |

---

### Blockers and Open Questions

List anything that prevented completion or that requires a decision before the next task proceeds.

| Blocker / question | File or area affected | Recommended resolution |
|---|---|---|
| | | |

(If no blockers: write "None.")

---

### Phase Update Required?

Does this completed task change the status of a phase in phase-control-log.md?
[ ] Yes — update required: [describe what should change]
[ ] No — no phase update needed

---

### Recommended Next Step

What should happen next, based on what you found while doing this task?

[Write 1–3 sentences. Be specific: "The next agent should address X before working on Y because Z."]

---

### Agent Confirmation

[ ] I confirm all testing checklist items applicable to this task have been run and results are recorded above
[ ] I confirm all files changed are listed in the Files Changed section
[ ] I confirm this report is accurate — it reflects what I actually did, not what I planned to do
```

---

## Status Definitions

**COMPLETE:** All approved changes were made. All applicable testing checklist items passed. No unresolved blockers.

**PARTIAL:** Some approved changes were made. The task is not finished. The next agent can resume from the state described in this report. The blockers section explains what stopped execution.

**INTERRUPTED:** The task was stopped before execution began. No files were modified. The blockers section explains why.

**BLOCKED:** A conflict, missing information, or out-of-scope requirement prevented completion. Files may or may not have been modified. The blockers section explains what was encountered and what is needed to proceed.

---

## Example: Completed Handoff Report

```
## HANDOFF REPORT

### Task Reference
Fix the sidebar active state on reservations.html

### Agent Type
[x] Frontend agent

### Status
[x] COMPLETE — all changes made, all tests passed

---

### Files Changed

| # | File path | Status | Sections / lines changed |
|---|---|---|---|
| 1 | reservations.html | Modified | Sidebar nav — added `active` class to Reservations link (line 47) |

---

### Summary of Changes

**File 1: reservations.html**
Added `active` class to the `.dashboard-nav-item` anchor element for the Reservations sidebar link. The element at line 47 now reads `<a href="reservations.html" class="dashboard-nav-item active">` matching the pattern used in dashboard-homeowner.html for the current page's nav item.

---

### Additional Changes Made
None.

---

### Testing Checklist Results

| Item | Result | Notes |
|---|---|---|
| F-01 — Page loads without console errors | Pass | No errors in console |
| F-03 — Active nav item is correct | Pass | Reservations item highlighted |
| F-04 — Dashboard link routes by accountType | Pass | Tested homeowner route |

Overall testing result: [x] All pass

---

### Known Risks and Regressions
None identified.

Issues found but not fixed:
| Issue found | File | Recommendation |
|---|---|---|
| guests.html has the same missing active class issue | guests.html | Fix in next frontend consistency pass |

---

### Blockers and Open Questions
None.

---

### Phase Update Required?
[ ] No — this is a minor fix within the current phase. No phase status change needed.

---

### Recommended Next Step
Apply the same active nav fix to guests.html, tasks.html, and marketplace.html — the same issue is present on those pages.

---

### Agent Confirmation

[x] I confirm all testing checklist items applicable to this task have been run and results are recorded above
[x] I confirm all files changed are listed in the Files Changed section
[x] I confirm this report is accurate
```

---

## Interrupted Task Example

```
## HANDOFF REPORT

### Task Reference
Add a "No guests yet" empty state to guests.html

### Agent Type
[x] Frontend agent

### Status
[x] BLOCKED — could not complete due to conflict or missing information

---

### Files Changed

| # | File path | Status | Sections / lines changed |
|---|---|---|---|
| 1 | guests.html | No change | No changes made |

---

### Summary of Changes
No changes were made. See Blockers.

---

### Blockers and Open Questions

| Blocker / question | File or area affected | Recommended resolution |
|---|---|---|
| guests.html does not use nauxica-demo-data.js to load guest data — it has all guest records hardcoded in HTML. Adding an empty state requires either: (a) converting the page to data-driven rendering, or (b) adding a conditional via a JS check. Option (a) requires approval to modify nauxica-demo-data.js. | guests.html | Clarify which approach is approved before proceeding. |

---

### Recommended Next Step
Approve either approach (a) or (b) and re-assign the task with the approach specified. Approach (a) is more consistent with how other pages work but requires editing nauxica-demo-data.js.
```
