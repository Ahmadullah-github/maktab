# ==============================================================================
# Unit Tests for SolutionBuilder
#
# Tests for the SolutionBuilder class that handles solution construction
# from solver results and metadata generation.
#
# **Requirements: 1.3**
# ==============================================================================

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from ortools.sat.python import cp_model

# Add the solver package to the path
solver_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(solver_path))

from core.solution_builder import SolutionBuilder, get_category_dari_name
from models.input import (
    DayOfWeek,
    GlobalConfig,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
    TimetableData,
    FixedLesson,
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
    
    rooms = [
        Room(id="ROOM_1", name="Room 1", capacity=30, type="classroom"),
        Room(id="ROOM_2", name="Room 2", capacity=25, type="classroom"),
    ]
    
    subjects = [
        Subject(id="MATH", name="Mathematics"),
        Subject(id="SCIENCE", name="Science", isCustom=True, customCategory="Middle"),
    ]
    
    teachers = [
        Teacher(
            id="TEACHER_1",
            fullName="Ahmad Khan",
            primarySubjectIds=["MATH", "SCIENCE"],
            availability={day: [True] * periods_per_day for day in standard_days},
            maxPeriodsPerWeek=total_periods,
        ),
        Teacher(
            id="TEACHER_2",
            fullName="Sara Ahmadi",
            primarySubjectIds=["MATH"],
            availability={day: [True] * periods_per_day for day in standard_days},
            maxPeriodsPerWeek=total_periods,
        ),
    ]
    
    classes = [
        ClassGroup(
            id="CLASS_1A",
            name="Class 1-A",
            studentCount=25,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=total_periods)},
            gradeLevel=1,
        ),
        ClassGroup(
            id="CLASS_7A",
            name="Class 7-A",
            studentCount=30,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=15), "SCIENCE": SubjectRequirement(periodsPerWeek=15)},
            gradeLevel=7,
            singleTeacherMode=True,
            classTeacherId="TEACHER_1",
        ),
    ]
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )


@pytest.fixture
def timetable_data_with_fixed_lessons(minimal_timetable_data, standard_days):
    """TimetableData with fixed lessons."""
    fixed_lessons = [
        FixedLesson(
            day=DayOfWeek.MONDAY,
            periodIndex=0,
            classId="CLASS_1A",
            subjectId="MATH",
            teacherIds=["TEACHER_1"],
            roomId="ROOM_1",
        ),
        FixedLesson(
            day=DayOfWeek.TUESDAY,
            periodIndex=1,
            classId="CLASS_7A",
            subjectId="SCIENCE",
            teacherIds=["TEACHER_1"],
            roomId="ROOM_2",
        ),
    ]
    
    return TimetableData(
        config=minimal_timetable_data.config,
        rooms=minimal_timetable_data.rooms,
        subjects=minimal_timetable_data.subjects,
        teachers=minimal_timetable_data.teachers,
        classes=minimal_timetable_data.classes,
        fixedLessons=fixed_lessons,
    )


@pytest.fixture
def mock_solver():
    """Create a mock CP-SAT solver."""
    solver = MagicMock(spec=cp_model.CpSolver)
    return solver


@pytest.fixture
def solution_builder(minimal_timetable_data, mock_solver, standard_days):
    """Create a SolutionBuilder instance for testing."""
    data = minimal_timetable_data
    periods_per_day = 6
    
    # Create mappings
    class_map = {c.id: i for i, c in enumerate(data.classes)}
    teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
    subject_map = {s.id: i for i, s in enumerate(data.subjects)}
    room_map = {r.id: i for i, r in enumerate(data.rooms)}
    day_map = {day.value: i for i, day in enumerate(standard_days)}
    days = [day.value for day in standard_days]
    
    return SolutionBuilder(
        data=data,
        solver=mock_solver,
        requests=[],
        class_map=class_map,
        teacher_map=teacher_map,
        subject_map=subject_map,
        room_map=room_map,
        day_map=day_map,
        days=days,
        num_periods_per_day=periods_per_day,
    )


# ==============================================================================
# Tests for get_category_dari_name
# ==============================================================================

