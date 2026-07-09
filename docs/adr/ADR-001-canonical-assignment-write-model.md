## ADR-001: Canonical Assignment Write Model

- Status: Accepted
- Date: 2026-04-14
- Owners: Assignments domain, Classes feature, Teachers feature, Solver integration

### Context

Assignment truth currently exists in three persisted representations:

1. `Teacher.classAssignments`
2. `ClassGroup.subjectRequirements[].teacherId`
3. `TeacherClassSubjectAssignment`

These representations are written by different routes and rendered by different
screens. The result is stale UI, conflicting workload calculations, invalid
solver input, and drift between JSON mirrors and normalized rows.

### Decision

The assignment domain will move to one canonical relational model and one
transactional write boundary.

The target canonical write model is:

- `class_subject_requirement`
- `teacher_subject_capability`
- `teaching_assignment`

The assignment architecture will follow these rules:

1. The database owns assignment business truth.
2. The API owns UI-facing assignment projections.
3. React Query and local component state are caches only.
4. Generic teacher CRUD must not mutate assignment truth.
5. Generic class CRUD must not mutate assignment truth.
6. `classTeacherId` remains a homeroom or supervisor field only.
7. Solver inputs and outputs must use canonical assignment data only.

Legacy fields remain compatibility-only during cutover:

- `Teacher.classAssignments`
- `Teacher.primarySubjectIds`
- `Teacher.allowedSubjectIds`
- `ClassGroup.subjectRequirements[].teacherId`

### Consequences

- New schema work must land before write cutover.
- Read-heavy screens must migrate to projection endpoints rather than stitched
  entity payloads.
- Backfill and reconciliation tooling is required before the cutover.
- Existing teacher/class CRUD payloads may continue to carry compatibility
  fields temporarily, but those fields are deprecated and must not be treated
  as the source of truth once the canonical model is live.

### Non-Goals

- This ADR does not define the migration implementation details.
- This ADR does not remove legacy fields immediately.
- This ADR does not split the repo into networked services.
