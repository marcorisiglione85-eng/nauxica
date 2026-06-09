# API Endpoints — Reservations

**Version:** 1.3
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Reservation CRUD endpoints
**Last updated:** 2026-06-07
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md) · [auth-strategy.md](../../backend/auth-strategy.md)

> **v1.3 changes (2026-06-07):** Final API Consistency Micro Fix. Overview visibility scope corrected — `homeowner_id = auth.uid()` replaced with the correct RLS pattern: `property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())`. There is no `homeowner_id` column on the `reservations` table (source: auth-strategy.md v1.2 §9.2, database-schema.md v1.4 §3.4).

> **v1.2 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-4: POST /v1/reservations behaviour updated — `confirmation_number` generation strategy documented as server-side PostgreSQL sequence; unique; immutable; never reused (source: database-schema.md v1.4 §3.4).

> **v1.1 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-C: `guest_nationality` added to the POST optional fields list and to the GET/{id} response object — the column is now nullable at MVP (source: data-models.md v1.5 Model 4, database-schema.md v1.3 §3.4).

---

## Overview

The `Reservation` is the canonical backend entity for guest stays. The frontend displays this data under the label "Guests" in the Guests dashboard page and guest detail views. There is no `/guests` endpoint.

Each reservation is scoped to a single property (`property_id` UUID FK to `properties.id`) and belongs to the authenticated homeowner.

The guest is not a platform user. Guest identity is carried within the reservation record: `guest_name`, `guest_phone` (E.164), and optionally `guest_email`. The AI concierge resolves guest identity by matching `guest_phone` against active reservations.

**Account type:** Homeowners only. Partners do not have access to reservation endpoints.

**Visibility scope:** A homeowner can only access reservations scoped to properties they own. Access is enforced via the property ownership relationship: `property_id IN (SELECT id FROM properties WHERE owner_id = auth.uid())`. There is no `homeowner_id` column on the `reservations` table.

---

## Base Path

```
/v1/reservations
```

---

## Endpoints

### GET /v1/reservations

List reservations for the authenticated homeowner.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `property_id` | UUID | — | Filter by property. |
| `reservation_status` | string | — | Filter by status. See status enum below. |
| `booking_source` | string | — | Filter by source. Enum: `airbnb`, `booking_com`, `vrbo`, `direct`, `other`. |
| `checkin_after` | date | — | Filter reservations with `checkin_date >= date`. Format `YYYY-MM-DD`. |
| `checkin_before` | date | — | Filter reservations with `checkin_date <= date`. Format `YYYY-MM-DD`. |
| `include_cancelled` | boolean | `false` | Include reservations with `reservation_status = cancelled`. |
| `sort` | string | `checkin_date` | Sort field. |
| `order` | string | `asc` | `asc` or `desc`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Reservation status enum:**

| Value | Meaning |
|---|---|
| `confirmed` | Booking confirmed, check-in is more than 7 days away |
| `pre_arrival` | Check-in is within 7 days |
| `checked_in` | Guest is currently in residence |
| `checked_out` | Stay completed |
| `cancelled` | Reservation cancelled |
| `no_show` | Guest did not arrive |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "883g2733-h52e-74g7-d049-779988773333",
      "property_id": "550e8400-e29b-41d4-a716-446655440000",
      "property_code": "NAU-00001",
      "guest_name": "Luca Martini",
      "guest_phone": "+39 333 1234567",
      "checkin_date": "2026-07-10",
      "checkout_date": "2026-07-17",
      "guest_count": 4,
      "confirmation_number": "NX-2026-00123",
      "booking_source": "airbnb",
      "reservation_status": "confirmed",
      "created_at": "2026-05-20T08:00:00Z",
      "updated_at": "2026-05-20T08:00:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### GET /v1/reservations/{id}

Retrieve a single reservation by UUID.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The reservation's UUID. |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "883g2733-h52e-74g7-d049-779988773333",
    "homeowner_id": "661e9511-f30c-52e5-b827-557766551111",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "guest_name": "Luca Martini",
    "guest_phone": "+39 333 1234567",
    "guest_email": "luca.martini@example.com",
    "guest_nationality": null,
    "guest_document_type": "passport",
    "guest_document_number": "AA1234567",
    "guest_count": 4,
    "checkin_date": "2026-07-10",
    "checkout_date": "2026-07-17",
    "confirmation_number": "NX-2026-00123",
    "booking_source": "airbnb",
    "reservation_status": "confirmed",
    "guest_preferred_language": "it",
    "special_requests": "Late check-in around 22:00",
    "internal_notes": null,
    "created_at": "2026-05-20T08:00:00Z",
    "updated_at": "2026-05-20T08:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Reservation does not exist or belongs to a different homeowner. |

