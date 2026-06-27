-- Sprint 029D.0: partner context read access for Job Detail
--
-- Goal: let an assigned partner read the reservation, property knowledge,
-- and emergency-contact context for a task they are assigned to, so
-- partner-job-detail.html (built in a later sprint) has real data to show.
--
-- "Task is the security gate": every policy below grants access only when
-- there exists a task with tasks.assigned_partner_id = auth.uid() linking
-- the partner to the row in question — the same pattern already used for
-- properties partner-read access
-- (supabase/migrations/20260625000001_sprint027d2g_partner_properties_read.sql)
-- and for every table created in
-- supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql and
-- supabase/migrations/20260626000002_sprint029c_operations_conversations.sql.
--
-- This migration is purely additive:
--   - adds four new SELECT policies (one per table), each guarded by a
--     pg_policies existence check so it is safely re-runnable
--   - does NOT remove, replace, or weaken any existing policy
--   - does NOT touch INSERT/UPDATE/DELETE on any of these tables
--   - does NOT touch conversations, messages, or timeline_events at all
--   - does NOT add any guest-facing access
--   - does NOT touch frontend files, Edge Functions, or Storage
--
-- Existing homeowner_select_* / "reservations: select via owned properties"
-- policies on these four tables are left completely untouched. Postgres RLS
-- OR's multiple permissive policies for the same command together, so
-- homeowner access is unaffected by these additions.

-- ============================================================
-- 1. reservations — partner read via assigned task
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'reservations'
      AND policyname = 'reservations: partner select via assigned task'
  ) THEN
    CREATE POLICY "reservations: partner select via assigned task"
      ON public.reservations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.reservation_id = reservations.id
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 2. property_knowledge_blocks — partner read PTR/GST blocks via
--    assigned task. PUB and INT scopes remain unreadable by partners.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'property_knowledge_blocks'
      AND policyname = 'partner_select_property_knowledge_blocks'
  ) THEN
    CREATE POLICY "partner_select_property_knowledge_blocks"
      ON public.property_knowledge_blocks
      FOR SELECT
      TO authenticated
      USING (
        visibility_scope IN ('PTR', 'GST')
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.property_id = property_knowledge_blocks.property_id
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 3. emergency_data — partner read via assigned task
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'emergency_data'
      AND policyname = 'partner_select_emergency_data'
  ) THEN
    CREATE POLICY "partner_select_emergency_data"
      ON public.emergency_data
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.property_id = emergency_data.property_id
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 4. emergency_contacts — partner read via assigned task
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'emergency_contacts'
      AND policyname = 'partner_select_emergency_contacts'
  ) THEN
    CREATE POLICY "partner_select_emergency_contacts"
      ON public.emergency_contacts
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE t.property_id = emergency_contacts.property_id
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;
