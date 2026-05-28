# Security Model

**Version:** 1.0
**Status:** Complete — Architecture phase
**Scope:** Sicily launch · Platform-wide security architecture
**Last updated:** 2026-05-28
**Related:** [data-visibility-model.md](data-visibility-model.md) · [data-models.md](../backend/data-models.md) · [ai-runtime-orchestration.md](../ai-runtime/ai-runtime-orchestration.md) · [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md) · [event-driven-architecture.md](event-driven-architecture.md) · [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md)

---

## Purpose

This document defines the security architecture for the Nauxica platform: authentication, authorisation, access boundaries, secret management, encryption, and incident response assumptions.

**Design philosophy:** Security controls should be structural where possible — enforced by the architecture, not by human discipline or prompt-level instructions. A developer building on this architecture should have to actively break a rule to create a security incident; the default path should be the secure path.

**MVP scope:** This is a security architecture for a small-team, founder-operated platform at Sicily launch. It avoids enterprise overengineering while ensuring that the security properties essential to the platform's integrity are in place before the first guest arrives. Post-scale requirements are noted but not designed in full.

---

## 1. Authentication Model

### 1.1 Homeowner and partner authentication

| Method | Detail |
|---|---|
| Primary authentication | Email + password |
| Password requirements | Minimum 12 characters; bcrypt or Argon2id hashing (never stored in plaintext) |
| Session management | Short-lived JWT access token (15-minute expiry) + long-lived refresh token (30-day expiry, rotated on use) |
| Email verification | Required before account is active |
| Phone verification | SMS OTP required at registration; used for account recovery |
| Multi-factor authentication | Optional at MVP for homeowners; recommended but not enforced |
| Account lockout | 5 failed attempts → 15-minute lockout; 10 cumulative failed attempts → account locked, email unlock required |

### 1.2 Operator authentication

| Method | Detail |
|---|---|
| Primary authentication | Email + password (same as homeowner/partner) |
| MFA | **Required** for all operator accounts — no exceptions |
| Session duration | Shorter session tokens (8 hours max) |
| Access level | Operator role grants elevated permissions — see Section 3 |
| Shared accounts | Prohibited — each operator must have a unique credential |

### 1.3 Guest authentication

Guests have no accounts on the Nauxica platform. Guest identity is established through the WhatsApp session anchor:
- Phone number → reservation lookup
- No password, no login, no token

The security model for guest interactions relies on:
- E.164 phone number verification (WhatsApp number ownership implies control of that number)
- Reservation date range gating (the session is only active for the relevant stay window)
- Access code delivery gating (credentials only delivered within the active window)

> ⚠️ **Legal note:** WhatsApp phone number ownership is not a strong identity verification mechanism under GDPR. The guest's identity is asserted by the homeowner at reservation creation — the guest's phone number is provided by the homeowner, not verified by the platform. This is consistent with the WhatsApp-only, no-account guest model, but means the platform cannot make strong identity claims about guests. See [regulatory-compliance-checklist.md](../legal/regulatory-compliance-checklist.md) Section B.

### 1.4 API authentication

All API endpoints (backend ↔ frontend, backend ↔ AI runtime, backend ↔ external services) use:
- **Internal service communication:** API keys scoped to specific service permissions (see Section 5)
- **Client ↔ backend:** Bearer token (JWT) in Authorization header
- **Webhook ingestion:** HMAC signature verification (see Section 7)

---

## 2. Role Scopes

Four roles exist on the platform. Each role has a defined permission boundary.

| Role | Who | Dashboard access | API access | Data access |
|---|---|---|---|---|
| `homeowner` | Property owners and managers | Homeowner dashboard | Homeowner API endpoints only | Their own properties, reservations, partner assignments |
| `partner` | Service partners | Partner dashboard | Partner API endpoints only | Their own assignments and job requests |
| `operator` | Nauxica team (founder + staff) | Full platform dashboard | All API endpoints | All data (see Section 3 for limits) |
| `ai_runtime` | AI orchestration service | None (internal service) | Restricted write API only | PropertyKnowledgeBlock, EmergencyData (read), WhatsAppSession (read/write), ServiceRequest (create), EscalationRecord (create) |

**No guest role.** Guests interact only through the WhatsApp channel. They have no platform account, no API access, and no direct data access.

---

## 3. Access Boundaries by Role

### 3.1 Homeowner access boundary

