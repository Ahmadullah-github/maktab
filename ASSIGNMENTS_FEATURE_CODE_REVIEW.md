# Assignments and Teacher Assignments — End-to-End Code Review

**Review date:** 2026-07-16  
**Primary scope:**

- `packages/web/src/features/assignments`
- `packages/web/src/features/teacher-assignments`

**Related scope inspected:** assignment routes and schemas, canonical and compatibility services, repositories and entities, teacher/class/subject mutation paths, timetable staleness, solver input validation and teacher-domain construction, localization, and the current SQLite database.

**Review status:** Findings and remediation guidance only. No assignment source code or database data was changed as part of this review.

## Executive summary

The live assignments feature is built on a useful canonical model (`ClassSubjectRequirement` + `TeachingAssignment`) and a projection API, but it still writes and mirrors the same fact through several paths:

```text
Assignments UI / Subjects UI / Classes UI / Teachers UI
                         |
        canonical commands + legacy compatibility routes
                         |
  TeachingAssignment + TeacherClassSubjectAssignment + JSON mirrors
                         |
             solver input and saved timetables
```

That transitional architecture is the main integrity risk. The review verified **26 actionable findings**:

| Priority | Count | Meaning |
| --- | ---: | --- |
| P0 | 4 | Can mutate the wrong record, commit a failed operation, save solver-invalid state, or leave schedules falsely current |
| P1 | 12 | Common workflows can partially commit, reject valid work, accept invalid work, or disagree across layers |
| P2 | 10 | UI correctness, accessibility, localization, contracts, maintainability, and observability gaps |

The highest-risk defects are:

1. Compatibility reads return a canonical assignment ID, while compatibility update/delete write against a legacy-table ID.
2. Changing teacher/class/subject through the legacy `PUT` path can soft-delete the legacy row, create the new canonical assignment, then return `404` after the transaction commits.
3. The UI/API treat an `allowed` capability as assignable even when `restrictToPrimarySubjects` makes it ineligible in the solver.
4. Assignment and capability mutations do not mark existing saved timetables stale.

The current SQLite database passed structural checks and contains no assignment rows, so no live behavioral inconsistencies could be sampled. This makes automated lifecycle and rollback tests especially important before real data is introduced.

## Scope and method

- Inventoried **66 files / 19,499 lines** in the two requested feature directories.
- Followed the live route from `packages/web/src/routes/assignments.tsx` through the active page, drawer, matrix cells, hooks, projection API, command API, persistence, mirrors, and solver.
- Traced related writes from teacher, class, and subject features.
- Compared UI eligibility/workload calculations with backend validation and solver domain rules.
- Inspected the actual SQLite schema, foreign keys, uniqueness, soft-delete design, integrity, and assignment-row counts using read-only queries.
- Ran the available web and API static checks/tests. Attempted the solver suite without changing the environment.

This report describes the current checkout, which already contains unrelated in-progress changes. Those changes were preserved.

## P0 — stop-ship integrity defects

### ASG-001 — Compatibility IDs refer to different tables on reads and writes

**Evidence**

- `assignmentCompatibility.service.ts:45-67,70-89,319-335` reads `TeachingAssignment` and exposes `id: assignment.id` as a legacy-compatible record.
- `teacherClassSubjectAssignment.routes.ts:241,274` forwards that exposed ID to `updateLegacyAssignment` and `deleteLegacyAssignment`.
- `assignmentCommand.service.ts:618-623` and the delete path resolve the ID through `TeacherClassSubjectAssignmentRepository`.

The canonical and legacy tables have independent primary-key sequences. Their IDs are not a stable cross-table identity, especially after migration, revival, deletion, or repair.

**Impact**

- Update/delete can return `404` for a record returned by `GET`.
- Worse, if a different legacy row happens to own the same numeric ID, the wrong assignment can be changed or deleted.
- The compatibility API violates the basic invariant that a resource ID returned by a read identifies the same resource on write.

**Recommended fix**

Retire ID-based compatibility writes. Make canonical assignment IDs the only public identity and route all writes to the canonical command service. During a short transition, return explicit `canonicalAssignmentId` and `legacyAssignmentId` fields and require the correct one at each private adapter boundary; never overload one `id` field.

**Acceptance tests**

- Seed canonical and legacy rows with deliberately divergent IDs; `GET -> PUT -> GET` changes only the requested logical assignment.
- `GET -> DELETE` removes only the requested logical assignment.
- A migrated/revived row retains stable API identity.