---

### POST /v1/reservations

Create a new reservation.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "property_id": "550e8400-e29b-41d4-a716-446655440000",
  "guest_name": "Sofia Russo",
  "guest_phone": "+39 347 9876543",
  "guest_email": "sofia.russo@example.com",
  "guest_count": 2,
  "checkin_date": "2026-08-01",
  "checkout_date": "2026-08-08",
  "booking_source": "direct",
  "confirmation_number": "NX-2026-00456"
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `property_id` | UUID | Must be a property owned by the authenticated homeowner. |
| `guest_name` | string | Full name. Max 200 characters. |
| `guest_phone` | string | Phone number. Normalised to E.164 server-side. |
| `guest_count` | integer | Minimum 1. Must not exceed `property.max_guests`. |
| `checkin_date` | date | Format `YYYY-MM-DD`. Must be before `checkout_date`. |
| `checkout_date` | date | Format `YYYY-MM-DD`. |
| `booking_source` | string | Enum: `airbnb`, `booking_com`, `vrbo`, `direct`, `other`. |

**Optional fields:** `guest_email`, `guest_nationality`, `guest_document_type`, `guest_document_number`, `confirmation_number`, `guest_preferred_language`, `special_requests`, `internal_notes`.

> **Note on `guest_nationality`:** This field is nullable at MVP. ISO 3166-1 alpha-2 country code (e.g. `IT`, `DE`, `GB`). Required for Alloggiati Web compliance — will become conditionally required when the Alloggiati Web module is implemented.

**Behaviour:**
1. Sets `homeowner_id = auth.uid()`.
2. Sets `reservation_status` based on `checkin_date`: `pre_arrival` if within 7 days, `confirmed` otherwise.
3. `confirmation_number` is auto-generated server-side using a PostgreSQL sequence (format `NX-YYYY-NNNNN`) if not provided by the client. The number is unique, immutable, and never reused.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "994h3844-i63f-85h8-e150-880099884444",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "guest_name": "Sofia Russo",
    "guest_phone": "+39347987654",
    "checkin_date": "2026-08-01",
    "checkout_date": "2026-08-08",
    "confirmation_number": "NX-2026-00456",
    "booking_source": "direct",
    "reservation_status": "confirmed",
    "created_at": "2026-06-05T10:00:00Z",
    "updated_at": "2026-06-05T10:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields, invalid dates, or invalid enum values. |
| `NOT_FOUND` | 404 | `property_id` does not belong to the authenticated homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | `guest_count` exceeds `property.max_guests`. |
| `CONFLICT` | 409 | Date range overlaps with an existing active reservation for the same property. |

---

### PATCH /v1/reservations/{id}

Update a reservation. Partial updates are supported.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The reservation's UUID. |

**Request body:** Any subset of writable reservation fields. `id`, `homeowner_id`, `property_id`, and `created_at` are immutable and are ignored if present.

```json
{
  "reservation_status": "checked_in",
  "internal_notes": "Guest arrived early. Key safe access confirmed.",
  "guest_document_type": "passport",
  "guest_document_number": "AA9876543"
}
```

**Writable status transitions:**

| From | To | Permitted |
|---|---|---|
| `confirmed` | `pre_arrival` | Yes (date-driven) |
| `pre_arrival` | `checked_in` | Yes |
| `checked_in` | `checked_out` | Yes |
| Any | `cancelled` | Yes |
| Any | `no_show` | Yes (if checkin_date has passed) |
| `checked_out` | Any earlier state | No |
| `cancelled` | Any state | No |

**Response — 200 OK:** Returns the full updated reservation object.

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid field values. |
| `NOT_FOUND` | 404 | Reservation does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Invalid status transition. |

---

## Guest Phone Lookup Note

The AI concierge resolves guest identity by matching inbound WhatsApp phone numbers against active reservations. This lookup is handled by the AI runtime service key and is not exposed as a public homeowner API endpoint. It operates on `reservations.guest_phone` (E.164-normalised) with `reservation_status IN ('pre_arrival', 'checked_in')`.

---

## Guests UI Terminology Note

The frontend "Guests" page and guest detail views display data from this endpoint. The frontend term "guest" maps directly to a `Reservation` record — there is no separate guest entity and no `/guests` endpoint.

When building the frontend integration, the Guests list page should call `GET /v1/reservations` and the guest detail page should call `GET /v1/reservations/{id}`.

See [auth-strategy.md §5.3](../../backend/auth-strategy.md) for the full specification.
