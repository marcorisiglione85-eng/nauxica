# Legal Review Tracker

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch · Nauxica platform
**Last updated:** 2026-05-28
**Audience:** Founder, legal counsel, operations team
**Related:** [regulatory-compliance-checklist.md](regulatory-compliance-checklist.md) · [security-model.md](../architecture/security-model.md) · [subscription-plans.md](../onboarding/homeowner/subscription-plans.md) · [partner-vetting.md](../trust-safety/partner-vetting.md) · [dispute-resolution.md](../trust-safety/dispute-resolution.md) · [launch-readiness.md](../architecture/launch-readiness.md)

> **Disclaimer:** This document consolidates legal review items from across the Nauxica architecture documentation. It does not constitute legal advice and must not be treated as such. Every item requires review by a qualified Italian and EU lawyer before the corresponding gate can be cleared. Do not use the summaries of law in this document as definitive statements of legal obligation.

---

## Purpose

This tracker centralises every legal review requirement currently scattered across six source documents. Its purpose is to give the founder and legal counsel a single working list: what must be resolved, in what order, and with what urgency.

---

## How to Use This Tracker

**Risk levels:**

| Level | Meaning |
|---|---|
| CRITICAL | Blocks platform operation or exposes Nauxica to regulatory sanction. Must be resolved before any live guest data is processed. |
| HIGH | Significant legal exposure if unresolved. Resolving at MVP is strongly recommended. |
| MEDIUM | Operational or contractual risk. Can follow first live property in most cases, but should not be deferred past Pilot. |
| LOW | Procedural or advisory. Resolve before Scale. |

**Gate columns:** "Yes" = must be resolved before this phase. "No" = not required at this phase.

**Owner:** The party responsible for driving this item to resolution.
- *Legal Counsel* — requires an external qualified Italian/EU lawyer.
- *Founder* — commercial decision; lawyer may draft but founder decides.
- *Nauxica Ops* — operational step once legal position is confirmed.

**Status:** All items are `Open` at document creation. Update to `In Progress`, `Awaiting Opinion`, or `Resolved` as items advance.

---

## Part 1 — Corporate and Entity Setup

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-01 | regulatory-compliance-checklist.md LB-09 | Nauxica legal entity must be registered in Italy (or an EU jurisdiction with Italian nexus) to have contractual capacity, issue invoices, collect subscriptions, and sign agreements with homeowners, partners, and suppliers. Without a registered entity, no enforceable contract can be formed and no subscription revenue can lawfully be collected. | CRITICAL | Yes | Yes | Yes | Founder | Open | Register entity (e.g. S.r.l.) with Italian Camera di Commercio or confirm equivalent EU registration with Italian nexus. Obtain P.IVA. Confirm jurisdiction with legal counsel. |
| LR-02 | regulatory-compliance-checklist.md Section G | Confirm GDPR supervisory authority jurisdiction. If operating in Italy, the primary supervisory authority is the Garante per la Protezione dei Dati Personali. Confirm whether registration with the Garante is required. Organisations under 250 employees may be exempt from some registration obligations — confirm scope. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) primary supervisory authority for Nauxica; (2) whether registration is required; (3) any applicable exemptions for small organisations. |

---

