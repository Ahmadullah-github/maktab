# Subjects Feature — Deep Code Review

Review date: 2026-07-14  
Scope: current working tree, including uncommitted changes  
Mode: initial read-only review followed by phased remediation and final verification

## Remediation status — 2026-07-14

All 33 findings in this report have been addressed in the current working tree. The repair was completed in dependency order so that persistence contracts were stable before curriculum, assignments, integration boundaries, and UI behavior were changed.

| Phase | Completed outcome |
|---|---|
| 1 — Persistence and identity | School/grade-scoped normalized identity, strict create vs explicit upsert, atomic bulk operations, database constraints/triggers, safe imports, explicit hard-delete behavior |
| 2 — Curriculum and periods | One operational backend curriculum materializer, transactional config-to-subject updates, complete class reconciliation, custom-subject classification, specialized labs, consistent 1–84 period contract and official totals |
| 3 — Assignments and coverage | Multi-teacher UI flow, preserved optimistic assignment arrays, conflict failures propagated as HTTP 409, generalist-teacher support, period-based coverage/conflicts |
| 4 — Integration and lifecycle | Atomic multi-grade sync/clear, centralized machine identity, read-only licensing, read-only GETs, stable list contract, normalized solver feature tags, timetable staleness tracking |
| 5 — UI and UX | Correct filtered selection, single coverage navigation, atomic confirmed bulk delete, valid form defaults/bounds, reachable curriculum clear flow, effective-curriculum previews, production logging cleanup |
| 6 — Regression protection | API integration, web contract, and solver contract tests added; full API/web/solver suites and production web build executed at the end |

Final verification:

| Command | Result |
|---|---|
| API `npm test` | 16/16 passed, including migration lifecycle/adoption and 6 new subject-flow integration scenarios |
| Web `npm run type-check` | Passed |
| Web `npm test` | 15/15 passed across 3 test files |
| Web `npm run build` | Production build passed |
| Solver `.venv/bin/python -m unittest discover -s tests -v` | 19/19 passed |

The two new managed migrations are `HardenSubjectIdentity1784200000000` and `TrackTimetableStaleness1784300000000`. Both participate in backup/adoption flow; the staleness migration is idempotent for synchronized databases whose migration ledger must be adopted.

## Original executive conclusion (before remediation)

At review time, the subjects feature was **not safe to release**. Type checking and the existing tests passed, but the most important defects were behavioral and cross-layer defects that the test suite did not cover.

The highest risks are:

1. A grade-less subject save can overwrite an unrelated subject from another grade.
2. `POST /subjects` is implemented partly as an upsert: a code collision can silently replace an existing row while returning `201 Created`.
3. Curriculum import is a destructive full-row overwrite for existing subjects. It can erase room constraints, feature constraints, metadata, minimum capacity, and school scope.
4. Subject assignment screens collapse a valid multi-teacher assignment model to one teacher, misclassify partial coverage, and optimistically remove other teachers from the cache.
5. The `CurriculumConfig` feature is disconnected from subject creation, class requirements, and solver input, so saved school customizations do not affect scheduling.

### Finding count

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 3 | Direct data corruption or destructive overwrite |
| High | 12 | Broken core flow, solver failure, irreversible behavior, or policy bypass |
| Medium | 13 | Important inconsistency, partial failure, scalability, or UX correctness issue |
| Low | 5 | Maintainability, observability, or contract clarity issue |

## Reviewed flow and related features

```text
Subjects UI/forms
  -> web validation and serialization
  -> /api/subjects routes and license middleware
  -> SubjectService
  -> SubjectRepository / TypeORM
  -> SQLite subject table
  -> class_subject_requirement
  -> teacher_subject_capability
  -> teaching_assignment / legacy assignment mirrors
  -> assignment projections and subject coverage UI
  -> solver input transformer
  -> Python scheduling and swap validation
  -> persisted timetable JSON

Curriculum UI/local data
  -> curriculum bulk subject import
  -> subject rows
  -> class auto-population

CurriculumConfig API/table
  -X-> subject import / class auto-population / solver (currently disconnected)
```

