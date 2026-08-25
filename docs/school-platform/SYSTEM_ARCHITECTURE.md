# System Architecture

**Status:** Baseline architecture  
**Last updated:** 2026-08-03

## 1. Architectural objective

The platform must combine a centrally managed online School ERP/SIS with a reliable offline timetable solver and affordable school hardware. The main design challenge is not raw traffic volume; it is preserving tenant isolation, financial correctness, audit evidence, and synchronization boundaries while keeping deployment and support simple.

The recommended architecture is a **cloud modular monolith plus specialized clients and local connectors**.

## 2. Context view

```text
 Public visitors        Teachers/Guardians/Staff       Administrators
        |                         |                          |
        +------------ HTTPS responsive web ----------------+
                                  |
                         CDN / WAF / load balancer
                                  |
                    Django + DRF stateless application
                       /          |             \
             PostgreSQL      Redis / queue     Object storage
             system of       background        files, exports,
             record          workers           tutorials, PDFs
                                  |
                       Messaging/provider adapters

 Administrator workstation
        |
 Electron desktop client -- authenticated HTTPS --> cloud API
        |
        +-- local SQLite timetable workspace/cache
        +-- packaged Python timetable solver
        +-- local print integration
        +-- optional device connector supervision

 School LAN biometric devices
        |
 Trusted local connector -- buffered, idempotent upload --> cloud ingestion
```

## 3. Major runtime components

### 3.1 React web application

The web application provides:

- public school/platform information and tutorials;
- authenticated portals for teachers, guardians, staff, and managers;
- school management dashboards and operational workflows;
- responsive and RTL-first interfaces for phone and desktop use;
- role-aware navigation, while treating API authorization as authoritative.

The web frontend must not receive database credentials or infer tenant authority from a URL alone. It sends authenticated API requests; the backend resolves membership, tenant, entitlements, and scope.

### 3.2 Electron administrative application

Electron is not a second independent ERP server. It provides capabilities that benefit from local execution:

- download and cache a versioned scheduling input snapshot;
- run the existing Python timetable solver without internet;
- review and edit local schedule drafts;
- upload a candidate timetable for conflict validation and publication;
- print through the operating system;
- optionally monitor or host approved local hardware connectors;
- expose the online management UI when connected.

The current React/Vite interface, local Express/TypeORM API, SQLite database, and Python solver can be evolved rather than discarded. The local API boundary should be narrowed to scheduling/device/OS integration. Cloud business modules should call Django APIs.

### 3.3 Django modular monolith

The cloud backend should be one deployable application initially, separated into domain modules with explicit service boundaries. Suggested Django applications:

```text
platform_core        tenants              entitlements
identity             people               students
academics            scheduling           attendance
examinations         courses              discipline
hr                   payroll              finance
inventory            transport            communications
reporting            integrations         audit
files                support_operations
```

Each module owns its domain rules and migrations. Cross-module behavior should use application services and domain events/outbox records, not direct mutation of another module's tables from controllers or background tasks.

Django Admin is for vendor staff to provision tenants, inspect support metadata, manage controlled reference data, and perform audited break-glass support. It is not the school-facing CMS.

### 3.4 PostgreSQL

PostgreSQL is the authoritative database for all online business modules. The initial tenancy strategy is a shared database/shared schema with a mandatory tenant key on tenant-owned records. Isolation uses multiple layers:

- authenticated tenant membership resolution;
- tenant-aware query/service abstractions;
- foreign keys and uniqueness constraints that include tenant ownership;
- database roles and optional row-level security as defense in depth;
- automated cross-tenant negative tests.

Financial journals, raw biometric events, audit logs, outbox entries, and issued document metadata use append-oriented structures. Large event tables should be indexed by tenant and time and can be partitioned when measured volume justifies it.

### 3.5 Redis, durable queue, and workers

Background workers handle work that is slow, bursty, retryable, or provider-dependent:

- biometric event validation, deduplication, mapping, and projection;
- bulk messages and delivery-status polling;
- large PDF/Excel report generation;
- imports and exports;
- timetable publication side effects;
- file scanning/processing;
- scheduled fee, payroll, notification, and retention jobs.

Every job must carry tenant ID, actor/system principal, correlation ID, idempotency key where applicable, attempt count, and safe retry policy. Jobs must re-check authorization/workflow preconditions if execution is delayed.

### 3.6 Object storage

Object storage holds user uploads, generated exports, tutorial media, document attachments, and archived PDFs. Records in PostgreSQL hold tenant ownership, classification, checksum, content type, size, retention, and authorization metadata. Objects are private by default and accessed through short-lived authorized URLs or streamed endpoints.

### 3.7 Device connector

Biometric hardware is integrated through an adapter-based local connector, not directly trusted as the business system of record. The connector:

- identifies the tenant, site, and registered device;
- reads vendor logs or receives device events;
- persists a local encrypted buffer when internet is unavailable;
- assigns/retains vendor event identifiers for deduplication;
- batches and retries uploads;
- monitors clock drift, storage, connectivity, and firmware/SDK details;
- never logs secrets or fingerprint templates.

