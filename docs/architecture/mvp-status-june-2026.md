# Nauxica MVP Status – June 2026

## Executive Summary

Nauxica has reached a functional MVP across its core homeowner and partner workflows. The platform is backed by a live Supabase Postgres instance with row-level security enforced at the database layer. Authentication, property management, reservations, guests, calendar, messaging, and the full task/operations lifecycle are all reading and writing real data. The partner workflow — including task assignment, acceptance, execution, and completion — is end-to-end functional across the homeowner and partner dashboards without any dependency on mock data.

The remaining gaps are well-contained: revenue, marketplace, and reviews are explicitly deferred behind "coming soon" shells; notifications exist as UI chrome but have no real delivery system; and several pages still load `nauxica-demo-data.js` as a leftover script tag even though their data now comes from Supabase. The platform is ready for internal testing and first user onboarding. It is not yet ready for general release.

---

## Completed Features

### Property Management

**Properties**
Full CRUD for homeowner properties backed by `public.properties`. The properties list page (`properties.html`) and property detail page (`property-detail.html`) both query Supabase. Auth guard redirects unauthenticated users to `login.html`. Only properties owned by the authenticated user are returned (homeowner RLS via `owner_id = auth.uid()`).

**Reservations**
`reservations.html` lists reservations joined to properties. Supports filter by `reservation_status`. Data sourced exclusively from `public.reservations`. `nauxica-demo-data.js` is still included as a script tag but is not actively called.

**Guests**
`guests.html` derives the guest list from `public.reservations` (no separate guests table). Guest records are represented by reservation rows with guest contact fields. `guest-detail.html` is fully Supabase-backed: loads reservation data, surfaces linked conversations, and supports message sending inline.

**Calendar**
`calendar.html` renders a 7-day strip populated from `public.reservations`. Occupancy, arrivals, and departures are real data. The page loads `nauxica-demo-data.js` as a leftover tag but does not consume it. A full month grid view is not yet implemented.

**Availability**
`availability.html` loads properties from `public.properties` and blocks dates from `public.reservations`. Availability windows are calculated client-side by merging booked ranges against a configurable display window. Serves both homeowners (property availability) and partners (service availability windows) via account-type branching.

---

### Guest Experience

**Conversations**
`messages.html` lists conversations from `public.conversations`, ordered by `last_message_at`. Homeowners see only conversations where `owner_id = auth.uid()`. Status transitions (open / resolved / archived) are written back to Supabase.

**Messages**
Individual messages within a conversation are stored in `public.messages` with `sender_type` values of `guest`, `ai`, `homeowner`, `partner`, or `system`. Message send creates a row via Supabase insert. The `messages_update_last_message_at` trigger keeps `conversations.last_message_at` current automatically. Read/unread state is tracked via `is_read`.

**Help Center**
`help.html` provides a static entry point with navigation cards to the four FAQ types. No Supabase dependency. Content is hardcoded.

**FAQ System**
`faq-viewer.html` renders FAQ content for four audience types — guest, homeowner, partner, concierge — selected via a `?type=` query parameter. Content is hardcoded in the HTML file; there is no `faq_entries` table in Supabase. This means FAQ updates require a code change. Trilingual support (EN/IT/ES) exists at the locale file level (`locales/en.json`, `locales/it.json`, `locales/es.json`) but is only wired into `index.html`; `faq-viewer.html` currently renders English only.

- **Guest FAQ** — check-in procedures, GuestPal AI concierge, house rules
- **Homeowner FAQ** — property setup, reservations, task management
- **Partner FAQ** — job acceptance, payment, service types
- **Concierge FAQ** — AI concierge operation, escalation, language support

---

### Operations

**Tasks**
`tasks.html` lists all tasks for the authenticated homeowner with filter tabs (All / Open / Assigned / Accepted / In progress / Completed / Cancelled). Status can be updated inline via a select control which writes to `public.tasks`. Backed by `homeowner_select_tasks` and `homeowner_update_tasks` RLS policies.

