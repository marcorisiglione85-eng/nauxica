# AI Runtime Orchestration

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · AI concierge runtime — WhatsApp guest interaction
**Last updated:** 2026-05-28
**Related:** [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) · [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) · [ai-knowledge-taxonomy.md](../ai-concierge/ai-knowledge-taxonomy.md) · [escalation-rules.md](../ai-concierge/escalation-rules.md) · [emergency-procedures.md](../ai-concierge/emergency-procedures.md) · [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) · [event-driven-architecture.md](../architecture/event-driven-architecture.md)

---

## Purpose

This document defines how the AI runtime operates internally when processing a guest message: the full orchestration pipeline from inbound WhatsApp message to outbound response, including classification, retrieval, response assembly, escalation triggering, and workflow action creation.

This document is the implementation contract for the backend engineer building the AI runtime service. It specifies what the runtime does at each step, what data it can access, what it can write, and where it must stop and hand off to a human.

**Design boundaries:**
- The AI runtime is not a general-purpose AI. It is a structured orchestrator with a narrow permission set.
- It answers questions about a specific property for a specific confirmed guest.
- It creates `ServiceRequest`, `EscalationRecord`, and `WhatsAppSession` records. It writes nothing else.
- It reads only from `PropertyKnowledgeBlock`, `EmergencyData`, `Reservation` (scoped fields), and `WhatsAppSession`.
- All other models are off-limits.

---

## Architecture Position

The AI runtime sits between the WhatsApp Business API and the platform's data layer:

```
[WhatsApp Business API]
        │
        ▼
[Message Intake Service]   ← normalises inbound webhook payload
        │
        ▼
[AI Runtime Orchestrator]  ← this document
        │
        ├──→ [Knowledge Block Builder (KBB)]   ← reads PropertyKnowledgeBlock
        ├──→ [AI Model (LLM API call)]          ← generates response text
        ├──→ [Action Executor]                  ← writes ServiceRequest / EscalationRecord
        └──→ [WhatsApp Send API]                ← delivers outbound message
```

The AI runtime does not expose a public API. It is triggered exclusively by internal events: `guest.WhatsAppMessage.Received`.

---

## Full Orchestration Pipeline

### Step 1 — Message Intake

**Input:** Inbound WhatsApp webhook payload
**Trigger event:** `guest.WhatsAppMessage.Received`

The Message Intake Service normalises the raw webhook into a structured `InboundMessage` object before the AI runtime processes it:

```
InboundMessage {
    whatsapp_message_id:  String    // Deduplicate using this ID
    guest_phone:          String    // E.164 normalised
    message_body:         String    // Trimmed raw text
    media_type:           Enum      // text / image / audio / document / location
    media_url:            String    // Nullable — only for non-text messages
    received_at:          DateTime  // UTC timestamp from WhatsApp
}
```

**Idempotency check:** Before any further processing, the runtime checks `whatsapp_message_id` against a deduplication cache (TTL: 48 hours). If already processed, return immediately — do not re-execute.

**Media handling (MVP):** If `media_type` is not `text`, the runtime responds with a standard fallback: "I've received your message. For images or voice messages, please describe what you need in text and I'll help right away." No media processing at MVP. Log the media_type in the session for analytics.

---

### Step 2 — Session Resolution

**Purpose:** Establish which guest, reservation, and property this message belongs to.

**Resolution lookup:** See [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) for the full resolution logic. Summary:

```
Query:
  guest_phone = InboundMessage.guest_phone
  reservation_status IN ('pre_arrival', 'checked_in')
  checkin_date <= today + 2 days
  checkout_date >= today - 1 day  (24h grace period post-checkout)
```

**If resolution succeeds:**
- Load or create the `WhatsAppSession` for this reservation
- Determine current `session_phase` (pre_arrival / check_in / in_stay / check_out / post_stay)
- Load session context: `session_id`, `reservation_id`, `property_id`, `guest_name`, `guest_preferred_language`, `unresolved_query_count`, `active_escalation_id`

