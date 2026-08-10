# Nauxica — Sprint Registry

**Version:** 1.0
**Last updated:** 2026-08-10 (Sprint 030E.3B complete)
**Purpose:** Canonical ordered record of every sprint (or migration unit) applied to the Nauxica production database, with status and commit cross-references.

> **Warning:** This document is a snapshot in time. Always verify applied migrations against the actual `supabase/migrations/` directory and the Supabase dashboard before applying or writing new migrations.

---

## Legend

| Field | Meaning |
|---|---|
| Sprint ID | Canonical ID used in migration filenames and commit messages |
| Name / Objective | What the sprint did |
| Migration file(s) | File(s) in `migrations/` or `supabase/migrations/` |
| Commit | Git commit hash (first 7 chars) and message |
| Status | Complete / Partial / Historical record only |
| Notes | Verification status, known issues, relevant caveats |

---

## Era 1: Legacy Prototype Migrations (`migrations/` directory)

These were applied manually during the prototype-to-production transition. No `supabase db push` workflow was in place at this time. The files exist in the repo and are authoritative for their schema; they cannot be re-applied.

| # | Sprint / Unit | Migration File | Commit | Status | Notes |
|---|---|---|---|---|---|
| 001 | Core conversations + messages schema | `migrations/001_conversations.sql` | early history | Complete | `public.conversations`, `public.messages` |
| 002 | Task schema foundation | `migrations/002_tasks.sql` | early history | Complete | `public.tasks`, initial RLS |
| 003 | Partner RLS | `migrations/003_partner_rls.sql` | early history | Complete | RLS on `public.users`, partner-read policy |
| 004 | Task `accepted` status | `migrations/004_accepted_status.sql` | early history | Complete | Added `accepted` to task status enum |
| 005 | Timeline events | `migrations/005_timeline.sql` | early history | Complete | `public.timeline_events`, homeowner/partner SELECT + authenticated INSERT policies |
| 006 | Task value | `migrations/006_task_value.sql` | early history | Complete | `task_value_amount`, `task_value_currency` columns |
| 007 | (Unknown label) | `migrations/007_*.sql` | early history | Historical record only | Content not audited in Phase 2B |
| 008 | (Missing) | — | — | File absent from repo | No `migrations/008_*.sql` in repository |
| 009 | (Unknown label) | `migrations/009_*.sql` | early history | Historical record only | |
| 010 | (Unknown label) | `migrations/010_*.sql` | early history | Historical record only | |
| 011 | Property knowledge blocks | `migrations/011_property_knowledge_blocks.sql` | `42c47ce` Add property concierge knowledge and emergency modules | Complete | `public.property_knowledge_blocks`, 14 block types, visibility_scope PUB/GST/PTR/INT |
| 012 | Emergency data | `migrations/012_emergency_data.sql` | `42c47ce` | Complete | `public.emergency_data` |
| 013 | Emergency contacts | `migrations/013_emergency_contacts.sql` | `42c47ce` | Complete | `public.emergency_contacts`, `guest_visible`, `ai_usable` flags |

---

## Era 2: `supabase/migrations/` directory

Applied via `supabase db push` from this point forward. Filenames encode apply order chronologically.

### Sprint 1 — Core Schema

| Sprint ID | Sprint 1 |
|---|---|
| **Name** | Core Supabase backend schema |
| **Objective** | Establish production Supabase schema with GoTrue auth integration |
| **Migration** | `supabase/migrations/20260607000001_sprint1_core_schema.sql` |
| **Commit** | `3d228fa feat: consolidate supabase MVP workflows` (approximately; may be earlier) |
| **Status** | Complete |
| **Notes** | Includes `handle_new_user()` trigger, `public.account_type` enum (`homeowner`, `partner`), `public.nauxica_plan_tier` enum, `public.users` table, `on_auth_user_created` trigger binding |

---

### Sprint 018A.1D — Guest Phone E164 Constraints

| Sprint ID | 018A.1D |
|---|---|
| **Name** | Guest phone E164 normalisation |
| **Objective** | Add E164 format constraint to guest phone number fields; phone verification gate |
| **Migration** | `supabase/migrations/20260611000001_sprint018a1d_guest_phone_e164_constraints.sql` |
| **Commit** | `a982d9e feat: Sprint 018A.1D guest phone verification gate` |
| **Status** | Complete |
| **Notes** | `d602b95` (fix: normalize guest phone numbers) is a later related fix |

---

### Sprint 020A — Twilio Webhook Events

