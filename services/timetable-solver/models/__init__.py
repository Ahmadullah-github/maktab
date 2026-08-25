# ==============================================================================
# Models Package
#
# This package contains all Pydantic data models for the timetable solver.
# - input.py: Input data models (TimetableData, Teacher, ClassGroup, etc.)
# - output.py: Output data models (ScheduledLesson, SolutionMetadata, etc.)
# ==============================================================================

from .input import (
    ISO_DATE_REGEX,
    # Primitives
    TIME_REGEX,
    BaseLesson,
    BreakPeriodConfig,
    ClassGroup,
    # Enums
    DayOfWeek,
    FixedLesson,
    GlobalConfig,
    GlobalPreferences,
    # Sub-models
    Period,
    Room,
    SchoolEvent,
    Subject,
    SubjectRequirement,
    Teacher,
    TimePreference,
    # Main model
    TimetableData,
    UnavailableSlot,
)
from .output import (
    ScheduledLesson,
    SolutionMetadata,
    SolverError,
    SolverOutput,
)

__all__ = [
    # Enums
    "DayOfWeek",
    "TimePreference",
    # Primitives
    "TIME_REGEX",
    "ISO_DATE_REGEX",
    # Sub-models
    "Period",
    "UnavailableSlot",
    "BreakPeriodConfig",
    "GlobalConfig",
    "GlobalPreferences",
    "Room",
    "Subject",
    "Teacher",
    "SubjectRequirement",
    "ClassGroup",
    "SchoolEvent",
    "BaseLesson",
    "FixedLesson",
    # Main model
    "TimetableData",
    # Output models
    "ScheduledLesson",
    "SolutionMetadata",
    "SolverOutput",
    "SolverError",
]
