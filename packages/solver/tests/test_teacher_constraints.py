import unittest
from collections import Counter, defaultdict

from core.solver import TimetableSolver
from models.input import TimetableData
from feedback.pre_solve_analyzer import PreSolveAnalyzer


def payload(periods=3, days=None, teachers=None, fixed_assignments=None, preference=None):
    days = days or ["Saturday"]
    periods_per_day_map = {
        day: periods // len(days) + (1 if index < periods % len(days) else 0)
        for index, day in enumerate(days)
    }
    periods_per_day = max(periods_per_day_map.values())
    teachers = teachers or [
        {
            "id": "teacher-a",
            "fullName": "Teacher A",
            "primarySubjectIds": ["subject"],
            "availability": {day: [True] * periods_per_day for day in days},
            "maxPeriodsPerWeek": periods,
        }
    ]
    teachers = [dict(teacher) for teacher in teachers]
    for teacher in teachers:
        source = teacher.get("availability", {})
        teacher["availability"] = {
            day: list(source.get(day, []))[: periods_per_day_map[day]]
            + [True] * max(0, periods_per_day_map[day] - len(source.get(day, [])))
            for day in days
        }
    preferences = {
        "avoidTeacherGapsWeight": 0,
        "avoidClassGapsWeight": 0,
        "distributeDifficultSubjectsWeight": 0,
        "balanceTeacherLoadWeight": 0,
        "minimizeRoomChangesWeight": 0,
        "preferMorningForDifficultWeight": 0,
        "respectTeacherTimePreferenceWeight": 0,
        "respectTeacherRoomPreferenceWeight": 0,
        "respectPreferredColleaguesWeight": 0,
        "preferClassHomeRoomWeight": 0,
        "respectSubjectDesiredFeaturesWeight": 0,
        "subjectSpreadWeight": 0,
    }
    if preference:
        preferences.update(preference)
    return {
        "config": {
            "daysOfWeek": days,
            "periodsPerDay": periods_per_day,
            "periodsPerDayMap": periods_per_day_map,
            "solverTimeLimitSeconds": 5,
            "solverOptimizationLevel": 0,
            "enableGracefulDegradation": False,
        },
        "preferences": preferences,
        "rooms": [{"id": "room", "name": "Room", "capacity": 30, "type": "normal"}],
        "subjects": [{"id": "subject", "name": "Subject"}],
        "teachers": teachers,
        "classes": [
            {
                "id": "class",
                "name": "Class",
                "studentCount": 20,
                "subjectRequirements": {
                    "subject": {
                        "periodsPerWeek": periods,
                        "minConsecutive": periods,
                        "maxConsecutive": periods,
                    }
                },
            }
        ],
        "fixedTeacherAssignments": fixed_assignments,
    }


def solve(data):
    return TimetableSolver(TimetableData(**data)).solve(
        time_limit_seconds=5,
        enable_graceful_degradation=False,
        optimization_level=0,
        user_strategy="fast",
    )


