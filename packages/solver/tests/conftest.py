# ==============================================================================
# Shared Test Fixtures and Configuration
#
# This file contains shared fixtures and Hypothesis strategies for all tests.
# ==============================================================================

import sys
from pathlib import Path

import pytest

# Add the solver package to the path so tests can import models
solver_path = Path(__file__).parent.parent
sys.path.insert(0, str(solver_path))

from hypothesis import strategies as st, settings

from models.input import (
    DayOfWeek,
    TimePreference,
    GlobalConfig,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
    TimetableData,
)


# ==============================================================================
# Hypothesis Settings
# ==============================================================================

# Configure default Hypothesis settings for all tests
settings.register_profile("ci", max_examples=100, deadline=10000)
settings.register_profile("dev", max_examples=20, deadline=5000)
settings.register_profile("debug", max_examples=5, deadline=None)

# Use 'dev' profile by default, CI can override with HYPOTHESIS_PROFILE env var
settings.load_profile("dev")


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
def six_day_week():
    """6-day school week including Saturday."""
    return [
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
        DayOfWeek.FRIDAY,
        DayOfWeek.SATURDAY,
    ]


@pytest.fixture
def minimal_config(standard_days):
    """Minimal valid GlobalConfig."""
    return GlobalConfig(
        daysOfWeek=standard_days,
        periodsPerDay=6,
    )


@pytest.fixture
def minimal_room():
    """Minimal valid Room."""
    return Room(
        id="ROOM_1",
        name="Room 1",
        capacity=30,
        type="classroom",
    )


@pytest.fixture
def minimal_subject():
    """Minimal valid Subject."""
    return Subject(
        id="MATH",
        name="Mathematics",
    )


@pytest.fixture
def minimal_teacher(standard_days):
    """Minimal valid Teacher."""
    periods_per_day = 6
    return Teacher(
        id="TEACHER_1",
        fullName="Ahmad Khan",
        primarySubjectIds=["MATH"],
        availability={day: [True] * periods_per_day for day in standard_days},
        maxPeriodsPerWeek=30,
    )


@pytest.fixture
def minimal_class():
    """Minimal valid ClassGroup."""
    return ClassGroup(
        id="CLASS_1A",
        name="Class 1-A",
        studentCount=25,
        subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=30)},
        gradeLevel=1,
    )


@pytest.fixture
def minimal_timetable_data(minimal_config, minimal_room, minimal_subject, minimal_teacher, minimal_class):
    """Minimal valid TimetableData."""
    return TimetableData(
        config=minimal_config,
        rooms=[minimal_room],
        subjects=[minimal_subject],
        teachers=[minimal_teacher],
        classes=[minimal_class],
    )


# ==============================================================================
# Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_id_strategy(draw):
    """Generate valid ID strings."""
    prefix = draw(st.sampled_from(["ROOM", "SUBJ", "TEACHER", "CLASS"]))
    suffix = draw(st.integers(min_value=1, max_value=999))
    return f"{prefix}_{suffix}"


@st.composite
def valid_name_strategy(draw):
    """Generate valid name strings."""
    return draw(st.text(
        alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Zs')),
        min_size=1,
        max_size=50
    ).filter(lambda x: len(x.strip()) > 0))


@st.composite
def day_of_week_strategy(draw):
    """Generate a valid DayOfWeek."""
    return draw(st.sampled_from(list(DayOfWeek)))


@st.composite
def grade_level_strategy(draw):
    """Generate a valid grade level (1-12)."""
    return draw(st.integers(min_value=1, max_value=12))


@st.composite
def room_strategy(draw):
    """Generate a valid Room."""
    room_id = draw(valid_id_strategy())
    return Room(
        id=room_id,
        name=f"Room {room_id}",
        capacity=draw(st.integers(min_value=10, max_value=50)),
        type=draw(st.sampled_from(["classroom", "lab", "gym", "library"])),
    )


@st.composite
def subject_strategy(draw):
    """Generate a valid Subject."""
    subject_id = draw(valid_id_strategy())
    return Subject(
        id=subject_id,
        name=f"Subject {subject_id}",
        isDifficult=draw(st.booleans()),
        isCustom=draw(st.booleans()),
    )
