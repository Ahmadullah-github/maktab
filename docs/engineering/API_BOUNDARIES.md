# API and data boundaries

## Local API

- Base path: `/local-api/v1`
- Storage: per-installation SQLite
- Availability: offline and online
- Responsibilities: timetable configuration, generation, schedules, swaps, exports, local license,
  and desktop-integrated operations

## Platform API

- Base path: `/api/v1`
- Storage: shared-cloud PostgreSQL with tenant ownership on domain records
- Availability: online
- Responsibilities: organizations, contracts, identity, RBAC, attendance, academics, finance, HR,
  inventory, transport, messaging, portals, audit, and reporting

## Tenant context contract

1. The account authenticates.
2. `/api/v1/me` returns memberships owned by that account.
3. The client selects a membership identifier, not a tenant identifier.
4. Tenant-scoped requests send `X-Maktab-Membership`.
5. The server verifies ownership, active membership, and active tenant, then derives the tenant.
6. Capabilities are the intersection of role permissions and enabled contract entitlements.

No domain endpoint may accept `tenant_id` as an authorization shortcut. PostgreSQL row-level
security can be added later as defense in depth, but application-level scoping remains mandatory.

## Authentication

| Client | Mechanism | Secret storage |
| --- | --- | --- |
| Browser | Django session + CSRF | HttpOnly cookie managed by browser |
| Electron | Short-lived JWT + rotating refresh | Electron main-process memory via protected IPC |

Packaged Electron builds reject non-HTTPS platform API endpoints.
