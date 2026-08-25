"""Hard constraints module.

Hard constraints are constraints that must always be satisfied.
They are applied at the ESSENTIAL stage.
"""

from .class_teacher import ClassTeacherMinLessonConstraint
from .consecutive import ConsecutiveConstraint
from .no_overlap import (
    NoClassOverlapConstraint,
    NoRoomOverlapConstraint,
    NoTeacherOverlapConstraint,
)
from .same_day import SameDayConstraint

__all__ = [
    "NoClassOverlapConstraint",
    "NoTeacherOverlapConstraint",
    "NoRoomOverlapConstraint",
    "SameDayConstraint",
    "ConsecutiveConstraint",
    "ClassTeacherMinLessonConstraint",
]
