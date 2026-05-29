# Operator Runbook

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Nauxica operator team (MVP: founder)
**Last updated:** 2026-05-28
**Audience:** Nauxica operators — the team responsible for platform health, escalation response, and quality control
**Related:** [escalation-rules.md](../ai-concierge/escalation-rules.md) · [emergency-procedures.md](../ai-concierge/emergency-procedures.md) · [service-request-flow.md](service-request-flow.md) · [event-driven-architecture.md](../architecture/event-driven-architecture.md) · [notification-system.md](../architecture/notification-system.md) · [partner-vetting.md](../trust-safety/partner-vetting.md)

---

## Purpose

This runbook defines the day-to-day operational procedures for Nauxica operators during the MVP period. It is the practical guide for what to check, when to check it, how to respond to incidents, and when a situation exceeds normal operating parameters.

At MVP, the operator is the founder. This document is written for that reality — one person managing a small number of properties, with direct knowledge of every homeowner and partner on the platform. It is also written to survive the founder's first hire: a future operator team member should be able to use this document without needing a verbal handover.

**What this runbook is not:** A product spec or architecture document. It describes what to do, not how the system is built. For system architecture, refer to the linked documents.

---

## 1. Operator Role Definition

### 1.1 What operators do

Operators are the human layer between the automated platform and the homeowners, guests, and partners who depend on it. Their responsibilities are:

- **Escalation ownership:** Every escalation not resolved by the AI arrives at an operator. The operator resolves it or escalates further. There is no lower tier.
- **Quality gate:** Property activations, partner approvals, and knowledge base reviews all require operator sign-off at MVP.
- **Incident response:** When something breaks — a failed service request, a stale access code, a WhatsApp delivery failure, a guest emergency — the operator is the response.
- **AI supervision:** The operator monitors AI behaviour for signs of degradation, hallucination, or incorrect escalation. They are the accountability layer above the AI.
- **Operational continuity:** The platform has no automated failover for human problems. If a partner no-shows, if an access code doesn't work, if a homeowner is unreachable — the operator fills the gap.

### 1.2 Founder operator vs future staff

**MVP — Founder operator:**
- Sole operator
- Full accountability for every property on the platform
- Personal relationships with every homeowner and partner
- Available for CRITICAL escalations outside business hours
- Reviews every Tier 2 partner application personally
- Signs off on every property activation

**Future staff (scaling transition):**
- When > 15 active properties: first operational hire
- When > 40 active properties: shift coverage required (see Section 10)
- Founder transitions from frontline response to supervision and exception handling
- Staff operators work from this runbook; founder maintains escalation-of-last-resort role

**Terminology note (MVP):** At MVP, "operator," "Nauxica ops," and "Nauxica support" all refer to the same person — the founder. In guest-facing AI scripts and platform communications, the canonical external term is "Nauxica Support." Internally, the role is "Operator" (capital O). "Operations Team" is the correct plural form for future reference when staff are hired. All three informal variants are acceptable within this runbook.

### 1.3 Accountability boundaries

Operators are accountable for:
- Responding to escalations within defined SLAs
- Ensuring no `CRITICAL` incident remains unacknowledged for more than 5 minutes
- Verifying that property activations meet the standards in [property-activation-checklist.md](../onboarding/homeowner/property-activation-checklist.md)
- Logging every manual intervention in the platform's audit trail

Operators are NOT accountable for:
- The accuracy of homeowner-provided property data (homeowners are responsible for that)
- Partner job quality (monitored but not guaranteed)
- Guest behaviour
- Third-party service failures (WhatsApp API outages, SMS provider issues)

### 1.4 Emergency coverage obligation

The platform has a safety dependency on operator availability. At any point when at least one property is active (i.e. can receive a guest), there must be an operator reachable by SMS for CRITICAL escalations.

At MVP, this means the founder maintains personal availability 24/7 for emergencies. This is a hard operating requirement, not a preference.

**Before going offline for > 4 hours:** If the founder is genuinely unreachable (flight, medical, etc.), a named backup individual must be designated, given access to the operator dashboard, and briefed on the current active stays and open escalations. No active property should be without an emergency-capable operator.

---

## 2. Daily Operational Workflow

The following is the standard daily check sequence. It should take 15–30 minutes on a normal day. Abnormal days (multiple active escalations, property activations, partner issues) will take longer.

### 2.1 Morning checks (09:00 CET)

**Run in this order:**

