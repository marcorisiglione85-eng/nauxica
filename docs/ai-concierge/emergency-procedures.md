# Emergency Procedures

Defines the emergency data structure for Nauxica properties and the AI concierge's behaviour
during emergency situations. This is a safety-critical document.

**Related:** [Data Models](../backend/data-models.md) · [Property Data Schema](../property-intake/property-data-schema.md) · [AI Knowledge Taxonomy](ai-knowledge-taxonomy.md) · [Escalation Rules](escalation-rules.md) · [Data Visibility Model](../architecture/data-visibility-model.md)

---

## 1. Design Principles

**Emergency data is always pre-loaded.** The AI concierge loads the EmergencyData object
into every session context regardless of query type. If a guest's first message is "there's
a gas leak", the AI must respond with complete, accurate information immediately — not after
a context lookup.

**All emergency fields are GUEST-scoped.** No emergency information can be internal-only.
If information is important enough to exist in this object, it must be available to the guest.

**Emergency data is required for property activation.** A property cannot go ACTIVE without
a complete and validated EmergencyData record.

**The AI never minimises an emergency.** If a guest uses emergency language, the AI
treats it as real and responds with full emergency information, even if the situation later
turns out to be minor.

**The AI always provides Italian national emergency numbers.** These are static constants
built into the AI model, not stored per-property. They are provided in every emergency response
as a baseline regardless of property-specific data.

---

## 2. Italian National Emergency Numbers (Static Constants)

These are not stored in property data — they are hard-coded system constants available to the
AI in all sessions, including unknown guest sessions.

| Service | Number | Notes |
|---|---|---|
| **General Emergency (EU)** | **112** | Single European Emergency Number. Works across all EU countries. Police, medical, fire. |
| **Police (Polizia di Stato)** | 113 | For security, theft, assault, missing persons. |
| **Fire Brigade (Vigili del Fuoco)** | 115 | For fire, gas leaks, structural collapse, vehicle extrication. |
| **Medical Emergency (Emergenza Sanitaria)** | 118 | Ambulance and medical emergencies. |
| **Coast Guard (Guardia Costiera)** | 1530 | For sea emergencies near the Sicilian coast. |
| **Carabinieri** | 112 | Law enforcement — reachable on 112. |
| **Roadside Assistance (ACI)** | 803 116 | Vehicle breakdown on Italian roads. |

**AI behaviour:** In any emergency response, the AI must include at minimum:
- 112 (general emergency)
- 118 (medical, if injury or illness suspected)
- 115 (fire brigade, if fire or gas suspected)

---

## 3. Emergency Data Object (Per Property)

This is the `EmergencyData` model referenced in [Data Models](../backend/data-models.md).
All fields in this object are `GUEST` visibility scope.

### 3.1 Owner Emergency Contact

| Field | Type | Required | Notes |
|---|---|---|---|
| `owner_emergency_name` | String | Yes | Name of owner or designated emergency contact person. |
| `owner_emergency_phone` | String | Yes | Italian phone in E.164 format. This is the number given to guests for urgent issues. |
| `owner_emergency_available_hours` | String | No | e.g. "Available 08:00–22:00. Outside these hours, please call Nauxica." |
| `owner_secondary_contact_name` | String | No | Backup contact if primary is unreachable. |
| `owner_secondary_contact_phone` | String | No | |

### 3.2 Nauxica Operations Contact

| Field | Type | Required | Notes |
|---|---|---|---|
| `nauxica_ops_phone` | String | Yes | Nauxica 24/7 operations number. Inserted by Nauxica at onboarding — not editable by homeowner. |
| `nauxica_ops_whatsapp` | String | No | WhatsApp number for Nauxica ops team. |

### 3.3 Medical

