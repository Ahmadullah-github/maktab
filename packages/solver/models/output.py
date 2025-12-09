# ==============================================================================
#
#  Output Data Models for Timetable Solver
#
#  Description:
#  Pydantic data models for solver output, including scheduled lessons,
#  solution metadata, and error responses.
#
# ==============================================================================

from enum import Enum
from typing import List, Dict, Optional, Any, Union

from pydantic import BaseModel, ConfigDict, Field

from .input import DayOfWeek


# ==============================================================================
# Enums
# ==============================================================================

class SolverStatus(str, Enum):
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
    day: Union[DayOfWeek, str] = Field(description="Day of the week")
    periodIndex: int = Field(ge=0, description="Period index (0-based)")
    classId: str = Field(min_length=1, description="Class identifier")
    className: Optional[str] = Field(default=None, description="Class display name")
    subjectId: str = Field(min_length=1, description="Subject identifier")
    subjectName: Optional[str] = Field(default=None, description="Subject display name")
    teacherIds: List[str] = Field(default_factory=list, description="List of teacher IDs")
    teacherNames: Optional[List[str]] = Field(default=None, description="List of teacher names")
    roomId: Optional[str] = Field(default=None, description="Room identifier")
    roomName: Optional[str] = Field(default=None, description="Room display name")
    isFixed: bool = Field(default=False, description="Whether this is a pre-scheduled fixed lesson")
    periodsThisDay: Optional[int] = Field(default=None, description="Total periods for this day")
    
    model_config = ConfigDict(use_enum_values=True)


# ==============================================================================
# Metadata Models
# ==============================================================================

class ClassMetadata(BaseModel):
    """Metadata about a class in the solution."""
    classId: str
    className: str
    gradeLevel: Optional[int] = None
    category: Optional[str] = None
    categoryDari: Optional[str] = None
    studentCount: int = 0
    singleTeacherMode: bool = False
    classTeacherId: Optional[str] = None
    classTeacherName: Optional[str] = None
    classTeacherSubjects: Optional[List[str]] = None


class SubjectMetadata(BaseModel):
    """Metadata about a subject in the solution."""
    subjectId: str
    subjectName: str
    isCustom: bool = False
    customCategory: Optional[str] = None
    customCategoryDari: Optional[str] = None


class TeacherMetadata(BaseModel):
    """Metadata about a teacher in the solution."""
    teacherId: str
    teacherName: str
    primarySubjects: List[str] = Field(default_factory=list)
    maxPeriodsPerWeek: int = 0
    classTeacherOf: List[str] = Field(default_factory=list)


class PeriodConfiguration(BaseModel):
    """Period configuration metadata."""
    periodsPerDayMap: Dict[str, int] = Field(default_factory=dict)
    totalPeriodsPerWeek: int = 0
    daysOfWeek: List[str] = Field(default_factory=list)
    hasVariablePeriods: bool = False


class SolutionMetadata(BaseModel):
    """Metadata about the solution."""
    classes: List[ClassMetadata] = Field(default_factory=list)
    subjects: List[SubjectMetadata] = Field(default_factory=list)
    teachers: List[TeacherMetadata] = Field(default_factory=list)
    periodConfiguration: Optional[PeriodConfiguration] = None


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
    categoryCounts: Dict[str, int] = Field(default_factory=dict)
    customSubjectsByCategory: Dict[str, int] = Field(default_factory=dict)
    totalLessons: int = 0
    periodsPerWeek: int = 0
    solveTimeSeconds: Optional[float] = None
    strategy: Optional[str] = None
    numConstraintsApplied: Optional[int] = None
    qualityScore: Optional[float] = None


# ==============================================================================
# Error Response Model
# ==============================================================================

class SolverError(BaseModel):
    """Standard error response from the solver."""
    error: str = Field(description="Error message")
    status: SolverStatus = Field(default=SolverStatus.ERROR, description="Error status")
    details: Optional[str] = Field(default=None, description="Detailed error information")
    suggestions: Optional[List[str]] = Field(default=None, description="Suggestions for fixing the error")
    conflicts: Optional[List[Dict[str, Any]]] = Field(default=None, description="Conflict details if applicable")

    model_config = ConfigDict(use_enum_values=True)


# ==============================================================================
# Main Output Model
# ==============================================================================

class SolverOutput(BaseModel):
    """Complete solver output including schedule, metadata, and statistics."""
    schedule: List[ScheduledLesson] = Field(default_factory=list, description="List of scheduled lessons")
    metadata: Optional[SolutionMetadata] = Field(default=None, description="Solution metadata")
    statistics: Optional[SolutionStatistics] = Field(default=None, description="Solution statistics")
    status: SolverStatus = Field(default=SolverStatus.SUCCESS, description="Solver status")
    errors: Optional[List[str]] = Field(default=None, description="List of error messages if any")

    model_config = ConfigDict(use_enum_values=True)

    @classmethod
    def from_lessons(
        cls,
        lessons: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
        statistics: Optional[Dict[str, Any]] = None,
        status: SolverStatus = SolverStatus.SUCCESS
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
                    if metadata.get("periodConfiguration") else None
            )
        
        parsed_statistics = None
        if statistics:
            parsed_statistics = SolutionStatistics(**statistics)
        
        return cls(
            schedule=scheduled_lessons,
            metadata=parsed_metadata,
            statistics=parsed_statistics,
            status=status
        )

    @classmethod
    def from_error(cls, error: Union[str, SolverError]) -> "SolverOutput":
        """
        Create SolverOutput from an error.
        
        Args:
            error: Error message or SolverError instance
        
        Returns:
            SolverOutput instance with error status
        """
        if isinstance(error, SolverError):
            return cls(
                schedule=[],
                status=error.status,
                errors=[error.error]
            )
        return cls(
            schedule=[],
            status=SolverStatus.ERROR,
            errors=[str(error)]
        )
