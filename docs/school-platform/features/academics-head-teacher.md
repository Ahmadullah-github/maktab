# Academic Structure and Head-Teacher Administration

**Module prefix:** `ACD`  
**Current status:** Discovery; core academic structure is partially present in the current scheduler  
**Primary owners:** Head teacher, school academic leadership

## Objective

Define the academic calendar and structure that scheduling, enrollment, attendance, exams, grading, and reporting share, then provide head-teacher oversight workflows.

## Requirements

| ID | Requirement |
|---|---|
| ACD-001 | Configure academic years, terms/reporting periods, school days, holidays, shifts, and status/locking. |
| ACD-002 | Configure grade/level/program, class groups/sections without an arbitrary product limit, subjects, rooms, periods, and capacity metadata. |
| ACD-003 | Assign class teachers, subject teachers, department responsibility, and effective dates/workload. |
| ACD-004 | Maintain subject curriculum/requirements and lesson or teaching plans linked to period/class/teacher. |
| ACD-005 | Maintain student grouping/zoning tables after `جدول زمره بندی` meaning is confirmed. |
| ACD-006 | Provide academic dashboards for enrollment, attendance, results, outstanding entry, teacher workload, and risk indicators. |
| ACD-007 | Analyze marks by student, class, subject, term, and cohort; compare top students only using approved, explainable criteria. |
| ACD-008 | Produce grade charts/statistical student reports without exposing restricted individual data to unauthorized viewers. |
| ACD-009 | Support year rollover by creating a new structure and proposed promotions/placements without rewriting the prior year. |
| ACD-010 | Lock completed academic periods and require approved correction/reopen workflows. |
| ACD-011 | Link official student rules/eligibility/discipline effects through explicit policies, not manual hidden calculations. |
| ACD-012 | Reuse one canonical academic structure across scheduler, attendance, exams, portals, and reports. |

The implemented offline timetable curriculum workflow is specified separately in
[School Curriculum](school-curriculum.md). It is a local planning source for the scheduler and does
not replace the future cloud-authoritative academic structure described here.

## Main workflows

### Academic year setup

Copy selected prior-year structure → set dates/calendar/holidays → configure levels/classes/subjects/periods → assign teachers/rooms → validate gaps/conflicts → approve and activate. Copying never copies student results or published attendance as new facts.

### Year rollover

Freeze reporting cut-off → calculate proposed status/promotions based on approved rules → review exceptions → create next-year enrollments/class placements → reconcile totals → archive/lock old year while retaining reports.

### Head-teacher oversight

Dashboards link summaries to authorized underlying records. Alerts identify missing attendance/marks, conflicts, deprived candidates, or abnormal trends; they do not automatically punish or label a student.

## Core entities

`AcademicYear`, `Term`, `SchoolCalendar`, `Holiday`, `Shift`, `GradeLevel`, `Program`, `ClassGroup`, `Section`, `Subject`, `Room`, `PeriodDefinition`, `TeacherAssignment`, `CurriculumRequirement`, `LessonPlan`, `AcademicPolicy`, `YearRolloverRun`.

## Invariants

- Dates/terms for an active structure cannot overlap invalidly.
- Classes, assignments, results, and attendance share the same academic-year/unit ownership.
- Period locks block normal mutation; reopen requires permission, reason, and audit.
- Teacher assignment history is preserved.
- Dashboard aggregates use authorized tenant-scoped data and clearly state reporting period/freshness.

## Reports

Class/subject/teacher lists; workload; lesson-plan coverage; mark distributions and comparisons; student statistics; missing academic data; class promotion/retention; academic-year configuration; policy exceptions.

## Acceptance criteria

- One academic setup can feed timetable, attendance, exams, and portal views consistently.
- Activating a new year does not change historical year records.
- Unauthorized users cannot expand a dashboard into restricted student detail.
- Locked periods reject ordinary grade/attendance structure edits.
- Rollover is previewable, idempotent, reconcilable, and reversible before finalization.

## Open questions

- Exact Ministry/school calendar, grade, promotion, deprived, temporary/سویه, and grouping rules.
- Whether multiple shifts/calendars exist within one school unit.
- Official naming and limits for class/section/group.
- Required lesson-plan workflow and approval.

## Implementation tracker

- [ ] Collect calendars, structure, policy, and report samples
- [ ] Map current scheduler entities to cloud academic model
- [ ] Define academic lifecycle, locks, and rollover
- [ ] Implement shared structure APIs and permission scopes
- [ ] Implement dashboards/read models with freshness labels
- [ ] Validate analytics criteria and child privacy
- [ ] Add year rollover reconciliation tests
- [ ] Pilot one full academic setup
- [ ] Mark Released
