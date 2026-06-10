-- migrations/013_emergency_contacts.sql
-- Sprint 012B — Emergency & Knowledge Database Foundation
-- Corrective patch applied pre-Supabase: Corrections B and C (Sprint 012B Review Gate)
-- Micro-correction applied pre-Supabase: Correction E (Sprint 012B Final Micro-Correction)
--   available_hours text NULL added — resolves ConciergeContext.emergency_contacts gap.
--
-- Creates the emergency_contacts table: a per-property list of emergency and
-- operational contacts used by the AI concierge when routing escalations and
-- responding to emergency queries.
--
-- Design decisions:
--
-- Separate from emergency_data: emergency_data holds property procedures and
-- static emergency facility data (one row per property). emergency_contacts
-- holds a variable-length list of reachable people/services per property.
-- This allows properties to register different contacts per service type
-- (e.g. two plumbers, a caretaker, a property manager) without a fixed column layout.
--
-- contact_type enum (12 values): defines the role/domain of the contact.
-- nauxica_operator is a protected type — Nauxica inserts and owns these rows.
-- Homeowners may not INSERT, UPDATE, or DELETE nauxica_operator contacts.
-- This is enforced at the database level via separate RLS policies (see below).
--
-- emergency_services enum value (Correction C): this value exists in the enum but
-- MUST NOT be inserted as a stored row. Italian national emergency numbers
-- (112 Carabinieri, 113 Polizia, 115 Vigili del Fuoco, 118 Ambulanza) are static
-- constants for all properties in Italy. They live in the AI system prompt, not in
-- property data. Storing them per-property would create maintenance overhead with
-- no benefit. The enum value is retained for schema completeness and potential
-- future use in non-Italy markets.
--
-- available_hours (Correction E): human-readable availability guidance for the contact.
-- Examples: "24/7", "Mon–Fri 09:00–18:00", "Emergency only". NULL if unknown.
-- Informational only — does not replace escalation_priority, does not affect RLS.
-- Included in ConciergeContext.emergency_contacts for rows where guest_visible=true
-- and ai_usable=true. Resolves the gap between migration 013 and the frozen
-- ConciergeContext.emergency_contacts design contract (property-knowledge-schema.md v1.3 §6).
--
-- guest_visible / ai_usable (Correction B): two boolean flags required by the
-- loadEmergencyContacts() contract to filter which contacts appear in the guest-
-- facing AI context. DEFAULT false for both — rows are opted in explicitly by the
-- property onboarding pipeline or by homeowner edits.
-- Guidance per contact type:
--   nauxica_operator:                  guest_visible=true, ai_usable=true
--   owner, property_manager, caretaker,
--   local_police, local_fire,
--   local_medical:                     guest_visible=true  (typically ai_usable=true)
--   maintenance, plumber, electrician,
--   gas_provider:                      guest_visible=false (AI dispatches service
--                                      request; does NOT relay trade contact numbers
--                                      to guests)
-- These are defaults per type; individual rows may deviate based on homeowner
-- configuration. The helper reads the per-row flags, not the type.
--
-- escalation_priority: integer 0–3. Lower number = higher priority.
--   0 = first escalation point (typically nauxica_operator)
--   1 = primary owner contact
--   2 = secondary contacts (caretaker, property_manager)
--   3 = specialist contacts (plumber, electrician, etc.)
-- The AI concierge uses this to order who to escalate to in an emergency.
--
-- is_active: soft-delete flag. Inactive contacts are not loaded into AI context.
-- No hard-delete policy for authenticated homeowners — use is_active = false.
--
-- RLS security model:
--   SELECT  — homeowner sees all own-property contacts (including nauxica_operator)
--   INSERT  — homeowner may add only non-nauxica_operator contacts for own properties
--   UPDATE  — homeowner may update only non-nauxica_operator contacts for own properties
--   DELETE  — no homeowner DELETE policy (use is_active = false; service_role hard-deletes)
-- nauxica_operator rows are inserted and managed by service_role only.
--
-- Prerequisites:
--   public.properties    — Sprint 1 core schema
--   public.set_updated_at — Sprint 1 core schema (redefined in migration 001)
--
-- Run manually in Supabase SQL Editor after migration 012.

