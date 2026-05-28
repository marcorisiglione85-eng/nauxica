# AI Knowledge Taxonomy

Defines how property knowledge is classified, retrieved, and used by the AI concierge.
Every piece of information the AI can serve to a guest belongs to exactly one category.
Categories drive retrieval strategy, response priority, and escalation rules.

**Related:** [Property Data Schema](../property-intake/property-data-schema.md) · [Data Visibility Model](../architecture/data-visibility-model.md) · [WhatsApp Session Anchor](whatsapp-session-anchor.md) · [Escalation Rules](escalation-rules.md)

---

## 1. Why Taxonomy Matters

The AI concierge does not load the entire property knowledge base for every guest message.
Doing so would: exceed context window limits, dilute relevance, slow response time, and
increase the risk of unrelated data surfacing in responses.

Instead, the system classifies the guest's query into a knowledge category, then loads only
the relevant fields into the AI's active context. This is the retrieval model.

**At MVP:** Category classification is rule-based (keyword and pattern matching against the
guest's message). **Future:** Classification can be upgraded to a semantic embedding-based
retrieval system without changing the taxonomy or field structure.

---

## 2. Knowledge Categories

Twelve categories cover all possible guest query types.

### CAT-01: EMERGENCY
**Trigger:** Any message containing safety, medical, fire, gas, flood, injury, help, locked out (urgent), or distress signals.
**Priority:** Highest — overrides all other categories. Always pre-loaded in every session.
**Retrieval scope:** Full EmergencyData object + gas/water/electricity shutoff locations.
**AI behaviour:** Immediate response. Italian emergency numbers always included. Escalation triggered if medical or fire context detected.

**Property fields loaded:**
- All EmergencyData fields (pre-loaded)
- `gas_shutoff_instructions`, `water_shutoff_instructions`, `electricity_shutoff_instructions`
- `fire_extinguisher_location`, `first_aid_kit_location`
- `evacuation_assembly_point`

---

### CAT-02: ACCESS
**Trigger:** Messages about entry, door, key, lockbox, code, gate, parking, how to get in, locked out (non-urgent), smart lock, app.
**Priority:** High — guests at the property door need an immediate answer.
**Retrieval scope:** Access section of property knowledge block.
**AI behaviour:** Step-by-step instructions. Share access code only if delivery gate conditions are met (see [WhatsApp Session Anchor §8](whatsapp-session-anchor.md)).

**Property fields loaded:**
- `access_method`, `lockbox_location`, `lockbox_code` (gated)
- `smart_lock_app`, `smart_lock_instructions`
- `key_collection_contact_name`, `key_collection_address`, `key_collection_hours`
- `main_door_instructions`, `gate_code`, `building_door_code`
- `parking_available`, `parking_instructions`, `parking_code`
- `entry_instructions` (full)

---

### CAT-03: CHECK-IN
**Trigger:** Messages about arriving, arrival, check-in, getting to the property, what time, key, where to go. Active primarily in `pre_arrival` and `check_in` session phases.
**Priority:** High during arrival phases.
**Retrieval scope:** Check-in instructions + access + location.
**AI behaviour:** Proactively sent on arrival day. Answers arrival logistics questions.

**Property fields loaded:**
- `checkin_time_from`, `checkin_time_to`
- `early_checkin_available`, `early_checkin_notes`
- `entry_instructions`, `checkin_instructions`
- `checkin_welcome_message`
- `property_orientation`, `first_night_essentials`
- `address_locality`, `arrival_landmark`, `what3words`
- `nearest_airport`, `nearest_port`
- CAT-02 ACCESS fields (merged)

---

### CAT-04: CHECK-OUT
**Trigger:** Messages about leaving, check-out, departure, key return, time to leave, checkout tasks. Active primarily in `check_out` session phase.
**Priority:** High during checkout phase. Proactively initiated.
**Retrieval scope:** Checkout instructions + rules.
**AI behaviour:** Proactively sent on checkout morning. Reminds of tasks, time, and key return.

**Property fields loaded:**
- `checkout_time`
- `late_checkout_available`, `late_checkout_notes`
- `checkout_instructions`
- `checkout_tasks` (as a checklist)
- `key_return_instructions`
- `checkout_message`

---

### CAT-05: WIFI AND CONNECTIVITY
**Trigger:** Messages about WiFi, internet, password, network, connection, signal, hotspot.
**Priority:** Medium-high — frequent request.
**Retrieval scope:** WiFi section.
**AI behaviour:** Direct answer with network name and password. If issues persist, router location and restart instructions.

**Property fields loaded:**
- `wifi_network`, `wifi_password`
- `wifi_backup_notes`
- `mobile_coverage_notes`

---

### CAT-06: AMENITIES AND APPLIANCES
**Trigger:** Messages about washing machine, dishwasher, TV, AC, heating, remote, coffee, pool, BBQ, oven, how does X work.
**Priority:** Medium.
**Retrieval scope:** Amenities and appliance instructions.
**AI behaviour:** Specific instructions for the named appliance or facility. Pool availability and hours if relevant.

**Property fields loaded:**
- `appliance_guides` (specific appliance if matched, full list otherwise)
- `tv_instructions`
- `heating_instructions`, `cooling_instructions`
- `water_heater_instructions`
- `pool_available`, `pool_type`, `pool_instructions`, `pool_hours`, `pool_heated`
- `garden_instructions`, `bbq_instructions`
- `amenity_notes`

---

### CAT-07: HOUSE RULES
**Trigger:** Messages about rules, allowed, permitted, can I, noise, pets, smoking, guests, party, quiet hours.
**Priority:** Medium.
**Retrieval scope:** House rules section.
**AI behaviour:** Clear, non-judgemental statement of the relevant rule. If guest's request violates a rule, decline politely and explain.

**Property fields loaded:**
- `house_rules` (full)
- `smoking_policy`, `pet_policy`, `pet_policy_notes`
- `party_policy`
- `quiet_hours_from`, `quiet_hours_to`
- `max_guests`, `max_additional_guests`
- `children_allowed`, `children_notes`
- `checkout_tasks` (pre-empt "what do I need to do before leaving?")

---

### CAT-08: LOCAL AREA
**Trigger:** Messages about restaurants, food, beach, things to do, transport, shops, supermarket, nearby, recommendations, where can I, what's good around here.
**Priority:** Medium — high satisfaction impact.
**Retrieval scope:** Local area knowledge.
**AI behaviour:** Curated recommendations with context. Promote Nauxica marketplace partners if relevant (partner flag is internal — AI mentions the experience provider name, not the partner relationship).

**Property fields loaded:**
- `nearest_supermarket`, `nearest_pharmacy`, `nearest_hospital_name`
- `nearest_beach`, `nearest_bus_stop`, `nearest_taxi_or_transfer`
- `restaurant_recommendations` (all entries)
- `experience_recommendations` (all entries)
- `local_tips`
- `getting_around_notes`
- `area_description`

---

### CAT-09: SERVICES AND BOOKINGS
**Trigger:** Messages about booking an experience, transfer, taxi, tour, cooking class, boat, restaurant reservation, organising, can you arrange.
**Priority:** Medium.
**Retrieval scope:** Experience recommendations + partner services.
**AI behaviour:** Describe what is available and how to book (direct, via Nauxica marketplace, or contact info). Creates a ServiceRequest if the guest wants to proceed.

**Property fields loaded:**
- `experience_recommendations` (filtered to bookable via Nauxica or direct)
- `nearest_taxi_or_transfer`
- `restaurant_recommendations` (with booking info)

**Action:** If guest confirms they want to book something, creates a `ServiceRequest` with `service_type = experience` or `transfer`, `urgency = routine`, and `guest_message` = the guest's original request.

---

### CAT-10: MAINTENANCE AND ISSUES
**Trigger:** Messages about something broken, not working, problem, issue, report, leak, no hot water, no electricity, broken lock, fault, damage.
**Priority:** Medium-high — urgency varies by nature of issue.
**Retrieval scope:** Utility controls (for immediate self-resolution) + owner/Nauxica contact.
**AI behaviour:** First attempt guided self-resolution (e.g., reset router, check breaker). If issue cannot be self-resolved, create a ServiceRequest and reassure the guest.

**Property fields loaded:**
- `appliance_guides` (relevant item)
- `wifi_backup_notes` (if WiFi issue)
- `water_heater_instructions`, `boiler_location`, `boiler_reset_instructions`
- `electricity_shutoff_location` (to direct to breaker if power partial)
- `maintenance_contact_notes` (if present in knowledge block)

**Action:** Creates a `ServiceRequest` with appropriate `urgency` level:
- Water leak, power outage, gas smell → `urgent` or `emergency` → triggers escalation
- Appliance fault, minor damage → `same_day` or `routine`

**Urgency escalation rule:** Any maintenance issue that could compromise guest safety (gas, flooding, structural) must immediately escalate to the emergency flow (CAT-01).

---

### CAT-11: TOURIST TAX AND PAYMENT
**Trigger:** Messages about tourist tax, tassa di soggiorno, how much, what do I owe, payment, receipt, invoice.
**Priority:** Low-medium.
**Retrieval scope:** Tourist tax fields.
**AI behaviour:** State the rate, how it is collected, and when. Do not process payments. Direct to homeowner if guest disputes amount.

**Property fields loaded:**
- `tourist_tax_amount_eur`
- `tourist_tax_max_nights`
- `tourist_tax_exemptions`
- `address_municipality` (for reference)

**Escalation rule:** If guest disputes the tax amount or refuses to pay → escalate to homeowner.

---

### CAT-12: GENERAL PROPERTY FAQ
**Trigger:** Any question not matched by the above categories. Also used for: "tell me about the property", "what can I ask you about?", "what do you know about this place?".
**Priority:** Low.
**Retrieval scope:** General orientation fields.
**AI behaviour:** Broad orientation response. Offers to answer specific questions.

**Property fields loaded:**
- `display_name`, `property_type`, `city`, `nearest_town`
- `max_guests`, `bedrooms`, `bathrooms`, `beds_configuration`
- `amenity_list` (as bullet list)
- `area_description`
- Session phase-appropriate prompt (arrival tips in pre_arrival, local tips in in_stay, etc.)

---

## 3. Category Priority Hierarchy

When a guest message matches multiple categories, the higher-priority category takes precedence.

```
Priority (highest to lowest):
1. CAT-01  EMERGENCY
2. CAT-02  ACCESS (during check_in phase)
3. CAT-03  CHECK-IN (during pre_arrival / check_in phase)
4. CAT-04  CHECK-OUT (during check_out phase)
5. CAT-10  MAINTENANCE (when urgency = urgent or emergency)
6. CAT-05  WIFI
7. CAT-06  AMENITIES
8. CAT-07  HOUSE RULES
9. CAT-09  SERVICES
10. CAT-08  LOCAL AREA
11. CAT-11  TOURIST TAX
12. CAT-12  GENERAL FAQ
```

---

## 4. Structured vs Unstructured Field Split

The taxonomy maps directly onto the structured vs unstructured data split in the property schema.

| Category | Primarily structured | Primarily unstructured | Notes |
|---|---|---|---|
| CAT-01 EMERGENCY | Yes | Partial | Phone numbers, addresses = structured. Procedures = prose. |
| CAT-02 ACCESS | Yes | Partial | Codes = structured. Entry instructions = prose. |
| CAT-03 CHECK-IN | Partial | Yes | Times = structured. Arrival instructions = prose. |
| CAT-04 CHECK-OUT | Partial | Yes | Time = structured. Procedure = prose. |
| CAT-05 WIFI | Yes | No | Code and SSID are structured fields. |
| CAT-06 AMENITIES | Partial | Yes | Has/hasn't = structured. Usage instructions = prose. |
| CAT-07 RULES | Partial | Yes | Policy enums = structured. Nuanced rules = prose. |
| CAT-08 LOCAL | No | Yes | All prose and recommendations. Best vector search candidate. |
| CAT-09 SERVICES | No | Yes | All prose and booking instructions. |
| CAT-10 MAINTENANCE | Partial | Yes | Utility locations = structured. Instructions = prose. |
| CAT-11 TAX | Yes | No | Rate and nights = structured. |
| CAT-12 FAQ | No | Yes | All general prose. |

**Implication for vector search readiness:** CAT-08 (Local Area) and CAT-09 (Services) have
the highest proportion of unstructured prose and are the strongest candidates for semantic
embedding retrieval. CAT-01 through CAT-05 are predominantly structured and are better served
by direct field lookup than embedding retrieval.

---

## 5. Category-to-Property-Field Mapping Reference

| Property Schema Section | Primary Category | Secondary Category |
|---|---|---|
| Access (3.4) | CAT-02 | CAT-03 |
| WiFi (3.5) | CAT-05 | — |
| Amenities (3.6) | CAT-06 | — |
| House Rules (3.7) | CAT-07 | CAT-04 |
| Check-In Instructions (3.8) | CAT-03 | CAT-02 |
| Check-Out Instructions (3.9) | CAT-04 | CAT-07 |
| Local Area Knowledge (3.10) | CAT-08 | CAT-09 |
| Emergency Data (3.11) | CAT-01 | — |
| Utility Controls (Cat I) | CAT-01, CAT-10 | — |
| Tourist Tax (Cat F) | CAT-11 | — |

---

## 6. AI Response Rules by Category

### When the AI must answer directly
CAT-05 (WiFi), CAT-02 (Access — within delivery window), CAT-04 (Check-out), CAT-11 (Tourist tax)
→ These have deterministic answers from structured fields. The AI must not hedge or qualify.

### When the AI should offer options
CAT-08 (Local), CAT-09 (Services)
→ Multiple valid answers exist. The AI should offer 2–3 curated options, not a wall of text.

### When the AI must not guess
If the relevant field is null or the question cannot be answered from loaded context:
→ "I don't have that information to hand — I'll pass this to [property name]'s team and they'll
   get back to you shortly." Then create a ServiceRequest or escalation as appropriate.

### When the AI must escalate immediately
CAT-01 (Emergency) — always.
CAT-10 when urgency = emergency (gas, flood, fire, structural collapse).
See [Escalation Rules](escalation-rules.md) for the full trigger list.

---

## 7. Proactive Messaging by Session Phase

The AI is not only reactive — it sends proactive messages at lifecycle transitions.

| Session Phase | Proactive Message | Categories Loaded |
|---|---|---|
| Transition to `pre_arrival` (48h before) | "Your stay at [property] is coming up — here's what you need to know for arrival." | CAT-03, CAT-02 (directions only, no code) |
| Transition to `check_in` (arrival day morning) | Welcome message + access code delivery | CAT-03, CAT-02, CAT-05, CAT-12 |
| 24 hours after check-in | "Need any help? Here are some things guests often ask about..." | CAT-06, CAT-08 |
| Transition to `check_out` (checkout day morning) | Checkout reminder and task list | CAT-04 |
| Transition to `post_stay` | Thank you + review request link | — |

---

## 8. Future Vector Search Readiness

The taxonomy and field structure are designed to be embedding-compatible without modification.

**Recommended embedding strategy at scale:**
- Each property section (one category's fields) becomes one or more embedding documents
- Documents are tagged with `property_id` + `category` + `language`
- Retrieval uses cosine similarity on the guest query embedding against pre-computed property documents
- Top-k results are filtered to GUEST scope before being loaded into context

**Fields with highest embedding value:**
- `local_tips`, `area_description`, `restaurant_recommendations[].notes`, `experience_recommendations[].notes`
- `checkin_instructions`, `property_orientation`, `first_night_essentials`
- `property_quirks` (if a guest-scoped version is created)

**Fields that should NOT be embedded:**
- Any field containing credentials (WiFi password, lockbox code, access codes)
- Any PARTNER, OPERATOR, or INTERNAL scoped field
- Fields with numerical values (rates, counts, times) — these are better served by structured lookup
