# Regulatory Compliance Checklist

**Version:** 1.0
**Status:** Draft — Architecture phase. Not legal-final.
**Scope:** Sicily launch · Italy · EU
**Last updated:** 2026-05-28
**Audience:** Founder, operations team, legal counsel
**Related:** [privacy-policy.md](privacy-policy.md) · [terms-of-service.md](terms-of-service.md) · [partner-agreement.md](partner-agreement.md) · [whatsapp-concierge-guidelines.md](../ai-concierge/whatsapp-concierge-guidelines.md) · [property-data-schema.md](../property-intake/property-data-schema.md)

> **Disclaimer:** This document is an operational architecture reference, not legal advice. Every section marked ⚠️ **Legal review required** must be reviewed and confirmed by a qualified Italian/EU lawyer before the platform goes live. Do not treat the summaries of law in this document as definitive — they are operational summaries intended to structure the legal review, not to replace it.

---

## Purpose

This document maps every regulatory obligation relevant to the Nauxica Sicily MVP and assigns responsibility between the platform (Nauxica) and the property owner (homeowner). It defines what must be in place before the first live guest conversation, and what can follow post-launch.

---

## Launch-Blocking Dependencies

These items must be resolved before any live guest data is processed. They are not optional.

| # | Dependency | Owner | Blocking reason |
|---|---|---|---|
| LB-01 | GDPR-compliant consent mechanism for WhatsApp implemented | Nauxica | Processing guest phone numbers requires lawful basis |
| LB-02 | Privacy policy published and accessible | Nauxica | Required by GDPR Article 13 before data collection begins |
| LB-03 | Terms of Service reviewed by lawyer and published | Nauxica | Platform operation requires user agreement |
| LB-04 | Partner Agreement reviewed by lawyer and signed by all active partners | Nauxica + Partners | Platform liability exposure without signed agreements |
| LB-05 | CIR code validation workflow implemented | Nauxica | Properties cannot go live without a valid CIR code |
| LB-06 | Alloggiati Web responsibility model confirmed and communicated to homeowners | Nauxica | Homeowners are legally responsible — Nauxica must confirm they understand this |
| LB-07 | Data retention policy confirmed and implemented for Booking guest data | Nauxica | Guest document numbers (alloggiati) have legal retention requirements |
| LB-08 | WhatsApp Business API data processing agreement signed with provider | Nauxica | Required under GDPR Article 28 (processor agreement) |
| LB-09 | Nauxica entity legally registered in Italy (or EU equivalent) | Founder | Required for contractual capacity and tax compliance |
| LB-10 | Homeowner subscription agreement reviewed by lawyer | Nauxica | Revenue model requires enforceable contract |

---

## Section A — Short-Term Rental Registration (CIR Code)

### Legal basis

⚠️ **Legal review required.** The requirement for a *Codice Identificativo Regionale* (CIR) for short-term rentals in Sicily is established under Sicilian regional law and national regulations governing tourist accommodation. National framework: D.L. 50/2017 and subsequent implementing decrees. The Decreto Legge 145/2023 (converted with amendments) introduced the national *Codice Identificativo Nazionale* (CIN) system operated by the Ministry of Tourism, which is progressively replacing or supplementing regional CIR codes. Confirm current applicable requirement with legal counsel — the transition from regional to national code is in progress and the obligation may be dual.

### What it is

A unique alphanumeric code assigned by the relevant regional or national authority to each short-term rental property. It must be displayed on all listing advertisements (online and offline), booking confirmations, and receipts.

### Who is responsible

The **homeowner** is responsible for obtaining and maintaining the CIR/CIN code. Nauxica's platform responsibility is to:
- Require CIR/CIN code entry before property activation
- Display it on listing pages (if Nauxica hosts listing pages)
- Validate format (not validity — Nauxica cannot verify with the authority)
- Communicate to homeowners their obligation to obtain it

### Nauxica platform obligations

| Action | Required by | Status |
|---|---|---|
| Require `cir_code` field before property activation | Platform policy | Designed in property schema |
| Display CIR code on all property listing surfaces | Regional law | ⚠️ Implement before first listing goes live |
| Validate CIR code format (regex or format check only) | Platform quality | ⚠️ Confirm correct format with legal/authority |
| Log when CIR code was entered and by whom | Audit trail | ⚠️ Implement in platform |
| Notify homeowner of CIR/CIN renewal obligations | Platform service | Optional — adds homeowner value |

### Homeowner obligations