| Field | Type | Required | Notes |
|---|---|---|---|
| `nearest_hospital_name` | String | Yes | Full name of nearest hospital or pronto soccorso. |
| `nearest_hospital_address` | String | Yes | Full street address. |
| `nearest_hospital_distance` | String | Yes | e.g. "8 min by car", "25 min by public transport". |
| `nearest_hospital_phone` | String | No | Direct phone number if available. |
| `nearest_pharmacy_name` | String | Yes | Full name. |
| `nearest_pharmacy_address` | String | Yes | Full street address. |
| `nearest_pharmacy_hours` | String | No | Opening hours. For pharmacies on call (farmacia di turno) information. |
| `nearest_urgent_care_name` | String | No | If there is a closer minor injuries / urgent care facility than the main hospital. |
| `nearest_urgent_care_address` | String | No | |

### 3.4 Utility Shutoffs

Required for activation. These fields are also in the property schema (Category I) — the EmergencyData object references the same values. They are denormalised here for fast emergency retrieval.

| Field | Type | Required | Notes |
|---|---|---|---|
| `gas_shutoff_instructions` | Text | Yes | Precise step-by-step. e.g. "Turn the yellow lever on the external gas meter box (ground floor, left of main entrance) to the horizontal position. Call 115 immediately." |
| `water_shutoff_instructions` | Text | Yes | Where the mains stopcock is and how to turn it. |
| `electricity_shutoff_instructions` | Text | Yes | Where the fuse box / consumer unit is and how to trip the main breaker. |
| `gas_meter_location_description` | String | No | Physical description to help find it. |
| `fuse_box_location_description` | String | No | Physical description. |

### 3.5 Fire Safety

| Field | Type | Required | Notes |
|---|---|---|---|
| `fire_extinguisher_present` | Boolean | Yes | |
| `fire_extinguisher_location` | String | Conditional | Required if `fire_extinguisher_present` is true. |
| `fire_extinguisher_type` | String | No | e.g. "dry powder", "CO2". Helps guests know what it covers. |
| `fire_blanket_location` | String | No | |
| `smoke_detector_present` | Boolean | Yes | |
| `smoke_detector_test_date` | Date | No | Last test date — for operator awareness. |
| `evacuation_route_description` | Text | Yes | How to exit the building and reach the evacuation assembly point. |
| `evacuation_assembly_point` | Text | Yes | Where guests should gather outside the property after evacuating. |

### 3.6 Property-Specific Hazards

| Field | Type | Required | Notes |
|---|---|---|---|
| `property_specific_hazards` | Text | No | Any specific risks the homeowner wants guests to know about. e.g. "External stone staircase is steep and has no handrail — use caution at night.", "Well cover in the garden — children must be supervised." |
| `pool_safety_notes` | Text | Conditional | Required if `pool_available` is true. e.g. depth, no lifeguard, supervision of children. |
| `balcony_safety_notes` | Text | No | If there are any balcony access or structural concerns. |

### 3.7 Record Completeness

| Field | Type | Notes |
|---|---|---|
| `is_complete` | Boolean | System-computed. True when all required fields are populated. Blocks property activation if false. |
| `last_verified_at` | Date | Date Nauxica or homeowner last confirmed this data is accurate. Prompt for re-verification every 90 days. |
| `verified_by` | UUID → User | Operator or homeowner who last verified. |

---

## 4. Emergency Type Classification

The AI classifies emergency situations into types to determine the correct response set.

| Type Code | Triggers (keywords/context) | Immediate AI Action | Escalation |
|---|---|---|---|
| `MEDICAL` | injury, hurt, ill, sick, unconscious, chest pain, difficulty breathing, blood, fell, accident | Call 118 / 112. Nearest hospital address. First aid kit location. Operator alert. | Immediate |
| `FIRE` | fire, smoke, burning smell, flames | Call 115 / 112. Evacuation route. Assembly point. Fire extinguisher location (only if safe). Do not re-enter building. | Immediate |
| `GAS` | gas smell, gas leak, sulphur smell, rotten eggs | Do NOT turn on lights. Open windows and doors. Gas shutoff location. Leave building. Call 115. | Immediate |
| `FLOOD` | water everywhere, flood, pipe burst, water leak, ceiling dripping | Water shutoff location. Move valuables to high ground. Electricity shutoff if water near sockets. Operator contact. | Urgent |
| `POWER` | no electricity, lights out, power cut, power off | Electricity shutoff / breaker location (to check if it tripped). If full building: likely local outage — call electricity operator. | Routine (unless unsafe) |
| `LOCKOUT` | locked out, can't get in, lost key, left key inside | Access code or lockbox procedure. Key contact if applicable. Nauxica Support if unresolvable. | Urgent (if after 22:00) |
| `SECURITY` | intruder, break-in, theft, someone in the property, threatening, robbery | Call 113 or 112. Leave property if unsafe. Do not confront. Nauxica Support. | Immediate |
| `STRUCTURAL` | crack in wall, ceiling collapsed, structural damage, earthquake damage | Leave building immediately. Call 115. Assembly point. | Immediate |
| `NATURAL_DISASTER` | earthquake, eruption, tsunami (Sicily context), storm damage | Italian Civil Protection (Protezione Civile): 1515. Evacuate if instructed. 112 for general emergency. | Immediate |

