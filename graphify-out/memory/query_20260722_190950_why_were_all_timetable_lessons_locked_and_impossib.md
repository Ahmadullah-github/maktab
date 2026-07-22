---
type: "debugging"
date: "2026-07-22T19:09:50.337439+00:00"
question: "Why were all timetable lessons locked and impossible to swap, and why did lock icons obscure cell information?"
contributor: "graphify"
outcome: "corrected"
correction: "Fixed teacher assignments constrain teacher selection only; only fixedLessons constrain a lesson's timetable day and period."
source_nodes: ["TimetableSolver", "ScheduledLesson", "ScheduleGrid", "SwapConstraintGatherer", "scheduleTransformer"]
---

# Q: Why were all timetable lessons locked and impossible to swap, and why did lock icons obscure cell information?

## Answer

Expanded vocabulary: fixed, lesson, schedule, grid, cell, lock, swap, solver, assignment, timetable. The solver incorrectly mapped fixed teacher assignments to ScheduledLesson.isFixed, making every lesson immovable. Only explicit fixedLessons represent fixed timetable positions. Generated lessons now remain movable, solver output is versioned, legacy all-locked schedules are repaired at API and web boundaries, swap constraint gathering uses the repaired representation, and genuinely fixed cells reserve space for the lock badge.

## Outcome

- Signal: corrected
- Correction: Fixed teacher assignments constrain teacher selection only; only fixedLessons constrain a lesson's timetable day and period.

## Source Nodes

- TimetableSolver
- ScheduledLesson
- ScheduleGrid
- SwapConstraintGatherer
- scheduleTransformer