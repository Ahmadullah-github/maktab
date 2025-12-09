"""Consecutive period constraints for Afghanistan school rules.

This module implements the consecutive period constraints specific to
the Afghanistan education system:
- Rule 1: Max 2 periods per day per subject (ALWAYS)
- Rule 2a: If consecutive DISABLED (=1), max 1 period per day
- Rule 2b: If consecutive ENABLED (>=2), if 2 periods on same day they MUST be adjacent
"""
import collections
from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from ..base import HardConstraint
from ..registry import ConstraintRegistry, ConstraintStage


class ConsecutiveConstraint(HardConstraint):
    """Enforces consecutive period rules for subjects.
    
    Afghanistan School Rules:
    1. Max 2 periods per day per subject (ALWAYS enforced)
    2a. If consecutive DISABLED (consecutivePeriods=1), max 1 period per day
    2b. If consecutive ENABLED (consecutivePeriods>=2), if 2 periods on same day
        they MUST be adjacent (no gap between them)
    
    This constraint groups lessons by (class, subject, day) and applies
    the appropriate rules based on the subject's consecutive setting.
    """
    
    def __init__(self):
        super().__init__(name="consecutive_periods")
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        """Apply consecutive period constraints.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing:
                - 'requests': List of scheduling requests
                - 'start_vars': List of start time decision variables
                - 'data': TimetableData with class and subject information
                - 'class_map': Dict mapping class ID to index
                - 'num_days': Number of days in the schedule
                - 'num_periods_per_day': Number of periods per day
        """
        requests = context.get('requests', [])
        start_vars = context.get('start_vars', [])
        data = context.get('data')
        class_map = context.get('class_map', {})
        num_days = context.get('num_days', 1)
        num_periods_per_day = context.get('num_periods_per_day', 1)
        
        if not requests or not start_vars or not data:
            return
        
        # Group requests by (class, subject, day) to track lessons per day
        class_subject_day_lessons = collections.defaultdict(
            lambda: collections.defaultdict(
                lambda: collections.defaultdict(list)
            )
        )
        
        # First pass: create day/period variables and group lessons
        for r_idx, req in enumerate(requests):
            class_id = req['class_id']
            subject_id = req['subject_id']
            
            start = start_vars[r_idx]
            
            # Create day variable
            start_day = model.NewIntVar(0, num_days - 1, f'consec_day_{r_idx}')
            model.AddDivisionEquality(start_day, start, model.NewConstant(num_periods_per_day))
            
            # Create period variable (period within the day)
            start_period = model.NewIntVar(0, num_periods_per_day - 1, f'consec_period_{r_idx}')
            model.AddModuloEquality(start_period, start, num_periods_per_day)
            
            # Store for each possible day
            for day_idx in range(num_days):
                class_subject_day_lessons[class_id][subject_id][day_idx].append({
                    'r_idx': r_idx,
                    'start_day': start_day,
                    'start_period': start_period,
                    'length': req.get('length', 1)
                })
        
        # Second pass: apply constraints
        for class_id, subjects in class_subject_day_lessons.items():
            c_idx = class_map.get(class_id)
            if c_idx is None:
                continue
            
            class_group = data.classes[c_idx]
            
            for subject_id, days in subjects.items():
                subject_req = class_group.subjectRequirements.get(subject_id)
                if not subject_req:
                    continue
                
                # Get consecutive setting (default to 1 if not set)
                consecutive_setting = getattr(subject_req, 'consecutivePeriods', None)
                if consecutive_setting is None:
                    consecutive_setting = 1
                
                for day_idx, lessons in days.items():
                    if len(lessons) == 0:
                        continue
                    
                    self._apply_day_constraints(
                        model, lessons, day_idx, consecutive_setting,
                        class_id, subject_id, num_periods_per_day
                    )
    
    def _apply_day_constraints(
        self,
        model: cp_model.CpModel,
        lessons: List[Dict],
        day_idx: int,
        consecutive_setting: int,
        class_id: str,
        subject_id: str,
        num_periods_per_day: int
    ) -> None:
        """Apply constraints for lessons of a subject on a specific day.
        
        Args:
            model: CP-SAT model
            lessons: List of lesson info dicts for this day
            day_idx: Day index
            consecutive_setting: The consecutivePeriods setting for this subject
            class_id: Class ID for naming
            subject_id: Subject ID for naming
            num_periods_per_day: Number of periods per day
        """
        # Count how many lessons of this subject are actually on this day
        lessons_on_day_bools = []
        for lesson in lessons:
            is_on_day = model.NewBoolVar(f'on_day_{lesson["r_idx"]}_{day_idx}')
            model.Add(lesson['start_day'] == day_idx).OnlyEnforceIf(is_on_day)
            model.Add(lesson['start_day'] != day_idx).OnlyEnforceIf(is_on_day.Not())
            lessons_on_day_bools.append(is_on_day)
        
        lessons_count = model.NewIntVar(0, len(lessons), f'count_{class_id}_{subject_id}_{day_idx}')
        model.Add(lessons_count == sum(lessons_on_day_bools))
        
        # HARD CONSTRAINT 1: Max 2 periods per day per subject (ALWAYS)
        model.Add(lessons_count <= 2)
        
        if consecutive_setting == 1:
            # HARD CONSTRAINT 2a: If consecutive DISABLED, max 1 period per day
            model.Add(lessons_count <= 1)
        
        elif consecutive_setting >= 2:
            # HARD CONSTRAINT 2b: If 2 lessons on same day, they MUST be adjacent
            if len(lessons) >= 2:
                self._apply_adjacency_constraints(
                    model, lessons, lessons_on_day_bools, day_idx, num_periods_per_day
                )
    
    def _apply_adjacency_constraints(
        self,
        model: cp_model.CpModel,
        lessons: List[Dict],
        lessons_on_day_bools: List,
        day_idx: int,
        num_periods_per_day: int
    ) -> None:
        """Apply adjacency constraints when consecutive periods are enabled.
        
        If two lessons of the same subject are on the same day, they must
        be adjacent (no gap between them).
        
        Args:
            model: CP-SAT model
            lessons: List of lesson info dicts
            lessons_on_day_bools: Boolean variables indicating if each lesson is on this day
            day_idx: Day index
            num_periods_per_day: Number of periods per day
        """
        # Check all pairs of lessons
        for i, lesson_i in enumerate(lessons):
            for j, lesson_j in enumerate(lessons[i+1:], start=i+1):
                # Boolean: are both lessons on this day?
                both_on_day = model.NewBoolVar(
                    f'both_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}_day_{day_idx}'
                )
                is_i_on_day = lessons_on_day_bools[i]
                is_j_on_day = lessons_on_day_bools[j]
                
                model.AddBoolAnd([is_i_on_day, is_j_on_day]).OnlyEnforceIf(both_on_day)
                model.AddBoolOr([is_i_on_day.Not(), is_j_on_day.Not()]).OnlyEnforceIf(both_on_day.Not())
                
                # If both on same day, they MUST be adjacent (no gap)
                # Adjacent means: period_j == period_i + length_i OR period_i == period_j + length_j
                
                # Calculate end periods
                end_i = model.NewIntVar(0, num_periods_per_day, f'end_{lesson_i["r_idx"]}')
                model.Add(end_i == lesson_i['start_period'] + lesson_i['length'])
                
                end_j = model.NewIntVar(0, num_periods_per_day, f'end_{lesson_j["r_idx"]}')
                model.Add(end_j == lesson_j['start_period'] + lesson_j['length'])
                
                # j immediately after i (no gap)
                j_after_i = model.NewBoolVar(f'j_after_i_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}')
                model.Add(lesson_j['start_period'] == end_i).OnlyEnforceIf(j_after_i)
                
                # i immediately after j (no gap)
                i_after_j = model.NewBoolVar(f'i_after_j_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}')
                model.Add(lesson_i['start_period'] == end_j).OnlyEnforceIf(i_after_j)
                
                # If both on same day, one of these MUST be true (they must be adjacent)
                model.AddBoolOr([j_after_i, i_after_j]).OnlyEnforceIf(both_on_day)
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """Check if this constraint should be applied."""
        if not self.enabled:
            return False
        
        requests = context.get('requests', [])
        data = context.get('data')
        
        return len(requests) > 0 and data is not None


def register_consecutive_constraint(registry: ConstraintRegistry = None) -> None:
    """Register the consecutive constraint with the registry.
    
    Args:
        registry: ConstraintRegistry instance. If None, uses the singleton.
    """
    if registry is None:
        registry = ConstraintRegistry.get_instance()
    
    registry.register(ConsecutiveConstraint(), ConstraintStage.ESSENTIAL)