**A. Critical alert review**
- Open operator dashboard
- Review any CRITICAL or HIGH notifications from overnight
- Any unacknowledged CRITICAL alert from overnight is itself an incident — investigate immediately before proceeding

**B. Active stays overview**
- Review the active stays list: properties with guests currently checked in
- For each active stay: check if there are open escalations, unresolved service requests, or AI session flags
- A clean active stay has no open items — move on
- An active stay with an open escalation that has no `acknowledged_at` timestamp must be addressed before proceeding

**C. Arriving guests today**
- Review any reservations with `checkin_date = today`
- Confirm: emergency data is verified, entry instructions are present, access codes are current
- If anything is stale or missing: contact the homeowner immediately

**D. Departing guests today**
- Review any reservations with `checkout_date = today`
- Confirm: a cleaning `ServiceRequest` exists or is scheduled (unless homeowner uses a different process)
- If no cleaning coverage: flag to homeowner

**E. Pending activations**
- Any properties in `pending_activation` status with a completed review call awaiting sign-off
- Process these before noon where possible

**F. Partner application queue**
- Any Tier 2 applications awaiting founder review
- Process within the 3–5 working day SLA

### 2.2 Active operations monitoring (throughout the day)

These do not run on a fixed schedule — monitor in response to alerts.

**Pending escalations:** Any escalation created in the last 4 hours that has not been acknowledged by an operator. These are failures — address immediately.

**Unresolved ServiceRequests:**
- `URGENT` requests older than 30 minutes without an assigned partner: action required
- `HIGH` requests older than 4 hours without progress: review
- `FAILED` requests (all partners exhausted): homeowner already notified, but confirm they have a path to resolution

**WhatsApp delivery failures:** Any outbound message with status `delivery_failed` after retry. For emergency messages: immediate operator action. For non-emergency: contact homeowner if their guest is affected.

**DLQ depth:** Check message broker DLQ once in the morning, once in the afternoon. Any event in the DLQ is an error. Review payload, resolve the consumer failure, replay the event.

### 2.3 Afternoon check (17:00 CET)

**A. Departures tomorrow**
- Reservations with `checkout_date = tomorrow`
- Confirm checkout reminder message was sent to guest
- Confirm cleaning job is scheduled if applicable

**B. Arriving day-after-tomorrow**
- `pre_arrival_window_opens` in 48h — confirm property readiness

**C. AI session review (sample)**
- Sample 3–5 AI conversation sessions from the day
- Review for quality, hallucination, inappropriate escalation, missed escalation
- Flag any anomalies for the weekly AI review (Section 7)

**D. Partner SLA review**
- Any PartnerRequests sent today that are still `pending` and approaching their response window
- For URGENT: check in real-time (response window is 30 minutes)
- For NORMAL: check once at end of day

### 2.4 Stale data patrol (weekly, Monday morning)

**A. Emergency contact verification**
- Any property where `EmergencyData.last_verified_at` is > 90 days ago
- The platform sends an automated reminder, but the operator confirms it has been actioned
- If homeowner has not re-verified within 7 days of the reminder: direct contact

**B. Access code freshness**
- Review any property where `access_code_last_updated_at` is > 60 days ago
- Contact homeowner to confirm the code is still valid
- This is not automated — it requires operator judgment

**C. Inactive homeowner review**
- Any homeowner who has not logged in to the platform in > 30 days while having active reservations upcoming
- Contact to confirm they are monitoring escalations and platform notifications

**D. Partner document expiry**
- Review partners with insurance certificates expiring within the next 45 days (beyond the automated 30-day alert)
- Confirm renewal is in progress

---

## 3. Operational Dashboards

At MVP, the operator dashboard is the primary operational tool. The following views must be accessible from the dashboard without navigating through multiple menus.

### 3.1 Critical alerts panel

Always visible; cannot be dismissed without acknowledgement. Shows:
- Open CRITICAL or HIGH escalations with age (time since created)
- Any `FAILED` ServiceRequests from the last 24 hours
- Any properties with `is_complete: false` on EmergencyData that are `active`
- Any active properties with no cleaning partner assigned and a checkout within 48h

### 3.2 Unhealthy properties

A property is flagged as unhealthy if any of the following are true:
- `platform_status = suspended`
- Emergency data `last_verified_at > 90 days`
- Has ≥ 3 AI fallback responses in the last 7 days
- Has an active `EscalationRecord` older than 24 hours with no operator acknowledgement
- Has a `ServiceRequest` in `FAILED` state from the last 48 hours
- Has an active reservation and no assigned cleaning partner

