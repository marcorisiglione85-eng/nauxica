# Common Issue Playbooks

**Version:** 1.0
**Status:** Complete — Operational
**Scope:** Sicily launch · Guest issues, homeowner issues, operational failures
**Last updated:** 2026-05-28
**Audience:** Nauxica operators · Homeowners (sections marked for homeowner use)
**Related:** [operator-runbook.md](../operations/operator-runbook.md) · [operator-response-templates.md](../operations/operator-response-templates.md) · [escalation-rules.md](../ai-concierge/escalation-rules.md) · [emergency-procedures.md](../ai-concierge/emergency-procedures.md) · [service-request-flow.md](../operations/service-request-flow.md)

---

## How to Use This Document

Each playbook covers one recurring operational issue. Use the structure:

1. **Read the symptoms** — confirm you're looking at the right playbook
2. **Check likely causes** — understand what's probably happening before acting
3. **Follow AI-handled steps** — if the AI concierge is still in the conversation, these have already been attempted
4. **Apply operator actions** — if you're taking over, start here
5. **Check homeowner involvement** — know when to loop in the homeowner and what to ask for
6. **Target resolution time** — don't let issues drag past this
7. **Post-resolution verification** — confirm the issue is actually closed

**Escalation codes** referenced below match the taxonomy in `docs/ai-concierge/escalation-rules.md`.

---

## Playbook Index

| # | Issue | Typical urgency |
|---|---|---|
| PIB-01 | Guest cannot enter property | HIGH to CRITICAL |
| PIB-02 | WiFi not working | NORMAL to HIGH |
| PIB-03 | Cleaner did not arrive | HIGH |
| PIB-04 | Wrong or stale access code | HIGH |
| PIB-05 | Noisy neighbour complaint | NORMAL |
| PIB-06 | Air conditioning issue | NORMAL to HIGH |
| PIB-07 | Late checkout dispute | NORMAL |
| PIB-08 | Missing inventory report | NORMAL |
| PIB-09 | Guest locked out (mid-stay) | HIGH to CRITICAL |
| PIB-10 | Tourist tax confusion | NORMAL |

---

## PIB-01 — Guest Cannot Enter Property

**Typical urgency:** HIGH (day arrival) → CRITICAL (evening/night arrival)

### Symptoms
- Guest messages that they are at the property and cannot get in
- Key box not opening, smart lock not responding, code rejected, gate not opening
- Guest has not arrived yet but is concerned about access after reading instructions

### Likely Causes
| Cause | Frequency |
|---|---|
| Wrong entry point — guest at wrong door or gate | Very common |
| Access code was changed and knowledge base not updated | Common |
| Key box battery dead | Occasional |
| Smart lock app issue or connectivity failure | Occasional |
| Property address communicated incorrectly | Rare |
| Code sent by AI concierge before check-in window opened | Rare |

### AI-Handled Steps (already attempted if AI escalated)
1. AI confirmed which entry point and code the guest is using
2. AI provided step-by-step entry instructions from the property knowledge block
3. AI sent the access code (if session_phase = check_in_day and current_time ≥ check_in_from)
4. AI issued one re-send of the code on request
5. AI escalated after 3 failed attempts or explicit guest request

### Operator Actions
1. Confirm the guest's exact location — "Which door are you at? Describe what you see."
2. Cross-reference the correct entry point from the property knowledge block
3. Contact the homeowner immediately via in-platform message — "Guest [name] cannot access [property]. Please call or message me now."
4. If homeowner unreachable within 10 minutes: contact homeowner on their emergency number
5. If smart lock: check if the lock can be remotely opened by the homeowner
6. If key box: get the correct current code from the homeowner and pass it directly to the guest
7. If no resolution in 30 minutes after 22:00: assess alternative accommodation options and notify the homeowner that this may be needed

### Homeowner Involvement
- Immediate contact required
- Ask: "Is the current access code [CODE]? Has it changed recently? Can you open the lock remotely?"
- After resolution: "Please update the access code in the property knowledge base immediately."

