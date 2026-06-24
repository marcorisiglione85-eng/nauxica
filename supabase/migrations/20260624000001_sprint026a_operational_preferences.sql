-- Migration: Sprint 026A — operational preferences
-- Adds account-level operational preferences (default currency, timezone,
-- market, date format) to public.users, surfaced and edited from the
-- Operational preferences card in settings.html.
--
-- Default '{}'::jsonb means every existing row is backfilled automatically
-- by the ALTER TABLE itself (constant default, no table rewrite, no
-- separate backfill needed) and every new row from handle_new_user()
-- gets a valid empty object since that trigger's INSERT doesn't list
-- this column. Missing keys are resolved to product defaults client-side
-- (EUR / Europe/Rome / Sicily / DD/MM/YYYY) in settings.html.
--
-- Language is intentionally NOT a key here — preferred_language on this
-- same table remains the sole source of truth for language, managed via
-- Account profile.

ALTER TABLE public.users
  ADD COLUMN operational_preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.users
  ADD CONSTRAINT users_operational_preferences_is_object
    CHECK (jsonb_typeof(operational_preferences) = 'object');

COMMENT ON COLUMN public.users.operational_preferences IS
  'Account-level operational preferences such as default currency, timezone, market and date format.';
