import unittest

from afghanistan.curriculum import (
    EXPECTED_PERIODS,
    MINISTRY_CURRICULUM,
    get_grade_category,
)
from models.input import Teacher


class SubjectContractTests(unittest.TestCase):
    def test_generalist_teacher_without_primary_subjects_is_valid(self):
        teacher = Teacher(
            id="generalist",
            fullName="Generalist Teacher",
            availability={"Saturday": [True, True]},
            maxPeriodsPerWeek=2,
        )

        self.assertEqual(teacher.primarySubjectIds, [])

    def test_ministry_period_totals_match_declared_category_totals(self):
        for grade, subjects in MINISTRY_CURRICULUM.items():
            category = get_grade_category(grade)
            actual = sum(subject["periodsPerWeek"] for subject in subjects)
            self.assertEqual(
                actual,
                EXPECTED_PERIODS[category],
                f"grade {grade} curriculum total drifted",
            )


if __name__ == "__main__":
    unittest.main()
