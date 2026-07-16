import unittest

from core.solver import TimetableSolver
from core.swap_validator import SwapValidator
from models.input import TimetableData
from models.swap import SwapRequest


def build_solver_payload(
    *,
    teacher_availability=None,
    room_unavailable=None,
    home_room_id=None,
    desired_features=None,
    preferred_room_ids=None,
    periods_per_week=1,
    consecutive=1,
):
    period_count = periods_per_week
    return {
        "config": {
            "daysOfWeek": ["Saturday"],
            "periodsPerDay": period_count,
            "periodsPerDayMap": {"Saturday": period_count},
            "solverTimeLimitSeconds": 5,
            "solverOptimizationLevel": 2,
            "enableGracefulDegradation": False,
        },
        "preferences": {
            "preferClassHomeRoomWeight": 5.0,
            "respectSubjectDesiredFeaturesWeight": 0.3,
            "respectTeacherRoomPreferenceWeight": 0.2,
            "minimizeRoomChangesWeight": 0.3,
        },
        "rooms": [
            {
                "id": "room-1",
                "name": "Room 1",
                "capacity": 40,
                "type": "normal",
                "features": [],
                "unavailable": room_unavailable or [],
            },
            {
                "id": "room-2",
                "name": "Room 2",
                "capacity": 40,
                "type": "normal",
                "features": ["projector"],
            },
        ],
        "subjects": [
            {
                "id": "subject-1",
                "name": "Subject 1",
                "desiredFeatures": desired_features or [],
            }
        ],
        "teachers": [
            {
                "id": "teacher-1",
                "fullName": "Teacher 1",
                "primarySubjectIds": ["subject-1"],
                "availability": {
                    "Saturday": teacher_availability or [True] * period_count
                },
                "preferredRoomIds": preferred_room_ids or [],
                "maxPeriodsPerWeek": 2,
            }
        ],
        "classes": [
            {
                "id": "class-1",
                "name": "Class 1",
                "studentCount": 20,
                "homeRoomId": home_room_id,
                "subjectRequirements": {
                    "subject-1": {
                        "periodsPerWeek": periods_per_week,
                        "minConsecutive": consecutive,
                        "maxConsecutive": consecutive,
                    }
                },
            }
        ],
    }


def solve(payload):
    return TimetableSolver(TimetableData(**payload)).solve(
        time_limit_seconds=5,
        enable_graceful_degradation=False,
        optimization_level=2,
        user_strategy="thorough",
    )


class RoomSolverConstraintTests(unittest.TestCase):
    def test_unknown_home_room_is_rejected_at_input_boundary(self):
        payload = build_solver_payload(home_room_id="missing-room")

        with self.assertRaisesRegex(ValueError, "unknown homeRoomId"):
            TimetableData(**payload)

    def test_selected_room_must_be_available_for_full_duration(self):
        payload = build_solver_payload(
            room_unavailable=[{"day": "Saturday", "periods": [1]}],
            periods_per_week=2,
            consecutive=2,
        )
        payload["rooms"][1]["unavailable"] = [
            {"day": "Saturday", "periods": [0]}
        ]

        result = solve(payload)

        self.assertEqual(result["status"], "failed")

    def test_selected_teacher_must_be_available_for_full_duration(self):
        payload = build_solver_payload(
            teacher_availability=[True, False],
            periods_per_week=2,
            consecutive=2,
        )

        result = solve(payload)

        self.assertEqual(result["status"], "failed")

    def test_short_remainder_gets_its_own_start_domain(self):
        payload = build_solver_payload(periods_per_week=3, consecutive=2)
        payload["teachers"][0]["availability"]["Saturday"] = [True, True, False]
        payload["teachers"].append(
            {
                "id": "teacher-2",
                "fullName": "Teacher 2",
                "primarySubjectIds": ["subject-1"],
                "availability": {"Saturday": [False, False, True]},
                "maxPeriodsPerWeek": 2,
            }
        )
        payload["rooms"][0]["unavailable"] = [
            {"day": "Saturday", "periods": [2]}
        ]
        payload["rooms"][1]["unavailable"] = [
            {"day": "Saturday", "periods": [0, 1]}
        ]

        result = solve(payload)

        self.assertEqual(result["status"], "success")
        self.assertEqual(len(result["data"]["schedule"]), 3)

    def test_compatible_home_room_is_preferred_without_becoming_hard(self):
        result = solve(build_solver_payload(home_room_id="room-2"))

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["schedule"][0]["roomId"], "room-2")

    def test_desired_features_and_teacher_preference_use_selected_room(self):
        result = solve(
            build_solver_payload(
                desired_features=["projector"],
                preferred_room_ids=["room-2"],
            )
        )

        self.assertEqual(result["status"], "success")
        self.assertEqual(result["data"]["schedule"][0]["roomId"], "room-2")


