-- Migration 006: task economic value fields
-- Run manually in Supabase SQL Editor.
-- Prerequisite: migration 002 must already be applied.

ALTER TABLE public.tasks
  ADD COLUMN task_value_amount   numeric(10,2) NULL,
  ADD COLUMN task_value_currency text          NOT NULL DEFAULT 'EUR';
