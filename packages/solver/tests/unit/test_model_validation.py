# ==============================================================================
# Unit Tests: Model Validation
#
# Tests validation errors for invalid inputs and model_validator cross-field
# validation for the input models.
#
# _Requirements: 1.7_
# ==============================================================================

import pytest
from pydantic import ValidationError

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
# Period Model Tests
# ==============================================================================

class TestPeriodValidation:
    """Tests for Period model validation."""

    def test_valid_period(self):
        """Valid period should be created successfully."""
        period = Period(index=0, startTime="08:00", endTime="08:45")
        assert period.index == 0
        assert period.startTime == "08:00"
        assert period.endTime == "08:45"

    def test_period_negative_index_rejected(self):
        """Period with negative index should be rejected."""
        with pytest.raises(ValidationError) as exc_info:
            Period(index=-1)
        assert "greater than or equal to 0" in str(exc_info.value).lower()

    def test_period_invalid_time_format_rejected(self):
        """Period with invalid time format should be rejected."""
        with pytest.raises(ValidationError):
            Period(index=0, startTime="25:00")  # Invalid hour

    def test_period_invalid_duration_rejected(self):
        """Period with non-positive duration should be rejected."""
        with pytest.raises(ValidationError):
            Period(index=0, duration=0)  # Must be > 0


# ==============================================================================
# Room Model Tests
# ==============================================================================

class TestRoomValidation:
    """Tests for Room model validation."""

    def test_valid_room(self):
        """Valid room should be created successfully."""
        room = Room(id="ROOM_1", name="Room 1", capacity=30, type="classroom")
        assert room.id == "ROOM_1"
        assert room.capacity == 30

    def test_room_empty_id_rejected(self):
        """Room with empty ID should be rejected."""
        with pytest.raises(ValidationError):
            Room(id="", name="Room 1", capacity=30, type="classroom")

    def test_room_empty_name_rejected(self):
        """Room with empty name should be rejected."""
        with pytest.raises(ValidationError):
            Room(id="ROOM_1", name="", capacity=30, type="classroom")

    def test_room_negative_capacity_rejected(self):
        """Room with negative capacity should be rejected."""
        with pytest.raises(ValidationError):
            Room(id="ROOM_1", name="Room 1", capacity=-1, type="classroom")


# ==============================================================================
# Subject Model Tests
# ==============================================================================

class TestSubjectValidation:
    """Tests for Subject model validation."""

    def test_valid_subject(self):
        """Valid subject should be created successfully."""
        subject = Subject(id="MATH", name="Mathematics")
        assert subject.id == "MATH"
        assert subject.isCustom is False

    def test_subject_empty_id_rejected(self):
        """Subject with empty ID should be rejected."""
        with pytest.raises(ValidationError):
            Subject(id="", name="Mathematics")

    def test_custom_subject_with_category(self):
        """Custom subject with valid category should be accepted."""
        subject = Subject(
            id="QURAN",
            name="Quran Studies",
            isCustom=True,
            customCategory="Alpha-Primary"
        )
        assert subject.isCustom is True
        assert subject.customCategory == "Alpha-Primary"


# ==============================================================================
# Teacher Model Tests
# ==============================================================================