A homeowner can only access:
- Their own `User` record
- Their own `Property` records
- `Reservation` records linked to their properties
- `PartnerAssignment` records for their properties
- `ServiceRequest` records for their properties
- `PartnerRequest` records for their properties (read-only view)
- `WhatsAppSession` history for their properties (read-only)
- `EscalationRecord` summaries for their properties (status only — not full operator notes)

A homeowner cannot access:
- Another homeowner's data (enforced at API layer — all queries filtered by `owner_id = authenticated_user_id`)
- Partner identity details beyond name and public profile
- AI runtime internals
- Platform-wide metrics
- Other guests' data

### 3.2 Partner access boundary

A partner can only access:
- Their own `User` record
- `PartnerAssignment` records they are assigned to
- `PartnerRequest` records sent to them (within their response window or accepted)
- The `Partner Brief` — a scoped subset of property data — only after accepting a specific job
- Their own job history and review records

A partner cannot access:
- Property records beyond the Partner Brief for their active job
- Other partners' assignments or job history
- Homeowner personal details beyond the emergency contact in the Partner Brief
- Guest identity or reservation details beyond the specific stay their job relates to
- Financial data (commission rates, homeowner revenue)

**The Partner Brief is the only property data a partner ever receives.** The full Property record is never exposed to partners. This is enforced at the API layer: the endpoint that serves the Partner Brief explicitly excludes all INTERNAL and GUEST-scoped fields.

### 3.3 Operator access boundary

Operators have broad access for operational purposes. However:
- Operators cannot modify encrypted sensitive fields (codice_fiscale, guest document numbers) — they can view the fact that a field is present but not its plaintext value
- All operator actions are audit-logged with the operator's user ID and a reason where applicable
- Admin override actions (forcing state transitions, manual escalation resolution) are logged as `operator_override` events in the audit trail

**Admin override rules:**
- No state can be set to a terminal state (VERIFIED, ARCHIVED) without logging
- No property can be activated without the activation checklist passing
- No partner can be approved without a completed vetting record
- Any data deletion (account closure, GDPR erasure request) requires operator ID + written reason logged

### 3.4 AI runtime access boundary

The AI runtime service uses a dedicated API key that is scoped to a minimal permission set. This is enforced at the API key level, not by application logic.

**AI runtime permitted operations:**
- Read: `PropertyKnowledgeBlock` (for the specific property in the current session)
- Read: `EmergencyData` (for the specific property in the current session)
- Read: `WhatsAppSession` (for the current session only)
- Read: `Reservation` (scoped fields only — guest_name, checkin_date, checkout_date, guest_count, confirmation_number — not document numbers or financial data)
- Write: `WhatsAppSession` (session state updates only)
- Write: `ServiceRequest` (create new requests only — cannot update or delete)
- Write: `EscalationRecord` (create new records only — cannot update or delete)

**AI runtime prohibited operations (enforced at the Action Executor level, not just by prompt):**
- Read or write `Property` records
- Read or write `User` records
- Read or write `PartnerAssignment` records
- Read or write `Reservation` fields outside the scoped list above
- Delete any record
- Access any financial data
- Access any encrypted sensitive fields

A `SCOPE_VIOLATION` event is logged when the AI runtime attempts a prohibited operation. The Action Executor returns an error to the AI model.

---

## 4. KBB Isolation

The Knowledge Block Builder is a transformation service, not a raw database proxy. Its isolation properties are critical to guest data safety.

### 4.1 What the KBB does not expose

The KBB applies scope filtering before returning any content to the AI runtime. The following fields are structurally excluded from any `PropertyKnowledgeBlock` output:

- Owner personal phone number
- Owner codice_fiscale or Partita IVA
- Partner names, phone numbers, or company names
- Partner access codes for any service type
- Cleaning or partner operational notes (PARTNER-scoped fields)
- Internal operator notes
- Financial data
- Guest document numbers from any reservation
- Other guests' data

These exclusions are implemented at the KBB scope filter (Step 1 of KBB pipeline), not in the AI system prompt. A prompt instruction saying "do not mention X" is insufficient — the field must not enter the AI's context at all.

### 4.2 Access code gating is structural

Access credentials (WiFi passwords, lockbox codes, smart lock PINs) are replaced with sentinel values outside their delivery window at the KBB level. The AI model receives `[not yet available]` — it is not possible for the AI to deliver a credential before the gate opens, because the credential is not in the context window.

---

## 5. Secret Management

### 5.1 What constitutes a secret

