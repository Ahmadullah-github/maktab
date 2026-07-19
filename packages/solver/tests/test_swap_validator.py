from core.swap_validator import SwapValidator
from models.swap import SlotIdentifier, SwapRequest


def make_constraint_data(assignments, teachers):
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
        "timetableData": {},
        "config": {"periodsPerDay": {"Saturday": 7}},
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