class SwapRoomContractTests(unittest.TestCase):
    def build_validator(self, teacher_availability=None):
        return SwapValidator(
            {
                "teachers": [
                    {
                        "id": "teacher-lab",
                        "fullName": "Lab Teacher",
                        "availability": teacher_availability
                        or {"Saturday": [True, True], "Sunday": [True, True]},
                    },
                    {
                        "id": "teacher-normal",
                        "fullName": "Normal Teacher",
                        "availability": {
                            "Saturday": [True, True],
                            "Sunday": [True, True],
                        },
                    },
                ],
                "subjects": [
                    {
                        "id": "lab-subject",
                        "name": "Lab",
                        "requiredRoomType": "laboratory",
                        "requiredFeatures": ["sink"],
                        "minRoomCapacity": 20,
                    },
                    {
                        "id": "normal-subject",
                        "name": "Normal",
                        "requiredRoomType": None,
                        "requiredFeatures": [],
                        "minRoomCapacity": 20,
                    },
                ],
                "rooms": [
                    {
                        "id": "lab-room",
                        "name": "Lab Room",
                        "type": "laboratory",
                        "capacity": 30,
                        "features": ["sink"],
                        "unavailable": [],
                    },
                    {
                        "id": "normal-room",
                        "name": "Normal Room",
                        "type": "normal",
                        "capacity": 30,
                        "features": [],
                        "unavailable": [],
                    },
                ],
                "classes": [
                    {"id": "class-lab", "studentCount": 20},
                    {"id": "class-normal", "studentCount": 20},
                ],
                "assignments": [
                    {
                        "classId": "class-lab",
                        "subjectId": "lab-subject",
                        "teacherId": "teacher-lab",
                        "roomId": "lab-room",
                        "day": "Saturday",
                        "periodIndex": 0,
                        "duration": 1,
                    },
                    {
                        "classId": "class-normal",
                        "subjectId": "normal-subject",
                        "teacherId": "teacher-normal",
                        "roomId": "normal-room",
                        "day": "Sunday",
                        "periodIndex": 0,
                        "duration": 1,
                    },
                ],
                "timetableData": {},
                "config": {
                    "daysOfWeek": ["Saturday", "Sunday"],
                    "periodsPerDay": {"Saturday": 2, "Sunday": 2},
                },
            }
        )

    @staticmethod
    def request():
        return SwapRequest(
            timetableId=1,
            sourceSlot={"classId": "class-lab", "day": "Saturday", "period": 0},
            targetSlot={"classId": "class-normal", "day": "Sunday", "period": 0},
        )

    def test_room_and_teacher_follow_the_lesson_during_swap(self):
        result = self.build_validator().validate_swap(self.request())

        self.assertTrue(result.is_valid)
        self.assertEqual(result.affected_lessons[0].room_id, "lab-room")
        self.assertEqual(result.affected_lessons[0].teacher_id, "teacher-lab")

    def test_swap_checks_every_period_of_resource_availability(self):
        validator = self.build_validator(
            {
                "Saturday": [True, True],
                "Sunday": [True, False],
            }
        )
        validator.assignments[0].duration = 2

        result = validator.validate_swap(self.request())

        self.assertFalse(result.is_valid)
        self.assertIn("TEACHER_UNAVAILABLE", {error.type for error in result.errors})


if __name__ == "__main__":
    unittest.main()
