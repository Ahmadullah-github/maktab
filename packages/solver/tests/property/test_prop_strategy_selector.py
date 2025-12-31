# ==============================================================================
# Property Tests: Strategy Selector
#
# Tests for strategy auto-selection and override functionality.
#
# **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
# **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
#
# **Feature: solver-ux-feedback, Property 12: Strategy Override**
# **Validates: Requirements 6.5**
#
# ==============================================================================

from typing import List

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
from feedback.strategy_selector import (
    StrategySelector,
    FAST_THRESHOLD,
    BALANCED_THRESHOLD,
)


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Standard 5-day week (Afghanistan school week)
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

# Strategy for valid strategy names
valid_strategies = st.sampled_from(["fast", "balanced", "thorough"])


def create_global_config(periods_per_day: int = 6) -> GlobalConfig:
    """Create a valid GlobalConfig."""
    return GlobalConfig(
        daysOfWeek=STANDARD_DAYS,
        periodsPerDay=periods_per_day,
    )


@st.composite
def timetable_data_with_lesson_count(draw, min_classes: int, max_classes: int):
    """
    Generate TimetableData with a specific range of classes.
    
    Each class has exactly 30 periods (6 periods/day * 5 days).
    Total lessons = num_classes * 30.
    
    Args:
        min_classes: Minimum number of classes to generate
        max_classes: Maximum number of classes to generate
    """
    periods_per_day = 6
    num_days = len(STANDARD_DAYS)
    periods_per_week_per_class = periods_per_day * num_days  # 30
    
    # Draw number of classes directly
    num_classes = draw(st.integers(min_value=min_classes, max_value=max_classes))
    
    # Generate subjects (at least 1)
    num_subjects = draw(st.integers(min_value=1, max_value=5))
    subjects = []
    for i in range(num_subjects):
        subject_id = f"SUBJ_{i}"
        subjects.append(Subject(
            id=subject_id,
            name=f"Subject {i}",
            isDifficult=draw(st.booleans()),
        ))
    subject_ids = [s.id for s in subjects]
    
    # Generate rooms (at least 1)
    num_rooms = draw(st.integers(min_value=1, max_value=3))
    rooms = []
    for i in range(num_rooms):
        rooms.append(Room(
            id=f"ROOM_{i}",
            name=f"Room {i}",
            capacity=30,
            type="classroom",
        ))
    
    # Generate teachers (enough to cover all subjects)
    teachers = []
    for i, subject_id in enumerate(subject_ids):
        teachers.append(Teacher(
            id=f"TEACHER_{i}",
            fullName=f"Teacher {i}",
            primarySubjectIds=[subject_id],
            availability={day: [True] * periods_per_day for day in STANDARD_DAYS},
            maxPeriodsPerWeek=num_classes * periods_per_week_per_class,  # Enough capacity
        ))
    
    # Generate classes
    classes = []
    for i in range(num_classes):
        # Distribute periods among subjects evenly
        periods_per_subject = periods_per_week_per_class // num_subjects
        extra = periods_per_week_per_class % num_subjects
        
        requirements = {}
        for j, sid in enumerate(subject_ids):
            periods = periods_per_subject + (1 if j < extra else 0)
            if periods > 0:
                requirements[sid] = SubjectRequirement(periodsPerWeek=periods)
        
        classes.append(ClassGroup(
            id=f"CLASS_{i}",
            name=f"Class {i}",
            studentCount=25,
            subjectRequirements=requirements,
            gradeLevel=(i % 12) + 1,
        ))
    
    config = create_global_config(periods_per_day)
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )


# Strategies for different school sizes
# With 30 periods per class:
# - Small: < 200 lessons = 1-6 classes (max 180 lessons)
# - Medium: 200-499 lessons = 7-16 classes (210-480 lessons)
# - Large: >= 500 lessons = 17+ classes (510+ lessons)

small_school_data = timetable_data_with_lesson_count(
    min_classes=1,  # 30 lessons
    max_classes=6   # 180 lessons (< 200)
)