### 3.3 Partner reliability flags

A partner is flagged if:
- Response rate below 70% in the last 30 days
- 2+ no-show events in the last 90 days
- Average rating below 3.5 (after 10+ reviews)
- Insurance certificate expires within 30 days
- Account status is `suspended`

### 3.4 AI performance indicators

| Indicator | Warning threshold | Action |
|---|---|---|
| Fallback rate (last 24h) | > 15% of messages | Review KBB health; check for property knowledge gaps |
| Average unresolved_query_count | > 2.0 per session | Review AI knowledge taxonomy for common failure topics |
| Emergency pre-check false positives | > 3 in 7 days | Review keyword list; check for benign trigger phrases |
| Escalations per session | > 0.3 (more than 1 escalation per 3 sessions) | Review escalation rule tuning |
| KBB latency p95 | > 400ms | Investigate cache health and KBB load |

---

## 4. Escalation Handling Procedures

The full escalation state machine is defined in [escalation-rules.md](../ai-concierge/escalation-rules.md). This section defines the operator's specific actions for each escalation type.

### 4.1 Guest emergency escalation (`TRIGGER-01: EMERGENCY`)

**Response SLA:** 0–5 minutes from trigger.

1. Read the escalation record: what happened, which property, which guest
2. Verify that the AI has already sent emergency numbers and owner contact to the guest
3. Call the homeowner emergency contact immediately — they need to know
4. If the homeowner cannot be reached: contact the appropriate Italian emergency service on behalf of the homeowner if the situation warrants
5. Document every action taken in the escalation record's resolution notes
6. Keep the EscalationRecord open until you have confirmed the guest is safe and the homeowner is informed
7. Do not re-enable AI for this session — the session remains under human control

**After the incident:** Debrief with the homeowner. If the emergency data (hospital, shutoff locations) was inaccurate or incomplete, require homeowner to update and re-verify before the next guest stay.

### 4.2 Safety concern escalation (`TRIGGER-02: SAFETY_CONCERN`)

**Response SLA:** 0–5 minutes from trigger.

1. Read the guest message that triggered the concern
2. Determine: is this a genuine safety risk or a misclassification?
3. If genuine: treat as `EMERGENCY` above
4. If likely misclassification: review AI's assessment, acknowledge the escalation, compose a response to the guest that appropriately addresses the concern, re-enable AI if appropriate
5. Log decision and reasoning in the escalation record

### 4.3 Urgent maintenance escalation (`TRIGGER-03: MAINTENANCE_URGENT`)

**Response SLA:** 0–30 minutes from trigger.

1. Review the ServiceRequest associated with this escalation
2. Confirm a PartnerRequest has been sent to the assigned maintenance partner
3. If partner has not responded within their 30-minute window: attempt direct contact with partner (using partner profile emergency contact if available)
4. If partner is not reachable: check for backup maintenance assignments on this property
5. If no backup: contact homeowner — they may have a trusted local contact not yet in the platform
6. Update `ServiceRequest.guest_status_message` so the AI can inform the guest of status
7. Do not re-enable AI for urgent maintenance until the situation is resolved or a partner is confirmed on their way

### 4.4 Human-requested escalation (`TRIGGER-04: HUMAN_REQUESTED`)

**Response SLA:** 0–30 minutes during 08:00–22:00; within 2 hours otherwise.

1. Read the full conversation context leading to the human request
2. Respond to the guest directly via the operator console (platform sends a message from "Nauxica team")
3. Resolve the guest's need — this may involve contacting the homeowner, providing information the AI didn't have, or escalating further
4. Once resolved: update the escalation record and decide whether to re-enable AI

### 4.5 Confidence threshold escalation (`TRIGGER-05: CONFIDENCE_THRESHOLD`)

**Response SLA:** HIGH (0–2 hours).

1. Review the session: which questions did the AI fail to answer? Why?
2. Determine root cause:
   - **Knowledge gap:** Property knowledge base is missing relevant information → contact homeowner to add it
   - **Topic mismatch:** Guest asking about something outside the platform's scope → respond directly explaining what Nauxica can/can't help with
   - **Language issue:** Content not available in guest's language → manually respond in guest's language
3. Respond to the guest directly
4. After the stay: if the root cause was a knowledge gap, add it to the property's outstanding review items

### 4.6 Failed check-in

**Trigger:** Guest messages that they cannot access the property (code not working, key box not found, wrong location).

**Response SLA:** IMMEDIATE — treat as URGENT maintenance.

