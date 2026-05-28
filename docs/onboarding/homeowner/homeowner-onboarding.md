# Homeowner Onboarding

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Sicily launch · Property owners and managers
**Last updated:** 2026-05-28
**Related:** [subscription-plans.md](subscription-plans.md) · [property-activation-checklist.md](property-activation-checklist.md) · [property-intake-checklist.md](../../property-intake/property-intake-checklist.md) · [property-knowledge-base-template.md](../../property-intake/property-knowledge-base-template.md) · [regulatory-compliance-checklist.md](../../legal/regulatory-compliance-checklist.md)

---

## Overview

This guide walks a new homeowner through the complete process of joining Nauxica, setting up their first property, and reaching activation — the point at which the AI concierge can serve their first guest.

**Estimated time to activation:** 2–4 hours of active work across 2–3 sessions. Compliance steps (CIR code, tourist tax confirmation) may require additional time depending on the homeowner's preparedness.

**MVP onboarding model:** During the MVP phase, every homeowner goes through a founder-assisted onboarding call before activation. Self-service is the goal at scale — at MVP, human review ensures quality, catches compliance gaps, and builds the relationship between Nauxica and each property owner.

---

## Who This Guide Is For

- Individual property owners with 1–3 short-term rental properties in Sicily
- Property managers managing multiple properties on behalf of owners
- Anyone adding a Sicilian property to the Nauxica platform for the first time

---

## What You Need Before Starting

Gather these before beginning. Missing items will block specific steps.

| Item | Required for | Notes |
|---|---|---|
| Email address | Account creation | Used for login and notifications |
| Italian mobile number | Account verification | SMS verification required |
| Codice fiscale or Partita IVA | Identity & compliance | Italian tax ID — personal or business |
| CIR or CIN code | Property activation | Regional/national rental registration code — see Step 4 |
| Tourist tax rate for your municipality | Property setup | Check your comune's website or ask a commercialista |
| Property address | Property creation | Full street address including postcode |
| Property access information | AI concierge setup | Entry instructions, key box location, codes |
| Emergency contact details | Required before activation | Name and phone number for urgent guest issues |
| Nearest hospital name and address | Required before activation | For AI emergency responses |
| WiFi network name and password | Required before activation | The network your guests will use |

---

## Step 1 — Account Creation

**Platform:** Registration page at [platform URL]
**Estimated time:** 5 minutes

### 1.1 Register

1. Navigate to the Nauxica registration page
2. Select account type: **Homeowner / Property Manager**
3. Enter: email address, password, full legal name, mobile phone number
4. Accept the Terms of Service and Privacy Policy
   - These must be read — they define your obligations regarding guest data, tourist tax, and Alloggiati Web registration
5. Accept the WhatsApp communications consent notice
   - This is required for the AI concierge to communicate with your guests
6. Click **Create account**

### 1.2 Verify your email

- A verification email is sent immediately
- Click the link in the email — it expires after 24 hours
- If you do not receive it within 5 minutes: check spam, then use "Resend verification"

### 1.3 Verify your phone number

- An SMS OTP is sent to your mobile number
- Enter the 6-digit code in the platform
- Your number is used for urgent platform notifications and escalation alerts

### 1.4 Enter your tax identity

- Enter your **codice fiscale** (individual owners) or **Partita IVA** (business operators)
- This is required for compliance reporting and invoicing
- It is stored encrypted and is not visible to guests or partners

> ⚠️ **Legal note:** Your tax identity is required for CIR/CIN registration verification and tourist tax compliance. Do not skip this step.

**Blocker:** If you do not complete email and phone verification within 72 hours, the account is deactivated. Re-register to restart.

---

## Step 2 — Subscription Plan Selection

**Estimated time:** 5 minutes

Review the full plan comparison in [subscription-plans.md](subscription-plans.md). Key decision points:

| Your situation | Recommended plan |
|---|---|
| 1 property, getting started | **Starter** |
| 2–3 properties or want full message schedule | **Professional** |
| Portfolio management (4+ properties) | **Premium** |

### 2.1 Select your plan

1. Review the plan comparison table
2. Choose monthly or annual billing (annual saves approximately 2 months)
3. Enter payment details — card or SEPA direct debit
4. Confirm subscription

**Free trial:** A [X]-day free trial is available on all plans. No payment required to begin the trial.

### 2.2 After plan selection

Your account dashboard is now accessible. Your properties section is empty — proceed to Step 3.

