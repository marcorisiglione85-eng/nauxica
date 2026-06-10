# Sprint 013 Architecture Handoff

**Branch:** `feature/add-property`
**Last validated commit:** `a865be8` (Sprint 012C concierge context engine)
**Date:** 2026-06-10

---

## 1. System Architecture

```
Browser (property-detail.html)
  │
  ├── nauxica-wizard.js     — Register / Edit Property multi-step wizard
  └── nauxica-knowledge.js  — Knowledge Base + Emergency Data cards and editors
         │
         ├── Supabase JS client (anon key + user JWT)
         │     ├── SELECT  properties              (homeowner RLS: own rows only)
         │     ├── SELECT  property_knowledge_blocks (homeowner RLS: SELECT only)
         │     ├── SELECT  emergency_data           (homeowner RLS: SELECT only)
         │     └── SELECT  emergency_contacts       (homeowner RLS: SELECT only)
         │
         └── Supabase Edge Functions (service_role bypass)
               ├── knowledge-writer  — upserts property_knowledge_blocks
               └── emergency-writer  — writes emergency_data + emergency_contacts
```

**Key constraint:** homeowner RLS allows `SELECT` only on `property_knowledge_blocks`, `emergency_data`, and `emergency_contacts`. All writes to these tables must go through the Edge Functions, which use the `service_role` key.

**No build step.** All JS is vanilla, loaded directly by the HTML file. There are no npm dependencies, bundlers, or test runners.

---

## 2. Data Flow Diagrams

### 2a. Register Property (new property)

```
editPropertyBtn click → NauxicaWizard.open({})
  │
  ├── [steps 1–9] user fills wizard
  │
  └── _saveProperty()
        │
        ├── 1. properties INSERT  →  new property_id
        │
        ├── 2. property_knowledge_blocks SELECT  (empty for new property)
        │         └── _buildKbBlocks()  →  knowledge-writer POST
        │               └── UPSERT on (property_id, block_type)
        │
        ├── 3. if (owner_name || owner_phone):
        │         emergency-writer POST
        │               ├── SELECT emergency_data by property_id  →  no row
        │               └── INSERT  (requires all 4 NOT NULL fields)
        │
        └── 4. _afterSave()  →  caller navigates / reloads
```

### 2b. Edit Property (existing property)

```
editPropertyBtn click
  │
  ├── properties SELECT (fresh row)
  │
  └── NauxicaWizard.fromSupabase(row)
        │
        ├── emergency_data SELECT by property_id  →  preloadedEmergency
        ├── emergency_contacts SELECT by property_id  →  preloadedContacts
        │
        ├── open(wizardData)   ← resets _emergencyData={}, _contactsData={}
        └── _emergencyData = preloadedEmergency   ← restored immediately after open()
            _contactsData  = preloadedContacts
              │
              ├── [steps 1–9] user navigates; _collectStep() called on every transition
              │
              └── _saveProperty()
                    │
                    ├── 1. properties UPDATE by (id, owner_id)
                    │
                    ├── 2. property_knowledge_blocks SELECT  →  existing blocks
                    │         └── _buildKbBlocks(_wizardData, existing)  →  knowledge-writer POST
                    │               └── UPSERT merges wizard fields onto existing content_jsonb
                    │
                    ├── 3. if (owner_name || owner_phone):
                    │         emergency-writer POST
                    │               ├── SELECT emergency_data  →  row exists
                    │               └── UPDATE (no required-field check on UPDATE)
                    │
                    └── 4. _afterSave()  →  window.location.reload()
                              └── NauxicaKnowledge.init()  →  fresh SELECT of all tables
```

### 2c. Emergency Data editor (property-detail.html)

```
"Configure Emergency Data" button
  └── NauxicaKnowledge._openEmModal()
        └── user edits form
              └── _saveEmData()
                    ├── client-side validation (4 required fields)
                    ├── emergency-writer POST
                    │     ├── SELECT  →  INSERT or UPDATE
                    │     └── returns { ok, contacts: { owner, caretaker } }
                    ├── Object.assign(_emData, emPayload)   ← optimistic local update
                    ├── merge savedContacts into _contacts
                    └── _renderEmCard()
```

### 2d. Knowledge Base editor (property-detail.html)