**Task Creation**
Task creation is available from `dashboard-homeowner.html` via the Create Task action panel. The form collects: property (select from owned properties), title, task type, description, priority, and due date. On submit, a row is inserted into `public.tasks` with `created_by = auth.uid()`. After creation, the dashboard task list and open-tasks KPI refresh automatically.

**Operations Center**
`operations.html` is the homeowner-facing assignment interface. It displays all tasks with filter tabs (All / Open / Assigned / Accepted / In progress / Completed). For tasks in `open` or `assigned` status, a partner select and Assign button are rendered inline. Assigning a partner writes `assigned_partner_id` and sets `status = 'assigned'`. The summary panel shows live counts by status.

**Partner Assignment**
The partner select in `operations.html` is populated from `public.users WHERE account_type = 'partner'`, enabled by the `authenticated_read_partners` policy added in migration 003. The homeowner sees partner display names and can reassign at any time while the task is still in `open` or `assigned` state.

**Homeowner Live Operations**
`dashboard-homeowner.html` displays a live operations card showing all tasks in `assigned`, `accepted`, or `in_progress` status. Each card shows the property name, task title and type, assigned partner name (resolved via the `users!assigned_partner_id` FK join), status badge, and due date. Badge classes are distinct for each status: `live-status-assigned`, `live-status-accepted`, `live-status-progress`.

**Partner Dashboard**
`dashboard-partner.html` is fully migrated off `NauxicaDemoData` for task rendering. On load it queries `public.tasks WHERE assigned_partner_id = auth.uid()` and populates three sections:

- **Job requests** — tasks in `assigned` status, with Decline and Accept buttons
- **My jobs** — tasks in `accepted` or `in_progress` status, with Start job or Complete buttons respectively
- **Request history** — tasks in `completed` or `cancelled` status, display only

Partner profile data (display name, service type, verification status) is loaded from `public.users`. KPI cards, today's schedule, and the AI insights section remain as hardcoded UI chrome (see Technical Debt).

---

### Authentication & Security

**Supabase Authentication**
`login.html` and `register.html` use Supabase Auth via `NauxicaSupabase.auth.signInWithPassword` and `signUp`. Sessions are persisted in `localStorage` by the Supabase JS client. All module scripts guard against unauthenticated access with a session check that redirects to `login.html` on failure. Logout clears `localStorage` keys and calls `auth.signOut()`.

**Homeowner RLS**
Homeowners can only select, insert, and update rows that belong to them. For `public.tasks`, the policy checks `EXISTS (SELECT 1 FROM public.properties WHERE id = tasks.property_id AND owner_id = auth.uid())`. For `public.conversations` and `public.messages`, the policy checks `owner_id = auth.uid()` (direct) or a subquery join to conversations.

**Partner RLS**
Partners can select and update tasks where `assigned_partner_id = auth.uid()`. The update `WITH CHECK` permits `assigned_partner_id = auth.uid() OR assigned_partner_id IS NULL` so that a decline can clear the assignment without violating the policy. Partners cannot insert tasks.

**Conversation RLS**
Three policies on `public.conversations`: homeowner select / insert / update, all scoped to `owner_id = auth.uid()`.

**Message RLS**
Three policies on `public.messages`: homeowner select / insert / update, all scoped via a subquery that verifies the parent conversation belongs to the authenticated user.

---

## Database Migrations

### Migration 001 — Conversations and Messages

**Purpose:** Establish the guest communication layer.

**Tables created:**
- `public.conversations` — one row per reservation, tracks status (open / resolved / archived), `last_message_at`, and `updated_at`
- `public.messages` — individual messages within a conversation, typed by `sender_type`

**Functions and triggers:**
- `public.set_updated_at()` — reusable trigger function, auto-updates `updated_at` on any UPDATE; reused by all subsequent migrations
- `public.update_conversation_last_message_at()` — AFTER INSERT on `public.messages`, propagates the new message timestamp to the parent conversation

