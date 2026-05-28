# Frontend Agent Scope

**Version:** 1.0
**Applies to:** Claude Code agents working on HTML, CSS, and JavaScript files
**Prerequisite:** Read [claude-code-master-rules.md](claude-code-master-rules.md) first
**Last updated:** 2026-05-28

---

## What Frontend Agents Do

Frontend agents work on the Nauxica prototype: the collection of HTML, CSS, and JavaScript files that form the client-side SaaS interface. At this stage, there is no backend. All state is managed via localStorage. The goal is a fully functional, visually consistent prototype.

---

## Files a Frontend Agent May Modify

These files are in scope for frontend agents. Each has specific rules below.

### HTML Pages

| File | Notes |
|---|---|
| `index.html` | Public landing page |
| `login.html` | Login page — public nav |
| `register.html` | Registration — public nav |
| `contacts.html` | Contact page — public nav |
| `dashboard-homeowner.html` | **Master visual reference — see rules below** |
| `dashboard-partner.html` | Partner dashboard — must match homeowner visual system |
| `messages.html` | Shared page — adapts by accountType |
| `calendar.html` | Shared page — adapts by accountType |
| `reviews.html` | Shared page — adapts by accountType |
| `properties.html` | Homeowner: property management |
| `reservations.html` | Homeowner: reservation management |
| `guests.html` | Homeowner: guest management |
| `tasks.html` | Homeowner/partner: task management |
| `marketplace.html` | Partner/homeowner: service marketplace |
| `operations.html` | Operations page |
| `reports.html` | Reports page |
| `revenue.html` | Revenue page |
| `availability.html` | Partner: availability management |
| `help.html` | Help/support page |
| `settings.html` | Account settings |

### CSS

| File | Notes |
|---|---|
| `style.css` | Single global stylesheet — **sensitive file, requires explicit approval** |

### JavaScript

| File | Notes |
|---|---|
| `nauxica-shared.js` | Shared UI, navigation, helpers — **sensitive file, requires explicit approval** |
| `nauxica-demo-data.js` | Demo state and data — **sensitive file, requires explicit approval** |
| Inline `<script>` in HTML pages | Part of the HTML file edit — covered by HTML page approval |

### Assets

| File | Notes |
|---|---|
| Files in `assets/` | Images, icons, fonts — modifiable but new files require approval |

---

## Files a Frontend Agent Must NOT Modify

These files are outside frontend agent scope:

- `PROJECT_RULES.md` — governance document
- Any file in `docs/` — documentation scope only
- Any `.md` file — documentation scope only
- `site.webmanifest` — only with explicit task instruction
- PDF files — not editable
- Files in `business file/`, `Beta test/`, `accomodation contact and sheets/` — not in scope

---

## dashboard-homeowner.html Rules

**This file is the master visual reference for the entire platform.**

Do not modify `dashboard-homeowner.html` unless the task explicitly instructs it.

When building or editing any other page:
1. Open `dashboard-homeowner.html` and compare your work to it
2. Match: header structure, sidebar structure, card radius, shadows, spacing, topbar structure
3. Use the same CSS classes where they apply — do not invent new ones for patterns that already exist

**CSS classes from `dashboard-homeowner.html` that all internal pages must use:**
```
homeowner-dashboard-page
dashboard-shell
homeowner-dashboard
dashboard-sidebar
dashboard-sidebar-inner
sidebar-brand
dashboard-nav
dashboard-nav-item
dashboard-main
dashboard-topbar
dashboard-card
dashboard-grid
col-left
col-right
dashboard-section-title
dashboard-card-text
card-heading-row
```

Before adding a new CSS class: confirm the equivalent does not already exist in `style.css`.

---

## Dashboard Shell Rules

Every internal app page (all pages except `index.html`, `login.html`, `register.html`, `contacts.html`) must:

- Use the full dashboard shell layout: header + sidebar + main
- Have a functional sidebar with correct active nav item
- Have a dynamic dashboard link that routes by `accountType`
- Match the shell width from `dashboard-homeowner.html`
- Maintain full responsive behaviour (sidebar becomes horizontal scroll nav on mobile)

Never create a new layout system for an internal page. If you need a layout not present in the master reference, stop and ask.

---

## Shared Page Rules (messages.html, calendar.html, reviews.html)

These pages serve both homeowners and partners. They must adapt by `accountType`.

**Rules:**
- Do not create `messages-homeowner.html` and `messages-partner.html` as separate files
- Do not create `calendar-homeowner.html` / `calendar-partner.html`
- Do not create `reviews-homeowner.html` / `reviews-partner.html`
- Use `accountType` from localStorage to show/hide content
- Use `window.NauxicaDemoData.getCurrentAccountType()` where available

**Navigation in shared pages:**
- Sidebar shows appropriate items for each account type
- Dashboard link routes to the correct dashboard

---

## Navigation Rules

