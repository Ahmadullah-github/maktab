# Teachers Feature Deep Code Review

**Review date:** 2026-07-16  
**Primary scope:** `packages/web/src/features/teachers`  
**Integration scope:** web assignments/classes/subjects/schedule features, API routes/services/repositories/entities/migrations, SQLite data, and Python solver input/constraints  
**Mode:** original read-only review followed by completed remediation

> **Implementation status (2026-07-16):** The findings below preserve the original pre-fix evidence. The remediation plan has now been implemented across the web application, API, SQLite migrations, and solver. The previously inconsistent local planning data was reset with an automatic backup after the user approved deletion. The current database and verification results are recorded near the end of this document.

## Executive summary

The teachers feature is not safe to treat as a self-contained CRUD screen. It currently spans three competing representations:

1. legacy JSON mirrors on `teacher` and `class_group`;
2. legacy normalized `teacher_class_subject_assignment` rows;
3. canonical `teacher_subject_capability`, `class_subject_requirement`, and `teaching_assignment` rows.

The UI and solver now mostly trust the canonical representation, but schema migration did not backfill legacy data and application startup does not verify semantic assignment consistency. The live database demonstrates the result: the migration ledger is current and SQLite's structural checks pass, while the assignment integrity report finds **115 errors, 2 warnings, and 36 canonical drift records**.

The highest-risk outcomes are:

- teacher capabilities and assignments can disappear from the UI/solver while stale mirrors remain in the database;
- fixed and split teacher assignment period counts are not honored by the solver;
- weekly, daily, consecutive, and time-preference teacher settings are mostly not enforced during generation;
- a teacher with `maxPeriodsPerWeek = 0` means three different things in the API, assignment service, and solver;
- bulk import can partially commit even though the UI reports the whole import as failed;
- stored availability matrices can constrain generation while the teacher UI silently discards and hides them.

### Finding count

| Severity | Count | Meaning |
|---|---:|---|
| Critical | 6 | Can corrupt/lose authoritative data, generate a timetable that violates explicit teacher assignments, or block valid generation |
| High | 11 | Material correctness, destructive UX, cross-feature consistency, or scaling defect |
| Medium | 10 | Contract drift, incomplete functionality, maintainability, localization, or performance concern |
| Low | 4 | Quality and accessibility debt that increases future defect risk |

## Remediation summary

All 31 findings were addressed under the approved product policies: canonical assignments remain authoritative; `maxPeriodsPerWeek = 0` means the teacher cannot teach; teacher deletion is a transactional hard delete; staff code is the required school-scoped identity while duplicate display names are allowed; sparse `unavailable` slots are authoritative; and non-fixed assignments are weighted solver preferences.

The implementation includes:

- a managed, transactional legacy-to-canonical backfill that synchronizes compatibility storage and a semantic startup gate that refuses drift;
- exact fixed/split assignment counts, hard weekly/daily/consecutive limits, availability enforcement, time preferences, preferred-room/colleague objectives, and sound pre-solve capacity bounds;
- atomic bulk import/delete and capability-plus-dependent-assignment commands with school-scope and calendar-aware validation;
- explicit employment type, staff codes, complete teacher preferences, safe Excel import, visible-selection deletion confirmation, batch workload projections, and distinct projection loading/error states;
- lazy-loaded import code, removal of obsolete teacher components/hooks, an accessible class-selection dialog, one shared API client, and complete English/Farsi teacher keys.

## Critical findings

### TCH-C01 — Canonical assignment rollout is active without an automatic backfill or semantic startup gate

**Evidence**

- `1742400000000-CreateCanonicalAssignmentTables.ts:4-91` creates tables and indexes only; it does not migrate teacher/class JSON mirrors into canonical rows.
- The actual backfill is a separate manual command in `scripts/assignment-phase2-backfill.ts:20-84`.
- `database/bootstrap.ts:78-92` checks only `PRAGMA integrity_check` and `PRAGMA foreign_key_check`; it does not run `auditAssignmentStorageConsistency` or the phase-2 integrity report.
- `teacher.repository.ts:136-153` prefers canonical compatibility whenever the compatibility map is present, even when it is an empty array/map entry. Legacy JSON therefore becomes invisible to API consumers after canonical tables exist.
- The live database has all 12 migrations applied, but teacher `id=1` stores `primarySubjectIds=[73]`, `allowedSubjectIds=[72]`, and a class assignment for subject `72` / classes `17,18`; canonical capability and assignment tables contain zero rows, and subjects `72/73` no longer exist.
- `npm run assignments:phase2:report` reports 72 planned requirements, 115 errors, 2 warnings, and 36 requirement drift records.

