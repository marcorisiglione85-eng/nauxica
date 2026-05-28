# Property Activation Checklist

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Per-property go/no-go quality gate · Sicily launch
**Last updated:** 2026-05-28
**Audience:** Homeowner (self-check) and Nauxica ops team (review)
**Related:** [homeowner-onboarding.md](homeowner-onboarding.md) · [property-intake-checklist.md](../../property-intake/property-intake-checklist.md) · [property-knowledge-base-template.md](../../property-intake/property-knowledge-base-template.md) · [property-knowledge-schema.md](../../ai-concierge/property-knowledge-schema.md) · [regulatory-compliance-checklist.md](../../legal/regulatory-compliance-checklist.md)

---

## Purpose

This checklist is the go/no-go gate for a single property. It is completed immediately before activation is requested and again by the Nauxica review team before approval.

It differs from the [property-intake-checklist.md](../../property-intake/property-intake-checklist.md), which governs the process of getting from zero to ready. This checklist answers one question: **is this specific property ready to serve real guests today?**

The checklist is divided into five categories. Each has a minimum pass threshold. A property cannot activate unless every category meets its minimum.

---

## How Scoring Works

Each item is scored 0–2:

| Score | Meaning |
|---|---|
| **2** | Complete, accurate, and specific |
| **1** | Present but incomplete, vague, or unverified |
| **0** | Missing or incorrect |

**Scoring applies only to the AI quality categories (B, E).** Categories A, C, D, and F are binary — either all required items are present (pass) or they are not (fail). There is no partial pass on blocking items.

---

## Category A — Activation Blockers (Binary Pass/Fail)

**All items must be present. Any missing item blocks activation.**

The platform performs this check automatically when activation is requested. Homeowner cannot submit for review if these are not complete.

| # | Item | Pass condition | Status |
|---|---|---|---|
| A-01 | Property display name | Present, max 60 chars | [ ] |
| A-02 | Full street address | Street, municipality, province, postcode all present | [ ] |
| A-03 | Property type | Selected from enum | [ ] |
| A-04 | Maximum guest capacity | Integer > 0 entered | [ ] |
| A-05 | Check-in time window | `checkin_from` and `checkin_until` both present | [ ] |
| A-06 | Checkout time | `checkout_by` present | [ ] |
| A-07 | Access method | Selected from enum | [ ] |
| A-08 | Entry instructions | Text present, min 50 characters | [ ] |
| A-09 | Emergency contact name | Present | [ ] |
| A-10 | Emergency contact phone | Present, E.164 format (+39...) | [ ] |
| A-11 | Nearest hospital name | Present | [ ] |
| A-12 | Nearest hospital address | Present | [ ] |
| A-13 | WiFi network name | Present | [ ] |
| A-14 | WiFi password | Present | [ ] |
| A-15 | House rules (condensed) | Text present | [ ] |
| A-16 | CIR or CIN code | Present | [ ] |
| A-17 | Tourist tax amount | Decimal > 0 entered | [ ] |
| A-18 | Smoking policy | Selected from enum | [ ] |
| A-19 | Pet policy | Selected from enum | [ ] |
| A-20 | `is_complete` flag | Set to `true` by homeowner | [ ] |
| A-21 | Platform agreements accepted | ToS + Privacy Policy accepted at registration | [ ] |

**Result: [ ] PASS — all 21 items present | [ ] FAIL — list blocking items**

---

## Category B — AI Quality (Scored 0–2 per item)

**Minimum threshold: 32 / 44 points (73%)**

These items are present in Category A but are assessed here for *quality*, not just presence. The AI concierge is only as useful as the content it has to work with. Vague or incomplete content passes the presence check but produces degraded AI responses.

**Scoring guide:**
- **2** — Specific, actionable, written as if explaining to a first-time guest
- **1** — Present but vague, missing a key detail, or uses unverifiable language ("near the entrance", "somewhere on the left")
- **0** — Missing, contains placeholder text, or is a generic description with no property-specific detail

