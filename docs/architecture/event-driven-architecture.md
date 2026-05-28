# Event-Driven Architecture

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Platform-wide event system
**Last updated:** 2026-05-28
**Related:** [service-request-flow.md](../operations/service-request-flow.md) · [notification-system.md](notification-system.md) · [data-models.md](../backend/data-models.md) · [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md)

---

## Purpose

This document defines the platform's event system: how domain events are structured, named, produced, consumed, and guaranteed. Events are the connective tissue between the platform's components — they decouple producers from consumers, make state changes auditable, and enable the AI concierge, notification system, and partner dispatch to react to what happens in the system rather than polling for it.

**Design principle for MVP:** The event system should be simple and reliable, not sophisticated. A well-designed single-broker queue with clear event contracts is more valuable at this stage than a distributed streaming architecture. This document designs for MVP delivery while preserving the ability to scale to a fully distributed system post-MVP.

---

## Design Principles

**1. Events describe facts, not instructions.**
An event says "this happened" — not "now do this." What consumers do with an event is their concern, not the producer's. `ServiceRequestCreated` is correct. `RouteServiceRequestToPartner` is not an event — it's a command.

**2. Events are immutable.**
Once emitted, an event cannot be changed. Corrections are achieved by emitting a new event (e.g. `ServiceRequestUrgencyUpdated`), not by modifying the original.

**3. Events must be self-describing.**
Every event carries enough data that a consumer can act on it without querying back. A consumer should not need to re-fetch the entity to handle the event — the payload includes the relevant fields at the time of the event.

**4. Producers do not know their consumers.**
A domain publishing `ReservationCreated` does not know or care that the AI concierge, the notification system, and the billing system all consume it. This isolation is what makes the system extensible.

**5. Idempotency is a consumer responsibility.**
Every consumer must be safe to receive the same event twice. Event IDs are unique. Consumers deduplicate by event ID before processing.

**6. Auditability is non-negotiable.**
Every emitted event is written to the audit log before being dispatched. If dispatch fails, the event still exists in the audit log. No event may be silently dropped.

---

## MVP Queue Assumptions

At Sicily launch, the event system is implemented on a simple, reliable message broker appropriate for low-to-medium volume:

| Assumption | Detail |
|---|---|
| Broker type | Single-instance message queue (e.g. Redis Streams, RabbitMQ, or equivalent) |
| Queue topology | Single queue per domain with fan-out to relevant consumers |
| Delivery guarantee | At-least-once delivery. Consumers must be idempotent. |
| Ordering | FIFO per domain. Cross-domain ordering is not guaranteed. |
| Retention | Events retained for minimum 7 days for replay. Audit log retained permanently. |
| Throughput expectation | < 1,000 events/day at MVP. No throughput optimisation required. |
| Dead-letter queue | One DLQ per domain queue |
| Monitoring | Queue depth + DLQ depth + consumer lag monitored by ops team |

**Scaling note:** When event volume exceeds ~10,000/day or when consumer diversity grows significantly, migrate to a partitioned streaming platform (Apache Kafka, AWS Kinesis, or equivalent). The event contracts defined here do not change on migration — only the transport layer changes.

---

## Event Naming Convention

All events follow a structured naming scheme:

```
[Domain].[EntityType].[PastTenseVerb]

Examples:
  reservation.Reservation.Created
  service_request.ServiceRequest.Classified
  ai.AISession.EscalationTriggered
  partner.PartnerAssignment.AccessGranted
```

**Rules:**
- Domain: lowercase snake_case — the bounded context owning the event
- EntityType: PascalCase — the primary entity involved
- PastTenseVerb: PascalCase — what happened (always past tense)
- Use the most specific verb available: `Accepted` not `Updated`, `Expired` not `Changed`
- No generic events like `DataChanged` or `RecordUpdated`

---

## Event Envelope

Every event is wrapped in a standard envelope before emission:

```
EventEnvelope {
    event_id:          String (UUID)        // Globally unique. Used for deduplication.
    event_type:        String               // Full dotted name: domain.Entity.Verb
    schema_version:    String               // e.g. "1.0" — bumped on payload change
    emitted_at:        DateTime (ISO 8601 UTC)
    emitted_by:        String               // Service or component that emitted the event
    correlation_id:    String (UUID)        // Traces a chain of related events (e.g. one guest interaction)
    causation_id:      String (UUID)        // The event_id of the event that caused this one (nullable)
    payload:           Object               // Event-specific data (see Section per event type)
}
```

