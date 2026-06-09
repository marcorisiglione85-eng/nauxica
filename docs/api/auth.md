# API Authentication

**Version:** 1.3
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Authentication endpoint specifications
**Last updated:** 2026-06-07

> **v1.3 changes (2026-06-07):** Supabase Foundation Final Blocker Fix. CB-NEW-1/CB-NEW-2: Implementation notes added to homeowner and partner registration POST sections — `codice_fiscale_or_piva` is not collected at registration (nullable; set during onboarding); `plan_started_at` and `plan_renews_at` are not sent by client (nullable at MVP; server-managed by Stripe billing module). (source: database-schema.md v1.4 §3.1, data-models.md v1.6 Model 1)

> **v1.2 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-B: `nauxica_plan_tier` enum corrected — `growth` replaced with `premium`. Canonical values are `starter / professional / premium` (source: database-schema.md §2 `nauxica_plan_tier` enum).

> **v1.1 changes (2026-06-06):** API Contract Correction Sprint. `nauxica_plan_tier` added as optional field to homeowner registration POST — required NOT NULL in schema, defaults to `starter` server-side (source: database-schema.md §3.1). §6 added: register.html multi-step form field-to-API mapping, documenting which form fields map to API fields, which require client-side transformation, and which are onboarding context not sent to the API.
**Related:** [auth-strategy.md](../backend/auth-strategy.md) · [api-overview.md](api-overview.md) · [data-models.md](../backend/data-models.md)

---

## Purpose

This document specifies the authentication API endpoints for homeowner and partner account registration, login, token refresh, and logout. It is the implementation contract between the frontend and the Supabase Auth (GoTrue) backend.

Design decisions and security requirements are defined in [auth-strategy.md](../backend/auth-strategy.md). This document covers endpoint contracts only.

---

## Base Path

```
/v1/auth
```

---

## Endpoints

### POST /v1/auth/register/homeowner

Register a new homeowner account.

**Authentication:** None required.

**Request body:**