**Impact**

The teacher screen, assignment projections, and solver can show/use no capability or assignment even though persisted legacy JSON says the opposite. A structurally “healthy” and fully migrated database can therefore be semantically unusable.

**Fix direction**

1. Stop treating schema creation as activation of canonical reads.
2. Add an idempotent managed data migration or a versioned rollout state: create schema → dry-run plan → reconcile blocking errors → atomic backfill → verify zero drift → switch reads.
3. Fail startup (with a backup and actionable report) when canonical tables are active but semantic drift exceeds zero.
4. Do not use `--force` on the current database until missing subject identities and class requirements have been reconciled from a backup or an authoritative curriculum source.

### TCH-C02 — Fixed and split teacher assignment period counts are ignored by timetable generation

**Evidence**

- `solverDataTransformer.service.ts:432-456` correctly sends `periodsPerWeek` and `isFixed` for each canonical teaching assignment.
- `core/solver.py:410-424` stores those period counts.
- `core/solver.py:649-667` only restricts each class/subject request to the set of fixed teachers. It never constrains how many periods each fixed teacher must receive.
- Non-fixed rows are not implemented as a preference: when no fixed rows remain, the code logs a warning and leaves the original domain unchanged (`core/solver.py:668-675`).
- Every generated lesson is emitted with `isFixed: False`, even when its teacher was selected through a fixed assignment (`core/solver.py:1207-1225`).

**Impact**

If History is split as Teacher A = 1 period and Teacher B = 2 periods, the solver may assign all three periods to either teacher. A supposedly fixed assignment is also lost in output metadata, so later schedule editing/swapping cannot reliably preserve it.

**Fix direction**

Create assignment indicator variables per request/teacher and constrain their weighted sum to each canonical `assignedPeriodsPerWeek`. Implement `isFixed=false` as an explicit soft objective or remove that unsupported state. Preserve fixed provenance in generated lessons and add solver tests for exact 1+2, replacement, and non-fixed preference cases.

### TCH-C03 — Teacher workload and preference settings are not enforced by the solver

**Evidence**

- `Teacher` accepts `maxPeriodsPerWeek`, `maxPeriodsPerDay`, `maxConsecutivePeriods`, and `timePreference` (`models/input.py:246-260`).
- Solver constraint code contains no hard constraints using the three teacher maximum fields. `maxPeriodsPerDay` is not referenced outside models, and teacher `maxConsecutivePeriods` / `timePreference` are only considered by the swap validator, not generation.
- The pre-solve workaround distributes each class/subject load evenly among all qualified teachers (`feedback/pre_solve_analyzer.py:142-162`) and blocks generation when that estimate exceeds a teacher maximum (`:164-182`; `generate/handlers.ts:114-132`). It is not a feasibility calculation.

**Impact**

The generated timetable may overload teachers or violate daily/consecutive preferences. Conversely, a feasible schedule can be rejected: for two qualified teachers with capacities 2 and 8 and a 10-period demand, the equal-share estimate assigns 5 to each and rejects the teacher with capacity 2 even though a 2/8 allocation is feasible.

**Fix direction**

Enforce weekly/day/consecutive limits in CP-SAT using assignment indicators and scheduled-slot variables. Implement time preference as a weighted soft constraint. Replace the equal-share pre-check with safe lower/upper-bound feasibility checks that cannot reject a feasible allocation.

### TCH-C04 — Zero workload has contradictory meanings across API, UI, assignments, and solver

**Evidence**

