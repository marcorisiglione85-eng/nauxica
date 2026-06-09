-- ============================================================
-- Nauxica — Sprint 1: Core Schema Implementation
-- Migration: 20260607000001_sprint1_core_schema
-- Tables:    public.users · public.properties · public.reservations
-- Includes:  enums · sequences · functions · auth hook · RLS · indexes
-- ============================================================


-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

CREATE TYPE public.account_type AS ENUM (
  'homeowner',
  'partner'
);

CREATE TYPE public.business_type AS ENUM (
  'individual',
  'sole_trader',
  'company'
);

CREATE TYPE public.nauxica_plan_tier AS ENUM (
  'starter',
  'professional',
  'premium'
);

CREATE TYPE public.account_status AS ENUM (
  'pending',
  'active',
  'suspended',
  'closed'
);

CREATE TYPE public.background_check_status AS ENUM (
  'not_started',
  'submitted',
  'approved',
  'rejected'
);

CREATE TYPE public.service_type AS ENUM (
  'cleaning',
  'maintenance',
  'laundry',
  'transfers',
  'experiences'
);

-- platform_status governs property lifecycle (draft → active → archived).
CREATE TYPE public.platform_status AS ENUM (
  'draft',
  'onboarding',
  'pending_activation',
  'active',
  'suspended',
  'archived'
);

CREATE TYPE public.availability_status AS ENUM (
  'available',
  'unavailable',
  'maintenance'
);

CREATE TYPE public.property_type AS ENUM (
  'apartment',
  'villa',
  'house',
  'room',
  'studio'
);

CREATE TYPE public.guest_document_type AS ENUM (
  'passport',
  'id_card',
  'driving_licence'
);

CREATE TYPE public.reservation_status AS ENUM (
  'confirmed',
  'pre_arrival',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
);

-- canonical booking_source enum; no 'cancelled' value
CREATE TYPE public.booking_source AS ENUM (
  'direct',
  'airbnb',
  'booking_com',
  'vrbo',
  'other'
);


-- ============================================================
-- 2. SEQUENCES
-- ============================================================

-- property_code_seq: numeric portion of NAU-XXXXX property codes
CREATE SEQUENCE IF NOT EXISTS public.property_code_seq
  START 1
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- confirmation_number_seq: numeric portion of NX-YYYY-NNNNN confirmation numbers
CREATE SEQUENCE IF NOT EXISTS public.confirmation_number_seq
  START 1
  INCREMENT 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;


-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- generate_property_code: called as DEFAULT on properties.property_code.
-- Format: NAU-XXXXX (zero-padded to 5 digits).
-- The code is immutable — no UPDATE path touches this column.
CREATE OR REPLACE FUNCTION public.generate_property_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'NAU-' || LPAD(nextval('public.property_code_seq')::text, 5, '0');
$$;

-- generate_confirmation_number: called as DEFAULT on reservations.confirmation_number.
-- Format: NX-YYYY-NNNNN (calendar year at generation time; zero-padded to 5 digits).
-- The year is embedded at generation time — the sequence itself is global and never resets.
CREATE OR REPLACE FUNCTION public.generate_confirmation_number()
RETURNS text
LANGUAGE sql
AS $$
  SELECT 'NX-' || EXTRACT(YEAR FROM now())::integer::text
      || '-' || LPAD(nextval('public.confirmation_number_seq')::text, 5, '0');
$$;

-- set_updated_at: BEFORE UPDATE trigger to maintain updated_at timestamps.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- 4. TABLES
-- ============================================================

