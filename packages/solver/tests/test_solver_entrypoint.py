import json
import subprocess
import sys
from pathlib import Path

import solver as solver_entry


def test_large_problem_uses_canonical_solver_contract(monkeypatch):
    captured = {}

    class FakeSolver:
        def __init__(self, data):
            captured["data"] = data

        def solve(self, user_strategy=None):
            captured["strategy"] = user_strategy
            return {"status": "success", "data": {"schedule": [{"id": "kept"}]}}

    monkeypatch.setattr(solver_entry, "TimetableData", lambda **payload: payload)
    monkeypatch.setattr(solver_entry, "TimetableSolver", FakeSolver)

    result = solver_entry.solve_with_decomposition_if_beneficial(
        {
            "config": {"strategy": "balanced"},
            "classes": [
                {
                    "subjectRequirements": {
                        "math": {"periodsPerWeek": 250},
                    }
                }
            ],
        }
    )

    assert result["status"] == "success"
    assert result["data"]["schedule"] == [{"id": "kept"}]
    assert captured["strategy"] == "balanced"


def test_main_entrypoint_supports_swap_protocol():
    payload = {
        "operation": "validate_schedule",
        "constraintData": {
            "teachers": [{"id": "t1"}],
            "subjects": [{"id": "s1", "name": "Math"}],
            "rooms": [],
            "classes": [{"id": "c1", "studentCount": 20}],
            "assignments": [
                {
                    "classId": "c1",
                    "subjectId": "s1",
                    "teacherIds": ["t1"],
                    "roomId": None,
                    "day": "Saturday",
                    "periodIndex": 0,
                }
            ],
            "fixedLessons": [],
            "timetableData": {},
            "config": {
                "daysOfWeek": ["Saturday"],
                "periodsPerDay": {"Saturday": 7},
            },
        },
    }

    completed = subprocess.run(
        [sys.executable, str(Path(__file__).parents[1] / "solver.py"), "--swap"],
        input=json.dumps(payload),
        capture_output=True,
        check=True,
        text=True,
    )

    result = json.loads(completed.stdout)
    assert result["is_valid"] is True
    assert result["errors"] == []
