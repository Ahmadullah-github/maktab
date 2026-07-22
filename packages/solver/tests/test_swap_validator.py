from core.swap_validator import SwapValidator
from models.swap import SlotIdentifier, SwapRequest


def make_constraint_data(assignments, teachers, fixed_lessons=None, allow_consecutive=True):
    return {
        "teachers": teachers,
        "subjects": [{"id": "s1", "name": "Math"}],
        "rooms": [
            {"id": "r1", "name": "One", "capacity": 30, "features": []},
            {"id": "r2", "name": "Two", "capacity": 30, "features": []},
        ],
        "classes": [
            {"id": "c1", "studentCount": 20},
            {"id": "c2", "studentCount": 20},
        ],
        "assignments": assignments,
        "fixedLessons": fixed_lessons or [],
        "timetableData": {},
        "config": {
            "daysOfWeek": ["Saturday"],
            "periodsPerDay": {"Saturday": 7},
            "allowConsecutivePeriodsForSameSubject": allow_consecutive,
        },
    }


def swap_to_period_one():
    return SwapRequest(
        timetableId=1,
        sourceSlot=SlotIdentifier(classId="c1", day="Saturday", period=0),
        targetSlot=SlotIdentifier(classId="c1", day="Saturday", period=1),
    )


def test_secondary_teacher_unavailability_blocks_swap():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1", "t2"],
            "roomId": "r1",
            "day": "Saturday",
            "periodIndex": 0,
        }
    ]
    teachers = [
        {"id": "t1", "fullName": "Primary"},
        {
            "id": "t2",
            "fullName": "Secondary",
            "unavailable": [{"day": "Saturday", "period": 1}],
        },
    ]

    result = SwapValidator(make_constraint_data(assignments, teachers)).validate_swap(
        swap_to_period_one()
    )

    assert not result.is_valid
    assert any(
        error.type == "TEACHER_UNAVAILABLE"
        and error.details.get("teacherId") == "t2"
        for error in result.errors
    )


def test_secondary_teacher_conflict_blocks_swap():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1", "t2"],
            "roomId": "r1",
            "day": "Saturday",
            "periodIndex": 0,
        },
        {
            "classId": "c2",
            "subjectId": "s1",
            "teacherId": "t2",
            "roomId": "r2",
            "day": "Saturday",
            "periodIndex": 1,
        },
    ]
    teachers = [
        {"id": "t1", "fullName": "Primary"},
        {"id": "t2", "fullName": "Secondary"},
    ]

    result = SwapValidator(make_constraint_data(assignments, teachers)).validate_swap(
        swap_to_period_one()
    )

    assert not result.is_valid
    assert any(
        error.type == "TEACHER_CONFLICT"
        and error.details.get("resourceId") == "t2"
        for error in result.errors
    )


def test_fixed_lesson_cannot_be_moved():
    fixed_lesson = {
        "classId": "c1",
        "subjectId": "s1",
        "teacherIds": ["t1"],
        "roomId": "r1",
        "day": "Saturday",
        "periodIndex": 0,
        "isFixed": True,
    }
    result = SwapValidator(
        make_constraint_data([fixed_lesson], [{"id": "t1"}], [fixed_lesson])
    ).validate_swap(swap_to_period_one())

    assert not result.is_valid
    assert any(error.type == "FIXED_LESSON_MOVED" for error in result.errors)


def test_identical_fixed_lessons_are_matched_by_position_before_order():
    fixed_at_zero = {
        "classId": "c1",
        "subjectId": "s1",
        "teacherIds": ["t1"],
        "roomId": "r1",
        "day": "Saturday",
        "periodIndex": 0,
        "isFixed": True,
    }
    fixed_at_one = {**fixed_at_zero, "periodIndex": 1}

    result = SwapValidator(
        make_constraint_data(
            [fixed_at_one, fixed_at_zero],
            [{"id": "t1"}],
            [fixed_at_zero, fixed_at_one],
        )
    ).validate_schedule()

    assert result.is_valid
    assert not any(error.type == "FIXED_LESSON_MOVED" for error in result.errors)


def test_swap_cannot_split_same_day_subject_periods():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": "r1",
            "day": "Saturday",
            "periodIndex": 0,
        },
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": "r1",
            "day": "Saturday",
            "periodIndex": 1,
        },
    ]
    request = SwapRequest(
        timetableId=1,
        sourceSlot=SlotIdentifier(classId="c1", day="Saturday", period=0),
        targetSlot=SlotIdentifier(classId="c1", day="Saturday", period=3),
    )

    result = SwapValidator(
        make_constraint_data(assignments, [{"id": "t1"}])
    ).validate_swap(request)

    assert not result.is_valid
    assert any(
        error.type == "NON_CONSECUTIVE_SUBJECT_PERIODS" for error in result.errors
    )


def test_roomless_lesson_is_valid_when_no_room_is_required():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": None,
            "day": "Saturday",
            "periodIndex": 0,
        }
    ]
    result = SwapValidator(
        make_constraint_data(assignments, [{"id": "t1"}])
    ).validate_swap(swap_to_period_one())

    assert result.is_valid
    assert not any(error.type.startswith("MISSING") for error in result.errors)


def test_inactive_assigned_room_blocks_schedule_validation():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": "deleted-room",
            "day": "Saturday",
            "periodIndex": 0,
        }
    ]
    result = SwapValidator(
        make_constraint_data(assignments, [{"id": "t1"}])
    ).validate_schedule()

    assert not result.is_valid
    assert any(error.type == "MISSING_ROOM" for error in result.errors)


def test_complete_schedule_validation_detects_resource_conflict():
    assignments = [
        {
            "classId": "c1",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": "r1",
            "day": "Saturday",
            "periodIndex": 0,
        },
        {
            "classId": "c2",
            "subjectId": "s1",
            "teacherIds": ["t1"],
            "roomId": "r2",
            "day": "Saturday",
            "periodIndex": 0,
        },
    ]
    result = SwapValidator(
        make_constraint_data(assignments, [{"id": "t1"}])
    ).validate_schedule()

    assert not result.is_valid
    assert any(error.type == "TEACHER_CONFLICT" for error in result.errors)
