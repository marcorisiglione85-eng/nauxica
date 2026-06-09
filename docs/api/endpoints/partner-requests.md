# API Endpoints — Partner Requests

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Partner request endpoints
**Last updated:** 2026-06-06
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md) · [service-request-flow.md](../../operations/service-request-flow.md)

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. Partner request status enum corrected from invalid `pending/cancelled` to canonical `new/accepted/declined/in_progress/completed/disputed` (source: `partner_request_status` enum in database-schema.md §2). `include_cancelled` filter renamed to `include_inactive` (no `cancelled` status exists). `linked_partner_request_id` and `active_partner_request_id` removed from GET/{id} response (those fields live on `service_requests`, not `partner_requests`). `linked_service_request_id` renamed to `service_request_id`. DELETE endpoint corrected: hard delete for `new` requests only; `accepted`/`in_progress` cancellation is a status transition, not a DELETE.

---

## Overview

Partner requests represent jobs dispatched to service partners (cleaning, maintenance, transfers, experiences, laundry). Each request is scoped to a property via `property_id` (UUID FK to `properties.id`).

**Account types:**
- `homeowner` — full CRUD on their own partner requests.
- `partner` — read access to requests assigned to them; status update on accepted jobs.

**Visibility scope (homeowner):** A homeowner can only access partner requests where `homeowner_id = auth.uid()`.

**Visibility scope (partner):** A partner can only access partner requests where `partner_id = auth.uid()`.

---

## Base Path

```
/v1/partner-requests
```

---

## Endpoints

### GET /v1/partner-requests

List partner requests.

**Authentication:** Bearer token required. Account type: `homeowner` or `partner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `property_id` | UUID | — | Filter by property (homeowner only). |
| `status` | string | — | Filter by status enum value. |
| `service_type` | string | — | Filter by service type. |
| `requested_date_after` | date | — | Filter requests with `requested_date >= date`. Format `YYYY-MM-DD`. |
| `requested_date_before` | date | — | Filter requests with `requested_date <= date`. |
| `include_inactive` | boolean | `false` | Include requests with `status = declined` or `status = disputed`. |
| `sort` | string | `requested_date` | Sort field. |
| `order` | string | `asc` | `asc` or `desc`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Partner request status enum:**

| Value | Meaning |
|---|---|
| `new` | Created, awaiting partner acceptance |
| `accepted` | Partner has accepted |
| `declined` | Partner has declined the job |
| `in_progress` | Work underway |
| `completed` | Work finished |
| `disputed` | Request is under dispute resolution |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "cc7k6177-l96i-18k1-h483-113322117777",
      "property_id": "550e8400-e29b-41d4-a716-446655440000",
      "property_code": "NAU-00001",
      "title": "Post-checkout deep clean",
      "service_type": "cleaning",
      "status": "new",
      "requested_date": "2026-07-17",
      "agreed_payout_eur": 120.00,
      "partner_id": null,
      "notes_for_partner": "Full 4-bed villa. Focus on bathrooms.",
      "created_at": "2026-06-05T09:00:00Z",
      "updated_at": "2026-06-05T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 5,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### GET /v1/partner-requests/{id}

Retrieve a single partner request by UUID.

**Authentication:** Bearer token required. Account type: `homeowner` or `partner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The partner request's UUID. |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "cc7k6177-l96i-18k1-h483-113322117777",
    "homeowner_id": "661e9511-f30c-52e5-b827-557766551111",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "reservation_id": "883g2733-h52e-74g7-d049-779988773333",
    "title": "Post-checkout deep clean",
    "service_type": "cleaning",
    "status": "new",
    "requested_date": "2026-07-17",
    "agreed_payout_eur": 120.00,
    "partner_id": null,
    "notes_for_partner": "Full 4-bed villa. Focus on bathrooms.",
    "service_request_id": null,
    "created_at": "2026-06-05T09:00:00Z",
    "updated_at": "2026-06-05T09:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Request does not exist or caller does not have visibility. |

---

### POST /v1/partner-requests

Create a new partner request.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "property_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Post-checkout deep clean",
  "service_type": "cleaning",
  "requested_date": "2026-07-17",
  "agreed_payout_eur": 120.00,
  "notes_for_partner": "Full 4-bed villa. Focus on bathrooms.",
  "reservation_id": "883g2733-h52e-74g7-d049-779988773333"
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `property_id` | UUID | Must be a property owned by the authenticated homeowner. |
| `title` | string | Max 200 characters. |
| `service_type` | string | Enum: `cleaning`, `maintenance`, `transfers`, `experiences`, `laundry`. |
| `requested_date` | date | Format `YYYY-MM-DD`. |

**Optional fields:** `agreed_payout_eur`, `notes_for_partner`, `reservation_id`, `partner_id`.

**Behaviour:**
1. Sets `homeowner_id = auth.uid()`.
2. Sets `status = new`.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "dd8l7288-m07j-29l2-i594-224433228888",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "title": "Post-checkout deep clean",
    "service_type": "cleaning",
    "status": "new",
    "requested_date": "2026-07-17",
    "agreed_payout_eur": 120.00,
    "partner_id": null,
    "notes_for_partner": "Full 4-bed villa. Focus on bathrooms.",
    "created_at": "2026-06-05T12:00:00Z",
    "updated_at": "2026-06-05T12:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid values. |
| `NOT_FOUND` | 404 | `property_id` or `reservation_id` does not belong to the authenticated homeowner. |
| `FORBIDDEN` | 403 | Caller is not a homeowner. |

---

### PATCH /v1/partner-requests/{id}

Update a partner request. Partial updates are supported.

**Authentication:** Bearer token required. Account type: `homeowner` or `partner` (restricted fields for partners).

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The partner request's UUID. |

**Homeowner-writable fields:** `title`, `service_type`, `requested_date`, `agreed_payout_eur`, `notes_for_partner`, `status`, `partner_id`.

**Partner-writable fields:** `status` only (limited transitions — see below).

**Status transition rules:**

| Role | From | To | Notes |
|---|---|---|---|
| Homeowner | `new` | `accepted` | When assigning a partner directly |
| Homeowner | `new` | `declined` | Homeowner withdraws the request |
| Homeowner | `accepted` | `disputed` | Triggers dispute resolution flow |
| Homeowner | `in_progress` | `disputed` | Triggers dispute resolution flow |
| Partner | `new` | `accepted` | Partner accepts the job |
| Partner | `new` | `declined` | Partner declines the job |
| Partner | `accepted` | `in_progress` | Partner starts work |
| Partner | `in_progress` | `completed` | Partner marks done |

**Reassignment behaviour (homeowner):** When `partner_id` is changed on an `accepted` or `in_progress` request:
1. The request status reverts to `new`.
2. The new partner must accept before work can proceed.

**Response — 200 OK:** Returns the full updated partner request object.

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid field values. |
| `NOT_FOUND` | 404 | Request does not exist or caller does not have visibility. |
| `FORBIDDEN` | 403 | Partner attempting to update a field outside their permitted scope. |
| `BUSINESS_RULE_VIOLATION` | 422 | Invalid status transition. |

---

### DELETE /v1/partner-requests/{id}

Delete a partner request. Only permitted when `status = new`. Requests that have been accepted or are in progress must be handled via PATCH status transitions, not deleted.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The partner request's UUID. |

**Behaviour:**
1. Permanently deletes the record. This is a hard delete.
2. Only permitted when `status = new`. Active requests (`accepted`, `in_progress`) cannot be deleted.

**Response — 204 No Content**

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Request does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Request status is not `new` (i.e. `accepted`, `in_progress`, `completed`, `disputed`). |