## Part 2 — Legal Documents

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-03 | regulatory-compliance-checklist.md LB-03; Section G | Terms of Service is a stub with no legal content. Required before the first homeowner or partner registers on the platform. Must cover: platform liability, dispute resolution clause, subscription auto-renewal, cancellation, refund policy, AI error liability cap, and price change notification obligations. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Commission Italian/EU lawyer to draft full Terms of Service. Brief includes all items listed in Description plus: Italian consumer law compliance, EU distance selling compliance, ODR platform reference (EU Regulation 524/2013). |
| LR-04 | regulatory-compliance-checklist.md LB-02; Section G | Privacy Policy is a stub with no legal content. Required before any personal data is collected — GDPR Art. 13 mandates transparency at the point of data collection. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Commission lawyer to draft GDPR-compliant Privacy Policy covering: data categories processed, purposes, legal bases, retention periods, data subject rights (access, erasure, rectification, portability), processor list, supervisory authority contact, Garante contact details. |
| LR-05 | regulatory-compliance-checklist.md Section G | Cookie Policy does not exist. Required before the platform website goes live under Italian implementation of the ePrivacy Directive. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Commission lawyer to draft Cookie Policy. Confirm which cookies are technically necessary (no consent required) vs consent-required. Confirm format of cookie banner compliant with Garante guidelines. |
| LR-06 | regulatory-compliance-checklist.md LB-04; Section G | Partner Agreement is a stub with no legal content. Required before any partner is activated on the platform. Must cover: service standards, commission terms, liability, non-payment consequences, dispute resolution, suspension and removal, data processing obligations, anti-discrimination compliance. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Commission lawyer to draft Partner Agreement. Include: commission characterisation (see LR-23), Nauxica authority to suspend (see LR-25), criminal incident obligations (see LR-29), sanctions screening commitment. |
| LR-07 | regulatory-compliance-checklist.md LB-10; Section G | Homeowner Subscription Agreement does not exist as a standalone document. Required before any homeowner pays for a subscription. Must cover: plan terms, auto-renewal, cancellation, refund policy, price change notification (30-day notice), and grandfathering provisions if offered. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Commission lawyer to draft Homeowner Subscription Agreement. Coordinate with ToS (LR-03) to avoid duplication and conflict. Confirm Codice del Consumo requirements for distance contracts with consumers. |
| LR-08 | regulatory-compliance-checklist.md LB-08; Section G | Data Processing Agreements (DPAs) with all data processors do not exist. Required under GDPR Art. 28 before processing begins. Known processors: Meta (WhatsApp Business API), hosting/cloud provider, AI/LLM model provider. | CRITICAL | Yes | Yes | Yes | Nauxica / Legal Counsel | Open | Identify all processors. Sign Meta's standard DPA for WhatsApp Business API. Negotiate and sign DPAs with hosting provider and LLM provider. Confirm DPAs are executed before first guest data is processed. |
| LR-09 | regulatory-compliance-checklist.md Section C; Section G | A Data Processing Agreement between Nauxica and homeowners may be required if homeowners are classified as data controllers for guest identification data (passport/ID numbers) that Nauxica collects and stores on their behalf for Alloggiati Web purposes. Classification depends on LR-11. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Await LR-11 outcome. If homeowners are controllers for this data: draft a homeowner DPA and include it in the onboarding flow. If joint controllers: confirm joint controller arrangement in writing. |
| LR-10 | regulatory-compliance-checklist.md Section G; Section D | Record of Processing Activities (RoPA) does not exist. Required under GDPR Art. 30 before processing begins. The data processing inventory in regulatory-compliance-checklist.md Section D provides the architecture for the RoPA. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to complete the formal RoPA from the processing inventory in Section D. Confirm whether Garante registration or notification is separately required. |

---

