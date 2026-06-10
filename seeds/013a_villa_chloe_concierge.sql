-- ====================================================================
-- Sprint 013A Seed — Villa Chloe AI Concierge Data
-- ====================================================================
-- Property:    Villa Chloe
-- Code:        NAU-00003
-- property_id: 20d769a2-6f22-4882-8bd9-d00a26cf96cc
-- Location:    Via Etnea 2, Catania CT 95100
-- Type:        house · 1BR · 1BA · max 4 guests
--
-- Tables written:
--   public.property_knowledge_blocks  (9 blocks)
--   public.emergency_data              (1 row)
--   public.emergency_contacts          (3 rows: owner, caretaker, nauxica_operator)
--
-- Run as service_role in the Supabase SQL Editor.
-- RLS is bypassed by service_role — required for:
--   • INSERT on property_knowledge_blocks (homeowners cannot insert)
--   • INSERT of nauxica_operator contact   (homeowners cannot insert this type)
--
-- Fields marked [TEST PLACEHOLDER] are not yet confirmed by the homeowner.
-- Replace before go-live.
--
-- Idempotent: safe to run more than once.
--   • property_knowledge_blocks  — ON CONFLICT (property_id, block_type) DO UPDATE
--   • emergency_data             — ON CONFLICT (property_id) DO UPDATE
--   • emergency_contacts         — DELETE + INSERT scoped to this property and
--                                  these three contact types (no UNIQUE constraint
--                                  on the table; see migration 013)
-- ====================================================================

BEGIN;

-- ====================================================================
-- 1. property_knowledge_blocks
-- ====================================================================
-- Nine blocks for the first functional AI concierge session.
-- Credentials (key_box_code, wifi_password) are stored at their real
-- values. The resolver applies the SENTINEL '[not yet available]'
-- substitution at runtime when the access code gate is closed.
-- ====================================================================

