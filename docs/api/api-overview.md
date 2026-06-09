# API Overview

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · REST API conventions and shared contracts
**Last updated:** 2026-06-07

> **v1.1 changes (2026-06-07):** Final API Consistency Micro Fix. §10 Soft Deletes: `partner_requests` entry corrected — `cancelled` is not in the `partner_request_status` enum. Entry replaced with canonical behaviour: unaccepted records may be hard-deleted; accepted/in-progress/completed/disputed records are retained; declined → `status = declined`; disputed → `status = disputed` (source: database-schema.md v1.4 §2 `partner_request_status` enum).
**Related:** [auth-strategy.md](../backend/auth-strategy.md) · [data-models.md](../backend/data-models.md) · [api/auth.md](auth.md) · [api/endpoints/](endpoints/)

---

## Purpose

This document defines the shared conventions for the Nauxica REST API: base URL, versioning, authentication, request and response formats, pagination, error handling, and resource naming. All endpoint documentation in `api/endpoints/` conforms to these conventions.

---

## 1. Base URL and Versioning

```
https://api.nauxica.com/v1
```

All endpoints are prefixed with `/v1`. The version is part of the URL path. When a breaking change is introduced, a new version prefix (`/v2`) is introduced alongside the existing one; the previous version is not removed until clients have migrated.

---

## 2. Authentication

All API requests require a valid Bearer token in the `Authorization` header:

```http
Authorization: Bearer <access_token>
```

Access tokens are short-lived JWTs (15-minute expiry) issued by Supabase Auth. Token refresh is handled via `POST /v1/auth/refresh`. See [auth.md](auth.md) for full authentication endpoint documentation.

**Unauthenticated requests** receive a `401 Unauthorized` response.

**Token claims:** All JWTs carry the following custom claims:
- `user_id` — UUID of the authenticated user
- `account_type` — `homeowner` or `partner`
- `account_status` — current account lifecycle state
- `is_identity_verified` — boolean; relevant for partner dispatch gating

The API validates token claims on every request. Client-provided role assertions in the request body are ignored.

---

## 3. Account Types and Scopes

The platform has two public account types, each with distinct access scopes:

| Account type | Scope |
|---|---|
| `homeowner` | Full CRUD on their own properties, reservations, tasks, partner requests, messages, and reviews. Read-only access to partner profiles. |
| `partner` | Read-only access to assigned partner requests. Status updates on accepted jobs. No access to homeowner property data beyond the assigned job context. |

Homeowner-scoped endpoints filter results to records owned by the authenticated homeowner. A homeowner cannot access another homeowner's records.

---

## 4. Request Format

- **Content type:** `application/json`
- **Character encoding:** UTF-8
- **Date format:** ISO 8601 — `YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:MM:SSZ` for timestamps
- **Boolean values:** JSON booleans (`true` / `false`), never strings
- **Enum values:** Always lowercase strings (e.g. `"active"`, `"pending"`, `"checked_in"`)
- **UUID references:** All IDs are UUIDs. Human-readable references (e.g. `property_code: "NAU-00042"`) are display fields only and are never used as FK references in request bodies.

---

## 5. Response Format

All responses use a consistent JSON envelope.

### 5.1 Single resource

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "display_name": "Villa Mare",
    "property_code": "NAU-00001"
  }
}
```

### 5.2 Resource collection

```json
{
  "data": [
    { "id": "...", "display_name": "Villa Mare" },
    { "id": "...", "display_name": "Casa Etna" }
  ],
  "pagination": {
    "total": 47,
    "page": 1,
    "per_page": 20,
    "total_pages": 3
  }
}
```

### 5.3 Empty response

Successful operations with no response body (e.g. DELETE) return HTTP `204 No Content` with an empty body.

### 5.4 Created resource

Successful POST operations return HTTP `201 Created` with the created resource in the `data` envelope.

---

## 6. Pagination

Collection endpoints support cursor-based pagination via query parameters:

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number (1-indexed) |
| `per_page` | integer | `20` | Records per page. Maximum `100`. |

The response `pagination` object always includes `total`, `page`, `per_page`, and `total_pages`.

---

## 7. Filtering and Sorting

Collection endpoints support filtering via query parameters. Common parameters:

| Parameter | Type | Description |
|---|---|---|
| `property_id` | UUID | Filter by property |
| `status` | string | Filter by status enum value |
| `sort` | string | Field name to sort by (e.g. `created_at`, `due_date`) |
| `order` | string | `asc` or `desc`. Default: `desc` |

Endpoint-specific filter parameters are documented in each endpoint file.

---

## 8. Error Format

All errors use a consistent envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Property not found.",
    "details": {}
  }
}
```

