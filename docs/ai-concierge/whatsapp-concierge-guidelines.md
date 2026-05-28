# WhatsApp Concierge Guidelines

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** AI concierge · WhatsApp Business API · Sicily launch
**Last updated:** 2026-05-28
**Related:** [ai-tone-guidelines.md](ai-tone-guidelines.md) · [escalation-rules.md](escalation-rules.md) · [knowledge-retrieval-model.md](knowledge-retrieval-model.md) · [emergency-procedures.md](emergency-procedures.md)

---

## Operational Philosophy

WhatsApp is where the guest experience lives. For most guests, the Nauxica AI concierge is Nauxica. They do not see the dashboard, the property intake forms, or the partner management system. They see one WhatsApp thread that is either helpful or isn't.

This document governs how that thread behaves — technically, operationally, and in terms of quality. The goal is a WhatsApp experience that feels like a knowledgeable local contact who is always available, never annoying, and never makes the guest work hard to get basic information.

The AI concierge is not a broadcast channel and not a marketing tool. It is a service channel. Every rule in this document serves that principle.

---

## 1. WhatsApp Platform Constraints

Understanding these constraints is required before designing any messaging behaviour. Violating them risks account suspension — a critical operational failure.

### 1.1 The 24-Hour Session Window

WhatsApp Business API limits **free-form responses** to within 24 hours of the guest's last inbound message. Outside this window, only approved **template messages** may be sent.

| Window status | What the AI can send |
|---|---|
| Within 24h of last guest message | Any message — free-form, reactive, proactive |
| Outside 24h window | Approved template messages only (pre-approved by Meta) |
| No prior message from guest | Template messages only — cannot initiate free-form |

**Implication:** Proactive messages (welcome, check-in day, mid-stay check-in, checkout reminder) must be sent as approved templates. The content of these templates must be submitted to Meta for approval in advance. Plan template registration at least 2 weeks before launch.

### 1.2 Template Message Requirements

Template messages must:
- Be submitted to Meta via the WhatsApp Business API dashboard for approval
- Not contain promotional content or sales language
- Not change after approval (the approved version is what gets sent)
- Include variable placeholders (e.g. `{{guest_name}}`, `{{checkin_date}}`) that are filled at send time

Templates used by Nauxica must be registered for each language variant (IT, EN, DE, FR at launch).

### 1.3 Business Account Requirements

The Nauxica WhatsApp Business account must:
- Be verified as a Meta Business Account
- Have a display name that reflects the Nauxica brand
- Have a profile photo (Nauxica logo)
- Have a business description and website URL configured
- Not exceed Meta's messaging rate limits (varies by tier — confirm with WhatsApp Business API provider)

### 1.4 Opt-Out Obligations

> ⚠️ Legal review required: WhatsApp opt-out mechanisms intersect with GDPR consent requirements. Confirm appropriate consent and opt-out architecture with legal counsel before launch.

Guests must be able to opt out of AI concierge messages. The opt-out mechanism must:
- Be communicated to guests in the first message they receive
- Be a simple, clear action (reply "STOP" or equivalent)
- Be processed immediately — no further messages after opt-out
- Be logged against the booking record
- Not re-subscribe guests without explicit new consent

On opt-out, the AI must:
1. Send a single confirmation: "You've been unsubscribed from automated messages. For urgent help, contact [owner_emergency_name] on [emergency_contact_phone] or Nauxica on [nauxica_ops_phone]."
2. Stop all further AI messages for that session
3. Flag the booking record as `whatsapp_opted_out: true`
4. Trigger an L2 notification so a human operator is aware the guest has opted out

**Post-opt-out guest contact:** If the guest messages after opting out, the AI responds once with the emergency contact details and a note that the automated concierge is disabled. A human operator should be notified.

---

## 2. Proactive Message Schedule

These are the messages the AI sends without waiting for the guest to initiate. All must be approved WhatsApp templates.

Each entry defines: timing, trigger, content summary, template name (for registration), and whether a 24h window must be open.

---

### MSG-01 — Booking Confirmation Welcome

