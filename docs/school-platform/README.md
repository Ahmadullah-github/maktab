# Maktab School Platform Documentation

**Document status:** Baseline design with platform foundation in implementation  
**Last updated:** 2026-08-03  
**Scope:** Product, architecture, security, delivery, and feature tracking  
**Implementation effect:** The repository now contains the local development stack, Django platform
foundation, separated local/cloud APIs, secure Electron transport boundary, and role-aware UI shell.
Business modules remain Discovery or Specified unless the tracker says otherwise.

## 1. Purpose

Maktab is evolving from an advanced offline timetable generator into a cloud-first, enterprise-grade school management platform for schools in Afghanistan. The timetable engine remains an important subsystem, but the product boundary expands to student administration, academics, attendance, examinations, courses, discipline, HR, payroll, finance, inventory, transport, communications, reporting, portals, and hardware integrations.

This documentation is the source of truth for the decisions made so far. It is designed to prevent feature work from becoming a set of disconnected screens. Each module specification includes stable requirement identifiers, business rules, permissions, dependencies, acceptance criteria, open questions, and a checklist that can later be linked to issues and releases.

## 2. Product position

The target product is a **multi-tenant School ERP/SIS delivered as SaaS**, with specialized desktop capabilities where local execution is valuable.

- The cloud platform is authoritative for operational and business data.
- The Electron application is a trusted administrative client, local timetable workspace, solver host, print integration, and optional hardware bridge.
- Teachers, guardians, and other users can use responsive browser portals from phones or laptops.
- Timetable generation is the only required offline business workflow in the current baseline.
- Contract entitlements determine which purchased modules and limits are available to a school.
- Authorization determines what an individual user may see or do inside the purchased modules.

## 3. Documentation map

### Canonical design

| Document | Purpose |
|---|---|
| [Decisions](DECISIONS.md) | Confirmed, provisional, and unresolved product decisions |
| [System architecture](SYSTEM_ARCHITECTURE.md) | Cloud, Electron, data, integration, and deployment architecture |
| [Domain model](DOMAIN_MODEL.md) | Tenant boundaries, core entities, relationships, and ownership |
| [Security, tenancy, and access control](SECURITY_TENANCY_RBAC.md) | Authentication, authorization, isolation, finance controls, and audit |
| [Non-functional requirements](NON_FUNCTIONAL_REQUIREMENTS.md) | Availability, performance, recovery, privacy, localization, and quality targets |
| [Delivery roadmap](DELIVERY_ROADMAP.md) | Sequencing, gates, migrations, and release strategy |
| [Glossary and open terminology](GLOSSARY.md) | Product vocabulary and Afghan school terms requiring samples or confirmation |

### Feature specifications and trackers

| Area | Specification |
|---|---|
| Organizations, contracts, and entitlements | [organizations-contracts.md](features/organizations-contracts.md) |
| Identity, accounts, and access | [identity-access.md](features/identity-access.md) |
| People, students, guardians, and admissions | [people-students-guardians.md](features/people-students-guardians.md) |
| Academic structure and head-teacher administration | [academics-head-teacher.md](features/academics-head-teacher.md) |
| Offline school curriculum | [school-curriculum.md](features/school-curriculum.md) |
| Timetable and scheduling | [scheduling.md](features/scheduling.md) |
| Attendance and biometrics | [attendance-biometric.md](features/attendance-biometric.md) |
| Examinations, grades, and question bank | [examinations-grades-question-bank.md](features/examinations-grades-question-bank.md) |
| Course management | [courses.md](features/courses.md) |
| Discipline and student welfare | [discipline.md](features/discipline.md) |
| Human resources | [hr-workforce.md](features/hr-workforce.md) |
| Payroll | [payroll.md](features/payroll.md) |
| Finance and accounting | [finance-accounting.md](features/finance-accounting.md) |
| Inventory, store, library, books, and uniforms | [inventory-library.md](features/inventory-library.md) |
| Transport | [transport.md](features/transport.md) |
| Messaging and notifications | [communications.md](features/communications.md) |
| Mobile experience, diary, and feedback | [mobile-diary-feedback.md](features/mobile-diary-feedback.md) |
| Public site and authenticated portals | [portals-public-site.md](features/portals-public-site.md) |
| Reports and analytics | [reporting-analytics.md](features/reporting-analytics.md) |
| Hardware and external integrations | [hardware-integrations.md](features/hardware-integrations.md) |
| Audit, compliance, and operational oversight | [audit-compliance.md](features/audit-compliance.md) |

The cross-module rollout view is maintained in [IMPLEMENTATION_TRACKER.md](IMPLEMENTATION_TRACKER.md).

## 4. Requirement and status conventions

Requirement IDs use a stable module prefix such as `FIN-`, `ATT-`, or `IAM-`. IDs must not be reused after a requirement is removed; mark the old requirement obsolete and create a new ID.

Feature trackers use these states:

- **Discovery:** terminology, documents, or business policy is not sufficiently defined.
- **Specified:** requirements and acceptance criteria are approved.
- **Designed:** data model, APIs, permissions, and user flows are reviewed.
- **Implementing:** code and migrations are in progress.
- **Verifying:** automated tests, security checks, and user acceptance are in progress.
- **Released:** enabled in production for at least one entitled tenant.
- **Deferred:** intentionally outside the current delivery window.

Unless explicitly marked otherwise, every feature in this baseline is in **Discovery** or **Specified**, not implemented.

## 5. Governing design principles

1. **Cloud authority:** PostgreSQL owns shared business truth; Electron SQLite never becomes a second ERP database.
2. **Explicit tenant context:** every tenant-owned record and request has a validated school organization context.
3. **Entitlement is not permission:** contracts expose modules; role and data scope authorize operations.
4. **Server-enforced security:** hidden navigation is usability, not authorization.
5. **Immutable evidence:** biometric events, posted accounting entries, receipts, approvals, and audit history are append-only or reversed, never silently rewritten.
6. **Offline by exception:** only timetable drafting/generation is required offline; other offline workflows require a separate approved design.
7. **Asynchronous heavy work:** messaging, large reports, imports, biometric projection, and file generation run through durable background jobs.
8. **Modular monolith first:** deploy a well-bounded Django application before considering microservices.
9. **Localized by design:** Dari/Persian and Pashto, RTL layouts, Afghanistan-specific calendars, currency, and official forms are domain requirements.
10. **Operational simplicity:** the architecture must be supportable for approximately 20 schools after one year and 100 after three years without premature infrastructure complexity.

## 6. Scope boundaries

### Included in the platform vision

- Multi-school SaaS management and per-school contracts
- Administrative Electron application
- Responsive staff, teacher, and guardian portals
- Offline timetable generation and synchronized publication
- Student, academic, employee, finance, and inventory records
- Biometric devices and normal A4 printing
- Dari/Persian and Pashto communications
- Internal company operations needed to provision and support customer schools

### Not yet committed

- A full public website page-builder CMS
- Native mobile applications; a responsive/PWA portal is the initial assumption
- Microservices, Kubernetes, or a separate VPS for every school
- Offline finance, admissions, or attendance entry
- Storage of fingerprint images/templates in the cloud
- Cross-school identity or data sharing
- Final legal/accounting form behavior before domain-expert validation

## 7. Change governance

A change that affects tenant isolation, posted finance, identity, audit evidence, biometric privacy, or the offline synchronization protocol requires an architecture decision entry before implementation. Feature documents may refine details, but they must not contradict a confirmed decision in [DECISIONS.md](DECISIONS.md) without updating that decision and its consequences.
