# Platform Flow Map

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch — end-to-end platform flows
**Last updated:** 2026-05-28
**Related:** [module-functionality-map.md](module-functionality-map.md) · [system-dependency-map.md](system-dependency-map.md) · [service-request-flow.md](../operations/service-request-flow.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) · [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) · [partner-assignment-model.md](partner-assignment-model.md)

---

## Purpose

This document maps the end-to-end flows for each major user journey on the Nauxica platform. Each flow shows: actor, trigger, sequential steps, data models touched at each step, and terminal state.

These flows are the implementation reference for integration testing and acceptance criteria definition.

---

## Flow Index

| # | Flow | Primary actor | Trigger |
|---|---|---|---|
| F-01 | Property activation | Homeowner + Operator | Homeowner submits a property for activation |
| F-02 | Partner onboarding and first assignment | Partner + Operator + Homeowner | Partner registers on the platform |
| F-03 | Guest check-in via AI concierge | Guest (WhatsApp) + AI Runtime | Guest sends first WhatsApp message |
| F-04 | Service request lifecycle | Guest + AI + Partner + Homeowner | Guest reports an issue or requests a service |
| F-05 | Partner dispatch and job completion | Partner + Homeowner + System | ServiceRequest created; partner dispatched |
| F-06 | Operator escalation handling | AI + Operator + Guest | AI concierge triggers escalation |
| F-07 | Emergency detection and response | Guest + AI + Operator + Homeowner | Guest message contains emergency keywords |
| F-08 | Post-stay review flow | Guest + Homeowner + Platform | Guest checkout completed |

---

## F-01 — Property Activation

**Primary actor:** Homeowner (initiates); Operator (approves)
**Trigger:** Homeowner submits a new property for activation
**Terminal state:** `Property.platform_status = active`, AI concierge live for first reservation

```
HOMEOWNER
  1. Registers account (email + password + phone OTP)
  2. Creates property record: basic details, address, capacity
     → Writes: Property (platform_status = pending)
  3. Completes full property data schema
     → Writes: Property (all fields from property-data-schema.md)
  4. Enters EmergencyData: emergency contacts, utility controls, hospital info
     → Writes: EmergencyData (is_complete set to true when all required fields present)
  5. Completes PropertyKnowledgeBlock: AI-facing prose content for all categories
     → Writes: PropertyKnowledgeBlock (is_complete = false until reviewed)
  6. Completes property activation checklist (per property-activation-checklist.md)
  7. Assigns at least one vetted partner (CLEANING minimum) via marketplace
     → Writes: PartnerAssignment (status = DRAFT until partner accepts)
  8. Submits property for operator review

OPERATOR
  9. Reviews property data for completeness and quality
  10. Verifies EmergencyData is complete and accurate
  11. Verifies PropertyKnowledgeBlock is complete and reviewed
      → Writes: PropertyKnowledgeBlock (is_complete = true)
  12. Approves partner assignment (if first partner for this property type)
  13. Activates property
      → Writes: Property (platform_status = active, activated_at = now)
      → Emits: compliance.Property.Activated

SYSTEM
  14. Sends activation confirmation to homeowner
      → Writes: Notification (NORMAL severity, email + dashboard)
  15. AI concierge is now live for reservations linked to this property
```

**Data models touched:** User, Property, EmergencyData, PropertyKnowledgeBlock, PartnerAssignment, Notification
**Key gate:** Steps 4 and 5 must both be complete before step 13 can execute. Operator cannot activate if `EmergencyData.is_complete = false` or `PropertyKnowledgeBlock.is_complete = false`.

---

## F-02 — Partner Onboarding and First Assignment

**Primary actor:** Partner (registers); Operator (approves); Homeowner (assigns)
**Trigger:** Partner registers on the platform
**Terminal state:** `PartnerAssignment.assignment_status = ACTIVE`, partner ready to receive jobs