**If resolution fails (no matching reservation):**
- Apply the Unknown Guest flow (see [whatsapp-session-anchor.md Section 5](../ai-concierge/whatsapp-session-anchor.md))
- Respond with the standard unknown-guest message (translated to the detected language)
- Emit `guest.WhatsAppSession.UnresolvablePhone`
- Do not proceed past Step 2 — no further processing

**If session has an active escalation (`active_escalation_id` is set):**
- AI is in human-handoff mode for this session
- Skip to Step 11 (Operator Handoff Holding)
- Do not process the message through the normal pipeline

---

### Step 3 — Emergency Pre-Check

**This step runs on EVERY message, before any other classification.**

The emergency pre-check is a keyword and phrase scan of `InboundMessage.message_body`. It is a deterministic rule, not an LLM judgment.

**Emergency keyword set (hardcoded in system prompt and pre-check logic):**
- Italian: fuoco, incendio, gas, alluvione, inondazione, emergenza, aiuto, soccorso, ambulanza, morto, ferito, crollo, terremoto
- English: fire, gas, flood, emergency, help, ambulance, dead, injured, collapse, earthquake
- Universal: 112, 113, 115, 118, 1530

**On keyword match:**
1. Classify intent as `EMERGENCY` — do not proceed to standard classification
2. Load emergency data block (from `EmergencyData` record for this property — always pre-loaded in emergency cache)
3. Compose emergency response immediately:
   - Italian emergency numbers (112, 113, 115, 118, 1530)
   - Owner emergency contact name and phone number
   - Any property-specific safety instruction relevant to the detected keyword (gas shutoff, evacuation route, etc.)
4. Send response **immediately** — do not wait for KBB assembly or LLM call
5. Create `EscalationRecord` with `trigger_type: EMERGENCY`
6. Emit `ai.AISession.EmergencyDetected`
7. Set `WhatsAppSession.active_escalation_id`
8. End processing — do not continue pipeline

**Rules E-01 through E-07** from [emergency-procedures.md](../ai-concierge/emergency-procedures.md) govern the content and behaviour of emergency responses and must be applied by the response assembly logic at this step.

**No false-negative tolerance:** The emergency pre-check must have high recall and low precision. It is better to treat a non-emergency as an emergency than to miss a real one. If a keyword fires but the context is clearly non-emergency (e.g. "is there a fire going in the outdoor pizza oven?"), the AI still sends the precautionary emergency response first, then follows up with a normal message once the session continues.

---

### Step 4 — Intent Classification

**Purpose:** Determine the primary topic of the guest's message to identify which knowledge chunks to retrieve and how to respond.

**Input:** `InboundMessage.message_body`, `session_phase`, session context
**Output:** `classified_intent`, `confidence_score`, `secondary_intent` (nullable)

**Classification uses the AI Knowledge Taxonomy** defined in [ai-knowledge-taxonomy.md](../ai-concierge/ai-knowledge-taxonomy.md):

| Category code | Topic | Priority rank |
|---|---|---|
| CAT-01 | Emergency | 1 (handled in Step 3) |
| CAT-02 | Access / Entry | 2 |
| CAT-03 | Check-in | 3 |
| CAT-04 | Check-out | 4 |
| CAT-05 | Maintenance (urgent) | 5 |
| CAT-06 | WiFi | 6 |
| CAT-07 | Amenities / Appliances | 7 |
| CAT-08 | House rules | 8 |
| CAT-09 | Services (transfer, experience) | 9 |
| CAT-10 | Local area | 10 |
| CAT-11 | Tourist tax | 11 |
| CAT-12 | General FAQ | 12 |

**Classification method at MVP:** LLM-based classification. The inbound message and session phase are included in a short classification prompt. The LLM returns the most likely CAT code and a confidence score (0.0–1.0).

