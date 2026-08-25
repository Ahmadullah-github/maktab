# ==============================================================================
#
#  Output Data Models for Timetable Solver
#
#  Description:
#  Pydantic data models for solver output, including scheduled lessons,
#  solution metadata, and error responses.
#
# ==============================================================================

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from .input import BreakPeriodConfig, DayOfWeek

# ==============================================================================
# Enums
# ==============================================================================


class SolverStatus(StrEnum):
    """Status of the solver execution."""

    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    INFEASIBLE = "INFEASIBLE"
    TIMEOUT = "TIMEOUT"
    ERROR = "ERROR"
    INTERRUPTED = "INTERRUPTED"


# ==============================================================================
# Scheduled Lesson Model
# ==============================================================================


class ScheduledLesson(BaseModel):
    """A single scheduled lesson in the timetable."""

    day: DayOfWeek | str = Field(description="Day of the week")
    periodIndex: int = Field(ge=0, description="Period index (0-based)")
    classId: str = Field(min_length=1, description="Class identifier")
    className: str | None = Field(default=None, description="Class display name")
    subjectId: str = Field(min_length=1, description="Subject identifier")
    subjectName: str | None = Field(default=None, description="Subject display name")
    teacherIds: list[str] = Field(default_factory=list, description="List of teacher IDs")
    teacherNames: list[str] | None = Field(default=None, description="List of teacher names")
    roomId: str | None = Field(default=None, description="Room identifier")
    roomName: str | None = Field(default=None, description="Room display name")
    isFixed: bool = Field(default=False, description="Whether this is a pre-scheduled fixed lesson")
    periodsThisDay: int | None = Field(default=None, description="Total periods for this day")

    model_config = ConfigDict(use_enum_values=True)


# ==============================================================================
# Metadata Models
# ==============================================================================


class ClassMetadata(BaseModel):
    """Metadata about a class in the solution."""

    classId: str
    className: str
    gradeLevel: int | None = None
    category: str | None = None
    categoryDari: str | None = None
    studentCount: int = 0
    singleTeacherMode: bool = False
    classTeacherId: str | None = None
    classTeacherName: str | None = None
    classTeacherSubjects: list[str] | None = None


class SubjectMetadata(BaseModel):
    """Metadata about a subject in the solution."""

    subjectId: str
    subjectName: str
    isCustom: bool = False
    customCategory: str | None = None
    customCategoryDari: str | None = None


class TeacherMetadata(BaseModel):
    """Metadata about a teacher in the solution."""

    teacherId: str
    teacherName: str
    primarySubjects: list[str] = Field(default_factory=list)
    maxPeriodsPerWeek: int = 0
    classTeacherOf: list[str] = Field(default_factory=list)


class PeriodConfiguration(BaseModel):
    """Period configuration metadata."""

    periodsPerDayMap: dict[str, int] = Field(default_factory=dict)
    totalPeriodsPerWeek: int = 0
    daysOfWeek: list[str] = Field(default_factory=list)
    hasVariablePeriods: bool = False
    categoryPeriodsPerDayMap: dict[str, dict[str, int]] = Field(default_factory=dict)
    breakPeriodsDefault: list[BreakPeriodConfig] = Field(default_factory=list)
    breakPeriodsByDay: dict[str, list[BreakPeriodConfig]] = Field(default_factory=dict)
    hasVariableBreaks: bool = False


class SolutionMetadata(BaseModel):
    """Metadata about the solution."""

    classes: list[ClassMetadata] = Field(default_factory=list)
    subjects: list[SubjectMetadata] = Field(default_factory=list)
    teachers: list[TeacherMetadata] = Field(default_factory=list)
    periodConfiguration: PeriodConfiguration | None = None


# ==============================================================================
# Statistics Model
# ==============================================================================


class SolutionStatistics(BaseModel):
    """Statistics about the generated solution."""

    totalClasses: int = 0
    singleTeacherClasses: int = 0
    multiTeacherClasses: int = 0
    totalSubjects: int = 0
    customSubjects: int = 0
    standardSubjects: int = 0
    totalTeachers: int = 0
    totalRooms: int = 0
    categoryCounts: dict[str, int] = Field(default_factory=dict)
    customSubjectsByCategory: dict[str, int] = Field(default_factory=dict)
    totalLessons: int = 0
    periodsPerWeek: int = 0
    solveTimeSeconds: float | None = None
    strategy: str | None = None
    numConstraintsApplied: int | None = None
    qualityScore: float | None = None


# ==============================================================================
# Error Response Model
# ==============================================================================


class SolverError(BaseModel):
    """Standard error response from the solver."""

    error: str = Field(description="Error message")
    status: SolverStatus = Field(default=SolverStatus.ERROR, description="Error status")
    details: str | None = Field(default=None, description="Detailed error information")
    suggestions: list[str] | None = Field(
        default=None, description="Suggestions for fixing the error"
    )
    conflicts: list[dict[str, Any]] | None = Field(
        default=None, description="Conflict details if applicable"
    )

    model_config = ConfigDict(use_enum_values=True)


# ==============================================================================
# Main Output Model
# ==============================================================================


class SolverOutput(BaseModel):
    """Complete solver output including schedule, metadata, and statistics."""

    schedule: list[ScheduledLesson] = Field(
        default_factory=list, description="List of scheduled lessons"
    )
    metadata: SolutionMetadata | None = Field(default=None, description="Solution metadata")
    statistics: SolutionStatistics | None = Field(default=None, description="Solution statistics")
    status: SolverStatus = Field(default=SolverStatus.SUCCESS, description="Solver status")
    errors: list[str] | None = Field(default=None, description="List of error messages if any")

    model_config = ConfigDict(use_enum_values=True)

    @classmethod
    def from_lessons(
        cls,
        lessons: list[dict[str, Any]],
        metadata: dict[str, Any] | None = None,
        statistics: dict[str, Any] | None = None,
        status: SolverStatus = SolverStatus.SUCCESS,
    ) -> "SolverOutput":
        """
        Create SolverOutput from raw lesson dictionaries.

        Args:
            lessons: List of lesson dictionaries from solver
            metadata: Optional metadata dictionary
            statistics: Optional statistics dictionary
            status: Solver status

        Returns:
            SolverOutput instance
        """
        scheduled_lessons = [ScheduledLesson(**lesson) for lesson in lessons]

        parsed_metadata = None
        if metadata:
            parsed_metadata = SolutionMetadata(
                classes=[ClassMetadata(**c) for c in metadata.get("classes", [])],
                subjects=[SubjectMetadata(**s) for s in metadata.get("subjects", [])],
                teachers=[TeacherMetadata(**t) for t in metadata.get("teachers", [])],
                periodConfiguration=PeriodConfiguration(**metadata["periodConfiguration"])
                if metadata.get("periodConfiguration")
                else None,
            )

        parsed_statistics = None
        if statistics:
            parsed_statistics = SolutionStatistics(**statistics)

        return cls(
            schedule=scheduled_lessons,
            metadata=parsed_metadata,
            statistics=parsed_statistics,
            status=status,
        )

    @classmethod
    def from_error(cls, error: str | SolverError) -> "SolverOutput":
        """
        Create SolverOutput from an error.

        Args:
            error: Error message or SolverError instance

        Returns:
            SolverOutput instance with error status
        """
        if isinstance(error, SolverError):
            return cls(schedule=[], status=error.status, errors=[error.error])
        return cls(schedule=[], status=SolverStatus.ERROR, errors=[str(error)])
