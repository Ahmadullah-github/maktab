"""Subject spread across days constraint.

This soft constraint penalizes scheduling multiple lessons of the same
subject for the same class on the same day, encouraging distribution
across different days of the week.
"""
from typing import Any, Dict, List, Optional
from collections import defaultdict

from ortools.sat.python import cp_model

from ..base import SoftConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class SubjectSpreadConstraint(SoftConstraint):
    """Spreads subject lessons across different days.
    
    This constraint creates penalty variables when multiple lessons of
    the same subject for the same class are scheduled on the same day.
    The solver minimizes these penalties, encouraging better distribution.
    
    Context requirements:
        - 'data': TimetableData with preferences
        - 'requests': List of scheduling requests
        - 'start_vars': Dict mapping request index to start time variable
        - 'num_days': Number of days in the schedule
        - 'num_periods_per_day': Number of periods per day
    
    Attributes:
        weight: Base weight for penalty calculation (default: 50)
    """
    
    DEFAULT_WEIGHT = 50
    
    def __init__(self, weight: int = DEFAULT_WEIGHT):
        """Initialize the constraint.
        
        Args:
            weight: Weight for penalty variables (higher = more important)
        """
        super().__init__(name="subject_spread", weight=weight)
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> Optional[List[Any]]:
        """Add penalty variables for same-day subject clustering.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing solver state
        
        Returns:
            List of weighted penalty variables to minimize
        """
        data = context.get('data')
        requests = context.get('requests', [])
        start_vars = context.get('start_vars', {})
        num_days = context.get('num_days', 5)
        num_periods_per_day = context.get('num_periods_per_day', 8)
        
        if not data or not requests or not start_vars:
            return []
        
        # Get weight from preferences if available
        prefs = getattr(data, 'preferences', None)
        if prefs:
            pref_weight = getattr(prefs, 'subjectSpreadWeight', 0.0)
            effective_weight = int(pref_weight * 100)
        else:
            effective_weight = self.weight
        
        if effective_weight <= 0:
            return []
        
        penalties = []
        
        # Group requests by (class_id, subject_id)
        pair_to_indices: Dict[tuple, List[int]] = defaultdict(list)
        for idx, req in enumerate(requests):
            if idx not in start_vars:
                continue
            
            class_id = req.get('class_id')
            subject_id = req.get('subject_id')
            
            if class_id and subject_id:
                pair_to_indices[(class_id, subject_id)].append(idx)
        
        # Create constant for division
        periods_per_day_const = model.NewConstant(num_periods_per_day)
        
        # For each class-subject pair with multiple lessons
        for (c_id, s_id), indices in pair_to_indices.items():
            if len(indices) <= 1:
                continue
            
            # Create day variables for each request
            day_vars = []
            for r_idx in indices:
                day = model.NewIntVar(
                    0, num_days - 1,
                    f'spread_day_{c_id}_{s_id}_{r_idx}'
                )
                model.AddDivisionEquality(day, start_vars[r_idx], periods_per_day_const)
                day_vars.append((r_idx, day))
            
            # Pairwise same-day penalties
            for i in range(len(day_vars)):
                for j in range(i + 1, len(day_vars)):
                    r_i, day_i = day_vars[i]
                    r_j, day_j = day_vars[j]
                    
                    same_day = model.NewBoolVar(
                        f'spread_same_day_{c_id}_{s_id}_{r_i}_{r_j}'
                    )
                    
                    # day_i == day_j <=> same_day
                    model.Add(day_i == day_j).OnlyEnforceIf(same_day)
                    model.Add(day_i != day_j).OnlyEnforceIf(same_day.Not())
                    
                    penalties.append(effective_weight * same_day)
        
        return penalties
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied.
        
        Returns False if:
        - Constraint is disabled
        - No preferences are set
        - Weight is zero or negative
        """
        if not self.enabled:
            return False
        
        data = context.get('data')
        if not data:
            return False
        
        prefs = getattr(data, 'preferences', None)
        if prefs:
            weight = getattr(prefs, 'subjectSpreadWeight', 0.0)
            return weight > 0
        
        # Default to not applying if no explicit weight set
        return False


def register_subject_spread_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the subject spread constraint.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(
        SubjectSpreadConstraint(),
        ConstraintStage.IMPORTANT
    )
