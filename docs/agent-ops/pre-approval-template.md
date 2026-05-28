# Pre-Approval Template

**Version:** 1.0
**Applies to:** All Claude Code agents — every task, every time
**Last updated:** 2026-05-28

---

## How to Use This Template

Copy the template below and fill in every field before touching any file. Do not abbreviate, skip fields, or combine fields.

Submit the completed template. Stop. Wait for explicit approval.

"Explicit approval" means a human reply that uses one of the following phrases:
- "Approved"
- "Approved as described"
- "Approved — proceed"
- "Go ahead"
- Any equivalent direct confirmation

"I understand" or "thanks" or continuing a conversation does not constitute approval. If you are unsure whether approval was given, ask.

---

## Template

```
## PRE-APPROVAL REQUEST

### Task Reference
[Paste or briefly describe the task you received. If there is no task reference, write "Ad-hoc — [one-line description]"]

### Agent Type
[ ] Frontend agent
[ ] Backend / Architecture agent
[ ] Docs agent
[ ] Other: ___________

### Phase
Current phase (from phase-control-log.md): ___________
Is this phase open? [ ] Yes  [ ] No  (If No: do not proceed — report the block)

---

### Files to Be Modified

List every file that will be changed. Do not include files you will only read.

| # | File path | Type of change |
|---|---|---|
| 1 | | |
| 2 | | |
| 3 | | |

(Add rows as needed. One row per file.)

---

### Files to Be Created (if any)

| # | File path | Purpose |
|---|---|---|
| 1 | | |

(Leave blank if no new files are being created.)

---

### Sensitive Files

Check any sensitive files included in your modification list:
[ ] PROJECT_RULES.md
[ ] nauxica-demo-data.js
[ ] nauxica-shared.js
[ ] style.css
[ ] An architecture document in docs/

For each checked item, explain specifically why this file must be changed for this task:
[Write here]

---

### Proposed Changes — Detail

For each file being modified, describe specifically what will change.
Do not say "update X" — say exactly what will be added, removed, or edited.

**File 1: [filename]**
Section / function / element: [identify exactly where in the file]
What will change: [describe exactly — new content, removed content, renamed element, etc.]
What will NOT change: [list anything nearby that you will leave untouched]

**File 2: [filename]**
[Repeat above structure]

**File N: [filename]**
[Repeat above structure]

---

### Rationale

Why is this change needed? What does it achieve?
[Write 1–3 sentences. Be specific to this task.]

---

### Risk Assessment

What could break as a result of these changes?

| Risk | Affected area | Likelihood | How you will avoid or mitigate it |
|---|---|---|---|
| | | | |

---

### Consistency Checks

For frontend changes:
[ ] I have confirmed the visual change matches dashboard-homeowner.html
[ ] I have confirmed no existing CSS class already achieves this
[ ] I have confirmed localStorage keys are not being renamed
[ ] I have confirmed nauxica-demo-data.js structure is not being broken

For documentation changes:
[ ] I have checked no existing document already covers this content
[ ] I have identified all documents that will need cross-reference updates
[ ] All new legal/regulatory content will be marked ⚠️ Legal review required

For architecture changes:
[ ] I have confirmed the change is consistent with data-visibility-model.md
[ ] I have confirmed the change does not alter AI runtime write permissions
[ ] I have identified which other documents reference the content I am changing

---

### Test Plan

Which testing checklist items will I run after making these changes?
(Reference testing-checklist.md sections and item numbers)

[ ] Frontend checklist items: [list item numbers, e.g. F-01, F-02, F-05]
[ ] Documentation checklist items: [list item numbers]
[ ] Data consistency checklist items: [list item numbers]

---

### What I Will NOT Do

Explicitly list things that are in scope of this general area but that you will NOT do in this task:

[Example: "I will not modify nauxica-shared.js. I will not change the sidebar structure on pages other than [target page]. I will not change the demo data structure."]

---

### Approval Request

I have read the relevant files, completed this pre-approval request, and I am waiting for explicit approval before making any changes.

[ ] I confirm I have read claude-code-master-rules.md this session
[ ] I confirm I have read the applicable scope document (frontend/backend/docs) this session
[ ] I confirm I have read the current version of every file I plan to modify
```

---

## Example: Completed Pre-Approval Request

This example shows what a correctly completed request looks like. It is a frontend example.

```
## PRE-APPROVAL REQUEST

### Task Reference
Fix the sidebar active state on reservations.html — the "Reservations" nav item is not highlighted when the page loads.

### Agent Type
[x] Frontend agent

### Phase
Current phase (from phase-control-log.md): Phase 1 — Frontend Consistency
Is this phase open? [x] Yes

---

### Files to Be Modified

| # | File path | Type of change |
|---|---|---|
| 1 | reservations.html | Add `active` class to the Reservations nav item in the sidebar |

---

### Files to Be Created (if any)
None.

---

### Sensitive Files
None checked. No sensitive files are being modified.

---

### Proposed Changes — Detail

**File 1: reservations.html**
Section / function / element: The `.dashboard-nav` section in the sidebar
What will change: The `<a>` element for the Reservations link will have `active` class added, matching the pattern used in dashboard-homeowner.html for active nav items.
What will NOT change: All other nav items, all JavaScript, all demo data connections, the page structure, or any other section of the file.

---

### Rationale
The active nav state is set via a CSS class. The reservations.html file is missing the `active` class on the Reservations nav item, causing it to appear unselected even when the user is on that page.

---

### Risk Assessment

| Risk | Affected area | Likelihood | Mitigation |
|---|---|---|---|
| Active state appears on wrong item if class is placed on wrong element | Sidebar nav | Low | I will check the exact element against dashboard-homeowner.html's active nav pattern before placing the class |

---

### Consistency Checks

For frontend changes:
[x] I have confirmed the visual change matches dashboard-homeowner.html (it uses the same active class pattern)
[x] I have confirmed no existing CSS class already achieves this (it does, the class exists — it's just missing from this element)
[x] I have confirmed localStorage keys are not being renamed (no localStorage changes)
[x] I have confirmed nauxica-demo-data.js structure is not being broken (no data changes)

---

### Test Plan
[ ] Frontend checklist items: F-01 (page loads), F-03 (active nav item correct), F-04 (dashboard link works)

---

### What I Will NOT Do
I will not modify any other pages. I will not change the CSS for the active state. I will not modify nauxica-shared.js or nauxica-demo-data.js. I will not change any JavaScript on the page.

---

### Approval Request

[x] I confirm I have read claude-code-master-rules.md this session
[x] I confirm I have read frontend-agent-scope.md this session
[x] I confirm I have read the current version of reservations.html
```