**Correlation ID:** Propagated from the originating trigger (e.g. a WhatsApp message). All events caused by that message share the same correlation_id. Enables full trace reconstruction.

**Causation ID:** Points to the specific event that directly caused this one. Nullable for root events (e.g. ReservationCreated triggered by a homeowner action, not by another event).

---

## Idempotency Rules

Every consumer maintains an idempotency log: a record of `event_id` values it has successfully processed.

**Before processing any event:**
1. Check if `event_id` exists in the idempotency log
2. If yes: skip processing, acknowledge receipt (to remove from queue), log duplicate
3. If no: process, write `event_id` to idempotency log, acknowledge receipt

The idempotency log should be:
- Fast to read (in-memory cache backed by persistent store)
- Retained for at least 48 hours (covers any realistic re-delivery scenario)
- Not indefinitely large — expire entries after 48h

---

## Retry Logic

On processing failure (consumer error, downstream service unavailable):

| Attempt | Delay before retry |
|---|---|
| 1st retry | 30 seconds |
| 2nd retry | 2 minutes |
| 3rd retry | 10 minutes |
| 4th retry | 30 minutes |
| 5th retry (final) | 60 minutes |
| After 5th failure | Move to Dead-Letter Queue (DLQ) |

**Retry triggers:** Consumer returns a non-success response, throws an unhandled exception, or fails to acknowledge within the broker's ack timeout (default: 30 seconds).

**Do not retry on:** Consumer explicitly rejects event as invalid/unprocessable (business logic failure, not infrastructure failure). These go to DLQ immediately.

---

## Dead-Letter Queue (DLQ) Handling

Events that exhaust all retries land in the DLQ.

| Action | Who | When |
|---|---|---|
| DLQ alert sent to operator | Automated | Immediately on event entering DLQ |
| Operator reviews event | Nauxica ops | Within 1 hour for URGENT/EMERGENCY domain events; within 4 hours for NORMAL |
| Options: replay, discard, manual resolution | Operator | After reviewing the event payload and failure logs |
| DLQ cleared | Operator | After resolution |

**DLQ is never silently ignored.** Any event in the DLQ represents a broken flow. At MVP volume, every DLQ event is investigated.

---

## Auditability Requirements

**All events are written to an append-only audit log before dispatch.**

The audit log:
- Is a separate persistent store from the queue (events survive if the queue is purged)
- Contains the full `EventEnvelope` including payload
- Is indexed by: `event_id`, `event_type`, `correlation_id`, `emitted_at`, `entity_id` (extracted from payload)
- Is retained for a minimum of 3 years
- Is readable by operators for incident investigation; not exposed to homeowners or partners

**Purpose:** Compliance, dispute resolution, incident investigation, and debugging. The audit log is the authoritative record of what happened in the system.

---

## Event Ordering Assumptions

**Within a single domain queue:** Events are FIFO. `ServiceRequestCreated` always arrives before `ServiceRequestClassified` for the same request.

**Across domains:** No ordering guarantee. A consumer that receives `PartnerAssignment.Accepted` before `ServiceRequest.Routed` must handle this gracefully (re-queue, wait for the missing event, or query state from the source of truth).

**Practical implication:** Consumers should not assume causal ordering across domain boundaries. Build consumers to be tolerant of out-of-order delivery.

---

## Event Categories and Core Events

### Category 1 — Reservation Events

Domain: `reservation`

| Event | Trigger | Key payload fields |
|---|---|---|
| `reservation.Reservation.Created` | Homeowner adds a new reservation | `reservation_id`, `property_id`, `guest_phone`, `checkin_date`, `checkout_date`, `guest_name` |
| `reservation.Reservation.Updated` | Any field on the reservation changes | `reservation_id`, `changed_fields[]`, `previous_values{}`, `new_values{}` |
| `reservation.Reservation.Cancelled` | Reservation cancelled | `reservation_id`, `cancelled_by`, `cancellation_reason` |
| `reservation.Reservation.StatusChanged` | Status enum transitions | `reservation_id`, `from_status`, `to_status` |
| `reservation.GuestCheckedIn` | Reservation status → checked_in | `reservation_id`, `property_id`, `guest_phone`, `checkin_completed_at` |
| `reservation.GuestCheckedOut` | Reservation status → checked_out | `reservation_id`, `property_id`, `checkout_completed_at` |
| `reservation.PreArrivalWindowOpened` | 48h before checkin_date | `reservation_id`, `property_id`, `guest_phone`, `checkin_date` |
| `reservation.AlloggiatiWebReminderDue` | 24h before checkin_date if alloggiati_web_required=true | `reservation_id`, `property_id`, `homeowner_id` |

