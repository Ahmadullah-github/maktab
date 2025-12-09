# ==============================================================================
# Property Tests: Hard Constraint Satisfaction
#
# **Feature: solver-refactoring, Property 19: Hard Constraint Satisfaction**
# **Validates: Requirements 10.3**
#
# For any valid input data, the solver SHALL never produce a solution that
# violates any hard constraint (no class overlap, no teacher overlap,
# no room overlap, consecutive lessons adjacent).
# ==============================================================================

from typing import Any, Dict, List, Optional
import collections

import pytest
from hypothesis import given, strategies as st, settings, assume
from ortools.sat.python import cp_model

from constraints import ConstraintRegistry, ConstraintStage
from constraints.hard import (
    NoClassOverlapConstraint,
    NoTeacherOverlapConstraint,
    NoRoomOverlapConstraint,
    SameDayConstraint,
    ConsecutiveConstraint,
)


# ==============================================================================
# Hypothesis Strategies
# ==============================================================================

@st.composite
def scheduling_request_strategy(draw, num_classes: int, num_subjects: int, num_teachers: int):
    """Generate a valid scheduling request."""
    class_idx = draw(st.integers(min_value=0, max_value=max(0, num_classes - 1)))
    subject_idx = draw(st.integers(min_value=0, max_value=max(0, num_subjects - 1)))
    teacher_idx = draw(st.integers(min_value=0, max_value=max(0, num_teachers - 1)))
    length = draw(st.integers(min_value=1, max_value=2))
    
    return {
        'class_id': f'CLASS_{class_idx}',
        'subject_id': f'SUBJ_{subject_idx}',
        'teacher_id': f'TEACHER_{teacher_idx}',
        'length': length,
        'class_idx': class_idx,
        'teacher_idx': teacher_idx,
    }


@st.composite
def small_problem_strategy(draw):
    """Generate a small scheduling problem for testing constraints."""
    num_days = draw(st.integers(min_value=2, max_value=5))
    num_periods = draw(st.integers(min_value=4, max_value=8))
    num_classes = draw(st.integers(min_value=1, max_value=3))
    num_teachers = draw(st.integers(min_value=1, max_value=3))
    num_rooms = draw(st.integers(min_value=1, max_value=3))
    num_subjects = draw(st.integers(min_value=1, max_value=3))
    num_requests = draw(st.integers(min_value=2, max_value=6))
    
    requests = []
    for i in range(num_requests):
        req = draw(scheduling_request_strategy(num_classes, num_subjects, num_teachers))
        req['r_idx'] = i
        requests.append(req)
    
    return {
        'num_days': num_days,
        'num_periods_per_day': num_periods,
        'num_slots': num_days * num_periods,
        'num_classes': num_classes,
        'num_teachers': num_teachers,
        'num_rooms': num_rooms,
        'num_subjects': num_subjects,
        'requests': requests,
    }


# ==============================================================================
# Helper Functions
# ==============================================================================

def create_model_with_variables(problem: Dict) -> tuple:
    """Create a CP-SAT model with variables for the given problem.
    
    Returns:
        Tuple of (model, context) where context contains all variables and data.
    """
    model = cp_model.CpModel()
    
    num_slots = problem['num_slots']
    num_days = problem['num_days']
    num_periods = problem['num_periods_per_day']
    requests = problem['requests']
    
    # Create decision variables
    start_vars = []
    class_intervals = collections.defaultdict(list)
    teacher_intervals = collections.defaultdict(list)
    room_intervals = collections.defaultdict(list)
    
    for r_idx, req in enumerate(requests):
        length = req['length']
        class_idx = req['class_idx']
        teacher_idx = req['teacher_idx']
        
        # Ensure lesson fits within a day
        max_start = num_slots - length
        start_var = model.NewIntVar(0, max_start, f'start_{r_idx}')
        start_vars.append(start_var)
        
        # Create interval for class
        end_var = model.NewIntVar(0, num_slots, f'end_{r_idx}')
        model.Add(end_var == start_var + length)
        interval = model.NewIntervalVar(start_var, length, end_var, f'interval_{r_idx}')
        class_intervals[class_idx].append(interval)
        
        # Create interval for teacher (using same interval for simplicity)
        teacher_intervals[teacher_idx].append(interval)
        
        # Create interval for room (assign to room 0 for simplicity)
        room_intervals[0].append(interval)
    
    context = {
        'requests': requests,
        'start_vars': start_vars,
        'class_intervals': dict(class_intervals),
        'teacher_intervals': dict(teacher_intervals),
        'room_intervals': dict(room_intervals),
        'num_days': num_days,
        'num_periods_per_day': num_periods,
        'num_slots': num_slots,
    }
    
    return model, context