-- ------------------------------------------------------------
-- 4.1  public.users
--
-- Application profile table. Credential storage lives exclusively
-- in auth.users (Supabase GoTrue) — there is no password_hash here.
-- This table is populated by the handle_new_user auth hook (§6).
--
-- id comes from GoTrue (auth.users.id); no gen_random_uuid() default.
--
-- average_rating and total_jobs_completed are NOT stored columns.
-- They are computed from partner_requests at read time.
-- ------------------------------------------------------------
CREATE TABLE public.users (
  -- Identity
  id                        uuid                     NOT NULL,
  email                     text                     NOT NULL,
  account_type              public.account_type      NOT NULL,

  -- Profile
  full_name                 text                     NOT NULL,
  display_name              text,
  phone_number              text                     NOT NULL,
  profile_photo_url         text,

  -- Legal / billing
  -- codice_fiscale_or_piva: nullable at registration; collected during onboarding.
  --   Must not be inserted with a placeholder value. Encrypt at rest.
  codice_fiscale_or_piva    text,
  business_type             public.business_type,

  -- Verification flags
  is_email_verified         boolean                  NOT NULL DEFAULT false,
  is_phone_verified         boolean                  NOT NULL DEFAULT false,
  is_identity_verified      boolean                  NOT NULL DEFAULT false,

  -- Plan & account state
  nauxica_plan_tier         public.nauxica_plan_tier NOT NULL DEFAULT 'starter',
  -- plan_started_at / plan_renews_at: nullable at MVP; managed by Stripe billing module.
  plan_started_at           timestamptz,
  plan_renews_at            timestamptz,
  account_status            public.account_status    NOT NULL DEFAULT 'pending',
  preferred_language        text                     NOT NULL DEFAULT 'en',

  -- Documents
  id_document_url           text,
  insurance_document_url    text,

  -- Partner-specific fields (null for homeowners)
  partner_service_types     public.service_type[],
  operating_areas           text[],
  background_check_status   public.background_check_status DEFAULT 'not_started',
  is_accepting_jobs         boolean                  DEFAULT true,
  trust_score               integer                  CHECK (trust_score BETWEEN 0 AND 100),
  reliability_score         integer                  CHECK (reliability_score BETWEEN 0 AND 100),

  -- Timestamps
  created_at                timestamptz              NOT NULL DEFAULT now(),
  updated_at                timestamptz              NOT NULL DEFAULT now(),

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_id_fkey FOREIGN KEY (id)
    REFERENCES auth.users(id) ON DELETE CASCADE
);

COMMENT ON TABLE  public.users IS 'Application user profiles. 1-to-1 with auth.users via GoTrue trigger. No credential storage here.';
COMMENT ON COLUMN public.users.codice_fiscale_or_piva IS 'Italian tax ID. Nullable at registration — collected during onboarding. Encrypt at rest (legal requirement). No placeholder values.';
COMMENT ON COLUMN public.users.plan_started_at        IS 'Nullable at MVP. Set by Stripe billing module when subscription activates. Not client-provided.';
COMMENT ON COLUMN public.users.plan_renews_at         IS 'Nullable at MVP. Set by Stripe billing module when subscription activates. Not client-provided.';


-- ------------------------------------------------------------
-- 4.2  public.properties
--
-- Top-level resource. All child records (reservations, tasks,
-- partner_requests, messages) reference properties.id as FK.
-- property_code is a human-readable reference — never a FK.
-- ------------------------------------------------------------
CREATE TABLE public.properties (
  -- Identity
  id                        uuid                       NOT NULL DEFAULT gen_random_uuid(),
  -- property_code is server-generated via property_code_seq.
  -- Any client-provided value is ignored by the API.
  property_code             text                       NOT NULL DEFAULT public.generate_property_code(),
  owner_id                  uuid                       NOT NULL,

  -- Platform lifecycle
  schema_version            text                       NOT NULL DEFAULT '1.0',
  platform_status           public.platform_status     NOT NULL DEFAULT 'draft',
  availability_status       public.availability_status,
  nauxica_plan_tier         public.nauxica_plan_tier   NOT NULL DEFAULT 'starter',
  activated_at              timestamptz,

  -- Core profile (API required fields)
  display_name              text                       NOT NULL,
  property_type             public.property_type       NOT NULL,
  max_guests                integer                    NOT NULL CHECK (max_guests > 0),
  bedrooms                  integer                    NOT NULL CHECK (bedrooms >= 0),
  bathrooms                 integer                    NOT NULL CHECK (bathrooms >= 0),

  -- Location (field names match API endpoint contract, not property-data-schema.md)
  area_description          text,
  address_street            text,
  address_city              text                       NOT NULL,
  address_province          text                       NOT NULL,
  address_postal_code       text,
  address_country           text                       NOT NULL DEFAULT 'IT',

  -- Configuration
  beds_configuration        jsonb,
  amenities                 text[],
  checkin_time              text,
  checkout_time             text,
  access_method             text,
  house_rules               text,
  cancellation_policy       text,

  -- Italian regulatory compliance
  cir_code                  text,
  alloggiati_web_required   boolean                    NOT NULL DEFAULT false,
  tourist_tax_enabled       boolean                    NOT NULL DEFAULT false,
  tourist_tax_amount_eur    numeric(10, 2),
  tourist_tax_exemptions    jsonb,

  -- Listing channels
  listing_channels          text[],
  listing_urls              jsonb,

  -- Internal
  owner_notes               text,
  -- dynamic_instructions: per-scenario AI concierge instructions (future integration)
  dynamic_instructions      jsonb,

  -- Timestamps
  created_at                timestamptz                NOT NULL DEFAULT now(),
  updated_at                timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT properties_pkey              PRIMARY KEY (id),
  CONSTRAINT properties_property_code_key UNIQUE (property_code),
  CONSTRAINT properties_owner_id_fkey     FOREIGN KEY (owner_id)
    REFERENCES public.users(id)
);

