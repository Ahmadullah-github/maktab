# ==============================================================================
#
#  Swap Solver Data Models
#
#  Description:
#  Pydantic data models for swap validation and constraint checking.
#  These models define the data contract for the swap solver.
#
# ==============================================================================

from typing import Any

from pydantic import AliasChoices, BaseModel, Field, model_validator


class SlotIdentifier(BaseModel):
    """Identifies a specific time slot in the timetable."""

    classId: str = Field(min_length=1)
    day: str = Field(min_length=1)
    period: int = Field(ge=0)


class SwapRequest(BaseModel):
    """Request to swap two lessons in the timetable."""

    timetable_id: int = Field(ge=1, validation_alias=AliasChoices("timetable_id", "timetableId"))
    source_slot: SlotIdentifier = Field(validation_alias=AliasChoices("source_slot", "sourceSlot"))
    target_slot: SlotIdentifier = Field(validation_alias=AliasChoices("target_slot", "targetSlot"))


class ConstraintViolation(BaseModel):
    """Represents a constraint violation."""

    type: str = Field(min_length=1)
    severity: str = Field(pattern="^(hard|soft)$")
    message: str = Field(min_length=1)
    message_farsi: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)


class LessonMove(BaseModel):
    """Represents a lesson that needs to be moved as part of the swap."""

    class_id: str
    subject_id: str
    teacher_id: str
    teacher_ids: list[str] = Field(default_factory=list)
    room_id: str | None = None
    from_day: str
    from_period: int
    to_day: str
    to_period: int


class SwapResolution(BaseModel):
    """Result of swap validation with constraint checking."""

    is_valid: bool
    can_proceed_with_warning: bool
    errors: list[ConstraintViolation] = Field(default_factory=list)
    warnings: list[ConstraintViolation] = Field(default_factory=list)
    affected_lessons: list[LessonMove] = Field(default_factory=list)
    total_moves: int = Field(ge=0)
    solve_time_ms: int | None = None


class Lesson(BaseModel):
    """Represents a lesson in the timetable."""

    classId: str
    subjectId: str
    teacherIds: list[str] = Field(default_factory=list)
    roomId: str | None = None
    day: str
    periodIndex: int
    duration: int = 1

    @model_validator(mode="before")
    @classmethod
    def normalize_teacher_ids(cls, value: Any) -> Any:
        """Accept both legacy teacherId and canonical teacherIds payloads."""
        if not isinstance(value, dict):
            return value
        normalized = dict(value)
        teacher_ids = normalized.get("teacherIds")
        if not isinstance(teacher_ids, list) or not teacher_ids:
            legacy_teacher_id = normalized.get("teacherId")
            if legacy_teacher_id is not None:
                normalized["teacherIds"] = [str(legacy_teacher_id)]
        else:
            normalized["teacherIds"] = [str(teacher_id) for teacher_id in teacher_ids]
        return normalized

    @model_validator(mode="after")
    def require_teacher(self) -> "Lesson":
        if not self.teacherIds:
            raise ValueError("Lesson must contain at least one teacher")
        return self

    @property
    def teacherId(self) -> str:
        """Legacy primary-teacher accessor used by response compatibility paths."""
        return self.teacherIds[0]


class ConstraintData(BaseModel):
    """All constraint data needed for swap validation."""

    teachers: list[dict[str, Any]]
    subjects: list[dict[str, Any]]
    rooms: list[dict[str, Any]]
    classes: list[dict[str, Any]]
    assignments: list[Lesson]
    timetableData: dict[str, Any]
    config: dict[str, Any]
