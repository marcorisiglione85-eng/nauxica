# Nauxica — Operator RBAC Architecture

**Version:** 1.0
**Sprint:** 030E.1 + 030E.2 (schema + policies) · 030E.3 (verification) · 030E.3B (auth provisioning fix)
**Status:** Production-grade — verified in production 2026-08-10
**Related:** [current-state.md](current-state.md) · [security-model.md](security-model.md) · [data-visibility-model.md](data-visibility-model.md)

---

## Purpose

An Operator is a Nauxica staff member who needs cross-platform read access to all operational task data — across all homeowners, properties, and partners. This document describes the complete RBAC design: the identity flag, the self-promotion guard, the helper function, all ten SELECT policies, the storage policy, and the write-denial model.

---

## Design Decision: Boolean Flag, Not Enum Extension

`public.account_type` is a PostgreSQL enum with values `homeowner` and `partner`. A third value (`operator`) was considered and rejected for the following reasons:

1. **Live schema risk.** `ALTER TYPE … ADD VALUE` on a production enum referenced by `handle_new_user()`, all existing RLS policies, and multiple client-side conditionals has a high blast radius.
2. **Operator is additive.** An operator retains their underlying account type. A homeowner can be promoted to operator without losing their homeowner view. A separate enum value would conflate role with privilege.
3. **Migration safety.** Adding a boolean column with `ADD COLUMN IF NOT EXISTS` and a safe default is fully idempotent and has zero blast radius.

**Resolution:** `public.users.is_operator boolean NOT NULL DEFAULT false`

---

## Column: `public.users.is_operator`

```sql
is_operator boolean NOT NULL DEFAULT false
```

Added in Sprint 030E.1 (`20260715000001_sprint030e1_operator_role_foundation.sql`) using `ADD COLUMN IF NOT EXISTS`.

- Default: `false` for all existing and new users
- Type: boolean — no nullable ambiguity
- NOT NULL: explicit, no NULL state
- Administrative write: service_role only (direct SQL or trusted tooling)
- `handle_new_user()` trigger does not set this column — new accounts always start as non-operator

---

## Self-Promotion Guard: `guard_is_operator_column`

**Problem:** PostgreSQL table-level `GRANT UPDATE ON public.users TO authenticated` supersedes any column-level `REVOKE`. An `authenticated` user could call `UPDATE public.users SET is_operator = true WHERE id = auth.uid()` and the column-level revoke would not block it.

**Solution:** A `BEFORE UPDATE` trigger function that inspects the proposed row change and aborts the transaction if an `authenticated` session is attempting to modify `is_operator`.

```sql
CREATE OR REPLACE FUNCTION public.guard_is_operator_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_operator IS DISTINCT FROM OLD.is_operator
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION 'is_operator cannot be modified by authenticated users';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_is_operator_column
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_operator_column();
```

**Key design choices:**

| Decision | Rationale |
|---|---|
| `NOT SECURITY DEFINER` | `current_user` must reflect the actual calling database role, not the function owner. If the function were SECURITY DEFINER, `current_user` would always be `postgres`, and the `authenticated` check would never fire. |
| `IS DISTINCT FROM` | Safe NULL comparison — handles the case where either OLD or NEW is NULL (though the NOT NULL constraint makes this theoretical). |
| Raises `EXCEPTION` | Rolls back the entire UPDATE, not just the column. Returning `OLD` instead would silently discard the change, which is harder to diagnose. |
| `current_user = 'authenticated'` | The database role assigned to Supabase JWT sessions. `postgres` and `service_role` (which set `current_user` to `postgres`) bypass the check — administrative writes are permitted. |

---

## Helper Function: `public.is_current_user_operator()`

```sql
CREATE OR REPLACE FUNCTION public.is_current_user_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_operator FROM public.users u WHERE u.id = auth.uid()),
    false
  );
$$;

REVOKE ALL   ON FUNCTION public.is_current_user_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_operator() TO authenticated;
```

**Purpose:** Provide a safe way to read `is_operator` for the calling user from within RLS policies — specifically from within `public.users` policies where an inline read would cause infinite recursion.

**Key design choices:**

| Property | Value | Rationale |
|---|---|---|
| `LANGUAGE sql` | vs. `plpgsql` | Simpler, slightly faster for a single-expression function |
| `STABLE` | | `auth.uid()` is constant per query; `is_operator` does not change mid-query. STABLE allows the planner to evaluate once and cache across rows. |
| `SECURITY DEFINER` | | Runs as the function owner (`postgres`), bypassing RLS on the internal `public.users` read. Required to break the recursion described below. |
| `SET search_path = public` | | Prevents search_path injection attacks where a malicious schema could shadow `public.users`. |
| `REVOKE ALL FROM PUBLIC` | | The function's SECURITY DEFINER context runs as `postgres`. It must not be callable by `anon` (unauthenticated) sessions. |
| `GRANT EXECUTE TO authenticated` | | Minimal-privilege grant: only authenticated sessions can call the function. |
| `COALESCE(..., false)` | | If `auth.uid()` returns NULL (no session) or the user has no matching row, returns `false` safely. |

