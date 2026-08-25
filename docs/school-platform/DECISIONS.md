# Product and Architecture Decisions

**Status:** Canonical decision register  
**Last updated:** 2026-08-03

## 1. Decision states

- **Confirmed:** agreed baseline; implementation should follow it.
- **Provisional:** preferred direction, awaiting a bounded validation or business choice.
- **Open:** no decision yet; implementation must not silently choose.
- **Superseded:** retained for history and linked to its replacement.

## 2. Confirmed decisions

| ID | Decision | Rationale and consequence |
|---|---|---|
| DEC-001 | Maktab will be a cloud-first, multi-tenant School ERP/SIS delivered as SaaS. | The current scheduler becomes one bounded subsystem rather than the platform architecture. |
| DEC-002 | Only timetable generation and its local draft/review workflow are required offline. | All other modules use the online system of record unless a future decision explicitly adds offline support. |
| DEC-003 | PostgreSQL in the cloud is the authoritative operational database. | SQLite remains limited to the Electron local workspace/cache and must not independently own finance, students, or attendance truth. |
| DEC-004 | The cloud backend will use Python Django with Django REST Framework as a modular monolith. | Django's transactional model, admin tooling, ORM, migrations, and ecosystem fit the domains and current scale. Bounded modules are still mandatory. |
| DEC-005 | School-facing experiences will use custom React web interfaces. | Django Admin is reserved for trusted vendor/company operations and controlled support, not as the school portal. |
| DEC-006 | The Electron application is a specialized administrative client and local capability host. | It hosts the timetable solver/workspace, OS printing, optional device connectors, and authenticated cloud API access. The existing local Express API may remain as a narrow local bridge. |
| DEC-007 | Schools share a scalable SaaS deployment by default. | A VPS per school creates upgrade, monitoring, backup, and security fragmentation. Dedicated deployment/database may become a premium option later. |
| DEC-008 | One contracted school customer is one tenant organization. | A tenant may contain school units, campuses, course centers, departments, and academic sections. There is no cross-tenant data access by default. |
| DEC-009 | Contract entitlements and user authorization are separate controls. | Effective access is: active subscription + module entitlement + action permission + data scope/relationship + valid workflow state. |
| DEC-010 | Authorization uses RBAC plus scoped and relationship-based rules. | Roles provide reusable permission sets; scopes constrain tenant/unit/class/record access; relationships allow a guardian to see only linked children, for example. |
| DEC-011 | The backend enforces authorization on every protected operation. | Frontend routes and hidden screens improve usability but are never treated as security boundaries. |
| DEC-012 | A school may have approximately five highly privileged users and up to roughly one hundred other staff accounts in the expected near-term profile. | Design and tests must support multiple users per department and avoid assuming one manager per role. |
| DEC-013 | Teachers and guardians receive distinct login accounts, even when the same human has both roles. | Credentials, sessions, role contexts, and audit trails remain separate. The accounts may link to one canonical Person record. |
| DEC-014 | Initial accounts use a temporary password and mandatory first-login password change. | Credentials are delivered without SMS, displayed/printed once, expire, and cannot be retrieved as plaintext. |
| DEC-015 | Password authentication is the initial login method. | Use a modern password hasher, secure session/token rotation, rate limits, reset controls, and later MFA for sensitive roles. |
| DEC-016 | Biometric attendance supports students and employees. | Student attendance may be morning-only or entry/exit; employee timekeeping includes arrival, departure, breaks, shifts, corrections, and approval. |
| DEC-017 | Biometric raw events are immutable and separate from derived attendance. | Corrections change projections with a reason and audit trail; they do not overwrite device evidence. |
| DEC-018 | Fingerprint matching should occur on the device or trusted local connector by default. | The cloud ingests identifiers and event metadata, not fingerprint images/templates, unless a separately approved privacy/security design requires otherwise. |
| DEC-019 | Manual class attendance is submitted as an idempotent class sheet. | One transactional request per sheet avoids hundreds of fragile per-student requests. |
| DEC-020 | Employee payroll consumes approved time summaries, not raw biometric punches. | Raw punches first become sessions and daily timesheets; exceptions and approvals are resolved before payroll. |
| DEC-021 | Financial accounting uses double-entry principles. | Posted entries and issued receipts are immutable; errors are handled through reversal/adjustment, with sequence numbers, reasons, approvals, and audit evidence. |
| DEC-022 | Sensitive finance workflows support configurable separation of duties. | Schools may use dual control, amount-threshold approval, or single-operator mode with re-authentication, based on contract and policy. Audit is never optional. |
| DEC-023 | Reports, bills, and receipts use normal A4 printers by default. | Documents are generated from server-authoritative data; print/reprint is logged and printer failure never cancels a committed payment. |
| DEC-024 | Hardware sales and maintenance are commercially separate from the SaaS subscription. | Device integration remains a software entitlement/capability and can support company-provided or certified customer-owned devices. |
| DEC-025 | Messaging supports Dari/Persian and Pashto and multiple providers. | Provider adapters, an outbox, retries, delivery status, templates, consent, and language selection prevent business logic from depending on one channel. |
| DEC-026 | Large reports, messaging, imports, and biometric processing run asynchronously. | Django request workers remain responsive; durable jobs carry tenant, actor, correlation, idempotency, and retry metadata. |
| DEC-027 | The initial scale target is about 20 schools after one year and about 100 after three years. | A stateless Django deployment, PostgreSQL, Redis/queue, workers, object storage, and observability are sufficient; microservices/Kubernetes are not initial requirements. |
| DEC-028 | The public site exposes general information and tutorials; authenticated portals expose tenant data by role and relationship. | Public content and protected operational data remain separate routes and authorization contexts. |
| DEC-029 | The timetable publication workflow is versioned. | Electron downloads a cloud snapshot, solves locally, uploads with its source revision, and the server validates staleness/conflicts before central publication. |
| DEC-030 | Hardware throughput and resilience are part of procurement acceptance. | Devices must be tested for scans/minute, retry behavior, offline log capacity, clock handling, power recovery, network/SDK support, and duplicate events. |
| DEC-031 | The implementation baseline is Python 3.12 and Django 5.2 LTS, managed as an uv workspace. | The platform and solver keep separate dependency groups under one reproducible lockfile. Review before the LTS support window ends. |