**Confidence thresholds:**
- `confidence ≥ 0.80`: High confidence. Proceed to retrieval.
- `confidence 0.60–0.79`: Moderate confidence. Proceed to retrieval, but include an implicit hedge in the response ("If I've understood correctly…").
- `confidence < 0.60`: Low confidence. Issue a clarification request to the guest before retrieval. Increment `unresolved_query_count`.

**Secondary intent:** If the message contains two topics (e.g. "where's the WiFi password and what time do I need to check out?"), classify both. Load chunks for both. Compose a single response covering both.

---

### Step 5 — Retrieval Orchestration (KBB Call)

**Purpose:** Load the property knowledge relevant to the classified intent.

**Full retrieval architecture:** See [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md). Summary of what the AI runtime does at this step:

**5.1 Determine required chunks**

Based on `classified_intent`, the runtime specifies which knowledge chunks to request from the KBB:

| Classified intent | Always-loaded chunks | Add on demand |
|---|---|---|
| CAT-02 Access | `emergency`, `access` | `check_in` |
| CAT-03 Check-in | `emergency`, `access`, `check_in` | `house_rules` |
| CAT-04 Check-out | `emergency`, `check_out` | `house_rules` |
| CAT-05 Maintenance | `emergency`, `maintenance` | `utilities` |
| CAT-06 WiFi | `emergency`, `connectivity` | — |
| CAT-07 Amenities | `emergency`, `amenities` | `appliance_guides` |
| CAT-08 House rules | `emergency`, `house_rules` | — |
| CAT-09 Services | `emergency`, `services` | `local_area` |
| CAT-10 Local area | `emergency`, `local_area` | — |
| CAT-11 Tourist tax | `emergency`, `compliance` | — |
| CAT-12 FAQ | `emergency`, `property_summary`, `house_rules` | — |

`emergency` chunk is always loaded regardless of intent. This is hardcoded, not configurable.

**5.2 KBB call contract**

The runtime calls the KBB with:
```
KBBRequest {
    property_id:     String
    reservation_id:  UUID
    session_id:      UUID
    session_phase:   Enum
    guest_language:  String        // ISO 639-1
    chunks_requested: Array[String]
}
```

The KBB executes its 7-step assembly pipeline (Scope Filter → Activation Gate → Dynamic Merge → Language Select → Access Gate → Emergency Inject → Chunk Generate) and returns a `PropertyKnowledgeBlock` scoped to this session.

**5.3 KBB failure handling**

If the KBB returns an error or times out:

| Failure type | AI runtime action |
|---|---|
| KBB timeout (> 200ms) | Use cached block from previous session request (if within TTL) |
| No cached block available | Issue degraded response: "I'm having trouble accessing your property information right now. For anything urgent, please call your host directly: [emergency_contact_phone]." |
| EmergencyData unavailable | Use hardcoded Italian emergency numbers. Never proceed without emergency data. |
| Property not found / not active | Issue unknown-property fallback and escalate to operator |

---

### Step 6 — Access Code Gating

**Purpose:** Determine whether access credentials may be included in this response.

Access codes (WiFi password, lockbox code, smart lock PIN) are subject to time-gated delivery rules defined in [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md):

| Code type | Delivery condition |
|---|---|
| WiFi password | Always available once reservation is `checked_in` or within `access_window` (check-in day) |
| Lockbox / key box code | Available from check-in day (`checkin_date`) through checkout day |
| Smart lock PIN | Available from `checkin_date - 1 day` (configurable) through checkout day |
| Post-checkout codes | Not delivered |

**Gate check:**
```
if today < (checkin_date - access_lead_days):
    replace all access codes with sentinel "[not yet available — available from [checkin_date]]"

if today > checkout_date:
    replace all access codes with sentinel "[access codes are no longer active after checkout]"
```

This check is applied at the KBB level (Step 5 of KBB pipeline). The AI runtime does NOT re-implement this check — it trusts the KBB output. However, the runtime validates that sentinel values are present as expected when the session phase is `pre_arrival` (early access scenario) and does not attempt to construct codes from other data in the block.

---

### Step 7 — Multilingual Orchestration

**Purpose:** Determine the language of the AI's response.

