# Backend Agent Scope

**Version:** 2.0
**Status:** Active
**Scope:** Sicily launch · Agents performing backend design, schema work, Edge Function implementation, or API architecture tasks
**Last updated:** 2026-08-10
**Related:** [claude-code-master-rules.md](claude-code-master-rules.md) · [docs-agent-scope.md](docs-agent-scope.md) · [agent-task-protocol.md](agent-task-protocol.md) · [../architecture/current-state.md](../architecture/current-state.md) · [../architecture/security-model.md](../architecture/security-model.md) · [../architecture/rbac.md](../architecture/rbac.md) · [../architecture/task-workspace.md](../architecture/task-workspace.md)

---

## 1. What This Document Is

Nauxica is a production-backed hospitality operations SaaS running against a live Supabase instance — Postgres with Row Level Security, GoTrue Auth, Supabase Storage, and Edge Functions (Deno / TypeScript). It is not a prototype. Applied migrations, live user accounts, and production RLS policies are in place.

Backend work is governed by the four-role agent workflow: Architect, Implementer, Reviewer, and Security/Supabase. This document defines what backend work means at each role boundary. It covers database migrations, Edge Functions, RLS policies, and API design constraints.

For execution rules and role permission tables, `CLAUDE.md` and `docs/agent-ops/claude-code-master-rules.md` are the authoritative sources. This document does not restate those rules — it references them and adds backend-specific guidance.

---

## 2. What Backend Agents Do Today

### Role permission table — backend layer

| Role | May read backend files | May write backend files | May deploy to production |
|---|---|---|---|
| **Architect** | Yes — all files, including migrations and Edge Functions | No | No |
| **Implementer** | Yes — all files | Yes — approved sprint list only. New migration files in `supabase/migrations/`. Edge Function files when explicitly approved. | No |
| **Reviewer** | Yes — all files | No | No |
| **Security/Supabase** | Yes — migrations, Edge Functions, architecture docs, RLS policies | No | No |

### Key facts at each boundary

**Architect:**
- Reads existing migrations, schema, and architecture documents to produce accurate sprint plans
- Produces migration file content and Edge Function code for Implementer to write — does not write files itself
- Flags any migration that will require Security/Supabase review before production deployment

**Implementer:**
- Writes new migration files in `supabase/migrations/` when explicitly listed in an approved sprint plan
- Never modifies an applied migration — applied migrations are immutable
- Writes or updates Edge Function files (in `supabase/functions/`) when explicitly approved
- Does not run `supabase db push` or `supabase functions deploy` — these are human-controlled operations

**Reviewer:**
- Reads the Implementer's output (migration files, Edge Function code, updated frontend files) and produces a findings report
- Does not silently fix its own findings — findings go to the handoff report for human decision

**Security/Supabase:**
- Reviews any migration or Edge Function that touches Auth triggers, RLS policies, SECURITY DEFINER functions, storage policies, or database triggers before it is applied to production
- Security/Supabase review is a required gate — not optional — for these change types
- Does not apply changes itself — the human controls `supabase db push` and `supabase functions deploy`

For the complete role permission table and workflow sequence, see `CLAUDE.md` "Engineering workflow" and `docs/agent-ops/claude-code-master-rules.md` Rule 17.

---

## 3. Mandatory Reading

Before working on any backend task, read the relevant documents from this table. Consult the authoritative sources for current platform state; do not rely on memory from prior sessions.

### Authoritative (production-era) documents

| Topic | Document |
|---|---|
| Platform status — what is built, what is deployed, what is not built | `docs/architecture/current-state.md` |
| Database schema evolution — canonical and chronological | `supabase/migrations/` directory |
| Security constraints, encryption, access boundaries by role | `docs/architecture/security-model.md` |
| Operator RBAC — `is_operator` flag, self-promotion guard, operator SELECT policies | `docs/architecture/rbac.md` |
| Task workspace — evidence checks, photos, operations conversations, storage | `docs/architecture/task-workspace.md` |
| Execution rules, safety rules, deployment authority | `CLAUDE.md` |
| Agent roles, approval requirements, scope discipline | `docs/agent-ops/claude-code-master-rules.md` |
| Data visibility scoping (PUB/GST/PTR/INT) | `docs/architecture/data-visibility-model.md` |
| Event naming conventions and event catalogue | `docs/architecture/event-driven-architecture.md` |
| AI concierge knowledge retrieval and KBB scope filter | `docs/ai-concierge/knowledge-retrieval-model.md` |

### Historical-reference-only documents (stale — read with caution)

The following documents were authoritative at an earlier phase of the project but have not been updated to reflect the current production state. They may contain useful historical context but must not be treated as canonical for schema, role model, or auth architecture decisions.

| Document | Status | What is stale |
|---|---|---|
| `docs/backend/database-schema.md` | Historical reference only — stale at v1.10 | Predates `task_photos`, `task_evidence_checks`, `operations_conversations`, `operations_messages`, `timeline_events.operations_conversation_id`, and the `is_operator` RBAC column. Does not reflect the operator RBAC design or the task workspace schema. For current schema, consult `supabase/migrations/` and `docs/architecture/current-state.md`. |
| `docs/backend/auth-strategy.md` | Historical reference only — stale | States "no operator dashboard" and does not reflect the current operator RBAC model. The `account_type` enum it describes (`homeowner`, `partner`) remains accurate, but operator elevation via the `is_operator` boolean flag is not documented in it. For the current auth and role model, consult `docs/architecture/rbac.md` and `docs/architecture/security-model.md`. |

