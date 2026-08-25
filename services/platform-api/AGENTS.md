# Platform API guidance

- Django/PostgreSQL is authoritative for all online school-platform data.
- Every tenant-owned query must be scoped through an authenticated active membership. A request
  body, query parameter, or renderer-provided tenant ID is not an authorization boundary.
- Access requires role permission and contract entitlement. Sensitive writes also require an
  append-only audit event and, where documented, approval/idempotency controls.
- Browser authentication uses an HttpOnly session plus CSRF. Electron uses short-lived JWT access
  tokens through protected main-process IPC. Never expose token material to renderer JavaScript.
- Keep domain apps modular. Cross-domain mutations belong in explicit application services, not
  signals with hidden side effects.
- Add migrations and tenant-isolation tests for every persisted feature.
- Run `npm run test:platform` and Ruff before handoff.