COMMENT ON TABLE  public.properties IS 'Top-level resource. All reservations, tasks, and partner_requests reference properties.id.';
COMMENT ON COLUMN public.properties.property_code        IS 'Human-readable reference (NAU-XXXXX). Server-generated via property_code_seq. Immutable. Never a FK.';
COMMENT ON COLUMN public.properties.dynamic_instructions IS 'Per-scenario AI concierge instructions. Reserved for future concierge integration.';


-- ------------------------------------------------------------
-- 4.3  public.reservations
--
-- Canonical guest stay record. The frontend "Guests" page and
-- guest detail views display data from this table — there is no
-- separate guest entity and no /guests endpoint.
--
-- Guest identity is carried within the reservation record.
-- guest_phone (E.164) is the WhatsApp anchor for AI concierge
-- resolution against active reservations.
--
-- There is no homeowner_id column here. Homeowner ownership is
-- resolved via: property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid()).
--
-- Date overlap enforcement is at the API layer.
-- A DB EXCLUDE constraint (btree_gist extension) is deferred to Sprint 2.
-- ------------------------------------------------------------
CREATE TABLE public.reservations (
  -- Identity
  id                            uuid                       NOT NULL DEFAULT gen_random_uuid(),
  property_id                   uuid                       NOT NULL,
  -- confirmation_number: auto-generated via confirmation_number_seq if not provided by client.
  confirmation_number           text                       NOT NULL DEFAULT public.generate_confirmation_number(),

  -- Guest identity (guest is NOT a platform user)
  guest_name                    text                       NOT NULL,
  guest_phone                   text                       NOT NULL,
  guest_phone_verified          boolean                    NOT NULL DEFAULT false,
  guest_email                   text,
  guest_preferred_language      text                       NOT NULL DEFAULT 'en',
  -- guest_nationality: nullable at MVP; required for Alloggiati Web (future module)
  guest_nationality             text,
  guest_document_type           public.guest_document_type,
  guest_document_number         text,
  guest_count                   integer                    NOT NULL CHECK (guest_count > 0),
  guest_count_adults            integer,
  guest_count_children_under_12 integer,

  -- Stay dates
  checkin_date                  date                       NOT NULL,
  checkout_date                 date                       NOT NULL,
  -- nights: derived from date arithmetic; never stored externally
  nights                        integer                    GENERATED ALWAYS AS (checkout_date - checkin_date) STORED,

  -- Italian compliance
  tourist_tax_total_eur         numeric(10, 2),
  tourist_tax_collected         boolean                    NOT NULL DEFAULT false,
  alloggiati_registered         boolean                    NOT NULL DEFAULT false,

  -- Booking context
  booking_source                public.booking_source,
  special_requests              text,
  internal_notes                text,

  -- Lifecycle
  reservation_status            public.reservation_status  NOT NULL DEFAULT 'confirmed',
  checkin_completed_at          timestamptz,
  checkout_completed_at         timestamptz,

  -- Timestamps
  created_at                    timestamptz                NOT NULL DEFAULT now(),
  updated_at                    timestamptz                NOT NULL DEFAULT now(),

  CONSTRAINT reservations_pkey                   PRIMARY KEY (id),
  CONSTRAINT reservations_confirmation_number_key UNIQUE (confirmation_number),
  CONSTRAINT reservations_property_id_fkey        FOREIGN KEY (property_id)
    REFERENCES public.properties(id),
  CONSTRAINT reservations_checkout_after_checkin  CHECK (checkout_date > checkin_date)
);

COMMENT ON TABLE  public.reservations IS 'Canonical guest stay records. Frontend Guests page maps here. No separate guest entity.';
COMMENT ON COLUMN public.reservations.guest_phone         IS 'E.164-normalised. WhatsApp anchor for AI concierge guest identity resolution against status IN (pre_arrival, checked_in).';
COMMENT ON COLUMN public.reservations.guest_nationality   IS 'ISO 3166-1 alpha-2. Nullable at MVP. Conditionally required when Alloggiati Web module is implemented.';
COMMENT ON COLUMN public.reservations.confirmation_number IS 'Format NX-YYYY-NNNNN. Server-generated via confirmation_number_seq if not provided by client. Unique, immutable, never reused.';
COMMENT ON COLUMN public.reservations.nights              IS 'Generated column: checkout_date - checkin_date. Read-only.';