## 3. Provisional decisions

| ID | Direction | Validation required |
|---|---|---|
| DEC-P02 | Start with one shared PostgreSQL database and shared schema with mandatory `tenant_id` on tenant-owned data. | Perform a tenant-isolation threat model and prototype database constraints; consider PostgreSQL RLS as defense in depth. |
| DEC-P03 | Use Redis plus a durable Django-compatible job queue/workers. | Select the queue based on operational support, scheduling, retries, observability, and deployment environment. |
| DEC-P04 | Start with responsive web/PWA portals instead of native teacher/guardian apps. | Validate notification, offline-read, camera/file, and low-bandwidth needs with pilot schools. |
| DEC-P05 | Use Argon2id for password hashing and introduce MFA first for vendor, tenant-superuser, and finance approval accounts. | Confirm operational recovery and device availability in target schools. |
| DEC-P06 | Use a canonical Person model with role-specific profiles and separate LoginAccount records. | Validate deduplication, guardian relationships, employment history, and legal name requirements. |
| DEC-P07 | Use server-generated PDFs for official and financial documents. | Obtain real forms and printer samples; test Dari/Pashto fonts, RTL layout, barcodes/QR, and A4 margins. |

## 4. Open decisions

| ID | Question | Why it blocks or changes design |
|---|---|---|
| DEC-O01 | What exact username format replaces or safely adapts `name + phone number`? | Full phone numbers expose personal data, names collide, and phone numbers change. Uniqueness and recovery policy depend on this decision. |
| DEC-O02 | Can one phone number belong to multiple people/accounts, and can a guardian manage multiple children? | This affects contact normalization, identity verification, notifications, and guardian portal navigation. |
| DEC-O03 | What are the exact meanings, workflows, and official layouts for شقه, سه پارچه, کورس, and سویه? | These terms affect domain entities, state transitions, reports, and permissions; implementation requires real samples. |
| DEC-O04 | Which Afghan accounting, payroll, tax, education, and record-retention rules apply to the first release? | Finance and official records require expert validation; guesses create legal and business risk. |
| DEC-O05 | Which messaging providers are commercially and technically available? | Delivery guarantees, Telegram linking, push behavior, costs, consent, and fallback channels differ. |
| DEC-O06 | Which biometric device models/protocols form the initial certified list? | Connector architecture and procurement tests depend on SDK/API, LAN capability, event identifiers, and local storage. |
| DEC-O07 | What are the school, campus, branch, course-center, and section semantics for the first customers? | Organizational hierarchy controls scope, reporting, numbering, calendars, cashboxes, and device mapping. |
| DEC-O08 | What are the exact approval thresholds and segregation policies for finance and payroll? | These must be configurable but need safe defaults and tested workflow states. |
| DEC-O09 | Are student/teacher ratings and “mental growth” ratings included, and under what ethical safeguards? | Child profiling, visibility, appeals, evidence, and retention need explicit policy and specialist review. |
| DEC-O10 | What service level and recovery commitments are sold in each contract tier? | Availability, backup retention, support staffing, and dedicated deployment pricing depend on them. |

## 5. Decision review triggers

Review this register when any of the following occurs:

- the first pilot school's real forms and policies are collected;
- a finance or biometric vendor is selected;
- the cloud deployment provider is selected;
- native mobile development is proposed;
- offline scope expands beyond timetable work;
- a customer requests dedicated infrastructure or cross-school sharing;
- legislation, ministry formats, or retention obligations are confirmed.
