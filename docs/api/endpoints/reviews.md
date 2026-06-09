# API Endpoints — Reviews

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Review endpoints
**Last updated:** 2026-06-06
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md) · [api/endpoints/reservations.md](reservations.md)

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. `review_date` field removed everywhere — not a column on `reviews` table; sort default changed to `created_at` (source: database-schema.md §3.13). `platform` field removed everywhere — not a column on `reviews` table (source: database-schema.md §3.13). `review_type` and `subject_id` added as required POST fields — both are NOT NULL in the schema (source: database-schema.md §3.13 and data-models.md Model 13). `homeowner_id` removed from all responses — not a column on `reviews` table; visibility scoped via RLS through `subject_id`. Stray backtick in base path corrected.

---

## Overview

Reviews represent evaluations linked to a subject entity. The `review_type` determines what is being reviewed and which `subject_id` is expected:

| `review_type` | Subject | `subject_id` references |
|---|---|---|
| `guest_to_property` | Guest reviewing a property | `properties.id` |
| `homeowner_to_partner` | Homeowner reviewing a partner | `users.id` (partner) |
| `partner_to_homeowner` | Partner reviewing a homeowner | `users.id` (homeowner) |

Reviews use integer ratings (1–5). Ratings from demo seed data stored as decimals must be rounded to the nearest integer on migration.

**Account type:** Homeowners only.

**Visibility scope:** Scoped by RLS via `subject_id` — a homeowner can access reviews where the subject belongs to their property portfolio or their own user record.

---

## Base Path

```
/v1/reviews
```

---

## Endpoints

### GET /v1/reviews

List reviews for the authenticated homeowner.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `subject_id` | UUID | — | Filter by subject entity UUID. |
| `review_type` | string | — | Filter by review type. Enum: `guest_to_property`, `homeowner_to_partner`, `partner_to_homeowner`. |
| `rating` | integer | — | Filter by exact rating value (1–5). |
| `rating_gte` | integer | — | Filter reviews with `rating >= value`. |
| `sort` | string | `created_at` | Sort field. |
| `order` | string | `desc` | `asc` or `desc`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "gg1o0511-p30m-52o5-l827-557766551111",
      "review_type": "guest_to_property",
      "subject_id": "550e8400-e29b-41d4-a716-446655440000",
      "reservation_id": "883g2733-h52e-74g7-d049-779988773333",
      "reviewer_name": "Marco B.",
      "rating": 5,
      "comment": "Stunning villa with an incredible view. Everything was perfect.",
      "created_at": "2026-05-21T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 14,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### GET /v1/reviews/{id}

Retrieve a single review by UUID.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The review's UUID. |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "gg1o0511-p30m-52o5-l827-557766551111",
    "review_type": "guest_to_property",
    "subject_id": "550e8400-e29b-41d4-a716-446655440000",
    "reservation_id": "883g2733-h52e-74g7-d049-779988773333",
    "reviewer_name": "Marco B.",
    "rating": 5,
    "comment": "Stunning villa with an incredible view. Everything was perfect.",
    "created_at": "2026-05-21T09:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Review does not exist or caller does not have visibility. |

---

### POST /v1/reviews

Create a new review record. Used to manually log reviews received on external platforms.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "review_type": "guest_to_property",
  "subject_id": "550e8400-e29b-41d4-a716-446655440000",
  "reservation_id": "994h3844-i63f-85h8-e150-880099884444",
  "reviewer_name": "Anna C.",
  "rating": 4,
  "comment": "Beautiful location, very clean. The pool was a highlight."
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `review_type` | string | Enum: `guest_to_property`, `homeowner_to_partner`, `partner_to_homeowner`. |
| `subject_id` | UUID | For `guest_to_property`: must be a `properties.id` owned by the homeowner. For `homeowner_to_partner` and `partner_to_homeowner`: must be a valid `users.id`. |
| `reviewer_name` | string | Display name of the reviewer. Max 100 characters. |
| `rating` | integer | Integer 1–5 inclusive. |

**Conditional required fields:**

| Field | Required when | Notes |
|---|---|---|
| `reservation_id` | `review_type = guest_to_property` | Must belong to the same homeowner. |
| `partner_request_id` | `review_type = homeowner_to_partner` or `partner_to_homeowner` | Must belong to the same homeowner. |

**Optional fields:** `comment`.

**Behaviour:**
1. Validates `subject_id` against the expected entity type for the given `review_type`.
2. If `reservation_id` is provided, verifies it belongs to the same homeowner.
3. If `partner_request_id` is provided, verifies it belongs to the same homeowner.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "hh2p1622-q41n-63p6-m938-668877662222",
    "review_type": "guest_to_property",
    "subject_id": "550e8400-e29b-41d4-a716-446655440000",
    "reservation_id": "994h3844-i63f-85h8-e150-880099884444",
    "reviewer_name": "Anna C.",
    "rating": 4,
    "comment": "Beautiful location, very clean. The pool was a highlight.",
    "created_at": "2026-06-05T14:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields, rating outside 1–5 range, or invalid enum values. |
| `NOT_FOUND` | 404 | `subject_id`, `reservation_id`, or `partner_request_id` does not exist or does not belong to the authenticated homeowner. |
| `FORBIDDEN` | 403 | Caller is not a homeowner. |