The `details` field is an optional object containing field-level validation errors or additional context.

### 8.1 HTTP status codes

| Status | Meaning |
|---|---|
| `200 OK` | Successful GET or PATCH |
| `201 Created` | Successful POST |
| `204 No Content` | Successful DELETE |
| `400 Bad Request` | Malformed request or validation failure |
| `401 Unauthorized` | Missing or invalid token |
| `403 Forbidden` | Authenticated but not authorised for this resource |
| `404 Not Found` | Resource does not exist or is not visible to the caller |
| `409 Conflict` | State conflict (e.g. duplicate unique field) |
| `422 Unprocessable Entity` | Request is well-formed but violates a business rule |
| `500 Internal Server Error` | Unexpected server error |

### 8.2 Error codes

| Code | HTTP status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | One or more fields failed validation. Details contain field errors. |
| `INVALID_TOKEN` | 401 | Token is malformed, expired, or revoked. |
| `FORBIDDEN` | 403 | Caller does not have permission for this resource. |
| `NOT_FOUND` | 404 | Resource does not exist or is scoped out of visibility. |
| `CONFLICT` | 409 | Unique constraint violation or state conflict. |
| `BUSINESS_RULE_VIOLATION` | 422 | Request violates a platform business rule. |
| `INTERNAL_ERROR` | 500 | Unexpected server error. |

---

## 9. Resource Naming

URL path segments use **plural kebab-case**:

| Resource | Path segment |
|---|---|
| Property | `/properties` |
| Reservation | `/reservations` |
| Task | `/tasks` |
| Partner request | `/partner-requests` |
| Message | `/messages` |
| Review | `/reviews` |

Nested resource paths follow the pattern `/{parent}/{parent_id}/{child}` where the parent is needed for context (e.g. `/properties/{property_id}/reservations`). Flat resource paths (`/reservations?property_id={uuid}`) are preferred for collections that are frequently queried across properties.

---

## 10. Soft Deletes

Some resources use soft deletion (status transition) rather than hard deletion:

| Resource | Delete behaviour |
|---|---|
| `properties` | Status set to `archived`. Record retained. |
| `tasks` | Status set to `cancelled`. Record retained. |
| `reservations` | Status set to `cancelled`. Record retained. |
| `messages` | `is_archived` set to `true`. Record retained. |
| `partner_requests` | `cancelled` is not in the `partner_request_status` enum — do not set `status = cancelled`. Unaccepted (`new`) partner requests may be hard-deleted. Records with status `accepted`, `in_progress`, `completed`, or `disputed` are retained. Declined requests use `status = declined`. Disputed requests use `status = disputed`. |
| `reviews` | Hard delete. No retention required. |

Archived and cancelled records are excluded from default collection responses. Use `?include_archived=true` to include them.

---

## 11. Idempotency

POST requests are not idempotent by default. Clients that retry on network failure may create duplicate records. For critical operations (reservation creation, partner request creation), the client should check for existing records before retrying.

A future version of the API may add `Idempotency-Key` header support for POST operations.

---

## 12. Rate Limiting

Rate limits are enforced per authenticated user:

| Limit | Value |
|---|---|
| Requests per minute | 120 |
| Burst limit | 20 requests in 1 second |

Rate limit headers are included in all responses:

```http
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 118
X-RateLimit-Reset: 1748908800
```

Exceeded rate limits return `429 Too Many Requests`.

---

## 13. Related Documents

- [auth.md](auth.md) — Authentication endpoint specifications
- [endpoints/properties.md](endpoints/properties.md) — Property CRUD endpoints
- [endpoints/reservations.md](endpoints/reservations.md) — Reservation CRUD endpoints
- [endpoints/tasks.md](endpoints/tasks.md) — Task CRUD endpoints
- [endpoints/partner-requests.md](endpoints/partner-requests.md) — Partner request endpoints
- [endpoints/messages.md](endpoints/messages.md) — Message endpoints
- [endpoints/reviews.md](endpoints/reviews.md) — Review endpoints
- [auth-strategy.md](../backend/auth-strategy.md) — Authentication architecture
- [data-models.md](../backend/data-models.md) — Canonical data models