The review covered the subject UI, schemas, API client, Express routes, service and repository layers, migrations/entities, the live SQLite schema, class curriculum population, teacher capabilities, assignments and projections, room constraints, solver input/Pydantic models, swap validation, license middleware, and timetable persistence.

## Critical findings

### SUB-001 — Grade-less upsert can overwrite a subject from another grade

**Evidence:** `SubjectRepository.saveSubject()` builds a TypeORM query using `{ grade: null }` instead of `IsNull()` at `packages/api/src/database/repositories/subject.repository.ts:281-291`. TypeORM's default behavior ignores a null property in a `where` object. The repository's dedicated lookup methods correctly use `IsNull()` at lines 409-440, so the service duplicate check and the actual save do not use the same identity rule.

**Isolated proof:** saving grade 1 `Shared Name / G1`, then saving grade-less `Shared Name / NONE`, returned the same ID and left one row whose grade had been changed to null and whose code/periods had been replaced.

**Impact:** creating or importing a grade-less subject can silently reclassify and overwrite an existing graded subject. All relationships still point to the same ID, now with the wrong subject data.

**Fix:** configure TypeORM to throw on null/undefined where values; use an explicit identity query with `IsNull()`; add a transaction and database-backed identity constraint; add a regression test that proves grade-null and grades 1–12 are separate identities.

### SUB-002 — Create/upsert identity is inconsistent and permits silent replacement or duplicates

**Evidence:**

- `SubjectService.create()` rejects only duplicate `(grade, name)` at `packages/api/src/services/subject.service.ts:77-98`.
- `SubjectRepository.saveSubject()` then upserts by `(grade, name) OR (grade, code)` at `packages/api/src/database/repositories/subject.repository.ts:271-306`.
- Therefore a new name with an existing code updates the existing row, yet the route responds `201 Created`.
- Update checks name but never checks code at `packages/api/src/services/subject.service.ts:120-130`.
- The database has ordinary non-unique indexes, not unique constraints (`packages/api/src/entity/Subject.ts:11-16`).
- `bulkUpsert()` reads once per input before saving the batch and does not deduplicate the input at `packages/api/src/database/repositories/subject.repository.ts:527-555`.

**Isolated proofs:**

- Saving `Original / SAME`, then `Replacement / SAME` for one grade returned the same ID and replaced the original row.
- Bulk-upserting the same `(grade, name, code)` twice into an empty database created two rows.

**Impact:** normal POSTs can overwrite data; bulk imports can create duplicates; concurrent requests can race past service checks; update can create duplicate codes. Subject identity differs depending on which endpoint is used.

**Fix:** decide and document one identity rule, preferably scoped by school and grade; make create strictly create and import explicitly upsert; normalize identity values; enforce the chosen uniqueness in SQLite; reject ambiguous collisions where name matches one row and code matches another; validate duplicate entries inside bulk payloads.

### SUB-003 — Curriculum import destructively clears existing subject configuration

**Evidence:** the web import sends only name, code, periods, room type, difficulty, and section (`packages/web/src/features/subjects/api.ts:164-172`). Backend `bulkUpsert()` passes that partial-looking object through `stringifySubjectJsonFields()`, which supplies defaults for every omitted field (`packages/api/src/database/repositories/subject.repository.ts:137-161, 546-549`).

On an existing subject, an import therefore resets:

- `schoolId` to null
- `requiredFeatures` to `[]`
- `desiredFeatures` to `[]`
- `minRoomCapacity` to `0`
- `meta` to `{}`
- ordinary `requiredRoomType` to null because ordinary curriculum entries omit it

It also overwrites periods, difficulty, section, name, and code. The initial database snapshot showed ordinary subjects using room type `normal`; reimporting their curriculum changes that to null, allowing them into specialty rooms unless another constraint prevents it.

**Impact:** clicking “insert curriculum” again can silently weaken solver room constraints and erase user configuration. It is presented as insertion, not destructive reset.

**Fix:** make import field-aware: preserve fields not owned by the curriculum; separate “add missing,” “update ministry-owned fields,” and “reset to ministry” operations; show a diff and require confirmation for destructive changes; execute multi-grade imports atomically.

## High-severity findings