| Obligation | Notes |
|---|---|
| Obtain CIR or CIN code before listing | Must be done with the regional tourism authority or national BDSR (Banca Dati delle Strutture Ricettive) |
| Display code on all advertising | Including OTA listings (Airbnb, Booking.com) and any direct advertising |
| Keep code current if renewed | Homeowner must update in Nauxica platform |
| Notify Nauxica if code is suspended or revoked | Platform deactivates property on notification |

### What happens without it

Operating a short-term rental without a CIR/CIN code carries administrative fines. The fine is the homeowner's liability — Nauxica must not activate a property without this field populated, to protect both the homeowner and the platform.

---

## Section B — Tourist Tax (Tassa di Soggiorno)

### Legal basis

⚠️ **Legal review required.** The *tassa di soggiorno* is established under D.Lgs. 23/2011, Article 4. It is a **municipal tax** — each Italian municipality (*comune*) sets its own rate, maximum duration, and exemptions by ordinance. Rates are not uniform across Sicily and change periodically. Nauxica must obtain the current rate for each property's municipality directly or via a trusted source.

### What it is

A per-person, per-night tax levied on guests staying in tourist accommodation. Collected by the host/accommodation provider on behalf of the municipality. Remitted to the municipality on a schedule set by local ordinance (typically quarterly or annually).

### Responsibility allocation

| Responsibility | Owner | Notes |
|---|---|---|
| Collecting the tax from guests | **Homeowner** | Nauxica does not collect the tax |
| Remitting the tax to the municipality | **Homeowner** | Nauxica does not remit the tax |
| Informing the AI concierge of the correct rate | **Homeowner** (entered in platform) | Nauxica platform stores and displays |
| Updating the rate if the municipality changes it | **Homeowner** | Nauxica prompts on annual review |
| Notifying guests of the tax in advance | **Homeowner** (via Nauxica platform) | AI concierge cites the rate from the property knowledge block |
| Maintaining records of tax collected | **Homeowner** | Nauxica does not maintain these records on the homeowner's behalf |

### AI concierge rules

- The AI **informs only**. It tells guests the tax amount and collection method as configured in the property knowledge block.
- The AI does not collect, calculate, or adjust the tax.
- If a guest disputes the tax amount: the AI escalates to the homeowner (L1). The AI does not attempt to adjudicate.
- If the `tourist_tax_amount_eur` field is empty in the knowledge block: the AI says "Please ask the property owner about the tourist tax — I don't have that information." It does not say the tax does not apply.

### Platform data requirements

| Field | Location | Notes |
|---|---|---|
| `tourist_tax_amount_eur` | Property data schema | Required before activation — rate per person per night |
| `tourist_tax_max_nights` | Property data schema | Maximum nights the tax applies (set by ordinance) |
| `tourist_tax_exemptions` | Property data schema | Children, disabled persons — varies by comune |
| `tourist_tax_collection_method` | Knowledge base template | How the homeowner collects (cash at check-in, etc.) |

### Rate reference sources

⚠️ Nauxica does not maintain a database of municipal tourist tax rates. Homeowners are responsible for providing accurate rates. Recommended reference sources for homeowners:

- The website of the specific *Comune* (municipal authority)
- The Regione Siciliana tourism portal
- An Italian accountant (*commercialista*) familiar with local tourism tax obligations

---

## Section C — Guest Registration (Alloggiati Web)

### Legal basis

