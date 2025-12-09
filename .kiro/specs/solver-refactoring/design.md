# Design Document: Solver Refactoring

## Overview

This design document describes the architecture for refactoring the Timetable Solver from a monolithic 3000+ line file (`solver_enhanced.py`) into a modular, maintainable architecture. The refactoring preserves all existing functionality while enabling:

1. **Better maintainability** through logical module separation
2. **Extensibility** via a constraint plugin system
3. **Scalability** through parallel sub-problem solving
4. **Reliability** with checkpoint/resume capability
5. **Operability** via containerization, queue-based architecture, and metrics

The solver uses Google OR-Tools CP-SAT for constraint satisfaction and Pydantic v2 for data validation.

## Architecture

### Current Architecture (Monolithic)

```
packages/solver/
├── solver_enhanced.py      # 3000+ lines - ALL logic here
├── strategies/             # Strategy implementations (already modular)
├── decomposition/          # Decomposition logic (already modular)
├── utils/                  # Utilities (already modular)
└── constraints/
    └── base.py             # Abstract base only - not used
```

### Target Architecture (Modular)

```
packages/solver/
├── solver.py               # Entry point - thin wrapper
├── core/
│   ├── __init__.py
│   ├── solver.py           # Main TimetableSolver class (~500 lines)
│   ├── variables.py        # Variable creation logic
│   └── solution_builder.py # Solution building logic
├── constraints/
│   ├── __init__.py
│   ├── base.py             # Abstract Constraint interface
│   ├── registry.py         # ConstraintRegistry for plugin system
│   ├── hard/
│   │   ├── __init__.py
│   │   ├── no_overlap.py   # No class/teacher/room overlap
│   │   ├── same_day.py     # Multi-period lessons same day
│   │   └── consecutive.py  # Consecutive period constraints
│   └── soft/
│       ├── __init__.py
│       ├── morning_difficult.py
│       ├── teacher_gaps.py
│       └── subject_spread.py
├── validation/
│   ├── __init__.py
│   ├── period_config.py
│   ├── teacher_availability.py
│   └── subject_references.py
├── models/
│   ├── __init__.py
│   ├── input.py            # TimetableData, Teacher, ClassGroup, etc.
│   └── output.py           # Solution, Lesson, Metadata models
├── config/
│   ├── __init__.py
│   ├── loader.py           # YAML configuration loader
│   └── schema.py           # Configuration Pydantic models
├── parallel/
│   ├── __init__.py
│   ├── executor.py         # Parallel cluster solving
│   └── checkpoint.py       # Checkpoint/resume capability
├── memory/
│   ├── __init__.py
│   └── manager.py          # Memory management
├── metrics/
│   ├── __init__.py
│   └── prometheus.py       # Prometheus metrics export
├── queue/
│   ├── __init__.py
│   ├── worker.py           # Redis queue worker
│   └── job.py              # Job model
├── strategies/             # (existing - unchanged)
├── decomposition/          # (existing - unchanged)
└── utils/                  # (existing - unchanged)
```