```
"Configure Knowledge Base" button
  └── NauxicaKnowledge._openKbModal()
        └── user edits accordion sections
              └── _saveKnowledge()
                    ├── _collectKbBlocks()  →  all 8 block types
                    ├── knowledge-writer POST
                    │     └── UPSERT on (property_id, block_type)
                    ├── merge saved blocks into _kbBlocks   ← optimistic local update
                    └── _renderKbCard()
```

---

## 3. `property_knowledge_blocks` Lifecycle

| Event | Actor | Operation |
|---|---|---|
| First wizard save (new property) | nauxica-wizard.js → knowledge-writer | INSERT via UPSERT |
| Subsequent wizard saves | nauxica-wizard.js → knowledge-writer | UPDATE via UPSERT (merge) |
| Manual KB editor save | nauxica-knowledge.js → knowledge-writer | UPDATE via UPSERT |
| AI concierge read | GuestPal backend | SELECT by (property_id, block_type) |

**Conflict key:** `(property_id, block_type)` — one row per block type per property.

**Merge strategy on wizard save:** `_buildKbBlocks()` reads existing blocks first (`SELECT` by the anon client; homeowner RLS allows SELECT). It merges wizard-derived fields on top of the existing `content_jsonb`, preserving any manually-edited keys not covered by the wizard. The knowledge-writer's `ON CONFLICT DO UPDATE` only sets the columns in the payload, so `title` is never overwritten on UPDATE.

**Allowed block types:** `property_summary`, `wifi`, `access`, `check_in`, `check_out`, `house_rules`, `tourist_tax`, `fallback_support`. The `emergency` block type exists in knowledge-writer's allow-list but is never sent by the wizard or the KB editor.

**`visibility_scope`:** Must be one of `PUB`, `GST`, `PTR`, `INT`. knowledge-writer normalises long-form strings (`public` → `PUB`, etc.) and applies per-block defaults if none is provided. The wizard always sends canonical codes via `_normVis()`.

---

## 4. `emergency_data` Lifecycle

| Event | Actor | Operation | Notes |
|---|---|---|---|
| First wizard save | nauxica-wizard.js → emergency-writer | INSERT | Requires 4 NOT NULL fields |
| Subsequent wizard saves | nauxica-wizard.js → emergency-writer | UPDATE | No required-field check |
| Emergency Data editor save | nauxica-knowledge.js → emergency-writer | INSERT or UPDATE | Client validates 4 fields before POST |
| AI concierge read | GuestPal backend | SELECT | Full row |

**INSERT guard (emergency-writer):** `REQUIRED_ED_COLUMNS = [owner_emergency_name, owner_emergency_phone, nearest_hospital_name, nearest_hospital_address]`. These four columns are `NOT NULL` in the schema. emergency-writer validates they are present and non-empty before running INSERT, returning HTTP 400 if any are missing.

**`nauxica_ops_phone`:** Set once on INSERT from the `NAUXICA_OPS_PHONE` environment variable. Never written from the request payload; never updated on subsequent saves. `NOT NULL` — the env var default is `+39 000 000 0000`.

**Homeowner-writable columns (via ALLOWED_ED_COLUMNS):**
`owner_emergency_name`, `owner_emergency_phone`, `nearest_hospital_name`, `nearest_hospital_address`, `nearest_hospital_distance`, `nearest_hospital_phone`, `gas_shutoff_instructions`, `water_shutoff_instructions`, `electricity_shutoff_instructions`, `evacuation_route_description`, `evacuation_assembly_point`, `property_specific_hazards`, `emergency_instructions`

**Columns the wizard does NOT collect:** `nearest_hospital_phone`, `emergency_instructions`. Both are in ALLOWED_ED_COLUMNS and can be set via the Emergency Data editor only.

**`is_complete`:** Column exists on the table but is never set or read by the wizard or either editor. Currently orphaned.

---

## 5. `emergency_contacts` Lifecycle

| Event | Actor | Operation | Notes |
|---|---|---|---|
| First wizard save (step 9) | nauxica-wizard.js → emergency-writer | INSERT if name or phone present | |
| Subsequent wizard saves | nauxica-wizard.js → emergency-writer | UPDATE by (property_id, contact_type) | |
| Emergency Data editor save | nauxica-knowledge.js → emergency-writer | INSERT or UPDATE | |
| AI concierge read | GuestPal backend | SELECT | Filtered by ai_usable |

**Allowed contact types:** `owner`, `caretaker`. The type `nauxica_operator` is blocked at the Edge Function boundary and never accepted from any browser request.