**Language resolution order** (from [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md)):
1. `WhatsAppSession.detected_language` — if detected with high confidence in recent messages
2. `Reservation.guest_preferred_language` — set by homeowner at booking
3. `en` — default fallback
4. `it` — second fallback (always available for Italian content)

**Emergency exception:** In emergency situations (Step 3), respond in both Italian and English regardless of detected language. Safety information must be understood; do not risk a language mismatch.

**Language of knowledge content:**
The KBB returns content in the resolved language where translations exist. If content for the requested language is not available, the KBB returns the best available language (EN or IT). The AI runtime notes this language mismatch and includes a soft apology: "I only have this information in [language] at the moment — I hope that's helpful."

**Do not machine-translate content at runtime.** If a translation is not in the KnowledgeBlock, it does not exist. Do not use the LLM to translate property-specific factual content — this risks hallucination of property details. Only translation of wrapper phrases and conversational scaffolding is permitted at runtime.

---

### Step 8 — Response Assembly

**Purpose:** Generate the outbound message to send to the guest.

**System prompt construction:**

The LLM prompt is assembled as:
```
[1] Fixed system role + persona instructions (from ai-tone-guidelines.md)
[2] Session context: guest_name, session_phase, property display_name, language
[3] Emergency data block (always injected — hardcoded numbers + property emergency contacts)
[4] PropertyKnowledgeBlock chunks (relevant to this intent)
[5] Conversation history (last N exchanges — WhatsAppSession.message_history)
[6] Grounding rules (G-01 through G-10 from property-knowledge-schema.md)
[7] Hallucination prevention rules (H-01 through H-07 from property-knowledge-schema.md)
[8] Guest's message
```

**Grounding rules applied at assembly (abbreviated):**
- G-01: Only answer from knowledge block content — never from general LLM knowledge about Italy or Sicily
- G-02: If a field is null or missing, say the information isn't available, not a guess
- G-03: Always use exact values from the knowledge block — do not paraphrase credentials
- G-04: Never infer what the guest "probably" needs when the question is ambiguous — clarify
- G-05: Include the exact name of emergency services, not generic descriptions
- G-06: If access code delivery is gated, use the exact sentinel message — do not approximate

**Response length rules:**
- Maximum: 300 words in a single WhatsApp message
- Access code delivery: use WhatsApp fixed-width formatting: `` `CODE` ``
- Step-by-step instructions: numbered lists
- Emergency responses: short, direct, action-first — no pleasantries

**LLM call:**
- Model: configured via environment variable — not hardcoded in this document
- Temperature: 0.2 (low — deterministic responses for factual queries)
- Max tokens: 400
- Timeout: 8 seconds. If the LLM exceeds 8 seconds, use the appropriate fallback response.

---

### Step 9 — Confidence Evaluation and Unresolved Query Handling

**Purpose:** Assess whether the generated response is grounded and appropriate to send.

**Post-generation confidence check:**
After the LLM generates a response, the runtime evaluates:
1. Does the response contain content not present in the loaded knowledge chunks? → Hallucination risk
2. Does the response make a claim about a specific credential (code, phone number) that differs from the knowledge block? → Hard fail
3. Does the response reference a partner name, homeowner personal phone, or internal note? → Scope violation

**On scope violation:**
- Do not send the response
- Log a `SCOPE_VIOLATION` security event
- Escalate to operator
- Send fallback: "I'm having trouble giving you a complete answer right now. For anything urgent, please call [emergency_contact_phone]. The Nauxica team will follow up."

**Unresolved query count:**

`WhatsAppSession.unresolved_query_count` is incremented when:
- The AI issues a clarification request (confidence < 0.60 at Step 4)
- The AI issues a fallback response (knowledge not available)
- The AI explicitly says "I'm not sure" or equivalent

At `count = 3`: Soft escalation — the AI includes "I can also connect you with the Nauxica team if that would help" in its response.
At `count = 5`: Hard escalation — `CONFIDENCE_THRESHOLD` trigger fires. See `TRIGGER-05` in [escalation-rules.md](../ai-concierge/escalation-rules.md).

