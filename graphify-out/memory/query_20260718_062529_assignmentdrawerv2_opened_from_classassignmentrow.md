---
type: "query"
date: "2026-07-18T06:25:29.885006+00:00"
question: "AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers"
contributor: "graphify"
outcome: "useful"
source_nodes: ["ClassAssignmentRow.tsx", "AssignmentDrawerV2.tsx", "TeacherSelectionList.tsx", "useSmartTeacherSelection", "teacherCompatibility.ts"]
---

# Q: AssignmentDrawerV2 opened from ClassAssignmentRow does not show the teacher list; show all teachers

## Answer

Expanded from the graph vocabulary via [assignment, drawer, teacher, teachers, class, row, selector, smart, subject, compatible, filter, workload]. The data path is ClassAssignmentRow -> AssignmentDrawerV2 -> TeacherSelectionList -> useSmartTeacherSelection. The hook hard-filtered teachers unless canonical capability rows covered every eligible subject, so generalists and other-specialty teachers disappeared. Removed that capability filter while retaining non-deleted filtering, compatibility ranking, workload warnings, and includeOverloaded behavior. Removed the obsolete eligibleSubjectIds prop, expanded all compatibility groups by default, and labeled unmatched teachers explicitly. Browser verification showed primary, generalist, and other-subject teachers visible in the drawer.

## Outcome

- Signal: useful

## Source Nodes

- ClassAssignmentRow.tsx
- AssignmentDrawerV2.tsx
- TeacherSelectionList.tsx
- useSmartTeacherSelection
- teacherCompatibility.ts