# Examinations, Grades, Results, and Question Bank

**Module prefix:** `EXM`  
**Current status:** Discovery  
**Primary owners:** Head teacher, examination office, authorized teachers

## Objective

Manage examination planning, controlled mark entry, result calculation/approval/publication, official school tables, eligibility lists, and a secure question bank.

## Requirements

| ID | Requirement |
|---|---|
| EXM-001 | Configure assessment schemes by grade/program/subject/period with components, maximums, weights, pass/eligibility rules, and rounding. |
| EXM-002 | Create exam sessions, exams, dates/periods, rooms, invigilators, eligible students, and conflict-checked exam timetables. |
| EXM-003 | Generate versioned exam cards and approved A4 schedules. |
| EXM-004 | Enter marks in controlled batches/شقه after the exact form is confirmed, with validation, save/submit/lock states, and attribution. |
| EXM-005 | Calculate totals, percentages, grades, rank/comparison if approved, pass/fail, deprived, temporary/سویه, and progression using versioned rules. |
| EXM-006 | Require review/approval before results are official or visible to guardians/students. |
| EXM-007 | Correct published results only through a reasoned approval workflow retaining old/new values and regenerated documents. |
| EXM-008 | Generate result notifications and official tables for grades 1–9, grades 10–12, and three-year marks using real approved samples. |
| EXM-009 | Produce deprived, pass, fail, temporary/level, missing-mark, and exception lists with explainable criteria. |
| EXM-010 | Maintain a versioned multilingual question bank with subject, level, topic, difficulty, answer/rubric, author, review, and access classification. |
| EXM-011 | Create question groups/papers and register students into groups where required, with controlled randomization/export and leakage audit. |
| EXM-012 | Provide authorized analysis/charts by student, class, subject, teacher, and period while protecting child data. |

## Main workflows

### Exam cycle

Configure scheme/session → schedule exams/rooms/invigilation → determine eligibility → issue cards → enter marks → validate missing/outlier data → submit and lock batches → calculate results → review/approve → publish → notify/print → handle controlled corrections.

### Question lifecycle

Draft → peer review → approved → available for controlled selection → used/retired. Export of confidential questions is logged; permissions separate authoring, review, paper generation, and final reveal.

## Core entities

`AssessmentScheme`, `GradeScale`, `ExamSession`, `Exam`, `ExamTimetableEntry`, `ExamEligibility`, `ExamCard`, `Assessment`, `GradeEntryBatch`, `Result`, `ResultCalculationRun`, `ResultApproval`, `ResultPublication`, `ResultCorrection`, `QuestionBankItem`, `QuestionVersion`, `QuestionGroup`, `ExamPaper`.

## Invariants

- Scores cannot exceed configured bounds without an explicit permitted exception.
- Calculation records the exact scheme/rule version and source mark versions.
- Locked/submitted batches reject normal edits.
- Published results are versioned evidence; correction never erases prior value.
- A teacher enters only assigned assessments unless delegated.
- Question content is not exposed through logs, broad search, or normal teacher access.

## Acceptance criteria

- Recalculation with identical inputs/rules is deterministic.
- Missing/invalid marks prevent approval or appear as explicitly approved exceptions.
- Portal visibility begins only after publication and follows guardian relationship scope.
- A result correction shows original/new value, reason, approvals, and affected regenerated documents.
- Exam timetable detects student, room, and invigilator conflicts.
- Official outputs match signed school samples exactly enough for operational acceptance.

## Open questions

- Definitions/samples for شقه, deprived, temporary/سویه, percentage/ranking, three-year table, and grade-specific official formats.
- Whether ranking/top-student comparison is permitted and how ties/absences are handled.
- Question group/student grouping purpose and security level.
- Mark-entry approval chain and appeal process.

## Implementation tracker

- [ ] Collect all grade/exam/result/form samples
- [ ] Approve assessment/calculation and correction rules
- [ ] Design exam, grade batch, result version, and question security model
- [ ] Implement scheduling/cards/eligibility
- [ ] Implement mark entry, locking, validation, approval, publication
- [ ] Implement official outputs and portal visibility
- [ ] Implement question lifecycle and confidential export controls
- [ ] Add deterministic calculation and correction tests
- [ ] Pilot a complete exam period
- [ ] Mark Released

