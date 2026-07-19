---
type: "review"
date: "2026-07-19T07:06:42.978559+00:00"
question: "Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements"
contributor: "graphify"
outcome: "useful"
source_nodes: ["swapValidation.ts", "ExportDialog", "useExportSchedule", "SwapConstraintGatherer", "SwapSolverService", "solver.py", "DecompositionSolver", "scheduleStore"]
---

# Q: Deep review and fix swaps, exports, and the Python solver; find bugs, wrong implementations, and improvements

## Answer

Expanded terms: swap, export, solver, schedule, timetable, validation, constraint, room, teacher, class, generation, api. Fixed stale swap validation data, multi-teacher constraint loss, unvalidated Python responses, partial swap persistence, export polling stale closure, cancellation state, export scope/target validation, leaked token mappings, unsafe download error responses, legacy decomposition response loss, Unicode corruption, malformed timetable fallback, and missing room names. Added UI, API, and Python regression tests; full suites and production build pass.

## Outcome

- Signal: useful

## Source Nodes

- swapValidation.ts
- ExportDialog
- useExportSchedule
- SwapConstraintGatherer
- SwapSolverService
- solver.py
- DecompositionSolver
- scheduleStore