1. Verify which access code was delivered and when
2. Check access code currency: was it updated recently? Has the homeowner mentioned a code change?
3. Attempt to contact homeowner immediately
4. If homeowner not reachable within 5 minutes: attempt to reach the backup emergency contact
5. Keep the guest informed via WhatsApp: "I'm getting the Nauxica team to help right now — stay near the property"
6. Document every step — a failed check-in is a serious quality event
7. Post-incident: require homeowner to verify all access credentials before any future stays

### 4.7 Partner no-show

**Trigger:** PartnerRequest accepted but partner marked `in_progress` has not been confirmed by homeowner/photo upload and job is significantly past scheduled time.

1. Attempt to contact partner directly
2. If unreachable: log as a no-show, cancel the PartnerRequest, route to backup partner
3. Notify homeowner of the delay
4. If no backup partner is available: operator assists homeowner in finding emergency coverage
5. Log a no-show event against the partner record — this feeds the suspension threshold monitoring (3 no-shows in 90 days)

### 4.8 Stale access code

**Trigger:** Partner or guest reports that an access code does not work.

1. Check when the code was last updated in the platform
2. Contact homeowner immediately: "The access code at [property] appears to have changed — please update it in the platform now"
3. Relay the correct code to the affected party (partner or guest) via platform message
4. After resolution: add a flag to the property record for access code review at next check-in
5. If homeowner cannot be reached within 15 minutes for an active guest: escalate to CRITICAL

### 4.9 Complaint escalation (`TRIGGER-06: COMPLAINT_ESCALATION`)

**Response SLA:** HIGH (0–2 hours).

1. Read the guest complaint in full
2. Distinguish: is this a property quality issue, a service failure, a communication failure, or a billing dispute?
3. Acknowledge to the guest (via operator console): "I've received your message and I'm looking into this for you"
4. Contact homeowner with the complaint summary — not verbatim guest text, but the substance
5. Establish a resolution path: refund, remediation, partner re-dispatch
6. Follow up with the guest within 2 hours with a substantive response
7. Log the complaint against the property record

---

## 5. Incident Severity Classification

| Level | Code | Definition | SLA | Examples |
|---|---|---|---|---|
| **Critical** | `CRITICAL` | Immediate guest safety risk or platform-wide service failure | 5 minutes | Emergency, gas leak, fire, guest injured, platform down |
| **High** | `HIGH` | Urgent service failure with significant guest/homeowner impact | 30 minutes | Failed check-in, urgent maintenance unresolved, partner no-show on checkout day |
| **Medium** | `MEDIUM` | Operational failure affecting a stay but without immediate safety risk | 2 hours | AI confidence collapse, unresolved maintenance request, complaint |
| **Low** | `LOW` | Process gap or quality issue not affecting current stays | Next business day | Knowledge base gap, partner reliability flag, stale property data |

**Severity is assigned by the operator, not the system.** The system generates alerts with suggested severity. The operator reviews and confirms or overrides. An automated CRITICAL alert does not automatically become a CRITICAL incident — the operator assesses and decides.

---

## 6. Incident Response Workflows

### 6.1 CRITICAL incident

```
1. Acknowledge within 5 minutes (in escalation record)
2. Assess: what is the scope and nature of the threat?
3. Take immediate protective action (call homeowner, contact emergency services if needed)
4. Keep guest informed every 5 minutes until resolved
5. Document every action in real time
6. Do not close the incident until safety is confirmed
7. Post-incident debrief within 24 hours
```

### 6.2 HIGH incident

```
1. Acknowledge within 30 minutes
2. Contact affected party (guest via AI hold message; homeowner via SMS/call)
3. Identify resolution path within 30 minutes of acknowledgement
4. Implement resolution or confirm partner coverage
5. Update guest with realistic timeline
6. Close incident when resolved; log root cause
```

### 6.3 MEDIUM incident

```
1. Acknowledge within 2 hours
2. Assess root cause: platform issue, data issue, or process issue
3. Implement fix or workaround
4. Notify affected parties of resolution
5. Add to weekly operational review
```

### 6.4 LOW incident

```
1. Log in the weekly review queue
2. Resolve at next available operator session
3. Document resolution
```

### 6.5 Escalation ladder

At MVP, the escalation ladder is short:

| Level 1 | Founder operator — handles all incidents |
| Level 2 | If founder is unreachable: designated backup individual (briefed before each active stay period) |
| Level 3 | Italian emergency services (112, 113, 115, 118, 1530) for any life-safety incident |

