---
type: "query"
date: "2026-07-16T12:54:12.220641+00:00"
question: "Resolve the five assignment domain decisions from the Afghanistan school production description"
contributor: "graphify"
outcome: "corrected"
correction: "Correct ASG-003 guidance: do not reject or promote allowed-only assignments. Remove or redefine restrictToPrimarySubjects so allowed subjects remain solver-eligible at lower priority. Correct ASG-013: grades 1-3 single-teacher classes bypass primary/allowed capability constraints, while non-single classes require classTeacherId to have an actual assignment in the class."
source_nodes: ["Teacher", "AssignmentDrawerV2.tsx", "solver.ts", "assignmentCommand.service.ts"]
---

# Q: Resolve the five assignment domain decisions from the Afghanistan school production description

## Answer

Expanded from original query via graph vocabulary: [allowed, assignment, capability, class, compatibility, period, primary, requirement, route, single, solver, teacher]. Production rules resolved: explicit headteacher teacher-class-subject assignments are hard solver locks; primary capability is preferred and allowed capability remains eligible without promotion; grades 1-3 use one class teacher for every subject and bypass subject capability checks; for other grades the class teacher is a homeroom role but must actually teach at least one weekly lesson in that class; split-enabled requirements should default to remaining periods while allowing a smaller positive allocation; repository search finds no live web consumers of compatibility POST/PUT/DELETE, so legacy writes can be disabled now if no out-of-repository client exists, while compatibility reads remain temporarily.

## Outcome

- Signal: corrected
- Correction: Correct ASG-003 guidance: do not reject or promote allowed-only assignments. Remove or redefine restrictToPrimarySubjects so allowed subjects remain solver-eligible at lower priority. Correct ASG-013: grades 1-3 single-teacher classes bypass primary/allowed capability constraints, while non-single classes require classTeacherId to have an actual assignment in the class.

## Source Nodes

- Teacher
- AssignmentDrawerV2.tsx
- solver.ts
- assignmentCommand.service.ts