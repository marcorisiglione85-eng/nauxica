# Notification System

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Homeowners, partners, operators
**Last updated:** 2026-05-28
**Related:** [event-driven-architecture.md](event-driven-architecture.md) · [service-request-flow.md](../operations/service-request-flow.md) · [escalation-rules.md](../ai-concierge/escalation-rules.md) · [whatsapp-concierge-guidelines.md](../ai-concierge/whatsapp-concierge-guidelines.md)

---

## Purpose

This document defines the Nauxica notification architecture: which channels exist, how severity and priority determine routing, what the delivery guarantees are, and how the system prevents notification overload while ensuring critical communications always get through.

**Scope of this document:** Notifications to homeowners, partners, and operators. Guest notifications are governed by [whatsapp-concierge-guidelines.md](../ai-concierge/whatsapp-concierge-guidelines.md) — guests are served exclusively through the WhatsApp AI concierge, not this notification system.

---

## Notification Channels

Four channels are available to the notification system. Each has different delivery characteristics, reliability expectations, and appropriate use cases.

| Channel | Delivery | Reliability | Appropriate for |
|---|---|---|---|
| **In-Platform Dashboard** | Synchronous (next page load or push) | High — guaranteed if user is active | Operational updates, job completions, informational alerts |
| **Email** | Async — typically < 2 minutes | Medium — delivery not guaranteed; spam folder risk | Confirmations, summaries, non-time-critical alerts |
| **SMS** | Async — typically < 60 seconds | High — direct to phone; does not require internet | URGENT escalations, FAILED service requests, emergency alerts |
| **WhatsApp (homeowner/partner)** | Async — same as SMS characteristics | High — if number is active on WhatsApp | Not used at MVP for homeowner/partner (reserved for guest AI concierge) |

**Post-MVP consideration:** WhatsApp Business API for homeowner operational notifications (e.g. "your property has an urgent maintenance request") can be added as a future channel. Not in scope at MVP due to WhatsApp API complexity and limited incremental value over SMS when homeowners are expected to monitor the dashboard actively.

---

## Notification Severity Levels

Every notification is assigned a severity level. Severity determines which channels are used and whether quiet hours apply.

| Severity | Code | Description | Channels used | Quiet hours apply |
|---|---|---|---|---|
| **Critical** | `CRITICAL` | Emergency, life-safety, immediate action required | SMS + Dashboard | No — always delivers |
| **High** | `HIGH` | Urgent service request, partner no-show, SLA breach | SMS + Email + Dashboard | No — always delivers |
| **Normal** | `NORMAL` | Job updates, booking confirmations, standard reminders | Email + Dashboard | Yes |
| **Low** | `LOW` | Informational, non-actionable summaries | Dashboard only | Yes |

---

## Quiet Hours

**Purpose:** Prevent low-priority notifications from waking homeowners and partners during sleeping hours. Critical and High notifications always bypass quiet hours.

**Default quiet hours:** 22:00 – 07:00 Europe/Rome

During quiet hours:
- `NORMAL` and `LOW` notifications are queued and delivered at 07:00
- `CRITICAL` and `HIGH` notifications are delivered immediately, regardless of hour
- Operators' own quiet hours: operators do not have quiet hours — they are on duty during escalations

**Homeowner override:** Homeowners can configure their own quiet hours in profile settings. They cannot disable critical notifications.

---

## Recipient Types and Typical Channels

| Recipient type | Primary channel | Secondary channel | Emergency override |
|---|---|---|---|
| Homeowner (active on platform) | Dashboard | Email | SMS |
| Homeowner (not logged in) | Email | SMS (High/Critical only) | SMS |
| Partner | Dashboard | SMS (job-related: immediate) | SMS |
| Nauxica operator | Dashboard + SMS | Email | SMS |

---

## Notification Templates

Each notification is defined by a `NotificationTemplate`:

