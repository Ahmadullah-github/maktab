# Identity, Accounts, and Access Control

**Module prefix:** `IAM`  
**Current status:** Implementing foundation; username and recovery policies remain open  
**Primary owners:** Platform security, tenant administrators

## Objective

Give every user a traceable login identity and only the access allowed by the school's contract, assigned role, data scope/relationship, and workflow state.

## Requirements

| ID | Requirement |
|---|---|
| IAM-001 | Maintain separate `Person`, `LoginAccount`, and `TenantMembership` concepts. |
| IAM-002 | Give teacher and guardian contexts separate accounts, credentials, sessions, memberships, and audit identities even if linked to one Person. |
| IAM-003 | Create accounts individually or by validated import using a server-generated unique username policy. |
| IAM-004 | Issue temporary passwords/activation artifacts once, without SMS, with expiry and forced first-login password change. |
| IAM-005 | Support secure login, logout, password change, admin reset, lock/disable, recovery, and session revocation. |
| IAM-006 | Use role templates matching school responsibilities but permit custom permission bundles and multiple assignments. |
| IAM-007 | Apply tenant, unit, department, class, subject, course, cashbox, store, and relationship scopes. |
| IAM-008 | Enforce access as subscription + entitlement + active membership + permission + scope/relationship + workflow state. |
| IAM-009 | Allow broad school leadership visibility only through explicit permissions; reserve posting, reversal, approval, impersonation, and audit operations separately. |
| IAM-010 | Maintain activity/security history to at least second precision with correlation and client/source context. |
| IAM-011 | Add re-authentication for sensitive operations and later MFA for privileged/finance roles. |
| IAM-012 | Provide access reviews showing privileged accounts, unused accounts, conflicts, expiring assignments, and active sessions. |
| IAM-013 | Prevent self-elevation, unsafe last-superuser removal, and approval of one's own restricted request where dual control applies. |
| IAM-014 | Local Electron credentials/tokens use operating-system protected storage and can be revoked centrally. |

## Initial role templates

Guardian, teacher, storekeeper, discipline officer, admissions/information officer, administrative manager, finance manager, course manager, head teacher, school manager/principal, deputy, and president/head. A tenant may assign more than one role, but conflicting duties must be detected.

## Main workflows

### Account issuance

Authorized admin selects/creates a Person, selects exactly one intended login context, assigns membership/role/scope, and generates a temporary credential. The credential slip is displayed/printed once. First login forces password change before operational access.

### Password reset

An authorized process verifies identity, creates a new expiring secret or activation link/QR, invalidates sessions, and records actor/reason. Admins cannot view an old password or set a predictable shared password.

### Permission evaluation

The backend resolves context for each request. Object lookup is tenant-scoped before returning existence details. Entitlement and action permission are checked, then relationship/scope and state transition. Denials are safely logged without leaking confidential object data.

## Core entities

`Person`, `LoginAccount`, `CredentialState`, `Session`, `TenantMembership`, `RoleTemplate`, `TenantRole`, `Permission`, `RolePermission`, `ScopeAssignment`, `RelationshipGrant`, `SecurityEvent`, `AccessReview`, `Delegation`.

## Security invariants

- No plaintext/retrievable password storage.
- Tenant IDs supplied by clients do not grant authority.
- Frontend visibility never replaces API checks.
- Membership, role, and scope changes invalidate affected authorization caches/sessions promptly.
- Role changes and sensitive views/exports are audited.
- Support impersonation is explicit, time-limited, bannered, reasoned, and audited.

## Acceptance criteria

- Teacher and guardian accounts linked to the same Person cannot see each other's session/context unless separately authorized.
- A teacher cannot access an unassigned class by changing an ID.
- A finance viewer cannot issue, post, approve, reverse, or export unless each action is granted.
- Temporary password expires, is shown once, and first login cannot bypass change.
- Password reset invalidates existing sessions and generates an audit/security event.
- Disabling a membership blocks web, Electron, API, job continuation, and file access.
- Cross-tenant permission tests cover list, detail, filter, relation, export, and file endpoints.

## Open questions

- Final username algorithm and whether username aliases can change.
- Whether phone numbers can repeat and the non-SMS recovery method.
- MFA methods usable in target schools and break-glass recovery.
- Tenant-configurable role editing boundaries and safe defaults.

## Implementation tracker

- [ ] Resolve username/contact/recovery policy
- [x] Model core accounts, memberships, roles, permissions, and unit-scoped assignments
- [ ] Implement credential issuance and one-time print/activation
- [ ] Complete backend authorization policy/service layer (membership context and capability
      intersection are implemented; object/relationship scopes remain)
- [x] Define the initial permission and module catalog for development
- [ ] Implement access reviews and separation-of-duty conflicts
- [ ] Complete Electron secure token lifecycle (main-process in-memory tokens, rotation, and revoke
      exist; OS-protected persistence and central session inventory remain)
- [ ] Complete authentication, tenant, object, and negative tests (foundation isolation tests exist)
- [ ] Threat model and security review
- [ ] Pilot and mark Released