**Consumers:** AI concierge (session readiness), notification system (homeowner reminders, guest proactive messages), compliance tracker.

---

### Category 2 — Guest Events

Domain: `guest`

| Event | Trigger | Key payload fields |
|---|---|---|
| `guest.WhatsAppMessage.Received` | Inbound message from guest WhatsApp | `guest_phone`, `message_body`, `received_at`, `whatsapp_message_id` |
| `guest.WhatsAppSession.Created` | New session resolved | `session_id`, `reservation_id`, `property_id`, `guest_phone`, `session_phase` |
| `guest.WhatsAppSession.PhaseChanged` | Session phase transitions | `session_id`, `from_phase`, `to_phase` |
| `guest.WhatsAppSession.Closed` | Session closed after checkout + 24h | `session_id`, `reservation_id`, `closed_at` |
| `guest.WhatsAppSession.UnresolvablePhone` | Phone cannot be matched to a reservation | `guest_phone`, `attempted_at` |

**Consumers:** AI runtime (primary), notification system (operator alert on unresolvable), audit log.

---

### Category 3 — AI Events

Domain: `ai`

| Event | Trigger | Key payload fields |
|---|---|---|
| `ai.AISession.MessageProcessed` | AI completes a response cycle | `session_id`, `intent_classified`, `confidence_score`, `response_sent`, `processing_ms` |
| `ai.AISession.EscalationTriggered` | Escalation rule fires | `session_id`, `reservation_id`, `trigger_type`, `trigger_context` |
| `ai.AISession.FallbackIssued` | AI issued a fallback (no confident answer) | `session_id`, `topic_attempted`, `fallback_reason` |
| `ai.AISession.EmergencyDetected` | Emergency pre-check positive | `session_id`, `guest_phone`, `detected_keywords[]`, `ai_response_sent` |
| `ai.KnowledgeBlock.Requested` | KBB called for a session | `property_id`, `session_id`, `chunks_requested[]` |
| `ai.KnowledgeBlock.Assembled` | KBB returned a block | `property_id`, `session_id`, `chunks_loaded[]`, `assembly_ms` |
| `ai.ServiceRequest.Created` | AI creates a service request | `session_id`, `service_request_id`, `service_type`, `urgency` |
| `ai.AISession.OperatorHandoffCompleted` | AI resumed after escalation resolved | `session_id`, `escalation_id`, `resumed_at` |

**Consumers:** Audit log (all events), notification system (escalation, emergency), analytics.

---

### Category 4 — ServiceRequest Events

Domain: `service_request`

| Event | Trigger | Key payload fields |
|---|---|---|
| `service_request.ServiceRequest.Created` | Any trigger source creates a request | `service_request_id`, `property_id`, `service_type`, `urgency`, `initiated_by` |
| `service_request.ServiceRequest.Classified` | Urgency assigned | `service_request_id`, `urgency`, `classification_source` |
| `service_request.ServiceRequest.Routed` | First PartnerRequest sent | `service_request_id`, `partner_request_id`, `partner_id`, `response_deadline` |
| `service_request.ServiceRequest.Assigned` | Partner accepted | `service_request_id`, `partner_id`, `accepted_at` |
| `service_request.ServiceRequest.InProgress` | Partner marked started | `service_request_id`, `partner_id`, `started_at` |
| `service_request.ServiceRequest.Completed` | Partner marked complete | `service_request_id`, `partner_id`, `photo_count`, `completion_note` |
| `service_request.ServiceRequest.Verified` | Homeowner verified | `service_request_id`, `verified_by`, `verified_at` |
| `service_request.ServiceRequest.AutoVerified` | 48h timeout | `service_request_id`, `auto_verified_at` |
| `service_request.ServiceRequest.Escalated` | Escalation triggered | `service_request_id`, `escalation_id`, `trigger_reason` |
| `service_request.ServiceRequest.Failed` | All partners exhausted | `service_request_id`, `routing_attempt_count` |
| `service_request.ServiceRequest.Cancelled` | Cancelled by actor | `service_request_id`, `cancelled_by`, `cancellation_reason` |
| `service_request.PartnerRequest.Declined` | Partner declined or timed out | `partner_request_id`, `service_request_id`, `partner_id`, `reason` |

