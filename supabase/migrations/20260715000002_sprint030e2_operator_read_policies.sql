-- Sprint 030E.2: Operator Read Policies
--
-- Adds read-only RLS foundation for authenticated Nauxica Operators.
-- An operator is any user with public.users.is_operator = true (set via
-- trusted administrative tooling — never by frontend clients).
--
-- Access model: operator retains their existing account_type
-- (homeowner | partner) and gains additional cross-platform read
-- access to all operational task data.
--
-- This migration is purely additive:
--   - one SECURITY DEFINER helper function (§1)
--   - ten SELECT-only RLS policies (§2–§11)
--   - one storage.objects SELECT policy for task-photos (§12)
--
-- It does NOT:
--   - alter public.account_type
--   - add INSERT, UPDATE, or DELETE operator policies
--   - modify or drop any existing homeowner or partner policy
--   - promote any user (is_operator remains false for all users)
--   - change the task-photos bucket public flag
--   - touch any other storage bucket
--   - touch any Edge Function or frontend file
--
-- Idempotency: every policy is guarded by an IF NOT EXISTS check on
-- pg_policies. The helper function uses CREATE OR REPLACE.
--
-- All operator policies use public.is_current_user_operator() (§1)
-- rather than an inline EXISTS predicate. This is required because
-- an inline EXISTS (SELECT 1 FROM public.users WHERE is_operator = true)
-- inside a public.users SELECT policy would cause infinite recursion:
-- evaluating the policy queries public.users, which triggers the same
-- policy again. The SECURITY DEFINER function breaks the cycle — it
-- runs as the function owner (postgres), which bypasses RLS, so the
-- internal read of public.users.is_operator does not re-trigger any
-- public.users policy.

-- ============================================================
-- 1. Helper function: public.is_current_user_operator()
-- ============================================================
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing
-- RLS on public.users. This is intentional — the function exists
-- specifically to read public.users safely from within a public.users
-- RLS policy. It exposes only a single boolean (is_operator for the
-- authenticated caller) and cannot be used to read arbitrary user data.
--
-- STABLE: auth.uid() is constant per query, and is_operator does not
-- change during a query. STABLE allows the planner to evaluate this
-- function once and reuse the result across all rows in a query.
--
-- SET search_path = public: prevents search_path injection attacks.
-- Without this, a malicious search_path could shadow public.users.
--
-- REVOKE ALL FROM PUBLIC / GRANT TO authenticated: the function's
-- SECURITY DEFINER context runs as postgres (bypassing RLS), so it
-- must not be callable by unauthenticated (anon) sessions. All operator
-- policies below are TO authenticated, so anon sessions never trigger
-- them, but explicitly restricting EXECUTE to authenticated is the
-- minimal-privilege best practice.

CREATE OR REPLACE FUNCTION public.is_current_user_operator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.is_operator
      FROM public.users u
      WHERE u.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL   ON FUNCTION public.is_current_user_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_operator() TO authenticated;

-- ============================================================
-- 2. public.tasks — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'tasks'
      AND policyname = 'tasks: operator select all'
  ) THEN
    CREATE POLICY "tasks: operator select all"
      ON public.tasks
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 3. public.properties — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'properties'
      AND policyname = 'properties: operator select all'
  ) THEN
    CREATE POLICY "properties: operator select all"
      ON public.properties
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 4. public.reservations — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'reservations'
      AND policyname = 'reservations: operator select all'
  ) THEN
    CREATE POLICY "reservations: operator select all"
      ON public.reservations
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 5. public.users — operator select all
-- ============================================================
-- Allows operators to resolve homeowner, partner, and future operator
-- identity from task context. Additive alongside existing policies:
--   "users: select own record"    (own row)
--   "authenticated_read_partners" (partner-type rows)
-- Non-operator authenticated users continue to see only what those
-- two existing policies permit; this policy adds no access for them
-- because is_current_user_operator() returns false.
--
-- Recursion safety: this policy calls public.is_current_user_operator(),
-- which reads public.users as SECURITY DEFINER (postgres). That internal
-- read bypasses RLS and does not re-trigger this or any other
-- public.users policy. No infinite recursion.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users: operator select all'
  ) THEN
    CREATE POLICY "users: operator select all"
      ON public.users
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 6. public.task_evidence_checks — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_evidence_checks'
      AND policyname = 'task_evidence_checks: operator select all'
  ) THEN
    CREATE POLICY "task_evidence_checks: operator select all"
      ON public.task_evidence_checks
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 7. public.task_photos — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_photos'
      AND policyname = 'task_photos: operator select all'
  ) THEN
    CREATE POLICY "task_photos: operator select all"
      ON public.task_photos
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 8. public.timeline_events — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'timeline_events'
      AND policyname = 'timeline_events: operator select all'
  ) THEN
    CREATE POLICY "timeline_events: operator select all"
      ON public.timeline_events
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 9. public.operations_conversations — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'operations_conversations'
      AND policyname = 'operations_conversations: operator select all'
  ) THEN
    CREATE POLICY "operations_conversations: operator select all"
      ON public.operations_conversations
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 10. public.operations_messages — operator select all
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'operations_messages'
      AND policyname = 'operations_messages: operator select all'
  ) THEN
    CREATE POLICY "operations_messages: operator select all"
      ON public.operations_messages
      FOR SELECT
      TO authenticated
      USING (public.is_current_user_operator());
  END IF;
END
$$;

-- ============================================================
-- 11. storage.objects — task-photos bucket: operator select
-- ============================================================
-- Scoped strictly to bucket_id = 'task-photos'. No UUID path join
-- is required: the operator role itself is the security gate, and
-- an operator requires access to all photos in the bucket regardless
-- of which task they belong to.
--
-- The bucket remains private (public = false — set in
-- 20260628000001_sprint029e1_task_photos_storage_bucket.sql).
-- This policy grants signed-URL generation for operators only.
-- No other bucket is affected.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'task-photos storage: operator select'
  ) THEN
    CREATE POLICY "task-photos storage: operator select"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'task-photos'
        AND public.is_current_user_operator()
      );
  END IF;
END
$$;
