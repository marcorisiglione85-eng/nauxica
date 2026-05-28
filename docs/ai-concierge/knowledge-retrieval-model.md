# Knowledge Retrieval Model

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** AI concierge · WhatsApp-first · Sicily launch
**Last updated:** 2026-05-28
**Related:** [property-knowledge-schema.md](property-knowledge-schema.md) · [escalation-rules.md](escalation-rules.md) · [emergency-procedures.md](emergency-procedures.md) · [data-models.md](../backend/data-models.md)

---

## Purpose

This document defines the logical model for how the AI concierge:

1. Identifies which guest is messaging
2. Determines which property to look up
3. Retrieves the correct knowledge block
4. Routes the conversation to the right response type
5. Knows when to handle autonomously vs. escalate

It is an architecture document — no code, no prompt engineering. The intent is to define behaviour precisely enough that an AI integration team can implement it correctly, and a Nauxica operator can understand and audit it.

---

## Design Constraints

| Constraint | Implication |
|---|---|
| Guests have no Nauxica account | Identity must be established via WhatsApp phone number matched to a Booking record |
| WhatsApp has no persistent session memory | Knowledge block must be re-fetched or cached per conversation window |
| Guest may speak any language | Language detection runs on first message; response language must match |
| AI must never hallucinate property details | All cited facts must come from the knowledge block — no inference or invention |
| Some knowledge block fields may be missing | Defined fallbacks must exist for every required field (see [property-knowledge-schema.md](property-knowledge-schema.md)) |
| Emergency situations require immediate human escalation | Emergency detection must trigger before any other routing logic |

---

## 1. Guest Identification Flow

The AI cannot begin a property-specific conversation until a guest is positively identified.

```
Incoming WhatsApp message received
         │
         ▼
Look up phone number in active Booking records
(active = booking_status is "confirmed" or "checked-in",
 checkin_date ≤ today ≤ checkout_date + 1 day grace period)
         │
         ├─── MATCH FOUND ──────────────────────────────────────────────►
         │                                                                │
         │                                               Load PropertyKnowledgeBlock
         │                                               for matched property_id
         │                                                                │
         │                                               Proceed to Language Detection
         │
         └─── NO MATCH ────────────────────────────────────────────────►
                                                                         │
                                                          Send: "I couldn't find a booking 
                                                          linked to your number. Could you 
                                                          share your confirmation number? 
                                                          It looks like NX-2026-XXXXX."
                                                                         │
                                                          Guest provides confirmation number
                                                                         │
                                                          Look up Booking by confirmation_number
                                                                         │
                                                    ┌────────────────────┘
                                                    │
                                         ┌──────────┴──────────┐
                                   MATCH FOUND             STILL NO MATCH
                                         │                       │
                                  Verify phone number    Escalate to human operator
                                  matches or prompt      "I'm unable to find your booking.
                                  guest to confirm       Please contact Nauxica support."
                                  their name matches
                                         │
                                  Load knowledge block
                                  Proceed to Language Detection
```

**Grace period:** The knowledge block remains accessible for 24 hours after `checkout_date` to handle post-checkout questions (lost items, taxi requests, etc.).

**Multiple active bookings:** If a phone number is linked to more than one active booking (edge case — unlikely at MVP), prompt: "We have more than one active booking for your number. Which property are you staying at?" and list the `display_name` values.

---

## 2. Language Detection

Language detection runs on the first message of each conversation window.

```
First message received from identified guest
         │
         ▼
Detect language of message text
         │
         ├─── Italian (IT) detected ────► respond in Italian
         ├─── English (EN) detected ────► respond in English
         ├─── German (DE) detected ─────► respond in German
         ├─── French (FR) detected ─────► respond in French
         ├─── Other language detected ──► respond in English (default)
         │                               + append: "If you prefer, I can try to assist 
         │                               in your language — just let me know."
         └─── Language unclear / emoji only ──► respond in English (default)
```

**Language persistence:** Once detected, the response language is maintained for the duration of the conversation window. If the guest switches language mid-conversation, detect and switch at the next message.

