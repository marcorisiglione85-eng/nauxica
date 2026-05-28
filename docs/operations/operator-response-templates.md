# Operator Response Templates

**Version:** 1.0
**Status:** Complete — Operational
**Scope:** Sicily launch · Nauxica operator team (MVP: founder)
**Last updated:** 2026-05-28
**Audience:** Nauxica operators handling escalations, incidents, and stakeholder communication
**Related:** [operator-runbook.md](operator-runbook.md) · [escalation-rules.md](../ai-concierge/escalation-rules.md) · [emergency-procedures.md](../ai-concierge/emergency-procedures.md) · [ai-tone-guidelines.md](../ai-concierge/ai-tone-guidelines.md) · [dispute-resolution.md](../trust-safety/dispute-resolution.md)

---

## Purpose and Usage

This document provides ready-to-use response templates for the most common operational situations requiring human operator intervention. Templates are written to work across the three primary communication channels used at MVP:

- **WhatsApp** (guest-facing) — conversational, brief, hospitality-appropriate
- **In-platform messaging** (homeowner-facing, partner-facing) — slightly more formal, structured
- **Email** (legal, dispute, or formal escalation contexts) — professional, factual

**Tone alignment:** All templates follow the principles in `ai-tone-guidelines.md`. Key rules for operator responses:
- Warm but not performative — do not over-apologise
- Direct and specific — state what is happening and what comes next
- No legal admissions — do not use language that assigns fault or implies liability
- No compensation promises — no "we'll refund" or "we'll compensate" without going through the dispute process
- Honest about timelines — only state a response time you can actually meet

**Multilingual note:** Templates are written in English. When communicating with Italian guests, homeowners, or partners, translate the substance — do not translate word-for-word. Italian hospitality communication is warmer and slightly more formal than the English templates suggest. See `ai-tone-guidelines.md` for Italian-specific guidance.

---

## Template Index

| # | Situation | Channel | Trigger |
|---|---|---|---|
| ORT-01 | Failed check-in / access issue | WhatsApp | Guest cannot enter property |
| ORT-02 | Stale or invalid access code | WhatsApp + in-platform | Access code not working |
| ORT-03 | Guest complaint acknowledgement | WhatsApp | Guest raises a problem |
| ORT-04 | Emergency acknowledgement | WhatsApp | Safety emergency escalation |
| ORT-05 | Partner no-show | In-platform (homeowner) | Partner did not arrive |
| ORT-06 | Homeowner non-response | In-platform / WhatsApp | Homeowner unreachable during escalation |
| ORT-07 | Refund escalation acknowledgement | In-platform / Email | Guest or homeowner requests refund |
| ORT-08 | Dispute intake | Email | Dispute formally registered |
| ORT-09 | Safety escalation (non-emergency) | WhatsApp + in-platform | Safety concern raised, not life-threatening |
| ORT-10 | AI fallback acknowledgement | WhatsApp | AI could not answer; operator following up |

---

## ORT-01 — Failed Check-In / Access Issue

**Trigger:** Guest cannot access the property. AI concierge has already attempted standard resolution steps.
**Channel:** WhatsApp (operator takes over conversation from AI concierge)
**Urgency:** HIGH to CRITICAL depending on time of day

**Template A — Operator takes over, resolution in progress:**