⚠️ **Legal review required.** Guest registration with Italian police authorities is required under **D.M. 7 gennaio 2013** (Ministero dell'Interno — Dipartimento della Pubblica Sicurezza). Hosts of tourist accommodation must transmit guest identification data to the Polizia di Stato via the **Alloggiati Web** portal within **24 hours of guest arrival** (or at the time of booking if the booking is made within 24 hours of arrival).

The obligation applies to most accommodation operators including private short-term rental hosts. Exemptions may apply — confirm scope with legal counsel.

### What data is required per guest

| Data field | Notes |
|---|---|
| Last name | |
| First name | |
| Date of birth | |
| Place of birth | |
| Nationality | |
| Document type | Passport, identity card, or other accepted document |
| Document number | |
| Document issuing country | |
| Date of arrival | |
| Number of nights | |

This data must be collected from all guests (including guests who book via OTAs like Airbnb or Booking.com — the registration obligation is on the host, not the platform).

### Responsibility allocation

| Responsibility | Owner | Notes |
|---|---|---|
| Registering guests on Alloggiati Web | **Homeowner** | Nauxica is not the accommodation operator |
| Collecting required identification data | **Homeowner** | Nauxica platform can collect at booking as a service, but homeowner remains legally responsible |
| Maintaining Alloggiati Web credentials | **Homeowner** | Each property has its own portal account |
| Retaining registration records | **Homeowner** | Retention period set by the authority — ⚠️ confirm with legal |
| Tracking whether registration was completed per booking | **Homeowner** | `alloggiati_registered` field in Booking model is for homeowner tracking only |

### Nauxica's operational role

Nauxica does **not** register guests with Italian police authorities on the homeowner's behalf at MVP. This is a legal service that would require Nauxica to act as the homeowner's agent, with associated liability and regulatory requirements.

Nauxica **does:**
- Collect necessary guest identification fields in the Booking model at booking time as a convenience for the homeowner
- Store this data securely (encrypted at rest, access-controlled)
- Display it to the homeowner via the dashboard for their own registration
- Track `alloggiati_registered` as a yes/no flag updated by the homeowner
- Include Alloggiati Web obligation reminders in the homeowner onboarding materials

⚠️ **Legal review required:** If Nauxica collects guest document numbers (passport, ID card) and transmits them to homeowners for registration purposes, Nauxica is processing special-category-adjacent data as a data processor. Confirm the GDPR basis, required security measures, and whether a Data Processing Agreement (DPA) with homeowners is required.

### Platform data requirements

| Field | Notes |
|---|---|
| `guest_nationality` | ISO 3166-1 alpha-2 in Booking model |
| `guest_document_type` | Enum in Booking model |
| `guest_document_number` | Encrypted at rest — never AI-visible |
| `alloggiati_web_required` | Boolean in Property model — homeowner self-declares |
| `alloggiati_registered` | Boolean in Booking model — updated by homeowner |

---

## Section D — GDPR Compliance Architecture

### Applicable regulations

| Regulation | Scope |
|---|---|
| GDPR (EU 2016/679) | Applies as EU regulation — governs all personal data processing |
| D.Lgs. 196/2003 (Italian Privacy Code, as amended by D.Lgs. 101/2018) | Italian implementing legislation — supplements GDPR |
| Meta WhatsApp Business API terms | Governs use of the WhatsApp channel — intersects with GDPR |

### Data controller vs data processor

⚠️ **Legal review required.** Confirm the correct classification for Nauxica and homeowners across each data processing activity.

| Processing activity | Data controller | Data processor | Notes |
|---|---|---|---|
| Guest WhatsApp communication | Nauxica | (WhatsApp API provider) | Nauxica determines purpose and means |
| Guest booking data (name, phone) | Nauxica (or homeowner?) | Nauxica | ⚠️ Confirm — could be joint controllers |
| Guest identification data (passport) | Homeowner | Nauxica | Homeowner has the legal obligation; Nauxica stores on their behalf |
| Homeowner account data | Nauxica | — | |
| Partner account and vetting data | Nauxica | — | |
| Review data | Nauxica | — | |

### Lawful basis for WhatsApp communication

⚠️ **Legal review required.** The lawful basis for sending WhatsApp messages to guests must be established before the first message is sent.

**Options and assessment:**

| Basis | GDPR Article | Applicability to Nauxica | Assessment |
|---|---|---|---|
| **Consent** | Art. 6(1)(a) | Guest explicitly agrees to WhatsApp comms at booking | **Preferred basis** — provides clear legal ground and supports opt-out model. Requires affirmative opt-in, not pre-ticked boxes. |
| **Contract performance** | Art. 6(1)(b) | Messages necessary to fulfil the accommodation service | **Potentially applicable** for check-in instructions and essential stay information. Debatable for promotional or mid-stay messages. |
| **Legitimate interests** | Art. 6(1)(f) | Platform interest in guest safety and service quality | **Weaker basis** — requires balancing test. Not recommended as primary basis for WhatsApp. |

**Recommended architecture:** Consent as primary basis, with contract performance as secondary basis for emergency and essential operational messages only. This means:

1. Consent obtained at booking — via checkbox on the booking confirmation form
2. Consent language is specific: "I agree to receive WhatsApp messages about my stay from Nauxica, including check-in instructions, concierge support, and stay-related updates."
3. Consent is not bundled with Terms of Service acceptance
4. Opt-out is always available and immediately honoured
5. Emergency messages (safety-critical) may rely on contract performance or vital interests basis — regardless of consent status

### Guest consent design

The consent mechanism must be implemented before the first booking is processed.

| Element | Requirement | Notes |
|---|---|---|
| Consent form | Presented at booking confirmation | Separate from ToS — affirmative opt-in only |
| Consent language | Specific to WhatsApp AI concierge | Name the channel, name the use |
| Consent record | Stored with the Booking record | `whatsapp_consent: boolean` + `consent_timestamp` |
| Opt-out mechanism | Reply "STOP" — processed immediately | See whatsapp-concierge-guidelines.md |
| Consent withdrawal | Honoured without detriment | Guest can opt out but still has a stay |
| Re-consent | Not requested automatically | A new consent request requires a new booking or explicit user action |

### Data processing inventory

A full Record of Processing Activities (RoPA) is required under GDPR Article 30. This is the architecture — the formal RoPA must be completed by legal counsel.

| Data category | Data subjects | Purpose | Legal basis | Retention — see Section E |
|---|---|---|---|---|
| Homeowner account data | Homeowners | Platform account management, contract performance | Contract (Art. 6(1)(b)) | Duration of account + legal retention |
| Partner account and vetting data | Partners | Vetting, job coordination | Contract (Art. 6(1)(b)) + Legitimate interest (Art. 6(1)(f)) | Duration of account + legal retention |
| Guest name and phone number | Guests | WhatsApp concierge, booking management | Consent (Art. 6(1)(a)) | Per Section E |
| Guest identification data (passport/ID) | Guests | Alloggiati Web obligation support | Legal obligation (Art. 6(1)(c)) | Per Section E — aligns with authority requirements |
| Booking data | Guests | Service delivery | Contract (Art. 6(1)(b)) | Per Section E |
| Review data | Guests, Homeowners, Partners | Platform trust and quality | Legitimate interest (Art. 6(1)(f)) | Duration of platform operation |
| WhatsApp conversation logs | Guests | Quality assurance, safety, escalation audit | Legitimate interest (Art. 6(1)(f)) + Contract | Per Section E |
| Financial/subscription data | Homeowners, Partners | Billing and subscription management | Contract (Art. 6(1)(b)) + Legal obligation | Per Italian tax/accounting law |

---

## Section E — Data Retention Boundaries

⚠️ **Legal review required.** Confirm all retention periods with legal counsel. Italian law imposes minimum and maximum retention periods for some categories that may differ from GDPR-only analysis.

| Data category | Retention period | Trigger for deletion | Notes |
|---|---|---|---|
| Guest name and WhatsApp number | Stay end + 12 months | 12 months post-checkout | For dispute resolution and review purposes |
| Guest document numbers (passport/ID) | Stay end + 5 years | ⚠️ Align with Alloggiati Web authority requirements — confirm with legal | Required for police audit |
| Guest email address | Stay end + 12 months | 12 months post-checkout | |
| Booking record (non-PII fields) | 10 years | Accounting retention period | Italian civil/tax law — confirm |
| WhatsApp conversation logs | 12 months | 12 months from session close | Anonymise or delete after this period |
| EscalationRecord (non-PII) | 3 years | Statute of limitations reference | ⚠️ Confirm with legal |
| Homeowner account data | Account closure + 7 years | Accounting retention | Italian fiscal year requirements |
| Partner account data (non-document) | Account closure + 3 years | Contractual + dispute window | |
| Partner vetting documents (ID, insurance) | Account closure + 3 years | ⚠️ Confirm with legal | Cannot be retained indefinitely |
| Review content | Duration of platform operation | Platform closure or deletion request | Subject to right to erasure |
| Financial transaction records | 10 years | Italian tax law | Overrides shorter GDPR retention preference |

### Deletion process requirements

- Deletion must be logged (who triggered it, when, what was deleted)
- Deletion of guest data must cascade to all copies (backups, logs, AI session caches)
- Data subject requests for erasure must be responded to within 30 days (GDPR Article 17)
- Some data cannot be erased where legal retention obligations override (e.g. fiscal records)

---

## Section F — Platform Responsibility Allocation

### What Nauxica is responsible for

| Obligation | Notes |
|---|---|
| GDPR compliance for data Nauxica processes as controller | Including guest comms, account data, WhatsApp logs |
| Privacy policy published and accurate | Before first data is collected |
| Terms of Service enforceable and current | Legal review required before publication |
| Secure storage of all user data | Encryption at rest, access controls, breach response |
| Processing GDPR data subject requests | Right to access, erasure, rectification — within 30 days |
| Notifying supervisory authority (Garante Privacy) of data breaches | Within 72 hours of becoming aware |
| Data Processing Agreements with all data processors | WhatsApp API provider, hosting provider, any AI model provider |
| Communicating homeowner regulatory obligations clearly | Via onboarding, property intake checklist, and documentation |
| Maintaining `alloggiati_registered` as a tracking tool | Not as a compliance guarantee |

### What homeowners are responsible for

| Obligation | Notes |
|---|---|
| Obtaining and maintaining CIR/CIN code | Platform requires it — homeowner must keep it current |
| Collecting and remitting tourist tax | Nauxica informs only — collection is homeowner's legal duty |
| Registering guests on Alloggiati Web | Homeowner is the accommodation operator |
| Accuracy of emergency contact data | Homeowner must update when contacts change |
| Accuracy of tourist tax rate in the platform | Homeowner must update if municipality changes the rate |
| Property insurance adequate for short-term rental | Confirm minimum coverage — ⚠️ legal review required |
| Compliance with any municipal planning or zoning regulations | Nauxica does not verify this |
| Compliance with condominium rules for short-term rental | Common in Italian apartment buildings — homeowner's responsibility |

### What cannot be delegated by either party

| Obligation | Reason |
|---|---|
| Police guest registration (Alloggiati Web) | Legally on the accommodation operator (homeowner) — cannot be delegated to a platform without formal agency agreement |
| Tourist tax remittance to municipality | Legally on the accommodation operator — platform collection would require tax agency registration |
| GDPR accountability | Each controller is accountable for their own processing — cannot be delegated |
| CIR/CIN code application | Application is by the property owner to the relevant authority |

---

## Section G — Legal Document Status

Status of all required legal documents at architecture phase.

| Document | Status | Required before | Notes |
|---|---|---|---|
| Terms of Service | Stub — no content | First homeowner/partner registration | ⚠️ Lawyer required |
| Privacy Policy | Stub — no content | First data collection | ⚠️ Lawyer required |
| Cookie Policy | Stub — no content | Website goes live | ⚠️ Lawyer required |
| Partner Agreement | Stub — no content | First partner activation | ⚠️ Lawyer required |
| Homeowner Subscription Agreement | Does not exist | First homeowner subscription | ⚠️ Lawyer required |
| Data Processing Agreements (with processors) | Does not exist | Before processing begins | WhatsApp API provider, hosting provider, AI model provider |
| Data Processing Agreement (with homeowners, if applicable) | Does not exist | ⚠️ Confirm whether required with legal | Depends on joint controller vs processor analysis |
| Record of Processing Activities (RoPA) | Does not exist | Before ICO/Garante registration if required | GDPR Art. 30 — ⚠️ Lawyer completes from this architecture |

---

## Pre-Launch Compliance Checklist

Required before live guest data is processed.

### Legal

- [ ] ⚠️ Terms of Service reviewed by lawyer and published
- [ ] ⚠️ Privacy Policy reviewed by lawyer and published
- [ ] ⚠️ Partner Agreement reviewed by lawyer, ready for signature
- [ ] ⚠️ Homeowner Subscription Agreement reviewed by lawyer, ready for signature
- [ ] ⚠️ Data Processing Agreements signed with: WhatsApp API provider / hosting provider / AI model provider
- [ ] ⚠️ Nauxica legal entity registered in Italy or jurisdiction of operation
- [ ] ⚠️ Confirm GDPR supervisory authority jurisdiction (Garante Privacy if operating in Italy)
- [ ] ⚠️ Register with Garante if required (organisations under 250 employees may be exempt from some registration — confirm)

### Platform (Nauxica)

- [ ] CIR code field required before property activation — implemented in platform
- [ ] Guest GDPR consent collected at booking — implemented
- [ ] Opt-out (STOP) mechanism implemented and tested
- [ ] Data retention deletion workflows implemented
- [ ] Guest document data encrypted at rest
- [ ] Access logging implemented for sensitive fields (guest documents, access codes)
- [ ] Data breach response procedure documented (even if brief — must exist)

### Homeowner onboarding

- [ ] CIR/CIN code obligation explained in homeowner onboarding materials
- [ ] Tourist tax obligation explained and rate collection form included in property intake
- [ ] Alloggiati Web obligation explained — homeowner confirms awareness in onboarding
- [ ] Emergency data completeness verified before property activation
- [ ] Homeowner subscription agreement signed

---

## Related Documents

- [privacy-policy.md](privacy-policy.md) — Full GDPR-compliant privacy policy (⚠️ stub — requires legal drafting)
- [terms-of-service.md](terms-of-service.md) — Platform terms (⚠️ stub — requires legal drafting)
- [partner-agreement.md](partner-agreement.md) — Partner contractual terms (⚠️ stub — requires legal drafting)
- [property-data-schema.md](../property-intake/property-data-schema.md) — `cir_code`, `tourist_tax_*`, `alloggiati_*` fields
- [data-models.md](../backend/data-models.md) — Booking model guest data fields
- [whatsapp-concierge-guidelines.md](../ai-concierge/whatsapp-concierge-guidelines.md) — WhatsApp consent and opt-out implementation
- [property-intake-checklist.md](../property-intake/property-intake-checklist.md) — Phase 3 compliance verification
