# Local timetable API guidance

- Scope is offline timetable generation, its reference data, exports, licensing, and desktop OS
  integration. Do not add school-platform finance, HR, messaging, attendance, or identity tables.
- All routes mount below `/local-api/v1`.
- SQLite data belongs to the local installation and is not a cloud source of truth.
- A future sync adapter must use explicit versioned contracts; never connect directly to the
  platform PostgreSQL database.
- Run `npm test --workspace=services/local-api` after changes.