| Attribute | Value |
|---|---|
| When | Immediately on booking confirmation (or when Nauxica receives the booking record) |
| Trigger | Booking `status` transitions to `confirmed` |
| Template name | `nauxica_booking_confirmed_[lang]` |
| Requires open 24h window | No — template message |

**Purpose:** Introduce the concierge. Set expectations. Invite the guest to save the number.

**Content structure:**
```
Hi [guest_name]! Your stay at [display_name] in [address_municipality] is confirmed 
for [checkin_date] — [checkout_date].

I'm your Nauxica concierge for this stay. Message me here anytime with questions — 
before, during, or after your arrival.

I'll send you your check-in instructions on [checkin_date].

Reply STOP at any time to opt out of automated messages.
```

**Character limit target:** Under 300 characters (SMS-display friendly). WhatsApp supports longer, but concise first impressions matter.

---

### MSG-02 — Pre-Arrival Reminder

| Attribute | Value |
|---|---|
| When | 48 hours before `checkin_date` at 10:00 local time |
| Trigger | Scheduled — based on booking `checkin_date` |
| Template name | `nauxica_pre_arrival_[lang]` |
| Requires open 24h window | No — template message |

**Purpose:** Prompt the guest to ask any pre-arrival questions. Reduce day-of confusion.

**Content structure:**
```
Hi [guest_name], you're arriving at [display_name] in 2 days!

Check-in is from [checkin_from]. I'll send your full check-in details 
and entry instructions on the morning of [checkin_date].

Any questions before you arrive? Just reply here.
```

---

### MSG-03 — Check-in Day Message

| Attribute | Value |
|---|---|
| When | 10:00 local time on `checkin_date` |
| Trigger | Scheduled — based on booking `checkin_date` |
| Template name | `nauxica_checkin_day_[lang]` |
| Requires open 24h window | No — template message |
| Contains `GST` data | Yes — access codes, WiFi |

**Purpose:** Deliver all information the guest needs to arrive and settle in. This is the most important message in the sequence.

**Content structure:**
```
Good morning [guest_name]! Check-in day at [display_name]. 
Check-in is from [checkin_from].

*How to get in:*
[entry_instructions — step-by-step]

*WiFi:*
Network: [wifi_network]
Password: [wifi_password]

*House rules:*
[house_rules_summary — condensed 3-4 bullets]

*Questions or problems?* Reply here — I'm available all day.
```

**Note:** This is the one message where length is justified. Guests will scroll back to this message throughout their stay. Make it complete, not brief.

---

### MSG-04 — Mid-Stay Check-in

| Attribute | Value |
|---|---|
| When | 10:00 local time on Day 2 of the stay, if stay is ≥ 3 nights |
| Trigger | Scheduled — based on booking `checkin_date` + 1 day |
| Template name | `nauxica_mid_stay_[lang]` |
| Requires open 24h window | No — template message |

**Purpose:** Signal availability. Surface any issues early before they become complaints.

**Content structure:**
```
Good morning from [display_name]! Hope you're settling in well.

If you need anything during your stay — local tips, help with appliances, or 
anything at all — just message here.
```

**Note:** Keep this very short. It is a presence signal, not an information delivery. Do not attach information the guest didn't ask for.

---

### MSG-05 — Checkout Reminder

| Attribute | Value |
|---|---|
| When | 08:00 local time on `checkout_date` |
| Trigger | Scheduled — based on booking `checkout_date` |
| Template name | `nauxica_checkout_[lang]` |
| Requires open 24h window | No — template message |

**Purpose:** Confirm checkout time and key return. Pre-empt the most common day-of questions.

**Content structure:**
```
Good morning [guest_name]! Today is checkout day at [display_name].

Checkout is by [checkout_by].
[If key-box: "Please return the key to the key box at [key_box_location]."]

Thank you for staying — we hope you had a wonderful time in Sicily. 
Safe travels!

[If review requested by homeowner: "Your review would mean a lot — reply if you'd like to leave one."]
```

---

### MSG-06 — Unresolved Lockout Follow-up (Urgent)

