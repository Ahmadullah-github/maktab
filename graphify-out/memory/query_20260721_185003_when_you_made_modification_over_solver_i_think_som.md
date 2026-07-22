---
type: "query"
date: "2026-07-21T18:50:03.916226+00:00"
question: "when you made modification over solver i think somewhere you made a mistake or your code had a bug. can you review just solver"
contributor: "graphify"
outcome: "corrected"
correction: "The prior end-to-end claim was too broad. Generated solver requests are correct, but fixedLessons and fixed-class stale homeRoomId were not covered and violate the fixed/non-fixed room contract."
source_nodes: ["TimetableSolver", "TimetableData", "QualityScorer", "SwapValidator"]
---

# Q: when you made modification over solver i think somewhere you made a mistake or your code had a bug. can you review just solver

## Answer

Expanded from graph vocabulary: [solver, fixed, room, domain, availability, compatibility, capacity, feature, preference, quality, swap, conflict]. Solver-only review found the generated-request fixed-room path correct: it fixes the room domain, bypasses room metadata/availability, skips room preferences, and retains NoOverlap. However, the implementation is incomplete for fixedLessons: input validation does not enforce or normalize class fixedRoomId, fixed intervals use lesson.roomId, and solution output copies lesson.roomId, so fixed-room classes can succeed with a wrong or null room and lose room-collision integrity. Non-fixed fixedLessons also bypass availability/type/capacity/features and can succeed in unavailable rooms. Additionally, an unknown homeRoomId still blocks a fixed-room class even though home-room preference should be ignored. Full suite passes 40 tests, showing missing coverage; adversarial checks reproduced all three failures. No solver files were edited during review.

## Outcome

- Signal: corrected
- Correction: The prior end-to-end claim was too broad. Generated solver requests are correct, but fixedLessons and fixed-class stale homeRoomId were not covered and violate the fixed/non-fixed room contract.

## Source Nodes

- TimetableSolver
- TimetableData
- QualityScorer
- SwapValidator