**Consumers:** Notification system (all transitions), AI runtime (ASSIGNED, COMPLETED — to update guest), partner app (new PartnerRequest), analytics.

---

### Category 5 — Partner Events

Domain: `partner`

| Event | Trigger | Key payload fields |
|---|---|---|
| `partner.PartnerAssignment.Created` | Homeowner assigns a partner to a property | `assignment_id`, `property_id`, `partner_id`, `service_type` |
| `partner.PartnerAssignment.Activated` | Assignment status → active | `assignment_id`, `property_id`, `partner_id` |
| `partner.PartnerAssignment.Paused` | Assignment paused | `assignment_id`, `paused_by`, `reason` |
| `partner.PartnerAssignment.Ended` | Assignment ended | `assignment_id`, `ended_by`, `ended_reason` |
| `partner.PartnerAssignment.AccessGranted` | Access code delivered at job confirmation | `assignment_id`, `partner_request_id`, `access_type`, `delivered_at` |
| `partner.PartnerAccount.StatusChanged` | Partner account status changes | `partner_id`, `from_status`, `to_status`, `changed_by` |
| `partner.PartnerAccount.InsuranceExpiringSoon` | 30 days before certificate expiry | `partner_id`, `expiry_date` |
| `partner.PartnerAccount.InsuranceLapsed` | Insurance expired without renewal | `partner_id`, `lapsed_at` |
| `partner.PartnerReview.Created` | Homeowner posts a job review | `review_id`, `partner_id`, `rating`, `reservation_id` |

**Consumers:** Notification system (all events), vetting monitor, analytics.

---

### Category 6 — Escalation Events

Domain: `escalation`

| Event | Trigger | Key payload fields |
|---|---|---|
| `escalation.EscalationRecord.Created` | Escalation triggered | `escalation_id`, `trigger_type`, `session_id`, `property_id`, `reservation_id` |
| `escalation.EscalationRecord.Acknowledged` | Operator picks up the escalation | `escalation_id`, `operator_id`, `acknowledged_at` |
| `escalation.EscalationRecord.InProgress` | Operator actively working | `escalation_id`, `operator_id` |
| `escalation.EscalationRecord.Resolved` | Escalation resolved | `escalation_id`, `operator_id`, `resolved_at`, `resolution_note` |
| `escalation.EscalationRecord.AIResumed` | AI re-enabled after resolution | `escalation_id`, `session_id`, `resumed_at` |
| `escalation.EscalationRecord.SLABreached` | Escalation response SLA missed | `escalation_id`, `trigger_type`, `sla_target_ms`, `elapsed_ms` |

**Consumers:** Notification system (operator alerts, SLA breach alert), AI runtime (resolution triggers AI resume), audit log.

---

### Category 7 — Billing Events

Domain: `billing`

| Event | Trigger | Key payload fields |
|---|---|---|
| `billing.Subscription.Created` | Homeowner subscribes | `user_id`, `plan_tier`, `billing_cycle`, `started_at` |
| `billing.Subscription.Renewed` | Renewal processed | `user_id`, `plan_tier`, `period_start`, `period_end` |
| `billing.Subscription.PaymentFailed` | Payment attempt failed | `user_id`, `attempt_count`, `next_attempt_at` |
| `billing.Subscription.Cancelled` | Subscription cancelled | `user_id`, `cancelled_at`, `end_date` |
| `billing.Commission.Calculated` | Platform commission due on Experience/Transfer | `service_request_id`, `partner_id`, `gross_amount`, `commission_amount`, `commission_rate` |

**Consumers:** Notification system (payment failure, renewal confirmation), access control (plan tier changes), analytics.

---

### Category 8 — Compliance Events

