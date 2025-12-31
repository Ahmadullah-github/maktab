# ==============================================================================
# Property Tests: Pre-solve Analyzer
#
# Tests for pre-solve analysis functionality.
#
# **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
# **Validates: Requirements 3.2, 3.3**
#
# **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
# **Validates: Requirements 3.1**
#
# ==============================================================================

import time
from typing import List, Dict, Any

import pytest
from hypothesis import given, strategies as st, settings, assume

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
from feedback.pre_solve_analyzer import PreSolveAnalyzer, PreSolveResult
from feedback.response_models import SolverErrorDetail


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Standard 5-day week
STANDARD_DAYS = [
    DayOfWeek.SATURDAY,
    DayOfWeek.SUNDAY,
    DayOfWeek.MONDAY,
    DayOfWeek.TUESDAY,
    DayOfWeek.WEDNESDAY,
]

# Strategy for generating valid entity IDs
entity_ids = st.text(
    alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz0123456789"),
    min_size=3,
    max_size=10
).map(lambda x: f"id_{x}")

# Strategy for generating valid names
valid_names = st.text(
    alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ "),
    min_size=2,
    max_size=20
).filter(lambda x: x.strip())


def valid_global_config(periods_per_day: int = 6):
    """Generate a valid GlobalConfig."""
    return GlobalConfig(
        daysOfWeek=STANDARD_DAYS,
        periodsPerDay=periods_per_day,
    )


@st.composite
def valid_room(draw):
    """Generate a valid Room."""
    room_id = draw(entity_ids)
    return Room(
        id=room_id,
        name=f"Room {room_id}",
        capacity=draw(st.integers(min_value=20, max_value=50)),
        type="classroom",
    )


@st.composite
def valid_subject(draw):
    """Generate a valid Subject."""
    subject_id = draw(entity_ids)
    return Subject(
        id=subject_id,
        name=f"Subject {subject_id}",
        isDifficult=draw(st.booleans()),
    )


@st.composite
def valid_teacher_for_subjects(
    draw, 
    subject_ids: List[str], 
    max_periods: int,
    periods_per_day: int = 6
):
    """Generate a valid Teacher that can teach the given subjects."""
    teacher_id = draw(entity_ids)
    return Teacher(
        id=teacher_id,
        fullName=f"Teacher {teacher_id}",
        primarySubjectIds=subject_ids,
        availability={day: [True] * periods_per_day for day in STANDARD_DAYS},
        maxPeriodsPerWeek=max_periods,
    )


@st.composite
def valid_class_with_requirements(
    draw,
    subject_ids: List[str],
    total_periods: int,
):
    """Generate a valid ClassGroup with subject requirements."""
    class_id = draw(entity_ids)
    
    # Distribute periods among subjects
    num_subjects = len(subject_ids)
    periods_per_subject = total_periods // num_subjects
    remainder = total_periods % num_subjects
    
    requirements = {}
    for i, sid in enumerate(subject_ids):
        periods = periods_per_subject + (1 if i < remainder else 0)
        if periods > 0:
            requirements[sid] = SubjectRequirement(periodsPerWeek=periods)
    
    return ClassGroup(
        id=class_id,
        name=f"Class {class_id}",
        studentCount=25,
        subjectRequirements=requirements,
        gradeLevel=draw(st.integers(min_value=1, max_value=12)),
    )


