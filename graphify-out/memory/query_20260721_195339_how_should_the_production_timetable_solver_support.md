---
type: "query"
date: "2026-07-21T19:53:39.212333+00:00"
question: "How should the production timetable solver support 30 classes on low-resource computers: fewer workers with 15-20 minutes, decomposition, and best-solution expectations?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["DecompositionSolver", "TimetableSolver", "StrategySelector"]
---

# Q: How should the production timetable solver support 30 classes on low-resource computers: fewer workers with 15-20 minutes, decomposition, and best-solution expectations?

## Answer

Expanded from original query via graph vocabulary: solver, optimization, objective, decomposition, performance, resource, workers, timeout, feasible, optimal, classes, constraints. Recommended architecture: guarantee hard-constraint validity, find and persist an initial feasible solution, then improve the incumbent asynchronously for an adaptive 15-20 minute budget. A finite timeout can promise best-known, not globally optimal, unless CP-SAT proves OPTIMAL; expose objective bound/gap. Use hardware-aware workers rather than 16 fixed workers. Apply exact decomposition only to independent components determined by shared teachers, scarce rooms, and cross-class constraints; otherwise use decomposition for initial construction plus global repair and large-neighborhood optimization. Reduce the model first by compiling fixed assignments, shrinking domains, symmetry breaking, and building only enabled objectives. Current legacy decomposition is disabled at the canonical entrypoint due incompatible response contracts, so it must be redesigned and benchmarked rather than merely switched on.

## Outcome

- Signal: useful

## Source Nodes

- DecompositionSolver
- TimetableSolver
- StrategySelector