### High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INPUT (JSON via stdin)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    1. CONFIGURATION LOADING (config/loader.py)              │
│  • Load solver_config.yaml if present                                       │
│  • Apply environment variable overrides                                     │
│  • Use defaults for missing values                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    2. DATA VALIDATION (validation/*.py)                     │
│  • Period configuration validation                                          │
│  • Teacher availability validation                                          │
│  • Subject reference validation                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    3. DECOMPOSITION DECISION (decomposition/)               │
│  • Analyze problem size                                                     │
│  • Choose strategy (none/clustering/grade-level/two-phase)                  │
│  • Create clusters if needed                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼                                   ▼
┌───────────────────────────────┐     ┌───────────────────────────────────────┐
│   4a. SEQUENTIAL SOLVING      │     │   4b. PARALLEL SOLVING                │
│   (small problems)            │     │   (large problems - parallel/)        │
│   • Single solver instance    │     │   • ProcessPoolExecutor               │
│   • Direct solution           │     │   • Checkpoint after each cluster     │
└───────────────────────────────┘     │   • Merge solutions                   │
                    │                 └───────────────────────────────────────┘
                    │                                   │
                    └─────────────────┬─────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    5. CONSTRAINT APPLICATION (constraints/)                 │
│  • ConstraintRegistry.apply_all(model, context, stage)                      │
│  • Hard constraints first (ESSENTIAL stage)                                 │
│  • Soft constraints by priority (IMPORTANT, OPTIONAL stages)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    6. CP-SAT SOLVING (core/solver.py)                       │
│  • Configure solver parameters from strategy                                │
│  • Run solver with time limit                                               │
│  • Export metrics (metrics/)                                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    7. OUTPUT (JSON via stdout)                              │
│  • Build solution (core/solution_builder.py)                                │
│  • Add metadata                                                             │
│  • Return schedule                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Core Solver Module (`core/`)

#### `core/solver.py` - TimetableSolver Class

```python
class TimetableSolver:
    """Main solver class - orchestrates the solving process."""
    
    def __init__(self, input_data: Union[dict, TimetableData], config: SolverConfig = None):
        """Initialize solver with input data and optional configuration."""
        
    def solve(self, time_limit_seconds: int = 600, **kwargs) -> List[Dict[str, Any]]:
        """Solve the timetabling problem and return scheduled lessons."""
        
    def _create_model(self) -> cp_model.CpModel:
        """Create CP-SAT model with variables and constraints."""
        
    def _apply_constraints(self, model: cp_model.CpModel, context: Dict) -> None:
        """Apply all registered constraints via ConstraintRegistry."""
```

#### `core/variables.py` - Variable Creation

```python
class VariableManager:
    """Manages CP-SAT variable creation with memory optimization."""
    
    def __init__(self, model: cp_model.CpModel, config: SolverConfig):
        """Initialize with model and configuration."""
        
    def create_start_variables(self, requests: List[Request]) -> Dict[int, IntVar]:
        """Create start time variables for each request."""
        
    def create_teacher_variables(self, requests: List[Request], teachers: List[Teacher]) -> Dict:
        """Create teacher assignment variables."""
        
    def create_room_variables(self, requests: List[Request], rooms: List[Room]) -> Dict:
        """Create room assignment variables."""
        
    def create_interval_variables(self, requests: List[Request]) -> Dict[int, IntervalVar]:
        """Create interval variables for no-overlap constraints."""
        
    def get_or_create_bool_var(self, key: str) -> BoolVar:
        """Get cached bool variable or create new one."""
```

#### `core/solution_builder.py` - Solution Construction

```python
class SolutionBuilder:
    """Builds solution output from solver results."""
    
    def __init__(self, data: TimetableData, solver: cp_model.CpSolver):
        """Initialize with input data and solved model."""
        
    def build_solution(self, requests: List[Request], variables: Dict) -> List[Dict]:
        """Build list of scheduled lessons from solver values."""
        
    def add_metadata(self, solution: List[Dict]) -> Dict[str, Any]:
        """Add metadata (categories, statistics) to solution."""
```

### 2. Constraint System (`constraints/`)

#### `constraints/registry.py` - Constraint Plugin System

```python
class ConstraintStage(Enum):
    """Stages for constraint application."""
    ESSENTIAL = 1   # Hard constraints - always applied
    IMPORTANT = 2   # High-priority soft constraints
    OPTIONAL = 3    # Low-priority soft constraints

class ConstraintRegistry:
    """Registry for constraint plugins."""
    
    _instance = None  # Singleton
    
    def __init__(self):
        self._constraints: Dict[ConstraintStage, List[Constraint]] = {
            stage: [] for stage in ConstraintStage
        }
    
    @classmethod
    def get_instance(cls) -> 'ConstraintRegistry':
        """Get singleton instance."""
        
    def register(self, constraint: Constraint, stage: ConstraintStage = None) -> None:
        """Register a constraint for automatic application."""
        
    def unregister(self, constraint_name: str) -> bool:
        """Unregister a constraint by name."""
        
    def apply_all(self, model: cp_model.CpModel, context: Dict, stage: ConstraintStage) -> List:
        """Apply all registered constraints for a stage."""
        
    def get_constraints(self, stage: ConstraintStage = None) -> List[Constraint]:
        """Get registered constraints, optionally filtered by stage."""
```

#### `constraints/hard/no_overlap.py` - Example Hard Constraint

```python
class NoClassOverlapConstraint(HardConstraint):
    """Ensures a class cannot have two lessons at the same time."""
    
    def __init__(self):
        super().__init__(name="no_class_overlap")
    
    def apply(self, model: cp_model.CpModel, context: Dict) -> None:
        """Add no-overlap intervals for each class."""
        # Implementation using AddNoOverlap
```

#### `constraints/soft/morning_difficult.py` - Example Soft Constraint

```python
class PreferMorningForDifficultConstraint(SoftConstraint):
    """Prefers scheduling difficult subjects in morning periods."""
    
    def __init__(self, weight: int = 50):
        super().__init__(name="prefer_morning_difficult", weight=weight)
    
    def apply(self, model: cp_model.CpModel, context: Dict) -> List[IntVar]:
        """Add penalty variables for difficult subjects not in morning."""
        # Returns list of penalty variables to minimize
```

### 3. Configuration System (`config/`)

#### `config/schema.py` - Configuration Models

```python
class DecompositionConfig(BaseModel):
    """Decomposition configuration."""
    enabled: bool = True
    threshold: int = 200
    large_threshold: int = 250
    very_large_threshold: int = 400
    max_cluster_size: int = 150

class StrategyConfig(BaseModel):
    """Strategy-specific configuration."""
    workers: int
    max_time_seconds: int
    probing_level: int = 0
    linearization_level: int = 0
    soft_constraints: List[str] = []

class MemoryConfig(BaseModel):
    """Memory management configuration."""
    max_memory_mb: int = 4096
    warning_threshold: float = 0.8
    gc_threshold: float = 0.9

class SolverConfig(BaseModel):
    """Root configuration model."""
    decomposition: DecompositionConfig = DecompositionConfig()
    strategies: Dict[str, StrategyConfig] = {}
    memory: MemoryConfig = MemoryConfig()
    checkpoints: CheckpointConfig = CheckpointConfig()
```

#### `config/loader.py` - Configuration Loading

```python
class ConfigLoader:
    """Loads configuration from YAML files and environment."""
    
    SEARCH_PATHS = [
        Path('./solver_config.yaml'),
        Path('./config/solver_config.yaml'),
        Path.home() / '.maktab' / 'solver_config.yaml'
    ]
    
    @classmethod
    def load(cls, config_path: str = None) -> SolverConfig:
        """Load configuration from file or defaults."""
        
    @classmethod
    def apply_env_overrides(cls, config: SolverConfig) -> SolverConfig:
        """Apply environment variable overrides."""
        
    @classmethod
    def save(cls, config: SolverConfig, path: str) -> None:
        """Save configuration to YAML file."""
```

### 4. Parallel Execution (`parallel/`)

#### `parallel/executor.py` - Parallel Cluster Solving

```python
class ParallelClusterExecutor:
    """Executes cluster solving in parallel."""
    
    def __init__(self, max_workers: int = None, config: SolverConfig = None):
        """Initialize with worker count (default: CPU count - 1)."""
        self.max_workers = max_workers or max(1, os.cpu_count() - 1)
        
    def solve_clusters(
        self, 
        clusters: List[Dict], 
        solver_class: Type,
        checkpoint_manager: CheckpointManager = None,
        **solver_kwargs
    ) -> List[ClusterResult]:
        """Solve clusters in parallel with optional checkpointing."""
        
    def _solve_single_cluster(self, cluster: Dict, solver_class: Type, **kwargs) -> ClusterResult:
        """Solve a single cluster (runs in subprocess)."""
```

#### `parallel/checkpoint.py` - Checkpoint/Resume

```python
class CheckpointManager:
    """Manages solver checkpoints for pause/resume."""
    
    def __init__(self, checkpoint_dir: str = "./checkpoints"):
        """Initialize checkpoint manager."""
        
    def save(
        self,
        job_id: str,
        input_data: Dict,
        partial_solution: List,
        completed_clusters: List[int],
        pending_clusters: List[int]
    ) -> str:
        """Save checkpoint to disk."""
        
    def load(self, job_id: str) -> Optional[Checkpoint]:
        """Load checkpoint if exists."""
        
    def delete(self, job_id: str) -> bool:
        """Delete checkpoint after successful completion."""
        
    def validate(self, checkpoint: Checkpoint, input_data: Dict) -> bool:
        """Validate checkpoint matches current input schema."""
```

### 5. Memory Management (`memory/`)

#### `memory/manager.py` - Memory Manager

```python
class MemoryManager:
    """Manages memory usage during solving."""
    
    def __init__(self, max_memory_mb: int = 4096):
        """Initialize with memory limit."""
        self.max_memory_mb = max_memory_mb
        self._variable_pools: Dict[str, Any] = {}
        
    def check_memory(self) -> float:
        """Check current memory usage, trigger GC if needed."""
        
    def get_or_create_variable(self, pool_name: str, key: str, factory: Callable) -> Any:
        """Get variable from pool or create with factory."""
        
    def cleanup(self) -> None:
        """Force garbage collection and clear caches."""
```

### 6. Metrics Export (`metrics/`)

#### `metrics/prometheus.py` - Prometheus Metrics

```python
from prometheus_client import Counter, Histogram, Gauge, generate_latest

# Metrics definitions
solve_duration = Histogram(
    'solver_duration_seconds',
    'Time spent solving',
    buckets=[1, 5, 10, 30, 60, 120, 300, 600]
)

constraints_applied = Counter(
    'solver_constraints_applied_total',
    'Total constraints applied',
    ['constraint_type', 'stage']
)

solution_quality = Gauge(
    'solver_solution_quality_score',
    'Quality score of the solution'
)

class MetricsExporter:
    """Exports solver metrics in Prometheus format."""
    
    @staticmethod
    def record_solve_duration(duration_seconds: float) -> None:
        """Record solve duration."""
        
    @staticmethod
    def record_constraint_applied(constraint_type: str, stage: str) -> None:
        """Record constraint application."""
        
    @staticmethod
    def record_solution_quality(score: float) -> None:
        """Record solution quality score."""
        
    @staticmethod
    def get_metrics() -> bytes:
        """Get metrics in Prometheus format."""
```

### 7. Queue Worker (`queue/`)

#### `queue/worker.py` - Redis Queue Worker

```python
class SolverWorker:
    """Redis queue worker for solver jobs."""
    
    def __init__(self, redis_url: str, result_store: ResultStore):
        """Initialize worker with Redis connection."""
        
    def start(self) -> None:
        """Start processing jobs from queue."""
        
    def process_job(self, job: SolverJob) -> SolverResult:
        """Process a single solver job."""
        
    def stop(self) -> None:
        """Stop worker gracefully."""
```

## Data Models

### Input Models (`models/input.py`)

The existing Pydantic models will be moved to this module:

- `TimetableData` - Root input model
- `GlobalConfig` - Configuration settings
- `Teacher` - Teacher definition
- `ClassGroup` - Class definition
- `Subject` - Subject definition
- `Room` - Room definition
- `FixedLesson` - Pre-scheduled lessons
- `SchoolEvent` - Blocked time slots

### Output Models (`models/output.py`)

```python
class ScheduledLesson(BaseModel):
    """A single scheduled lesson."""
    day: str
    periodIndex: int
    classId: str
    className: str
    subjectId: str
    subjectName: str
    teacherIds: List[str]
    teacherNames: List[str]
    roomId: Optional[str]
    roomName: Optional[str]

class SolutionMetadata(BaseModel):
    """Metadata about the solution."""
    solveTimeSeconds: float
    strategy: str
    numLessons: int
    numConstraintsApplied: int
    qualityScore: float

class SolverOutput(BaseModel):
    """Complete solver output."""
    status: str  # SUCCESS, PARTIAL, INFEASIBLE, ERROR
    schedule: List[ScheduledLesson]
    metadata: SolutionMetadata
    errors: Optional[List[str]] = None
```



## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified. Redundant properties have been consolidated.

### Property 1: Solver Output Equivalence

*For any* valid input data, the refactored modular solver SHALL produce output equivalent to the original monolithic solver (same lessons scheduled to same time slots).

**Validates: Requirements 1.8**

### Property 2: Constraint Registry Completeness

*For any* set of constraints registered with the ConstraintRegistry, calling `apply_all(model, context, stage)` SHALL invoke the `apply()` method on every enabled constraint matching that stage.

**Validates: Requirements 2.2, 2.4**

### Property 3: Constraint Categorization Correctness

*For any* constraint registered with the ConstraintRegistry, the constraint SHALL be categorized by its `is_hard` property (hard/soft) and `priority` property (CRITICAL/HIGH/MEDIUM/LOW).

**Validates: Requirements 2.3**

### Property 4: Configuration Round-Trip

*For any* valid SolverConfig object, serializing to YAML and deserializing back SHALL produce an equivalent configuration object.

**Validates: Requirements 3.6, 10.2**

### Property 5: Configuration Override

*For any* configuration values specified in `solver_config.yaml`, the solver SHALL use those values instead of defaults for decomposition thresholds, strategy parameters, and constraint budgets.

**Validates: Requirements 3.2, 3.3, 3.4**

### Property 6: Parallel Worker Count

*For any* worker count configuration, the ParallelClusterExecutor SHALL spawn exactly that many worker processes (or CPU count - 1 if not specified).

**Validates: Requirements 4.2**

### Property 7: Parallel Failure Isolation

*For any* set of clusters where one or more clusters fail during parallel solving, the solver SHALL continue solving remaining clusters and include failure information in the result.

**Validates: Requirements 4.3**

### Property 8: Solution Merge Correctness

*For any* set of cluster solutions, the merged solution SHALL contain no conflicts (no two lessons with the same class, teacher, or room at the same time).

**Validates: Requirements 4.4**

### Property 9: Checkpoint Completeness

*For any* checkpoint saved during solving, the checkpoint SHALL contain: input data, partial solution, list of completed cluster IDs, and list of pending cluster IDs.

**Validates: Requirements 5.1, 5.2**

### Property 10: Checkpoint Resume Correctness

*For any* valid checkpoint, resuming from that checkpoint SHALL continue solving from the saved state and produce a complete solution equivalent to solving from scratch.

**Validates: Requirements 5.3**

### Property 11: Checkpoint Validation

*For any* checkpoint loaded, the solver SHALL validate that the checkpoint's input data schema matches the current input schema and reject invalid checkpoints.

**Validates: Requirements 5.5**

### Property 12: Memory Limit Enforcement

*For any* configured memory limit, the solver SHALL raise a MemoryError with diagnostic information when memory usage exceeds the limit.

**Validates: Requirements 6.1, 6.3**

### Property 13: Variable Pool Reuse

*For any* equivalent variable creation requests (same key), the VariableManager SHALL return the same cached variable instance.

**Validates: Requirements 6.4**

### Property 14: Environment Variable Override

*For any* environment variables SOLVER_MAX_MEMORY_MB and SOLVER_MAX_TIME_SECONDS, the solver SHALL use those values to configure memory and time limits.

**Validates: Requirements 7.4**

### Property 15: Queue Result Storage

*For any* job processed by the queue worker, the result SHALL be stored in the configured results store with the job ID as key.

**Validates: Requirements 8.2**

### Property 16: Queue Retry Logic

*For any* failed job with retry configuration, the queue worker SHALL retry the job according to the configured retry count and backoff.

**Validates: Requirements 8.3**

### Property 17: Metrics Counter Increment

*For any* constraint applied during solving, the `constraints_applied_total` counter SHALL be incremented with the correct constraint type and stage labels.

**Validates: Requirements 9.2**

### Property 18: Grade Category Validity

*For any* grade level from 1 to 12, the `get_category_from_grade()` function SHALL return exactly one of: "Alpha-Primary", "Beta-Primary", "Middle", or "High".

**Validates: Requirements 10.1**

### Property 19: Hard Constraint Satisfaction

*For any* valid input data, the solver SHALL never produce a solution that violates any hard constraint (no class overlap, no teacher overlap, no room overlap, consecutive lessons adjacent).

**Validates: Requirements 10.3**

### Property 20: Decomposition Partition

*For any* decomposition into clusters, every lesson from the original problem SHALL appear in exactly one cluster (no duplicates, no omissions).

**Validates: Requirements 10.4**

## Error Handling

### Validation Errors

| Error Type | Condition | Response |
|------------|-----------|----------|
| `PeriodConfigurationError` | Invalid period configuration | Return error with specific field and suggestion |
| `TeacherAvailabilityError` | Teacher availability doesn't match periods | Return error with teacher name and expected periods |
| `SubjectReferenceError` | Unknown subject ID referenced | Return error with suggestion for similar subjects |
| `SingleTeacherFeasibilityError` | Teacher can't teach all required subjects | Return error with missing subjects list |
| `EmptyPeriodsError` | Class has empty periods | Return error with gap count and suggestions |

### Runtime Errors

| Error Type | Condition | Response |
|------------|-----------|----------|
| `MemoryError` | Memory usage exceeds limit | Raise with diagnostic info (variables created, memory used) |
| `TimeoutError` | Solve time exceeds limit | Return partial solution with TIMEOUT status |
| `InfeasibleError` | No solution exists | Return INFEASIBLE status with constraint analysis |
| `ClusterFailureError` | Cluster fails during parallel solve | Log error, continue with other clusters, include in result |
| `CheckpointCorruptError` | Checkpoint data invalid | Delete checkpoint, restart from beginning |

### Error Response Format

```python
class SolverError(BaseModel):
    """Standard error response."""
    status: str  # ERROR, TIMEOUT, INFEASIBLE
    error_type: str
    message: str
    details: Optional[Dict[str, Any]] = None
    suggestions: Optional[List[str]] = None
```

## Testing Strategy

### Dual Testing Approach

This project uses both unit tests and property-based tests:

- **Unit tests** verify specific examples, edge cases, and integration points
- **Property-based tests** verify universal properties that should hold across all inputs

### Property-Based Testing Framework

**Framework:** `hypothesis` (Python)

**Configuration:**
- Minimum 100 iterations per property test
- Deadline: 10 seconds per example
- Database for reproducibility

### Test Organization

```
packages/solver/tests/
├── unit/
│   ├── test_core_solver.py
│   ├── test_variables.py
│   ├── test_solution_builder.py
│   ├── test_constraint_registry.py
│   ├── test_config_loader.py
│   ├── test_checkpoint.py
│   └── test_memory_manager.py
├── property/
│   ├── test_prop_solver_equivalence.py      # Property 1
│   ├── test_prop_constraint_registry.py     # Properties 2, 3
│   ├── test_prop_config_roundtrip.py        # Properties 4, 5
│   ├── test_prop_parallel.py                # Properties 6, 7, 8
│   ├── test_prop_checkpoint.py              # Properties 9, 10, 11
│   ├── test_prop_memory.py                  # Properties 12, 13
│   ├── test_prop_queue.py                   # Properties 15, 16
│   ├── test_prop_metrics.py                 # Property 17
│   ├── test_prop_grade_category.py          # Property 18
│   ├── test_prop_hard_constraints.py        # Property 19
│   └── test_prop_decomposition.py           # Property 20
├── integration/
│   ├── test_full_solve.py
│   ├── test_parallel_solve.py
│   └── test_checkpoint_resume.py
└── conftest.py                              # Shared fixtures
```

### Property Test Annotation Format

Each property-based test MUST include a comment referencing the correctness property:

```python
# **Feature: solver-refactoring, Property 18: Grade Category Validity**
@given(st.integers(min_value=1, max_value=12))
def test_grade_category_always_valid(grade: int):
    """For any grade 1-12, category must be one of the four valid values."""
    category = get_category_from_grade(grade)
    assert category in ["Alpha-Primary", "Beta-Primary", "Middle", "High"]
```

### Test Generators

Custom Hypothesis strategies for domain objects:

```python
# conftest.py
from hypothesis import strategies as st

@st.composite
def solver_config(draw):
    """Generate valid SolverConfig objects."""
    return SolverConfig(
        decomposition=DecompositionConfig(
            threshold=draw(st.integers(100, 500)),
            large_threshold=draw(st.integers(200, 600)),
        ),
        memory=MemoryConfig(
            max_memory_mb=draw(st.integers(1024, 8192))
        )
    )

@st.composite
def constraint(draw):
    """Generate valid Constraint objects."""
    is_hard = draw(st.booleans())
    if is_hard:
        return MockHardConstraint(name=draw(st.text(min_size=1, max_size=20)))
    else:
        return MockSoftConstraint(
            name=draw(st.text(min_size=1, max_size=20)),
            weight=draw(st.integers(1, 100))
        )

@st.composite
def timetable_input(draw):
    """Generate valid TimetableData input."""
    # Generate minimal valid input for testing
    ...
```

### Unit Test Coverage Requirements

| Module | Minimum Coverage |
|--------|------------------|
| `core/solver.py` | 80% |
| `core/variables.py` | 85% |
| `constraints/registry.py` | 90% |
| `config/loader.py` | 85% |
| `parallel/checkpoint.py` | 90% |
| `memory/manager.py` | 85% |

### Integration Test Scenarios

1. **Full solve with small problem** - Verify end-to-end solving works
2. **Full solve with large problem** - Verify decomposition triggers correctly
3. **Parallel solve with 4 clusters** - Verify parallel execution
4. **Checkpoint and resume** - Verify pause/resume works correctly
5. **Configuration override** - Verify YAML config is loaded and applied
6. **Memory limit enforcement** - Verify MemoryError is raised at limit
