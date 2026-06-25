-- Sprint 029C.1: task evidence schema foundation
--
-- This migration is purely additive:
--   - widens an existing CHECK constraint (tasks.task_type)
--   - adds one missing index (tasks.assigned_partner_id)
--   - creates two new tables (task_photos, task_evidence_checks)
--
-- It does NOT touch:
--   - any frontend file
--   - any Edge Function
--   - any existing migration
--   - conversations / messages (operations conversations are a later migration)
--   - timeline_events or its RLS policies (linkage is a later migration)
--   - Supabase Storage — no bucket or storage.objects policy is created here;
--     task_photos.storage_path is just a text column with no enforced bucket yet.
--
-- "Task is the security gate": every RLS policy below resolves access via
-- tasks.assigned_partner_id (partner) or tasks.property_id -> properties.owner_id
-- (homeowner), exactly the pattern already established for tasks itself
-- (migrations/003_partner_rls.sql) and for properties partner-read access
-- (supabase/migrations/20260625000001_sprint027d2g_partner_properties_read.sql).

-- ============================================================
-- 1. Extend tasks.task_type to allow 'transfers' and 'experiences'
-- ============================================================

ALTER TABLE public.tasks DROP CONSTRAINT tasks_task_type_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_task_type_check
  CHECK (task_type IN (
    'cleaning', 'maintenance', 'inspection', 'laundry', 'guest_request', 'other',
    'transfers', 'experiences'
  ));

-- ============================================================
-- 2. Missing index — every partner RLS policy on tasks filters on this
--    column (assigned_partner_id = auth.uid()), and every new table's RLS
--    below joins through tasks on the same column. Was never indexed.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_partner_id
  ON public.tasks (assigned_partner_id);

-- ============================================================
-- 3. task_photos
-- ============================================================

CREATE TABLE public.task_photos (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  uploaded_by   uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  photo_type    text        NOT NULL DEFAULT 'other',
  storage_path  text        NOT NULL,
  caption       text        NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT task_photos_photo_type_check
    CHECK (photo_type IN ('before', 'after', 'issue', 'completion', 'other'))
);

CREATE INDEX idx_task_photos_task_id     ON public.task_photos (task_id);
CREATE INDEX idx_task_photos_uploaded_by ON public.task_photos (uploaded_by);

-- ── Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.task_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: assigned partner
CREATE POLICY "task_photos: partner select assigned"
  ON public.task_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_photos.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- SELECT: property owner (task is the security gate -> property -> owner)
CREATE POLICY "task_photos: owner select via property"
  ON public.task_photos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = task_photos.task_id
        AND p.owner_id = auth.uid()
    )
  );

-- INSERT: only the assigned partner, and only as themselves
CREATE POLICY "task_photos: partner insert assigned"
  ON public.task_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_photos.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- No UPDATE policy: photos are append-only evidence, never edited.
-- No DELETE policy: evidence is not removable by authenticated users.

-- ============================================================
-- 4. task_evidence_checks
-- ============================================================

CREATE TABLE public.task_evidence_checks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  check_key     text        NOT NULL,
  is_checked    boolean     NOT NULL DEFAULT false,
  note          text        NULL,
  photo_id      uuid        NULL REFERENCES public.task_photos(id) ON DELETE SET NULL,
  completed_at  timestamptz NULL,
  completed_by  uuid        NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT task_evidence_checks_task_check_key_unique
    UNIQUE (task_id, check_key)
);

CREATE INDEX idx_task_evidence_checks_task_id      ON public.task_evidence_checks (task_id);
CREATE INDEX idx_task_evidence_checks_completed_by ON public.task_evidence_checks (completed_by);
CREATE INDEX idx_task_evidence_checks_photo_id     ON public.task_evidence_checks (photo_id);

-- updated_at: reuse the existing shared trigger function (public.set_updated_at,
-- defined in migrations/001_conversations.sql and redefined identically via
-- CREATE OR REPLACE in supabase/migrations/20260607000001_sprint1_core_schema.sql).
-- No new trigger function is created — every other updated_at column in this
-- project (conversations, properties, reservations, users, tasks,
-- property_knowledge_blocks, emergency_data, emergency_contacts,
-- whatsapp_sessions) already uses this same function.
CREATE TRIGGER task_evidence_checks_set_updated_at
  BEFORE UPDATE ON public.task_evidence_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.task_evidence_checks ENABLE ROW LEVEL SECURITY;

-- SELECT: assigned partner
CREATE POLICY "task_evidence_checks: partner select assigned"
  ON public.task_evidence_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_evidence_checks.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- SELECT: property owner
CREATE POLICY "task_evidence_checks: owner select via property"
  ON public.task_evidence_checks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      JOIN  public.properties p ON p.id = t.property_id
      WHERE t.id = task_evidence_checks.task_id
        AND p.owner_id = auth.uid()
    )
  );

-- INSERT: only the assigned partner, for their own assigned task
CREATE POLICY "task_evidence_checks: partner insert assigned"
  ON public.task_evidence_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_evidence_checks.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- UPDATE: only the assigned partner, for their own assigned task
-- (USING and WITH CHECK both applied so a row can't be re-pointed to a
-- task the partner isn't assigned to via the update itself.)
CREATE POLICY "task_evidence_checks: partner update assigned"
  ON public.task_evidence_checks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_evidence_checks.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_evidence_checks.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- No DELETE policy: evidence checks are not removable by authenticated users.
