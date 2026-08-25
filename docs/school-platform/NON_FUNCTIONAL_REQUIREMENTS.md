# Non-Functional Requirements

**Status:** Initial measurable targets; contract-specific SLOs remain open  
**Last updated:** 2026-08-03

## 1. Capacity assumptions

The baseline plans for:

- about 20 tenant schools after year one and 100 after year three;
- up to approximately 100 operational staff accounts per school plus teachers/guardians;
- up to approximately 1,000 students at a larger school using biometric attendance;
- morning-only or entry/exit attendance, potentially producing 20–40 million student events/year across 100 schools and 200 school days;
- morning attendance and school opening as the most important synchronized bursts;
- large periodic load during fee collection, result publication, payroll, and report generation.

These are planning assumptions, not licensing limits. Load tests must use measured pilot-school behavior and realistic event bursts, not uniform traffic.

## 2. Availability and reliability

| ID | Requirement |
|---|---|
| NFR-AVL-01 | No single web/API instance may hold required durable business state. |
| NFR-AVL-02 | Production uses health checks, automatic instance replacement, and rolling/blue-green deployment appropriate to the provider. |
| NFR-AVL-03 | External messaging, printing, and report-generation failure must not corrupt the originating business transaction. |
| NFR-AVL-04 | Device connectors buffer events during internet/cloud interruption and resume idempotently. |
| NFR-AVL-05 | Background jobs use bounded retries, dead-letter review, and operator-visible status. |
| NFR-AVL-06 | Published schedules, posted journals, issued receipts, and raw device evidence remain recoverable and versioned. |

Contractual uptime is unresolved. The initial engineering objective should be at least 99.9% monthly availability for the online service excluding agreed maintenance, with stricter commitments introduced only alongside matching operations and pricing.

## 3. Performance targets

Initial service objectives, measured server-side under expected load:

- common interactive reads: p95 under 500 ms, p99 under 1.5 s;
- common validated writes: p95 under 800 ms, excluding external delivery/large document generation;
- login and tenant-context selection: p95 under 1.5 s;
- manual attendance sheet submission: p95 under 2 s for a normal class;
- biometric ingestion acknowledgement: p95 under 1 s per normal batch after durable acceptance;
- portal initial usable content: target under 3 s on representative low-bandwidth/mobile hardware after static caching;
- large reports return a job acknowledgement quickly and complete asynchronously under a report-specific target.

Targets must be refined through pilots. Every endpoint has pagination/bounds; no dashboard may run unbounded tenant-wide aggregation in the request path.

## 4. Scalability

- Application and worker processes scale horizontally.
- Connection pooling prevents instance count from exhausting PostgreSQL.
- Indexes begin with tenant and domain access patterns where appropriate.
- Biometric/audit/outbox tables are designed for time-based retention/partitioning if measured growth requires it.
- Reporting uses read-optimized queries/materialized summaries or replicas only after correctness is established.
- Object payloads and generated documents stay outside database rows.
- Per-tenant quotas and fair-use controls stop one school/report/import from starving others.

## 5. Recovery and continuity

| ID | Initial objective |
|---|---|
| NFR-DR-01 | Managed PostgreSQL automated backups with point-in-time recovery. |
| NFR-DR-02 | Define production RPO target of 15 minutes or better and RTO target of 4 hours, subject to contract approval. |
| NFR-DR-03 | Restore tests occur at least quarterly and record achieved RPO/RTO. |
| NFR-DR-04 | Object storage versioning/retention and backup policy matches document criticality. |
| NFR-DR-05 | Connector queues survive process/device-host restart and expose oldest pending event. |
| NFR-DR-06 | Electron schedule workspaces can be exported/backed up and never overwrite a newer published cloud version silently. |
| NFR-DR-07 | Runbooks cover database recovery, credential compromise, messaging outage, queue backlog, device backlog, failed migration, and tenant isolation incident. |

## 6. Security and privacy

The mandatory controls in [SECURITY_TENANCY_RBAC.md](SECURITY_TENANCY_RBAC.md) are non-functional acceptance requirements. Additionally:

- encryption in transit is mandatory; encryption at rest uses provider-supported controls;
- secrets have owners, rotation process, least privilege, and no repository inclusion;
- critical vulnerabilities block release until mitigated or formally accepted;
- security events and audit pipeline health are monitored;
- data classification covers public, internal, confidential, highly sensitive/financial, and biometric-related metadata;
- retention and access are purpose-limited, especially for minors.

## 7. Correctness and consistency

- Financial posting, receipt allocation, inventory movement, result publication, and attendance-sheet submission are transactionally consistent.
- Retryable commands are idempotent.
- Concurrent edits use optimistic locking or domain-specific locking and return an explicit conflict.
- Time-based rules use an assigned school timezone and calendar; server clock synchronization is monitored.
- All money uses fixed precision and explicit currency.
- Derived reports can be eventually consistent only when labeled; official receipts/ledgers/results read authoritative committed data.
- Background effects use a transactional outbox or equivalent to avoid a committed record with a lost required event.

## 8. Localization and accessibility

- Dari/Persian and Pashto are first-class product languages; English may remain an administrative/development fallback.
- All user-facing text uses translation resources, not hard-coded strings.
- RTL direction, mixed Latin/numeric content, fonts, line breaking, sorting, search normalization, and printed PDFs are tested.
- Dates display using configured Afghan school conventions while preserving unambiguous stored instants; the calendar requirement needs confirmation.
- Currency, number separators, names, addresses, and official identifiers are configurable.
- Core web workflows support keyboard navigation, readable contrast, semantic labels, and responsive zoom.
- Low-bandwidth behavior includes compressed assets, paginated data, cached static tutorials, clear retry state, and no unnecessary large bundles.

## 9. Observability and operations

- Structured logs include timestamp, service/version, environment, correlation ID, safe tenant identifier, actor type, route/job, outcome, and latency.
- Metrics cover HTTP errors/latency, DB/query health, pool saturation, queue depth/age, job failures, message delivery, connector/device last seen, biometric backlog, report duration, and storage growth.
- Distributed traces connect API, database, queue, worker, and provider operations for sampled/high-value flows.
- Alerts are actionable, routed, severity-defined, and linked to runbooks.
- Tenant support views show subscription, entitlement, app version, connector status, and job health without exposing unnecessary business payloads.
- Audit logs are distinct from diagnostic logs and have stronger retention/integrity controls.

## 10. Maintainability and delivery quality

- Domain modules have explicit ownership and public service interfaces.
- API and event schemas are versioned and backward-compatible across a supported Electron upgrade window.
- Database migrations are reviewed for locking, backfill, rollback/forward-fix, and tenant impact.
- Tests include unit, domain invariant, API contract, tenant isolation, permission, migration, integration, load, and end-to-end critical-path coverage.
- Feature flags/entitlements are safe defaults and do not replace migrations or permissions.
- Electron updates are signed, integrity-checked, staged, and compatible with the supported cloud API versions.
- Every released module has operational documentation, support diagnostics, and data export/reconciliation tools.

## 11. Definition of production-ready

A feature is production-ready only after functionality, permissions, tenant isolation, audit, localization, failure recovery, observability, data migration, support/runbook, and acceptance criteria are verified. A completed UI alone is not a completed feature.

