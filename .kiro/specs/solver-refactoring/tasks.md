# Implementation Plan

## Phase 1: Core Module Extraction

- [x] 1. Extract data models to `models/` module
  - [x] 1.1 Create `models/input.py` with all Pydantic input models (TimetableData, Teacher, ClassGroup, Subject, Room, etc.)
    - Move all input-related Pydantic models from `solver_enhanced.py`
    - Preserve all validators and model_validators
    - _Requirements: 1.7_
  - [x] 1.2 Create `models/output.py` with output models (ScheduledLesson, SolutionMetadata, SolverOutput)
    - Define output schema for solver results
    - Include metadata and error response models
    - _Requirements: 1.7_
  - [x] 1.3 Write property test for input model serialization round-trip
    - **Property 4: Configuration Round-Trip**
    - **Validates: Requirements 3.6, 10.2**
  - [x] 1.4 Write unit tests for model validation
    - Test validation errors for invalid inputs
    - Test model_validator cross-field validation
    - _Requirements: 1.7_

- [x] 2. Extract validation logic to `validation/` module
  - [x] 2.1 Create `validation/period_config.py` with period configuration validation
    - Extract `validate_period_configuration()` method
    - _Requirements: 1.6_
  - [x] 2.2 Create `validation/teacher_availability.py` with teacher availability validation
    - Extract `validate_teacher_availability_structure()` method
    - _Requirements: 1.6_
  - [x] 2.3 Create `validation/subject_references.py` with subject reference validation
    - Extract `validate_subject_references()` and `validate_custom_subjects()` methods
    - _Requirements: 1.6_
  - [x] 2.4 Write unit tests for validation modules
    - Test each validation function with valid and invalid inputs
    - _Requirements: 1.6_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 2: Constraint System

- [x] 4. Implement constraint registry
  - [x] 4.1 Create `constraints/registry.py` with ConstraintRegistry class
    - Implement singleton pattern
    - Implement `register()`, `unregister()`, `apply_all()`, `get_constraints()` methods
    - Support ConstraintStage enum (ESSENTIAL, IMPORTANT, OPTIONAL)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - [x] 4.2 Write property test for constraint registry completeness
    - **Property 2: Constraint Registry Completeness**
    - **Validates: Requirements 2.2, 2.4**
  - [x] 4.3 Write property test for constraint categorization
    - **Property 3: Constraint Categorization Correctness**
    - **Validates: Requirements 2.3**

- [x] 5. Extract hard constraints to `constraints/hard/`
  - [x] 5.1 Create `constraints/hard/no_overlap.py` with NoClassOverlapConstraint, NoTeacherOverlapConstraint, NoRoomOverlapConstraint
    - Extract no-overlap constraint logic from solver
    - Register with ConstraintRegistry at ESSENTIAL stage
    - _Requirements: 1.4_
  - [x] 5.2 Create `constraints/hard/same_day.py` with SameDayConstraint
    - Extract same-day multi-period constraint logic
    - _Requirements: 1.4_
  - [x] 5.3 Create `constraints/hard/consecutive.py` with ConsecutiveConstraint
    - Extract consecutive period constraint logic
    - _Requirements: 1.4_
  - [x] 5.4 Write property test for hard constraint satisfaction
    - **Property 19: Hard Constraint Satisfaction**
    - **Validates: Requirements 10.3**

- [x] 6. Extract soft constraints to `constraints/soft/`
  - [x] 6.1 Create `constraints/soft/morning_difficult.py` with PreferMorningForDifficultConstraint
    - Extract morning preference logic for difficult subjects
    - _Requirements: 1.5_
  - [x] 6.2 Create `constraints/soft/teacher_gaps.py` with AvoidTeacherGapsConstraint
    - Extract teacher gap minimization logic
    - _Requirements: 1.5_
  - [x] 6.3 Create `constraints/soft/subject_spread.py` with SubjectSpreadConstraint
    - Extract subject spread across days logic
    - _Requirements: 1.5_
  - [x] 6.4 Write unit tests for soft constraints
    - Test penalty variable creation
    - Test weight application
    - _Requirements: 1.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 3: Core Solver Refactoring

- [x] 8. Extract variable creation to `core/variables.py`
  - [x] 8.1 Create VariableManager class with variable creation methods
    - Implement `create_start_variables()`, `create_teacher_variables()`, `create_room_variables()`
    - Implement variable pooling for memory optimization
    - _Requirements: 1.2, 6.4_
  - [x] 8.2 Write property test for variable pool reuse
    - **Property 13: Variable Pool Reuse**
    - **Validates: Requirements 6.4**

- [x] 9. Extract solution building to `core/solution_builder.py`
  - [x] 9.1 Create SolutionBuilder class
    - Implement `build_solution()` method
    - Implement `add_metadata()` method
    - _Requirements: 1.3_
  - [x] 9.2 Write unit tests for solution builder
    - Test solution construction from solver values
    - Test metadata generation
    - _Requirements: 1.3_

- [x] 10. Refactor main solver in `core/solver.py`
  - [x] 10.1 Create refactored TimetableSolver class
    - Use VariableManager for variable creation
    - Use ConstraintRegistry for constraint application
    - Use SolutionBuilder for output construction
    - _Requirements: 1.1, 1.8_
  - [x] 10.2 Write property test for solver output equivalence
    - **Property 1: Solver Output Equivalence**                                                    
    - **Validates: Requirements 1.8**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 4: Configuration System

