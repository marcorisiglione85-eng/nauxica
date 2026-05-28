# Partner Operations

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Active partners post-activation
**Last updated:** 2026-05-28
**Audience:** Active service partners managing jobs on the Nauxica platform
**Related:** [partner-onboarding.md](../../onboarding/partner/partner-onboarding.md) · [first-job-walkthrough.md](../../onboarding/partner/first-job-walkthrough.md) · [partner-vetting.md](../../trust-safety/partner-vetting.md) · [service-request-flow.md](../service-request-flow.md) · [partner-assignment-model.md](../../architecture/partner-assignment-model.md)

---

## Purpose

This document defines the ongoing operational lifecycle for active partners after onboarding is complete. The first job walkthrough in [first-job-walkthrough.md](../../onboarding/partner/first-job-walkthrough.md) covers the mechanics of a first job. This document covers everything that happens over the months and years that follow: how reliability is tracked, how trust scores evolve, what triggers suspension, and how to participate in disputes.

---

## 1. Job Queue Management

### 1.1 Where to find your jobs

All incoming job requests appear in your **Partner Dashboard → Jobs**. The dashboard shows:
- **Pending requests:** PartnerRequests awaiting your response (sorted by response deadline)
- **Accepted jobs:** Jobs you have accepted, with date, property area, and status
- **Upcoming jobs:** Accepted jobs scheduled for a future date
- **Completed jobs:** Historical record of all completed work
- **Disputed jobs:** Any job currently under a dispute review

### 1.2 Response window management

The response window starts when the PartnerRequest is sent — not when you open the notification. This distinction matters when you are busy between jobs.

**Managing missed windows:**
If you routinely miss response windows for a specific service type, consider one of:
- Narrowing your service area (fewer requests, but more achievable response)
- Reducing your availability to periods you can genuinely respond in
- Using the **availability pause** feature when you know you will be unreachable

Three missed response windows (where you did not accept or decline within the window) in any 90-day period trigger an automatic reliability flag. See Section 5 (Reliability Scoring).

### 1.3 Prioritising urgent requests

MAINTENANCE (urgent) requests have a 30-minute response window. When one arrives:
- It appears at the top of your pending queue with a countdown timer
- You receive an SMS alert in addition to the in-platform notification
- If you are in the middle of another job and cannot accept: decline immediately with reason "other job in progress"

A fast decline is always better than a missed window for urgent requests. Declining does not count against your reliability score if it has a valid reason.

### 1.4 Managing multiple active jobs

You may have multiple accepted jobs at different properties. The platform does not prevent this — you manage your own scheduling. However:
- Do not accept a job you cannot complete on time
- If scheduling conflicts arise after acceptance: contact the Nauxica team via the job chat immediately — do not wait until the day of the job

---

## 2. Availability Management

### 2.1 Setting your availability

Your availability determines whether you appear as a viable recipient for new PartnerRequests. Keep it current.

**In your partner profile:**
- `is_accepting_jobs`: toggle to temporarily pause all new requests
- Availability calendar: block specific dates or periods when you are unavailable
- Recurring availability: set your standard weekly pattern

**Use the availability calendar proactively.** Holidays, training days, family events — block them in advance. Last-minute declines create operational problems for homeowners and reflect in your reliability score.

### 2.2 Pausing job acceptance

When you go on holiday or have an extended period of unavailability:
1. Toggle `is_accepting_jobs` to false before the period starts
2. Set an estimated return date so homeowners can see when you will be available again
3. Any existing accepted jobs that overlap with your pause period must be resolved first — contact the Nauxica team if you have scheduling conflicts

While paused, you receive no new PartnerRequests. Your existing assignments remain active but dormant.

### 2.3 Returning from a pause

When you return:
1. Toggle `is_accepting_jobs` back to true
2. Review any job requests that may have been queued (if the homeowner added you back to their preferred list)
3. Check your assigned properties — confirm access codes and Partner Briefs are still current

### 2.4 Seasonal availability

If you only operate seasonally (e.g. summer only, April–October):
- Set `valid_until` on your PartnerAssignments to match your season end
- Notify homeowners at least 2 weeks before your season ends so they can arrange alternative coverage
- Return-to-active at season start: update your availability and re-activate assignments

