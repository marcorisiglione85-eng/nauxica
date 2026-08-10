# Nauxica — Current Platform State

**Version:** 1.0
**Status:** Living document — update with each completed sprint
**Scope:** Feature/implementation reality as of 2026-08-10 (Sprint 030E.3B complete)
**Related:** [sprint-registry.md](sprint-registry.md) · [mvp-boundaries.md](mvp-boundaries.md) · [rbac.md](rbac.md) · [task-workspace.md](task-workspace.md) · [security-model.md](security-model.md)

> **Note:** `docs/architecture/mvp-status-june-2026.md` is a point-in-time snapshot from June 2026.
> This document supersedes it as the living current-state reference.

---

## Status Legend

| Status | Meaning |
|---|---|
| **Production-grade** | Schema applied, RLS enforced, production-verified, UI functional |
| **Built / not fully validated** | Implemented but not end-to-end verified against production, or pending a dependency |
| **Deployed** | Edge Function deployed; integration completeness varies |
| **UI only** | Frontend exists; no backend table or delivery layer |
| **Not built** | No schema, no Edge Function, no meaningful frontend implementation |
| **Legacy remnant** | Exists from prototype era; being phased out; must not be extended |

---

## Platform Identity

Nauxica is a production-backed hospitality operations SaaS for short-term rental homeowners and service partners (Sicily launch). The frontend is static HTML/CSS/Vanilla JS. The backend is Supabase (Postgres + GoTrue Auth + Storage + Edge Functions). There is no build step and no framework.

---

## Domain Status

### Auth

**Status: Production-grade**

- Supabase GoTrue (email + password, JWT sessions, refresh token rotation)
- `handle_new_user()` trigger: `AFTER INSERT ON auth.users` — creates `public.users` profile row
- Bug fixed in Sprint 030E.3B (2026-08-10): NULL metadata now resolved to `'homeowner'` via `COALESCE(NULLIF(...))` before enum cast; outer `EXCEPTION WHEN OTHERS` block removed to prevent split identity state
- `public.account_type` enum: two values — `homeowner`, `partner`
- Auth guard pattern on all pages: `sb.auth.getSession()` → redirect to `login.html` on failure
- Logout: `auth.signOut()` + clear `localStorage` keys
- Operator MFA: required per `docs/architecture/security-model.md` but not enforced by the platform at MVP (GoTrue MFA configuration required; not yet wired up)

**Migration:** `supabase/migrations/20260607000001_sprint1_core_schema.sql`
**Fix:** `supabase/migrations/20260810000001_sprint030e3b_fix_handle_new_user.sql`

---

### Properties

**Status: Production-grade**

- `public.properties`: UUID PK, `property_code` (`NAU-XXXXX`, server-generated sequence), `owner_id`, `platform_status`, `availability_status`, full property data fields
- RLS: homeowner SELECT/INSERT/UPDATE via `owner_id = auth.uid()`
- UI: `properties.html` (list), `property-detail.html` (detail + Knowledge Base editor + Emergency Data editor)
- Auth guard on all pages

**Pilot property verified in production:** Villa Chloe — `property_code = NAU-00003`

---

### Reservations

**Status: Production-grade**

- `public.reservations`: linked to properties via `property_id`, guest data fields (Alloggiati-aligned), `reservation_value_amount`, `reservation_value_currency`
- RLS: homeowner SELECT/INSERT/UPDATE via property ownership chain
- Partner RLS: partner can SELECT reservations linked to an assigned task (Sprint 029D.0)
- UI: `reservations.html` (list with status filter), `guest-detail.html` (guest context + inline messaging)
- Guest phone normalisation fixed: Sprint 030A area (commit `d602b95`)

---

### Guests / Conversations / Messages (Guest Domain)

**Status: Production-grade**

- `public.conversations`: one per reservation, `status` (open/resolved/archived), `last_message_at`
- `public.messages`: individual messages, `sender_type` (guest/ai/homeowner/partner/system), `is_read`
- RLS: homeowner-scoped via `owner_id = auth.uid()` on conversations; messages via parent conversation
- UI: `messages.html` (conversation list with status management), `guest-detail.html` (inline thread + send)
- `messages_update_last_message_at` trigger keeps `conversations.last_message_at` current
- Attention model: notification bell aligned to conversation attention state (commit `4c4eac2`)
- Session handoff: `session-handoff` Edge Function deployed; UI surfaces handoff state

