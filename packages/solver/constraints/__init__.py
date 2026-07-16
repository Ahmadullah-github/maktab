"""Constraints module."""
from .base import Constraint, HardConstraint, SoftConstraint
from .registry import ConstraintRegistry, ConstraintStage, ConstraintPriority
from .hard import (
    NoClassOverlapConstraint,
    NoTeacherOverlapConstraint,
    NoRoomOverlapConstraint,
    SameDayConstraint,
    ConsecutiveConstraint,
)
from .hard.no_overlap import register_no_overlap_constraints
from .hard.same_day import register_same_day_constraint
from .hard.consecutive import register_consecutive_constraint

__all__ = [
    # Base classes
    'Constraint',
    'HardConstraint',
    'SoftConstraint',
    # Registry
    'ConstraintRegistry',
    'ConstraintStage',
    'ConstraintPriority',
    # Hard constraints
    'NoClassOverlapConstraint',
    'NoTeacherOverlapConstraint',
    'NoRoomOverlapConstraint',
    'SameDayConstraint',
    'ConsecutiveConstraint',
    # Registration functions
    'register_no_overlap_constraints',
    'register_same_day_constraint',
    'register_consecutive_constraint',
    'register_all_hard_constraints',
    'register_all_constraints',
]


def register_all_hard_constraints(registry: ConstraintRegistry = None) -> None:
    """Register all hard constraints with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    register_no_overlap_constraints(registry)
    register_same_day_constraint(registry)
    register_consecutive_constraint(registry)


def register_all_constraints(registry: ConstraintRegistry = None) -> None:
    """Register hard constraints; canonical objectives are built by TimetableSolver."""
    register_all_hard_constraints(registry)