### SUB-004 — Subject assignment UIs do not support the backend's multi-teacher model

Canonical coverage returns an array of assignments, but subject screens take only `assignments[0]` (`packages/web/src/features/subjects/hooks/useSubjectCoverage.ts:66-85` and `packages/web/src/features/subjects/components/SubjectAssignmentSheet.tsx:346-355`). Once the first teacher exists, the sheet classifies the class as assigned and removes it from assignable rows (`SubjectAssignmentSheet.tsx:123-125, 174-195`). The edit-drawer manager also hides its assign action when any first teacher exists and offers no unassign action (`SubjectAssignmentManager.tsx:227-329`).

Partial coverage can therefore appear “assigned,” remaining periods cannot be assigned to another teacher, secondary teachers are invisible, and the subject screens cannot remove an incorrect assignment. The two subject assignment UIs also use different compatibility rules: the sheet allows only explicit `primary`/`allowed` teachers, while the manager shows all teachers.

**Fix:** use assignment arrays end-to-end; show assigned and remaining periods per teacher; support add/rebalance/unassign; use one shared assignment component and one compatibility policy.

### SUB-005 — Optimistic assignment update removes other teachers for the same class/subject

`buildOptimisticAssignments()` filters every existing assignment for the target class and subject without checking teacher ID (`packages/web/src/features/assignments/hooks/useAssignmentMutations.ts:221-246`). It then inserts only the new teacher.

**Impact:** a legitimate split assignment disappears from the client cache until refetch. Any UI deriving further actions from the optimistic state sees false coverage and teacher data. This contradicts the canonical multi-teacher database model.

**Fix:** preserve unrelated teacher assignments and update/replace only the assignment identified by the operation's actual semantics. Add optimistic-cache tests for two teachers sharing one requirement.

### SUB-006 — Assignment conflict responses resolve as success at the Promise level

The API intentionally returns HTTP 200 with `{ success: false }` for conflicts (`packages/api/src/routes/assignment.routes.ts:145-150`). React Query's mutation therefore resolves, and callers such as the subject sheet clear their selection immediately after `mutateAsync()` (`SubjectAssignmentSheet.tsx:146-151`) even though the hook later displays an error toast.

**Impact:** the UI behaves as if an assignment completed after a domain failure, losing user selection and obscuring retry/correction.

**Fix:** either return an error HTTP status for a rejected command or make every caller inspect the domain result before changing UI state.

### SUB-007 — School curriculum customization is disconnected from operational scheduling

`CurriculumConfig` routes and repository can store overrides/custom subjects and calculate effective curriculum (`packages/api/src/routes/curriculum.routes.ts:134-237`, `packages/api/src/database/repositories/curriculum.repository.ts:93-103`). But:

- subject import uses the web's static curriculum copy;
- class auto-population reads current subject rows (`packages/api/src/services/class.service.ts:196-213`);
- solver input reads subject rows and canonical class requirements (`packages/api/src/services/solverDataTransformer.service.ts:181-216`);
- none of these read `CurriculumConfig`.

The Python solver supports `isCustom/customCategory`, but the Subject entity/API/UI do not define these fields; the transformer reads nonexistent properties at `solverDataTransformer.service.ts:390-391`.

**Impact:** users can save curriculum overrides or custom subjects that appear valid through the curriculum API but never affect subjects, classes, assignments, or the generated timetable. Solver custom-subject logic is effectively dead.

**Fix:** choose one source of truth. Materialize effective curriculum into subject/class requirement records through an explicit synchronization workflow, or have operational flows consume effective curriculum directly. Add versioning and reconciliation.

### SUB-008 — Incomplete database curriculum is treated as complete

`ensureSubjectsExist()` returns as soon as a grade has at least one subject (`packages/web/src/features/classes/hooks/useCurriculumPopulation.ts:203-229`). It does not compare ministry/effective curriculum codes with existing subject rows.

**Impact:** if one of fourteen subjects exists, the class population flow uses that incomplete set and silently omits the other thirteen.

**Fix:** compare normalized curriculum identity against database rows, insert only missing items, report conflicting rows, then populate requirements from the reconciled set.