**Migrations:** `migrations/001_conversations.sql`

---

### Tasks

**Status: Production-grade**

Six-state lifecycle enforced at the database level:

```
open → assigned → accepted → in_progress → completed
                                          ↘ cancelled (from any active state)
assigned → open (partner decline — clears assigned_partner_id)
```

- `public.tasks`: `property_id`, `reservation_id` (nullable), `task_type`, `priority`, `status`, `assigned_partner_id`, `due_date`, `created_by`, `completed_at` (trigger-set)
- `task_type` values: `cleaning`, `maintenance`, `inspection`, `laundry`, `guest_request`, `other`, `transfers`, `experiences` (extended Sprint 029C.1)
- `task_value_amount`, `task_value_currency` columns (Migration 006)
- Index on `assigned_partner_id` added Sprint 029C.1
- RLS: homeowner SELECT/INSERT/UPDATE via property ownership; partner SELECT/UPDATE via `assigned_partner_id`
- UI: `tasks.html` (homeowner list), `operations.html` (assignment centre), `dashboard-homeowner.html` (live operations card), `dashboard-partner.html` (job requests/my jobs/history)

**Migrations:** `migrations/002_tasks.sql`, `migrations/003_partner_rls.sql`, `migrations/004_accepted_status.sql`, `migrations/006_task_value.sql`, `supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql` (task_type extension + index)

---

### Task Evidence Checks

**Status: Production-grade**

- `public.task_evidence_checks`: keyed by `(task_id, check_key)` UNIQUE constraint, `is_checked`, `note`, `photo_id` (nullable FK to `task_photos`), `completed_at`, `completed_by`
- Check keys defined per task type in `nauxica-tasks.js` `EVIDENCE_CHECK_KEYS` map
- RLS: partner SELECT/INSERT/UPDATE (assigned only); homeowner SELECT (via property ownership chain); no DELETE for any authenticated user
- `set_updated_at` trigger on UPDATE

**Migration:** `supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql`

---

### Task Photos

**Status: Production-grade**

- `public.task_photos`: `task_id`, `uploaded_by`, `photo_type` (`before`/`after`/`issue`/`completion`/`other`), `storage_path`, `caption`
- RLS: partner SELECT + INSERT (assigned only, `uploaded_by = auth.uid()` enforced); homeowner SELECT (via property ownership); no UPDATE/DELETE for any authenticated user — append-only evidence model
- Storage path format: `{task_id}/{photo_id}.{ext}` — used inside `task-photos` bucket
- Signed URL viewing: `NauxicaTasks.openTaskPhoto()` → `createSignedUrl()` (300-second default expiry)
- Upload: `NauxicaStorage.uploadTaskPhoto()` → `NauxicaPhotos.attachTaskPhoto()` (coordinates Storage upload + `task_photos` INSERT + optional evidence check link)
- MIME types allowed: JPEG, PNG, WebP, HEIC, HEIF — 10 MB max per file

**Migration:** `supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql`

---

### Task Conversations (Operations Domain)

**Status: Production-grade**

Separate from the guest-facing conversations domain (`public.conversations`).

- `public.operations_conversations`: one per task (UNIQUE on `task_id`), `property_id`, `status` (open/resolved/archived), `last_message_at`
- `public.operations_messages`: `operations_conversation_id`, `sender_type` (`partner`/`ai`/`homeowner`/`system` — `guest` excluded by CHECK constraint), `message_text`, `is_read`
- RLS: partner SELECT + INSERT as `sender_type='partner'` (assigned task); homeowner SELECT + INSERT as `sender_type='homeowner'` (property ownership); `ai`/`system` messages written only by service_role (Edge Function, bypasses RLS)
- No UPDATE/DELETE policies on messages — append-only
- `timeline_events.operations_conversation_id` nullable FK added (Sprint 029C.2) for timeline linkage

**Migration:** `supabase/migrations/20260626000002_sprint029c_operations_conversations.sql`

---

### Timeline

**Status: Production-grade**

- `public.timeline_events`: `property_id`, `reservation_id`, `task_id`, `conversation_id`, `operations_conversation_id`, `actor_id`, `actor_type` (`homeowner`/`partner`/`guest`/`ai`/`system`), `event_type`, `event_title`, `event_description`, `metadata` (JSONB)
- RLS: homeowner SELECT via property/reservation/task/conversation chain; partner SELECT via assigned task or `actor_id = auth.uid()`; authenticated INSERT with `actor_id = auth.uid()` enforced
- Shared helper: `NauxicaTimeline.log()` — writes timeline events from any page, resolves `actor_id` from live session
- Operator SELECT policy added in Sprint 030E.2

