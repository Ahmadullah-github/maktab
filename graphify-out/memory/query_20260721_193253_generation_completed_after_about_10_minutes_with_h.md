---
type: "query"
date: "2026-07-21T19:32:53.677106+00:00"
question: "Generation completed after about 10 minutes with HTTP 200 and saved timetable, but the UI reported an unrecognizable server response while all CPUs were saturated."
contributor: "graphify"
outcome: "useful"
source_nodes: ["parseSolverResponse()", "useGenerateSchedule.ts", "operation_contract.py", "Timetable"]
---

# Q: Generation completed after about 10 minutes with HTTP 200 and saved timetable, but the UI reported an unrecognizable server response while all CPUs were saturated.

## Answer

Expanded from original query via graph vocab: [generate, schedule, solver, response, parse, timeout, request, fetch, api, abort, status, timetable]. The server succeeded and persisted timetable id 3 with 204 entries under the canonical schedule field. The web parseSolverResponse boundary incorrectly required lessons and also rejected language-neutral quality suggestions after the solver contract stripped presentation prose. Fixed the web validator to accept schedule and compatible suggestions, added localized client fallbacks, and retained stable suggestion codes and translation parameters in solver serialization. Thorough CPU saturation is expected from parallel CP-SAT search at its 600-second optimization limit; low-resource mode limits it to two workers and first-feasible search.

## Outcome

- Signal: useful

## Source Nodes

- parseSolverResponse()
- useGenerateSchedule.ts
- operation_contract.py
- Timetable