# Partner Vetting

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch · All partner service types
**Last updated:** 2026-05-28
**Related:** [partner-agreement.md](../legal/partner-agreement.md) · [dispute-resolution.md](dispute-resolution.md) · [data-models.md](../backend/data-models.md) · [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) · [partner-onboarding.md](../onboarding/partner/partner-onboarding.md)

---

## Purpose

This document defines the criteria, process, and ongoing model for vetting service partners on the Nauxica platform. It governs who can join, what they must demonstrate before activation, how they are monitored during active status, and what triggers suspension or removal.

Partners are the operational backbone of the platform. The guest's experience of Nauxica is shaped directly by partner quality. Vetting is therefore not a bureaucratic exercise — it is a quality and safety control.

---

## Operating Principles

**1. Trust is earned, not assumed.**
A new partner application is reviewed before any job requests are sent. No partner receives a request on the same day they register.

**2. Vetting depth matches risk.**
Partners who enter guest accommodation (cleaning, maintenance) face higher vetting requirements than partners who work externally (transfers, experiences). The process is tiered accordingly.

**3. Ongoing behaviour matters as much as initial vetting.**
A clean application record is not a permanent pass. Job quality, dispute history, and responsiveness are monitored continuously and feed into ongoing status.

**4. The homeowner is the partner's client — Nauxica is the platform.**
Nauxica vets partners for platform fitness. Homeowners may choose to run their own additional checks — particularly for long-term preferred partner relationships. This is encouraged but not required.

**5. Human review at MVP.**
There is no automated partner approval. Every application is reviewed by a Nauxica team member (or the founder) before approval. Automation of lower-risk checks can be introduced post-MVP.

---

## Partner Service Types and Risk Classification

Five service categories are in scope at Sicily launch. Each carries a different trust profile based on physical access, financial exposure, and guest interaction.

| Service type | Guest access to property | Homeowner property access | Financial exposure | Trust tier |
|---|---|---|---|---|
| **Cleaning** | Unsupervised access between stays | Yes — full property | Low (consumables) | **Tier 2 — High** |
| **Maintenance** | Unsupervised or supervised access | Yes — full property | Medium (materials, potential damage) | **Tier 2 — High** |
| **Laundry** | Typically no property access (pickup/delivery) | Limited | Low | **Tier 1 — Standard** |
| **Transfers** | No property access | No | Low | **Tier 1 — Standard** |
| **Experiences** | No property access | No | Low-medium | **Tier 1 — Standard** |

---

## Vetting Tiers

### Tier 1 — Standard Vetting

**Applies to:** Transfers, Experiences, Laundry