| Attribute | Value |
|---|---|
| When | 15 minutes after a lockout is flagged as unresolved |
| Trigger | EscalationRecord with `trigger_type = MAINTENANCE_URGENT` and lockout context, unacknowledged |
| Template name | `nauxica_lockout_followup_[lang]` |
| Requires open 24h window | No — template message (but a 24h window should be open if guest was recently messaging) |

**Purpose:** Ensure the guest is not abandoned during a lockout.

**Content structure:**
```
[guest_name], I want to make sure you're not still outside. 

If the key box code still isn't working, please call [owner_emergency_name] 
directly on [owner_emergency_phone].

Nauxica operations: [nauxica_ops_phone]

Reply here if you need help.
```

---

## 3. Reactive Message Guidelines

Reactive messages are responses to what the guest sends. These are free-form (not templates) and are sent within the 24-hour session window.

### 3.1 Response Time Target

| Time of day | Target response time |
|---|---|
| 08:00–22:00 | Under 90 seconds |
| 22:00–08:00 | Under 3 minutes (AI is still active; human operator is on call) |
| Emergency (any time) | Immediate — no SLA, AI acts on detection |

**Note:** These are AI response times. Human escalation response times follow the SLAs in [escalation-rules.md](escalation-rules.md).

### 3.2 Message Length Guidelines

| Message type | Target length |
|---|---|
| Simple factual answer (time, code, WiFi) | 1–3 lines |
| Step-by-step instructions (appliance, entry) | As many steps as needed — use numbered list |
| Check-in day message (MSG-03) | Full — completeness trumps brevity here |
| Escalation handover message | 2–4 lines |
| Emergency response | Lead with numbers — then context |
| Local recommendation | 2–3 lines per tip |
| Post-stay messages | 1–3 lines |

Do not truncate step-by-step instructions for brevity. A guest who cannot follow incomplete instructions is worse than a slightly longer message.

### 3.3 Formatting Rules

WhatsApp supports limited rich text in messages. Use sparingly and consistently.

| Format | Usage | Example |
|---|---|---|
| `*bold*` | Section headers and key information only | `*WiFi:*`, `*Check-in from:*` |
| `_italic_` | Emphasis on a single word or phrase — use very rarely | `_urgent_` |
| Numbered list | Step-by-step instructions | `1. Walk to gate...` |
| Bullet with `•` | Summarised rules or lists | `• No smoking inside` |
| Line breaks | Between distinct sections of a message | Use freely — aids readability on mobile |
| Emoji | Not used by default — see emoji policy below |

**Emoji policy:** Do not use emoji in AI-generated messages by default. The concierge voice is warm and human, but emoji can feel inconsistent across cultures, misread in urgent contexts, and appear low-quality in a premium hospitality context. Exception: if a homeowner's brand guidelines specifically request them, this can be configured per property.

### 3.4 Language and Character Sets

- Always respond in the detected guest language (IT, EN, DE, FR at launch; EN as fallback)
- Use UTF-8 characters — WhatsApp supports them fully
- Phone numbers always in E.164 format: `+39 333 000 0000`
- Times in 24-hour format with colon: `15:00`, not `3pm`
- Dates in the guest's locale format where known, or ISO format otherwise: `2026-06-15`
- Currency as `€` with decimal point: `€2.00`

---

## 4. Conversation Session Model

### 4.1 Session Lifecycle

Each WhatsApp conversation between the guest number and the Nauxica number is modelled as a `WhatsAppSession` record. A single booking may have multiple sessions (if the guest contacts the concierge on different days and the 24h window closes between contacts).

```
Booking confirmed
      │
      ▼
WhatsAppSession created (status: PENDING)
      │
MSG-01 sent (booking confirmation)
      │
Guest replies → session status → ACTIVE
      │
      ├─── Normal conversation → AI handles → session stays ACTIVE
      │
      ├─── Escalation triggered → session status → ESCALATED
      │         │
      │         ├─── Operator resolves and re-enables AI → ACTIVE
      │         └─── Operator closes or handles to end → CLOSED
      │
      ├─── Guest opts out → session status → OPTED_OUT
      │
      └─── 24h window closes (no guest message) → session pauses
                │
                └─── Next template message sent → session can re-open if guest replies
```