**MVP note:** At this point in the MVP period, a Nauxica onboarding email is automatically sent to you with a link to schedule your founder onboarding call. This call happens before your property is activated, not at this stage. Continue with setup independently and the call will be scheduled at the appropriate time.

---

## Step 3 — Property Creation

**Estimated time:** 20–30 minutes for basic data

### 3.1 Start a new property

1. In the dashboard, go to **Properties → Add property**
2. The property creation wizard opens
3. Your property starts in `draft` status — no data is validated yet

### 3.2 Basic identity

| Field | What to enter |
|---|---|
| Display name | What guests see. 60 characters max. e.g. "Villa Mare" |
| Property type | Villa / Apartment / House / Penthouse / Cottage |
| Internal reference | Optional — your own code (e.g. Airbnb listing ID) |

### 3.3 Location

| Field | What to enter |
|---|---|
| Street address | Full street name and number |
| Locality (district/neighbourhood) | e.g. "Ognina" — helps AI orient guests |
| Municipality | City or town — e.g. "Catania" |
| Province | Sicilian province code — e.g. "CT", "ME", "PA" |
| Postcode (CAP) | 5-digit Italian postcode |
| GPS coordinates | Optional at this stage — enter via map pin if available |

### 3.4 Configuration

| Field | What to enter |
|---|---|
| Maximum guests | Hard limit — do not exceed this in any booking |
| Bedrooms | Number of bedrooms |
| Bathrooms | Number of bathrooms |
| Bed configuration | e.g. "1 king bed, 2 single beds" |
| Key amenities | Pool, parking, air conditioning, washing machine — select from list |

### 3.5 Access method

Select how guests access your property:
- **Key box** — code-protected box fixed to the property
- **Smart lock** — app or code-operated electronic lock
- **Host handover** — you or a contact physically hands over keys
- **Concierge desk** — building concierge manages key collection

This determines which access fields are shown in the next steps.

### 3.6 Basic check-in information

| Field | What to enter |
|---|---|
| Check-in from | Earliest check-in time, e.g. 15:00 |
| Check-in until | Latest standard check-in, e.g. 20:00 |
| Checkout by | Checkout deadline, e.g. 10:00 |
| Early check-in available | Yes / On request / No |
| Late checkout available | Yes / On request / No |

### 3.7 Save as draft

At this point, save. The property is in `draft` status. Proceed to compliance steps before setting up the AI concierge.

**Platform behaviour:** A draft property does not appear in any marketplace listing and the AI concierge is not active. You can return to continue at any time.

---

## Step 4 — CIR/CIN Code

**Estimated time:** 5 minutes if you have the code. Days or weeks if you need to obtain it.

> ⚠️ **This step is activation-blocking.** A property cannot be set to `active` without a valid CIR or CIN code. Do not begin the AI concierge setup until this is resolved.

### 4.1 What is required

Italian and Sicilian law requires a registration code for all short-term rental properties. There are currently two overlapping systems:

| Code type | Issued by | Notes |
|---|---|---|
| **CIR** (Codice Identificativo Regionale) | Regione Siciliana | Regional code — currently the primary operative requirement in Sicily |
| **CIN** (Codice Identificativo Nazionale) | Ministero del Turismo (BDSR) | National code — being rolled out nationally |

**Action required:** Confirm with a local commercialista or the relevant authority which code currently applies to your property municipality in Sicily and how to obtain it. The transition from CIR to CIN is in progress and the requirement may be dual. See [regulatory-compliance-checklist.md](../../legal/regulatory-compliance-checklist.md) Section A.

### 4.2 Enter your code

1. In the property setup wizard, go to **Compliance → Registration code**
2. Enter the code exactly as issued
3. The platform performs a format check — it does not verify validity with the authority
4. The code is displayed on all property listing surfaces as required by law

### 4.3 If you do not yet have a code

- Save the property in `draft` status
- Obtain the code through the appropriate authority
- Return and enter it before requesting activation

**Nauxica cannot obtain the code on your behalf.** It is issued to the property owner by the relevant authority.

---

## Step 5 — Tourist Tax Configuration

**Estimated time:** 10 minutes

> ⚠️ This is a legal obligation. The tourist tax (tassa di soggiorno) is a per-person, per-night tax set by your municipality. You are responsible for collecting it from guests and remitting it to the municipality.

### 5.1 Find your rate