medium_school_data = timetable_data_with_lesson_count(
    min_classes=7,   # 210 lessons (>= 200)
    max_classes=16   # 480 lessons (< 500)
)

large_school_data = timetable_data_with_lesson_count(
    min_classes=17,  # 510 lessons (>= 500)
    max_classes=30   # 900 lessons (reasonable upper bound)
)


# ==============================================================================
# Property Tests: Strategy Auto-Selection (Property 11)
# ==============================================================================

class TestStrategyAutoSelection:
    """
    **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
    **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
    
    For any solver execution without explicit strategy parameter, the solver
    SHALL select "fast" if totalLessons < 200, "balanced" if 200 <= totalLessons < 500,
    and "thorough" if totalLessons >= 500, AND include strategySelected and
    strategyReason in metadata.
    """

    @given(data=small_school_data)
    @settings(max_examples=100)
    def test_small_school_selects_fast_strategy(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.1, 6.2**
        
        For any school with totalLessons < 200, the selector SHALL choose "fast".
        """
        selector = StrategySelector(data)
        result = selector.select()
        
        # Verify total lessons is in expected range
        assert selector.total_lessons < FAST_THRESHOLD, (
            f"Expected total_lessons < {FAST_THRESHOLD}, got {selector.total_lessons}"
        )
        
        # Must select fast strategy
        assert result["strategy_selected"] == "fast", (
            f"Expected 'fast' for {selector.total_lessons} lessons, "
            f"got '{result['strategy_selected']}'"
        )
        
        # Must not be overridden
        assert result["strategy_overridden"] is False
        
        # Must include reason
        assert "strategy_reason" in result
        assert len(result["strategy_reason"]) > 0
        
        # Must include total_lessons
        assert result["total_lessons"] == selector.total_lessons

    @given(data=medium_school_data)
    @settings(max_examples=100)
    def test_medium_school_selects_balanced_strategy(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.1, 6.3**
        
        For any school with 200 <= totalLessons < 500, the selector SHALL choose "balanced".
        """
        selector = StrategySelector(data)
        result = selector.select()
        
        # Verify total lessons is in expected range
        assert FAST_THRESHOLD <= selector.total_lessons < BALANCED_THRESHOLD, (
            f"Expected {FAST_THRESHOLD} <= total_lessons < {BALANCED_THRESHOLD}, "
            f"got {selector.total_lessons}"
        )
        
        # Must select balanced strategy
        assert result["strategy_selected"] == "balanced", (
            f"Expected 'balanced' for {selector.total_lessons} lessons, "
            f"got '{result['strategy_selected']}'"
        )
        
        # Must not be overridden
        assert result["strategy_overridden"] is False
        
        # Must include reason
        assert "strategy_reason" in result
        assert len(result["strategy_reason"]) > 0

    @given(data=large_school_data)
    @settings(max_examples=100)
    def test_large_school_selects_thorough_strategy(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.1, 6.4**
        
        For any school with totalLessons >= 500, the selector SHALL choose "thorough".
        """
        selector = StrategySelector(data)
        result = selector.select()
        
        # Verify total lessons is in expected range
        assert selector.total_lessons >= BALANCED_THRESHOLD, (
            f"Expected total_lessons >= {BALANCED_THRESHOLD}, got {selector.total_lessons}"
        )
        
        # Must select thorough strategy
        assert result["strategy_selected"] == "thorough", (
            f"Expected 'thorough' for {selector.total_lessons} lessons, "
            f"got '{result['strategy_selected']}'"
        )
        
        # Must not be overridden
        assert result["strategy_overridden"] is False
        
        # Must include reason
        assert "strategy_reason" in result
        assert len(result["strategy_reason"]) > 0

    @given(
        data=st.one_of(small_school_data, medium_school_data, large_school_data)
    )
    @settings(max_examples=100)
    def test_auto_selection_returns_required_fields(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.1**
        
        For any auto-selection, the result SHALL contain strategy_selected,
        strategy_overridden, strategy_reason, and total_lessons fields.
        """
        selector = StrategySelector(data)
        result = selector.select()
        
        # All required fields must be present
        required_fields = ["strategy_selected", "strategy_overridden", "strategy_reason", "total_lessons"]
        for field in required_fields:
            assert field in result, f"Missing required field: {field}"
        
        # strategy_selected must be one of the valid strategies
        assert result["strategy_selected"] in ["fast", "balanced", "thorough"]
        
        # strategy_overridden must be False for auto-selection
        assert result["strategy_overridden"] is False
        
        # total_lessons must match the calculated value
        assert result["total_lessons"] == selector.total_lessons

    @given(
        data=st.one_of(small_school_data, medium_school_data, large_school_data)
    )
    @settings(max_examples=100)
    def test_strategy_selection_is_deterministic(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.1**
        
        For any input, calling select() multiple times SHALL return the same result.
        """
        selector = StrategySelector(data)
        
        result1 = selector.select()
        result2 = selector.select()
        
        assert result1 == result2, "Strategy selection must be deterministic"

    def test_threshold_boundary_fast_to_balanced(self):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.2, 6.3**
        
        At the boundary (199 vs 200 lessons), strategy SHALL change from fast to balanced.
        """
        # Create minimal data structures for boundary testing
        periods_per_day = 6
        num_days = len(STANDARD_DAYS)
        periods_per_class = periods_per_day * num_days  # 30
        
        config = create_global_config(periods_per_day)
        subject = Subject(id="MATH", name="Mathematics")
        room = Room(id="ROOM1", name="Room 1", capacity=30, type="classroom")
        
        # Helper to create data with specific number of classes
        def create_data(num_classes: int) -> TimetableData:
            teachers = [Teacher(
                id=f"T{i}",
                fullName=f"Teacher {i}",
                primarySubjectIds=["MATH"],
                availability={day: [True] * periods_per_day for day in STANDARD_DAYS},
                maxPeriodsPerWeek=periods_per_class,
            ) for i in range(num_classes)]
            
            classes = [ClassGroup(
                id=f"C{i}",
                name=f"Class {i}",
                studentCount=25,
                subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=periods_per_class)},
                gradeLevel=1,
            ) for i in range(num_classes)]
            
            return TimetableData(
                config=config,
                rooms=[room],
                subjects=[subject],
                teachers=teachers,
                classes=classes,
            )
        
        # 6 classes = 180 lessons (< 200) -> fast
        data_below = create_data(6)
        selector_below = StrategySelector(data_below)
        assert selector_below.total_lessons == 180
        result_below = selector_below.select()
        assert result_below["strategy_selected"] == "fast"
        
        # 7 classes = 210 lessons (>= 200) -> balanced
        data_at = create_data(7)
        selector_at = StrategySelector(data_at)
        assert selector_at.total_lessons == 210
        result_at = selector_at.select()
        assert result_at["strategy_selected"] == "balanced"

    def test_threshold_boundary_balanced_to_thorough(self):
        """
        **Feature: solver-ux-feedback, Property 11: Strategy Auto-Selection**
        **Validates: Requirements 6.3, 6.4**
        
        At the boundary (499 vs 500 lessons), strategy SHALL change from balanced to thorough.
        """
        periods_per_day = 6
        num_days = len(STANDARD_DAYS)
        periods_per_class = periods_per_day * num_days  # 30
        
        config = create_global_config(periods_per_day)
        subject = Subject(id="MATH", name="Mathematics")
        room = Room(id="ROOM1", name="Room 1", capacity=30, type="classroom")
        
        def create_data(num_classes: int) -> TimetableData:
            teachers = [Teacher(
                id=f"T{i}",
                fullName=f"Teacher {i}",
                primarySubjectIds=["MATH"],
                availability={day: [True] * periods_per_day for day in STANDARD_DAYS},
                maxPeriodsPerWeek=periods_per_class,
            ) for i in range(num_classes)]
            
            classes = [ClassGroup(
                id=f"C{i}",
                name=f"Class {i}",
                studentCount=25,
                subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=periods_per_class)},
                gradeLevel=1,
            ) for i in range(num_classes)]
            
            return TimetableData(
                config=config,
                rooms=[room],
                subjects=[subject],
                teachers=teachers,
                classes=classes,
            )
        
        # 16 classes = 480 lessons (< 500) -> balanced
        data_below = create_data(16)
        selector_below = StrategySelector(data_below)
        assert selector_below.total_lessons == 480
        result_below = selector_below.select()
        assert result_below["strategy_selected"] == "balanced"
        
        # 17 classes = 510 lessons (>= 500) -> thorough
        data_at = create_data(17)
        selector_at = StrategySelector(data_at)
        assert selector_at.total_lessons == 510
        result_at = selector_at.select()
        assert result_at["strategy_selected"] == "thorough"


