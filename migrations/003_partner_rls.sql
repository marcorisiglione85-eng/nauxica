-- Migration 003: partner RLS policies
-- Run manually in Supabase SQL Editor.
-- Prerequisites: migrations 001 and 002 must already be applied.

-- ── Partner policies on public.tasks ─────────────────────────────────

-- Partners can select tasks assigned to them.
CREATE POLICY "partner_select_tasks"
  ON public.tasks FOR SELECT
  USING (assigned_partner_id = auth.uid());

-- Partners can update tasks assigned to them.
-- WITH CHECK allows assigned_partner_id to become NULL so partners can
-- decline a task (sets status = 'open', assigned_partner_id = NULL).
CREATE POLICY "partner_update_tasks"
  ON public.tasks FOR UPDATE
  USING  (assigned_partner_id = auth.uid())
  WITH CHECK (assigned_partner_id = auth.uid() OR assigned_partner_id IS NULL);

-- ── Partner profile visibility on public.users ────────────────────────

-- Authenticated users need to read partner rows to populate the partner
-- select in operations.html and to resolve assigned_partner display names
-- in task joins. This policy adds read access to partner-type user rows
-- for all authenticated users. It is additive alongside any existing
-- policy that allows users to read their own row.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_read_partners"
  ON public.users FOR SELECT
  TO authenticated
  USING (account_type = 'partner');
