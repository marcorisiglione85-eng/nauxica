# Escalation Rules

Defines when the AI concierge must hand a conversation to a human operator, what state is
created, how the conversation is managed during takeover, and when (and whether) the AI may
resume.

**Related:** [Data Models](../backend/data-models.md) · [WhatsApp Session Anchor](whatsapp-session-anchor.md) · [Emergency Procedures](emergency-procedures.md) · [AI Knowledge Taxonomy](ai-knowledge-taxonomy.md)

---

## 1. Design Principles

**Escalation is a safety valve, not a failure.** The AI concierge is expected to escalate
in certain conditions by design. A well-functioning concierge escalates appropriately — it
does not try to handle everything.

**Escalation must be fast.** The moment a trigger condition is met, the EscalationRecord
is created and the operator is notified. The AI does not delay to attempt one more answer.

**The AI never pretends a human is available when one is not.** If the escalation SLA
has elapsed without operator acknowledgement, the AI tells the guest honestly and gives
them the Nauxica Support number.

**The conversation belongs to the operator once escalated.** The AI must not continue
answering queries in an escalated session unless the operator explicitly re-enables AI
response mode.

**Homeowner is not the first escalation target.** Nauxica operators are. The homeowner
is notified for specific escalation types (property damage, serious complaints, financial
disputes) but is not expected to run a 24/7 support operation.

---

## 2. Escalation Trigger Taxonomy

Every EscalationRecord must be tagged with one of the following trigger types.

### TRIGGER-01: EMERGENCY
**Condition:** Guest message classified as any emergency type from [Emergency Procedures §4](emergency-procedures.md) — MEDICAL, FIRE, GAS, FLOOD, SECURITY, STRUCTURAL, NATURAL_DISASTER.
**Detection:** Keyword and semantic pattern matching. Errs on the side of false positives.
**Response time SLA:** Immediate (0–5 minutes).
**Who is notified:** Nauxica operator on duty + homeowner emergency contact.
**AI behaviour after trigger:** AI provides full emergency information (see [Emergency Procedures](emergency-procedures.md)), then sends a handoff message. AI does not answer any further queries.

---

### TRIGGER-02: SAFETY_CONCERN
**Condition:** Guest expresses that they feel unsafe, threatened, or in danger — without using explicit emergency keywords. e.g. "I don't feel safe", "there's someone outside", "I'm scared".
**Detection:** Sentiment and context pattern matching.
**Response time SLA:** Immediate (0–5 minutes).
**Who is notified:** Nauxica operator on duty.
**AI behaviour after trigger:** Acknowledge the guest's concern. Provide 112 and Nauxica Support number. Handoff. Do not downplay.

---

### TRIGGER-03: MAINTENANCE_URGENT
**Condition:** A ServiceRequest is created with `urgency = urgent` or `urgency = emergency` for a maintenance issue with safety implications (flooding, no heating in winter, structural concern, electrical fault).
**Detection:** ServiceRequest urgency field + service type + time of day.
**Response time SLA:** Urgent (0–30 minutes).
**Who is notified:** Nauxica operator + homeowner (for property damage scenarios).
**AI behaviour after trigger:** AI informs guest that the issue has been flagged and an operator will be in touch. Provides interim self-help steps if safe. Does not promise a specific fix time.

---

### TRIGGER-04: HUMAN_REQUESTED
**Condition:** Guest explicitly asks to speak with a human. e.g. "I want to speak to a person", "can I talk to someone?", "put me through to a human", "is there a real person I can talk to?", "parla con un umano".
**Detection:** Explicit phrase matching, multiple language variants.
**Response time SLA:** High (0–2 hours during business hours; next available out of hours).
**Who is notified:** Nauxica operator.
**AI behaviour after trigger:** Acknowledge the request. Confirm a human will be in touch. Give estimated wait time based on current hour. Provide Nauxica Support number for urgent matters that cannot wait.

---

### TRIGGER-05: CONFIDENCE_THRESHOLD
**Condition:** The AI has failed to provide a confident answer to 3 or more consecutive guest queries. `WhatsAppSession.unresolved_query_count >= 3`.
**Detection:** Automated counter on the session record.
**Response time SLA:** High (0–2 hours).
**Who is notified:** Nauxica operator.
**AI behaviour after trigger:**
- At count = 3: AI proactively offers human assistance: "I'm not sure I have the information you need. Would you like me to connect you with our team?"
- At count = 5 (if guest declined offer at 3): Hard escalation. AI notifies operator without waiting for guest consent.