| Requirement | Description | Verified by |
|---|---|---|
| Identity verification | Government-issued ID (passport or Italian carta d'identità) — uploaded to platform | Nauxica staff — document review |
| Phone number verification | SMS OTP confirmation | Automated |
| Email verification | Email confirmation link | Automated |
| Codice fiscale or P.IVA | Italian tax ID — confirms legal operating status | Nauxica staff — format + presence check |
| Service description | Description of services, operating area, typical availability | Self-declared + Nauxica review |
| Pricing (indicative) | Typical rates — not binding | Self-declared |
| Platform agreement | Partner Agreement signed digitally | Automated — signature required |
| Profile completeness | Photo, display name, bio | Required before activation |

**Approval timeline:** 24–48 hours from application completion.

---

### Tier 2 — High Vetting

**Applies to:** Cleaning, Maintenance

All Tier 1 requirements apply, plus:

| Requirement | Description | Verified by |
|---|---|---|
| Identity verification (enhanced) | Government-issued ID verified more carefully — cross-check name vs. tax ID | Nauxica staff |
| Background check consent | Partner consents to background check process | Signed consent form |
| Background check | Criminal record check (visura giudiziaria or equivalent) | ⚠️ Confirm available mechanism in Italy — see note below |
| Insurance (liability) | Public liability insurance certificate — minimum €[amount TBD] coverage | Document review — Nauxica staff |
| Insurance (maintenance only) | Professional indemnity or contractor insurance — if applicable | Document review |
| References (optional but recommended) | At least 2 references from prior property management clients | Nauxica contacts if provided |
| Initial job review | First 2–3 jobs are monitored more closely — homeowner feedback required | Nauxica operational monitoring |

**Approval timeline:** 3–5 working days from application completion.

> ⚠️ **Legal review required — Background checks in Italy:**
> Italian law is restrictive on private background check requests. Employers and businesses cannot freely request a *casellario giudiziario* (criminal record certificate) from a candidate — individuals must request their own certificate (*certificato del casellario giudiziale*) and provide it voluntarily. The partner must self-request and voluntarily submit their own certificate. Nauxica cannot directly query the public prosecutor's database. Confirm the legally permissible process with legal counsel, including what criminal history (if any) constitutes grounds for rejection.

---

## Required Documents by Partner Type

| Document | Cleaning | Maintenance | Laundry | Transfers | Experiences |
|---|---|---|---|---|---|
| Government-issued ID | Required | Required | Required | Required | Required |
| Codice fiscale or P.IVA | Required | Required | Required | Required | Required |
| Public liability insurance | Required | Required | Optional | Optional | Optional |
| Professional indemnity insurance | Not applicable | Recommended | Not applicable | Not applicable | Not applicable |
| Criminal record certificate (self-submitted) | Required | Required | Optional | Optional | Optional |
| Vehicle insurance (commercial use) | Not applicable | Not applicable | Not applicable | Required | Conditional |
| Vehicle roadworthiness (revisione) | Not applicable | Not applicable | Not applicable | Required | Conditional |
| Food handling certificate | Not applicable | Not applicable | Not applicable | Not applicable | Conditional (if food involved) |
| Tourism guide licence | Not applicable | Not applicable | Not applicable | Not applicable | ⚠️ Conditional — confirm if required for guided tours in Sicily |
| Signed Partner Agreement | Required | Required | Required | Required | Required |
| Bank/payment details (for direct billing) | Required | Required | Required | Required | Required |

---

## Insurance Requirements

⚠️ **Legal review required.** Minimum insurance coverage amounts must be confirmed with legal counsel and insurance advisers. The figures below are indicative and subject to revision.

| Insurance type | Minimum coverage | Partner type | Notes |
|---|---|---|---|
| Public liability (RC Terzi) | €500,000 (indicative) | Cleaning, Maintenance | Covers injury or damage caused to third parties |
| Professional indemnity | €100,000 (indicative) | Maintenance | Covers errors and omissions in professional work |
| Motor vehicle (commercial use) | As required by Italian law + RC Auto | Transfers | Must confirm policy covers commercial passenger transport |
| Employer's liability (INAIL) | As required by Italian law | Cleaning companies | Required if partner employs staff |

**Insurance verification process:**
1. Partner uploads insurance certificate during application
2. Nauxica staff reviews: issuer, policy number, coverage amount, expiry date, named insured
3. If policy expires during active status: platform sends 30-day renewal reminder
4. If policy lapses without renewal: partner status paused until renewed certificate is provided

---

## Approval Criteria

A partner application is approved when:

- All required documents have been submitted and reviewed
- Identity has been confirmed
- Background check result is within acceptable range (see Rejection Criteria)
- Insurance requirements are met (where applicable)
- Partner Agreement is signed
- Profile is complete to minimum standard
- Service description is coherent and specific
- No red flags identified during manual review (see Rejection Criteria)

---

## Rejection Criteria

An application is rejected if any of the following apply:

| Criteria | Tier applies to | Notes |
|---|---|---|
| Identity cannot be verified (ID document unclear, mismatched name) | All tiers | Reapplication permitted with new documentation |
| Criminal record includes violence, theft from property, or sexual offences | Tier 2 only | ⚠️ Confirm with legal counsel what categories are permissible grounds for rejection under Italian anti-discrimination law |
| Insurance certificate is invalid, expired, or for insufficient coverage | Tier 2 only | May reapply once valid insurance is obtained |
| Application details are inconsistent or appear fraudulent | All tiers | Case reviewed by founder; may be permanently rejected |
| Partner previously removed from Nauxica platform | All tiers | Permanent rejection unless founder review approves exception |
| Partner is on a sanctions list | All tiers | Permanent rejection; ⚠️ confirm applicable screening obligations with legal |
| Tourism guide operating without required licence (if applicable) | Experiences | Rejection until licence obtained |

### Rejection notification

Partners must be informed of rejection. The notification:
- Confirms the rejection
- States whether reapplication is permitted and under what conditions
- Does not share the specific criminal record content with other parties
- Does not imply discrimination based on protected characteristics

⚠️ **Legal review required:** Confirm that rejection criteria and notification process comply with Italian anti-discrimination law (D.Lgs. 9 luglio 2003, n. 216) and any applicable labour law considerations.

### Appeals

A rejected partner may appeal by:
1. Submitting a written appeal within 14 days of the rejection notice
2. Providing any additional documentation they believe resolves the rejection reason
3. The founder (at MVP) reviews all appeals personally
4. Appeal decision is final at MVP — no further escalation within the platform

---

## Ongoing Monitoring Model

Vetting at application is not sufficient. The following monitoring applies to all active partners.

### Automated triggers (platform-monitored)

| Event | Automated action |
|---|---|
| Insurance certificate expiry approaching (30 days) | Notification sent to partner to upload renewal |
| Insurance certificate lapsed | Partner status paused — no new job requests sent |
| 3 no-shows on confirmed jobs (within any 90-day period) | Auto-flag for manual review |
| 3 dispute records in any 90-day period | Auto-flag for manual review |
| Average rating drops below 3.5 (after minimum 10 reviews) | Auto-flag for manual review |
| Partner deactivates their account | Record preserved — reactivation requires confirmation of current document status |

### Manual review triggers (Nauxica staff)

| Event | Action |
|---|---|
| D-05 / D-06 / D-07 dispute confirmed against partner | Log in partner record; assess if suspension warranted |
| Homeowner complaint about partner conduct (non-dispute) | Investigate; log in partner record |
| Guest complaint about partner (transfer, experience, laundry) | Investigate; log in partner record |
| Pattern of low-quality job completion photos | Flag for homeowner feedback check |
| Partner found operating under different entity name | Investigate for identity or insurance mismatch |

### Periodic review

| Review | Frequency | Trigger |
|---|---|---|
| Insurance renewal verification | Annual or on expiry | Partner prompted; Nauxica verifies new cert |
| Document currency check | Annual | Confirm ID is still valid; request renewal if expired |
| Full re-review | On any suspension then reinstatement | Treat as new application for documents |

---

## Suspension Triggers

A partner's status is set to `suspended` under the following conditions. Suspension means: no new job requests are sent. Active jobs are not cancelled but are flagged for homeowner notification.

### Automatic suspension

| Trigger | Cooling-off period | Reinstatement condition |
|---|---|---|
| Insurance certificate lapsed | Immediate | Upload valid renewed certificate |
| 3 confirmed no-shows in 90 days | 14 days | Founder review + written commitment |
| Average rating below 3.0 after 10+ reviews | Until review | Founder review |

### Manual suspension (Nauxica decision)

| Trigger | Notes |
|---|---|
| D-07 confirmed (partner caused property damage) | Suspend pending investigation |
| Guest safety complaint against partner | Immediate suspension pending investigation |
| Partner found to be operating under false identity | Permanent removal |
| Criminal incident reported involving partner during platform job | Immediate suspension; refer to police; ⚠️ legal review required |
| Pattern of 3+ disputes across homeowners (not all confirmed) | Suspend for review |

### Reinstatement process

1. Partner submits written reinstatement request
2. Founder reviews partner record: dispute history, ratings, documents
3. If reinstated: first 5 jobs post-reinstatement are monitored with mandatory homeowner feedback
4. Second suspension: permanent removal (no reinstatement)

---

## Risk Classification Matrix

Summary classification used for operational triage.

| Rating | Risk level | Criteria |
|---|---|---|
| ⬜ **New** | Unknown | Fewer than 5 completed jobs on the platform |
| 🟢 **Low Risk** | Established | 10+ jobs, avg rating ≥ 4.0, no disputes, insurance current |
| 🟡 **Monitor** | Medium | 1–2 disputes resolved, rating 3.5–3.9, or documents approaching expiry |
| 🔴 **High Risk** | Elevated | 3+ disputes (any resolution), rating below 3.5, or suspension history |
| ⛔ **Suspended** | Inactive | Currently suspended — see triggers above |

The risk classification is an internal operational tool. It is not shown to homeowners or partners directly. It informs how proactively Nauxica monitors a given partner's jobs.

---

## Founder MVP Operational Role

At MVP, the founder manages all partner vetting and monitoring decisions.

**Per application:**
- [ ] Review each Tier 2 application personally before approval
- [ ] Tier 1 applications can be approved by any trained team member — founder spot-checks 20%
- [ ] Rejection decisions confirmed in writing (platform record)

**Ongoing:**
- [ ] Weekly review of all auto-flagged partners (insurance expiry, no-shows, rating drops)
- [ ] Monthly review of all active partners in `Monitor` or `High Risk` classification
- [ ] Personal review of every D-07 (partner caused damage) dispute

**Scaling indicator:** When partner volume exceeds 30 active partners, a dedicated operations or trust-and-safety role is required to sustain this monitoring model without degradation.

---

## Related Documents

- [partner-onboarding.md](../onboarding/partner/partner-onboarding.md) — Partner application journey
- [partner-agreement.md](../legal/partner-agreement.md) — Contractual terms governing the partner relationship
- [dispute-resolution.md](dispute-resolution.md) — What happens when a partner dispute is filed
- [data-models.md](../backend/data-models.md) — User (partner) model — vetting fields
- [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) — GDPR handling of vetting documents