def solve_and_get_solution(model: cp_model.CpModel, start_vars: List) -> Optional[List[int]]:
    """Solve the model and return the solution values for start variables.
    
    Returns:
        List of start times if solution found, None otherwise.
    """
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    status = solver.Solve(model)
    
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [solver.Value(var) for var in start_vars]
    return None


def check_no_overlap(solution: List[int], requests: List[Dict], group_key: str) -> bool:
    """Check that no two lessons in the same group overlap.
    
    Args:
        solution: List of start times for each request
        requests: List of request dictionaries
        group_key: Key to group by ('class_idx', 'teacher_idx', etc.)
    
    Returns:
        True if no overlaps, False otherwise.
    """
    # Group lessons by the specified key
    groups = collections.defaultdict(list)
    for r_idx, req in enumerate(requests):
        group_id = req.get(group_key, 0)
        start = solution[r_idx]
        end = start + req['length']
        groups[group_id].append((start, end, r_idx))
    
    # Check for overlaps within each group
    for group_id, lessons in groups.items():
        # Sort by start time
        lessons.sort(key=lambda x: x[0])
        
        for i in range(len(lessons) - 1):
            _, end_i, _ = lessons[i]
            start_j, _, _ = lessons[i + 1]
            
            # If end of lesson i > start of lesson j, they overlap
            if end_i > start_j:
                return False
    
    return True


def check_same_day(solution: List[int], requests: List[Dict], num_periods: int) -> bool:
    """Check that multi-period lessons don't span multiple days.
    
    Args:
        solution: List of start times for each request
        requests: List of request dictionaries
        num_periods: Number of periods per day
    
    Returns:
        True if all multi-period lessons are on same day, False otherwise.
    """
    for r_idx, req in enumerate(requests):
        length = req['length']
        if length > 1:
            start = solution[r_idx]
            end = start + length - 1
            
            start_day = start // num_periods
            end_day = end // num_periods
            
            if start_day != end_day:
                return False
    
    return True


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture(autouse=True)
def reset_registry():
    """Reset the singleton registry before and after each test."""
    ConstraintRegistry.reset_instance()
    yield
    ConstraintRegistry.reset_instance()


# ==============================================================================
# Property Tests
# ==============================================================================

class TestNoOverlapConstraints:
    """
    **Feature: solver-refactoring, Property 19: Hard Constraint Satisfaction**
    **Validates: Requirements 10.3**
    
    Tests that no-overlap constraints prevent double-booking of resources.
    """

    @given(problem=small_problem_strategy())
    @settings(max_examples=100, deadline=30000)
    def test_no_class_overlap_constraint_prevents_double_booking(self, problem):
        """
        For any scheduling problem, applying NoClassOverlapConstraint SHALL
        ensure no class has two lessons at the same time.
        """
        model, context = create_model_with_variables(problem)
        
        # Apply the constraint
        constraint = NoClassOverlapConstraint()
        constraint.apply(model, context)
        
        # Solve
        solution = solve_and_get_solution(model, context['start_vars'])
        
        # If a solution exists, verify no class overlaps
        if solution is not None:
            assert check_no_overlap(
                solution, problem['requests'], 'class_idx'
            ), "Solution violates no-class-overlap constraint"

    @given(problem=small_problem_strategy())
    @settings(max_examples=100, deadline=30000)
    def test_no_teacher_overlap_constraint_prevents_double_booking(self, problem):
        """
        For any scheduling problem, applying NoTeacherOverlapConstraint SHALL
        ensure no teacher teaches two lessons at the same time.
        """
        model, context = create_model_with_variables(problem)
        
        # Apply the constraint
        constraint = NoTeacherOverlapConstraint()
        constraint.apply(model, context)
        
        # Solve
        solution = solve_and_get_solution(model, context['start_vars'])
        
        # If a solution exists, verify no teacher overlaps
        if solution is not None:
            assert check_no_overlap(
                solution, problem['requests'], 'teacher_idx'
            ), "Solution violates no-teacher-overlap constraint"

    @given(problem=small_problem_strategy())
    @settings(max_examples=100, deadline=30000)
    def test_no_room_overlap_constraint_prevents_double_booking(self, problem):
        """
        For any scheduling problem, applying NoRoomOverlapConstraint SHALL
        ensure no room hosts two lessons at the same time.
        """
        model, context = create_model_with_variables(problem)
        
        # Apply the constraint
        constraint = NoRoomOverlapConstraint()
        constraint.apply(model, context)
        
        # Solve
        solution = solve_and_get_solution(model, context['start_vars'])
        
        # If a solution exists, verify no room overlaps
        # All requests use room 0 in our test setup
        if solution is not None:
            # Check that no two lessons overlap (since all use same room)
            lessons = []
            for r_idx, req in enumerate(problem['requests']):
                start = solution[r_idx]
                end = start + req['length']
                lessons.append((start, end))
            
            lessons.sort()
            for i in range(len(lessons) - 1):
                _, end_i = lessons[i]
                start_j, _ = lessons[i + 1]
                assert end_i <= start_j, "Solution violates no-room-overlap constraint"


