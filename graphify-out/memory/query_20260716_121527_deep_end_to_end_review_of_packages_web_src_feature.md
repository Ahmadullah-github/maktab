---
type: "query"
date: "2026-07-16T12:15:27.057559+00:00"
question: "Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations"
contributor: "graphify"
outcome: "useful"
source_nodes: ["AssignmentsPage.tsx", "AssignmentDrawerV2.tsx", "useAssignmentMutations.ts", "assignmentCommand.service.ts", "assignmentProjection.service.ts"]
---

# Q: Deep end-to-end review of packages/web/src/features/assignments and packages/web/src/features/teacher-assignments across UI, API, backend, database, and solver integrations

## Answer

Reviewed the assignment, teacher, capability, requirement, projection, workload, command, service, route, validation, schedule, and subject paths. Found 26 actionable issues: 4 P0, 12 P1, and 10 P2. Highest risks are canonical-vs-legacy ID mismatch, identity-changing legacy updates committing before returning 404, allowed capability assignments conflicting with restrictToPrimarySubjects in the solver, and assignment mutations not marking saved timetables stale. Full evidence and remediation plan: ASSIGNMENTS_FEATURE_CODE_REVIEW.md

## Outcome

- Signal: useful

## Source Nodes

- AssignmentsPage.tsx
- AssignmentDrawerV2.tsx
- useAssignmentMutations.ts
- assignmentCommand.service.ts
- assignmentProjection.service.ts