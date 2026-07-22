# ==============================================================================
#
#  Response Models for Timetable Solver
#
#  Description:
#  Standardized response structures for all solver outputs. These models define
#  the contract between the solver, API, and UI for consistent error handling
#  and feedback display.
#
#  Requirements: 1.1, 1.2, 1.3
#
# ==============================================================================

from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class ResponseStatus(str, Enum):
    """Status of the solver response.
    
    - SUCCESS: Timetable generated successfully
    - PARTIAL: Timetable generated with warnings or incomplete
    - FAILED: Timetable generation failed due to errors
    """
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"


class AffectedEntity(BaseModel):
    """Reference to an entity affected by an error or suggestion.
    
    Attributes:
        entity_type: Type of entity ("teacher", "class", "room", "subject")
        entity_id: Unique identifier of the entity
        entity_name: Human-readable name of the entity
    """
    entity_type: str = Field(
        ...,
        description='Type of entity: "teacher", "class", "room", or "subject"'
    )
    entity_id: str = Field(..., description="Unique identifier of the entity")
    entity_name: str = Field(..., description="Human-readable name of the entity")


class SolverErrorDetail(BaseModel):
    """Detailed error information returned by the solver.
    
    Requirements: 1.2, 1.3
    
    Attributes:
        error_code: Unique identifier for the error type (e.g., TEACHER_OVERLOAD)
        severity: Error severity level ("error", "warning", "info")
        message_key: i18n lookup key for UI translation
        message_farsi: Localized Farsi error message
        message_english: English fallback message
        affected_entities: List of entities involved in the error
        context: Additional data for UI rendering and debugging
    """
    error_code: str = Field(..., description="Unique error code identifier")
    severity: str = Field(
        ...,
        description='Severity level: "error", "warning", or "info"'
    )
    message_key: str = Field(..., description="i18n lookup key for UI translation")
    message_farsi: str = Field(..., description="Localized Farsi error message")
    message_english: str = Field(..., description="English fallback message")
    affected_entities: List[AffectedEntity] = Field(
        default_factory=list,
        description="List of entities affected by this error"
    )
    context: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional context data for UI rendering"
    )


class QualityBreakdown(BaseModel):
    """Breakdown of quality score components.
    
    Each component includes count (number of occurrences) and penalty (score deduction).
    
    Attributes:
        teacher_gaps: Gaps in teacher schedules {"count": int, "penalty": int, "details": list}
        afternoon_difficult_subjects: Difficult subjects in afternoon {"count": int, "penalty": int, "details": list}
        same_day_subject_repetition: Same subject multiple times per day {"count": int, "penalty": int, "details": list}
        teacher_load_balance: Teacher workload variance {"variance": float, "penalty": int}
    """
    teacher_gaps: Dict[str, Any] = Field(
        default_factory=lambda: {"count": 0, "penalty": 0, "details": []},
        description="Teacher schedule gaps: count, penalty, and details"
    )
    afternoon_difficult_subjects: Dict[str, Any] = Field(
        default_factory=lambda: {"count": 0, "penalty": 0, "details": []},
        description="Difficult subjects scheduled in afternoon: count, penalty, and details"
    )
    same_day_subject_repetition: Dict[str, Any] = Field(
        default_factory=lambda: {"count": 0, "penalty": 0, "details": []},
        description="Same subject repeated on same day: count, penalty, and details"
    )
    teacher_load_balance: Dict[str, Any] = Field(
        default_factory=lambda: {"variance": 0.0, "penalty": 0},
        description="Teacher workload balance: variance and penalty"
    )


class ObjectiveResult(BaseModel):
    """Measured outcome for one enabled soft objective."""
    key: str
    strength: float = Field(ge=0, le=2)
    violation_units: int = Field(ge=0)
    opportunity_units: int = Field(ge=0)
    satisfaction_percent: int = Field(ge=0, le=100)
    affected_entities: List[AffectedEntity] = Field(default_factory=list)


class Suggestion(BaseModel):
    """Actionable suggestion for improving timetable quality.
    
    Attributes:
        suggestion_code: Unique identifier for the suggestion type
        message_farsi: Localized Farsi suggestion message
        affected_entities: Entities that would be affected by implementing the suggestion
        expected_improvement: Estimated score increase if suggestion is implemented
    """
    suggestion_code: str = Field(..., description="Unique suggestion code identifier")
    message_key: str = Field(default="quality.generic")
    message_params: Dict[str, Any] = Field(default_factory=dict)
    message_farsi: str = Field(..., description="Localized Farsi suggestion message")
    message_english: str = Field(default="Review the affected timetable preference")
    affected_entities: List[AffectedEntity] = Field(
        default_factory=list,
        description="Entities affected by this suggestion"
    )
    expected_improvement: int = Field(
        ...,
        ge=0,
        description="Estimated score increase (0-100)"
    )


