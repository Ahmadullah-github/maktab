---
type: "query"
date: "2026-07-19T06:37:37.871930+00:00"
question: "http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???"
contributor: "graphify"
outcome: "useful"
source_nodes: ["classes-schedule.tsx", "teachers-schedule.tsx", "scheduleStore.ts", "api.ts", "ClassScheduleView.tsx", "TeacherScheduleView.tsx"]
---

# Q: http://localhost:5173/classes-schedule http://localhost:5173/teachers-schedule when accessing to these from browser it dont works correctly???

## Answer

Expanded from original query via graph vocabulary: [classes, teachers, route, schedule, timetable, api, summaries, storage, current]. The route loader one-shot ref conflicted with React Strict Mode effect replay: the first request was cancelled during cleanup and the replay was blocked, so navigation and detail loading never happened. Removing that ref lets the replay reuse the cached summaries promise and navigate once. A second issue in period integrity treated an empty category override map as authoritative; falling back to periodsPerDayMap removes the false invalid-period lockout.

## Outcome

- Signal: useful

## Source Nodes

- classes-schedule.tsx
- teachers-schedule.tsx
- scheduleStore.ts
- api.ts
- ClassScheduleView.tsx
- TeacherScheduleView.tsx