## Part 3 — GDPR and Data Protection

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-11 | regulatory-compliance-checklist.md Section D | Controller/processor classification for each processing activity has not been confirmed with legal counsel. Nauxica's role varies by data category — potentially sole controller (guest WhatsApp comms), joint controller (booking data with homeowner), or processor (guest identification data on behalf of homeowners). The classification drives DPA requirements, Privacy Policy obligations, and liability allocation across all other GDPR items. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Priority item. Legal counsel to review the processing activity table in regulatory-compliance-checklist.md Section D and issue a written classification for each activity. This output is a prerequisite for LR-09 and LR-10. |
| LR-12 | regulatory-compliance-checklist.md LB-01; Section D | Lawful basis for WhatsApp guest communications must be confirmed before the first message is sent. Architecture recommendation: consent (GDPR Art. 6(1)(a)) as primary basis; contract performance (Art. 6(1)(b)) for safety-critical messages only. Consent must not be bundled with Terms of Service acceptance. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm the recommended basis is defensible under Italian GDPR implementation. Implement consent mechanism at booking: affirmative opt-in, separate from ToS, with specific language naming the WhatsApp AI concierge. Confirm emergency message basis separately (vital interests or contract performance). |
| LR-13 | regulatory-compliance-checklist.md Section E | All data retention periods in Section E are provisional and flagged for legal confirmation. Italian law imposes minimum and maximum retention periods for several categories that may differ from a GDPR-only analysis. Priority categories: guest document numbers (Alloggiati Web audit requirement), booking records (civil and tax law), WhatsApp conversation logs, escalation records, partner vetting documents. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to review each retention period in Section E and issue confirmed durations. Flag any categories where Italian law imposes a retention obligation that conflicts with GDPR minimisation principles — document how the conflict is resolved. |
| LR-14 | regulatory-compliance-checklist.md Section C; security-model.md §8.2 | Nauxica collects guest document numbers (passport/ID card) as a convenience for homeowners completing Alloggiati Web registration. This constitutes processing of document data — the GDPR legal basis, required security measures (encryption at rest is designed; confirm sufficiency), and DPA obligations with homeowners must all be confirmed. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) lawful basis for Nauxica processing passport/ID data (currently proposed: legal obligation, Art. 6(1)(c)); (2) whether the encryption and access controls in security-model.md §6 are sufficient under GDPR Art. 32; (3) DPA obligations (see LR-09). |
| LR-15 | security-model.md §13; §15 | GDPR principles compliance across all data processing must be reviewed before deployment. Breach response procedure must be in place: (1) Garante notification within 72 hours of becoming aware of a breach (GDPR Art. 33); (2) notification to affected individuals where the breach causes high risk to their rights and freedoms (Art. 34). A documented breach response procedure is required even in brief form at MVP. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to: (1) confirm GDPR compliance of the security architecture in security-model.md §13; (2) draft a brief breach response procedure covering: identification → severity assessment → Garante notification (72h window) → individual notification if Art. 34 applies → record-keeping. |

---

## Part 4 — Short-Term Rental Regulation

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-16 | regulatory-compliance-checklist.md LB-05; Section A | CIR/CIN code requirement is in legislative transition. The regional CIR (D.L. 50/2017) and the national CIN (D.L. 145/2023 — Banca Dati delle Strutture Ricettive) may both apply concurrently in Sicily. The correct code format for platform validation, the display obligations on listing pages, and whether dual compliance is required must be confirmed before any property is activated. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) current applicable requirement for short-term rentals in Sicily as of the launch date; (2) whether CIR, CIN, or both are required per property; (3) correct format for regex validation; (4) display obligations on listing pages and in booking confirmations. |
| LR-17 | regulatory-compliance-checklist.md Section B | Tourist tax (tassa di soggiorno, D.Lgs. 23/2011 Art. 4) is a municipal tax — each comune sets its own rate, duration cap, and exemptions. Nauxica stores homeowner-entered rates but does not collect or remit. The responsibility allocation (homeowner collects and remits; Nauxica stores and informs only) must be confirmed as legally sound, including Nauxica's liability exposure if a homeowner provides an incorrect rate. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) the responsibility allocation is legally correct; (2) Nauxica's liability exposure if the homeowner-entered rate is wrong; (3) whether Nauxica has any notification obligation if a municipal rate changes that it becomes aware of. |
| LR-18 | regulatory-compliance-checklist.md LB-06; Section C | Alloggiati Web obligation (D.M. 7 gennaio 2013) falls on the homeowner as accommodation operator. Nauxica collects ID data as a convenience but does not register guests. The responsibility allocation, and any liability Nauxica bears by collecting and storing this data without directly registering, must be confirmed. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) responsibility allocation is legally sound and homeowner cannot shift liability to Nauxica; (2) Nauxica's collection and storage of ID data does not constitute acting as the homeowner's agent without a formal agency agreement; (3) confirm applicable exemptions to the Alloggiati Web obligation with legal counsel. |

---

