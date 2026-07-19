---
type: "query"
date: "2026-07-16T18:24:58.944792+00:00"
question: "Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["CurriculumMaterializationService", "useCurriculumPopulation", "SubjectAssignmentManager", "ClassSubjectRequirement"]
---

# Q: Why do manually added subjects appear on the Subjects screen but not in teachers, classes, or assignments after applying the lesson plan?

## Answer

Expanded from original query via vocab: [subject, subjects, curriculum, custom, manual, grade, class, classes, requirement, requirements, teacher, assignments]. The root cause was that CurriculumMaterializationService returned and synchronized only effective curriculum-managed subjects, while useCurriculumPopulation then replaced the class requirement payload with that incomplete response. The fix now includes every active same-grade manual subject with a positive periodsPerWeek in the authoritative curriculum synchronization, preserves existing class-specific manual requirement overrides, returns those applicable subjects for new-class population, and removes the redundant browser-side class overwrite. SubjectAssignmentManager now distinguishes no required classes from fully assigned classes. Regression tests cover new and existing classes. The full API suite passed 21/21 and focused web contract tests passed 8/8. Live repair synchronized grades 7, 8, 10, 11, and 12; Turkish subject IDs 101-105 now each have two active canonical class requirements.

## Outcome

- Signal: useful

## Source Nodes

- CurriculumMaterializationService
- useCurriculumPopulation
- SubjectAssignmentManager
- ClassSubjectRequirement