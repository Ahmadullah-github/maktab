# Delivery Roadmap and Implementation Governance

**Status:** Recommended sequence; dates intentionally not committed  
**Last updated:** 2026-08-03

## 1. Strategy

The safest path is an incremental platform transformation, not a rewrite of the working scheduler and not simultaneous implementation of every school module. Each phase should deliver an end-to-end usable slice to a pilot school and establish reusable platform capabilities for the next phase.

## 2. Phase sequence

### Phase 0 — Discovery and compliance artifacts

Collect real examples and policies before schema/UI commitment:

- school organizational charts and roles;
- student admission forms and identifiers;
- شقه, سه پارچه, کورس, سویه definitions and samples;
- grade sheets, exam cards, result tables, transfer documents, and official reports;
- fee, receipt, cashbook, balance, payroll, tax, expense, and approval samples;
- attendance calendars/rules and biometric device candidate specs;
- Dari/Pashto terminology and print font validation;
- legal retention, privacy, accounting, and education requirements.

**Exit gate:** glossary resolved for the pilot slice; signed business process maps; data classifications; prioritized contract package.

### Phase 1 — SaaS foundation

Deliver the platform controls that every module depends on:

- Django/DRF modular project and deployment pipeline;
- PostgreSQL tenancy model and isolation tests;
- organizations, school units, contracts, subscriptions, and entitlements;
- accounts, temporary credentials, memberships, roles, permissions, scopes, and sessions;
- audit/outbox/job foundations;
- object storage, PDF foundation, localization, observability, backups, and support operations;
- responsive shell/public login/tutorial experience.

**Exit gate:** two test tenants prove isolation; restore exercise succeeds; role/entitlement checks work end to end; audit and job failure are observable.

### Phase 2 — Core school records

- people, students, guardians, employees, admissions, enrollment, academic year/term;
- grades/levels, classes/sections, subjects, teacher assignments;
- import/export and duplicate-resolution workflows;
- foundational reports and A4 document rendering.

**Exit gate:** one pilot school can import, reconcile, manage, and export its authoritative current-year roster without scheduler dependency.

### Phase 3 — Timetable cloud integration

- cloud scheduling snapshot/version APIs;
- Electron authentication and cloud tenant context;
- local snapshot/cache migration boundaries;
- offline solve/review/upload/conflict workflow;
- central review/publication and teacher portal timetable;
- signed Electron delivery/update compatibility policy.

**Exit gate:** a schedule generated offline from a cloud revision is safely published and visible online; stale uploads cannot overwrite new data.

### Phase 4 — Attendance and communications

- teacher class-sheet attendance;
- guardian attendance visibility and message templates;
- device registry, connector, raw event ingestion, deduplication, identity mapping, rules, and exceptions;
- employee punch/time-session foundation;
- provider adapters, outbox, retries, delivery tracking, consent/language preferences.

**Exit gate:** morning burst/load test passes; connector offline recovery is demonstrated; raw evidence and corrections remain separate; notifications reconcile.

### Phase 5 — Academic operations and examinations

- head-teacher workflows, lesson plans, grade entry, exams, exam cards/timetables;
- result calculation, approval/publication, official tables, deprived/pass/fail lists;
- question bank and controlled paper/group workflows;
- academic analytics and guardian result views.

**Exit gate:** a complete exam period can be configured, entered, approved, published, corrected, audited, and printed using pilot-approved rules.

### Phase 6 — Finance foundation and student billing

- chart of accounts, fiscal periods, cashboxes, journals, document sequences;
- fee plans/charges, family payments, allocation, receipts, arrears, discounts, refunds/reversals;
- daily cashier close/reconciliation and core statements;
- secure approvals, immutable posting, A4 receipts, and reprint audit.

**Exit gate:** external accounting/domain review; balanced postings; retry/concurrency tests; end-to-end cash reconciliation; no edit/delete of posted records.

### Phase 7 — HR, payroll, inventory, and procurement

- employee agreements, positions, responsibilities, leave, approved timesheets;
- payroll rules/run/approval/payment/accounting;
- items, stores, movements, library/textbook loans, uniforms/book sales, employee issues;
- purchase requests, approvals, receipt of goods, expenses, and finance integration.