## Part 5 — Commercial and Subscription Law

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-19 | subscription-plans.md §6; dispute-resolution.md | Refund policy for subscription cancellation mid-billing period is undefined. Italian consumer law (Codice del Consumo, D.Lgs. 206/2005) and EU distance selling and digital services directives govern minimum refund entitlements. The refund policy must be defined before subscriptions are sold and included in both the Terms of Service and the Homeowner Subscription Agreement. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to advise on minimum statutory refund obligations for digital subscription services under Italian/EU consumer law. Draft refund policy for inclusion in ToS and Subscription Agreement. |
| LR-20 | subscription-plans.md §8 | Price change notification requirements under Codice del Consumo and EU distance selling regulations must be confirmed. The platform architecture assumes 30-day advance notice — the minimum notice period, required delivery format (email, in-app, written), and the subscriber's right to cancel without penalty must be confirmed. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) minimum statutory notice period for price changes; (2) required delivery channel and format; (3) whether subscribers must be given an option to cancel before the new price takes effect. Reflect confirmed rules in subscription-plans.md §8 and in the Subscription Agreement. |
| LR-21 | subscription-plans.md §5 | Trial period handling in the Terms of Service requires two legal confirmations: (1) guest WhatsApp conversations started during a free trial — the platform architecture proposes these continue for the duration of an active booking after the trial ends; this must be reflected in the ToS; (2) trials without a credit card on file — confirm payment processor requirements for fraud prevention and chargeback exposure. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to draft trial terms for inclusion in ToS. Confirm continuation of AI concierge during active bookings post-trial-end is enforceable. Confirm with payment processor whether card-free trials are operationally viable. |
| LR-22 | subscription-plans.md §8 | Grandfathering of founding-member pricing (if offered) must be documented in the Homeowner Subscription Agreement. The enforceability of a pricing lock for a defined period, and the conditions under which Nauxica can end a grandfathered price, must be confirmed under Italian contract law. | LOW | No | Yes | Yes | Founder + Legal Counsel | Open | Once founder decides whether to offer grandfathered pricing: document terms in Subscription Agreement (duration of lock, conditions for termination). Legal counsel to confirm enforceability under Italian contract law. |

---

## Part 6 — Commission and Payment Law

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-23 | subscription-plans.md §3 | Commission on Nauxica-coordinated jobs must be characterised under Italian commercial law. The characterisation — agency, intermediation (mediazione), or another model — determines: VAT treatment of the commission, required contractual terms in the Partner Agreement, and Nauxica's potential liability for the underlying service quality. Commission is invoiced from partner to Nauxica under the direct billing model at MVP. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to advise on the correct legal characterisation of the commission model under Italian commercial law (Codice Civile). Issue written opinion on VAT treatment (IVA) of commissions before the first commission is earned. Draft commission clause for Partner Agreement. |
| LR-24 | subscription-plans.md §7 | At scale (100+ active properties), transitioning from direct billing to Nauxica processing payments between homeowners and partners (marketplace model) triggers PSD2 obligations (EU Directive 2015/2366 and its successor PSD3) and potential payment service provider licensing. This change has significant regulatory lead time and must be planned early — do not leave it until the operational need arises. | HIGH | No | No | Yes | Founder + Legal Counsel | Open | Legal counsel to advise on PSD2/PSD3 applicability timeline and licensing pathway. Begin scoping payment infrastructure and licensing requirements during the Pilot phase. Note: this is a Scale-phase legal requirement but needs planning from Pilot. |
| LR-25 | dispute-resolution.md §F (D-08) | The extent of Nauxica's authority to sanction homeowners for non-payment to partners must be confirmed. The platform architecture proposes suspending the homeowner's ability to create new partner requests pending resolution. This power must have a contractual basis in the Terms of Service and the Partner Agreement, and must not constitute an unlawful penalty clause. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to advise on the legality of the proposed account-level sanction under Italian contract law. Confirm the mechanism is not a penalty clause (clausola penale) requiring specific statutory compliance. Draft sanction clause for ToS. |

---

