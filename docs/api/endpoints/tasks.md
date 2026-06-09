# API Endpoints — Tasks

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Task CRUD endpoints
**Last updated:** 2026-06-06
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md) · [database-schema.md](../../backend/database-schema.md)

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. Task priority enum corrected from invalid `low/medium/high` to canonical `low/normal/important/urgent` (source: `task_priority` enum in database-schema.md §2). FK column name corrected from `homeowner_id` to `owner_id` throughout (source: `tasks.owner_id` column in database-schema.md §3.11 and data-models.md Model 10).

---

## Overview

Tasks represent property maintenance, cleaning, or operational items managed by the homeowner. Each task is scoped to a property via `property_id` (UUID FK to `properties.id`).

**Account type:** Homeowners only. Partners do not have access to task endpoints.

**Visibility scope:** A homeowner can only access tasks where `owner_id = auth.uid()`.

---

## Base Path

```
/v1/tasks
```

---

## Endpoints

### GET /v1/tasks

List tasks for the authenticated homeowner.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `property_id` | UUID | — | Filter by property. |
| `status` | string | — | Filter by status enum value. |
| `priority` | string | — | Filter by priority enum value. |
| `due_before` | date | — | Filter tasks with `due_date <= date`. Format `YYYY-MM-DD`. |
| `due_after` | date | — | Filter tasks with `due_date >= date`. Format `YYYY-MM-DD`. |
| `include_cancelled` | boolean | `false` | Include tasks with `status = cancelled`. |
| `sort` | string | `due_date` | Sort field. |
| `order` | string | `asc` | `asc` or `desc`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Task status enum:**

| Value | Meaning |
|---|---|
| `pending` | Not yet started |
| `in_progress` | Work underway |
| `completed` | Work finished |
| `cancelled` | Task cancelled (soft delete) |

**Task priority enum:**

| Value | Meaning |
|---|---|
| `low` | Low urgency |
| `normal` | Standard operational priority |
| `important` | Elevated priority — attention required |
| `urgent` | Time-sensitive — act immediately |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "aa5i4955-j74g-96i9-f261-991100995555",
      "property_id": "550e8400-e29b-41d4-a716-446655440000",
      "property_code": "NAU-00001",
      "title": "Replace kitchen tap",
      "description": "Cold water tap is dripping. Need a plumber.",
      "status": "pending",
      "priority": "normal",
      "due_date": "2026-06-15",
      "assigned_partner_id": null,
      "completed_at": null,
      "created_at": "2026-06-05T09:00:00Z",
      "updated_at": "2026-06-05T09:00:00Z"
    }
  ],
  "pagination": {
    "total": 8,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

---

### GET /v1/tasks/{id}

Retrieve a single task by UUID.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The task's UUID. |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "aa5i4955-j74g-96i9-f261-991100995555",
    "owner_id": "661e9511-f30c-52e5-b827-557766551111",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "title": "Replace kitchen tap",
    "description": "Cold water tap is dripping. Need a plumber.",
    "status": "pending",
    "priority": "normal",
    "due_date": "2026-06-15",
    "assigned_partner_id": null,
    "completed_at": null,
    "created_at": "2026-06-05T09:00:00Z",
    "updated_at": "2026-06-05T09:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Task does not exist or belongs to a different homeowner. |

---

### POST /v1/tasks

Create a new task.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "property_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Replace kitchen tap",
  "description": "Cold water tap is dripping. Need a plumber.",
  "priority": "normal",
  "due_date": "2026-06-15"
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `property_id` | UUID | Must be a property owned by the authenticated homeowner. |
| `title` | string | Max 200 characters. |
| `priority` | string | Enum: `low`, `normal`, `important`, `urgent`. |

**Optional fields:** `description`, `due_date`, `assigned_partner_id`.

**Behaviour:**
1. Sets `owner_id = auth.uid()`.
2. Sets `status = pending`.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "bb6j5066-k85h-07j0-g372-002211006666",
    "owner_id": "661e9511-f30c-52e5-b827-557766551111",
    "property_id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "title": "Replace kitchen tap",
    "description": "Cold water tap is dripping. Need a plumber.",
    "status": "pending",
    "priority": "normal",
    "due_date": "2026-06-15",
    "assigned_partner_id": null,
    "completed_at": null,
    "created_at": "2026-06-05T11:00:00Z",
    "updated_at": "2026-06-05T11:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid values. |
| `NOT_FOUND` | 404 | `property_id` does not belong to the authenticated homeowner. |
| `FORBIDDEN` | 403 | Caller is not a homeowner. |

---

### PATCH /v1/tasks/{id}

Update a task. Partial updates are supported.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The task's UUID. |

**Request body:** Any subset of writable task fields. `id`, `owner_id`, `property_id`, and `created_at` are immutable.

```json
{
  "status": "in_progress",
  "assigned_partner_id": "661e9511-f30c-52e5-b827-557766551111"
}
```

**Status transition rules:**

| From | To | Notes |
|---|---|---|
| `pending` | `in_progress` | — |
| `pending` | `cancelled` | Soft delete |
| `in_progress` | `completed` | Sets `completed_at` to current timestamp automatically. |
| `in_progress` | `cancelled` | Soft delete |
| `completed` | — | Terminal state. No further transitions. |
| `cancelled` | — | Terminal state. No further transitions. |

**Response — 200 OK:** Returns the full updated task object.

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid field values. |
| `NOT_FOUND` | 404 | Task does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Invalid status transition. |

---

### DELETE /v1/tasks/{id}

Cancel a task. This is a soft delete — the record is retained with `status = cancelled`.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The task's UUID. |

**Behaviour:**
1. Sets `status = cancelled`.
2. The task is excluded from default list responses (`include_cancelled=true` required to retrieve it).

**Response — 204 No Content**

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Task does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Task is already `completed` or `cancelled`. |
