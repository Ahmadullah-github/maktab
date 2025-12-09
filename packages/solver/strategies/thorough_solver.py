"""Thorough solver strategy - all optimizations, best quality."""
from typing import Any, Dict, List
from .base import SolverStrategy


class ThoroughStrategy(SolverStrategy):
    """
    Thorough solving strategy.
    
    Characteristics:
    - All soft constraints enabled
    - 16 workers for exhaustive search
    - Full time limit
    - Maximum quality
    
    Best for:
    - Small problems (<100 requests)
    - Final production timetables
    - When quality matters more than speed
    """
    
    def __init__(self):
        super().__init__("Thorough")
    
    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        """Get comprehensive search parameters for best quality."""
        return {
            'max_time_in_seconds': time_limit,
            'num_workers': 16,  # Maximum parallelism
            'log_search_progress': False,
            'cp_model_probing_level': 2,  # Aggressive probing
            'linearization_level': 2,  # Full linearization
            'cp_model_presolve': True,
            'symmetry_level': 2,  # Use symmetry breaking
            'optimize_with_max_hs': True,  # Use additional optimization strategies
        }
    
    def get_enabled_soft_constraints(self, problem_size: Dict[str, int]) -> List[str]:
        """Enable ALL soft constraints for maximum quality."""
        return [
            'prefer_morning_difficult',
            'avoid_first_last_period',
            'subject_spread',
            'balance_teacher_load',
            'minimize_room_changes',
            'respect_room_preferences',
            'avoid_teacher_gaps',
            'teacher_collaboration',
            # Could add more advanced constraints here in the future
        ]
    
    def get_constraint_budget(self, problem_size: Dict[str, int]) -> int:
        """No strict limit - allow many penalty variables."""
        num_requests = problem_size.get('num_requests', 0)
        
        # ~10 penalty vars per request (generous)
        return max(1000, num_requests * 10)
    
    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        """Use thorough strategy only for small, well-constrained problems."""
        num_requests = problem_size.get('num_requests', 0)
        avg_teachers = problem_size.get('avg_teachers', 10)
        
        # Use if:
        # - Small problem
        # - AND good teacher availability
        # - AND reasonable complexity
        return num_requests < 150 and avg_teachers >= 3.5 and model_complexity < 50000
