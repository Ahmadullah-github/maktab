"""Fast solver strategy - minimal constraints, quick solutions."""
from typing import Any, Dict, List
from .base import SolverStrategy


class FastStrategy(SolverStrategy):
    """
    Fast solving strategy.
    
    Characteristics:
    - Minimal soft constraints
    - 4 workers for quick search
    - Short time limit
    - No expensive optimizations
    
    Best for:
    - Initial testing
    - Highly constrained problems
    - Quick feasibility checks
    """
    
    def __init__(self):
        super().__init__("Fast")
    
    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        """Get minimal search parameters for fast solving."""
        return {
            'max_time_in_seconds': min(time_limit, 300),  # Max 5 minutes
            'num_workers': 4,  # Fewer workers = less overhead
            'log_search_progress': False,
            'cp_model_probing_level': 0,  # Minimal probing
            'linearization_level': 0,  # No linearization
            'cp_model_presolve': True,  # Basic presolve only
        }
    
    def get_enabled_soft_constraints(self, problem_size: Dict[str, int]) -> List[str]:
        """Enable only essential soft constraints."""
        # Only enable the most important optimizations
        return [
            'prefer_morning_difficult',  # Keep difficult subjects in morning
            'avoid_first_last_period',   # Basic comfort constraint
        ]
    
    def get_constraint_budget(self, problem_size: Dict[str, int]) -> int:
        """Strict penalty variable limit for fast mode."""
        num_requests = problem_size.get('num_requests', 0)
        
        # Very strict limit: ~2 penalty vars per request
        return max(100, num_requests * 2)
    
    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        """Use fast strategy for highly constrained or very large problems."""
        num_requests = problem_size.get('num_requests', 0)
        avg_teachers = problem_size.get('avg_teachers', 10)
        
        # Use if:
        # - Very few teacher options (highly constrained)
        # - OR very large problem
        return avg_teachers < 2.5 or num_requests > 500
