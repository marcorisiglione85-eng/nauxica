# API Endpoints — Messages

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Message endpoints
**Last updated:** 2026-06-06
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md)

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. `sent_at` removed everywhere — messages use `created_at` only (source: `messages` table in database-schema.md §3.12). `message_type` enum corrected: `guest` replaced by `nauxica` (source: `message_type` enum in database-schema.md §2). `homeowner_id` removed from all responses and behaviour — messages are scoped by `sender_id` and `recipient_id` (source: data-models.md Model 12). `property_id` and `property_code` removed from response objects — not columns on `messages` table. `recipient_id` and `account_type_context` added as required POST fields. Visibility scope corrected.

---

## Overview

Messages represent communications visible to the homeowner: messages from partners, AI concierge summaries and escalations, and system notifications. The homeowner can mark messages as read, archive them, and send replies.

Guests do not interact with the messages system. Guest communications are handled exclusively via WhatsApp through the AI concierge.

**Account type:** Homeowners. Partners may have limited read access to messages scoped to their assigned jobs (post-MVP).

**Visibility scope:** A user can access messages where `sender_id = auth.uid()` OR `recipient_id = auth.uid()`.

---

## Base Path

```
/v1/messages
```

---

## Endpoints

### GET /v1/messages

List messages for the authenticated user.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message_type` | string | — | Filter by type. Enum: `partner`, `nauxica`, `system`. |
| `is_read` | boolean | — | Filter by read status. |
| `include_archived` | boolean | `false` | When `false`, only non-archived messages are returned. When `true`, all messages including archived are returned. |
| `sort` | string | `created_at` | Sort field. |
| `order` | string | `desc` | `asc` or `desc`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Message type enum:**

| Value | Meaning |
|---|---|
| `partner` | Message from or to a service partner |
| `nauxica` | AI concierge summary or guest-related notification |
| `system` | System-generated notification or alert |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "ee9m8399-n18k-30m3-j605-335544339999",
      "sender_id": "772f0622-g41d-63f6-c938-668877662222",
      "recipient_id": "661e9511-f30c-52e5-b827-557766551111",
      "account_type_context": "partner",
      "subject": "Cleaning completed — Villa Mare",
      "body": "Deep clean completed at 14:30. All rooms done. Photos uploaded.",
      "message_type": "partner",
      "is_read": false,
      "is_archived": false,
      "created_at": "2026-07-17T14:35:00Z",
      "updated_at": "2026-07-17T14:35:00Z"
    }
  ],
  "pagination": {
    "total": 23,
    "page": 1,
    "per_page": 20,
    "total_pages": 2
  }
}
```

---

### GET /v1/messages/{id}

Retrieve a single message by UUID.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The message's UUID. |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "ee9m8399-n18k-30m3-j605-335544339999",
    "sender_id": "772f0622-g41d-63f6-c938-668877662222",
    "recipient_id": "661e9511-f30c-52e5-b827-557766551111",
    "account_type_context": "partner",
    "subject": "Cleaning completed — Villa Mare",
    "body": "Deep clean completed at 14:30. All rooms done. Photos uploaded.",
    "message_type": "partner",
    "is_read": false,
    "is_archived": false,
    "created_at": "2026-07-17T14:35:00Z",
    "updated_at": "2026-07-17T14:35:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Message does not exist or caller is neither sender nor recipient. |

---

### POST /v1/messages

Send a new message. Used by the homeowner to send outbound messages to partners.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "recipient_id": "772f0622-g41d-63f6-c938-668877662222",
  "account_type_context": "partner",
  "subject": "Checklist for next arrival",
  "body": "Please make sure to restock coffee pods and replace the bathroom toiletries.",
  "message_type": "partner"
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `recipient_id` | UUID | The recipient user's UUID. Must be a valid user. |
| `account_type_context` | string | Enum: `homeowner`, `partner`. Describes the account type context of the sender. |
| `subject` | string | Max 200 characters. |
| `body` | string | Message content. |
| `message_type` | string | Enum: `partner`, `system`. Homeowners may only send `partner` type. `nauxica` and `system` are system-generated. |

**Optional fields:** none.

**Behaviour:**
1. Sets `sender_id = auth.uid()`.
2. Sets `is_read = false`, `is_archived = false`.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "ff0n9400-o29l-41n4-k716-446655440000",
    "sender_id": "661e9511-f30c-52e5-b827-557766551111",
    "recipient_id": "772f0622-g41d-63f6-c938-668877662222",
    "account_type_context": "partner",
    "subject": "Checklist for next arrival",
    "body": "Please make sure to restock coffee pods and replace the bathroom toiletries.",
    "message_type": "partner",
    "is_read": false,
    "is_archived": false,
    "created_at": "2026-06-05T13:00:00Z",
    "updated_at": "2026-06-05T13:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid values. |
| `NOT_FOUND` | 404 | `recipient_id` does not correspond to a valid user. |
| `BUSINESS_RULE_VIOLATION` | 422 | Homeowner attempting to send a `nauxica` or `system` type message. |

---

### PATCH /v1/messages/{id}

Update a message. Only `is_read` and `is_archived` are writable. Message content is immutable after sending.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The message's UUID. |

**Request body:**

```json
{
  "is_read": true,
  "is_archived": false
}
```

**Writable fields:**

| Field | Type | Notes |
|---|---|---|
| `is_read` | boolean | Mark as read or unread. |
| `is_archived` | boolean | Archive or unarchive the message. |

All other fields (`subject`, `body`, `message_type`, `created_at`) are immutable and are ignored if present.

**Response — 200 OK:** Returns the full updated message object.

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid field values. |
| `NOT_FOUND` | 404 | Message does not exist or caller is neither sender nor recipient. |