### SUB-009 — Period validation contradicts downstream database requirements

Contracts disagree:

- web form: nullable or 1–10 (`packages/web/src/schemas/subject.schema.ts:12-14`)
- subject API: nullable or any integer >= 0 (`packages/api/src/schemas/subject.schema.ts:116-121`)
- curriculum import: 0–100 (`packages/api/src/schemas/subject.schema.ts:191-207`)
- subject table: null or >= 0 (`packages/api/src/entity/Subject.ts:15-16`)
- canonical class subject requirement: must be > 0

Class auto-population converts null to an unexplained default of 3 in both web and API (`useCurriculumPopulation.ts:113-118`, `class.service.ts:206-213`). A subject value of 0 is accepted by API/database but later fails when inserted as a canonical requirement.

**Impact:** API-valid subjects can break class creation/population; values accepted by one client cannot be edited in another; null silently changes meaning to 3.

**Fix:** define one domain contract. If periods are optional, require explicit resolution before requirement creation; otherwise use 1..configured weekly capacity everywhere. Never silently invent 3.

### SUB-010 — Deletion claims soft delete but performs irreversible hard delete

The entity has `isDeleted/deletedAt`, the web API documents soft delete (`packages/web/src/features/subjects/api.ts:109-120`), but `SubjectRepository.deleteSubject()` calls `BaseRepository.delete()`, which executes SQL DELETE (`packages/api/src/database/repositories/subject.repository.ts:383-394`, `base.repository.ts:274-289`). Foreign keys and cleanup remove requirements, capabilities, and assignments.

All subject read queries also omit `isDeleted = false` (`subject.repository.ts:174-225, 455-490`), so legacy soft-deleted rows would still be returned and sent to the solver.

**Impact:** users cannot restore a deleted subject or its assignment setup, while the dormant soft-delete fields create false expectations and inconsistent behavior.

**Fix:** choose hard or soft delete explicitly. For soft delete, filter every operational read and support restore. For hard delete, remove soft-delete claims/fields or require a strongly worded cascade preview and backup strategy.

### SUB-011 — Read-only GET requests perform database cleanup writes

Both list service methods call `cleanupDeletedSubjectReferences()` before reading (`packages/api/src/services/subject.service.ts:201-219`). With no IDs, cleanup scans all subjects, classes, teachers, and assignments and opens a committed transaction.

**Impact:** a GET can update classes/teachers and delete legacy assignments, adds full-table cost and lock contention to routine reads, and makes read behavior surprising and difficult to cache or reason about.

**Fix:** move reconciliation to migrations, startup repair, or an explicit/admin job. Keep subject GETs read-only.

### SUB-012 — Curriculum subject requests omit the machine ID used by license/trial policy

Normal API calls use the centralized client, which adds `X-Machine-Id` (`packages/web/src/lib/api.ts:99-104`). Curriculum insert and grade clear use raw `fetch` with only `Content-Type` (`packages/web/src/features/subjects/api.ts:174-184, 209-220`). License middleware only loads trial status when that header exists (`packages/api/src/middleware/licenseMiddleware.ts:173-190`).

**Impact:** normal subject CRUD can work during a trial while insert/clear is treated as no trial/read-only. Error parsing and status behavior also diverge from the rest of the app.

**Fix:** route all calls through the centralized API transport.

### SUB-013 — Curriculum configuration writes bypass expired-license read-only mode

Read-only middleware is mounted for `/api/subjects` but not `/api/curriculum` (`packages/api/src/app.ts:87-99`). Curriculum routes expose multiple PUT/POST/DELETE operations.

**Impact:** an expired/read-only installation can still mutate curriculum configuration even though related subject writes are blocked.

**Fix:** protect every mutating route consistently, ideally with an allowlist for truly public/read-only endpoints rather than per-feature omissions.

### SUB-014 — Generalist teachers can make solver input validation fail

The API and UI support teachers with no capabilities, and the transformer emits an empty `primarySubjectIds` array (`packages/api/src/services/solverDataTransformer.service.ts:341-355`). The solver Pydantic model requires `primarySubjectIds` with `min_length=1` (`packages/solver/models/input.py:246-252`).