The count is cumulative across the session (not reset per message). It is persisted on `WhatsAppSession`.

---

### Step 10 — Action Execution

**Purpose:** Execute any workflow actions implied by the classified intent and response.

The AI runtime can create the following records as part of a message handling cycle:

| Allowed write | Conditions |
|---|---|
| `ServiceRequest` | Guest's message clearly requests a service (maintenance, transfer, experience). AI confirms in the response that a request has been submitted. |
| `EscalationRecord` | Any escalation trigger condition is met (see [escalation-rules.md](../ai-concierge/escalation-rules.md)). |
| `WhatsAppSession` | Session state updates: `detected_language`, `unresolved_query_count`, `session_phase`, message history appended. |

**The AI runtime may NOT write to any other model.** Attempting to write outside this set constitutes a `SCOPE_VIOLATION` security event.

**ServiceRequest creation rules:**
- The AI creates a ServiceRequest only when the guest explicitly states a need — not speculatively
- Urgent maintenance (gas, no water, broken lock) → create `ServiceRequest` with urgency `URGENT`, simultaneously create `EscalationRecord` with `MAINTENANCE_URGENT`
- Non-urgent maintenance (appliance not working) → create `ServiceRequest` with urgency `HIGH`
- Transfer/experience request → create `ServiceRequest` with urgency `NORMAL`
- The AI tells the guest exactly what it submitted: "I've submitted a maintenance request for your hot water issue — your host's partner will aim to respond within 30 minutes."

**Action confirmation in response:**
Every action the AI takes must be reflected in its message to the guest. The AI cannot silently create a `ServiceRequest` without telling the guest. The guest's `guest_status_message` on the ServiceRequest must be consistent with what the AI said.

---

### Step 11 — Operator Handoff Holding

**Applies when:** `WhatsAppSession.active_escalation_id` is set (identified in Step 2).

When a session is under human takeover:
1. The AI does not process the message through Steps 3–10
2. The AI acknowledges receipt and holds: "I've passed your message to the Nauxica team. They're looking into this for you and will follow up shortly."
3. The guest's message is logged in the session history (operators can see it)
4. An operator notification is triggered (new message arrived in an escalated session)
5. The AI does not attempt to answer the question — even if it could

**Exception:** If the guest sends a message containing emergency keywords while the session is escalated, the AI still fires the emergency pre-check (Step 3) and sends the emergency response. Safety is never handed off.

**Holding message variants** (from [escalation-rules.md](../ai-concierge/escalation-rules.md)):
- Generic: "I've passed your message to the Nauxica team — they'll be with you shortly."
- After a service request: "The Nauxica team is handling your request. You'll hear back soon."
- After a safety concern: "I've alerted the Nauxica team immediately. Please stay in contact."

---

### Step 12 — Post-Escalation Recovery

**When the escalation is resolved:**
- `EscalationRecord.status → RESOLVED`
- `EscalationRecord.ai_resumed_at` is set (if AI is re-enabled)
- Event `escalation.EscalationRecord.AIResumed` is emitted
- AI runtime consumes this event and clears `WhatsAppSession.active_escalation_id`

**AI re-engagement message:**
When AI is re-enabled, if the guest sends a message after the handoff ends, the AI resumes with:
"I'm back to help you. Is there anything else you need for your stay?"
Do not reference what the escalation was about. Do not comment on whether it was resolved. Start fresh.

**AI is NOT automatically re-enabled after every escalation.** The operator decides whether to re-enable AI for each session. Some escalations (e.g. COMPLAINT_ESCALATION, LEGAL_LIABILITY) result in the session being permanently handled by a human for the remainder of the stay.

---

### Step 13 — Message Delivery and Session Update

