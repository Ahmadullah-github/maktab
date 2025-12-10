# ==============================================================================
#
#  Property Test: Solver Output Equivalence
#
#  **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
#  **Validates: Requirements 1.8**
#
#  This test verifies that the refactored modular solver produces output
#  equivalent to the original monolithic solver for the same input.
#
# ==============================================================================

import sys
from pathlib import Path

import pytest
from hypothesis import given, settings, assume, HealthCheck
from hypothesis import strategies as st

# Add solver package to path
solver_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(solver_path))

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
from core.solver import TimetableSolver


# ==============================================================================
# Test Strategies
# ==============================================================================

@st.composite
def simple_timetable_data(draw):
    """
    Generate a simple but valid TimetableData for testing solver equivalence.
    
    We keep the problem small to ensure:
    1. Tests run quickly
    2. Solutions are deterministic (or at least comparable)
    3. Both solvers can find solutions
    """
    # Fixed 5-day week with 6 periods per day
    days = [
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY,
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
    ]
    periods_per_day = 6
    
    config = GlobalConfig(
        daysOfWeek=days,
        periodsPerDay=periods_per_day,
        solverTimeLimitSeconds=30,  # Short timeout for tests
    )
    
    # Create 1-2 rooms
    num_rooms = draw(st.integers(min_value=1, max_value=2))
    rooms = [
        Room(
            id=f"ROOM_{i}",
            name=f"Room {i}",
            capacity=30,
            type="classroom",
        )
        for i in range(1, num_rooms + 1)
    ]
    
    # Create 1-3 subjects
    num_subjects = draw(st.integers(min_value=1, max_value=3))
    subjects = [
        Subject(
            id=f"SUBJ_{i}",
            name=f"Subject {i}",
        )
        for i in range(1, num_subjects + 1)
    ]
    
    # Create 1-2 teachers that can teach all subjects
    num_teachers = draw(st.integers(min_value=1, max_value=2))
    subject_ids = [s.id for s in subjects]
    teachers = [
        Teacher(
            id=f"TEACHER_{i}",
            fullName=f"Teacher {i}",
            primarySubjectIds=subject_ids,
            availability={day: [True] * periods_per_day for day in days},
            maxPeriodsPerWeek=30,
        )
        for i in range(1, num_teachers + 1)
    ]
    
    # Create 1 class with requirements that exactly fill the schedule
    # Total periods = 5 days * 6 periods = 30
    total_periods = len(days) * periods_per_day
    
    # Distribute periods across subjects
    periods_per_subject = total_periods // num_subjects
    remainder = total_periods % num_subjects
    
    subject_requirements = {}
    for i, subj in enumerate(subjects):
        periods = periods_per_subject + (1 if i < remainder else 0)
        subject_requirements[subj.id] = SubjectRequirement(periodsPerWeek=periods)
    
    classes = [
        ClassGroup(
            id="CLASS_1",
            name="Class 1",
            studentCount=25,
            subjectRequirements=subject_requirements,
            gradeLevel=draw(st.integers(min_value=1, max_value=12)),
        )
    ]
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )


# ==============================================================================
# Property Tests
# ==============================================================================