### ASG-002 — Identity-changing legacy update commits data and then reports `404`

**Evidence**

- `assignmentCommand.service.ts:672-698` soft-deletes the previous canonical assignment when teacher, class, or subject changes.
- `softDeleteCanonicalAssignment` also soft-deletes the matching legacy row (`assignmentCommand.service.ts:1236-1257`).
- The method then upserts the new canonical row (`:700-708`) and attempts to update the now-deleted legacy row by ID (`:710-720`).
- The repository update only finds active rows, so it returns `null`; the route maps that to `404` (`teacherClassSubjectAssignment.routes.ts:241-244`).
- Returning `null` does not throw, so the transaction can commit the canonical mutation even though the client is told the assignment was not found.

**Impact**

The operation is externally reported as failure after changing persisted state. The new canonical assignment can exist without its legacy counterpart, while the old record is deleted.

**Recommended fix**

Replace this sequence with a single atomic, key-aware move command:

1. Load and verify canonical and legacy identities.
2. Validate the complete destination state.
3. Upsert/update the destination canonical and compatibility representation.
4. Remove the old representation only after destination writes succeed.
5. Throw on any missing/failed persistence result so the transaction rolls back.

Prefer eliminating identity changes from the legacy route and using canonical replace/unassign+assign commands internally.

**Acceptance tests**

- Change teacher, class, and subject independently and together.
- Force a destination conflict and a repository failure; assert both tables remain unchanged.
- A successful response and both representations describe the same assignment.

### ASG-003 — Saved assignments can be ineligible in the solver

**Evidence**

- Canonical and legacy assignment commands call `ensureCapability(..., 'allowed')` (`assignmentCommand.service.ts:295,559,646`).
- UI ranking treats `allowed` as compatible and does not apply the teacher's `restrictToPrimarySubjects` policy (`useSmartTeacherSelection.ts:75-93,137-153`; `useUnifiedAssignment.ts:174-190`).
- Teachers default to `restrictToPrimarySubjects = true` (`entity/Teacher.ts:45` and the teacher schema default).
- The solver's `can_teach` rejects allowed-only subjects when the restriction is enabled (`packages/solver/core/solver.py:88-100`).
- Manual canonical writes are persisted as `isFixed: true` (`assignmentCommand.service.ts:325-331`), but the fixed teacher may then be outside the solver variable's domain (`solver.py:647-670`).
- Preliminary solver-data feasibility logic also includes allowed subjects without applying the same restriction, so preflight and solving can disagree.

**Impact**

The assignments page can show a teacher as suitable and save the assignment successfully, but timetable generation can fail because a hard-fixed teacher is not a legal candidate.

**Recommended fix**

Create one authoritative **effective teachability** policy shared by command validation, projections, UI DTOs, and solver transformation. When restriction is enabled, allowed-only capability must not be eligible. Either:

- reject the assignment with a typed policy conflict; or
- require an explicit, confirmed promotion to `primary` before assignment.

Do not silently create an `allowed` capability for an operation that produces a hard solver constraint.

**Acceptance tests**

- Matrix test for `primary`, `allowed`, `none` × restricted/unrestricted.
- Every assignment accepted by the command can be inserted into the solver domain.
- A fixed assignment to an ineligible teacher is rejected before persistence with the same machine-readable reason shown by the UI.

### ASG-004 — Assignment changes do not invalidate saved timetables

**Evidence**

- Assignment command, projection, requirement, and capability services do not call the timetable stale mechanism.
- `timetable.repository.ts:357-370` provides `markStaleForSchool`.
- Other domain mutations, such as subject/curriculum changes, already use timetable invalidation.

Assignments are hard inputs to generation, and most manual assignments are persisted as fixed constraints.

**Impact**

After assigning, unassigning, splitting, changing periods, or changing capability, previously generated timetables can remain labeled current even though they no longer represent the saved constraints.

**Recommended fix**

Within the same transaction as every assignment/requirement/capability mutation, derive the school and mark its active saved timetables stale with a stable reason code. Invalidate related schedule caches after commit. Avoid invalidation for a true no-op.

**Acceptance tests**

- Assign, unassign, replace, split, requirement-period change, and relevant capability change each mark the school's timetable stale.
- Other schools remain untouched.
- A failed/rolled-back mutation does not mark anything stale.

## P1 — high-priority workflow and contract defects

### ASG-005 — The main drawer cannot complete a partial split assignment

