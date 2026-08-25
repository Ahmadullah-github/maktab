# Security, Multi-Tenancy, RBAC, and Audit

**Status:** Mandatory baseline controls  
**Last updated:** 2026-08-03

## 1. Security objective

The system holds children's records, family contacts, employee data, biometric-derived attendance, and deep financial data. A feature is not complete if it works functionally but can cross tenant boundaries, bypass approval, lose attribution, expose unnecessary data, or silently alter evidence.

## 2. Trust boundaries

- Browser and Electron UI are untrusted for authorization decisions.
- Electron local SQLite is trusted only as the user's local schedule workspace, not as cloud truth.
- Biometric devices are event sources, not trusted identity/attendance authorities.
- Local connectors are authenticated integration principals with narrow permissions.
- Messaging providers, printers, and object storage are external dependencies.
- Vendor support personnel have no automatic access to tenant business data.

All traffic outside a single trusted process boundary uses authenticated encrypted transport. Secrets are kept in managed secret storage and never packaged as shared credentials in Electron.

## 3. Authentication

### Account issuance

1. An authorized school administrator creates or imports a person and requests an account.
2. The system creates a unique username and a high-entropy temporary secret.
3. The secret is shown/printed exactly once through a controlled credential slip or activation artifact; it is never sent by SMS under the current decision.
4. The temporary credential expires and requires a password change at first login.
5. Creation, handoff state, first login, expiry, reset, disablement, and recovery are audited.

The final username convention remains open. Do not expose an entire phone number in a username by default without a privacy review. Usernames must be immutable or changed through an auditable alias/history mechanism.

### Password and session controls

- Use Argon2id or the strongest supported approved password hasher.
- Never store or log plaintext passwords; support breached/common-password checks where feasible offline/locally compliant.
- Apply progressive rate limiting by account, IP/risk signal, and tenant without enabling trivial denial of service.
- Rotate sessions/tokens at login, privilege change, password change, and sensitive re-authentication.
- Invalidate active sessions on password reset, account disablement, membership suspension, or confirmed compromise.
- Use secure, HTTP-only, same-site cookies for browser sessions where possible; Electron uses protected OS credential storage for refresh credentials.
- Require recent authentication for sensitive exports, payment reversal, role elevation, and configuration changes.
- Introduce MFA first for vendor operators, tenant superusers, finance approvers, and other high-risk accounts after recovery operations are designed.

Teachers and guardians use distinct accounts even when linked to the same Person. There is no role-switch shortcut that merges their audit identity.

## 4. Tenant resolution and isolation

The client may request/select one of its permitted memberships, but it cannot assert arbitrary tenant authority. For every protected request:

1. authenticate the login account;
2. resolve the active tenant membership from server state;
3. verify subscription state and required entitlement;
4. establish tenant context for the unit of work;
5. apply permission, data scope/relationship, and workflow-state checks;
6. query and mutate only through tenant-constrained services/managers;
7. record tenant and actor in audit/outbox data.

### Database controls

- Every tenant-owned table includes a non-null tenant key.
- Foreign keys between tenant-owned records preserve the same tenant; use composite constraints or equivalent enforcement where appropriate.
- Natural/business uniqueness includes the tenant and sometimes school unit/period.
- Background tasks fail closed when tenant context is missing.
- Cache keys, object paths, search indexes, exports, logs, and metrics include safe tenant partitioning.
- PostgreSQL row-level security should be evaluated as defense in depth, not as a replacement for application authorization.

### Mandatory isolation tests

For every tenant-owned API/resource, tests must demonstrate that a valid user from tenant A cannot read, enumerate, create against, update, delete, export, link, or infer tenant B's data through IDs, filters, files, jobs, websockets, caches, or error differences.

## 5. Effective access model

```text
ALLOW when all are true:
  subscription permits operation
  AND contract entitlement enables feature/capacity
  AND membership is active
  AND role grants action permission
  AND data scope or relationship includes resource
  AND record/workflow state permits transition
  AND any required approval/re-authentication is satisfied
```

### Role templates

Initial templates map to the collected school roles:

- guardian
- teacher
- storekeeper
- discipline officer
- admissions/information officer
- administrative manager
- finance manager
- course manager
- head teacher
- school manager/principal
- deputy
- president/head

Templates are starting points, not hard-coded checks. Permissions are action-oriented (`student.view`, `attendance.submit_class_sheet`, `receipt.issue`, `journal.post`, `payroll.approve`) and can be bundled into tenant-specific roles.

### Scopes and relationships

- tenant-wide, school-unit, department, class, subject, course, cashbox, store, or assigned-record scope;
- teacher-to-class/subject assignment;
- guardian-to-student relationship;
- employee-to-own-profile/payslip relationship;
- cashier-to-cashbox assignment;
- approver-to-threshold/workflow responsibility.

“Admin can see all” means broad visibility only when explicitly granted. It does not automatically grant journal posting, payroll approval, audit deletion, impersonation, or cross-tenant access.

## 6. Financial and payroll control

- Separate create, submit, approve, post, pay, reverse, reopen, and export permissions.
- Enforce fiscal-period locks and numbered document sequences server-side.
- Posted journals and issued receipts cannot be edited/deleted.
- Reversal references the original transaction, reason, actor, approval, and compensating entry.
- Use idempotency keys and database uniqueness to prevent duplicate payments/receipts on retries.
- Cashiers operate only assigned cashboxes and complete daily closing/reconciliation.
- Support configurable dual approval, amount thresholds, and a small-school single-operator mode with re-authentication and enhanced audit.
- Payroll approval and payroll payment are distinct operations.
- Sensitive exports are authorized, watermarked/classified where appropriate, and audited.

## 7. Child, guardian, and employee privacy

- Apply least privilege to student health/welfare, discipline, contact, finance, and biometric-derived records.
- Guardians see only explicitly linked children and only approved/published information.
- Teachers see rosters/results/attendance only for assigned responsibilities and allowed periods.
- Employee peer data, salary, bank/payment, discipline, and documents are restricted by purpose.
- Rating or “mental growth” features require an approved rubric, limited visibility, correction/appeal, retention limits, and specialist ethical review before implementation.
- Collect the minimum biometric metadata needed; cloud fingerprint images/templates are prohibited by default.
- Define retention and deletion/anonymization by record category, contract, and law.

## 8. Audit and support access

Audit events are append-only to normal application roles. Platform operators cannot alter tenant audit history. High-risk events include:

- login, failure, recovery, session termination, and MFA changes;
- role, scope, membership, entitlement, and tenant configuration changes;
- viewing/exporting sensitive data where policy requires;
- attendance correction and biometric identity mapping;
- grade entry, correction, approval, and publication;
- fee deletion attempts, reversals, refunds, discounts, journal posting, period reopening;
- payroll approval/payment/reversal;
- inventory adjustment/write-off;
- support impersonation or break-glass access;
- printing/reprinting official receipts and reports.

Vendor support access must be time-bounded, reasoned, approved where feasible, visibly indicated, and fully audited. Prefer diagnostic metadata over tenant payload access.

## 9. Application and infrastructure security

- Validate all input on the server; encode output and use framework protections for CSRF/XSS/SQL injection.
- Set content security policy and safe Electron navigation/IPC boundaries; disable arbitrary remote code and Node integration in untrusted renderer content.
- Scan uploads, restrict content types/sizes, and use private object storage.
- Encrypt backups and transport; manage keys/secrets separately from application images.
- Use dependency scanning, secret scanning, static analysis, migration review, and penetration testing before sensitive production releases.
- Patch supported OS/runtime/framework versions on a defined cadence.
- Centralize security logs and alert on tenant-isolation failures, credential attacks, role elevation, high-value reversals, unusual exports, connector abuse, and audit pipeline failure.
- Backups must be restored in exercises; a successful backup job alone is not recovery evidence.

## 10. Security release gate

A module cannot be released until it has:

- a permission matrix and negative authorization tests;
- tenant isolation tests;
- audit event coverage for privileged state changes;
- idempotency/concurrency tests for retryable writes;
- privacy classification and retention decision;
- threat review for new external integrations;
- recovery/reconciliation behavior for partial failure;
- confirmation that logs/errors contain no secrets or excessive personal data.