### Resolution Target
- Daytime: guest inside within 30 minutes of operator taking over
- Evening (after 20:00): guest inside within 20 minutes or alternative arranged within 45 minutes
- Night (after 22:00): treat as URGENT — operator cannot stand down until guest has safe access or alternative accommodation

### Post-Resolution Verification
- Confirm with guest that they are inside: "Are you in? Is everything OK?"
- Log the incident in the property's record
- Create a Task for the homeowner to update the access code in the knowledge base
- If a different entry point than documented worked: create a Task to update entry instructions

---

## PIB-02 — WiFi Not Working

**Typical urgency:** NORMAL (annoying) → HIGH (guest working remotely, stays dependent on connectivity)

### Symptoms
- Guest cannot connect to the WiFi network
- Network not visible in device list
- Password not working
- Connected but no internet access

### Likely Causes
| Cause | Frequency |
|---|---|
| WiFi password changed by homeowner without updating knowledge base | Very common |
| Guest device issue (wrong network selected, saved incorrect password) | Common |
| Router needs restart | Common |
| ISP outage — not property-specific | Occasional |
| Network name (SSID) changed | Occasional |
| Router hardware failure | Rare |

### AI-Handled Steps (already attempted)
1. AI provided network name and password from property knowledge block
2. AI provided standard troubleshooting steps (forget network, re-enter password, restart router)
3. AI escalated if guest confirms the steps were tried and failed

### Operator Actions
1. Confirm: has the guest tried forgetting and re-entering the network? If not, guide them through this.
2. Confirm: is the router visible and lit normally? Ask guest to describe indicator lights.
3. Contact homeowner: "Guest at [property] reports WiFi not working. Can you confirm the current network name and password? Has anything changed recently?"
4. If homeowner confirms credentials are correct: advise guest to restart the router (if location known from property brief) — "The router is [location]. Hold the power button for 10 seconds, wait 30 seconds, then reconnect."
5. If password mismatch confirmed: get correct password from homeowner, pass to guest.
6. If ISP outage: check provider status for the property's municipality. Inform guest factually — "There appears to be an outage in [area]. I've notified the homeowner and there's nothing to fix from the property — it should resolve within [provider's estimated time] or you can use mobile data in the meantime."

### Homeowner Involvement
- First contact: confirm current credentials and whether anything has changed
- After resolution: if credentials had changed, instruct homeowner to update property knowledge base

### Resolution Target
- Credentials issue: resolved within 30 minutes
- Hardware issue: homeowner to arrange repair or replacement within 24 hours
- ISP outage: no resolution possible — inform guest, document for homeowner

### Post-Resolution Verification
- Guest confirms they are connected and online
- If credentials were outdated: confirm homeowner has updated the knowledge base (or create a Task)

---

## PIB-03 — Cleaner Did Not Arrive

**Typical urgency:** HIGH — escalates to CRITICAL if a new guest is arriving that day

### Symptoms
- Homeowner reports cleaner has not arrived by the expected time
- Checkout has happened but property has not been cleaned for an imminent check-in
- Cleaner marked as confirmed but no job completion notification

### Likely Causes
| Cause | Frequency |
|---|---|
| Partner scheduling conflict or emergency | Occasional |
| Partner did not receive or acknowledge the job request | Common |
| Response window expired and no backup partner assigned | Common |
| Job was created but not routed to a partner | Rare |

### AI-Handled Steps
The AI concierge does not manage cleaning scheduling directly. This is an operator/homeowner issue.

### Operator Actions
1. Check the ServiceRequest record: what state is it in? Has a PartnerRequest been sent? Has the partner accepted?
2. If no PartnerRequest created: the routing failed — create one manually and dispatch to the assigned cleaning partner
3. If PartnerRequest was sent but not accepted: check if response window has expired; contact the partner directly
4. Contact partner by in-platform message: "You were scheduled to clean [property description] at [time]. Are you still coming? Please respond within 15 minutes."
5. If no partner response within 15 minutes: begin identifying an alternative partner — check the homeowner's assigned backup partners for the cleaning service type
6. Contact homeowner: "Your cleaner [name] hasn't confirmed for today. I'm following up with them and looking for a backup. When is the new guest arriving?"
7. If new guest arrives before clean is complete: work with homeowner on options — delayed check-in, partial credit, emergency clean