- API create defaults all workload limits to `0` (`teacher.schema.ts:220-238`), and the entity/check constraint explicitly permits zero.
- Web forms require values of at least `1` (`web/src/schemas/teacher.schema.ts:62-64`; `TeacherForm.tsx:71-86`).
- Assignment validation treats `maxPeriodsPerWeek=0` as zero capacity and rejects any positive assignment (`assignmentCommand.service.ts:200-208`).
- Solver transformation changes zero to 30 via `t.maxPeriodsPerWeek || 30`, while zero daily/consecutive limits become `undefined` (`solverDataTransformer.service.ts:362-364`).
- The API integration test creates a teacher without any workload values, which produces this zero-default state, but it does not test assignment or generation behavior.

**Impact**

The same teacher can be unassignable through the API, invalid in the edit UI, and treated as a 30-period teacher by the solver.

**Fix direction**

Define one meaning: either zero is a real “cannot teach” limit or the fields are nullable and `null` means “use school defaults.” Use nullish coalescing rather than truthiness in the transformer. Align Zod schemas, database constraints, form defaults, projections, assignment validation, and solver behavior.

### TCH-C05 — Stored teacher availability can be enforced by the solver but is discarded and invisible in the UI

**Evidence**

- Backend/API availability is a day-keyed record (`teacher.repository.ts:37,62`; `teacher.schema.ts:216,278`).
- The frontend declares it as `boolean[][]` (`teachers/types.ts:34,63`) and deserializes any non-array value with `JSON.parse` as though it were a string (`teachers/api.ts:42-44`; `utils/serialization.ts:153-155`). A normal API object therefore falls back to `[]`.
- The active create/edit UI only renders and writes `unavailable`; it has no control for the persisted `availability` matrix (`TeacherFormDrawer.tsx:339-345`, `:479-499`; `TeacherEditDrawer.tsx:298-329`).
- The transformer still reads and applies the hidden database matrix (`solverDataTransformer.service.ts:346-360`, `:525-585`).

**Impact**

A migrated or API-created teacher can be unavailable in generation even while every cell appears available in the teacher screen. Users cannot inspect, clear, or correctly edit the hidden constraint.

**Fix direction**

Choose one canonical availability representation. Prefer a single day/period map derived from a validated `unavailable` list, or expose and edit the full map. Introduce explicit wire DTOs, migrate stored data, and add a round-trip test from database → API → form → update → solver input.

### TCH-C06 — Bulk teacher import is not atomic and leaves the UI stale on partial failure

**Evidence**

- `TeacherService.bulkImport` loops through `this.create()` (`teacher.service.ts:368-400`). Each `create` opens and commits its own transaction (`:154-188`).
- The repository already contains an atomic batch implementation (`teacher.repository.ts:500-562`), but the service does not use it because capability/assignment synchronization was added separately.
- Frontend invalidates teacher caches only on full mutation success (`useBulkImportTeachers.ts:386-408`).

**Impact**

If row 6 fails, rows 1-5 remain committed while the request fails. The UI keeps its old cache and reports import failure, encouraging a retry that produces duplicates or more partial state.

**Fix direction**

Validate the entire batch first, then write teachers and capabilities in one committed transaction. Return structured per-row validation before writing. On unexpected failure, roll back everything. Until fixed, the frontend should invalidate/refetch on settled failure and clearly report any server-declared partial result (ideally partial results should be impossible).

## High-severity findings

### TCH-H01 — Cleanup-on-read is expensive, mutating, and blind to the drift it is meant to repair

- Every teacher GET/list calls `cleanupDeletedSubjectReferences` (`teacher.service.ts:327-360`).
- The cleanup always opens a transaction; `runCommittedTransaction` clears the entire process cache after every commit, even when nothing changed (`database/transaction.ts:8-15`).
- Cleanup scans all classes, teachers, and assignments (`subjectReferenceCleanup.service.ts:141-164`).
- Those repositories overlay canonical compatibility before cleanup examines legacy mirrors (`teacher.repository.ts:136-153`; `class.repository.ts:153-155`). Empty canonical maps hide stale raw JSON, so the current teacher/class mirror corruption is not detected.

Move cleanup to explicit write paths or a repair job. Read raw columns for audits, never derived projections. Make GET endpoints side-effect free and cache-safe.

