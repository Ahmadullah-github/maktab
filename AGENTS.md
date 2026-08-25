# Maktab repository guidance

## Architecture boundaries

- `apps/web` is one adaptive renderer for browser and Electron. Do not fork business screens by
  runtime; isolate transport and native capabilities behind clients/bridges.
- `services/local-api` and its SQLite database are only for offline timetable work and desktop
  integrations. Its API prefix is `/local-api/v1`.
- `services/platform-api` is authoritative for school, identity, finance, attendance, messaging,
  audit, contract, and other online data. Its API prefix is `/api/v1`.
- Never let the renderer choose a tenant by sending a raw tenant or school ID. Platform endpoints
  resolve the active tenant from an authenticated `X-Maktab-Membership` owned by the account.
- A visible module requires both an RBAC permission and an enabled tenant entitlement.
- Staff and guardian login accounts are separate identities even when they belong to one person.
- Cloud deployment files are intentionally deferred. Keep local settings development-safe and do
  not add production secrets or a speculative VPS topology.

## Change discipline

- Read the relevant document under `docs/school-platform/features` before implementing a module.
- Update `docs/school-platform/IMPLEMENTATION_TRACKER.md` when a feature changes lifecycle state.
- Add tenant-isolation, permission, audit, and financial invariants before feature CRUD.
- Keep migrations deterministic and committed. Do not edit generated migrations after use.
- Preserve Dari/RTL behavior and add Pashto catalogs when that localization phase begins.

## Verification

- Full foundation: `npm run check`
- Platform API: `npm run test:platform`
- Local timetable API: `npm test --workspace=services/local-api`
- Renderer: `npm run type-check --workspace=apps/web && npm test --workspace=apps/web`
- Python lint: `uv run --package maktab-platform-api ruff check services/platform-api`
