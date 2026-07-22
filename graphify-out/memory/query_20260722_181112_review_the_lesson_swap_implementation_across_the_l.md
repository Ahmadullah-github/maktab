---
type: "query"
date: "2026-07-22T18:11:12.133533+00:00"
question: "Review the lesson swap implementation across the listed API and web files without changing code"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SwapSolverService", "SwapConstraintGatherer", "swapValidation.ts", "scheduleStore.ts", "ScheduleGrid.tsx", "useValidSwapTargets.ts", "useSaveScheduleChanges.ts"]
---

# Q: Review the lesson swap implementation across the listed API and web files without changing code

## Answer

Expanded from the original review request via graph vocabulary: swap, lesson, constraint, gatherer, cache, solver, validation, execution, target, unsaved, save, schedule. The review found three release-blocking architectural defects: validation always reads the persisted timetable rather than the current browser draft; the swap validator does not enforce fixed-lesson or consecutive-period hard constraints; and SwapSolverService hard-codes a development virtualenv and Python script that are absent from the packaged Electron application. High-severity findings include stale memoized click handlers, a save race that marks newer edits as saved, frontend room-type checks that reject solver-valid moves, non-atomic lesson matching, a cancellation timer race, and a license read-only bypass on POST /api/swap/execute. Additional issues cover nullable-room contract divergence, lost Farsi error messages, ineffective cache usage, incomplete navigation protection, dead duplicate UI, and very sparse tests. API and web TypeScript checks passed; the two existing Python swap tests passed; direct probes confirmed fixed/consecutive moves are accepted and roomless moves are rejected.

## Outcome

- Signal: useful

## Source Nodes

- SwapSolverService
- SwapConstraintGatherer
- swapValidation.ts
- scheduleStore.ts
- ScheduleGrid.tsx
- useValidSwapTargets.ts
- useSaveScheduleChanges.ts