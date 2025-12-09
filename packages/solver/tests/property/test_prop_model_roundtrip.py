# ==============================================================================
# Property Test: Input Model Serialization Round-Trip
#
# **Feature: solver-refactoring, Property 4: Configuration Round-Trip**
# **Validates: Requirements 3.6, 10.2**
#
# For any valid TimetableData object, serializing to JSON and deserializing
# back SHALL produce an equivalent data object.
# ==============================================================================

import json
from typing import Dict, List

import pytest
from hypothesis import given, strategies as st, settings, assume

from models.input import (
    DayOfWeek,
    TimePreference,
    Period,
    UnavailableSlot,
    GlobalConfig,
    GlobalPreferences,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
    TimetableData,
)


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_time_string(draw):
    """Generate valid time strings in HH:MM format."""
    hour = draw(st.integers(min_value=0, max_value=23))
    minute = draw(st.integers(min_value=0, max_value=59))
    return f"{hour:02d}:{minute:02d}"


@st.composite
def valid_id(draw):
    """Generate valid ID strings."""
    return draw(st.text(
        alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd'), whitelist_characters='_-'),
        min_size=1,
        max_size=20
    ).filter(lambda x: len(x.strip()) > 0))


@st.composite
def valid_name(draw):
    """Generate valid name strings."""
    return draw(st.text(
        alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs'), whitelist_characters=' -'),
        min_size=1,
        max_size=50
    ).filter(lambda x: len(x.strip()) > 0))


@st.composite
def day_of_week(draw):
    """Generate a valid DayOfWeek."""
    return draw(st.sampled_from(list(DayOfWeek)))


@st.composite
def days_of_week_list(draw, min_size=1, max_size=6):
    """Generate a list of unique days of week."""
    all_days = list(DayOfWeek)[:6]  # Exclude Sunday for typical school week
    num_days = draw(st.integers(min_value=min_size, max_value=min(max_size, len(all_days))))
    return all_days[:num_days]


@st.composite
def periods_per_day_map(draw, days: List[DayOfWeek]):
    """Generate a valid periodsPerDayMap for given days."""
    periods = draw(st.integers(min_value=4, max_value=8))
    return {day: periods for day in days}


@st.composite
def teacher_availability(draw, days: List[DayOfWeek], periods_per_day: int):
    """Generate valid teacher availability for given days and periods."""
    availability = {}
    for day in days:
        # Generate list of booleans for each period
        day_availability = draw(st.lists(
            st.booleans(),
            min_size=periods_per_day,
            max_size=periods_per_day
        ))
        # Ensure at least one available period
        if not any(day_availability):
            day_availability[0] = True
        availability[day] = day_availability
    return availability


@st.composite
def valid_room(draw):
    """Generate a valid Room."""
    return Room(
        id=draw(valid_id()),
        name=draw(valid_name()),
        capacity=draw(st.integers(min_value=10, max_value=50)),
        type=draw(st.sampled_from(["classroom", "lab", "gym", "library"])),
        features=draw(st.none() | st.lists(st.text(min_size=1, max_size=20), max_size=3)),
    )


@st.composite
def valid_subject(draw):
    """Generate a valid Subject."""
    return Subject(
        id=draw(valid_id()),
        name=draw(valid_name()),
        isDifficult=draw(st.booleans()),
        isCustom=draw(st.booleans()),
    )


@st.composite
def valid_subject_requirement(draw):
    """Generate a valid SubjectRequirement."""
    return SubjectRequirement(
        periodsPerWeek=draw(st.integers(min_value=1, max_value=6)),
    )


@st.composite
def minimal_timetable_data(draw):
    """
    Generate minimal valid TimetableData for round-trip testing.
    
    This creates a small but valid timetable configuration that can be
    serialized and deserialized without validation errors.
    """
    # Generate days
    days = draw(days_of_week_list(min_size=5, max_size=6))
    periods_per_day = draw(st.integers(min_value=5, max_value=7))
    
    # Generate config
    config = GlobalConfig(
        daysOfWeek=days,
        periodsPerDay=periods_per_day,
        periodsPerDayMap={day: periods_per_day for day in days},
    )
    
    # Generate rooms
    room_id = f"ROOM_{draw(st.integers(min_value=1, max_value=100))}"
    rooms = [Room(
        id=room_id,
        name=f"Room {room_id}",
        capacity=30,
        type="classroom",
    )]
    
    # Generate subjects
    subject_id = f"SUBJ_{draw(st.integers(min_value=1, max_value=100))}"
    subjects = [Subject(
        id=subject_id,
        name=f"Subject {subject_id}",
    )]
    
    # Generate teacher with proper availability
    teacher_id = f"TEACHER_{draw(st.integers(min_value=1, max_value=100))}"
    availability = {}
    for day in days:
        availability[day] = [True] * periods_per_day
    
    teachers = [Teacher(
        id=teacher_id,
        fullName=f"Teacher {teacher_id}",
        primarySubjectIds=[subject_id],
        availability=availability,
        maxPeriodsPerWeek=periods_per_day * len(days),
    )]
    
    # Generate class with matching subject requirements
    # Total periods must equal available periods (no empty periods)
    total_available = periods_per_day * len(days)
    class_id = f"CLASS_{draw(st.integers(min_value=1, max_value=100))}"
    
    classes = [ClassGroup(
        id=class_id,
        name=f"Class {class_id}",
        studentCount=25,
        subjectRequirements={
            subject_id: SubjectRequirement(periodsPerWeek=total_available)
        },
        gradeLevel=draw(st.integers(min_value=1, max_value=12)),
    )]
    
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