---

## 5. AI Emergency Response Rules

> **Notation note:** The rule codes below use the legacy `E-XX` prefix. The same rules also appear as `EM-XX` in `whatsapp-concierge-guidelines.md §13`. Both prefixes are legacy and inconsistent — consolidation under a single prefix is required in a future editorial sprint. `TRIGGER-XX` codes in `escalation-rules.md` govern the `EscalationRecord` lifecycle and are a separate system; do not confuse them with these emergency response rules.

### Rule E-01: Always provide 112 first
In any emergency response, 112 is the first thing provided. No exceptions. It works in Italian, English, and other languages.

### Rule E-02: Do not attempt to assess or triage medical situations
The AI is not a medical professional. It must not say "that sounds minor" or attempt to diagnose. It provides the hospital address and 118, then escalates.

### Rule E-03: Safety first, property second
In fire, gas, or structural emergencies, the AI instructs guests to leave the building immediately before providing any property-specific information.

### Rule E-04: Never delay emergency information behind conversational niceties
Emergency responses are not prefaced with "I'm sorry to hear that" or similar. Lead with the actionable information, then acknowledge.

**Correct:**
> "Call 118 immediately for medical emergencies. The nearest hospital is [name] at [address] — approximately 8 minutes by car. [Further details]"

**Incorrect:**
> "Oh no, I'm so sorry to hear you're having a problem! Let me help you with that. First, I want to make sure you know that there are some important numbers..."

### Rule E-05: Always escalate emergency sessions to a human operator
After providing emergency information, the AI must always notify a Nauxica operator. This happens automatically via the EscalationRecord system (see [Escalation Rules](escalation-rules.md)).

### Rule E-06: Repeat contact information
In emergencies, include the owner emergency contact number AND the Nauxica Support contact number. The guest may be panicking and need information repeated.

### Rule E-07: Language — default to guest language, include Italian numbers
Emergency numbers are Italian — include them in their standard format. Do not translate numbers. The AI may use the guest's detected language for all instructions.

---

## 6. Lockout — Special Case

Lockout is the most common "emergency" the AI will handle. It is time-sensitive but not life-threatening unless the guest is locked out in extreme weather or a dangerous area.

**Resolution flow:**
1. Confirm access method for this property
2. Provide access code / lockbox code if in delivery window
3. If code was already provided: re-send it
4. If lockbox malfunction is suspected: owner emergency contact
5. If no resolution: Nauxica Support

**After 22:00 escalation:** Any unresolved lockout after 22:00 is automatically escalated to the operator duty line. A guest locked out overnight is an urgent operational failure.

---

## 7. Operator Notification Requirements

When the AI handles an emergency (any type other than `POWER` at routine level):

1. An `EscalationRecord` is created immediately with `trigger_type = emergency`
2. The `urgency` field is set based on emergency type
3. The assigned Nauxica operator (or on-call duty operator) is notified via the platform
4. The homeowner is notified for FLOOD, SECURITY, STRUCTURAL, and NATURAL_DISASTER types
5. The `WhatsAppSession.session_status` is set to `escalated`

---

## 8. Data Maintenance

Emergency data degrades in accuracy over time. The following maintenance rules apply:

