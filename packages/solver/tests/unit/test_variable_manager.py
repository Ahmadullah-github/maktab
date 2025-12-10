# ==============================================================================
# Unit Tests for VariableManager
#
# Tests for the VariableManager class that handles CP-SAT variable creation
# with memory optimization through variable pooling.
#
# **Requirements: 1.2, 6.4**
# ==============================================================================

import sys
from pathlib import Path

import pytest
from ortools.sat.python import cp_model

# Add the solver package to the path
solver_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(solver_path))

from core.variables import VariableManager
from models.input import (
    DayOfWeek,
    GlobalConfig,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
    TimetableData,
)


# ==============================================================================
# Fixtures
# ==============================================================================

@pytest.fixture
def standard_days():
    """Standard 5-day school week."""
    return [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
    ]


@pytest.fixture
def minimal_timetable_data(standard_days):
    """Create minimal valid TimetableData for testing."""
    periods_per_day = 6
    total_periods = periods_per_day * len(standard_days)
    
    config = GlobalConfig(
        daysOfWeek=standard_days,
        periodsPerDay=periods_per_day,
    )
    
    rooms = [Room(
        id="ROOM_1",
        name="Room 1",
        capacity=30,
        type="classroom",
    )]
    
    subjects = [Subject(
        id="MATH",
        name="Mathematics",
    )]
    
    teachers = [Teacher(
        id="TEACHER_1",
        fullName="Ahmad Khan",
        primarySubjectIds=["MATH"],
        availability={day: [True] * periods_per_day for day in standard_days},
        maxPeriodsPerWeek=total_periods,
    )]
    
    classes = [ClassGroup(
        id="CLASS_1A",
        name="Class 1-A",
        studentCount=25,
        subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=total_periods)},
        gradeLevel=1,
    )]
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )


@pytest.fixture
def variable_manager(minimal_timetable_data, standard_days):
    """Create a VariableManager instance for testing."""
    model = cp_model.CpModel()
    data = minimal_timetable_data
    periods_per_day = 6
    num_days = len(standard_days)
    num_slots = num_days * periods_per_day
    
    # Create mappings
    class_map = {c.id: i for i, c in enumerate(data.classes)}
    teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
    subject_map = {s.id: i for i, s in enumerate(data.subjects)}
    room_map = {r.id: i for i, r in enumerate(data.rooms)}
    day_map = {day.value: i for i, day in enumerate(standard_days)}
    
    # Create availability matrices (all available)
    teacher_availability = [[1] * num_slots for _ in data.teachers]
    room_availability = [[1] * num_slots for _ in data.rooms]
    class_blocked_slots = [[0] * num_slots for _ in data.classes]
    
    # Create data_dict for compatibility
    data_dict = {
        'teachers': [t.model_dump() for t in data.teachers],
        'rooms': [r.model_dump() for r in data.rooms],
        'subjects': [s.model_dump() for s in data.subjects],
    }
    
    return VariableManager(
        model=model,
        data=data,
        data_dict=data_dict,
        class_map=class_map,
        teacher_map=teacher_map,
        subject_map=subject_map,
        room_map=room_map,
        day_map=day_map,
        num_slots=num_slots,
        num_periods_per_day=periods_per_day,
        teacher_availability=teacher_availability,
        room_availability=room_availability,
        class_blocked_slots=class_blocked_slots,
    )


# ==============================================================================
# Tests
# ==============================================================================

class TestVariableManagerInit:
    """Tests for VariableManager initialization."""
    
    def test_init_creates_empty_pools(self, variable_manager):
        """VariableManager should initialize with empty variable pools."""
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] == 0
        assert stats['int_vars'] == 0
        assert stats['interval_vars'] == 0
        assert stats['is_assigned_vars'] == 0
        assert stats['cached_domains'] == 0


class TestBoolVarPool:
    """Tests for boolean variable pooling."""
    
    def test_get_or_create_bool_var_creates_new(self, variable_manager):
        """Should create a new boolean variable when key doesn't exist."""
        var = variable_manager.get_or_create_bool_var("test_bool_1")
        assert var is not None
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] == 1
    
    def test_get_or_create_bool_var_returns_cached(self, variable_manager):
        """Should return cached variable when key exists."""
        var1 = variable_manager.get_or_create_bool_var("test_bool_1")
        var2 = variable_manager.get_or_create_bool_var("test_bool_1")
        
        # Should be the same object
        assert var1 is var2
        
        # Pool should still have only one variable
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] == 1
    
    def test_different_keys_create_different_vars(self, variable_manager):
        """Different keys should create different variables."""
        var1 = variable_manager.get_or_create_bool_var("test_bool_1")
        var2 = variable_manager.get_or_create_bool_var("test_bool_2")
        
        assert var1 is not var2
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] == 2


class TestIntVarPool:
    """Tests for integer variable pooling."""
    
    def test_get_or_create_int_var_creates_new(self, variable_manager):
        """Should create a new integer variable when key doesn't exist."""
        var = variable_manager.get_or_create_int_var("test_int_1", 0, 10)
        assert var is not None
        stats = variable_manager.get_pool_stats()
        assert stats['int_vars'] == 1
    
    def test_get_or_create_int_var_returns_cached(self, variable_manager):
        """Should return cached variable when key exists."""
        var1 = variable_manager.get_or_create_int_var("test_int_1", 0, 10)
        var2 = variable_manager.get_or_create_int_var("test_int_1", 0, 10)
        
        assert var1 is var2
        stats = variable_manager.get_pool_stats()
        assert stats['int_vars'] == 1


