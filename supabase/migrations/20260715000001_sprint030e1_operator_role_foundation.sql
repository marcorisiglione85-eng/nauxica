-- Sprint 030E.1: Operator Role Foundation
--
-- Adds the minimal RBAC identity flag required to identify authenticated
-- Nauxica Operators.
--
-- is_operator is an internal RBAC flag. It is independent of
-- public.account_type. A user remains account_type 'homeowner' or
-- 'partner', but may additionally hold internal Operator privileges
-- when is_operator = true.
--
-- Promotion is performed exclusively through trusted service-role or
-- direct SQL administration after deployment. Frontend clients cannot
-- self-promote — see §2 for the security finding and guard.
--
-- This migration is purely additive:
--   - one column added to public.users (ADD COLUMN IF NOT EXISTS)
--   - one trigger function + trigger that blocks self-promotion
--
-- It does NOT:
--   - alter public.account_type
--   - modify the handle_new_user auth trigger
--   - include any UPDATE statement to promote a specific user
--   - add SELECT or UPDATE policies on operational tables
--   - touch existing homeowner or partner RLS policies

-- ============================================================
-- 1. Add is_operator column
-- ============================================================
-- DEFAULT false: every existing row and every new row created by
-- handle_new_user() (which does not list this column in its INSERT)
-- receives false automatically. No backfill or trigger change needed.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_operator boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_operator IS
  'Internal RBAC operator flag. Independent of account_type '
  '(homeowner | partner). Users are promoted only through trusted '
  'service-role or direct SQL administration — never by frontend '
  'clients. The guard_is_operator_column trigger enforces this at '
  'the database level.';

-- ============================================================
-- 2. SECURITY FINDING — existing users UPDATE policy is unrestricted
-- ============================================================
-- The core schema migration (20260607000001_sprint1_core_schema.sql)
-- created the following policy on public.users:
--
--   CREATE POLICY "users: update own record"
--     ON public.users FOR UPDATE TO authenticated
--     USING (id = auth.uid())
--     WITH CHECK (id = auth.uid());
--
-- This policy has no column-level restrictions. Any authenticated
-- homeowner or partner can update every column on their own row,
-- including a freshly added is_operator column:
--
--   UPDATE public.users SET is_operator = true WHERE id = auth.uid();
--
-- A column-level REVOKE is not effective here because the same
-- migration also grants table-level UPDATE to authenticated:
--
--   GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
--
-- In PostgreSQL, a table-level privilege supersedes column-level
-- revokes for the same grantee (narrowing it would require revoking
-- the table-level UPDATE and re-granting column by column — a
-- high-blast-radius change touching every other column).
--
-- Mitigation (§3 below): a BEFORE UPDATE trigger that checks
-- current_user. This is the smallest safe mechanism: it does not
-- replace any existing policy, does not modify any existing grant,
-- and leaves all other column updates intact.

-- ============================================================
-- 3. Self-promotion guard
-- ============================================================
-- current_user reflects the PostgreSQL role executing the UPDATE:
--   - 'authenticated'  — normal frontend user via PostgREST JWT
--   - 'service_role'   — administrative tooling / service-role client
--   - 'postgres' etc.  — direct SQL access (Supabase Studio / psql)
--
-- NOT using SECURITY DEFINER intentionally: with SECURITY DEFINER,
-- current_user would always be the function owner, defeating the check.
-- Without it, current_user is the actual calling role.

CREATE OR REPLACE FUNCTION public.guard_is_operator_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_operator IS DISTINCT FROM OLD.is_operator
     AND current_user = 'authenticated' THEN
    RAISE EXCEPTION
      'is_operator may only be changed through trusted administrative tooling'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname    = 'guard_is_operator_column'
      AND tgrelid   = 'public.users'::regclass
  ) THEN
    CREATE TRIGGER guard_is_operator_column
      BEFORE UPDATE ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_is_operator_column();
  END IF;
END
$$;
