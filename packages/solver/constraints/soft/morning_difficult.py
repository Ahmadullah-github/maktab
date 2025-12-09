"""Prefer morning periods for difficult subjects constraint.

This soft constraint penalizes scheduling difficult subjects in afternoon
periods, encouraging the solver to place them in morning slots when possible.
"""
import math
from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from ..base import SoftConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class PreferMorningForDifficultConstraint(SoftConstraint):
    """Prefers scheduling difficult subjects in morning periods.
    
    This constraint creates penalty variables for difficult subjects
    scheduled in afternoon periods. The solver minimizes these penalties,
    encouraging morning placement for subjects marked as difficult.
    
    Context requirements:
        - 'data': TimetableData with subjects and preferences
        - 'requests': List of scheduling requests
        - 'start_vars': Dict mapping request index to start time variable
        - 'subject_map': Dict mapping subject ID to index
        - 'num_periods_per_day': Number of periods per day
    
    Attributes:
        weight: Base weight for penalty calculation (default: 50)
        morning_cutoff_ratio: Fraction of day considered "morning" (default: 0.5)
    """
    
    DEFAULT_WEIGHT = 50
    
    def __init__(self, weight: int = DEFAULT_WEIGHT, morning_cutoff_ratio: float = 0.5):
        """Initialize the constraint.
        
        Args:
            weight: Weight for penalty variables (higher = more important)
            morning_cutoff_ratio: Fraction of periods considered morning (0.5 = first half)
        """
        super().__init__(name="prefer_morning_difficult", weight=weight)
        self.morning_cutoff_ratio = morning_cutoff_ratio
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> Optional[List[Any]]:
        """Add penalty variables for difficult subjects not in morning.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing solver state
        
        Returns:
            List of weighted penalty variables to minimize
        """
        data = context.get('data')
        requests = context.get('requests', [])
        start_vars = context.get('start_vars', {})
        subject_map = context.get('subject_map', {})
        num_periods_per_day = context.get('num_periods_per_day', 8)
        
        if not data or not requests or not start_vars:
            return []
        
        # Get weight from preferences if available
        prefs = getattr(data, 'preferences', None)
        if prefs:
            pref_weight = getattr(prefs, 'preferMorningForDifficultWeight', 0.5)
            effective_weight = int(pref_weight * 100)
        else:
            effective_weight = self.weight
        
        if effective_weight <= 0:
            return []
        
        # Calculate morning cutoff period
        morning_cutoff = math.ceil(num_periods_per_day * self.morning_cutoff_ratio)
        
        penalties = []
        subjects = getattr(data, 'subjects', [])
        
        for r_idx, req in enumerate(requests):
            if r_idx not in start_vars:
                continue
            
            subject_id = req.get('subject_id')
            if not subject_id or subject_id not in subject_map:
                continue
            
            s_idx = subject_map[subject_id]
            if s_idx >= len(subjects):
                continue
            
            subject = subjects[s_idx]
            is_difficult = getattr(subject, 'isDifficult', False)
            
            if not is_difficult:
                continue
            
            # Create period-in-day variable
            period_in_day = model.NewIntVar(
                0, num_periods_per_day - 1,
                f'morning_period_in_day_{r_idx}'
            )
            model.AddModuloEquality(
                period_in_day,
                start_vars[r_idx],
                num_periods_per_day
            )
            
            # Create penalty for afternoon scheduling
            is_afternoon = model.NewBoolVar(f'morning_difficult_afternoon_{r_idx}')
            model.Add(period_in_day >= morning_cutoff).OnlyEnforceIf(is_afternoon)
            model.Add(period_in_day < morning_cutoff).OnlyEnforceIf(is_afternoon.Not())
            
            # Add weighted penalty
            penalties.append(effective_weight * is_afternoon)
        
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
            weight = getattr(prefs, 'preferMorningForDifficultWeight', 0.5)
            return weight > 0
        
        return True


def register_morning_difficult_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the prefer morning for difficult constraint.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(
        PreferMorningForDifficultConstraint(),
        ConstraintStage.IMPORTANT
    )