**Impact:** one active generalist/uncategorized teacher can reject the entire solver request before scheduling starts.

**Fix:** either allow empty lists in the solver and apply the chosen generalist semantics, or prevent such teachers from being active/sent to the solver. Add an end-to-end fixture with zero capabilities.

### SUB-015 — Official curriculum totals contradict configured expected totals

All three static curriculum copies currently total:

| Grades | Actual periods | Expected metadata | Difference |
|---|---:|---:|---:|
| 1–3 | 24 | 24 | 0 |
| 4–6 | 32 | 32 | 0 |
| 7–12 | 36 | 42 | -6 |

The expected category values are declared in `packages/api/src/curriculum/afghanistanCurriculum.ts:41-73`, while the grade lists total 36 for grades 7–12. The validation helper will warn, but ordinary import/class population proceeds.

**Impact:** previews and validation say a grade should have 42 periods while generated requirements contain 36, producing permanent six-period discrepancies.

**Fix:** verify the official policy, then correct either the subject allocations or expected total; add an invariant test for every grade.

## Medium-severity findings

### SUB-016 — Multi-grade curriculum operations are sequential and non-atomic

`CurriculumDialog` loops over grades and performs one request at a time (`packages/web/src/features/subjects/components/CurriculumDialog.tsx:203-219`). Failure on grade N leaves earlier grades committed. Each mutation also emits its own success toast.

**Fix:** add one backend transaction endpoint for a multi-grade plan and return one result with per-grade details.

### SUB-017 — Bulk selection state is incorrect across filtering

Select-all compares the global selected set size with the filtered row count (`SubjectsPage.tsx:112-119`; `SubjectDataGrid.tsx:185-186`). It does not calculate the intersection of selected and visible IDs. Changing filters can produce false all-selected/partially-selected states. The checkbox fakes indeterminate state through `data-state` rather than its `checked` API (`SubjectDataGrid.tsx:214-221`).

**Fix:** derive visible selected IDs and pass `checked="indeterminate"` when appropriate.

### SUB-018 — Coverage click callback fires twice

The coverage `<td>` calls the callback and the nested `SubjectCoverageCell` receives another callback (`SubjectDataGrid.tsx:382-392`). The child click bubbles to the cell, so one click can open/log twice.

**Fix:** make only one element interactive or stop propagation in the child.

### SUB-019 — UI bulk delete is sequential and partially commits

The page loops over IDs and calls the single-delete mutation (`SubjectsPage.tsx:137-144`). A failure leaves earlier rows deleted, later rows untouched, selection uncleared, and emits one toast per deletion even though the backend already has transactional bulk deletion.

**Fix:** expose/use a bulk-ID endpoint and return a single atomic result.

### SUB-020 — Create form produces a value rejected by its own schema

The section schema permits `''` but not null (`packages/web/src/schemas/subject.schema.ts:14`). Selecting “none” calls `field.onChange(null)` (`SubjectForm.tsx:265-268`). The edit drawer uses the empty string instead, so create/edit behavior diverges.

The create grade selector also lacks a “none” item, so a selected nullable grade cannot be cleared; the edit drawer can clear it.

**Fix:** use one canonical null/empty representation and one shared form component/schema for create and edit.

### SUB-021 — Web, API, and database field contracts disagree

Examples:

- code: web required max 10; API optional max 50; database nullable
- periods: web 1–10; API/database >= 0; import <= 100
- name/code: not consistently trimmed or case/Unicode normalized
- section: API enum, but no database CHECK

**Impact:** direct API data can become impossible to edit in the web UI; visually identical names/codes can bypass duplicate checks; invalid direct/database values fail later.

**Fix:** publish a shared contract package, normalize before identity checks, and mirror critical invariants in the database.

### SUB-022 — Feature tags are unnormalized but compared exactly in the solver

Room and subject schemas accept arbitrary strings without trimming, case normalization, deduplication, or non-empty checks (`packages/api/src/schemas/room.schema.ts:20-43`; `subject.schema.ts:46-68`). Solver compatibility uses exact set inclusion (`packages/solver/utils/domain_filter.py:97-101`).

