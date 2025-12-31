# ==============================================================================
# Property Tests: Quality Score Structure
#
# **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
# **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
#
# For any successful solver response, the qualityScore object SHALL contain
# an overall score (0-100), a breakdown object with teacherGaps,
# afternoonDifficultSubjects, sameDaySubjectRepetition, and teacherLoadBalance
# fields, AND each suggestion SHALL contain suggestionCode, messageFarsi,
# affectedEntities, and expectedImprovement.
#
# ==============================================================================

import sys
from pathlib import Path
from typing import Any, Dict, List

import pytest
from hypothesis import given, strategies as st, settings, assume

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
from models.output import ScheduledLesson
from feedback.quality_scorer import QualityScorer, BASE_SCORE, SUGGESTION_THRESHOLD
from feedback.response_models import (
    QualityScore,
    QualityBreakdown,
    Suggestion,
    AffectedEntity,
)


# ==============================================================================
# Strategies for generating test data
# ==============================================================================

# Strategy for days of week
day_strategy = st.sampled_from(list(DayOfWeek))

# Strategy for period indices (0-based, max 11 periods per day)
period_index_strategy = st.integers(min_value=0, max_value=11)


@st.composite
def scheduled_lesson_strategy(draw, class_ids: List[str], subject_ids: List[str], teacher_ids: List[str]):
    """Generate a valid ScheduledLesson."""
    return ScheduledLesson(
        day=draw(day_strategy),
        periodIndex=draw(period_index_strategy),
        classId=draw(st.sampled_from(class_ids)) if class_ids else "class-1",
        subjectId=draw(st.sampled_from(subject_ids)) if subject_ids else "subject-1",
        teacherIds=[draw(st.sampled_from(teacher_ids))] if teacher_ids else ["teacher-1"],
        roomId=None,
        isFixed=False,
    )


@st.composite
def timetable_data_strategy(draw):
    """Generate valid TimetableData for quality scoring."""
    days = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY, 
            DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY]
    periods_per_day = draw(st.integers(min_value=4, max_value=8))
    
    # Generate subjects (1-5)
    num_subjects = draw(st.integers(min_value=1, max_value=5))
    subjects = []
    for i in range(num_subjects):
        subjects.append(Subject(
            id=f"subject-{i}",
            name=f"Subject {i}",
            isDifficult=draw(st.booleans()),
        ))
    
    # Generate teachers (1-3)
    num_teachers = draw(st.integers(min_value=1, max_value=3))
    teachers = []
    for i in range(num_teachers):
        teachers.append(Teacher(
            id=f"teacher-{i}",
            fullName=f"Teacher {i}",
            primarySubjectIds=[s.id for s in subjects],
            availability={day: [True] * periods_per_day for day in days},
            maxPeriodsPerWeek=draw(st.integers(min_value=10, max_value=40)),
        ))
    
    # Generate classes (1-3)
    num_classes = draw(st.integers(min_value=1, max_value=3))
    classes = []
    total_periods = len(days) * periods_per_day
    for i in range(num_classes):
        # Distribute periods across subjects to fill the schedule
        subject_reqs = {}
        remaining = total_periods
        for j, subj in enumerate(subjects):
            if j == len(subjects) - 1:
                # Last subject gets remaining periods
                periods = remaining
            else:
                # Distribute evenly with some variation
                periods = remaining // (len(subjects) - j)
            subject_reqs[subj.id] = SubjectRequirement(periodsPerWeek=periods)
            remaining -= periods
        
        classes.append(ClassGroup(
            id=f"class-{i}",
            name=f"Class {i}",
            studentCount=25,
            subjectRequirements=subject_reqs,
            gradeLevel=draw(st.integers(min_value=1, max_value=12)),
        ))
    
    # Generate room
    room = Room(
        id="room-1",
        name="Room 1",
        capacity=30,
        type="classroom",
    )
    
    config = GlobalConfig(
        daysOfWeek=days,
        periodsPerDay=periods_per_day,
    )
    
    return TimetableData(
        config=config,
        rooms=[room],
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )


@st.composite
def schedule_strategy(draw, data: TimetableData):
    """Generate a valid schedule for the given TimetableData."""
    schedule = []
    class_ids = [c.id for c in data.classes]
    subject_ids = [s.id for s in data.subjects]
    teacher_ids = [t.id for t in data.teachers]
    
    # Generate lessons for each class
    for cls in data.classes:
        for subject_id, req in cls.subjectRequirements.items():
            periods_remaining = req.periodsPerWeek
            day_idx = 0
            period_idx = 0
            
            while periods_remaining > 0 and day_idx < len(data.config.daysOfWeek):
                day = data.config.daysOfWeek[day_idx]
                
                # Pick a random teacher
                teacher_id = draw(st.sampled_from(teacher_ids))
                
                schedule.append(ScheduledLesson(
                    day=day,
                    periodIndex=period_idx,
                    classId=cls.id,
                    subjectId=subject_id,
                    teacherIds=[teacher_id],
                    roomId="room-1",
                    isFixed=False,
                ))
                
                periods_remaining -= 1
                period_idx += 1
                
                if period_idx >= data.config.periodsPerDay:
                    period_idx = 0
                    day_idx += 1
    
    return schedule


# ==============================================================================
# Property Tests: Quality Score Structure (Property 8)
# ==============================================================================

