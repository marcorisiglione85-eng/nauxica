# Authentication Strategy

**Version:** 1.2
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Backend authentication and session management
**Last updated:** 2026-06-07
**Related:** [security-model.md](../architecture/security-model.md) · [data-models.md](data-models.md) · [database-schema.md](database-schema.md) · [data-visibility-model.md](../architecture/data-visibility-model.md) · [api/auth.md](../api/auth.md)

> **v1.2 changes (2026-06-07):** Supabase Sprint 1 Blocker Resolution. CB-A: §9.1 extended with explicit clarification that GoTrue manages password storage in `auth.users` and `public.users` is the application profile table only — `public.users` must not contain a `password_hash` column.

> **v1.1 changes (2026-06-05):** §9.2 RLS pattern for child records updated from slug-FK join-through-properties to direct UUID FK. §9.4 slug-FK complexity note removed — no longer applicable. `property_code` note added: not used in RLS; human reference only.

---

## Purpose

This document defines the authentication architecture for the Nauxica backend. It is the implementation reference for auth flows, session management, role boundaries, and Supabase integration design.

**Design source:** Security decisions and threat model are defined in [security-model.md](../architecture/security-model.md). This document translates those decisions into implementation-level specifications for backend and API developers.

---

## 1. Account Model

The Nauxica platform has two public account types:

| Account type | Who | Registration path |
|---|---|---|
| `homeowner` | Property owners and managers | Public registration via platform |
| `partner` | Vetted service providers (cleaning, maintenance, transfers, experiences, laundry) | Public registration via platform |

**No other public account types exist at MVP.** Specifically:

- **Guests** have no platform accounts. Guest identity is established through the WhatsApp session anchor (phone number → active reservation lookup). See §5.
- **AI runtime** is an internal service role operating via API key. It is not a user account and is not registered through the platform. See §6.
- **Nauxica internal administration** is outside the public account model at MVP. There is no operator registration flow, no `operator` value in the `account_type` enum, and no operator dashboard. Internal operational references in the schema (e.g. `escalation_records.assigned_operator_id`, `dispute_records.assigned_operator_id`) are future-facing fields not backed by a public registration path at Sicily launch. See §7.

---

## 2. Homeowner Authentication

### 2.1 Credentials and login

| Parameter | Value |
|---|---|
| Primary method | Email + password |
| Password minimum length | 12 characters |
| Password hashing | Bcrypt or Argon2id. Password is never stored in plaintext or logged. |
| Email verification | Required before account status transitions to `active`. `is_email_verified` must be `true`. |
| Phone verification | SMS OTP required at registration. Italian E.164 format (+39...). `is_phone_verified` must be `true`. |

### 2.2 Session management

| Parameter | Value |
|---|---|
| Access token | Short-lived JWT, 15-minute expiry |
| Refresh token | Long-lived, 30-day expiry, rotated on every use |
| Token delivery | Bearer token in `Authorization` header |
| Refresh behaviour | On use, old refresh token is immediately invalidated; a new refresh token is issued alongside the new access token |
| Session termination | Explicit logout invalidates the current refresh token |

### 2.3 Multi-factor authentication

- Optional at MVP for homeowners.
- Recommended but not enforced.
- Implementation should allow homeowners to enable TOTP-based MFA from their account settings.

### 2.4 Account lockout

| Condition | Action |
|---|---|
| 5 consecutive failed login attempts | 15-minute lockout on that account |
| 10 cumulative failed attempts in a session | Account locked; email unlock flow required |
| Locked account recovery | Time-limited unlock link sent to the verified email address |

### 2.5 Account recovery

- **Password reset:** Email-based magic link, 30-minute expiry. Sent to verified email address only.
- **Secondary recovery:** SMS OTP to verified phone number as a fallback recovery path.

---

## 3. Partner Authentication

Partner accounts use the same authentication mechanism as homeowners (§2.1–2.5) with two additional constraints:

- A partner account with `is_identity_verified = false` cannot accept job requests, even if the account status is `active`. Identity verification is required before first dispatch.
- Partners with `background_check_status != 'approved'` are restricted from Tier-2 jobs. See [partner-vetting.md](../trust-safety/partner-vetting.md).

Session management, MFA, and lockout rules are identical to homeowners.

---

## 4. Shared Authentication Rules

The following rules apply to both `homeowner` and `partner` accounts:

- `account_status` must be `active` to use the platform. Accounts in `pending`, `suspended`, or `closed` states can authenticate to a read-only status view but cannot perform write operations.
- JWT token claims include: `user_id` (UUID), `account_type` (`homeowner` or `partner`), `account_status`, and `is_identity_verified` (relevant for partner dispatch gating).
- The API layer validates token claims on every request. Client-provided role assertions in the request body are ignored.
- Tokens are signed with the platform JWT signing key. Key rotation is on a 180-day schedule with coordinated token invalidation. See [security-model.md](../architecture/security-model.md) §5.

