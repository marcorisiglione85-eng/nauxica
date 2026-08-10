# Nauxica — Task Workspace Architecture

**Version:** 1.0
**Sprints:** 029C.1, 029C.2, 029D.0, 029E.1 (schema) · b8ea423 (helpers refactor) · multiple UI commits
**Status:** Production-grade — task workspace fully implemented for both Partner and Homeowner roles
**Related:** [current-state.md](current-state.md) · [rbac.md](rbac.md) · [data-visibility-model.md](data-visibility-model.md) · [partner-assignment-model.md](partner-assignment-model.md)

---

## Purpose

The task workspace is the set of tables, Storage bucket, Edge Function integrations, shared JS helpers, and UI pages that together constitute the operational workspace for a task: evidence collection, photo uploads, internal messaging, and audit timeline. This document describes the complete architecture — data model, RLS boundaries, shared JS helpers, and what is explicitly not implemented.

---

## Task Lifecycle

Six states, enforced at the database level:

```
open → assigned → accepted → in_progress → completed
         ↘                              ↘
          open (partner decline)         cancelled (from any active state)
```

| Status | Who may write | Notes |
|---|---|---|
| `open` | Homeowner (via INSERT or partner decline UPDATE) | `assigned_partner_id` is NULL |
| `assigned` | Homeowner (via UPDATE) | Sets `assigned_partner_id` |
| `accepted` | Partner (via UPDATE) | Partner confirms the assignment |
| `in_progress` | Partner (via UPDATE) | Work started |
| `completed` | Partner (via UPDATE) | Triggers `completed_at` timestamp |
| `cancelled` | Homeowner or Partner (via UPDATE) | Clears `assigned_partner_id` |

**"Task is the security gate" pattern:** All access to task-related tables — `task_photos`, `task_evidence_checks`, `operations_conversations`, `operations_messages`, and `storage.objects` — resolves through either:
- `tasks.assigned_partner_id = auth.uid()` (partner access path)
- `tasks.property_id → properties.owner_id = auth.uid()` (homeowner access path)

---

## Task Evidence Checks

### Schema

```sql
public.task_evidence_checks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id           uuid NOT NULL REFERENCES public.tasks(id),
  check_key         text NOT NULL,
  is_checked        boolean NOT NULL DEFAULT false,
  note              text,
  photo_id          uuid REFERENCES public.task_photos(id),
  completed_at      timestamptz,
  completed_by      uuid REFERENCES public.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, check_key)
)
```

### Check Keys by Task Type (`EVIDENCE_CHECK_KEYS` in `nauxica-tasks.js`)

| Task type | Check keys |
|---|---|
| `cleaning` | `before_condition`, `linens_replaced`, `amenities_restocked`, `final_walkthrough` |
| `maintenance` | `issue_documented`, `repair_attempted`, `parts_required`, `owner_notified` |
| `laundry` | `items_collected`, `items_returned` |
| `transfers` | `guest_met`, `luggage_handled` |
| `experiences` | `guest_briefed`, `activity_confirmed` |
| `guest_request` | `request_fulfilled`, `guest_confirmed` |
| `other` | `action_taken`, `outcome_documented` |

`inspection` task type is not in `EVIDENCE_CHECK_KEYS` — no predefined check structure.

### RLS Boundaries

| Operation | Who | Condition |
|---|---|---|
| SELECT | Partner | `task.assigned_partner_id = auth.uid()` |
| SELECT | Homeowner | `task.property_id → property.owner_id = auth.uid()` |
| SELECT | Operator | `is_current_user_operator()` (Sprint 030E.2) |
| INSERT | Partner only | `task.assigned_partner_id = auth.uid()` |
| UPDATE | Partner only | `task.assigned_partner_id = auth.uid()` |
| DELETE | Nobody | No policy exists — append-only evidence |

`set_updated_at` trigger fires on every UPDATE to keep `updated_at` current.

The `photo_id` FK links an evidence check to a specific photo uploaded for it. Set via `NauxicaPhotos.attachTaskPhoto()` when `evidenceCheckId` is passed.

---

## Task Photos

### Schema

```sql
public.task_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES public.tasks(id),
  uploaded_by   uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  photo_type    text NOT NULL CHECK (photo_type IN ('before', 'after', 'issue', 'completion', 'other')),
  storage_path  text NOT NULL,
  caption       text,
  created_at    timestamptz NOT NULL DEFAULT now()
)
```

### RLS Boundaries

| Operation | Who | Condition |
|---|---|---|
| SELECT | Partner | `task.assigned_partner_id = auth.uid()` |
| SELECT | Homeowner | `task.property_id → property.owner_id = auth.uid()` |
| SELECT | Operator | `is_current_user_operator()` (Sprint 030E.2) |
| INSERT | Partner only | `task.assigned_partner_id = auth.uid()` AND `uploaded_by = auth.uid()` |
| UPDATE | Nobody | No policy — append-only evidence |
| DELETE | Nobody | No policy — append-only evidence |

`uploaded_by` is always resolved from the live session inside `NauxicaPhotos.attachTaskPhoto()` — it is never accepted from a caller argument.