### Public pages (index.html, login.html, register.html, contacts.html)
Must use the public nav:
- Home
- Services
- Pricing
- Login
- Register
- Contact

Never inject the app sidebar into public pages.

### Internal app pages (everything else)
Must use the app header with:
- Home
- Contact
- Logout

The Logout button must:
- Remove `accountType` and `nauxicaAccountType` from localStorage
- Redirect to `index.html`

Never duplicate the public nav inside an app page.

---

## nauxica-shared.js Rules

This file contains shared components and helpers used across all pages. It is a sensitive file.

**Before requesting approval to edit `nauxica-shared.js`:**
- Read the entire file
- Identify exactly what you need to change and why
- Confirm the change is not achievable by inline page script
- Confirm the change does not break any page that currently imports it

**What you may add:**
- New helper functions that are genuinely reusable across pages
- Extensions to existing helper functions

**What you must not do:**
- Remove or rename existing functions
- Change the signature of existing functions without auditing every call site
- Add page-specific logic that is only needed by one page

---

## nauxica-demo-data.js Rules

This file is the state management layer. It defines the demo data structure and all localStorage interactions. It is a sensitive file.

**Before requesting approval to edit `nauxica-demo-data.js`:**
- Read the entire file
- Identify exactly what you need to add or change
- Confirm no existing structure already satisfies your need

**What you may add:**
- New data entries in existing arrays (e.g. a new demo property, a new demo task)
- New fields on existing objects if the task requires them and the addition is backwards-compatible

**What you must not do:**
- Rename existing `localStorage` keys
- Change the structure of existing data objects (the shape must remain the same)
- Add a new top-level state key without explicit approval
- Reset user state programmatically
- Remove any existing data properties

---

## style.css Rules

This is the global stylesheet. All visual styles live here. It is a sensitive file.

**Before requesting approval to edit `style.css`:**
- Search the file for existing classes that satisfy your need
- Check `dashboard-homeowner.html` for existing visual patterns
- If an existing class almost works, prefer extending it over creating a new one

**Adding new CSS:**
- Group new rules near related existing rules (by component, not at the end of the file)
- Use existing CSS custom properties (`--etna-dark`, `--etna-orange`, `--sicily-blue`, etc.)
- Never use `!important` unless overriding a specific legacy conflict — document why
- Do not add large blocks of new CSS for a small change

**Forbidden:**
- Introducing CSS variables not already in the project
- Adding Tailwind, Bootstrap, or any utility class system
- Adding `@import` for external stylesheets not already present

---

## Demo Data Rules

All data displayed in the prototype comes from `nauxica-demo-data.js` or inline HTML.

**Rules:**
- Do not hardcode data that should come from `nauxica-demo-data.js` directly into HTML
- Do not invent data structures that are inconsistent with `nauxica-demo-data.js`
- Every `accountType`-sensitive data item should include `accountType: "homeowner"` or `accountType: "partner"`
- If a page needs data not yet in `nauxica-demo-data.js`: add it via a separate approved `nauxica-demo-data.js` edit, not inline in the HTML

---

## No Backend Assumptions

The frontend prototype does not connect to a backend. Do not:

- Write `fetch()` or `XMLHttpRequest` calls to actual API endpoints
- Write authentication flows that expect a real server response
- Create form submissions that POST to a backend URL
- Add environment variable references or API key placeholders

If the task description implies a backend integration: clarify whether it is a prototype stub or real integration before proceeding. At this project stage, everything is prototype/localStorage only.

---

## Coding Conventions

These are taken directly from `PROJECT_RULES.md`. Follow them without exception.

**Use:**
- Vanilla JavaScript (no jQuery, no frameworks)
- `const` and `let` (never `var`)
- Template literals for dynamic HTML
- Small, single-purpose functions
- Event delegation where possible
- `data-` attributes for actions

**Avoid:**
- Inline styles (use CSS classes)
- Duplicated CSS or JavaScript
- Over-engineering (build what the task requires)
- Adding any external library not already present
- Changing existing data structures without approval

---

## Responsive Behaviour Requirements

Every internal page must maintain:
- Single-column layout on mobile (< 768px)
- Sidebar becomes horizontal scrollable nav on mobile
- Cards stack vertically
- No horizontal page overflow
- Touch-friendly button sizing (min 44px tap target)

Never ship a change that breaks mobile layout. Test at 375px width before reporting complete.

---

## Frontend Agent Quick Reference

```
BEFORE EDITING:
✓ Read master rules
✓ Read this scope doc
✓ Read the target file
✓ Fill pre-approval template
✓ Wait for approval

WHILE EDITING:
✓ Only approved files
✓ Only approved sections
✓ Match dashboard-homeowner.html for layout
✓ No new frameworks
✓ No backend calls
✓ No localStorage key renames

AFTER EDITING:
✓ Run testing checklist
✓ Check mobile at 375px
✓ File handoff report
```