### TCH-H02 — Assignment validation ignores real availability, daily limits, and consecutive limits

`AssignmentCommandService.validateAssignment` checks capability and weekly contracted capacity but never reads the teacher availability fields, `maxPeriodsPerDay`, or `maxConsecutivePeriods` (`assignmentCommand.service.ts:104-229`). The declared `availability_conflict` type is never produced by backend assignment validation. UI workload uses an “available slots” effective maximum, so UI and API can disagree about whether an assignment is acceptable.

Validate assigned periods against effective available slots and add a feasibility warning/error model for daily constraints. Keep assignment-time validation conservative, with final enforcement in the solver.

### TCH-H03 — Excel import silently drops the subject column and the generated template can import sample teachers

- Parsing supports `primarySubjects` and `validateImportedTeachers` can map names when a `subjectMap` is supplied (`useBulkImportTeachers.ts:153-166`, `:264-271`).
- `TeacherExcelImport` calls `validateFromExcel(file, existingTeachers)` without a subject map (`TeacherExcelImport.tsx:91-95`), and the bulk dialog does not load/pass subjects. Every imported subject name is silently discarded.
- The generated template includes a descriptive row plus three realistic example teachers (`useBulkImportTeachers.ts:313-330`). The importer treats those rows as data; the UI allows importing valid rows even when other rows have validation errors (`TeacherExcelImport.tsx:320-445`).

Load active subjects, build a normalized name/code map, and reject unknown/ambiguous subject names. Put instructions/examples on a separate sheet or mark and skip them deterministically.

### TCH-H04 — “Full-time / part-time” has multiple incompatible definitions

- Filters and table badges classify from available slots (`useTeacherFilters.ts:59-67`; `TeacherDataGrid.tsx:186-189`).
- Stats and the edit drawer classify from contracted `maxPeriodsPerWeek` (`TeacherStatsCard.tsx:41-47`; `TeacherEditDrawer.tsx:181-184`).

The same teacher can be full-time in the sidebar and part-time in the list. Define employment status explicitly in the data model, or publish one shared derived function and use it everywhere.

### TCH-H05 — Filtered selection can display the wrong “select all” state and delete hidden teachers without confirmation

- Selection persists across filter changes (`TeachersPage.tsx:50-58`).
- “All selected” compares only set size with visible row count, not ID membership (`TeacherDataGrid.tsx:191-192`).
- Toggle-all also compares only sizes (`TeachersPage.tsx:151-158`).
- The bulk delete button immediately performs sequential deletes with no confirmation (`TeacherFilters.tsx:138-153`; `TeachersPage.tsx:183-190`).

A selected set from a previous filter can make a new filter appear fully selected and the delete action can remove non-visible records. Scope selection to visible IDs or explicitly label cross-filter selection; compute membership intersections; require a confirmation listing count/names; use one atomic bulk-delete endpoint.

### TCH-H06 — Teacher identity is neither normalized nor protected by a database constraint

- Manual create/update does not trim or Unicode-normalize names.
- Duplicate checks and repository upsert are exact global string comparisons (`teacher.service.ts:139-146`, `:223-227`; `teacher.repository.ts:323-339`, `:458-470`).
- The database has only a non-unique name index (`entity/Teacher.ts:10-12`).
- Bulk import uses a different normalization policy and a 100-character limit, while manual/API flows allow 255.

Names such as `Ahmad`, ` Ahmad `, case variants, and Unicode-equivalent Dari text can coexist. Normalize at the API boundary and add an active, school-scoped unique key/index using the same canonicalization.

### TCH-H07 — Removing a capability and its assignments is a two-request, non-atomic operation

Disabling a subject first unassigns all classes, then updates teacher capabilities (`SubjectAssignmentManager.tsx:367-397`). If the second request fails, assignments are gone but the capability remains. Other subject-level toggles similarly make independent writes.

Add one backend command that changes capability and resolves dependent assignments in one transaction. Return the resulting teacher capability and assignment projection.

### TCH-H08 — Cross-school references are not validated consistently

