---
type: "query"
date: "2026-07-21T15:35:49.107512+00:00"
question: "Why i cant lock the room for classes?? when a room is locked to a class it means that all room types will be ignored. How you can analyze this one please???"
contributor: "graphify"
outcome: "useful"
source_nodes: ["RoomSelector.tsx", "ClassGroup", "SolverDataTransformerService", "TimetableSolver", "Room"]
---

# Q: Why i cant lock the room for classes?? when a room is locked to a class it means that all room types will be ignored. How you can analyze this one please???

## Answer

Expanded from original query via graph vocab: [room, selector, class, lock, fixed, disabled, type, requirement, constraint, assignment, preference, timetable]. Diagnosis: RoomSelector is not disabled by the class panel; it stays open after selection and the choice is only local until Save is clicked. More importantly, TimetableSolver checks fixed rooms with is_room_compatible, which still enforces subject requiredRoomType, capacity, and required features before locking the domain. Current class 7 uses normal, physics_lab, chemistry_lab, and biology_lab subjects, so no one room can pass all types, and chemistry_lab has no room. PreSolveAnalyzer also checks missing types globally, while generated timetable and swap validators still enforce type matching. The intended override must be implemented consistently across solver domain creation, pre-solve analysis, generated-output validation, and swap validation; keep existence, capacity, availability, and collision rules unless product policy says otherwise.

## Outcome

- Signal: useful

## Source Nodes

- RoomSelector.tsx
- ClassGroup
- SolverDataTransformerService
- TimetableSolver
- Room