# Testing Checklist

**Version:** 1.0
**Applies to:** All Claude Code agents — run after every change
**Last updated:** 2026-05-28

---

## How to Use This Checklist

After completing your changes and before filing your handoff report, run the checklist sections that apply to your task type.

Record each result as:
- **Pass** — item verified, no issues
- **Fail** — item does not pass (describe the failure)
- **N/A** — item is not applicable to this specific change

A task is not complete until all applicable items show Pass or N/A.

If an item fails and the fix is within your approved scope: fix it before proceeding.
If an item fails and the fix requires going out of scope: report it in your handoff report and stop.

---

## Section F — Frontend Checks

Apply these checks to any task that modifies an HTML, CSS, or JavaScript file.

### F-01 — Page Loads Without Console Errors
Open the modified page. Open the browser's developer console. Confirm no JavaScript errors or warnings are present on load.
- Common failures: undefined variable, broken import, syntax error in `<script>` block

### F-02 — Page Visual Integrity
The page renders without broken layout, missing sections, or visual corruption.
- Check at 1280px width (desktop)
- Check at 375px width (mobile)

### F-03 — Active Nav Item Is Correct
The sidebar nav item corresponding to the current page has the `active` class applied and appears visually selected.
- Common failure: `active` class on wrong item, or no item selected

### F-04 — Dashboard Link Routes by Account Type
The sidebar dashboard link routes to `dashboard-homeowner.html` when `accountType = homeowner` and to `dashboard-partner.html` when `accountType = partner`.
- Test both account types if the page is shared

### F-05 — Sidebar Structure Matches Master Reference
The sidebar HTML structure matches the pattern in `dashboard-homeowner.html`:
- `dashboard-sidebar` wrapping div
- `dashboard-sidebar-inner` inner wrapper
- `sidebar-brand` branding section
- `dashboard-nav` nav container
- `dashboard-nav-item` for each nav link

### F-06 — Responsive Layout (375px)
At 375px width:
- Dashboard shell is single column
- Sidebar becomes horizontal scrollable nav
- Cards stack vertically
- No horizontal page overflow
- All buttons are touch-friendly (minimum 44px tap target)

### F-07 — Existing Buttons and Interactions Still Work
All interactive elements on the page that were working before the change still work:
- Buttons that existed before still trigger their actions
- Any modals, dropdowns, or toggles that existed before still open and close correctly
- Form inputs (if any) still accept input and clear correctly

### F-08 — localStorage Persistence Is Intact
If the page reads from or writes to localStorage:
- Data loads correctly on page open
- Any state changes persist correctly on reload
- No existing localStorage keys have been renamed or removed
- `nauxica-demo-data.js` `loadState()` still returns the expected structure

Verify by:
1. Open the page with localStorage populated (after a demo login)
2. Check that data-driven content appears
3. Refresh the page — confirm the same data appears (not reset)

### F-09 — Account Type Conditional Content
If the page shows different content based on `accountType`:
- Homeowner content appears for `accountType = homeowner`
- Partner content appears for `accountType = partner`
- No homeowner content bleeds into partner view, and vice versa

Test both states explicitly.

### F-10 — No New Frameworks or CDN Links Added
Confirm the file does not contain:
- A new `<script src="...cdn...">` for a framework not previously in the project
- A new `<link rel="stylesheet" href="...cdn...">` for an external CSS library
- Any `import` statement for a new module system

### F-11 — CSS Does Not Duplicate Existing Patterns
Any new CSS added:
- Does not duplicate an existing class in `style.css`
- Does not introduce a new naming convention that conflicts with existing classes
- Does not use hardcoded colour values where CSS custom properties exist

### F-12 — Logout Behaviour Is Correct
The Logout button (if present):
- Removes `accountType` from localStorage
- Removes `nauxicaAccountType` from localStorage
- Redirects to `index.html`

---

## Section D — Documentation Checks

Apply these checks to any task that creates or modifies a file in `docs/`.

### D-01 — Document Header Is Complete
The document starts with the required metadata block:
- `**Version:**` present
- `**Status:**` present and uses a valid status value
- `**Last updated:**` present with a date
- `**Related:**` present (or explicitly noted as "None" if no related docs)

