-- Sprint 030E.3B: Fix handle_new_user auth provisioning
--
-- Root cause (confirmed in production):
--
--   When a user is created via the Supabase Auth Admin UI without
--   account_type metadata, raw_user_meta_data->>'account_type' returns
--   NULL. Casting NULL to an enum type in PostgreSQL silently returns
--   NULL — it does NOT raise invalid_text_representation. The original
--   inner EXCEPTION block was therefore never reached, v_account_type
--   remained NULL, and the subsequent INSERT into public.users (where
--   account_type is NOT NULL) raised a not_null_violation (23502).
--
--   That violation was swallowed by the outer EXCEPTION WHEN OTHERS
--   clause, which returned NEW without creating the public.users row.
--   Result: split identity state — auth.users exists, public.users absent.
--
-- Observed state:
--   auth.users row exists (RBAC test fixture user created 2026-08-10)
--   public.users row absent
--
-- Fix 1 — account_type parsing (required):
--   Add COALESCE(NULLIF(..., ''), 'homeowner') before the enum cast so
--   that NULL and '' metadata both resolve to 'homeowner' before any
--   cast is attempted. Invalid non-empty strings remain caught by
--   EXCEPTION WHEN invalid_text_representation.
--
-- Fix 2 — nauxica_plan_tier parsing (hardening):
--   Already used COALESCE+NULLIF correctly — no semantic change.
--   Narrow inner EXCEPTION from (invalid_text_representation OR OTHERS)
--   to only invalid_text_representation for precision.
--
-- Fix 3 — account_type inner EXCEPTION (hardening):
--   Same narrowing: WHEN invalid_text_representation only.
--   OR OTHERS in metadata-parsing inner blocks was over-broad.
--
-- Fix 4 — outer EXCEPTION WHEN OTHERS block (design change):
--   Removed. The original comment "Never block the auth.users insert"
--   was written before the implications of split identity state were
--   understood. An incomplete account (auth row, no profile) is more
--   dangerous than a failed creation request:
--     - RLS policies that check public.users silently return no rows
--       for the orphaned user
--     - The user appears authenticated but the platform treats them as
--       nonexistent
--     - The failure is invisible until the user attempts a platform action
--   Without the outer handler, unexpected INSERT failures propagate and
--   roll back the auth.users insert. GoTrue sees this as a creation error
--   and surfaces it to the caller — clean failure, no split state.
--   ON CONFLICT (id) DO NOTHING is retained for idempotency on
--   replay/retry: if the profile row already exists, the INSERT is a no-op
--   and the function returns NEW successfully.
--
-- Other metadata fields audited — no changes required:
--   full_name:   COALESCE(NULLIF(..., ''), NEW.email) — already safe
--   phone_number: COALESCE(..., '') — already safe, empty string is valid
--   display_name: not in INSERT — nullable column, trigger never sets it
--   partner_service_types: not in INSERT — nullable column, trigger never sets it
--
-- This migration uses CREATE OR REPLACE FUNCTION. The existing trigger
-- on_auth_user_created already references public.handle_new_user() by
-- name — it does not need to be recreated.
--
-- This migration does NOT repair the existing orphaned test user created
-- during RBAC fixture setup. That user will be handled separately after
-- this fix is deployed.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_type  public.account_type;
  v_plan_tier     public.nauxica_plan_tier;
BEGIN
  -- account_type: COALESCE+NULLIF before the cast so that NULL and ''
  -- metadata both resolve to 'homeowner' without ever casting NULL
  -- (casting NULL returns NULL silently — it does NOT raise an exception,
  -- which was the root cause of the auth provisioning bug fixed here).
  -- Only genuinely invalid non-empty strings reach the EXCEPTION block.
  BEGIN
    v_account_type := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'account_type', ''),
      'homeowner'
    )::public.account_type;
  EXCEPTION WHEN invalid_text_representation THEN
    v_account_type := 'homeowner';
  END;

  -- nauxica_plan_tier: already used COALESCE+NULLIF correctly.
  -- Narrowed EXCEPTION from (invalid_text_representation OR OTHERS) to
  -- only invalid_text_representation — the only exception this inner
  -- block can legitimately raise.
  BEGIN
    v_plan_tier := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nauxica_plan_tier', ''),
      'starter'
    )::public.nauxica_plan_tier;
  EXCEPTION WHEN invalid_text_representation THEN
    v_plan_tier := 'starter';
  END;

  INSERT INTO public.users (
    id,
    email,
    account_type,
    full_name,
    phone_number,
    nauxica_plan_tier
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_account_type,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    v_plan_tier
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

  -- The outer EXCEPTION WHEN OTHERS block has been intentionally removed.
  --
  -- If public.users provisioning fails unexpectedly, the error propagates
  -- and rolls back the auth.users insert. This prevents split identity
  -- state. GoTrue returns a creation error to the caller — the failure is
  -- visible and actionable rather than silent and permanent.
  --
  -- The metadata-parsing fixes above (Fix 1–3) eliminate all previously
  -- known silent failure paths. Remaining unexpected failures (e.g., schema
  -- inconsistency, sequence exhaustion) should be surfaced, not hidden.
END;
$$;