## Part 7 — Partner Vetting Law

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-26 | partner-vetting.md Tier 2; Rejection Criteria | Background check process in Italy: Nauxica cannot directly request a casellario giudiziario (criminal record certificate) from a third party. Partners must self-request and voluntarily submit their own certificate. The legally permissible process — including what criminal record categories constitute valid grounds for rejection without violating Italian anti-discrimination law (D.Lgs. 9 luglio 2003, n. 216) — must be confirmed with legal counsel before the first Tier 2 partner is vetted. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to: (1) confirm the self-submission process is the legally permissible model; (2) advise which criminal record categories are permissible grounds for rejection (violence, property theft, sexual offences — confirm scope); (3) confirm rejection notification requirements under D.Lgs. 216/2003 including what information may be cited as grounds. |
| LR-27 | partner-vetting.md Insurance Requirements | Minimum insurance coverage amounts for partners are indicative only: €500,000 public liability (RC Terzi) for Cleaning and Maintenance; €100,000 professional indemnity for Maintenance. These figures must be confirmed by legal counsel and an Italian insurance adviser before being used as vetting pass/fail criteria. Employer's liability (INAIL) requirement for Cleaning companies with staff must also be confirmed. | MEDIUM | Yes | Yes | Yes | Legal Counsel + Insurance Adviser | Open | Engage Italian insurance adviser to confirm minimum adequate coverage amounts by partner type. Confirm INAIL obligation for cleaning businesses employing staff. Update partner-vetting.md with confirmed minimums once received. |
| LR-28 | partner-vetting.md Required Documents | Tourism guide licence (licenza di guida turistica) requirement for Experiences partners may be conditional on the nature of the experience. Guided tours in Sicily may require a regional or national licence — the applicable requirement following the Corte Costituzionale ruling on regional guide licensing must be confirmed. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) whether a tourism guide licence is required for guided experiences in Sicily; (2) whether regional or national licence applies (and which regions are relevant for Sicily given post-ruling state); (3) language requirements (if any). Update partner-vetting.md Required Documents table once confirmed. |
| LR-29 | partner-vetting.md Suspension Triggers | When a criminal incident involving a partner occurs during a platform job, legal review is required before any platform action. The obligations — whether to notify police, evidence preservation requirements, and Nauxica's potential liability as a platform — must be confirmed. The founder must have a documented procedure before a first incident occurs, not after. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to draft a brief criminal incident response procedure for inclusion in the operator runbook. Cover: (1) obligation to report to police (obbligo di denuncia); (2) Nauxica's liability exposure as a platform operator; (3) evidence preservation requirements; (4) communication to homeowner and affected parties. |
| LR-30 | partner-vetting.md Rejection Criteria | Sanctions screening obligations: partners on a sanctions list must be permanently rejected. The applicable EU and Italian sanctions lists, the required screening method, and the frequency of ongoing screening for active partners must be confirmed. EU Consolidated Sanctions List is the baseline — confirm whether additional lists apply. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm: (1) applicable EU/Italian sanctions screening obligations for platform operators; (2) which sanctions lists must be screened (EU Consolidated List, UN, other); (3) required frequency for active partner re-screening; (4) whether automated screening services are required. |

---

## Part 8 — Dispute Resolution