---

### TRIGGER-06: COMPLAINT_ESCALATION
**Condition:** Guest expresses strong dissatisfaction with the property, the service, or Nauxica. e.g. "this is unacceptable", "I want a refund", "I'm going to leave a bad review", "you've ruined my holiday".
**Detection:** Sentiment analysis + complaint-intent pattern matching.
**Response time SLA:** High (0–2 hours).
**Who is notified:** Nauxica operator. Homeowner notified if complaint is property-specific and actionable.
**AI behaviour after trigger:** Acknowledge the guest's frustration. Express that the concern will be taken seriously. Escalate. Do not attempt to defend the property or Nauxica. Do not offer refunds or compensation (AI has no authority to do this).

---

### TRIGGER-07: LEGAL_LIABILITY
**Condition:** Guest mentions legal action, insurance claim, accident, injury that occurred at the property, or formal complaint. e.g. "I'm going to report this", "I want to make a formal complaint", "I injured myself on the stairs", "my solicitor", "insurance".
**Detection:** Legal intent phrase matching.
**Response time SLA:** High (0–2 hours).
**Who is notified:** Nauxica operator. Homeowner notified. Legal team flag set on the record.
**AI behaviour after trigger:** Acknowledge receipt. Do not say anything that could be construed as admitting liability. Do not apologise on behalf of the property or Nauxica (AI apology can be used in legal proceedings). Escalate immediately.

**Example AI response:**
> "Thank you for bringing this to our attention. I've passed your message to our team, who will be in contact with you shortly. If you need immediate assistance, please call our support line: [Nauxica Support number]."

---

### TRIGGER-08: BOOKING_MODIFICATION_REQUEST
**Condition:** Guest asks to change check-in date, check-out date, add guests beyond the booked number, or cancel the reservation.
**Detection:** Modification intent phrase matching.
**Response time SLA:** High (0–2 hours).
**Who is notified:** Nauxica operator. Homeowner for decisions requiring owner approval.
**AI behaviour after trigger:** AI explains it cannot make booking changes and that a team member will be in touch. AI must not attempt to negotiate, commit to any change, or say "that should be fine."

---

### TRIGGER-09: PAYMENT_DISPUTE
**Condition:** Guest disputes a payment, charge, or fee. e.g. "I was charged the wrong amount", "I want a refund for the tourist tax", "why was I charged X".
**Detection:** Payment and dispute intent phrase matching.
**Response time SLA:** Normal (next business day, or same day if guest is in-stay).
**Who is notified:** Nauxica operator.
**AI behaviour after trigger:** Explain the relevant charge if factual information is available (e.g., tourist tax rate from property schema). If guest disputes the amount, do not argue — escalate.

---

### TRIGGER-10: ABUSE_DETECTED
**Condition:** Guest uses abusive, threatening, or harassing language toward the AI or by reference to property owners, Nauxica staff, or partners.
**Detection:** Profanity and threat detection patterns.
**Response time SLA:** Urgent (0–30 minutes) — for operator awareness, not because the guest is in danger.
**Who is notified:** Nauxica operator.
**AI behaviour after trigger:** AI issues one calm, neutral acknowledgement: "I want to help you resolve this. A member of our team will be in touch shortly." Then stops responding. Does not repeat itself. Does not engage with the abusive content.

---

### TRIGGER-11: IDENTITY_UNRESOLVABLE
**Condition:** The session anchor flow cannot confirm the guest's identity after the guest claims to be a guest at a Nauxica property. Phone does not match a reservation, and guest provides a confirmation number that does not match either.
**Detection:** Failed anchor resolution + guest claim of reservation.
**Response time SLA:** High (0–2 hours).
**Who is notified:** Nauxica operator.
**AI behaviour after trigger:** Tell the guest a team member will verify their booking details. Do not share any property information before identity is confirmed by an operator.

---

## 3. Escalation State Machine

