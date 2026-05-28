# Property Knowledge Base Template

**Version:** 1.0
**Status:** Draft — Architecture phase
**Scope:** Per-property AI concierge content · Sicily launch
**Last updated:** 2026-05-28
**Related:** [property-data-schema.md](property-data-schema.md) · [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) · [property-intake-checklist.md](property-intake-checklist.md)

---

## What This Document Is

This template is completed once per property by the homeowner or Nauxica onboarding staff. It produces the **property knowledge block** — the structured content that powers the AI concierge for this property.

It is not a raw data form. It is a content document written in guest-facing prose. The AI concierge reads directly from this content; it does not rephrase or interpret raw database fields.

**Rule:** Write every section as if you are explaining it to a guest arriving for the first time, in clear and friendly language. Be specific. Avoid vague descriptions.

---

## Visibility Markers

Each section is marked with its visibility level:

| Marker | Meaning |
|---|---|
| `[PUBLIC]` | Visible to anyone — included in listing, pre-booking responses |
| `[GUEST-ONLY]` | Delivered only to confirmed guests, post-booking, via WhatsApp |

No internal or financial data belongs in this template.

---

## Tone Guidelines

- Direct and warm — not corporate, not overly casual
- Specific — "Turn left after the blue gate" not "it's near the entrance"
- Actionable — step-by-step where instructions are involved
- Concise — guests read this on a phone, often on arrival
- Multilingual-ready — avoid idioms or cultural references that do not translate well

---

## Template

> Copy this section for each property. Replace all placeholder text (shown in `[BRACKETS]`).
> Delete placeholder instructions before marking the template as complete.

---

### Property Reference

| Field | Value |
|---|---|
| Property ID | `[property-id-slug]` e.g. `villa-mare` |
| Display name | `[Property Display Name]` |
| Template version | `1.0` |
| Completed by | `[Name]` |
| Completed date | `[YYYY-MM-DD]` |
| Last verified | `[YYYY-MM-DD]` |

---

### 1. Property Summary `[PUBLIC]`

*Write 2–4 sentences. Describe the property and its setting in a way that orients a first-time guest. Include the type of property, key feature, and neighbourhood context.*

```
[EXAMPLE: Villa Mare is a bright two-bedroom apartment on the third floor of a liberty-style building in the Ognina district of Catania. 
It sits 300 metres from the sea and 15 minutes by car from the historic centre. 
The building has a lift and private parking.]
```

**Your content:**

> [Write here]

---

### 2. Check-in and Checkout `[PUBLIC]`

*State times clearly. Include early check-in and late checkout availability and any conditions.*

| | Time | Available | Notes |
|---|---|---|---|
| Check-in from | `[HH:MM]` | — | |
| Check-in until | `[HH:MM]` | — | *Note: if arriving outside this window, see access instructions below* |
| Checkout by | `[HH:MM]` | — | |
| Early check-in | `[HH:MM or "not available"]` | `[yes / on request / no]` | `[any surcharge or condition]` |
| Late checkout | `[HH:MM or "not available"]` | `[yes / on request / no]` | `[any surcharge or condition]` |

---

### 3. Entry Instructions `[GUEST-ONLY]`

*Write as numbered steps. Be precise — assume the guest has never been here before and is arriving alone at night. Include every door, code, gate, and turn.*

**Access method:** `[key-box / smart-lock / host-handover / concierge-desk]`

**Step-by-step entry:**

```
[EXAMPLE:
1. Walk along Via Roma until you reach the green gate at number 14. 
   The gate has a brass letter box on the right side.
2. The key box is attached to the wall on the left of the gate, at shoulder height. 
   It has an orange Nauxica sticker on it.
3. Enter the code [sent separately] and lift the tab to open the key box.
4. Take the key labelled "FRONT DOOR".
5. Enter the building, take the lift to the 3rd floor, and use the key on door 3B (on your right as you exit the lift).
6. Return the key to the key box at checkout.]
```

**Your content:**

> 1. [Step one]
> 2. [Step two]
> 3. [Step three]
> 4. [Continue as needed]

**Key box location:** `[Precise description — do not just say "near the door"]`