Teacher base writes call `assertOperationalWriteScope`, but capability synchronization only verifies that teacher and subject are active (`teacherCapability.service.ts:97-165`, `:203-235`). Assignment commands load active teacher/subject/class requirements without asserting a common school scope. Name uniqueness is also global rather than scoped.

When non-null school IDs are used, a teacher can acquire another school's subject/class relationship. Add a shared scope assertion to capability and assignment commands and enforce scope at the database/service boundary.

### TCH-H09 — Bulk-import defaults ignore the active school calendar

Bulk defaults are hard-coded to 35 weekly and 7 daily periods, with a generic weekly range of 1-50 (`useBulkImportTeachers.ts:110-122`, `:273-296`). The active form derives limits from SchoolConfig. A 30-period/6-period school can import teachers that the edit form rejects and that availability calculations classify incorrectly.

Pass the active SchoolConfig into all import validators and derive the same defaults/limits used by the regular form.

### TCH-H10 — Teacher list performs N workload requests, each requiring several database queries

Every `AssignmentBadgesCell` invokes `useTeacherWorkloadView(teacher.id)` (`AssignmentBadgesCell.tsx:72-95`). `TeacherDataGrid` renders one cell per teacher, and each API workload projection performs teacher, assignment, requirement, capability, class, and subject reads (`assignmentProjection.service.ts:783-840`). The existing plural hook still uses `useQueries`, so it is not a batch API (`projections/hooks.ts:63-97`).

Return assignment summary/workload columns in the teacher list DTO or add a real bulk projection endpoint. Fetch once at page level and pass a map to rows.

### TCH-H11 — Hidden or obsolete unavailable slots distort UI capacity while the solver ignores them

The UI subtracts `teacher.unavailable.length` without validating uniqueness, enabled days, or per-day period bounds (`TeacherDataGrid.tsx:372-399`; `SubjectAssignmentManager.tsx:213-222`). The availability grid hides slots outside the current calendar but does not remove them. The transformer/solver ignores unknown days and out-of-grid periods.

After calendar changes, UI capacity can be lower than solver capacity. Normalize and deduplicate slots whenever SchoolConfig changes and at every API write; calculate capacity from the canonical current calendar, not raw array length.

## Medium-severity findings

### TCH-M01 — API validation is much looser than UI validation

`timePreference` accepts any string; subject/room/colleague ID arrays accept zero and negative integers before the service silently filters some values; unavailable slots allow any standard weekday and periods 0-11 without checking the active calendar; duplicate slots are accepted (`teacher.schema.ts:107-150`, `:192-251`, `:258-302`). Use strict enums, positive IDs, uniqueness refinements, referential validation, and SchoolConfig-aware slot validation.

### TCH-M02 — Frontend wire types knowingly lie about the actual API response

`TeacherResponse` declares JSON fields as strings while the backend returns parsed arrays/objects (`teachers/types.ts:51-78`; `teacher.repository.ts:128-160`). The API client then uses casts and dual runtime branches (`teachers/api.ts:32-62`). This hid the availability-object bug while type checking still passed. Define generated/shared DTO schemas and validate responses at runtime.

### TCH-M03 — Several teacher settings are dormant or unreachable

`timePreference` exists in the form model but is not rendered in active create/edit forms. `preferredRoomIds` and `preferredColleagues` exist in entity/API/types but are not part of `TeacherFormValues` or serialized by the active client. Colleague preference is not sent to the solver, and teacher time preference is not used by generation. Either implement each setting end-to-end or remove it from the active contract until supported.

### TCH-M04 — English localization is incomplete and frequently falls back to Persian

The Farsi catalog contains 10 keys missing from English, and the code references many keys missing from both catalogs. Most calls provide Persian fallback strings, so the English UI displays mixed languages. Examples include bulk import, quick add, Excel import, settings, workload labels, and `tabs.subjectsClasses`. Add a CI key-parity/extraction check and provide English/Farsi entries instead of embedding Persian fallback copy in components.

### TCH-M05 — The teacher route chunk is unnecessarily heavy