### Homeowner Involvement
- Notify as soon as no-show is confirmed
- Ask: "Do you have a backup cleaner? Do you have a contact number for [Partner name]?"
- After resolution: "Consider assigning a backup cleaning partner to this property in the marketplace."

### Resolution Target
- If new guest arriving same day: confirmed alternative cleaner within 2 hours
- If no same-day arrival: confirmed alternative within 24 hours, clean completed before next check-in

### Post-Resolution Verification
- Clean completed and job marked complete with photos
- Homeowner confirms property is ready
- Log the no-show against the partner's record (potential D-06 dispute indicator)
- Create a recommendation for the homeowner to assign a backup partner

---

## PIB-04 — Wrong or Stale Access Code

**Typical urgency:** HIGH (if guest is at property) → NORMAL (if discovered before arrival)

### Symptoms
- Guest uses the code from the AI concierge and it does not work
- Homeowner reports they changed the code but the platform shows the old one
- Operator spot-check reveals knowledge base access code differs from actual

### Likely Causes
| Cause | Frequency |
|---|---|
| Homeowner changed the code after a previous guest stay without updating the knowledge base | Very common |
| Smart lock reset automatically | Occasional |
| Code entered incorrectly during knowledge base setup | Occasional |

### AI-Handled Steps (already attempted if guest raised this)
1. AI provided the code from the property knowledge block
2. AI provided step-by-step entry instructions
3. AI escalated after guest confirmed code does not work

### Operator Actions
1. Immediately contact homeowner: "What is the current access code for [property]? The guest reports it isn't working and the platform has [OLD CODE]."
2. Get the correct code from the homeowner.
3. Pass the correct code to the guest via WhatsApp: "I have the updated code: [NEW CODE]. Please try now and let me know if you're in."
4. After resolution: create a Task for the homeowner to update the access code in the property knowledge base immediately.
5. If homeowner is unreachable and you cannot get the current code: escalate to CRITICAL — a guest locked out without a reachable homeowner is a CRITICAL situation after 20 minutes.

### Homeowner Involvement
- Essential — you cannot resolve without the correct code from the homeowner.
- After resolution: "Please update the access code in your property settings. This is the second step in Profile → Property → Access. A stale code locks out guests."

### Resolution Target
- Guest receives correct code: within 15 minutes of operator taking over
- Knowledge base updated: within 24 hours (create Task if homeowner does not confirm)

### Post-Resolution Verification
- Guest confirms they are inside
- Knowledge base access code field confirmed correct
- Log the stale code incident in the property record

---

## PIB-05 — Noisy Neighbour Complaint

**Typical urgency:** NORMAL → HIGH (after quiet hours, if guest cannot sleep)

### Symptoms
- Guest reports excessive noise from neighbouring property or common areas
- Guest cannot sleep or is significantly disrupted
- Guest asks Nauxica to "do something" about the noise

### Likely Causes
| Cause | Frequency |
|---|---|
| Neighbour event or gathering | Common |
| Common area noise (stairwell, shared courtyard) | Common |
| Construction or renovation nearby | Occasional |
| Building-wide issue (mechanical, HVAC) | Rare |

### AI-Handled Steps (already attempted)
1. AI acknowledged the disruption without dismissing it
2. AI provided quiet hours information from the property knowledge block
3. AI provided any relevant neighbour contact information if present in the knowledge block
4. AI explained the options available (concierge or local authority contact)
5. AI escalated if guest requested human help or situation was after quiet hours with no resolution

### Operator Actions
1. Acknowledge the complaint directly: "I understand this is disruptive. Here's what I can do."
2. If noise is from within the property building and a property manager or building contact exists in the knowledge block: contact them now.
3. If noise is from a neighbouring private property: the options are limited. Be honest with the guest.
   - Homeowner contact is appropriate if this is a known or recurring issue.
   - Police (Polizia Municipale) can be called for noise violations during quiet hours — provide the number.
   - Nauxica cannot directly compel a private neighbour.