| ID | Source | Description | Risk | MVP | Pilot | Scale | Owner | Status | Next Action |
|---|---|---|---|---|---|---|---|---|---|
| LR-31 | dispute-resolution.md Operating Principle 2 | Dispute resolution clause in Terms of Service and Partner Agreement: Nauxica is a facilitator, not an arbitrator. The clause referring unresolved disputes to the "competent Italian court" must include: applicable jurisdiction, governing law, and any mandatory ADR or ODR provisions required under EU consumer law (EU Regulation 524/2013 on online dispute resolution applies to B2C online contracts). | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to draft the dispute resolution clause for ToS and Partner Agreement. Confirm: (1) correct jurisdiction for Italian and EU consumers; (2) governing law (Italian law is proposed); (3) mandatory ODR platform link under EU Regulation 524/2013; (4) whether mandatory mediation applies before court referral under Italian law. |
| LR-32 | dispute-resolution.md §D-01; Refund and Compensation Framework | Financial thresholds for dispute escalation have not been defined. The maximum refund Nauxica can facilitate without homeowner consent, and the threshold beyond which disputes must be referred to consumer protection authorities (Autorità Garante della Concorrenza e del Mercato — AGCM), have not been set. These thresholds require both legal advice and a founder decision. | HIGH | Yes | Yes | Yes | Legal Counsel + Founder | Open | Legal counsel to advise on: (1) Nauxica's legal authority to facilitate refunds without homeowner consent; (2) whether any threshold triggers mandatory referral to AGCM or other consumer body. Founder to set financial thresholds in dispute-resolution.md Refund and Compensation Framework once advice is received. |
| LR-33 | dispute-resolution.md §D-02 | Nauxica's liability for guest-caused property damage (D-02 disputes): the Terms of Service must define whether Nauxica bears any indemnification obligation and under what conditions. The platform architecture proposes homeowner bears responsibility with Nauxica facilitating — but this must have a contractual basis that withstands consumer law scrutiny. | HIGH | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to advise on platform liability exposure for guest-caused property damage under Italian contract and tort law. Draft liability clause for ToS. Confirm whether platform-level insurance (professional liability) is advisable to back this allocation. |
| LR-34 | dispute-resolution.md §D-04 | Nauxica's liability cap for AI errors must be defined in the Terms of Service. The applicable framework under Italian and EU law — product liability (D.Lgs. 206/2005), service liability, or platform safe harbour (EU Digital Services Act) — must be determined. The EU AI Act (Regulation 2024/1689) may impose additional obligations depending on Nauxica's AI system risk classification. | CRITICAL | Yes | Yes | Yes | Legal Counsel | Open | Priority item. Legal counsel to advise on: (1) applicable liability framework for AI-generated information errors; (2) EU AI Act risk classification for Nauxica's AI concierge use case; (3) defensible liability cap clause for ToS; (4) whether EU DSA safe harbour applies and under what conditions. |
| LR-35 | dispute-resolution.md Evidence Standards | Evidence retention period for dispute records is currently set at "dispute lifetime plus 3 years." This must be confirmed against the statute of limitations for relevant Italian civil claims: property damage, service failure, personal injury, and contractual breach (terms range from 3 to 10 years under Codice Civile, Art. 2934–2946). The retention period must be long enough to defend against the longest applicable claim. | MEDIUM | Yes | Yes | Yes | Legal Counsel | Open | Legal counsel to confirm the appropriate retention period for dispute evidence under Italian civil law, accounting for the longest applicable statute of limitations. Update the evidence retention policy in dispute-resolution.md Evidence Standards once confirmed. |

---

## Legal Readiness Dashboard

Summary of all 35 items by status, risk level, and required gate.

### Item Count by Gate

| Gate | Total items required | CRITICAL | HIGH | MEDIUM | LOW |
|---|---|---|---|---|---|
| **MVP** | 33 | 10 | 16 | 7 | 0 |
| **Pilot** | 35 | 10 | 16 | 8 | 1 |
| **Scale** | 35 | 10 | 16 | 8 | 1 |

### Items Not Required at MVP

| ID | Description | Required at |
|---|---|---|
| LR-22 | Grandfathering of founding-member pricing | Pilot |
| LR-24 | PSD2 / payment service provider licensing (marketplace transition) | Scale |

> Note: LR-24 requires planning from the Pilot phase even though formal compliance is a Scale obligation. Do not treat "not required at MVP" as "no action until Scale."

---

## MVP Legal Gate

**Criteria:** All 33 MVP-required items must be `Resolved` before live guest data is processed and before any property goes live.

**Current status:** 33 / 33 Open. Zero resolved.

**CRITICAL items to resolve first (10):**

| ID | Description |
|---|---|
| LR-01 | Legal entity registered in Italy |
| LR-03 | Terms of Service — lawyer-drafted and published |
| LR-04 | Privacy Policy — lawyer-drafted and published |
| LR-06 | Partner Agreement — lawyer-drafted and signed by all active partners |
| LR-07 | Homeowner Subscription Agreement — lawyer-drafted |
| LR-08 | DPAs signed with all data processors (Meta, hosting provider, LLM provider) |
| LR-11 | Controller/processor classification confirmed for all processing activities |
| LR-12 | Lawful basis for WhatsApp guest communications confirmed and implemented |
| LR-16 | CIR/CIN code requirement confirmed for Sicily; platform validation implemented |
| LR-34 | AI error liability cap defined in ToS; EU AI Act risk classification confirmed |