Production output contains a **529 KB uncompressed** `teachers-*.js` chunk. `xlsx` is imported statically through the bulk-import hook/dialog even when the dialog or Excel method is never opened (`useBulkImportTeachers.ts:16`; `TeachersPage.tsx:36,346-352`). Dynamically import the bulk dialog and load `xlsx` only when Excel import/template generation is selected.

### TCH-M06 — Duplicate and stale teacher implementations contain conflicting business rules

The directory retains multiple unused/legacy surfaces: `TeacherInspector`, `TeacherAssignmentMatrix`, `TeacherWorkloadCalculator`, `QuickAssignmentForm`, `TeacherAssignedClassesGrid`, a second local `useTeacherAssignments`, and duplicate serialization helpers. `useTeacherWorkload` exposes `getWorkloadWithAssignment` and `getWorkloadWithoutAssignment`, but both return the unchanged workload (`useTeacherWorkload.ts:110-128`). Remove unused surfaces or migrate all callers to canonical projections before keeping them exported.

### TCH-M07 — Soft-delete fields and repository behavior disagree

Teacher comments/types describe soft deletion, but single and bulk repository delete operations are hard deletes (`base.repository.ts:274-290`; `teacher.repository.ts:565-598`). At the same time, list/get/name/count queries do not filter `isDeleted`, so imported legacy soft-deleted rows would still appear and block recreation. Choose hard delete or soft delete and implement it consistently in entity constraints, routes, queries, cache keys, and UI wording.

### TCH-M08 — Quick/paste import failures are swallowed

`TeacherQuickAdd` and `TeacherPasteImport` catch bulk-import errors and render no `importError` (`TeacherQuickAdd.tsx:160-167`; `TeacherPasteImport.tsx:139-147`). The mutation has no `onError` toast. Users can click save, receive no durable explanation, and retry after a possible partial commit. Surface structured row/server errors and keep the pending list intact.

### TCH-M09 — Single-row delete UI is dead code

`TeacherDataGrid` carries delete state, confirmation dialog, and callbacks, but never sets `deleteTarget`, and `TeachersPage` does not pass `onDeleteTeacher` (`TeacherDataGrid.tsx:103-178`, `:422-443`; `TeachersPage.tsx:295-307`). The only active deletion path is the unsafe bulk toolbar. Remove the dead path or expose a proper per-row action with confirmation.

### TCH-M10 — Per-row projection errors are rendered as “no assignments”

`AssignmentBadgesCell` ignores workload query loading and error state and uses `workloadView?.assignments ?? []` (`AssignmentBadgesCell.tsx:84-95`). Network/server failure is indistinguishable from a genuinely unassigned teacher, which is especially dangerous during canonical drift. Render loading/error indicators and avoid enabling “click to assign” until the authoritative state is known.

## Low-severity findings

### TCH-L01 — Production components retain debug console logging

`SubjectAssignmentManager` logs assignment requests/results/errors directly (`:429-459`), and `TeacherAssignmentMatrix` also logs mutation failures. Route handlers log full result objects. Route logs should avoid potentially sensitive payloads; frontend logging should use the existing environment-aware logger.

### TCH-L02 — The custom class-selection overlay is not an accessible dialog

`AddClassPopoverWrapper` uses fixed divs without `role="dialog"`, `aria-modal`, focus trapping, Escape handling, or focus restoration (`SubjectAssignmentManager.tsx:719-960`). Use the shared Dialog component.

### TCH-L03 — Teacher-related APIs use three different fetch wrappers

Core teachers use `lib/api.ts`, canonical assignment mutations define another wrapper, and `teacher-assignments/api.ts` defines a third. Error payload handling and machine/license headers already differ. Consolidate on the typed `ApiError` client to avoid inconsistent failures and authentication metadata.

### TCH-L04 — Comments and contracts describe behavior that no longer exists

Examples include “dual-write” comments after canonicalization, “soft delete” on a hard-delete endpoint, and “pagination support” while the frontend expects only an array. Update documentation after the canonical model is settled so future changes do not revive obsolete write paths.

## Current database audit

The original audit found the corruption described above. After implementation, the approved reset created `timetable.db.reset-backup-2026-07-16T11-35-05-150Z` and cleared the inconsistent local planning data.

