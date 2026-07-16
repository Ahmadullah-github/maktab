import unittest

from feedback.quality_scorer import QualityScorer
from feedback.pre_solve_analyzer import PreSolveAnalyzer
from models.input import TimetableData
from models.output import ScheduledLesson


def data():
    return TimetableData(**{
        "meta": {"optimizationPreferencesRevision": 4},
        "config": {
            "daysOfWeek": ["Saturday", "Sunday"],
            "periodsPerDay": 4,
            "periodsPerDayMap": {"Saturday": 4, "Sunday": 4},
        },
        "preferences": {
            "avoidTeacherGapsWeight": 2,
            "avoidClassGapsWeight": 1,
            "distributeDifficultSubjectsWeight": 1,
            "balanceTeacherLoadWeight": 0.5,
            "minimizeRoomChangesWeight": 0.5,
            "preferMorningForDifficultWeight": 1,
            "respectTeacherTimePreferenceWeight": 0.5,
            "respectTeacherRoomPreferenceWeight": 0.5,
            "respectPreferredColleaguesWeight": 0,
            "preferClassHomeRoomWeight": 2,
            "respectSubjectDesiredFeaturesWeight": 0.5,
            "subjectSpreadWeight": 1,
            "allowConsecutivePeriodsForSameSubject": True,
        },
        "rooms": [
            {"id": "home", "name": "Home", "capacity": 30, "type": "normal", "features": ["projector"]},
            {"id": "other", "name": "Other", "capacity": 30, "type": "normal", "features": []},
        ],
        "subjects": [
            {"id": "math", "name": "Math", "isDifficult": True, "desiredFeatures": ["projector"]},
            {"id": "physics", "name": "Physics", "isDifficult": True},
        ],
        "teachers": [{
            "id": "teacher", "fullName": "Teacher", "primarySubjectIds": ["math", "physics"],
            "availability": {"Saturday": [True] * 4, "Sunday": [True] * 4},
            "maxPeriodsPerWeek": 8, "timePreference": "Morning", "preferredRoomIds": ["home"],
        }],
        "classes": [{
            "id": "class", "name": "Class", "studentCount": 20, "homeRoomId": "home",
            "subjectRequirements": {"math": {"periodsPerWeek": 4}, "physics": {"periodsPerWeek": 4}},
        }],
    })


class ConstraintQualityTests(unittest.TestCase):
    def test_rejects_non_canonical_strength(self):
        payload = data().model_dump()
        payload["preferences"]["avoidTeacherGapsWeight"] = 0.3

        with self.assertRaises(ValueError):
            TimetableData(**payload)

    def test_reports_every_enabled_objective_and_actionable_violations(self):
        lessons = [
            ScheduledLesson(day="Saturday", periodIndex=0, classId="class", subjectId="math", teacherIds=["teacher"], roomId="home"),
            ScheduledLesson(day="Saturday", periodIndex=2, classId="class", subjectId="math", teacherIds=["teacher"], roomId="other"),
            ScheduledLesson(day="Saturday", periodIndex=3, classId="class", subjectId="physics", teacherIds=["teacher"], roomId="other"),
        ]
        score = QualityScorer(lessons, data()).calculate()
        results = {result.key: result for result in score.objective_results}
        self.assertEqual(len(results), 11)
        self.assertGreater(results["avoidTeacherGaps"].violation_units, 0)
        self.assertGreater(results["distributeDifficultSubjects"].violation_units, 0)
        self.assertGreater(results["preferClassHomeRoom"].violation_units, 0)
        self.assertTrue(score.suggestions)

    def test_disabled_consecutive_periods_blocks_impossible_weekly_requirement(self):
        payload = data().model_dump()
        payload["preferences"]["allowConsecutivePeriodsForSameSubject"] = False
        payload["classes"][0]["subjectRequirements"]["math"]["periodsPerWeek"] = 5
        payload["classes"][0]["subjectRequirements"]["physics"]["periodsPerWeek"] = 3

        result = PreSolveAnalyzer(TimetableData(**payload)).analyze()

        self.assertFalse(result.can_proceed)
        self.assertIn(
            "SUBJECT_DAILY_LIMIT_INFEASIBLE",
            [error.error_code for error in result.errors],
        )


if __name__ == "__main__":
    unittest.main()
