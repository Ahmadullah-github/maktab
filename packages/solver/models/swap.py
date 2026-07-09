# ==============================================================================
#
#  Swap Solver Data Models
#
#  Description:
#  Pydantic data models for swap validation and constraint checking.
#  These models define the data contract for the swap solver.
#
# ==============================================================================

from typing import List, Dict, Optional, Any
from pydantic import AliasChoices, BaseModel, Field


class SlotIdentifier(BaseModel):
    """Identifies a specific time slot in the timetable."""

    classId: str = Field(min_length=1)
    day: str = Field(min_length=1)
    period: int = Field(ge=0)


class SwapRequest(BaseModel):
    """Request to swap two lessons in the timetable."""

    timetable_id: int = Field(
        ge=1, validation_alias=AliasChoices("timetable_id", "timetableId")
    )
    source_slot: SlotIdentifier = Field(
        validation_alias=AliasChoices("source_slot", "sourceSlot")
    )
    target_slot: SlotIdentifier = Field(
        validation_alias=AliasChoices("target_slot", "targetSlot")
    )


class ConstraintViolation(BaseModel):
    """Represents a constraint violation."""

    type: str = Field(min_length=1)
    severity: str = Field(pattern="^(hard|soft)$")
    message: str = Field(min_length=1)
    message_farsi: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class LessonMove(BaseModel):
    """Represents a lesson that needs to be moved as part of the swap."""

    class_id: str
    subject_id: str
    teacher_id: str
    room_id: Optional[str] = None
    from_day: str
    from_period: int
    to_day: str
    to_period: int


class SwapResolution(BaseModel):
    """Result of swap validation with constraint checking."""

    is_valid: bool
    can_proceed_with_warning: bool
    errors: List[ConstraintViolation] = Field(default_factory=list)
    warnings: List[ConstraintViolation] = Field(default_factory=list)
    affected_lessons: List[LessonMove] = Field(default_factory=list)
    total_moves: int = Field(ge=0)
    solve_time_ms: Optional[int] = None


class Lesson(BaseModel):
    """Represents a lesson in the timetable."""

    classId: str
    subjectId: str
    teacherId: str
    roomId: Optional[str] = None
    day: str
    periodIndex: int
    duration: int = 1


class ConstraintData(BaseModel):
    """All constraint data needed for swap validation."""

    teachers: List[Dict[str, Any]]
    subjects: List[Dict[str, Any]]
    rooms: List[Dict[str, Any]]
    classes: List[Dict[str, Any]]
    assignments: List[Lesson]
    timetableData: Dict[str, Any]
    config: Dict[str, Any]
