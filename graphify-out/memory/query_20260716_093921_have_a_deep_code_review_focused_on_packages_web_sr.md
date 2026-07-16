---
type: "query"
date: "2026-07-16T09:39:21.409039+00:00"
question: "Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Teacher", "teachersApi", "SubjectAssignmentManager.tsx", "TeacherFormDrawer.tsx", "solverDataTransformer.service.ts"]
---

# Q: Have a deep code review focused on packages/web/src/features/teachers and report UI, API, backend, database, and integration bugs without fixing code

## Answer

Expanded from original query via graph vocab: [teacher, teachers, availability, assignment, workload, subject, class, timetable, validation, api, entity, conflict]. Source verification found 6 critical, 11 high, 10 medium, and 4 low issues. The most important are semantic drift between legacy teacher/class mirrors and empty canonical assignment tables, solver failure to enforce fixed split period counts and teacher workload constraints, contradictory zero-capacity semantics, hidden availability contract loss, and non-atomic bulk import. Full evidence and remediation plan are in TEACHERS_FEATURE_CODE_REVIEW.md.

## Outcome

- Signal: useful

## Source Nodes

- Teacher
- teachersApi
- SubjectAssignmentManager.tsx
- TeacherFormDrawer.tsx
- solverDataTransformer.service.ts