BEGIN;

-- ── Enum types ─────────────────────────────────────────────────────────────

-- contact_type: 12 canonical contact domains.
-- Source: property-knowledge-schema.md v1.3 §5 (Emergency Contacts Domain).
-- 'nauxica_operator' rows are protected — homeowners may not create or modify them.

CREATE TYPE public.emergency_contact_type AS ENUM (
  'owner',
  'property_manager',
  'caretaker',
  'maintenance',
  'plumber',
  'electrician',
  'gas_provider',
  'emergency_services',
  'local_police',
  'local_fire',
  'local_medical',
  'nauxica_operator'
);

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.emergency_contacts (
  id                   uuid                       PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Property anchor
  property_id          uuid                       NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,

  -- Contact role
  contact_type         emergency_contact_type     NOT NULL,

  -- Contact details
  contact_name         text                       NOT NULL,
  contact_phone        text                       NOT NULL,  -- E.164 format
  -- Human-readable availability guidance. Examples: "24/7", "Mon–Fri 09:00–18:00",
  -- "Emergency only". NULL if unknown. Informational only — does not affect dispatch.
  available_hours      text                       NULL,

  -- Dispatch ordering: 0 = highest priority (escalate first), 3 = lowest.
  escalation_priority  integer                    NOT NULL DEFAULT 1
                         CONSTRAINT ec_priority_range CHECK (escalation_priority BETWEEN 0 AND 3),

  -- Activation flag: false = exclude from AI context loading.
  is_active            boolean                    NOT NULL DEFAULT true,

  -- Visibility flags for loadEmergencyContacts() filter (Correction B).
  -- guest_visible: true = AI may share this contact's phone number with guests.
  -- ai_usable:     true = AI may use this contact in emergency response context.
  -- Both default to false — rows must be explicitly opted in.
  -- See design decisions above for guidance per contact type.
  guest_visible        boolean                    NOT NULL DEFAULT false,
  ai_usable            boolean                    NOT NULL DEFAULT false,

  created_at           timestamptz                NOT NULL DEFAULT now(),
  updated_at           timestamptz                NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Primary AI concierge contact load path.
-- KBB loads active contacts ordered by escalation_priority for AI context assembly.
CREATE INDEX ec_property_active_priority_idx
  ON public.emergency_contacts (property_id, escalation_priority)
  WHERE is_active = true;

-- Contact type lookup: "give me all plumbers for this property".
CREATE INDEX ec_property_type_idx
  ON public.emergency_contacts (property_id, contact_type);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE TRIGGER emergency_contacts_set_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- SELECT: homeowner sees all contacts (including nauxica_operator) for own properties.
-- INSERT: homeowner may add non-nauxica_operator contacts for own properties only.
-- UPDATE: homeowner may update non-nauxica_operator contacts for own properties only.
-- DELETE: no homeowner DELETE policy — use is_active = false for deactivation.
--         Hard-delete requires service_role.
-- nauxica_operator contacts: inserted and managed by service_role only.

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeowner_select_emergency_contacts"
  ON public.emergency_contacts FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "homeowner_insert_emergency_contacts"
  ON public.emergency_contacts FOR INSERT
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
    AND contact_type != 'nauxica_operator'
  );

CREATE POLICY "homeowner_update_emergency_contacts"
  ON public.emergency_contacts FOR UPDATE
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
    AND contact_type != 'nauxica_operator'
  )
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
    AND contact_type != 'nauxica_operator'
  );

-- No DELETE policy for authenticated role.
-- service_role has full access via Supabase default.

COMMIT;