-- ============================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. AUTH HOOK — handle_new_user
--
-- Fires AFTER INSERT ON auth.users (Supabase GoTrue).
-- Creates the corresponding public.users profile row using
-- values from NEW.raw_user_meta_data (set by the registration API).
--
-- SECURITY DEFINER: runs with the function owner's privileges so
-- it can write to public.users even during the GoTrue insert.
--
-- ON CONFLICT (id) DO NOTHING: idempotent against replay/retry.
--
-- The outer EXCEPTION block ensures a profile creation failure
-- never rolls back the auth.users insert — authentication must
-- not be blocked by application-layer errors.
--
-- Edge Function fallback: if this trigger is disabled or fails
-- silently, the API server must create the public.users row
-- directly via the Supabase service role client.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_account_type  public.account_type;
  v_plan_tier     public.nauxica_plan_tier;
BEGIN
  -- Cast account_type from metadata; default to 'homeowner' on invalid value
  BEGIN
    v_account_type := (NEW.raw_user_meta_data->>'account_type')::public.account_type;
  EXCEPTION WHEN invalid_text_representation OR OTHERS THEN
    v_account_type := 'homeowner';
  END;

  -- Cast nauxica_plan_tier from metadata; default to 'starter' if absent or invalid
  BEGIN
    v_plan_tier := COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'nauxica_plan_tier', ''),
      'starter'
    )::public.nauxica_plan_tier;
  EXCEPTION WHEN invalid_text_representation OR OTHERS THEN
    v_plan_tier := 'starter';
  END;

  INSERT INTO public.users (
    id,
    email,
    account_type,
    full_name,
    phone_number,
    nauxica_plan_tier
  )
  VALUES (
    NEW.id,
    NEW.email,
    v_account_type,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'phone', NEW.phone, ''),
    v_plan_tier
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the auth.users insert
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- 7. ROW LEVEL SECURITY
--
-- service_role has BYPASSRLS in Supabase — no explicit service_role
-- policies are required. All policies below govern `authenticated`.
-- Unauthenticated (anon) access is denied by default.
-- ============================================================

ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 7.1  users policies
-- ------------------------------------------------------------

CREATE POLICY "users: select own record"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users: update own record"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ------------------------------------------------------------
-- 7.2  properties policies
-- ------------------------------------------------------------

CREATE POLICY "properties: select own"
  ON public.properties
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- INSERT requires caller to be a homeowner (account_type check via public.users)
CREATE POLICY "properties: insert own homeowners only"
  ON public.properties
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND account_type = 'homeowner'
    )
  );

CREATE POLICY "properties: update own"
  ON public.properties
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ------------------------------------------------------------
-- 7.3  reservations policies
--
-- There is no homeowner_id on reservations.
-- Ownership is resolved via the property ownership relationship:
--   property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())
-- This matches the RLS pattern documented in auth-strategy.md §9.2.
-- ------------------------------------------------------------

CREATE POLICY "reservations: select via owned properties"
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "reservations: insert via owned properties"
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "reservations: update via owned properties"
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    property_id IN (
      SELECT id FROM public.properties WHERE owner_id = auth.uid()
    )
  );


-- ============================================================
-- 8. INDEXES
--
-- FK columns used in RLS subqueries must be indexed — every
-- authenticated request against properties or reservations
-- runs the owner_id / property_id subquery.
-- ============================================================

-- properties: owner_id used in every RLS check and homeowner list query
CREATE INDEX idx_properties_owner_id
  ON public.properties (owner_id);

-- reservations: property_id used in every RLS check and reservation list query
CREATE INDEX idx_reservations_property_id
  ON public.reservations (property_id);

-- reservations: status used heavily for filtering (active guests, upcoming, etc.)
CREATE INDEX idx_reservations_status
  ON public.reservations (reservation_status);

-- reservations: guest_phone used by AI concierge for guest identity resolution
CREATE INDEX idx_reservations_guest_phone
  ON public.reservations (guest_phone);

-- reservations: date range queries (upcoming check-ins, calendar views)
CREATE INDEX idx_reservations_checkin_date
  ON public.reservations (checkin_date);


-- ============================================================
-- 9. GRANTS
--
-- Supabase applies default grants for authenticated/anon on the
-- public schema. Explicit grants below ensure the sequences are
-- accessible for DEFAULT expressions during authenticated INSERTs.
-- ============================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;

GRANT SELECT, INSERT, UPDATE ON public.users        TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.properties   TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.reservations TO authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.property_code_seq       TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.confirmation_number_seq TO authenticated;