| # | Item | Max score | Score | Notes |
|---|---|---|---|---|
| B-01 | Entry instructions — precision | 2 | | Can a stranger follow these cold, at night? |
| B-02 | Entry instructions — completeness | 2 | | Every door, code, gate, and turn included? |
| B-03 | Key box or smart lock instructions | 2 | | Exact location described, not just "near the door" |
| B-04 | WiFi credentials — accuracy verified | 2 | | Homeowner confirms these work — not just filled |
| B-05 | Property summary quality | 2 | | Specific neighbourhood context, not just "nice place in Catania" |
| B-06 | Washing machine instructions | 2 | | Step-by-step; programme numbers specified |
| B-07 | Air conditioning / heating instructions | 2 | | Remote location, mode selection explained |
| B-08 | House rules — specificity | 2 | | Quiet hours as times; smoking location named; pet terms clear |
| B-09 | Emergency contact — reliability | 2 | | This is a number the owner actively answers including evenings |
| B-10 | Local area tips | 2 | | At least 3 tips with specific name, description, distance |
| B-11 | Tourist tax — exemptions clear | 2 | | Exemption conditions stated precisely |
| B-12 | Trash instructions | 2 | | Days, bin colours, and bin location all specified |
| B-13 | Nearest pharmacy — name and address | 2 | | Specific name and address, not just "there's a pharmacy nearby" |
| B-14 | Parking instructions (if applicable) | 2 | | Space number or location, access code if needed |
| B-15 | Seasonal notes | 2 | | Present if stay window includes seasonal variation (summer/winter) |
| B-16 | Lockout instructions | 2 | | What to do if code doesn't work — specific fallback, not just "call the owner" |
| B-17 | TV and entertainment guide | 2 | | Remote identified; streaming services listed |
| B-18 | Appliance coverage — completeness | 2 | | Every major guest-use appliance has a guide |
| B-19 | Quiet hours — specific times | 2 | | e.g. "23:00–08:00", not "please be quiet at night" |
| B-20 | Building/neighbourhood orientation | 2 | | Floor, lift availability, any building quirks noted |
| B-21 | Hot water / water heater note | 2 | | If non-standard (boiler, solar, timer) — instructions present |
| B-22 | Language of content | 2 | | Written in a language the AI can deliver (EN or IT at minimum) |

**Total score: _____ / 44**
**Threshold: 32 / 44 — [ ] PASS | [ ] FAIL**

---

## Category C — Compliance-Critical Fields (Binary Pass/Fail)

**All required items must be present and internally consistent. Any gap blocks activation.**

These fields have legal implications. An inaccurate tourist tax rate or missing CIR code exposes the homeowner to regulatory risk and the platform to reputational risk.

| # | Item | Pass condition | Status |
|---|---|---|---|
| C-01 | CIR/CIN code format | Matches expected regional/national format (platform format check) | [ ] |
| C-02 | Tourist tax rate plausible | Rate is within typical range for Sicily (€0.50–€3.50/person/night) — flag if outside this range for homeowner confirmation | [ ] |
| C-03 | Tourist tax max nights plausible | Typically 7 or fewer — flag if above 10 for confirmation | [ ] |
| C-04 | Alloggiati Web status declared | `alloggiati_web_required` field completed by homeowner (true or false — not left blank) | [ ] |
| C-05 | Codice fiscale or P.IVA present | Present on homeowner account | [ ] |
| C-06 | Tourist tax collection method described | Text present in knowledge base | [ ] |

**Result: [ ] PASS — all 6 items present and consistent | [ ] FAIL — list items**

---

## Category D — Emergency Data (Binary Pass/Fail)

**All items must be present and verified. Any gap blocks activation — no exceptions.**

Emergency data is used in real-time during safety incidents. An AI concierge that cannot provide accurate emergency information is a liability.

| # | Item | Pass condition | Verified how | Status |
|---|---|---|---|---|
| D-01 | Emergency contact name | Present | Homeowner declaration | [ ] |
| D-02 | Emergency contact phone — format | E.164 format, Italian number | Automated format check | [ ] |
| D-03 | Emergency contact phone — reachability | Number is answered (homeowner confirms or test call) | Homeowner declaration at MVP | [ ] |
| D-04 | Nearest hospital name | Present, named specifically | Homeowner declaration | [ ] |
| D-05 | Nearest hospital address | Full street address | Homeowner declaration | [ ] |
| D-06 | Nearest hospital — not outdated | Hospital is still operational (not closed/renamed) | Nauxica spot-check on Google Maps | [ ] |
| D-07 | Evacuation route described | Text present if multi-floor property or building with complex layout | Homeowner declaration | [ ] |
| D-08 | Gas shutoff instructions | Present if property has gas supply | Homeowner declaration | [ ] |
| D-09 | Electricity breaker location | Present | Homeowner declaration | [ ] |
| D-10 | Fire extinguisher location | Present if `fire_extinguisher_present: true` | Homeowner declaration | [ ] |
| D-11 | Pool safety notes | Present if `has_pool: true` | Homeowner declaration | [ ] |
| D-12 | Last verified date | `last_verified_at` not more than 90 days ago | System check | [ ] |

**Result: [ ] PASS — all applicable items present and verified | [ ] FAIL — list items**

---

## Category E — Multilingual Readiness (Scored)

**Minimum threshold: Tier B (see below)**

At Sicily launch, the AI concierge serves guests in Italian, English, German, and French. At MVP, property knowledge blocks are authored in one language. This category assesses readiness for the primary guest language mix.

### Language content tiers

| Tier | Requirement | Minimum for activation |
|---|---|---|
| **Tier A — Full** | All AI-visible content authored in both EN and IT | Recommended for premium properties |
| **Tier B — Core** | Entry instructions, WiFi, house rules, and emergency info authored in EN or IT | **Minimum required for activation** |
| **Tier C — Partial** | Some sections present, some missing | Not sufficient for activation |
| **Tier D — Single language only** | Content present in only one language with no cross-language check | Only acceptable if primary guest market is confirmed mono-lingual |

