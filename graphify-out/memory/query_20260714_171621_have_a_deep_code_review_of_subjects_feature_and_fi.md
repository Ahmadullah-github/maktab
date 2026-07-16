---
type: "query"
date: "2026-07-14T17:16:21.427487+00:00"
question: "Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectForm.tsx", "SubjectAssignmentSheet.tsx", "useSubjectCoverage.ts"]
---

# Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE.

## Answer

Expanded from original query via vocab: [subject, subjects, assignment, class, teacher, room, schedule, solver, schema, route, service, validation]. Deep review traced UI, API, service, repository, SQLite, classes, assignments, curriculum, rooms, license policy, solver, swaps, and timetable persistence. Reported 32 findings: 3 critical, 11 high, 13 medium, 5 low. Critical proofs showed nullable-grade cross-grade overwrite, POST/upsert code-collision replacement plus duplicate bulk rows, and destructive curriculum re-import resetting user-owned constraints. Full evidence and repair order are in SUBJECTS_FEATURE_CODE_REVIEW.md.

## Outcome

- Signal: useful

## Source Nodes

- SubjectForm.tsx
- SubjectAssignmentSheet.tsx
- useSubjectCoverage.ts