class QualityScore(BaseModel):
    """Quality assessment of a generated timetable.
    
    Requirements: 4.1, 4.2, 4.3, 4.4
    
    Attributes:
        overall: Overall quality score (0-100)
        breakdown: Detailed breakdown of quality components
        suggestions: List of actionable suggestions for improvement
    """
    overall: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall quality score (0-100)"
    )
    breakdown: QualityBreakdown = Field(
        default_factory=QualityBreakdown,
        description="Detailed breakdown of quality components"
    )
    objective_results: List[ObjectiveResult] = Field(default_factory=list)
    suggestions: List[Suggestion] = Field(
        default_factory=list,
        description="Actionable suggestions for improvement"
    )


class SolverResponseMetadata(BaseModel):
    """Metadata about the solver execution.
    
    Attributes:
        solve_time_seconds: Time taken to solve (in seconds)
        strategy_selected: Strategy used for solving ("fast", "balanced", "thorough")
        strategy_reason: Explanation for strategy selection
        strategy_overridden: Whether user explicitly specified the strategy
        total_lessons: Total number of lessons to schedule
        low_resource_mode: Whether low-resource mode was active
        max_workers: Max workers used in low-resource mode (if enabled)
        max_memory_mb: Max memory used in low-resource mode (if enabled)
    """
    solve_time_seconds: Optional[float] = Field(
        None,
        description="Time taken to solve in seconds"
    )
    strategy_selected: Optional[str] = Field(
        None,
        description='Strategy used: "fast", "balanced", or "thorough"'
    )
    strategy_reason: Optional[str] = Field(
        None,
        description="Explanation for strategy selection"
    )
    strategy_overridden: Optional[bool] = Field(
        None,
        description="Whether user explicitly specified the strategy"
    )
    total_lessons: Optional[int] = Field(
        None,
        description="Total number of lessons to schedule"
    )
    optimization_preferences_revision: Optional[int] = Field(default=None, ge=1)
    enabled_objectives: List[str] = Field(default_factory=list)
    # Afghanistan-specific metadata (Requirements: 4.4)
    low_resource_mode: Optional[bool] = Field(
        None,
        description="Whether low-resource mode was active"
    )
    max_workers: Optional[int] = Field(
        None,
        description="Max worker threads used in low-resource mode"
    )
    max_memory_mb: Optional[int] = Field(
        None,
        description="Max memory in MB used in low-resource mode"
    )
    objective_value: Optional[float] = None
    best_bound: Optional[float] = None
    relative_gap: Optional[float] = None
    time_to_first_feasible_seconds: Optional[float] = None
    solution_count: Optional[int] = None
    workers: Optional[int] = None
    interrupted: bool = False
    model_variables: Optional[int] = None
    model_constraints: Optional[int] = None
    peak_memory_mb: Optional[float] = None


class SolverResponse(BaseModel):
    """Standardized response from the timetable solver.
    
    Requirements: 1.1
    
    This is the top-level response structure that wraps all solver outputs.
    The UI can rely on this consistent structure for all solver interactions.
    
    Attributes:
        status: Response status ("success", "partial", "failed")
        data: Timetable data when successful (None when failed)
        errors: List of errors (severity="error")
        warnings: List of warnings (severity="warning")
        quality_score: Quality assessment (only when timetable is generated)
        metadata: Execution metadata (timing, strategy, etc.)
    """
    status: ResponseStatus = Field(..., description="Response status")
    data: Optional[Dict[str, Any]] = Field(
        None,
        description="Timetable data when successful"
    )
    errors: List[SolverErrorDetail] = Field(
        default_factory=list,
        description="List of errors that blocked generation"
    )
    warnings: List[SolverErrorDetail] = Field(
        default_factory=list,
        description="List of warnings (non-blocking issues)"
    )
    quality_score: Optional[QualityScore] = Field(
        None,
        description="Quality assessment of the generated timetable"
    )
    metadata: SolverResponseMetadata = Field(
        default_factory=SolverResponseMetadata,
        description="Execution metadata"
    )