```
PARTNER
  1. Registers account: email + password + phone OTP
     → Writes: User (account_type = partner, account_status = pending)
  2. Selects service types and operating areas
     ⚠️ Note: Service type list is currently inconsistent across docs — see BLOCKER C-02
     → Writes: User (partner_service_types, operating_areas)
  3. Uploads identity document
     → Writes: User (id_document_url)
  4. Uploads insurance certificate (if Tier 2: CLEANING or MAINTENANCE)
     → Writes: User (insurance_document_url)
  5. Submits self-requested casellario giudiziale (criminal record certificate) for Tier 2 partners
  6. Completes profile: display name, photo, bio

OPERATOR
  7. Reviews submitted documents
  8. Confirms identity verification
      → Writes: User (is_identity_verified = true)
  9. Reviews background check certificate (Tier 2 only)
  10. Approves application
      → Writes: User (background_check_status = approved, account_status = active)
  11. Sends platform welcome email to partner

HOMEOWNER
  12. Browses partner marketplace — filters by service type and operating area
  13. Selects partner for a specific service type on their property
  14. Creates PartnerAssignment
      → Writes: PartnerAssignment (assignment_status = DRAFT)

PARTNER
  15. Receives assignment invitation notification
      → Reads: Partner Brief (PARTNER-scoped property data — no access codes yet)
  16. Reviews and accepts the assignment
      → Writes: PartnerAssignment (assignment_status = ACTIVE, partner_briefed = true)

SYSTEM
  17. PartnerAssignment becomes active — partner will receive dispatch notifications
      when ServiceRequests of this type are created for this property
  18. Access codes are NOT delivered at this stage — only at job acceptance
```

**Data models touched:** User, PartnerAssignment, Property (via Partner Brief read), Notification
**Key security note:** Access codes (lockbox, key safe, smart lock) are delivered at `PartnerRequest.accepted` — never at assignment time (step 16).

---

## F-03 — Guest Check-In via AI Concierge

**Primary actor:** Guest (WhatsApp)
**Trigger:** Guest sends first WhatsApp message on or before arrival day
**Terminal state:** Guest has received welcome message, access code, and knows how to reach emergency services

```
GUEST
  1. Sends first WhatsApp message to property number
     → Emits: guest.WhatsAppMessage.Received

AI RUNTIME — Step 1: Message Intake
  2. Normalises webhook payload into InboundMessage
  3. Idempotency check: is this message_id already processed? If yes: stop.

AI RUNTIME — Step 2: Session Resolution
  4. Looks up guest_phone against active reservations:
     checkin_date <= today + 2 days AND checkout_date >= today - 1 day
  5a. Resolution SUCCESS: loads/creates WhatsAppSession, determines session_phase
      → Writes: WhatsAppSession (created if new)
  5b. Resolution FAILURE (unknown number): sends standard unknown-guest message. Stop.

AI RUNTIME — Step 3: Emergency Pre-Check
  6. Deterministic keyword scan on message body (<100ms)
  7. Emergency keywords found? → jump to F-07 Emergency flow
  8. No emergency → continue to Step 4

AI RUNTIME — Steps 4–8: Classification, Retrieval, Response
  9. Intent classified (check-in inquiry expected at this phase)
  10. KBB called: loads PropertyKnowledgeBlock + EmergencyData for this property,
      filtered by GUEST scope, language = guest_preferred_language
  11. Access code gate checked:
      session_phase = check_in_day AND current_time >= check_in_from?
      YES → access code included in response
      NO → access code withheld; time context offered ("check-in is at [time]")
  12. LLM generates welcome response: greets guest by name, confirms reservation,
      provides check-in instructions, WiFi, house rules summary
  13. Confidence evaluated — ≥0.80 proceed; otherwise hedge or clarify

AI RUNTIME — Steps 10–13: Delivery and Session Update
  14. Message sent via WhatsApp Business API
      → Emits: guest.WhatsAppMessage.Sent
  15. Session updated: message_count++, last_message_at = now
      → Writes: WhatsAppSession (updated fields only)

GUEST
  16. Receives welcome message with check-in instructions
  17. Subsequent messages continue in the same session
      (session_phase transitions as stay progresses)
```

**Data models touched:** WhatsAppSession (create/write), Reservation (read), PropertyKnowledgeBlock (read via KBB), EmergencyData (read via KBB)
**Session phases during stay:** pre_arrival → check_in_day → in_stay → check_out → post_stay

---

## F-04 — Service Request Lifecycle