class TestSameDayConstraint:
    """
    **Feature: solver-refactoring, Property 19: Hard Constraint Satisfaction**
    **Validates: Requirements 10.3**
    
    Tests that same-day constraint prevents multi-period lessons from spanning days.
    """

    @given(problem=small_problem_strategy())
    @settings(max_examples=100, deadline=30000)
    def test_same_day_constraint_prevents_day_spanning(self, problem):
        """
        For any scheduling problem with multi-period lessons, applying
        SameDayConstraint SHALL ensure no lesson spans multiple days.
        """
        # Ensure we have at least one multi-period request
        has_multi_period = any(req['length'] > 1 for req in problem['requests'])
        assume(has_multi_period)
        
        model, context = create_model_with_variables(problem)
        
        # Apply the constraint
        constraint = SameDayConstraint()
        constraint.apply(model, context)
        
        # Solve
        solution = solve_and_get_solution(model, context['start_vars'])
        
        # If a solution exists, verify no lessons span days
        if solution is not None:
            assert check_same_day(
                solution, problem['requests'], problem['num_periods_per_day']
            ), "Solution violates same-day constraint"


class TestAllHardConstraintsTogether:
    """
    **Feature: solver-refactoring, Property 19: Hard Constraint Satisfaction**
    **Validates: Requirements 10.3**
    
    Tests that all hard constraints work together correctly.
    """

    @given(problem=small_problem_strategy())
    @settings(max_examples=100, deadline=30000)
    def test_all_hard_constraints_satisfied(self, problem):
        """
        For any scheduling problem, applying all hard constraints SHALL
        produce a solution (if one exists) that satisfies all constraints.
        """
        model, context = create_model_with_variables(problem)
        
        # Apply all no-overlap constraints
        NoClassOverlapConstraint().apply(model, context)
        NoTeacherOverlapConstraint().apply(model, context)
        NoRoomOverlapConstraint().apply(model, context)
        
        # Apply same-day constraint
        SameDayConstraint().apply(model, context)
        
        # Solve
        solution = solve_and_get_solution(model, context['start_vars'])
        
        # If a solution exists, verify all constraints are satisfied
        if solution is not None:
            # Check no class overlaps
            assert check_no_overlap(
                solution, problem['requests'], 'class_idx'
            ), "Solution violates no-class-overlap constraint"
            
            # Check no teacher overlaps
            assert check_no_overlap(
                solution, problem['requests'], 'teacher_idx'
            ), "Solution violates no-teacher-overlap constraint"
            
            # Check same-day for multi-period lessons
            assert check_same_day(
                solution, problem['requests'], problem['num_periods_per_day']
            ), "Solution violates same-day constraint"


class TestConstraintShouldApply:
    """Tests for the should_apply method of hard constraints."""

    def test_no_class_overlap_should_apply_with_intervals(self):
        """NoClassOverlapConstraint should apply when class_intervals exist."""
        constraint = NoClassOverlapConstraint()
        
        # Should apply with intervals
        context = {'class_intervals': {0: ['interval1']}}
        assert constraint.should_apply(context) is True
        
        # Should not apply without intervals
        context = {'class_intervals': {}}
        assert constraint.should_apply(context) is False
        
        # Should not apply when disabled
        constraint.disable()
        context = {'class_intervals': {0: ['interval1']}}
        assert constraint.should_apply(context) is False

    def test_same_day_should_apply_with_multi_period(self):
        """SameDayConstraint should apply when multi-period requests exist."""
        constraint = SameDayConstraint()
        
        # Should apply with multi-period requests
        context = {'requests': [{'length': 2}]}
        assert constraint.should_apply(context) is True
        
        # Should not apply with only single-period requests
        context = {'requests': [{'length': 1}]}
        assert constraint.should_apply(context) is False
        
        # Should not apply when disabled
        constraint.disable()
        context = {'requests': [{'length': 2}]}
        assert constraint.should_apply(context) is False

    def test_consecutive_should_apply_with_data(self):
        """ConsecutiveConstraint should apply when data and requests exist."""
        constraint = ConsecutiveConstraint()
        
        # Should apply with data and requests
        context = {'requests': [{'class_id': 'C1'}], 'data': object()}
        assert constraint.should_apply(context) is True
        
        # Should not apply without requests
        context = {'requests': [], 'data': object()}
        assert constraint.should_apply(context) is False
        
        # Should not apply without data
        context = {'requests': [{'class_id': 'C1'}], 'data': None}
        assert constraint.should_apply(context) is False
