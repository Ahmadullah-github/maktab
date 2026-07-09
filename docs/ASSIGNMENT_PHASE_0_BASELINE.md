# Assignment Phase 0 Baseline

## Purpose

This document records the accepted phase-0 decisions for the assignment
architecture cutover. It is the baseline for phases 1 through 5.

## Linked Artifacts

- [ADR-001: Canonical Assignment Write Model](./adr/ADR-001-canonical-assignment-write-model.md)
- [ADR-002: Split-Teaching Default Policy](./adr/ADR-002-split-teaching-default-policy.md)
- [Assignment Projection Contract](./contracts/ASSIGNMENT_PROJECTION_CONTRACT.md)

## Domain Invariants

The following invariants are accepted for implementation:

1. Assignment business truth belongs to canonical relational rows, not JSON
   mirrors.
2. UI-facing read models belong to projection endpoints owned by the server.
3. Generic teacher CRUD does not own assignment writes.
4. Generic class CRUD does not own assignment writes.
5. `classTeacherId` is a homeroom or supervisor field only.
6. Teacher capability is eligibility, not active assignment.
7. Every class-subject requirement has one requirement row in the canonical
   model.
8. Every assignment row belongs to one requirement row.
9. `assigned_periods_per_week` must be positive.
10. Total assigned periods for a requirement must not exceed required periods.
11. Split teaching is disabled by default and must be enabled explicitly per
    requirement.
12. Solver reads canonical data only and writes back through canonical rows.
13. Soft-deleted assignment domain rows are excluded from active projections.
14. Client caches may optimize rendering, but they are not authoritative.

## Deprecated Compatibility Fields

These fields remain compatibility-only during the cutover and are formally
deprecated as write authority:

| Field | Status | Notes | Planned replacement |
| --- | --- | --- | --- |
| `Teacher.classAssignments` | Deprecated | Legacy assignment mirror only | `teaching_assignment` |
| `Teacher.primarySubjectIds` | Deprecated | Legacy capability mirror only | `teacher_subject_capability` |
| `Teacher.allowedSubjectIds` | Deprecated | Legacy capability mirror only | `teacher_subject_capability` |
| `ClassGroup.subjectRequirements[].teacherId` | Deprecated | Embedded assignment mirror only | `teaching_assignment` |

Additional rule:

- `ClassGroup.subjectRequirements` may continue as a temporary class
  requirement input, but embedded teacher assignment data is not authoritative.

## Module Ownership

Ownership is by module boundary, not by convenience of the current route.

| Module area | Primary responsibility | Explicitly does not own |
| --- | --- | --- |
| `assignment-domain` backend services | Assignment commands, invariants, projections, reconciliation | Generic teacher or class CRUD |
| `classes` backend services and UI | Class identity, class metadata, requirement definition | Teacher assignment truth |
| `teachers` backend services and UI | Teacher identity, availability, compatibility input during transition | Class assignment truth |
| Solver services | Consume canonical requirements, capabilities, and assignments | Reading or writing legacy mirrors |
| Assignment UI | Render projection views and call assignment commands | Reconstructing truth from fallback fields |

## Phase 0 Exit Criteria

Phase 0 is complete when:

1. The accepted assignment and split-teaching decisions are recorded.
2. Projection targets are defined at the contract level.
3. Deprecated compatibility fields are marked in code and documentation.
4. Later phases can implement schema, migration, and projection work without
   reopening these ownership decisions.