**Building door code (if applicable):** `[Code or "not applicable"]`

**Parking access (if applicable):** `[Location, code, and any instructions]`

**What to do if you can't get in:** `[e.g. "Call the emergency contact below. Do not attempt to force the lock."]`

---

### 4. WiFi & Connectivity `[GUEST-ONLY]`

| | |
|---|---|
| Network name | `[exact network name]` |
| Password | `[exact password — case sensitive]` |
| Router location | `[where the router is, in case of issues]` |
| Backup note | `[e.g. "If the connection drops, restart the router by switching it off and on at the wall. It takes about 60 seconds to reconnect."]` |

---

### 5. Appliance Guides `[GUEST-ONLY]`

*Complete one entry per appliance. Write instructions in plain steps — no technical jargon. Include only the appliances a guest is likely to use.*

#### Washing Machine

**Make / model:** `[e.g. Bosch Serie 4]`

```
[EXAMPLE:
1. Load clothes, close the door firmly.
2. Add detergent to the drawer (compartment II for main wash).
3. Select programme 3 for colours or programme 6 for whites.
4. Press Start. A standard wash takes about 90 minutes.
5. The machine is in the bathroom cupboard — it vibrates during the spin cycle, this is normal.]
```

> [Your instructions]

---

#### Air Conditioning / Heating

**Make / model:** `[e.g. Daikin split unit]`

```
[EXAMPLE:
1. Use the white remote control on the bedside table.
2. Press the power button (top left).
3. Use the up/down arrows to set temperature — we recommend 24°C in summer.
4. Press MODE to switch between cooling (snowflake icon) and heating (sun icon).
5. Please turn off the AC when leaving the apartment.]
```

> [Your instructions]

---

#### TV and Streaming

**TV make / model:** `[e.g. Samsung 55" Smart TV]`

```
[EXAMPLE:
1. Use the black Samsung remote — it's on the TV unit.
2. Netflix is pre-loaded — use the guest profile (blue icon labelled "Guests").
3. To switch input, press the Source button and select HDMI 1 for the Apple TV.
4. The Apple TV remote is the small silver one. Use it to access Disney+, Apple TV+, and YouTube.]
```

> [Your instructions]

---

#### [Additional appliance — copy and repeat as needed]

> [Your instructions]

---

### 6. House Rules `[PUBLIC]`

*Write the condensed version for AI delivery — maximum 8 bullet points. Clear, direct, non-aggressive tone. The full legal house rules are stored separately on the platform.*

```
[EXAMPLE:
• No smoking inside the property. Smoking is allowed on the terrace.
• No parties or events. Maximum [X] guests at any time.
• Quiet hours: 23:00 – 08:00. Please respect neighbours.
• Pets: [allowed / not allowed / on request].
• Check-out: please leave the property tidy and return keys to the key box.
• Air conditioning: please switch off when leaving.
• Windows: please close all windows before using AC.
• Damages: please report any damage immediately to the emergency contact.]
```

**Your content:**

> • [Rule 1]
> • [Rule 2]
> • [Rule 3]
> • [Add up to 8 total]

---

### 7. Trash & Recycling `[GUEST-ONLY]`

*State the collection days and explain the bin system clearly. Many guests are unfamiliar with Italian separate waste collection.*

| | |
|---|---|
| Bin location | `[where the bins are in or near the property]` |
| General waste | `[bin colour and collection day(s)]` |
| Organic waste | `[bin colour and collection day(s), or "not applicable"]` |
| Plastic & metal | `[bin colour and collection day(s)]` |
| Paper & cardboard | `[bin colour and collection day(s)]` |
| Glass | `[bin colour or drop-off point]` |
| Special notes | `[any local rules — e.g. "bags must be tied and left outside by 07:00 on collection day"]` |

---

### 8. Emergency Contacts `[GUEST-ONLY]`

*These are the contacts the AI concierge will give guests in urgent situations. Confirm all contacts have consented to being shared.*

> ⚠️ Legal review required: confirm consent and GDPR basis for sharing contact details with guests.