Adapters normalize vendor-specific records into a versioned canonical event envelope.

## 4. Principal data flows

### 4.1 Normal online operation

1. A user authenticates.
2. The backend resolves the login account, active memberships, selected tenant context, entitlements, permissions, and scopes.
3. The API validates input and workflow state in a database transaction.
4. The domain change and audit/outbox evidence commit atomically where required.
5. Background workers perform external or heavy side effects.
6. The UI receives committed status and later observes delivery/export completion.

### 4.2 Offline timetable generation

1. Electron authenticates online and requests a versioned scheduling snapshot.
2. Django builds the tenant-scoped snapshot of teachers, classes, subjects, rooms, periods, assignments, and constraints.
3. Electron stores the snapshot and revision in its local SQLite workspace.
4. The Python solver runs fully offline; the user reviews and edits local drafts.
5. When online, Electron uploads the candidate with source revision and client-generated idempotency key.
6. Django checks entitlement, permission, schema version, source staleness, changed dependencies, and publication conflicts.
7. A permitted user resolves conflicts and publishes a central timetable version.
8. Teacher/staff portals read only published or explicitly shared versions.

There is no automatic field-level merge of arbitrary school data. A schedule is an explicit versioned artifact.

### 4.3 Manual student attendance

1. The teacher opens an attendance sheet for an assigned class/session.
2. The API returns the roster and current sheet version.
3. The teacher submits the entire sheet once with an idempotency key.
4. The backend validates teacher relationship, date/session, roster, locks/version, and allowed status values.
5. Attendance records, sheet submission, and audit evidence commit transactionally.
6. Notification intents are written to the outbox and processed asynchronously.

### 4.4 Biometric attendance

1. The device performs local biometric matching and records a device-user event.
2. The connector buffers and uploads normalized events in batches.
3. Cloud ingestion authenticates the connector/device and stores immutable raw events idempotently.
4. A worker maps device-user codes to tenant-owned student/employee identities.
5. Rules project student attendance or employee timekeeping and create exceptions.
6. Authorized users resolve exceptions without modifying the raw event.
7. Approved employee timesheets can later feed payroll.

### 4.5 Financial receipt and printing

1. A cashier records a payment with allocation and idempotency token.
2. The finance service validates receivables, cashbox, period, currency, permission, and approval policy.
3. Receipt, allocation, journal entry, sequence number, and audit/outbox evidence commit atomically.
4. The server produces an official PDF from committed data.
5. Browser or Electron prints the PDF on a normal A4 printer.
6. A failed print can be retried; reprints are logged and never duplicate the payment.

## 5. API and integration conventions

- Version public/internal client APIs explicitly, beginning with `/api/v1/`.
- Use opaque IDs at external boundaries; never authorize by ID shape.
- Derive tenant from the authenticated membership/context, never an arbitrary body `schoolId`.
- Require idempotency keys for payments, receipt issuance, bulk attendance, device batches, messaging requests, imports, and schedule uploads.
- Use optimistic concurrency/version fields for editable aggregates.
- Return stable machine-readable error codes plus localized messages.
- Propagate correlation IDs through HTTP, jobs, outbox, logs, and provider calls.
- Treat time as timezone-aware instants; store UTC and preserve local school/date context needed for official records.
- Publish a versioned event envelope for integrations; consumers must tolerate additive fields.

## 6. Deployment topology

### Initial production topology

- CDN/WAF for static assets, rate limiting, and edge protection
- load balancer/API gateway
- at least two stateless Django application instances where the chosen tier permits
- managed PostgreSQL with automated backups and point-in-time recovery
- connection pooling
- managed Redis or equivalent queue/broker support
- separate worker processes and scheduler
- private object storage plus CDN for public assets
- centralized structured logs, metrics, traces, error reporting, and alerting
- automated migrations and rollback-aware deployment pipeline

This topology can serve the stated target of approximately 100 schools without a microservice split if queries, reports, and jobs are designed correctly. Scale application and worker instances horizontally; scale PostgreSQL based on measured connections, storage, IOPS, and query latency.

### Optional premium isolation

A future contract may offer a dedicated database or deployment. Domain APIs must not assume shared-schema internals so this remains possible, but the initial product should not bear the operational cost of one VPS per school.

## 7. Availability and failure behavior

- Web/API instances are replaceable and keep no durable local business state.
- Database unavailability stops authoritative writes rather than accepting unsafe local ERP mutations.
- Jobs retry transient failures with exponential backoff and dead-letter review.
- Messaging provider failure does not roll back attendance or finance.
- Printer failure does not roll back receipt issuance.
- Device/internet failure buffers biometric events locally and exposes backlog/health status.
- Solver failure affects only the local schedule attempt; it does not corrupt published timetables.
- Every external integration has timeouts, circuit protection, bounded retries, and reconciliation tools.

## 8. Evolution rules

Do not split a module into a microservice merely because it is large. Consider extraction only when there is a measured independent scaling, failure-isolation, security, data-residency, or team-ownership need. Before extraction, enforce clean module ownership, an outbox/event boundary, API contracts, and observability inside the monolith.