`AssignmentDrawerV2.tsx:355-367` correctly calculates the remaining periods, but `handleAssign` (`:384-390`) sends no `classPeriodOverrides`. The backend therefore defaults the new teacher to the full requirement (`assignmentCommand.service.ts:1292-1295`), which conflicts with periods already assigned to other teachers.

**Fix:** send the exact remaining allocation for the class. Separate “teacher allocation periods” from “change the class requirement” in naming and schema. Test a 5-period split where teacher A owns 2 and teacher B is assigned the remaining 3.

### ASG-006 — Multi-subject bulk assignment uses the first subject for ranking and commits per subject

`AssignmentDrawerV2.tsx:369-370` selects the first cell's subject for teacher ranking. The handler groups selected cells by subject and performs sequential independent mutations (`:393-413`).

**Impact:** the selected teacher can be unsuitable for later subjects. If a later request fails, earlier subjects remain committed although the combined user action appears to have failed.

**Fix:** add one bulk command containing all cells, validate every subject/class/workload/policy in one transaction, and return per-cell diagnostics. The UI should show the intersection of eligible teachers across all selected subjects, or require a teacher per subject. Invalidate/refetch once after commit.

### ASG-007 — Class assignment replacement deletes before proving the replacement

`useClassAssignments.ts:145-169` unassigns existing teachers and then sends the new assignment in separate requests. The bulk path (`:393-419`) repeats this pattern.

**Impact:** validation or network failure on the new assignment loses the previous valid assignment; multiple deletes can also partially succeed.

**Fix:** provide a server-side `replaceRequirementAssignments` command with one transaction and an idempotency key. Return the previous/new state and typed conflicts. Never model replacement as client-orchestrated destructive calls.

### ASG-008 — Compatibility writes bypass effective workload and availability validation

`createLegacyAssignment` and `updateLegacyAssignment` validate active entities, requirement coverage, and split rules (`assignmentCommand.service.ts:541-578,638-669`) but do not execute the canonical command's effective capacity/availability validation.

**Impact:** `/teacher-assignments` can persist a workload the canonical API would reject and the solver cannot schedule.

**Fix:** make compatibility routes thin adapters over the canonical validate-and-write command. There should be no second validation implementation. Add parity tests proving identical input has identical result through both routes during deprecation.

### ASG-009 — Legacy synchronization treats domain conflicts as successful writes

`assignTeacher` represents a domain rejection as transport success with `data.success: false` (`assignmentCommand.service.ts:277-286`). Synchronization adapters only test the outer `result.success` (`:868-879,927-940`). Teacher and class service transactions call those adapters.

**Impact:** teacher/class create or update can report success while requested assignment mirrors were rejected, leaving persisted data different from the submitted DTO.

**Fix:** centralize `requireSuccessfulAssignmentResult`, requiring both outer and domain success and throwing a typed conflict to roll back the parent transaction. Then remove assignment mutation fields from teacher/class compatibility DTOs after clients migrate.

### ASG-010 — Authoritative validation occurs before the write transaction

`assignTeacher` calls `validateAssignment` before starting its transaction (`assignmentCommand.service.ts:262-290`). Inside the transaction it recomputes the requirement plan but does not reject recomputed `plan.conflicts` before writing, and workload is not revalidated.

**Impact:** concurrent assignments can pass the same preflight and over-cover a split requirement or overload a teacher (time-of-check/time-of-use race).

**Fix:** retain preflight for UX only; repeat all authoritative validation inside the write transaction after obtaining appropriate write serialization. On SQLite, establish the write lock before dependent reads. Reject every recomputed error before any mutation.

### ASG-011 — Projection/UI capacity differs from backend effective capacity

`assignmentProjection.service.ts:398-448` exposes remaining workload from raw `maxPeriodsPerWeek`. The command's effective capacity calculation (`assignmentCommand.service.ts:1011-1045`) also limits by daily maximum, consecutive maximum, and availability. Smart selection ranks the projection value.

**Impact:** the UI can advertise sufficient capacity and enable a candidate that the API rejects.

**Fix:** use a shared capacity calculator and return `contractedMax`, `effectiveCapacity`, `assignedPeriods`, `remainingEffectiveCapacity`, and the binding constraint. For exact previews, call server validation rather than reconstructing policy in React.

### ASG-012 — Workload preview overcounts partial assignments