class TestTeacherValidation:
    """Tests for Teacher model validation."""

    def test_valid_teacher(self):
        """Valid teacher should be created successfully."""
        teacher = Teacher(
            id="TEACHER_1",
            fullName="Ahmad Khan",
            primarySubjectIds=["MATH"],
            availability={
                DayOfWeek.MONDAY: [True, True, True, True, True],
                DayOfWeek.TUESDAY: [True, True, True, True, True],
            },
            maxPeriodsPerWeek=20
        )
        assert teacher.id == "TEACHER_1"
        assert len(teacher.primarySubjectIds) == 1

    def test_teacher_empty_id_rejected(self):
        """Teacher with empty ID should be rejected."""
        with pytest.raises(ValidationError):
            Teacher(
                id="",
                fullName="Ahmad Khan",
                primarySubjectIds=["MATH"],
                availability={DayOfWeek.MONDAY: [True]},
                maxPeriodsPerWeek=20
            )

    def test_teacher_empty_primary_subjects_rejected(self):
        """Teacher with no primary subjects should be rejected."""
        with pytest.raises(ValidationError):
            Teacher(
                id="TEACHER_1",
                fullName="Ahmad Khan",
                primarySubjectIds=[],  # Empty list
                availability={DayOfWeek.MONDAY: [True]},
                maxPeriodsPerWeek=20
            )

    def test_teacher_negative_max_periods_rejected(self):
        """Teacher with negative maxPeriodsPerWeek should be rejected."""
        with pytest.raises(ValidationError):
            Teacher(
                id="TEACHER_1",
                fullName="Ahmad Khan",
                primarySubjectIds=["MATH"],
                availability={DayOfWeek.MONDAY: [True]},
                maxPeriodsPerWeek=-1
            )


# ==============================================================================
# SubjectRequirement Model Tests
# ==============================================================================

class TestSubjectRequirementValidation:
    """Tests for SubjectRequirement model validation."""

    def test_valid_requirement(self):
        """Valid subject requirement should be created successfully."""
        req = SubjectRequirement(periodsPerWeek=5)
        assert req.periodsPerWeek == 5

    def test_requirement_negative_periods_rejected(self):
        """Requirement with negative periods should be rejected."""
        with pytest.raises(ValidationError):
            SubjectRequirement(periodsPerWeek=-1)

    def test_requirement_with_constraints(self):
        """Requirement with min/max constraints should be accepted."""
        req = SubjectRequirement(
            periodsPerWeek=4,
            minConsecutive=2,
            maxConsecutive=2
        )
        assert req.minConsecutive == 2
        assert req.maxConsecutive == 2


# ==============================================================================
# ClassGroup Model Tests
# ==============================================================================

class TestClassGroupValidation:
    """Tests for ClassGroup model validation."""

    def test_valid_class_group(self):
        """Valid class group should be created successfully."""
        cls = ClassGroup(
            id="CLASS_1A",
            name="Class 1-A",
            studentCount=25,
            subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=5)},
            gradeLevel=1
        )
        assert cls.id == "CLASS_1A"
        assert cls.category == "Alpha-Primary"  # Auto-determined

    def test_class_empty_id_rejected(self):
        """Class with empty ID should be rejected."""
        with pytest.raises(ValidationError):
            ClassGroup(
                id="",
                name="Class 1-A",
                studentCount=25,
                subjectRequirements={}
            )

    def test_class_negative_student_count_rejected(self):
        """Class with negative student count should be rejected."""
        with pytest.raises(ValidationError):
            ClassGroup(
                id="CLASS_1A",
                name="Class 1-A",
                studentCount=-1,
                subjectRequirements={}
            )

    def test_class_grade_level_auto_category(self):
        """Grade level should auto-determine category."""
        # Alpha-Primary (1-3)
        cls1 = ClassGroup(id="C1", name="C1", studentCount=25, subjectRequirements={}, gradeLevel=2)
        assert cls1.category == "Alpha-Primary"
        
        # Beta-Primary (4-6)
        cls2 = ClassGroup(id="C2", name="C2", studentCount=25, subjectRequirements={}, gradeLevel=5)
        assert cls2.category == "Beta-Primary"
        
        # Middle (7-9)
        cls3 = ClassGroup(id="C3", name="C3", studentCount=25, subjectRequirements={}, gradeLevel=8)
        assert cls3.category == "Middle"
        
        # High (10-12)
        cls4 = ClassGroup(id="C4", name="C4", studentCount=25, subjectRequirements={}, gradeLevel=11)
        assert cls4.category == "High"

    def test_class_invalid_grade_level_rejected(self):
        """Class with invalid grade level should be rejected."""
        with pytest.raises(ValidationError):
            ClassGroup(
                id="CLASS_1A",
                name="Class 1-A",
                studentCount=25,
                subjectRequirements={},
                gradeLevel=0  # Must be 1-12
            )
        
        with pytest.raises(ValidationError):
            ClassGroup(
                id="CLASS_1A",
                name="Class 1-A",
                studentCount=25,
                subjectRequirements={},
                gradeLevel=13  # Must be 1-12
            )


