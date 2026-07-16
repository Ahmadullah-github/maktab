"""Fast search effort; the enabled objective set remains unchanged."""
from typing import Any, Dict
from .base import SolverStrategy


class FastStrategy(SolverStrategy):
    def __init__(self):
        super().__init__("Fast")

    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        return {
            "max_time_in_seconds": min(time_limit, 300),
            "num_workers": 4,
            "log_search_progress": False,
            "cp_model_probing_level": 0,
            "linearization_level": 0,
            "cp_model_presolve": True,
        }

    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        return problem_size.get("num_requests", 0) > 400 or model_complexity > 100000
