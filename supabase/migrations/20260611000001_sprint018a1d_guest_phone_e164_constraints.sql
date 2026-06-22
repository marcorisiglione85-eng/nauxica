-- Sprint 018A.1D — Guest phone E.164 format enforcement
--
-- Adds CHECK constraints requiring valid E.164 format on both guest_phone columns.
-- Pattern: ^\+[1-9][0-9]{6,14}$
--   \+          literal plus sign
--   [1-9]       first digit of country code (no ITU-T country code starts with 0)
--   [0-9]{6,14} remaining 6–14 digits
--   Total digits after +: 7–15 (ITU-T E.164 maximum)
--
-- Data pre-condition: both tables are 100% E.164-compliant as of Sprint 018A.1C.
-- Verified: 6/6 reservations, 5/5 whatsapp_sessions pass this regex.

ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_guest_phone_e164
  CHECK (guest_phone ~ '^\+[1-9][0-9]{6,14}$');

ALTER TABLE public.whatsapp_sessions
  ADD CONSTRAINT whatsapp_sessions_guest_phone_e164
  CHECK (guest_phone ~ '^\+[1-9][0-9]{6,14}$');