`useWorkloadImpact.ts:129-151` reads legacy `teacher.classAssignments`, which contains class/subject identity but not the canonical assigned-period allocation, and adds the full class requirement. A teacher holding 1 of 5 periods is therefore counted as holding all 5. The hook also compares against raw maximum (`:242-252`).

**Fix:** source workload from the canonical projection's `assignedPeriodsPerWeek` and effective capacity. Remove legacy mirror arithmetic from UI eligibility logic.

### ASG-013 — Assignment commands do not enforce class single-teacher or gender policy

- The class schema permits `singleTeacherMode` without requiring `classTeacherId` (`class.schema.ts:118-129`).
- Assignment command context does not enforce the class teacher or gender policy.
- Solver input validation requires a valid class teacher for single-teacher mode (`packages/solver/models/input.py:434-496`), and solver candidate domains apply single-teacher and conditional gender rules (`solver.py:88-114,647-670`).

**Impact:** the API can save a fixed assignment contradicted by solver policy, causing generation failure later.

**Fix:** enforce all class eligibility rules at the assignment boundary and expose them through candidate projections. Add a schema refinement requiring `classTeacherId` when single-teacher mode truly means one instructional teacher. If it only means homeroom supervision, rename/redefine it and remove the solver restriction.

### ASG-014 — `periodsPerWeek` is accepted by the canonical API but ignored

The assignment schemas accept `periodsPerWeek` (`assignment.schema.ts:31-36,51-56`), but the route does not forward it and the service names the argument `_periodsPerWeek` (`assignmentCommand.service.ts:253-258`). Callers and types imply it affects allocation.

**Impact:** clients can submit a valid field and receive a successful response while the saved allocation follows different rules.

**Fix:** either remove the field in a versioned contract, or define it unambiguously as allocation for a single class. For multi-class requests, require explicit per-class overrides. Reject ambiguous combinations.

### ASG-015 — API conflict details are lost on the frontend

The assignment route returns a `409` payload containing structured conflicts plus an English `error` string. `fetchAPI` throws for non-2xx and selects the `error` string (`packages/web/src/api.ts:108-114`), so the later mapping in `teacher-assignments/api.ts` never gets to use `messageFa` or structured conflict data.

**Impact:** users receive generic/English errors and cannot see per-class resolutions despite the backend calculating them.

**Fix:** introduce a standard `ApiError` with stable code, localized parameters, and `details/conflicts`. Parse it before throwing; localize at the UI boundary. Add contract tests for 400/404/409/500.

### ASG-016 — Legacy routes map predictable domain failures to `500`

Compatibility create/update/bulk handlers recognize a few error-message substrings. Coverage overflow and split-disabled errors fall through to `500`; bulk failures also commonly return `500` (`teacherClassSubjectAssignment.routes.ts:217-223,246-258`).

**Fix:** stop parsing human messages. Use typed domain errors and centralized Express error middleware: malformed request `400`, missing resource `404`, state/policy conflict `409`, unexpected fault `500`.

## P2 — UI quality, accessibility, and maintainability

### ASG-017 — Partially covered classes are counted as fully assigned

`useAssignmentsPage.ts:119-124` does not count requirements with status `partial`. `calculateClassOverallStatus` then returns `assigned` whenever `unassigned === 0` (`:102-107`). A class containing only partial requirements is therefore labeled assigned and missed by the partial filter.

**Fix:** add a partial count and derive class status from every requirement status. Cover all combinations with table-driven tests.

### ASG-018 — Split assignments are collapsed to the first teacher in the matrix

`useAssignmentsPage.ts:81-99` selects the first assignment's teacher ID even when several teachers share a requirement. `AssignmentCell` renders a single teacher identity.

**Fix:** keep an assignment summary array in the view model and render multi-teacher avatars/count plus exact period allocations in accessible text and the drawer. Never imply one teacher owns the full requirement.

### ASG-019 — Select-all creates cells without periods, producing a zero workload preview

The Ctrl/Cmd+A path in `AssignmentsPage.tsx:358-374` constructs selected cells without `periodsPerWeek`; bulk preview sums missing periods as zero (`AssignmentDrawerV2.tsx:363-365`).

**Fix:** make periods non-optional in the selected-cell type and derive them from each projection requirement at every construction site. Add a shortcut-to-preview test.

### ASG-020 — Keyboard handling can hijack input keys or invoke assignment twice

`TeacherSelectionList.tsx:516-535` handles arrows and Enter on the whole container (`:563-564`). The search input (`:613-621`), group controls, and nested assign buttons bubble into it. Enter on an interactive child can trigger both the container assignment and the child's native action.

