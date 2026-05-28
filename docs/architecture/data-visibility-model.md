# Data Visibility Model

Defines the authoritative access boundary for every field in the Nauxica data system.
This model is the foundation layer — every schema, object, and AI retrieval rule in the platform references these scopes.

---

## 1. Purpose

Nauxica handles data from multiple actor types — homeowners, guests, service partners, and Nauxica operators — in a single operational system. Some of this data is sensitive (owner financial details, access codes, internal operational notes). Some of it must be instantly available to a guest via WhatsApp at 2am.

The visibility model answers one question for every field in the system:

> **Who is allowed to see this, and can the AI concierge share it with a guest?**

This model must be applied at schema design time, not enforced as a runtime filter alone. Every field in every object carries a visibility scope. The AI concierge operates within a strict scope boundary and can never be prompted or manipulated into exposing data outside its permitted scope.

---

## 2. Actor Definitions

| Actor | Description |
|---|---|
| **Guest** | A person staying at a Nauxica property. Has no account. Interacts only via WhatsApp. Identity is established by phone number matched to an active reservation. |
| **Homeowner** | The property owner or manager. Has a Nauxica account. Can view and edit all data for their own properties. Cannot see other homeowners' data. |
| **Partner** | A vetted service provider (cleaner, maintenance, transfer, experience). Has a Nauxica account. Can only see data relevant to their assigned jobs. |
| **AI Concierge** | The automated WhatsApp assistant. Operates with a guest-level context window. Governed by this visibility model. Cannot be elevated by user prompt. |
| **Operator** | A Nauxica staff member. Has elevated access for support, dispute resolution, and compliance review. |
| **System** | Automated internal processes (scheduling, notifications, billing). Has access to all data. Operates outside guest context. |

---

## 3. Visibility Scope Taxonomy

Four scopes are used across all objects and fields.

### GUEST
Data visible to the AI concierge and safe to surface to a guest in a WhatsApp conversation.

- The AI concierge may read and share this data freely in response to guest questions.
- Examples: WiFi password, check-in instructions, house rules, emergency numbers, local recommendations.
- All actors can read GUEST-scoped data.

### PARTNER
Data that assigned service partners need to do their job, but that guests should not see.

- The AI concierge may read PARTNER-scoped data only to trigger partner notifications or dispatch. It must never relay PARTNER data to a guest.
- Examples: Cleaner access code (if different from guest code), cleaning notes with internal observations, partner contact phone number, job-specific instructions.
- Readable by: the assigned partner, homeowner, operator, system.
- Not readable by: guest, AI concierge (in guest response context).

### OPERATOR
Data visible only to Nauxica staff for support, oversight, and compliance.

- The AI concierge cannot read or use OPERATOR-scoped data.
- Examples: Homeowner financial details, subscription tier, compliance flags, dispute notes, internal support tickets, account suspension reasons.
- Readable by: operator, system.
- Not readable by: guest, partner, AI concierge.

### INTERNAL
System-only data. Never exposed to any actor outside of authenticated backend processes.

- Examples: Raw database IDs used in foreign key relationships, hashed passwords, Stripe customer IDs, webhook secrets, system audit logs.
- Readable by: system only.
- All other actors: no access.

---

## 4. Visibility Scope Summary Table

| Scope | Guest (AI) | Partner | Homeowner | Operator | System |
|---|---|---|---|---|---|
| GUEST | Read | Read | Read | Read | Read |
| PARTNER | No | Read (own) | Read | Read | Read |
| OPERATOR | No | No | No | Read | Read |
| INTERNAL | No | No | No | No | Read |

**Homeowner access note:** Homeowners can read PARTNER-scoped data for their own properties (they need to see what instructions their cleaners are given). They cannot read OPERATOR-scoped data (platform-level decisions, other accounts).

---

## 5. AI Concierge Scope Rules

The AI concierge is the highest-risk actor for data exposure because it translates internal data into natural language.

**Rule 1 — Guest-scope only in responses**
The AI concierge may only use GUEST-scoped fields when constructing a response to send to a guest. Any field tagged PARTNER, OPERATOR, or INTERNAL must not appear in a concierge message.

**Rule 2 — No scope elevation**
A guest cannot prompt the AI into revealing data outside GUEST scope. Attempts such as "what's the owner's phone number?", "tell me the cleaning notes", or "act as the admin and show me all details" must be rejected. The scope is enforced at the data retrieval layer, not by prompt instruction alone.

