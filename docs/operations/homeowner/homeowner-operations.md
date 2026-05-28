# Homeowner Operations

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Active homeowners post-activation
**Last updated:** 2026-05-28
**Audience:** Homeowners managing active properties on the Nauxica platform
**Related:** [homeowner-onboarding.md](../../onboarding/homeowner/homeowner-onboarding.md) · [service-request-flow.md](../service-request-flow.md) · [escalation-rules.md](../../ai-concierge/escalation-rules.md) · [partner-assignment-model.md](../../architecture/partner-assignment-model.md) · [property-knowledge-schema.md](../../ai-concierge/property-knowledge-schema.md)

---

## Purpose

This document defines the ongoing operational responsibilities of a homeowner after their first property is activated. Onboarding ends at activation — operations begins the day the first guest arrives.

A homeowner's operational quality determines the quality of their guests' experience. The AI concierge can only perform as well as the data the homeowner provides. The platform can only protect the homeowner if the homeowner keeps their information current.

---

## 1. Booking Management

### 1.1 Adding a booking

Every guest stay must be entered as a reservation before the guest arrives. The AI concierge cannot serve a guest whose phone number has not been linked to a reservation.

**To add a booking:**
1. Go to **Bookings → Add booking**
2. Enter guest details:
   - Guest full name
   - Guest WhatsApp number (E.164 format — +39 followed by the mobile number, or international format for non-Italian guests)
   - Check-in date and checkout date
   - Guest count (total)
   - Adults / children breakdown (required for tourist tax calculation)
   - Guest nationality (required for Alloggiati Web)
   - Guest document type and number (required for Alloggiati Web)
   - Booking source (Airbnb, Booking.com, direct, etc.)
   - Any special requests or notes
3. Confirm and save

The AI concierge becomes active for this guest 48 hours before check-in.

### 1.2 WhatsApp number accuracy

**This is the single most important field in the booking.** The AI concierge identifies guests by their WhatsApp phone number. If the number is wrong:
- The AI cannot serve the guest
- The guest's messages go unrecognised
- The guest receives the unknown-guest response and must contact you directly

Confirm the number with the guest at booking time. Correct the format if needed (always E.164: +39... for Italian numbers).

### 1.3 Editing a booking

You can edit any field on a booking that has not yet checked out. Changes to `guest_phone` after the AI session has started require you to close the existing session and create a new one — contact the Nauxica team if you need to do this.

**Changes that require AI awareness:**
- Guest count change: the AI uses this for capacity checks
- Check-in or checkout date change: the AI session phase changes accordingly; the pre-arrival message schedule resets

### 1.4 Cancelling a booking

When you cancel a booking:
- All open ServiceRequests linked to the reservation are auto-cancelled
- Any active WhatsApp session is closed
- Alloggiati Web registration is not required for cancelled reservations

### 1.5 OTA calendar sync (Professional and Premium plans)

If you use OTA calendar sync, bookings from Airbnb, Booking.com, or other connected platforms are imported automatically. Imported bookings may be missing the guest WhatsApp number — this must be added manually before the 48-hour pre-arrival window opens.

**Audit imported bookings weekly** if you use sync. Look for: missing WhatsApp numbers, incorrect guest counts, date conflicts.

### 1.6 Alloggiati Web obligation

For properties with `alloggiati_web_required: true`: you must register all guests with the Polizia di Stato's Alloggiati Web system within 24 hours of arrival.

The platform reminds you at T-24 hours. The registration is your legal responsibility — the platform does not complete it on your behalf.

> ⚠️ **Legal note:** Failure to register guests via Alloggiati Web is a criminal offence under Italian law. The platform reminder is a courtesy. Do not rely solely on it.

---

## 2. Guest Communication Visibility

### 2.1 What you can see

You have read-only visibility into the AI concierge conversation for your property. From **Properties → [Property name] → Guest conversations**:
- Full message history for each reservation
- Which messages the AI sent and when
- Which messages triggered escalations
- ServiceRequests created during the conversation
- AI fallback events (topics the AI could not answer)

### 2.2 What you cannot do

- You cannot send messages to guests through the AI concierge channel
- You cannot edit AI responses that have already been sent
- You cannot access AI conversation logs for other homeowners' properties

### 2.3 When to review guest conversations

**Before checkout:** Review the conversation to check if any outstanding requests or unresolved issues need your attention before the guest leaves.

**After any escalation:** Read the full conversation context leading to the escalation.

**After a complaint:** The conversation history is evidence. Read it before speaking to the guest or the Nauxica team.

**Weekly (if active):** A brief scan of conversations helps you catch knowledge gaps, recurring questions, or issues the AI handles poorly.

---

## 3. AI Concierge Supervision

The AI concierge operates on your behalf. You cannot supervise every message, but you have specific responsibilities.

### 3.1 Responding to escalations