**Migration:** `migrations/005_timeline.sql` (+ `operations_conversation_id` column added in Sprint 029C.2)

---

### Property Knowledge Blocks

**Status: Production-grade**

- `public.property_knowledge_blocks`: multi-row design, one row per `(property_id, block_type)` (UNIQUE), 14 canonical block types, `visibility_scope` (PUB/GST/PTR/INT), `content_jsonb`, `source_jsonb`, `is_active`
- RLS: homeowner SELECT/INSERT/UPDATE (own properties); partner SELECT limited to `visibility_scope IN ('PTR', 'GST')` for assigned-task properties (Sprint 029D.0); operator SELECT (Sprint 030E.2)
- Protected writes: `knowledge-writer` Edge Function (service_role — bypasses RLS for INSERT/UPDATE)
- UI: Knowledge Base editor on `property-detail.html`

**Migration:** `migrations/011_property_knowledge_blocks.sql`

---

### Emergency Data

**Status: Production-grade**

- `public.emergency_data`: per-property emergency procedures and contacts (gas/water/electricity shutoff, evacuation, hospital details, owner emergency contact)
- `public.emergency_contacts`: per-property contact registry, `guest_visible`, `ai_usable` flags
- RLS: homeowner SELECT (own properties); partner SELECT via assigned task (Sprint 029D.0); operator SELECT (Sprint 030E.2)
- Protected writes: `emergency-writer` Edge Function
- UI: Emergency Data editor on `property-detail.html`

**Migrations:** `migrations/012_emergency_data.sql`, `migrations/013_emergency_contacts.sql`

---

### Operator RBAC

**Status: Production-grade — verified in production (Sprint 030E.3)**

See [rbac.md](rbac.md) for full architecture documentation.

- `public.users.is_operator boolean NOT NULL DEFAULT false` — RBAC flag independent of `account_type`
- `guard_is_operator_column` BEFORE UPDATE trigger — blocks self-promotion by `authenticated` role
- `public.is_current_user_operator()` SECURITY DEFINER function — safe recursive read of `public.users`
- 10 operator SELECT policies across all operational tables
- `task-photos` storage operator SELECT policy
- No operator INSERT/UPDATE/DELETE policies — read-only at this stage
- Write denial verified in production: operator UPDATE on cross-owner task returns 0 rows

**Migrations:** `supabase/migrations/20260715000001_sprint030e1_operator_role_foundation.sql`, `supabase/migrations/20260715000002_sprint030e2_operator_read_policies.sql`

---

### Storage

**Status: Production-grade**

- Bucket: `task-photos` — private (`public = false`), no public URL access
- Path convention: `{task_id}/{photo_id}.{ext}` inside bucket
- Storage RLS: partner INSERT + SELECT (via assigned task); homeowner SELECT (via property ownership); operator SELECT (Sprint 030E.2); no DELETE for any authenticated role
- UUID-format regex guard on `storage.foldername(name)[1]` prevents cast errors on malformed paths
- Signed URL generation via Supabase JS client `createSignedUrl()`, 300-second default expiry

**Migration:** `supabase/migrations/20260628000001_sprint029e1_task_photos_storage_bucket.sql`

---

### Edge Functions

**Status: Deployed** (individual integration status varies)

| Function | Purpose | Status |
|---|---|---|
| `knowledge-writer` | Protected INSERT/UPDATE to `property_knowledge_blocks` | Production-grade |
| `emergency-writer` | Protected INSERT/UPDATE to `emergency_data` + `emergency_contacts` | Production-grade |
| `pricing-agent-scan` | Occupancy gap detection, revenue opportunity alerts | Deployed — functions against live data |
| `session-handoff` | WhatsApp session status transitions (active/escalated/waiting/closed) | Deployed |
| `concierge-inbound` | Live WhatsApp inbound webhook handler | Deployed — awaiting WhatsApp Business API connection |
| `concierge-inbound-sim` | Simulation/testing mode for concierge pipeline | Deployed |
| `concierge-resolver` | Phone → reservation resolver utilities | Deployed |
| `intro-scheduler` | Scheduled intro message delivery to guests | Deployed |
| `_shared` | Shared library (reply engine) used by concierge functions | Deployed |