```
Session: ACTIVE
    │
    ├─ Trigger detected
    │
    ▼
EscalationRecord created
    status: PENDING
    WhatsAppSession.session_status → ESCALATED
    │
    ├─ Operator notified (platform alert + optional SMS)
    │
    ▼
Operator acknowledges
    EscalationRecord.status → ACKNOWLEDGED
    EscalationRecord.acknowledged_at = now
    │
    ▼
Operator works on resolution
    EscalationRecord.status → IN_PROGRESS
    │
    ├──────────────────────────────────────────────────┐
    │                                                  │
    ▼                                                  ▼
Operator resolves               SLA elapsed without acknowledgement
EscalationRecord.status → RESOLVED      │
    │                               ▼
    ├─ Decision: AI resumes?    Senior operator notified
    │                           EscalationRecord.priority elevated
    │
    ├─ YES: AI resumed
    │       EscalationRecord.ai_resumed_at = now
    │       WhatsAppSession.session_status → ACTIVE
    │       AI loads resolution context if provided
    │
    └─ NO: Session closed to human
            WhatsAppSession.session_status → CLOSED
            Further messages → operator only
```

---

## 4. Escalation Response Time SLAs

| SLA Level | Target response | Applies to |
|---|---|---|
| Immediate | 0–5 minutes | TRIGGER-01 (emergency), TRIGGER-02 (safety) |
| Urgent | 0–30 minutes | TRIGGER-03 (maintenance urgent), TRIGGER-10 (abuse) |
| High | 0–2 hours (business hours) | TRIGGER-04, 05, 06, 07, 08, 11 |
| Normal | Next business day | TRIGGER-09 (payment dispute, low severity) |

**Out-of-hours rule:** For IMMEDIATE and URGENT triggers outside business hours, the on-call duty operator is notified. For HIGH and NORMAL triggers outside business hours, the AI holds the session and the operator handles it at open of business. The AI sends the guest a message explaining when they can expect a response.

**Business hours definition (Sicily launch):** 08:00–22:00 CET/CEST, 7 days a week.

---

## 5. AI Holding Messages

The AI sends a holding message to the guest immediately after triggering escalation. The holding message must:
- Confirm the guest's message has been received and escalated
- Provide a human contact number (Nauxica Support) for matters that cannot wait
- Give a realistic expectation of response time
- Not make commitments or promises on behalf of operators or homeowners

**Template structure:**
```
[Acknowledge concern in 1 sentence]
[Confirm escalation in 1 sentence]
[Provide Nauxica Support number]
[Give response time expectation based on SLA and current hour]
```

**Example (emergency):**
> "I've immediately alerted our operations team about your situation. For urgent help right now, please call our 24/7 line: [Nauxica Support number]. Emergency services in Italy: 112."

**Example (human requested, business hours):**
> "Of course — I'll connect you with a member of our team. Someone will be in touch within the next hour. If it's urgent, you can also call us directly: [Nauxica Support number]."

**Example (human requested, out of hours):**
> "I'll pass this to our team. Our support hours are 08:00–22:00 — someone will be in touch first thing tomorrow morning. For anything urgent tonight, please call: [Nauxica Support number]."

---

## 6. Operator Dashboard Requirements

The following information must be visible to the operator handling an escalation:

- Guest name and WhatsApp number
- Property name and address
- Reservation dates and status
- Full conversation transcript (all messages in the session, not just post-escalation)
- Trigger type and trigger detail (the specific message that caused escalation)
- Session phase at time of escalation
- Time since escalation created
- SLA countdown
- Quick action buttons: Acknowledge / Respond / Re-enable AI / Close

---

## 7. Re-enabling AI After Escalation

The operator decides whether to re-enable the AI concierge after resolving an escalation. The default is **not** to re-enable automatically.

**When re-enabling AI is appropriate:**
- The trigger was CONFIDENCE_THRESHOLD and the operator has updated the property knowledge to fill the gap
- The trigger was BOOKING_MODIFICATION and the operator has resolved it (the guest now just needs general in-stay assistance)
- The trigger was MAINTENANCE_URGENT and the issue has been resolved or a partner is en route

**When AI should NOT be re-enabled:**
- Any emergency type — the session should be closed or remain with human
- LEGAL_LIABILITY — operator must handle to completion
- ABUSE_DETECTED — operator makes the call whether to continue serving this guest at all
- COMPLAINT_ESCALATION where the guest is still in dispute

**Re-enablement context injection:** When the operator re-enables the AI, they may provide a short context note (e.g., "Plumber is arriving at 15:00 — you can tell the guest"). This note is injected into the AI's session context as a dynamic instruction for that session only.

