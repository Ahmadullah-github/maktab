---
type: "query"
date: "2026-07-18T11:13:33.602549+00:00"
question: "Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes."
contributor: "graphify"
outcome: "useful"
source_nodes: ["ClassSubjectRequirement", "RequirementService", "CurriculumMaterializationService", "SubjectRequirementsEditor.tsx", "solverDataTransformer.service.ts"]
---

# Q: Analyze whether the database and backend support grade-wide subject periods with rare class-specific exceptions, then plan the UI changes.

## Answer

Expanded tokens: curriculum, grade, grades, class, classes, subject, subjects, periods, requirement, requirements, override. The canonical class_subject_requirement table and solver support a distinct required_periods_per_week for every class-subject pair. RequirementService safely updates one class, increments assignmentVersion, marks timetables stale, and rejects reductions below assigned periods. Current UI already exposes a raw per-class number input. However, ClassSubjectRequirement has no inherited-versus-override marker, and CurriculumMaterializationService overwrites curriculum-managed class requirements from the grade subject default on every materialization; therefore Ministry-subject exceptions can be lost. The plan is to add explicit inheritance metadata, preserve overrides during curriculum sync, provide transactional grade-default propagation to inherited rows only, and expose inherited/exception badges, reset-to-default actions, exception counts, and a grade overview in the UI. Recommended defaults: preserve exceptions, support both class and grade views, and block reductions below existing allocations.

## Outcome

- Signal: useful

## Source Nodes

- ClassSubjectRequirement
- RequirementService
- CurriculumMaterializationService
- SubjectRequirementsEditor.tsx
- solverDataTransformer.service.ts