**Primary actor:** Guest (via AI concierge)
**Trigger:** Guest reports a problem or requests a service during their stay
**Terminal state:** Service completed and verified; guest informed of outcome

```
GUEST
  1. Sends message: "The air conditioning isn't working"
     → Emits: guest.WhatsAppMessage.Received

AI RUNTIME
  2. Emergency pre-check: no emergency keywords detected
  3. Intent classified: MAINTENANCE request, urgency assessed
  4. KBB retrieval: property maintenance context loaded
  5. AI creates ServiceRequest:
     service_type = MAINTENANCE
     urgency = HIGH (A/C failure in summer = HIGH, not EMERGENCY)
     description = [internal description]
     guest_message = "The air conditioning isn't working"
     guest_status_message = "I've logged a maintenance request — a partner will be notified."
     → Writes: ServiceRequest (status = CREATED)
     → Emits: service_request.ServiceRequest.Created
  6. AI responds to guest: "I've logged a maintenance request for the air conditioning.
     A partner will contact you shortly — typically within [response_window] for this type of issue."

DISPATCH SERVICE
  7. Listens to service_request.ServiceRequest.Created
  8. Looks up PartnerAssignment for (property_id, MAINTENANCE), ordered by priority_rank
  9. Creates PartnerRequest for rank-1 partner
     → Writes: PartnerRequest (status = new)
     → Emits: partner.PartnerRequest.Dispatched
  10. Notification sent to partner (NORMAL/HIGH severity depending on urgency)

PARTNER
  11. Receives notification; reviews job details (no access code yet)
  12. Accepts or declines within response window (4h routine, 30min urgent)
      → Writes: PartnerRequest (status = accepted or declined)

  If ACCEPTED:
  13. Access code delivered to partner
      → Writes: PartnerAssignment (access_granted = true)
  14. Partner travels to property, performs repair

  If DECLINED (or no response within window):
  15. Dispatch tries rank-2 partner (if exists)
  16. If all partners exhausted: ServiceRequest → FAILED; notify homeowner + operator

PARTNER
  17. Job complete: adds completion notes, uploads photos
      → Writes: PartnerRequest (status = completed, completion_photo_urls = [...])
      → Emits: partner.PartnerRequest.Completed

HOMEOWNER
  18. Receives verification notification (dashboard + email)
  19. Reviews completion: confirms or disputes
      → Writes: ServiceRequest (status = VERIFIED or DISPUTED)

  If DISPUTED:
  20. Dispute record created → operator review
```

**Data models touched:** ServiceRequest, PartnerRequest, PartnerAssignment, WhatsAppSession, Notification
**State machine:** CREATED → CLASSIFIED → ROUTED → PENDING_ACCEPTANCE → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED

---

## F-05 — Partner Dispatch and Job Completion

**Primary actor:** Partner + System
**Trigger:** `service_request.ServiceRequest.Created` event
**Terminal state:** Job completed, photos uploaded, homeowner verified

This flow covers the supply side of F-04 in more detail, particularly for homeowner-initiated requests and scheduled recurring jobs.

```
SYSTEM (recurring schedule trigger)
  1. Scheduled job time reached (e.g. weekly cleaning)
  2. System auto-creates ServiceRequest (BLOCKER: C-02 — auto_create_request field in
     partner-assignment-model.md currently references PartnerRequest incorrectly;
     should create ServiceRequest first — see documentation-consistency-audit.md H-03)
     → Writes: ServiceRequest (initiated_by = system, status = CREATED)
     → Emits: service_request.ServiceRequest.Created

DISPATCH SERVICE
  3. ServiceRequest.CLASSIFIED → ServiceRequest.ROUTED
  4. PartnerRequest created for preferred partner → ServiceRequest.PENDING_ACCEPTANCE
  5. Partner notified (response window clock starts)

PARTNER
  6. Reviews request: property name, service type, requested date, job description
     (No access code shown until step 8)
  7. Accepts job within response window
     → Writes: PartnerRequest (status = accepted, accepted_at = now)
     → ServiceRequest → ASSIGNED
  8. Access code delivered: lockbox / key safe / partner code
     (Access code is PARTNER scope — delivered via in-platform message or notification)
  9. Partner travels to property on agreed date

  On arrival:
  10. Marks job as in-progress (optional — for time tracking)
      → Writes: PartnerRequest (status = in-progress)
      → ServiceRequest → IN_PROGRESS

  Job complete:
  11. Adds completion notes
  12. Uploads required photos:
      - CLEANING: living areas, kitchen, bathrooms, beds made, key returned
      - MAINTENANCE: before and after photos of repair area
      → Writes: PartnerRequest (status = completed, partner_completion_notes, completion_photo_urls)
      → Emits: partner.PartnerRequest.Completed
      → ServiceRequest → COMPLETED

HOMEOWNER
  13. Receives verification notification
  14. Reviews photos and notes
  15. Verifies completion within 48h (auto-verified if no action taken)
      → Writes: ServiceRequest (status = VERIFIED)
      → Emits: service_request.ServiceRequest.Verified

SYSTEM (post-job)
  16. Review requests sent to homeowner (rate partner) and partner (rate homeowner)
      → Partner quality score recalculated
```

