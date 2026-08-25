# Audit, Compliance, and Operational Oversight

**Module prefix:** `AUD`  
**Current status:** Mandatory platform foundation; legal retention discovery pending  
**Primary owners:** Security, vendor operations, tenant leadership/auditors

## Objective

Provide tamper-resistant evidence of who did what, when, in which tenant/context, and with what result; support investigations, access reviews, financial reconciliation, data governance, and safe vendor operations.

## Requirements

| ID | Requirement |
|---|---|
| AUD-001 | Record append-only audit events for authentication, authorization/admin, sensitive reads/exports, and privileged business state changes. |
| AUD-002 | Include tenant, actor/account, effective membership/role, action, resource reference, timestamp, correlation/request ID, client/source, outcome, and reason where required. |
| AUD-003 | Record safe structured before/after or domain change details without passwords, tokens, biometric templates, question content, or unnecessary personal/financial payload. |
| AUD-004 | Make audit history unavailable for edit/delete by normal tenant/platform roles and monitor ingestion/storage failure. |
| AUD-005 | Provide authorized search by time, actor, module, action, resource, outcome, device/client, and correlation. |
| AUD-006 | Explicitly surface fee/receipt edits attempted, reversals, deletions attempted, discounts, refunds, role changes, grade corrections, attendance corrections, inventory adjustments, and reprints. |
| AUD-007 | Audit support impersonation/break-glass with reason, approval, start/end, viewed/changed resources, and visible session indication. |
| AUD-008 | Define retention, legal hold, archival, export, and disposal per audit/domain/data classification. |
| AUD-009 | Provide periodic privileged-access, segregation-of-duty, inactive-account, device, and entitlement reviews. |
| AUD-010 | Link audit evidence across API, database transaction, outbox/job, connector, provider, and document using correlation IDs. |
| AUD-011 | Provide incident and reconciliation runbooks plus evidence export with integrity metadata. |
| AUD-012 | Keep diagnostic logs and audit evidence separate in purpose, access, retention, and integrity. |

## Event categories

Authentication/security; tenant/contract/entitlement; account/role/scope; student/guardian relationship; attendance/device mapping/correction; grades/results/question access; HR/payroll; finance; inventory; discipline; messaging/export; support/operations; configuration/migration.

## Core entities

`AuditEvent`, `AuditStreamCheckpoint`, `SensitiveAccessEvent`, `SupportAccessSession`, `AccessReview`, `ReviewFinding`, `LegalHold`, `RetentionPolicy`, `EvidenceExport`, `IncidentRecord`.

## Invariants and controls

- Audit event commits atomically with high-value state change or through a provably reliable transactional mechanism.
- Actor distinguishes human, system job, connector/device, provider callback, and support impersonator/effective user.
- Tenant administrators can view entitled audit reports but cannot erase them.
- Search results themselves respect sensitive-domain permissions.
- Audit timestamps are server-authoritative; source/device time can be additional evidence.
- Retention/disposal is policy-driven and produces its own evidence.

## Acceptance criteria

- Every high-risk requirement has a mapped audit event and test.
- A receipt reversal, fee correction attempt, role elevation, grade change, attendance correction, and support session can be reconstructed end to end.
- Audit pipeline/storage failure alerts promptly and blocks configured high-risk operations if evidence cannot be guaranteed.
- Export includes parameters, actor, time, integrity/checksum metadata and remains tenant isolated.
- Normal database/admin interfaces cannot silently modify audit events.
- Security review finds no secrets or excessive protected payload in audit/log samples.

## Open questions

- Applicable legal retention, school access rights, Ministry/auditor export, legal hold, and breach notification obligations.
- Whether external immutable/WORM storage is required for particular contract tiers.
- Which sensitive reads must be audited versus aggregated to control volume/privacy.

## Implementation tracker

- [ ] Create data classification and audit-event catalog per requirement/module
- [ ] Approve retention/legal-hold/support-access policies
- [ ] Implement audit SDK/service, transaction integration, and correlation
- [ ] Implement protected storage/search/evidence export
- [ ] Implement support access and access-review workflows
- [ ] Add audit health, integrity, volume, and alerting metrics
- [ ] Test high-risk coverage and failure behavior
- [ ] Conduct security/compliance review
- [ ] Mark foundation Released; continue coverage per module