**Fix:** use a scoped listbox pattern with roving focus or `aria-activedescendant`; ignore input/button/interactive targets; stop propagation where needed; test search arrows, group buttons, row selection, and Enter on the assign button.

### ASG-021 — Global select-all overrides normal browser behavior

`AssignmentsPage.tsx:334-395` listens at window level and excludes only `INPUT`/`TEXTAREA`. It can hijack selection in other interactive or content-editable contexts and selects only expanded groups without making that scope clear.

**Fix:** scope the shortcut to a focused matrix/bulk-selection mode, exclude all editable and interactive targets, and label whether it means all visible, filtered, or expanded cells.

### ASG-022 — Ungraded or out-of-range classes disappear

`useAssignmentsPage.ts:72-78,226-229` maps nullable/unsupported grades to `null` and silently skips those classes. Grade is nullable in the data model.

**Fix:** add an “Ungraded / needs configuration” group with a visible data-quality warning, or make grade mandatory before requirements can be assigned. Never silently omit active classes.

### ASG-023 — Header statistics are filtered statistics presented as totals

`useAssignmentsPage.ts:266-282` calculates page totals from already-filtered `gradeGroups`. Search/status filters therefore change “total” counts, and total/visible values can duplicate each other.

**Fix:** compute global statistics from the unfiltered projection and visible statistics from the filtered view model; name both explicitly.

### ASG-024 — English localization is incomplete

The assignments UI references substantially more keys than exist in the English catalog; many inline fallbacks are Persian. Switching to English can therefore display mixed Persian/English text.

**Fix:** extract all active keys, establish English/Farsi parity, use English defaults in the English catalog, and add a CI test that fails when either locale is missing an active key. Remove obsolete keys after dead UI is retired.

### ASG-025 — Accessibility and responsive layout need a focused pass

Examples:

- Drawer close button lacks an accessible name (`AssignmentDrawerV2.tsx:467-469`).
- The collapsible grade header uses a non-button `CardHeader` as a trigger (`GradeGroupSection.tsx:139-146`).
- Search and assignment cells depend heavily on placeholder/tooltip/initials rather than persistent accessible names.
- `AssignmentsPage.tsx:563-567` reserves fixed 500/360 px side-panel widths in a horizontal layout, which is fragile on mobile and narrow RTL screens.

**Fix:** use semantic buttons and labels, expose class/subject/teacher/status in cell names, keep nested actions outside collapse triggers, and switch the drawer to a responsive sheet/overlay below a tested breakpoint.

### ASG-026 — Duplicate systems and unchecked API casts increase drift

The requested directories contain two drawer generations, several conflict/cache/realtime systems, and a virtualized matrix that are not reached from the current assignments route based on import tracing. Meanwhile `teacher-assignments/api.ts` casts JSON directly to TypeScript shapes without runtime parsing.

**Impact:** maintainers can fix a non-live implementation, bundles/mental model grow, and backend response drift reaches React as undefined or misleading data.

**Fix:** document and consolidate the live surface, remove or archive unreachable implementations after confirming no lazy consumer, use direct imports/code splitting, and parse API responses with shared/generated schemas. Virtualize the live matrix only after measuring; the immediate performance win is atomic bulk mutation with one invalidation.

## Database and persistence review

### Current database observations

- `PRAGMA integrity_check`: `ok`.
- `PRAGMA foreign_key_check`: no violations.
- `ClassSubjectRequirement`, `TeachingAssignment`, and `TeacherClassSubjectAssignment`: **0 active or deleted rows** in the current database.
- The actual canonical tables include foreign keys, check constraints, and uniqueness constraints.
- The standalone SQLite CLI reports `foreign_keys = 0` for its own new connection. This is a per-connection setting and is **not evidence** that the application connection disables enforcement; application startup configuration should have an explicit integration assertion.

No live row-level mismatch could be measured because the assignment tables are empty.

### Architectural persistence risk

The same logical assignment can exist in:

1. `TeachingAssignment` (canonical),
2. `TeacherClassSubjectAssignment` (legacy),
3. teacher JSON assignment mirrors,
4. class requirement JSON mirrors.

Transactions and `AssignmentConsistencyService` reduce risk but do not make four mutable representations safe indefinitely. The audit checks representation parity, but not all school-scope, effective-capacity, gender, single-teacher, or solver-domain invariants.