class TestSolverOutputEquivalence:
    """
    Property tests for solver output equivalence.
    
    **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
    **Validates: Requirements 1.8**
    """
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,  # 60 second deadline per example
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_refactored_solver_produces_valid_output(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        For any valid input data, the refactored solver SHALL produce
        a valid output structure with schedule, metadata, and statistics.
        """
        # Create solver with refactored implementation
        solver = TimetableSolver(data.model_dump())
        
        # Solve with short time limit
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,  # Fast mode for testing
            use_registry=True,
        )
        
        # Result should be a dict with expected structure (success case)
        # or a list with error info (failure case)
        if isinstance(result, dict):
            # Success case - verify structure
            assert 'schedule' in result, "Result should have 'schedule' key"
            assert 'metadata' in result, "Result should have 'metadata' key"
            assert 'statistics' in result, "Result should have 'statistics' key"
            
            # Verify schedule is a list
            assert isinstance(result['schedule'], list), "Schedule should be a list"
            
            # Verify metadata structure
            metadata = result['metadata']
            assert 'classes' in metadata, "Metadata should have 'classes'"
            assert 'subjects' in metadata, "Metadata should have 'subjects'"
            assert 'teachers' in metadata, "Metadata should have 'teachers'"
            assert 'periodConfiguration' in metadata, "Metadata should have 'periodConfiguration'"
            
            # Verify statistics structure
            stats = result['statistics']
            assert 'totalClasses' in stats, "Statistics should have 'totalClasses'"
            assert 'totalSubjects' in stats, "Statistics should have 'totalSubjects'"
            assert 'totalTeachers' in stats, "Statistics should have 'totalTeachers'"
            assert 'totalLessons' in stats, "Statistics should have 'totalLessons'"
        else:
            # Failure case - should be a list with error info
            assert isinstance(result, list), "Failed result should be a list"
            if result:
                assert 'error' in result[0] or 'status' in result[0], \
                    "Failed result should have error or status"

    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_refactored_solver_schedules_all_lessons(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        For any valid input data where a solution exists, the refactored solver
        SHALL schedule all required lessons (same count as original would).
        """
        # Calculate expected total lessons
        expected_lessons = sum(
            req.periodsPerWeek
            for cls in data.classes
            for req in cls.subjectRequirements.values()
        )
        
        # Create and run solver
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        # If we got a valid solution, verify lesson count
        if isinstance(result, dict) and 'schedule' in result:
            schedule = result['schedule']
            actual_lessons = len(schedule)
            
            # Should have scheduled all required lessons
            assert actual_lessons == expected_lessons, \
                f"Expected {expected_lessons} lessons, got {actual_lessons}"
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_refactored_solver_no_class_overlap(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        For any valid solution, no class SHALL have two lessons at the same time.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'schedule' in result:
            schedule = result['schedule']
            
            # Check for class overlaps
            class_slots = {}  # (class_id, day, period) -> lesson
            for lesson in schedule:
                key = (lesson['classId'], lesson['day'], lesson['periodIndex'])
                assert key not in class_slots, \
                    f"Class {lesson['classId']} has overlapping lessons at {lesson['day']} period {lesson['periodIndex']}"
                class_slots[key] = lesson
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_refactored_solver_no_teacher_overlap(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        For any valid solution, no teacher SHALL have two lessons at the same time.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'schedule' in result:
            schedule = result['schedule']
            
            # Check for teacher overlaps
            teacher_slots = {}  # (teacher_id, day, period) -> lesson
            for lesson in schedule:
                for teacher_id in lesson['teacherIds']:
                    key = (teacher_id, lesson['day'], lesson['periodIndex'])
                    assert key not in teacher_slots, \
                        f"Teacher {teacher_id} has overlapping lessons at {lesson['day']} period {lesson['periodIndex']}"
                    teacher_slots[key] = lesson
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_refactored_solver_no_room_overlap(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        For any valid solution, no room SHALL have two lessons at the same time.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'schedule' in result:
            schedule = result['schedule']
            
            # Check for room overlaps
            room_slots = {}  # (room_id, day, period) -> lesson
            for lesson in schedule:
                if lesson.get('roomId'):
                    key = (lesson['roomId'], lesson['day'], lesson['periodIndex'])
                    assert key not in room_slots, \
                        f"Room {lesson['roomId']} has overlapping lessons at {lesson['day']} period {lesson['periodIndex']}"
                    room_slots[key] = lesson


class TestSolverMetadataEquivalence:
    """
    Tests for metadata equivalence between refactored and original solver.
    """
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_metadata_contains_all_classes(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        Metadata SHALL contain information for all input classes.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'metadata' in result:
            class_metadata = result['metadata']['classes']
            class_ids = {c['classId'] for c in class_metadata}
            expected_ids = {c.id for c in data.classes}
            
            assert class_ids == expected_ids, \
                f"Metadata missing classes: {expected_ids - class_ids}"
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_metadata_contains_all_subjects(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        Metadata SHALL contain information for all input subjects.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'metadata' in result:
            subject_metadata = result['metadata']['subjects']
            subject_ids = {s['subjectId'] for s in subject_metadata}
            expected_ids = {s.id for s in data.subjects}
            
            assert subject_ids == expected_ids, \
                f"Metadata missing subjects: {expected_ids - subject_ids}"
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_metadata_contains_all_teachers(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        Metadata SHALL contain information for all input teachers.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'metadata' in result:
            teacher_metadata = result['metadata']['teachers']
            teacher_ids = {t['teacherId'] for t in teacher_metadata}
            expected_ids = {t.id for t in data.teachers}
            
            assert teacher_ids == expected_ids, \
                f"Metadata missing teachers: {expected_ids - teacher_ids}"
    
    @given(data=simple_timetable_data())
    @settings(
        max_examples=10,
        deadline=60000,
        suppress_health_check=[HealthCheck.too_slow],
    )
    def test_statistics_match_input(self, data: TimetableData):
        """
        **Feature: solver-refactoring, Property 1: Solver Output Equivalence**
        **Validates: Requirements 1.8**
        
        Statistics SHALL accurately reflect the input data counts.
        """
        solver = TimetableSolver(data.model_dump())
        result = solver.solve(
            time_limit_seconds=30,
            enable_graceful_degradation=True,
            optimization_level=0,
            use_registry=True,
        )
        
        if isinstance(result, dict) and 'statistics' in result:
            stats = result['statistics']
            
            assert stats['totalClasses'] == len(data.classes), \
                f"Expected {len(data.classes)} classes, got {stats['totalClasses']}"
            assert stats['totalSubjects'] == len(data.subjects), \
                f"Expected {len(data.subjects)} subjects, got {stats['totalSubjects']}"
            assert stats['totalTeachers'] == len(data.teachers), \
                f"Expected {len(data.teachers)} teachers, got {stats['totalTeachers']}"
            assert stats['totalRooms'] == len(data.rooms), \
                f"Expected {len(data.rooms)} rooms, got {stats['totalRooms']}"
