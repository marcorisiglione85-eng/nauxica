You are working on the Nauxica project.

PROJECT OVERVIEW
Nauxica is a premium Mediterranean hospitality SaaS platform for short term rental property owners and local service partners.

The platform connects:
1. Homeowners, property owners and hospitality managers
2. Local partners such as cleaners, maintenance providers, guest services, transfer providers and local experience providers

The product vision is to help owners manage:
- properties
- guests
- messages
- calendars
- operations
- tasks
- reviews
- revenue
- marketplace services
- AI insights

And help partners manage:
- incoming service requests
- accepted jobs
- calendar
- availability
- messages
- reviews
- earnings
- performance
- services

CURRENT TECH STACK
- HTML
- CSS
- Vanilla JavaScript
- No framework
- No backend yet
- Demo state managed via localStorage
- Shared data/functions live in nauxica-demo-data.js

MAIN FILES
- index.html
- login.html
- register.html
- contacts.html
- dashboard-homeowner.html
- dashboard-partner.html
- messages.html
- calendar.html
- reviews.html
- style.css
- nauxica-demo-data.js

DESIGN DIRECTION
The visual identity must feel:
- premium
- Mediterranean
- minimal
- warm
- hospitality focused
- clean SaaS

Reference feel:
- Airbnb
- Linear
- Notion
- modern hospitality dashboards

Design characteristics:
- soft cream background
- warm terracotta accent
- rounded cards
- soft shadows
- generous spacing
- clear hierarchy
- mobile first responsive behavior

MASTER LAYOUT RULE
dashboard-homeowner.html is the current visual master reference.

All internal app pages should visually match the homeowner dashboard layout in:
- header
- sidebar
- dashboard shell width
- dashboard main width
- card radius
- shadows
- spacing
- topbar structure
- responsive behavior
- mobile sidebar horizontal scrolling

IMPORTANT
Do not create new layout systems unless explicitly requested.

Use existing classes whenever possible:
- homeowner-dashboard-page
- dashboard-shell
- homeowner-dashboard
- dashboard-sidebar
- dashboard-sidebar-inner
- sidebar-brand
- dashboard-nav
- dashboard-nav-item
- dashboard-main
- dashboard-topbar
- dashboard-card
- dashboard-grid
- col-left
- col-right
- dashboard-section-title
- dashboard-card-text
- card-heading-row

SHARED PAGE STRATEGY
Do not create separate pages like:
- messages-homeowner.html
- messages-partner.html
- calendar-homeowner.html
- calendar-partner.html

Instead use shared pages:
- messages.html
- calendar.html
- reviews.html

These pages must adapt content based on accountType.

ACCOUNT TYPES
There are two account types:
- homeowner
- partner

Current demo account type is stored in localStorage using:
- accountType
- nauxicaAccountType

Use helper if available:
window.NauxicaDemoData.getCurrentAccountType()

Dashboard link should be dynamic:
- homeowner goes to dashboard-homeowner.html
- partner goes to dashboard-partner.html

DATA STRUCTURE
Data comes from:
window.NauxicaDemoData.loadState()

Current state includes:
- properties
- tasks
- partnerRequests
- notifications
- messages
- calendarEvents
- reviews

Every account specific item should ideally include:
accountType: "homeowner"
or
accountType: "partner"

LOCALSTORAGE RULES
Do not break localStorage persistence.

Do not rename localStorage keys unless explicitly requested.

Do not reset user state automatically.

Do not modify nauxica-demo-data.js unless explicitly approved.

MESSAGES PAGE
messages.html must:
- use the same master layout as homeowner dashboard
- have full sidebar
- have dynamic dashboard link
- filter messages by accountType
- support filters:
  All
  Unread
  Archived
  Nauxica
- support Mark as read
- support Archive
- preserve current JavaScript logic
- not break localStorage

CALENDAR PAGE
calendar.html must:
- use the same master layout as homeowner dashboard
- have full sidebar
- have dynamic dashboard link
- filter events by accountType
- support date strip
- support Today, Upcoming, Completed, All
- preserve existing JavaScript logic
- not break localStorage