4. Contact homeowner: "Guest at [property] is reporting ongoing noise from [source]. Are you aware of this? Is there a building contact who can help?"
5. If the noise is persistent and significantly affecting the guest's stay: work with the homeowner on a resolution — not Nauxica's financial decision, but the homeowner may choose to offer a gesture.

### Homeowner Involvement
- Notify if the noise is ongoing or if the guest asks about compensation.
- Do not offer compensation on the homeowner's behalf.

### Resolution Target
- Acknowledgement and initial response: within 30 minutes
- Practical resolution (noise stops): not always achievable — be honest about this
- If noise persists past midnight: review whether alternative accommodation should be offered (homeowner decision, not operator)

### Post-Resolution Verification
- Guest has been given all available options
- If noise was from a building source: confirm with homeowner if it recurs, add a note to the property record

---

## PIB-06 — Air Conditioning Issue

**Typical urgency:** NORMAL (mild weather) → HIGH (summer heat, Sicily — can become a health risk)

### Symptoms
- AC unit not turning on
- AC not cooling effectively (runs but room stays warm)
- Remote control not working
- Guest unfamiliar with how to use the system

### Likely Causes
| Cause | Frequency |
|---|---|
| Guest unfamiliar with remote operation — wrong mode selected | Very common |
| Remote battery dead | Common |
| AC filter clogged — reduced output | Occasional |
| AC unit tripped at breaker | Occasional |
| Mechanical failure | Rare |
| AC unit not turned on at the mains | Common (first-time users) |

### AI-Handled Steps (already attempted)
1. AI provided AC operation instructions from the property knowledge block (remote location, mode, temperature)
2. AI walked guest through standard steps (mode, temperature setting, fan speed)
3. AI escalated if basic steps were confirmed tried and failed

### Operator Actions
1. Confirm which steps the guest has tried. If they haven't tried the basic remote steps, guide them through.
2. Ask: "Is there a small panel on the wall near the AC unit, or is the unit controlled only by the remote?"
3. Guide guest to check the breaker panel if the unit won't turn on at all (location should be in the property knowledge block or Partner Brief).
4. If remote battery dead: "Is there a remote with the unit? If it has batteries, they may need replacing — standard AA batteries. Is there a spare remote in a drawer?"
5. If still not working: create a MAINTENANCE ServiceRequest for an urgent visit.
6. Contact homeowner: "Guest at [property] reports the AC isn't working. They've tried [steps]. I'm creating a maintenance request. Can you confirm your preferred maintenance partner for this property?"
7. In high heat conditions (July/August Sicily): treat as HIGH urgency regardless of time of day. A property without cooling in summer heat is a comfort and potential health issue.

### Homeowner Involvement
- Required if basic steps don't resolve it.
- Homeowner to confirm maintenance partner and authorise a visit if required.
- If AC is non-functional in summer: homeowner decision on whether to offer a portable unit or other resolution.

### Resolution Target
- User instruction issue: resolved in the conversation within 15 minutes
- Technical failure: maintenance visit arranged within 4 hours (or same day if in summer)
- Mechanical failure requiring parts: honest timeline from maintenance partner

### Post-Resolution Verification
- Guest confirms AC is working
- If maintenance was needed: job completion confirmed and knowledge base updated with any relevant notes (e.g. "AC remote batteries need annual replacement — check seasonally")

---

## PIB-07 — Late Checkout Dispute

**Typical urgency:** NORMAL → HIGH (if incoming guest is affected)

### Symptoms
- Outgoing guest has not left by checkout time
- Homeowner or cleaner reports property still occupied at or after checkout
- Incoming guest is scheduled and property is not ready

### Likely Causes
| Cause | Frequency |
|---|---|
| Guest misread checkout time | Common |
| Guest asked for late checkout and received an informal "yes" from someone | Occasional |
| Guest transport delay (flight, train) | Occasional |
| Guest ignoring checkout time deliberately | Rare |

### AI-Handled Steps (already attempted)
1. AI sent checkout reminder (MSG-05) that morning with checkout time
2. AI responded to any guest messages about extending checkout
3. AI did not grant a late checkout (not within AI authority) — escalated to homeowner

