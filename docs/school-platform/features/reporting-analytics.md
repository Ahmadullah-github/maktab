# Reporting and Analytics

**Module prefix:** `RPT`  
**Current status:** Architecture specified; report catalog discovery pending  
**Primary owners:** Module owners, school leadership, finance, vendor reporting team

## Objective

Replace dozens of disconnected hard-coded reports with a governed catalog of consistent, authorized, localized reports and dashboards that reconcile to source records and official samples.

## Requirements

| ID | Requirement |
|---|---|
| RPT-001 | Maintain a report catalog with stable code, owner, definition, data source, filters, totals, recognition basis, freshness, permissions, and template version. |
| RPT-002 | Apply tenant, entitlement, role, scope/relationship, period lock, and sensitive-field rules before query and export. |
| RPT-003 | Support interactive summaries for bounded data and asynchronous jobs for large PDF/Excel exports. |
| RPT-004 | Generate A4 multilingual/RTL PDFs and spreadsheet exports with tenant branding, parameters, generated time, actor, and page totals. |
| RPT-005 | Version official formats and preserve the template/rule version used for historical output. |
| RPT-006 | Provide drill-down only when the viewer can access underlying records; aggregate access does not automatically grant detail. |
| RPT-007 | Label data cut-off/freshness and distinguish live authoritative reports from delayed analytical summaries. |
| RPT-008 | Reconcile finance, payroll, inventory, attendance, and result reports to their authoritative ledgers/batches. |
| RPT-009 | Audit sensitive report generation/download and use expiring private file links. |
| RPT-010 | Schedule approved reports and delivery only through authorized recipients/channels. |
| RPT-011 | Provide data-quality reports for imports, missing mappings, exceptions, duplicates, and unresolved workflow states. |
| RPT-012 | Avoid public rankings or sensitive child comparisons without approved purpose and privacy safeguards. |

## Report definition template

Every report must state: business question; report code/title/translations; owner; audience/permission; source entities; filters; as-of/cut-off; row grain; calculations; totals/subtotals; currency/timezone/calendar; inclusion/exclusion rules; drill-down; output formats; template sample; reconciliation target; privacy class; retention; performance target; acceptance owner.

## Architecture

Small reports query tenant-scoped read services. Heavy reports enqueue a job, capture authorized parameters/context, generate a private immutable artifact, store checksum/expiry, and notify the requester. Materialized views/read models may be introduced after correctness and freshness contracts are defined.

## Core entities

`ReportDefinition`, `ReportVersion`, `ReportPermission`, `ReportRequest`, `ReportJob`, `ReportArtifact`, `DashboardDefinition`, `MetricDefinition`, `ScheduledReport`, `ReconciliationResult`.

## Acceptance criteria

- Report totals match documented source queries and signed real samples.
- Large export does not block API workers and cannot be downloaded by another tenant/user.
- Changing a report template does not alter archived official output metadata.
- A user without detail permission cannot drill from an allowed aggregate to names.
- Rerunning with same cut-off/data/version is reproducible or explicitly labels changed source data.
- Finance/subledger reports have automated reconciliation checks.

## Open questions

- Collect and prioritize the 20+ course and 24+ finance reports plus academic/HR forms.
- Official versus management-only status and signature/seal requirements.
- Calendar, number, currency, ranking, and statistical disclosure rules.
- Retention and scheduled delivery needs.

## Implementation tracker

- [ ] Inventory every requested report with sample and business owner
- [ ] Consolidate duplicates into parameterized definitions
- [ ] Approve report catalog/definition/versioning model
- [ ] Build secure synchronous/asynchronous report framework
- [ ] Build RTL PDF/Excel template and font test suite
- [ ] Implement reconciliation and data-quality framework
- [ ] Implement prioritized reports by module phase
- [ ] Performance/privacy/security acceptance
- [ ] Mark Released per report code/version