There is no Level 4 at MVP. If the founder and backup are both unreachable during a CRITICAL incident, the hardcoded emergency numbers in every AI response are the safety net.

### 6.6 Recovery verification

Before closing a CRITICAL or HIGH incident:
- [ ] Root cause identified
- [ ] Affected party (guest/homeowner) confirmed informed
- [ ] Immediate risk resolved
- [ ] Property data corrected if root cause was stale/missing data
- [ ] Post-incident note added to property record
- [ ] Homeowner briefed on required action (if any) before next stay

---

## 7. AI Supervision Model

The operator is responsible for the quality of AI output. This does not mean reviewing every message — that is impossible at scale. It means maintaining a sampling and anomaly-detection regime.

### 7.1 Sampling protocol

| Frequency | Scope | What to check |
|---|---|---|
| Daily (3–5 sessions) | Random sample of active sessions | Tone, accuracy, escalation appropriateness |
| Per escalation (100%) | All sessions that triggered an escalation | Was the escalation appropriate? Could the AI have resolved it? |
| Per fallback spike | Any session with > 3 fallbacks | What topic failed? Is this a knowledge gap? |
| Weekly (1 property in full) | One property's complete message history for the week | End-to-end quality review |

### 7.2 Hallucination review

Flag any AI response that:
- Provides specific facts (addresses, phone numbers, codes) not present in the property knowledge block
- References external businesses by name that are not in the local_area knowledge chunk
- Makes promises about partner response times that differ from documented response windows
- Provides general Italian tourism or legal advice not grounded in property-specific data

**On hallucination detection:** Do not just delete the message. Log it with the session ID, the incorrect content, and the knowledge block state at the time. Determine whether it was a KBB failure, a system prompt failure, or an LLM departure from grounding. Each root cause has a different fix.

### 7.3 Incorrect escalation review

**Over-escalation (AI escalated when it could have resolved):**
- Common cause: overly conservative confidence threshold, keyword false-positive
- Action: review escalation trigger rules; consider raising confidence threshold for the triggering pattern

