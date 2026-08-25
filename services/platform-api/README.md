# Platform API

Django/DRF service for cloud-authoritative multi-tenant school data.

```bash
npm run infra:up
npm run platform:migrate
npm run platform:seed
npm run dev:platform-api
```

Health endpoints are `/api/v1/health/live` and `/api/v1/health/ready`. OpenAPI documentation is at
`/api/docs/`. Tests use an in-memory SQLite database for speed; local runtime uses PostgreSQL.

The current foundation includes organizations, school units, separate account/person identities,
memberships, scoped RBAC, contract entitlements, append-only audit events, browser session login,
Electron JWT login, password change, membership selection, and capability calculation.