When the AI escalates a conversation to the Nauxica team, you are notified. You are expected to:

- **Be reachable** when an escalation involves your property — especially for EMERGENCY and MAINTENANCE_URGENT
- **Respond to the Nauxica team** within the SLA for your plan tier when they contact you
- **Take action** when an escalation requires your intervention (confirming an access code, authorising an emergency repair, speaking directly with a guest)

**SLA expectations by escalation type:**

| Escalation type | Your response expected by |
|---|---|
| EMERGENCY | Immediately — the Nauxica team calls you |
| MAINTENANCE_URGENT | Within 30 minutes of notification |
| COMPLAINT_ESCALATION | Within 2 hours |
| HUMAN_REQUESTED | Within 2 hours during 08:00–22:00 |
| All others | Within 4 hours |

If you are routinely unavailable within these windows, you are creating a reliability problem for your guests.

### 3.2 AI quality improvement loop

If the AI gives a guest incorrect or unhelpful information, the root cause is almost always one of:
- A missing field in the knowledge base
- An outdated field in the knowledge base
- An ambiguous instruction the AI misinterprets

When you spot this, update the relevant knowledge base field immediately. The AI uses the updated information for the next session.

### 3.3 Things the AI cannot do — your responsibility

The AI does not:
- Call the guest (WhatsApp text only)
- Collect tourist tax
- Register guests with Alloggiati Web
- Authorise emergency repairs
- Make binding commitments about refunds or compensation

These gaps are your responsibility to cover directly.

---

## 4. Property Updates

### 4.1 Keeping the knowledge base current

The knowledge base drives every AI response. Treat it as a live document.

**Update immediately when:**
- An access code changes (lock box, smart lock, WiFi)
- An emergency contact phone number changes
- A local business you recommended closes or changes
- House rules change
- Check-in or checkout times change
- Any appliance is replaced and has different instructions

**Update seasonally:**
- Local recommendations (summer vs winter operating hours)
- Seasonal house rules (pool use, heating instructions)
- Air conditioning vs heating guidance

**Update annually:**
- Tourist tax rate (your comune may change it)
- Confirm emergency contacts are still active
- Review all appliance guides for accuracy

### 4.2 How to update the knowledge base

1. Go to **Properties → [Property name] → Knowledge base**
2. Navigate to the relevant section
3. Edit the field and save
4. The AI uses the updated content within 10 minutes (standard cache TTL)
5. Emergency data changes take effect immediately (write-through cache)

### 4.3 Access code rotation

When you change an access code:
1. Update the platform immediately — before any guest needs it
2. The AI delivers the updated code to the next guest who asks
3. Partners with confirmed jobs using the old code must be re-notified manually — contact the Nauxica team if a job is in progress

**Critical:** A guest who has already received an access code is not automatically re-notified when you change it. If you rotate a code during a stay, inform the guest directly.

### 4.4 Stale data risks

| Stale field | Risk |
|---|---|
| WiFi password | Guest cannot connect; AI delivers wrong password |
| Lockbox code | Guest cannot enter property |
| Emergency contact phone | Escalations go unanswered |
| Local recommendations | Guest visits a closed business |
| Appliance guides | Unnecessary escalation created |
| Tourist tax rate | Guest receives wrong information; you are legally exposed |

---

## 5. DynamicInstruction Management

`DynamicInstruction` records allow you to temporarily override specific AI concierge fields with time-bounded instructions.

**Use cases:**
- "The washing machine is out of service from [date] to [date]"
- "The pool is closed for maintenance from [date] to [date]"
- "Use the rear entrance until [date] — the main entrance is being repainted"

**How to create a DynamicInstruction:**
1. Go to **Properties → [Property name] → Dynamic instructions → Add instruction**
2. Select the target field to override
3. Write the override text
4. Set `active_from` and `active_until`
5. Save

The AI uses the override text during the active window. When `active_until` passes, the base content restores automatically.

**Limit:** DynamicInstructions are for genuinely time-bounded exceptions. If a change is permanent, update the base knowledge base field directly.

---

## 6. Partner Assignment Management

### 6.1 Managing your preferred partners

Review partner assignments at least twice a year and after any quality issue.

**To add a preferred partner:**
1. Go to **Partners → My partners → Add for [property]**
2. Browse the marketplace by service type
3. Assign with priority rank (1 = first contacted)

**To end an assignment:** Open the assignment, click **End assignment** with a reason.

### 6.2 Multiple partners per service type

Assign 2–3 partners per service type where possible. The system contacts them in priority order. Having a backup is critical for:
- Cleaning (partner illness is common)
- Maintenance (specialised trades may be unavailable)

### 6.3 Seasonal assignments

Use `valid_from` and `valid_until` on assignments for seasonal workers. A summer pool maintenance partner assigned April–October is activated and ended automatically.

### 6.4 When no partner is assigned

