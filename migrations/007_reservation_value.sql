-- Migration 007: reservation economic value fields
-- Run manually in Supabase SQL Editor.
-- Prerequisite: reservations table must already exist (migration 001).

ALTER TABLE public.reservations
  ADD COLUMN reservation_value_amount   numeric(10,2) NULL,
  ADD COLUMN reservation_value_currency text          NOT NULL DEFAULT 'EUR';
