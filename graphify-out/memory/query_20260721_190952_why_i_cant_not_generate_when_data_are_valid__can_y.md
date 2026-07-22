---
type: "query"
date: "2026-07-21T19:09:52.107643+00:00"
question: "Why i cant not generate when data are valid. can you have a review(do not run tests)."
contributor: "graphify"
outcome: "useful"
source_nodes: ["TimetableSolver", "PreSolveAnalyzer", "ConsecutiveConstraint", "SolverDataTransformerService"]
---

# Q: Why i cant not generate when data are valid. can you have a review(do not run tests).

## Answer

Expanded from original query via graph vocab: solver, infeasible, constraint, fixed, lesson, generation, validation, assignment, availability, workload, teacher, timetable. Root cause: teacher 15 Ahmadullah Ahmadi has four hard fixed Math allocations of five periods each for classes 7A, 7B, 8A, and 8B. He is available only Saturday through Tuesday, while allowConsecutivePeriodsForSameSubject is false. The hard consecutive constraint permits each class-subject at most once per day, so each five-period Math allocation needs five distinct teacher-available days but only four exist. PreSolveAnalyzer incorrectly calculates the maximum from all six school days and does not intersect fixed teacher availability, so it passes. A second defect masks the cause: INFEASIBLE is converted to partial fixed-lessons-only with NO_FEASIBLE_SOLUTION downgraded to warning; the API then validates the incomplete schedule and returns generic INVALID_GENERATED_TIMETABLE 422. Immediate data fix: enable consecutive periods, or keep it disabled and make the teacher available for four slots on a fifth day, or reassign one Math period in each affected class. No tests were run.

## Outcome

- Signal: useful

## Source Nodes

- TimetableSolver
- PreSolveAnalyzer
- ConsecutiveConstraint
- SolverDataTransformerService