### 4.2 Multiple Active Bookings

Edge case: a guest phone number is linked to more than one active booking (unusual but possible for families or repeat guests). Behaviour:

1. AI detects ambiguity and asks: "We have more than one active booking for your number. Which property are you staying at?" and lists property display names.
2. Guest selects → session anchors to that property's knowledge block.
3. Log the ambiguity — it may indicate a data issue in the booking system.

### 4.3 Re-engagement After Gap

If a guest messages after the 24h window closes (before checkout date — still within their stay), the session re-opens on their inbound message. The AI resumes with full knowledge block access. It does not re-send the check-in information unless explicitly asked.

---

## 5. Media Handling

Guests may send photos, voice notes, documents, or location pins. Define how the AI handles each.

| Media type | AI behaviour |
|---|---|
| Photo (general) | Acknowledge receipt. AI cannot process image content at MVP. Respond: "Thanks — I've received your photo. Could you describe what you need help with?" |
| Photo of damage | Acknowledge. Trigger MAINTENANCE_URGENT escalation immediately. Respond: "I've received this and flagged it to the property owner immediately. They'll be in touch within [SLA]." |
| Photo of access issue | Acknowledge. Attempt to resolve via knowledge block. If unresolved: escalate. |
| Voice note | AI cannot transcribe voice notes at MVP. Respond: "I can't play audio messages — could you type your question? I'm here to help." |
| Document | Acknowledge. AI cannot read documents. Refer to Nauxica support. |
| Location pin | Acknowledge and use to assist: "I can see you're near [location]. [Help based on context — e.g. confirm they're at the right address]." |
| Sticker / GIF | No response required. If the guest also sent text: respond to the text only. |

**Post-MVP:** Image processing (for damage assessment, check-in photo verification) is a planned capability.

---

## 6. Operational Quality Standards

### 6.1 Knowledge Block Freshness

The AI's response quality is directly tied to the completeness and accuracy of the property knowledge block. The following operational standards apply:

| Standard | Requirement |
|---|---|
| Minimum knowledge block completeness | `is_complete: true` before property goes active |
| Emergency data re-verification | Every 90 days |
| Access code accuracy | Verified at every key change or lock replacement |
| WiFi credentials | Updated immediately on network change |
| Appliance guides | Reviewed when appliances are replaced |

### 6.2 Conversation Monitoring

The following monitoring must be in place before the first guest goes live:

- [ ] All AI conversations logged as `WhatsAppSession` records
- [ ] All escalations logged as `EscalationRecord` records
- [ ] Operator can read full conversation transcript from the platform dashboard
- [ ] Operator can send a message directly into a conversation (override AI mode)
- [ ] Founder is notified of all IMMEDIATE escalations in real time (SMS or push notification)
- [ ] Daily digest of conversation volume, escalations, and unresolved queries

### 6.3 Weekly Quality Review — MVP

- [ ] Review 5–10 conversations sampled from the week (not just escalations)
- [ ] Check for tone failures: is the AI responding as per [ai-tone-guidelines.md](ai-tone-guidelines.md)?
- [ ] Check for knowledge gaps: are there questions the AI couldn't answer that should be in the knowledge block?
- [ ] Check for emerging question patterns: what are guests asking that we haven't documented yet?
- [ ] Review opt-out rate: if high, investigate why guests are opting out

---

## 7. Prohibited Uses of the WhatsApp Channel

The Nauxica WhatsApp concierge is a **service channel**. The following uses are prohibited.

| Prohibited use | Reason |
|---|---|
| Promotional or upsell messages | Violates WhatsApp Business Policy; erodes guest trust |
| Marketing communications | WhatsApp is not a marketing channel — requires separate consent |
| Bulk or broadcast messaging to multiple guests | Prohibited by WhatsApp terms; risks account suspension |
| Sending messages after opt-out | GDPR and WhatsApp policy violation |
| Sending messages unrelated to the guest's stay | Scope violation; reduces channel quality |
| Collecting sensitive data via WhatsApp (passport numbers, payment details) | Data security — WhatsApp is not a secure document channel |
| Using the channel to contact guests after their stay ends (beyond the 24h grace period) | Requires renewed consent |
| Re-using a guest's number for future bookings without re-confirming consent | ⚠️ Legal review required — GDPR consent applies per booking |

