"""Base constraint interface for modular constraint system."""
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from ortools.sat.python import cp_model


class Constraint(ABC):
    """Base class for all constraints."""
    
    def __init__(self, name: str, is_hard: bool = True, weight: int = 1):
        """
        Initialize constraint.
        
        Args:
            name: Human-readable name for this constraint
            is_hard: True for hard constraints (must be satisfied), False for soft (optimization)
            weight: Weight/priority for soft constraints (higher = more important)
        """
        self.name = name
        self.is_hard = is_hard
        self.weight = weight
        self.enabled = True
        self.applied = False
    
    @abstractmethod
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> Optional[List[Any]]:
        """
        Apply this constraint to the CP-SAT model.
        
        Args:
            model: CP-SAT model to add constraints to
            context: Dictionary containing solver state:
                - 'data': Input data
                - 'requests': List of scheduling requests
                - 'start_vars': Decision variables for start times
                - 'teacher_vars': Decision variables for teachers
                - 'room_vars': Decision variables for rooms
                - 'class_map', 'subject_map', 'teacher_map', 'room_map': ID mappings
                - 'num_days', 'num_periods_per_day': Schedule structure
                - etc.
        
        Returns:
            For hard constraints: None
            For soft constraints: List of penalty variables to minimize
        """
        pass
    
    def enable(self):
        """Enable this constraint."""
        self.enabled = True
    
    def disable(self):
        """Disable this constraint."""
        self.enabled = False
    
    def should_apply(self, context: Dict[str, Any]) -> bool:
        """
        Determine if this constraint should be applied given current context.
        
        Can be overridden for adaptive behavior based on problem size, etc.
        
        Args:
            context: Solver context dictionary
        
        Returns:
            True if constraint should be applied, False otherwise
        """
        return self.enabled
    
    def __repr__(self) -> str:
        constraint_type = "HARD" if self.is_hard else f"SOFT(w={self.weight})"
        status = "ENABLED" if self.enabled else "DISABLED"
        return f"<{self.__class__.__name__}[{constraint_type}] {self.name} - {status}>"


class HardConstraint(Constraint):
    """Base class for hard constraints (must be satisfied)."""
    
    def __init__(self, name: str):
        super().__init__(name, is_hard=True, weight=0)


class SoftConstraint(Constraint):
    """Base class for soft constraints (optimization objectives)."""
    
    def __init__(self, name: str, weight: int = 1):
        super().__init__(name, is_hard=False, weight=weight)
