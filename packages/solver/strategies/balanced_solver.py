"""Balanced solver strategy - good tradeoff between speed and quality."""
from typing import Any, Dict, List
from .base import SolverStrategy


class BalancedStrategy(SolverStrategy):
    """
    Balanced solving strategy.
    
    Characteristics:
    - Moderate soft constraints
    - 8 workers for balanced search
    - Reasonable time limit
    - Good quality/speed tradeoff
    
    Best for:
    - Most real-world problems
    - 100-400 requests
    - Default strategy
    """
    
    def __init__(self):
        super().__init__("Balanced")
    
    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        """Get balanced search parameters."""
        return {
            'max_time_in_seconds': time_limit,
            'num_workers': 8,  # Balanced parallelism
            'log_search_progress': False,
            'cp_model_probing_level': 1,  # Moderate probing
            'linearization_level': 1,  # Some linearization
            'cp_model_presolve': True,
        }
    
    def get_enabled_soft_constraints(self, problem_size: Dict[str, int]) -> List[str]:
        """Enable most soft constraints, excluding very expensive ones."""
        num_requests = problem_size.get('num_requests', 0)
        
        # Base constraints (always enabled)
        enabled = [
            'prefer_morning_difficult',
            'avoid_first_last_period',
            'subject_spread',
            'balance_teacher_load',
            'minimize_room_changes',
            'respect_room_preferences',
        ]
        
        # Add expensive constraints only for smaller problems
        if num_requests < 300:
            enabled.extend([
                'avoid_teacher_gaps',  # Moderately expensive
            ])
        
        # Teacher collaboration is very expensive - only for small problems
        if num_requests < 200:
            enabled.append('teacher_collaboration')
        
        return enabled
    
    def get_constraint_budget(self, problem_size: Dict[str, int]) -> int:
        """Moderate penalty variable limit."""
        num_requests = problem_size.get('num_requests', 0)
        
        # ~5-6 penalty vars per request
        return max(500, num_requests * 5)
    
    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        """Use balanced strategy for moderate problems."""
        num_requests = problem_size.get('num_requests', 0)
        avg_teachers = problem_size.get('avg_teachers', 10)
        
        # Use if:
        # - Moderate problem size
        # - AND reasonable teacher availability
        return 100 <= num_requests <= 400 and avg_teachers >= 2.5
