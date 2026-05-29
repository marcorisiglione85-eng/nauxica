# Partner Scoring Model

**Version:** 1.0
**Status:** Draft — Architecture phase. MVP scoring is manual; automated calculation is post-MVP.
**Scope:** Sicily launch · Partner trust and reliability assessment
**Last updated:** 2026-05-29
**Related:** [partner-vetting.md](partner-vetting.md) · [dispute-resolution.md](dispute-resolution.md) · [document-glossary.md](../architecture/document-glossary.md) · [legal-review-tracker.md](../legal/legal-review-tracker.md)

---

## Purpose

This document defines the Trust Score and Reliability Score as operational concepts for the
Nauxica platform. Both scores are operator-assessed at MVP — they inform decisions but do not
trigger automated platform actions.

These scores are referenced in `partner-vetting.md` and defined canonically here.

---

## Trust Score

**Definition:** A 0–100 signal representing the operator's confidence that a partner will
behave safely, honestly, and in accordance with their stated service profile.

**Scale:**

| Band | Range | Interpretation |
|---|---|---|
| Not activatable | 0–39 | Do not approve |
| Conditional | 40–59 | Activate with additional monitoring |
| Standard | 60–79 | Activate on normal terms |
| High trust | 80–100 | Eligible for preferred partner assignment and priority routing |

**Inputs at MVP (operator-assessed, not automated):**

| Input | Description |
|---|---|
| Vetting completeness | Did the partner supply all required documents? Were they credible? |
| Reference quality | Did references respond positively and specifically? |
| Application accuracy | Did stated skills and service area match verification? |
| Dispute history | Active unresolved disputes reduce score; resolved disputes reviewed case-by-case |
| Operator flags | Any concerns noted during review or monitoring |

**What Trust Score is NOT used for at MVP:**
- Automated partner suspension — operator reviews before any suspension action
- Public display to homeowners
- Automated job routing priority
- Any contractual commitment to the partner about their score

---

## Reliability Score

**Definition:** A 0–100 signal representing the operator's assessment of a partner's
operational dependability — whether they show up, respond promptly, and complete jobs.

**Scale:** Same banding as Trust Score (0–39 / 40–59 / 60–79 / 80–100).

**Inputs at MVP (operator-assessed, not automated):**

| Input | Description |
|---|---|
| Response rate | Does the partner respond to job requests within the stated window? |
| Job completion rate | Do they complete jobs they accept? |
| No-show / cancellation history | Any confirmed no-shows or late cancellations without notice |
| Homeowner feedback | Reported via the platform after job completion |
| Dispute outcomes | Jobs that resulted in formal disputes reduce score |

**What Reliability Score is NOT used for at MVP:**
- Automated partner suspension — operator reviews before any suspension action
- Public display to homeowners
- Binding SLA commitments to partners

---

## MVP Assessment Process

1. Operator reviews inputs listed above after each vetting stage and after each completed job.
2. Scores are recorded in the partner's operator dashboard record.
3. No automated calculation or weighting formula is applied at MVP.
4. Score changes that affect activation status (e.g. dropping below 40) require an explicit
   operator decision with a reason logged in the audit trail.
5. Partners are not notified of their scores at MVP.

---

## Post-MVP Intentions (Non-Binding)

- Automate score calculation from platform event data (response time, completion rate)
- Surface a homeowner-visible signal with an explicit caveat that it is Nauxica-assessed
- Define score thresholds that trigger automated review flags (not automated suspension)

These are architectural intentions, not commitments. They require founder approval before implementation.

---

## Related Documents

- [partner-vetting.md](partner-vetting.md) — Vetting criteria and activation process that feed Trust Score
- [dispute-resolution.md](dispute-resolution.md) — Dispute outcomes that affect both scores
- [document-glossary.md](../architecture/document-glossary.md) — Canonical definitions of Trust Score and Reliability Score
- [legal-review-tracker.md](../legal/legal-review-tracker.md) — Legal review status for all platform obligations
