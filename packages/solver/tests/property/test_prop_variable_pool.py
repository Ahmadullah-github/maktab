# ==============================================================================
# Property Test: Variable Pool Reuse
#
# **Feature: solver-refactoring, Property 13: Variable Pool Reuse**
# **Validates: Requirements 6.4**
# ==============================================================================

import sys
from pathlib import Path

import pytest
from hypothesis import given, strategies as st, settings, assume
from ortools.sat.python import cp_model

solver_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(solver_path))

from core.variables import VariableManager
from models.input import (
    DayOfWeek, GlobalConfig, Room, Subject, Teacher,
    SubjectRequirement, ClassGroup, TimetableData,
)

STANDARD_DAYS = [
    DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY,
]

@st.composite
def valid_var_key(draw):
    prefix = draw(st.sampled_from(["bool", "int", "start", "teacher", "room"]))
    suffix = draw(st.integers(min_value=0, max_value=1000))
    return f"{prefix}_{suffix}"

@st.composite
def request_teacher_pair(draw):
    r_idx = draw(st.integers(min_value=0, max_value=100))
    t_idx = draw(st.integers(min_value=0, max_value=50))
    return (r_idx, t_idx)

@st.composite
def request_room_pair(draw):
    r_idx = draw(st.integers(min_value=0, max_value=100))
    rm_idx = draw(st.integers(min_value=0, max_value=20))
    return (r_idx, rm_idx)

@st.composite
def int_var_bounds(draw):
    lower = draw(st.integers(min_value=0, max_value=100))
    upper = draw(st.integers(min_value=lower, max_value=lower + 100))
    return (lower, upper)


def create_variable_manager():
    """Create a fresh VariableManager instance for testing."""
    periods_per_day = 6
    num_days = len(STANDARD_DAYS)
    num_slots = num_days * periods_per_day
    
    config = GlobalConfig(daysOfWeek=STANDARD_DAYS, periodsPerDay=periods_per_day)
    rooms = [Room(id="ROOM_1", name="Room 1", capacity=30, type="classroom")]
    subjects = [Subject(id="MATH", name="Mathematics")]
    teachers = [Teacher(
        id="TEACHER_1", fullName="Ahmad Khan", primarySubjectIds=["MATH"],
        availability={day: [True] * periods_per_day for day in STANDARD_DAYS},
        maxPeriodsPerWeek=num_slots,
    )]
    classes = [ClassGroup(
        id="CLASS_1A", name="Class 1-A", studentCount=25,
        subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=num_slots)},
        gradeLevel=1,
    )]
    
    data = TimetableData(
        config=config, rooms=rooms, subjects=subjects,
        teachers=teachers, classes=classes,
    )
    
    model = cp_model.CpModel()
    class_map = {c.id: i for i, c in enumerate(data.classes)}
    teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
    subject_map = {s.id: i for i, s in enumerate(data.subjects)}
    room_map = {r.id: i for i, r in enumerate(data.rooms)}
    day_map = {day.value: i for i, day in enumerate(STANDARD_DAYS)}
    
    teacher_availability = [[1] * num_slots for _ in data.teachers]
    room_availability = [[1] * num_slots for _ in data.rooms]
    class_blocked_slots = [[0] * num_slots for _ in data.classes]
    
    data_dict = {
        'teachers': [t.model_dump() for t in data.teachers],
        'rooms': [r.model_dump() for r in data.rooms],
        'subjects': [s.model_dump() for s in data.subjects],
    }
    
    return VariableManager(
        model=model, data=data, data_dict=data_dict,
        class_map=class_map, teacher_map=teacher_map,
        subject_map=subject_map, room_map=room_map, day_map=day_map,
        num_slots=num_slots, num_periods_per_day=periods_per_day,
        teacher_availability=teacher_availability,
        room_availability=room_availability,
        class_blocked_slots=class_blocked_slots,
    )