---

## 3. SLA Expectations

Your service-level commitments on the platform:

| SLA | Standard | Urgent |
|---|---|---|
| Respond to PartnerRequest | Service-type response window | 30 minutes (MAINTENANCE URGENT) |
| Arrive at property | Within the agreed job time window | ASAP for urgent |
| Complete job | As described in the job scope | — |
| Upload completion evidence | Before marking complete | Immediately |
| Respond to issue flags | Within 4 hours | Within 1 hour for CRITICAL |
| Respond to dispute notification | Within 24 hours | — |

**Response windows by service type:**

| Service type | Response window |
|---|---|
| CLEANING | 2 hours |
| MAINTENANCE (routine) | 4 hours |
| MAINTENANCE (urgent) | 30 minutes |
| TRANSFER | 1 hour |
| EXPERIENCE | 4 hours |
| POOL / GARDEN | 24 hours |

---

## 4. Quality Score System

Your quality score is a composite metric derived from four factors. It is visible to homeowners and determines your position in marketplace listings.

### 4.1 Score components

| Factor | Weight | How it is measured |
|---|---|---|
| Average homeowner rating | 40% | Star rating (1–5) from post-job homeowner reviews |
| Job completion rate | 25% | Completed jobs / accepted jobs |
| Response rate | 20% | Responses within window / total PartnerRequests |
| Dispute rate | 15% | (Inverse) — lower disputes = higher score contribution |

### 4.2 Score tiers

| Score | Tier | Marketplace position |
|---|---|---|
| 4.5 – 5.0 | ⭐⭐⭐ Excellent | Featured in search results; priority listing |
| 3.8 – 4.4 | ⭐⭐ Good | Standard listing |
| 3.0 – 3.7 | ⭐ Adequate | Standard listing with advisory note visible to homeowners |
| Below 3.0 | Below threshold | Profile de-prioritised; manual review triggered |

### 4.3 Improving your score

**Rating improvement:**
- After every job, leave a clear completion note and quality photos — homeowners rate higher when they have evidence
- If a homeowner rates you poorly, do not contest it immediately — review the photos and completion notes to understand whether the rating was fair before responding
- If you believe a rating is unjust (e.g. you were rated for a problem that was pre-existing), raise it via the platform's review process — see Section 9

**Completion rate improvement:**
- If you are declining accepted jobs, review whether your response window decisions are sound — accept only what you can deliver
- Late cancellations (after ASSIGNED state) count most heavily against completion rate

**Response rate improvement:**
- If your response rate is low, check whether your notification settings are correctly configured
- Review your availability calendar — are you receiving requests during periods you cannot respond?

---

## 5. Reliability Scoring

Reliability is tracked separately from quality. A highly rated partner who is chronically unreliable is still a platform risk.

### 5.1 Reliability events

The following are logged as reliability events:

| Event | Code | Impact |
|---|---|---|
| Response window missed (no accept or decline) | NO_RESPONSE | Negative |
| Accepted job cancelled after ASSIGNED | LATE_CANCEL | Negative (higher weight) |
| Accepted job — partner did not arrive (confirmed no-show) | NO_SHOW | Strongly negative |
| Accepted job completed as agreed | COMPLETION | Positive |
| Accepted job completed early | EARLY_COMPLETION | Positive |
| Partner proactively updates homeowner on delay | PROACTIVE_COMMS | Positive |

### 5.2 Reliability thresholds

| Pattern | Action |
|---|---|
| 3 NO_RESPONSE events in 90 days | Automatic reliability flag — operator review |
| 2 LATE_CANCEL events in 90 days | Automatic reliability flag — operator review |
| 1 confirmed NO_SHOW | Operator contact; written acknowledgement required |
| 3 NO_SHOW events in 90 days | Automatic 14-day suspension (see Section 6) |
| Pattern of LATE_CANCEL after URGENT acceptance | Operator review; may be removed from URGENT dispatch |

### 5.3 How to clear a reliability flag

When a reliability flag is created, the Nauxica team contacts you for context. Providing a clear explanation (illness, emergency, scheduling failure) acknowledges the event and helps inform whether it is a systemic problem or a one-off.

A flag does not automatically affect your account status. It is a signal for the operator to assess.

---

