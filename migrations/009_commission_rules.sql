-- migrations/009_commission_rules.sql
-- Sprint 009 — Platform Commission Foundation
-- Creates commission_rules table with a single global rate (15%).
-- Commission applies only between Nauxica and partner.
-- Homeowner-facing pages must never reference this table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type  text         NOT NULL,
  scope_id    uuid         NULL,
  rate        numeric(5,4) NOT NULL,
  valid_from  date         NOT NULL DEFAULT CURRENT_DATE,
  valid_to    date         NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  updated_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_scope
  ON public.commission_rules (scope_type, scope_id, valid_from);

-- Seed: global rule, open-ended (valid_to NULL = currently active)
INSERT INTO public.commission_rules (scope_type, scope_id, rate, valid_from, valid_to)
  VALUES ('global', NULL, 0.15, CURRENT_DATE, NULL);

-- RLS: authenticated users may read; no write access for authenticated role.
-- Mutations require service_role (Supabase dashboard or backend function only).
ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_authenticated_read"
  ON public.commission_rules
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;
