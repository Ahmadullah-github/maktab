---
type: "query"
date: "2026-07-16T14:08:22.277945+00:00"
question: "Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Teacher", "AssignmentDrawerV2.tsx", "solver.ts", "assignmentCommand.service.ts"]
---

# Q: Implement the assignment remediation plan from ASSIGNMENTS_FEATURE_CODE_REVIEW.md using the resolved Afghanistan school rules

## Answer

Expanded from the prior graph query via graph vocabulary: [allowed, assignment, capability, class, compatibility, period, primary, requirement, route, single, solver, teacher]. Implemented a versioned atomic canonical batch command; all externally reachable compatibility writes translate to it. Manual assignments are hard locks. Primary and allowed capabilities are eligible for grades 4-12, while grades 1-3 derive single-teacher mode and automatically allocate every requirement to the class teacher without capability checks. Grades 4-12 require the class teacher to own at least one lesson before generation. Split requirements accept partial positive allocations and default to remaining periods. Generation now rejects incomplete or policy-invalid drafts with structured 422 conflicts. Canonical projections, effective workload, timetable staleness, UI partial/split state, runtime response schemas, accessibility, responsive layout, and complete English/Farsi catalogs were aligned. API build and 19 tests pass; web type-check, lint, and 22 tests pass; solver Python compiles, while the full solve suite still needs its external Python dependencies.

## Outcome

- Signal: useful

## Source Nodes

- Teacher
- AssignmentDrawerV2.tsx
- solver.ts
- assignmentCommand.service.ts