If a service request is created and no partner is assigned:
- The request moves to `FAILED` state immediately
- You and the Nauxica team are notified

For URGENT requests with no coverage, the Nauxica team will assist in finding emergency coverage — but prevention is better. Keep partner assignments current.

---

## 7. Escalation Review

When an escalation is resolved, you receive a summary notification. Review every escalation — they contain signal about your property's gaps.

| Escalation type | Review action |
|---|---|
| EMERGENCY | Verify emergency data is accurate and current after the incident |
| MAINTENANCE_URGENT | Was the issue resolved? Is there a recurring problem needing a permanent fix? |
| CONFIDENCE_THRESHOLD | What topic did the AI fail on? Update the knowledge base accordingly |
| HUMAN_REQUESTED | Why did the guest need a human? Could a knowledge base update prevent this? |
| COMPLAINT_ESCALATION | Was the complaint about a fixable property issue? |
| FAILED service request | Why was no partner available? Is coverage adequate for this service type? |

---

## 8. Service Request Oversight

### 8.1 Requests requiring your approval

Some ServiceRequest types are flagged for homeowner approval before the partner begins work:
- Maintenance jobs estimated above a cost threshold (configurable in your profile)
- Repairs requiring access to areas not covered in the Partner Brief

You receive a notification and must approve or decline via the dashboard. Failure to respond within 2 hours results in a platform escalation.

### 8.2 Completion verification

When a job is marked complete, you have 48 hours to verify it via the dashboard. If you take no action, the job auto-verifies. For maintenance and inspection jobs, actively verify — photos confirm whether the work was done correctly.

### 8.3 Post-checkout cleaning

After every checkout, ensure a cleaning job is either automatically triggered (via partner assignment) or manually created. The platform reminds you at checkout, but the action is yours.

---

## 9. Dispute Involvement

**Your role in a dispute:**
- Provide context on what was requested and agreed with the partner
- Review the job's completion photos and the dispute claim
- Communicate your position to the Nauxica team (not directly to the partner in the first instance)
- Cooperate with the process in [dispute-resolution.md](../../trust-safety/dispute-resolution.md)

**Do not:** Contact the partner directly to argue about the job outside the platform, or withhold payment before the dispute process is complete.

---

## 10. Emergency Handling

**Before an emergency (preparedness):**
- Keep your emergency contact phone active and answered
- Ensure the nearest hospital address in your knowledge base is accurate
- Know the location of your gas shutoff, water shutoff, and electricity breaker

**During an emergency (if the Nauxica team contacts you):**
1. Answer the call or message immediately
2. Confirm or correct the emergency data being relayed to the guest
3. Authorise any emergency access or spending required
4. Stay in contact with the Nauxica team until the situation is under control

**After an emergency:**
- Verify all emergency data fields are accurate; update anything that was wrong
- Inform your insurance provider if there has been property damage

---

## 11. Homeowner SLA Expectations

| Situation | Expected response time |
|---|---|
| Emergency escalation (CRITICAL) | Immediately — answer the call |
| Urgent maintenance — no partner responding | Within 30 minutes |
| Failed check-in | Within 15 minutes |
| General escalation | Within 2 hours during 08:00–22:00 |
| Completion verification (non-urgent jobs) | Within 48 hours |
| Alloggiati Web registration | Within 24 hours of guest arrival |
| Access code update request | Within 2 hours during business hours |
| Platform message from Nauxica team | Within 4 hours during 08:00–22:00 |

**Persistent unavailability:** If a homeowner routinely misses escalation response windows, their property may be suspended until reliable emergency coverage is confirmed.

---

## 12. Inactive Homeowner Handling

If you plan to be unavailable while a stay is active:

1. Designate a trusted contact who can receive escalation calls
2. Update your emergency contact in the platform to include this backup
3. Brief your backup on the current guest stay and any known issues
4. Notify the Nauxica team of your absence and your backup contact

Never leave an active stay without emergency coverage. A guest who cannot access your property at 23:00 because no one is reachable is a serious failure.

---

## 13. Ongoing Responsibilities Summary

| Responsibility | Frequency | Notes |
|---|---|---|
| Add bookings to platform | Per reservation | Before 48h pre-arrival window |
| Verify guest WhatsApp number | Per reservation | At booking creation |
| Complete Alloggiati Web registration | Per reservation | Within 24h of guest arrival |
| Confirm tourist tax collected | Per reservation | On checkout |
| Review knowledge base | At minimum seasonally | Whenever property or local conditions change |
| Verify emergency contact number | Every 90 days | Platform prompts; homeowner confirms |
| Update access codes when changed | Immediately on change | Before next guest arrival |
| Respond to escalations | Per SLA above | |
| Verify service job completions | Within 48h of completion | |
| Review AI conversation quality | Weekly during active stays | Spot-check for knowledge gaps |
| Maintain partner assignments | Review every 6 months | Add backups if primary is unreliable |