The rate is set by your comune (municipality) and changes periodically. Sources:
- Your comune's official website (search: "[nome comune] tassa di soggiorno")
- Your commercialista
- The Regione Siciliana tourism portal

**Common rates in Sicily (indicative — confirm for your specific comune):**
Most Sicilian municipalities charge between €0.50 and €3.00 per person per night, with a maximum of 7 consecutive nights per stay. Some exempt children under 12 and certified disabled guests.

### 5.2 Configure in the platform

| Field | What to enter |
|---|---|
| Tax amount | € per person per night — decimal, e.g. 2.00 |
| Maximum nights | Nights tax applies per stay, e.g. 7 |
| Exemptions | Free text — e.g. "Children under 12 exempt. Guests with certified disability exempt." |
| Collection method | How you collect — e.g. "Cash at check-in" |

### 5.3 AI concierge behaviour

Once configured:
- The AI concierge informs guests of the tax amount and collection method when asked
- The AI does not collect the tax — this remains your responsibility
- If a guest disputes the tax, the AI escalates to you

**Do not leave this field empty.** If it is empty, the AI cannot answer guest questions about the tax, which generates unnecessary escalations and erodes guest trust.

---

## Step 6 — AI Concierge Knowledge Base Setup

**Estimated time:** 45–90 minutes for the first property. Faster for subsequent properties.

This is the most important step in onboarding. The quality of your property's knowledge base directly determines the quality of the AI concierge. A complete, specific, well-written knowledge base produces a concierge that guests trust. An incomplete one produces fallback responses and unnecessary escalations.

### 6.1 Open the knowledge base template

1. In the property setup wizard, go to **AI Concierge → Knowledge base**
2. The guided form follows the structure of [property-knowledge-base-template.md](../../property-intake/property-knowledge-base-template.md)
3. Work through each section in order

### 6.2 Section-by-section guidance

**Property summary (required)**
Write 2–4 sentences describing the property and its neighbourhood. Write as if you are telling a guest over the phone — warm, specific, conversational.

> Good: "Villa Mare is a bright two-bedroom apartment on the third floor of a liberty-style building in the Ognina district of Catania, 300 metres from the sea."
> Weak: "Nice apartment in Catania, close to the sea."

**Access and entry instructions (required, activation-blocking)**
Write numbered steps that a guest arriving alone at night could follow without confusion. Test your own instructions — if you cannot follow them cold, a guest cannot either.

> Tip: Walk through your own entry process and write what you see at each step. Include colours, heights, and landmarks. Don't assume the guest knows anything.

**WiFi (required, activation-blocking)**
Enter the exact network name and password. These are case-sensitive. Double-check them.

**Appliance guides (recommended)**
Write instructions for every appliance a guest might use: washing machine, air conditioning, TV, dishwasher, water heater if non-standard. One guide per appliance. Short, numbered steps.

**House rules (required)**
Write the guest-facing condensed version — maximum 8 bullet points. The AI delivers this version in conversation, not your full legal house rules.

**Emergency contacts (required, activation-blocking)**
- Your name and the mobile number guests should call in an emergency
- This must be a number you answer, including evenings and weekends
- Nearest hospital: name and full address

> ⚠️ **Critical:** If these fields are inaccurate or empty, the AI cannot respond correctly to emergencies. This is a guest safety issue, not a platform formatting requirement.

**Tourist tax (required if applicable)**
This should already be filled from Step 5. Verify it is present and accurate.

**Local tips (optional but recommended)**
Add 3–5 curated local recommendations — restaurant, beach, market, transport. Be specific. "A restaurant near the sea" is not useful. "Trattoria del Porto on the harbour, 3 minutes' walk — order the ricci" is.

### 6.3 Knowledge base quality review

Before marking the knowledge base as complete:

- [ ] Read through every section as a guest arriving for the first time
- [ ] Test the entry instructions — are they unambiguous?
- [ ] Confirm WiFi credentials are accurate
- [ ] Confirm emergency contact phone number is currently active
- [ ] Remove any placeholder text
- [ ] Confirm all required fields are filled

See the full quality checklist in [property-activation-checklist.md](property-activation-checklist.md).

### 6.4 Save and mark complete

When you are satisfied the knowledge base is complete, mark it as ready for review. The platform status advances to `onboarding` and notifies the Nauxica team that a review is pending.

---

## Step 7 — Partner Assignment (Recommended Before Activation)

