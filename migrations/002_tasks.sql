-- Migration 002: tasks table
-- Run manually in Supabase SQL Editor.
-- Prerequisite: migration 001 must already be applied (public.set_updated_at() must exist).

-- ── Table ─────────────────────────────────────────────────────────────

CREATE TABLE public.tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id         uuid        NOT NULL REFERENCES public.properties(id)    ON DELETE CASCADE,
  reservation_id      uuid        NULL        REFERENCES public.reservations(id) ON DELETE SET NULL,
  title               text        NOT NULL,
  description         text        NULL,
  task_type           text        NOT NULL,
  priority            text        NOT NULL DEFAULT 'normal',
  status              text        NOT NULL DEFAULT 'open',
  assigned_partner_id uuid        NULL        REFERENCES public.users(id)      ON DELETE SET NULL,
  due_date            date        NULL,
  created_by          uuid        NOT NULL REFERENCES public.users(id)         ON DELETE CASCADE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  completed_at        timestamptz NULL,

  CONSTRAINT tasks_task_type_check
    CHECK (task_type IN ('cleaning', 'maintenance', 'inspection', 'laundry', 'guest_request', 'other')),

  CONSTRAINT tasks_priority_check
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled'))
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_tasks_property_id    ON public.tasks (property_id);
CREATE INDEX idx_tasks_reservation_id ON public.tasks (reservation_id);
CREATE INDEX idx_tasks_created_by     ON public.tasks (created_by);
CREATE INDEX idx_tasks_status         ON public.tasks (status);
CREATE INDEX idx_tasks_due_date       ON public.tasks (due_date);
CREATE INDEX idx_tasks_task_type      ON public.tasks (task_type);

-- ── Triggers ──────────────────────────────────────────────────────────

-- Auto-update updated_at (reuses function defined in migration 001)
CREATE TRIGGER tasks_set_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Set/clear completed_at when status transitions to/from 'completed'
CREATE OR REPLACE FUNCTION public.set_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at = now();
  ELSIF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_set_completed_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_completed_at();

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Homeowner: select tasks where the task's property belongs to them
CREATE POLICY "homeowner_select_tasks"
  ON public.tasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tasks.property_id
        AND p.owner_id = auth.uid()
    )
  );

-- Homeowner: insert tasks for their properties; must be the creator
CREATE POLICY "homeowner_insert_tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tasks.property_id
        AND p.owner_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Homeowner: update tasks for their properties
CREATE POLICY "homeowner_update_tasks"
  ON public.tasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = tasks.property_id
        AND p.owner_id = auth.uid()
    )
  );