- [x] 12. Implement configuration system
  - [x] 12.1 Create `config/schema.py` with configuration Pydantic models
    - Define DecompositionConfig, StrategyConfig, MemoryConfig, SolverConfig
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - [x] 12.2 Create `config/loader.py` with ConfigLoader class
    - Implement YAML loading from multiple search paths
    - Implement environment variable overrides
    - Implement `save()` method for serialization
    - _Requirements: 3.1, 3.5_
  - [x] 12.3 Write property test for configuration round-trip
    - **Property 4: Configuration Round-Trip**
    - **Validates: Requirements 3.6, 10.2**
  - [x] 12.4 Write property test for configuration override
    - **Property 5: Configuration Override**
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [x] 12.5 Write property test for environment variable override
    - **Property 14: Environment Variable Override**
    - **Validates: Requirements 7.4**

- [x] 13. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 5: Parallel Execution

- [x] 14. Implement parallel cluster solving
  - [x] 14.1 Create `parallel/executor.py` with ParallelClusterExecutor class
    - Implement ProcessPoolExecutor-based parallel solving
    - Support configurable worker count
    - Handle cluster failures gracefully
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [x] 14.2 Write property test for parallel worker count
    - **Property 6: Parallel Worker Count**
    - **Validates: Requirements 4.2**
  - [x] 14.3 Write property test for parallel failure isolation
    - **Property 7: Parallel Failure Isolation**
    - **Validates: Requirements 4.3**
  - [x] 14.4 Write property test for solution merge correctness
    - **Property 8: Solution Merge Correctness**
    - **Validates: Requirements 4.4**

- [x] 15. Implement checkpoint/resume capability
  - [x] 15.1 Create `parallel/checkpoint.py` with CheckpointManager class
    - Implement `save()`, `load()`, `delete()`, `validate()` methods
    - Use pickle for serialization
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [x] 15.2 Write property test for checkpoint completeness
    - **Property 9: Checkpoint Completeness**
    - **Validates: Requirements 5.1, 5.2**
  - [x] 15.3 Write property test for checkpoint resume correctness
    - **Property 10: Checkpoint Resume Correctness**
    - **Validates: Requirements 5.3**
  - [x] 15.4 Write property test for checkpoint validation
    - **Property 11: Checkpoint Validation**
    - **Validates: Requirements 5.5**

- [x] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 6: Memory Management

- [x] 17. Implement memory management
  - [x] 17.1 Create `memory/manager.py` with MemoryManager class
    - Implement memory limit checking
    - Implement GC triggering at threshold
    - Implement variable pool management
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - [x] 17.2 Write property test for memory limit enforcement
    - **Property 12: Memory Limit Enforcement**
    - **Validates: Requirements 6.1, 6.3**

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 7: Metrics and Queue

- [x] 19. Implement metrics export
  - [x] 19.1 Create `metrics/prometheus.py` with MetricsExporter class
    - Define Histogram, Counter, Gauge metrics
    - Implement recording methods
    - Implement Prometheus format export
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 19.2 Write property test for metrics counter increment
    - **Property 17: Metrics Counter Increment**
    - **Validates: Requirements 9.2**

- [x] 20. Implement queue worker
  - [x] 20.1 Create `job_queue/worker.py` with SolverWorker class
    - Implement Redis queue consumption
    - Implement result storage
    - Implement retry logic
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 20.2 Create `job_queue/job.py` with SolverJob and SolverResult models
    - Define job and result schemas
    - _Requirements: 8.1_
  - [x] 20.3 Write property test for queue result storage
    - **Property 15: Queue Result Storage**
    - **Validates: Requirements 8.2**
  - [x] 20.4 Write property test for queue retry logic
    - **Property 16: Queue Retry Logic**
    - **Validates: Requirements 8.3**

- [x] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 8: Containerization

- [x] 22. Create Docker configuration
  - [x] 22.1 Create `Dockerfile.solver` for solver container
    - Use python:3.12-slim base image
    - Include health check
    - Configure entrypoint
    - _Requirements: 7.1, 7.2_
  - [x] 22.2 Update `docker-compose.yml` with solver service
    - Configure resource limits (CPU, memory)
    - Configure environment variables
    - _Requirements: 7.3, 7.4_
  - [x] 22.3 Write integration test for containerized solver
    - Test solver runs correctly in container
    - Test health check works
    - _Requirements: 7.1, 7.2_

- [x] 23. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Phase 9: Property Tests for Core Invariants

- [x] 24. Implement remaining property tests
  - [x] 24.1 Write property test for grade category validity
    - **Property 18: Grade Category Validity**
    - **Validates: Requirements 10.1**
  - [x] 24.2 Write property test for decomposition partition
    - **Property 20: Decomposition Partition**
    - **Validates: Requirements 10.4**

## Phase 10: Integration and Entry Point

- [x] 25. Create entry point and wire everything together
  - [x] 25.1 Create `solver.py` entry point
    - Wire all modules together
    - Maintain backward compatibility with stdin/stdout interface
    - _Requirements: 1.1, 1.8_
  - [x] 25.2 Update `__init__.py` files for proper exports
    - Export public APIs from each module
    - _Requirements: 1.1_
  - [x] 25.3 Write integration tests for full solve workflow
    - Test small problem end-to-end
    - Test large problem with decomposition
    - Test parallel solving
    - _Requirements: 1.8_

- [x] 26. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