## 6. Suspension and Reinstatement

Full suspension criteria are defined in [partner-vetting.md](../../trust-safety/partner-vetting.md). This section summarises what you need to know operationally.

### 6.1 What triggers automatic suspension

- Insurance certificate lapsed (no active coverage)
- 3 confirmed no-shows in any 90-day period
- Average rating below 3.0 after 10+ reviews

### 6.2 What triggers manual suspension (operator decision)

- Guest safety complaint against you during a platform job
- Confirmed property damage caused by you during a job
- Pattern of 3+ disputes across homeowners within any quarter
- Operating under a different business name than registered (identity mismatch)

### 6.3 What happens during suspension

- You receive no new PartnerRequests
- Existing in-progress jobs are not cancelled, but homeowners are notified
- Your profile is not visible in the marketplace
- Your insurance documents (if the trigger was lapse) must be renewed before reinstatement

### 6.4 Reinstatement process

1. Submit a written reinstatement request via the platform
2. Provide evidence that the suspension cause is resolved (e.g. renewed insurance certificate)
3. The Nauxica founder reviews the request personally
4. If reinstated: your first 5 jobs post-reinstatement are monitored closely with mandatory homeowner feedback
5. A second suspension is permanent — there is no further reinstatement

---

## 7. Issue Reporting

When you find a problem at a property during a job, you report it through the platform. This is mandatory — informal handling (e.g. WhatsApp message to the homeowner, verbal agreement) creates liability for you if the issue is later disputed.

### 7.1 What to report

- Pre-existing damage you found before starting work
- Damage you accidentally caused during the job
- Safety hazards (gas smell, flooding, structural damage)
- Missing items that should have been at the property (cleaning inventory, tools you need)
- Guest belongings left after checkout
- Access code that did not work (even if you found another way in)
- Property condition significantly different from the job brief

### 7.2 How to report

1. Open the active job in your dashboard
2. Navigate to **Report an issue**
3. Select the issue category
4. Describe: what you found, where, when
5. Upload photos (required for damage reports)
6. Submit

The homeowner and Nauxica team are notified automatically.

### 7.3 What you must not do

- Fix pre-existing damage without homeowner authorisation
- Dispose of guest belongings
- Contact emergency services on behalf of the property without reporting through the platform first (exception: immediate life-safety threat — call 112 immediately, report through platform after)
- Share property access information with anyone not authorised by the platform

---

## 8. Proof-of-Completion Expectations

Completion photos are your protection in any dispute. The requirements vary by service type and are defined in [service-request-flow.md](../service-request-flow.md). The short version:

| Service type | Minimum photos |
|---|---|
| CLEANING | 4+ covering all rooms in scope |
| MAINTENANCE | Before + after + completed-fix context |
| INSPECTION | 6+ with structured checklist |
| Others | 1 confirmation photo or written note |

**Photo quality matters.** A dark, blurry photo of the wrong area of the room does not support your claim that the job was done. Take photos in good light, at the relevant area, before you leave.

**Do not mark a job complete without uploading evidence.** The platform requires it for cleaning and maintenance. If you bypass this, the completion is accepted but flagged for review — which takes longer to resolve than just taking the photos correctly the first time.

---

## 9. Dispute Participation

When a homeowner reports an issue at verification, a dispute is created. You are notified and have 24 hours to respond.

### 9.1 Your response to a dispute

When you receive a dispute notification:
1. Read the homeowner's complaint in full
2. Review your own completion photos and notes from the job
3. Submit your response via the platform within 24 hours — include: what you did, what photos show, any context relevant to the complaint
4. Do not contact the homeowner directly to argue about the job

### 9.2 Types of dispute and how they are assessed

| Dispute type | How it is assessed |
|---|---|
| Quality dispute | Completion photos, homeowner description of what was missing |
| Scope dispute | Job brief vs. what you reported completing |
| Damage dispute | Before/after photos, issue report (if filed), homeowner's evidence |
| No-show dispute | PartnerRequest timestamps, GPS/arrival data if available |

### 9.3 Dispute outcomes

| Outcome | Effect |
|---|---|
| Resolved in partner's favour | No effect on quality score |
| Resolved against partner | Counted in dispute rate; potential quality score impact |
| Partner at fault for damage | Logged in partner record; insurance claim may be initiated |
| Pattern of disputes | Reliability flag; potential suspension review |