class TeacherConstraintTests(unittest.TestCase):
    def test_teacher_can_teach_four_consecutive_periods_across_classes(self):
        data = payload(periods=4)
        data["teachers"] = [
            {
                "id": "teacher-a",
                "fullName": "Teacher A",
                "primarySubjectIds": ["subject"],
                "availability": {"Saturday": [True] * 4},
                "maxPeriodsPerWeek": 4,
                # Legacy fields must not recreate the retired teacher-wide limits.
                "maxPeriodsPerDay": 1,
                "maxConsecutivePeriods": 1,
            },
            *[
                {
                    "id": f"teacher-filler-{index}",
                    "fullName": f"Filler {index}",
                    "primarySubjectIds": ["filler-a", "filler-b"],
                    "availability": {"Saturday": [True] * 4},
                    "maxPeriodsPerWeek": 3,
                }
                for index in range(4)
            ],
        ]
        data["rooms"] = [
            {"id": f"room-{index}", "name": f"Room {index}", "capacity": 30, "type": "normal"}
            for index in range(4)
        ]
        data["subjects"].extend([
            {"id": "filler-a", "name": "Filler A"},
            {"id": "filler-b", "name": "Filler B"},
        ])
        data["classes"] = [
            {
                "id": f"class-{index}",
                "name": f"Class {index}",
                "studentCount": 20,
                "subjectRequirements": {
                    "subject": {"periodsPerWeek": 1, "maxConsecutive": 2},
                    "filler-a": {"periodsPerWeek": 2, "maxConsecutive": 2},
                    "filler-b": {"periodsPerWeek": 1, "maxConsecutive": 2},
                },
            }
            for index in range(4)
        ]
        data["fixedTeacherAssignments"] = [
            *[
                {
                    "teacherId": "teacher-a",
                    "classId": f"class-{index}",
                    "subjectId": "subject",
                    "periodsPerWeek": 1,
                    "isFixed": True,
                }
                for index in range(4)
            ],
            *[
                {
                    "teacherId": f"teacher-filler-{index}",
                    "classId": f"class-{index}",
                    "subjectId": subject_id,
                    "periodsPerWeek": periods,
                    "isFixed": True,
                }
                for index in range(4)
                for subject_id, periods in (("filler-a", 2), ("filler-b", 1))
            ],
        ]

        result = solve(data)
        self.assertEqual(result["status"], "success")
        self.assertEqual(
            sorted(
                lesson["periodIndex"]
                for lesson in result["data"]["schedule"]
                if lesson["teacherIds"][0] == "teacher-a"
            ),
            [0, 1, 2, 3],
        )

    def test_pre_solve_does_not_reject_feasible_asymmetric_capacity(self):
        teachers = [
            {
                "id": teacher_id,
                "fullName": teacher_id,
                "primarySubjectIds": ["subject"],
                "availability": {
                    "Saturday": [True] * 5,
                    "Sunday": [True] * 5,
                },
                "maxPeriodsPerWeek": capacity,
            }
            for teacher_id, capacity in (("teacher-a", 2), ("teacher-b", 8))
        ]
        data = TimetableData(
            **payload(periods=10, days=["Saturday", "Sunday"], teachers=teachers)
        )
        self.assertEqual(PreSolveAnalyzer(data)._check_teacher_capacity(), [])

    def test_fixed_split_assignment_uses_exact_period_counts(self):
        teachers = [
            {
                "id": teacher_id,
                "fullName": teacher_id,
                "primarySubjectIds": ["subject"],
                "availability": {"Saturday": [True] * 4},
                "maxPeriodsPerWeek": 3,
            }
            for teacher_id in ("teacher-a", "teacher-b")
        ]
        result = solve(
            payload(
                periods=3,
                days=["Saturday", "Sunday"],
                teachers=teachers,
                fixed_assignments=[
                    {
                        "teacherId": "teacher-a",
                        "classId": "class",
                        "subjectId": "subject",
                        "periodsPerWeek": 1,
                        "isFixed": True,
                    },
                    {
                        "teacherId": "teacher-b",
                        "classId": "class",
                        "subjectId": "subject",
                        "periodsPerWeek": 2,
                        "isFixed": True,
                    },
                ],
            )
        )
        self.assertEqual(result["status"], "success")
        counts = Counter(
            lesson["teacherIds"][0] for lesson in result["data"]["schedule"]
        )
        self.assertEqual(counts, {"teacher-a": 1, "teacher-b": 2})
        self.assertTrue(all(lesson["isFixed"] for lesson in result["data"]["schedule"]))

    def test_zero_weekly_capacity_teacher_is_never_selected(self):
        teachers = [
            {
                "id": teacher_id,
                "fullName": teacher_id,
                "primarySubjectIds": ["subject"],
                "availability": {"Saturday": [True] * 4},
                "maxPeriodsPerWeek": capacity,
            }
            for teacher_id, capacity in (("teacher-zero", 0), ("teacher-active", 2))
        ]
        result = solve(payload(periods=2, teachers=teachers))
        self.assertEqual(result["status"], "success")
        self.assertEqual(
            {lesson["teacherIds"][0] for lesson in result["data"]["schedule"]},
            {"teacher-active"},
        )

    def test_subject_shape_constraints_still_apply(self):
        teacher = {
            "id": "teacher-a",
            "fullName": "Teacher A",
            "primarySubjectIds": ["subject"],
            "availability": {
                "Saturday": [True] * 2,
                "Sunday": [True] * 2,
                "Monday": [True] * 2,
            },
            "maxPeriodsPerWeek": 3,
        }
        data = payload(
            periods=6,
            days=["Saturday", "Sunday", "Monday"],
            teachers=[teacher],
        )
        filler = {
            "id": "teacher-filler",
            "fullName": "Filler",
            "primarySubjectIds": ["filler"],
            "availability": {
                "Saturday": [True] * 2,
                "Sunday": [True] * 2,
                "Monday": [True] * 2,
            },
            "maxPeriodsPerWeek": 3,
        }
        data["teachers"].append(filler)
        data["subjects"].append({"id": "filler", "name": "Filler"})
        data["classes"][0]["subjectRequirements"] = {
            "subject": {"periodsPerWeek": 3, "minConsecutive": 1, "maxConsecutive": 1},
            "filler": {"periodsPerWeek": 3, "minConsecutive": 1, "maxConsecutive": 1},
        }
        result = solve(data)
        self.assertEqual(result["status"], "success")
        periods_by_day = defaultdict(list)
        for lesson in result["data"]["schedule"]:
            if lesson["teacherIds"][0] == "teacher-a":
                periods_by_day[lesson["day"]].append(lesson["periodIndex"])
        self.assertTrue(all(len(periods) <= 1 for periods in periods_by_day.values()))
        self.assertTrue(
            all(
                right - left > 1
                for periods in periods_by_day.values()
                for left, right in zip(sorted(periods), sorted(periods)[1:])
            )
        )

    def test_time_preference_is_optimized(self):
        teacher = {
            "id": "teacher-a",
            "fullName": "Teacher A",
            "primarySubjectIds": ["subject"],
            "availability": {"Saturday": [True] * 4},
            "maxPeriodsPerWeek": 1,
            "timePreference": "Morning",
        }
        data = payload(
            periods=4,
            teachers=[teacher],
            preference={"respectTeacherTimePreferenceWeight": 1},
        )
        filler_subjects = ["filler-1", "filler-2", "filler-3"]
        filler = {
            "id": "teacher-filler",
            "fullName": "Filler",
            "primarySubjectIds": filler_subjects,
            "availability": {"Saturday": [True] * 4},
            "maxPeriodsPerWeek": 3,
        }
        data["teachers"].append(filler)
        data["subjects"].extend(
            {"id": subject_id, "name": subject_id}
            for subject_id in filler_subjects
        )
        data["classes"][0]["subjectRequirements"] = {
            "subject": {"periodsPerWeek": 1, "minConsecutive": 1, "maxConsecutive": 1},
            **{
                subject_id: {"periodsPerWeek": 1, "minConsecutive": 1, "maxConsecutive": 1}
                for subject_id in filler_subjects
            },
        }
        result = solve(data)
        self.assertEqual(result["status"], "success")
        target = next(
            lesson for lesson in result["data"]["schedule"]
            if lesson["subjectId"] == "subject"
        )
        self.assertLess(target["periodIndex"], 2)


if __name__ == "__main__":
    unittest.main()