Domain: `compliance`

| Event | Trigger | Key payload fields |
|---|---|---|
| `compliance.AlloggiatiWeb.ReminderSent` | 24h pre-arrival reminder sent to homeowner | `reservation_id`, `property_id`, `homeowner_id`, `sent_at` |
| `compliance.AlloggiatiWeb.Registered` | Homeowner marks registration complete | `reservation_id`, `registered_at`, `registered_by` |
| `compliance.TouristTax.ConfigurationMissing` | Property activated without tourist tax rate | `property_id`, `homeowner_id` |
| `compliance.TouristTax.CollectionConfirmed` | Homeowner marks tax collected for a stay | `reservation_id`, `amount_eur`, `confirmed_at` |
| `compliance.EmergencyData.VerificationDue` | 90 days since last emergency data verification | `property_id`, `homeowner_id`, `last_verified_at` |
| `compliance.EmergencyData.Updated` | Any emergency data field updated | `property_id`, `updated_by`, `fields_changed[]` |
| `compliance.KnowledgeBlock.Updated` | PropertyKnowledgeBlock updated | `property_id`, `updated_by`, `updated_at`, `schema_version` |
| `compliance.DynamicInstruction.Activated` | A DynamicInstruction becomes active | `property_id`, `instruction_id`, `target_field`, `active_from`, `active_until` |
| `compliance.DynamicInstruction.Expired` | A DynamicInstruction's active_until passes | `property_id`, `instruction_id`, `expired_at` |

**Consumers:** Notification system (reminders, overrides), KBB cache invalidation (knowledge block updated, dynamic instruction activated/expired), compliance tracker, audit log.

---

## Special Event: KnowledgeUpdated and Cache Invalidation

The `compliance.KnowledgeBlock.Updated` event has a critical consumer: the Knowledge Block Builder (KBB) cache. When a PropertyKnowledgeBlock is updated, the KBB's property cache for that property must be invalidated so the next session load reflects the new content.

**KBB cache invalidation rule:** The KBB consumes `compliance.KnowledgeBlock.Updated` and `compliance.DynamicInstruction.Activated/Expired` events. On receipt, it purges the cached block for `property_id` from the property cache. The next KBB request for that property will re-assemble from the fresh source.

**Emergency data exception:** The emergency cache uses write-through invalidation (see [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) Section 6). Changes to emergency data fields emit `compliance.EmergencyData.Updated`, which triggers immediate emergency cache write-through, not a TTL-based expiry.

---

## Event Consumer Map

| Consumer | Events consumed | Purpose |
|---|---|---|
| AI Runtime | `guest.WhatsAppMessage.Received`, `escalation.EscalationRecord.Resolved` (AI resume), `service_request.ServiceRequest.Assigned/Completed` | Drive conversation and update guests |
| KBB Cache Invalidator | `compliance.KnowledgeBlock.Updated`, `compliance.DynamicInstruction.Activated/Expired`, `compliance.EmergencyData.Updated` | Cache freshness |
| Notification System | Most events (see [notification-system.md](notification-system.md)) | Send homeowner/partner/operator notifications |
| Partner Dispatch | `service_request.ServiceRequest.Routed`, `service_request.ServiceRequest.Assigned` | Create/update PartnerRequest |
| Response Window Monitor | `service_request.ServiceRequest.Routed` | Start countdown; fire timeout if no response |
| Compliance Tracker | All `compliance.*` events, `reservation.AlloggiatiWebReminderDue` | Track legal obligations |
| Analytics | All events (async, non-blocking) | Operational metrics and reporting |
| Audit Log | All events (always first consumer) | Append-only event record |

---

## Future Scaling Notes

| Current (MVP) | Future (post-scale) |
|---|---|
| Single-instance message broker | Partitioned streaming platform (Kafka/Kinesis) |
| Single queue per domain with fan-out | Separate topics per event type |
| Synchronous KBB call in AI runtime | KBB as independent service consuming events |
| Analytics as async consumer of main queue | Dedicated analytics stream with separate retention |
| Retry in-process | Dedicated retry service |

Schema versioning (`schema_version` field in the envelope) is critical for the migration. Consumers that handle both `schema_version: 1.0` and `schema_version: 2.0` payloads allow rolling upgrades without dual-write periods.
