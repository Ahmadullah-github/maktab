---
type: "query"
date: "2026-07-18T09:39:25.673122+00:00"
question: "Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing."
contributor: "graphify"
outcome: "useful"
source_nodes: ["AssignmentDrawerV2.tsx", "TeacherSelectionList.tsx", "useAssignmentMutations.ts", "useUnifiedAssignment.ts", "assignmentCommand.service.ts", "Teacher"]
---

# Q: Implement an atomic Add as Primary and assign flow for headteachers across subject, class, and assignment drawer, with workload and availability conflict rollback and no allowed behavior outside teacher editing.

## Answer

Expanded tokens: assignment, assign, teacher, subject, capability, primary, conflict, batch, workload, availability, drawer. Implemented all-teacher visibility and explicit Add as Primary and assign actions across assignment surfaces. The API accepts explicit primary capability grants, validates that grants correspond to allocations, evaluates stale versions, subject/class policy, effective workload, and availability-derived capacity first, then promotes capabilities and writes assignments within one transaction. Any conflict rolls back both changes. Existing allowed capabilities are promoted to primary in assignment flows; allowed remains managed only in the Teacher editor. Verified with API build, atomic integration tests including unavailable capacity rollback and allowed-to-primary promotion, web type-check, focused tests, lint, and production build.

## Outcome

- Signal: useful

## Source Nodes

- AssignmentDrawerV2.tsx
- TeacherSelectionList.tsx
- useAssignmentMutations.ts
- useUnifiedAssignment.ts
- assignmentCommand.service.ts
- Teacher