### D-02 — No Placeholder Text
Search the document for: "TBD", "TODO", "fill in", "placeholder", "coming soon", "[X]", "[insert".
All must be absent (or deliberately present as part of a template that's meant to have placeholders — like this file).

### D-03 — All Internal Links Resolve
Every Markdown link in the document that points to another file in `docs/` leads to a file that exists.
- Test by verifying each linked path against the actual file system

### D-04 — Legal Review Markers Are Present
Any section containing legal or regulatory content has the marker:
`⚠️ **Legal review required:**`

Topics that require marking: GDPR, tourist tax, Alloggiati Web, partner background checks, insurance amounts, guide licences, data retention, consent.

### D-05 — No Duplication of Existing Architecture
The document does not re-define content already defined in another document.
If content is shared: it references the authoritative document, it does not copy-paste from it.

### D-06 — Version Incremented on Update
If this is an update to an existing document: the version number has been incremented from its previous value.

### D-07 — Status Is Correct
The document status reflects its actual completeness:
- `Draft` — if any section is incomplete
- `Complete` — if all sections are fully developed
- `Active` — only if the backend is live and this document governs a live system

### D-08 — Cross-References Are Bidirectional
If this document references Document B, check whether Document B should reference this document in its Related section. If it should, update Document B's Related section.

---

## Section C — Data Consistency Checks

Apply these checks when `nauxica-demo-data.js` has been modified, or when a new HTML page has been created that consumes data.

### C-01 — loadState() Returns Expected Structure
`window.NauxicaDemoData.loadState()` returns an object with all expected top-level keys:
- `properties`
- `tasks`
- `partnerRequests`
- `notifications`
- `messages`
- `calendarEvents`
- `reviews`

Any new key added in this change is present and contains the expected default value.

### C-02 — Existing Data Objects Have Not Changed Shape
Objects that existed before this change:
- Still have all the same fields they had before
- Any new fields added have default values that do not break existing code reading those objects

### C-03 — accountType Filter Works on Data Items
Any data items that should be account-type specific include `accountType: "homeowner"` or `accountType: "partner"`.
Pages that filter by account type return the correct subset.

### C-04 — No Hardcoded Data That Should Come From loadState()
New HTML pages or sections do not hardcode data values that should be driven by `nauxica-demo-data.js`.

### C-05 — localStorage Keys Are Unchanged
No existing localStorage keys have been renamed, removed, or had their value format changed.
Keys to verify: `accountType`, `nauxicaAccountType`, and any keys used by the modified page.

---

## Section N — Navigation Checks

Apply these checks when modifying nav structure, adding pages, or modifying shared navigation components.

### N-01 — Public Pages Use Public Nav
`index.html`, `login.html`, `register.html`, `contacts.html` all use the public header nav (Home, Services, Pricing, Login, Register, Contact).
No sidebar is injected into these pages.

### N-02 — Internal Pages Use App Header and Sidebar
All pages other than the four public pages use:
- The app header (Home, Contact, Logout)
- The sidebar with the appropriate account-type nav items

### N-03 — New Pages Are Linked From the Sidebar
If a new HTML page was created, it appears as a nav item in the sidebar of relevant pages (or in `nauxica-shared.js` if nav is shared).

### N-04 — No Broken Nav Links
Every sidebar nav link points to a file that exists. No `href="#"` for a link that should go somewhere.

### N-05 — Dynamic Dashboard Link Is Present
Every internal page that includes the sidebar has a dashboard link that:
- Routes to `dashboard-homeowner.html` for homeowners
- Routes to `dashboard-partner.html` for partners
- Does NOT hardcode a single dashboard URL

---

## Section B — Future Backend Checks (Placeholder)

These checks apply when backend integration begins. They are not currently active.

### B-01 — API Calls Use Correct Endpoint Structure
(Not active — no backend yet)

### B-02 — Auth Tokens Are Not Hardcoded
(Not active — no backend yet)

### B-03 — No Personal Data in Frontend JavaScript
(Not active — enforce at backend integration phase)

### B-04 — Error States Handle API Failures Gracefully
(Not active — no backend yet)

---

## Checklist Summary Card

Copy this into your handoff report and fill in results:

```
TESTING CHECKLIST RESULTS

Frontend checks (Section F):
F-01 Page loads without console errors:          Pass / Fail / N/A
F-02 Page visual integrity:                      Pass / Fail / N/A
F-03 Active nav item is correct:                 Pass / Fail / N/A
F-04 Dashboard link routes by accountType:       Pass / Fail / N/A
F-05 Sidebar structure matches master reference: Pass / Fail / N/A
F-06 Responsive layout (375px):                  Pass / Fail / N/A
F-07 Existing interactions still work:           Pass / Fail / N/A
F-08 localStorage persistence intact:           Pass / Fail / N/A
F-09 Account type conditional content:          Pass / Fail / N/A
F-10 No new frameworks or CDN links:            Pass / Fail / N/A
F-11 CSS does not duplicate existing patterns:   Pass / Fail / N/A
F-12 Logout behaviour correct:                   Pass / Fail / N/A

Documentation checks (Section D):
D-01 Document header complete:                   Pass / Fail / N/A
D-02 No placeholder text:                        Pass / Fail / N/A
D-03 All internal links resolve:                 Pass / Fail / N/A
D-04 Legal review markers present:               Pass / Fail / N/A
D-05 No duplication of existing architecture:    Pass / Fail / N/A
D-06 Version incremented:                        Pass / Fail / N/A
D-07 Status is correct:                          Pass / Fail / N/A
D-08 Cross-references bidirectional:             Pass / Fail / N/A

Data consistency checks (Section C):
C-01 loadState() returns expected structure:     Pass / Fail / N/A
C-02 Existing object shapes unchanged:           Pass / Fail / N/A
C-03 accountType filter works:                   Pass / Fail / N/A
C-04 No hardcoded data replacing loadState():    Pass / Fail / N/A
C-05 localStorage keys unchanged:               Pass / Fail / N/A

Navigation checks (Section N):
N-01 Public pages use public nav:               Pass / Fail / N/A
N-02 Internal pages use app header + sidebar:    Pass / Fail / N/A
N-03 New pages linked from sidebar:             Pass / Fail / N/A
N-04 No broken nav links:                        Pass / Fail / N/A
N-05 Dynamic dashboard link present:            Pass / Fail / N/A

Failures requiring follow-up:
[List any Fail items with explanation]
```