```
NotificationTemplate {
    template_id:     String          // e.g. "sr.assigned.homeowner"
    recipient_type:  Enum            // homeowner / partner / operator
    severity:        Enum            // CRITICAL / HIGH / NORMAL / LOW
    event_trigger:   String          // Event type that triggers this notification
    channels:        Array[Enum]     // Ordered list of channels to use
    subject_template: String         // For email/SMS — variable placeholders: {{field_name}}
    body_template:   String          // Supports: {{reservation_id}}, {{guest_name}}, etc.
    action_url:      String          // Optional deep-link into platform
    batch_eligible:  Boolean         // Whether this can be batched with similar notifications
    batch_window_s:  Integer         // Seconds to wait before sending batch (if batch_eligible)
}
```

---

## SLA-Sensitive Notifications

These notifications have defined delivery SLAs. A failure to deliver within SLA triggers an operator alert.

| Notification | Recipient | Delivery SLA | Severity |
|---|---|---|---|
| Emergency escalation | Operator | 60 seconds from trigger | CRITICAL |
| Urgent service request — no partner found | Homeowner + Operator | 5 minutes from FAILED state | HIGH |
| Partner response window expired (URGENT) | Operator | 5 minutes from timeout | HIGH |
| Escalation SLA breach | Operator | Immediately on breach | HIGH |
| Access code delivery to partner | Partner | 60 seconds from job acceptance | HIGH |
| Pre-arrival message to homeowner | Homeowner | 09:00 on the day 48h before checkin | NORMAL |
| Alloggiati Web reminder | Homeowner | 09:00 the day before checkin | NORMAL |
| Emergency data re-verification (90-day) | Homeowner | 09:00 on the 90th day | NORMAL |

---

## Critical Notification Overrides

Some notifications override all delivery preferences, quiet hours, and channel restrictions.

| Notification | Override rule |
|---|---|
| `EMERGENCY` escalation detected | Operator receives SMS immediately. No delay. No batching. |
| `SAFETY_CONCERN` escalation | Same as emergency |
| Guest unreachable during emergency | Operator receives SMS + dashboard flag within 60 seconds |
| Partner insurance lapsed | Homeowner receives email; partner account paused immediately |
| Escalation SLA breach | Operator escalation path (secondary operator if primary unresponsive) |
| Payment failure (3rd attempt) | Homeowner receives SMS — service suspension warning |

**Override delivery is logged separately.** Override events appear in the notification audit log with `override_reason` noted.

---

## Notification Batching

Some high-frequency operational notifications may be batched to prevent inbox overload.

**Eligible for batching:**
- Multiple job completion notifications in a short window (e.g. homeowner with several checkouts on the same day)
- Partner response-received confirmations
- Knowledge base update confirmations

**Batching rules:**
- Batch window: up to 15 minutes for NORMAL severity
- Maximum batch size: 5 notifications per batch
- Batch only if all items are the same notification type
- Never batch CRITICAL or HIGH severity
- Never batch items from different properties into one notification (homeowners with multiple properties must see property-specific context clearly)

---

## Anti-Spam Safeguards

| Rule | Detail |
|---|---|
| Same notification, same recipient, same entity, within 1 hour | Deduplicate — do not resend |
| More than 5 NORMAL notifications in 1 hour to the same recipient | Queue remaining notifications; deliver at next batching window |
| Idempotency check on event_id | If the same underlying event triggers a notification twice, deliver once only |
| Test-mode filtering | Notifications triggered in staging/test environments are routed to operator-only inboxes — never to real homeowner or partner phone numbers |

---

## Retry Logic

On delivery failure (channel-specific):

| Channel | Failure condition | Retry strategy |
|---|---|---|
| Email | Send API error | Retry at 5min, 30min, 2h — after 3 failures, log as undelivered |
| SMS | Provider error | Retry at 60s, 5min — after 2 failures, attempt email fallback |
| Dashboard | Internal notification service unavailable | Buffer in queue; deliver when service recovers |
| SMS (CRITICAL) | Any failure | Immediate retry (no delay), then operator escalation if still failing |