**Supported at launch (Sicily):** IT, EN, DE, FR — the four primary tourist source markets for Sicily.

**Knowledge block language:** Property-specific prose (entry instructions, appliance guides, etc.) is authored in one language (typically Italian or English). At MVP, the AI delivers it in the authored language. Automatic translation is a post-MVP feature. Clearly note this limitation in the [ai-tone-guidelines.md](ai-tone-guidelines.md).

---

## 3. Knowledge Block Retrieval

### When to fetch

| Trigger | Action |
|---|---|
| New conversation started (first message in window) | Fetch full knowledge block |
| Guest identified via confirmation number | Fetch full knowledge block |
| Block is older than 24 hours (cache TTL) | Re-fetch |
| Homeowner updates property data | Invalidate cache for that `property_id` |
| Property `platform_status` changes to `suspended` | Immediately invalidate and disable |

### What is fetched

The API endpoint returns a **scoped projection** of the `PropertyKnowledgeBlock`:

- **Pre-booking / unidentified guest:** `PUB` fields only
- **Confirmed guest (booking matched):** `PUB` + `GST` fields

The AI integration layer must enforce this scope. The raw `PropertyKnowledgeBlock` record is never delivered directly to the AI prompt — the API applies field filtering before delivery.

### Knowledge block completeness check

On fetch, check `is_complete` flag:

| Value | AI behaviour |
|---|---|
| `true` | Proceed normally |
| `false` | Use degraded mode — for any property-specific question, respond: "I don't have all the details for this property yet. Please contact [emergency_contact_name] on [emergency_contact_phone] or Nauxica support." |

---

## 4. Conversation Lifecycle

Each guest stay has a defined arc. The AI adapts its proactive messaging and topic routing based on the current stage.

### Stage 1 — Pre-Arrival

**Trigger:** Message received when today < `checkin_date`

**Proactive message (sent automatically 48h before check-in):**
> "Hi [guest_name], we're looking forward to welcoming you to [display_name] on [checkin_date]. 
> Check-in is from [checkin_from]. Reply to this message if you have any questions before you arrive."

**Topics to handle in this stage:**

| Topic | Handle? |
|---|---|
| Check-in time | Yes |
| Early check-in availability | Yes |
| Directions / nearest airport | Yes |
| Transfer requests | Yes — refer to partner marketplace or provide info |
| Access / entry code | No — do not send codes until check-in day |
| House rules | Yes |
| Property amenities | Yes |
| Booking changes or cancellation | No — escalate to homeowner |

---

### Stage 2 — Check-in Day

**Trigger:** Today = `checkin_date`

**Proactive message (sent at 10:00 on check-in day):**
> "Good morning [guest_name]! Today is your check-in day at [display_name]. 
> Check-in is from [checkin_from]. Here is everything you need to arrive:
>
> **Entry instructions:**
> [entry_instructions]
>
> **WiFi:**
> Network: [wifi_network] | Password: [wifi_password]
>
> If you have any questions, just reply here."

**Topics to handle in this stage:**

| Topic | Handle? |
|---|---|
| Entry instructions | Yes — deliver in full |
| Access codes | Yes — deliver once in check-in message |
| WiFi | Yes |
| Parking | Yes |
| Check-in time / late arrival | Yes |
| Lockout | Yes — provide lockout instructions + emergency contact |
| Tourist tax | Yes |
| Appliance questions | Yes |

---

### Stage 3 — During Stay

**Trigger:** `checkin_date` < today < `checkout_date`

**Proactive message (sent at 10:00 on Day 2 if stay ≥ 3 nights):**
> "Good morning from [display_name]! Hope everything is going well. 
> If you need anything during your stay — local tips, help with appliances, or anything else — 
> just message here. We're happy to help."

**Topics to handle in this stage:**

| Topic | Handle? |
|---|---|
| Appliance questions | Yes |
| WiFi issues | Yes |
| House rules clarification | Yes |
| Trash / recycling | Yes |
| Local recommendations | Yes |
| Medical / pharmacy questions | Yes |
| Emergency | Immediate escalation — see Stage escalation rules |
| Noise complaint about guest | Escalate to homeowner |
| Maintenance issue | Acknowledge + escalate to homeowner |
| Booking extension | Escalate to homeowner |
| Refund request | Escalate to homeowner |