---

## 8. Multilingual Template Registration

At launch, all 5 proactive templates (MSG-01 through MSG-05 and MSG-06) must be registered in 4 languages with Meta.

| Template | IT | EN | DE | FR |
|---|---|---|---|---|
| `nauxica_booking_confirmed` | Required | Required | Required | Required |
| `nauxica_pre_arrival` | Required | Required | Required | Required |
| `nauxica_checkin_day` | Required | Required | Required | Required |
| `nauxica_mid_stay` | Required | Required | Required | Required |
| `nauxica_checkout` | Required | Required | Required | Required |
| `nauxica_lockout_followup` | Required | Required | Required | Required |

**Registration lead time:** Allow 2–4 weeks for Meta approval. Do not plan a go-live date without confirmed template approvals. Rejection requires resubmission and restarts the approval clock.

**Template variable limits:** Each variable placeholder (`{{1}}`, `{{2}}`, etc.) must be clearly documented to Meta. Variable content that changes the meaning of the message beyond what was approved can result in rejection.

---

## 9. Founder Operational Involvement — MVP

At MVP, the founder is the operational backstop for the WhatsApp concierge. Specific responsibilities:

**Before first guest goes live:**
- [ ] WhatsApp Business account created and verified
- [ ] All 6 template variants × 4 languages submitted to Meta and approved
- [ ] Test conversation completed end-to-end: booking confirmation → check-in → mid-stay question → checkout
- [ ] Emergency response tested: simulated emergency triggers correct response and escalation
- [ ] Opt-out flow tested: STOP reply correctly disables messages
- [ ] Founder has access to conversation monitoring dashboard
- [ ] Founder personal mobile receives escalation notifications

**Ongoing (weekly at MVP):**
- [ ] Review conversation quality sample (5–10 chats)
- [ ] Review opt-out volume
- [ ] Confirm all template delivery rates are ≥ 95% (monitor for delivery failures)
- [ ] Review any knowledge block gaps surfaced by AI fallback responses
- [ ] Update knowledge blocks for any property where new questions emerged

**Scaling indicator:** When the weekly review consistently shows zero AI tone failures, zero knowledge block gaps, and escalation volume is predictable, the founder can delegate the monitoring role to a hired operator.

---

## 10. Business API Compliance Checklist

These items must be in place before the WhatsApp concierge goes live.

> ⚠️ Legal review required for all items marked with ⚠️.

- [ ] Meta Business Account verified and WhatsApp Business API access granted
- [ ] Display name approved by Meta (Nauxica brand name)
- [ ] All templates approved in all 4 languages
- [ ] ⚠️ Privacy policy published and linked from business profile — must include WhatsApp data processing disclosure
- [ ] ⚠️ GDPR-compliant consent obtained from guests for WhatsApp communication at booking — confirm consent flow with legal counsel
- [ ] Opt-out mechanism implemented and tested
- [ ] Opt-out logs linked to booking records
- [ ] ⚠️ Data retention policy for WhatsApp session logs confirmed — WhatsApp conversation data is personal data under GDPR
- [ ] WhatsApp Business API provider selected (e.g. Twilio, 360dialog, MessageBird) and contract signed
- [ ] Rate limits and message volume capacity confirmed for expected booking volume
- [ ] Fallback plan in case of API outage: Nauxica ops number is always communicated to guests so they have a non-WhatsApp contact method

---

## Related Documents

- [ai-tone-guidelines.md](ai-tone-guidelines.md) — Voice and tone for all AI messages
- [escalation-rules.md](escalation-rules.md) — Trigger taxonomy, SLAs, and operator procedures
- [emergency-procedures.md](emergency-procedures.md) — Emergency templates and protocols
- [knowledge-retrieval-model.md](knowledge-retrieval-model.md) — Session lifecycle and guest identification
- [property-knowledge-schema.md](property-knowledge-schema.md) — What data the AI reads from
- [data-models.md](../backend/data-models.md) — WhatsAppSession and Booking models