**After all retries exhausted:**
- Non-critical: log as `delivery_failed` in notification audit log
- Critical: immediate operator alert via backup channel (email to ops account)

---

## Escalation Notification Routing

When an escalation is triggered, notifications follow the escalation type's SLA tier (defined in [escalation-rules.md](../ai-concierge/escalation-rules.md)):

| Escalation SLA tier | First notification target | Escalation path if unacknowledged |
|---|---|---|
| IMMEDIATE (0–5 min) | Primary operator — SMS | After 5 min: secondary operator SMS |
| URGENT (0–30 min) | Primary operator — SMS + Dashboard | After 30 min: SMS to homeowner + secondary operator |
| HIGH (0–2 hours) | Operator — Dashboard + Email | After 2h: SMS to operator |
| NORMAL (next business day) | Operator — Dashboard | No escalation path |

**Business hours:** 08:00–22:00 Europe/Rome. An escalation that arrives outside business hours with SLA tier IMMEDIATE or URGENT still delivers immediately — the ops team is on duty for emergencies regardless of hour.

**Homeowner notification in escalations:**
The homeowner is notified that an escalation has occurred for their property. They are NOT given the escalation's internal details — only that "Nauxica is handling a situation at [property name]" with a contact number if they need to reach the team directly.

---

## Unread State Logic

Dashboard notifications maintain an unread state:
- Created as `unread: true`
- Marked `unread: false` when the user opens the notification detail or acknowledges the banner
- CRITICAL and HIGH notifications include an explicit **Acknowledge** button — tapping dismisses the notification and records `acknowledged_at`
- Unacknowledged HIGH notifications older than 1 hour resurface at the top of the notification list

**Badge counts:** Homeowner and partner dashboards show unread notification counts. Counts include only notifications requiring action or acknowledgement — informational (LOW) notifications are excluded from counts.

---

## Notification Audit Logging

Every notification is logged to the notification audit record. This log is append-only.

| Field | Content |
|---|---|
| `notification_id` | UUID |
| `template_id` | Template used |
| `recipient_id` | Homeowner/partner/operator user ID |
| `recipient_type` | Recipient category |
| `severity` | Level assigned |
| `channels_attempted` | Array: which channels were tried |
| `channels_delivered` | Array: which delivered successfully |
| `triggered_by_event_id` | The EventEnvelope.event_id that triggered this |
| `entity_type` | Domain entity involved (e.g. `ServiceRequest`) |
| `entity_id` | UUID of the involved entity |
| `sent_at` | Timestamp of first delivery attempt |
| `delivered_at` | Timestamp of first confirmed delivery (nullable if failed) |
| `override_reason` | Set if quiet hours or batching was overridden |
| `batch_id` | Set if this was part of a batch |
| `delivery_status` | `pending` / `delivered` / `failed` / `deduplicated` |

Audit logs are retained for a minimum of 3 years.

---

## Notification Preferences Model

Homeowners and partners can configure preferences within allowed boundaries:

| Preference | Default | Homeowner can change | Partner can change |
|---|---|---|---|
| Quiet hours start/end | 22:00–07:00 | Yes, within 21:00–08:00 range | Yes |
| Receive job completion summaries | Email | Yes — dashboard only or off | N/A |
| Receive partner response confirmations | Dashboard | Yes — turn off | N/A |
| Receive knowledge base update reminders | Email | Yes | N/A |
| Emergency notifications | Always on | Cannot be disabled | Cannot be disabled |
| FAILED service request alerts | SMS + Email | Can reduce to Email only | N/A |
| Job alerts | SMS + Dashboard | N/A | Yes — dashboard only or both |
| Language of notifications | Auto-detect from account | Yes | Yes |

**Homeowners cannot disable:** CRITICAL, HIGH-severity escalation notifications, payment failure notifications, insurance lapse notifications.

---

## Key Notification Definitions by Trigger Event