**Why SECURITY DEFINER is necessary here:**

An inline `EXISTS (SELECT 1 FROM public.users WHERE is_operator = true)` inside a `public.users` RLS SELECT policy causes infinite recursion:

1. Policy evaluation reads `public.users` → triggers the same policy → reads `public.users` again → ...

By using a SECURITY DEFINER function, the internal read of `public.users` runs as `postgres` (bypassing all RLS on `public.users`). No recursion occurs.

---

## Operator SELECT Policies

All 10 policies were applied in Sprint 030E.2 using idempotent `DO $$ IF NOT EXISTS` guards.

All policies use `public.is_current_user_operator()` as their USING clause. Non-operator authenticated users return `false` from the helper function; the policy never matches their rows.

| # | Table | Policy name | Notes |
|---|---|---|---|
| 1 | `public.tasks` | `tasks: operator select all` | Global cross-owner task read |
| 2 | `public.properties` | `properties: operator select all` | All properties across all homeowners |
| 3 | `public.reservations` | `reservations: operator select all` | All reservations |
| 4 | `public.users` | `users: operator select all` | Additive — homeowner self-read and partner-read policies remain; recursion-safe via SECURITY DEFINER helper |
| 5 | `public.task_evidence_checks` | `task_evidence_checks: operator select all` | Evidence records for all tasks |
| 6 | `public.task_photos` | `task_photos: operator select all` | Photo metadata for all tasks |
| 7 | `public.timeline_events` | `timeline_events: operator select all` | Full audit trail across all entities |
| 8 | `public.operations_conversations` | `operations_conversations: operator select all` | All task-level conversations |
| 9 | `public.operations_messages` | `operations_messages: operator select all` | All task-level messages (including ai/system sender types) |
| 10 | `storage.objects` | `task-photos storage: operator select` | Storage objects in `task-photos` bucket only (see below) |

---

## Storage Policy

```sql
CREATE POLICY "task-photos storage: operator select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'task-photos'
    AND public.is_current_user_operator()
  );
```

**Notes:**
- Scoped strictly to `bucket_id = 'task-photos'`. No other storage bucket is affected.
- The `task-photos` bucket remains private (`public = false`). This policy enables signed-URL generation for operators.
- No UUID path join is required: the operator role is the security gate, and operators need access to all photos regardless of which task they belong to.
- The UUID regex guard (`storage.foldername(name)[1] ~* '^[0-9a-f]{8}-...'`) that prevents cast errors on malformed paths is part of the partner/homeowner policies; it is not needed here since no cast occurs.

---

## Write-Denial Model

No operator INSERT, UPDATE, or DELETE policies exist on any table. Additive operators cannot write application data through any RLS policy.

This is enforced by absence, not by explicit DENY policies (PostgreSQL RLS does not have DENY — access is `allow only what a policy explicitly permits`).

**Verified in production (Sprint 030E.3):** An operator attempting `UPDATE public.tasks SET status = 'cancelled' WHERE id = <cross-owner-task-id>` returned `0 rows` with no error. The task status was unchanged.

---

## Administrative Promotion

`is_operator` can only be set to `true` by:

1. Direct SQL in the Supabase SQL Editor while authenticated as `postgres` (the superuser session)
2. A trusted administrative Edge Function using the `service_role` key

Both bypass the `guard_is_operator_column` trigger because `current_user` is `postgres` in both contexts, not `authenticated`.

Frontend clients (Supabase JS client with anon or JWT sessions) cannot set `is_operator = true` — the trigger blocks it and raises an exception.

---

## Runtime Verification Method

To verify the RBAC model in production without a dedicated UI, use the Supabase SQL Editor transaction technique:

```sql
BEGIN;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "<operator-uuid>", "role": "authenticated"}', true);

-- This should return all tasks across all homeowners
SELECT id, status, property_id FROM public.tasks;

-- This should return 0 rows (no write policy)
UPDATE public.tasks SET status = 'cancelled' WHERE id = '<cross-owner-task-id>';

-- Inspect results, then:
ROLLBACK;
```

All test transactions must end with `ROLLBACK` to leave production data unchanged.

---

## Known Limitations

| Limitation | Notes |
|---|---|
| Operator read includes guest conversations | `public.conversations` and `public.messages` (guest domain) do not have operator SELECT policies. This was intentional at MVP — operator access was scoped to the operational task domain. If guest conversation access is needed, new policies are required and must go through Security/Supabase review. |
| No operator UI | The RBAC foundation is complete. A UI for operator accounts has not been designed. Building it requires a separate architecture review and human approval before any implementation begins. |
| MFA not enforced | The security model requires MFA for operator accounts. GoTrue MFA configuration is not yet wired up in the platform. |
| `is_operator` not shown in any admin UI | Promotion is currently done via direct SQL or trusted tooling only. An administrative panel for operator management does not exist. |
| RBAC fixture remains in production | RBAC Test Property and RBAC Isolation Test Task (created in Sprint 030E.3A) and the orphaned `graziellaensabella@yahoo.it` auth user should be cleaned up when the test fixtures are no longer needed. See [current-state.md](current-state.md). |
