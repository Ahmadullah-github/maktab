# Windows runtime acceptance

Complete one copy of this record for every Phase 2 release candidate. Use the unsigned unpacked CI
artifact only for internal testing; it is not a public release artifact.

## Build evidence

- Commit:
- CI run:
- Package SHA-256:
- Electron / electron-builder / electron-updater versions:
- Tester and date:

## Test matrix

Run the complete matrix on a clean, fully patched Windows 10 x64 VM and a clean, fully patched
Windows 11 x64 VM. Neither VM may have Node.js, Python, SQLite, or developer tooling installed.

| Scenario | Windows 10 | Windows 11 | Evidence / notes |
| --- | --- | --- | --- |
| Package starts without developer runtimes | | | |
| Diagnostics report database and solver ready | | | |
| QA license activation succeeds | | | |
| Activation remains valid after restart (safeStorage) | | | |
| Minimal school fixture generates a timetable | | | |
| Generated timetable remains after restart | | | |
| Save as PDF succeeds | | | |
| Native printing succeeds using Microsoft Print to PDF or a physical printer | | | |
| Cross-origin navigation and popups open nothing | | | |
| Clean shutdown leaves no local API or solver process | | | |

Any startup, security, data-loss, generation, persistence, or printing failure blocks Phase 2.