**Recommendation:** make canonical tables the sole source of truth. Convert legacy tables/mirrors to read-only projections during a measured migration, then remove them. Until removal, expand the consistency audit and run it after migrations/deployments without automatically “repairing” ambiguous conflicts.

## Verification results

| Check | Result | Notes |
| --- | --- | --- |
| Web TypeScript | Pass | `npm run type-check` |
| Web unit tests | Pass | 4 files, 18 tests |
| Web lint | Pass | Existing configured lint command |
| API TypeScript build | Pass | `npm run build` |
| API tests | Pass | 18 tests |
| SQLite integrity/FK audit | Pass | Database is structurally healthy; assignment tables are empty |
| Solver unit discovery | Blocked by environment | Imports fail because `ortools` and `pydantic` are not installed in the active Python environment |

Passing totals should not be interpreted as assignment coverage. The web suite has only limited related helper coverage; the API suite covers assignment migration/backfill but not the command/route lifecycle. No existing tests exercise the critical read/update/delete identity mismatch, split completion, bulk rollback, replacement rollback, or UI keyboard behavior.

## Recommended implementation sequence

### Phase 0 — Lock contracts and add failing regression tests

1. Record decisions listed below.
2. Add canonical/legacy divergent-ID fixtures.
3. Add command integration tests with a real transactional test database.
4. Add solver handoff fixtures for every accepted assignment policy.
5. Add UI tests for partial/split state, bulk behavior, and keyboard interaction.

### Phase 1 — Protect integrity

1. Fix ASG-001 and ASG-002; disable identity-changing compatibility writes until tests pass.
2. Centralize effective teachability and enforce solver parity (ASG-003, ASG-013).
3. Mark timetables stale transactionally (ASG-004).
4. Move authoritative validation into the write transaction (ASG-010).
5. Make sync adapters reject domain conflicts (ASG-009).

### Phase 2 — Make user operations atomic

1. Implement atomic bulk assignment and atomic replacement (ASG-006, ASG-007).
2. Correct split-period allocation (ASG-005).
3. Route compatibility writes through canonical validation and typed errors (ASG-008, ASG-015, ASG-016).
4. Resolve or remove the ignored `periodsPerWeek` contract (ASG-014).

### Phase 3 — Unify projections and UI truth

1. Share effective workload/capacity and policy reasons (ASG-011, ASG-012).
2. Correct partial/split view models and statistics (ASG-017, ASG-018, ASG-023).
3. Fix selection semantics, ungraded classes, keyboard behavior, accessibility, responsive layout, and localization (ASG-019 through ASG-025).

### Phase 4 — Retire transition debt

1. Stop external writes to legacy assignment routes.
2. Backfill and audit canonical data.
3. Convert mirrors to derived read models, migrate consumers, then remove mutable legacy storage.
4. Delete confirmed unreachable UI systems and add runtime response parsing (ASG-026).
5. Add production metrics for assignment conflicts, rollbacks, stale timetable marking, and solver-preflight mismatches.

## Decisions needed before implementation

These are product/domain decisions, not details that should be guessed in code:

1. **Manual assignment strength:** Is every manual assignment a hard solver lock (`isFixed`), or can it be a preference that the solver may change?
2. **Allowed capability under restriction:** Should assigning an allowed-only subject be rejected, or should the user explicitly promote it to primary?
3. **Single-teacher mode meaning:** Must one teacher teach every subject in the class, or is `classTeacherId` only a homeroom/supervision role?
4. **Split allocation UX:** Should the drawer always allocate the exact remaining periods, or allow the user to enter a smaller allocation and leave the requirement partial?
5. **Compatibility lifetime:** Can legacy assignment writes be disabled immediately, or is there an external client that needs a versioned migration period?

## Positive foundations to preserve

- The canonical requirement/assignment model represents split coverage much better than the older denormalized mirrors.
- The projection API is the right place to assemble matrix-ready server truth.
- Assignment commands already use transaction helpers and maintain compatibility mirrors in several paths.
- The database schema has meaningful foreign keys, checks, and uniqueness constraints.
- The consistency audit and migration backfill are useful transition tools.
- TypeScript, lint, and current unit suites pass, giving a stable baseline for adding the missing regression coverage.

The safest implementation strategy is to strengthen and expose the canonical command/projection contract, make compound user actions atomic, prove parity with solver eligibility, and then remove mutable compatibility representations rather than continuing to patch each mirror independently.
