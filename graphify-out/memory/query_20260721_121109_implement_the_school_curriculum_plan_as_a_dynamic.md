---
type: "architecture"
date: "2026-07-21T12:11:09.399188+00:00"
question: "Implement the School Curriculum plan as a dynamic school-owned source of truth using School Settings and Period Structure, with reviewed subject/class materialization."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SchoolConfigDto", "PeriodStructurePage.tsx", "BulkClassDialog.tsx", "CurriculumMaterializationService", "CurriculumConfig", "ClassService", "Sidebar", "SubjectsPage.tsx"]
---

# Q: Implement the School Curriculum plan as a dynamic school-owned source of truth using School Settings and Period Structure, with reviewed subject/class materialization.

## Answer

Implemented /school-curriculum as a dedicated sidebar feature. School Settings controls active grades, Period Structure controls weekly capacity, school-owned grade curriculum controls subject demand, and a revisioned preview/apply transaction materializes subjects, synchronizes existing classes, optionally creates reviewed classes, blocks over-capacity plans, and requires confirmation before removing teacher assignments. Manual and bulk subject writes now update the same curriculum transactionally; Ministry validation was removed while the Afghanistan curriculum remains an optional draft template.

## Outcome

- Signal: useful

## Source Nodes

- SchoolConfigDto
- PeriodStructurePage.tsx
- BulkClassDialog.tsx
- CurriculumMaterializationService
- CurriculumConfig
- ClassService
- Sidebar
- SubjectsPage.tsx