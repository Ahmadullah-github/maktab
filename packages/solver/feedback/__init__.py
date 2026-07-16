# ==============================================================================
#
#  Feedback Module for Timetable Solver
#
#  Description:
#  Provides standardized error handling, quality scoring, progress reporting,
#  and strategy selection for the timetable solver.
#
# ==============================================================================

from feedback.error_catalog import (
    ErrorSeverity,
    ErrorCode,
    ErrorDefinition,
    ERROR_DEFINITIONS,
)

from feedback.response_models import (
    ResponseStatus,
    AffectedEntity,
    SolverErrorDetail,
    QualityBreakdown,
    ObjectiveResult,
    Suggestion,
    QualityScore,
    SolverResponseMetadata,
    SolverResponse,
)

from feedback.error_builder import (
    build_error,
    build_internal_error,
)

from feedback.pre_solve_analyzer import (
    PreSolveResult,
    PreSolveAnalyzer,
)

from feedback.quality_scorer import QualityScorer

from feedback.progress_reporter import (
    SolveStage,
    STAGE_FARSI,
    STAGE_PERCENT_RANGES,
    ProgressReporter,
)

from feedback.strategy_selector import (
    StrategySelector,
    FAST_THRESHOLD,
    BALANCED_THRESHOLD,
)

__all__ = [
    # Error catalog exports
    "ErrorSeverity",
    "ErrorCode",
    "ErrorDefinition",
    "ERROR_DEFINITIONS",
    # Response model exports
    "ResponseStatus",
    "AffectedEntity",
    "SolverErrorDetail",
    "QualityBreakdown",
    "ObjectiveResult",
    "Suggestion",
    "QualityScore",
    "SolverResponseMetadata",
    "SolverResponse",
    # Error builder exports
    "build_error",
    "build_internal_error",
    # Pre-solve analyzer exports
    "PreSolveResult",
    "PreSolveAnalyzer",
    # Quality scorer exports
    "QualityScorer",
    # Progress reporter exports
    "SolveStage",
    "STAGE_FARSI",
    "STAGE_PERCENT_RANGES",
    "ProgressReporter",
    # Strategy selector exports
    "StrategySelector",
    "FAST_THRESHOLD",
    "BALANCED_THRESHOLD",
]