**Delivery:**
1. Outbound message is sent via WhatsApp Business API
2. Delivery confirmation is awaited (within 10 seconds)
3. On confirmed delivery: `WhatsAppSession.last_message_at` updated, message history appended
4. On delivery failure: retry once after 30 seconds; if second attempt fails, log delivery failure and alert operator (for CRITICAL scenarios) or log only (for non-critical)

**Session state update:**
After each message cycle:
- `WhatsAppSession.last_active_at` = now()
- `WhatsAppSession.message_count` incremented
- `WhatsAppSession.session_phase` updated if a phase transition occurred
- `WhatsAppSession.unresolved_query_count` updated

**Events emitted:**
- `ai.AISession.MessageProcessed` (always)
- `ai.AISession.FallbackIssued` (if fallback was sent)
- `ai.AISession.EscalationTriggered` (if escalation was created)
- `ai.AISession.EmergencyDetected` (if emergency pre-check fired)
- `ai.ServiceRequest.Created` (if ServiceRequest was created)

---

## Hallucination Prevention Layers

Hallucination prevention is structural — not prompt-only. The following mechanisms work together:

| Layer | Mechanism |
|---|---|
| Scope filtering (KBB Step 1) | INTERNAL-scoped fields never enter the knowledge block |
| Activation gate (KBB Step 2) | Inactive properties → degraded block, not empty or fabricated |
| Sentinel values (KBB Step 5) | Access codes outside delivery window replaced with `[not yet available]` — LLM cannot invent them |
| Chunk isolation | LLM prompt includes only chunks relevant to the intent — reduces surface for off-topic inference |
| Grounding instruction (system prompt) | Explicit rule: "answer only from the information provided — if not present, say so" |
| Post-generation scope check (Step 9) | Output verified against knowledge block before sending |
| Low temperature | LLM temperature = 0.2 — reduces creative departures from the knowledge block |
| Confidence thresholds | Low-confidence classification → clarification before retrieval — reduces mismatched chunk loading |

**Prohibited inferences** (from [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md)):

| Prohibited | Why |
|---|---|
| Guessing a WiFi password not in the knowledge block | Credentials must be exact |
| Estimating a tourist tax amount from similar properties | Tax rates are municipality-specific |
| Assuming a partner will arrive "in an hour" without a confirmed response window | Overpromising partner availability |
| Saying "I believe the hospital is in X" when the address is not in emergency data | Safety-critical — must be exact or not answered |
| Describing local restaurants not in the local_area chunk | Risk of sending guests to a closed or wrong business |
| Inventing emergency procedures beyond what the property record contains | Safety risk |

---

## Tool Access Permission Boundaries

The AI model (LLM) does not have direct database access. All writes are mediated by the Action Executor in the AI runtime service.

**Permitted tool calls (AI model → Action Executor):**

| Tool | Purpose | Guard condition |
|---|---|---|
| `create_service_request` | Guest requests a service | Service type confirmed from guest message; property has an active assignment for this type or the request is URGENT |
| `create_escalation` | Escalation trigger condition met | Specific trigger type identified; not already escalated for the same trigger in this session |
| `update_session_language` | Detected language updated | Language detected with high confidence over 3+ messages |

**Prohibited tool calls (the AI model may not):**
- Read or write Property records
- Read or write Reservation records beyond what is pre-loaded in session context
- Read PartnerAssignment records
- Read or write User records
- Create or modify PartnerRequest records
- Read EmergencyData directly (this is pre-loaded into the knowledge block — AI reads it via the block, not directly)
- Access any financial data
- Access any other guest's session

These prohibitions are enforced at the Action Executor level — the AI model requesting a prohibited action receives an error response, and a `SCOPE_VIOLATION` event is logged.

---

## Session Memory Architecture

The AI runtime maintains two types of memory for a session:

### Short-term (in-session context window)
- Last N messages exchanged in this session (N = 10 by default; configurable)
- Current `PropertyKnowledgeBlock` chunks loaded for this session
- Current session context: phase, language, unresolved_query_count, active escalation state
- Loaded from `WhatsAppSession.message_history` at the start of each message cycle

