from __future__ import annotations

from dataclasses import dataclass

import pytest
import solver as solver_entry


@dataclass(frozen=True)
class SyntheticDataset:
    name: str
    weekly_lessons: int
    strategy: str
    impossible: bool = False

    def payload(self) -> dict:
        return {
            "config": {"strategy": self.strategy},
            "classes": [
                {
                    "id": f"{self.name}-class",
                    "subjectRequirements": {
                        f"{self.name}-subject": {
                            "periodsPerWeek": self.weekly_lessons,
                        }
                    },
                }
            ],
            "syntheticContradiction": self.impossible,
        }


DATASETS = (
    SyntheticDataset("small", 60, "balanced"),
    SyntheticDataset("medium", 300, "balanced"),
    SyntheticDataset("large", 600, "fast"),
    SyntheticDataset("impossible", 60, "balanced", impossible=True),
)


@pytest.mark.parametrize("dataset", DATASETS, ids=lambda dataset: dataset.name)
def test_representative_dataset_contracts_are_deterministic(monkeypatch, dataset):
    captured = {}

    class DeterministicSolver:
        def __init__(self, payload):
            captured["payload"] = payload

        def solve(self, user_strategy=None):
            captured["strategy"] = user_strategy
            if captured["payload"].get("syntheticContradiction"):
                return {
                    "status": "failed",
                    "errors": [{"error_code": "NO_FEASIBLE_SOLUTION"}],
                }
            return {
                "status": "success",
                "data": {"schedule": [], "weeklyLessons": dataset.weekly_lessons},
            }

    monkeypatch.setattr(solver_entry, "TimetableData", lambda **payload: payload)
    monkeypatch.setattr(solver_entry, "TimetableSolver", DeterministicSolver)

    result = solver_entry.solve_with_decomposition_if_beneficial(dataset.payload())

    assert captured["strategy"] == dataset.strategy
    if dataset.impossible:
        assert result["status"] == "failed"
        assert result["errors"][0]["error_code"] == "NO_FEASIBLE_SOLUTION"
    else:
        assert result["status"] == "success"
        assert result["data"]["weeklyLessons"] == dataset.weekly_lessons


def test_crash_failure_does_not_poison_a_successful_retry(monkeypatch):
    attempts = 0

    class RetrySolver:
        def __init__(self, _payload):
            pass

        def solve(self, user_strategy=None):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                raise RuntimeError("synthetic process crash")
            return {"status": "success", "data": {"schedule": []}}

    monkeypatch.setattr(solver_entry, "TimetableData", lambda **payload: payload)
    monkeypatch.setattr(solver_entry, "TimetableSolver", RetrySolver)
    payload = DATASETS[0].payload()

    failed = solver_entry.solve_with_decomposition_if_beneficial(payload)
    assert failed == [{"error": "synthetic process crash", "status": "ERROR"}]
    assert solver_entry.solve_with_decomposition_if_beneficial(payload)["status"] == "success"
    assert attempts == 2