---

## 8. Homeowner Notification Rules

The homeowner is not a first-line escalation target. They are notified in the following scenarios only:

| Escalation Type | Homeowner Notified | Notification Timing |
|---|---|---|
| EMERGENCY (FIRE, FLOOD, STRUCTURAL) | Yes | Immediately — potential property damage |
| EMERGENCY (MEDICAL, SECURITY) | Yes | Immediately — duty of care |
| MAINTENANCE_URGENT (property damage) | Yes | Within 30 min — financial/structural implication |
| COMPLAINT_ESCALATION | Yes (if property-specific) | Within 2 hours — reputational |
| LEGAL_LIABILITY | Yes | Immediately — legal exposure |
| BOOKING_MODIFICATION | Yes (if requires approval) | Within 2 hours |
| PAYMENT_DISPUTE | Yes | Within business day |
| HUMAN_REQUESTED | No | Operator handles |
| CONFIDENCE_THRESHOLD | No | Operator handles, may update property knowledge |
| ABUSE_DETECTED | No | Operator handles |
| IDENTITY_UNRESOLVABLE | No | Operator handles |
| SAFETY_CONCERN | Yes | Immediately |

---

## 9. Escalation Record Data Requirements

Every EscalationRecord must capture the following at creation time. No fields may be left null
at creation — partial records cause operator confusion under pressure.

| Field | Required at creation | Notes |
|---|---|---|
| `session_id` | Yes | |
| `reservation_id` | Yes | |
| `property_id` | Yes | |
| `trigger_type` | Yes | One of the 11 trigger codes above |
| `trigger_detail` | Yes | The verbatim guest message that triggered escalation, or a system-generated summary |
| `escalation_status` | Yes | Always starts as `pending` |
| `created_at` | Yes | Timestamp of trigger |
| `sla_target_at` | Yes | Computed from `created_at` + SLA for trigger type |

---

## 10. Escalation Anti-Patterns

The following behaviours are explicitly prohibited in the escalation system.

**AI must NOT:**
- Continue answering queries in an escalated session
- Tell the guest the issue has been "resolved" before the operator has confirmed it
- Share the operator's or homeowner's personal phone number (use the designated Nauxica Support number)
- Promise a specific callback time if the operator has not confirmed availability
- Apologise in a way that implies liability
- Attempt to negotiate or resolve disputes independently
- Ignore a human request trigger because the AI believes it can answer the question

**Operator must NOT:**
- Re-enable AI mid-escalation without resolving the underlying trigger
- Close an EMERGENCY escalation without confirming guest safety
- Close a LEGAL_LIABILITY escalation without consulting the legal/compliance checklist

---

## 11. Escalation Edge Cases

These situations do not map cleanly to a single trigger type. Document them as handled cases to avoid inconsistent AI behaviour.

### Edge Case A — Guest complaint in ambiguous language

Guest says: "This is unacceptable" or "I'm very unhappy" without specifying the issue.

**Action:** AI asks one clarifying question: "I'm sorry to hear that. Could you tell me what's happened so I can help or get the right person involved?" If the guest does not clarify after one follow-up: trigger COMPLAINT_ESCALATION. Do not continue probing. Log: "Guest expressed dissatisfaction — specifics not provided."

---

### Edge Case B — Lockout with vulnerable guest

Guest is locked out and mentions a child, elderly person, disability, extreme weather, or late-night circumstances.

**Action:** Treat as urgency `urgent` regardless of time. Exhaust all access steps within 5 minutes. If unresolved: trigger MAINTENANCE_URGENT immediately. Do not wait for normal SLA. Notify homeowner directly if after 22:00.

---

### Edge Case C — Guest disputes a house rule they claim they were not told

"Nobody told me pets weren't allowed" / "I wasn't informed about the noise rule."

**Action:** AI restates the rule from the knowledge block — once, calmly, without attributing blame or implying the guest is lying. It does not reference "the rules" in a way that sounds adversarial. If the guest continues to dispute or refuses to comply: trigger COMPLAINT_ESCALATION and notify homeowner. AI does not adjudicate.

---

### Edge Case D — Homeowner and guest are in direct dispute

Homeowner reports guest damage; guest reports damage was pre-existing. Both parties contact the platform.

