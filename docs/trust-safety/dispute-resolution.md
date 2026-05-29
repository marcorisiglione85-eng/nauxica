# Dispute Resolution

**Version:** 1.0
**Status:** Draft — Architecture phase. Not legal-final.
**Scope:** Sicily launch · All actor types (guest, homeowner, partner)
**Last updated:** 2026-05-28
**Related:** [escalation-rules.md](../ai-concierge/escalation-rules.md) · [partner-vetting.md](partner-vetting.md) · [partner-agreement.md](../legal/partner-agreement.md) · [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) · [data-models.md](../backend/data-models.md) · [legal-review-tracker.md](../legal/legal-review-tracker.md)

---

## Purpose

This document defines how disputes between actors on the Nauxica platform are handled — who owns the resolution process, what evidence is required, how long resolution takes, and where the boundaries of Nauxica's authority sit.

Disputes are an expected part of operating a hospitality platform. The goal is not to eliminate disputes but to resolve them fairly, consistently, and within timeframes that do not destroy the guest or homeowner's experience.

---

## Operating Principles

**1. The AI concierge has zero authority in disputes.**
It may acknowledge a dispute, escalate it, and communicate updates — but it never negotiates, assesses fault, or makes any financial decision. These are hard rules, not guidelines.

**2. Nauxica is a facilitator, not an arbitrator.**
At MVP, Nauxica facilitates the resolution process. It does not have binding arbitration authority. For disputes that cannot be resolved by the parties, the default is to refer to the competent Italian court. ⚠️ **Legal review required** — confirm dispute resolution clause in Terms of Service and Partner Agreement.

**3. Evidence is logged before resolution is attempted.**
No resolution conversation begins without the relevant evidence collected. This protects all parties and Nauxica.

**4. Financial decisions belong to the homeowner — within defined limits.**
Homeowners decide on refunds and compensation within the Nauxica framework. Nauxica may set outer limits (e.g. maximum refund without platform approval) but does not make financial decisions on the homeowner's behalf.

**5. Human escalation is always available.**
Any party may request escalation to a human at any point in the dispute process. The AI never refuses this request.

---

## Dispute Type Taxonomy

| Code | Dispute type | Parties | Primary owner |
|---|---|---|---|
| D-01 | Guest vs Property (service failure / misrepresentation) | Guest ↔ Homeowner | Nauxica facilitates |
| D-02 | Guest vs Property (damage claim) | Guest ↔ Homeowner | Nauxica facilitates |
| D-03 | Guest vs Property (tourist tax) | Guest ↔ Homeowner | Homeowner resolves; Nauxica informs |
| D-04 | Guest vs Platform (AI error / platform failure) | Guest ↔ Nauxica | Nauxica owns |
| D-05 | Homeowner vs Partner (job quality failure) | Homeowner ↔ Partner | Nauxica facilitates |
| D-06 | Homeowner vs Partner (no-show) | Homeowner ↔ Partner | Nauxica facilitates |
| D-07 | Homeowner vs Partner (property damage by partner) | Homeowner ↔ Partner | Nauxica facilitates |
| D-08 | Partner vs Homeowner (payment not received) | Partner ↔ Homeowner | Nauxica facilitates |
| D-09 | Homeowner vs Guest (damage to property) | Homeowner ↔ Guest | Homeowner leads; Nauxica supports |
| D-10 | Any party vs Nauxica (platform conduct) | Any actor ↔ Nauxica | Nauxica legal / founder |

---

## Resolution Lifecycle

Every dispute is tracked as a `DisputeRecord`. The lifecycle is:

```
REPORTED
    │
    ▼
EVIDENCE_COLLECTION (max 48h)
    │
    ▼
UNDER_REVIEW (Nauxica or relevant party)
    │
    ├─────────────────────────────────────┐
    ▼                                     ▼
RESOLVED                         ESCALATED_TO_PARTIES
    │                                     │
    ▼                             (Mediation attempted)
CLOSED                                    │
                                    ┌─────┴─────┐
                                    ▼           ▼
                               RESOLVED    REFERRED_TO_COURT
                                    │
                                    ▼
                                 CLOSED
```

**State descriptions:**

| State | Description | Max duration |
|---|---|---|
| `REPORTED` | Dispute filed — initial acknowledgement sent | 2 hours |
| `EVIDENCE_COLLECTION` | Relevant evidence being gathered from all parties | 48 hours |
| `UNDER_REVIEW` | Nauxica or designated party reviewing evidence | 72 hours (5 working days for complex) |
| `ESCALATED_TO_PARTIES` | Nauxica presenting resolution proposal to both parties | 5 working days |
| `RESOLVED` | Both parties accept outcome | — |
| `REFERRED_TO_COURT` | Parties cannot agree — Nauxica refers to competent jurisdiction | — |
| `CLOSED` | Resolved and logged | — |