| Trigger | Action |
|---|---|
| Property activation | Nauxica operator validates all emergency fields |
| 90 days since last verification | Homeowner receives re-verification prompt |
| Partner or contact change | Homeowner must update emergency contacts |
| Phone number change | Nauxica validates new number is reachable |
| Building works or renovation | Gas/water/electricity shutoff locations may change — homeowner must re-verify |

**(Legal review required)** Accuracy of emergency contact data may carry liability implications. Nauxica's terms of service should clarify the homeowner's responsibility for maintaining accurate emergency information.

---

## 9. Sicily-Specific Notes

- **Etna / volcanic activity:** Mount Etna is active. Properties in the Catania/Messina province may be subject to volcanic alerts. Nauxica should monitor Civil Protection alerts and proactively notify affected guests. The AI concierge should know the property's distance from Etna.
- **Seismic activity:** Sicily is seismically active. Properties should be enrolled in the national seismic awareness programme. Evacuation assembly points must account for this risk.
- **Summer wildfires:** Common in Sicilian summer. Properties in rural or semi-rural areas must have evacuation plans specific to wildfire scenarios.
- **Coast Guard (1530):** Relevant for any property within walking distance of the sea, given typical guest water activity.

---

## 10. Emergency Response Templates

These templates define the exact structure of AI responses per emergency type. Tone rule E-04 applies to all: lead with the actionable information, not with acknowledgement. Adapt language to the guest's detected language while keeping all numbers in standard Italian format.

> **Template notation:** `[FIELD]` = pulled from PropertyKnowledgeBlock or EmergencyData. `STATIC` = hard-coded constant, not from property data.

---

### Template: MEDICAL

```
Call 118 immediately for medical emergencies.
Nearest hospital: [nearest_hospital_name], [nearest_hospital_address] — approximately [nearest_hospital_distance].

General emergency: 112 (STATIC)
Medical emergency: 118 (STATIC)

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've alerted our operations team. Stay safe — help is on the way.
```

---

### Template: FIRE

```
Leave the building immediately. Do not use the lift.
Evacuation route: [evacuation_route_description]
Assembly point: [evacuation_assembly_point]

Call 115 (fire brigade) — STATIC
General emergency: 112 — STATIC

Do not re-enter the building until the fire service gives the all-clear.

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've alerted our operations team.
```

---

### Template: GAS

```
Do not turn on any lights or electrical switches.
Open windows and doors immediately.
Leave the building — do not use the lift.

Gas shutoff (only if you can reach it safely without turning on anything electrical):
[gas_shutoff_instructions]

Call 115 (fire brigade) — STATIC
General emergency: 112 — STATIC

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've alerted our operations team.
```

---

### Template: FLOOD

```
Move away from any water near electrical outlets or sockets.
Water shutoff location: [water_shutoff_instructions]

If water is near electrical fittings, switch off the main electricity breaker first:
[electricity_shutoff_instructions]

Property owner: [owner_emergency_name] — [owner_emergency_phone] — please call them now.
Nauxica operations: [nauxica_ops_phone]

General emergency (if structural risk): 112 — STATIC

I've alerted our operations team.
```

---

### Template: SECURITY

```
If you feel unsafe, leave the property now if you can do so safely.
Do not confront anyone.

Call 113 (Polizia di Stato) or 112 — STATIC

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've alerted our operations team immediately.
```

---

### Template: LOCKOUT (Standard)

```
Here is how to get in:
[entry_instructions condensed]

Key box code: [key_box_code]
Key box location: [key_box_location]

If the code isn't working: call [owner_emergency_name] on [owner_emergency_phone].
If no answer: call Nauxica operations on [nauxica_ops_phone].
```

---

### Template: LOCKOUT (Urgent — after 22:00 or vulnerable guest)

```
I'm escalating this to our operations team right now — someone will call you within 15 minutes.

In the meantime, homeowner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

[Re-state entry instructions and code one more time]
```

---

### Template: NATURAL_DISASTER (Etna alert / earthquake / wildfire)

```
Italian Civil Protection (Protezione Civile): 1515 — STATIC
General emergency: 112 — STATIC

If instructed to evacuate: leave immediately.
Evacuation route: [evacuation_route_description]
Assembly point: [evacuation_assembly_point]

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've alerted our operations team and will pass on any Civil Protection guidance as it comes.
```

