-- Migration 005: activity timeline
-- Run manually in Supabase SQL Editor.
-- Prerequisites: migrations 001–004 must be applied.

-- ── Table ─────────────────────────────────────────────────────────────

CREATE TABLE public.timeline_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       uuid        NULL REFERENCES public.properties(id)    ON DELETE CASCADE,
  reservation_id    uuid        NULL REFERENCES public.reservations(id)  ON DELETE SET NULL,
  task_id           uuid        NULL REFERENCES public.tasks(id)         ON DELETE SET NULL,
  conversation_id   uuid        NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  actor_id          uuid        NULL REFERENCES public.users(id)         ON DELETE SET NULL,
  actor_type        text        NOT NULL DEFAULT 'system',
  event_type        text        NOT NULL,
  event_title       text        NOT NULL,
  event_description text        NULL,
  metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT timeline_actor_type_check
    CHECK (actor_type IN ('homeowner', 'partner', 'guest', 'ai', 'system'))
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_timeline_property_id     ON public.timeline_events (property_id);
CREATE INDEX idx_timeline_reservation_id  ON public.timeline_events (reservation_id);
CREATE INDEX idx_timeline_task_id         ON public.timeline_events (task_id);
CREATE INDEX idx_timeline_conversation_id ON public.timeline_events (conversation_id);
CREATE INDEX idx_timeline_actor_id        ON public.timeline_events (actor_id);
CREATE INDEX idx_timeline_event_type      ON public.timeline_events (event_type);
CREATE INDEX idx_timeline_created_at      ON public.timeline_events (created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Homeowner: select events linked to their portfolio via any foreign key path.
CREATE POLICY "homeowner_select_timeline"
  ON public.timeline_events FOR SELECT
  USING (
    -- direct property link
    (property_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = timeline_events.property_id
        AND p.owner_id = auth.uid()
    ))
    OR
    -- via reservation
    (reservation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN  public.properties p ON p.id = r.property_id
      WHERE r.id = timeline_events.reservation_id
        AND p.owner_id = auth.uid()
    ))
    OR
    -- via task
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = timeline_events.task_id
        AND p.owner_id = auth.uid()
    ))
    OR
    -- via conversation
    (conversation_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = timeline_events.conversation_id
        AND c.owner_id = auth.uid()
    ))
  );

-- Partner: select events for tasks they are assigned to, or events they created.
CREATE POLICY "partner_select_timeline"
  ON public.timeline_events FOR SELECT
  USING (
    (task_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = timeline_events.task_id
        AND t.assigned_partner_id = auth.uid()
    ))
    OR actor_id = auth.uid()
  );

-- Authenticated users may insert events only as themselves.
-- System/service-role events are out of scope for MVP and will be handled
-- by a backend role with RLS bypassed. Frontend callers must always supply
-- actor_id = auth.uid() (enforced by nauxica-timeline.js).
CREATE POLICY "authenticated_insert_timeline"
  ON public.timeline_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());
