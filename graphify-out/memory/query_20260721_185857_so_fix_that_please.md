---
type: "query"
date: "2026-07-21T18:58:57.942718+00:00"
question: "so fix that please"
contributor: "graphify"
outcome: "useful"
source_nodes: ["solver.py", "TimetableData", "FixedLesson", "Room"]
---

# Q: so fix that please

## Answer

Expanded from original query via graph vocab: [solver, fixed, lesson, room, availability, compatibility, capacity, feature, preference, collision, interval, class]. Fixed the Python solver so class fixedRoomId is authoritative for fixedLessons in validation, collision intervals, successful output, and partial output. Fixed classes ignore stale home-room and fixed-lesson room preferences plus room availability and compatibility metadata, while non-fixed fixedLessons require an existing room and validate capacity, type, required features, and availability. Added regression tests; full solver suite passes 45 tests plus 3 subtests.

## Outcome

- Signal: useful

## Source Nodes

- solver.py
- TimetableData
- FixedLesson
- Room