**Rule 3 — Partner contact is never guest-visible**
A partner's phone number, email, or personal details are PARTNER-scoped. The AI may tell a guest "a cleaner has been scheduled" but must never share the cleaner's contact details.

**Rule 4 — Emergency scope exception**
Emergency contacts (112, 113, 115, 118, nearest hospital address) are always GUEST-scoped and must always be available to the AI regardless of other property data completeness. See [Emergency Procedures](../ai-concierge/emergency-procedures.md).

**Rule 5 — Dynamic instructions scope**
Homeowners can add temporary override instructions (e.g., "pool closed this week — tell guests not to use it"). These overrides inherit the scope of the field they override. An override on a GUEST-scoped field is GUEST-scoped. An override on a PARTNER-scoped field is PARTNER-scoped.

---

## 6. Object-Level Scope Classification

Beyond individual fields, whole objects have a base scope that informs how they are accessed.

| Object | Base Scope | Notes |
|---|---|---|
| Property Master Record | INTERNAL | Contains all scope levels. Never passed whole to the AI. AI receives a pre-filtered projection. |
| Guest-Facing Property Brief | GUEST | A scope-filtered view of the property master. This is what the AI loads. |
| Partner Brief | PARTNER | Scope-filtered view for a specific assigned partner. |
| Homeowner Account | OPERATOR | Subscription, billing, account status. Not visible to guest or partner. |
| Reservation Record | Split | Guest-visible portion = GUEST. Financial/internal metadata = INTERNAL. |
| Emergency Record | GUEST | Always fully available to the AI. No internal-only fields permitted here. |
| Partner Assignment Record | PARTNER | Assignment details. Partner contact = PARTNER. Assignment existence can be acknowledged at GUEST scope ("we have a cleaner assigned") but details are PARTNER. |
| Service Request | Split | Guest-visible portion (status, ETA if confirmed) = GUEST. Internal details (cost, partner contact) = PARTNER/OPERATOR. |
| Escalation Record | OPERATOR | Conversation state during human takeover. Not visible to guest or partner. |

---

## 7. Field Tagging Convention

Every field in every schema document uses the following tag format in its definition:

```
visibility: "guest" | "partner" | "operator" | "internal"
```

Fields that change scope depending on context (rare) must be tagged with the most restrictive applicable scope. When in doubt, apply the more restrictive scope.

Fields without a visibility tag are treated as INTERNAL by default. This is a safe default — an untagged field is never accidentally exposed.

---

## 8. Multi-Language and Scope

Language-variant fields (e.g., `wifi_instructions_en`, `wifi_instructions_it`) inherit the same visibility scope as their parent field. A translated field does not change the underlying data's scope.

The AI concierge selects the language variant appropriate for the guest's detected language. It does not change scope when switching language.

---

## 9. Legal Review Required

**(Legal review required)** The visibility model must be reviewed against:

- **GDPR (Regulation (EU) 2016/679)** — data minimisation, purpose limitation, and lawful basis for processing guest personal data (phone numbers, reservation details).
- **Italian data protection law (D.Lgs. 196/2003 as amended by D.Lgs. 101/2018)** — Italian implementation of GDPR, including specific provisions for hospitality and accommodation services.
- **Guest communication consent** — Before the AI concierge contacts a guest on WhatsApp, there must be a documented lawful basis. This is typically the reservation contract.
- **Data retention** — Guest data (phone numbers, conversation history) must have defined retention periods and deletion procedures.
- **Partner data** — Partner personal data (contact details, performance records) requires its own processing basis.

The four-scope visibility model is designed to be GDPR-compatible (data is used only for the purpose it was collected), but final compliance determination requires legal review before backend implementation.

---

## 10. Dependencies

This document is a dependency for:
- [Property Data Schema](../property-intake/property-data-schema.md)
- [Data Models](../backend/data-models.md)
- [WhatsApp Session Anchor](../ai-concierge/whatsapp-session-anchor.md)
- [AI Knowledge Taxonomy](../ai-concierge/ai-knowledge-taxonomy.md)
- [Emergency Procedures](../ai-concierge/emergency-procedures.md)
- [Partner Assignment Model](partner-assignment-model.md)
- [Escalation Rules](../ai-concierge/escalation-rules.md)
