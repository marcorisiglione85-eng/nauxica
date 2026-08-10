# Nauxica — Claude Code Project Instructions

## What this project is

Nauxica is a production-backed hospitality operations SaaS for short-term rental homeowners and local service partners (Sicily launch). It is **not a prototype** — it runs against a live Supabase instance with real user accounts, row-level security, and applied database migrations.

---

## Tech stack

- HTML / CSS / Vanilla JavaScript — no framework, no build step
- Supabase Auth (GoTrue) — authentication and JWT sessions
- PostgreSQL with Row Level Security — application database
- Supabase Storage — private file storage (task-photos bucket)
- Supabase Edge Functions (Deno / TypeScript) — server-side and protected writes

---

## Source of truth hierarchy

| Domain | Authority |
|---|---|
| Execution rules (this session) | `CLAUDE.md` — this file |
| Universal agent governance | `docs/agent-ops/claude-code-master-rules.md` |
| Architecture and product decisions | `docs/architecture/` |
| Backend implementation references | `docs/backend/` |
| Database evolution | `supabase/migrations/` — chronological order |
| Security architecture | `docs/architecture/security-model.md` |
| Visual and layout reference | `dashboard-homeowner.html` |
| Legacy frontend conventions | `PROJECT_RULES.md` — frontend layout only; governance sections are deprecated |
| Session continuity | Memory system — non-authoritative for architecture or schema |

---

## Data layer

**Supabase is the application source of truth.**

`nauxica-demo-data.js` and `localStorage` are legacy demo mechanisms from the prototype era. They may remain on pages that still use them but must **not** be extended into new production flows without explicit human approval.

New production data flows use: Supabase Auth, the Supabase JS client for database queries, Edge Functions for protected writes, and Supabase Storage for file access.

---

## Mandatory safety rules

These rules apply to every Claude Code session on this project without exception.

**Database and migrations:**
- Never modify a migration that has already been applied to production
- Schema changes require a new migration file in `supabase/migrations/`
- Any migration touching Auth triggers, RLS policies, SECURITY DEFINER functions, storage policies, or database triggers requires Security/Supabase review before being applied to production

**Security:**
- Never expose `service_role` credentials in browser-facing code
- Never bypass RLS from frontend JavaScript
- Never use a frontend-only role check as an authorisation boundary — enforcement must be at the database (RLS) or Edge Function layer

**Deployment and git — human-controlled only:**
- No `git commit` without explicit human instruction
- No `git push` without explicit human instruction
- No `supabase db push` without explicit human instruction
- No `supabase functions deploy` without explicit human instruction
- No destructive production operation (`DELETE`, `DROP`, `TRUNCATE` against production data) without explicit human approval per operation

---

## Engineering workflow

```
Architect
  → Human approval
  → Implementer
  → Reviewer
  → Security/Supabase review (when migrations, RLS, Auth triggers, or Edge Functions are in scope)
  → Human deployment (supabase db push / supabase functions deploy)
  → Human commit / push
```

No stage advances automatically. The human controls every transition.

| Role | Read files | Edit files | Commit / push / deploy |
|---|---|---|---|
| Architect | Yes | No | No |
| Implementer | Yes | Approved list only | No |
| Reviewer | Yes | No | No |
| Security/Supabase | Yes | No | No |

Agent role definitions will be documented in `docs/agent-ops/` in a later sprint.

---

## Mandatory governance

Read `docs/agent-ops/claude-code-master-rules.md` before beginning any task. It contains the detailed working rules for approval, scope discipline, testing, and handoff. It is non-optional.
