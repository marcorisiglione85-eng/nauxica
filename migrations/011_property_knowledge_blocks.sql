-- migrations/011_property_knowledge_blocks.sql
-- Sprint 012B — Emergency & Knowledge Database Foundation
--
-- Creates the property_knowledge_blocks table: the typed block registry for the
-- AI concierge context pipeline (KBB — Knowledge Block Builder).
--
-- Design decisions:
--
-- Multi-row design: one row per block type per property (up to 14 rows per property,
-- one for each canonical block type). This replaces the earlier single-row-per-property
-- placeholder documented in database-schema.md v1.7 §3.3, which was written before
-- the block type taxonomy was finalised.
--
-- Each block holds:
--   content_jsonb  — guest-safe structured block data (what the AI reads)
--   source_jsonb   — provenance metadata (who updated, when, from which source field)
-- This hybrid allows block-specific schemas within each content_jsonb without
-- requiring separate tables for each block type, while keeping provenance trackable.
--
-- UNIQUE(property_id, block_type): one block of each type per property.
-- Prior placeholder documentation showed UNIQUE(property_id) which assumed a
-- single-row design. The multi-row design requires the composite uniqueness key.
--
-- is_active: controls whether a block is loaded by the KBB pipeline.
-- Blocks with is_active = false are skipped during AI context assembly.
-- All 14 blocks are created per property by the onboarding pipeline;
-- is_active is set per-block as the homeowner completes each section.
--
-- session_phase_gate: text field (nullable) storing a comma-separated list of
-- session_phase enum values. NULL means no gate — load in any phase.
-- The KBB pipeline checks session.session_phase against this column at step 2
-- (Activation Gate) before loading the block. Stored as text for flexibility;
-- the KBB validates values against the session_phase enum at runtime.
--
-- RLS: homeowners may SELECT their own property blocks. No homeowner INSERT/UPDATE/
-- DELETE — mutations are service_role only. Homeowner edits go through a validated
-- API endpoint that uses service_role, validates content, updates source_jsonb
-- provenance, and re-runs the KBB pipeline.
--
-- visibility_scope: per-block scope from the four-tier data visibility model.
-- The KBB pipeline applies the scope filter at step 1 before loading blocks.
-- Only PUB and GST scoped blocks are eligible for guest-facing AI context.
--
-- Scope: block registry only. This migration does NOT create:
--   emergency_data         (Sprint 012B / migration 012)
--   emergency_contacts     (Sprint 012B / migration 013)
--   escalation_records     (Sprint 013)
--
-- Prerequisites:
--   public.properties    — Sprint 1 core schema
--   public.set_updated_at — Sprint 1 core schema (redefined in migration 001)
--
-- Run manually in Supabase SQL Editor after migration 010.

BEGIN;

-- ── Enum types ─────────────────────────────────────────────────────────────

-- knowledge_block_type: 14 canonical block types for the AI concierge context pipeline.
-- Source: property-knowledge-schema.md v1.3 §3 (Canonical Knowledge Block Type Registry).
-- These are the only valid block types at Sicily launch. New types require a schema
-- migration and a corresponding KBB pipeline step update.

CREATE TYPE public.knowledge_block_type AS ENUM (
  'emergency',
  'property_summary',
  'access',
  'check_in',
  'check_out',
  'wifi',
  'amenities',
  'house_rules',
  'local_area',
  'services',
  'maintenance',
  'tourist_tax',
  'booking_policy',
  'fallback_support'
);

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.property_knowledge_blocks (
  id                     uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Block identity
  property_id            uuid                   NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  block_type             knowledge_block_type   NOT NULL,

  -- Visibility scope from data-visibility-model.md.
  -- 'PUB' = shareable pre-auth; 'GST' = confirmed guest only; 'PTR' = partner only;
  -- 'INT' = internal (homeowner + operator). PUB and GST are eligible for AI context.
  visibility_scope       text                   NOT NULL DEFAULT 'GST'
                           CONSTRAINT pkb_visibility_scope_check
                           CHECK (visibility_scope IN ('PUB', 'GST', 'PTR', 'INT')),

  -- Session phase gate: NULL means always load; otherwise the KBB step 2 (Activation Gate)
  -- checks session.session_phase against these values before loading the block.
  -- Format: comma-separated session_phase values, e.g. 'pre_arrival,check_in'
  session_phase_gate     text                   NULL,

  -- Human-readable block label for admin tooling and onboarding UI.
  title                  text                   NULL,

  -- Block data for AI context loading (guest-safe structured content).
  content_jsonb          jsonb                  NOT NULL DEFAULT '{}',

  -- Provenance metadata for audit and pipeline tracing.
  -- Structure: { updated_by, updated_at, source_field, pipeline_version }
  source_jsonb           jsonb                  NOT NULL DEFAULT '{}',

  -- Activation flag: false = skip this block in KBB pipeline; true = eligible for loading.
  is_active              boolean                NOT NULL DEFAULT false,

  created_at             timestamptz            NOT NULL DEFAULT now(),
  updated_at             timestamptz            NOT NULL DEFAULT now()
);

-- ── Unique constraint: one block of each type per property ─────────────────

ALTER TABLE public.property_knowledge_blocks
  ADD CONSTRAINT pkb_property_block_type_unique UNIQUE (property_id, block_type);

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Primary KBB loading path: "give me all active blocks for this property".
-- Queried on every AI concierge session context load.
CREATE INDEX pkb_property_active_idx
  ON public.property_knowledge_blocks (property_id, block_type)
  WHERE is_active = true;

-- Direct block type lookup: "give me the emergency block for this property".
-- Used by the emergency cache and for specific block retrieval.
CREATE INDEX pkb_property_block_type_idx
  ON public.property_knowledge_blocks (property_id, block_type);

-- ── updated_at trigger ─────────────────────────────────────────────────────

CREATE TRIGGER pkb_set_updated_at
  BEFORE UPDATE ON public.property_knowledge_blocks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Homeowners may SELECT blocks for properties they own.
-- INSERT / UPDATE / DELETE require service_role (AI runtime + admin tooling only).
-- Homeowner edits go through a validated API endpoint that uses service_role.

ALTER TABLE public.property_knowledge_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeowner_select_property_knowledge_blocks"
  ON public.property_knowledge_blocks FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies for the authenticated role.
-- Mutations are service_role only.

COMMIT;