**Policies applied:**
- `homeowner_select_conversations`, `homeowner_insert_conversations`, `homeowner_update_conversations`
- `homeowner_select_messages`, `homeowner_insert_messages`, `homeowner_update_messages`

**Current status:** Applied. Active in production. `messages.html` and `guest-detail.html` read and write against these tables.

---

### Migration 002 — Tasks

**Purpose:** Establish the operational task engine.

**Tables created:**
- `public.tasks` — full task record with `property_id`, `reservation_id` (nullable), `task_type`, `priority`, `status`, `assigned_partner_id` (nullable FK to `public.users`), `due_date`, `created_by`, `completed_at`

**Constraints:**
- `tasks_task_type_check`: `cleaning`, `maintenance`, `inspection`, `laundry`, `guest_request`, `other`
- `tasks_priority_check`: `low`, `normal`, `high`, `urgent`
- `tasks_status_check`: initially `open`, `assigned`, `in_progress`, `completed`, `cancelled` — extended by migration 004

**Functions and triggers:**
- `tasks_set_updated_at` — reuses `public.set_updated_at()`
- `public.set_completed_at()` — BEFORE UPDATE, sets `completed_at = now()` when transitioning to `completed`, clears it when transitioning away

**Policies applied:**
- `homeowner_select_tasks`, `homeowner_insert_tasks`, `homeowner_update_tasks`

**Current status:** Applied. Active in production. `tasks.html`, `operations.html`, `dashboard-homeowner.html`, and `dashboard-partner.html` all read and write against this table.

---

### Migration 003 — Partner RLS

**Purpose:** Enable partners to see and act on tasks assigned to them, and enable homeowners to discover available partners.

**Tables affected:**
- `public.tasks` — two new policies added
- `public.users` — RLS enabled; one new policy added

**Policies applied:**
- `partner_select_tasks`: partners can read tasks where `assigned_partner_id = auth.uid()`
- `partner_update_tasks`: partners can update tasks where `assigned_partner_id = auth.uid()`, WITH CHECK permitting NULL on the partner ID column (decline flow)
- `authenticated_read_partners`: any authenticated user can read rows from `public.users` where `account_type = 'partner'`; enables the partner select in `operations.html` and display name resolution in task joins

**Current status:** Applied. Active in production. Required for the partner dashboard and operations assignment centre to function.

---

### Migration 004 — Accepted Status Workflow

**Purpose:** Insert an explicit `accepted` status between `assigned` and `in_progress` to distinguish homeowner assignment (passive) from partner confirmation (active).

**Tables affected:**
- `public.tasks` — `tasks_status_check` constraint dropped and recreated

**Constraint before:**
```sql
CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled'))
```

**Constraint after:**
```sql
CHECK (status IN ('open', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled'))
```

**Policies affected:** None. The partner RLS policies operate on `assigned_partner_id`, not `status`, so no policy changes were required.

**Current status:** Applied. Active in production. All three dashboards and the operations centre reflect the new lifecycle.

---

## Current Task Lifecycle

```
open → assigned → accepted → in_progress → completed
                                          ↘ cancelled (from any active state)
assigned → open (decline: clears assigned_partner_id)
```

| Status | Set by | Where | Meaning |
|---|---|---|---|
| `open` | System (on create) | Task creation form | Task exists, no partner assigned |
| `assigned` | Homeowner | `operations.html` Assign button | Homeowner nominated a partner; partner not yet confirmed |
| `accepted` | Partner | `dashboard-partner.html` Accept button | Partner confirmed the job; not yet started |
| `in_progress` | Partner | `dashboard-partner.html` Start job button | Partner began execution |
| `completed` | Partner | `dashboard-partner.html` Complete button | Work finished; sets `completed_at` via trigger |
| `cancelled` | Homeowner | `tasks.html` status select | Task voided; removes from active views |
| `open` (reset) | Partner | `dashboard-partner.html` Decline button | Partner declined; clears `assigned_partner_id`, returns to pool |

---

## Current Architecture

### Frontend

