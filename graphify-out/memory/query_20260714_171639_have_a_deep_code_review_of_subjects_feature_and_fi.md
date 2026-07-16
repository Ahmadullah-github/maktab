---
type: "query"
date: "2026-07-14T17:16:39.899504+00:00"
question: "Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE."
contributor: "graphify"
outcome: "corrected"
correction: "The report contains 33 findings: 3 critical, 12 high, 13 medium, and 5 low. The earlier saved summary undercounted high-severity findings by one."
source_nodes: ["SubjectForm.tsx", "SubjectAssignmentSheet.tsx", "useSubjectCoverage.ts"]
---

# Q: Have a deep code review of subjects feature and find out all bugs,inconsistency, wrong implementation, wrong code flow between ui-->backend-->database and more other layers. and their relation with other features. then build a report for me, over all to fix. FOR NOW DO NOT CHANGE CODE.

## Answer

Expanded from original query via vocab: [subject, subjects, assignment, class, teacher, room, schedule, solver, schema, route, service, validation]. Deep review traced UI, API, service, repository, SQLite, classes, assignments, curriculum, rooms, license policy, solver, swaps, and timetable persistence. Full evidence and repair order are in SUBJECTS_FEATURE_CODE_REVIEW.md.

## Outcome

- Signal: corrected
- Correction: The report contains 33 findings: 3 critical, 12 high, 13 medium, and 5 low. The earlier saved summary undercounted high-severity findings by one.

## Source Nodes

- SubjectForm.tsx
- SubjectAssignmentSheet.tsx
- useSubjectCoverage.ts