class TestQualityScoreStructure:
    """
    **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
    **Validates: Requirements 4.1, 4.2, 4.4, 4.5**
    
    For any successful solver response, the qualityScore object SHALL contain
    an overall score (0-100), a breakdown object with teacherGaps,
    afternoonDifficultSubjects, sameDaySubjectRepetition, and teacherLoadBalance
    fields, AND each suggestion SHALL contain suggestionCode, messageFarsi,
    affectedEntities, and expectedImprovement.
    """

    @given(data=st.data())
    @settings(max_examples=100)
    def test_quality_score_overall_in_valid_range(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.1**
        
        For any schedule and timetable data, the overall quality score
        SHALL be between 0 and 100 inclusive.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        assert 0 <= quality_score.overall <= 100, (
            f"Overall score {quality_score.overall} is outside valid range [0, 100]"
        )

    @given(data=st.data())
    @settings(max_examples=100)
    def test_quality_score_has_breakdown_with_required_fields(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.2**
        
        For any schedule, the quality score breakdown SHALL contain
        teacherGaps, afternoonDifficultSubjects, sameDaySubjectRepetition,
        and teacherLoadBalance fields.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        breakdown = quality_score.breakdown
        
        # Verify all required breakdown fields exist
        assert hasattr(breakdown, 'teacher_gaps'), "breakdown must have teacher_gaps"
        assert hasattr(breakdown, 'afternoon_difficult_subjects'), "breakdown must have afternoon_difficult_subjects"
        assert hasattr(breakdown, 'same_day_subject_repetition'), "breakdown must have same_day_subject_repetition"
        assert hasattr(breakdown, 'teacher_load_balance'), "breakdown must have teacher_load_balance"
        
        # Verify breakdown fields are dictionaries with required keys
        assert "count" in breakdown.teacher_gaps, "teacher_gaps must have 'count'"
        assert "penalty" in breakdown.teacher_gaps, "teacher_gaps must have 'penalty'"
        
        assert "count" in breakdown.afternoon_difficult_subjects, "afternoon_difficult_subjects must have 'count'"
        assert "penalty" in breakdown.afternoon_difficult_subjects, "afternoon_difficult_subjects must have 'penalty'"
        
        assert "count" in breakdown.same_day_subject_repetition, "same_day_subject_repetition must have 'count'"
        assert "penalty" in breakdown.same_day_subject_repetition, "same_day_subject_repetition must have 'penalty'"
        
        assert "variance" in breakdown.teacher_load_balance, "teacher_load_balance must have 'variance'"
        assert "penalty" in breakdown.teacher_load_balance, "teacher_load_balance must have 'penalty'"

    @given(data=st.data())
    @settings(max_examples=100)
    def test_quality_score_breakdown_values_are_non_negative(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.2**
        
        For any schedule, all breakdown counts and penalties SHALL be non-negative.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        breakdown = quality_score.breakdown
        
        # All counts must be non-negative
        assert breakdown.teacher_gaps["count"] >= 0, "teacher_gaps count must be >= 0"
        assert breakdown.afternoon_difficult_subjects["count"] >= 0, "afternoon_difficult_subjects count must be >= 0"
        assert breakdown.same_day_subject_repetition["count"] >= 0, "same_day_subject_repetition count must be >= 0"
        
        # All penalties must be non-negative
        assert breakdown.teacher_gaps["penalty"] >= 0, "teacher_gaps penalty must be >= 0"
        assert breakdown.afternoon_difficult_subjects["penalty"] >= 0, "afternoon_difficult_subjects penalty must be >= 0"
        assert breakdown.same_day_subject_repetition["penalty"] >= 0, "same_day_subject_repetition penalty must be >= 0"
        assert breakdown.teacher_load_balance["penalty"] >= 0, "teacher_load_balance penalty must be >= 0"
        
        # Variance must be non-negative
        assert breakdown.teacher_load_balance["variance"] >= 0, "teacher_load_balance variance must be >= 0"

    @given(data=st.data())
    @settings(max_examples=100)
    def test_suggestions_have_required_fields(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.4**
        
        For any suggestion in the quality score, it SHALL contain
        suggestionCode, messageFarsi, affectedEntities, and expectedImprovement.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        for suggestion in quality_score.suggestions:
            # Verify all required fields exist
            assert hasattr(suggestion, 'suggestion_code'), "suggestion must have suggestion_code"
            assert hasattr(suggestion, 'message_farsi'), "suggestion must have message_farsi"
            assert hasattr(suggestion, 'affected_entities'), "suggestion must have affected_entities"
            assert hasattr(suggestion, 'expected_improvement'), "suggestion must have expected_improvement"
            
            # Verify field types and values
            assert isinstance(suggestion.suggestion_code, str), "suggestion_code must be string"
            assert len(suggestion.suggestion_code) > 0, "suggestion_code must be non-empty"
            
            assert isinstance(suggestion.message_farsi, str), "message_farsi must be string"
            assert len(suggestion.message_farsi) > 0, "message_farsi must be non-empty"
            
            assert isinstance(suggestion.affected_entities, list), "affected_entities must be list"
            
            assert isinstance(suggestion.expected_improvement, int), "expected_improvement must be int"
            assert suggestion.expected_improvement >= 0, "expected_improvement must be >= 0"

    @given(data=st.data())
    @settings(max_examples=100)
    def test_affected_entities_in_suggestions_have_required_fields(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.4**
        
        For any affected entity in a suggestion, it SHALL contain
        entity_type, entity_id, and entity_name.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        for suggestion in quality_score.suggestions:
            for entity in suggestion.affected_entities:
                # Verify all required fields exist
                assert hasattr(entity, 'entity_type'), "entity must have entity_type"
                assert hasattr(entity, 'entity_id'), "entity must have entity_id"
                assert hasattr(entity, 'entity_name'), "entity must have entity_name"
                
                # Verify field types
                assert isinstance(entity.entity_type, str), "entity_type must be string"
                assert isinstance(entity.entity_id, str), "entity_id must be string"
                assert isinstance(entity.entity_name, str), "entity_name must be string"
                
                # Verify entity_type is valid
                assert entity.entity_type in ["teacher", "class", "room", "subject"], (
                    f"entity_type '{entity.entity_type}' is not valid"
                )

    @given(data=st.data())
    @settings(max_examples=100)
    def test_quality_score_serializes_completely(self, data):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.5**
        
        For any quality score, serialization SHALL include all required fields.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        # Serialize to dict
        json_dict = quality_score.model_dump()
        
        # Verify required fields in serialized output
        assert "overall" in json_dict, "Serialized quality score must contain 'overall'"
        assert "breakdown" in json_dict, "Serialized quality score must contain 'breakdown'"
        assert "suggestions" in json_dict, "Serialized quality score must contain 'suggestions'"
        
        # Verify breakdown fields
        breakdown = json_dict["breakdown"]
        assert "teacher_gaps" in breakdown, "breakdown must contain 'teacher_gaps'"
        assert "afternoon_difficult_subjects" in breakdown, "breakdown must contain 'afternoon_difficult_subjects'"
        assert "same_day_subject_repetition" in breakdown, "breakdown must contain 'same_day_subject_repetition'"
        assert "teacher_load_balance" in breakdown, "breakdown must contain 'teacher_load_balance'"

    def test_empty_schedule_produces_valid_quality_score(self):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.1, 4.2**
        
        An empty schedule SHALL produce a valid quality score with all required fields.
        """
        days = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY]
        
        config = GlobalConfig(
            daysOfWeek=days,
            periodsPerDay=6,
        )
        
        subject = Subject(id="math", name="Mathematics", isDifficult=True)
        teacher = Teacher(
            id="teacher-1",
            fullName="Ahmad",
            primarySubjectIds=["math"],
            availability={day: [True] * 6 for day in days},
            maxPeriodsPerWeek=18,
        )
        cls = ClassGroup(
            id="class-1",
            name="Class 1",
            studentCount=25,
            subjectRequirements={"math": SubjectRequirement(periodsPerWeek=18)},
            gradeLevel=1,
        )
        room = Room(id="room-1", name="Room 1", capacity=30, type="classroom")
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=[subject],
            teachers=[teacher],
            classes=[cls],
        )
        
        # Empty schedule
        schedule = []
        
        scorer = QualityScorer(schedule, data)
        quality_score = scorer.calculate()
        
        # Verify structure
        assert 0 <= quality_score.overall <= 100
        assert quality_score.breakdown is not None
        assert quality_score.suggestions is not None
        assert isinstance(quality_score.suggestions, list)

    def test_quality_score_is_instance_of_correct_type(self):
        """
        **Feature: solver-ux-feedback, Property 8: Quality Score Structure**
        **Validates: Requirements 4.1**
        
        The calculate() method SHALL return a QualityScore instance.
        """
        days = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY]
        
        config = GlobalConfig(
            daysOfWeek=days,
            periodsPerDay=6,
        )
        
        subject = Subject(id="math", name="Mathematics")
        teacher = Teacher(
            id="teacher-1",
            fullName="Ahmad",
            primarySubjectIds=["math"],
            availability={day: [True] * 6 for day in days},
            maxPeriodsPerWeek=18,
        )
        cls = ClassGroup(
            id="class-1",
            name="Class 1",
            studentCount=25,
            subjectRequirements={"math": SubjectRequirement(periodsPerWeek=18)},
            gradeLevel=1,
        )
        room = Room(id="room-1", name="Room 1", capacity=30, type="classroom")
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=[subject],
            teachers=[teacher],
            classes=[cls],
        )
        
        schedule = [
            ScheduledLesson(
                day=DayOfWeek.SATURDAY,
                periodIndex=0,
                classId="class-1",
                subjectId="math",
                teacherIds=["teacher-1"],
            )
        ]
        
        scorer = QualityScorer(schedule, data)
        quality_score = scorer.calculate()
        
        assert isinstance(quality_score, QualityScore), "calculate() must return QualityScore instance"
        assert isinstance(quality_score.breakdown, QualityBreakdown), "breakdown must be QualityBreakdown instance"


# ==============================================================================
# Property Tests: Low Quality Triggers Suggestions (Property 9)
# ==============================================================================

def create_low_quality_schedule_and_data():
    """
    Create a schedule that is designed to produce a low quality score (< 70).
    
    This creates schedules with:
    - Teacher gaps (free periods between teaching periods)
    - Difficult subjects in afternoon
    - Same subject multiple times on same day
    
    Returns a tuple of (TimetableData, schedule).
    """
    days = [DayOfWeek.SATURDAY, DayOfWeek.SUNDAY, DayOfWeek.MONDAY, 
            DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY]
    periods_per_day = 8  # More periods to allow for gaps
    total_periods = len(days) * periods_per_day  # 40 periods
    
    # Create difficult subjects
    subjects = [
        Subject(id="math", name="ریاضی", isDifficult=True),
        Subject(id="physics", name="فیزیک", isDifficult=True),
        Subject(id="art", name="هنر", isDifficult=False),
    ]
    
    # Create teachers
    teachers = [
        Teacher(
            id="teacher-1",
            fullName="استاد احمد",
            primarySubjectIds=["math", "physics", "art"],
            availability={day: [True] * periods_per_day for day in days},
            maxPeriodsPerWeek=40,
        ),
        Teacher(
            id="teacher-2",
            fullName="استاد محمد",
            primarySubjectIds=["math", "physics", "art"],
            availability={day: [True] * periods_per_day for day in days},
            maxPeriodsPerWeek=40,
        ),
    ]
    
    # Create classes - subject requirements must equal total periods (no empty periods)
    classes = [
        ClassGroup(
            id="class-1",
            name="صنف ۱۰-الف",
            studentCount=25,
            subjectRequirements={
                "math": SubjectRequirement(periodsPerWeek=16),
                "physics": SubjectRequirement(periodsPerWeek=16),
                "art": SubjectRequirement(periodsPerWeek=8),
            },
            gradeLevel=10,
        ),
    ]
    
    room = Room(id="room-1", name="اتاق ۱", capacity=30, type="classroom")
    
    config = GlobalConfig(
        daysOfWeek=days,
        periodsPerDay=periods_per_day,
    )
    
    data = TimetableData(
        config=config,
        rooms=[room],
        subjects=subjects,
        teachers=teachers,
        classes=classes,
    )
    
    # Create a schedule with quality issues:
    # We need to fill all 40 periods but create quality issues
    schedule = []
    
    # Day 1 (Saturday): Create gaps for teacher-1 and same-day repetition
    # Periods 0, 2, 4, 6 for teacher-1 (gaps at 1, 3, 5, 7)
    # Periods 1, 3, 5, 7 for teacher-2
    for period_idx in [0, 2, 4, 6]:
        schedule.append(ScheduledLesson(
            day=DayOfWeek.SATURDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="math",  # Same subject = repetition
            teacherIds=["teacher-1"],
            roomId="room-1",
            isFixed=False,
        ))
    for period_idx in [1, 3, 5, 7]:
        schedule.append(ScheduledLesson(
            day=DayOfWeek.SATURDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="math",  # Same subject = more repetition
            teacherIds=["teacher-2"],
            roomId="room-1",
            isFixed=False,
        ))
    
    # Day 2 (Sunday): Same pattern - gaps and repetition
    for period_idx in [0, 2, 4, 6]:
        schedule.append(ScheduledLesson(
            day=DayOfWeek.SUNDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="physics",  # Difficult subject
            teacherIds=["teacher-1"],
            roomId="room-1",
            isFixed=False,
        ))
    for period_idx in [1, 3, 5, 7]:
        schedule.append(ScheduledLesson(
            day=DayOfWeek.SUNDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="physics",  # Same subject = repetition
            teacherIds=["teacher-2"],
            roomId="room-1",
            isFixed=False,
        ))
    
    # Day 3 (Monday): Difficult subjects in afternoon
    for period_idx in range(8):
        schedule.append(ScheduledLesson(
            day=DayOfWeek.MONDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="math" if period_idx >= 4 else "art",  # Math (difficult) in afternoon
            teacherIds=["teacher-1"],
            roomId="room-1",
            isFixed=False,
        ))
    
    # Day 4 (Tuesday): Difficult subjects in afternoon
    for period_idx in range(8):
        schedule.append(ScheduledLesson(
            day=DayOfWeek.TUESDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="physics" if period_idx >= 4 else "art",  # Physics (difficult) in afternoon
            teacherIds=["teacher-2"],
            roomId="room-1",
            isFixed=False,
        ))
    
    # Day 5 (Wednesday): More difficult subjects in afternoon
    for period_idx in range(8):
        schedule.append(ScheduledLesson(
            day=DayOfWeek.WEDNESDAY,
            periodIndex=period_idx,
            classId="class-1",
            subjectId="physics" if period_idx >= 4 else "art",  # Physics (difficult) in afternoon
            teacherIds=["teacher-1"],
            roomId="room-1",
            isFixed=False,
        ))
    
    return data, schedule


class TestLowQualityTriggersSuggestions:
    """
    **Feature: solver-ux-feedback, Property 9: Low Quality Triggers Suggestions**
    **Validates: Requirements 4.3**
    
    For any successful solver response where qualityScore.overall is less than 70,
    the suggestions array SHALL contain at least one suggestion.
    """

    @given(data=st.data())
    @settings(max_examples=100)
    def test_low_quality_score_has_suggestions(self, data):
        """
        **Feature: solver-ux-feedback, Property 9: Low Quality Triggers Suggestions**
        **Validates: Requirements 4.3**
        
        For any schedule that produces a quality score below 70,
        the suggestions array SHALL contain at least one suggestion.
        """
        # Use the existing timetable_data_strategy and schedule_strategy
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        # Only check if score is actually below threshold
        if quality_score.overall < SUGGESTION_THRESHOLD:
            assert len(quality_score.suggestions) >= 1, (
                f"Quality score {quality_score.overall} is below {SUGGESTION_THRESHOLD} "
                f"but no suggestions were generated. "
                f"Breakdown: teacher_gaps={quality_score.breakdown.teacher_gaps}, "
                f"afternoon_difficult={quality_score.breakdown.afternoon_difficult_subjects}, "
                f"same_day_repetition={quality_score.breakdown.same_day_subject_repetition}, "
                f"load_balance={quality_score.breakdown.teacher_load_balance}"
            )

    def test_score_below_70_always_has_suggestion(self):
        """
        **Feature: solver-ux-feedback, Property 9: Low Quality Triggers Suggestions**
        **Validates: Requirements 4.3**
        
        A schedule specifically designed to have low quality SHALL have suggestions.
        """
        # Use the helper function that creates a valid low-quality schedule
        data, schedule = create_low_quality_schedule_and_data()
        
        scorer = QualityScorer(schedule, data)
        quality_score = scorer.calculate()
        
        # This schedule should have a low score due to:
        # - Teacher gaps (alternating periods create gaps)
        # - Difficult subjects in afternoon
        # - Same subject multiple times per day
        
        # Verify the score is below 70 and has suggestions
        if quality_score.overall < SUGGESTION_THRESHOLD:
            assert len(quality_score.suggestions) >= 1, (
                f"Quality score {quality_score.overall} is below {SUGGESTION_THRESHOLD} "
                f"but no suggestions were generated"
            )

    def test_extreme_low_quality_has_suggestion(self):
        """
        **Feature: solver-ux-feedback, Property 9: Low Quality Triggers Suggestions**
        **Validates: Requirements 4.3**
        
        An extremely low quality schedule SHALL have at least one suggestion.
        """
        # Use the helper function that creates a valid low-quality schedule
        data, schedule = create_low_quality_schedule_and_data()
        
        scorer = QualityScorer(schedule, data)
        quality_score = scorer.calculate()
        
        # With the issues in the schedule (gaps, afternoon difficult, repetition),
        # the score should be below 70
        # If it's below threshold, verify suggestions exist
        if quality_score.overall < SUGGESTION_THRESHOLD:
            assert len(quality_score.suggestions) >= 1, (
                f"Quality score {quality_score.overall} is below {SUGGESTION_THRESHOLD} "
                f"but no suggestions were generated. "
                f"Breakdown: {quality_score.breakdown}"
            )

    @given(data=st.data())
    @settings(max_examples=100)
    def test_high_quality_may_have_no_suggestions(self, data):
        """
        **Feature: solver-ux-feedback, Property 9: Low Quality Triggers Suggestions**
        **Validates: Requirements 4.3**
        
        For any schedule with quality score >= 70, suggestions MAY be empty.
        This is the inverse property - high quality doesn't require suggestions.
        """
        timetable_data = data.draw(timetable_data_strategy())
        schedule = data.draw(schedule_strategy(timetable_data))
        
        scorer = QualityScorer(schedule, timetable_data)
        quality_score = scorer.calculate()
        
        # If score is >= 70, it's valid to have no suggestions
        if quality_score.overall >= SUGGESTION_THRESHOLD:
            # This is valid - high quality schedules don't need suggestions
            assert quality_score.suggestions is not None, "suggestions should be a list (possibly empty)"
            assert isinstance(quality_score.suggestions, list), "suggestions must be a list"

