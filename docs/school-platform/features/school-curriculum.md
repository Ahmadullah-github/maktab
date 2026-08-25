# School Curriculum (Offline Timetable Input)

**Module prefix:** `SCU`  
**Current status:** Verifying — implementation and automated release gates passed; school UAT pending  
**Primary owners:** Head teacher, timetable administrator  
**Runtime owner:** `services/local-api` and the shared browser/Electron renderer

## Objective

Make a revisioned, school-owned curriculum plan the source of truth for timetable subjects and
class requirements. The Afghanistan curriculum is an optional starting template; it has no
validation or solver authority. A school may freely combine template rows and its own subjects.

## Scope and ownership

- SQLite owns this offline planning feature. It does not create authoritative academic CRUD in
  `services/platform-api`.
- One `SchoolCurriculumPlan` exists per local school scope. Its normalized
  `SchoolCurriculumItem` rows are the complete plan for each populated grade.
- A linked catalog `Subject` carries the stable curriculum item UUID. Renaming or recoding a row
  updates that subject instead of replacing its identity.
- A subject without a grade or positive weekly periods remains catalog-only and is not assigned
  to classes automatically.
- Class-specific differences are explicit period overrides. Synchronization preserves them while
  inherited requirements follow the curriculum.

## User workflows

### Build or change a grade plan

Open `/school-curriculum` → choose an active grade → edit rows or paste a spreadsheet → optionally
replace that grade's draft with the Afghanistan template → review subject, class, requirement, and
teacher impacts → confirm destructive dependency removal when required → apply atomically.

Drafts are retained between grade tabs. Unsaved navigation is guarded in browser and Electron
navigation. Applying the Afghanistan template changes only the selected in-memory draft until the
user reviews and applies it.

### Add a planning subject from Subjects

Creating a subject with a grade and positive weekly periods adds a curriculum item and synchronizes
every existing class in that grade in one transaction. Editing or deleting a linked subject uses
the same preview/apply behavior. Removing its grade or periods converts it to catalog-only after
the shared removal-impact checks.

### Synchronize selected classes

Class-page synchronization previews and applies exact class IDs. It never reloads the Afghanistan
template. A reviewed class proposal receives its grade plan even when that grade itself is
unchanged; other classes in that grade are untouched.

## API contract

All endpoints are under `/local-api/v1`:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/curriculum/plan` | Revision, active grades, complete grade rows, capacity, and class counts |
| `GET` | `/curriculum/templates/afghanistan` | Optional template rows for active grades |
| `POST` | `/curriculum/plan/preview` | Non-mutating normalized impact preview and ten-minute token |
| `POST` | `/curriculum/plan/apply` | Transactional apply of the reviewed token |

Preview requests include the current global revision, complete drafts for changed grades, exact
class IDs to synchronize, and fully expanded proposed class rows. Apply reloads and fingerprints
the relevant curriculum, subjects, classes, requirements, assignments, teachers, and rooms inside
the write transaction.

Conflict responses use HTTP `409` with one of:

- `PREVIEW_EXPIRED`
- `CURRICULUM_REVISION_STALE`
- `PREVIEW_CHANGED`
- `CONFIRMATION_REQUIRED`
- `CURRICULUM_BLOCKED`

## Capacity and synchronization rules

- Active grades come from School Settings grade bands.
- Weekly capacity is calculated server-side from active school days and effective per-day and
  per-category Period Structure values.
- Changed grades synchronize all existing classes in those grades. Unchanged grades synchronize
  only explicitly reviewed classes and proposed classes.
- Obsolete requirements and their assignments are removed only after required confirmation.
  Capabilities are archived only when their linked subject is archived.
- A curriculum apply increments the plan revision once. Sync-only apply does not increment it.
- Affected timetables are marked stale once with a structured reason, and the audit row is written
  in the same transaction. Any failure rolls back every mutation.

## Migration rules

The committed SQLite migration converts legacy grade configurations into their calculated effective
rows, including overrides and custom subjects. Genuine manual planning subjects are appended without
duplicates; stale materialized template subjects that had been removed stay absent. Grades without
a configuration use active catalog planning subjects, and unused grades remain empty.

Item UUIDs are deterministic by school scope, grade, and normalized code. Existing subjects link by
the same identity. Ambiguous normalized-code matches abort with school, grade, code, and subject IDs
in the diagnostic. The final active schema has no legacy curriculum configuration table or Ministry
validation columns.

## Invariants

- Normalized subject code is unique within a plan and grade.
- Preview is non-mutating and its token is process-local, single-use, and valid for ten minutes.
- Revision and fingerprint checks occur inside the same transaction as apply.
- The solver receives ordinary subjects and class requirements; it contains no curriculum constants
  or Ministry validator.
- Afghanistan template metadata cannot block, validate, or silently repopulate a school plan.

## Verification evidence

Automated coverage includes migration conversion/conflicts, the reported `حرفه` → `ترکی` grades
7–9 flow, stable subject identity, preserved class overrides, exact synchronization scope, capacity
blocking, non-mutating preview, expiry/staleness/fingerprint conflicts, destructive confirmation,
rollback, audit, timetable staleness, optional class creation, paste validation, draft behavior, and
the absence of solver Ministry contracts.

On 2026-08-21 the final implementation tree passed:

- the complete local API suite (31 tests), including migration/adoption and transaction rollback;
- renderer type checking and unit tests (16 files, 45 tests);
- timetable solver tests (31 tests) and platform API tests (8 tests);
- the repository-wide `npm run check` quality gate;
- production web, local API, and standalone solver builds;
- all Chromium end-to-end flows (8 tests), including School Curriculum RTL, navigation guard,
  exact synchronization, template draft isolation, and stale-preview recovery; and
- a packaged Electron smoke flow that created and applied a curriculum row through the embedded
  local API using an isolated temporary profile.

The destructive local planning reset is performed only after these gates and creates its own
automatic backup. Production release status still requires school user acceptance under the
documentation lifecycle convention.
