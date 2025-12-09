# ==============================================================================
# Models Package
# 
# This package contains all Pydantic data models for the timetable solver.
# - input.py: Input data models (TimetableData, Teacher, ClassGroup, etc.)
# - output.py: Output data models (ScheduledLesson, SolutionMetadata, etc.)
# ==============================================================================

from .input import (
    # Enums
    DayOfWeek,
    TimePreference,
    # Primitives
    TIME_REGEX,
    ISO_DATE_REGEX,
    # Sub-models
    Period,
    UnavailableSlot,
    BreakPeriodConfig,
    GlobalConfig,
    GlobalPreferences,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
    SchoolEvent,
    BaseLesson,
    FixedLesson,
    # Main model
    TimetableData,
)

from .output import (
    ScheduledLesson,
    SolutionMetadata,
    SolverOutput,
    SolverError,
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