**Recommended sequencing:**

1. **Immediately:** LR-01 (entity registration — everything depends on this), LR-11 (controller analysis — drives DPAs, Privacy Policy, and retention policy).
2. **Within 4 weeks of entity registration:** LR-03, LR-04, LR-06, LR-07, LR-08 (core legal documents and processor agreements — all must exist before first user registration).
3. **Concurrent with legal document drafting:** LR-12 (WhatsApp consent design), LR-16 (CIR/CIN format validation), LR-34 (AI liability — brief legal opinion needed early to scope ToS liability clause).
4. **Before first property activation:** All remaining MVP items (LR-02, LR-05, LR-09, LR-10, LR-13–LR-15, LR-17–LR-21, LR-23, LR-25–LR-33, LR-35).

---

## Pilot Legal Gate

**Criteria:** All 35 items resolved, including LR-22 (grandfathering, if offered).

**Additional gate beyond MVP:** LR-22 is the only item first required at Pilot. All other Pilot-required items are already required at MVP.

---

## Scale Legal Gate

**Criteria:** All 35 items resolved. LR-24 (PSD2/marketplace payment model) must be resolved before the platform begins processing payments between homeowners and partners.

**Additional gate beyond Pilot:** LR-24 requires a separate legal engagement on payment service regulation — this has a long lead time and must begin no later than the Pilot phase.

---

## Cross-Reference: Launch Readiness Legal Gates

The legal gates in [launch-readiness.md](../architecture/launch-readiness.md) (L-01 through L-17) correspond to the following tracker items:

| Launch Readiness Gate | Tracker Item(s) |
|---|---|
| L-01 — DPA signed with Meta (WhatsApp Business API) | LR-08 |
| L-02 — DPA signed with LLM provider | LR-08 |
| L-03 — Lawful basis for WhatsApp guest opt-in | LR-12 |
| L-04 — Guest data retention periods defined | LR-13 |
| L-05 — CIR/CIN code registration confirmed | LR-16 |
| L-06 — Alloggiati Web obligation confirmed per property | LR-18 |
| L-07 — Tourist tax obligation confirmed per municipality | LR-17 |
| L-08 — Partner background check permissibility confirmed | LR-26 |
| L-09 — Commission VAT treatment confirmed | LR-23 |
| L-10 — Homeowner subscription auto-renewal terms compliant | LR-07, LR-20 |
| L-11 — Terms of Service reviewed and approved | LR-03 |
| L-12 — Partner Agreement reviewed and approved | LR-06 |
| L-13 — Privacy Policy reviewed and approved | LR-04 |
| L-14 — Dispute resolution clause approved | LR-31 |
| L-15 — WhatsApp message log retention policy defined | LR-13 |
| L-16 — Guest codice_fiscale encryption reviewed | LR-14 |
| L-17 — Breach notification obligation acknowledged | LR-15 |

---

## Related Documents

- [regulatory-compliance-checklist.md](regulatory-compliance-checklist.md) — Detailed regulatory framework and homeowner/Nauxica responsibility allocation
- [security-model.md](../architecture/security-model.md) — Security architecture and GDPR technical measures
- [subscription-plans.md](../onboarding/homeowner/subscription-plans.md) — Subscription, commission, and trial architecture
- [partner-vetting.md](../trust-safety/partner-vetting.md) — Partner vetting process and criteria
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — Dispute taxonomy, lifecycle, and resolution framework
- [launch-readiness.md](../architecture/launch-readiness.md) — Consolidated launch gate checklist (legal gates: L-01 through L-17)
- [terms-of-service.md](terms-of-service.md) — Terms of Service (⚠️ stub — requires lawyer)
- [privacy-policy.md](privacy-policy.md) — Privacy Policy (⚠️ stub — requires lawyer)
- [partner-agreement.md](partner-agreement.md) — Partner Agreement (⚠️ stub — requires lawyer)
