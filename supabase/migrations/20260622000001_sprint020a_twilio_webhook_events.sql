-- Sprint 020A: Idempotency table for Twilio inbound webhook deduplication.
--
-- One row per Twilio MessageSid. The row is claimed (INSERT) before any business
-- logic runs. Duplicate deliveries conflict on the PRIMARY KEY and are rejected
-- immediately without executing resolveByPhone, context load, classifier,
-- escalation, or any message/task INSERT.
--
-- Status lifecycle:
--   processing  →  processed   (happy path and handled error paths: unauthorized, unverified)
--   processing  →  failed      (unexpected processing error)
--   processing  →  processing  (stuck: function crashed after claim, before finalise)
--
-- Stuck 'processing' rows: identify with
--   SELECT * FROM twilio_webhook_events
--   WHERE status = 'processing' AND created_at < now() - interval '5 minutes';
-- These require manual investigation. Twilio retries are blocked (SID is claimed).
--
-- phone_prefix: first 6 chars of the stripped E.164 number. Never full phone.
-- error_message: populated only on status='failed'.

CREATE TABLE public.twilio_webhook_events (
  message_sid   TEXT        PRIMARY KEY,
  status        TEXT        NOT NULL DEFAULT 'processing',
  phone_prefix  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at  TIMESTAMPTZ,
  error_message TEXT,

  CONSTRAINT twilio_webhook_events_status_check
    CHECK (status IN ('processing', 'processed', 'failed'))
);

-- For monitoring: list recent failures and identify stuck-processing records.
CREATE INDEX twilio_webhook_events_status_created_idx
  ON public.twilio_webhook_events (status, created_at DESC);

-- Only service_role (edge functions) may read or write.
-- No anon/authenticated policies — this table is internal to the webhook pipeline.
ALTER TABLE public.twilio_webhook_events ENABLE ROW LEVEL SECURITY;