---

### Stage 4 — Checkout Day

**Trigger:** Today = `checkout_date`

**Proactive message (sent at 08:00 on checkout day):**
> "Good morning [guest_name], today is your checkout day. 
> Checkout is by [checkout_by]. 
> [If key-box: "Please return the key to the key box at [key_box_location] and close it securely."]
> Thank you for staying at [display_name] — we hope you had a wonderful time in Sicily.
> [If review requested by homeowner: "We'd love to hear about your experience — your review means a lot to us."]"

**Topics to handle in this stage:**

| Topic | Handle? |
|---|---|
| Checkout time / late checkout | Yes |
| Key return instructions | Yes |
| Lost items | Acknowledge + advise to contact homeowner directly after checkout |
| Review requests | Yes — provide link if available |
| Taxi / transfer to airport | Yes — refer to partner if configured |

---

### Stage 5 — Post-Checkout (Grace Period)

**Trigger:** `checkout_date` < today ≤ `checkout_date` + 1 day

**No proactive message.**

**Topics to handle:**

| Topic | Handle? |
|---|---|
| Lost items | Acknowledge + connect to homeowner |
| Invoice / tourist tax receipt | Refer to homeowner |
| Review questions | Yes |
| Re-booking | Acknowledge + redirect to Nauxica platform |
| Anything property-access-related | Do not re-send codes — session is closed |

---

## 5. Topic Routing Table

Authoritative reference for AI capability boundaries. This table governs what the AI handles and what it escalates.

| Topic | Handle autonomously | Escalate to | Escalation trigger |
|---|---|---|---|
| Check-in time | Yes | — | — |
| Check-in instructions / entry | Yes | Emergency contact | If guest reports they cannot get in after following instructions |
| WiFi | Yes | Emergency contact | If guest reports WiFi completely down |
| Access codes | Yes (confirmed guest only) | — | — |
| Appliance guides | Yes | Homeowner | If guest reports appliance appears broken or damaged |
| House rules | Yes | Homeowner | If guest disputes or refuses to follow a rule |
| Tourist tax | Yes (inform only) | Homeowner | If guest refuses to pay |
| Quiet hours reminder | Yes | Homeowner | If guest is non-compliant after reminder |
| Local recommendations | Yes | — | — |
| Pharmacy / medical questions | Yes (inform + direct) | Emergency services | If medical urgency indicated |
| Transfer / taxi requests | Yes (refer to info) | — | — |
| Noise complaint (neighbour) | Acknowledge + remind of rules | Homeowner | Immediately |
| Noise complaint (about guest) | — | Homeowner | Immediately |
| Maintenance issue | Acknowledge | Homeowner | All maintenance issues — do not advise DIY repair |
| Booking change / extension | — | Homeowner | Always |
| Cancellation or refund | — | Homeowner | Always |
| Price / cost question | — | Homeowner | Always |
| Guest dispute or complaint | Acknowledge only | Homeowner + Nauxica support | All complaints — do not attempt to resolve |
| Medical emergency | Give emergency numbers immediately | Emergency services + emergency contact | Always |
| Safety threat | Give emergency numbers immediately | Emergency services + emergency contact | Always |
| Fire / gas leak | Give emergency numbers immediately | Emergency services | Always |
| Property damage by guest | Acknowledge | Homeowner + Nauxica support | Always |
| Abusive or threatening language | End conversation politely | Nauxica support | Always |
| Request for information not in knowledge block | Use fallback response | — | — |

---

## 6. Emergency Detection

Emergency detection must run before any other routing logic on every incoming message.

**Trigger keywords / signals (not exhaustive — AI must use contextual judgement):**

| Category | Example signals |
|---|---|
| Medical | "hospital", "ambulance", "hurt", "injured", "ill", "chest pain", "not breathing", "accident", "bleed" |
| Fire / gas | "fire", "smoke", "gas smell", "explosion" |
| Safety threat | "someone in the property", "break-in", "threatened", "afraid", "unsafe" |
| Lockout + distress | "locked out" + "cold" / "late at night" / "child with me" / "raining" |