class TestIsAssignedCache:
    """Tests for is_assigned variable caching."""
    
    def test_get_or_create_is_assigned_teacher(self, variable_manager):
        """Should create assignment variable for teacher."""
        var = variable_manager.get_or_create_is_assigned(0, t_idx=0)
        assert var is not None
        stats = variable_manager.get_pool_stats()
        assert stats['is_assigned_vars'] == 1
    
    def test_get_or_create_is_assigned_room(self, variable_manager):
        """Should create assignment variable for room."""
        var = variable_manager.get_or_create_is_assigned(0, rm_idx=0)
        assert var is not None
        stats = variable_manager.get_pool_stats()
        assert stats['is_assigned_vars'] == 1
    
    def test_get_or_create_is_assigned_returns_cached(self, variable_manager):
        """Should return cached variable for same request/teacher."""
        var1 = variable_manager.get_or_create_is_assigned(0, t_idx=0)
        var2 = variable_manager.get_or_create_is_assigned(0, t_idx=0)
        
        assert var1 is var2
        stats = variable_manager.get_pool_stats()
        assert stats['is_assigned_vars'] == 1
    
    def test_get_or_create_is_assigned_requires_idx(self, variable_manager):
        """Should raise ValueError if neither t_idx nor rm_idx provided."""
        with pytest.raises(ValueError, match="Either t_idx or rm_idx must be provided"):
            variable_manager.get_or_create_is_assigned(0)


class TestComputeAllowedStarts:
    """Tests for computing allowed start slots."""
    
    def test_compute_allowed_starts_all_available(self, variable_manager):
        """Should return all valid starts when everything is available."""
        allowed_starts = variable_manager.compute_allowed_starts(
            c_idx=0,
            allowed_teachers=[0],
            allowed_rooms=[0],
            length=1
        )
        
        # With 5 days * 6 periods = 30 slots, all should be allowed
        assert len(allowed_starts) == 30
    
    def test_compute_allowed_starts_multi_period(self, variable_manager):
        """Should account for multi-period requests."""
        allowed_starts = variable_manager.compute_allowed_starts(
            c_idx=0,
            allowed_teachers=[0],
            allowed_rooms=[0],
            length=2
        )
        
        # With length=2, last slot of each day can't be a start
        # 5 days * 6 periods = 30 slots, but can only start at 0-28
        assert len(allowed_starts) == 29
    
    def test_compute_allowed_starts_with_blocked_slots(self, variable_manager):
        """Should exclude blocked slots."""
        # Block first slot
        variable_manager.class_blocked_slots[0][0] = 1
        
        allowed_starts = variable_manager.compute_allowed_starts(
            c_idx=0,
            allowed_teachers=[0],
            allowed_rooms=[0],
            length=1
        )
        
        assert 0 not in allowed_starts
        assert len(allowed_starts) == 29


class TestCreateVariables:
    """Tests for variable creation methods."""
    
    def test_create_start_variables(self, variable_manager):
        """Should create start variables for each request."""
        requests = [
            {'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1},
            {'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1},
        ]
        
        allowed_domains = {
            ('CLASS_1A', 'MATH'): {
                'teachers': [0],
                'rooms': [0],
                'starts': list(range(30)),
            }
        }
        
        start_vars = variable_manager.create_start_variables(requests, allowed_domains)
        
        assert len(start_vars) == 2
        assert all(var is not None for var in start_vars)
    
    def test_create_teacher_variables(self, variable_manager):
        """Should create teacher variables for each request."""
        requests = [
            {'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1},
        ]
        
        allowed_domains = {
            ('CLASS_1A', 'MATH'): {
                'teachers': [0],
                'rooms': [0],
                'starts': list(range(30)),
            }
        }
        
        teacher_vars = variable_manager.create_teacher_variables(requests, allowed_domains)
        
        assert len(teacher_vars) == 1
        assert teacher_vars[0] is not None
    
    def test_create_room_variables(self, variable_manager):
        """Should create room variables for each request."""
        requests = [
            {'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1},
        ]
        
        allowed_domains = {
            ('CLASS_1A', 'MATH'): {
                'teachers': [0],
                'rooms': [0],
                'starts': list(range(30)),
            }
        }
        
        room_vars = variable_manager.create_room_variables(requests, allowed_domains)
        
        assert len(room_vars) == 1
        assert room_vars[0] is not None


class TestClearPools:
    """Tests for clearing variable pools."""
    
    def test_clear_pools_empties_all(self, variable_manager):
        """Should clear all variable pools."""
        # Create some variables
        variable_manager.get_or_create_bool_var("test_bool")
        variable_manager.get_or_create_int_var("test_int", 0, 10)
        variable_manager.get_or_create_is_assigned(0, t_idx=0)
        variable_manager.cache_allowed_domain("CLASS_1A", "MATH", {'teachers': [0], 'rooms': [0], 'starts': [0]})
        
        # Verify they exist
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] > 0
        assert stats['int_vars'] > 0
        assert stats['is_assigned_vars'] > 0
        assert stats['cached_domains'] > 0
        
        # Clear pools
        variable_manager.clear_pools()
        
        # Verify all cleared
        stats = variable_manager.get_pool_stats()
        assert stats['bool_vars'] == 0
        assert stats['int_vars'] == 0
        assert stats['interval_vars'] == 0
        assert stats['is_assigned_vars'] == 0
        assert stats['cached_domains'] == 0