| Secret type | Examples |
|---|---|
| Service API keys | WhatsApp Business API key, LLM API key, SMS provider key |
| Database credentials | PostgreSQL connection string with credentials |
| JWT signing key | Used to sign and verify all platform tokens |
| HMAC webhook secrets | Per-webhook shared secret for signature verification |
| Internal service API keys | AI runtime ↔ backend, KBB ↔ backend |
| Encryption keys | For encrypting sensitive fields at rest |

### 5.2 Secret storage rules

- Secrets are stored in an environment variable manager or secrets vault — never in source code, git repositories, or configuration files checked into version control
- Each environment (development, staging, production) has separate secrets — production secrets are never used in development
- Secrets have defined rotation schedules:
  - Database credentials: rotated every 90 days
  - External service API keys: rotated on any security event and annually
  - JWT signing key: rotated every 180 days (requires coordinated token invalidation)
  - Encryption keys: rotated annually; old key retained for decryption of historical data

### 5.3 Principle of least privilege for API keys

Each internal service receives an API key with the minimum permissions needed. The AI runtime key cannot read homeowner financial data. The notification service key cannot write to Reservation records. Keys are named and scoped explicitly.

**At MVP:** The founder manages all production secrets. Before any team member is given production access, a secrets management rotation must be documented.

---

## 6. Webhook Verification

The platform receives webhooks from WhatsApp Business API (inbound messages) and any connected OTA calendars. All inbound webhooks must be verified before processing.

### 6.1 WhatsApp webhook verification

Meta's WhatsApp Business API uses HMAC-SHA256 signature verification:

1. Meta sends an `X-Hub-Signature-256` header with each webhook payload
2. The platform recomputes the HMAC using the shared webhook secret
3. If the signatures match: process the payload
4. If the signatures do not match: reject (HTTP 401) and log the failed verification

**Any webhook that fails signature verification is rejected entirely.** Do not process partial data from an unverified webhook.

### 6.2 Replay attack prevention

Webhook payloads include a timestamp. Any webhook with a timestamp older than 5 minutes is rejected as a potential replay attack.

### 6.3 OTA calendar webhook verification

OTA providers use different verification mechanisms. Each OTA integration must document its specific verification approach before deployment. An OTA integration without webhook verification is not acceptable for production.

---

## 7. WhatsApp Security Assumptions

The WhatsApp channel has specific security properties the platform relies on:

| Assumption | Basis | Risk if violated |
|---|---|---|
| Phone number ownership = identity | WhatsApp ties accounts to verified phone numbers | SIM swapping or phone transfer could allow an attacker to impersonate a guest |
| Message confidentiality | WhatsApp end-to-end encryption (guest ↔ WhatsApp ↔ Meta) | Trust is in Meta's encryption implementation |
| Message integrity | WhatsApp API signatures on inbound webhooks | Covered by webhook verification (Section 6) |
| Guest cannot inject system prompt | Inbound message is user-turn content only | Prompt injection via message body (see ai-runtime-orchestration.md Open Risks) |

**SIM swap risk:** If a malicious actor acquires a guest's SIM and messages the AI, they could receive the guest's access codes within the delivery window. This is a known limitation of phone-number-as-identity. Mitigation: the access code delivery window is narrow (check-in day through checkout day), and codes are rotated after use where possible.

---

## 8. Encryption Assumptions

### 8.1 Encryption in transit

All communications use TLS 1.2 minimum, TLS 1.3 preferred:
- Browser ↔ platform (HTTPS)
- Backend ↔ database
- Backend ↔ external services (WhatsApp API, LLM API, SMS provider)
- Internal service communication (AI runtime ↔ backend)

No plaintext communication between any platform components.

### 8.2 Encryption at rest

The following fields are encrypted at rest using application-level encryption (not just filesystem or database encryption):

| Field | Location | Reason |
|---|---|---|
| `codice_fiscale_or_piva` | User model | Tax ID — personal data under GDPR |
| `guest_document_number` | Reservation model | Identity document number — sensitive personal data; required for Alloggiati Web |
| `password_hash` | User model | Already hashed; additional encryption provides defence-in-depth |
| Access codes (partner and guest) | Property model | Property security credentials |
| `id_document_url` | User model (partner) | Link to identity document image |
| `insurance_document_url` | User model (partner) | Business document |

> ⚠️ **Legal note:** The specific fields subject to enhanced encryption, and the key management approach, should be reviewed with legal counsel against GDPR Article 32 requirements (appropriate technical security measures) before implementation.

### 8.3 What is not encrypted at rest (beyond standard database protection)

Non-sensitive operational data (property names, check-in dates, service types, timestamps) is stored without additional application-level encryption. Standard database access controls (credentials, network access restriction) provide adequate protection for this data class.

