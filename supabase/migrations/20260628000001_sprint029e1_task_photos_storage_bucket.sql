-- Sprint 029E.1: task-photos Storage bucket and Storage RLS
--
-- Goal: create the private Supabase Storage bucket that will hold the
-- actual photo files for public.task_photos, plus the storage.objects
-- RLS policies that gate access to it. This migration touches Storage
-- only — public.task_photos itself (created in
-- supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql)
-- is not modified: no new columns, no thumbnail support, nothing. Upload
-- UI/helpers are out of scope for this sprint too; this is the storage
-- foundation a later sprint's upload helper will write through.
--
-- Path convention
-- ----------------
-- task_photos.storage_path stores the path *inside* the bucket, not
-- including the bucket name itself:
--
--     task_photos.storage_path = '{task_id}/{photo_id}.{ext}'
--
-- The full Storage object address is bucket + that path:
--
--     task-photos/{task_id}/{photo_id}.{ext}
--
-- so inside storage.objects.name (which is bucket-relative), the FIRST
-- folder segment is task_id, not the bucket name. Every policy below
-- reads that first segment via storage.foldername(name)[1] and resolves
-- access through it, exactly the way public.task_photos.task_id already
-- does for the Postgres-side table.
--
-- "Task is the security gate", same pattern as every other table in this
-- project (public.task_photos itself, public.task_evidence_checks,
-- public.timeline_events, public.tasks RLS from migrations/003_partner_rls.sql):
--   - partner access  -> tasks.assigned_partner_id = auth.uid()
--   - homeowner access -> tasks.property_id -> properties.id -> properties.owner_id = auth.uid()
--
-- Access summary
-- ----------------
--   - Partner (assigned to the task): INSERT + SELECT only. No UPDATE/DELETE
--     — photos are append-only evidence, identical to public.task_photos'
--     own "no UPDATE policy / no DELETE policy" stance.
--   - Homeowner (owns the property the task belongs to): SELECT only.
--   - Guest: no policy at all — guests cannot read or write task photos.
--   - Public/anon: none. The bucket is created with public = false, and
--     every policy below is scoped TO authenticated, so there is no
--     anonymous or public-URL access path.
--   - Service role (future Edge Functions / AI Concierge): bypasses RLS
--     entirely, as it already does for every Postgres table in this
--     project. No explicit policy is needed or added for it here.
--
-- This migration is purely additive and safely re-runnable: the bucket
-- insert uses ON CONFLICT DO NOTHING, and every policy is guarded by a
-- pg_policies existence check before creation (same idempotency pattern
-- used in supabase/migrations/20260626000003_sprint029d0_partner_context_read.sql).
-- It does not remove, replace, or weaken any existing policy on any table,
-- and does not touch public.task_photos, any other table, any Edge
-- Function, or any frontend file.

-- ============================================================
-- 1. Bucket: task-photos (private)
-- ============================================================
-- public = false: no object in this bucket is ever reachable via a
-- public/unauthenticated URL. All access goes through the policies
-- below, which require an authenticated session.

INSERT INTO storage.buckets (id, name, public)
VALUES ('task-photos', 'task-photos', false)
ON CONFLICT (id) DO NOTHING;

-- storage.objects already has Row Level Security enabled by Supabase
-- at the platform level for every project — this migration only adds
-- policies to it, it does not (and must not) try to alter that table's
-- structure or RLS-enabled state.

-- ============================================================
-- 2. INSERT — assigned partner only
-- ============================================================
-- Expected object path: {task_id}/{photo_id}.{ext}
-- (storage.foldername(name))[1] is the first folder segment of that
-- path, i.e. the task_id. A partner may upload into this bucket only
-- when that task_id resolves to a task they are assigned to.
--
-- Every policy below checks that segment against a UUID-format regex
-- before casting it ::uuid — an upload with a malformed/non-UUID first
-- segment would otherwise raise a cast error inside the policy
-- evaluation itself (a hard failure) instead of simply being denied.
-- The regex guard turns that into an ordinary "no matching row" denial.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'task-photos storage: partner insert assigned'
  ) THEN
    CREATE POLICY "task-photos storage: partner insert assigned"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'task-photos'
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND t.id = ((storage.foldername(name))[1])::uuid
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 3. SELECT — assigned partner
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'task-photos storage: partner select assigned'
  ) THEN
    CREATE POLICY "task-photos storage: partner select assigned"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'task-photos'
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          WHERE (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND t.id = ((storage.foldername(name))[1])::uuid
            AND t.assigned_partner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- ============================================================
-- 4. SELECT — property owner (homeowner), via the task's property
-- ============================================================
-- Same join shape as "task_photos: owner select via property" in
-- supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql:
-- tasks.property_id -> properties.id -> properties.owner_id = auth.uid().

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'task-photos storage: owner select via property'
  ) THEN
    CREATE POLICY "task-photos storage: owner select via property"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'task-photos'
        AND EXISTS (
          SELECT 1 FROM public.tasks t
          JOIN  public.properties p ON p.id = t.property_id
          WHERE (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            AND t.id = ((storage.foldername(name))[1])::uuid
            AND p.owner_id = auth.uid()
        )
      );
  END IF;
END
$$;

-- No UPDATE policy: uploaded photos are not editable in place — the
-- same "append only" stance public.task_photos already takes (no
-- UPDATE policy there either).
--
-- No DELETE policy: evidence is not removable by authenticated users
-- via the client, matching public.task_photos and
-- public.task_evidence_checks.
--
-- No guest policy: guests have no row in any of the auth paths above
-- and no policy grants them access — confirmed absent by design, not
-- by omission.
--
-- No public/anon policy: the bucket is private (public = false) and
-- every policy above is scoped TO authenticated only.