---

### WhatsApp / AI Concierge

**Status: Built / not fully validated — awaiting external API connection**

- Full concierge pipeline implemented: inbound webhook → phone resolution → session management → KBB knowledge retrieval → LLM response generation → reply delivery
- `concierge-inbound` Edge Function deployed with idempotency guards
- `whatsapp_sessions` table tracks session state per phone+reservation pair
- Session statuses: `active`, `escalated`, `waiting`, `closed`
- Escalation model: 11 trigger codes defined in `docs/ai-concierge/escalation-rules.md`
- Twilio webhook events schema: Sprint 020A
- Guest phone E164 normalisation: Sprint 018A.1D
- **Blocker:** WhatsApp Business API account and phone number not yet registered with Meta; GDPR data processing agreement with Meta not yet signed

---

### Notifications

**Status: UI only — no delivery layer**

- Notification bell UI exists on homeowner dashboard (aligned to conversation attention model)
- No email, SMS, or push delivery infrastructure
- `docs/architecture/notification-system.md` defines the intended architecture

---

### Reviews

**Status: Not built**

- No `public.reviews` table
- `reviews.html` reads from `nauxica-demo-data.js` (last page genuinely dependent on demo data)
- No review creation flow
- Partner rating KPI on `dashboard-partner.html` is hardcoded static value

---

### Revenue

**Status: Not built**

- `revenue.html` is a shell page
- Revenue analytics UI exists on `reports.html` but is derived from live reservation data (not a dedicated transactions table)
- No `public.transactions` or `public.payouts` table

---

### Reports / Analytics

**Status: UI built against live data — limited scope**

- `reports.html`: homeowner reports dashboard with revenue chart (built from `public.reservations` data), business intelligence summaries, KPI metrics
- Pricing agent scan surfaced on `activity.html` and `dashboard-homeowner.html`
- No dedicated analytics tables; all derived from existing schema

---

### Marketplace

**Status: Not built**

- `marketplace.html` is a shell page
- No marketplace schema, no bidding model, no partner discovery flow beyond the operations assignment centre

---

### Settings / Operational Preferences

**Status: Production-grade**

- `settings.html`: profile integration, operational preferences
- `public.users.operational_preferences` (or equivalent column added in Sprint 026A)

---

## Database Migration Inventory

| Group | Files | Applied | Notes |
|---|---|---|---|
| Legacy (`migrations/`) | 001–007, 009–013 | Yes | Applied manually; no file 008 in repo |
| `supabase/migrations/` | 20260607–20260810 (12 files) | Yes | All applied to production |

Full ordered list in [sprint-registry.md](sprint-registry.md).

---

## Known Technical Debt

| Item | Impact | Notes |
|---|---|---|
| `nauxica-demo-data.js` leftover script tags | Low | Present on multiple pages that no longer call it; harmless but clutters page load |
| `reviews.html` reads NauxicaDemoData | Low | Last page genuinely dependent on demo data; blocked on reviews schema |
| Partner dashboard KPI cards hardcoded | Low | Static values for jobs/earnings/rating |
| Partner dashboard schedule card hardcoded | Low | Not derived from `public.tasks` |
| No explicit `users: select own record` homeowner policy | Medium | Migration 003 enables RLS on `public.users` and adds partner-read policy; homeowner self-read may rely on implicit Supabase behaviour |
| Calendar is 7-day strip only | Low | No monthly grid |
| `nauxica-wizard.js` unused | Low | File exists, not referenced |
| `docs/backend/database-schema.md` stale (v1.10) | Medium | Predates task_photos, task_evidence_checks, operations_conversations, is_operator column |
| `docs/backend/auth-strategy.md` stale | Low | Says "no operator dashboard" — RBAC now implemented |
| `docs/agent-ops/phase-control-log.md` stale | Low | Now corrected with current-state section |

---

## What Should NOT Be Built Next Without Human Decision

The following are plausible next work items but require explicit human approval and Architect planning before implementation begins:

- **Operator UI** — RBAC foundation exists; UI scope and information architecture not defined
- **Reviews** — schema design requires product decisions on who reviews whom and when
- **WhatsApp Business API connection** — requires external account registration and legal sign-off
- **Notification delivery** — external provider selection required
- **Revenue / payouts** — requires payment model decisions before schema
- **Marketplace** — significant schema additions; bidding model not designed
