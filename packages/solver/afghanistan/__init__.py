# ==============================================================================
#
#  Afghanistan-Specific Features Module for Timetable Solver
#
#  Description:
#  Provides Afghanistan-specific features including Ramadan mode, Ministry
#  validation, smart defaults, and low-resource mode.
#
#  Requirements: 1.1, 2.1, 3.1, 4.1
#
# ==============================================================================

from .defaults import (
    DEFAULT_DAYS_OF_WEEK,
    DEFAULT_PERIODS_PER_DAY,
    DEFAULT_CONFIG,
    apply_defaults,
    validate_config,
)

from .ramadan_mode import (
    RamadanConfig,
    RamadanModeHandler,
)

from .low_resource import (
    MAX_WORKERS,
    MAX_MEMORY_MB,
    LowResourceHandler,
)

from .ministry_validator import (
    ValidationMode,
    MinistryValidationResult,
    MinistryValidator,
)

from .curriculum import (
    MINISTRY_CURRICULUM,
    CurriculumProvider,
    get_grade_category,
    get_expected_periods,
)

__all__ = [
    # Defaults
    "DEFAULT_DAYS_OF_WEEK",
    "DEFAULT_PERIODS_PER_DAY",
    "DEFAULT_CONFIG",
    "apply_defaults",
    "validate_config",
    # Ramadan Mode
    "RamadanConfig",
    "RamadanModeHandler",
    # Low-Resource Mode
    "MAX_WORKERS",
    "MAX_MEMORY_MB",
    "LowResourceHandler",
    # Ministry Validation
    "ValidationMode",
    "MinistryValidationResult",
    "MinistryValidator",
    # Curriculum
    "MINISTRY_CURRICULUM",
    "CurriculumProvider",
    "get_grade_category",
    "get_expected_periods",
]