---

## 5. Guest Model (No Account)

Guests have no platform accounts. Guest identity resolution is not authentication in the traditional sense — it is a reservation lookup triggered by an inbound WhatsApp message.

### 5.1 Identity resolution path

```
Inbound WhatsApp message (from guest phone number)
        │
        ▼
Normalise to E.164 format
        │
        ▼
Look up active WhatsAppSession
  (guest_phone = normalised number AND session_status = 'active')
        │
        ├── Session found
        │       → Load reservation context from session
        │       → Serve AI response
        │
        └── No active session
                │
                ▼
          Look up Reservation
            (guest_phone = normalised number
             AND checkin_date <= today <= checkout_date
             AND reservation_status IN ('pre_arrival', 'checked_in'))
                │
                ├── Active reservation found
                │       → Create new WhatsAppSession
                │       → Serve welcome or pre-arrival response
                │
                └── No active reservation
                        → Respond with guest-safe "no reservation found" message
                        → Do not create a session
```

### 5.2 Security properties of the guest model

- WhatsApp phone number ownership is used as a proxy for guest identity.
- No password, no JWT, no registration — the guest interacts only via WhatsApp.
- Access code delivery is gated to the active stay window (session phase), not just to phone number resolution.
- Guest data (name, phone number, document number) is provided by the homeowner at reservation creation. The platform cannot independently verify guest identity.

> ⚠️ **Legal note:** WhatsApp phone number ownership is not a strong identity verification mechanism under GDPR. The guest's identity is asserted by the homeowner, not verified by the platform. See [security-model.md](../architecture/security-model.md) §1.3 and [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) Section B.

### 5.3 Guest and reservation terminology

The frontend uses the term **"Guests"** in operational views (guest dashboard, guest detail pages). The backend canonical entity is a **Reservation**. Guest-labelled views are operational views of `Reservation` records — the guest is not a separate entity with an account. This terminology distinction is intentional:

- `Reservation` is the canonical backend entity and the source of truth for all guest stay data.
- "Guest" as a label in the frontend is acceptable and user-facing-friendly.
- Backend code, API responses, and data models use `reservation` terminology.

---

## 6. AI Runtime Authentication

The AI runtime service is **not a user account**. It operates via a dedicated API key scoped to a restricted permission set.

| Parameter | Value |
|---|---|
| Auth method | API key as Bearer token: `Authorization: Bearer <service_api_key>` |
| Key scope | Restricted to permitted read/write operations only — see below and [security-model.md](../architecture/security-model.md) §3.4 |
| MFA | Not applicable — service-to-service key authentication |
| Key rotation | On any security event; annually at minimum |

**AI runtime permitted operations:**

| Model | Operation | Scope |
|---|---|---|
| `PropertyKnowledgeBlock` | Read | Property in current session only |
| `EmergencyData` | Read | Property in current session only |
| `WhatsAppSession` | Read + Write | Current session only; write is session state updates |
| `Reservation` | Read | Scoped fields: `guest_name`, `checkin_date`, `checkout_date`, `guest_count`, `confirmation_number`, `guest_preferred_language`, `special_requests` |
| `ServiceRequest` | Write | Create new records only; cannot update or delete |
| `EscalationRecord` | Write | Create new records only; cannot update or delete |

All other models are prohibited. Any attempt to access a prohibited model is logged as a `SCOPE_VIOLATION` event. The AI runtime never reads financial data, encrypted sensitive fields, or `User` records.

---

## 7. Internal Administration (Post-MVP)

Internal Nauxica administration is **outside the public account model at MVP**.

- There is no `operator` value in the `account_type` enum.
- There is no operator registration path on the platform.
- There is no operator-facing dashboard in the MVP product.

At Sicily launch, the founder operates the platform directly using database access and internal tooling outside the public platform.

**Schema references:** Fields such as `escalation_records.assigned_operator_id` and `dispute_records.assigned_operator_id` are future-facing internal operational fields. They reference an internal account type that does not yet exist as a public registration flow. At MVP, these fields remain null or are managed via direct database access.

**Post-MVP consideration:** When an internal administration account type is introduced, it must be treated as a separate identity domain from public homeowner/partner accounts. The security requirements for internal administration — mandatory MFA, shorter session tokens (8-hour max), enhanced audit logging, and elevated data access — are documented in [security-model.md](../architecture/security-model.md) §1.2 and §3.3 for future reference.

---

## 8. API Authentication

All API communication between clients and the backend uses Bearer token authentication:

```http
Authorization: Bearer <access_token>
```

