"""Hard constraints module.

Hard constraints are constraints that must always be satisfied.
They are applied at the ESSENTIAL stage.
"""
from .no_overlap import (
    NoClassOverlapConstraint,
    NoTeacherOverlapConstraint,
    NoRoomOverlapConstraint,
)
from .same_day import SameDayConstraint
from .consecutive import ConsecutiveConstraint
from .class_teacher import ClassTeacherMinLessonConstraint

__all__ = [
    'NoClassOverlapConstraint',
    'NoTeacherOverlapConstraint',
    'NoRoomOverlapConstraint',
    'SameDayConstraint',
    'ConsecutiveConstraint',
    'ClassTeacherMinLessonConstraint',
]
