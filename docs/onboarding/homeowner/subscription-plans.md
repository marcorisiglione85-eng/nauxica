# Subscription Plans

**Version:** 1.0
**Status:** Draft — Architecture phase. Pricing is indicative and subject to founder decision.
**Scope:** Sicily launch · Homeowner and partner plans
**Last updated:** 2026-05-28
**Related:** [homeowner-onboarding.md](homeowner-onboarding.md) · [partner-onboarding.md](../partner/partner-onboarding.md) · [terms-of-service.md](../../legal/terms-of-service.md) · [data-models.md](../../backend/data-models.md)

> **Note on pricing:** Specific price points are placeholders in this document. Final pricing is a founder decision that should be confirmed before the first subscription is sold. This document defines the structural architecture — what each plan includes, how plans relate to each other, and how the commercial model works operationally.

---

## Revenue Model Overview

Nauxica generates revenue from three sources:

| Source | Model | Applies to |
|---|---|---|
| **Homeowner subscriptions** | Monthly/annual recurring fee | Property owners |
| **Partner subscriptions** | Monthly/annual recurring fee | Service partners |
| **Service coordination commission** | Percentage of job value, on Nauxica-coordinated jobs only | Optional — applies only where Nauxica actively connects homeowner to a partner for a specific job |

**What Nauxica does not earn from:**
- Guest bookings (no booking commission)
- Tourist tax (not collected or remitted by platform)
- Direct homeowner-to-partner transactions (direct billing model)
- OTA referrals or affiliate revenue at MVP

---

## Section 1 — Homeowner Plans

Three tiers. A homeowner selects one plan at registration. Plan tier applies to their entire account and all properties on that account.

### Plan comparison

| Feature | Starter | Professional | Premium |
|---|---|---|---|
| **Monthly price (indicative)** | €[X]/mo | €[XX]/mo | €[XXX]/mo |
| **Annual price (indicative)** | €[X×10]/yr | €[XX×10]/yr | €[XXX×10]/yr |
| **Annual saving** | ~2 months free | ~2 months free | ~2 months free |
| **Properties included** | 1 | Up to 3 | Up to 10 |
| **Additional properties** | Not available | €[X]/mo each | €[X]/mo each |
| **AI concierge (WhatsApp)** | ✓ 1 property | ✓ All properties | ✓ All properties |
| **Proactive guest messages** | Check-in + checkout only | Full schedule (MSG-01 to MSG-05) | Full schedule + custom messages |
| **Partner marketplace access** | ✓ Post ad-hoc requests | ✓ Full marketplace | ✓ Full marketplace + preferred partners |
| **Preferred partner assignment** | — | ✓ Up to 3 per property | ✓ Unlimited |
| **Operations dashboard** | ✓ Basic | ✓ Full | ✓ Full |
| **Revenue reporting** | ✓ Basic (occupancy + bookings) | ✓ Standard | ✓ Advanced (with trend analysis) |
| **Task management** | ✓ Manual | ✓ With reminders | ✓ With automation suggestions |
| **Calendar sync (OTA)** | — | ✓ 1 OTA | ✓ Unlimited OTAs |
| **Guest review management** | ✓ View | ✓ View + respond | ✓ View + respond + insights |
| **Nauxica support SLA** | Email — 48h | Email — 24h | Priority — 4h |
| **Onboarding assistance** | Self-service | Self-service + 1 onboarding call | Assisted onboarding included |
| **AI knowledge base updates** | Self-service | Self-service | Assisted updates available |

---

### Plan details

#### Starter — Single property, essential operations

**For:** Homeowners with one property who want AI concierge and basic operations management.

**AI concierge scope on Starter:**
- Guest identification and knowledge block delivery
- Check-in day message (MSG-03) and checkout reminder (MSG-05)
- Reactive responses to all guest questions (full topic routing)
- Escalation model fully active (L1/L2/L3)

**Proactive messages on Starter:**
- MSG-03 (check-in day) — included
- MSG-05 (checkout reminder) — included
- MSG-01 (booking confirmation), MSG-02 (pre-arrival), MSG-04 (mid-stay) — not included
  - *Rationale:* These proactive messages require homeowner booking data integration to trigger reliably. On Starter, booking confirmation is entered manually, which makes automated triggering unreliable at MVP. Upgrade to Professional to unlock the full schedule.

**What Starter does not include:**
- Multi-property management
- Calendar sync with OTAs
- Custom WhatsApp message templates beyond the standard schedule

---

#### Professional — Up to 3 properties, full operations

**For:** Small portfolio owners (2–3 properties) who want full AI concierge coverage and operational integration.

**AI concierge scope on Professional:**
- All Starter capabilities
- Full proactive message schedule (MSG-01 through MSG-06)
- Mid-stay check-in message (MSG-04)
- Booking confirmation welcome (MSG-01) triggered on booking import

