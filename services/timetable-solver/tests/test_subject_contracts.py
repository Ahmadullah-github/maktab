import unittest

from models.input import Subject, Teacher


class SubjectContractTests(unittest.TestCase):
    def test_generalist_teacher_without_primary_subjects_is_valid(self):
        teacher = Teacher(
            id="generalist",
            fullName="Generalist Teacher",
            availability={"Saturday": [True, True]},
            maxPeriodsPerWeek=2,
        )

        self.assertEqual(teacher.primarySubjectIds, [])

    def test_school_defined_subject_has_no_ministry_contract(self):
        subject = Subject(
            id="turkish-7",
            name="ترکی",
            code="TR7",
            isCustom=True,
            customCategory="Middle",
        )

        self.assertEqual(subject.name, "ترکی")
        self.assertEqual(subject.code, "TR7")


if __name__ == "__main__":
    unittest.main()