---

## 9. Audit Logging

The audit log is a central security control. It records who did what, when, to which entity.

### 9.1 What is logged

| Category | Examples |
|---|---|
| Authentication events | Login success/failure, MFA events, account lockout, password change |
| Data access (operator) | Any operator read of sensitive data fields, GDPR erasure requests |
| State transitions | Property activation, partner suspension, escalation creation/resolution |
| Admin overrides | Any `operator_override` event |
| AI runtime scope violations | SCOPE_VIOLATION events from the Action Executor |
| Webhook verifications | Both successful and failed verifications |
| Access code delivery | Every delivery event, to which role, via which mechanism |
| Failed write attempts | Any attempt to write outside permitted models |

### 9.2 Audit log integrity

The audit log is append-only:
- No record can be deleted or modified after creation
- The log is stored in a separate persistence layer from the main application database
- Log access is restricted to operators only; the AI runtime cannot read or write the audit log

### 9.3 Retention

Audit logs are retained for a minimum of 3 years. This supports:
- GDPR compliance (Article 5(2) accountability principle)
- Insurance and dispute evidence
- Regulatory inspection

---

## 10. Cache Security

Three caches are operated by the AI runtime and KBB (defined in [knowledge-retrieval-model.md](../ai-concierge/knowledge-retrieval-model.md)):

| Cache | Data | Security requirement |
|---|---|---|
| Session cache (240s TTL) | WhatsAppSession state | Scoped per session_id — one session cannot read another's cache entry |
| Property cache (300–3600s TTL) | PropertyKnowledgeBlock | Scoped per property_id. Cached blocks must not contain INTERNAL or PTR scoped data. |
| Emergency cache (600s + write-through) | EmergencyData | Must be invalidated immediately on any emergency data update — write-through, not TTL |

**Cache isolation rule:** Cache keys must include the scoping identifier (session_id or property_id). A cache lookup for session A must be impossible to satisfy with a cached block from session B. This is enforced by key namespacing in the cache layer.

**Cache poisoning prevention:** Cache entries are populated only from the KBB transformation pipeline — never from unvalidated external input. A cache write is only triggered by a successful KBB assembly, not by any API endpoint.

---

## 11. Partner Access Boundaries (Detailed)

Access code delivery to partners follows strict rules defined in [partner-assignment-model.md](../architecture/partner-assignment-model.md) Section 7. Security properties:

- Access codes are delivered at job confirmation time only — not at assignment time
- Each delivery event is logged in the `AccessCodeDeliveryLog`
- Access codes are sent via in-platform message — not via SMS, email, or WhatsApp (which might be forwarded)
- The delivery log records: partner_id, partner_request_id, code_type, delivery_timestamp

**What partners must not receive:**
- Homeowner bank details or financial information
- Full guest identity information (only the guest name for the specific stay their job relates to)
- Other partners' access codes or assignments
- Internal operator notes

These exclusions are enforced by the Partner Brief API endpoint's field selection — it explicitly builds the response from a whitelist of permitted fields, not from a blacklist of prohibited ones.

---

## 12. Guest Access Boundaries

Guests access platform data only through the AI concierge WhatsApp channel. The data they can receive is limited to:

- Property display name and description
- Entry instructions and access codes (within delivery window)
- WiFi credentials (within delivery window)
- House rules and amenities
- Check-in and checkout times
- Tourist tax information
- Local area recommendations
- Emergency numbers and owner emergency contact
- Service request status (their own requests only)

Guests can never receive:
- Another guest's data
- Owner personal details beyond the designated emergency contact
- Partner identity or contact details
- Property owner financial data
- Internal notes
- Access codes outside the delivery window

These limits are enforced structurally by the KBB scope filter, not by prompt instruction.

---

## 13. GDPR-Aligned Principles

> ⚠️ **Legal review required.** The following principles are architectural design choices aligned with GDPR intent. They must be reviewed by legal counsel against specific GDPR Articles and Italian D.Lgs. 196/2003 requirements before deployment.