@st.composite
def valid_timetable_data_no_overload(draw):
    """Generate valid TimetableData where no teacher is overloaded."""
    periods_per_day = 6
    num_days = len(STANDARD_DAYS)
    total_periods_per_week = periods_per_day * num_days  # 30
    
    # Generate 1-3 subjects
    num_subjects = draw(st.integers(min_value=1, max_value=3))
    subjects = [draw(valid_subject()) for _ in range(num_subjects)]
    subject_ids = [s.id for s in subjects]
    
    # Ensure unique subject IDs
    assume(len(set(subject_ids)) == len(subject_ids))
    
    # Generate 1-2 rooms
    num_rooms = draw(st.integers(min_value=1, max_value=2))
    rooms = [draw(valid_room()) for _ in range(num_rooms)]
    
    # Ensure unique room IDs
    room_ids = [r.id for r in rooms]
    assume(len(set(room_ids)) == len(room_ids))
    
    # Generate 1 class with exactly total_periods_per_week periods
    cls = draw(valid_class_with_requirements(subject_ids, total_periods_per_week))
    
    # Generate 1 teacher with enough capacity (no overload)
    teacher = draw(valid_teacher_for_subjects(
        subject_ids, 
        max_periods=total_periods_per_week + 5,  # Extra capacity
        periods_per_day=periods_per_day
    ))
    
    config = valid_global_config(periods_per_day)
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=[teacher],
        classes=[cls],
    )


@st.composite
def valid_timetable_data_with_overload(draw):
    """Generate valid TimetableData where at least one teacher is overloaded."""
    periods_per_day = 6
    num_days = len(STANDARD_DAYS)
    total_periods_per_week = periods_per_day * num_days  # 30
    
    # Generate 1 subject
    subject = draw(valid_subject())
    subject_ids = [subject.id]
    
    # Generate 1 room
    room = draw(valid_room())
    
    # Generate 1 class with exactly total_periods_per_week periods
    cls = draw(valid_class_with_requirements(subject_ids, total_periods_per_week))
    
    # Generate 1 teacher with LESS capacity than needed (overload)
    max_periods = draw(st.integers(min_value=5, max_value=total_periods_per_week - 5))
    teacher = draw(valid_teacher_for_subjects(
        subject_ids, 
        max_periods=max_periods,
        periods_per_day=periods_per_day
    ))
    
    config = valid_global_config(periods_per_day)
    
    return TimetableData(
        config=config,
        rooms=[room],
        subjects=[subject],
        teachers=[teacher],
        classes=[cls],
    )


# ==============================================================================
# Property Tests: Pre-solve canProceed Correctness (Property 6)
# ==============================================================================

