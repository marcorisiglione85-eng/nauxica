# Backend Agent Scope

**Version:** 1.0
**Applies to:** Claude Code agents working on backend design, API architecture, database models, or AI runtime architecture
**Prerequisite:** Read [claude-code-master-rules.md](claude-code-master-rules.md) first
**Last updated:** 2026-05-28

---

## Current Status: Design Phase Only

**There is no backend code in this project.**

The Nauxica platform is currently a frontend prototype. All state is managed via localStorage. Backend implementation has not yet begun.

Backend agents at this stage are **architecture and design agents**, not implementation agents. Their work product is documentation — not code.

**Backend agents do not write:**
- Server-side code (Node.js, Python, Go, or any other language)
- SQL schemas or migration files
- API endpoint implementations
- Docker or deployment configuration
- Environment variable files
- Authentication middleware
- Database connection code

All of the above are deferred until the frontend prototype is stable and architecture documentation is approved. See [phase-control-log.md](phase-control-log.md) for current phase status.

---

## What Backend Agents Do Now

Backend agents work exclusively on architecture documentation in `docs/`.

**Current backend agent tasks may include:**
- Updating or extending existing architecture documents
- Reviewing existing documents for internal consistency
- Adding detail to data models, API contracts, or event definitions
- Identifying gaps in existing documentation
- Proposing new architecture documents (requires pre-approval before creation)

All work must follow the [docs-agent-scope.md](docs-agent-scope.md) rules in addition to the backend-specific rules in this document.

---

## Architecture Documents as Source of Truth

Before proposing any backend design decision, read the relevant existing documents. The architecture documents are the source of truth — not general best practices, not the agent's preferred stack.

**Required reading for any backend design task:**

| Topic | Document |
|---|---|
| Data models | `docs/backend/data-models.md` |
| API overview | `docs/api/api-overview.md` |
| Authentication | `docs/backend/auth-strategy.md` |
| Data visibility scoping | `docs/architecture/data-visibility-model.md` |
| Security model | `docs/architecture/security-model.md` |
| Event system | `docs/architecture/event-driven-architecture.md` |
| AI runtime | `docs/ai-runtime/ai-runtime-orchestration.md` |
| Knowledge retrieval | `docs/ai-concierge/knowledge-retrieval-model.md` |
| Partner assignments | `docs/architecture/partner-assignment-model.md` |
| Service request flow | `docs/operations/service-request-flow.md` |

A backend agent must not contradict a decision already documented in these files without first flagging the conflict, explaining why it should be revisited, and receiving explicit approval to revise the document.

---

## Database Model Constraints

When working on data models, apply these constraints without exception:

**1. Visibility scoping is non-negotiable.**
Every field must have a visibility scope assignment from the 4-scope model:
- `PUB` — public, pre-authentication
- `GST` — guest-only, confirmed guest via AI concierge
- `PTR` — partner-only
- `INT` — internal, homeowner/operator only

Fields with no scope assignment default to `INT`. This default is intentional and must not be changed.

**2. No field is AI-accessible unless explicitly marked.**
The AI concierge reads only `PropertyKnowledgeBlock`, `EmergencyData` (pre-loaded), `Reservation` (scoped fields), and `WhatsAppSession`. No other model is readable by the AI runtime. Adding AI read access to any other model requires explicit approval and security review.

**3. Sensitive fields require encryption at rest.**
The following field types require application-level encryption at rest (see `docs/architecture/security-model.md` Section 8.2):
- Tax identification numbers (codice_fiscale, P.IVA)
- Guest document numbers
- Access codes (partner and guest)
- Identity document file URLs

Do not add new sensitive fields without flagging them for encryption review.

**4. Guest identity is asserted by homeowners, not verified by the platform.**
Guests have no accounts. Their identity on the platform is established solely by the phone number entered by the homeowner at reservation creation. Do not design authentication flows for guests.

**5. Model renames require explicit approval.**
The `Booking → Reservation` rename documented in `data-models.md` is the authoritative naming. Do not revert this. Do not rename models without flagging and approving the change.