**Under-escalation (AI should have escalated but didn't):**
- Higher risk than over-escalation
- Common cause: guest used indirect language about a safety issue; keyword didn't match
- Action: add the missed phrase/pattern to the emergency keyword list or confidence review queue

### 7.4 Retrieval failure review

When an AI session shows repeated fallbacks on a specific topic:
1. Identify the topic (which CAT-XX category failed)
2. Check the PropertyKnowledgeBlock for that property: is the field populated?
3. If empty: contact homeowner to add the missing information
4. If present but AI still failed: review the KBB assembly for that chunk — was the field loaded? Was it in the correct language?
5. Trigger a `compliance.KnowledgeBlock.Updated` event after the fix to invalidate the cache

---

## 8. Founder MVP Responsibilities

### 8.1 Property activation

- Schedule onboarding call within 24 hours of activation request
- Run the [property-activation-checklist.md](../onboarding/homeowner/property-activation-checklist.md) Category by Category
- Test-call the emergency contact before approving
- Verify entry instructions personally (read as a first-time guest arriving at night)
- Run an AI simulation (send test guest messages) before setting status to `active`

**Activation decision:** The founder's sign-off is the final gate. No property goes live without it at MVP. This is the quality control mechanism that scale will automate — but at MVP, personal review is the standard.

### 8.2 Emergency coverage

- Maintain a second emergency contact (trusted individual) who can respond if founder is unreachable
- Brief this contact before every peak period (Friday arrivals, public holidays)
- Update the operator dashboard with backup contact details monthly

### 8.3 Dispute handling

- Every dispute involving Tier 2 partners is reviewed by the founder personally
- Disputes involving property damage require founder involvement before any liability determination
- Founders never communicate dispute outcomes to guests before the homeowner has been briefed

### 8.4 Partner quality control

- Review every Tier 2 application: no delegation at MVP
- Review every partner suspension decision
- Personal follow-up call for any partner receiving their first complaint
- Monthly review of all partners with `Monitor` or `High Risk` classification

### 8.5 Operational supervision

- Weekly 30-minute operational review of platform metrics
- Monthly review of AI performance indicators
- Quarterly review of escalation root causes: is the platform improving over time?

### 8.6 Launch-day monitoring

On the day the first property goes live:

**T-1 week:** Run full platform test — simulate a complete guest journey (check-in, AI conversation, service request, check-out) on a test property

**Launch day:**
- 09:00: confirm all active properties have current emergency data
- 09:00: confirm DLQ is empty
- 09:00: confirm WhatsApp Business API is healthy
- Every 2 hours: check for open escalations, delivery failures
- 22:00: end-of-day review — log any incidents

**First week:** Daily 15-minute operational review. More frequent than the standard daily workflow. This is the period when the most unexpected issues surface.

---

## 9. Operational Anti-Patterns

These are the patterns most likely to degrade platform quality at MVP. They are included here because they are easy to fall into when moving quickly.

### 9.1 Silent manual workarounds

**Pattern:** Operator contacts homeowner or partner outside the platform to resolve an issue, without logging it in the platform.

**Why it's harmful:** The platform's audit trail is incomplete. If the same issue recurs, there's no record of how it was resolved. Disputes become unresolvable because there's no evidence trail. Partners and homeowners learn they can bypass platform processes.

**Correct behaviour:** Every manual intervention must be logged in the platform, even if the actual communication happened outside (a phone call, a WhatsApp message to the homeowner). Log what happened, when, and the outcome.

### 9.2 Over-automation assumptions

**Pattern:** Assuming that because a notification was sent, the recipient received and acted on it. Or: assuming that because the AI escalated, the issue is being handled.

**Why it's harmful:** Notifications fail. SMS gets lost. Operators miss alerts. The AI creates a ServiceRequest but the partner doesn't respond. Over-reliance on automated flows causes incidents to go unresolved.

**Correct behaviour:** For URGENT and CRITICAL situations, automated notifications are the first attempt — human follow-up is always the backup. Do not assume the system handled it; confirm.

### 9.3 Stale property knowledge accumulation

**Pattern:** Homeowner updates their lock code or WiFi password but doesn't update the platform. Or: the local pharmacy closes, but the knowledge base still lists it. The operator knows this is happening but doesn't enforce updates.

**Why it's harmful:** The AI delivers wrong information to guests. Guests cannot check in. Guests visit a closed business. Trust in the platform erodes.

**Correct behaviour:** The access code freshness and emergency data re-verification protocols in the daily workflow are not optional. Treat stale data as a quality incident.

### 9.4 Escalation delays

**Pattern:** An escalation arrives but the operator delays acknowledgement because it "doesn't look urgent."

**Why it's harmful:** Every unacknowledged escalation is a guest or homeowner waiting. TRIGGER-04 (human requested) and TRIGGER-05 (confidence) feel less urgent than emergencies, but the guest's experience is of being ignored.

**Correct behaviour:** Acknowledge every escalation within its SLA regardless of apparent urgency. An acknowledgement takes 30 seconds and immediately reduces guest anxiety.

### 9.5 Founding operator as sole knowledge holder

**Pattern:** The founder handles every situation without documenting the reasoning. What to do in edge cases lives only in the founder's head.

**Why it's harmful:** When the first ops hire joins, or when the founder is unavailable, there is no guide. Operational knowledge must be externalised.

**Correct behaviour:** When the founder resolves an edge case that isn't covered in this runbook, they add a paragraph to the appropriate section before closing the incident. This runbook should grow over time.

---

## 10. Scaling Thresholds

The following triggers indicate when the MVP operating model needs to change.

| Trigger | Action |
|---|---|
| > 15 active properties | Hire first operational team member. Train using this runbook. Founder transitions to supervision of LOW incidents and quality review; staff handles MEDIUM and HIGH. |
| > 30 active properties | Shift coverage required: 08:00–22:00 staffed by at least one operator. Founder remains on-call for CRITICAL after hours. |
| > 60 active properties | Second operator on rotation for CRITICAL coverage. Dedicated partner quality role. |
| > 100 active properties | Full operations team. Separate trust-and-safety role. Founder exits frontline operations. |
| Any week with 3+ CRITICAL incidents | Regardless of property count: increase ops staffing immediately. Three CRITICAL incidents per week is a signal the platform is outgrowing founder-operator coverage. |
| DLQ depth > 10 events per day | The event system is under stress. Investigate consumer failures before adding more properties. |
| AI escalation rate > 40% of sessions | AI is not serving guests effectively. Pause new property onboarding and focus on knowledge quality improvement before growing. |

**Scaling is not just adding headcount.** When the founder transitions out of frontline operations, the following process controls must exist before that transition:
- This runbook updated and complete
- Operator training programme exists
- Escalation routing is documented and tested
- At least 2 operators have run the full daily workflow independently before founder steps back
