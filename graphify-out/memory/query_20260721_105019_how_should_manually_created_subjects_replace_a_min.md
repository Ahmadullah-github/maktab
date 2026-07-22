---
type: "query"
date: "2026-07-21T10:50:19.685030+00:00"
question: "How should manually created subjects replace a ministry subject and be assigned to existing classes without refreshing the whole curriculum?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectForm.tsx", "BulkApplyCurriculumDialog", "useCurriculumPopulation", "CurriculumMaterializationService", "SubjectRequirementsEditor.tsx", "ClassAssignmentManager.tsx", "CurriculumConfig"]
---

# Q: How should manually created subjects replace a ministry subject and be assigned to existing classes without refreshing the whole curriculum?

## Answer

Expanded from original query via graph vocab: [subject, subjects, curriculum, bulk, apply, assignment, classes, grade, periods, manual, teacher, requirements]. SubjectForm creates only a catalog subject; deletion cleans subject references but does not set a curriculum isRemoved override. BulkApplyCurriculum is a reconciliation operation, not an additive subject attachment: overwrite=false skips classes with requirements, while overwrite=true invokes materializeGrades, which synchronizes all classes of each affected grade and can recreate a deleted ministry subject. SubjectRequirementsEditor already supports additive class requirements but is only rendered for single-teacher classes; grades 7-9 use ClassAssignmentManager, which has no add/remove-subject control. Three viable flows are: class-level requirement editing for exceptions; a new idempotent bulk add/replace subject-to-selected-classes operation that never materializes curriculum; or, recommended for school-wide grade policy, expose existing CurriculumConfig APIs to mark حرفه removed and add ترکی as a custom curriculum subject for grades 7-9, then materialize once. The third flow correctly affects current and future classes while keeping ministry curriculum as the baseline.

## Outcome

- Signal: useful

## Source Nodes

- SubjectForm.tsx
- BulkApplyCurriculumDialog
- useCurriculumPopulation
- CurriculumMaterializationService
- SubjectRequirementsEditor.tsx
- ClassAssignmentManager.tsx
- CurriculumConfig