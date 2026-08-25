# Domain Model and Data Ownership

**Status:** Conceptual baseline; not a physical database schema  
**Last updated:** 2026-08-03

## 1. Purpose

This model establishes vocabulary, ownership, and aggregate boundaries before table design. It deliberately avoids committing to every field. Physical schemas must preserve the tenant, history, audit, and workflow invariants below.

## 2. Ownership hierarchy

```text
Vendor / Platform Operator
└── Tenant Organization (one contracted school customer)
    ├── Contract + Subscription + Entitlements
    ├── School Unit / Campus / Course Center
    │   ├── Academic years, terms, levels, classes, sections
    │   ├── Departments and staff assignments
    │   ├── Devices, routes, stores, cashboxes
    │   └── Local policies and document sequences
    ├── People and tenant-specific profiles
    ├── Login memberships, roles, permissions, scopes
    └── Tenant-owned operational records
```

Every tenant-owned row must be attributable to exactly one tenant organization. School units are data scopes inside a tenant, not tenants themselves, unless a future contract explicitly provisions them separately.

## 3. Core identity model

### Person

A canonical human identity within the platform's allowed matching scope. A Person stores stable human attributes and contacts, not authorization. It may link to:

- `StudentProfile`
- `GuardianProfile`
- `EmployeeProfile`
- `TeacherProfile` as an employment/teaching specialization
- one or more distinct `LoginAccount` records where policy requires separate identities

A teacher who is also a guardian has one Person where confidently matched, but two login accounts as confirmed by product policy. Merging people is a privileged, audited process with reversible linkage history.

### LoginAccount

Owns username, password state, status, credential lifecycle, sessions, and security events. It does not by itself grant school access.

### TenantMembership

Links a login account to one tenant and carries status, role assignments, scopes, validity dates, and employment/guardian context. Effective access is evaluated through membership. Separate teacher and guardian accounts have separate memberships and audit identities.

### ContactPoint

Normalized phone/email/other channel endpoint linked to a Person or organization, with verification, preferred language, consent, purpose, and validity history. Contact uniqueness must not be assumed until the open phone-sharing policy is resolved.

## 4. Organizational and commercial model

| Aggregate | Responsibility |
|---|---|
| TenantOrganization | Legal/customer boundary and isolation root |
| SchoolUnit | Campus, branch, course center, or operational unit within a tenant |
| Contract | Commercial agreement, dates, service tier, support terms, and billing references |
| Subscription | Current lifecycle state: trial, active, grace, suspended, ended |
| Entitlement | Module, feature, limit, quota, approval mode, or hardware integration enabled by contract |
| UsageCounter | Measured seats, students, messages, storage, devices, or other billable/limited usage |

Entitlements never grant an individual permission. Subscription suspension behavior must distinguish read access, exports, safety operations, and new writes according to contract policy.

## 5. Student and academic model

```text
StudentProfile
  └── Enrollment (school unit + academic year + grade/level + status)
      ├── ClassMembership / Section placement
      ├── CourseEnrollment
      ├── GuardianRelationship(s)
      ├── Attendance records
      ├── Assessment results
      ├── Fee account / receivables
      └── Discipline / welfare records

AcademicYear
  └── Term / ReportingPeriod
      ├── Calendar and holidays
      ├── GradeLevel / Program
      ├── ClassGroup / Section
      ├── Subject offerings
      ├── Teacher assignments
      ├── Exams and assessments
      └── Timetable versions
```

Student identity, enrollment, class placement, and course registration are different concepts. A student can retain one profile while changing academic year, grade, class, status, or course participation. Historical records reference the enrollment/period in force at the time and are not rewritten by later transfers.

## 6. Timetable model

The existing scheduling domain remains centered on teachers, subjects, classes, rooms, periods, assignments, and constraints. The cloud adds versioned synchronization:

- `SchedulingSnapshot`: immutable input package and revision
- `ScheduleDraft`: optional uploaded candidate metadata
- `TimetableVersion`: versioned schedule with lifecycle (`draft`, `review`, `published`, `superseded`)
- `TimetableEntry`: class/teacher/subject/room/period assignment belonging to a version
- `Publication`: actor, time, validation result, and audience

Only published versions are official. Local SQLite schedule drafts have no independent official status.

## 7. Attendance and timekeeping model

Separate evidence from conclusions:

```text
DeviceRawEvent (immutable evidence)
       ↓ mapping/deduplication/rules
AttendanceProjection or EmployeePunch
       ↓ exception resolution
StudentAttendanceSheet / WorkSession
       ↓ approval
FinalAttendance / DailyTimesheet
       ↓ controlled downstream use
Notifications / PayrollInput
```