Vanilla HTML/CSS/JS with no framework, no bundler, and no build step. Every page is a self-contained HTML file that loads shared resources via `<script src>` and `<link rel="stylesheet">`. Pages are opened directly in a browser or served from any static host.

Shared resources:
- `style.css` — full application stylesheet including layout, components, and dashboard-specific rules
- `nauxica-shared.js` — exposes `window.NauxicaShared` with: `resolveAccountType()`, `handleLogout()`, `renderNav()`, `setActivePage()`, `updateTopbar()`, `formatDateChip()`
- `nauxica-demo-data.js` — localStorage-backed mock store; being phased out as pages migrate to Supabase
- `supabase-client.js` — imports Supabase JS v2 from `esm.sh` and exposes `window.NauxicaSupabase`

Scripts that need Supabase load it as `<script type="module" src="supabase-client.js">` and then run their own `type="module"` inline script. Scripts that only need navigation use the sync IIFE pattern with `nauxica-shared.js`. Pages that mix both keep the module script separate from the sync IIFE to avoid blocking the navigation render.

### Supabase

- **Project URL:** `https://xhhcvpvemwsmmtjhbswa.supabase.co`
- **Client key type:** publishable (anon) key — safe to embed in client-side code
- **Auth:** Supabase Auth with email/password. Sessions managed by the Supabase JS client and stored in `localStorage`
- **Database:** Hosted Postgres. All application tables are in the `public` schema
- **Migrations:** Run manually via Supabase SQL Editor. Files stored in `migrations/` with sequential numbering

**Tables currently in use:**

| Table | Purpose |
|---|---|
| `public.users` | User profiles, account type, partner metadata |
| `public.properties` | Homeowner properties |
| `public.reservations` | Bookings linked to properties |
| `public.conversations` | One per reservation; guest communication thread |
| `public.messages` | Individual messages within conversations |
| `public.tasks` | Operational tasks linked to properties |

Pre-existing tables (present before the migrations in this sprint, not documented here in full):
`public.properties`, `public.reservations`, `public.users`

### Authentication

Auth state is established once per page in a module script guard:

```javascript
const { data: sessData } = await sb.auth.getSession();
if (!sessData.session) { window.location.replace('login.html'); throw 0; }
```

Account type (`homeowner` / `partner`) is resolved by reading `public.users.account_type` for the authenticated user's `id`. It is also cached in `localStorage` as `accountType` for use by the sync `NauxicaShared` nav rendering functions which cannot be async. The `throw 0` pattern is used for early exit inside `async` IIFEs in module scripts.

### RLS Model

Row-level security is enabled on all tables managed by the application migrations. The general model:

- **Homeowners** access their own data through ownership chains: `owner_id = auth.uid()` (direct) or `EXISTS (SELECT 1 FROM properties WHERE id = tasks.property_id AND owner_id = auth.uid())` (indirect via property)
- **Partners** access tasks through `assigned_partner_id = auth.uid()`
- **Partner visibility** is granted to all authenticated users via `authenticated_read_partners` to support the assignment select and display name resolution
- **No cross-tenant leakage:** a homeowner cannot see another homeowner's tasks, guests, or conversations; a partner cannot see tasks assigned to other partners

### Dashboard Structure

Two authenticated dashboard roots:

**`dashboard-homeowner.html`**
- Left sidebar with nav rendered by `NauxicaShared.renderNav()`
- KPI row: Properties, Active Reservations, Open Tasks, Occupancy Rate — all live from Supabase
- Arrivals & Departures card — live from `public.reservations`
- Messages card — live from `public.conversations`
- Tasks requiring attention — live from `public.tasks` (non-completed, non-cancelled), sortable by priority
- Live partner operations — live from `public.tasks` (assigned / accepted / in_progress)
- Properties overview — live from `public.properties`
- Action panel overlay: Create Task (Supabase insert), View Calendar, View Guests, Manage Availability

