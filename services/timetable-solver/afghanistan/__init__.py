# ==============================================================================
#
#  Afghanistan-Specific Features Module for Timetable Solver
#
#  Description:
#  Provides Afghanistan-specific runtime features including Ramadan mode,
#  smart defaults, and low-resource mode.
#
#  Requirements: 1.1, 2.1, 3.1, 4.1
#
# ==============================================================================

from .defaults import (
    DEFAULT_CONFIG,
    DEFAULT_DAYS_OF_WEEK,
    DEFAULT_PERIODS_PER_DAY,
    apply_defaults,
    validate_config,
)
from .low_resource import (
    MAX_MEMORY_MB,
    MAX_WORKERS,
    LowResourceHandler,
)
from .ramadan_mode import (
    RamadanConfig,
    RamadanModeHandler,
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
]