---

## Storage: `task-photos` Bucket

- Bucket name: `task-photos`
- Visibility: private (`public = false`)
- Path convention: `{task_id}/{photo_id}.{ext}` where `{photo_id}` matches the `task_photos.id` UUID

### Storage RLS

| Operation | Who | Condition |
|---|---|---|
| SELECT | Partner | `task.assigned_partner_id = auth.uid()` via UUID path join |
| SELECT | Homeowner | `task.property_id → property.owner_id = auth.uid()` via UUID path join |
| SELECT | Operator | `bucket_id = 'task-photos' AND is_current_user_operator()` (Sprint 030E.2) |
| INSERT | Partner only | `task.assigned_partner_id = auth.uid()` via UUID path join |
| UPDATE | Nobody | No policy |
| DELETE | Nobody | No policy |

**UUID regex guard:** Before any `::uuid` cast on the path segment, a regex guard verifies the format: `(storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`. This prevents `invalid_text_representation` errors on malformed paths.

---

## Signed URL Viewing

Photos cannot be accessed via public URL (bucket is private). All photo access goes through signed URLs with a limited lifetime.

```js
// NauxicaTasks.openTaskPhoto(photoId, taskId)
const { data, error } = await sb.storage
  .from('task-photos')
  .createSignedUrl(`${taskId}/${photoId}.jpg`, 300);
```

Default expiry: 300 seconds. After expiry, a new signed URL must be generated. The caller controls expiry via an optional parameter.

---

## Shared JS Helpers

All shared helpers load `SUPABASE_URL` and `SUPABASE_ANON_KEY` from `nauxica-config.js` and initialise a Supabase client. They expect an authenticated session from `supabase.auth.getSession()`.

### `nauxica-tasks.js` — `NauxicaTasks`

Responsibilities:
- `EVIDENCE_CHECK_KEYS` map (check key definitions per task type)
- `openTaskPhoto(photoId, taskId, expirySeconds?)` → signed URL generation
- Task lifecycle update methods

### `nauxica-storage.js` — `NauxicaStorage`

Responsibilities:
- `uploadTaskPhoto(taskId, photoId, file)` — uploads a File to `task-photos` bucket
  - Validates MIME type: JPEG, PNG, WebP, HEIC, HEIF only
  - Validates file size: 10 MB maximum
  - Path: `{taskId}/{photoId}.{ext}`

### `nauxica-photos.js` — `NauxicaPhotos`

Responsibilities:
- `attachTaskPhoto(taskId, file, photoType, caption?, evidenceCheckId?)` — the coordinating method:
  1. Generates a UUID for the new photo (`photoId`)
  2. Calls `NauxicaStorage.uploadTaskPhoto(taskId, photoId, file)` → storage upload
  3. Calls `sb.from('task_photos').insert(...)` → metadata row in `task_photos`
  4. If `evidenceCheckId` is provided, calls `sb.from('task_evidence_checks').update({ photo_id: photoId })` to link evidence check to photo
  5. On `metadata_insert_failed`: attempts best-effort `storage.remove()` cleanup before throwing
- `uploaded_by` is always resolved from `supabase.auth.getSession()` inside the function — never from a caller-provided argument

### `nauxica-timeline.js` — `NauxicaTimeline`

Responsibilities:
- `log({ propertyId, reservationId?, taskId?, conversationId?, operationsConversationId?, actorType, eventType, eventTitle, eventDescription?, metadata? })` → inserts a row into `public.timeline_events`
- Resolves `actor_id` from `supabase.auth.getSession()` — never from a caller argument

---

## Operations Conversations

One per task. The `operations_conversations` domain is separate from the guest-facing `conversations` domain.

### Schema

```sql
public.operations_conversations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL UNIQUE REFERENCES public.tasks(id),
  property_id   uuid NOT NULL REFERENCES public.properties(id),
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
  last_message_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
)
```

The UNIQUE constraint on `task_id` enforces one conversation per task. `last_message_at` is updated by the application layer (no trigger) when a message is sent.

### RLS Boundaries

| Operation | Who | Condition |
|---|---|---|
| SELECT | Partner | `task.assigned_partner_id = auth.uid()` via `task_id` join |
| SELECT | Homeowner | `property_id → property.owner_id = auth.uid()` |
| SELECT | Operator | `is_current_user_operator()` |
| INSERT | Partner or Homeowner | Via their respective conditions |
| UPDATE | Partner or Homeowner | Via their respective conditions |
| DELETE | Nobody | No policy |

---

## Operations Messages

```sql
public.operations_messages (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_conversation_id  uuid NOT NULL REFERENCES public.operations_conversations(id),
  sender_type                 text NOT NULL CHECK (sender_type IN ('partner', 'ai', 'homeowner', 'system')),
  message_text                text NOT NULL,
  is_read                     boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now()
)
```

`guest` is explicitly excluded from `sender_type` at the CHECK constraint level — guest communications go through `public.messages` (the guest domain), not here.

### RLS Boundaries

