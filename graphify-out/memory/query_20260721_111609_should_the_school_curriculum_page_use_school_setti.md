---
type: "query"
date: "2026-07-21T11:16:09.033896+00:00"
question: "Should the School Curriculum page use School Settings and Period Structure as dynamic inputs, and smartly create subjects and classes when applying?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SchoolConfigDto", "PeriodStructurePage.tsx", "BulkClassDialog.tsx", "CurriculumMaterializationService", "CurriculumConfig", "ClassService"]
---

# Q: Should the School Curriculum page use School Settings and Period Structure as dynamic inputs, and smartly create subjects and classes when applying?

## Answer

Expanded from original query via graph vocab: [curriculum, school, settings, periods, structure, grades, capacity, subjects, classes, preview, apply, bulk]. The idea is correct if Curriculum is an orchestration source of truth for subject plans, not a replacement authority for every setting. School Settings remains authoritative for enabled levels and working days; Period Structure remains authoritative for schedulable slots by day/category; Curriculum owns effective subjects and weekly demand by grade; the subject catalog and class requirements are materialized outputs; Classes remain authoritative for real cohorts and sections. The page should load all authorities dynamically, calculate per-grade capacity versus curriculum demand, stage changes, request a server-generated impact preview, then apply with revision checks and idempotency. Subject creation and synchronization to existing classes can be automatic because they are deterministic and are already supported by curriculum materialization. Creating missing classes should be optional and reviewed because curriculum cannot infer section counts, names, student counts, rooms, or whether a grade actually operates this year. Reuse the existing bulk-class naming and section preview within an optional Create missing classes step. Never silently create or delete classes, and never delete teacher assignments without explicit impact confirmation.

## Outcome

- Signal: useful

## Source Nodes

- SchoolConfigDto
- PeriodStructurePage.tsx
- BulkClassDialog.tsx
- CurriculumMaterializationService
- CurriculumConfig
- ClassService