**Operations scope on Professional:**
- Full partner marketplace access — browse and request all 5 partner types
- Preferred partner assignment per property — streamlines repeated job flows
- Calendar sync with 1 OTA — reduces double-booking risk
- Revenue reporting — occupancy, ADR (average daily rate), booking count per period

---

#### Premium — Up to 10 properties, full portfolio management

**For:** Property managers and multi-unit homeowners who need portfolio-level operations.

**AI concierge scope on Premium:**
- All Professional capabilities
- Custom message scheduling (founder-approved — delivered by Nauxica ops team at MVP, not self-service)
- Assisted knowledge base updates — Nauxica team reviews and refreshes property knowledge blocks on request

**Operations scope on Premium:**
- Unlimited preferred partner assignments
- Unlimited OTA calendar sync
- Advanced revenue reporting with period-over-period trends
- Priority support — 4-hour response commitment

---

### Homeowner add-ons

Available on top of any plan. Pricing indicative.

| Add-on | Price | Description |
|---|---|---|
| Additional property | €[X]/mo each | Add a property beyond the plan limit |
| Assisted property onboarding | One-time €[X] per property | Nauxica team completes property knowledge base and review |
| Annual knowledge base refresh | One-time €[X] per property | Nauxica team re-verifies and updates all property AI content |
| Partner coordination (commission-based) | [X]% of job value | Nauxica actively matches homeowner with a partner for a specific job — commission on that job only |

---

## Section 2 — Partner Plans

Two tiers for service partners. Partner plans control visibility on the marketplace and commission structure for Nauxica-coordinated jobs.

### Plan comparison

| Feature | Basic | Professional |
|---|---|---|
| **Monthly price (indicative)** | €[X]/mo | €[XX]/mo |
| **Annual price (indicative)** | €[X×10]/yr | €[XX×10]/yr |
| **Marketplace listing** | ✓ Listed | ✓ Featured listing |
| **Inbound job requests** | ✓ Unlimited | ✓ Unlimited + priority routing |
| **Preferred partner assignments (from homeowners)** | ✓ Can be assigned | ✓ Can be assigned |
| **Job calendar** | ✓ Basic | ✓ Full with reminders |
| **Earnings dashboard** | ✓ Basic | ✓ Full with history |
| **Reviews management** | ✓ View | ✓ View + respond |
| **Performance insights** | — | ✓ Job acceptance rate, rating trends |
| **Commission on Nauxica-coordinated jobs** | [X]% | [X - discount]% |
| **Support SLA** | Email — 48h | Email — 24h |

---

### Partner plan details

#### Basic — Standard marketplace access

**For:** Individual operators or small businesses wanting standard marketplace listing and job request access.

All inbound requests from homeowners (direct requests, not Nauxica-coordinated) come at no commission — the partner bills the homeowner directly.

Commission applies only to **Nauxica-coordinated jobs** — where Nauxica actively matches the homeowner to this partner for a specific job and earns a coordination fee.

#### Professional — Featured visibility and reduced commission

**For:** Established partners who want higher marketplace visibility and better commission terms on coordinated jobs.

Featured listing: Professional partners appear above Basic partners in marketplace search results for their service type and area. Within the same tier, ranking is by rating.

---

## Section 3 — Commission on Nauxica-Coordinated Jobs

The commission model applies only when Nauxica actively coordinates a match between a homeowner who has no preferred partner for a service type and a partner on the platform.

**When commission applies:**
- Homeowner creates a job request with no preferred partner assigned
- Nauxica matches a suitable partner based on service type, area, availability, and rating
- Partner accepts the job
- Job is completed

**When commission does not apply:**
- Homeowner sends a request directly to a preferred partner they assigned themselves
- Homeowner contacts a partner directly outside the platform
- Partner is introduced to a homeowner via a personal referral outside the platform

**Commission mechanics:**

| Element | Description |
|---|---|
| Commission rate (Basic partner) | [X]% of agreed job value |
| Commission rate (Professional partner) | [X - discount]% of agreed job value |
| Collection method | At MVP (direct billing model): homeowner pays partner; partner invoices Nauxica commission separately. ⚠️ This requires clear invoicing terms in the Partner Agreement. |
| Minimum commission | €[X] per coordinated job (if percentage is below this) |
| Commission disputes | Filed as D-08 variant — Nauxica reviews |

⚠️ **Legal review required:** The commission collection mechanism requires a clear contractual basis in the Partner Agreement. Confirm whether this constitutes agency, intermediation, or another legal relationship under Italian commercial law. Confirm VAT treatment of commissions.

---

## Section 4 — What No Plan Includes

The following capabilities are outside all plan tiers and are not available at MVP, regardless of plan.