**On emergency detection:**

```
Emergency signal detected
         │
         ▼
Immediately send emergency response:
  1. Acknowledge the situation clearly and calmly
  2. Give relevant emergency service numbers (112, 118, 113, 115)
  3. Give emergency_contact_name and emergency_contact_phone
  4. Give nearest_hospital_name and address (for medical)
  5. Do NOT ask clarifying questions before sending this information
         │
         ▼
Flag conversation for immediate human review
Notify Nauxica operations (platform alert)
Notify homeowner (via platform notification)
         │
         ▼
Continue conversation in monitoring mode
Do not return to standard routing until
a human operator has reviewed and cleared the session
```

Full procedures: [emergency-procedures.md](emergency-procedures.md)

---

## 7. Escalation Model

When the AI cannot or must not handle a topic, it escalates. Escalation is always transparent to the guest.

### Escalation levels

| Level | Target | How | When |
|---|---|---|---|
| **L1 — Homeowner** | Property owner | Platform notification + in-app alert | Maintenance, complaints, booking changes, rule disputes |
| **L2 — Nauxica Support** | Nauxica operations team | Support ticket created automatically | Platform issues, guest disputes, abusive behaviour, unresolved L1 |
| **L3 — Emergency Services** | Police / ambulance / fire | AI provides numbers directly — does not call | All life-safety situations |

### Standard escalation message to guest

> "I'm not able to handle this directly, but I've flagged it to [homeowner name / Nauxica support] and someone will be in touch shortly. 
> In the meantime, if this is urgent, please call [emergency_contact_phone]."

Full escalation rules: [escalation-rules.md](escalation-rules.md)

---

## 8. Sensitive Data Handling in Conversation

The AI must enforce data hygiene rules within the conversation itself:

| Rule | Detail |
|---|---|
| Access codes sent once only | `key_box_code`, `wifi_password`, etc. are sent in the check-in message. If a guest asks again, re-send once with a note to keep them safe. Do not re-send more than twice in a session. |
| Never send codes to unidentified guests | `GST`-level fields are never delivered until booking is matched. |
| Do not confirm or deny booking details to third parties | If a message comes from an unknown number asking about a guest's stay, do not confirm any information. |
| Do not log or repeat sensitive data in summaries | When acknowledging check-in, do not repeat access codes in later confirmation messages. |
| AI concierge has no access to financial data | If a guest asks about cost, pricing, or payment: always escalate to homeowner. The AI has no financial fields and must never estimate or fabricate amounts. |

---

## 9. Conversation Audit Log

Every AI conversation must be logged for quality assurance and legal traceability.

> ⚠️ Legal review required: WhatsApp conversation logs contain personal data. Confirm retention period, storage jurisdiction, access controls, and deletion policy under GDPR and Italian privacy law before implementing logging.

Minimum fields to log per conversation:

| Field | Notes |
|---|---|
| `conversation_id` | Unique per WhatsApp thread |
| `guest_phone_hash` | Hashed, not plaintext — for traceability without exposing PII |
| `property_id` | Which property knowledge block was used |
| `booking_id` | Which booking was matched |
| `messages_count` | Total messages in conversation |
| `escalations_triggered` | Array of escalation events with level and topic |
| `emergency_flags` | Boolean — whether emergency detection was triggered |
| `knowledge_block_version` | Schema version used |
| `session_started_at` | |
| `session_last_active_at` | |
| `language_detected` | ISO 639-1 code |

---

## Related Documents

- [property-knowledge-schema.md](property-knowledge-schema.md) — What the AI reads from
- [escalation-rules.md](escalation-rules.md) — Full escalation criteria and procedures
- [emergency-procedures.md](emergency-procedures.md) — Emergency response protocols
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Voice, tone, and language rules
- [whatsapp-concierge-guidelines.md](whatsapp-concierge-guidelines.md) — WhatsApp-specific operational rules
- [data-models.md](../backend/data-models.md) — Booking and PropertyKnowledgeBlock models