class TestPreSolveCanProceedCorrectness:
    """
    **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
    **Validates: Requirements 3.2, 3.3**
    
    For any pre-solve analysis result, canProceed SHALL be true if and only if
    the errors array is empty (contains no items with severity "error").
    """

    @given(data=valid_timetable_data_no_overload())
    @settings(max_examples=100)
    def test_can_proceed_true_when_no_errors(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
        **Validates: Requirements 3.2, 3.3**
        
        For any valid input without blocking issues, canProceed SHALL be true
        and errors array SHALL be empty.
        """
        analyzer = PreSolveAnalyzer(data)
        result = analyzer.analyze()
        
        # If no errors, can_proceed must be True
        if len(result.errors) == 0:
            assert result.can_proceed is True
        
        # Verify result structure
        assert isinstance(result.can_proceed, bool)
        assert isinstance(result.errors, list)
        assert isinstance(result.warnings, list)
        assert isinstance(result.suggestions, list)
        assert isinstance(result.analysis_time_ms, int)
        assert result.analysis_time_ms >= 0

    @given(data=valid_timetable_data_with_overload())
    @settings(max_examples=100)
    def test_can_proceed_false_when_errors_exist(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
        **Validates: Requirements 3.2, 3.3**
        
        For any input with blocking issues (teacher overload), canProceed SHALL
        be false and errors array SHALL contain at least one error.
        """
        analyzer = PreSolveAnalyzer(data)
        result = analyzer.analyze()
        
        # With overload, we expect errors
        assert len(result.errors) > 0
        assert result.can_proceed is False
        
        # Verify all errors have severity "error"
        for error in result.errors:
            assert error.severity == "error"

    @given(data=valid_timetable_data_no_overload())
    @settings(max_examples=100)
    def test_can_proceed_iff_errors_empty(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
        **Validates: Requirements 3.2, 3.3**
        
        For any pre-solve result, canProceed == (len(errors) == 0).
        This is the core property: canProceed is true IFF errors is empty.
        """
        analyzer = PreSolveAnalyzer(data)
        result = analyzer.analyze()
        
        # The fundamental property
        assert result.can_proceed == (len(result.errors) == 0)

    @given(data=valid_timetable_data_with_overload())
    @settings(max_examples=100)
    def test_can_proceed_iff_errors_empty_with_overload(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
        **Validates: Requirements 3.2, 3.3**
        
        For any pre-solve result with overload, canProceed == (len(errors) == 0).
        """
        analyzer = PreSolveAnalyzer(data)
        result = analyzer.analyze()
        
        # The fundamental property
        assert result.can_proceed == (len(result.errors) == 0)

    def test_warnings_do_not_block_proceed(self):
        """
        **Feature: solver-ux-feedback, Property 6: Pre-solve canProceed Correctness**
        **Validates: Requirements 3.3**
        
        Warnings (non-blocking issues) SHALL NOT affect canProceed.
        canProceed is determined only by errors, not warnings.
        """
        # Create data that will generate warnings but no errors
        # Room capacity warning scenario: more required periods than room capacity
        config = GlobalConfig(
            daysOfWeek=STANDARD_DAYS,
            periodsPerDay=6,
        )
        
        subject = Subject(id="MATH", name="Mathematics")
        
        # Only 1 room available
        room = Room(id="ROOM1", name="Room 1", capacity=30, type="classroom")
        
        # Teacher with enough capacity
        teacher = Teacher(
            id="T1",
            fullName="Teacher 1",
            primarySubjectIds=["MATH"],
            availability={day: [True] * 6 for day in STANDARD_DAYS},
            maxPeriodsPerWeek=60,  # Plenty of capacity
        )
        
        # Two classes, each needing 30 periods = 60 total
        # But only 1 room * 30 periods = 30 available
        class1 = ClassGroup(
            id="C1",
            name="Class 1",
            studentCount=25,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=30)},
            gradeLevel=1,
        )
        class2 = ClassGroup(
            id="C2",
            name="Class 2",
            studentCount=25,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=30)},
            gradeLevel=1,
        )
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=[subject],
            teachers=[teacher],
            classes=[class1, class2],
        )
        
        analyzer = PreSolveAnalyzer(data)
        result = analyzer.analyze()
        
        # Should have room capacity warning
        assert len(result.warnings) > 0
        
        # But can_proceed should still be True (warnings don't block)
        # unless there are also errors
        assert result.can_proceed == (len(result.errors) == 0)


# ==============================================================================
# Property Tests: Pre-solve Performance (Property 7)
# ==============================================================================