| Excluded capability | Notes |
|---|---|
| Automated payment processing between homeowner and partner | Direct billing model — Nauxica does not process inter-party payments at MVP |
| Tourist tax collection or remittance | Homeowner's legal obligation — see regulatory-compliance-checklist.md |
| Legal advice or contract drafting | Outside platform scope |
| Insurance brokerage | Outside platform scope |
| Alloggiati Web guest registration on homeowner's behalf | Legal service requiring formal agency arrangement |
| Guaranteed partner availability | Partners control their own availability — Nauxica does not guarantee job acceptance |
| Guaranteed AI response accuracy on uncompleted knowledge blocks | AI performs only as well as the data provided — incomplete knowledge blocks produce degraded responses |
| 24/7 live human support (any plan) | MVP is human-assisted, not 24/7 staffed. Founder and team respond within stated SLAs |

---

## Section 5 — Free Trial Architecture

**Trial period (indicative):** 14–30 days free on any plan. Subject to founder decision.

**Trial rules:**
- Full feature access at the trial plan tier
- No credit card required to start trial — ⚠️ confirm payment processor requirements
- Trial ends automatically after the trial period; subscription requires payment method to continue
- Properties activated during trial: remain active if subscription begins; deactivated if subscription does not begin
- Guest conversations started during trial: continue for the duration of the active booking regardless of subscription status — ⚠️ Confirm handling in Terms of Service
- Trial not repeatable: one trial per user account

---

## Section 6 — Upgrade and Downgrade Logic

### Upgrading

- Available at any time via account settings
- New plan tier takes effect immediately
- Billing: prorated upgrade charge for the remaining days of the billing period
- Additional properties unlocked immediately upon upgrade

### Downgrading

- Takes effect at the end of the current billing period (not immediately)
- Properties above the lower plan limit: homeowner must select which properties to deactivate or pay for as add-ons
- AI concierge for deactivated properties: deactivated at the billing period end
- Homeowner receives 7-day advance notice before downgrade takes effect and properties are deactivated

### Cancellation

- Account can be cancelled at any time
- Cancellation takes effect at end of current billing period
- Active bookings with active guest conversations: AI concierge remains active for the duration of confirmed bookings, then deactivates
- Data retention: homeowner data retained per the retention policy in regulatory-compliance-checklist.md
- ⚠️ Legal review required: Define refund policy for cancellation mid-period in Terms of Service

---

## Section 7 — Operational Scalability Assumptions

These assumptions govern what the platform can support at each phase of growth. They are operational constraints at MVP, not permanent limits.

| Phase | Active properties | Partner accounts | Support model | AI concierge coverage |
|---|---|---|---|---|
| **Alpha / pre-launch** | 1–5 | 5–15 | Founder only | Manual knowledge block population; founder reviews all sessions |
| **MVP** | 5–20 | 15–50 | Founder + 1 part-time ops | Knowledge base self-service with founder review; monitored escalations |
| **Early growth** | 20–100 | 50–200 | Small ops team (2–3 people) | Full self-service knowledge base; automated monitoring |
| **Scale** | 100+ | 200+ | Dedicated team + tooling | Automated quality checks; escalation workflows fully tooled |

**Commission model sustainability:** The direct billing + commission model is appropriate for MVP. At scale (100+ active properties), the operational overhead of tracking and invoicing individual commissions becomes unmanageable without payment infrastructure. The move to Nauxica processing payments (marketplace model) should be evaluated at the Early Growth phase. ⚠️ This change has significant legal and regulatory implications (payment service provider licensing, PSD2 compliance) and requires early planning.

---

## Section 8 — Pricing Governance

**Who sets prices:** The founder sets all prices for homeowner and partner plans, add-ons, and commission rates. Prices are not set by the platform team without founder approval.

**How prices change:**
- Existing subscribers receive 30 days' notice of any price change
- Price increases: take effect at the next billing period after the notice period
- Existing subscribers may cancel without penalty if they do not accept the new price
- New plans do not change existing subscribers' prices without notice

**Grandfathering:** At MVP, early subscribers (first [N] — founder decision) may be offered a founding-member price that is locked for [period — founder decision]. This is a commercial decision and must be documented in the subscription agreement.

⚠️ **Legal review required:** Price change notification requirements under Italian consumer law (Codice del Consumo) and EU distance selling regulations apply. Confirm minimum notice period and format.

---

## Related Documents

- [homeowner-onboarding.md](homeowner-onboarding.md) — Where plans are selected in the homeowner journey
- [partner-onboarding.md](../partner/partner-onboarding.md) — Where plans are selected in the partner journey
- [terms-of-service.md](../../legal/terms-of-service.md) — Contractual basis for subscriptions
- [regulatory-compliance-checklist.md](../../legal/regulatory-compliance-checklist.md) — Legal framework for subscriptions and commissions
- [data-models.md](../../backend/data-models.md) — `nauxica_plan_tier` field on User and Property models