# ==============================================================================
# GlobalConfig Model Tests
# ==============================================================================

class TestGlobalConfigValidation:
    """Tests for GlobalConfig model validation."""

    def test_valid_config(self):
        """Valid config should be created successfully."""
        config = GlobalConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY],
            periodsPerDay=6
        )
        assert config.periodsPerDay == 6
        assert len(config.daysOfWeek) == 2

    def test_config_empty_days_rejected(self):
        """Config with no days should be rejected."""
        with pytest.raises(ValidationError):
            GlobalConfig(daysOfWeek=[], periodsPerDay=6)

    def test_config_zero_periods_rejected(self):
        """Config with zero periods should be rejected."""
        with pytest.raises(ValidationError):
            GlobalConfig(daysOfWeek=[DayOfWeek.MONDAY], periodsPerDay=0)

    def test_config_periods_per_day_map_validation(self):
        """Config should validate periodsPerDayMap entries."""
        # Valid map
        config = GlobalConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY],
            periodsPerDay=6,
            periodsPerDayMap={
                DayOfWeek.MONDAY: 6,
                DayOfWeek.TUESDAY: 5
            }
        )
        assert config.periodsPerDayMap[DayOfWeek.MONDAY] == 6

    def test_config_invalid_periods_in_map_rejected(self):
        """Config with invalid periods in map should be rejected."""
        with pytest.raises(ValidationError):
            GlobalConfig(
                daysOfWeek=[DayOfWeek.MONDAY],
                periodsPerDay=6,
                periodsPerDayMap={DayOfWeek.MONDAY: 15}  # > 12
            )

    def test_config_category_periods_validation(self):
        """Config should validate categoryPeriodsPerDayMap."""
        config = GlobalConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY],
            periodsPerDay=6,
            categoryPeriodsPerDayMap={
                "Alpha-Primary": {DayOfWeek.MONDAY: 5, DayOfWeek.TUESDAY: 5},
                "High": {DayOfWeek.MONDAY: 7, DayOfWeek.TUESDAY: 7}
            }
        )
        # periodsPerDay should be set to max
        assert config.periodsPerDay == 7

    def test_config_invalid_category_rejected(self):
        """Config with invalid category should be rejected."""
        with pytest.raises(ValidationError):
            GlobalConfig(
                daysOfWeek=[DayOfWeek.MONDAY],
                periodsPerDay=6,
                categoryPeriodsPerDayMap={
                    "InvalidCategory": {DayOfWeek.MONDAY: 5}
                }
            )


# ==============================================================================
# TimetableData Cross-Field Validation Tests
# ==============================================================================

