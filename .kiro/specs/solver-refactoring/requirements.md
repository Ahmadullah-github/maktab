# Requirements Document

## Introduction

This specification defines the requirements for refactoring the Timetable Solver (`packages/solver`) from a monolithic 3000+ line file into a modular, maintainable architecture. The refactoring aims to improve code organization, enable parallel solving for large problems (756+ lessons/week), add configuration file support, implement a constraint plugin system, and enhance DevOps capabilities including containerization and queue-based architecture.

The current solver is production-ready but suffers from maintainability issues due to its monolithic structure. This refactoring will preserve all existing functionality while enabling better scalability, testability, and extensibility.

## Glossary

- **Solver**: The Python-based constraint satisfaction solver using Google OR-Tools CP-SAT
- **CP-SAT**: Constraint Programming with Boolean Satisfiability solver from Google OR-Tools
- **Decomposition**: Breaking large problems into smaller sub-problems that can be solved independently
- **Cluster**: A group of related classes that share teachers, solved as a unit during decomposition
- **Strategy**: A solving approach (Fast/Balanced/Thorough) with different worker counts and constraint levels
- **Hard Constraint**: A constraint that must always be satisfied (e.g., no teacher overlap)
- **Soft Constraint**: A constraint that is optimized but can be violated (e.g., prefer morning for difficult subjects)
- **Constraint Budget**: A limit on penalty variables to prevent memory explosion
- **Checkpoint**: A saved solver state that enables pause/resume functionality
- **Lesson Request**: A single lesson that needs to be scheduled (class + subject + teacher + room + time)

## Requirements

### Requirement 1: Modular Solver Architecture

**User Story:** As a developer, I want the solver code organized into logical modules, so that I can easily navigate, maintain, and extend the codebase.

#### Acceptance Criteria

1. WHEN the solver package is structured THEN the Solver SHALL organize code into `core/`, `constraints/`, `validation/`, and `models/` directories
2. WHEN a developer needs to modify variable creation logic THEN the Solver SHALL provide a dedicated `core/variables.py` module containing all variable creation functions
3. WHEN a developer needs to modify solution building logic THEN the Solver SHALL provide a dedicated `core/solution_builder.py` module containing solution construction functions
4. WHEN hard constraints are modified THEN the Solver SHALL provide individual constraint modules under `constraints/hard/` for no_overlap, same_day, and consecutive constraints
5. WHEN soft constraints are modified THEN the Solver SHALL provide individual constraint modules under `constraints/soft/` for morning_difficult, teacher_gaps, and subject_spread constraints
6. WHEN validation logic is modified THEN the Solver SHALL provide dedicated modules under `validation/` for period_config, teacher_availability, and subject_references validation
7. WHEN data models are accessed THEN the Solver SHALL provide `models/input.py` for input data models and `models/output.py` for output data models
8. WHEN the refactored solver is executed THEN the Solver SHALL produce identical output to the current monolithic solver for the same input

### Requirement 2: Constraint Plugin System

**User Story:** As a developer, I want to register and apply constraints through a plugin system, so that I can add new constraints without modifying the core solver code.

#### Acceptance Criteria

1. WHEN a new constraint is created THEN the Solver SHALL allow registration via a `ConstraintRegistry.register(constraint)` method
2. WHEN constraints are applied THEN the Solver SHALL apply all registered constraints for a given stage via `ConstraintRegistry.apply_all(model, context, stage)` method
3. WHEN a constraint is registered THEN the Solver SHALL categorize the constraint by type (hard/soft) and priority (CRITICAL/HIGH/MEDIUM/LOW)
4. WHEN the solver runs THEN the Solver SHALL apply constraints in the correct order based on their stage (ESSENTIAL, IMPORTANT, OPTIONAL)
5. WHEN a custom constraint is added THEN the Solver SHALL not require modifications to existing constraint files

### Requirement 3: Configuration File Support

**User Story:** As a system administrator, I want to configure solver parameters via a YAML file, so that I can tune performance without modifying code.

#### Acceptance Criteria

1. WHEN the solver starts THEN the Solver SHALL load configuration from `solver_config.yaml` if present
2. WHEN decomposition thresholds are configured THEN the Solver SHALL use the configured values for threshold (default 200), large_threshold (default 250), and very_large_threshold (default 400)
3. WHEN strategy parameters are configured THEN the Solver SHALL use configured workers, max_time, probing_level, and linearization_level for each strategy
4. WHEN constraint budgets are configured THEN the Solver SHALL use configured max_penalty_vars for small (5000), medium (2000), and large (1000) problems
5. WHEN no configuration file exists THEN the Solver SHALL use sensible default values
6. WHEN configuration is serialized THEN the Solver SHALL produce valid YAML that can be parsed back to equivalent configuration