### 9.4 Unjust ratings

If a homeowner rates you poorly for something outside your control (e.g. pre-existing damage not caused by you, a rating for a job cancellation that was the homeowner's decision), you can request a review. The process:
1. Navigate to the rating in your dashboard
2. Submit a review request with your explanation and supporting evidence
3. The Nauxica team reviews within 5 working days
4. If upheld: the rating is adjusted or removed

Review requests are assessed on evidence, not assertion. Have photos and job records ready.

---

## 10. Emergency Handling During a Job

If you encounter an emergency at a property during a job:

**Immediate life-safety threat (fire, gas leak, medical emergency, flooding):**
1. Leave the property immediately if you are in danger
2. Call 112 (all emergencies) or the relevant Italian emergency number
3. Call the homeowner emergency contact from the Partner Brief
4. Report through the platform immediately after — while the emergency is being handled if possible, otherwise as soon as it is safe

**Do not attempt to resolve life-safety situations yourself.** Italian emergency services are trained for this; you are not. Your role is to evacuate, call, and report.

**Non-urgent issues discovered during a job:**
- Stop and report via the platform before doing anything
- Do not attempt repairs beyond the scope of your job brief without homeowner authorisation
- For maintenance partners: if you discover a secondary issue while fixing the primary, report it through the platform — the homeowner can create a new ServiceRequest for the secondary issue

---

## 11. Inactive Partner Handling

### 11.1 What inactivity means

A partner is flagged as inactive if:
- No job accepted in the last 60 days while `is_accepting_jobs = true`
- No response to 5+ PartnerRequests in the last 30 days

### 11.2 What happens on inactivity flag

- Nauxica team contacts you to confirm you are still operating
- If no response within 7 days: `is_accepting_jobs` is set to false and homeowners are notified of the change
- Your profile remains in the marketplace but is de-prioritised

### 11.3 Reactivating after inactivity

1. Log in and set `is_accepting_jobs = true`
2. Confirm your insurance documents are still valid
3. Check your assigned properties — confirm you are still available and that access codes are current

If your insurance has lapsed during the inactivity period, you must upload a renewed certificate before reactivation.

---

## 12. Trust Score Evolution

Your trust score is a long-term indicator of your standing on the platform. It starts at `⬜ New` and evolves based on platform history.

| Score | Label | Criteria |
|---|---|---|
| ⬜ New | Unknown | Fewer than 5 completed jobs |
| 🟢 Low Risk | Established | 10+ jobs, avg rating ≥ 4.0, no disputes, insurance current |
| 🟡 Monitor | Watch | 1–2 resolved disputes, rating 3.5–3.9, or documents approaching expiry |
| 🔴 High Risk | Elevated | 3+ disputes, rating below 3.5, or suspension history |
| ⛔ Suspended | Inactive | Currently suspended |

The trust score is an internal operational classification. It is not displayed on your public profile. It affects:
- How closely the Nauxica team monitors your jobs
- Which types of dispatch you are eligible for
- Whether a complaint triggers a suspension review or just a flag

**The most reliable path to 🟢 Low Risk:**
- Complete your first 10 jobs with full documentation
- Maintain an average rating above 4.0
- Keep insurance current and respond to every review
- File issue reports immediately when you find problems

A partner who consistently documents well, responds reliably, and communicates proactively builds trust quickly. One who avoids documentation and handles issues informally will struggle to progress beyond 🟡 Monitor.

---

## 13. Repeat Failure Logic

The platform tracks patterns, not just individual events. The following repeat patterns trigger escalating consequences:

| Pattern | Consequence |
|---|---|
| 3rd no-show in 90 days | Automatic 14-day suspension |
| 2nd confirmed property damage | Suspended pending founder review |
| 3rd dispute in any quarter | Suspended pending founder review |
| 2nd suspension | Permanent removal — no reinstatement |
| Insurance lapsed 2× | High scrutiny on reinstatement; renewal must be verified before any jobs are dispatched |

**These thresholds are absolute.** They are not subject to operator discretion at the trigger point. The operator reviews the case after the automatic action is taken, but the action itself is immediate.
