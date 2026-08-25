# Cross-Module Implementation Tracker

**Status:** Platform foundation implementing  
**Last updated:** 2026-08-21

This file tracks program-level readiness. Detailed capability checklists and acceptance criteria live in each linked feature specification. Update status only when the lifecycle definition in [README.md](README.md) is satisfied.

## 1. Module matrix

| Prefix | Module | Current state | Earliest phase | Risk | Principal blockers/dependencies |
|---|---|---:|---:|---|---|
| ORG | [Organizations/contracts](features/organizations-contracts.md) | Implementing foundation | 1 | High | Unit hierarchy, package limits/usage, SLA |
| IAM | [Identity/access](features/identity-access.md) | Implementing foundation | 1 | Critical | Username/recovery/MFA, fine-grained scopes |
| AUD | [Audit/compliance](features/audit-compliance.md) | Implementing foundation | 1 | Critical | Event catalog, retention/legal policy, outbox |
| PRT | [Public site/portals](features/portals-public-site.md) | Implementing shell | 1 | High | Role journeys, public content ownership |
| STD | [People/students/guardians](features/people-students-guardians.md) | Discovery | 2 | High | Forms, identifiers, guardian policy |
| ACD | [Academics/head teacher](features/academics-head-teacher.md) | Discovery | 2 | High | School structure, calendar, policy samples |
| RPT | [Reporting/analytics](features/reporting-analytics.md) | Discovery | 2 | High | Official report catalog and samples |
| SCH | [Timetable/scheduling](features/scheduling.md) | Existing local; API boundary migrated | 3 | High | Snapshot/version/sync design, IAM/academics |
| SCU | [School curriculum](features/school-curriculum.md) | Verifying; automated gates passed | 3 | Medium | School UAT and release acceptance |
| ATT | [Attendance/biometrics](features/attendance-biometric.md) | Discovery | 4 | Critical | Rules, device certification, connector |
| COM | [Messaging](features/communications.md) | Discovery | 4 | High | Provider/consent/language policy |
| EXM | [Exams/grades/question bank](features/examinations-grades-question-bank.md) | Discovery | 5 | Critical | شقه and official result/rule samples |
| FIN | [Finance/accounting](features/finance-accounting.md) | Discovery | 6 | Critical | Afghan expert, forms, chart/policies |
| HRM | [Human resources](features/hr-workforce.md) | Discovery | 7 | High | Employment/leave/privacy rules |
| PAY | [Payroll](features/payroll.md) | Discovery | 7 | Critical | Tax/pay policy; ATT/HRM/FIN |
| INV | [Inventory/library](features/inventory-library.md) | Discovery | 7 | High | Item/cost/loan policies; FIN |
| CRS | [Courses](features/courses.md) | Discovery | 8 | High | Definition of کورس; FIN/ATT/INV/PAY |
| DSP | [Discipline](features/discipline.md) | Discovery | 8 | Critical | Child-safety, case/appeal/retention policy |
| TRN | [Transport](features/transport.md) | Discovery | 8 | High | Route/rider/vehicle boundary; FIN/COM |
| MOB | [Mobile/diary/feedback](features/mobile-diary-feedback.md) | Discovery | 4+ | High | PWA evaluation, diary and rating safeguards |
| INT | [Hardware/integrations](features/hardware-integrations.md) | Discovery | 4 | Critical | Device/provider selection and certification |

## 2. Platform foundation checklist

- [ ] Confirm cloud provider, environments, network, secrets, and managed services
- [x] Initialize Django/DRF modular monolith and supported dependency policy
- [x] Establish shared PostgreSQL tenant ownership and an initial isolation test harness
- [ ] Implement organizations, contracts, subscriptions, entitlements, and usage
- [ ] Complete accounts, memberships, permissions, scopes, sessions, and credential issuance (core
      accounts/memberships/RBAC/session/JWT capability path is implemented)
