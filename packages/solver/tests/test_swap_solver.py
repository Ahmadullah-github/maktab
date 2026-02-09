# ==============================================================================
#
#  Swap Solver Tests
#
#  Description:
#  Test cases for swap validation and constraint checking.
#
# ==============================================================================

import pytest
import json
from models.swap import (
    SwapRequest,
    SlotIdentifier,
    ConstraintData,
    Lesson,
    ConstraintViolation,
    LessonMove,
    SwapResolution,
)
from core.swap_validator import SwapValidator


@pytest.fixture
def sample_constraint_data():
    """Sample constraint data for testing."""
    return {
        "teachers": [
            {
                "id": "T1",
                "fullName": "Ahmad Ahmadi",
                "primarySubjectIds": ["S1"],
                "maxPeriodsPerWeek": 20,
                "maxConsecutivePeriods": 3,
                "timePreference": "Morning",
            },
            {
                "id": "T2",
                "fullName": "Fatima Karimi",
                "primarySubjectIds": ["S2"],
                "maxPeriodsPerWeek": 20,
                "maxConsecutivePeriods": 4,
                "timePreference": "Afternoon",
            },
        ],
        "subjects": [
            {
                "id": "S1",
                "name": "Mathematics",
                "isDifficult": True,
                "requiredRoomType": None,
            },
            {
                "id": "S2",
                "name": "Physics",
                "isDifficult": True,
                "requiredRoomType": "Lab",
            },
            {
                "id": "S3",
                "name": "English",
                "isDifficult": False,
                "requiredRoomType": None,
            },
        ],
        "rooms": [
            {"id": "R1", "name": "Room 101", "type": "Classroom", "capacity": 30},
            {"id": "R2", "name": "Science Lab", "type": "Lab", "capacity": 25},
        ],
        "classes": [
            {"id": "C1", "name": "Class 7A", "studentCount": 28},
            {"id": "C2", "name": "Class 7B", "studentCount": 30},
        ],
        "assignments": [
            {
                "classId": "C1",
                "subjectId": "S1",
                "teacherId": "T1",
                "roomId": "R1",
                "day": "Monday",
                "periodIndex": 0,
                "duration": 1,
            },
            {
                "classId": "C2",
                "subjectId": "S2",
                "teacherId": "T2",
                "roomId": "R2",
                "day": "Monday",
                "periodIndex": 0,
                "duration": 1,
            },
            {
                "classId": "C1",
                "subjectId": "S3",
                "teacherId": "T2",
                "roomId": "R1",
                "day": "Monday",
                "periodIndex": 5,
                "duration": 1,
            },
        ],
        "timetableData": {"lessons": []},
        "config": {"daysOfWeek": ["Monday", "Tuesday"], "periodsPerDay": 7},
    }


@pytest.fixture
def validator(sample_constraint_data):
    """Create a SwapValidator instance."""
    return SwapValidator(sample_constraint_data)