### Operator Actions
1. Contact the outgoing guest directly via WhatsApp: "Hi [Name] — I see your checkout time was [time]. Are you still at the property? Can you let me know your status?"
2. Contact the homeowner immediately if an incoming guest is affected: "The outgoing guest at [property] has not yet left. The new guest arrives at [time]. Please advise — can you offer a late checkout, and if so, at what time?"
3. If homeowner authorises a late checkout: communicate the new time to the outgoing guest and confirm the updated cleaning window with the cleaning partner.
4. If homeowner does not authorise a late checkout: "Hi [Name], the checkout time is [time] and we have a cleaning team arriving shortly. We'd need you to vacate by [time]. Please let me know if you need any help with luggage storage."
5. If incoming guest's arrival is at risk: proactively contact the incoming guest to manage expectations before they arrive.

### Homeowner Involvement
- Decision authority: only the homeowner can authorise a late checkout or adjust check-in timing.
- Financial terms of a late checkout (fee or complimentary): homeowner's decision.

### Resolution Target
- Property vacated and clean complete before incoming guest arrives
- If incoming guest affected: contacted at least 30 minutes before their expected arrival

### Post-Resolution Verification
- Outgoing guest has departed
- Cleaning confirmed complete before incoming guest arrival
- If an incoming guest was affected: confirm they checked in successfully

---

## PIB-08 — Missing Inventory Report

**Typical urgency:** NORMAL — time-sensitive only if a new guest arrives before inventory is checked

### Symptoms
- Homeowner reports items missing after a guest stay
- Cleaner reported items missing during post-checkout clean but no formal record was created
- Homeowner received an inventory report but items are disputed

### Likely Causes
| Cause | Frequency |
|---|---|
| Items removed by outgoing guest | Occasional |
| Items were already missing before this stay | Common — no baseline inventory |
| Cleaner put items somewhere different | Common |
| Items damaged during stay, not reported | Occasional |

### AI-Handled Steps
The AI concierge does not manage inventory. This is an operator/homeowner issue.

### Operator Actions
1. Ask the homeowner: "Do you have a pre-stay inventory record that documents what was there before this guest arrived?"
2. If no pre-stay inventory exists: note this as a gap — a missing inventory claim without a pre-stay baseline is very hard to resolve. Advise the homeowner for future stays.
3. If a pre-stay inventory exists: compare against the cleaner's post-stay report or the homeowner's current observation.
4. If items are confirmed missing: open a D-09 dispute process (homeowner vs guest) — this is a homeowner-led process. Nauxica facilitates but does not pursue guests on the homeowner's behalf.
5. Contact the outgoing guest only through the formal dispute process — not informally. Do not accuse a guest of theft without documented evidence.

### Homeowner Involvement
- Homeowner leads this process.
- Advise the homeowner to: (a) document the current state with photos; (b) check whether items might be misplaced; (c) review if they have a prior inventory record.

### Resolution Target
- Initial response and process guidance: within 24 hours of the report
- Formal dispute (D-09) opens if items confirmed missing and guest contact required

### Post-Resolution Verification
- Inventory record updated for future stays
- If dispute opened: tracked through dispute-resolution.md process to close

---

## PIB-09 — Guest Locked Out (Mid-Stay)

**Typical urgency:** HIGH (any time) → CRITICAL (night, vulnerable guest, adverse weather)

### Symptoms
- Guest is outside the property during their stay and cannot get back in
- Access code stopped working mid-stay
- Key broken, lost, or forgotten inside

### Likely Causes
| Cause | Frequency |
|---|---|
| Smart lock code expired or reset | Occasional |
| Key left inside property (self-locking door) | Common |
| Guest forgot access code | Common |
| Key box closed and code forgotten | Common |
| Smart lock app fault | Rare |

### AI-Handled Steps (already attempted)
1. AI checked session_phase (should be in_stay) and provided access code
2. AI provided step-by-step entry instructions
3. AI attempted standard troubleshooting (re-enter code, use keypad not app if applicable)
4. AI escalated after failure with urgency note if after 22:00