| # | Item | Check | Status |
|---|---|---|---|
| E-01 | Entry instructions present in EN or IT | Content in at least one of these languages | [ ] |
| E-02 | House rules present in EN or IT | Content in at least one of these languages | [ ] |
| E-03 | Emergency contacts language-neutral | Phone numbers are universal — no translation needed | [ ] |
| E-04 | Tourist tax explanation present in EN or IT | Amount and method described | [ ] |
| E-05 | Primary guest language identified | Homeowner has indicated primary guest market language | [ ] |
| E-06 | AI fallback note in knowledge base | If content is in one language only, homeowner has noted this for the AI | [ ] |

**Tier assessment: [ ] Tier A | [ ] Tier B | [ ] Tier C | [ ] Tier D**
**Minimum pass: Tier B — [ ] PASS | [ ] FAIL**

---

## Category F — Quality Flags (Advisory, Non-Blocking)

These do not block activation but are flagged to the homeowner as recommendations. The Nauxica reviewer notes them in the onboarding call.

| # | Advisory item | Rationale |
|---|---|---|
| F-01 | Fewer than 3 local tips | Guests ask for recommendations frequently — an empty tips section generates unnecessary escalations |
| F-02 | No bed configuration detail | Guests with specific sleeping needs (infants, mobility issues) ask about this |
| F-03 | No seasonal notes despite summer launch | If first expected guests arrive in summer, seasonal notes should be present |
| F-04 | No laundry partner assigned for stays > 3 nights | Linen management becomes critical for longer stays |
| F-05 | No preferred cleaning partner assigned | First checkout without a confirmed cleaner is an operational risk |
| F-06 | OTA calendar sync not configured (Professional/Premium) | Manual booking entry increases risk of double-booking |
| F-07 | No second emergency contact provided | If primary contact is unreachable, there is no fallback |
| F-08 | Nearest pharmacy hours not specified | Guests ask about pharmacy availability — especially evenings |

---

## Activation Scoring Summary

Complete this after all categories are assessed.

| Category | Type | Result |
|---|---|---|
| **A — Activation blockers** | Binary pass/fail | [ ] Pass / [ ] Fail |
| **B — AI quality** | Score ≥ 32/44 | _____ / 44 — [ ] Pass / [ ] Fail |
| **C — Compliance** | Binary pass/fail | [ ] Pass / [ ] Fail |
| **D — Emergency data** | Binary pass/fail | [ ] Pass / [ ] Fail |
| **E — Multilingual readiness** | Tier B minimum | [ ] Tier A / [ ] Tier B / [ ] Tier C / [ ] Tier D |
| **F — Quality flags** | Advisory | _____ flags noted |

### Overall activation decision

| Condition | Outcome |
|---|---|
| All binary categories pass AND B score ≥ 32 AND E is Tier B or above | **✓ Approved for activation** |
| Any binary category fails | **✗ Blocked — return to homeowner with specific items** |
| B score 28–31 | **⚠️ Conditional — activate with advisory note; recommend completing flagged items within 7 days** |
| B score below 28 | **✗ Blocked — AI concierge quality insufficient; return to homeowner** |
| E is Tier C or D | **⚠️ Conditional — activate with note that non-EN/IT guests will receive degraded service** |

---

## Property Quality Score

For internal tracking. Calculated as a composite of Category B score and Category F flag count.

| Score | Label | Description |
|---|---|---|
| B ≥ 40 + 0 F flags | ⭐⭐⭐ Excellent | Best-in-class knowledge base. Expected AI performance: high. |
| B 34–39 + ≤ 2 F flags | ⭐⭐ Good | Solid knowledge base. AI performs well on most queries. |
| B 28–33 + ≤ 4 F flags | ⭐ Adequate | Meets minimum. AI may fall back more frequently than expected. |
| B < 28 or > 4 F flags | Below threshold | Not yet sufficient for activation. |

This score is an internal operational tool. It is not shown to homeowners as a rating — it informs how closely the Nauxica team monitors the property in its first month.

---

## Post-Activation Quality Maintenance

Activation is not a permanent state. The following trigger a quality re-review.

| Trigger | Action |
|---|---|
| 3+ AI fallback responses in a single stay | Nauxica flags knowledge block fields that caused fallbacks |
| Guest complaint about AI providing wrong information | Immediate knowledge block review |
| Emergency contact unreachable during escalation | Immediate homeowner contact; emergency data re-verification |
| 90 days since last verification | Platform sends re-verification prompt to homeowner |
| Homeowner reports property renovation or access change | Entry instructions, access codes, emergency data re-verified |
| Property suspended then reinstated | Full Category D re-check before reinstatement |

---

## Related Documents

- [homeowner-onboarding.md](homeowner-onboarding.md) — Full onboarding journey this checklist sits within
- [property-intake-checklist.md](../../property-intake/property-intake-checklist.md) — Phase-by-phase intake process
- [property-knowledge-base-template.md](../../property-intake/property-knowledge-base-template.md) — Content guidance for Category B items
- [property-knowledge-schema.md](../../ai-concierge/property-knowledge-schema.md) — Technical schema for knowledge block
- [emergency-procedures.md](../../ai-concierge/emergency-procedures.md) — Why Category D is activation-blocking