**Data models touched:** ServiceRequest, PartnerRequest, PartnerAssignment, Review, Notification

---

## F-06 — Operator Escalation Handling

**Primary actor:** AI Concierge (triggers); Operator (handles)
**Trigger:** AI runtime triggers one of 11 escalation conditions
**Terminal state:** Escalation resolved; AI optionally re-enabled; homeowner informed

```
AI RUNTIME
  1. Detects escalation condition (e.g. guest expresses complaint — TRIGGER-03)
  2. Creates EscalationRecord:
     trigger_type = COMPLAINT
     trigger_detail = [specific guest message that triggered escalation]
     escalation_status = pending
     → Writes: EscalationRecord (create only — AI cannot modify after this)
  3. Emits: escalation.EscalationRecord.Triggered
  4. Sets WhatsAppSession.active_escalation_id = EscalationRecord.id
     → Writes: WhatsAppSession (active_escalation_id)
  5. AI suppressed: subsequent guest messages held in queue, not processed by AI
  6. Sends holding message to guest:
     "I've passed your message to our team. A member of staff will be in touch shortly."

NOTIFICATION SERVICE
  7. Receives escalation.EscalationRecord.Triggered
  8. Sends CRITICAL/HIGH notification to operator:
     dashboard alert + SMS (within 60s for EMERGENCY, within 5min for COMPLAINT)

OPERATOR
  9. Reviews escalation: reads EscalationRecord, full WhatsAppSession history,
     relevant PropertyKnowledgeBlock context
  10. Acknowledges escalation
      → Writes: EscalationRecord (escalation_status = acknowledged, acknowledged_at = now)
  11. Communicates with guest directly (outside platform at MVP — via WhatsApp personal)
  12. Resolves the underlying issue (may coordinate with homeowner)
  13. Marks escalation resolved
      → Writes: EscalationRecord (escalation_status = resolved, resolved_at = now, resolution_notes)

  If AI should resume:
  14. Clears active_escalation_id from session
      → Writes: WhatsAppSession (active_escalation_id = null)
  15. Writes: EscalationRecord (ai_resumed_at = now)

AI RUNTIME
  16. Detects active_escalation_id = null; resumes normal processing

HOMEOWNER
  17. Receives escalation summary notification (NORMAL severity, email)
```

**Data models touched:** EscalationRecord, WhatsAppSession, Notification
**SLA:** EMERGENCY escalation → operator acknowledgement within 5 minutes. COMPLAINT → 2 hours.

---

## F-07 — Emergency Detection and Response

**Primary actor:** Guest (WhatsApp); AI Runtime; Operator; Homeowner
**Trigger:** Guest message contains emergency keywords
**Terminal state:** Emergency services contacted; operator and homeowner notified; AI holds further messages pending operator assessment