---

## Authentication and Authorisation Constraints

**Authentication model is defined.** See `docs/backend/auth-strategy.md` and `docs/architecture/security-model.md`. Do not propose alternative authentication approaches without reading these first.

Key constraints to respect:
- JWT access token (15-minute expiry) + refresh token (30-day expiry, rotated on use)
- Operator accounts require MFA — this is non-negotiable
- Guests have no accounts and no authentication tokens
- API keys for internal services must be scoped to minimum permissions
- The AI runtime API key is scoped to exactly 3 writable models: `WhatsAppSession`, `ServiceRequest`, `EscalationRecord`

**Any proposed change to the auth model requires flagging the security model impact first.**

---

## AI Runtime Constraints

The AI runtime is not a general-purpose AI agent. It has a defined permission boundary documented in `docs/ai-runtime/ai-runtime-orchestration.md`.

**Backend agents must not propose changes that:**
- Give the AI runtime write access to additional models
- Give the AI runtime direct database access (it must go through the Action Executor service)
- Allow the AI to bypass the KBB scope filter
- Bypass access code gating logic
- Enable AI-to-AI calls without operator visibility

The AI runtime's permission boundary is a security property, not a convenience setting.

---

## Event System Constraints

The event system is defined in `docs/architecture/event-driven-architecture.md`. New events must:

**Follow the naming convention:**
```
[domain].[EntityType].[PastTenseVerb]
```

**Carry a complete `EventEnvelope`:**
- `event_id` (UUID for deduplication)
- `event_type` (dotted name)
- `schema_version`
- `emitted_at` (ISO 8601 UTC)
- `emitted_by`
- `correlation_id`
- `causation_id` (nullable)
- `payload`

**Never name events as commands:**
- Correct: `service_request.ServiceRequest.Completed`
- Wrong: `CompleteServiceRequest`

Proposed new events must be added to the event catalogue in `event-driven-architecture.md`, not silently introduced in an implementation file.

---

## API Design Constraints

API endpoints are documented in `docs/api/`. When designing new endpoints:

**Role-based access is mandatory:**
- Every endpoint must have a defined role requirement (`homeowner`, `partner`, `operator`, `ai_runtime`)
- No endpoint is accessible to all roles by default
- Guest role does not exist — guests never call the API directly

**The Partner Brief is a whitelist, not a blacklist:**
When designing partner-facing API endpoints that return property data, build the response from an explicit whitelist of permitted fields. Do not return a full property record and attempt to filter sensitive fields. The whitelist approach is specified in `docs/architecture/security-model.md` Section 11.

**No endpoint returns INTERNAL-scoped data to non-operator callers:**
The data visibility model in `docs/architecture/data-visibility-model.md` is the authoritative rule for what each role can receive. Enforce it at the API layer, not just the model layer.

---

## What Happens Before Writing Any Backend Code

Before any backend code is written (which is not permitted at this phase anyway), the following must be complete and approved:

1. Frontend prototype is stable (all navigation works, all major flows testable)
2. All architecture documents in `docs/` are internally consistent
3. A formal backend implementation plan has been approved
4. The tech stack decision has been made and documented
5. Database schema design is approved by a human reviewer
6. Security model has been reviewed by legal counsel (specifically: GDPR data processor agreements)

**Do not begin backend code until all of the above are confirmed in `phase-control-log.md`.**

---

## Backend Agent Quick Reference

```
PHASE STATUS: Design/Documentation only
No backend code permitted.

WHAT YOU CAN DO:
✓ Read and extend architecture docs
✓ Identify gaps and inconsistencies
✓ Propose new architecture documents (pre-approval required)
✓ Document data model fields and relationships

WHAT YOU CANNOT DO:
✗ Write server-side code of any kind
✗ Write SQL or migration files
✗ Contradict existing architecture without flagging
✗ Add AI runtime write permissions beyond the 3 permitted models
✗ Design guest authentication (guests have no accounts)
✗ Rename localStorage keys or frontend data structures
✗ Touch any HTML, CSS, or JavaScript files
```
