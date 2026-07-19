---
type: "query"
date: "2026-07-18T12:08:00.297346+00:00"
question: "Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectAssignmentManager", "ClassEditDrawer", "ClassAssignmentManager", "ClassSubjectPeriodEditor", "SubjectAssignmentSheet", "ClassAssignmentRow", "AssignmentProjectionService", "RequirementService"]
---

# Q: Here, can you update all UI components that they show the periods of subjects-class??? because the UI is yet do not working  correctly. the subject-class periods must be changeable from this components also packages/web/src/features/teachers/components/SubjectAssignmentManager.tsx packages/web/src/features/classes/components/ClassEditDrawer.tsx  and other UI parts must render or must show the real changes of periods. what do you think of???

## Answer

Implemented one transactional canonical class-subject period update endpoint and a shared period editor. Wired it into the teacher assignment manager, both class drawer assignment modes, the subject edit manager, and the subject assignment sheet. Propagated periodMode through canonical projections, distinguished teacher allocation from class requirement, invalidated all dependent assignment/coverage/workload caches, and verified API/web builds plus full tests.

## Outcome

- Signal: useful

## Source Nodes

- SubjectAssignmentManager
- ClassEditDrawer
- ClassAssignmentManager
- ClassSubjectPeriodEditor
- SubjectAssignmentSheet
- ClassAssignmentRow
- AssignmentProjectionService
- RequirementService