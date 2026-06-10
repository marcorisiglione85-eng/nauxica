-- migrations/012_emergency_data.sql
-- Sprint 012B — Emergency & Knowledge Database Foundation
-- Corrective patch applied pre-Supabase: Correction A (Sprint 012B Review Gate)
--
-- Creates the emergency_data table: property-level emergency contacts, utility
-- shutoff procedures, and nearest medical facility data. Always pre-loaded into
-- the AI concierge session context regardless of query type.
--
-- Design decisions:
--
-- Dual-field approach for emergency procedures (Correction A):
-- Individual named columns (gas_shutoff_instructions, water_shutoff_instructions,
-- electricity_shutoff_instructions, evacuation_route_description,
-- evacuation_assembly_point, property_specific_hazards, nearest_hospital_distance)
-- are required by buildEmergencyResponseContext() to construct category-specific
-- emergency responses. These were omitted from the original Sprint 012B brief but
-- are mandated by the ConciergeContext emergency contract frozen in
-- property-knowledge-schema.md v1.3 §6.
--
-- emergency_instructions is retained alongside the named columns as a general prose
-- supplement for homeowner use — catch-all for anything not covered by the named
-- fields. The AI reads both. Named columns are the authoritative source for
-- structured emergency response construction; emergency_instructions provides
-- supplemental context.
--
-- is_complete: required activation gate. Property cannot transition from
-- 'onboarding' to 'pending_activation' until is_complete = true. Re-evaluated by
-- the API layer on every homeowner save — the API sets is_complete when all
-- non-nullable fields are populated and owner_emergency_phone is valid E.164.
--
-- National emergency numbers (112, 113, 115, 118) are NOT stored as columns.
-- These are fixed constants for all properties in Italy; the AI concierge knows
-- them from the system prompt. Storing them per-property would create maintenance
-- overhead with no benefit.
--
-- nauxica_ops_phone: the Nauxica 24/7 operations number. Set and owned by
-- Nauxica — homeowner may not change this value. Enforcement at the API layer:
-- the homeowner-facing update endpoint does not accept nauxica_ops_phone in the
-- request body. RLS allows homeowner UPDATE on the row, but API validation strips
-- nauxica_ops_phone from homeowner payloads before writing.
--
-- RLS: homeowner SELECT and UPDATE on own property rows (onboarding form writes).
-- INSERT requires service_role — the row is created by the property onboarding
-- pipeline, not by the homeowner directly. DELETE requires service_role.
--
-- Prerequisites:
--   public.properties    — Sprint 1 core schema
--   public.set_updated_at — Sprint 1 core schema (redefined in migration 001)
--
-- Run manually in Supabase SQL Editor after migration 011.

BEGIN;

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.emergency_data (
  id                          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- One row per property
  property_id                 uuid         NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Activation gate: must be true before property can move to pending_activation.
  -- Set to true by the API when all required fields are valid.
  is_complete                 boolean      NOT NULL DEFAULT false,

  -- General prose supplement for homeowner-entered emergency notes.
  -- Catch-all for anything not covered by the named procedure columns below.
  -- The AI reads both this field and the named columns; named columns take
  -- precedence for structured emergency response construction.
  emergency_instructions                text         NULL,

  -- Named procedure columns (Correction A): required by buildEmergencyResponseContext()
  -- for category-specific emergency responses (gas/water/electrical/structural/hazard).
  -- All GST visibility scope. NULL = homeowner has not yet provided this information.
  gas_shutoff_instructions              text         NULL,
  water_shutoff_instructions            text         NULL,
  electricity_shutoff_instructions      text         NULL,
  evacuation_route_description          text         NULL,
  evacuation_assembly_point             text         NULL,
  property_specific_hazards             text         NULL,

  -- Nearest hospital
  nearest_hospital_name                 text         NOT NULL,
  nearest_hospital_phone                text         NULL,   -- Hospital switchboard E.164
  nearest_hospital_address              text         NOT NULL,
  -- Travel time in natural language, e.g. "8 min by car". NULL if unknown.
  -- Displayed to guests in emergency context; not a calculated field.
  nearest_hospital_distance             text         NULL,

  -- Owner emergency contact
  owner_emergency_name        text         NOT NULL,
  owner_emergency_phone       text         NOT NULL,  -- E.164. Always available to AI.

  -- Nauxica 24/7 operations. Set by Nauxica — not homeowner-editable via API.
  nauxica_ops_phone           text         NOT NULL,

  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now()
);

-- ── Unique constraint: one row per property ────────────────────────────────

ALTER TABLE public.emergency_data
  ADD CONSTRAINT ed_property_id_unique UNIQUE (property_id);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- AI concierge emergency context pre-load path.
-- Queried on every session initialisation to populate the emergency section
-- of ConciergeContext.
CREATE INDEX ed_property_id_idx
  ON public.emergency_data (property_id);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE TRIGGER emergency_data_set_updated_at
  BEFORE UPDATE ON public.emergency_data
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Homeowners may SELECT and UPDATE their own property's emergency data
-- (needed for the onboarding emergency details form).
-- INSERT is service_role only — the row is created by the property onboarding
-- pipeline, not by the homeowner directly (prevents partial empty rows).
-- DELETE is service_role only.
--
-- Important: nauxica_ops_phone is NOT homeowner-editable. This is enforced at
-- the API layer — the homeowner endpoint strips this field from the request body
-- before writing. The RLS policy does not enforce column-level restrictions.

ALTER TABLE public.emergency_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeowner_select_emergency_data"
  ON public.emergency_data FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "homeowner_update_emergency_data"
  ON public.emergency_data FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

-- No INSERT / DELETE policies for the authenticated role.
-- Mutations require service_role.

COMMIT;
