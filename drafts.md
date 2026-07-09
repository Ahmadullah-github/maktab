# Per-Class Subject Period Overrides

## Summary

- Make `ClassGroup.subjectRequirements[].periodsPerWeek` the only authoritative
  required-period value for scheduling, validation, workload, coverage, and
  assignment behavior.
- Keep `Subject.periodsPerWeek` as a default only. Use it when seeding a new
  class, applying curriculum to a class, or adding a new subject requirement
  from the Class editor.
- Do not introduce inheritance tracking or an override flag. A class requirement
  is a stored value, not a live link to the subject default.
- Editing a subject default does not retroactively change existing classes. The
  only explicit overwrite path remains the existing curriculum/apply flow when
  the user chooses it.
- Per-class period editing is available only from the Class editor. Subject and
  teacher/assignment screens must display and respect those values, but not edit
  them.

## Implementation Changes

- Backend data semantics:
  - Treat assignment routes as assignments to existing class-subject
    requirements only.
  - Stop letting assignment flows implicitly create or redefine a class’s
    subject requirement.
  - If a target class does not already require the subject, return a validation
    error and direct the user to add that subject in the Class editor first.
- Backend API and types:
  - Update assignment request contracts so `periodsPerWeek` is no longer a
    required input for `validate` and `assign`.
  - Keep the field temporarily accepted but ignored on the server for
    compatibility during rollout.
  - Derive required periods per class from `ClassGroup.subjectRequirements`
    inside validation, workload impact, and persistence logic.
- Assignment service behavior:
  - Replace all `classIds.length * periodsPerWeek` logic with per-class
    aggregation from class requirements.
  - Persist `TeacherClassSubjectAssignment.periodsPerWeek` using each class’s
    own required periods for single-teacher assignments.
  - Keep dual-write behavior for `teacher.classAssignments` and
    `subjectRequirements[].teacherId` for now, but make them compatibility
    outputs rather than read-side sources of truth.
- Coverage and analysis:
  - Standardize read-side behavior so required periods come from class
    requirements and actual assignment state comes from
    `TeacherClassSubjectAssignment`.
  - Remove reliance on `Subject.periodsPerWeek` for existing-class calculations
    except as a defensive fallback for malformed legacy records.
  - Align backend subject coverage logic with the frontend’s newer
    assignment-table-based behavior.
- Frontend behavior:
  - Keep the Class editor and `SubjectRequirementsEditor` as the canonical place
    to change per-class periods.
  - When adding a subject requirement to a class, prefill from the subject
    default and let the admin override immediately.
  - Update subject UI copy so `periodsPerWeek` is labeled as “default
    periods/week” and described as the seed value for classes.
  - Update subject coverage, teacher assignment matrix, quick assignment, and
    related workload previews to always read each selected class’s own
    requirement instead of reusing the first class’s value or the subject
    default.
  - Keep batch assignment UX, but send only teacher/subject/class targets and
    let the server compute per-class periods.
- Solver and validation:
  - No schema redesign is needed for solver input; it already consumes
    class-specific subject requirements.
  - Update comments, validation messages, and any helper logic so the system
    consistently describes subject periods as defaults and class requirements as
    actual weekly demand.

## Test Plan

- Create a subject with default `3`, apply/populate it into multiple classes,
  then override one class to `2` and another to `4`; verify each class keeps its
  own value and no sibling class changes.
- Change the subject default after classes already exist; verify existing
  classes keep their stored values and only newly populated classes receive the
  new default.
- Batch-assign a teacher to multiple classes of the same subject where each
  class has different required periods; verify validation, workload preview,
  persisted assignment rows, and coverage all use per-class values.
- Attempt assignment for a class that does not have that subject requirement;
  verify the request is rejected and no implicit requirement is created.
- Run schedule validation/generation with mixed overrides; verify
  over-allocation, empty-period, and teacher-load calculations reflect
  class-specific totals.
- Verify subject coverage, teacher assignment matrix, and quick assignment
  screens all display the same per-class period counts for the same
  class-subject pair.

## Assumptions

- No database migration is required because the existing class requirement model
  already stores per-class `periodsPerWeek`.
- No new standalone override screen is added; the Class editor remains the only
  editing surface.
- Partial multi-teacher period splitting is not expanded by this change.
  Existing single-teacher assignment behavior remains intact for the main
  assignment routes.
- Legacy fields such as `teacher.classAssignments` and
  `subjectRequirements[].teacherId` stay in place for compatibility in this
  implementation and can be cleaned up separately later.