A backend agent must not contradict a decision already documented in the authoritative documents above without first flagging the conflict, explaining why it should be revisited, and receiving explicit approval to revise the document.

---

## 4. Database and Migration Safety

Applied migrations in `supabase/migrations/` are immutable. The database is a live production system — mistakes here cannot be undone by reverting a file.

Specific rules:
- Never modify a migration that has already been applied to production
- New schema changes require a new migration file in `supabase/migrations/` — never apply schema changes only in the SQL Editor without a corresponding migration file in the repository
- Before any migration is applied to production (`supabase db push`), Security/Supabase review is required if the migration touches: Auth triggers, RLS policies, SECURITY DEFINER functions, storage policies, or database triggers
- `service_role` credentials must never appear in browser-facing code — they bypass RLS entirely and belong only in Edge Functions and server-side administrative tooling
- RLS must not be bypassed from frontend JavaScript — authorisation enforcement belongs at the database (RLS) or Edge Function layer

These rules are stated in full in `CLAUDE.md` "Mandatory safety rules" and `docs/agent-ops/claude-code-master-rules.md` Rule 15. They are referenced here for context, not restated as the authoritative source.

---

## 5. Database Model Constraints

When working on data models, apply these constraints without exception.

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
The `Booking → Reservation` rename documented in the data models is the authoritative naming. Do not revert this. Do not rename models without flagging and approving the change.

---

## 6. Authentication and Authorisation Constraints

The authentication model uses Supabase GoTrue (email + password, JWT sessions, refresh token rotation). See `docs/architecture/security-model.md` Section 1 for the complete authentication specification and `docs/architecture/rbac.md` for the current role model. Do not propose alternative authentication approaches without reading these first.

Key constraints:
- JWT access token (15-minute expiry) + refresh token (30-day expiry, rotated on use)
- Operator accounts require MFA — this is non-negotiable per `docs/architecture/security-model.md` Section 1.2 (GoTrue MFA configuration is not yet wired up at MVP, per `docs/architecture/current-state.md`)
- Guests have no accounts and no authentication tokens
- API keys for internal services must be scoped to minimum permissions
- The AI runtime API key is scoped to exactly 3 writable models: `WhatsAppSession`, `ServiceRequest`, `EscalationRecord`

**Current role model (as of Sprint 030E — production-grade):**

The platform has three user-facing account types and one internal service identity:

| Role identity | How it is expressed | Notes |
|---|---|---|
| `homeowner` | `public.account_type` enum value; `public.users.account_type = 'homeowner'` | Property owner or manager |
| `partner` | `public.account_type` enum value; `public.users.account_type = 'partner'` | Service partner |
| operator | `public.users.is_operator = true` boolean flag (independent of `account_type`) | Nauxica staff — additive privilege, not a separate account type |
| `ai_runtime` | Internal service API key — not a database user account | AI orchestration service |

The `public.account_type` enum has exactly two values: `homeowner` and `partner`. Operator is a boolean flag (`is_operator`) added in Sprint 030E.1, not a third enum value. See `docs/architecture/rbac.md` for the full design rationale, self-promotion guard, helper function, and operator SELECT policy inventory.

**Any proposed change to the auth model requires flagging the security model impact first.**

---

## 7. AI Runtime Constraints

The AI runtime is not a general-purpose AI agent. It has a defined permission boundary documented in `docs/ai-runtime/ai-runtime-orchestration.md`.

**Backend agents must not propose changes that:**
- Give the AI runtime write access to additional models
- Give the AI runtime direct database access (it must go through the Action Executor service)
- Allow the AI to bypass the KBB scope filter
- Bypass access code gating logic
- Enable AI-to-AI calls without operator visibility

The AI runtime's permission boundary is a security property, not a convenience setting.

---

## 8. Event System Constraints

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

## 9. API Design Constraints

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

## 10. Quick Reference

```
PLATFORM STATUS: Production-backed Supabase SaaS
Applied migrations, live RLS, deployed Edge Functions.

ROLE PERMISSIONS AT THE BACKEND LAYER:

  Architect         Read all files, produce sprint plan and migration content.
                    Does not write files. Does not deploy.

  Implementer       Read all files.
                    Write new migration files in supabase/migrations/ (approved sprint only).
                    Write Edge Function files (approved sprint only).
                    Does not modify applied migrations.
                    Does not run supabase db push or supabase functions deploy.

  Reviewer          Read all files.
                    Does not write files. Does not deploy.
                    Findings go to handoff report — not silently fixed.

  Security/Supabase Read migrations, Edge Functions, architecture docs.
                    Does not write files. Does not deploy.
                    Required review gate before any migration or Edge Function
                    touching Auth triggers, RLS policies, SECURITY DEFINER
                    functions, storage policies, or database triggers is
                    applied to production.

ALWAYS FORBIDDEN (any role, any sprint):
  - Modify an applied migration
  - Expose service_role credentials in browser-facing code
  - Bypass RLS from frontend JavaScript
  - Run supabase db push without explicit human instruction
  - Run supabase functions deploy without explicit human instruction
  - Run git commit or git push without explicit human instruction
  - Design guest authentication (guests have no accounts)
  - Give the AI runtime write access beyond the 3 permitted models
  - Add AI read access to models not in the permitted list
```