REVIEWS PAGE
reviews.html must:
- use the same master layout as homeowner dashboard
- have full sidebar
- have dynamic dashboard link
- filter reviews by accountType
- show demo rating summary and review cards
- remain functional even if reviews data is empty

HOMEOWNER DASHBOARD
dashboard-homeowner.html is the master visual reference.

Do not modify it unless explicitly instructed.

PARTNER DASHBOARD
dashboard-partner.html should have:
- partner specific content
- partner specific menu
- same visual rhythm as homeowner dashboard
- same shell width
- same sidebar card style
- same topbar style
- same card radius and shadows
- same responsive behavior

Partner dashboard content should remain partner specific:
- requests
- my jobs
- calendar
- availability
- earnings
- messages
- performance
- services
- reviews
- settings

Do not force homeowner menu into partner dashboard.

NAVIGATION RULES
Public pages:
- index.html
- login.html
- register.html
- contacts.html

Public pages keep the public nav:
- Home
- Services
- Pricing
- Login
- Register
- Contact

Internal app pages use app header:
- Home
- Contact
- Logout

Internal app pages use sidebar for app navigation.

Header logout button should:
- remove accountType and nauxicaAccountType from localStorage
- redirect to index.html

CODING RULES
Use:
- Vanilla JavaScript
- const and let
- template literals
- small functions
- event delegation
- dataset attributes for actions
- reusable helpers where useful

Avoid:
- inline styles
- duplicated CSS
- duplicated JavaScript
- over engineering
- adding frameworks
- changing existing data structure without approval
- breaking working interactions

CSS RULES
Before adding CSS:
1. check if an existing class already solves it
2. reuse homeowner dashboard styles
3. avoid creating new visual systems
4. avoid !important unless needed to override existing legacy rules
5. keep CSS grouped and readable

Do not add large new CSS blocks without explaining why.

RESPONSIVE RULES
Mobile behavior must remain:
- dashboard shell becomes one column
- sidebar becomes horizontal scroll nav
- cards stack vertically
- spacing remains compact
- no horizontal page overflow
- touch friendly buttons

SAFE EDITING WORKFLOW
Before editing any file, always provide:
1. what you will change
2. which files you will touch
3. why the change is needed
4. risks or possible regressions
5. wait for approval

Do not modify files before approval.

When approved:
- change only the approved files
- do not touch unrelated files
- preserve JavaScript logic unless explicitly asked
- keep existing functionality working

AFTER EDITING
After edits, provide:
1. files changed
2. summary of blocks changed
3. anything to test
4. any known risk

TESTING CHECKLIST
For any page edited, verify:
- page loads without console errors
- sidebar appears correctly
- active nav item is correct
- dashboard link goes to correct dashboard by accountType
- mobile layout still works
- existing buttons still work
- localStorage persistence still works

CURRENT PRIORITY
The current priority is to make the platform functional and consistent, not perfect.

Priority order:
1. fix layout consistency
2. make navigation work
3. keep messages, calendar and reviews functional
4. align partner dashboard to homeowner visual system
5. only then improve polish and micro interactions

DO NOT DO
- do not rebuild the project
- do not introduce React or frameworks
- do not create duplicate owner/partner pages for shared sections
- do not rewrite nauxica-demo-data.js unless approved
- do not delete working JavaScript
- do not change public page header
- do not invent new design direction
- do not make broad refactors without approval

When in doubt:
reuse dashboard-homeowner.html as the master visual reference.
PROJECT DEVELOPMENT PRINCIPLE

The current goal is to build a fully functional frontend SaaS prototype before backend implementation.

Before backend:
- all navigation flows must work
- all sidebar links must resolve correctly
- all major user journeys must be testable
- localStorage should simulate app state
- homeowner and partner experiences must be coherent
- the platform should feel operational even with mock/demo data

Backend integration, authentication, APIs and database work will happen only after frontend UX, flows and architecture are stable.