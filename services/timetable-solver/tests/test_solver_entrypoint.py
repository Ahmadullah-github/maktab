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