**Upsert strategy (emergency-writer):** For each contact type, SELECT existing row by `(property_id, contact_type)`. If found → UPDATE by `id`. If not → INSERT with `property_id` and `contact_type`. `contact_type` and `property_id` are never altered on UPDATE.

**Homeowner-writable columns:** `contact_name`, `contact_phone`, `available_hours`, `escalation_priority`, `is_active`, `guest_visible`, `ai_usable`.

**Fixed defaults set by wizard (not overridable via wizard step 9):**
- `owner`: `escalation_priority=1`, `is_active=true`, `guest_visible=false`, `ai_usable=false`
- `caretaker`: `escalation_priority=2`, `is_active=true`, `guest_visible=false`, `ai_usable=false`

The Emergency Data editor does not send `available_hours` for contacts (only `contact_name`, `contact_phone`). The wizard step 9 does collect `available_hours` but omits `guest_visible` and `ai_usable` (hardcoded above).

**emergency-writer return value:** `{ ok: true, contacts: { owner: { id, contact_type, contact_name, contact_phone }, caretaker: { … } } }`. The Emergency Data editor merges this back into `_contacts` for optimistic UI update without a reload.

---

## 6. knowledge-writer Responsibilities

**Entry point:** `POST /functions/v1/knowledge-writer`  
**Payload:** `{ property_id: string, blocks: Block[] }`  
**Auth:** Bearer JWT → `auth.getUser()` → ownership check on `properties` table via user-scoped client (RLS)

1. **Verify JWT** — anon client scoped to the Bearer token; `auth.getUser()` must return a valid user.
2. **Verify ownership** — SELECT `properties.id` using the user-scoped client; if not found, 403.
3. **Filter block types** — reject any block not in `ALLOWED_BLOCK_TYPES`; if all are rejected, 400.
4. **Normalise `visibility_scope`** — maps long-form strings and canonical codes to `PUB/GST/PTR/INT`; if a provided value does not map, collects all errors and returns 400 with the full error list.
5. **Apply per-block defaults** — if `visibility_scope` is absent, uses `BLOCK_VISIBILITY[blockType]`.
6. **Derive `title`** — from `BLOCK_TITLES[blockType]`; set on INSERT, preserved on UPDATE (PostgREST ON CONFLICT only updates provided columns).
7. **Upsert** — service_role client; `ON CONFLICT (property_id, block_type)`.
8. **Never log `content_jsonb`** — may contain WiFi passwords, access codes.

---

## 7. emergency-writer Responsibilities

**Entry point:** `POST /functions/v1/emergency-writer`  
**Payload:** `{ property_id: string, emergency_data?: object, contacts?: { owner?: object, caretaker?: object } }`  
**Auth:** Bearer JWT → `auth.getUser()` → ownership check on `properties` table via user-scoped client (RLS)

1. **Verify JWT** — same pattern as knowledge-writer.
2. **Verify ownership** — same pattern; 403 if not found.
3. **Write `emergency_data`** (if provided):
   - SELECT existing row by `property_id` → determines INSERT vs UPDATE path.
   - **UPDATE path:** `pickColumns(edInput, ALLOWED_ED_COLUMNS)` → UPDATE by `id`. No required-field validation. `nauxica_ops_phone` is not touched.
   - **INSERT path:** validate `REQUIRED_ED_COLUMNS` first → if any missing, 400. INSERT with `nauxica_ops_phone` from env var + all allowed columns.
4. **Write `emergency_contacts`** (if provided):
   - For each contact type in the payload, reject if not in `{ owner, caretaker }`.
   - SELECT existing row by `(property_id, contact_type)` → INSERT or UPDATE.
   - Never alters `contact_type` or `property_id` on UPDATE.
5. **Returns** `{ ok: true, contacts: { … } }` with the saved id/name/phone for each contact type written.
6. **Never log field values** — may contain phone numbers, access codes.
7. **Never write `nauxica_ops_phone` from the request payload.**
8. **Never write `contact_type = 'nauxica_operator'`.**

---

## 8. Edit Property Sync Flow (detailed)

