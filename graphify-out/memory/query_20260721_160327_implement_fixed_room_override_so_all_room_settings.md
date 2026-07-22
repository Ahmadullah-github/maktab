---
type: "implementation"
date: "2026-07-21T16:03:27.127464+00:00"
question: "Implement fixed-room override so all room settings and preferences are ignored for fixed classes while non-fixed classes retain validation"
contributor: "graphify"
outcome: "useful"
source_nodes: ["packages/solver/core/solver.py", "packages/solver/core/swap_validator.py", "packages/solver/feedback/pre_solve_analyzer.py", "packages/solver/feedback/quality_scorer.py", "packages/api/src/services/generatedTimetableValidation.service.ts", "packages/api/src/services/SwapConstraintGatherer.ts", "packages/web/src/features/schedule/utils/constraintChecker.ts", "packages/web/src/features/classes/components/ui/RoomSelector.tsx"]
---

# Q: Implement fixed-room override so all room settings and preferences are ignored for fixed classes while non-fixed classes retain validation

## Answer

Implemented end-to-end. Solver fixed-room domains bypass room type, capacity, required/desired features, availability, home-room, teacher-room, and room-stability preferences while preserving room existence, exact assignment, collision, teacher, class, and time constraints. Pre-solve and quality reporting match. API output validation and Python/web swap validation carry fixedRoomId and apply the same semantics. RoomSelector now closes after selection. Added fixed and non-fixed regression coverage; solver tests, API build/tests, web type-check/tests, and targeted lint pass.

## Outcome

- Signal: useful

## Source Nodes

- packages/solver/core/solver.py
- packages/solver/core/swap_validator.py
- packages/solver/feedback/pre_solve_analyzer.py
- packages/solver/feedback/quality_scorer.py
- packages/api/src/services/generatedTimetableValidation.service.ts
- packages/api/src/services/SwapConstraintGatherer.ts
- packages/web/src/features/schedule/utils/constraintChecker.ts
- packages/web/src/features/classes/components/ui/RoomSelector.tsx