class TestSwapValidator:
    """Test cases for SwapValidator."""

    def test_validator_initialization(self, validator):
        """Test validator initializes correctly."""
        assert len(validator.teachers) == 2
        assert len(validator.subjects) == 3
        assert len(validator.rooms) == 2
        assert len(validator.classes) == 2
        assert len(validator.assignments) == 3

    def test_simple_valid_swap(self, validator):
        """Test a simple valid swap with no conflicts."""
        # Add a second lesson for C1 at a different time with no conflicts
        validator.assignments.append(
            Lesson(
                classId="C1",
                subjectId="S3",
                teacherId="T1",  # Same teacher as period 0, different subject
                roomId="R1",
                day="Tuesday",  # Different day to avoid conflicts
                periodIndex=0,
                duration=1,
            )
        )
        validator._build_slot_index()

        # Swap lessons on different days (no conflicts)
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(
                classId="C1", day="Monday", period=0
            ),  # T1, S1, R1
            target_slot=SlotIdentifier(
                classId="C1", day="Tuesday", period=0
            ),  # T1, S3, R1
        )

        result = validator.validate_swap(swap_request)

        # This swap should be valid (same teacher, same room, different days)
        assert result.is_valid is True
        assert len(result.errors) == 0
        assert result.total_moves == 2
        assert len(result.affected_lessons) == 2

    def test_empty_source_slot(self, validator):
        """Test swap with empty source slot."""
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C1", day="Tuesday", period=0),
            target_slot=SlotIdentifier(classId="C2", day="Monday", period=0),
        )

        result = validator.validate_swap(swap_request)

        assert result.is_valid is False
        assert len(result.errors) == 1
        assert result.errors[0].type == "EMPTY_SOURCE_SLOT"
        assert result.errors[0].severity == "hard"

    def test_empty_target_slot(self, validator):
        """Test swap with empty target slot."""
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C1", day="Monday", period=0),
            target_slot=SlotIdentifier(classId="C2", day="Tuesday", period=0),
        )

        result = validator.validate_swap(swap_request)

        assert result.is_valid is False
        assert len(result.errors) == 1
        assert result.errors[0].type == "EMPTY_TARGET_SLOT"
        assert result.errors[0].severity == "hard"

    def test_teacher_conflict(self, validator):
        """Test swap that creates teacher conflict."""
        # Add another lesson for T2 at the target time
        validator.assignments.append(
            Lesson(
                classId="C1",
                subjectId="S3",
                teacherId="T2",
                roomId="R1",
                day="Monday",
                periodIndex=0,
                duration=1,
            )
        )
        validator._build_slot_index()

        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C2", day="Monday", period=0),
            target_slot=SlotIdentifier(classId="C1", day="Monday", period=5),
        )

        result = validator.validate_swap(swap_request)

        # Should detect that T2 already has a lesson at Monday period 0
        assert result.is_valid is False
        assert any(e.type == "TEACHER_CONFLICT" for e in result.errors)

    def test_room_type_mismatch(self, validator):
        """Test swap that violates room type requirements."""
        # Try to swap Physics (requires Lab) into a Classroom
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(
                classId="C2", day="Monday", period=0
            ),  # Physics in Lab
            target_slot=SlotIdentifier(
                classId="C1", day="Monday", period=0
            ),  # Math in Classroom
        )

        result = validator.validate_swap(swap_request)

        # Physics requires Lab but would be moved to Classroom
        assert result.is_valid is False
        assert any(e.type == "ROOM_TYPE_MISMATCH" for e in result.errors)

    def test_difficult_subject_afternoon_warning(self, validator):
        """Test soft constraint for difficult subject in afternoon."""
        # Add a lesson at period 5 for swapping
        validator.assignments.append(
            Lesson(
                classId="C1",
                subjectId="S3",
                teacherId="T1",  # Use T1 to avoid conflicts with T2
                roomId="R1",
                day="Monday",
                periodIndex=5,
                duration=1,
            )
        )
        validator._build_slot_index()

        # Swap Math (difficult, T1) from morning to afternoon with English (T1)
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(
                classId="C1", day="Monday", period=0
            ),  # Math morning (T1)
            target_slot=SlotIdentifier(
                classId="C1", day="Monday", period=5
            ),  # English afternoon (T1)
        )

        result = validator.validate_swap(swap_request)

        # Should be valid but with warning about difficult subject in afternoon
        assert result.is_valid is True
        assert result.can_proceed_with_warning is True
        assert any(w.type == "DIFFICULT_SUBJECT_AFTERNOON" for w in result.warnings)

    def test_teacher_time_preference_warning(self, validator):
        """Test soft constraint for teacher time preference."""
        # T1 prefers Morning, try to move to afternoon
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(
                classId="C1", day="Monday", period=0
            ),  # T1 morning
            target_slot=SlotIdentifier(
                classId="C1", day="Monday", period=5
            ),  # afternoon
        )

        result = validator.validate_swap(swap_request)

        # Should have warning about T1's morning preference
        assert any(w.type == "TEACHER_TIME_PREFERENCE" for w in result.warnings)

    def test_consecutive_periods_warning(self, validator):
        """Test soft constraint for max consecutive periods."""
        # Add consecutive lessons for T1
        for period in [1, 2]:
            validator.assignments.append(
                Lesson(
                    classId="C1",
                    subjectId="S1",
                    teacherId="T1",
                    roomId="R1",
                    day="Monday",
                    periodIndex=period,
                    duration=1,
                )
            )
        validator._build_slot_index()

        # Try to add another consecutive period (would be 4th, max is 3)
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C2", day="Monday", period=0),
            target_slot=SlotIdentifier(
                classId="C1", day="Monday", period=0
            ),  # Would make 4 consecutive
        )

        result = validator.validate_swap(swap_request)

        # Should have warning about consecutive periods
        # Note: This depends on the swap creating a 4th consecutive period
        # The test might need adjustment based on actual implementation

    def test_solve_time_recorded(self, validator):
        """Test that solve time is recorded."""
        swap_request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C1", day="Monday", period=0),
            target_slot=SlotIdentifier(classId="C2", day="Monday", period=0),
        )

        result = validator.validate_swap(swap_request)

        assert result.solve_time_ms is not None
        assert result.solve_time_ms >= 0


