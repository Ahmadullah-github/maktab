---
type: "query"
date: "2026-07-11T21:31:03.941008+00:00"
question: "Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown."
contributor: "graphify"
outcome: "useful"
source_nodes: ["main.tsx", "MainLayout.tsx", "api.ts", "ScheduleDashboard.tsx", "useEnhancedGenerateSchedule.ts", "scheduleStore.ts", "solver.ts"]
---

# Q: Review how the codebase is connected, focusing on packages/web and executable code rather than Markdown.

## Answer

Expanded from the original request via graph vocabulary: [main, router, route, client, state, store, query, api, assignment, schedule, generate, solver]. The web app boots in main.tsx with TanStack Query and Router; the root layout initializes direction and licensing and renders feature routes. CRUD flows from feature pages through hooks and API clients into Express routes, TypeORM repositories, and SQLite. Schedule generation flows from ScheduleDashboard through useEnhancedGenerateSchedule to POST /generate, then SolverDataTransformerService, SolverService, the Python solver, TimetableService persistence, query invalidation, normalization, and useScheduleStore. Direct source verification found unresolved Electron packaging, machine-ID/license, TypeScript, lint, and test-baseline issues.

## Outcome

- Signal: useful

## Source Nodes

- main.tsx
- MainLayout.tsx
- api.ts
- ScheduleDashboard.tsx
- useEnhancedGenerateSchedule.ts
- scheduleStore.ts
- solver.ts