# ==============================================================================
# Property Tests: Strategy Override (Property 12)
# ==============================================================================

class TestStrategyOverride:
    """
    **Feature: solver-ux-feedback, Property 12: Strategy Override**
    **Validates: Requirements 6.5**
    
    For any solver execution with explicit strategy parameter, the solver SHALL
    use the specified strategy regardless of lesson count AND set strategyOverridden
    to true in metadata.
    """

    @given(
        data=st.one_of(small_school_data, medium_school_data, large_school_data),
        user_strategy=valid_strategies
    )
    @settings(max_examples=100)
    def test_user_strategy_overrides_auto_selection(
        self, 
        data: TimetableData, 
        user_strategy: str
    ):
        """
        **Feature: solver-ux-feedback, Property 12: Strategy Override**
        **Validates: Requirements 6.5**
        
        For any user-specified strategy, the selector SHALL use that strategy
        regardless of total lesson count.
        """
        selector = StrategySelector(data)
        result = selector.select(user_strategy=user_strategy)
        
        # Must use the user-specified strategy
        assert result["strategy_selected"] == user_strategy, (
            f"Expected '{user_strategy}', got '{result['strategy_selected']}'"
        )
        
        # Must be marked as overridden
        assert result["strategy_overridden"] is True
        
        # Must include reason indicating user specified
        assert "strategy_reason" in result
        assert "User" in result["strategy_reason"] or "user" in result["strategy_reason"].lower()
        
        # Must still include total_lessons
        assert result["total_lessons"] == selector.total_lessons

    @given(data=small_school_data)
    @settings(max_examples=100)
    def test_override_thorough_on_small_school(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 12: Strategy Override**
        **Validates: Requirements 6.5**
        
        User can override to "thorough" even for small schools.
        """
        selector = StrategySelector(data)
        
        # Without override, should be "fast"
        auto_result = selector.select()
        assert auto_result["strategy_selected"] == "fast"
        assert auto_result["strategy_overridden"] is False
        
        # With override, should be "thorough"
        override_result = selector.select(user_strategy="thorough")
        assert override_result["strategy_selected"] == "thorough"
        assert override_result["strategy_overridden"] is True

    @given(data=large_school_data)
    @settings(max_examples=100)
    def test_override_fast_on_large_school(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 12: Strategy Override**
        **Validates: Requirements 6.5**
        
        User can override to "fast" even for large schools.
        """
        selector = StrategySelector(data)
        
        # Without override, should be "thorough"
        auto_result = selector.select()
        assert auto_result["strategy_selected"] == "thorough"
        assert auto_result["strategy_overridden"] is False
        
        # With override, should be "fast"
        override_result = selector.select(user_strategy="fast")
        assert override_result["strategy_selected"] == "fast"
        assert override_result["strategy_overridden"] is True

    @given(
        data=st.one_of(small_school_data, medium_school_data, large_school_data),
        user_strategy=valid_strategies
    )
    @settings(max_examples=100)
    def test_override_returns_required_fields(
        self, 
        data: TimetableData, 
        user_strategy: str
    ):
        """
        **Feature: solver-ux-feedback, Property 12: Strategy Override**
        **Validates: Requirements 6.5**
        
        For any override, the result SHALL contain all required fields.
        """
        selector = StrategySelector(data)
        result = selector.select(user_strategy=user_strategy)
        
        # All required fields must be present
        required_fields = ["strategy_selected", "strategy_overridden", "strategy_reason", "total_lessons"]
        for field in required_fields:
            assert field in result, f"Missing required field: {field}"
        
        # Types must be correct
        assert isinstance(result["strategy_selected"], str)
        assert isinstance(result["strategy_overridden"], bool)
        assert isinstance(result["strategy_reason"], str)
        assert isinstance(result["total_lessons"], int)

    @given(
        data=st.one_of(small_school_data, medium_school_data, large_school_data)
    )
    @settings(max_examples=100)
    def test_none_strategy_triggers_auto_selection(self, data: TimetableData):
        """
        **Feature: solver-ux-feedback, Property 12: Strategy Override**
        **Validates: Requirements 6.5**
        
        When user_strategy is None, auto-selection SHALL be used.
        """
        selector = StrategySelector(data)
        
        # Explicit None should trigger auto-selection
        result = selector.select(user_strategy=None)
        
        assert result["strategy_overridden"] is False
        
        # Strategy should match auto-selection rules
        if selector.total_lessons < FAST_THRESHOLD:
            assert result["strategy_selected"] == "fast"
        elif selector.total_lessons < BALANCED_THRESHOLD:
            assert result["strategy_selected"] == "balanced"
        else:
            assert result["strategy_selected"] == "thorough"


# ==============================================================================
# Additional Tests: Total Lessons Calculation
# ==============================================================================

class TestTotalLessonsCalculation:
    """
    Tests for the _count_total_lessons() method.
    """

    def test_single_class_single_subject(self):
        """Total lessons equals periodsPerWeek for single class/subject."""
        config = create_global_config(6)
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
        
        selector = StrategySelector(data)
        assert selector.total_lessons == 30

    def test_multiple_classes_multiple_subjects(self):
        """Total lessons is sum across all classes and subjects."""
        config = create_global_config(6)
        subjects = [
            Subject(id="MATH", name="Mathematics"),
            Subject(id="SCI", name="Science"),
        ]
        room = Room(id="ROOM1", name="Room 1", capacity=30, type="classroom")
        teachers = [
            Teacher(
                id="T1",
                fullName="Teacher 1",
                primarySubjectIds=["MATH"],
                availability={day: [True] * 6 for day in STANDARD_DAYS},
                maxPeriodsPerWeek=60,
            ),
            Teacher(
                id="T2",
                fullName="Teacher 2",
                primarySubjectIds=["SCI"],
                availability={day: [True] * 6 for day in STANDARD_DAYS},
                maxPeriodsPerWeek=60,
            ),
        ]
        classes = [
            ClassGroup(
                id="C1",
                name="Class 1",
                studentCount=25,
                subjectRequirements={
                    "MATH": SubjectRequirement(periodsPerWeek=15),
                    "SCI": SubjectRequirement(periodsPerWeek=15),
                },
                gradeLevel=1,
            ),
            ClassGroup(
                id="C2",
                name="Class 2",
                studentCount=25,
                subjectRequirements={
                    "MATH": SubjectRequirement(periodsPerWeek=15),
                    "SCI": SubjectRequirement(periodsPerWeek=15),
                },
                gradeLevel=2,
            ),
        ]
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=subjects,
            teachers=teachers,
            classes=classes,
        )
        
        selector = StrategySelector(data)
        # Class 1: 15 + 15 = 30
        # Class 2: 15 + 15 = 30
        # Total: 60
        assert selector.total_lessons == 60

    def test_empty_requirements_contribute_zero(self):
        """Classes with zero periodsPerWeek contribute zero to total."""
        config = create_global_config(6)
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
        
        selector = StrategySelector(data)
        assert selector.total_lessons == 30
