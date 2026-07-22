---
type: "query"
date: "2026-07-21T19:42:30.388395+00:00"
question: "Analyze whether the timetable solver is usable for Afghanistan schools with around 30 classes on typical Core i5/i7 computers with 8 or 16 GB RAM, given that six classes used all CPUs for about nine minutes. Do not change code."
contributor: "graphify"
outcome: "useful"
source_nodes: ["TimetableSolver", "DecompositionSolver", "StrategySelector.tsx", "LowResourceModeCard.tsx", "MemoryManager"]
---

# Q: Analyze whether the timetable solver is usable for Afghanistan schools with around 30 classes on typical Core i5/i7 computers with 8 or 16 GB RAM, given that six classes used all CPUs for about nine minutes. Do not change code.

## Answer

Expanded from original query via graph vocab: [solver, strategy, workers, classes, schedule, constraints, performance, resource, memory, decomposition, requests, variables]. Analysis found the current six-class database already represents 204 individual requests and exactly fills 34 weekly slots per class. A comparable 30-class school would produce about 1,020 requests, with combinatorial rather than linear growth. The actual machine is a 4-core/8-thread i7-7820HQ with 16 GB RAM. Thorough requests 16 workers for 600 seconds, balanced 8 for 600, and fast 4 for up to 300. The UI always sends an explicit strategy, bypassing automatic large-problem selection; per-strategy should_use_for_problem guards are unused. Decomposition was designed for 200-plus requests but is explicitly disabled because its output contract is incompatible. Fixed teachers and fixed rooms remain modeled through decision variables and exact-count constraints instead of being compiled to constants. MemoryManager and VariableManager optimizations are not integrated into TimetableSolver, normal mode has no memory cap, and no 30-class scale benchmark exists. Low-resource mode limits the solver to two workers and the first feasible solution, helping responsiveness but not solving model scalability. Verdict: the current release is bounded by timeouts and may run, but is not production-proven or reliably usable for 30 classes on the target hardware. Required direction is benchmarked adaptive first-feasible generation, CPU-aware worker caps, optional improvement, compiling fixed decisions, restoring safe teacher-connected decomposition, and real memory/model safeguards.

## Outcome

- Signal: useful

## Source Nodes

- TimetableSolver
- DecompositionSolver
- StrategySelector.tsx
- LowResourceModeCard.tsx
- MemoryManager