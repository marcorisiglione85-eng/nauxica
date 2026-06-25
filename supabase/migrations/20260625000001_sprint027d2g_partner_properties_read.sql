-- Sprint 027D.2G: partner read access to assigned-task properties
--
-- Root cause: public.properties only has a homeowner-scoped SELECT policy
-- ("properties: select own", owner_id = auth.uid()). Partners already have
-- a working SELECT policy on public.tasks for tasks assigned to them
-- (migration 003_partner_rls.sql, "partner_select_tasks"), but had no RLS
-- path to read the related properties row. PostgREST's tasks -> properties
-- embed therefore silently returned null for partners, even though the
-- underlying join is valid (confirmed via direct SQL and pg_policies
-- inspection) and task.property_id itself was always returned correctly.
--
-- This migration adds one additive SELECT policy on public.properties,
-- scoped to authenticated users who have at least one task assigned to
-- them on that property. It does not modify or replace any existing
-- policy; Postgres RLS OR's multiple permissive policies for the same
-- command together, so homeowner access is unaffected.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'properties'
      AND policyname = 'properties: partner read assigned task properties'
  ) THEN
    CREATE POLICY "properties: partner read assigned task properties"
      ON public.properties
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM public.tasks t
          WHERE t.property_id = properties.id
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;
