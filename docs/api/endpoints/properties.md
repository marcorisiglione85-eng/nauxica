# API Endpoints — Properties

**Version:** 1.1
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Property CRUD endpoints
**Last updated:** 2026-06-07
**Related:** [api-overview.md](../api-overview.md) · [data-models.md](../../backend/data-models.md) · [database-schema.md](../../backend/database-schema.md)

> **v1.1 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-3: POST /v1/properties behaviour updated — `property_code` generation strategy documented as server-side PostgreSQL sequence; immutable; never client-generated in production (source: database-schema.md v1.4 §3.2).

---

## Overview

Properties are the top-level resource in Nauxica. All other resources (reservations, tasks, partner requests) are scoped to a property via `property_id` (UUID FK to `properties.id`).

`property_code` (format `NAU-XXXXX`) is a human-readable reference generated at creation and never changed. It is returned in responses but is not used as an API identifier. All URL path parameters use the UUID `id`.

**Account type:** Homeowners only. Partners do not have access to property endpoints.

**Visibility scope:** A homeowner can only access properties where `owner_id = auth.uid()`.

---

## Base Path

```
/v1/properties
```

---

## Endpoints

### GET /v1/properties

List all properties owned by the authenticated homeowner.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `platform_status` | string | — | Filter by platform status. Enum: `draft`, `onboarding`, `pending_activation`, `active`, `suspended`, `archived`. |
| `availability_status` | string | — | Filter by availability. Enum: `available`, `unavailable`, `maintenance`. |
| `include_archived` | boolean | `false` | Include properties with `platform_status = archived`. |
| `page` | integer | `1` | Page number. |
| `per_page` | integer | `20` | Records per page. Max `100`. |

**Response — 200 OK:**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "property_code": "NAU-00001",
      "display_name": "Villa Mare",
      "property_type": "villa",
      "area_description": "Taormina",
      "address_city": "Taormina",
      "address_province": "ME",
      "max_guests": 8,
      "bedrooms": 4,
      "bathrooms": 3,
      "platform_status": "active",
      "availability_status": "available",
      "created_at": "2026-03-01T10:00:00Z",
      "updated_at": "2026-05-15T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 3,
    "page": 1,
    "per_page": 20,
    "total_pages": 1
  }
}
```

The list response returns a summary object. Full property details (amenities, listing URLs, regulatory fields) are returned by `GET /v1/properties/{id}`.

---

### GET /v1/properties/{id}

Retrieve a single property by UUID.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The property's UUID (`properties.id`). |

**Response — 200 OK:**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "property_code": "NAU-00001",
    "owner_id": "661e9511-f30c-52e5-b827-557766551111",
    "display_name": "Villa Mare",
    "property_type": "villa",
    "area_description": "Taormina, overlooking the bay",
    "address_street": "Via Nazionale 42",
    "address_city": "Taormina",
    "address_province": "ME",
    "address_postal_code": "98039",
    "address_country": "IT",
    "max_guests": 8,
    "bedrooms": 4,
    "bathrooms": 3,
    "beds_configuration": { "double": 2, "single": 4 },
    "amenities": ["wifi", "pool", "air_conditioning", "parking"],
    "checkin_time": "15:00",
    "checkout_time": "11:00",
    "access_method": "key_safe",
    "house_rules": "No smoking. No pets.",
    "cancellation_policy": "Moderate",
    "cir_code": "ME123456",
    "alloggiati_web_required": true,
    "tourist_tax_enabled": true,
    "tourist_tax_amount_eur": 2.50,
    "tourist_tax_exemptions": {},
    "listing_channels": ["airbnb", "booking_com"],
    "listing_urls": {
      "airbnb": "https://airbnb.com/rooms/12345",
      "booking_com": "https://booking.com/hotel/villa-mare"
    },
    "availability_status": "available",
    "platform_status": "active",
    "owner_notes": null,
    "created_at": "2026-03-01T10:00:00Z",
    "updated_at": "2026-05-15T14:30:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Property does not exist or is owned by a different homeowner. |

---

### POST /v1/properties

Create a new property.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Request body:**

```json
{
  "display_name": "Casa Etna",
  "property_type": "apartment",
  "area_description": "Nicolosi, Etna foothills",
  "address_street": "Via Etnea 10",
  "address_city": "Nicolosi",
  "address_province": "CT",
  "address_postal_code": "95030",
  "address_country": "IT",
  "max_guests": 4,
  "bedrooms": 2,
  "bathrooms": 1,
  "checkin_time": "15:00",
  "checkout_time": "10:00"
}
```

**Required fields:**

| Field | Type | Notes |
|---|---|---|
| `display_name` | string | Property display name. Max 120 characters. |
| `property_type` | string | Enum: `apartment`, `villa`, `house`, `room`, `studio`. |
| `address_city` | string | — |
| `address_province` | string | Two-letter Italian province code. |
| `max_guests` | integer | Minimum 1. |
| `bedrooms` | integer | Minimum 0. |
| `bathrooms` | integer | Minimum 0. |
| `checkin_time` | string | Format `HH:MM`. |
| `checkout_time` | string | Format `HH:MM`. |

**Optional fields:** All other property fields defined in [data-models.md](../../backend/data-models.md) Model 2.

**Behaviour:**
1. Sets `owner_id = auth.uid()`.
2. Generates `property_code` server-side using a PostgreSQL sequence (format `NAU-XXXXX`). The code is unique, immutable, and never reused. Any `property_code` in the request body is ignored — it is always server-generated and never accepted from the client.
3. Sets `platform_status = draft`.
4. Sets `availability_status = available`.

**Response — 201 Created:**

```json
{
  "data": {
    "id": "772f1622-g41d-63f6-c938-668877662222",
    "property_code": "NAU-00042",
    "display_name": "Casa Etna",
    "platform_status": "draft",
    "availability_status": "available",
    "created_at": "2026-06-05T09:00:00Z",
    "updated_at": "2026-06-05T09:00:00Z"
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid values. `details` lists field errors. |
| `FORBIDDEN` | 403 | Caller is not a homeowner. |

---

### PATCH /v1/properties/{id}

Update a property. Partial updates are supported — only provided fields are changed.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The property's UUID. |

**Request body:** Any subset of writable property fields. `id`, `property_code`, `owner_id`, and `created_at` are immutable and are ignored if present.

```json
{
  "display_name": "Casa Etna — Updated",
  "availability_status": "maintenance",
  "owner_notes": "Pool pump being replaced. Available from 2026-06-20."
}
```

**Response — 200 OK:** Returns the full updated property object (same structure as `GET /v1/properties/{id}`).

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid field values. |
| `NOT_FOUND` | 404 | Property does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Attempting to change an immutable field (`property_code`, `owner_id`). |

---

### DELETE /v1/properties/{id}

Archive a property. This is a soft delete — the record is retained with `platform_status = archived`.

**Authentication:** Bearer token required. Account type: `homeowner`.

**Path parameters:**

| Parameter | Type | Description |
|---|---|---|
| `id` | UUID | The property's UUID. |

**Behaviour:**
1. Sets `platform_status = archived`.
2. Sets `availability_status = unavailable`.
3. The property is excluded from default list responses (`include_archived=true` required to retrieve it).
4. Child records (reservations, tasks, partner requests) are not deleted.

**Response — 204 No Content**

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `NOT_FOUND` | 404 | Property does not exist or belongs to a different homeowner. |
| `BUSINESS_RULE_VIOLATION` | 422 | Property has active reservations (checked-in guests). Cannot archive. |