| Check | Result |
|---|---|
| Migration ledger | 14/14 migrations through `BackfillCanonicalAssignments1784500000000` |
| SQLite `integrity_check` | `ok` |
| SQLite `foreign_key_check` | 0 violations |
| Active teachers | 0 |
| Canonical teacher capabilities | 0 |
| Canonical teaching assignments | 0 |
| Legacy normalized teacher assignments | 0 |
| Classes / subjects / rooms / timetables | 0 / 0 / 0 / 0 |
| Phase-2 integrity report | 0 errors, 0 warnings, 0 drift |

This distinction is important: SQLite integrity and foreign keys cannot detect stale IDs stored inside JSON text. Semantic integrity must be a first-class startup/deployment check.

## Post-remediation verification

| Command/check | Result |
|---|---|
| Web type-check | Passed |
| Web unit tests | 4 files / 18 tests passed, including teacher contract/i18n coverage |
| Web ESLint | Passed with zero warnings |
| Production web build | Passed; `TeachersPage` is 91.68 KB and `xlsx` is a separate lazy chunk |
| API integration tests | 18/18 passed, including teacher rollback/delete and legacy upgrade/startup-gate cases |
| Solver tests | 24/24 passed, including fixed split counts, zero capacity, workload limits, availability, and preferences |
| SQLite structural checks | Integrity `ok`; 0 foreign-key violations |
| Assignment integrity report | 0 errors, 0 warnings, 0 requirement/capability/assignment drift |

## Recommended remediation sequence

### Phase 0 — Contain and recover data

1. Take a SQLite backup including WAL state using the existing backup helper.
2. Disable teacher/subject/class assignment writes while the current database is inconsistent.
3. Preserve the integrity report as an artifact.
4. Reconcile missing subject identities and raw class requirements from an authoritative source/backup.
5. Run phase-2 backfill in dry-run mode; resolve every blocking issue; then perform one atomic backfill and verify zero drift.
6. Add semantic startup gating before re-enabling writes.

### Phase 1 — Establish one contract

1. Make canonical rows the sole authority only after verified migration.
2. Define shared DTO schemas for Teacher, availability, capabilities, assignments, and workload.
3. Decide zero/null/default semantics and hard-vs-soft deletion.
4. Normalize names and enforce school-scoped identity/reference rules.
5. Remove cleanup mutations from GET routes.

### Phase 2 — Fix schedule correctness

1. Enforce exact fixed/split period counts in the solver.
2. Enforce weekly, daily, consecutive, availability, and time-preference constraints.
3. Replace the equal-share pre-solve estimator with sound feasibility checks.
4. Preserve fixed-assignment metadata into generated timetables and swap validation.

### Phase 3 — Make writes atomic and UI-safe

1. Replace bulk create/delete loops with transactional commands.
2. Add a single capability+assignment command.
3. Fix filtered selection membership and deletion confirmation.
4. Repair Excel subject mapping/template behavior and SchoolConfig-derived defaults.
5. Add explicit loading/error states for projections.

### Phase 4 — Performance and cleanup

1. Add a batch teacher list/workload projection.
2. Lazy-load bulk import and `xlsx`.
3. Remove duplicate legacy components/hooks/serializers.
4. Complete translation catalogs and accessibility work.

## Minimum regression suite before release

1. Legacy database upgrade with populated teacher mirrors produces canonical rows and zero drift.
2. Startup refuses a fully migrated but semantically divergent database.
3. Teacher create/update round-trips availability and all constraints without coercion.
4. Zero/null workload semantics are identical in API, UI, assignment validation, and solver.
5. Bulk import rolls back every row when one row fails.
6. Excel import maps subject names/codes, reports unknown names, and skips template examples.
7. Filter changes cannot make hidden selections appear selected or delete without confirmation.
8. Fixed split assignment A=1/B=2 yields exactly that distribution in generated lessons.
9. Solver respects weekly, daily, consecutive, unavailable, and time-preference constraints.
10. Teacher deletion handles canonical capabilities/assignments atomically and according to the chosen deletion policy.
11. English and Farsi teacher translation keys have parity.
12. Teacher list fetch count remains constant as teacher count grows.