class TestTimetableDataCrossValidation:
    """Tests for TimetableData cross-field validation."""

    def _create_minimal_valid_data(self):
        """Create minimal valid TimetableData for testing."""
        days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
        periods_per_day = 6
        total_periods = periods_per_day * len(days)  # 30
        
        return {
            "config": GlobalConfig(
                daysOfWeek=days,
                periodsPerDay=periods_per_day,
            ),
            "rooms": [Room(id="ROOM_1", name="Room 1", capacity=30, type="classroom")],
            "subjects": [Subject(id="MATH", name="Mathematics")],
            "teachers": [Teacher(
                id="TEACHER_1",
                fullName="Ahmad Khan",
                primarySubjectIds=["MATH"],
                availability={day: [True] * periods_per_day for day in days},
                maxPeriodsPerWeek=total_periods
            )],
            "classes": [ClassGroup(
                id="CLASS_1A",
                name="Class 1-A",
                studentCount=25,
                subjectRequirements={"MATH": SubjectRequirement(periodsPerWeek=total_periods)},
                gradeLevel=1
            )]
        }

    def test_valid_timetable_data(self):
        """Valid TimetableData should be created successfully."""
        data = self._create_minimal_valid_data()
        timetable = TimetableData(**data)
        assert len(timetable.classes) == 1
        assert len(timetable.teachers) == 1

    def test_unknown_subject_reference_rejected(self):
        """Class referencing unknown subject should be rejected."""
        data = self._create_minimal_valid_data()
        # Reference a subject that doesn't exist
        data["classes"][0].subjectRequirements["UNKNOWN_SUBJECT"] = SubjectRequirement(periodsPerWeek=5)
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "unknown subject" in str(exc_info.value).lower()

    def test_teacher_availability_mismatch_rejected(self):
        """Teacher with wrong availability length should be rejected."""
        data = self._create_minimal_valid_data()
        # Set wrong number of periods in availability
        data["teachers"][0].availability[DayOfWeek.MONDAY] = [True, True]  # Only 2 instead of 6
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "availability" in str(exc_info.value).lower()

    def test_empty_periods_rejected(self):
        """Class with empty periods (under-allocation) should be rejected."""
        data = self._create_minimal_valid_data()
        # Reduce subject requirements to create empty periods
        data["classes"][0].subjectRequirements["MATH"].periodsPerWeek = 10  # Less than 30 available
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "empty period" in str(exc_info.value).lower()

    def test_over_allocation_rejected(self):
        """Class with over-allocation should be rejected."""
        data = self._create_minimal_valid_data()
        # Increase subject requirements beyond available periods
        data["classes"][0].subjectRequirements["MATH"].periodsPerWeek = 50  # More than 30 available
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "over-allocation" in str(exc_info.value).lower()

    def test_single_teacher_mode_unknown_teacher_rejected(self):
        """Single-teacher mode with unknown teacher should be rejected."""
        data = self._create_minimal_valid_data()
        data["classes"][0].singleTeacherMode = True
        data["classes"][0].classTeacherId = "UNKNOWN_TEACHER"
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "unknown teacher" in str(exc_info.value).lower()

    def test_single_teacher_mode_insufficient_subjects_rejected(self):
        """Single-teacher mode where teacher can't teach all subjects should be rejected."""
        data = self._create_minimal_valid_data()
        # Add another subject that the teacher can't teach
        data["subjects"].append(Subject(id="SCIENCE", name="Science"))
        
        # Update class requirements
        days = [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY]
        total_periods = 6 * len(days)
        data["classes"][0].subjectRequirements = {
            "MATH": SubjectRequirement(periodsPerWeek=total_periods // 2),
            "SCIENCE": SubjectRequirement(periodsPerWeek=total_periods - total_periods // 2)
        }
        data["classes"][0].singleTeacherMode = True
        data["classes"][0].classTeacherId = "TEACHER_1"
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "cannot teach" in str(exc_info.value).lower()

    def test_custom_subject_invalid_category_rejected(self):
        """Custom subject with invalid category should be rejected."""
        data = self._create_minimal_valid_data()
        data["subjects"][0].isCustom = True
        data["subjects"][0].customCategory = "InvalidCategory"
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "invalid" in str(exc_info.value).lower() and "category" in str(exc_info.value).lower()

    def test_teacher_unknown_primary_subject_rejected(self):
        """Teacher with unknown primary subject should be rejected."""
        data = self._create_minimal_valid_data()
        data["teachers"][0].primarySubjectIds.append("UNKNOWN_SUBJECT")
        
        with pytest.raises(ValidationError) as exc_info:
            TimetableData(**data)
        assert "unknown" in str(exc_info.value).lower()