Service-to-service communication (AI runtime → backend) uses dedicated API keys with the same Bearer format.

Webhook ingestion (WhatsApp Business API inbound messages, OTA calendar providers) uses HMAC-SHA256 signature verification. Webhooks that fail signature verification are rejected before any payload is processed. See [security-model.md](../architecture/security-model.md) §6.

---

## 9. Supabase Implementation Assumptions

These assumptions should be reviewed against the Supabase Auth configuration before implementation begins. No Supabase-specific code is defined here — this section documents intended patterns only.

### 9.1 Supabase Auth (GoTrue)

**Recommended approach:** Use Supabase Auth (GoTrue) natively for homeowner and partner session management. Extend JWT tokens with custom claims to carry platform-specific fields (`account_type`, `account_status`).

**Rationale:** GoTrue handles token issuance, refresh rotation, and session management. Custom JWT claims allow RLS policies to access role and status without a database roundtrip, reducing policy complexity.

**Alternative (hybrid):** If GoTrue's claim extensibility is insufficient, a server-side middleware layer can inject additional claims after GoTrue issues the base token. This adds operational complexity and should only be used if native claims cannot satisfy requirements.

**Avoid:** Building a fully custom JWT layer that bypasses Supabase Auth entirely. The security parameters in `security-model.md` (15-minute access tokens, 30-day refresh, rotation on use) can be approximated via Supabase Auth configuration and should not require a custom implementation.

**`public.users` profile table:** GoTrue stores all password-related data (hashed credentials, password reset tokens, email confirmation tokens) in `auth.users`, which is Supabase-managed and not directly accessible via the application API. The `public.users` table is the application profile table only — it contains platform-specific metadata such as `account_type`, `account_status`, `full_name`, `phone_number`, and partner-specific fields. It must not contain a `password_hash` column. Any credential management operation (login, password reset, verification) must go through the GoTrue API, not through `public.users` writes.

### 9.2 RLS design patterns

Supabase RLS policies use `auth.uid()` to identify the authenticated user. The following patterns apply at MVP:

**User's own record:**
```sql
USING (id = auth.uid())
```

**Homeowner-owned properties:**
```sql
USING (owner_id = auth.uid())
```

**Child records via UUID FK:**
All child tables FK to `properties.id` (UUID). RLS policies on child tables scope access via the owner relationship on `properties`:

```sql
-- Pattern for all child tables (reservations, service_requests, tasks, etc.)
USING (
  property_id IN (
    SELECT id FROM properties WHERE owner_id = auth.uid()
  )
)
```

This pattern applies to all tables using `property_id` as a UUID FK: `reservations`, `service_requests`, `partner_requests`, `tasks`, `partner_assignments`, `property_knowledge_blocks`, `emergency_data`, `guest_stay_contexts`, `whatsapp_sessions`, `escalation_records`, `dispute_records`.

`property_code` is not used in RLS. It is a human-readable reference for display, support, search, and communication only.

**Partner-owned records:**
```sql
-- partner_assignments and partner_requests
USING (partner_id = auth.uid())
```

**account_type filtering:**
Include `account_type` in JWT claims to gate account-type-specific operations without a users table lookup:

```sql
-- Only homeowners can insert properties
WITH CHECK (
  (auth.jwt() ->> 'account_type') = 'homeowner'
  AND owner_id = auth.uid()
)
```

### 9.3 Guest access and RLS

Guests do not authenticate via Supabase Auth. All guest interactions pass through the AI runtime service key. The AI runtime's service key bypasses row-level security (or operates under a role with defined read permissions). The AI runtime's own application-layer access controls enforce guest data boundaries — Supabase RLS is not the enforcement mechanism for guest access.

### 9.4 RLS implementation status

RLS implementation is explicitly deferred to post-MVP. See [database-schema.md](database-schema.md) §1: "Visibility scopes are enforced by the API layer... not enforced by database-level row security at MVP."

When RLS is implemented, all child table policies use the UUID FK pattern documented in §9.2. Each policy must be individually tested with both homeowner and partner JWT contexts before deployment.

---

## 10. Related Documents

- [security-model.md](../architecture/security-model.md) — Security architecture and threat model (source of auth design decisions)
- [data-models.md](data-models.md) — User model, account_type field, and account lifecycle
- [database-schema.md](database-schema.md) — users table schema, constraints, and enum definitions
- [data-visibility-model.md](../architecture/data-visibility-model.md) — Visibility scope taxonomy governing API-layer data access
- [api/auth.md](../api/auth.md) — API endpoint specifications for login, refresh, and logout flows
- [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) — GDPR and Italian law obligations relevant to authentication data
- [partner-vetting.md](../trust-safety/partner-vetting.md) — Partner identity verification requirements