### Requirement 4: Parallel Sub-Problem Solving

**User Story:** As a school administrator with a large school (756+ lessons/week), I want the solver to solve sub-problems in parallel, so that I can get results faster.

#### Acceptance Criteria

1. WHEN decomposition creates multiple clusters THEN the Solver SHALL solve clusters in parallel using ProcessPoolExecutor
2. WHEN parallel solving is enabled THEN the Solver SHALL use a configurable number of workers (default: CPU count - 1)
3. WHEN a cluster fails during parallel solving THEN the Solver SHALL continue solving other clusters and report the failure
4. WHEN all clusters complete THEN the Solver SHALL merge solutions and verify no conflicts exist
5. WHEN parallel solving completes THEN the Solver SHALL achieve at least 2x speedup compared to sequential solving for problems with 4+ clusters

### Requirement 5: Checkpoint and Resume Capability

**User Story:** As a user running long solves, I want to pause and resume solving, so that I can interrupt the process without losing progress.

#### Acceptance Criteria

1. WHEN a solve is in progress THEN the Solver SHALL save checkpoints after each cluster completion
2. WHEN a checkpoint is saved THEN the Solver SHALL persist input data, partial solution, completed clusters, and pending clusters
3. WHEN a solve is resumed THEN the Solver SHALL load the checkpoint and continue from where it stopped
4. WHEN a solve completes successfully THEN the Solver SHALL delete the checkpoint file
5. WHEN a checkpoint is loaded THEN the Solver SHALL validate that the checkpoint data matches the current input schema

### Requirement 6: Memory Management

**User Story:** As a desktop application user, I want the solver to manage memory efficiently, so that it runs reliably on machines with limited RAM.

#### Acceptance Criteria

1. WHEN the solver starts THEN the Solver SHALL accept a configurable maximum memory limit (default 4096 MB)
2. WHEN memory usage approaches 90% of the limit THEN the Solver SHALL trigger garbage collection
3. WHEN memory usage exceeds the limit THEN the Solver SHALL raise a MemoryError with diagnostic information
4. WHEN variables are created THEN the Solver SHALL reuse shared variable pools where possible to reduce memory consumption
5. WHEN solving large problems THEN the Solver SHALL maintain memory usage below 2GB for problems up to 756 lessons

### Requirement 7: Containerization

**User Story:** As a DevOps engineer, I want the solver containerized, so that I can deploy it consistently across environments.

#### Acceptance Criteria

1. WHEN the solver is built THEN the Solver SHALL produce a Docker image based on python:3.12-slim
2. WHEN the container runs THEN the Solver SHALL include a health check that validates the solver can be imported
3. WHEN the container is deployed THEN the Solver SHALL respect resource limits for CPU and memory
4. WHEN environment variables are set THEN the Solver SHALL use SOLVER_MAX_MEMORY_MB and SOLVER_MAX_TIME_SECONDS to configure limits

### Requirement 8: Queue-Based Architecture Support

**User Story:** As a system architect, I want the solver to support queue-based job processing, so that I can scale horizontally and handle multiple concurrent requests.

#### Acceptance Criteria

1. WHEN a solve request is received THEN the Solver SHALL accept jobs from a Redis queue
2. WHEN a job is processed THEN the Solver SHALL store results in a configurable results store
3. WHEN a job fails THEN the Solver SHALL support configurable retry logic
4. WHEN multiple workers are deployed THEN the Solver SHALL process jobs independently without conflicts

### Requirement 9: Metrics Export

**User Story:** As a system operator, I want the solver to export metrics, so that I can monitor performance and health.

#### Acceptance Criteria

1. WHEN the solver runs THEN the Solver SHALL export solve_duration_seconds as a Histogram metric
2. WHEN constraints are applied THEN the Solver SHALL export constraints_applied_total as a Counter metric
3. WHEN a solution is found THEN the Solver SHALL export solution_quality_score as a Gauge metric
4. WHEN metrics are requested THEN the Solver SHALL expose metrics in Prometheus format

### Requirement 10: Property-Based Testing

**User Story:** As a developer, I want property-based tests for critical functions, so that I can verify correctness across a wide range of inputs.

#### Acceptance Criteria

1. WHEN grade category is determined THEN the Solver SHALL always return a valid category ("Alpha-Primary", "Beta-Primary", "Middle", "High") for grades 1-12
2. WHEN configuration is serialized and deserialized THEN the Solver SHALL produce an equivalent configuration object
3. WHEN constraints are applied THEN the Solver SHALL never produce a solution that violates hard constraints
4. WHEN decomposition creates clusters THEN the Solver SHALL ensure every lesson appears in exactly one cluster