### Operator Actions
1. Confirm: "Where are you right now? Are you at the property entrance, or somewhere else?"
2. Provide the access code directly (confirm it is current from the knowledge base).
3. Guide them step by step through the entry — ask them to describe what they're doing and what's happening.
4. If smart lock app is failing: "Try entering the code directly on the keypad if there is one, rather than using the app."
5. If code confirmed correct but not working: contact homeowner immediately for remote unlock or current code.
6. If after 22:00 and no resolution within 15 minutes: CRITICAL escalation — this is a guest locked out overnight. This must not remain unresolved.
7. If a locksmith is needed: get homeowner authorisation first. Nauxica does not commission a locksmith without homeowner sign-off unless the homeowner is entirely unreachable and the guest is in danger.

### Homeowner Involvement
- Immediate contact required if standard code does not work.
- Ask: "Can you remotely unlock the property / confirm the current code / arrange emergency key access?"

### Resolution Target
- Guest inside: within 20 minutes of operator taking over
- After 22:00: within 15 minutes or alternative safe location arranged
- Never acceptable: guest locked out overnight without resolution

### Post-Resolution Verification
- Guest confirms they are inside
- Cause identified: if code stopped working, knowledge base updated and homeowner notified
- If a locksmith was used: invoice logged, cost attributed correctly

---

## PIB-10 — Tourist Tax Confusion

**Typical urgency:** NORMAL

### Symptoms
- Guest asks how much tourist tax is, when it's paid, or why they need to pay it
- Guest refuses to pay tourist tax
- Guest received a different tax amount than expected
- Guest asks for a receipt or invoice for tourist tax

### Likely Causes
| Cause | Frequency |
|---|---|
| Guest unfamiliar with Italian tourist tax (common for international travellers) | Very common |
| Amount differs from OTA listing or pre-booking communication | Occasional |
| Homeowner collecting tax but guest expected to pay on OTA | Occasional |
| Guest believes tax is already included in booking price | Common |

### AI-Handled Steps (already attempted)
1. AI explained the tourist tax (tassa di soggiorno), the amount per person per night, and when it is collected
2. AI explained that the tax is collected by the homeowner, not Nauxica
3. AI explained that Nauxica does not collect, process, or receipt tourist tax
4. AI escalated if the guest disputed the amount or refused to pay

### Operator Actions
1. Confirm the correct tax details from the property knowledge block: amount per person per night, maximum nights, any exemptions.
2. If the amount matches what the homeowner has on record: provide the guest with a factual explanation. "The tassa di soggiorno in [municipality] is €[X] per person per night, collected by your host for up to [N] nights. This is a local government charge — your host is required by law to collect it."
3. If the guest believes the amount is wrong: check with the homeowner. The homeowner is responsible for setting and collecting the correct amount.
4. If the guest refuses to pay: this is between the homeowner and the guest. Nauxica does not arbitrate tourist tax disputes. Advise the homeowner. "The guest is disputing the tourist tax. This is your obligation to manage. We can facilitate a conversation but cannot collect it on your behalf."
5. For receipt requests: the homeowner issues the receipt, not Nauxica. Direct the guest to the homeowner.

### Homeowner Involvement
- Tourist tax is solely the homeowner's responsibility.
- Nauxica's role: inform guests, facilitate the conversation, flag if the rate in the knowledge base appears incorrect.
- Do not advise the homeowner on their legal tax obligations — this requires their own commercialista.

### Resolution Target
- Guest has a clear explanation within 30 minutes
- If dispute: homeowner and guest to resolve directly

### Post-Resolution Verification
- Guest question is answered
- If knowledge base tourist tax info was incorrect: Task created for homeowner to update it

---

## Related Documents

- [operator-response-templates.md](../operations/operator-response-templates.md) — Ready-to-send message templates for escalations
- [operator-runbook.md](../operations/operator-runbook.md) — Day-to-day operating procedures
- [escalation-rules.md](../ai-concierge/escalation-rules.md) — When and how escalations are triggered
- [emergency-procedures.md](../ai-concierge/emergency-procedures.md) — True emergency handling (beyond the scope of these playbooks)
- [dispute-resolution.md](../trust-safety/dispute-resolution.md) — Formal dispute process referenced in PIB-07, PIB-08, PIB-10
- [service-request-flow.md](../operations/service-request-flow.md) — How maintenance and cleaning requests are routed
