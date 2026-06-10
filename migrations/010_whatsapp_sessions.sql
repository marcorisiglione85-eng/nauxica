-- migrations/010_whatsapp_sessions.sql
-- Sprint 011A — WhatsApp Session Anchor
-- Sprint 011B — Session Model Correction (patched in-place: migration not yet applied)
--
-- Creates the whatsapp_sessions table: the AI concierge session anchor.
-- Establishes the guest_phone → reservation → property linkage.
--
-- Design decisions:
--
-- conversation_id is intentionally NOT stored on whatsapp_sessions.
-- conversations.reservation_id has a UNIQUE constraint, so the conversation is
-- always derivable in O(1) via: SELECT id FROM conversations WHERE reservation_id = ws.reservation_id.
-- Storing conversation_id here would create a redundant FK with a NULL-window at
-- session open and a stale-FK risk if the conversation is ever recreated.
-- The session does not own the conversation — it writes messages into it.
-- conversations.status (homeowner semantic) and session_status (concierge runtime)
-- are intentionally separate concepts and must not be conflated.
--
-- is_escalated is NOT stored as a persisted column.
-- It is always derivable as: session_status = 'escalated'.
-- Storing it would create a sync obligation (both session_status AND is_escalated
-- must be updated atomically on every escalation state transition) with no
-- compensating query benefit. The resolver computes it at runtime.
--
-- Live-session uniqueness is per (guest_phone, reservation_id), not per reservation_id alone.
-- The MVP allows multiple guests on the same reservation to message from different phones.
-- Each phone may hold one live session for the same reservation simultaneously.
-- whatsapp-session-anchor.md §10: "The system creates a separate WhatsAppSession per
-- phone number. Each session anchors to the same Reservation but has its own session state."
--
-- session_cache is for transient resolver workflow state only (e.g. disambiguation ids,
-- rate limit counters). It is not a substitute for structured columns. Any field written
-- to session_cache that is read by business logic across more than one sprint must
-- graduate to a dedicated typed column before that sprint ships.
--
-- Scope: session anchor only. This migration does NOT create:
--   property_knowledge_blocks  (Sprint 012)
--   emergency_data             (Sprint 012)
--   escalation_records         (Sprint 013)
--   service_requests           (Sprint 014)
--   guest_stay_contexts        (Sprint 015)
--
-- Prerequisites:
--   public.reservations    — Sprint 1 core schema
--   public.properties      — Sprint 1 core schema
--   public.conversations   — migration 001
--   public.set_updated_at  — Sprint 1 core schema (redefined with CREATE OR REPLACE in 001)
--
-- Run manually in Supabase SQL Editor after migrations 001–009.

BEGIN;

-- ── Enum types ─────────────────────────────────────────────────────────────
-- session_status: 4 canonical states for the concierge session lifecycle.
--
-- 'active':    Session is open; AI concierge responding normally.
-- 'waiting':   Disambiguation pending — guest phone matched multiple reservations in the
--              active window. Session is created immediately so the initial message is
--              logged and the homeowner has visibility. Held until guest selects a booking.
--              session_cache carries disambiguation_reservation_ids across messages.
--              This is a canonical durable state, not a transient implementation detail.
-- 'closed':    Session ended (checkout grace period elapsed or explicit close).
-- 'escalated': Human takeover active; AI does not respond; session holds for operator.

CREATE TYPE public.session_status AS ENUM (
  'active',
  'waiting',
  'closed',
  'escalated'
);

-- session_phase: mirrors the 5-phase guest stay lifecycle from whatsapp-session-anchor.md.
-- Re-evaluated on every inbound message — never treated as permanently fixed.

CREATE TYPE public.session_phase AS ENUM (
  'pre_arrival',
  'check_in',
  'in_stay',
  'check_out',
  'post_stay'
);

-- ── Table ──────────────────────────────────────────────────────────────────

CREATE TABLE public.whatsapp_sessions (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session anchor: phone → reservation → property
  guest_phone            text           NOT NULL,
  reservation_id         uuid           NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  property_id            uuid           NOT NULL REFERENCES public.properties(id)   ON DELETE CASCADE,

  -- Session runtime state
  session_status         session_status NOT NULL DEFAULT 'active',
  session_phase          session_phase  NOT NULL DEFAULT 'pre_arrival',
  detected_language      text           NULL,     -- ISO 639-1; locked after first detection
  unresolved_query_count integer        NOT NULL DEFAULT 0,
  last_message_at        timestamptz    NULL,     -- null until first message arrives

  -- Lightweight per-session cache for transient resolver state only.
  -- Do not use for business data that persists beyond a single resolver sprint.
  -- Any field read by business logic across more than one sprint must graduate
  -- to a dedicated typed column before that sprint ships.
  session_cache          jsonb          NOT NULL DEFAULT '{}',

  created_at             timestamptz    NOT NULL DEFAULT now(),
  updated_at             timestamptz    NOT NULL DEFAULT now()
);

-- ── Partial unique index: one live session per (phone, reservation) ────────
-- Enforces: a single phone number may hold at most one live session for a given
-- reservation at a time. Multiple 'closed' sessions per (guest_phone, reservation_id)
-- are allowed — they form the historical record.
--
-- Intentionally NOT unique on reservation_id alone: the MVP allows multiple guests
-- on the same reservation to each hold an independent live session from their own phone.
-- See: whatsapp-session-anchor.md §10 (Multi-Guest Phone Handling).

CREATE UNIQUE INDEX ws_one_active_per_phone_reservation
  ON public.whatsapp_sessions (guest_phone, reservation_id)
  WHERE session_status IN ('active', 'waiting', 'escalated');

-- ── Indexes ────────────────────────────────────────────────────────────────

-- Primary AI concierge resolution path.
-- Every inbound WhatsApp message hits this index first.
CREATE INDEX ws_guest_phone_status_idx
  ON public.whatsapp_sessions (guest_phone, session_status);

CREATE INDEX ws_reservation_id_idx
  ON public.whatsapp_sessions (reservation_id);

CREATE INDEX ws_property_id_idx
  ON public.whatsapp_sessions (property_id);

-- ── updated_at trigger ─────────────────────────────────────────────────────
-- public.set_updated_at() already exists from Sprint 1 + migration 001.

CREATE TRIGGER whatsapp_sessions_set_updated_at
  BEFORE UPDATE ON public.whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ─────────────────────────────────────────────────────
-- Homeowners may read sessions for properties they own.
-- All writes (INSERT / UPDATE) go through service_role only (AI concierge runtime).
-- Guests have no platform user account — no guest-facing RLS policy is needed.

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homeowner_select_whatsapp_sessions"
  ON public.whatsapp_sessions FOR SELECT
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

-- No INSERT / UPDATE / DELETE policies for the authenticated role.
-- Mutations are service_role only.

COMMIT;