`DeviceRawEvent` includes tenant, site, device, device user code, event timestamp, received timestamp, direction, method/status, vendor event ID, connector version, and mapping state. It does not contain a fingerprint image/template by default.

Student attendance is associated with an attendance day/session/class sheet. Employee timekeeping supports shifts, punches, breaks, work sessions, leave, exceptions, corrections, and approvals.

## 8. Examinations and grading model

| Entity | Purpose |
|---|---|
| AssessmentScheme | Defines assessment components, weights, pass rules, and grade scale |
| ExamSession | Exam period, eligibility, timetable, rooms, and invigilation |
| Assessment | Subject/class assessment with maximum score and publication state |
| GradeEntryBatch | Teacher/authorized entry workflow and lock/version |
| Result | Student score/grade with provenance and approval state |
| ResultPublication | Official release to portals/reports |
| QuestionBankItem | Versioned question, subject, level, language, difficulty, owner, status |
| QuestionGroup/Paper | Selected questions and controlled exam-paper lifecycle |

Official results are versioned and locked after publication. Corrections use an approval trail and retain the previous value.

## 9. HR and payroll model

An `EmployeeProfile` holds employment identity; `EmploymentAgreement` and `PositionAssignment` hold dated terms and responsibilities. HR history uses effective dates rather than overwriting prior assignments.

Payroll is a separate bounded domain:

- pay policy and earning/deduction rules;
- employee compensation assignment;
- approved attendance/time input;
- payroll period and payroll run;
- employee calculation and line items;
- approval, posting, payment, payslip, and reversal;
- accounting journal references.

Payroll calculations store rule versions and inputs so a historical payslip can be reproduced and explained.

## 10. Finance and accounting model

```text
Student/Family account
  ├── FeeCharge / Invoice ──┐
  ├── Discount/Scholarship  ├── Receivable balance
  └── Payment/Receipt ──────┘
                 |
                 v
        JournalEntry (posted)
          ├── debit JournalLine(s)
          └── credit JournalLine(s)

Procurement / Expense / Payroll / Inventory sale
                 └──────────────> JournalEntry
```

Core aggregates include chart of accounts, fiscal period, journal entry/lines, cashbox/bank account, document sequence, fee plan, charge, family payment, allocation, receipt, refund/reversal, expense, purchase request, approval, supplier, employee advance/guarantee, tax liability, and reconciliation.

Journal entries must balance. Posted entries cannot be edited or deleted. Operational documents link to their accounting entry; accounting data is not reconstructed from mutable screens later.

## 11. Inventory, library, and sales model

- `ItemDefinition`: book, textbook, study book, uniform, consumable, fixed asset, or other good
- `StockLocation`: store/warehouse/site
- `StockMovement`: receipt, issue, return, transfer, adjustment, sale, or write-off
- `StockLot`: optional cost/expiry/batch tracking
- `BookCopy`: individually tracked library/textbook copy when required
- `Loan`: borrower, issue, due, return, condition, and charges
- `EmployeeIssue`: goods/assets entrusted to an employee
- `Sale`: authorized sale of book/uniform/course material linked to receipt and accounting

Stock on hand is derived from controlled movements, not directly overwritten. Adjustments require a reason and permission.

## 12. Communications model

A communication is separated into intent, recipients, provider deliveries, and business event:

- `MessageTemplate` with language and version
- `MessageCampaign` or transactional intent
- `RecipientSnapshot` capturing who was targeted and why
- `OutboxMessage` for reliable dispatch
- `ProviderDelivery` with attempts, provider ID, status, and timestamps
- `CommunicationPreference/Consent`

The source business record remains authoritative. A notification failure does not alter attendance, fee, or salary status.

## 13. Audit model

`AuditEvent` records tenant, actor/account, effective role/context, action, resource type/ID, timestamp, request/correlation ID, source client/device/IP, outcome, reason, and safe before/after summary when appropriate. High-value domains additionally keep domain-specific history such as financial reversals, grade corrections, and attendance adjustments.

Audit logs must not store passwords, authentication tokens, fingerprint templates, or unnecessary child/financial payloads.

## 14. Shared modeling rules

- Use UUID/opaque identifiers at API boundaries.
- Include tenant ownership in uniqueness and relationship constraints.
- Prefer effective-dated history for enrollment, employment, policy, and assignment changes.
- Store money as fixed precision with explicit currency; never floating point.
- Store instants in UTC and retain school-local date/timezone context where business rules depend on it.
- Model lifecycle states explicitly; avoid multiple booleans that permit impossible combinations.
- Use database transactions and constraints for financial, attendance-sheet, result-publication, and inventory invariants.
- Use soft deletion only where legally/business appropriate; immutable/posted records use status, reversal, or archival instead.
- Attach files through tenant-owned metadata and retention policy, never raw public paths.

