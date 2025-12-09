"""Soft constraints for timetable scheduling.

Soft constraints are optimization objectives that the solver tries to satisfy
but can be violated if necessary. They return penalty variables that are
minimized during solving.
"""
from .morning_difficult import PreferMorningForDifficultConstraint
from .teacher_gaps import AvoidTeacherGapsConstraint
from .subject_spread import SubjectSpreadConstraint

__all__ = [
    'PreferMorningForDifficultConstraint',
    'AvoidTeacherGapsConstraint',
    'SubjectSpreadConstraint',
]


def register_soft_constraints(registry=None):
    """Register all soft constraints with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    from ..registry import ConstraintRegistry, ConstraintStage
    
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    # Register soft constraints at IMPORTANT stage by default
    registry.register(PreferMorningForDifficultConstraint(), ConstraintStage.IMPORTANT)
    registry.register(AvoidTeacherGapsConstraint(), ConstraintStage.IMPORTANT)
    registry.register(SubjectSpreadConstraint(), ConstraintStage.IMPORTANT)
