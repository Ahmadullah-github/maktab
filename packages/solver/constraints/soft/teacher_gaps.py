"""Avoid teacher gaps constraint.

This soft constraint penalizes gaps (free periods) in a teacher's daily
schedule, encouraging compact schedules without idle time between lessons.
"""
from typing import Any, Dict, List, Optional
from collections import defaultdict

from ortools.sat.python import cp_model

from ..base import SoftConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class AvoidTeacherGapsConstraint(SoftConstraint):
    """Minimizes gaps in teacher schedules.
    
    A gap occurs when a teacher has a free period between two scheduled
    lessons on the same day. This constraint creates penalty variables
    for such gaps, encouraging the solver to create compact schedules.
    
    Context requirements:
        - 'data': TimetableData with teachers and preferences
        - 'requests': List of scheduling requests
        - 'start_vars': Dict mapping request index to start time variable
        - 'teacher_vars': Dict mapping request index to teacher variable
        - 'teacher_map': Dict mapping teacher ID to index
        - 'num_days': Number of days in the schedule
        - 'num_periods_per_day': Number of periods per day
    
    Attributes:
        weight: Base weight for penalty calculation (default: 100)
    """
    
    DEFAULT_WEIGHT = 100
    
    def __init__(self, weight: int = DEFAULT_WEIGHT):
        """Initialize the constraint.
        
        Args:
            weight: Weight for penalty variables (higher = more important)
        """
        super().__init__(name="avoid_teacher_gaps", weight=weight)
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> Optional[List[Any]]:
        """Add penalty variables for gaps in teacher schedules.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing solver state
        
        Returns:
            List of weighted penalty variables to minimize
        """
        data = context.get('data')
        requests = context.get('requests', [])
        start_vars = context.get('start_vars', {})
        teacher_vars = context.get('teacher_vars', {})
        teacher_map = context.get('teacher_map', {})
        num_days = context.get('num_days', 5)
        num_periods_per_day = context.get('num_periods_per_day', 8)
        
        if not data or not requests or not start_vars:
            return []
        
        # Get weight from preferences if available
        prefs = getattr(data, 'preferences', None)
        if prefs:
            pref_weight = getattr(prefs, 'avoidTeacherGapsWeight', 1.0)
            effective_weight = int(pref_weight * 100)
        else:
            effective_weight = self.weight
        
        if effective_weight <= 0:
            return []
        
        penalties = []
        teachers = getattr(data, 'teachers', [])
        
        # Group requests by teacher
        # For each teacher, we need to track their lessons per day
        # and penalize gaps between them
        
        # First, identify which requests are assigned to which teachers
        # This is complex because teacher assignment may be a decision variable
        
        # For simplicity, we'll create gap penalties based on the
        # teacher assignment variables
        
        # Group requests that could be assigned to each teacher
        teacher_requests: Dict[int, List[int]] = defaultdict(list)
        
        for r_idx, req in enumerate(requests):
            if r_idx not in start_vars:
                continue
            
            # Get possible teachers for this request
            teacher_ids = req.get('teacher_ids', [])
            if not teacher_ids:
                continue
            
            for t_id in teacher_ids:
                if t_id in teacher_map:
                    t_idx = teacher_map[t_id]
                    teacher_requests[t_idx].append(r_idx)
        
        # For each teacher with multiple requests, add gap penalties
        for t_idx, req_indices in teacher_requests.items():
            if len(req_indices) < 2:
                continue
            
            # Create day variables for each request
            day_vars = {}
            period_vars = {}
            
            for r_idx in req_indices:
                if r_idx not in start_vars:
                    continue
                
                # Day variable
                day_var = model.NewIntVar(
                    0, num_days - 1,
                    f'teacher_gap_day_{t_idx}_{r_idx}'
                )
                periods_per_day_const = model.NewConstant(num_periods_per_day)
                model.AddDivisionEquality(day_var, start_vars[r_idx], periods_per_day_const)
                day_vars[r_idx] = day_var
                
                # Period-in-day variable
                period_var = model.NewIntVar(
                    0, num_periods_per_day - 1,
                    f'teacher_gap_period_{t_idx}_{r_idx}'
                )
                model.AddModuloEquality(period_var, start_vars[r_idx], num_periods_per_day)
                period_vars[r_idx] = period_var
            
            # For pairs of requests on the same day, penalize gaps
            req_list = list(day_vars.keys())
            for i in range(len(req_list)):
                for j in range(i + 1, len(req_list)):
                    r_i, r_j = req_list[i], req_list[j]
                    
                    # Check if both requests are assigned to this teacher
                    # (if teacher_vars exist and are decision variables)
                    if r_i in teacher_vars and r_j in teacher_vars:
                        # Create boolean for "both assigned to this teacher"
                        both_assigned = model.NewBoolVar(
                            f'both_teacher_{t_idx}_{r_i}_{r_j}'
                        )
                        is_i_assigned = model.NewBoolVar(f'is_t{t_idx}_r{r_i}')
                        is_j_assigned = model.NewBoolVar(f'is_t{t_idx}_r{r_j}')
                        
                        model.Add(teacher_vars[r_i] == t_idx).OnlyEnforceIf(is_i_assigned)
                        model.Add(teacher_vars[r_i] != t_idx).OnlyEnforceIf(is_i_assigned.Not())
                        model.Add(teacher_vars[r_j] == t_idx).OnlyEnforceIf(is_j_assigned)
                        model.Add(teacher_vars[r_j] != t_idx).OnlyEnforceIf(is_j_assigned.Not())
                        
                        model.AddBoolAnd([is_i_assigned, is_j_assigned]).OnlyEnforceIf(both_assigned)
                        model.AddBoolOr([is_i_assigned.Not(), is_j_assigned.Not()]).OnlyEnforceIf(both_assigned.Not())
                    else:
                        # No teacher decision variable, assume both are assigned
                        both_assigned = model.NewConstant(1)
                    
                    # Check if same day
                    same_day = model.NewBoolVar(f'teacher_same_day_{t_idx}_{r_i}_{r_j}')
                    model.Add(day_vars[r_i] == day_vars[r_j]).OnlyEnforceIf(same_day)
                    model.Add(day_vars[r_i] != day_vars[r_j]).OnlyEnforceIf(same_day.Not())
                    
                    # Calculate gap (absolute difference - 1)
                    # Gap exists if |period_i - period_j| > 1
                    diff = model.NewIntVar(
                        -(num_periods_per_day - 1), num_periods_per_day - 1,
                        f'teacher_gap_diff_{t_idx}_{r_i}_{r_j}'
                    )
                    model.Add(diff == period_vars[r_i] - period_vars[r_j])
                    
                    abs_diff = model.NewIntVar(
                        0, num_periods_per_day - 1,
                        f'teacher_gap_abs_{t_idx}_{r_i}_{r_j}'
                    )
                    model.AddAbsEquality(abs_diff, diff)
                    
                    # Penalty if gap > 1 (not consecutive)
                    has_gap = model.NewBoolVar(f'teacher_has_gap_{t_idx}_{r_i}_{r_j}')
                    model.Add(abs_diff > 1).OnlyEnforceIf(has_gap)
                    model.Add(abs_diff <= 1).OnlyEnforceIf(has_gap.Not())
                    
                    # Combined penalty: both assigned AND same day AND has gap
                    penalty_active = model.NewBoolVar(f'teacher_gap_penalty_{t_idx}_{r_i}_{r_j}')
                    
                    if isinstance(both_assigned, int) or (hasattr(both_assigned, 'Index') and both_assigned.Index() == -1):
                        # both_assigned is a constant (always true)
                        model.AddBoolAnd([same_day, has_gap]).OnlyEnforceIf(penalty_active)
                        model.AddBoolOr([same_day.Not(), has_gap.Not()]).OnlyEnforceIf(penalty_active.Not())
                    else:
                        model.AddBoolAnd([both_assigned, same_day, has_gap]).OnlyEnforceIf(penalty_active)
                        model.AddBoolOr([both_assigned.Not(), same_day.Not(), has_gap.Not()]).OnlyEnforceIf(penalty_active.Not())
                    
                    penalties.append(effective_weight * penalty_active)
        
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
            weight = getattr(prefs, 'avoidTeacherGapsWeight', 1.0)
            return weight > 0
        
        return True


def register_teacher_gaps_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the avoid teacher gaps constraint.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(
        AvoidTeacherGapsConstraint(),
        ConstraintStage.IMPORTANT
    )
