"""Thorough search effort; the enabled objective set remains unchanged."""
from typing import Any, Dict
from .base import SolverStrategy


class ThoroughStrategy(SolverStrategy):
    def __init__(self):
        super().__init__("Thorough")

    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        return {
            "max_time_in_seconds": time_limit,
            "num_workers": 16,
            "log_search_progress": False,
            "cp_model_probing_level": 2,
            "linearization_level": 2,
            "cp_model_presolve": True,
            "symmetry_level": 2,
            "optimize_with_max_hs": True,
        }

    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        return problem_size.get("num_requests", 0) < 200 and model_complexity < 50000
