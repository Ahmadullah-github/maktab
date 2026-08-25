# Inventory, Store, Library, Books, and Uniforms

**Module prefix:** `INV`  
**Current status:** Discovery/Specified  
**Primary owners:** Storekeeper/custodian, library staff, finance approvers

## Objective

Control school goods, books, uniforms, sales, loans, returns, transfers, and employee custody through traceable stock movements integrated with finance.

## Requirements

| ID | Requirement |
|---|---|
| INV-001 | Maintain item definitions/categories/units for textbooks, study/library books, course books, uniforms, consumables, goods, and assets. |
| INV-002 | Maintain stores/stock locations by tenant/unit with authorized custodians. |
| INV-003 | Record opening stock only through approved migration/opening movements and all later receipt, issue, return, transfer, sale, adjustment, and write-off movements. |
| INV-004 | Support individually tracked book copies/assets where serial/copy/condition is required and quantity-based stock otherwise. |
| INV-005 | Loan books to students/employees with issue, due, renew, return, condition, loss/damage, and approved charge. |
| INV-006 | Issue uniforms/books/goods/assets to students/employees and record return/custody obligations. |
| INV-007 | Sell books, uniforms, and course materials only when user, location, item, price, and contract permission allow it. |
| INV-008 | Integrate sales with finance receipt/journal and cost/profit calculation; retry must not duplicate stock or payment. |
| INV-009 | Support stock count, variance investigation, approved adjustment, and reconciliation. |
| INV-010 | Link purchase/goods receipt to procurement/finance and preserve supplier/cost provenance. |
| INV-011 | Prevent negative stock unless an explicit approved policy permits controlled exception. |
| INV-012 | Produce stock, movement, loan, overdue, custody, sale, profit, low-stock, count variance, and valuation reports. |

## Core entities

`ItemDefinition`, `ItemCategory`, `UnitOfMeasure`, `StockLocation`, `StockLot`, `BookCopy`, `Asset`, `StockMovement`, `StockMovementLine`, `Loan`, `CustodyIssue`, `PriceList`, `InventorySale`, `StockCount`, `StockAdjustment`, `GoodsReceipt`.

## Invariants and controls

- On-hand quantity is derived from posted movements.
- Posted movements cannot be edited/deleted; reverse/adjust with linked evidence.
- Transfers have matching source/destination movement and transit/receipt state.
- Sales commit finance and inventory effects atomically or through a recoverable outbox/saga with visible reconciliation state.
- Storekeeper scope is limited to assigned locations; sale permission is separate from stock view/issue.
- Stock count freezes or versions the comparison cut-off.

## Main workflows

Receive goods → inspect/accept → post stock movement and finance/procurement link.  
Loan book → validate borrower/copy/eligibility → issue → renew/return → record condition/charge.  
Sale → quote authorized price → collect/record payment → issue receipt → post stock/cost movement → print.  
Employee handover → list entrusted goods/assets → both-party/manager confirmation → update custody.

## Acceptance criteria

- Stock report at a cut-off reconciles exactly to movements.
- Retried sale/return/transfer creates one logical effect.
- An unauthorized user cannot sell or adjust stock by calling the API directly.
- Book copy cannot be actively loaned to two people.
- Inventory sale revenue/cost/stock reconcile to finance.
- Employee separation identifies unreturned custody items.

## Open questions

- Which item types use individual copy/serial versus quantity.
- Pricing, profit/cost method, loss/damage, deposit, and overdue policies.
- Whether “تحویل خانه” combines library, warehouse, asset custody, and retail at every school.
- Required stock and goods forms/report layouts.

## Implementation tracker

- [ ] Collect store/library/sale/loan/custody forms and item taxonomy
- [ ] Approve location, movement, costing, price, and authorization model
- [ ] Implement item/location/movement kernel and invariant tests
- [ ] Implement loans, custody, transfers, counts, and adjustments
- [ ] Integrate procurement, finance sales/receipts, employee clearance
- [ ] Build reports and A4 issue/return/sale documents
- [ ] Run concurrency/idempotency/reconciliation tests
- [ ] Pilot physical count and reconcile
- [ ] Mark Released