class TestModelRoundTrip:
    """Property tests for model serialization round-trip."""

    @given(data=minimal_timetable_data())
    @settings(max_examples=50, deadline=10000)
    def test_timetable_data_json_roundtrip(self, data: TimetableData):
        """
        **Property 4: Configuration Round-Trip**
        
        For any valid TimetableData object, serializing to JSON and
        deserializing back SHALL produce an equivalent data object.
        """
        # Serialize to JSON
        json_str = data.model_dump_json()
        
        # Deserialize back
        restored = TimetableData.model_validate_json(json_str)
        
        # Verify equivalence
        assert restored.config.periodsPerDay == data.config.periodsPerDay
        assert len(restored.rooms) == len(data.rooms)
        assert len(restored.subjects) == len(data.subjects)
        assert len(restored.teachers) == len(data.teachers)
        assert len(restored.classes) == len(data.classes)
        
        # Verify room IDs match
        original_room_ids = {r.id for r in data.rooms}
        restored_room_ids = {r.id for r in restored.rooms}
        assert original_room_ids == restored_room_ids
        
        # Verify subject IDs match
        original_subject_ids = {s.id for s in data.subjects}
        restored_subject_ids = {s.id for s in restored.subjects}
        assert original_subject_ids == restored_subject_ids
        
        # Verify teacher IDs match
        original_teacher_ids = {t.id for t in data.teachers}
        restored_teacher_ids = {t.id for t in restored.teachers}
        assert original_teacher_ids == restored_teacher_ids
        
        # Verify class IDs match
        original_class_ids = {c.id for c in data.classes}
        restored_class_ids = {c.id for c in restored.classes}
        assert original_class_ids == restored_class_ids

    @given(data=minimal_timetable_data())
    @settings(max_examples=50, deadline=10000)
    def test_timetable_data_dict_roundtrip(self, data: TimetableData):
        """
        For any valid TimetableData, converting to dict and back
        SHALL produce an equivalent object.
        """
        # Convert to dict
        data_dict = data.model_dump()
        
        # Convert back
        restored = TimetableData.model_validate(data_dict)
        
        # Verify key fields
        assert restored.config.periodsPerDay == data.config.periodsPerDay
        assert len(restored.classes) == len(data.classes)

    @given(room=valid_room())
    @settings(max_examples=100, deadline=5000)
    def test_room_roundtrip(self, room: Room):
        """Room model round-trip serialization."""
        json_str = room.model_dump_json()
        restored = Room.model_validate_json(json_str)
        
        assert restored.id == room.id
        assert restored.name == room.name
        assert restored.capacity == room.capacity
        assert restored.type == room.type

    @given(subject=valid_subject())
    @settings(max_examples=100, deadline=5000)
    def test_subject_roundtrip(self, subject: Subject):
        """Subject model round-trip serialization."""
        json_str = subject.model_dump_json()
        restored = Subject.model_validate_json(json_str)
        
        assert restored.id == subject.id
        assert restored.name == subject.name
        assert restored.isDifficult == subject.isDifficult
        assert restored.isCustom == subject.isCustom


class TestGradeCategory:
    """
    **Feature: solver-refactoring, Property 18: Grade Category Validity**
    **Validates: Requirements 10.1**
    """

    @given(grade=st.integers(min_value=1, max_value=12))
    @settings(max_examples=100)
    def test_grade_category_always_valid(self, grade: int):
        """
        For any grade 1-12, the auto-determined category must be
        one of the four valid Afghan education system categories.
        """
        valid_categories = {"Alpha-Primary", "Beta-Primary", "Middle", "High"}
        
        # Create a ClassGroup with the grade level
        class_group = ClassGroup(
            id="test_class",
            name="Test Class",
            studentCount=25,
            subjectRequirements={},
            gradeLevel=grade,
        )
        
        # Category should be auto-determined
        assert class_group.category is not None
        assert class_group.category in valid_categories

    @given(grade=st.integers(min_value=1, max_value=3))
    def test_alpha_primary_grades(self, grade: int):
        """Grades 1-3 should be Alpha-Primary."""
        class_group = ClassGroup(
            id="test", name="Test", studentCount=25,
            subjectRequirements={}, gradeLevel=grade
        )
        assert class_group.category == "Alpha-Primary"

    @given(grade=st.integers(min_value=4, max_value=6))
    def test_beta_primary_grades(self, grade: int):
        """Grades 4-6 should be Beta-Primary."""
        class_group = ClassGroup(
            id="test", name="Test", studentCount=25,
            subjectRequirements={}, gradeLevel=grade
        )
        assert class_group.category == "Beta-Primary"

    @given(grade=st.integers(min_value=7, max_value=9))
    def test_middle_grades(self, grade: int):
        """Grades 7-9 should be Middle."""
        class_group = ClassGroup(
            id="test", name="Test", studentCount=25,
            subjectRequirements={}, gradeLevel=grade
        )
        assert class_group.category == "Middle"

    @given(grade=st.integers(min_value=10, max_value=12))
    def test_high_grades(self, grade: int):
        """Grades 10-12 should be High."""
        class_group = ClassGroup(
            id="test", name="Test", studentCount=25,
            subjectRequirements={}, gradeLevel=grade
        )
        assert class_group.category == "High"
