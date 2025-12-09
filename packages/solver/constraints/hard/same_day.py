"""Same-day constraint for multi-period lessons.

This constraint ensures that multi-period lessons (lessons that span
multiple consecutive periods) are scheduled entirely within the same day.
"""
from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from ..base import HardConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class SameDayConstraint(HardConstraint):
    """Ensures multi-period lessons don't span multiple days.
    
    When a lesson requires multiple consecutive periods (e.g., a 2-period
    lab session), this constraint ensures that all periods of the lesson
    are scheduled on the same day.
    
    This is implemented by:
    1. Computing the start day from the start slot
    2. Computing the end day from the end slot (start + length - 1)
    3. Adding a constraint that start_day == end_day
    """
    
    def __init__(self):
        super().__init__(name="same_day")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Add same-day constraints for multi-period lessons.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing:
                - 'requests': List of scheduling requests with 'length' field
                - 'start_vars': List of start time decision variables
                - 'num_periods_per_day': Number of periods per day
                - 'num_days': Number of days in the schedule
                - 'num_slots': Total number of time slots
        """
        requests = context.get('requests', [])
        start_vars = context.get('start_vars', [])
        num_periods_per_day = context.get('num_periods_per_day', 1)
        num_days = context.get('num_days', 1)
        num_slots = context.get('num_slots', num_days * num_periods_per_day)
        
        if not requests or not start_vars:
            return
        
        # Create a constant for periods per day
        periods_per_day_var = model.NewConstant(num_periods_per_day)
        
        for r_idx, req in enumerate(requests):
            start = start_vars[r_idx]
            length = req.get('length', 1)
            
            # Create start day variable
            start_day = model.NewIntVar(0, num_days - 1, f'same_day_start_{r_idx}')
            model.AddDivisionEquality(start_day, start, periods_per_day_var)
            
            # For multi-period requests, ensure they fit within the same day
            if length > 1:
                # Calculate end slot (start + length - 1)
                end_slot = model.NewIntVar(0, num_slots - 1, f'same_day_end_slot_{r_idx}')
                model.Add(end_slot == start + length - 1)
                
                # Calculate end day
                end_day = model.NewIntVar(0, num_days - 1, f'same_day_end_{r_idx}')
                model.AddDivisionEquality(end_day, end_slot, periods_per_day_var)
                
                # Ensure start and end are on the same day
                model.Add(start_day == end_day)
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied.
        
        Only applies if there are multi-period requests.
        """
        if not self.enabled:
            return False
        
        requests = context.get('requests', [])
        # Check if any request has length > 1
        return any(req.get('length', 1) > 1 for req in requests)


def register_same_day_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the same-day constraint with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(SameDayConstraint(), ConstraintStage.ESSENTIAL)