| Principle | Implementation |
|---|---|
| Data minimisation | Only data required for the stated purpose is collected. Guest document numbers are collected for Alloggiati Web compliance only — not retained for longer than required. |
| Purpose limitation | Data collected for one purpose (e.g. Alloggiati Web) is not used for another (e.g. marketing). |
| Storage limitation | Retention schedules must be defined and enforced for all personal data. Guest data should be deleted or anonymised after the retention period ends. |
| Integrity and confidentiality | Encryption at rest and in transit for sensitive fields. Access controls enforced at API and application layer. |
| Accountability | Audit log provides complete record of who accessed what data and when. |
| Right of access / erasure | A process must exist for homeowners and partners to request their data and request erasure. Erasure requests must be logged as operator actions. |
| Consent | Guest WhatsApp interactions require a consent disclosure. Homeowner registration requires explicit acceptance of privacy policy. |
| Third-party processors | WhatsApp (Meta) and the LLM provider are data processors. Data processing agreements must be in place before launch. |

### 13.1 Personal data inventory (summary)

| Data category | Legal basis | Retention |
|---|---|---|
| Homeowner identity (name, email, phone, tax ID) | Contract performance | Duration of account + applicable legal minimum |
| Partner identity and vetting documents | Contract performance + legal obligation | Duration of active status + 5 years (insurance evidence) |
| Guest identity (name, phone, nationality, document) | Legal obligation (Alloggiati Web) + contract performance | Alloggiati Web retention period (consult legal) |
| WhatsApp session logs | Legitimate interest (dispute resolution, safety) | Recommended: 90 days post-checkout (per whatsapp-session-anchor.md) |
| Audit logs | Legal obligation + legitimate interest | 3 years minimum |
| Completion photos | Contract performance + legitimate interest (dispute) | Retained with job record; deletion schedule TBD |

---

## 14. Incident Logging

Security incidents are logged to the audit log with category `security_incident`:

| Incident type | Logged fields |
|---|---|
| Authentication failure (brute force threshold) | user_id (if known), IP, attempt count, lockout triggered |
| Failed webhook verification | Source IP, payload hash, timestamp, reason |
| SCOPE_VIOLATION (AI runtime) | session_id, operation_attempted, ai_message_context (truncated) |
| Unauthorised data access attempt | user_id, endpoint attempted, data requested |
| Account takeover attempt (unusual login location/device) | user_id, IP, device fingerprint, action taken |
| Personal data accessed by operator | operator_id, data category, entity accessed, reason |
| GDPR erasure request | user_id, request timestamp, operator who processed it |

---

## 15. Breach Response Assumptions

> ⚠️ **Legal review required.** GDPR Article 33 requires notification to the supervisory authority (Garante per la protezione dei dati personali) within 72 hours of becoming aware of a personal data breach. Article 34 may require notification to affected individuals. The following is an architectural framework; a full incident response plan must be developed with legal counsel before the platform handles any personal data.

### 15.1 What constitutes a reportable breach

A personal data breach that is likely to result in a risk to the rights and freedoms of natural persons. Examples:
- Unauthorised access to guest document numbers or homeowner tax IDs
- Accidental exposure of personal data to wrong recipients
- Loss or destruction of personal data beyond recovery
- Exposure of access codes enabling unauthorised property access

### 15.2 Immediate response actions

On discovery of a potential breach:
1. Contain: immediately revoke the compromised credentials or access path
2. Assess: determine what data was accessed, by whom, and for how long
3. Log: document every discovery and action in the security incident log
4. Escalate: the founder is notified of any potential breach immediately, regardless of hour
5. Legal: contact legal counsel within 24 hours
6. Notify: if a breach is confirmed and reportable, the Garante must be notified within 72 hours of awareness

### 15.3 Post-breach

- Full audit log review of the affected time period
- Credential rotation for all potentially compromised secrets
- Review of the access control failure that allowed the breach
- Update to this security model if architectural changes are required

---

## 16. MVP Security Checklist

Before the first property goes live:

- [ ] All production secrets stored in environment vault — not in code or config files
- [ ] WhatsApp webhook signature verification implemented and tested
- [ ] JWT access and refresh token flow implemented with rotation
- [ ] Operator MFA enforced
- [ ] AI runtime API key scoped to permitted operations only — Action Executor tested for rejection of prohibited operations
- [ ] KBB scope filter tested: INTERNAL fields must not appear in any PropertyKnowledgeBlock output
- [ ] Access code gating tested: sentinel values confirmed outside delivery window
- [ ] Audit log append-only store in place
- [ ] Encrypted fields at rest implemented for the fields listed in Section 8.2
- [ ] TLS enforced across all communications
- [ ] GDPR data processing agreements signed with WhatsApp (Meta) and LLM provider
- [ ] Homeowner privacy policy and terms of service explicitly accepted at registration
- [ ] Partner vetting documents stored in access-controlled storage — not publicly accessible URLs
- [ ] Breach response contact (legal counsel) identified and on file
