# Finance, Fees, Billing, and Accounting

**Module prefix:** `FIN`  
**Current status:** Discovery; architecture principles confirmed, local rules require expert review  
**Primary owners:** Cashier, finance manager, authorized approvers, leadership/auditors

## Objective

Provide a deep, business-secure finance system for student fees, family payments, other income, expenses, procurement, payroll, inventory sales, tax, balances, and financial statements using double-entry accounting and immutable posted evidence.

## Functional requirements

| ID | Requirement |
|---|---|
| FIN-001 | Configure a tenant chart of accounts, accounting dimensions, fiscal years/periods, currencies, opening balances, and period locks. |
| FIN-002 | Maintain balanced journal entries/lines with draft, approved, posted, reversed states and source-document references. |
| FIN-003 | Configure cashboxes/bank accounts and assign cashiers/scopes; support opening, receipt/payment, transfer, closing, and reconciliation. |
| FIN-004 | Configure student/course/transport fee plans by period/category with effective dates, discounts/scholarships, and family rules. |
| FIN-005 | Generate receivable charges/invoices and preserve their amount/source; changes use credit/debit adjustments. |
| FIN-006 | Receive student or family payments, allocate across charges/siblings/categories, handle unapplied credit, and issue one numbered receipt. |
| FIN-007 | Track arrears and aging by student, family, class, course, transport, period, and fee category. |
| FIN-008 | Support refunds, reversals, waivers, write-offs, discounts, and corrections with reason, permission, approval, and accounting. |
| FIN-009 | Record book/uniform/course-material sales and miscellaneous income with inventory/cost/profit integration. |
| FIN-010 | Manage purchase requests, approvals, suppliers, purchase/receipt/invoice/payment linkage, school expenses, and goods received. |
| FIN-011 | Manage employee advances, guarantees/deposits, rewards/penalties, payroll payables/payment, and settlement through proper subledgers. |
| FIN-012 | Record tax liabilities/payments and produce approved tax reports after domain validation. |
| FIN-013 | Generate server-authoritative multilingual A4 receipts/documents; log reprints without duplicating transactions. |
| FIN-014 | Provide daily cashier close, cash count, variance, bank/cash reconciliation, and controlled reopen. |
| FIN-015 | Provide trial balance, general ledger, account statement, balance sheet, income statement, cash flow, receivables, expense, tax, and source-module reports. |
| FIN-016 | Show edited/deleted fee attempts and all reversals/adjustments in immutable audit/activity views. Posted records are never deleted. |
| FIN-017 | Require idempotency for payment, allocation, receipt, posting, refund, reversal, and payment-batch commands. |
| FIN-018 | Support configurable approval modes: dual control, amount threshold, or small-school single operator with re-authentication/enhanced audit. |

## Accounting invariants

- Sum of debit lines equals sum of credit lines for every posted journal entry.
- Money uses fixed precision and explicit currency; rounding policy is versioned.
- Fiscal/document sequence uniqueness is enforced in the database per tenant/unit/type/period as configured.
- Posted journals, issued receipts, completed payments, and closed periods cannot be edited/deleted.
- Reversal points to the original and posts compensating lines in an open period.
- Operational balance fields are never manually typed when they can be derived from charges, allocations, journals, or stock movements.
- One idempotency key/command produces at most one financial effect.
- A receipt is issued only after payment/allocation/journal commit; printing is a separate retryable action.

## Key workflows

### Student/family fee receipt

Select/search account → show authoritative charges/arrears/credits → enter payment and allocation → validate cashier/cashbox/period/permission → apply configured approval → atomically create payment, allocations, journal, receipt number, audit/outbox → generate PDF → print/reprint.

### Correction

Before posting, a permitted draft may be corrected with history. After posting/receipt issuance, choose refund, reversal, write-off, reallocation, or adjustment based on policy. The original remains visible and reports show both sides.

### Cashier close

Stop/sequence new operations → calculate expected cash by method → record physical count → explain variance → review/approve → lock session → deposit/transfer/reconcile. Reopen is exceptional, reasoned, and audited.

### Purchase-to-pay

Request → budget/need approval → supplier/order (if used) → goods/service receipt → invoice/expense verification → approval → journal/payable → payment → reconciliation. Inventory items create stock movements; expense cannot be duplicated independently.

## Core entities

`Account`, `FiscalPeriod`, `JournalEntry`, `JournalLine`, `AccountingDimension`, `DocumentSequence`, `Cashbox`, `CashSession`, `BankAccount`, `FeePlan`, `FeeCharge`, `StudentFinancialAccount`, `FamilyAccount`, `Discount`, `Payment`, `PaymentAllocation`, `Receipt`, `Refund`, `Reversal`, `WriteOff`, `Expense`, `PurchaseRequest`, `Supplier`, `GoodsReceipt`, `Payable`, `TaxLiability`, `Reconciliation`.

## Permission separation

At minimum separate view, create draft, submit, approve, post, receive cash, allocate, issue receipt, reprint, refund, reverse, write off, reopen period/session, reconcile, manage chart/policy, and export. Access also scopes to unit, cashbox, bank account, course, or reporting dimension.

## Reports and reconciliation

The reported “24+ finance reports” become a parameterized catalog with shared definitions. Each report specifies data source, recognition basis, filters, currency, period, opening/closing treatment, drill-down permissions, freshness, totals, and signed sample. Every subledger report must reconcile to the general ledger at controlled cut-offs.

## Acceptance criteria

- Concurrent/retried fee payments cannot issue duplicates or over-allocate beyond policy.
- Every posted source transaction has a balanced journal; every journal can trace to source/actor/approval.
- Receipt reprint is visibly the same transaction and creates a reprint audit event only.
- Printer/provider failure leaves the committed payment correct and recoverable.
- Cashier close reconciles expected versus counted cash and prevents ordinary backdated changes.
- Tenant leadership can see reversals/edited/deleted attempts but cannot alter audit evidence.
- Trial balance balances and student/family arrears reconcile to charges, allocations, credits, and general ledger control accounts.

## Open questions

- Afghan accounting/tax rules, fiscal calendar, currency/rounding, Ministry/contract reporting, receipt numbering, cashbook forms.
- Definitions of فیس فامیلی, باقیات, بیلانس, بلنگ, guarantees, advances, rewards/penalties, transport/course fee recognition.
- Approval thresholds, budgets, supplier/procurement scope, and bank integration.
- The real 24+ report samples and how totals are currently calculated.

## Implementation tracker

- [ ] Engage Afghan finance/accounting expert and collect complete document/report set
- [ ] Approve chart, fiscal, subledger, recognition, sequence, and approval policies
- [ ] Design journal and source-document transaction boundaries
- [ ] Implement accounting kernel and invariant/property tests first
- [ ] Implement fees/charges/family payments/receipts/arrears
- [ ] Implement cashboxes, close, reconciliation, refund/reversal/write-off
- [ ] Implement procurement/expenses/tax and module integrations
- [ ] Build signed A4 documents and parameterized report catalog
- [ ] Run concurrency, retry, penetration, reconciliation, restore, and audit tests
- [ ] Parallel-run pilot against existing books and obtain sign-off
- [ ] Mark Released only after financial gate