**`dashboard-partner.html`**
- Left sidebar with partner profile card (live from `public.users`) and static nav links
- KPI row — hardcoded demo values (today's jobs, upcoming jobs, earnings, rating)
- AI actions, schedule, earnings chart, service area — all static HTML
- Job requests / My jobs / History — live from `public.tasks` via `assigned_partner_id` query
- Notifications panel — `#partnerNotificationsList` renders empty (no notification system implemented)
- AI panel (FAB) — static UI chrome

---

## Technical Debt

**Pages still loading `nauxica-demo-data.js` unnecessarily**
`availability.html`, `calendar.html`, `guests.html`, `help.html`, `messages.html`, `properties.html`, `reservations.html` all include `<script src="nauxica-demo-data.js">` as a leftover tag. None of them actively call `NauxicaDemoData` methods (their data comes from Supabase), but the script still executes and initialises a localStorage store on every page load. Low risk; should be cleaned up.

**`reviews.html` reads from `NauxicaDemoData`**
The reviews page calls `window.NauxicaDemoData.loadState()` to populate the review list. No `public.reviews` table exists. This is the only page still genuinely dependent on demo data (outside the deferred shell pages).

**Partner dashboard KPI cards are hardcoded**
Today's jobs (5), upcoming jobs (8), earnings today (€380), and rating (4.9) are static HTML values in `dashboard-partner.html`. There is no query backing them.

**Partner dashboard schedule is hardcoded**
The "Today's schedule" card in `dashboard-partner.html` lists four static entries (Oceanview Villa, City Center Apartments, Sunset Villa, Riverside House). It is not derived from `public.tasks`.

**Partner dashboard notifications panel is empty**
`#partnerNotificationsList` renders empty. The old `renderPartnerNotifications()` function was removed when the demo layer was stripped, and no real notification system has been built to replace it.

**FAQ content is not database-driven**
`faq-viewer.html` contains hardcoded FAQ entries. There is no `faq_entries` table in Supabase. Content updates require editing the HTML file directly.

**i18n is incomplete**
Locale files exist for EN, IT, and ES (`locales/en.json`, `locales/it.json`, `locales/es.json`) and language switching is wired into `index.html`. No other page consumes the locale system. The faq-viewer renders English only despite being the primary multilingual content surface.

**Calendar is a 7-day strip only**
`calendar.html` renders a rolling 7-day view built from reservations. There is no monthly grid, no day-detail view, and no visual occupancy indicator beyond a single reservation row per day.

**`nauxica-wizard.js` is unused**
The file exists in the project root but is not referenced by any HTML page.

**Homeowner dashboard messages card is partially live**
The messages card in `dashboard-homeowner.html` shows conversation list data from Supabase but some inline message previews in the card may still fall back to static HTML for the empty state. The dedicated `messages.html` page is fully live.

**No `public.reviews` table**
Reviews are referenced in the UI (partner rating on the partner dashboard, `reviews.html`, partner nav link) but no table has been migrated and no RLS policies exist for review data.

**No homeowner policy on `public.users`**
Migration 003 enabled RLS on `public.users` and added a policy for reading partner rows. There is no explicit policy allowing homeowners to read their own user row. This may work today because the `authenticated_read_partners` policy with `account_type = 'partner'` would not block a homeowner reading their own row if Supabase falls back to an implicit self-read policy — but this should be made explicit.

---

## Deferred Features

These items are intentionally not implemented at MVP and have "coming soon" placeholder pages or sections:

| Feature | Status | Shell page |
|---|---|---|
| Revenue tracking | Deferred | `revenue.html` (empty state) |
| Marketplace | Deferred | `marketplace.html` (empty state) |
| Reports & analytics | Deferred | `reports.html` (empty state) |
| Notification system | Deferred | UI chrome exists; no delivery layer |
| Activity timeline | Deferred | Not started |
| AI concierge expansion | Deferred | `guestpal_whatsapp_conversation.html` prototype only |
| Earnings module (partner) | Deferred | Static chart in dashboard-partner.html |
| Performance metrics (partner) | Deferred | Static values in dashboard-partner.html |
| Push / email notifications | Deferred | Not started |
| Pricing agent | Deferred | Not started |
| Maintenance agent | Deferred | Not started |
| Marketplace agent / upsells | Deferred | Not started |

---

## Known Issues

**Notifications panel in `dashboard-partner.html` renders empty**
`#partnerNotificationsList` has no data source. It will always be blank until a notification system is implemented.

**No explicit self-read policy on `public.users` for homeowners**
Migration 003 enables RLS on `public.users` but only creates a policy for reading partner-type rows. If Supabase does not have an implicit "read own row" fallback for the authenticated user, homeowners may be unable to read their own profile. This needs a `CREATE POLICY "user_read_own" ON public.users FOR SELECT USING (id = auth.uid())` to be safe.

**`faq-viewer.html` FAQ type picker does not persist scroll position**
Switching between FAQ types (guest / homeowner / partner / concierge) reloads the fragment, resetting scroll to the top. This is a minor UX issue but noticeable in a long FAQ section.

**`nauxica-demo-data.js` initialises localStorage on every page load**
Even on pages that do not use it, the script writes an initial state object to `localStorage` if none exists. This is harmless but wasteful and could interfere with any future legitimate use of `localStorage` keys.

---

## Next Recommended Priorities

**1. Activity Timeline**
The homeowner and partner dashboards lack any audit or event trail. Every task status transition, message send, and guest action should be surfaced in a chronological timeline. This is the single highest-value feature for operator trust and accountability. Requires: a `public.timeline_events` table (or a view over existing tables), a migration, RLS, and a timeline card component on both dashboards.

**2. Reviews**
`reviews.html` is the only page still genuinely dependent on `NauxicaDemoData`. A `public.reviews` table (homeowner reviewing partner after task completion, guest reviewing property after checkout) would close the last demo dependency and unlock the partner quality score KPI. Requires: migration, RLS, review creation flow post task-completion.

**3. Revenue**
Revenue tracking unblocks homeowner financial reporting. This likely requires: a `public.payouts` or `public.transactions` table, property-level revenue aggregation from `public.reservations`, and a chart component in `revenue.html`. The partner earnings KPI in `dashboard-partner.html` would also become live.

**4. Marketplace**
The marketplace bidding model (task posted to all eligible partners, partners bid, homeowner selects) is the alternative to direct assignment. Direct assignment MVP is in place; marketplace is the scalability layer. Requires: significant schema additions, partner discovery logic, bid/offer tables, and a separate UI flow.

**5. AI Concierge Expansion**
`guestpal_whatsapp_conversation.html` exists as a prototype. Real AI concierge integration requires: a webhook endpoint, an LLM call layer (using the Claude API), conversation context injection from `public.reservations` and `public.properties`, and a delivery mechanism to WhatsApp or SMS.

---

## Definition of MVP Completion

**Current estimate: 62% complete**

| Domain | Weight | Completion | Weighted |
|---|---|---|---|
| Auth & security | 10% | 90% | 9.0% |
| Property management | 12% | 80% | 9.6% |
| Guest experience (messaging) | 12% | 85% | 10.2% |
| Task & operations | 14% | 95% | 13.3% |
| Partner workflow | 12% | 75% | 9.0% |
| Revenue & reporting | 8% | 5% | 0.4% |
| Reviews | 5% | 10% | 0.5% |
| Marketplace | 8% | 5% | 0.4% |
| AI concierge | 10% | 8% | 0.8% |
| Notifications & timeline | 9% | 5% | 0.5% |
| **Total** | **100%** | | **~54%** |

The task and operations domain is the strongest — direct assignment, the full five-stage lifecycle, and both dashboards are production-grade. Auth and property management are solid foundations. Guest messaging is functional end-to-end.

The estimate lands at approximately **55–60%** of total product scope. The headline domains that a short-term rental operator would need before using the product daily (properties, reservations, tasks, messages, partner coordination) are all working. The domains that would be needed before charging for the product (revenue, reviews, marketplace, AI) are deferred. The gap to a chargeable release is primarily in those four deferred domains plus notifications.
