---
type: "query"
date: "2026-07-16T18:12:55.360289+00:00"
question: "Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SubjectRequirementsEditor()", "useCurriculumPopulation", "SubjectAssignmentManager.tsx", "useAssignmentsPage.ts"]
---

# Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?

## Answer

Expanded from original query via vocab: [subject, subjects, curriculum, custom, manual, grade, class, classes, requirement, requirements, teacher, assignments]. Live database evidence: Turkish subjects 101-105 are active catalog rows with grade and 3 periods, but meta is {}, isCustom is false, curriculumManaged is absent, and each has zero active class_subject_requirement rows. Every grade 7/8/10/11/12 class has hasTurkish=0. The web Apply Curriculum flow calls curriculum sync and, when result.subjects is nonempty, uses only result.subjects; that response contains only effective curriculum-managed subjects. It maps those subjects to requirements and replaces the class requirement payload, excluding manual catalog subjects even though allSubjects/gradeSubjects already includes them. Backend populateFromCurriculum and bulk apply likewise map only materialized effective-curriculum subjects. Teacher SubjectAssignmentManager correctly requires an exact subjectId in class.subjectRequirements, so it reports zero available classes. Assignments correctly reads the canonical requirement matrix, so Turkish is absent there too. Root cause is a catalog-vs-curriculum-vs-requirement contract mismatch, compounded by manual subject creation defaulting isCustom=false and not registering a curriculum customization.

## Outcome

- Signal: useful

## Source Nodes

- SubjectRequirementsEditor()
- useCurriculumPopulation
- SubjectAssignmentManager.tsx
- useAssignmentsPage.ts