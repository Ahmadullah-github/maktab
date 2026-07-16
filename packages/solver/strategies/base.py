"""Base strategy interface for solver strategies."""
from abc import ABC, abstractmethod
from typing import Any, Dict
from ortools.sat.python import cp_model


class SolverStrategy(ABC):
    """Base class for solver strategies (Fast, Balanced, Thorough)."""
    
    def __init__(self, name: str):
        """
        Initialize strategy.
        
        Args:
            name: Strategy name (e.g., "Fast", "Balanced", "Thorough")
        """
        self.name = name
    
    @abstractmethod
    def get_solver_parameters(self, time_limit: int, problem_size: Dict[str, int]) -> Dict[str, Any]:
        """
        Get CP-SAT solver parameters for this strategy.
        
        Args:
            time_limit: Maximum solve time in seconds
            problem_size: Dictionary with 'num_requests', 'num_teachers', etc.
        
        Returns:
            Dictionary of CP-SAT parameters
        """
        pass
    
    def should_use_for_problem(self, problem_size: Dict[str, int], model_complexity: float) -> bool:
        """
        Determine if this strategy is appropriate for the given problem.
        
        Can be overridden for automatic strategy selection.
        
        Args:
            problem_size: Dictionary with problem metrics
            model_complexity: Calculated model complexity score
        
        Returns:
            True if this strategy should be used
        """
        return True
    
    def __repr__(self) -> str:
        return f"<{self.__class__.__name__} '{self.name}'>"
