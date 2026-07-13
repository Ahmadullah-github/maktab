import unittest

from afghanistan.ministry_validator import MinistryValidator, ValidationMode
from core.solution_builder import build_effective_break_periods_by_day
from models.input import GlobalConfig


class SchoolConfigFlowTests(unittest.TestCase):
    def test_runtime_flags_are_part_of_the_solver_contract(self):
        config = GlobalConfig(
            daysOfWeek=["Saturday", "Sunday"],
            periodsPerDay=5,
            periodsPerDayMap={"Saturday": 5, "Sunday": 4},
            ramadanModeEnabled=True,
            ramadanPeriodDuration=30,
            enableMinistryValidation=True,
            ministryValidationMode="strict",
            customCurriculumMode=True,
            lowResourceMode=True,
        )

        self.assertTrue(config.ramadanModeEnabled)
        self.assertEqual(config.ramadanPeriodDuration, 30)
        self.assertTrue(config.enableMinistryValidation)
        self.assertEqual(config.ministryValidationMode, "strict")
        self.assertTrue(config.customCurriculumMode)
        self.assertTrue(config.lowResourceMode)
        self.assertNotIn("prayerBreaks", GlobalConfig.model_fields)

    def test_custom_curriculum_explicitly_skips_ministry_validation(self):
        validator = MinistryValidator(
            enabled=True,
            mode=ValidationMode.STRICT,
            custom_curriculum=True,
        )

        result = validator.validate(
            {
                "classes": [
                    {
                        "id": "class-1",
                        "name": "Grade 5",
                        "gradeLevel": 5,
                        "subjectRequirements": {},
                    }
                ],
                "subjects": [],
            }
        )

        self.assertTrue(result.is_compliant)
        self.assertEqual(result.warnings, [])
        self.assertEqual(result.errors, [])

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


if __name__ == "__main__":
    unittest.main()
