---
type: "query"
date: "2026-07-18T08:25:39.468144+00:00"
question: "Implement the plan."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Teacher", "AvailabilityMatrix.tsx", "SubjectAssignmentManager.tsx", "TeacherEditDrawer.tsx", "PeriodStructurePage.tsx"]
---

# Q: Implement the plan.

## Answer

Expanded from the original request via graph vocab: [teacher, availability, unavailable, workload, capacity, solver, schema, periods, config, assignment]. Implemented one canonical sparse unavailable-slot model and weekly effective capacity across the Teacher database/API contract, AvailabilityMatrix and TeacherEditDrawer save flow, SubjectAssignmentManager workload projection, school period bounds validation, solver input, and swap checks. Removed teacher-wide daily and consecutive limits while retaining the two-period same class-subject constraint. Verified migration, API startup, 21 API tests, 28 web tests, 6 solver tests, TypeScript, lint, production build, database integrity, and live health/teacher endpoints.

## Outcome

- Signal: useful

## Source Nodes

- Teacher
- AvailabilityMatrix.tsx
- SubjectAssignmentManager.tsx
- TeacherEditDrawer.tsx
- PeriodStructurePage.tsx