```
GUEST
  1. Sends message: "There's a gas leak — I can't breathe" (Italian or English)
     → Emits: guest.WhatsAppMessage.Received

AI RUNTIME — Emergency Pre-Check (Step 3 of pipeline — runs BEFORE classification)
  2. Keyword scan: detects "gas leak" as emergency keyword (<100ms, deterministic)
  3. Immediately constructs emergency response — does NOT wait for LLM
  4. Sends emergency response:
     "EMERGENZA — chiama il 112. Per il gas: apri le finestre, esci immediatamente, non usare interruttori."
     Includes: 112 (emergency), 118 (medical), gas shutoff instructions from EmergencyData
  5. Creates EscalationRecord with trigger_type = EMERGENCY
     → Writes: EscalationRecord
     → Emits: escalation.EscalationRecord.Triggered (severity = CRITICAL)
  6. Session set to escalated state
  7. Continues emergency information message sequence (second message: owner emergency contact)

NOTIFICATION SERVICE
  8. CRITICAL notification: operator + homeowner (no quiet hours, <60s SLA)
     → SMS + dashboard alert
     → Message: "EMERGENCY escalation at [property]. Guest reporting gas leak. [time]"

OPERATOR
  9. Acknowledges within 5 minutes
  10. Calls homeowner if not already responding
  11. Monitors situation; contacts emergency services if not already done

HOMEOWNER
  12. Immediately available (per homeowner SLA — EMERGENCY = immediate callback)
  13. Coordinates with emergency services and operator

AI RUNTIME (subsequent messages)
  14. All subsequent messages in the session are held — not processed by AI
  15. Operator manages the conversation manually
```

**Data models touched:** WhatsAppSession, EscalationRecord, EmergencyData (read), Notification
**Key principle:** Emergency pre-check is hardcoded and deterministic — it runs before the LLM, before classification, before KBB. It must never fail or be skipped.

---

## F-08 — Post-Stay Review Flow

**Primary actor:** Guest; Homeowner; Platform
**Trigger:** `Reservation.status` transitions to `checked-out`
**Terminal state:** Review records created; partner quality scores updated; homeowner sees review on dashboard

```
SYSTEM
  1. Checkout date passes; Reservation moves to checked-out
     → Writes: Reservation (status = checked-out, checkout_completed_at = now)
     → Emits: reservation.Reservation.CheckedOut

  2. AI concierge sends checkout message to guest (final session message):
     "Thank you for staying at [property name]. We hope you enjoyed your time in Sicily.
     If you'd like to leave a review, you can do so at [link]. Safe travels!"
     → Writes: WhatsAppSession (session closed — status = closed, session_closed_at = now)
     → Writes: GuestStayContext (feedback_requested = true)

  3. Review request sent to homeowner (for rating the partner on each completed job)
     → Writes: Notification (NORMAL severity, email)

GUEST
  4. Clicks review link (post-stay, via email or WhatsApp link)
  5. Submits 1–5 star rating + optional comment
     → Writes: Review (review_type = guest-to-property, rating, comment, is_visible = true)
     → Emits: reservation.Review.Created

HOMEOWNER
  6. Reviews completed PartnerRequests from this stay
  7. Rates partner (if job was completed)
     → Writes: Review (review_type = homeowner-to-partner)
     → Emits: reservation.Review.Created

PARTNER
  8. Receives homeowner rating; may rate homeowner in return
     → Writes: Review (review_type = partner-to-homeowner)

SYSTEM
  9. Partner quality score recalculated:
     40% average rating + 25% completion rate + 20% response rate + 15% (inverse) dispute rate
     → Updates: User (average_rating, quality metrics — computed fields)
```

**Data models touched:** Reservation, WhatsAppSession, GuestStayContext, Review, Notification
**Guest reviews:** Guest has no account. `reviewer_id = null`; `reviewer_guest_phone` stored (⚠️ legal review required — GDPR retention policy).

---

## Related Documents

- [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) — Full 13-step AI pipeline
- [service-request-flow.md](../operations/service-request-flow.md) — ServiceRequest state machine
- [partner-assignment-model.md](partner-assignment-model.md) — Assignment lifecycle and dispatch rules
- [whatsapp-session-anchor.md](../ai-concierge/whatsapp-session-anchor.md) — Session resolution and phases
- [escalation-rules.md](../ai-concierge/escalation-rules.md) — 11 escalation triggers
- [emergency-procedures.md](../ai-concierge/emergency-procedures.md) — Emergency keyword list and response
- [notification-system.md](notification-system.md) — Notification channels and severity
