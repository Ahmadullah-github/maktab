# Constraints feature — implemented remediation report

Date: 2026-07-16  
Primary UI: `packages/web/src/features/constraints`  
Status: implementation complete; automated verification passed

## Production decisions encoded

- Optimization settings are school-scoped and revisioned.
- A soft objective has one of four exact strengths: `0`, `0.5`, `1`, or `2`.
- `0` disables an objective. Strategy selection never disables an objective.
- Fast, Balanced, and Thorough change only CP-SAT search effort.
- Manual teacher allocations are hard locks; they are not solver suggestions.
- When consecutive periods are disabled, one class-subject may occur at most once per day.
- When consecutive periods are enabled, a class-subject may occur at most twice per day and two periods on the same day must be adjacent.

## End-to-end contract

The canonical profile contains these twelve weighted objectives and one capability toggle:

| Area | Objective |
| --- | --- |
| Teacher | Avoid teacher gaps |
| Teacher | Balance a teacher's load across available days |
| Teacher | Respect morning/afternoon preference |
| Teacher | Respect preferred rooms |
| Teacher | Align preferred colleagues' free periods when both are available |
| Class | Avoid class gaps |
| Subject | Avoid placing multiple distinct difficult subjects on one class-day |
| Subject | Prefer difficult subjects in the first half of the day |
| Subject | Spread a class-subject across days |
| Room | Use fewer distinct rooms per class |
| Room | Prefer a compatible class home room |
| Room | Prefer rooms containing desired subject features |
| Capability | Allow adjacent double periods for the same class-subject |

`avoidFirstLastPeriodWeight` and `respectTeacherAssignmentPreferenceWeight` were removed. The first had no truthful end-to-end implementation; the second contradicted the hard-lock assignment decision.

## Findings resolved

### Persistence and API

- Replaced the global generic `configuration` record with `SchoolConfig.optimizationPreferencesJson`.
- Added migration `1784700000000-SchoolScopedOptimizationPreferences`.
- The migration quantizes legacy numeric weights to the canonical four strengths, preserves defaults for fields absent from legacy data, copies the profile to school configuration rows, and removes the legacy record.
- Added canonical `GET /config/optimization-preferences` and `PATCH /config/optimization-preferences` endpoints.
- PATCH requires the current school-config revision and returns HTTP 409 for stale writes.
- No-op writes preserve the revision; real changes increment it transactionally.
- Real changes mark matching saved timetables stale with `OPTIMIZATION_PREFERENCES_CHANGED`.
- Strict Zod schemas reject unknown fields, missing fields, and arbitrary numeric weights.
- The solver transformer now reads the same school-scoped profile and includes its revision in solver metadata.
- The generic configuration write route cannot write optimization profiles.

### Web UI and UX

- Replaced continuous sliders and lossy drag ranking with explicit Off/Low/Medium/High controls.
- Presets are exact, deterministic profiles; editing a value produces a derived Custom state.
- Removed the misleading Fast preset and problem-size warnings that claimed objectives could be ignored.
- Added Teacher-focused, Class-focused, and Balanced presets.
- Added accessible button groups, translated help text, an expandable summary, loading/error/retry states, save progress, and revision-conflict feedback.
- Added separate Recommended defaults and Discard changes actions.
- Local edits are preserved during background query refreshes.
- Browser unload and internal route navigation warn before discarding dirty settings.
- Removed dead ranking, slider, problem-size, and ranking-to-weight code.
- English and Dari feature catalogs have parity and no longer advertise removed objectives.

### Solver correctness

- Every exposed objective now contributes a real CP-SAT penalty when its strength is non-zero.
- Removed old registry soft constraints, strategy-specific objective lists, and penalty budgets. There is one objective implementation.
- Strategy auto-selection now uses Thorough for small schools, Balanced for medium schools, and Fast for large schools, while preserving the same objective set.
- Teacher and class gaps measure actual empty usable slots between lessons.
- Load balance uses available teaching days rather than a fixed school-wide divisor.
- Morning/afternoon cutoffs use each day's effective period count.
- Preferred-colleague alignment ignores slots where either teacher is unavailable.
- Room stability minimizes distinct rooms rather than comparing only consecutive requests.
- Home-room, teacher-room, and desired-feature penalties use the room actually selected by CP-SAT.
- Per-request start domains are retained independently. A shorter remainder request can use valid starts that a longer block cannot use.
- Manual split allocations are exact hard equalities and generated lessons are marked fixed accordingly.
- Consecutive-period counting uses actual periods, including multi-period blocks.
- Pre-solve analysis reports an actionable blocking error when a weekly requirement cannot fit under the selected daily consecutive rule.

### Quality reporting and reload behavior

- Quality scoring measures the same twelve objectives with violation units, opportunity units, satisfaction percentage, strength, and affected entities.
- The overall score is weighted by the user's effective profile.
- Suggestions are selected from the highest-impact unsatisfied objectives and include localization keys, fallback Dari/English text, parameters, and affected entities.
- The effective profile, revision, detailed quality result, and overall score are stored inside the saved timetable data.
- The web schedule normalizer preserves this optimization metadata after reload instead of dropping it.
- Legacy four-metric quality fields remain temporarily for compatibility.

## Verification completed

- API build: passed.
- API integration tests: 19/19 passed.
- Web TypeScript check: passed.
- Web ESLint: passed with zero warnings.
- Web unit tests: 25/25 passed.
- Solver Python compilation: passed.
- Solver CP-SAT/unit suite in `packages/solver/.venv`: 27/27 passed.
- Repository diff whitespace validation: passed.

The solver tests cover exact strength rejection, all enabled-objective reporting, actionable pre-solve failure for an impossible consecutive profile, persisted quality metadata, per-request remainder domains, room objectives, hard teacher allocations, workload limits, category period boundaries, and teacher time preference optimization.

## Operational note

This repository currently uses the null/default school ID as the active school because the application has no school-selection context. The endpoint and storage contracts already accept an explicit `schoolId`, so introducing multi-school selection later does not require another optimization-profile redesign.
