# Course Management

**Module prefix:** `CRS`  
**Current status:** Discovery; definition of کورس and accounting boundary unresolved  
**Primary owners:** Course manager, teachers, finance

## Objective

Manage additional courses/programs with their own students, registrations, teachers, attendance, books, financial activity, reports, and closure while reusing platform identity/accounting controls.

## Requirements

| ID | Requirement |
|---|---|
| CRS-001 | Define a course center/program/course/cohort/session hierarchy after stakeholder confirmation. |
| CRS-002 | Register courses with subject, level, schedule, capacity, dates, fee/book rules, unit, status, and responsible manager. |
| CRS-003 | Register existing/new students in courses with enrollment status, placement/سویه if applicable, discounts, and guardian linkage. |
| CRS-004 | Assign/register/remove teachers with effective dates, agreement/pay basis, and attendance responsibility. |
| CRS-005 | Record student and teacher attendance using shared attendance infrastructure and course-specific policies. |
| CRS-006 | Manage course books/materials through inventory and authorized sales. |
| CRS-007 | Create course fees, receipts, arrears, prepayments, teacher compensation, book sales, expenses, and balance through finance/payroll modules. |
| CRS-008 | Close a course only after attendance, results, finance, inventory, and teacher obligations are reconciled. |
| CRS-009 | Preserve completed courses as read-only history with authorized reopen/correction. |
| CRS-010 | Provide a parameterized course report catalog rather than hard-coded duplicate reports. |

## Main workflows

Create course offering → approve/publish → enroll students → assign teacher/materials/schedule → run attendance/fees/teaching → record outcomes → reconcile receivables/pay/stock → close course → retain reports/history.

Prepayment must distinguish student credit, employee/teacher advance, and prepaid expense; each has a different ledger treatment.

## Core entities

`CourseCenter`, `CourseDefinition`, `CourseOffering`, `CourseCohort`, `CourseEnrollment`, `CourseTeacherAssignment`, `CourseSession`, `CourseAttendance`, `CourseMaterialRequirement`, `CourseClosure`, plus references to shared fee, payment, inventory, payroll, and reporting entities.

## Invariants

- A course record belongs to one tenant and accounting/unit dimension.
- Closing blocks ordinary registrations/attendance/charges but does not delete history.
- Course financial values originate in finance subledgers/journals, not duplicated balance columns.
- Removing a teacher ends an assignment; it does not erase sessions/pay history.
- Student/teacher identity reuses Person/Profile rather than creating isolated duplicates.

## Reports

Enrollment/attendance/completion; active/completed courses; teacher attendance/workload/pay; fees received; arrears aging; prepayments; books/material sales and profit; income/expense; course trial/profit/balance views; closure reconciliation.

## Acceptance criteria

- A person already in the school can join a course without duplicate identity.
- Course income, receivables, teacher pay, and inventory sales reconcile to finance.
- Course closure identifies unresolved students, fees, teacher pay, and stock before finalization.
- Closed course rejects normal mutation but approved corrections remain audited.
- Report filters and totals agree with source subledgers.

## Open questions

- Exact meaning and hierarchy of کورس.
- Whether courses share fiscal books/cashboxes or require reporting dimensions/separate entity.
- Teacher salary formula, course certification/results, placement/سویه, refunds, and closure policy.
- The claimed 20+ report samples and definitions.

## Implementation tracker

- [ ] Resolve کورس model with real customer examples
- [ ] Collect registration, fee, teacher pay, book, and report samples
- [ ] Define course lifecycle and shared-domain integrations
- [ ] Implement offerings, enrollment, staffing, sessions, attendance
- [ ] Integrate fees, pay, inventory sales, and accounting dimensions
- [ ] Implement closure/reopen/reconciliation
- [ ] Build approved report catalog
- [ ] Pilot one complete course lifecycle
- [ ] Mark Released