-- ── property_summary ──────────────────────────────────────────────────
-- Scope: PUB — visible to all sessions, always pre-loaded.
-- Gate:  NULL — no phase restriction.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'property_summary',
  'PUB',
  NULL,
  'Property Summary',
  '{
    "summary": "Villa Chloe is a bright one-bedroom house in the heart of Catania, at the start of Via Etnea — the city''s famous baroque main street. The property is on an upper floor with a private balcony and lift access, sleeping up to 4 guests in comfort. It is ideally placed for exploring Catania''s historic centre, La Pescheria fish market, and Mount Etna excursions.",
    "property_type": "house",
    "area_description": "Via Etnea 2 is steps from Piazza del Duomo and the Fontana dell''Elefante, the symbol of Catania. The street is lined with baroque palazzi, independent cafés, and local restaurants. The central train station is 10 minutes on foot; the fish market is 5 minutes away. Mount Etna is clearly visible from the balcony on clear days.",
    "nearest_airport": "Catania-Fontanarossa (CTA) — approximately 6 km, 15–20 minutes by car or taxi",
    "max_guests": 4,
    "bedrooms": 1,
    "bathrooms": 1,
    "beds_configuration": "1 double bed.",
    "amenities": ["elevator", "balcony/terrace"],
    "listing_channels": ["Airbnb", "Booking.com", "direct"]
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0"}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── wifi ──────────────────────────────────────────────────────────────
-- Scope: GST — confirmed guests only.
-- Gate:  NULL — block always loadable; password gated at runtime by
--        isCredentialGateOpen() (sentinel outside check_in / in_stay).
-- [TEST PLACEHOLDER] wifi_network and wifi_password not yet confirmed.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'wifi',
  'GST',
  NULL,
  'WiFi & Connectivity',
  '{
    "wifi_network": "VillaChloe_Guests",
    "wifi_password": "TEST-WifiPassword-2024",
    "wifi_backup_note": "The router is in the hallway near the front door. If the connection drops, switch it off at the wall socket, wait 30 seconds, and switch it back on."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["wifi_network", "wifi_password"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── access ────────────────────────────────────────────────────────────
-- Scope: GST — confirmed guests only.
-- Gate:  NULL — block loadable in all phases; key_box_code gated at
--        runtime by the access code gate.
-- [TEST PLACEHOLDER] key_box_location and key_box_code not yet confirmed.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'access',
  'GST',
  NULL,
  'Access & Entry',
  '{
    "access_method": "key_box",
    "key_box_location": "TEST PLACEHOLDER — location of the key box at Via Etnea 2 to be confirmed by homeowner.",
    "key_box_code": "0000",
    "entry_instructions": "TEST PLACEHOLDER — full entry instructions for Via Etnea 2 to be confirmed by homeowner. The building has a lift. The apartment is on floor TBC.",
    "checkin_instructions": "Welcome to Villa Chloe. The balcony is through the door in the living area. The lift is at the end of the main corridor on the ground floor.",
    "lockout_instructions": "If you cannot get in, call the owner on +39 333 000 0001 [TEST PLACEHOLDER]. Do not force the lock. Nauxica operations are available 24/7 on +39 800 629 422."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["key_box_location", "key_box_code", "entry_instructions"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── check_in ──────────────────────────────────────────────────────────
-- Scope: PUB — times and arrival guidance are publicly shareable.
-- Gate:  NULL — phase-default for pre_arrival and check_in; loadable
--        on direct question in other phases.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'check_in',
  'PUB',
  NULL,
  'Check-in',
  '{
    "checkin_from": "15:00",
    "checkin_until": "20:00",
    "early_checkin_available": false,
    "late_checkin_available": false,
    "directions": "By taxi from Catania airport: approximately 15–20 minutes, €15–20. By bus: AMT Alibus from the airport to Stazione Centrale (approximately 20 minutes), then 10 minutes on foot north along Via Etnea. The property is at number 2, the first major building on the left as you enter Via Etnea from Piazza del Duomo."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0"}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── check_out ─────────────────────────────────────────────────────────
-- Scope: PUB — checkout time is publicly shareable.
-- Gate:  NULL — phase-default for check_out; loadable on direct
--        question in in_stay and post_stay.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'check_out',
  'PUB',
  NULL,
  'Check-out',
  '{
    "checkout_by": "10:00",
    "late_checkout_available": false,
    "checkout_tasks": [
      "Lock all windows and the front door.",
      "Switch off all lights and appliances.",
      "Leave the property clean and tidy — a cleaning fee applies if the property requires extra cleaning beyond normal use.",
      "Return the key to the key box and close it securely.",
      "Take all personal belongings."
    ],
    "key_return_instructions": "Return the key to the key box at the building entrance. Close the cover firmly until it clicks."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0"}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── house_rules ───────────────────────────────────────────────────────
-- Scope: PUB — rules are publicly shareable.
-- Gate:  NULL — available all stay phases on demand.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'house_rules',
  'PUB',
  NULL,
  'House Rules',
  '{
    "house_rules_summary": "• Please leave the property clean and tidy on departure. A cleaning fee applies if extra cleaning is required beyond normal use.\n• Quiet hours: 22:00 – 08:00. The building has neighbours — please keep noise to a minimum, especially on the balcony in the evening.\n• No smoking inside. Smoking is permitted on the balcony only.\n• Pets on request — please ask before bringing a pet. Unauthorised pets may incur an additional fee.\n• No events or parties. Maximum 4 guests at any time.\n• Please close the balcony door when the air conditioning is running.",
    "quiet_hours": "22:00 – 08:00",
    "smoking_policy": "No smoking inside the property. Smoking is permitted on the balcony only.",
    "pet_policy": "Pets are welcome on request. Please ask the owner in advance — unauthorised pets may incur a cleaning fee.",
    "party_policy": "No events or parties. The property accommodates a maximum of 4 guests — no additional visitors may stay overnight.",
    "min_stay_nights": 2,
    "cancellation_policy": "TEST PLACEHOLDER — cancellation policy to be confirmed by homeowner."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["cancellation_policy"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── emergency ─────────────────────────────────────────────────────────
-- Scope: GST — emergency data is for confirmed guests only.
-- Gate:  NULL — always pre-loaded in every session, all phases.
-- Note:  AI-readable emergency chunk. The structured source of truth
--        also lives in the emergency_data table (section 2 below) and
--        is loaded separately into ConciergeContext.emergency.
-- [TEST PLACEHOLDER] owner contacts and utility locations not yet confirmed.
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'emergency',
  'GST',
  NULL,
  'Emergency Procedures',
  '{
    "owner_emergency_name": "TEST PLACEHOLDER — owner name",
    "owner_emergency_phone": "+39 333 000 0001",
    "nauxica_ops_phone": "+39 800 629 422",
    "nearest_hospital_name": "Ospedale Garibaldi-Centro",
    "nearest_hospital_address": "Piazza Santa Maria di Gesù, 95124 Catania CT",
    "nearest_hospital_distance": "approximately 1.5 km — 5 minutes by car, 15 minutes on foot",
    "nearest_hospital_phone": "+39 095 759 4111",
    "gas_shutoff_instructions": "TEST PLACEHOLDER — gas shutoff location to be confirmed by homeowner.",
    "water_shutoff_instructions": "TEST PLACEHOLDER — water shutoff location to be confirmed by homeowner.",
    "electricity_shutoff_instructions": "TEST PLACEHOLDER — circuit breaker location to be confirmed by homeowner.",
    "evacuation_route_description": "Exit through the front door and take the building staircase or lift to the ground floor. Exit onto Via Etnea.",
    "evacuation_assembly_point": "The pavement on Via Etnea directly outside number 2, away from the building entrance.",
    "property_specific_hazards": "TEST PLACEHOLDER — any property-specific hazards to be confirmed by homeowner.",
    "emergency_instructions": "In all emergencies: call 112 first. Contact the owner on +39 333 000 0001 [TEST PLACEHOLDER] for property-specific guidance. Nauxica operations are available 24/7 on +39 800 629 422."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["owner_emergency_name", "owner_emergency_phone", "gas_shutoff_instructions", "water_shutoff_instructions", "electricity_shutoff_instructions", "property_specific_hazards"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── tourist_tax ───────────────────────────────────────────────────────
-- Scope: PUB — tax information is publicly shareable.
-- Gate:  NULL — available all stay phases (guests may ask at any time).
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'tourist_tax',
  'PUB',
  NULL,
  'Tourist Tax',
  '{
    "tourist_tax_amount_eur": 2.50,
    "tourist_tax_max_nights": 7,
    "tourist_tax_exemptions": "TEST PLACEHOLDER — exemptions to be confirmed by homeowner. Typically: children under 12, guests with a certified disability.",
    "tourist_tax_collection_method": "TEST PLACEHOLDER — collection method to be confirmed by homeowner.",
    "municipality": "Catania (CT)"
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["tourist_tax_exemptions", "tourist_tax_collection_method"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();

-- ── fallback_support ──────────────────────────────────────────────────
-- Scope: GST — ops contact is for confirmed guests only.
-- Gate:  NULL — always available; activated as response context only
--        when KBB status = "degraded".
INSERT INTO public.property_knowledge_blocks
  (property_id, block_type, visibility_scope, session_phase_gate, title, content_jsonb, source_jsonb, is_active)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  'fallback_support',
  'GST',
  NULL,
  'Fallback Support',
  '{
    "nauxica_ops_phone": "+39 800 629 422",
    "nauxica_ops_available_hours": "24/7",
    "owner_emergency_name": "TEST PLACEHOLDER — owner name",
    "owner_emergency_phone": "+39 333 000 0001",
    "support_message": "I don''t have all the details I need to help you right now. For immediate assistance, please contact Nauxica operations on +39 800 629 422 — available 24 hours a day, 7 days a week. You can also reach the property owner directly. We apologise for any inconvenience."
  }'::jsonb,
  '{"updated_by": "seed_013a", "source": "sprint_013a_seed", "pipeline_version": "1.0", "placeholder_fields": ["owner_emergency_name", "owner_emergency_phone"]}'::jsonb,
  true
)
ON CONFLICT (property_id, block_type) DO UPDATE SET
  content_jsonb = EXCLUDED.content_jsonb,
  source_jsonb  = EXCLUDED.source_jsonb,
  is_active     = EXCLUDED.is_active,
  updated_at    = now();


-- ====================================================================
-- 2. emergency_data
-- ====================================================================
-- One row per property. ON CONFLICT (property_id) DO UPDATE.
-- nearest_hospital_name, nearest_hospital_address, owner_emergency_name,
-- owner_emergency_phone, and nauxica_ops_phone are NOT NULL in schema.
-- is_complete = true once both owner_emergency_name and
-- owner_emergency_phone are real values — set false here until the
-- homeowner confirms their emergency contact details.
-- nauxica_ops_phone is set here as service_role; the homeowner API
-- endpoint strips this field from homeowner payloads per migration 012.
-- [TEST PLACEHOLDER] owner contact and utility fields not yet confirmed.
-- ====================================================================

INSERT INTO public.emergency_data (
  property_id,
  is_complete,
  owner_emergency_name,
  owner_emergency_phone,
  nauxica_ops_phone,
  nearest_hospital_name,
  nearest_hospital_address,
  nearest_hospital_distance,
  nearest_hospital_phone,
  gas_shutoff_instructions,
  water_shutoff_instructions,
  electricity_shutoff_instructions,
  evacuation_route_description,
  evacuation_assembly_point,
  property_specific_hazards,
  emergency_instructions
)
VALUES (
  '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
  false,
  'TEST PLACEHOLDER — owner name',
  '+39 333 000 0001',
  '+39 800 629 422',
  'Ospedale Garibaldi-Centro',
  'Piazza Santa Maria di Gesù, 95124 Catania CT',
  'approximately 1.5 km — 5 minutes by car, 15 minutes on foot',
  '+39 095 759 4111',
  'TEST PLACEHOLDER — gas shutoff location to be confirmed by homeowner.',
  'TEST PLACEHOLDER — water shutoff location to be confirmed by homeowner.',
  'TEST PLACEHOLDER — circuit breaker location to be confirmed by homeowner.',
  'Exit through the front door and take the building staircase or lift to the ground floor. Exit onto Via Etnea.',
  'The pavement on Via Etnea directly outside number 2, away from the building entrance.',
  'TEST PLACEHOLDER — property-specific hazards to be confirmed by homeowner.',
  'In all emergencies: call 112 first. Contact Nauxica operations on +39 800 629 422 (24/7). Then follow the specific procedure for your situation.'
)
ON CONFLICT (property_id) DO UPDATE SET
  is_complete                      = EXCLUDED.is_complete,
  owner_emergency_name             = EXCLUDED.owner_emergency_name,
  owner_emergency_phone            = EXCLUDED.owner_emergency_phone,
  nauxica_ops_phone                = EXCLUDED.nauxica_ops_phone,
  nearest_hospital_name            = EXCLUDED.nearest_hospital_name,
  nearest_hospital_address         = EXCLUDED.nearest_hospital_address,
  nearest_hospital_distance        = EXCLUDED.nearest_hospital_distance,
  nearest_hospital_phone           = EXCLUDED.nearest_hospital_phone,
  gas_shutoff_instructions         = EXCLUDED.gas_shutoff_instructions,
  water_shutoff_instructions       = EXCLUDED.water_shutoff_instructions,
  electricity_shutoff_instructions = EXCLUDED.electricity_shutoff_instructions,
  evacuation_route_description     = EXCLUDED.evacuation_route_description,
  evacuation_assembly_point        = EXCLUDED.evacuation_assembly_point,
  property_specific_hazards        = EXCLUDED.property_specific_hazards,
  emergency_instructions           = EXCLUDED.emergency_instructions,
  updated_at                       = now();


-- ====================================================================
-- 3. emergency_contacts
-- ====================================================================
-- emergency_contacts has NO UNIQUE constraint on (property_id, contact_type).
-- Multiple rows of the same type are permitted by schema design.
-- For the three seed contact types we want exactly one row each.
-- Strategy: DELETE the three specific contact_type rows for this
-- property, then INSERT fresh. Scoped to this property_id only.
--
-- escalation_priority values per migration 013 design notes:
--   0 = highest priority (nauxica_operator — always-available backstop)
--   1 = primary owner contact
--   2 = secondary / local contact (caretaker)
--
-- nauxica_operator: inserted as service_role only.
-- [TEST PLACEHOLDER] owner and caretaker details not yet confirmed.
-- ====================================================================

DELETE FROM public.emergency_contacts
WHERE  property_id  = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
  AND  contact_type IN ('owner', 'caretaker', 'nauxica_operator');

INSERT INTO public.emergency_contacts
  (property_id, contact_type, contact_name, contact_phone, available_hours,
   escalation_priority, is_active, guest_visible, ai_usable)
VALUES
  -- Owner — primary human contact [TEST PLACEHOLDER]
  (
    '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
    'owner',
    'TEST PLACEHOLDER — owner name',
    '+39 333 000 0001',
    'TEST PLACEHOLDER — hours',
    1,
    true,
    true,
    true
  ),
  -- Caretaker — local contact [TEST PLACEHOLDER]
  (
    '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
    'caretaker',
    'TEST PLACEHOLDER — caretaker name',
    '+39 333 000 0002',
    'TEST PLACEHOLDER — hours',
    2,
    true,
    true,
    true
  ),
  -- Nauxica operator — 24/7 backstop, inserted by service_role
  (
    '20d769a2-6f22-4882-8bd9-d00a26cf96cc',
    'nauxica_operator',
    'Nauxica Operations',
    '+39 800 629 422',
    '24/7',
    0,
    true,
    true,
    true
  );

COMMIT;


-- ====================================================================
-- Verification queries (run separately after COMMIT)
-- ====================================================================

-- 1. All 9 knowledge blocks present and active
SELECT
  block_type,
  visibility_scope,
  session_phase_gate,
  is_active,
  length(content_jsonb::text) AS content_bytes
FROM   public.property_knowledge_blocks
WHERE  property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
ORDER  BY block_type;

-- 2. emergency_data row — is_complete should be false until owner confirms
SELECT
  is_complete,
  owner_emergency_name,
  owner_emergency_phone,
  nauxica_ops_phone,
  nearest_hospital_name,
  nearest_hospital_address,
  nearest_hospital_distance,
  CASE WHEN gas_shutoff_instructions IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS gas_shutoff,
  CASE WHEN water_shutoff_instructions IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS water_shutoff,
  CASE WHEN electricity_shutoff_instructions IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS elec_shutoff,
  CASE WHEN evacuation_route_description IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS evacuation_route,
  CASE WHEN evacuation_assembly_point IS NOT NULL THEN 'SET' ELSE 'MISSING' END AS assembly_point
FROM   public.emergency_data
WHERE  property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc';

-- 3. Emergency contacts with priority and flags — expect 3 rows
SELECT
  contact_type,
  contact_name,
  contact_phone,
  available_hours,
  escalation_priority,
  is_active,
  guest_visible,
  ai_usable
FROM   public.emergency_contacts
WHERE  property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
ORDER  BY escalation_priority;

-- 4. Spot-check content of key blocks
SELECT
  block_type,
  content_jsonb -> 'wifi_network'           AS wifi_network,
  content_jsonb -> 'key_box_code'           AS key_box_code,
  content_jsonb -> 'tourist_tax_amount_eur' AS tax_rate_eur,
  content_jsonb -> 'max_guests'             AS max_guests,
  content_jsonb -> 'bedrooms'               AS bedrooms
FROM   public.property_knowledge_blocks
WHERE  property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
  AND  block_type  IN ('wifi', 'access', 'tourist_tax', 'property_summary');

-- 5. Row counts — expect: blocks=9, emergency_data=1, contacts=3
SELECT 'property_knowledge_blocks' AS tbl, count(*) FROM public.property_knowledge_blocks WHERE property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
UNION ALL
SELECT 'emergency_data',            count(*) FROM public.emergency_data        WHERE property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc'
UNION ALL
SELECT 'emergency_contacts',        count(*) FROM public.emergency_contacts    WHERE property_id = '20d769a2-6f22-4882-8bd9-d00a26cf96cc';
