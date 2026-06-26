-- Sprint 029C.2: operations conversations schema foundation
--
-- This migration is purely additive:
--   - creates two new tables (operations_conversations, operations_messages)
--   - adds one nullable FK column to timeline_events
--
-- It does NOT touch:
--   - any frontend file
--   - any Edge Function
--   - any existing migration
--   - guest conversations / messages — those tables are completely untouched,
--     both in schema and in existing RLS policies. Operations conversations
--     are a fully separate domain (separate tables), not a discriminator
--     column on the guest-facing tables.
--   - Supabase Storage — no bucket or storage.objects policy is created here.
--   - timeline_events' existing INSERT policy — that hardening is deferred
--     to a later sprint, after regression-testing every existing
--     NauxicaTimeline.log() call site. This migration only adds a nullable
--     column and an index; it does not touch any policy on timeline_events.
--
-- "Task is the security gate": every RLS policy below resolves access via
-- tasks.assigned_partner_id (partner) or properties.owner_id (homeowner),
-- the same pattern already established in
-- supabase/migrations/20260626000001_sprint029c_task_evidence_schema.sql.

-- ============================================================
-- 1. operations_conversations
-- ============================================================

CREATE TABLE public.operations_conversations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  property_id     uuid        NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'open',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NULL,

  CONSTRAINT operations_conversations_status_check
    CHECK (status IN ('open', 'resolved', 'archived')),
  CONSTRAINT operations_conversations_task_id_key
    UNIQUE (task_id)
);

CREATE INDEX idx_operations_conversations_task_id         ON public.operations_conversations (task_id);
CREATE INDEX idx_operations_conversations_property_id     ON public.operations_conversations (property_id);
CREATE INDEX idx_operations_conversations_status          ON public.operations_conversations (status);
CREATE INDEX idx_operations_conversations_last_message_at ON public.operations_conversations (last_message_at);

-- updated_at: reuse the existing shared trigger function (public.set_updated_at).
-- No new trigger function is created — same function already reused by
-- conversations, properties, reservations, users, tasks,
-- property_knowledge_blocks, emergency_data, emergency_contacts,
-- whatsapp_sessions, and task_evidence_checks (migration 029C.1).
CREATE TRIGGER operations_conversations_set_updated_at
  BEFORE UPDATE ON public.operations_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.operations_conversations ENABLE ROW LEVEL SECURITY;

-- SELECT: assigned partner
CREATE POLICY "operations_conversations: partner select assigned"
  ON public.operations_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = operations_conversations.task_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- SELECT: property owner
CREATE POLICY "operations_conversations: owner select via property"
  ON public.operations_conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = operations_conversations.property_id
        AND p.owner_id = auth.uid()
    )
  );

-- INSERT: assigned partner OR property owner, only for a real task whose
-- property_id matches the task's actual property_id (prevents a caller
-- from pairing a task_id with a mismatched property_id).
CREATE POLICY "operations_conversations: partner or owner insert"
  ON public.operations_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = operations_conversations.task_id
        AND t.property_id = operations_conversations.property_id
        AND (
          t.assigned_partner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = t.property_id
              AND p.owner_id = auth.uid()
          )
        )
    )
  );

-- UPDATE: assigned partner or property owner, for conversations they can
-- already access (status / last_message_at changes).
CREATE POLICY "operations_conversations: partner or owner update"
  ON public.operations_conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = operations_conversations.task_id
        AND (
          t.assigned_partner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = t.property_id
              AND p.owner_id = auth.uid()
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = operations_conversations.task_id
        AND (
          t.assigned_partner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = t.property_id
              AND p.owner_id = auth.uid()
          )
        )
    )
  );

-- No DELETE policy.

-- ============================================================
-- 2. operations_messages
-- ============================================================

CREATE TABLE public.operations_messages (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  operations_conversation_id  uuid        NOT NULL REFERENCES public.operations_conversations(id) ON DELETE CASCADE,
  sender_type                 text        NOT NULL,
  message_text                text        NOT NULL,
  is_read                      boolean     NOT NULL DEFAULT false,
  created_at                   timestamptz NOT NULL DEFAULT now(),

  -- Deliberately excludes 'guest' — a guest can never be a valid sender in
  -- the operations domain, enforced at the data-modeling level, not just RLS.
  CONSTRAINT operations_messages_sender_type_check
    CHECK (sender_type IN ('partner', 'ai', 'homeowner', 'system'))
);

CREATE INDEX idx_operations_messages_conversation_id ON public.operations_messages (operations_conversation_id);
CREATE INDEX idx_operations_messages_sender_type     ON public.operations_messages (sender_type);
CREATE INDEX idx_operations_messages_created_at      ON public.operations_messages (created_at);

-- ── Row Level Security ──────────────────────────────────────────────────

ALTER TABLE public.operations_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: assigned partner, via the conversation's linked task
CREATE POLICY "operations_messages: partner select via task"
  ON public.operations_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operations_conversations oc
      JOIN  public.tasks t ON t.id = oc.task_id
      WHERE oc.id = operations_messages.operations_conversation_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- SELECT: property owner, via the conversation's linked property
CREATE POLICY "operations_messages: owner select via property"
  ON public.operations_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operations_conversations oc
      JOIN  public.properties p ON p.id = oc.property_id
      WHERE oc.id = operations_messages.operations_conversation_id
        AND p.owner_id = auth.uid()
    )
  );

-- INSERT: assigned partner may only insert as sender_type = 'partner'
CREATE POLICY "operations_messages: partner insert as partner"
  ON public.operations_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'partner'
    AND EXISTS (
      SELECT 1 FROM public.operations_conversations oc
      JOIN  public.tasks t ON t.id = oc.task_id
      WHERE oc.id = operations_messages.operations_conversation_id
        AND t.assigned_partner_id = auth.uid()
    )
  );

-- INSERT: property owner may only insert as sender_type = 'homeowner'
CREATE POLICY "operations_messages: owner insert as homeowner"
  ON public.operations_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'homeowner'
    AND EXISTS (
      SELECT 1 FROM public.operations_conversations oc
      JOIN  public.properties p ON p.id = oc.property_id
      WHERE oc.id = operations_messages.operations_conversation_id
        AND p.owner_id = auth.uid()
    )
  );

-- No authenticated INSERT policy for sender_type 'ai' / 'system' — those
-- messages will be written later by an Edge Function using the service
-- role (which bypasses RLS entirely), the same pattern already used for
-- AI/system messages in the existing guest-facing concierge pipeline.
-- No UPDATE policy. No DELETE policy.

-- ============================================================
-- 3. timeline_events — additive linkage only, no policy changes
-- ============================================================

ALTER TABLE public.timeline_events
  ADD COLUMN operations_conversation_id uuid NULL
    REFERENCES public.operations_conversations(id) ON DELETE SET NULL;

CREATE INDEX idx_timeline_operations_conversation_id
  ON public.timeline_events (operations_conversation_id);

-- Existing conversation_id column (-> public.conversations, the guest
-- domain) is untouched. Existing timeline_events RLS policies
-- (homeowner_select_timeline, partner_select_timeline,
-- authenticated_insert_timeline) are untouched in this migration.