class TestVariablePoolReuse:
    """
    **Feature: solver-refactoring, Property 13: Variable Pool Reuse**
    **Validates: Requirements 6.4**
    """

    @given(key=valid_var_key())
    @settings(max_examples=100, deadline=5000)
    def test_bool_var_pool_reuse_same_key(self, key):
        """For any key, get_or_create_bool_var twice returns same instance."""
        manager = create_variable_manager()
        var1 = manager.get_or_create_bool_var(key)
        var2 = manager.get_or_create_bool_var(key)
        assert var1 is var2
        assert manager.get_pool_stats()['bool_vars'] >= 1

    @given(key=valid_var_key(), bounds=int_var_bounds())
    @settings(max_examples=100, deadline=5000)
    def test_int_var_pool_reuse_same_key(self, key, bounds):
        """For any key, get_or_create_int_var twice returns same instance."""
        manager = create_variable_manager()
        lower, upper = bounds
        var1 = manager.get_or_create_int_var(key, lower, upper)
        var2 = manager.get_or_create_int_var(key, lower, upper)
        assert var1 is var2

    @given(pair=request_teacher_pair())
    @settings(max_examples=100, deadline=5000)
    def test_is_assigned_teacher_pool_reuse(self, pair):
        """For any (r_idx, t_idx), get_or_create_is_assigned twice returns same."""
        manager = create_variable_manager()
        r_idx, t_idx = pair
        var1 = manager.get_or_create_is_assigned(r_idx, t_idx=t_idx)
        var2 = manager.get_or_create_is_assigned(r_idx, t_idx=t_idx)
        assert var1 is var2

    @given(pair=request_room_pair())
    @settings(max_examples=100, deadline=5000)
    def test_is_assigned_room_pool_reuse(self, pair):
        """For any (r_idx, rm_idx), get_or_create_is_assigned twice returns same."""
        manager = create_variable_manager()
        r_idx, rm_idx = pair
        var1 = manager.get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
        var2 = manager.get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
        assert var1 is var2

    @given(keys=st.lists(valid_var_key(), min_size=1, max_size=50))
    @settings(max_examples=50, deadline=10000)
    def test_pool_size_equals_unique_keys(self, keys):
        """Pool size SHALL equal the number of unique keys."""
        manager = create_variable_manager()
        for key in keys:
            manager.get_or_create_bool_var(key)
        unique_keys = len(set(keys))
        assert manager.get_pool_stats()['bool_vars'] == unique_keys

    @given(key1=valid_var_key(), key2=valid_var_key())
    @settings(max_examples=100, deadline=5000)
    def test_different_keys_create_different_vars(self, key1, key2):
        """Different keys SHALL create different variable instances."""
        assume(key1 != key2)
        manager = create_variable_manager()
        var1 = manager.get_or_create_bool_var(key1)
        var2 = manager.get_or_create_bool_var(key2)
        assert var1 is not var2

    @given(pair1=request_teacher_pair(), pair2=request_teacher_pair())
    @settings(max_examples=100, deadline=5000)
    def test_different_teacher_pairs_create_different_vars(self, pair1, pair2):
        """Different pairs SHALL create different variable instances."""
        assume(pair1 != pair2)
        manager = create_variable_manager()
        var1 = manager.get_or_create_is_assigned(pair1[0], t_idx=pair1[1])
        var2 = manager.get_or_create_is_assigned(pair2[0], t_idx=pair2[1])
        assert var1 is not var2

    @given(n_requests=st.integers(min_value=1, max_value=20))
    @settings(max_examples=50, deadline=10000)
    def test_pool_memory_efficiency(self, n_requests):
        """Pool SHALL not grow beyond the number of unique requests."""
        manager = create_variable_manager()
        for _ in range(3):
            for i in range(n_requests):
                manager.get_or_create_bool_var(f"test_{i}")
        assert manager.get_pool_stats()['bool_vars'] == n_requests


class TestGenericVariablePool:
    """Tests for the generic get_or_create_variable method."""

    @given(key=valid_var_key())
    @settings(max_examples=50, deadline=5000)
    def test_generic_pool_reuse(self, key):
        """Generic get_or_create_variable SHALL also reuse variables."""
        manager = create_variable_manager()
        var1 = manager.get_or_create_variable(
            'bool', key, lambda: manager.model.NewBoolVar(key)
        )
        var2 = manager.get_or_create_variable(
            'bool', key, lambda: manager.model.NewBoolVar(key)
        )
        assert var1 is var2

    def test_invalid_pool_name_raises_error(self):
        """Should raise ValueError for invalid pool name."""
        manager = create_variable_manager()
        with pytest.raises(ValueError, match="Unknown pool name"):
            manager.get_or_create_variable('invalid_pool', 'key', lambda: None)
