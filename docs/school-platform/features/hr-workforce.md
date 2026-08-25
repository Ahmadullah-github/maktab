# Human Resources and Workforce Administration

**Module prefix:** `HRM`  
**Current status:** Discovery/Specified  
**Primary owners:** HR staff, administrative manager, authorized leadership

## Objective

Maintain complete effective-dated employee records, responsibilities, agreements, attendance-related policies, leave, approvals, and workforce reporting while protecting confidential personnel data.

## Requirements

| ID | Requirement |
|---|---|
| HRM-001 | Register employee profiles without duplicating an existing Person who may also be a guardian or other role. |
| HRM-002 | Store employment identifiers, contacts, emergency information, documents, qualifications, experience, bank/payment details where required, and confidentiality classification. |
| HRM-003 | Model agreements/contracts with type, dates, probation, work pattern, compensation reference, and status history. |
| HRM-004 | Model positions, departments, reporting lines, school-unit assignments, teaching responsibilities, and transfers with effective dates. |
| HRM-005 | Support onboarding, document checklist, approval, activation, transfer of responsibility, suspension, termination, clearance, and archive. |
| HRM-006 | Configure leave types, balances/accrual where used, requests, approvals, holidays, official duty, and return. |
| HRM-007 | Consume employee timekeeping from attendance and manage exceptions/corrections before approval. |
| HRM-008 | Define salary/payment rules and route policy changes for approval/versioning; payroll owns calculations/runs. |
| HRM-009 | Record reward/penalty decisions through approved HR/payroll components, never by directly editing a paid salary. |
| HRM-010 | Maintain employee information bank/search with field-level permission and safe exports. |
| HRM-011 | Provide workforce statistics by unit/department/position/status/qualification/attendance without exposing unnecessary salary/private details. |
| HRM-012 | Track entrusted responsibilities/assets through explicit transfer and inventory links. |

## Main workflows

### Onboarding

Search/create Person → employee profile → agreement and position/unit → required documents → approvals → account/membership request → device identity mapping if entitled → active employee. Each downstream action is explicit and compensatable.

### Responsibility transfer

Record outgoing/incoming employee, responsibilities/assets/cash/store/account access, effective time, checklist, handover evidence, approvals, and incomplete exceptions. IAM scopes and inventory custody update only after the authorized transition.

### Separation

Set last working date/reason → settle time/leave/pay/advances/assets → transfer duties → revoke memberships/sessions/device mappings → issue documents → archive according to retention. Historical records retain the employee reference.

## Core entities

`EmployeeProfile`, `EmploymentAgreement`, `Position`, `PositionAssignment`, `Department`, `ReportingRelationship`, `Qualification`, `EmployeeDocument`, `OnboardingCase`, `ResponsibilityAssignment`, `ResponsibilityTransfer`, `LeaveType`, `LeaveBalance`, `LeaveRequest`, `ClearanceCase`, `SeparationCase`.

## Invariants and controls

- Effective-dated employment/position records do not overlap incompatibly.
- HR confidentiality is field/purpose-specific; broad school role does not imply salary/bank/document access.
- Agreement and approved policy history is immutable/versioned.
- Separation revokes operational access promptly but preserves legal records.
- Rewards/penalties require a reason, policy basis, approval, employee visibility/appeal policy, and payroll linkage.
- Responsibility transfer cannot silently lose asset/cash/store custody.

## Reports

Active/inactive/headcount; onboarding/document expiry; positions/vacancies; transfers/responsibilities; attendance/leave/late/absence statistics; turnover; qualifications; contract expiry; clearance; entrusted assets; approved anonymized workforce statistics.

## Acceptance criteria

- An existing guardian Person can become an employee without merging login accounts.
- Transfer changes future responsibility/scope while retaining prior assignment history.
- Separation blocks account/device access and shows unresolved clearance items.
- Unauthorized staff cannot expose bank, pay, identity documents, or private leave reasons through reports/exports.
- Policy versions explain which rule applied at a historical date.

## Open questions

- Required employee forms/documents, employment laws, leave/accrual rules, and clearance.
- Exact salary-rule approval and reward/penalty policy.
- Bank/payment fields actually used in Afghanistan pilot schools.
- Responsibility categories and handover forms.

## Implementation tracker

- [ ] Collect employee, agreement, leave, transfer, and clearance samples
- [ ] Approve HR privacy/retention matrix
- [ ] Design effective-dated profile/agreement/position model
- [ ] Implement onboarding, transfer, leave, separation, and clearance workflows
- [ ] Integrate IAM, device mapping, inventory custody, and payroll inputs
- [ ] Implement confidential reporting/export controls
- [ ] Add lifecycle/overlap/revocation tests
- [ ] Pilot full join-transfer-leave process
- [ ] Mark Released