class TestGetCategoryDariName:
    """Tests for the get_category_dari_name helper function."""
    
    def test_alpha_primary(self):
        """Should return correct Dari name for Alpha-Primary."""
        assert get_category_dari_name("Alpha-Primary") == "ابتداییه دوره اول"
    
    def test_beta_primary(self):
        """Should return correct Dari name for Beta-Primary."""
        assert get_category_dari_name("Beta-Primary") == "ابتداییه دوره دوم"
    
    def test_middle(self):
        """Should return correct Dari name for Middle."""
        assert get_category_dari_name("Middle") == "متوسطه"
    
    def test_high(self):
        """Should return correct Dari name for High."""
        assert get_category_dari_name("High") == "لیسه"
    
    def test_unknown_category(self):
        """Should return None for unknown category."""
        assert get_category_dari_name("Unknown") is None


# ==============================================================================
# Tests for SolutionBuilder Initialization
# ==============================================================================

class TestSolutionBuilderInit:
    """Tests for SolutionBuilder initialization."""
    
    def test_init_creates_reverse_maps(self, solution_builder):
        """Should create reverse maps for ID lookups."""
        assert solution_builder._rev_class_map is not None
        assert solution_builder._rev_teacher_map is not None
        assert solution_builder._rev_subject_map is not None
        assert solution_builder._rev_room_map is not None
    
    def test_init_creates_name_maps(self, solution_builder):
        """Should create name lookup maps."""
        assert "CLASS_1A" in solution_builder._class_name_map
        assert "TEACHER_1" in solution_builder._teacher_name_map
        assert "MATH" in solution_builder._subject_name_map
        assert "ROOM_1" in solution_builder._room_name_map


# ==============================================================================
# Tests for build_solution
# ==============================================================================