```json
{
  "email": "owner@example.com",
  "password": "minimum-12-characters",
  "phone": "+39 333 1234567",
  "full_name": "Marco Russo"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Must be a valid email address. |
| `password` | string | Yes | Minimum 12 characters. |
| `phone` | string | Yes | Italian phone number. Normalised to E.164 (`+39...`) server-side. |
| `full_name` | string | Yes | Display name for the account. |
| `nauxica_plan_tier` | string | No | Enum: `starter`, `professional`, `premium`. Defaults to `starter` server-side if not provided. |

**Behaviour:**
1. Creates a new `User` record with `account_type = homeowner` and `account_status = pending`.
2. Sends an email verification link to the provided address.
3. Sends an SMS OTP to the provided phone number.
4. Account transitions to `active` only after both `is_email_verified` and `is_phone_verified` are `true`.

**Server-managed fields — not sent by client:**
- `codice_fiscale_or_piva` — not collected at registration. Column is nullable; server inserts `null`. Collected during onboarding/account verification. No placeholder value.
- `plan_started_at` / `plan_renews_at` — not set at registration. Both are nullable at MVP. Managed by the Stripe billing module when subscription billing is implemented.

**Response — 201 Created:**

```json
{
  "data": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "account_type": "homeowner",
    "account_status": "pending",
    "email": "owner@example.com",
    "message": "Verification email and SMS sent. Account pending verification."
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid format. |
| `CONFLICT` | 409 | Email or phone number already registered. |

---

### POST /v1/auth/register/partner

Register a new partner account.

**Authentication:** None required.

**Request body:**

```json
{
  "email": "partner@example.com",
  "password": "minimum-12-characters",
  "phone": "+39 333 9876543",
  "full_name": "Giulia Farina",
  "service_type": "cleaning",
  "operating_area": "Catania"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Must be a valid email address. |
| `password` | string | Yes | Minimum 12 characters. |
| `phone` | string | Yes | Italian phone number. Normalised to E.164 server-side. |
| `full_name` | string | Yes | Display name for the account. |
| `service_type` | string | Yes | Primary service type. Enum: `cleaning`, `maintenance`, `transfers`, `experiences`, `laundry`. |
| `operating_area` | string | Yes | Primary area of operation. Free text. |

**Behaviour:**
1. Creates a new `User` record with `account_type = partner`, `account_status = pending`, and `is_identity_verified = false`.
2. Sends email verification link and SMS OTP.
3. Partner account becomes `active` after email and phone verification.
4. Partner cannot accept job requests until `is_identity_verified = true`. Identity verification is a separate admin-gated process.

**Server-managed fields — not sent by client:**
- `codice_fiscale_or_piva` — not collected at registration. Column is nullable; server inserts `null`. Collected during onboarding/account verification. No placeholder value.
- `plan_started_at` / `plan_renews_at` — not set at registration. Both are nullable at MVP. Managed by the Stripe billing module when subscription billing is implemented.

**Response — 201 Created:**

```json
{
  "data": {
    "user_id": "661e9511-f30c-52e5-b827-557766551111",
    "account_type": "partner",
    "account_status": "pending",
    "email": "partner@example.com",
    "message": "Verification email and SMS sent. Account pending verification."
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields or invalid format. |
| `CONFLICT` | 409 | Email or phone number already registered. |

---

### POST /v1/auth/login

Authenticate an existing homeowner or partner account.

**Authentication:** None required.

**Request body:**

```json
{
  "email": "owner@example.com",
  "password": "minimum-12-characters"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `email` | string | Yes | Registered email address. |
| `password` | string | Yes | Account password. |

**Behaviour:**
1. Validates credentials against the stored hash.
2. Checks `account_status`. If not `active`, returns a status-specific error.
3. On 5 consecutive failed attempts: applies a 15-minute lockout.
4. On 10 cumulative failed attempts in a session: locks the account; sends unlock email.
5. On success: issues a short-lived access token (15-minute JWT) and a long-lived refresh token (30-day, rotated on every use).

**Response — 200 OK:**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...",
    "token_type": "bearer",
    "expires_in": 900,
    "user": {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "account_type": "homeowner",
      "account_status": "active",
      "email": "owner@example.com"
    }
  }
}
```

| Field | Notes |
|---|---|
| `expires_in` | Seconds until access token expiry. Always `900` (15 minutes). |
| `refresh_token` | Store securely. Used with `POST /v1/auth/refresh`. Invalidated on next use. |

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Missing required fields. |
| `INVALID_TOKEN` | 401 | Invalid credentials. |
| `FORBIDDEN` | 403 | Account is not `active` (pending, suspended, or closed). |
| `BUSINESS_RULE_VIOLATION` | 422 | Account is temporarily locked. `details` includes `locked_until` timestamp. |

---

### POST /v1/auth/refresh

Exchange a valid refresh token for a new access token and refresh token pair.

**Authentication:** None required (refresh token is the credential).

**Request body:**

```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `refresh_token` | string | Yes | The refresh token issued at login or the previous refresh. |

**Behaviour:**
1. Validates the refresh token.
2. Immediately invalidates the presented refresh token (rotation on every use).
3. Issues a new access token (15-minute JWT) and a new refresh token (30-day).
4. If the refresh token is already invalidated (possible replay attack): revokes all active sessions for the account and returns `401`.

**Response — 200 OK:**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4...",
    "token_type": "bearer",
    "expires_in": 900
  }
}
```

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `INVALID_TOKEN` | 401 | Refresh token is invalid, expired, or already used. |

---

### POST /v1/auth/logout

Invalidate the current session.

**Authentication:** Bearer token required.

**Request body:**

```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4..."
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `refresh_token` | string | Yes | The active refresh token to invalidate. |

**Behaviour:**
1. Invalidates the provided refresh token.
2. The access token remains technically valid until its 15-minute expiry but has no associated refresh token.
3. Future refresh attempts with the invalidated token return `401`.

**Response — 204 No Content**

No response body.

**Error responses:**

| Code | HTTP | Condition |
|---|---|---|
| `INVALID_TOKEN` | 401 | Missing or invalid access token. |

---

## Token Lifecycle Summary

```
POST /auth/login
  → access_token (15 min) + refresh_token (30 days)

Before access_token expires:
  POST /auth/refresh
  → new access_token (15 min) + new refresh_token (30 days)
  → old refresh_token immediately invalidated

On logout:
  POST /auth/logout
  → refresh_token invalidated
  → access_token expires naturally within 15 min
```

See [auth-strategy.md §2.2](../backend/auth-strategy.md) for full session management specification.

---

## Register.html Form Field Mapping

The `register.html` multi-step wizard collects more data than is sent to the API endpoints above. This section documents which fields map to API fields, which require client-side transformation, and which are onboarding context held in the browser only.

### Homeowner registration (steps 1–6)

**Step 2 — Account fields (sent to `POST /v1/auth/register/homeowner`):**

| Form field | API field | Transformation |
|---|---|---|
| `fullName` | `full_name` | Direct. |
| `email` | `email` | Direct. |
| `phone` | `phone` | Direct. Server normalises to E.164. |
| `password` | `password` | Direct. |
| `confirmPassword` | — | Client-side validation only. Not sent to API. |
| `companyName` | — | Not in `User` model. Onboarding context only. |

**Step 3 — Property context (onboarding context — not sent to API):**

| Form field | Notes |
|---|---|
| `propertyCount` | Used client-side to suggest a plan tier. |
| `mainLocation` | Onboarding context. Not a User model field. |
| `propertyType` | Onboarding context. Stored per-property, not on the user. |
| `pms` | Onboarding context. Not a backend field. |
| `pmsName` | Onboarding context. Not a backend field. |

**Step 5 — Plan suggestion:**

| Form field | API field | Notes |
|---|---|---|
| (computed from `propertyCount`) | `nauxica_plan_tier` | Client must map selected plan to enum: `starter`, `professional`, `premium`. Send as optional field on `POST /v1/auth/register/homeowner`. |

**Steps 4 and 6 — Not sent to API:**

Steps 4 (operational needs checkboxes, `ownerChallenge`) and 6 (review + consent) are onboarding UX only. No fields from these steps are sent to the registration endpoint.

---

### Partner registration (steps 1–6)

**Step 2 — Account fields (sent to `POST /v1/auth/register/partner`):**

| Form field | API field | Transformation |
|---|---|---|
| `fullName` | `full_name` | Direct. |
| `email` | `email` | Direct. |
| `phone` | `phone` | Direct. Server normalises to E.164. |
| `password` | `password` | Direct. |
| `confirmPassword` | — | Client-side validation only. Not sent to API. |
| `companyName` | — | Not in `User` model. Onboarding context only. |

**Step 3 — Service context (sent to `POST /v1/auth/register/partner`):**

| Form field | API field | Transformation required |
|---|---|---|
| `partnerCategory` | `service_type` | **Client-side mapping required.** Form display values (e.g. "Pulizie", "Manutenzione") must be mapped to canonical enum values (`cleaning`, `maintenance`, `transfers`, `experiences`, `laundry`) before submission. |
| `serviceArea` | `operating_area` | Direct. Free text string. Note: schema stores this as `operating_areas` (text array); the API accepts a single string and the server wraps it into an array. |
| `businessName` | — | Onboarding context. Not a `User` model field. |
| `businessWebsite` | — | Onboarding context. Not a `User` model field. |
| `businessAddress` | — | Onboarding context. Not a `User` model field. |
| `noticePeriod` | — | Onboarding context. Not a backend field. |
| `urgentRequests` | — | Onboarding context. Not a backend field. |
| `requestChannel` | — | Onboarding context. Not a backend field. |
| `partnerServices` | — | Onboarding context. Not a backend field. |

**Steps 4 and 6 — Not sent to API:**

Steps 4 (review message to applicant) and 6 (review + consent) are onboarding UX only.

---

### `partnerCategory` → `service_type` enum mapping

The form displays human-readable Italian labels. The client must translate to the canonical enum before submitting to the API:

| Form display value | API `service_type` value |
|---|---|
| `Pulizie` / `Cleaning` | `cleaning` |
| `Manutenzione` / `Maintenance` | `maintenance` |
| `Trasferimenti` / `Transfers` | `transfers` |
| `Esperienze` / `Experiences` | `experiences` |
| `Lavanderia` / `Laundry` | `laundry` |

If the form value does not match any known label, the submission should be blocked client-side with a validation error.
