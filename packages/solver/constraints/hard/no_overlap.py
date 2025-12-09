"""No-overlap constraints for timetable scheduling.

These constraints ensure that resources (classes, teachers, rooms) cannot
be double-booked at the same time slot.
"""
from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from ..base import HardConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class NoClassOverlapConstraint(HardConstraint):
    """Ensures a class cannot have two lessons at the same time.
    
    This constraint uses interval variables and the AddNoOverlap constraint
    to prevent any class from being scheduled for multiple lessons
    simultaneously.
    """
    
    def __init__(self):
        super().__init__(name="no_class_overlap")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Add no-overlap intervals for each class.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing:
                - 'class_intervals': Dict mapping class index to list of interval variables
        """
        class_intervals = context.get('class_intervals', {})
        
        for c_idx, intervals in class_intervals.items():
            if intervals:
                model.AddNoOverlap(intervals)
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied."""
        if not self.enabled:
            return False
        class_intervals = context.get('class_intervals', {})
        return len(class_intervals) > 0


class NoTeacherOverlapConstraint(HardConstraint):
    """Ensures a teacher cannot teach two lessons at the same time.
    
    This constraint uses optional interval variables (since teacher assignment
    may be a decision variable) and the AddNoOverlap constraint to prevent
    any teacher from being scheduled for multiple lessons simultaneously.
    """
    
    def __init__(self):
        super().__init__(name="no_teacher_overlap")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Add no-overlap intervals for each teacher.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing:
                - 'teacher_intervals': Dict mapping teacher index to list of interval variables
        """
        teacher_intervals = context.get('teacher_intervals', {})
        
        for t_idx, intervals in teacher_intervals.items():
            if intervals:
                model.AddNoOverlap(intervals)
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied."""
        if not self.enabled:
            return False
        teacher_intervals = context.get('teacher_intervals', {})
        return len(teacher_intervals) > 0


class NoRoomOverlapConstraint(HardConstraint):
    """Ensures a room cannot host two lessons at the same time.
    
    This constraint uses optional interval variables (since room assignment
    may be a decision variable) and the AddNoOverlap constraint to prevent
    any room from being used for multiple lessons simultaneously.
    """
    
    def __init__(self):
        super().__init__(name="no_room_overlap")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Add no-overlap intervals for each room.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing:
                - 'room_intervals': Dict mapping room index to list of interval variables
        """
        room_intervals = context.get('room_intervals', {})
        
        for rm_idx, intervals in room_intervals.items():
            if intervals:
                model.AddNoOverlap(intervals)
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied."""
        if not self.enabled:
            return False
        room_intervals = context.get('room_intervals', {})
        return len(room_intervals) > 0


def register_no_overlap_constraints(registry: ConstraintRegistry = None) -> None:
    """Register all no-overlap constraints with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(NoClassOverlapConstraint(), ConstraintStage.ESSENTIAL)
    registry.register(NoTeacherOverlapConstraint(), ConstraintStage.ESSENTIAL)
    registry.register(NoRoomOverlapConstraint(), ConstraintStage.ESSENTIAL)
