-- Migration 001: conversations and messages tables
-- Run manually in Supabase SQL Editor.

-- ── Tables ────────────────────────────────────────────────────────────

CREATE TABLE public.conversations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid        NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  property_id    uuid        NOT NULL REFERENCES public.properties(id)   ON DELETE CASCADE,
  owner_id       uuid        NOT NULL REFERENCES public.users(id)        ON DELETE CASCADE,
  status         text        NOT NULL DEFAULT 'open',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz,

  CONSTRAINT conversations_status_check
    CHECK (status IN ('open', 'resolved', 'archived')),

  CONSTRAINT conversations_reservation_id_key
    UNIQUE (reservation_id)   -- one conversation per reservation (MVP)
);

CREATE TABLE public.messages (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type     text        NOT NULL,
  message_text    text        NOT NULL,
  is_read         boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT messages_sender_type_check
    CHECK (sender_type IN ('guest', 'ai', 'homeowner', 'partner', 'system'))
);

-- ── Indexes ───────────────────────────────────────────────────────────

CREATE INDEX idx_conversations_owner_id       ON public.conversations (owner_id);
CREATE INDEX idx_conversations_reservation_id ON public.conversations (reservation_id);
CREATE INDEX idx_conversations_property_id    ON public.conversations (property_id);
CREATE INDEX idx_messages_conversation_id     ON public.messages      (conversation_id);
CREATE INDEX idx_messages_created_at          ON public.messages      (created_at);

-- ── Triggers ──────────────────────────────────────────────────────────

-- Auto-update conversations.updated_at on any UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER conversations_set_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-update conversations.last_message_at when a message is inserted
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at      = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER messages_update_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message_at();

-- ── Row Level Security ────────────────────────────────────────────────

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

-- conversations: homeowner sees / writes only their own
CREATE POLICY "homeowner_select_conversations"
  ON public.conversations FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "homeowner_insert_conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "homeowner_update_conversations"
  ON public.conversations FOR UPDATE
  USING (owner_id = auth.uid());

-- messages: homeowner sees / writes messages in their conversations
CREATE POLICY "homeowner_select_messages"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "homeowner_insert_messages"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "homeowner_update_messages"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND c.owner_id = auth.uid()
    )
  );