---

## Dispute Type A: Guest vs Property (Service Failure / Misrepresentation)

**Trigger examples:**
- Amenity listed on the platform is not present at the property
- Property description does not match reality
- Check-in information provided was incorrect
- Cleanliness standard significantly below what was described
- WiFi completely non-functional for extended period

### Resolution process

**Step 1 — Acknowledgement (within 2 hours)**
- AI escalation triggers L2 (Nauxica support) — not just L1 (homeowner)
- Guest receives acknowledgement that the complaint is being reviewed
- AI does not comment on whether the complaint is valid

**Step 2 — Evidence collection (within 48 hours)**
- Guest asked to provide: description of issue, photos if relevant, time the issue began
- Homeowner asked to provide: their account of the situation, any relevant context
- Platform data pulled: property knowledge block at time of booking, any prior escalation records for this property

**Step 3 — Review (within 72 hours)**
- Nauxica compares guest account against what was listed and promised on the platform
- If the issue is clearly a platform listing error (e.g. Nauxica's systems showed an amenity that was not there): Nauxica owns the resolution
- If the issue is a property-level failure: homeowner is asked to propose a resolution

**Step 4 — Resolution options (presented by Nauxica to homeowner)**

| Severity | Typical resolution range | Notes |
|---|---|---|
| Minor (temporary inconvenience, quickly resolved) | Apology + small goodwill gesture | Homeowner discretion |
| Moderate (significant impact on stay, not resolved during stay) | Partial refund of nightly rate | ⚠️ Amount is homeowner's decision within platform framework |
| Severe (stay significantly misrepresented) | Full or substantial refund | ⚠️ May require Nauxica authority if homeowner refuses |

⚠️ **Legal review required:** Define the maximum refund Nauxica can facilitate without homeowner consent, if any. Define the outer limit beyond which disputes are referred to consumer protection authorities.

### What the AI is prohibited from doing

- Saying "this sounds like the homeowner's fault"
- Saying "you're entitled to a refund"
- Saying "we'll take care of this" without operator confirmation
- Agreeing to any financial outcome
- Dismissing the complaint as minor

---

## Dispute Type B: Guest vs Property (Damage Claim — Guest Caused Damage)

**Trigger:** Homeowner reports guest caused damage during a stay.

### Resolution process

**Step 1 — Reporting (within 24h of discovery)**
- Homeowner files damage report via platform
- Required evidence: photos of damage taken before guest's checkout if possible, and after; cost estimate

**Step 2 — Guest notification**
- Guest notified via Nauxica: "The property owner has reported damage that occurred during your stay. You'll receive details shortly."
- AI does not send this notification — operator sends it
- Guest given 48 hours to respond

**Step 3 — Evidence review**
- Nauxica reviews: homeowner evidence vs. guest response
- Check-in/checkout photo records if available
- Prior maintenance records for the item in question

**Step 4 — Resolution**
- If guest accepts responsibility: direct payment to homeowner (outside Nauxica's financial flow at MVP — homeowner invoices guest directly)
- If guest disputes: Nauxica facilitates, refers to parties if unresolved

⚠️ **Legal review required:** Define the liability framework in the Terms of Service. Determine whether Nauxica has any indemnification obligation and under what conditions.

---

## Dispute Type C: Guest vs Property (Tourist Tax)

**Trigger:** Guest disputes the tourist tax amount charged, claims exemption, or refuses to pay.

### AI handling rule

The AI cites the amount configured in the property knowledge block. It does not negotiate. If the guest disputes, it escalates to L1 (homeowner). It does not say "you don't have to pay" or "the owner has to prove it."

### Resolution process

1. AI escalates to homeowner (L1)
2. Homeowner provides municipality ordinance reference if guest requests evidence
3. If guest claims exemption (child, disability): homeowner verifies eligibility per municipal rules
4. If homeowner refuses a valid exemption: Nauxica support intervenes (L2)
5. Unresolved disputes over tourist tax are referred to the municipality — Nauxica does not adjudicate tax law

---

## Dispute Type D: Guest vs Platform (AI Error or Platform Failure)

**Trigger examples:**
- AI provided incorrect entry code — guest was locked out
- AI provided wrong WiFi credentials
- AI gave incorrect emergency number or hospital address
- Platform system failure caused missed check-in message
- AI made a statement that caused material harm to the guest

### Ownership

Nauxica owns these disputes. The homeowner is not at fault.

### Resolution process

**Step 1 — Immediate acknowledgement (within 1 hour)**
- Nauxica support contacts guest directly (not via AI)
- AI is disabled for this session

**Step 2 — Evidence collection**
- Pull conversation logs
- Identify the specific AI error and its root cause
- Identify harm caused (missed check-in, cost of locksmith, hotel night, etc.)

**Step 3 — Resolution**
- If harm was caused by AI providing incorrect information from a complete knowledge block: Nauxica liability — offer compensation appropriate to the harm
- If harm was caused by an incomplete knowledge block (homeowner's field was empty or wrong): homeowner bears responsibility — Nauxica facilitates homeowner's compensation of guest
- If harm was caused by platform downtime: Nauxica liability

⚠️ **Legal review required:** Define Nauxica's liability cap for AI errors in the Terms of Service. Confirm whether product liability or service liability frameworks apply.

**Step 4 — System fix**
- Knowledge block corrected immediately
- Property flagged for re-verification
- If systemic AI error: escalate to AI model/integration team

---

## Dispute Type E: Homeowner vs Partner (Job Quality / No-Show / Damage)

**Trigger examples:**
- Cleaning was incomplete or substandard before guest arrival
- Partner did not show for a confirmed job
- Partner caused damage to the property during service

### Resolution process

**Step 1 — Report (within 24h of issue)**
- Homeowner files via platform
- Required evidence: photos, description, affected booking if relevant

**Step 2 — Partner response (within 24h)**
- Partner notified and asked to respond
- Partner may accept responsibility, dispute the claim, or provide context

**Step 3 — Review (within 72h)**
- Nauxica reviews evidence from both parties
- Check `PartnerRequest` completion notes and photos if submitted
- Check partner's job history — is this a pattern?

**Step 4 — Resolution options**

| Outcome | Applicable when |
|---|---|
| Partner accepts responsibility + refunds job fee | Partner at fault, job was not completed or was substandard |
| Homeowner compensated from partner's platform account (if held) | At MVP, Nauxica does not hold partner funds — direct billing model. ⚠️ This requires homeowner to pursue payment directly |
| Partner issued a formal warning | First offence — documented in partner record |
| Partner suspended from platform | Pattern of failures or serious single incident — see partner-vetting.md |
| Dispute referred to parties for direct resolution | Evidence is contested and Nauxica cannot determine fault |

**Note on no-shows:** A confirmed job with a no-show and no cancellation notice is the most operationally damaging dispute type. The platform should log all no-shows automatically. Three no-shows result in partner suspension (see partner-vetting.md).

---

## Dispute Type F: Partner vs Homeowner (Payment Not Received)

**Trigger:** Partner reports they completed a job and have not been paid by the homeowner within the agreed timeframe.

**Note:** At MVP, Nauxica operates a **direct billing model** — partners invoice homeowners directly. Nauxica does not process payments between parties. This limits Nauxica's authority in payment disputes.

### Resolution process

1. Partner files via platform with: job confirmation, completion record, invoice sent date
2. Homeowner notified — asked to respond within 48h
3. If homeowner confirms payment was made: ask for payment reference
4. If homeowner disputes the job was satisfactorily completed: dispute becomes D-05 (quality dispute)
5. If homeowner simply has not paid: Nauxica sends formal reminder to homeowner on partner's behalf
6. If still unpaid after 14 days following Nauxica reminder: Nauxica may escalate to homeowner account review — including potential suspension of new partner requests until payment dispute is resolved
7. Nauxica cannot force payment — refer to civil courts if unresolved

⚠️ **Legal review required:** Confirm the extent of Nauxica's authority to sanction homeowners for non-payment in the Partner Agreement and Terms of Service.

---

## Evidence Standards

All disputes require evidence before resolution is attempted. The following standards apply.

| Evidence type | Acceptable formats | Notes |
|---|---|---|
| Photos | JPEG, PNG — minimum 1MP resolution | Must be timestamped where possible |
| Video | MP4 — short clips only | For complex damage or condition records |
| Screenshots | PNG or JPEG | For communication records, booking details |
| Written account | Free text in platform | Required from all parties — one statement per party |
| Booking confirmation | Platform record | Pulled automatically |
| AI conversation log | Platform record | Pulled automatically |
| PartnerRequest record | Platform record | Pulled automatically |

**Chain of evidence rule:** Evidence submitted after the 48-hour collection window may be rejected if the dispute has already advanced to `UNDER_REVIEW`. Set this expectation clearly in the dispute notification to parties.

**Evidence storage:** All dispute evidence is retained for the life of the dispute plus 3 years. ⚠️ **Legal review required** — confirm retention period against statute of limitations for relevant claim types under Italian law.

---

## Refund and Compensation Framework

⚠️ **Legal review required for all financial thresholds.** This architecture defines categories and escalation points — not final amounts.

### Principles

- Nauxica does not process refunds at MVP (direct billing model — no payments flow through Nauxica)
- Refunds are negotiated between the parties and executed directly
- Nauxica sets the framework and facilitates — it does not guarantee outcomes
- Nauxica may offer goodwill credits against subscription fees as a platform-level gesture, within defined limits set by the founder

### Escalation threshold

| Claimed amount | Resolution owner | Notes |
|---|---|---|
| Under €[threshold — TBD] | Homeowner resolves directly | Nauxica facilitates, homeowner decides |
| €[threshold] to €[threshold 2] | Nauxica senior review required | Founder or ops lead involved |
| Over €[threshold 2] | Legal counsel required | Refer to insurance or court if unresolved |

> Specific thresholds to be confirmed by legal counsel and founder before launch.

---

## AI Prohibition Rules — Disputes

These rules are absolute and must be enforced in the AI prompt layer.

| Prohibition | Reason |
|---|---|
| The AI may not assess fault | It has no legal authority and incomplete information |
| The AI may not offer, suggest, or estimate refunds or compensation | Financial authority belongs to homeowners and Nauxica — not the AI |
| The AI may not relay messages between disputing parties | Risk of misrepresentation, escalation, or legal exposure |
| The AI may not comment on the validity of a complaint | Even if the complaint appears unfounded to the AI |
| The AI may not apologise on behalf of Nauxica in a way that implies liability | AI apologies can be used in legal proceedings |
| The AI may not access or cite financial records | Not in the AI's knowledge scope |
| The AI may not close or resolve a dispute | Only a human operator can mark a dispute as resolved |

### Correct AI behaviour on receiving a complaint

1. Acknowledge in one sentence (without implying validity or fault)
2. Confirm the concern is being escalated to a human immediately
3. Give the guest the Nauxica support contact
4. Stop responding on that topic until a human takes over

---

## Incident Logging Requirements

Every dispute generates a `DisputeRecord`. Required fields at creation:

| Field | Required | Notes |
|---|---|---|
| `dispute_id` | Yes (auto) | |
| `dispute_type` | Yes | D-01 through D-10 |
| `reported_by` | Yes | User ID or `guest_phone_hash` |
| `reported_at` | Yes | Timestamp |
| `property_id` | Yes | |
| `reservation_id` | Yes (if applicable) | |
| `partner_request_id` | Conditional | Required for D-05 through D-08 |
| `status` | Yes | Starts as `REPORTED` |
| `description` | Yes | Submitting party's account |
| `evidence_urls` | Yes (once collected) | CDN URLs |
| `assigned_operator_id` | Conditional | Assigned at `UNDER_REVIEW` |
| `resolution_summary` | Conditional | Required at `RESOLVED` |
| `resolution_type` | Conditional | enum: `accepted` / `partial-refund` / `full-refund` / `no-action` / `referred` / `platform-credit` |

---

## Founder MVP Operational Role

During the MVP phase, the founder handles all disputes above D-03 severity. This is an unavoidable operational reality for a small platform.

**Daily responsibilities:**
- Review all open `DisputeRecord` items — confirm none are stuck in `EVIDENCE_COLLECTION` beyond 48h
- For any D-04 (AI/platform error): personally review and respond within 4 hours
- For any D-09 (guest property damage): coordinate directly with homeowner

**Weekly responsibilities:**
- Review closed disputes: were resolutions fair? Were they consistent?
- Identify patterns: same partner repeatedly causing D-05/D-06? Same property generating D-01s?
- Update platform policy or partner status based on patterns

**Escalation to legal:**
Any dispute involving:
- Claimed financial amount over €[threshold — TBD]
- Physical injury
- Insurance claim
- Threat of legal action
- Regulatory complaint

...must be referred to legal counsel within 24 hours of identification.

**Scaling indicator:** When the platform has resolved 50+ disputes without a pattern of inconsistency, and dispute volume exceeds 5 per week, a part-time customer success or trust-and-safety role should be created.

---

## Related Documents

- [escalation-rules.md](../ai-concierge/escalation-rules.md) — TRIGGER-06 and TRIGGER-07 which surface disputes
- [partner-vetting.md](partner-vetting.md) — Suspension criteria for partners with dispute patterns
- [partner-agreement.md](../legal/partner-agreement.md) — Contractual basis for homeowner-partner disputes
- [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) — Legal framework governing disputes
- [data-models.md](../backend/data-models.md) — DisputeRecord model
