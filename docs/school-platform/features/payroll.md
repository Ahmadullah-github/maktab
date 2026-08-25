# Payroll

**Module prefix:** `PAY`  
**Current status:** Discovery; requires Afghan payroll/tax expert validation  
**Primary owners:** HR, payroll officer, finance approver

## Objective

Calculate explainable employee pay from approved policies and inputs, apply secure approvals, record liabilities/payments/accounting, and preserve reproducible historical payslips.

## Requirements

| ID | Requirement |
|---|---|
| PAY-001 | Configure versioned earning, deduction, tax, reward, penalty, overtime, absence, advance, and guarantee rules with effective dates. |
| PAY-002 | Assign approved compensation packages to employees without exposing values beyond authorized roles. |
| PAY-003 | Create payroll periods/runs for a tenant/unit/employee population with deterministic cut-off. |
| PAY-004 | Import only approved time/leave summaries; record other adjustments with source, reason, and approval. |
| PAY-005 | Calculate gross pay, earnings, deductions, tax, advances, guarantees, net pay, and employer liabilities using retained rule/input versions. |
| PAY-006 | Provide preview and exception validation before submission. |
| PAY-007 | Separate prepare, review, approve, post, pay, reverse, reopen, and export permissions. |
| PAY-008 | Post approved payroll to balanced accounting entries and payable records; payment is a later controlled operation. |
| PAY-009 | Record paid/unpaid/partially paid status and payment method/reference without editing the approved calculation. |
| PAY-010 | Generate private multilingual payslips and payroll/tax/payment reports. |
| PAY-011 | Correct an approved/posted payroll by controlled reversal/adjustment, preserving original evidence. |
| PAY-012 | Reconcile payroll totals to journals, payment batches/cash/bank, employee advances, and tax liabilities. |

## Payroll lifecycle

Draft period → snapshot employees/rules/approved inputs → calculate → resolve exceptions → submit → approve → post liability/journal → pay/payment batch → reconcile → close. A correction after posting uses reversal/supplemental adjustment, not recalculation in place.

## Core entities

`PayPolicy`, `PayComponent`, `PayRuleVersion`, `CompensationAssignment`, `PayrollPeriod`, `PayrollRun`, `PayrollEmployee`, `PayrollLine`, `PayrollInputSnapshot`, `PayrollException`, `PayrollApproval`, `PayrollPosting`, `PayrollPayment`, `Payslip`, `PayrollAdjustment`.

## Invariants and controls

- Identical retained inputs/rules produce identical calculations.
- A run has one immutable population/cut-off after submission.
- Net pay equals earnings minus deductions under the approved rule set.
- Posted payroll links to a balanced journal and cannot be edited/deleted.
- Approval and payment separation follows configured school mode; self-approval is prevented where required.
- Employee sees only own published payslips; manager visibility does not imply peer salary visibility.
- Raw biometric events never enter payroll directly.

## Reports

Payroll register; paid/unpaid/partial; earning/deduction summary; tax; advances/guarantees; overtime/absence impact; department/unit cost; payment reconciliation; journal reconciliation; exception/change/audit report.

## Acceptance criteria

- A historical payslip can be reproduced and explains every input/rule.
- Unapproved attendance changes do not alter a submitted payroll run.
- Repeated post/pay command does not duplicate journals or payment status.
- Totals reconcile across employee lines, payroll summary, accounting, and payment records.
- Reversal retains the original run and produces explicit compensating records.
- Unauthorized users cannot infer individual compensation through API, report, export, or logs.

## Open questions

- Afghan tax brackets/reporting, salary calendars, allowances, deductions, guarantees, advances, overtime, leave, and termination settlement.
- Cash versus bank payment workflows and required documents.
- Small-school approval modes and thresholds.
- Whether teachers in courses use payroll or contractor/course-specific payables.

## Implementation tracker

- [ ] Engage payroll/accounting domain expert and collect samples
- [ ] Approve component/rule/tax/payment model
- [ ] Define approval, posting, reversal, and reconciliation states
- [ ] Implement deterministic calculation engine with version snapshots
- [ ] Integrate approved time/leave and finance journals/payments
- [ ] Implement private payslips and reports
- [ ] Add golden calculation, concurrency, idempotency, and reconciliation tests
- [ ] Security/privacy review and parallel pilot payroll
- [ ] Mark Released only after financial sign-off

