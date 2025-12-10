# ==============================================================================
#
#  Configuration Schema for Timetable Solver
#
#  Description:
#  Pydantic models for solver configuration. Supports YAML serialization
#  and environment variable overrides.
#
#  Requirements: 3.1, 3.2, 3.3, 3.4
#
# ==============================================================================

from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class DecompositionConfig(BaseModel):
    """
    Configuration for problem decomposition.
    
    Decomposition breaks large problems into smaller sub-problems
    that can be solved independently and merged.
    
    Requirements: 3.2
    """
    enabled: bool = Field(
        default=True,
        description="Enable automatic problem decomposition for large problems"
    )
    threshold: int = Field(
        default=200,
        ge=50,
        le=1000,
        description="Lesson count threshold to trigger decomposition"
    )
    large_threshold: int = Field(
        default=250,
        ge=100,
        le=1500,
        description="Threshold for 'large' problem classification"
    )
    very_large_threshold: int = Field(
        default=400,
        ge=150,
        le=2000,
        description="Threshold for 'very large' problem classification"
    )
    max_cluster_size: int = Field(
        default=150,
        ge=50,
        le=500,
        description="Maximum lessons per cluster during decomposition"
    )


class StrategyConfig(BaseModel):
    """
    Configuration for a solver strategy.
    
    Strategies define how the CP-SAT solver is configured for
    different problem sizes and quality requirements.
    
    Requirements: 3.3
    """
    workers: int = Field(
        default=4,
        ge=1,
        le=64,
        description="Number of parallel workers for CP-SAT solver"
    )
    max_time_seconds: int = Field(
        default=600,
        ge=10,
        le=7200,
        description="Maximum solve time in seconds"
    )
    probing_level: int = Field(
        default=0,
        ge=0,
        le=3,
        description="CP-SAT probing level (0=auto, 1-3=increasing intensity)"
    )
    linearization_level: int = Field(
        default=0,
        ge=0,
        le=2,
        description="CP-SAT linearization level (0=auto, 1-2=increasing)"
    )
    soft_constraints: List[str] = Field(
        default_factory=list,
        description="List of soft constraint names to enable"
    )



class ConstraintBudgetConfig(BaseModel):
    """
    Configuration for constraint budget limits.
    
    Constraint budgets limit the number of penalty variables
    to prevent memory explosion on large problems.
    
    Requirements: 3.4
    """
    small_problem_max: int = Field(
        default=5000,
        ge=100,
        le=50000,
        description="Max penalty variables for small problems (<200 lessons)"
    )
    medium_problem_max: int = Field(
        default=2000,
        ge=100,
        le=20000,
        description="Max penalty variables for medium problems (200-400 lessons)"
    )
    large_problem_max: int = Field(
        default=1000,
        ge=100,
        le=10000,
        description="Max penalty variables for large problems (>400 lessons)"
    )


class MemoryConfig(BaseModel):
    """
    Configuration for memory management.
    
    Controls memory limits and garbage collection thresholds
    to ensure reliable operation on resource-constrained systems.
    
    Requirements: 3.4
    """
    max_memory_mb: int = Field(
        default=4096,
        ge=512,
        le=32768,
        description="Maximum memory usage in megabytes"
    )
    warning_threshold: float = Field(
        default=0.8,
        ge=0.5,
        le=0.95,
        description="Memory usage ratio to trigger warning"
    )
    gc_threshold: float = Field(
        default=0.9,
        ge=0.6,
        le=0.99,
        description="Memory usage ratio to trigger garbage collection"
    )


class CheckpointConfig(BaseModel):
    """
    Configuration for checkpoint/resume capability.
    
    Checkpoints allow pausing and resuming long-running solves.
    """
    enabled: bool = Field(
        default=True,
        description="Enable checkpoint saving during solving"
    )
    directory: str = Field(
        default="./checkpoints",
        description="Directory to store checkpoint files"
    )
    save_interval_seconds: int = Field(
        default=60,
        ge=10,
        le=600,
        description="Interval between checkpoint saves"
    )


class SolverConfig(BaseModel):
    """
    Root configuration model for the timetable solver.
    
    This is the main configuration object that contains all
    solver settings. It can be loaded from YAML files and
    overridden by environment variables.
    
    Requirements: 3.1, 3.2, 3.3, 3.4
    """
    decomposition: DecompositionConfig = Field(
        default_factory=DecompositionConfig,
        description="Decomposition settings"
    )
    strategies: Dict[str, StrategyConfig] = Field(
        default_factory=lambda: {
            "fast": StrategyConfig(
                workers=2,
                max_time_seconds=120,
                probing_level=0,
                linearization_level=0,
                soft_constraints=["avoid_teacher_gaps"],
            ),
            "balanced": StrategyConfig(
                workers=4,
                max_time_seconds=300,
                probing_level=1,
                linearization_level=1,
                soft_constraints=[
                    "avoid_teacher_gaps",
                    "prefer_morning_difficult",
                    "subject_spread",
                ],
            ),
            "thorough": StrategyConfig(
                workers=8,
                max_time_seconds=600,
                probing_level=2,
                linearization_level=2,
                soft_constraints=[
                    "avoid_teacher_gaps",
                    "prefer_morning_difficult",
                    "subject_spread",
                    "balance_teacher_load",
                ],
            ),
        },
        description="Strategy-specific configurations"
    )
    constraint_budget: ConstraintBudgetConfig = Field(
        default_factory=ConstraintBudgetConfig,
        description="Constraint budget limits"
    )
    memory: MemoryConfig = Field(
        default_factory=MemoryConfig,
        description="Memory management settings"
    )
    checkpoints: CheckpointConfig = Field(
        default_factory=CheckpointConfig,
        description="Checkpoint/resume settings"
    )
    
    # Global time limit override (can be set via environment)
    max_time_seconds: Optional[int] = Field(
        default=None,
        ge=10,
        le=7200,
        description="Global time limit override (overrides strategy settings)"
    )
    
    def get_strategy_config(self, strategy_name: str) -> StrategyConfig:
        """
        Get configuration for a specific strategy.
        
        Args:
            strategy_name: Name of the strategy (fast, balanced, thorough)
            
        Returns:
            StrategyConfig for the requested strategy
            
        Raises:
            KeyError: If strategy name is not found
        """
        if strategy_name not in self.strategies:
            raise KeyError(
                f"Unknown strategy '{strategy_name}'. "
                f"Available: {list(self.strategies.keys())}"
            )
        return self.strategies[strategy_name]
    
    def get_constraint_budget(self, num_lessons: int) -> int:
        """
        Get the constraint budget for a given problem size.
        
        Args:
            num_lessons: Number of lessons in the problem
            
        Returns:
            Maximum number of penalty variables allowed
        """
        if num_lessons < self.decomposition.threshold:
            return self.constraint_budget.small_problem_max
        elif num_lessons < self.decomposition.very_large_threshold:
            return self.constraint_budget.medium_problem_max
        else:
            return self.constraint_budget.large_problem_max