| Sprint ID | 020A |
|---|---|
| **Name** | Twilio webhook events schema |
| **Objective** | Schema support for logging Twilio inbound webhook events (WhatsApp) |
| **Migration** | `supabase/migrations/20260622000001_sprint020a_twilio_webhook_events.sql` |
| **Commit** | Part of the concierge pipeline sprint series (commits around `20a0b8d`) |
| **Status** | Complete |
| **Notes** | Part of the WhatsApp concierge pipeline; underlying schema is production-applied even though WhatsApp Business API is not yet connected |

---

### Sprint 026A — Operational Preferences

| Sprint ID | 026A |
|---|---|
| **Name** | Operational preferences |
| **Objective** | Add operational preferences column(s) to `public.users` |
| **Migration** | `supabase/migrations/20260624000001_sprint026a_operational_preferences.sql` |
| **Commit** | `2444fdb feat(settings): add operational preferences and profile integration` |
| **Status** | Complete |
| **Notes** | Powers `settings.html` user preferences UI |

---

### Sprint 027D.2G — Partner Properties Read

| Sprint ID | 027D.2G |
|---|---|
| **Name** | Partner properties read access |
| **Objective** | Allow partners to SELECT property records for their assigned tasks |
| **Migration** | `supabase/migrations/20260625000001_sprint027d2g_partner_properties_read.sql` |
| **Commit** | `4c34f7f fix(partner): enable property names via RLS policy and redesign job cards` |
| **Status** | Complete |
| **Notes** | Required for partner dashboard to resolve property names on job cards |

---

### Sprint 029C.1 — Task Evidence Schema

| Sprint ID | 029C.1 |
|---|---|
| **Name** | Task evidence schema |
| **Objective** | Create `task_photos` and `task_evidence_checks` tables; extend `task_type` enum with `transfers` and `experiences` |
| **Migration** | `supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql` |
| **Commit** | `bfeca35 feat(partner): add task evidence schema` |
| **Status** | Complete — production-verified |
| **Notes** | Append-only evidence model (no UPDATE/DELETE policies on photos). Adds index on `tasks.assigned_partner_id`. |

---

### Sprint 029C.2 — Operations Conversations Schema

| Sprint ID | 029C.2 |
|---|---|
| **Name** | Operations conversations and messages |
| **Objective** | Create `operations_conversations` and `operations_messages` tables for internal partner/homeowner/AI task messaging |
| **Migration** | `supabase/migrations/20260626000002_sprint029c_operations_conversations.sql` |
| **Commit** | `4d13da0 feat(partner): add operations conversations schema` |
| **Status** | Complete — production-verified |
| **Notes** | `guest` excluded from `sender_type` at CHECK level. `ai`/`system` messages via service_role only. Adds `operations_conversation_id` FK column to `timeline_events`. |

---

### Sprint 029D.0 — Partner Context Read

| Sprint ID | 029D.0 |
|---|---|
| **Name** | Partner context read access |
| **Objective** | Allow assigned partners to read reservations, knowledge blocks (PTR/GST scope), emergency data, and emergency contacts for tasks assigned to them |
| **Migration** | `supabase/migrations/20260626000003_sprint029d0_partner_context_read.sql` |
| **Commit** | `d11991b feat(partner): allow assigned partners to read job context` |
| **Status** | Complete |
| **Notes** | Knowledge blocks limited to `visibility_scope IN ('PTR', 'GST')` — partners cannot read internal (INT) blocks |

---

### Sprint 029E.1 — Task Photos Storage Bucket

| Sprint ID | 029E.1 |
|---|---|
| **Name** | Task photos private storage bucket |
| **Objective** | Create `task-photos` storage bucket and RLS policies for partner INSERT + homeowner/partner SELECT |
| **Migration** | `supabase/migrations/20260628000001_sprint029e1_task_photos_storage_bucket.sql` |
| **Commit** | `1ad7688 feat(partner): add optional issue photo upload` (first photo upload UI) |
| **Status** | Complete — production-verified |
| **Notes** | UUID regex guard prevents cast errors on malformed storage paths. Bucket remains private (no public URL). |

---

### Sprint 030E.1 — Operator Role Foundation

| Sprint ID | 030E.1 |
|---|---|
| **Name** | Operator RBAC role foundation |
| **Objective** | Add `is_operator boolean` column to `public.users`; add `guard_is_operator_column` BEFORE UPDATE trigger to block self-promotion |
| **Migration** | `supabase/migrations/20260715000001_sprint030e1_operator_role_foundation.sql` |
| **Commit** | `7af1d83 feat(rbac): add operator role foundation` |
| **Status** | Complete — production-verified |
| **Notes** | Trigger is NOT SECURITY DEFINER (required for `current_user = 'authenticated'` check to work correctly). Column-level REVOKE was considered and rejected — table-level GRANT UPDATE supersedes it. |

---