**Estimated time:** 15–30 minutes

You do not need preferred partners to activate — the AI concierge works without them. However, setting up partner preferences before your first guest means you are not sourcing a cleaner or maintenance person urgently the night before a checkout.

### 7.1 Browse the partner marketplace

1. Go to **Partners → Marketplace**
2. Filter by: service type, municipality, availability, rating
3. Review partner profiles — service description, ratings, typical pricing

### 7.2 Service types to consider for most properties

| Service | When needed | Priority |
|---|---|---|
| **Cleaning** | Between every stay | Essential before first checkout |
| **Maintenance** | When issues arise | Set up early — maintenance emergencies are urgent |
| **Transfers** | If guests request airport pickups | Optional — depends on your guest profile |
| **Laundry** | Linen and towel turnaround | Useful for high-occupancy properties |
| **Experiences** | Upsell for guests | Optional — add post-activation |

### 7.3 Add preferred partners

For each service type, you can add up to [plan limit] preferred partners per property. When you create a job request, preferred partners are contacted first before the general marketplace.

1. Open a partner profile
2. Click **Add as preferred partner for [property name]**
3. Confirm the assignment

### 7.4 If no suitable partner is available

The marketplace may have limited coverage at MVP. If no partner is listed for your area and service type:
- Contact the Nauxica team — the founder may be able to assist with a direct introduction
- Use your own existing service contacts for now — they can join Nauxica when ready

---

## Step 8 — Activation Review

**Estimated time:** 24–48 hours (Nauxica review) plus any correction time

### 8.1 Request activation

Once your property is fully set up:
1. Go to **Properties → [Property name] → Request activation**
2. The platform performs an automated completeness check
3. If all activation-blocking fields are present: the request is submitted for Nauxica review
4. If blocking fields are missing: the platform lists what needs completing before you can proceed

### 8.2 Founder onboarding call (MVP)

During the MVP period, activation includes a short call with the Nauxica founder (or team member). The call:
- Confirms the property knowledge base is complete and accurate
- Verifies CIR/CIN code is in place
- Confirms tourist tax configuration is correct
- Reviews emergency contacts
- Answers any questions about the platform

**Call duration:** 20–30 minutes
**Scheduling:** Nauxica sends a calendar link automatically when activation is requested
**Cannot be skipped at MVP** — it is the quality gate before the AI concierge goes live with real guests

### 8.3 Nauxica review checklist

During the review, the Nauxica team checks:

| Check | Pass condition |
|---|---|
| CIR/CIN code present | Code entered and format appears valid |
| Tourist tax configured | Rate entered for the correct municipality |
| Emergency contacts active | Phone number is reachable (test call or homeowner confirmation) |
| Entry instructions complete | Precise, step-by-step, no placeholders |
| WiFi credentials present | Network and password filled — accuracy is owner's responsibility |
| Knowledge base marked complete | `is_complete: true` |
| No placeholder text remaining | Full review of all text fields |
| Platform agreement signed | Terms of Service and Privacy Policy accepted at registration |

### 8.4 Correction requests

If the Nauxica review identifies issues:
1. You receive a specific list of what needs correcting
2. Make the corrections and resubmit
3. Resubmissions are reviewed within 24 hours at MVP

### 8.5 Activation confirmation

When the review passes:
- Property `platform_status` is set to `active`
- You receive a confirmation email
- The AI concierge is live — it will respond to any guest message linked to this property from this point
- An AI concierge test is run by the Nauxica team before notifying you (simulated guest check-in scenario)

---

## Step 9 — First Booking Setup

**Estimated time:** 10 minutes

Once active, configure how bookings are entered so the AI concierge can identify guests.

### 9.1 Adding bookings at MVP

At MVP, bookings are entered manually by the homeowner in the platform dashboard. OTA calendar sync is available on Professional and Premium plans.

To add a booking:
1. Go to **Bookings → Add booking**
2. Enter: guest name, guest WhatsApp number, check-in date, checkout date, guest count
3. Optionally: number of adults, children (for tourist tax calculation), booking source
4. Enter guest document information for Alloggiati Web (if required for your property — see Step 4 of the [property-intake-checklist.md](../../property-intake/property-intake-checklist.md) Phase 3)

### 9.2 Guest WhatsApp number

This is the number the AI concierge uses to identify the guest. It must be:
- The number the guest will use to contact the concierge
- Entered in E.164 format: +39 followed by the mobile number
- Verified as an active WhatsApp number

