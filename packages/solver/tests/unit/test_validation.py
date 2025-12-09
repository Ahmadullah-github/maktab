# ==============================================================================
#
#  Unit Tests for Validation Modules
#
#  Tests each validation function with valid and invalid inputs.
#  Requirements: 1.6
#
# ==============================================================================

import pytest
from unittest.mock import MagicMock

from models.input import (
    DayOfWeek,
    GlobalConfig,
    Room,
    Subject,
    Teacher,
    SubjectRequirement,
    ClassGroup,
)
from validation.period_config import validate_period_configuration
from validation.teacher_availability import validate_teacher_availability_structure
from validation.subject_references import (
    validate_subject_references,
    validate_custom_subjects,
    VALID_CATEGORIES,
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


def create_mock_timetable_data(config, teachers=None, subjects=None, classes=None):
    """Create a mock TimetableData object for testing validation functions directly."""
    mock_data = MagicMock()
    mock_data.config = config
    mock_data.teachers = teachers or []
    mock_data.subjects = subjects or []
    mock_data.classes = classes or []
    return mock_data


# ==============================================================================
# Period Configuration Validation Tests
# ==============================================================================

class TestValidatePeriodConfiguration:
    """Tests for validate_period_configuration function."""

    def test_valid_period_configuration(self, standard_days):
        """Valid period configuration should pass."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 6 for day in standard_days}
        
        data = create_mock_timetable_data(config)
        result = validate_period_configuration(data)
        assert result is data

    def test_missing_day_in_periods_per_day_map(self, standard_days):
        """Missing day in periodsPerDayMap should raise ValueError."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        # Missing Friday
        config.periodsPerDayMap = {day: 6 for day in standard_days[:-1]}
        
        data = create_mock_timetable_data(config)
        
        with pytest.raises(ValueError, match="Missing period count"):
            validate_period_configuration(data)

    def test_periods_out_of_range_too_high(self, standard_days):
        """Periods > 12 should raise ValueError."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 13 for day in standard_days}
        
        data = create_mock_timetable_data(config)
        
        with pytest.raises(ValueError, match="Must be between 1 and 12"):
            validate_period_configuration(data)

    def test_periods_out_of_range_zero(self, standard_days):
        """Periods = 0 should raise ValueError."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 0 for day in standard_days}
        
        data = create_mock_timetable_data(config)
        
        with pytest.raises(ValueError, match="Must be between 1 and 12"):
            validate_period_configuration(data)

    def test_no_periods_per_day_map(self, standard_days):
        """No periodsPerDayMap should pass (validation skipped)."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = None
        
        data = create_mock_timetable_data(config)
        result = validate_period_configuration(data)
        assert result is data


# ==============================================================================
# Teacher Availability Validation Tests
# ==============================================================================

class TestValidateTeacherAvailability:
    """Tests for validate_teacher_availability_structure function."""

    def test_valid_teacher_availability(self, standard_days):
        """Valid teacher availability should pass."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 6 for day in standard_days}
        config.periodsPerDay = 6
        
        teacher = MagicMock()
        teacher.id = "TEACHER_1"
        teacher.fullName = "Ahmad Khan"
        teacher.availability = {day.value: [True] * 6 for day in standard_days}
        
        data = create_mock_timetable_data(config, teachers=[teacher])
        result = validate_teacher_availability_structure(data)
        assert result is data

    def test_missing_day_in_availability(self, standard_days):
        """Missing day in teacher availability should raise ValueError."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 6 for day in standard_days}
        config.periodsPerDay = 6
        
        teacher = MagicMock()
        teacher.id = "TEACHER_1"
        teacher.fullName = "Ahmad Khan"
        # Missing Friday
        teacher.availability = {day.value: [True] * 6 for day in standard_days[:-1]}
        
        data = create_mock_timetable_data(config, teachers=[teacher])
        
        with pytest.raises(ValueError, match="is missing availability"):
            validate_teacher_availability_structure(data)

    def test_wrong_period_count_in_availability(self, standard_days):
        """Wrong number of periods in availability should raise ValueError."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 6 for day in standard_days}
        config.periodsPerDay = 6
        
        teacher = MagicMock()
        teacher.id = "TEACHER_1"
        teacher.fullName = "Ahmad Khan"
        # 5 periods instead of 6
        teacher.availability = {day.value: [True] * 5 for day in standard_days}
        
        data = create_mock_timetable_data(config, teachers=[teacher])
        
        with pytest.raises(ValueError, match="but configuration expects"):
            validate_teacher_availability_structure(data)

    def test_multiple_teachers_validation(self, standard_days):
        """All teachers should be validated."""
        config = MagicMock()
        config.daysOfWeek = standard_days
        config.periodsPerDayMap = {day: 6 for day in standard_days}
        config.periodsPerDay = 6
        
        teacher1 = MagicMock()
        teacher1.id = "TEACHER_1"
        teacher1.fullName = "Ahmad Khan"
        teacher1.availability = {day.value: [True] * 6 for day in standard_days}
        
        teacher2 = MagicMock()
        teacher2.id = "TEACHER_2"
        teacher2.fullName = "Sara Ahmadi"
        # Second teacher has wrong period count
        teacher2.availability = {day.value: [True] * 5 for day in standard_days}
        
        data = create_mock_timetable_data(config, teachers=[teacher1, teacher2])
        
        with pytest.raises(ValueError, match="Sara Ahmadi"):
            validate_teacher_availability_structure(data)


# ==============================================================================
# Subject Reference Validation Tests
# ==============================================================================

class TestValidateSubjectReferences:
    """Tests for validate_subject_references function."""

    def test_valid_subject_references(self):
        """Valid subject references should pass."""
        subject = MagicMock()
        subject.id = "MATH"
        
        cls = MagicMock()
        cls.id = "CLASS_1A"
        cls.name = "Class 1-A"
        cls.subjectRequirements = {"MATH": MagicMock()}
        
        data = create_mock_timetable_data(None, subjects=[subject], classes=[cls])
        result = validate_subject_references(data)
        assert result is data

    def test_unknown_subject_reference(self):
        """Unknown subject reference should raise ValueError."""
        subject = MagicMock()
        subject.id = "MATH"
        
        cls = MagicMock()
        cls.id = "CLASS_1A"
        cls.name = "Class 1-A"
        cls.subjectRequirements = {"UNKNOWN_SUBJECT": MagicMock()}
        
        data = create_mock_timetable_data(None, subjects=[subject], classes=[cls])
        
        with pytest.raises(ValueError, match="references unknown subject"):
            validate_subject_references(data)

    def test_similar_subject_suggestion(self):
        """Should suggest similar subjects when typo detected."""
        subject = MagicMock()
        subject.id = "MATHEMATICS"
        
        cls = MagicMock()
        cls.id = "CLASS_1A"
        cls.name = "Class 1-A"
        # "MATH" is similar to "MATHEMATICS"
        cls.subjectRequirements = {"MATH": MagicMock()}
        
        data = create_mock_timetable_data(None, subjects=[subject], classes=[cls])
        
        with pytest.raises(ValueError, match="Did you mean"):
            validate_subject_references(data)

    def test_multiple_classes_validation(self):
        """All classes should be validated."""
        subject = MagicMock()
        subject.id = "MATH"
        
        cls1 = MagicMock()
        cls1.id = "CLASS_1A"
        cls1.name = "Class 1-A"
        cls1.subjectRequirements = {"MATH": MagicMock()}
        
        cls2 = MagicMock()
        cls2.id = "CLASS_2A"
        cls2.name = "Class 2-A"
        cls2.subjectRequirements = {"UNKNOWN": MagicMock()}
        
        data = create_mock_timetable_data(None, subjects=[subject], classes=[cls1, cls2])
        
        with pytest.raises(ValueError, match="Class 2-A"):
            validate_subject_references(data)


# ==============================================================================
# Custom Subject Validation Tests
# ==============================================================================

class TestValidateCustomSubjects:
    """Tests for validate_custom_subjects function."""

    def test_valid_non_custom_subject(self):
        """Non-custom subject should pass."""
        subject = MagicMock()
        subject.id = "MATH"
        subject.name = "Mathematics"
        subject.isCustom = False
        
        data = create_mock_timetable_data(None, subjects=[subject])
        result = validate_custom_subjects(data)
        assert result is data

    def test_custom_subject_with_valid_category(self):
        """Custom subject with valid category should pass."""
        subject = MagicMock()
        subject.id = "CUSTOM_1"
        subject.name = "Custom Subject"
        subject.isCustom = True
        subject.customCategory = "Alpha-Primary"
        
        data = create_mock_timetable_data(None, subjects=[subject])
        result = validate_custom_subjects(data)
        assert result is data

    def test_custom_subject_with_invalid_category(self):
        """Custom subject with invalid category should raise ValueError."""
        subject = MagicMock()
        subject.id = "CUSTOM_1"
        subject.name = "Custom Subject"
        subject.isCustom = True
        subject.customCategory = "InvalidCategory"
        
        data = create_mock_timetable_data(None, subjects=[subject])
        
        with pytest.raises(ValueError, match="has invalid customCategory"):
            validate_custom_subjects(data)

    def test_all_valid_categories_accepted(self):
        """All valid categories should be accepted."""
        for category in VALID_CATEGORIES:
            subject = MagicMock()
            subject.id = f"CUSTOM_{category}"
            subject.name = f"Custom {category}"
            subject.isCustom = True
            subject.customCategory = category
            
            data = create_mock_timetable_data(None, subjects=[subject])
            result = validate_custom_subjects(data)
            assert result is data

    def test_non_custom_subject_with_category_ignored(self):
        """Non-custom subject with customCategory should be ignored."""
        subject = MagicMock()
        subject.id = "MATH"
        subject.name = "Mathematics"
        subject.isCustom = False
        subject.customCategory = "InvalidCategory"  # Should be ignored
        
        data = create_mock_timetable_data(None, subjects=[subject])
        # Should not raise error since isCustom=False
        result = validate_custom_subjects(data)
        assert result is data

    def test_custom_subject_without_category(self):
        """Custom subject without customCategory should pass."""
        subject = MagicMock()
        subject.id = "CUSTOM_1"
        subject.name = "Custom Subject"
        subject.isCustom = True
        subject.customCategory = None
        
        data = create_mock_timetable_data(None, subjects=[subject])
        result = validate_custom_subjects(data)
        assert result is data