```
property-detail.html
  editPropertyBtn.click()
    │
    ├── SELECT properties WHERE id = propertyId  →  freshRow
    │
    └── NauxicaWizard.fromSupabase(freshRow, afterSaveFn)
          │
          ├── SELECT emergency_data WHERE property_id = propId  →  preloadedEmergency
          ├── SELECT emergency_contacts WHERE property_id = propId
          │     AND contact_type IN ('owner','caretaker')       →  preloadedContacts
          │
          ├── open(wizardData)
          │     ├── _editId = propId
          │     ├── _wizardData = { ...wizardData }
          │     ├── _emergencyData = {}          ← reset
          │     ├── _contactsData = {}           ← reset
          │     ├── _currentStep = 1
          │     └── _renderStep(1)
          │
          ├── _emergencyData = preloadedEmergency  ← restored
          └── _contactsData  = preloadedContacts   ← restored

          [user navigates steps 1–9]
          On each "Next": _validateStep(n) → _collectStep(n) → _renderStep(n+1)
          On each "Back":                    _collectStep(n) → _renderStep(n-1)

          Step 8 render: fields pre-filled from _emergencyData
          Step 9 render: fields pre-filled from _contactsData

          "Save" on step 9:
            _validateStep(9) → _collectStep(9) → _saveProperty()
              │
              ├── getSession()  →  ownerId
              ├── properties UPDATE WHERE id=_editId AND owner_id=ownerId
              ├── property_knowledge_blocks SELECT  →  existingKbBlocks
              ├── _buildKbBlocks(_wizardData, existingKbBlocks)  →  kbBlocks[]
              ├── knowledge-writer POST { property_id, blocks: kbBlocks }
              │     [error: console.warn only — non-fatal]
              ├── if (_emergencyData.owner_emergency_name || .owner_emergency_phone):
              │     emergency-writer POST { property_id, emergency_data, contacts }
              │           [error: console.warn only — non-fatal]
              └── _close() → _afterSave(savedRow) → window.location.reload()
                    └── NauxicaKnowledge.init(propertyId)
                          ├── SELECT property_knowledge_blocks  →  _kbBlocks
                          ├── SELECT emergency_data             →  _emData
                          ├── SELECT emergency_contacts         →  _contacts
                          └── _renderKbCard() + _renderEmCard()
```

---

## 9. Register Property Sync Flow (detailed)

```
"Register Property" button
  └── NauxicaWizard.open(null, afterSaveFn)
        ├── _editId = null
        ├── _wizardData = {}
        ├── _emergencyData = {}
        ├── _contactsData = { owner: {}, caretaker: {} }
        └── _currentStep = 1

        [user fills all 9 steps from scratch]
        Step 8: emergency data (owner name/phone required; hospital name/address required)
        Step 9: contacts (all optional — only written if name or phone provided)

        _saveProperty()
          │
          ├── properties INSERT  →  new property_id (dbRes.data.id)
          │
          ├── var propId = dbRes.data.id   ← _editId is null for new property
          │
          ├── property_knowledge_blocks SELECT  →  [] (empty for new property)
          ├── _buildKbBlocks(_wizardData, {})   →  kbBlocks[]
          ├── knowledge-writer POST  →  INSERT (UPSERT with no conflict)
          │
          ├── if (owner_name || owner_phone):
          │     emergency-writer POST
          │           ├── SELECT emergency_data  →  no row
          │           └── INSERT  (all 4 required fields must be present)
          │                 nauxica_ops_phone set from NAUXICA_OPS_PHONE env var
          │
          └── _afterSave(savedRow)  →  caller's callback (e.g., redirect or list refresh)
```

---

## 10. Known Limitations

### Silent failures on Edge Function errors
Both `_saveProperty()` (wizard) and `_saveKnowledge()` / `_saveEmData()` (KB/EM editors) log Edge Function errors as `console.warn` and continue. The user sees the save succeed (wizard closes, page reloads) even if `emergency-writer` or `knowledge-writer` returned an error. There is no user-visible notification of partial failure.

### Wizard does not collect all emergency_data fields
`nearest_hospital_phone` and `emergency_instructions` are in `ALLOWED_ED_COLUMNS` but have no form fields in wizard step 8. They can only be set via the Emergency Data editor. If a wizard save runs an UPDATE, these fields are untouched (correct). If a wizard save runs an INSERT, these fields default to null (acceptable — they are nullable).

### `is_complete` is orphaned
The `emergency_data` table has an `is_complete` column. No code reads or writes it. Its intended semantics (computed vs. manual flag) are undefined.

### Emergency Data editor does not collect `available_hours` for contacts
`_saveEmData()` in nauxica-knowledge.js does not send `available_hours` when writing owner or caretaker contacts. If a user sets `available_hours` via the wizard step 9 and later saves via the Emergency Data editor, `available_hours` will not be overwritten (it is simply absent from the payload, and `pickColumns` only includes keys present in the input). This is safe but means the two editors have different field coverage.

