# People, Students, Guardians, Admissions, and Enrollment

**Module prefix:** `STD`  
**Current status:** Discovery/Specified  
**Primary owners:** Admissions, information office, academic administration

## Objective

Maintain a trustworthy, historical student roster and guardian relationships without duplicating people or losing prior enrollment context.

## Requirements

| ID | Requirement |
|---|---|
| STD-001 | Register a canonical Person with names in required scripts, identifiers, date/place of birth, sex/gender fields required by approved forms, photo, contacts, address, and document references. |
| STD-002 | Register student-specific profile data separately from yearly enrollment. |
| STD-003 | Model multiple guardians and relationship type, custody/contact authority, pickup/notification/financial responsibility, priority, and effective dates. |
| STD-004 | Allow one guardian account to see only explicitly linked children, subject to the final multi-child policy. |
| STD-005 | Support application/admission, review, acceptance/rejection/waitlist, document checklist, enrollment, class placement, transfer, withdrawal, graduation, and archive states. |
| STD-006 | Keep enrollment history per academic year, program/level, school unit, class/section, roll/registration identifiers, dates, and status. |
| STD-007 | Detect likely duplicate people using controlled matching and require privileged review before merge. |
| STD-008 | Import students/guardians from validated templates with row-level preview, errors, idempotency, and reconciliation output. |
| STD-009 | Generate student profile/history cards and approved admission/enrollment documents on A4. |
| STD-010 | Protect confidential documents, family contacts, discipline/welfare, fees, and biometric mappings by purpose and role. |
| STD-011 | Support configurable custom fields only through typed, governed definitions; do not turn core rules into unvalidated free text. |
| STD-012 | Preserve references when names, contacts, class placement, or guardian relationships change. |

## Main workflows

### Admission and enrollment

Create/search Person → collect application and documents → review decision → create StudentProfile → create enrollment for academic year/unit/program → assign class/section and student identifier → link guardians → create entitled portal accounts/fee setup through controlled downstream actions.

### Transfer or withdrawal

Record request, reason, effective date, approvals, outstanding obligations, destination/source data, and generated forms. Close/change enrollment without deleting academic, fee, attendance, or discipline history. Exact سه پارچه workflows remain TBD.

### Duplicate resolution

Present matched attributes and linked records. Merge or link only with permission, reason, preview, and reversible reference map; never auto-merge solely on name/phone.

## Core entities

`Person`, `NameVariant`, `ContactPoint`, `Address`, `IdentityDocument`, `StudentProfile`, `GuardianProfile`, `GuardianRelationship`, `Application`, `AdmissionDecision`, `DocumentChecklist`, `Enrollment`, `ClassMembership`, `StudentIdentifier`, `TransferCase`, `PersonMergeCase`.

## Invariants

- A student has at most one active enrollment for the same tenant/program context unless an approved model supports concurrent programs.
- Enrollment/class history is effective-dated; moving a student does not rewrite old attendance/results.
- Guardian portal access requires an active explicit relationship and allowed visibility.
- Imported records have tenant ownership and provenance.
- Deletion is restricted when business records reference a person; use inactive/archive/legal retention states.

## Reports/documents

Student roster by year/unit/class/status; admission pipeline; missing documents; new/withdrawn/transferred students; guardian contacts; demographic/statistical reports; student incident/history card if confirmed; enrollment/profile/transfer documents; data-quality/duplicate report.

## Acceptance criteria

- Re-enrolling a returning student preserves the old enrollment and creates a new one.
- Class transfer changes only effective/current placement and does not move historical results.
- Guardian A cannot infer students not linked to their account.
- Importing the same file twice does not duplicate accepted rows.
- A duplicate merge retains a complete mapping and audit history.
- Generated documents use the approved language, tenant header, identifiers, and template version.

## Open questions

- Required national/student identifiers and duplicate policy.
- One guardian account with multiple children and shared phone rules.
- Exact admission, temporary/سویه, transfer/سه پارچه, and archive forms.
- Required health/emergency fields and who may see them.

## Implementation tracker

- [ ] Collect admission, profile, transfer, and identifier samples
- [ ] Approve Person/student/guardian/enrollment data model
- [ ] Define lifecycle and transition permissions
- [ ] Build import preview/error/reconciliation contract
- [ ] Implement guardian relationship authorization tests
- [ ] Implement duplicate review/merge tooling
- [ ] Implement approved A4 documents
- [ ] Add privacy, retention, and export controls
- [ ] Pilot roster migration and reconcile counts
- [ ] Mark Released

