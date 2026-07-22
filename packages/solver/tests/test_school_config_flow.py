import json
import unittest
from pathlib import Path

from core.solution_builder import (
    build_effective_break_periods_by_day,
    normalize_break_periods,
)
from core.solver import TimetableSolver
from models.input import GlobalConfig, TimetableData


PERIOD_CONTRACT = json.loads(
    (
        Path(__file__).resolve().parents[3]
        / "test"
        / "fixtures"
        / "period-configuration.contract.json"
    ).read_text(encoding="utf-8")
)


def build_category_timetable(alpha_availability=None, fixed_lessons=None):
    alpha_availability = alpha_availability or [True, True, False, False]
    return {
        "config": {
            "daysOfWeek": ["Saturday"],
            "periodsPerDay": 4,
            "periodsPerDayMap": {"Saturday": 4},
            "categoryPeriodsPerDayMap": {
                "Alpha-Primary": {"Saturday": 2},
                "High": {"Saturday": 4},
            },
            "solverTimeLimitSeconds": 5,
            "solverOptimizationLevel": 0,
            "enableGracefulDegradation": False,
        },
        "rooms": [
            {"id": "room-1", "name": "Room 1", "capacity": 40, "type": "classroom"},
            {"id": "room-2", "name": "Room 2", "capacity": 40, "type": "classroom"},
        ],
        "subjects": [
            {"id": "alpha-subject", "name": "Alpha Subject"},
            {"id": "high-subject", "name": "High Subject"},
            {"id": "high-subject-2", "name": "High Subject 2"},
        ],
        "teachers": [
            {
                "id": "alpha-teacher",
                "fullName": "Alpha Teacher",
                "primarySubjectIds": ["alpha-subject"],
                "availability": {"Saturday": alpha_availability},
                "maxPeriodsPerWeek": 4,
            },
            {
                "id": "high-teacher",
                "fullName": "High Teacher",
                "primarySubjectIds": ["high-subject", "high-subject-2"],
                "availability": {"Saturday": [True, True, True, True]},
                "maxPeriodsPerWeek": 4,
            },
        ],
        "classes": [
            {
                "id": "alpha-class",
                "name": "Alpha Class",
                "studentCount": 20,
                "gradeLevel": 1,
                "category": "Alpha-Primary",
                "subjectRequirements": {
                    "alpha-subject": {
                        "periodsPerWeek": 2,
                        "minConsecutive": 2,
                        "maxConsecutive": 2,
                    }
                },
            },
            {
                "id": "high-class",
                "name": "High Class",
                "studentCount": 20,
                "gradeLevel": 10,
                "category": "High",
                "subjectRequirements": {
                    "high-subject": {
                        "periodsPerWeek": 2,
                        "minConsecutive": 2,
                        "maxConsecutive": 2,
                    },
                    "high-subject-2": {
                        "periodsPerWeek": 2,
                        "minConsecutive": 2,
                        "maxConsecutive": 2,
                    }
                },
            },
        ],
        "fixedLessons": fixed_lessons,
    }


class SchoolConfigFlowTests(unittest.TestCase):
    def test_shared_period_contract_matches_solver_normalization(self):
        contract_config = PERIOD_CONTRACT["config"]
        config = GlobalConfig(
            daysOfWeek=contract_config["daysOfWeek"],
            periodsPerDay=contract_config["defaultPeriodsPerDay"],
            periodsPerDayMap=contract_config["periodsPerDayMap"],
            categoryPeriodsPerDayMap=contract_config["categoryPeriodsMap"],
        )

        self.assertEqual(
            {day.value: periods for day, periods in config.periodsPerDayMap.items()},
            PERIOD_CONTRACT["expected"]["solverGrid"],
        )
        self.assertEqual(
            normalize_break_periods(PERIOD_CONTRACT["duplicateBreaks"]),
            PERIOD_CONTRACT["expected"]["deduplicatedBreaks"],
        )

    def test_runtime_flag_is_part_of_the_solver_contract(self):
        config = GlobalConfig(
            daysOfWeek=["Saturday", "Sunday"],
            periodsPerDay=5,
            periodsPerDayMap={"Saturday": 5, "Sunday": 4},
            lowResourceMode=True,
        )

        self.assertTrue(config.lowResourceMode)
        self.assertNotIn("ramadanModeEnabled", GlobalConfig.model_fields)
        self.assertNotIn("ramadanPeriodDuration", GlobalConfig.model_fields)
        self.assertNotIn("ramadanBreakConfig", GlobalConfig.model_fields)
        self.assertNotIn("prayerBreaks", GlobalConfig.model_fields)

    def test_empty_day_break_override_does_not_inherit_shared_breaks(self):
        effective = build_effective_break_periods_by_day(
            days=["Saturday", "Sunday"],
            periods_map={"Saturday": 5, "Sunday": 5},
            shared_breaks=[{"afterPeriod": 2, "duration": 15}],
            break_periods_by_day={"Sunday": []},
        )

        self.assertEqual(
            effective["Saturday"],
            [{"afterPeriod": 2, "duration": 15}],
        )
        self.assertEqual(effective["Sunday"], [])

    def test_category_period_limits_build_class_specific_blocked_slots(self):
        solver = TimetableSolver(TimetableData(**build_category_timetable()))
        alpha_index = solver.class_map["alpha-class"]
        high_index = solver.class_map["high-class"]

        self.assertEqual(solver.class_blocked_slots[alpha_index], [0, 0, 1, 1])
        self.assertEqual(solver.class_blocked_slots[high_index], [0, 0, 0, 0])

    def test_solver_never_places_short_category_outside_its_boundary(self):
        solver = TimetableSolver(TimetableData(**build_category_timetable()))
        result = solver.solve(
            time_limit_seconds=5,
            enable_graceful_degradation=False,
            optimization_level=0,
            user_strategy="fast",
        )

        self.assertEqual(result["status"], "success")
        alpha_lessons = [
            lesson for lesson in result["data"]["schedule"]
            if lesson["classId"] == "alpha-class"
        ]
        self.assertEqual(len(alpha_lessons), 2)
        self.assertTrue(all(lesson["periodIndex"] < 2 for lesson in alpha_lessons))
        self.assertTrue(all(lesson["periodsThisDay"] == 2 for lesson in alpha_lessons))

    def test_teacher_available_only_outside_short_category_is_infeasible(self):
        data = TimetableData(
            **build_category_timetable(alpha_availability=[False, False, True, True])
        )
        solver = TimetableSolver(data)
        result = solver.solve(
            time_limit_seconds=5,
            enable_graceful_degradation=False,
            optimization_level=0,
            user_strategy="fast",
        )

        self.assertEqual(result["status"], "failed")

    def test_category_mode_requires_every_class_to_have_a_configured_category(self):
        payload = build_category_timetable()
        payload["classes"][0]["gradeLevel"] = None
        payload["classes"][0]["category"] = None

        with self.assertRaisesRegex(ValueError, "must have a category"):
            TimetableData(**payload)

    def test_fixed_lesson_outside_category_boundary_is_rejected(self):
        payload = build_category_timetable(
            fixed_lessons=[
                {
                    "day": "Saturday",
                    "periodIndex": 2,
                    "classId": "alpha-class",
                    "subjectId": "alpha-subject",
                    "teacherIds": ["alpha-teacher"],
                    "roomId": "room-1",
                }
            ]
        )

        with self.assertRaisesRegex(ValueError, "outside the 2-period boundary"):
            TimetableData(**payload)


if __name__ == "__main__":
    unittest.main()
