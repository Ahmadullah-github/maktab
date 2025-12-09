"""Constraint registry for plugin-based constraint system.

This module provides a registry for managing constraints in a modular way,
allowing constraints to be registered, unregistered, and applied by stage.
"""
from enum import IntEnum
from typing import Any, Dict, List, Optional, Type
from ortools.sat.python import cp_model

from .base import Constraint


class ConstraintStage(IntEnum):
    """Stages for constraint application.
    
    Constraints are applied in order of their stage value:
    - ESSENTIAL: Hard constraints that must always be satisfied (applied first)
    - IMPORTANT: High-priority soft constraints
    - OPTIONAL: Low-priority soft constraints (applied last)
    """
    ESSENTIAL = 1
    IMPORTANT = 2
    OPTIONAL = 3


class ConstraintPriority(IntEnum):
    """Priority levels for constraints within a stage.
    
    Higher priority constraints are applied first within their stage.
    """
    CRITICAL = 4
    HIGH = 3
    MEDIUM = 2
    LOW = 1


class ConstraintRegistry:
    """Registry for constraint plugins.
    
    Implements a singleton pattern to ensure a single global registry.
    Constraints can be registered with a stage and priority, then applied
    in the correct order during solving.
    
    Example:
        >>> registry = ConstraintRegistry.get_instance()
        >>> registry.register(NoClassOverlapConstraint(), ConstraintStage.ESSENTIAL)
        >>> registry.apply_all(model, context, ConstraintStage.ESSENTIAL)
    """
    
    _instance: Optional['ConstraintRegistry'] = None
    
    def __init__(self):
        """Initialize the constraint registry."""
        self._constraints: Dict[ConstraintStage, List[Constraint]] = {
            stage: [] for stage in ConstraintStage
        }
        self._constraint_names: Dict[str, ConstraintStage] = {}

    @classmethod
    def get_instance(cls) -> 'ConstraintRegistry':
        """Get the singleton instance of the registry.
        
        Returns:
            The global ConstraintRegistry instance.
        """
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    @classmethod
    def reset_instance(cls) -> None:
        """Reset the singleton instance (primarily for testing)."""
        cls._instance = None
    
    def register(
        self,
        constraint: Constraint,
        stage: Optional[ConstraintStage] = None
    ) -> None:
        """Register a constraint for automatic application.
        
        Args:
            constraint: The constraint to register.
            stage: The stage at which to apply this constraint.
                   If None, defaults to ESSENTIAL for hard constraints
                   and IMPORTANT for soft constraints.
        
        Raises:
            ValueError: If a constraint with the same name is already registered.
        """
        if constraint.name in self._constraint_names:
            raise ValueError(
                f"Constraint '{constraint.name}' is already registered. "
                "Use unregister() first to replace it."
            )
        
        # Determine stage based on constraint type if not specified
        if stage is None:
            stage = ConstraintStage.ESSENTIAL if constraint.is_hard else ConstraintStage.IMPORTANT
        
        self._constraints[stage].append(constraint)
        self._constraint_names[constraint.name] = stage
    
    def unregister(self, constraint_name: str) -> bool:
        """Unregister a constraint by name.
        
        Args:
            constraint_name: The name of the constraint to remove.
        
        Returns:
            True if the constraint was found and removed, False otherwise.
        """
        if constraint_name not in self._constraint_names:
            return False
        
        stage = self._constraint_names[constraint_name]
        self._constraints[stage] = [
            c for c in self._constraints[stage] if c.name != constraint_name
        ]
        del self._constraint_names[constraint_name]
        return True
    
    def apply_all(
        self,
        model: cp_model.CpModel,
        context: Dict[str, Any],
        stage: ConstraintStage
    ) -> List[Any]:
        """Apply all registered constraints for a given stage.
        
        Args:
            model: The CP-SAT model to add constraints to.
            context: Dictionary containing solver state.
            stage: The stage of constraints to apply.
        
        Returns:
            List of penalty variables from soft constraints (for minimization).
        """
        penalty_vars = []
        
        for constraint in self._constraints[stage]:
            if not constraint.enabled:
                continue
            
            if not constraint.should_apply(context):
                continue
            
            result = constraint.apply(model, context)
            constraint.applied = True
            
            # Soft constraints return penalty variables
            if result is not None and not constraint.is_hard:
                penalty_vars.extend(result)
        
        return penalty_vars
    
    def get_constraints(
        self,
        stage: Optional[ConstraintStage] = None
    ) -> List[Constraint]:
        """Get registered constraints, optionally filtered by stage.
        
        Args:
            stage: If provided, only return constraints for this stage.
                   If None, return all constraints.
        
        Returns:
            List of registered constraints.
        """
        if stage is not None:
            return list(self._constraints[stage])
        
        all_constraints = []
        for s in ConstraintStage:
            all_constraints.extend(self._constraints[s])
        return all_constraints
    
    def get_constraint_by_name(self, name: str) -> Optional[Constraint]:
        """Get a specific constraint by name.
        
        Args:
            name: The name of the constraint to find.
        
        Returns:
            The constraint if found, None otherwise.
        """
        if name not in self._constraint_names:
            return None
        
        stage = self._constraint_names[name]
        for constraint in self._constraints[stage]:
            if constraint.name == name:
                return constraint
        return None
    
    def clear(self) -> None:
        """Remove all registered constraints."""
        self._constraints = {stage: [] for stage in ConstraintStage}
        self._constraint_names.clear()
    
    def __len__(self) -> int:
        """Return the total number of registered constraints."""
        return sum(len(constraints) for constraints in self._constraints.values())
    
    def __repr__(self) -> str:
        counts = {stage.name: len(self._constraints[stage]) for stage in ConstraintStage}
        return f"<ConstraintRegistry {counts}>"
