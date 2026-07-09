# Assignment Architecture Implementation Plan

## Document Purpose

This document defines the target architecture and full implementation plan for
fixing assignment consistency across the Maktab codebase.

The goal is to eliminate the current multi-source assignment model and replace
it with one canonical relational domain model, one write path, and server-owned
read projections.

This plan is intentionally aggressive. It assumes we prefer a high-risk,
high-clarity cutover over extending the current mixed architecture.

**Owner:** Ahmadullah Ahmadi
**Area:** Assignments, Classes, Teachers, Subjects, Solver integration
**Risk Level:** High
**Recommended Delivery Mode:** Aggressive phased cutover
**Estimated Duration:** 4-8 weeks
**Last Updated:** 2026-04-14

---

## Table of Contents

- [Assignment Architecture Implementation Plan](#assignment-architecture-implementation-plan)
  - [Document Purpose](#document-purpose)
  - [1. Problem Statement](#1-problem-statement)
  - [2. Current Architecture Issues](#2-current-architecture-issues)
  - [3. Target Architecture](#3-target-architecture)
  - [4. Domain Rules to Finalize Before Coding](#4-domain-rules-to-finalize-before-coding)
  - [5. Target Database Model](#5-target-database-model)
  - [6. API and Module Design](#6-api-and-module-design)
  - [7. Frontend Design](#7-frontend-design)
  - [8. Implementation Strategy](#8-implementation-strategy)
  - [9. Phase-by-Phase Plan](#9-phase-by-phase-plan)
  - [10. Data Migration Strategy](#10-data-migration-strategy)
  - [11. Solver Integration Plan](#11-solver-integration-plan)
  - [12. Testing Strategy](#12-testing-strategy)
  - [13. Rollout and Cutover Strategy](#13-rollout-and-cutover-strategy)
  - [14. Rollback Strategy](#14-rollback-strategy)
  - [15. Codebase Impact Estimate](#15-codebase-impact-estimate)
  - [16. File and Module Impact](#16-file-and-module-impact)
  - [17. Risks and Mitigations](#17-risks-and-mitigations)
  - [18. Definition of Done](#18-definition-of-done)

---

## 1. Problem Statement

The assignment domain is currently persisted and rendered from multiple models:

1. `Teacher.classAssignments`
2. `ClassGroup.subjectRequirements[].teacherId`
3. `TeacherClassSubjectAssignment`

These models are written by different features and read by different features.
That causes:

- stale UI in different pages
- contradictory workload calculations
- broken status badges and selection logic
- invalid solver inputs
- data drift that accumulates over time

The system currently has one physical database, but not one logical source of
truth for assignments.

---

## 2. Current Architecture Issues

### Persisted state is duplicated

Assignment truth exists in both JSON fields and normalized rows.

### Write paths are inconsistent

Some screens mutate teacher CRUD, some mutate class CRUD, some mutate
assignment-specific routes, and some go through the assignment service.

### Read paths are inconsistent

Some screens read the normalized assignment table, while others derive state
from teacher or class JSON fields.

### Domain rules are contradictory

The backend assignment service enforces single-teacher behavior in key paths,
while parts of the UI already model split-period or multi-teacher assignment.

### Derived calculations are not trustworthy

Workload, conflict, coverage, and assignment status are often computed from
legacy mirrors instead of canonical assignment rows.

---

## 3. Target Architecture

The assignment domain will use:

- one canonical relational write model
- one transaction boundary per command
- server-built read projections
- client caches as disposable replicas only

### Architectural principles

1. The database is the source of truth for domain state.
2. The API is the source of truth for UI-facing view models.
3. React Query is a cache, not authority.
4. Generic teacher/class CRUD must not mutate assignment state.
5. Assignment invariants must be enforced in both service logic and database
   constraints.
6. The solver must consume the canonical domain model only.

### Style and UI state

The database should own business truth, not presentational state. The frontend
should continue to own:

- open/closed drawers
- selected rows/cells
- hover/focus state
- layout state
- local optimistic transitions

---

## 4. Domain Rules to Finalize Before Coding

These decisions must be written as ADRs or explicit product rules before phase
1 begins.

### Rule A: Can one class-subject have multiple teachers?

Two valid options exist:

1. Single-teacher only
2. Split-teaching allowed

### Recommended decision

Use a schema that supports split teaching, but enforce single-teacher by
default through a requirement-level flag.

This means:

- the data model supports multiple assignments per requirement
- most class-subject requirements default to `allowSplitAssignment = false`
- the service rejects additional assignments unless splitting is allowed

### Rule B: What is `classTeacherId`?

`classTeacherId` must remain a homeroom or supervisor field only. It must never
be treated as subject assignment truth.

### Rule C: What is a teacher capability?

Teacher capability must be modeled independently from active assignments:

- `primary`
- `allowed`

Capability is eligibility, not assignment.

### Rule D: What is solver authority?

Recommended rule:

- manual assignments persist as canonical rows
- solver reads canonical rows and treats fixed rows as hard constraints
- solver-generated assignments are written back into canonical rows with
  `source = solver`

---

## 5. Target Database Model

### Existing entities to retain

- `Teacher`
- `ClassGroup`
- `Subject`
- `Room`

### New or refactored tables

#### `class_subject_requirement`

Defines what a class needs.

```text
id
class_id
subject_id
required_periods_per_week
allow_split_assignment
is_deleted
deleted_at
created_at
updated_at
```

Constraints:

- unique `(class_id, subject_id)`
- `required_periods_per_week > 0`

#### `teacher_subject_capability`

Defines what a teacher may teach.

```text
id
teacher_id
subject_id
capability_level  -- primary | allowed
is_deleted
deleted_at
created_at
updated_at
```

Constraints:

- unique `(teacher_id, subject_id)`
- capability enum constraint

#### `teaching_assignment`

Defines who is actively assigned to a class-subject requirement.

```text
id
class_subject_requirement_id
teacher_id
assigned_periods_per_week
is_fixed
source           -- manual | solver | migration
is_deleted
deleted_at
created_at
updated_at
```

Constraints:

- unique `(class_subject_requirement_id, teacher_id)`
- `assigned_periods_per_week > 0`

### Strongly recommended indexes

- `class_subject_requirement(class_id)`
- `class_subject_requirement(subject_id)`
- `teacher_subject_capability(teacher_id)`
- `teacher_subject_capability(subject_id)`
- `teaching_assignment(class_subject_requirement_id)`
- `teaching_assignment(teacher_id)`

### Legacy fields to deprecate

These fields must become compatibility-only and eventually be removed:

- `Teacher.classAssignments`
- `Teacher.primarySubjectIds`
- `Teacher.allowedSubjectIds`
- `ClassGroup.subjectRequirements.teacherId`

Note:

- `subjectRequirements` may continue to exist short term as curriculum input,
  but assignment-specific fields must stop being authoritative.

---

## 6. API and Module Design

### Backend module boundaries

Create or consolidate an `assignment-domain` area with these responsibilities:

- requirements
- capabilities
- assignments
- validation
- projections
- reconciliation

### Command endpoints

Generic entity CRUD must stop mutating assignment truth.

#### Class requirements

```text
PUT /api/classes/:classId/requirements
GET /api/classes/:classId/requirements
```

Payload shape:

```json
{
  "requirements": [
    {
      "subjectId": 12,
      "requiredPeriodsPerWeek": 3,
      "allowSplitAssignment": false
    }
  ]
}
```

#### Teacher capabilities

```text
PUT /api/teachers/:teacherId/capabilities
GET /api/teachers/:teacherId/capabilities
```

Payload shape:

```json
{
  "capabilities": [
    { "subjectId": 12, "capabilityLevel": "primary" },
    { "subjectId": 18, "capabilityLevel": "allowed" }
  ]
}
```

#### Teaching assignments

```text
POST   /api/requirements/:requirementId/assignments
PATCH  /api/assignments/:assignmentId
DELETE /api/assignments/:assignmentId
```

Create payload:

```json
{
  "teacherId": 4,
  "assignedPeriodsPerWeek": 2,
  "isFixed": true,
  "source": "manual"
}
```

Update payload:

```json
{
  "assignedPeriodsPerWeek": 1,
  "isFixed": false
}
```

### Projection endpoints

The UI should render from projection endpoints, not from ad hoc stitched entity
data.

Recommended endpoints:

```text
GET /api/assignment-matrix
GET /api/classes/:classId/assignment-view
GET /api/subjects/:subjectId/coverage-view
GET /api/teachers/:teacherId/workload-view
GET /api/teachers/:teacherId/assignment-summary
```

Projection responses should include:

- requirement metadata
- assigned teachers
- assigned periods
- remaining periods
- capability status
- conflict or warning summaries
- display-ready labels needed by the screen

---

## 7. Frontend Design

### Frontend rules

1. Components must never derive assignment truth from `teacher.classAssignments`.
2. Components must never derive assignment truth from
   `subjectRequirements.teacherId`.
3. Components must render from projection endpoints or canonical assignment
   hooks only.
4. Teacher edit forms must not modify assignments.
5. Class edit forms must not modify assignments except through requirement
   endpoints.
6. Query invalidation must target canonical query keys only.

### Query model

React Query should cache:

- teachers
- classes
- subjects
- requirements
- assignments
- capabilities
- assignment projections

It should not cache derived business truth in component-owned fallback logic.

### UI structure

Recommended feature ownership:

```text
packages/web/src/features/
  assignments/
    api/
    hooks/
    components/
    projections/
    types/
  classes/
    requirements/
  teachers/
    capabilities/
  subjects/
    coverage/
```

### Frontend anti-patterns to remove

- direct writes to `teachersApi.update(...classAssignments...)`
- direct writes to `classesApi.update(...subjectRequirements.teacherId...)`
- fallback from assignment table to class requirement teacher id
- workload calculations based on legacy mirrors
- status chips based on legacy mirrors

---

## 8. Implementation Strategy

### Recommended strategy

Use an aggressive phased cutover:

1. Build canonical model and reconciliation tooling.
2. Switch all writes to canonical commands.
3. Switch all read-heavy UI to projections.
4. Freeze legacy fields.
5. Remove legacy reads and writes.
6. Remove legacy columns after stabilization.

### Why not incremental patching only?

Patching invalidation and sync bugs in the current architecture increases
complexity but does not remove the root cause. The current model is not failing
because of one missing refresh. It is failing because multiple persisted
representations are treated as truth.

### Why not microservices?

This repo should remain a modular monolith. Splitting the assignment domain into
networked services would increase operational complexity while the current
problem is consistency inside one codebase.

---

## 9. Phase-by-Phase Plan

### Phase 0: ADRs, invariants, and ownership

**Duration:** 1-2 days

#### Objectives

1. Finalize domain rules.
2. Decide split-teaching default behavior.
3. Freeze legacy write patterns in planning.
4. Define team ownership per module.

#### Deliverables

- architecture decision record for assignment model
- architecture decision record for split-teaching
- data contract for projection endpoints

#### Acceptance criteria

- all domain invariants are written down
- all old writable fields are formally marked deprecated

#### Phase 0 artifacts

- [Phase 0 baseline](./ASSIGNMENT_PHASE_0_BASELINE.md)
- [ADR-001: Canonical assignment write model](./adr/ADR-001-canonical-assignment-write-model.md)
- [ADR-002: Split-teaching default policy](./adr/ADR-002-split-teaching-default-policy.md)
- [Assignment projection contract](./contracts/ASSIGNMENT_PROJECTION_CONTRACT.md)

---

### Phase 1: Database schema foundation

**Duration:** 3-5 days

#### Objectives

1. Add canonical tables for requirements, capabilities, and assignments.
2. Preserve old fields during transition.
3. Add indexes and constraints.

#### Backend deliverables

- TypeORM entities for:
  - `ClassSubjectRequirement`
  - `TeacherSubjectCapability`
  - `TeachingAssignment`
- migration files
- repository layer for each canonical table

#### Acceptance criteria

- migrations run cleanly on a fresh database
- migrations run cleanly on the current database
- schema constraints prevent obvious duplicates

---

### Phase 2: Backfill and reconciliation tooling

**Duration:** 3-4 days

#### Objectives

1. Backfill canonical tables from legacy JSON fields and current assignment rows.
2. Detect contradictions rather than silently hiding them.
3. Produce a reconciliation report before cutover.

#### Required tooling

- one backfill script
- one integrity-report script
- one dry-run mode

#### Reconciliation priority

Recommended precedence for migration input:

1. `TeacherClassSubjectAssignment`
2. `ClassGroup.subjectRequirements`
3. `Teacher.classAssignments`

If contradictions exist:

- mark them in report output
- do not silently overwrite without rule-based reconciliation

#### Acceptance criteria

- every active class-subject requirement has one canonical requirement row
- every active teacher capability is represented canonically
- every active assignment row is mapped to a canonical requirement
- reconciliation report is reviewed before write cutover

---

### Phase 3: Canonical write service

**Duration:** 4-6 days

#### Objectives

1. Create one transactional command service for assignment operations.
2. Remove assignment writes from generic teacher and class service flows.
3. Stop direct repository writes from assignment routes.

#### Required backend work

- create `AssignmentCommandService`
- create `RequirementService`
- create `TeacherCapabilityService`
- refactor routes to use services only

#### Invariants the service must enforce

1. teacher exists and is active
2. class exists and is active
3. subject exists and is active
4. capability exists or assignment is explicitly blocked
5. assigned periods do not exceed requirement capacity
6. when split is disabled, only one active assignment may exist
7. delete and update operations are transactional

#### Acceptance criteria

- all assignment-related writes go through one service boundary
- no route writes directly to canonical repositories except through services
- teacher CRUD and class CRUD no longer mutate assignment truth

---

### Phase 4: Projection query layer

**Duration:** 4-6 days

#### Objectives

1. Build server-owned read models for all assignment-heavy screens.
2. Remove the need for client-side business fallbacks.

#### Required backend projections

- class assignment view
- subject coverage view
- teacher workload view
- assignment matrix view
- teacher assignment summary view

#### Acceptance criteria

- all projections are generated from canonical tables only
- no projection depends on legacy JSON assignment state
- projection latency is acceptable for interactive UI use

---

### Phase 5: Frontend write cutover

**Duration:** 5-7 days

#### Objectives

1. Remove direct assignment writes from teacher and class forms.
2. Point all assignment actions to canonical endpoints only.
3. Simplify cache invalidation around canonical keys.

#### Frontend areas to change first

- `features/teachers`
- `features/classes`
- `features/subjects`
- `features/assignments`
- `features/teacher-assignments`
- `src/lib/queryKeys.ts`

#### Acceptance criteria

- no frontend code updates `classAssignments` directly
- no frontend code writes `subjectRequirements.teacherId` directly
- all assign/unassign flows use canonical commands

---

### Phase 6: Frontend read cutover

**Duration:** 5-8 days

#### Objectives

1. Move screens to projection-driven rendering.
2. Remove fallback logic based on legacy fields.

#### Highest-priority screens

1. assignment drawers
2. subject assignment sheet and subject coverage screens
3. class subject requirements editor
4. teacher workload and assignment summaries
5. bulk selection and status badges

#### Acceptance criteria

- assignment status is derived from projections only
- workload is derived from projections only
- subject coverage is derived from projections only
- multi-teacher UI behavior matches backend rules

---

### Phase 7: Solver cutover

**Duration:** 3-5 days

#### Objectives

1. Make solver input generation depend on canonical tables only.
2. Remove solver dependence on legacy teacher/class assignment mirrors.]\][lo.p;['/**
85/#### Acceptance criteria

- solver transformer reads canonical requirements, capabilities, and assignments
- infeasibility caused by stale mirrors is eliminated
- pre-solve analysis uses the same canonical source as solve

---

### Phase 8: Legacy freeze and removal

**Duration:** 3-5 days

#### Objectives

1. Make legacy fields read-only or derived temporarily.
2. Remove legacy reads from production code.
3. Remove legacy columns after stabilization.

#### Acceptance criteria

- no production path depends on `Teacher.classAssignments`
- no production path depends on `subjectRequirements.teacherId`
- legacy columns are either removed or no longer semantically authoritative

---

## 10. Data Migration Strategy

### Migration rules

#### Requirements backfill

Create one `class_subject_requirement` row per active class-subject requirement
found in `ClassGroup.subjectRequirements`.

#### Capabilities backfill

Build canonical capabilities from:

- `Teacher.primarySubjectIds`
- `Teacher.allowedSubjectIds`

#### Assignments backfill

Primary source for assignment rows:

- `TeacherClassSubjectAssignment`

Secondary fallback only when missing:

- `ClassGroup.subjectRequirements[].teacherId`
- `Teacher.classAssignments`

### Data repair rules

If a canonical assignment points to a teacher without canonical capability:

- create a reconciliation report entry
- do not auto-drop the row unless a migration rule explicitly says to

If legacy sources disagree:

- record a conflict
- assign a deterministic winner
- keep the losing source only as historical noise until removal

### Required migration reports

- requirements count before/after
- capability count before/after
- assignment count before/after
- orphaned rows
- duplicate rows
- period mismatches
- capability mismatches
- deleted entity references

---

## 11. Solver Integration Plan

### Current problem

Solver input currently risks mixing assignment truth from incompatible sources.

### Target solver input flow

```text
canonical requirements
  + canonical capabilities
  + canonical assignments
  + teacher availability
  + room data
  = solver input
```

### Required backend changes

- refactor `solverDataTransformer.service.ts`
- remove dependence on `Teacher.classAssignments`
- remove dependence on `subjectRequirements.teacherId`
- ensure fixed assignment extraction uses canonical `teaching_assignment`

### Validation changes

Pre-solve analysis must validate against the same canonical source used by the
solver, not against a weaker or partial representation.

---

## 12. Testing Strategy

### Backend tests

#### Unit tests

- repository behavior
- command service invariants
- split-teaching enforcement
- duplicate prevention
- projection generation

#### Integration tests

- assignment create/update/delete flows
- class requirement replacement flows
- teacher capability replacement flows
- migration backfill and reconciliation
- solver input generation from canonical tables

### Frontend tests

#### Component and hook tests

- assignment drawers
- subject coverage
- teacher workload
- class requirements editor
- query invalidation behavior

#### Property and regression tests

- no stale fallback rendering after assign/unassign
- workload remains consistent across pages
- deleting a teacher/class removes assignment visibility consistently

### Manual QA checklist

1. assign from classes page
2. verify subjects page updates
3. verify teachers page updates
4. verify assignment matrix updates
5. verify solver input remains valid
6. unassign from another page and repeat

---

## 13. Rollout and Cutover Strategy

### Recommended rollout

Use a short-lived dual-read period, but not a long-lived dual-write period.

#### Step 1

Deploy schema and backfill tooling.

#### Step 2

Run reconciliation and resolve critical conflicts.

#### Step 3

Deploy canonical write paths.

#### Step 4

Deploy projection-based frontend reads.

#### Step 5

Freeze legacy fields.

#### Step 6

Remove legacy reads and then drop legacy columns later.

### Why dual-read but not long dual-write?

Dual-write is the main source of current inconsistency. Extending it prolongs
failure modes. A very short compatibility period is acceptable, but it must be
temporary and tightly bounded.

---

## 14. Rollback Strategy

Because this is high-risk, rollback must be designed before implementation.

### Rollback boundaries

- after schema deploy
- after backfill
- after write cutover
- after read cutover

### Minimum rollback assets

- database backup before backfill
- reconciliation report snapshot
- feature flags for canonical projection reads if needed
- reversible migrations where possible

### Rollback trigger examples

- projection responses fail to match required UI coverage
- assignment command service produces invariant violations in production-like QA
- solver input diverges materially from expected class/teacher counts

---

## 15. Codebase Impact Estimate

This refactor is large.

### Current footprint indicators

- around `40` files reference `classAssignments`
- around `75` files in affected feature areas touch assignment-related
  `teacherId` logic
- around `36` files already touch the normalized assignment-table path

### Estimated file impact

#### Backend production files

- expected touched: `12-20`

Likely includes:
*/]=[-p;.

- entities
- migrations
- repositories
- schemas
- routes
- assignment services
- solver transformer
- cleanup/reconciliation services

#### Frontend production files

- expected touched: `20-35`

Likely includes:

- assignments feature
- classes feature
+
+
--+
 subjects feature
- teachers feature
- teacher-assignments feature
- shared query keys and parsers

#### Tests and supporting docs

- expected touched: `15-30`

### Total estimate

- production files touched: `32-55`
- total including tests and docs: `50-80`

### Time estimate

- one strong engineer: `4-8 weeks`
 two engineers split backend/frontend: `2-4 weeks`

---

## 16. File and Module Impact

### Backend hotspots

Likely impact areas:

```text
packages/api/src/entity/
packages/api/src/database/repositories/
packages/api/src/database/migrations/
packages/api/src/routes/assignment.routes.ts
packages/api/src/routes/teacherClassSubjectAssignment.routes.ts
packages/api/src/services/assignment.service.ts
packages/api/src/services/solverDataTransformer.service.ts
packages/api/src/services/subjectReferenceCleanup.service.ts
packages/api/src/services/class.service.ts
packages/api/src/services/teacher.service.ts
packages/api/src/schemas/
```

### Frontend hotspots

Likely impact areas:

```text
packages/web/src/features/assignments/
packages/web/src/features/classes/
packages/web/src/features/subjects/
packages/web/src/features/teachers/
packages/web/src/features/teacher-assignments/
packages/web/src/lib/queryKeys.ts
```

### Legacy paths expected to shrink or disappear

- `features/teachers/hooks/useTeacherAssignments.ts`
- `features/subjects/components/SubjectAssignmentSheet.tsx`
- legacy assignment fallbacks in assignment drawers
- workload and conflict services based on `classAssignments`

---

## 17. Risks and Mitigations

### Risk 1: Domain rule mismatch

If split-teaching behavior is not finalized first, implementation will fork in
multiple directions.

Mitigation:

- finalize ADR before phase 1

### Risk 2: Dirty legacy data

Current data already contains contradictions.

Mitigation:

- do not rely on silent backfill
- generate reconciliation reports
- validate data before enabling write cutover

### Risk 3: Frontend partial cutover

If some screens move to projections while others keep legacy reads too long,
users will continue seeing inconsistent state.

Mitigation:

- cut over whole screen families together

### Risk 4: Solver divergence

The solver may rely on current quirks in the legacy data shape.

Mitigation:

- explicitly regression-test solver input counts and fixed assignments

### Risk 5: Cache confusion

Even with the right backend model, stale UI can persist if query keys remain too
fragmented or inconsistent.

Mitigation:

- consolidate canonical query keys
- reduce custom local derived state

### Risk 6: Team falls back to convenience writes

Developers may continue updating assignments through generic entity update
routes.

Mitigation:

- remove writable support from those payloads
- add tests that fail if teacher/class CRUD mutates assignment state

---

## 18. Definition of Done

This project is complete only when all of the following are true:

1. there is exactly one canonical persisted source for assignment truth
2. teacher CRUD no longer mutates assignment state
3. class CRUD no longer mutates assignment state
4. all assignment writes go through one transactional command layer
5. all assignment-heavy UI reads come from projection endpoints or canonical
   assignment hooks
6. workload, coverage, conflict, and status values are consistent across
   classes, subjects, teachers, and assignments screens
7. solver input is generated from canonical tables only
8. migration tooling exists and has been used against current data
9. legacy assignment mirrors are frozen and removed from active production logic
10. regression tests cover cross-feature consistency

---

## Final Recommendation

Do not try to "synchronize the current mirrors better."

The correct end state is:

- normalized requirements
- normalized teacher capabilities
- normalized teaching assignments
- one command service
- projection-driven reads
- solver integration from canonical state only

That is the only approach that will make the database the real source of truth
for assignment behavior across the entire UI and backend.