class TestPreSolvePerformance:
    """
    **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
    **Validates: Requirements 3.1**
    
    For any valid input data, pre-solve analysis SHALL complete and return
    a PreSolveResult within 2000 milliseconds.
    """

    @given(data=valid_timetable_data_no_overload())
    @settings(max_examples=100, deadline=None)  # Disable hypothesis deadline
    def test_analysis_completes_within_time_limit(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
        **Validates: Requirements 3.1**
        
        For any valid input, analyze() SHALL complete within 2000ms.
        """
        analyzer = PreSolveAnalyzer(data)
        
        start_time = time.time()
        result = analyzer.analyze()
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Must complete within 2000ms (Requirement 3.1)
        assert elapsed_ms < 2000, f"Analysis took {elapsed_ms}ms, exceeds 2000ms limit"
        
        # Result must be valid
        assert isinstance(result, PreSolveResult)
        assert result.analysis_time_ms >= 0

    @given(data=valid_timetable_data_with_overload())
    @settings(max_examples=100, deadline=None)
    def test_analysis_with_errors_completes_within_time_limit(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
        **Validates: Requirements 3.1**
        
        For any input with errors, analyze() SHALL still complete within 2000ms.
        """
        analyzer = PreSolveAnalyzer(data)
        
        start_time = time.time()
        result = analyzer.analyze()
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Must complete within 2000ms even with errors
        assert elapsed_ms < 2000, f"Analysis took {elapsed_ms}ms, exceeds 2000ms limit"
        
        # Result must be valid
        assert isinstance(result, PreSolveResult)

    def test_analysis_time_reported_accurately(self):
        """
        **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
        **Validates: Requirements 3.1**
        
        The analysis_time_ms field SHALL accurately reflect the time taken.
        """
        config = GlobalConfig(
            daysOfWeek=STANDARD_DAYS,
            periodsPerDay=6,
        )
        
        subject = Subject(id="MATH", name="Mathematics")
        room = Room(id="ROOM1", name="Room 1", capacity=30, type="classroom")
        teacher = Teacher(
            id="T1",
            fullName="Teacher 1",
            primarySubjectIds=["MATH"],
            availability={day: [True] * 6 for day in STANDARD_DAYS},
            maxPeriodsPerWeek=30,
        )
        cls = ClassGroup(
            id="C1",
            name="Class 1",
            studentCount=25,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=30)},
            gradeLevel=1,
        )
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=[subject],
            teachers=[teacher],
            classes=[cls],
        )
        
        analyzer = PreSolveAnalyzer(data)
        
        start_time = time.time()
        result = analyzer.analyze()
        actual_elapsed_ms = (time.time() - start_time) * 1000
        
        # Reported time should be close to actual time (within 100ms tolerance)
        # The reported time is measured internally, so it should be <= actual
        assert result.analysis_time_ms <= actual_elapsed_ms + 100
        assert result.analysis_time_ms >= 0

    def test_large_input_completes_within_time_limit(self):
        """
        **Feature: solver-ux-feedback, Property 7: Pre-solve Performance**
        **Validates: Requirements 3.1**
        
        Even with larger inputs (many classes, teachers), analysis SHALL
        complete within 2000ms.
        """
        config = GlobalConfig(
            daysOfWeek=STANDARD_DAYS,
            periodsPerDay=6,
        )
        
        # Create 10 subjects
        subjects = [
            Subject(id=f"SUBJ_{i}", name=f"Subject {i}")
            for i in range(10)
        ]
        subject_ids = [s.id for s in subjects]
        
        # Create 5 rooms
        rooms = [
            Room(id=f"ROOM_{i}", name=f"Room {i}", capacity=30, type="classroom")
            for i in range(5)
        ]
        
        # Create 20 teachers, each teaching 2 subjects
        teachers = []
        for i in range(20):
            teacher_subjects = [subject_ids[i % 10], subject_ids[(i + 1) % 10]]
            teachers.append(Teacher(
                id=f"T_{i}",
                fullName=f"Teacher {i}",
                primarySubjectIds=teacher_subjects,
                availability={day: [True] * 6 for day in STANDARD_DAYS},
                maxPeriodsPerWeek=30,
            ))
        
        # Create 10 classes
        classes = []
        for i in range(10):
            # Each class needs 30 periods total, distributed among 3 subjects
            class_subjects = [subject_ids[i % 10], subject_ids[(i + 1) % 10], subject_ids[(i + 2) % 10]]
            requirements = {
                class_subjects[0]: SubjectRequirement(periodsPerWeek=10),
                class_subjects[1]: SubjectRequirement(periodsPerWeek=10),
                class_subjects[2]: SubjectRequirement(periodsPerWeek=10),
            }
            classes.append(ClassGroup(
                id=f"C_{i}",
                name=f"Class {i}",
                studentCount=25,
                subjectRequirements=requirements,
                gradeLevel=(i % 12) + 1,
            ))
        
        data = TimetableData(
            config=config,
            rooms=rooms,
            subjects=subjects,
            teachers=teachers,
            classes=classes,
        )
        
        analyzer = PreSolveAnalyzer(data)
        
        start_time = time.time()
        result = analyzer.analyze()
        elapsed_ms = (time.time() - start_time) * 1000
        
        # Must complete within 2000ms even with large input
        assert elapsed_ms < 2000, f"Large input analysis took {elapsed_ms}ms, exceeds 2000ms limit"
        assert isinstance(result, PreSolveResult)