| Operation | Who | Allowed `sender_type` | Condition |
|---|---|---|---|
| SELECT | Partner | Any | `conversation → task.assigned_partner_id = auth.uid()` |
| SELECT | Homeowner | Any | `conversation → task.property_id → property.owner_id = auth.uid()` |
| SELECT | Operator | Any | `is_current_user_operator()` |
| INSERT | Partner | `'partner'` only (WITH CHECK) | `conversation → task.assigned_partner_id = auth.uid()` |
| INSERT | Homeowner | `'homeowner'` only (WITH CHECK) | `conversation → task.property_id → property.owner_id = auth.uid()` |
| INSERT | service_role | `'ai'` or `'system'` | Bypasses RLS — Edge Function only |
| UPDATE | Nobody | — | No policy |
| DELETE | Nobody | — | No policy |

Messages are append-only. No authenticated role can update or delete a message after it is sent.

---

## Timeline Integration

`public.timeline_events` tracks all significant state changes in the task lifecycle. The `operations_conversation_id` nullable FK column was added in Sprint 029C.2.

Events are written by the frontend (`NauxicaTimeline.log()`) and by Edge Functions (service_role). Typical task workspace events:

- Task status transitions (accepted, in_progress, completed, cancelled)
- Evidence check completion
- Photo uploads
- Conversation opened, message sent
- Issue reported

All timeline writes enforce `actor_id = auth.uid()` via RLS WITH CHECK — the actor is always resolved from the live session, never accepted from application-layer input.

---

## Homeowner Task Workspace

**Page:** `homeowner-task-detail.html`

**Capabilities:**
- View task metadata (type, priority, status, due date, assigned partner)
- View assigned partner profile context (name, service types)
- View evidence checks (read-only summary of partner-submitted checks)
- View task photos (signed URL viewer)
- View operations conversation thread
- Send operations messages (`sender_type = 'homeowner'`)
- Mark task as completed (confirmation control)
- Timeline visible in the task context

**Read/write boundary:** Homeowner can read all task workspace data for tasks on their properties. Homeowner can write operations messages and advance task status (completion/cancellation) but cannot write evidence checks or upload photos.

---

## Partner Task Workspace

**Page:** `partner-job-detail.html`

**Capabilities:**
- View task details (job type, property, reservation context, due date)
- Lifecycle actions: accept → start → complete (status transitions via UPDATE)
- Report issues (issue photo upload with `photo_type = 'issue'`)
- Evidence check form (per task type, with `EVIDENCE_CHECK_KEYS` map)
- Photo uploads: before/after/issue/completion types (via `NauxicaPhotos.attachTaskPhoto()`)
- Photo viewer (signed URLs via `NauxicaTasks.openTaskPhoto()`)
- Operations conversation thread (send/receive)
- Timeline refresh after each lifecycle action

**Read/write boundary:** Partner can read all task workspace data for tasks where `assigned_partner_id = auth.uid()`. Partner writes evidence checks (INSERT + UPDATE), uploads photos (INSERT only), and sends operations messages (`sender_type = 'partner'`). Partner cannot modify task metadata, access other partners' tasks, or see properties they are not assigned to.

---

## Read/Write Summary by Role and Resource

| Resource | Homeowner (own property) | Partner (assigned task) | Operator | service_role |
|---|---|---|---|---|
| `tasks` | SELECT / INSERT / UPDATE | SELECT / UPDATE (status only) | SELECT | All |
| `task_evidence_checks` | SELECT | SELECT / INSERT / UPDATE | SELECT | All |
| `task_photos` | SELECT | SELECT / INSERT | SELECT | All |
| `task-photos` storage | SELECT | SELECT / INSERT | SELECT | All |
| `operations_conversations` | SELECT / INSERT / UPDATE | SELECT / INSERT / UPDATE | SELECT | All |
| `operations_messages` | SELECT / INSERT (homeowner type) | SELECT / INSERT (partner type) | SELECT | All (ai/system types) |
| `timeline_events` | SELECT / INSERT | SELECT / INSERT | SELECT | All |

---

## What Is NOT Implemented in the Task Workspace

| Feature | Status | Notes |
|---|---|---|
| Photo DELETE | Not built | Intentional — append-only evidence model |
| Evidence check DELETE | Not built | Intentional — append-only evidence model |
| Message editing / deletion | Not built | Append-only |
| Homeowner photo upload | Not built | Only partners upload task photos |
| AI messages from Edge Function | Deployed / partial | `sender_type = 'ai'` is allowed by schema; no Edge Function currently writes to `operations_messages` |
| System messages | Not built | `sender_type = 'system'` is allowed by schema; no automated system currently writes them |
| Partner adding new evidence check keys | Not built | Keys are defined statically in `EVIDENCE_CHECK_KEYS`; no UI for custom keys |
| Task reassignment | Not built | No workflow for moving a task from one partner to another while preserving evidence |
| Real-time updates (Supabase Realtime) | Not built | Pages currently require manual refresh to see new messages or evidence |
| Notification delivery on new message | Not built | No delivery layer exists; UI-only notification bell |