class TestBuildSolution:
    """Tests for building solution from solver values."""
    
    def test_build_solution_empty_requests(self, solution_builder):
        """Should return empty list for no requests."""
        solution = solution_builder.build_solution([], [], [])
        assert solution == []
    
    def test_build_solution_single_request(self, minimal_timetable_data, mock_solver, standard_days):
        """Should build solution for a single request."""
        data = minimal_timetable_data
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        requests = [{'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1}]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=requests,
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        # Mock solver values: start=0 (Monday period 0), teacher=0, room=0
        mock_solver.Value.side_effect = [0, 0, 0]
        
        start_vars = [MagicMock()]
        teacher_vars = [MagicMock()]
        room_vars = [MagicMock()]
        
        solution = builder.build_solution(start_vars, teacher_vars, room_vars)
        
        assert len(solution) == 1
        assert solution[0]['day'] == 'Monday'
        assert solution[0]['periodIndex'] == 0
        assert solution[0]['classId'] == 'CLASS_1A'
        assert solution[0]['subjectId'] == 'MATH'
        assert solution[0]['teacherIds'] == ['TEACHER_1']
        assert solution[0]['roomId'] == 'ROOM_1'
        assert solution[0]['isFixed'] is False
    
    def test_build_solution_multi_period_request(self, minimal_timetable_data, mock_solver, standard_days):
        """Should build multiple lessons for multi-period request."""
        data = minimal_timetable_data
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        requests = [{'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 2}]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=requests,
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        # Mock solver values: start=0 (Monday period 0-1), teacher=0, room=0
        mock_solver.Value.side_effect = [0, 0, 0]
        
        start_vars = [MagicMock()]
        teacher_vars = [MagicMock()]
        room_vars = [MagicMock()]
        
        solution = builder.build_solution(start_vars, teacher_vars, room_vars)
        
        assert len(solution) == 2
        assert solution[0]['periodIndex'] == 0
        assert solution[1]['periodIndex'] == 1
    
    def test_build_solution_includes_fixed_lessons(self, timetable_data_with_fixed_lessons, mock_solver, standard_days):
        """Should include fixed lessons in solution."""
        data = timetable_data_with_fixed_lessons
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=[],
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        solution = builder.build_solution([], [], [])
        
        assert len(solution) == 2
        assert all(lesson['isFixed'] is True for lesson in solution)
    
    def test_build_solution_sorted(self, minimal_timetable_data, mock_solver, standard_days):
        """Should sort solution by day, period, and class."""
        data = minimal_timetable_data
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        # Two requests: one on Tuesday, one on Monday
        requests = [
            {'class_id': 'CLASS_7A', 'subject_id': 'MATH', 'length': 1},
            {'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1},
        ]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=requests,
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        # First request: Tuesday (slot 6), Second: Monday (slot 0)
        mock_solver.Value.side_effect = [6, 0, 0, 0, 0, 0]
        
        start_vars = [MagicMock(), MagicMock()]
        teacher_vars = [MagicMock(), MagicMock()]
        room_vars = [MagicMock(), MagicMock()]
        
        solution = builder.build_solution(start_vars, teacher_vars, room_vars)
        
        # Monday should come before Tuesday
        assert solution[0]['day'] == 'Monday'
        assert solution[1]['day'] == 'Tuesday'


# ==============================================================================
# Tests for build_fixed_lessons_only
# ==============================================================================

class TestBuildFixedLessonsOnly:
    """Tests for building partial solution with fixed lessons only."""
    
    def test_build_fixed_lessons_only_empty(self, solution_builder):
        """Should return empty list when no fixed lessons."""
        solution = solution_builder.build_fixed_lessons_only()
        assert solution == []
    
    def test_build_fixed_lessons_only_with_lessons(self, timetable_data_with_fixed_lessons, mock_solver, standard_days):
        """Should return only fixed lessons."""
        data = timetable_data_with_fixed_lessons
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=[],
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        solution = builder.build_fixed_lessons_only()
        
        assert len(solution) == 2
        assert all(lesson['isFixed'] is True for lesson in solution)


# ==============================================================================
# Tests for add_metadata
# ==============================================================================

class TestAddMetadata:
    """Tests for adding metadata to solution."""
    
    def test_add_metadata_structure(self, solution_builder):
        """Should return correct structure with schedule, metadata, and statistics."""
        result = solution_builder.add_metadata([])
        
        assert 'schedule' in result
        assert 'metadata' in result
        assert 'statistics' in result
        
        assert 'classes' in result['metadata']
        assert 'subjects' in result['metadata']
        assert 'teachers' in result['metadata']
        assert 'periodConfiguration' in result['metadata']
    
    def test_add_metadata_class_info(self, solution_builder):
        """Should include correct class metadata."""
        result = solution_builder.add_metadata([])
        
        class_metadata = result['metadata']['classes']
        assert len(class_metadata) == 2
        
        # Check Alpha-Primary class
        class_1a = next(c for c in class_metadata if c['classId'] == 'CLASS_1A')
        assert class_1a['className'] == 'Class 1-A'
        assert class_1a['gradeLevel'] == 1
        assert class_1a['category'] == 'Alpha-Primary'
        assert class_1a['categoryDari'] == 'ابتداییه دوره اول'
        assert class_1a['singleTeacherMode'] is False
        
        # Check Middle class with single teacher mode
        class_7a = next(c for c in class_metadata if c['classId'] == 'CLASS_7A')
        assert class_7a['category'] == 'Middle'
        assert class_7a['singleTeacherMode'] is True
        assert class_7a['classTeacherId'] == 'TEACHER_1'
        assert class_7a['classTeacherName'] == 'Ahmad Khan'
    
    def test_add_metadata_subject_info(self, solution_builder):
        """Should include correct subject metadata."""
        result = solution_builder.add_metadata([])
        
        subject_metadata = result['metadata']['subjects']
        assert len(subject_metadata) == 2
        
        # Check standard subject
        math = next(s for s in subject_metadata if s['subjectId'] == 'MATH')
        assert math['subjectName'] == 'Mathematics'
        assert math['isCustom'] is False
        
        # Check custom subject
        science = next(s for s in subject_metadata if s['subjectId'] == 'SCIENCE')
        assert science['isCustom'] is True
        assert science['customCategory'] == 'Middle'
        assert science['customCategoryDari'] == 'متوسطه'
    
    def test_add_metadata_teacher_info(self, solution_builder):
        """Should include correct teacher metadata."""
        result = solution_builder.add_metadata([])
        
        teacher_metadata = result['metadata']['teachers']
        assert len(teacher_metadata) == 2
        
        teacher_1 = next(t for t in teacher_metadata if t['teacherId'] == 'TEACHER_1')
        assert teacher_1['teacherName'] == 'Ahmad Khan'
        assert 'MATH' in teacher_1['primarySubjects']
        assert 'CLASS_7A' in teacher_1['classTeacherOf']
    
    def test_add_metadata_period_configuration(self, solution_builder):
        """Should include correct period configuration."""
        result = solution_builder.add_metadata([])
        
        period_config = result['metadata']['periodConfiguration']
        assert period_config['totalPeriodsPerWeek'] == 30  # 6 periods * 5 days
        assert len(period_config['daysOfWeek']) == 5
        assert period_config['hasVariablePeriods'] is False
    
    def test_add_metadata_statistics(self, solution_builder):
        """Should include correct statistics."""
        result = solution_builder.add_metadata([])
        
        stats = result['statistics']
        assert stats['totalClasses'] == 2
        assert stats['singleTeacherClasses'] == 1
        assert stats['multiTeacherClasses'] == 1
        assert stats['totalSubjects'] == 2
        assert stats['customSubjects'] == 1
        assert stats['standardSubjects'] == 1
        assert stats['totalTeachers'] == 2
        assert stats['totalRooms'] == 2
        assert stats['categoryCounts']['Alpha-Primary'] == 1
        assert stats['categoryCounts']['Middle'] == 1


# ==============================================================================
# Tests for build_output_with_metadata
# ==============================================================================

class TestBuildOutputWithMetadata:
    """Tests for building complete output with metadata."""
    
    def test_build_output_with_metadata(self, minimal_timetable_data, mock_solver, standard_days):
        """Should build complete output with all components."""
        data = minimal_timetable_data
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        requests = [{'class_id': 'CLASS_1A', 'subject_id': 'MATH', 'length': 1}]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=requests,
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        mock_solver.Value.side_effect = [0, 0, 0]
        
        start_vars = [MagicMock()]
        teacher_vars = [MagicMock()]
        room_vars = [MagicMock()]
        
        result = builder.build_output_with_metadata(
            start_vars, teacher_vars, room_vars,
            solve_time_seconds=1.5,
            strategy_name="Balanced",
            num_constraints=100,
        )
        
        assert 'schedule' in result
        assert 'metadata' in result
        assert 'statistics' in result
        assert result['statistics']['solveTimeSeconds'] == 1.5
        assert result['statistics']['strategy'] == 'Balanced'
        assert result['statistics']['numConstraintsApplied'] == 100


# ==============================================================================
# Tests for build_partial_output
# ==============================================================================

class TestBuildPartialOutput:
    """Tests for building partial output."""
    
    def test_build_partial_output(self, timetable_data_with_fixed_lessons, mock_solver, standard_days):
        """Should build partial output with fixed lessons only."""
        data = timetable_data_with_fixed_lessons
        periods_per_day = 6
        
        class_map = {c.id: i for i, c in enumerate(data.classes)}
        teacher_map = {t.id: i for i, t in enumerate(data.teachers)}
        subject_map = {s.id: i for i, s in enumerate(data.subjects)}
        room_map = {r.id: i for i, r in enumerate(data.rooms)}
        day_map = {day.value: i for i, day in enumerate(standard_days)}
        days = [day.value for day in standard_days]
        
        builder = SolutionBuilder(
            data=data,
            solver=mock_solver,
            requests=[],
            class_map=class_map,
            teacher_map=teacher_map,
            subject_map=subject_map,
            room_map=room_map,
            day_map=day_map,
            days=days,
            num_periods_per_day=periods_per_day,
        )
        
        result = builder.build_partial_output(solve_time_seconds=2.0)
        
        assert len(result['schedule']) == 2
        assert result['statistics']['solveTimeSeconds'] == 2.0