### Wizard contact defaults are hardcoded
`guest_visible=false` and `ai_usable=false` are hardcoded for both owner and caretaker contacts in `_saveProperty()`. There is no UI in the wizard to control these flags. The Emergency Data editor also does not expose them. They can only be changed via the Knowledge Base editor's `fallback_support` block or direct DB access.

### `fromSupabase()` ordering dependency
`open()` resets `_emergencyData` and `_contactsData`. `fromSupabase()` immediately restores them after calling `open()`. This is a fragile ordering assumption: if `open()` is ever made asynchronous, or if any code between the two assignments triggers a render that reads `_emergencyData`, the pre-loaded data will be missing.

### No partial-save recovery
`_saveProperty()` runs steps sequentially: properties → knowledge-writer → emergency-writer. If properties succeeds but knowledge-writer fails, the wizard closes and the page reloads — the next page load will show stale KB data. There is no retry or rollback.

### Stale comment in nauxica-knowledge.js
Line 8 reads: *"Emergency data and contacts are written directly via the anon client."* This is incorrect. As of Sprint 013B, `_saveEmData()` routes through `emergency-writer`. The comment was not updated.

---

## 11. Open Technical Debt

| Item | Severity | Location |
|---|---|---|
| Edge Function failures are silent (non-fatal console.warn) | High | nauxica-wizard.js `_saveProperty()`, nauxica-knowledge.js `_saveKnowledge()` |
| `is_complete` column — undefined semantics, never set | Medium | emergency_data table, all writers |
| Stale comment (anon client claim) | Low | nauxica-knowledge.js line 8 |
| `nearest_hospital_phone` not collected in wizard | Low | nauxica-wizard.js step 8 |
| `emergency_instructions` not collected in wizard | Low | nauxica-wizard.js step 8 |
| `guest_visible` / `ai_usable` hardcoded, not configurable | Medium | nauxica-wizard.js `_saveProperty()`, nauxica-knowledge.js `_saveEmData()` |
| `available_hours` not collected in Emergency Data editor | Low | nauxica-knowledge.js `_saveEmData()` |
| `fromSupabase()` / `open()` ordering dependency | Medium | nauxica-wizard.js `fromSupabase()` |
| No user-visible error surface for partial wizard saves | High | nauxica-wizard.js `_saveProperty()` |
| `emergency` block type in knowledge-writer allow-list but never sent | Low | supabase/functions/knowledge-writer/index.ts |

---

## 12. Recommended Sprint 014 Starting Point

### P1 — Surface Edge Function errors to the user
`_saveProperty()` currently swallows both knowledge-writer and emergency-writer errors with `console.warn`. At minimum, show a non-blocking toast or a post-save warning banner: *"Property saved. Some AI concierge data could not be updated — please check the Knowledge Base."* This prevents silent data loss from being invisible to the homeowner.

### P2 — Resolve `is_complete` semantics
Decide whether `is_complete` should be:
- A computed flag (set by emergency-writer when all 4 required fields are present)
- A manual flag (set by Nauxica staff via admin tooling)

If computed: emergency-writer should set `is_complete = true` whenever `owner_emergency_name`, `owner_emergency_phone`, `nearest_hospital_name`, and `nearest_hospital_address` are all non-null on any UPDATE or INSERT.

### P3 — GuestPal concierge context consumption
Sprint 012C validated the concierge context engine. Sprint 013 built the operational data model it reads from. Sprint 014 should wire the consumption path: confirm that GuestPal can SELECT `property_knowledge_blocks` by `(property_id, is_active = true)` and `emergency_data` / `emergency_contacts` via the concierge's service account or RLS policy. Define which `visibility_scope` values are served to guests vs. internal only.

### P4 — Add `nearest_hospital_phone` to wizard step 8
Low-effort field addition alongside the existing hospital section. The field ID convention is `wf_em_hospital_phone`; add it to `_buildStepHTML(8)`, `_collectStep(8)`, and `_saveProperty()`'s `emPayload`.

### Deferred (Sprint 015+)
- Configurable `guest_visible` / `ai_usable` per contact in the Emergency Data editor
- Retry mechanism for failed Edge Function calls during wizard save
- Refactor `fromSupabase()` ordering dependency (pass pre-loaded data as a parameter to `open()` instead of restoring it after)