---

### Template: GUEST PERSONAL DISTRESS

> ⚠️ This template handles situations where a guest expresses personal distress, extreme anxiety, or possible risk to themselves. It requires particular care. Do not be clinical. Do not dismiss. Do not escalate before acknowledging.

```
I hear you, and I want to make sure you're okay.

If you're in immediate danger, please call 112 now — STATIC

If you'd like to talk to someone:
Telefono Amico: 02 2327 2327 — STATIC
Telefono Azzurro (if involving a child): 19696 — STATIC

Property owner: [owner_emergency_name] — [owner_emergency_phone]
Nauxica operations: [nauxica_ops_phone]

I've passed this to our team and someone will be in touch with you.
```

---

## 11. Post-Emergency Procedures

After any emergency type other than `LOCKOUT` (standard), the following steps must be completed by the Nauxica operations team.

### Immediate (within 1 hour)

- [ ] Confirm guest safety — contact guest directly or via homeowner
- [ ] Confirm homeowner has been notified (for FIRE, FLOOD, SECURITY, STRUCTURAL, NATURAL_DISASTER)
- [ ] Confirm EscalationRecord status is `ACKNOWLEDGED` by an operator
- [ ] Check if emergency services were called — if yes, request update from homeowner when known

### Within 24 hours

- [ ] Debrief with homeowner — what happened, what was the outcome
- [ ] Review AI response accuracy — did the AI provide the correct emergency data?
- [ ] Check all emergency fields for accuracy — if any were wrong or missing, update immediately and flag for re-verification
- [ ] Determine if property should be temporarily suspended while issue is resolved (e.g. fire damage, structural concern)
- [ ] Determine if the incident requires insurance, legal, or compliance action — flag accordingly
- [ ] Document the incident in the EscalationRecord resolution notes

### Within 72 hours

- [ ] Follow up with guest — wellbeing check and acknowledgement of the experience
- [ ] If guest experienced harm: trigger dispute resolution process and notify legal counsel
- [ ] Conduct post-incident review: could the AI have responded better? Was the knowledge block complete?
- [ ] Update emergency data fields if any information was found to be inaccurate during the incident

> ⚠️ Legal review required: depending on the nature of the emergency (particularly MEDICAL, SECURITY, and STRUCTURAL), there may be reporting obligations to Italian authorities or insurers. Confirm with legal counsel what constitutes a reportable incident and the required timeline.

---

## 12. Founder Operational Involvement — MVP

During the MVP phase, the founder or a designated team member must be reachable for all IMMEDIATE and URGENT emergency escalations. This is a non-negotiable operational commitment.

**Why:** The EmergencyData quality at MVP depends on homeowners completing the intake correctly. Given that this is a new platform with a small property base, the probability of a missing or inaccurate field is higher than it will be at scale. The founder's presence in escalations is a quality check as much as an operational one.

**Founder responsibilities for emergencies:**

- Personal review of all emergency escalations within 24 hours, regardless of resolution
- Direct follow-up with homeowners after any FIRE, FLOOD, MEDICAL, or SECURITY incident
- Monthly review of EmergencyData completeness across all active properties — flag any property where `last_verified_at` is older than 90 days
- Ownership of the post-emergency debrief for the first 20 incidents handled on the platform

**When to scale:** Once the platform has processed 50+ emergency-level escalations (excluding standard lockouts) without a documented AI response failure, and all active properties have complete and recently-verified EmergencyData, the founder can step back from personal review.

---

## Related Documents

- [escalation-rules.md](escalation-rules.md) — Trigger taxonomy, SLAs, and operator handling
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Emergency tone rules (E-01 through E-07)
- [knowledge-retrieval-model.md](knowledge-retrieval-model.md) — Emergency detection and routing logic
- [property-knowledge-schema.md](property-knowledge-schema.md) — EmergencyData fields in the knowledge block
- [property-intake-checklist.md](../property-intake/property-intake-checklist.md) — Phase 3 emergency data collection
- [data-models.md](../backend/data-models.md) — EmergencyData and EscalationRecord models