> Hi [Name] — I'm [Operator name] from Nauxica. I can see you're having trouble getting in. I'm on this now.
>
> Can you confirm: are you at [property address / building entrance]? And have you tried [specific step — e.g. pressing and holding the # button / trying the code twice]?
>
> I'm reaching the homeowner at the same time. I'll update you within [5/10] minutes.

**Template B — Access code confirmed correct but not working (operator resolves with homeowner):**

> [Name], I've spoken to the homeowner. [Brief resolution — e.g. "The key box is on the left side of the gate, not the right — the instructions will be updated." / "The homeowner is heading to the property now."]
>
> Next step: [specific instruction].
>
> I'll stay on this until you're inside. Message me if anything changes.

**Template C — Access cannot be resolved remotely (after 22:00 or if homeowner unreachable):**

> [Name], I haven't been able to reach the homeowner so far. Here's what I'm doing:
>
> I'm continuing to try to reach them and will call you directly on [guest phone number] if I find a solution in the next 15 minutes.
>
> In the meantime — is there somewhere comfortable nearby you can wait? If the situation doesn't resolve within [time], I'll arrange [alternative — hotel, alternative accommodation]. I'll keep you updated every 15 minutes.

**Operator notes:**
- Do not leave a guest waiting without an update for more than 15 minutes after taking over.
- If after 22:00 and unresolved after 30 minutes: trigger CRITICAL escalation internally.
- Document every action in the EscalationRecord.

---

## ORT-02 — Stale or Invalid Access Code

**Trigger:** Access code has changed since the property knowledge block was last updated, or the code was entered incorrectly in the knowledge base.
**Channel:** WhatsApp (guest), in-platform (homeowner)
**Urgency:** HIGH

**To guest (WhatsApp):**

> Hi [Name] — I'm [Operator name] from Nauxica. I've flagged this to the homeowner and I'm getting the correct code now. I'll have an update for you in the next few minutes. Please stay near the entrance.

**To homeowner (in-platform):**

> Hi [Name] — a guest at [property name] is reporting that the access code isn't working. Can you confirm the current code and send it to me now? I'll pass it directly to the guest. Once resolved, please update the property knowledge base so this doesn't happen again.

**Follow-up to guest (once code confirmed):**

> Hi [Name] — the updated code is [CODE]. [Repeat any relevant entry instruction — e.g. "Enter the code and press the green button."]
>
> You should now be inside. Let me know if you have any other questions.

**Operator notes:**
- Do not share a new access code with the guest until the homeowner has confirmed it is current.
- After resolution: create a Task for the homeowner to update the property knowledge block.
- Log the stale code incident in the property's record.

---

## ORT-03 — Guest Complaint Acknowledgement

**Trigger:** Guest has raised a complaint that the AI concierge has escalated (TRIGGER-06) or that has been flagged by the homeowner.
**Channel:** WhatsApp
**Urgency:** NORMAL to HIGH

**Template A — Acknowledging without resolution yet:**

> Hi [Name] — I'm [Operator name] from Nauxica. I've seen your message and I understand this isn't the experience you were expecting.
>
> I'm looking into this now and I'll come back to you with a clear answer by [specific time — e.g. 14:00 today / within 2 hours]. I won't leave you without a response.
>
> In the meantime, if anything else comes up, reply here and I'll see it immediately.

**Template B — After investigation, providing a resolution:**

> Hi [Name] — thank you for your patience. Here's what I've found and what's happening next:
>
> [State what happened factually, without blame.]
>
> [State what is being done: e.g. "A maintenance visit has been arranged for tomorrow morning between 10:00 and 12:00." / "The homeowner has confirmed [specific resolution]."]
>
> Is there anything else I can help with before or after that?

**Operator notes:**
- Do not minimise or dismiss the complaint in any message.
- Do not say "I understand this is frustrating" (performative empathy).
- Do not offer a refund or compensation — direct to the dispute process if it reaches that point.
- Do not share internal information about the homeowner or partner.

---

## ORT-04 — Emergency Acknowledgement

**Trigger:** Safety emergency escalated from AI concierge (TRIGGER-01) or reported directly.
**Channel:** WhatsApp
**Urgency:** CRITICAL — respond within 5 minutes

**Template A — First response (sent within 2 minutes of receiving escalation):**

> Hi [Name] — I'm [Operator name] from Nauxica. I'm here.
>
> If this is a life-threatening emergency — fire, medical, gas leak — please call 112 now if you haven't already.
>
> Tell me: what is happening and where are you right now?

**Template B — After confirming situation and emergency services are involved:**

> [Name], I'm with you on this. Emergency services [are on their way / have been called].
>
> [If homeowner or relevant contact needs to be involved: "I'm also reaching the homeowner now."]
>
> Stay with me — reply or call [operator number] directly if anything changes.

**Template C — After situation stabilises:**

> [Name], I'm glad you're [safe / the situation has stabilised].
>
> I'll follow up with you in [timeframe] to make sure you have everything you need. If you need anything in the meantime, message here.

**Operator notes:**
- Emergency services first — do not delay this for any reason.
- Call the guest directly if the WhatsApp response window has closed.
- After the incident: complete the 72-hour post-emergency checklist in `emergency-procedures.md`.
- Log in EscalationRecord: time of first notification, time of operator acknowledgement, emergency services contacted, resolution summary.

---

## ORT-05 — Partner No-Show

**Trigger:** Partner did not arrive for a confirmed job. Homeowner has flagged or the system has detected a missed service window.
**Channel:** In-platform messaging (to homeowner); internal action to find replacement
**Urgency:** HIGH (escalates to CRITICAL if checkout is imminent)

**To homeowner (in-platform):**

> Hi [Name] — I've seen that [Partner name] hasn't arrived for the [service type] at [property name]. I'm following up with them now to find out what's happened.
>
> In parallel, I'm looking for an available partner who can cover this. I'll update you within [30/60] minutes with either a confirmed replacement or a status from [Partner name].
>
> Is the checkout time still [time]? That helps me know how much urgency I'm working with.

**Follow-up once replacement confirmed:**

> Hi [Name] — I've confirmed [Replacement partner name] will arrive at [time]. They've been briefed on the property.
>
> I'll also be following up with [original partner] separately. The no-show will be noted on their record.

**Follow-up if no replacement found in time:**

> Hi [Name] — I haven't been able to confirm a same-day replacement in time for the checkout window. Here's what I'd suggest: [specific option — e.g. "Could you or someone on site do a basic tidy? I'll arrange a full clean for tomorrow morning at [time]." / "I've reached out to two more partners and expect a response within the hour."]
>
> I'll keep trying and won't stop until this is resolved.

**Operator notes:**
- Open a ServiceRequest for the job immediately — do not wait for the homeowner to create one.
- Log a D-06 dispute indicator against the partner if no-show is confirmed (not just late).
- Do not promise the homeowner that the partner will be penalised — the process handles that.

---

## ORT-06 — Homeowner Non-Response

**Trigger:** Operator or AI concierge cannot reach the homeowner during an active escalation requiring their input.
**Channel:** In-platform → WhatsApp → phone (in that order)
**Urgency:** Depends on the underlying situation — document the urgency level

**Template A — First contact attempt (in-platform):**

> Hi [Name] — there's an active situation at [property name] that needs your input. [One sentence describing the situation — e.g. "A guest is reporting an access issue." / "The scheduled cleaner hasn't arrived."]
>
> Please reply here or call [operator number] as soon as you see this. I need to hear from you within [30 minutes / 2 hours] to resolve this.

**Template B — Second attempt (WhatsApp or SMS, sent if no response after 20 minutes):**

> [Name], this is [Operator name] from Nauxica. I sent a message via the platform about [property name]. Please reply or call [number] — I need to speak with you about [brief issue]. Thank you.

**Template C — After the situation resolves without homeowner response:**

> Hi [Name] — I tried to reach you [X times] today regarding [brief situation description]. I resolved it by [what was done]. No action needed from you now, but please check your platform notifications and ensure your contact details are current.
>
> If a situation like this recurs and you're unreachable, it may affect how quickly we can protect your guests and property.

**Operator notes:**
- Three unreachable events in 30 days: flag for homeowner account review.
- If an emergency is involved and the homeowner is unreachable: do not wait — take whatever protective action is available and document it.
- Never take financial decisions (refunds, compensation) on the homeowner's behalf without their authorisation.

---

## ORT-07 — Refund Escalation Acknowledgement

**Trigger:** A guest or homeowner has formally requested a refund or compensation. The AI concierge has escalated this correctly (TRIGGER-09 or TRIGGER-06).
**Channel:** In-platform or email
**Urgency:** NORMAL — handle within one business day

**To the requesting party (guest via homeowner, or homeowner directly):**

> Thank you for raising this. I've noted your request and I'm reviewing what happened.
>
> To make sure this is handled fairly, I'll need [specify what — e.g. "a brief summary from you of the issue and when it occurred" / "the relevant job records from the homeowner"].
>
> Once I have that, I'll come back to you within [2 business days] with a clear response.
>
> I want to be straightforward: I'm not in a position to confirm any refund or payment right now — that decision will follow a proper review. But you will get a substantive answer, not a form response.

**Operator notes:**
- Do not use "I understand your frustration" or similar phrases.
- Do not say "we're sorry" — this implies an admission that the situation was Nauxica's fault.
- Do not say "your request has been submitted" — tell them when they will hear back.
- If a refund is ultimately warranted: follow the dispute-resolution.md process.

---

## ORT-08 — Dispute Intake

**Trigger:** A formal dispute is being registered (any D-01 through D-10 type).
**Channel:** Email (primary), in-platform messaging
**Urgency:** NORMAL — acknowledge within 24 hours

**Email template:**

> Subject: Dispute reference [DISPUTE-REF] — [Brief description]
>
> Dear [Name],
>
> This confirms that I've received your dispute report dated [date]. Here is the reference for your records: [DISPUTE-REF].
>
> **What this means:**
> I'm collecting the relevant information from all parties involved. Once I have a complete picture, I'll facilitate a resolution conversation and provide a written recommendation.
>
> **Timeline:**
> I'll confirm the evidence collection phase is complete within 48 hours. You'll receive a substantive response — not a status update — within [5 business days / as appropriate for dispute type].
>
> **What I need from you:**
> [List any specific evidence requested — e.g. "photos of the condition of the property on departure," "a copy of the invoice you received," "dates and times of the incidents you've described."]
>
> Please send these to me by [date/time].
>
> [Operator name]
> Nauxica

**Operator notes:**
- Follow the full dispute lifecycle in `dispute-resolution.md`.
- Do not share evidence from one party with the other until the review stage.
- Do not make a resolution recommendation until you have heard from all relevant parties.

---

## ORT-09 — Safety Escalation (Non-Emergency)

**Trigger:** A safety concern has been raised that is not immediately life-threatening (TRIGGER-02). Examples: broken stair rail, faulty gas appliance, suspected mould, pool fence damage.
**Channel:** WhatsApp (guest) + in-platform (homeowner)
**Urgency:** HIGH — respond within 2 hours

**To guest (WhatsApp):**

> Hi [Name] — I've seen your message about [brief description — e.g. "the loose step on the staircase"]. Thank you for flagging this.
>
> [If the risk is immediate: "Please don't use [the stairs / the appliance] until this is assessed."]
>
> I'm notifying the homeowner now and will arrange for this to be looked at [as soon as possible / within 24 hours]. I'll confirm the arrangements with you by [specific time].

**To homeowner (in-platform):**

> Hi [Name] — a guest at [property name] has reported [brief description]. This needs your attention.
>
> [If urgent maintenance needed: "I'm creating a ServiceRequest for an urgent maintenance visit. Can you confirm the best partner to handle this?"]
>
> Please respond by [time]. If this isn't resolved promptly and a guest is harmed as a result, the consequences for you and the platform are serious.

**Operator notes:**
- Do not downplay safety concerns in any communication.
- Do not tell the guest you will "look into it" if you mean you will pass it to the homeowner — be honest about what the next step is.
- If the homeowner is non-responsive to a safety concern: escalate to CRITICAL and take protective action (contact partner directly, flag property for review).
- Log everything: time reported, time acted on, outcome.

---

## ORT-10 — AI Fallback Acknowledgement

**Trigger:** The AI concierge has issued a fallback response because it could not answer a guest question, and the operator is following up proactively.
**Channel:** WhatsApp
**Urgency:** NORMAL — within the guest's active session

**Template A — Operator proactively follows up on AI fallback:**

> Hi [Name] — I saw that the concierge wasn't able to fully answer your question about [topic]. I'm [Operator name] from Nauxica.
>
> [Provide the answer if you have it: "The answer is: [answer]."]
>
> [If you don't have it: "I'm checking with the homeowner and will come back to you by [time]. You won't wait long."]

**Template B — Operator contacts homeowner to fill knowledge gap:**

> Hi [Name] — a guest at [property name] asked about [topic] and the AI concierge didn't have the answer. Can you add this to the property knowledge base? The specific question was: "[guest question verbatim]."
>
> I've told the guest I'll follow up by [time].

**Template C — After answering, flagging the knowledge gap internally:**

> Note for knowledge base update: [property name] — missing answer on [topic]. Guest asked: "[verbatim question]." Correct answer: "[answer provided]." Homeowner notified to update.

**Operator notes:**
- Three or more AI fallbacks in a single stay: trigger a property knowledge block review (see `property-activation-checklist.md` — post-activation quality maintenance).
- The goal is to close the knowledge gap so the AI can handle this next time, not just to answer this guest.
- Be specific when telling the homeowner what to add — do not say "update the knowledge base," say "add instructions for [specific topic] in the [section name] section."

---

## Template Usage Guidelines

### What every response should include

- Who you are (name, Nauxica)
- What you know about the situation (brief — 1 sentence)
- What you are doing right now
- When the person will hear from you next (specific time, not "soon")

### What no response should include

- Admissions of fault ("we got this wrong", "this shouldn't have happened")
- Compensation commitments without dispute process ("we'll refund your stay")
- Vague timelines ("as soon as possible", "shortly")
- Corporate deflection ("I've escalated this to the relevant team")
- Performative sympathy ("I completely understand how frustrating this must be for you")

### Response time targets (operator-to-guest)

| Severity | First response target |
|---|---|
| CRITICAL | Within 5 minutes |
| URGENT | Within 30 minutes |
| HIGH | Within 2 hours |
| NORMAL | Within one business day |

If you cannot meet a response target, send a brief acknowledgement first: "I've seen this and I'm on it — I'll have a full response by [specific time]."

---

## Related Documents

- [operator-runbook.md](operator-runbook.md) — Day-to-day operational procedures
- [escalation-rules.md](../ai-concierge/escalation-rules.md) — Escalation trigger taxonomy and SLA definitions
- [emergency-procedures.md](../ai-concierge/emergency-procedures.md) — Emergency response rules and Italian emergency numbers
- [ai-tone-guidelines.md](../ai-concierge/ai-tone-guidelines.md) — Voice and tone principles that apply to operator responses
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — Formal dispute process referenced in ORT-07 and ORT-08
- [common-issue-playbooks.md](../help-center/common-issue-playbooks.md) — Troubleshooting guidance for common operational issues