**Exit gate:** payroll is reproducible from approved inputs; stock reconciles to movements; procure-to-pay and sale-to-ledger flows balance.

### Phase 8 — Courses, discipline, transport, advanced analytics

- course lifecycle, course teachers/students/books/attendance/finance;
- discipline types, cases, safeguards, actions, and reports;
- routes, stops, riders, assignments, vehicles/drivers as confirmed;
- report catalog expansion, dashboards, data archive/year rollover;
- contract packaging and premium deployment options if commercially justified.

## 3. Cross-cutting work in every phase

- Dari/Pashto translation and RTL print/UI verification
- permission matrix and cross-tenant negative testing
- audit event and sensitive-data review
- imports, exports, and reconciliation tools
- operational metrics, alerts, dashboards, and runbooks
- performance/load tests proportional to risk
- pilot user acceptance and terminology update
- migrations and backward compatibility with supported Electron versions

## 4. Feature implementation lifecycle

For each feature document:

1. Resolve listed open questions with named business owners and samples.
2. Promote requirements from Discovery to Specified.
3. Produce data model, API/event contracts, permission matrix, screens, states, error/recovery flows, and migration plan.
4. Review tenant/privacy/finance/child-safety impact.
5. Implement behind an entitlement/feature rollout strategy.
6. Verify automated tests, performance, localization, observability, and support tools.
7. Pilot with a controlled tenant and reconcile real output.
8. Mark Released only after production evidence; record deferred gaps explicitly.

## 5. Recommended work-item hierarchy

```text
Initiative: School Platform
  Epic: ATT — Attendance and Biometrics
    Capability: ATT-100 — Manual student attendance
      Story/Task: API, UI, permission, audit, tests, migration...
    Capability: ATT-200 — Device ingestion
    Capability: ATT-300 — Employee timekeeping
```

Requirement IDs in these documents should be referenced in issue titles, commits/PR descriptions, tests, release notes, and support documentation. Code implementation state should be tracked in an issue tracker; Markdown retains the durable specification and high-level checklist.

## 6. Release gates by risk class

### Standard module

- functional acceptance criteria
- permissions and tenant tests
- localization/accessibility
- migrations and rollback/forward-fix plan
- audit/observability and support notes

### Sensitive student/employee module

All standard gates plus privacy classification, relationship authorization, export controls, retention, and child/employee safeguards.

### Finance/payroll/biometric module

All prior gates plus domain-expert review, invariant/concurrency/idempotency tests, reconciliation, failure drills, immutable evidence verification, and staged pilot sign-off.

## 7. Migration rules for the existing application

- Preserve the current scheduler while extracting a stable scheduling snapshot contract.
- Do not migrate SQLite tables directly into PostgreSQL without domain mapping, tenant ownership, identifier reconciliation, and validation reports.
- Mark local-only fields and cloud-authoritative fields explicitly.
- Introduce cloud identity separately from any current local placeholder User entity.
- Replace client-supplied `schoolId` scaffolding with authenticated tenant context.
- Keep old Electron versions compatible only for a defined window; force safe upgrade before an API version is retired.
- Never let a failed migration or sync silently discard a local schedule draft.

## 8. Program risks

| Risk | Mitigation |
|---|---|
| Building many screens before rules/forms are understood | Phase 0 samples, signed workflows, requirement IDs, pilot acceptance |
| Tenant data leakage | isolation-by-construction, database constraints/RLS evaluation, automated negative tests |
| Finance behaves like editable CRUD | double-entry foundation, posting/reversal, approvals, expert review |
| Electron becomes a second ERP database | strict local boundary and versioned schedule artifact protocol |
| Device vendor lock-in/unreliable hardware | adapter contract, certification suite, local buffer, reconciliation |
| Messaging failures create incorrect business state | transactional outbox and delivery state separated from source record |
| Too much infrastructure too early | modular monolith, managed services, measurement before extraction |
| Incomplete Dari/Pashto or official print layouts | sample-driven terminology, RTL/PDF test suite, school sign-off |
| Role explosion and hidden privilege | permission catalog, templates + scopes, separation of duties, access review |