### Sprint 030E.2 — Operator Read Policies

| Sprint ID | 030E.2 |
|---|---|
| **Name** | Operator read-only RLS policies |
| **Objective** | Add `is_current_user_operator()` SECURITY DEFINER helper; add 10 SELECT-only RLS policies for operator cross-platform read access |
| **Migration** | `supabase/migrations/20260715000002_sprint030e2_operator_read_policies.sql` |
| **Commit** | `83a407c feat(rbac): add operator read policies` |
| **Status** | Complete — production-verified |
| **Notes** | All policies idempotent (IF NOT EXISTS). SECURITY DEFINER helper required to break RLS recursion on `public.users` SELECT policy. Storage policy scoped to `task-photos` bucket only. |

---

### Sprint 030E.3 — Operator RBAC Verification

| Sprint ID | 030E.3 |
|---|---|
| **Name** | Operator RBAC production verification |
| **Objective** | Verify all RBAC properties in production via SQL Editor transaction-wrapped simulations (ROLLBACK after each test). Create RBAC test fixture (test property + task owned by second homeowner). |
| **Migration** | None — verification sprint only; test fixture created via SQL Editor, not persisted to repo files |
| **Commit** | None (no commit for fixture SQL) |
| **Status** | Complete — all 5 test blocks PASS (2026-08-10) |
| **Notes** | Tests: (A) operator global SELECT, (B) homeowner isolation, (C) partner isolation, (D) storage SELECT, (E) write denial. No test UUIDs written to repository files. RBAC fixture (test property + task + orphaned auth user) remains in production pending cleanup. |

---

### Sprint 030E.3B — Auth Provisioning Fix

| Sprint ID | 030E.3B |
|---|---|
| **Name** | `handle_new_user()` hardening |
| **Objective** | Fix split identity state caused by NULL metadata silently returning NULL on enum cast, swallowed by outer EXCEPTION WHEN OTHERS |
| **Migration** | `supabase/migrations/20260810000001_sprint030e3b_fix_handle_new_user.sql` |
| **Commit** | `73fed8b fix(auth): harden new user profile provisioning` |
| **Status** | Complete — production-verified |
| **Notes** | Fix 1: `COALESCE(NULLIF(raw_user_meta_data->>'account_type', ''), 'homeowner')::public.account_type`. Fix 4 (design change): outer `EXCEPTION WHEN OTHERS` block removed entirely — split identity state is more dangerous than a visible creation failure. Orphaned test user from Sprint 030E.3A fixture NOT repaired by this migration (separate cleanup action). |

---

## Sprints Without Dedicated Migrations (Frontend / Edge Function Sprints)

The following development units are reflected in git commits and may have associated architecture documents, but they required no Supabase schema migration. The sprint ID assignments are approximate based on commit message context.

| Approximate Sprint | Description | Key Commits |
|---|---|---|
| Sprint 012C | Concierge context engine | `a865be8` |
| Sprint 014A | Intro scheduler manual trigger | `91b9424`, `d9edfbd` |
| Sprint 014B | Tick mode + session closure | `9bdcbf7` |
| Sprint 015A | Delivery adapter | `776d132` |
| Sprint 017B | AI visibility in frontend UI | `ffe6e96` |
| Sprint 018A.1D (UI) | WhatsApp pipeline + idempotency | `20a0b8d` |
| Session handoff | Session handoff Edge Function + UI | `3b129b6` |
| Task workspace refactor | Extract shared task workspace JS helpers | `b8ea423` |
| Sprint 030A (estimated) | Pricing agent scan Edge Function + activity feed | `947445f`, `2f000de` |
| Sprint 030B (estimated) | AI insights + knowledge gap detection | `ee3a5db`, `8a2b36d`, `e4d65e3` |
| Sprint 030C (estimated) | Reports MVP + attention model | `e288afd`, `633a097`, `4c4eac2` |

> **Note on sprint IDs in the "estimated" rows:** Sprint boundary commits in this range were not tagged with sprint IDs in the commit messages. The mappings above are inferences from commit order and content — treat them as historical approximations, not canonical records.

---

## Cleanup Pending

The following actions are outstanding and require human execution (no code changes):

| Action | Method | Blocker |
|---|---|---|
| Delete RBAC Test Property and RBAC Isolation Test Task | Supabase SQL Editor — direct DELETE (confirm fixture no longer needed first) | Human approval required |
| Delete `graziellaensabella@yahoo.it` orphaned auth user | Supabase Auth Admin UI — delete the auth.users row only | Do NOT attempt to repair/re-provision; the public.users row does not exist |
| Verify/revert founder `is_operator` flag | Supabase SQL Editor — check current value; revert to `false` if left `true` after testing | Human decision required |
