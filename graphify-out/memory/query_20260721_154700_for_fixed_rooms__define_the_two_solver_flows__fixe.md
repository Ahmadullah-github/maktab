---
type: "query"
date: "2026-07-21T15:47:00.941572+00:00"
question: "For fixed rooms, define the two solver flows: fixed classes ignore every room setting/preference; non-fixed classes retain normal room validation."
contributor: "graphify"
outcome: "corrected"
correction: "A fixed class must also ignore room capacity, room availability, required features, desired features, teacher room preferences, subject room preferences, and other room-related scoring; only room existence, exact fixed-room assignment, and room collision integrity remain."
source_nodes: ["ClassGroup", "TimetableSolver", "SolverDataTransformerService", "SwapConstraintGatherer", "Room"]
---

# Q: For fixed rooms, define the two solver flows: fixed classes ignore every room setting/preference; non-fixed classes retain normal room validation.

## Answer

Expanded via graph vocab: [fixed, room, override, availability, capacity, features, preference, teacher, subject, class, validation, solver]. Corrected policy: fixedRoomId is an administrative override. For a fixed class, force every lesson to that room while ignoring room type, capacity, minRoomCapacity, required and desired features, room unavailable slots, class home-room preference, teacher preferred rooms, and room-change preference/quality penalties. Keep selected-room existence, exact fixed-room matching, room no-overlap, and all non-room constraints. For non-fixed classes, preserve all existing hard compatibility/availability checks and soft room preferences. Apply the branch consistently in TimetableSolver domain construction and resource-start pairs, PreSolveAnalyzer, generated timetable validation, SwapConstraintGatherer and SwapValidator, web swap checks, and QualityScorer. This corrects the prior result that suggested retaining capacity and availability for fixed rooms.

## Outcome

- Signal: corrected
- Correction: A fixed class must also ignore room capacity, room availability, required features, desired features, teacher room preferences, subject room preferences, and other room-related scoring; only room existence, exact fixed-room assignment, and room collision integrity remain.

## Source Nodes

- ClassGroup
- TimetableSolver
- SolverDataTransformerService
- SwapConstraintGatherer
- Room