# ==============================================================================
#
#  Unit Tests for Request Processing
#
#  These tests verify that weekly subject requirements are split into the
#  correct lesson blocks before the CP-SAT model is built.
#
# ==============================================================================

from core.solver import TimetableSolver
from models.input import (
    ClassGroup,
    DayOfWeek,
    GlobalConfig,
    Room,
    Subject,
    SubjectRequirement,
    Teacher,
    TimetableData,
)


def _build_solver(periods_per_day: int, subject_requirement: SubjectRequirement) -> TimetableSolver:
    days = [
        DayOfWeek.SATURDAY,
        DayOfWeek.SUNDAY,
        DayOfWeek.MONDAY,
        DayOfWeek.TUESDAY,
        DayOfWeek.WEDNESDAY,
        DayOfWeek.THURSDAY,
    ]

    data = TimetableData(
        config=GlobalConfig(
            daysOfWeek=days,
            periodsPerDay=periods_per_day,
        ),
        rooms=[
            Room(
                id="ROOM_1",
                name="Room 1",
                capacity=30,
                type="classroom",
            )
        ],
        subjects=[
            Subject(id="MATH", name="Mathematics"),
            Subject(id="FILL", name="Filler"),
        ],
        teachers=[
            Teacher(
                id="TEACHER_1",
                fullName="Ahmad Khan",
                primarySubjectIds=["MATH"],
                availability={day: [True] * periods_per_day for day in days},
                maxPeriodsPerWeek=36,
            ),
            Teacher(
                id="TEACHER_2",
                fullName="Filler Teacher",
                primarySubjectIds=["FILL"],
                availability={day: [True] * periods_per_day for day in days},
                maxPeriodsPerWeek=36,
            ),
        ],
        classes=[
            ClassGroup(
                id="CLASS_1",
                name="Class 1",
                studentCount=30,
                subjectRequirements={
                    "MATH": subject_requirement,
                    "FILL": SubjectRequirement(periodsPerWeek=36 - subject_requirement.periodsPerWeek),
                },
                gradeLevel=7,
            )
        ],
    )

    return TimetableSolver(data)


def test_default_request_processing_splits_weekly_periods_into_single_period_lessons():
    solver = _build_solver(
        periods_per_day=6,
        subject_requirement=SubjectRequirement(periodsPerWeek=5),
    )

    math_requests = [request for request in solver.requests if request["subject_id"] == "MATH"]

    assert len(math_requests) == 5
    assert [request["length"] for request in math_requests] == [1, 1, 1, 1, 1]


def test_request_processing_honors_max_consecutive_when_present():
    solver = _build_solver(
        periods_per_day=6,
        subject_requirement=SubjectRequirement(periodsPerWeek=5, maxConsecutive=2),
    )

    math_requests = [request for request in solver.requests if request["subject_id"] == "MATH"]

    assert [request["length"] for request in math_requests] == [2, 2, 1]


def test_solver_allows_same_day_split_when_max_consecutive_is_two():
    days = [DayOfWeek.SATURDAY]
    data = TimetableData(
        config=GlobalConfig(
            daysOfWeek=days,
            periodsPerDay=3,
        ),
        rooms=[
            Room(
                id="ROOM_1",
                name="Room 1",
                capacity=30,
                type="classroom",
            )
        ],
        subjects=[Subject(id="MATH", name="Mathematics")],
        teachers=[
            Teacher(
                id="TEACHER_1",
                fullName="Ahmad Khan",
                primarySubjectIds=["MATH"],
                availability={DayOfWeek.SATURDAY: [True, True, True]},
                maxPeriodsPerWeek=3,
            )
        ],
        classes=[
            ClassGroup(
                id="CLASS_1",
                name="Class 1",
                studentCount=30,
                subjectRequirements={
                    "MATH": SubjectRequirement(periodsPerWeek=3, maxConsecutive=2)
                },
                gradeLevel=7,
            )
        ],
    )

    solver = TimetableSolver(data)
    result = solver.solve(time_limit_seconds=5, user_strategy="fast")

    assert result["status"] == "success"
    assert solver.num_requests == 2
    assert len(result["data"]["schedule"]) == 3