**Impact:** `Projector`, `projector`, and `projector ` are different features; a typo can make a subject unschedulable with no early diagnostic.

**Fix:** define feature slugs or IDs, normalize both sides, validate references, and surface zero-compatible-room errors before solve.

### SUB-023 — School scope is absent from subject identity and repository lookups

Duplicate/upsert queries use grade/name/code but not `schoolId`. The field is described as future multi-tenancy, yet curriculum and repository APIs already accept school scope.

**Impact:** once multiple schools share a database, one school's import can match another school's subject or uniqueness rules become ambiguous.

**Fix:** include normalized school scope in all identity queries and constraints before enabling multi-school operation.

### SUB-024 — Saved timetables are not reconciled when subjects change/delete

Subject updates invalidate swap constraint cache, but deletion cleanup does not update persisted timetable JSON. Swap gathering combines old timetable lessons with current subject rows. A deleted subject lesson can remain in historical JSON with no corresponding current constraint record.

**Impact:** historical display may contain stale names/deleted subjects; swap validation can lack the deleted subject's room/difficulty constraints.

**Fix:** define timetable snapshots as immutable historical records and disable editing against changed master data, or version/reconcile references and mark affected timetables stale.

### SUB-025 — Curriculum source is duplicated in three runtimes

The same Ministry data exists in:

- `packages/api/src/curriculum/afghanistanCurriculum.ts`
- `packages/web/src/features/subjects/data/curriculum.ts`
- `packages/solver/afghanistan/curriculum.py`

They currently agree on counts/totals, but there is no parity test. The web copy is the actual import source while the API copy powers curriculum configuration, making drift operationally dangerous.

**Fix:** keep one versioned data artifact and generate TypeScript/Python adapters, or serve it through one API with checksum/version tests.

### SUB-026 — Specialized lab mapping is mostly ineffective

The web import mapper recognizes biology/chemistry/physics/math lab strings (`packages/web/src/features/subjects/api.ts:149-161`), but curriculum science entries generally contain generic `lab`, so they all map to the generic lab type. The more specific branches do not provide the advertised specialization.

**Fix:** store canonical room type IDs directly in curriculum data and validate them against `room_type`.

### SUB-027 — Curriculum clear flow is implemented but unreachable from SubjectsPage

The page state supports `insert | clear`, but the only menu action always sets `insert` (`SubjectsPage.tsx:59, 153-158, 203-220`). No code sets clear mode.

**Fix:** either expose a guarded clear action with cascade preview or remove the dead mode/API until it is deliberately supported.

### SUB-028 — Curriculum repository singleton is not DataSource-scoped

Most repositories use DataSource-scoped instances, but `CurriculumConfigRepository` stores one global static instance (`packages/api/src/database/repositories/curriculum.repository.ts:11-24`).

**Impact:** tests or processes using more than one DataSource can read/write through the first database's repository and cache.

**Fix:** use the existing DataSource-scoped instance helper.

## Low-severity findings

### SUB-029 — Subject list endpoint has two response shapes

`GET /subjects` returns an array without pagination parameters and an object with pagination parameters. The web client hard-casts the response to an array. A future shared client/query change can fail at runtime.

### SUB-030 — Coverage counts use class completion rather than period coverage

The subject hook counts only fully assigned classes as assigned and computes `unassignedCount = total - assigned`, so partially assigned classes are counted as unassigned (`useSubjectCoverage.ts:151-177`). The UI says “needs assignment,” which is defensible, but the underlying names and coverage percentage are misleading. Use explicit full/partial/empty counts and period coverage.

### SUB-031 — Dead conflict state in subject coverage mapping

The hook counts an `assignmentStatus === 'conflict'` branch but never assigns that status; warnings are stored separately (`useSubjectCoverage.ts:72-86, 151-156`). Conflict totals cannot reflect warnings.

### SUB-032 — Production debug logging leaks assignment payloads/results

Assignment requests and results are printed with `console.log` in `useAssignmentMutations.ts:86-112` and `SubjectAssignmentManager.tsx:234-244, 394-415`. Use the configured logger, levels, and redaction.

### SUB-033 — Comments and telemetry contradict behavior

