# Property Intake Checklist

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch
**Last updated:** 2026-05-28
**Related:** [property-data-schema.md](property-data-schema.md) · [property-knowledge-base-template.md](property-knowledge-base-template.md) · [homeowner-onboarding.md](../onboarding/homeowner/homeowner-onboarding.md)

---

## Purpose

This checklist governs the end-to-end process of onboarding a new property onto Nauxica — from initial data collection through AI concierge activation. It is used by:

- **Homeowners** completing self-service onboarding
- **Nauxica staff** during assisted onboarding or quality review

Each phase has a defined gate. A property cannot advance to the next phase until all required items in the current phase are complete.

---

## How to Read This Checklist

- `[ ]` — Item not yet completed
- `[x]` — Item completed
- **Required** — Blocking: property cannot advance without this
- **Recommended** — Strongly advised for quality and AI concierge performance; can be completed post-activation
- **Conditional** — Required only when a specific condition applies (noted inline)
- ⚠️ **Legal review required** — Do not treat as optional until legal sign-off is obtained

---

## Phase 1 — Required Data Collection

**Gate:** All required items must be complete before a property record can be created in the platform.

**Completed by:** Homeowner (self-service) or Nauxica onboarding staff

### 1.1 — Account & Identity

- [ ] Homeowner account created and verified (email confirmed)
- [ ] Full legal name of property owner entered
- [ ] Phone number verified
- [ ] ⚠️ Codice fiscale or Partita IVA entered — **Legal review required** (required for tourist tax and compliance reporting)
- [ ] Subscription plan selected

### 1.2 — Property Identity