If the number is wrong or not on WhatsApp, the AI cannot serve the guest — they will need to contact you directly.

### 9.3 Alloggiati Web reminder

When you add a booking for a property with `alloggiati_web_required: true`, the platform reminds you that guest registration with Alloggiati Web is due within 24 hours of guest arrival. This is your legal obligation — the platform provides the reminder and the guest data, but registration is completed by you on the Alloggiati Web portal.

---

## Common Onboarding Blockers

These are the most frequent reasons homeowners get stuck. Knowing them in advance saves time.

| Blocker | Cause | Resolution |
|---|---|---|
| Cannot obtain CIR/CIN code quickly | Waiting for authority to issue or renew | Begin CIR/CIN application early — it can take 1–2 weeks. You can complete all other steps while waiting. |
| Tourist tax rate unknown | Homeowner has not checked their comune's current rate | Contact your commercialista or check the comune website. Do not guess. |
| Entry instructions too vague to pass review | Homeowner writes "key is near the entrance" | Walk through your own entry process step by step and write exactly what you see. |
| Emergency contact phone not answered in test | Homeowner listed a number they do not answer reliably | Use the number you carry at all times. If you are not reachable, designate a reliable backup and list them. |
| WiFi credentials incorrect | Network renamed or password changed since entered | Re-test credentials before confirming. |
| Alloggiati Web setup not completed | Homeowner does not have an Alloggiati Web account | Create an account at [alloggiatiweb.poliziadistato.it] before your first guest arrives. This takes several days as approval is required from local police. |
| No cleaning partner available before first checkout | Partner sourcing left too late | Set up cleaning partner assignment at Step 7, before first booking is added. |

---

## Founder / MVP Manual Intervention Points

These are the points in onboarding where the founder or Nauxica team is actively involved at MVP. They are not automated.

| Point | Trigger | Nauxica action |
|---|---|---|
| Activation request received | Homeowner marks knowledge base complete | Nauxica schedules onboarding call within 24h |
| Onboarding call | Scheduled post-activation request | Founder reviews property, asks clarifying questions, signs off or returns with corrections |
| CIR code format uncertain | Homeowner enters an unusual format | Nauxica team checks format against known regional patterns |
| Tourist tax rate seems implausible | Rate entered is significantly above or below typical range | Nauxica flags to homeowner for confirmation before activation |
| Emergency contact unreachable | Test contact attempt fails | Nauxica contacts homeowner to resolve before activation proceeds |
| Knowledge base quality too low | Review finds vague or placeholder content | Nauxica returns specific corrections — not a general rejection |
| First booking added to newly activated property | Triggered by booking creation | Nauxica team manually verifies AI concierge is responding correctly by simulating a message |

---

## After Activation — Ongoing Responsibilities

Activation is the beginning, not the end. Your ongoing responsibilities:

| Responsibility | Frequency | Notes |
|---|---|---|
| Keep entry codes updated | Whenever a lock or code is changed | AI concierge will deliver outdated codes if not updated |
| Update WiFi credentials | Whenever the password changes | |
| Verify emergency contacts still active | Every 90 days | Platform prompts you |
| Update tourist tax rate if comune changes it | When rate changes | You are responsible for accuracy |
| Add each new booking manually (Starter/Manual) | Per booking | Or configure OTA sync on Professional/Premium |
| Complete Alloggiati Web registration | Within 24h of each guest arrival | Your legal obligation — platform reminds you |
| Mark Alloggiati registration complete in platform | Per booking | Closes the compliance tracking loop |
| Review AI concierge escalations | As they arise | Respond within the SLA for your plan |
| Update knowledge base for seasonal changes | At least twice a year | Summer/winter conditions, local business hours, etc. |

---

## Related Documents

- [property-activation-checklist.md](property-activation-checklist.md) — Quality scoring before activation
- [property-intake-checklist.md](../../property-intake/property-intake-checklist.md) — Detailed phase-by-phase intake
- [property-knowledge-base-template.md](../../property-intake/property-knowledge-base-template.md) — Knowledge base content guide
- [subscription-plans.md](subscription-plans.md) — Full plan comparison
- [regulatory-compliance-checklist.md](../../legal/regulatory-compliance-checklist.md) — CIR, tourist tax, Alloggiati Web
- [escalation-rules.md](../../ai-concierge/escalation-rules.md) — How the AI handles and escalates guest issues