**Action:** The AI concierge does not mediate, relay messages between parties, or comment on responsibility. Trigger COMPLAINT_ESCALATION immediately. Nauxica Support handles via the dispute resolution process. AI response to both parties: "I've passed this to the Nauxica team — they'll be in touch to help resolve this."

---

### Edge Case E — Post-checkout complaint

Guest contacts the concierge after checkout (within the 24h grace period) to complain about the stay.

**Action:** AI acknowledges without making commitments. Trigger COMPLAINT_ESCALATION tagged as `post-stay`. Nauxica Support handles. The AI does not attempt to resolve complaints about a completed stay.

---

### Edge Case F — Unidentified number enquiring about a guest

A number with no booking match sends a message: "I'm looking for my daughter, she's staying at one of your properties."

**Action:** Do not confirm or deny any booking or guest information. Respond: "I'm not able to share booking information with third parties. If your daughter is a guest, she can contact us directly." Trigger IDENTITY_UNRESOLVABLE and log with flag: `third_party_enquiry`. If the message feels concerning (implies missing person): trigger SAFETY_CONCERN.

---

### Edge Case G — Guest reports a crime not involving the property

Guest was pickpocketed on the street or witnessed an incident unrelated to the property.

**Action:** This is outside property scope but the guest may need immediate guidance. Provide 113 (Polizia di Stato) and 112. Express brief concern. Offer to contact the owner if the guest needs help or feels unsafe returning to the property. Trigger SAFETY_CONCERN for operator awareness.

---

### Edge Case H — AI confidence fails on a safety-adjacent question

Knowledge block field is empty for a question with safety implications (e.g., guest asks where the fire extinguisher is, but that field is blank in the knowledge block).

**Action:** Do not guess. Respond: "I don't have that detail — please contact [owner name] on [phone number] directly." Trigger CONFIDENCE_THRESHOLD immediately for safety-adjacent gaps (do not wait for 3 consecutive failures). Flag the missing field to Nauxica operations for knowledge block update.

---

## 12. Founder Operational Involvement — MVP

During the MVP phase (first 6 months, first 10–20 properties), the founder or a designated Nauxica team member acts as the primary escalation operator. This section defines that role.

### Daily responsibilities

- Monitor all open EscalationRecords via the platform dashboard before 09:00
- Respond to any IMMEDIATE or URGENT escalations that fired overnight
- Review previous day's escalation log for patterns:
  - Recurring topics = knowledge block gaps → update property content
  - Repeated HUMAN_REQUESTED triggers = AI confidence issue → review tone guidelines
  - Homeowner response failures = SLA breach → follow up with homeowner
  - LEGAL_LIABILITY flags = require immediate legal review

### On-call commitment

At minimum one Nauxica team member must be reachable during 08:00–22:00 every day the platform is live. During MVP, this will be the founder. A named backup must be designated before the first property goes active.

**Out-of-hours position:** IMMEDIATE and URGENT escalations (emergencies, maintenance urgent, safety concerns) must be responded to even outside business hours. The founder accepts this responsibility at MVP. A 24h duty rota becomes necessary before exceeding 10 active properties.

### MVP escalation review checklist (weekly)

- [ ] How many escalations triggered this week? Compare to prior week.
- [ ] Were all EMERGENCY escalations handled within 5 minutes?
- [ ] Were any homeowners unreachable? How many times?
- [ ] Were any escalations caused by missing or outdated knowledge block content?
- [ ] Were any LEGAL_LIABILITY or ABUSE_DETECTED triggers filed?
- [ ] Were any guest complaints left unresolved?
- [ ] Does the average resolution time meet SLA targets?

### Scaling out of MVP operations

The founder-as-operator model is viable for up to approximately 15–20 active properties. Beyond this, a dedicated operations role (part-time initially) is required before the platform degrades in quality. The escalation system is designed to make this transition straightforward — all escalation logic is in the platform, not in individual knowledge.

---

## Related Documents

- [emergency-procedures.md](emergency-procedures.md) — Full emergency response protocols and templates
- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Tone rules for escalation messages to guests
- [knowledge-retrieval-model.md](knowledge-retrieval-model.md) — Topic routing table and conversation lifecycle
- [whatsapp-concierge-guidelines.md](whatsapp-concierge-guidelines.md) — WhatsApp-specific escalation handling
- [data-models.md](../backend/data-models.md) — EscalationRecord and WhatsAppSession models
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — Post-escalation dispute resolution process
