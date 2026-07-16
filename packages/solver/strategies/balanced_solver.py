"""Balanced search effort; the enabled objective set remains unchanged."""
from typing import Any, Dict
from .base import SolverStrategy


class BalancedStrategy(SolverStrategy):
    def __init__(self):
        super().__init__("Balanced")

    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        return {
            "max_time_in_seconds": time_limit,
            "num_workers": 8,
            "log_search_progress": False,
            "cp_model_probing_level": 1,
            "linearization_level": 1,
            "cp_model_presolve": True,
        }

    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        return 100 <= problem_size.get("num_requests", 0) <= 500