- [ ] Property display name entered (max 60 characters)
- [ ] Property type selected: `villa` / `apartment` / `house` / `penthouse` / `cottage`
- [ ] Internal reference entered (optional — owner's own code)

### 1.3 — Location

- [ ] Street address entered
- [ ] Locality (neighbourhood/district) entered
- [ ] Municipality (city/town) entered
- [ ] Province code entered (e.g. CT, ME, PA)
- [ ] Postcode (CAP) entered
- [ ] GPS coordinates entered (recommended — enables map display and transfer routing)

### 1.4 — Configuration

- [ ] Maximum guest capacity entered
- [ ] Number of bedrooms entered
- [ ] Number of bathrooms entered
- [ ] Bed configuration described (e.g. "1 king, 2 singles")

### 1.5 — Access Method

- [ ] Access method selected: `key-box` / `smart-lock` / `host-handover` / `concierge-desk`
- [ ] Check-in window entered (from / to times)
- [ ] Checkout time entered

### 1.6 — House Rules Baseline

- [ ] Smoking policy set: `no-smoking` / `outdoor-only` / `designated-area`
- [ ] Pet policy set: `no-pets` / `pets-allowed` / `pets-on-request`
- [ ] Party policy set: `no-events` / `small-gatherings-ok`
- [ ] Minimum stay (nights) entered

### 1.7 — Emergency Contacts

- [ ] Emergency contact name entered
- [ ] Emergency contact phone number entered (Italian format: +39...)
- [ ] Nearest hospital name and address entered
- [ ] ⚠️ Confirm emergency contact has been informed and consented to their details being shared with guests — **Legal review required**

---

## Phase 2 — AI Concierge Knowledge Base

**Gate:** All required items must be complete before the AI concierge can be activated for this property.

**Completed by:** Homeowner (guided form) or Nauxica onboarding staff
**Reference document:** [property-knowledge-base-template.md](property-knowledge-base-template.md)

### 2.1 — Property Summary

- [ ] Area description written (2–4 sentences, guest-facing tone)
- [ ] Nearest airport entered with approximate travel time
- [ ] Nearest port entered (if applicable)

### 2.2 — Access & Entry Instructions

- [ ] Step-by-step entry instructions written in guest-facing prose
- [ ] Conditional: Key box location described precisely (if `access_method` is `key-box`)
- [ ] Conditional: Key box code entered (if `access_method` is `key-box`)
- [ ] Conditional: Building door code entered (if applicable)
- [ ] Conditional: Smart lock app name and instructions entered (if `access_method` is `smart-lock`)
- [ ] Conditional: Parking access instructions and code entered (if `has_parking` is true)
- [ ] Entry instructions reviewed for completeness — no ambiguous language

### 2.3 — WiFi

- [ ] WiFi network name entered (exact string)
- [ ] WiFi password entered
- [ ] Backup/router reset note added (optional but recommended)

### 2.4 — Appliance Guides

- [ ] Washing machine instructions written
- [ ] Air conditioning / heating instructions written
- [ ] TV and streaming instructions written
- [ ] Water heater instructions written (if non-standard)
- [ ] Any other non-obvious appliances documented (e.g. pool pump, alarm system, electric gate)

### 2.5 — In-Stay Information

- [ ] Trash collection days entered
- [ ] Trash collection notes written (bin locations, categories)
- [ ] Recycling instructions written
- [ ] Quiet hours entered (from / to)
- [ ] Full house rules text entered (for listing display)
- [ ] Condensed house rules written for AI delivery (max 8 bullet points)

### 2.6 — Local Recommendations (Optional)

- [ ] Up to 5 local tips added (restaurants, beaches, transport, markets, pharmacies)
- [ ] Each tip includes: type, name, brief description, distance from property

### 2.7 — AI Knowledge Quality Review

- [ ] All guest-facing text reviewed: written in direct, warm, specific prose
- [ ] No placeholder text remaining
- [ ] Access codes confirmed accurate
- [ ] Emergency contacts confirmed accurate
- [ ] Property knowledge template marked as complete in platform

---

## Phase 3 — Sicily Compliance Verification

**Gate:** All required compliance items must be verified before the property status can be set to `active`.

**Completed by:** Homeowner (self-declare) + Nauxica staff (verification)

> ⚠️ All items in this phase are subject to Italian and Sicilian regional law. **Legal review required** before finalising compliance requirements and their enforcement on the platform.

### 3.1 — CIR Code (Codice Identificativo Regionale)

- [ ] ⚠️ Homeowner confirms CIR code has been obtained from the Regione Siciliana
- [ ] CIR code entered in platform
- [ ] CIR code format validated (regional format varies — confirm correct pattern)
- [ ] CIR code displayed on listing (legally required on all advertising)

### 3.2 — Tourist Tax (Tassa di Soggiorno)

- [ ] ⚠️ Tourist tax amount per person per night entered (rate set by the property's municipality — confirm with homeowner)
- [ ] Maximum nights for tax collection entered (typically 7 in Sicily — verify per comune)
- [ ] Exemption rules entered (typically children under 12 — verify per comune)
- [ ] Homeowner confirmed as responsible for collecting and remitting tourist tax to the municipality

### 3.3 — Guest Registration (Alloggiati Web)

- [ ] ⚠️ Confirmed whether property is subject to Alloggiati Web registration obligation (Polizia di Stato)
- [ ] If yes: confirmed who registers guests (`owner` or `nauxica-assisted`)
- [ ] Homeowner provided with Alloggiati Web setup guidance (or Nauxica assisted onboarding scheduled)

### 3.4 — Insurance & Safety

- [ ] Homeowner confirms property has valid public liability insurance (confirm minimum coverage requirement — **Legal review required**)
- [ ] Homeowner confirms smoke detectors are installed and functional
- [ ] Homeowner confirms CO detector installed (if gas appliances present)
- [ ] Homeowner confirms fire extinguisher accessible
- [ ] Emergency exit routes documented (for multi-floor properties)

---

## Phase 4 — Nauxica Quality Review

**Gate:** Nauxica internal review must be completed and approved before property activation.

**Completed by:** Nauxica operations staff

### 4.1 — Data Completeness Check

- [ ] All Phase 1 required fields confirmed complete
- [ ] All Phase 2 required fields confirmed complete
- [ ] All Phase 3 compliance fields confirmed complete
- [ ] No fields contain placeholder, test, or obviously inaccurate data

### 4.2 — Knowledge Base Quality Check

- [ ] Entry instructions are precise and testable
- [ ] WiFi credentials are present
- [ ] Emergency contacts are filled
- [ ] House rules are clear and complete
- [ ] AI knowledge template has no empty required fields

### 4.3 — Compliance Spot-Check

- [ ] CIR code entered and format appears valid
- [ ] Tourist tax rate cross-checked against municipality (spot-check)
- [ ] Alloggiati Web status confirmed

### 4.4 — Review Decision

- [ ] Property approved for activation → proceed to Phase 5
- [ ] Property returned to homeowner for corrections → note corrections sent to homeowner

---

## Phase 5 — Activation

**Gate:** Phases 1–4 complete and approved.

**Completed by:** Nauxica operations staff

- [ ] Property `platform_status` set to `active`
- [ ] `activated_at` timestamp recorded
- [ ] Homeowner notified: property is live
- [ ] AI concierge test run completed:
  - [ ] Simulated check-in enquiry returns correct entry instructions
  - [ ] Simulated WiFi question returns correct credentials
  - [ ] Simulated emergency question returns correct contact and hospital
- [ ] Homeowner welcome email sent with next steps (partner assignment, calendar sync)

---

## Post-Activation Recommended Actions

These items are not required for activation but significantly improve platform performance.

- [ ] Preferred partners assigned per service type (cleaning, maintenance, transfers)
- [ ] Booking calendar connected (external OTA sync if applicable)
- [ ] Property photos uploaded
- [ ] Local recommendations reviewed and expanded
- [ ] Seasonal notes added (summer vs. winter hours, seasonal closures)

---

## Related Documents

- [property-data-schema.md](property-data-schema.md) — Full field reference
- [property-knowledge-base-template.md](property-knowledge-base-template.md) — AI content template
- [homeowner-onboarding.md](../onboarding/homeowner/homeowner-onboarding.md) — Homeowner journey overview
- [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) — How knowledge is structured for AI