- [ ] Implement audit, correlation, transactional outbox, queue/workers, and job operations
- [ ] Implement object storage, private files, PDF foundation, and upload scanning
- [ ] Implement Dari/Pashto localization, RTL design, timezone/calendar/currency foundations
- [ ] Implement structured logs, metrics, tracing, alerts, and support diagnostics
- [ ] Implement automated backup/PITR and complete a restore exercise
- [ ] Implement CI/CD, safe migrations, dependency/security checks, and environment promotion
- [ ] Complete two-tenant isolation/security acceptance before operational data pilots

### Implemented foundation evidence

- uv workspace and locked Django 5.2 / Python 3.12 toolchain
- local PostgreSQL, Redis, MinIO, and Mailpit dependency stack
- tenant organizations and hierarchical school/course units
- separate Person and LoginAccount concepts, memberships, roles, permissions, and scoped role links
- contracts and tenant module entitlements
- append-only audit event model and authentication audit events
- browser session/CSRF and Electron short-lived JWT transport
- server-validated membership context and role-entitlement capability intersection
- `/api/v1` platform and `/local-api/v1` offline timetable namespace separation
- shared responsive platform login/module prototype with school context switching
- automated authentication, tenant isolation, entitlement, health, and audit tests

## 3. Discovery artifact tracker

- [ ] Tenant/school/campus/course-center organizational examples
- [ ] Role/responsibility and approval matrices from multiple schools
- [ ] Student admission, identity, enrollment, transfer, and archive forms
- [ ] Academic calendar, classes, subjects, grouping, lesson plans, and year rollover rules
- [ ] شقه blank/completed samples and mark-entry workflow
- [ ] سه پارچه رفت/آمد samples and transfer workflow
- [ ] کورس structure, lifecycle, accounting, and report examples
- [ ] سویه definition, assessment, status, and output samples
- [ ] Exam cards/timetables/result tables for grade groups and three-year records
- [ ] Student/employee manual and biometric attendance policies
- [ ] Biometric candidate device test results/SDK agreements
- [ ] Employee, agreement, leave, responsibility transfer, and clearance forms
- [ ] Payroll calculations, tax forms, advances/guarantees, reward/penalty rules
- [ ] Fee, family payment, receipt, cashbook, arrears, expense, tax, balance, and approval samples
- [ ] Course 20+ and finance 24+ report inventory with owners/calculations
- [ ] Inventory/store/library/uniform/book/loan/sale/count forms
- [ ] Transport route/rider forms and safety rules
- [ ] Messaging providers, consent, account linking, and template terminology
- [ ] Discipline/incident card, investigation, action, appeal, disclosure, and retention policy
- [ ] Afghanistan legal/privacy/education/accounting/tax/record-retention expert review

## 4. Pilot release checklist

For every released capability:

- [ ] Approved requirement IDs and signed acceptance owner
- [ ] Domain model, lifecycle, API/event contract, migration/import plan
- [ ] Entitlement, permission matrix, scope/relationship, and separation-of-duty review
- [ ] Cross-tenant and object-level negative tests
- [ ] Transaction, concurrency, idempotency, and reconciliation tests proportional to risk
- [ ] Audit event map and audit-pipeline failure behavior
- [ ] Dari/Pashto/RTL, accessibility, low-bandwidth, A4/PDF acceptance
- [ ] Privacy classification, retention, export, file, and support-access controls
- [ ] Performance/burst/background-job tests and capacity evidence
- [ ] Observability dashboards, alerts, support diagnostics, and runbooks
- [ ] Backup/restore or local-buffer/offline recovery test where applicable
- [ ] Pilot data reconciliation and user acceptance
- [ ] Release notes, training/tutorials, contract entitlement, rollout/rollback plan

## 5. Decision blockers

Open decisions `DEC-O01` through `DEC-O10` are maintained in [DECISIONS.md](DECISIONS.md). When resolved, update the decision, affected specifications, acceptance criteria, and this matrix in the same documentation change.