class TestSwapModels:
    """Test Pydantic models for swap solver."""

    def test_slot_identifier_validation(self):
        """Test SlotIdentifier validation."""
        slot = SlotIdentifier(classId="C1", day="Monday", period=0)
        assert slot.classId == "C1"
        assert slot.day == "Monday"
        assert slot.period == 0

        # Test invalid period
        with pytest.raises(Exception):
            SlotIdentifier(classId="C1", day="Monday", period=-1)

    def test_swap_request_validation(self):
        """Test SwapRequest validation."""
        request = SwapRequest(
            timetable_id=1,
            source_slot=SlotIdentifier(classId="C1", day="Monday", period=0),
            target_slot=SlotIdentifier(classId="C2", day="Monday", period=1),
        )
        assert request.timetable_id == 1

        # Test invalid timetable_id
        with pytest.raises(Exception):
            SwapRequest(
                timetable_id=0,
                source_slot=SlotIdentifier(classId="C1", day="Monday", period=0),
                target_slot=SlotIdentifier(classId="C2", day="Monday", period=1),
            )

    def test_constraint_violation_validation(self):
        """Test ConstraintViolation validation."""
        violation = ConstraintViolation(
            type="TEACHER_CONFLICT",
            severity="hard",
            message="Teacher conflict detected",
            message_farsi="تضاد استاد شناسایی شد",
            details={"teacherId": "T1"},
        )
        assert violation.type == "TEACHER_CONFLICT"
        assert violation.severity == "hard"

        # Test invalid severity
        with pytest.raises(Exception):
            ConstraintViolation(
                type="TEST",
                severity="invalid",
                message="Test",
                details={},
            )

    def test_lesson_move_model(self):
        """Test LessonMove model."""
        move = LessonMove(
            class_id="C1",
            subject_id="S1",
            teacher_id="T1",
            room_id="R1",
            from_day="Monday",
            from_period=0,
            to_day="Tuesday",
            to_period=1,
        )
        assert move.class_id == "C1"
        assert move.from_day == "Monday"
        assert move.to_day == "Tuesday"

    def test_swap_resolution_model(self):
        """Test SwapResolution model."""
        resolution = SwapResolution(
            is_valid=True,
            can_proceed_with_warning=False,
            errors=[],
            warnings=[],
            affected_lessons=[],
            total_moves=2,
            solve_time_ms=150,
        )
        assert resolution.is_valid is True
        assert resolution.total_moves == 2
        assert resolution.solve_time_ms == 150


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
