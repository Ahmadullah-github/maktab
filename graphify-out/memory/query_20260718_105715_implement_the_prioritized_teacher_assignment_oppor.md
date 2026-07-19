---
type: "query"
date: "2026-07-18T10:57:15.986323+00:00"
question: "Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectAssignmentManager.tsx", "SubjectAssignmentRow.tsx", "useAssignmentMutations.ts", "assignmentCommand.service.ts", "Teacher"]
---

# Q: Implement the prioritized teacher assignment opportunity view and confirmed override flow in TeacherEditDrawer subjects/classes tab.

## Answer

Expanded tokens: teacher, subjects, assignment, requirements, drawer, override, partial, search, capability, classes. Implemented canonical matrix-derived grouping into needs assignment, current assignments, and hidden/no-demand subjects. Search respects the visible groups and Show all subjects reveals fully assigned/no-demand items. Normal batch changes preserve existing allocations and fill only remaining periods. Fully assigned items require a detailed confirmation and then use expected-version batch validation/application to replace every current allocation atomically. Teacher-feature allowed capabilities remain allowed. Added opportunity/batch unit tests and an API integration assertion for complete override and allowed preservation; type-check, lint, focused tests, API build/test, diff checks, JSON parsing, and production web build pass.

## Outcome

- Signal: useful

## Source Nodes

- SubjectAssignmentManager.tsx
- SubjectAssignmentRow.tsx
- useAssignmentMutations.ts
- assignmentCommand.service.ts
- Teacher