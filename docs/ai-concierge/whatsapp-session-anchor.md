# WhatsApp Session Anchor Model

Defines how the AI concierge binds an incoming WhatsApp message to a specific property,
reservation, and guest context. This is the foundational mechanism of the concierge — without
a correct anchor, every response is either wrong or unsafe.

**Related:** [Data Models](../backend/data-models.md) · [Data Visibility Model](../architecture/data-visibility-model.md) · [AI Knowledge Taxonomy](ai-knowledge-taxonomy.md) · [Escalation Rules](escalation-rules.md)

---

## 1. The Core Problem

Nauxica guests have no account and no login. The only identifier available when a guest sends
a WhatsApp message is their phone number. The AI concierge must:

1. Identify which property the guest is staying at
2. Identify which reservation is active
3. Load the correct property knowledge context
4. Determine the correct session phase (pre-arrival, check-in, in-stay, check-out)
5. Do all of this in under 1 second before generating a response
6. Do this securely, so that a guest cannot access another property's data by claiming a wrong number

---

## 2. Phone Number Normalisation

All guest phone numbers stored in the system must use E.164 format:
- `+39 333 123 4567` → stored as `+393331234567`
- `0039 333 123 4567` → stored as `+393331234567`

Normalisation happens at reservation creation time, not at message receipt time.

WhatsApp delivers phone numbers in E.164 format. The lookup is a direct string match between
the incoming WhatsApp `from` field and the stored `guest_phone` on the Reservation record.

---

## 3. Session Resolution Flow

When a WhatsApp message arrives from phone number `P`:

```
Step 1 — Normalise P to E.164

Step 2 — Query: find Reservation where
    guest_phone = P
    AND reservation_status IN ('pre_arrival', 'checked_in')
    AND checkin_date <= today + 2 days  // pre-arrival window
    AND checkout_date >= today          // include check-out day

Step 3 — Evaluate result:

    A. One match found → ANCHOR CONFIRMED
       → Load property context
       → Determine session phase
       → Continue to Step 4

    B. Multiple matches found (same phone, multiple properties)
       → DISAMBIGUATION REQUIRED
       → See Section 5

    C. No match found — check extended window:
       → Query: Reservation where guest_phone = P
         AND checkout_date = yesterday  // 24-hour grace period post-checkout
       → If found → POST-STAY session (limited context, review request only)
       → If not found → UNKNOWN GUEST flow (see Section 6)

Step 4 — Check for existing WhatsAppSession:
    → If active session exists for this P + reservation_id → RESUME session
    → If no session exists → CREATE new WhatsAppSession

Step 5 — Load context:
    → Load PropertyKnowledgeBlock (GUEST-scoped fields only)
    → Pre-load EmergencyData (always, regardless of query)
    → Load GuestStayContext (if reservation is checked-in)
    → Set session_phase based on reservation_status and current date/time
    → Set detected_language from session record or default to 'en'

Step 6 — Generate response
```

---

## 4. Session Phase Determination

The session phase shapes how the AI responds — what information it prioritises, what it
proactively offers, and what tone it uses.

| Phase | Condition | AI Behaviour |
|---|---|---|
| `pre_arrival` | Today is within 48 hours of `checkin_date`, reservation not yet checked in | Focus on arrival logistics: directions, access, check-in time, what to bring. Do not yet share access codes. |
| `check_in` | Today = `checkin_date` | Proactively send welcome + access instructions. Share lockbox code or smart lock details. Orientation tour text. |
| `in_stay` | After check-in confirmed, before `checkout_date` | Full property assistance mode: WiFi, amenities, local tips, service requests, issues. |
| `check_out` | Today = `checkout_date` | Proactively send checkout instructions. Remind of checkout time, checkout tasks, key return. |
| `post_stay` | `checkout_date` + 0–24 hours grace | Thank guest. Request review. Answer final questions. No new service requests accepted. |

**Phase transition triggers:**
- `pre_arrival → check_in`: Automated on `checkin_date` at the `check_in_from` time.
- `check_in → in_stay`: Set when `GuestStayContext.access_code_delivered = true` OR 3 hours after `check_in_from`, whichever comes first.
- `in_stay → check_out`: Automated on `checkout_date` at the time defined in `checkout_reminder_time` property setting (default: 08:00 local time).
- `check_out → post_stay`: Automated when `checkout_completed_at` is set, or at `checkout_date` + 4 hours.

---

## 5. Disambiguation — Multiple Active Reservations

A guest may, in rare cases, have reservations at multiple Nauxica properties simultaneously
(e.g., booking multiple properties for a family trip). Or a phone number collision may occur
on test/demo data.

**When disambiguation is required:**

```
AI response (in guest's detected language):

"Welcome to Nauxica! I can see you have more than one active reservation.
Could you confirm which property you're contacting us about?
[Property A display_name] — checking in [checkin_date]
[Property B display_name] — checking in [checkin_date]"
```

The guest's reply is used to set the session to a specific reservation. The session anchor is
then locked to that reservation for the duration of the stay. The lock is stored in
`WhatsAppSession.reservation_id`.

**Security note:** The disambiguation message must only use `display_name` and `checkin_date`
from the reservation — never full address, access codes, or owner contact details.

---

## 6. Unknown Guest Flow

When a phone number cannot be matched to any active or recent reservation:

```
AI response (English default, or detected language if determinable):

"Hello! Welcome to Nauxica. I'm the AI concierge for our managed properties in Sicily.
I couldn't find an active booking linked to your number.

If you have a reservation, please check your confirmation email for the booking reference,
or contact us at [nauxica support contact].

If you're enquiring about a new booking, please visit [booking link] or contact our team."
```

**What the AI must NOT do in this flow:**
- Ask for the guest's name (unnecessary data collection with no legal basis)
- Offer to look up by name (privacy risk)
- Provide any property-specific information
- Accept service requests

**What the AI should do:**
- Be warm and helpful
- Direct to support contact
- Log the interaction as an `UNKNOWN_CALLER` session type for operator visibility

---

## 7. WhatsApp Session Context Object

What is loaded into the AI's active context window for every session. This is the input package
that the AI receives before generating a response.

```
SessionContext {
    // Anchor
    session_id:            UUID
    session_phase:         Enum (pre_arrival | check_in | in_stay | check_out | post_stay)
    detected_language:     String (ISO 639-1)

    // Guest identity (GUEST-scoped only)
    guest_name:            String
    guest_count:           Integer
    checkin_date:          Date
    checkout_date:         Date
    confirmation_number:   String
    special_requests:      String | null

    // Property knowledge (GUEST-scoped projection)
    property_display_name: String
    property_type:         String
    city:                  String
    // ...all PUB and GST fields from PropertyKnowledgeBlock
    // Structured by knowledge category per ai-knowledge-taxonomy.md

    // Emergency data (always pre-loaded)
    emergency:             EmergencyData (all fields, always present)

    // Dynamic instructions (merged into relevant sections)
    // Active overrides have already replaced base field values before this object is built

    // Session state
    unresolved_query_count: Integer
    is_escalated:           Boolean
}
```

**What is NOT in the context object:**
- Owner contact details beyond emergency contact (operator-approved context only)
- Partner contact details
- Financial data of any kind
- Internal notes
- Other guests' data
- Historical reservation data

---

## 8. Access Code Delivery Rules

Access codes (lockbox code, smart lock code, gate code, parking code) are GUEST-scoped but
require a delivery gate — they must not be shared on demand at any time of day or before arrival.

| Code type | When delivered | How delivered |
|---|---|---|
| Lockbox code / smart lock | On `check_in_from` time on `checkin_date`, or when guest confirms they are near the property | AI sends as a WhatsApp message. Also sent in confirmation if homeowner configured early delivery. |
| Gate / building code | With check-in instructions on arrival day | Included in the arrival briefing message. |
| Parking code | On arrival day with parking instructions | Included only if guest confirms they have a car. |

**Security principle:** Access codes must never be shared in the `pre_arrival` phase unless
the homeowner has explicitly enabled early delivery. The AI must refuse if a guest asks for
the code more than 24 hours before check-in:

```
"I'll send you the entry details on the day of your arrival
([checkin_date]). You'll receive them in the morning so everything
is ready when you arrive. Is there anything else I can help you with beforehand?"
```

---

## 9. Session Timeout and Re-engagement

| Condition | Action |
|---|---|
| Session inactive for 4 hours (in-stay) | Session remains open. No action. |
| Session inactive for 24 hours (pre-arrival) | Session remains open. No action. |
| `checkout_date` + 24 hours | Session moves to `closed` state. Post-stay review request has been sent. |
| Guest messages a closed session | If within 48 hours of checkout: reopen as post-stay session. If beyond 48 hours: unknown guest flow. |
| Guest messages during an active escalation | AI responds: "Your query has been passed to our team and someone will be in touch shortly." AI does not attempt to answer. |

---

## 10. Multi-Guest Phone Handling

In some cases, multiple members of a party may message from different phones. The system
creates a separate WhatsAppSession per phone number. Each session anchors to the same
Reservation but has its own session state.

**Rule:** Each session operates independently. Sharing information about another guest in
the party (their name, messages, requests) between sessions is not permitted.

**Practical implication:** If Guest A reports a broken appliance and Guest B asks about it
30 minutes later, the AI treats it as a new report (which is safe — it creates a duplicate
ServiceRequest that can be de-duplicated by the operator).

---

## 11. Language Detection and Selection

| Priority | Source | Notes |
|---|---|---|
| 1 | `WhatsAppSession.detected_language` (session-level lock) | Set after 2 or more messages in the same language. |
| 2 | `Reservation.guest_preferred_language` | Set at booking time. |
| 3 | WhatsApp profile locale (if available via API) | Not always available. |
| 4 | Default: `en` | Safe fallback. |

**Language lock:** Once the AI has detected a language and the guest has sent 2 more messages
in that language without switching, the session language is locked. A guest can override by
explicitly requesting a language change: "Please respond in Italian" / "Rispondimi in italiano".

**Available languages at Sicily launch:** English (`en`), Italian (`it`).
**Future:** German (`de`), French (`fr`) when property content is available in those languages.

---

## 12. Legal and Privacy Notes

**(Legal review required)**

- Guest phone numbers are personal data under GDPR. They must only be used for the purpose
  of providing the concierge service linked to the reservation.
- Phone numbers must not be used for marketing without separate explicit consent.
- WhatsApp conversation logs are personal data. Retention policy must be defined (recommended:
  delete 90 days after checkout date, or per applicable national law, whichever is shorter).
- The session anchor mechanism (phone → reservation lookup) must include a rate-limiting
  layer to prevent enumeration attacks.
- At no point should the system confirm to an unmatched number that a specific guest IS or
  IS NOT staying at a named property — that would be a data disclosure.