This table maps high-value platform events to their notification configuration. For full event definitions, see [event-driven-architecture.md](event-driven-architecture.md).

| Event | Recipient | Severity | Channels | Body summary |
|---|---|---|---|---|
| `reservation.Reservation.Created` | Homeowner | LOW | Dashboard | "Reservation added for [guest_name] — [checkin] to [checkout]" |
| `reservation.PreArrivalWindowOpened` | Homeowner | NORMAL | Email + Dashboard | "Guest arriving in 48 hours — confirm everything is ready" |
| `reservation.AlloggiatiWebReminderDue` | Homeowner | NORMAL | Email + Dashboard | "Alloggiati Web registration due within 24 hours" |
| `reservation.GuestCheckedIn` | Homeowner | NORMAL | Dashboard | "Guest checked in at [property_name]" |
| `reservation.GuestCheckedOut` | Homeowner | NORMAL | Dashboard | "Guest checked out — a checkout cleaning job may be needed" |
| `service_request.ServiceRequest.Created` (AI) | Homeowner | NORMAL | Dashboard | "Your guest reported [issue] — request submitted to your partner" |
| `service_request.ServiceRequest.Assigned` | Homeowner | NORMAL | Email + Dashboard | "[Service] accepted by your partner — expected [date/time]" |
| `service_request.ServiceRequest.Failed` | Homeowner + Operator | HIGH | SMS + Email + Dashboard | "No partner available for [service] — action required" |
| `service_request.ServiceRequest.Completed` | Homeowner | NORMAL | Email + Dashboard | "[Service] complete at [property]. Photos attached. Please verify." |
| `escalation.EscalationRecord.Created` (EMERGENCY) | Operator | CRITICAL | SMS | "EMERGENCY at [property_name] — [trigger context]" |
| `escalation.EscalationRecord.Created` (other) | Operator | HIGH | SMS + Dashboard | "Escalation: [trigger_type] at [property_name]" |
| `escalation.EscalationRecord.Created` | Homeowner | NORMAL | Email + Dashboard | "Nauxica is handling a situation at [property_name] — we'll update you shortly" |
| `escalation.EscalationRecord.SLABreached` | Operator | HIGH | SMS | "SLA breach — escalation [id] unacknowledged for [elapsed]" |
| `partner.PartnerAccount.InsuranceLapsed` | Partner | HIGH | SMS + Email | "Your insurance has lapsed — your account is paused until renewed" |
| `partner.PartnerAccount.InsuranceExpiringSoon` | Partner | NORMAL | Email | "Your insurance expires in 30 days — please upload renewal" |
| `service_request.PartnerRequest.Declined` (all partners) | Homeowner | HIGH | SMS + Email | "Your partner declined — no other partners assigned. Attention needed." |
| `billing.Subscription.PaymentFailed` | Homeowner | HIGH | SMS + Email | "Payment failed for your Nauxica subscription — update payment method" |
| `compliance.EmergencyData.VerificationDue` | Homeowner | NORMAL | Email + Dashboard | "Your emergency contact details need re-verification" |

---

## MVP Operational Notes

**At MVP, the notification system is simple.** There is no recommendation engine, no ML-based suppression, no personalised send-time optimisation. The logic above is implementable with a standard task queue and a small set of templates.

**Operator notifications at MVP:** The primary operator is the founder. All CRITICAL and HIGH notifications route to the founder's personal mobile number as SMS. A second emergency SMS contact should be configured for redundancy before the first property goes live.

**No in-app push notification service at MVP:** Dashboard notifications are polled (or delivered via lightweight long-polling) at MVP. Push notification integration (FCM, APNs) is a post-MVP enhancement — do not build it at MVP unless the mobile-first homeowner experience demands it.

**Template management:** All notification body text is in a template store, not hardcoded. This allows body text to be updated without a deployment. Template language variants (Italian, English) must be maintained — homeowner and partner language preferences drive template selection.
