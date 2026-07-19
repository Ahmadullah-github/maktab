---
type: "query"
date: "2026-07-18T09:02:14.027636+00:00"
question: "Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats.."
contributor: "graphify"
outcome: "useful"
source_nodes: ["AssignmentDrawerV2.tsx", "TeacherSelectionList.tsx", "TeacherSelectionList()", "AssignmentsPage.tsx", "workloadCalculation.ts"]
---

# Q: Here one UI UX problem, exists, in the the assignement drawer , the teachers list is not visible correctly. modify the design layout of this drawer to focus more on teachers list and assignening instead of just labels and stats..

## Answer

Expanded from the original request via graph vocab: [assignment, drawer, teacher, selection, list, layout, stats, summary, panel, scroll, workload]. The graph identified AssignmentDrawerV2.tsx, TeacherSelectionList.tsx, AssignmentsPage.tsx, and workload calculation as the relevant UI path. Reworked the drawer into a compact target/status strip, removed redundant stats panels, empty callout, footer close action, and compatibility group headers, retained a fixed search/summary toolbar, flattened all ranked teachers into one list, compacted workload rows, and made the teacher list the only scroll container. Live Chrome verification at 1366x768 showed two assign buttons immediately visible and all 15 teachers available. TypeScript, targeted ESLint, 28 web tests, and production build passed.

## Outcome

- Signal: useful

## Source Nodes

- AssignmentDrawerV2.tsx
- TeacherSelectionList.tsx
- TeacherSelectionList()
- AssignmentsPage.tsx
- workloadCalculation.ts