| Role | Name | Phone | When to call |
|---|---|---|---|
| Property owner / emergency | `[Name]` | `[+39 ...]` | Any urgent property issue, access failure, safety concern |
| Nauxica support | Nauxica | `[support number — TBC]` | Platform or booking issues |
| Local police | Polizia di Stato | `113` | Crime, threat, serious incident |
| Carabinieri | Carabinieri | `112` | Emergency, crime |
| Ambulance / medical | Emergenza Sanitaria | `118` | Medical emergency |
| Fire brigade | Vigili del Fuoco | `115` | Fire, structural emergency |
| EU emergency | General emergency | `112` | All emergencies (unified EU number) |

---

### 9. Nearest Medical Facilities `[GUEST-ONLY]`

| Type | Name | Address | Notes |
|---|---|---|---|
| Hospital (A&E) | `[Name]` | `[Address]` | `[e.g. "Open 24h. Bring your EHIC or travel insurance card."]` |
| Nearest pharmacy | `[Name]` | `[Address]` | `[Opening hours, or note if there is a 24h farmacia di turno nearby]` |
| Nearest GP (if relevant) | `[Name or "not applicable"]` | `[Address]` | `[Notes]` |

---

### 10. Tourist Tax `[PUBLIC]`

*State clearly. The AI will cite this when guests ask about the tourist tax (tassa di soggiorno).*

> ⚠️ Legal review required: tourist tax rates are set by each municipality. Confirm rate, scope, and collection method with legal/tax adviser.

| | |
|---|---|
| Amount | `[€X.XX per person per night]` |
| Applies for maximum | `[X nights per stay]` |
| Exemptions | `[e.g. "Children under 12 years old are exempt. Guests with certified disability are exempt."]` |
| How it is collected | `[e.g. "Collected by the owner at check-in in cash" / "Added to the booking total" / "Invoiced separately"]` |
| Municipality | `[Name of municipality — sets the rate]` |

---

### 11. Local Area Tips `[PUBLIC]`

*Optional. Up to 5 curated recommendations. These are offered by the AI when guests ask for suggestions. Keep descriptions brief and specific.*

| Type | Name | Description | Distance |
|---|---|---|---|
| `[restaurant / beach / market / transport / pharmacy / experience]` | `[Name]` | `[1 sentence description]` | `[e.g. "5 min walk"]` |
| | | | |
| | | | |
| | | | |
| | | | |

---

### 12. Seasonal or Special Notes `[GUEST-ONLY]`

*Optional. Use for anything that changes by season or that a guest arriving at a specific time needs to know.*

```
[EXAMPLES:
• Summer (June–September): the property can get hot. We recommend keeping the shutters closed during the day and opening windows at night.
• December–January: heating is via the AC unit in heat mode. See appliance guide.
• August: many local shops and restaurants close for Ferragosto (week of 15 August). The nearest supermarket that stays open is [name].
• Weekly market: every Saturday morning at Piazza X, 07:00–13:00.]
```

**Your content:**

> [Write here, or leave blank if no seasonal notes apply]

---

## Completion Quality Checklist

Before submitting this template, verify:

- [ ] Property ID matches the slug in the platform (`property_id`)
- [ ] All required sections are filled — no `[placeholder]` text remaining
- [ ] Entry instructions tested: someone unfamiliar with the property has read and confirmed they are clear
- [ ] Access codes and WiFi credentials confirmed accurate
- [ ] Emergency contacts confirmed active and consented
- [ ] Hospital and pharmacy addresses confirmed correct
- [ ] Tourist tax amount confirmed with municipality current rate
- [ ] All text written in guest-facing, direct prose — no owner-facing abbreviations
- [ ] Seasonal notes added if relevant
- [ ] Template completion date recorded above

---

## Related Documents

- [property-data-schema.md](property-data-schema.md) — Full property field reference
- [property-intake-checklist.md](property-intake-checklist.md) — Phase 2 governs this template
- [property-knowledge-schema.md](../ai-concierge/property-knowledge-schema.md) — Technical schema for the AI knowledge block
- [ai-tone-guidelines.md](../ai-concierge/ai-tone-guidelines.md) — Voice and tone for AI content
