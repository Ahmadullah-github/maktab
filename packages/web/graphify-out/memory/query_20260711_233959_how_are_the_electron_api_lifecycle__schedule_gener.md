---
type: "architecture"
date: "2026-07-11T23:39:59.472802+00:00"
question: "How are the Electron/API lifecycle, schedule generation, and schedule routes connected after implementation?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["electron/main.js", "packages/api/server.ts", "packages/api/src/app.ts", "packages/web/src/lib/apiBase.ts", "packages/web/src/features/schedule/hooks/useGenerateSchedule.ts", "packages/web/src/features/schedule/hooks/useScheduleRouteLoader.ts"]
---

# Q: How are the Electron/API lifecycle, schedule generation, and schedule routes connected after implementation?

## Answer

Electron now owns the packaged API child lifecycle: it starts the compiled API on an OS-assigned loopback port, waits for IPC readiness plus health, serves the built SPA through Express, stores SQLite under Electron userData, and terminates the child gracefully. Web API calls share a relative API base that Vite proxies during development. Schedule generation has one canonical useGenerateSchedule hook, and both class/teacher routes use one shared useScheduleRouteLoader and ScheduleRouteState. Legacy tests and test tooling were removed; production TypeScript, lint, web/API builds, packaged API, and solver smoke checks pass. Licensing behavior was intentionally left unchanged.

## Outcome

- Signal: useful

## Source Nodes

- electron/main.js
- packages/api/server.ts
- packages/api/src/app.ts
- packages/web/src/lib/apiBase.ts
- packages/web/src/features/schedule/hooks/useGenerateSchedule.ts
- packages/web/src/features/schedule/hooks/useScheduleRouteLoader.ts