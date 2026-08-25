# Repository map

## Runtime components

```text
Browser ───────────────┐
                      ├─ apps/web ── /api/v1 ─────── services/platform-api ─ PostgreSQL
Electron ─ protected ─┘      │                         │
   IPC/token vault           └─ /local-api/v1 ─ services/local-api ─ SQLite
                                                        │
                                               timetable-solver (OR-Tools)

services/platform-api ─ Redis/Celery
                      └ MinIO-compatible object storage
```

The React renderer is shared. Runtime differences are isolated at transport and hardware
boundaries. The Electron main process owns platform tokens and native operations. The browser uses
same-origin session cookies and CSRF.

## Python layout

The repository is an uv workspace. `services/platform-api` owns Django dependencies and
`services/timetable-solver` owns numerical/scheduling dependencies. This avoids forcing every
platform developer to load the solver into their daily process while preserving one lockfile.

## Django domains currently established

- `tenancy`: customer organizations and school/course units
- `identity`: people, separate login accounts, memberships, roles, permissions, scoped assignments
- `entitlements`: contracts and paid module switches
- `audit`: append-only security and business event history
- `api`: versioned authentication, membership context, capabilities, health, and OpenAPI

Business domains are added incrementally according to `docs/school-platform/DELIVERY_ROADMAP.md`.