Examples: delete is described as soft delete but is hard delete; DELETE telemetry records status 200 though the server returns 204; assignment comments say assigning makes a subject primary while the command currently creates an `allowed` capability. These comments should not be used as specifications.

## Database observations

At the initial read-only snapshot, the working database contained 75 subjects and showed:

- no duplicate `(grade, name)` or `(grade, code)` groups
- no invalid subject JSON fields
- no soft-deleted subjects
- no detected orphan subject references
- all subject `schoolId` values null
- non-unique indexes on `(grade, name)` and `(grade, code)`
- a foreign key from `requiredRoomType` to `room_type(value)`

During the review, a separately running development process (`ts-node server.ts`) held the SQLite database and later changed it; a subsequent snapshot contained zero subjects. No restoration or database write was performed by this review. Treat live-data counts as point-in-time observations and stop the dev process or copy the database before repeatable integrity audits.

## Verification performed during the initial review

| Check | Result |
|---|---|
| Web TypeScript type-check | Passed |
| API TypeScript `--noEmit` | Passed |
| Web unit tests | 12/12 passed |
| API integration tests | 10/10 passed |
| Solver tests through venv Python | 17/17 passed |
| Direct subject-focused tests found | None |
| Isolated nullable-grade overwrite proof | Failed as predicted: row overwritten |
| Isolated code-collision upsert proof | Failed as predicted: existing row replaced |
| Isolated duplicate bulk payload proof | Failed as predicted: two duplicate rows created |

The solver's `.venv/bin/pytest` entrypoint has a stale absolute interpreter path; running `.venv/bin/python -m pytest` works. This is an environment issue, not a subject-domain defect.

## Repair order used

### Phase 1 — Stop data corruption

1. Freeze and document subject identity.
2. Separate create from upsert.
3. Fix null query handling and enable TypeORM null/undefined where-value errors.
4. Add normalized, school-aware database uniqueness and collision migration reporting.
5. Make curriculum import non-destructive and transactional.
6. Add backups/confirmation before cascade deletion.

### Phase 2 — Establish one curriculum and period contract

1. Select one curriculum source and reconcile 36 vs 42 periods.
2. Connect `CurriculumConfig` to materialized subjects/class requirements or remove the false operational API.
3. Reconcile incomplete grades by identity, not `length > 0`.
4. Make the periods domain identical in web, API, DB, classes, and solver.

### Phase 3 — Repair assignment/coverage behavior

1. Replace the two subject assignment implementations with one multi-teacher component.
2. Preserve all assignments in optimistic state.
3. Expose full/partial/unassigned period coverage.
4. Support add, rebalance, and unassign.
5. Align HTTP/domain failure semantics.

### Phase 4 — Harden integration boundaries

1. Centralize API transport and license policy.
2. Remove GET-side repair writes.
3. Normalize room feature tags and validate solver compatibility early.
4. Resolve generalist-teacher solver contract.
5. Define timetable staleness/version policy.

### Phase 5 — Tests required before release

At minimum, add end-to-end or integration coverage for:

- create with same name, same code, ambiguous name/code collision, null grade, and concurrent requests
- bulk import with duplicate payload rows and existing custom subject constraints
- import that adds missing subjects without modifying user-owned fields
- curriculum config override/custom subject affecting class requirements and solver input
- 0/null/max periods through UI -> API -> DB -> class requirement -> solver
- two teachers sharing one class/subject, partial coverage, add second teacher, and unassign one teacher
- hard/soft delete semantics and every dependent table/persisted timetable
- trial/expired-license behavior for every curriculum endpoint
- subject/room feature normalization and zero-compatible-room diagnostics
- generalist teacher with empty capabilities reaching solver validation
- parity/checksum and total-period invariants for all curriculum runtimes

## Original release gate and disposition

The original gate required SUB-001 through SUB-015 to be fixed or explicitly removed from supported behavior, with automated regression tests. That gate is now satisfied in the working tree, and SUB-016 through SUB-033 were remediated in the same pass. Deployment still requires the normal operational steps: back up the target database, apply managed migrations, and deploy the API and web artifacts together.