### Long-term (persisted, not in context window)
- Full message history on `WhatsAppSession` (persisted but not all loaded into LLM context)
- `unresolved_query_count` (persisted across the full session)
- `session_phase` history
- Linked `ServiceRequest` and `EscalationRecord` IDs

**No cross-session memory:** The AI has no memory of conversations from previous stays by the same guest. Each `Reservation` creates a new `WhatsAppSession` with a clean state. The guest's phone number in a future reservation creates a new session — prior stays are not referenced.

**Within a session:** The AI should use conversation context to avoid asking the guest to repeat themselves. If the guest said "the washing machine is broken" in message 3 and asks a follow-up in message 5, the AI should reference the prior context without asking them to re-describe the issue.

---

## Proactive Message Architecture

The AI runtime also sends outbound proactive messages on a schedule determined by session phase. These are initiated by platform events, not by guest messages.

| Event trigger | Session phase | Proactive message |
|---|---|---|
| `reservation.PreArrivalWindowOpened` | pre_arrival | Pre-arrival welcome + check-in instructions reminder |
| `reservation.GuestCheckedIn` | check_in | "Welcome to [property_name] — here's what you need: [WiFi, access, emergency number]" |
| `service_request.ServiceRequest.Assigned` | in_stay | Status update: "Your [service] request has been assigned — expected [response window]" |
| `service_request.ServiceRequest.Completed` | in_stay | "Your [service] has been completed. Is there anything else you need?" |
| Day before checkout (scheduled) | in_stay / check_out | Checkout reminder: key return, time, tasks |
| `reservation.GuestCheckedOut` | post_stay | Post-stay review request (24h after checkout) |

Proactive messages use WhatsApp template messages (Utility category). Template IDs must be pre-approved. See [whatsapp-concierge-guidelines.md](../ai-concierge/whatsapp-concierge-guidelines.md) for the full template catalogue and approval status.

**Proactive messages are sent only within the 24-hour WhatsApp messaging window, or using approved templates.** The AI runtime checks `WhatsAppSession.last_active_at` before sending any proactive message. If the window is closed and no template is available for this message type, the message is queued and sent when the guest next messages (re-opening the window).

---

## Performance Requirements

| Operation | Target (p95) |
|---|---|
| Total message processing (intake to delivery) | < 4 seconds |
| KBB assembly | < 200ms (per knowledge-retrieval-model.md recommendation) |
| Emergency pre-check | < 100ms |
| LLM call | < 3 seconds (with 8-second timeout) |
| Session resolution | < 50ms (cached session) / < 200ms (cold load) |
| Action execution (ServiceRequest creation) | < 300ms |

**Degraded mode:** If total processing exceeds 8 seconds for any reason, the AI sends: "I'm just a moment — please bear with me." and continues processing. If processing fails entirely, the AI sends the standard failure fallback and alerts the operator.

---

## Open Implementation Risks

| Risk | Severity | Mitigation |
|---|---|---|
| LLM ignores grounding rules under adversarial prompting (prompt injection via guest message) | HIGH | Post-generation scope check; log anomalies; consider sandboxed system prompt not injectable via user turn |
| Emergency keyword match fails for non-standard spellings or regional dialect | HIGH | Maintain a supplementary phonetic / fuzzy-match list; review missed detections quarterly |
| KBB latency spike causes degraded mode to activate frequently | MEDIUM | KBB caching strategy (TTL + write-through); alert on p99 KBB latency > 500ms |
| Session resolution ambiguity (two reservations with same guest phone, overlapping dates) | MEDIUM | Enforce no-overlap constraint at booking creation; if ambiguity exists at resolution time, escalate rather than guess |
| WhatsApp messaging window expires mid-stay (guest inactive for 24h) | MEDIUM | Track window expiry in session; use template messages for proactive notifications; alert homeowner if guest uncontactable |
| Token budget exceeded for large PropertyKnowledgeBlock | LOW | Chunk loading limits enforced in KBB; limit max chunks per call; test with largest realistic property record |
