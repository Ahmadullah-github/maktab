---
type: "query"
date: "2026-07-14T17:54:45.924347+00:00"
question: "fix all the problems, that you have found. phase by phase. do the testing at the very end."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectForm.tsx", "SubjectAssignmentSheet.tsx", "useSubjectCoverage.ts"]
---

# Q: fix all the problems, that you have found. phase by phase. do the testing at the very end.

## Answer

Expanded from the original subject-feature query via graph vocabulary: [subject, subjects, assignment, class, teacher, room, schedule, solver, schema, route, service, validation]. Remediation completed all 33 findings in dependency-ordered phases: persistence and subject identity; curriculum and period contracts; multi-teacher assignments and coverage; integration, licensing, solver, and timetable lifecycle; then UI correctness. Added managed identity and timetable-staleness migrations plus API, web, and solver regression tests. Final verification passed: API 16/16, web type-check and production build, web tests 15/15, solver tests 19/19. The detailed disposition is in SUBJECTS_FEATURE_CODE_REVIEW.md.

## Outcome

- Signal: useful

## Source Nodes

- SubjectForm.tsx
- SubjectAssignmentSheet.tsx
- useSubjectCoverage.ts