-- Migration 004: add 'accepted' status to task lifecycle
-- Run manually in Supabase SQL Editor.
-- Prerequisite: migration 002 must already be applied.

-- ── Extend status check constraint ────────────────────────────────────

-- Drop the existing constraint and recreate it with 'accepted' inserted
-- between 'assigned' and 'in_progress'. New lifecycle:
--   open → assigned → accepted → in_progress → completed / cancelled

ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;

ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('open', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled'));
