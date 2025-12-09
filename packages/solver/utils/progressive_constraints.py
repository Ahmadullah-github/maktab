"""
Phase 3.3: Progressive Constraint Application

Applies constraints in stages based on problem complexity.
Ensures hard constraints are always applied, then adds soft constraints by priority.
"""
import structlog
from typing import Callable, List, Dict, Any
from enum import Enum

log = structlog.get_logger()


class ConstraintStage(Enum):
    """Stages for constraint application."""
    HARD = 1           # Hard constraints (always applied)
    CRITICAL_SOFT = 2  # Critical soft constraints
    IMPORTANT_SOFT = 3 # Important soft constraints
    OPTIONAL_SOFT = 4  # Optional soft constraints


class ProgressiveConstraintManager:
    """
    Manages progressive application of constraints based on problem complexity.
    
    Small problems: Apply all constraints
    Medium problems: Apply hard + critical + important
    Large problems: Apply hard + critical only
    """
    
    def __init__(self, problem_complexity: str = "medium"):
        """
        Initialize progressive constraint manager.
        
        Args:
            problem_complexity: "small", "medium", or "large"
        """
        self.problem_complexity = problem_complexity
        self.constraints_to_apply = self._determine_stages()
        
        log.info(f"Progressive constraint manager initialized",
                 complexity=problem_complexity,
                 stages=self.constraints_to_apply)
    
    def _determine_stages(self) -> List[ConstraintStage]:
        """Determine which constraint stages to apply based on complexity."""
        if self.problem_complexity == "small":
            # Small problems: Apply everything
            return [
                ConstraintStage.HARD,
                ConstraintStage.CRITICAL_SOFT,
                ConstraintStage.IMPORTANT_SOFT,
                ConstraintStage.OPTIONAL_SOFT
            ]
        elif self.problem_complexity == "large":
            # Large problems: Hard + critical only
            return [
                ConstraintStage.HARD,
                ConstraintStage.CRITICAL_SOFT
            ]
        else:  # medium
            # Medium problems: Hard + critical + important
            return [
                ConstraintStage.HARD,
                ConstraintStage.CRITICAL_SOFT,
                ConstraintStage.IMPORTANT_SOFT
            ]
    
    def should_apply_constraint(self, stage: ConstraintStage) -> bool:
        """
        Check if a constraint stage should be applied.
        
        Args:
            stage: Constraint stage to check
            
        Returns:
            True if this stage should be applied
        """
        return stage in self.constraints_to_apply
    
    def get_enabled_stages(self) -> List[ConstraintStage]:
        """Get list of enabled constraint stages."""
        return self.constraints_to_apply
    
    def log_configuration(self):
        """Log the current constraint configuration."""
        enabled = [stage.name for stage in self.constraints_to_apply]
        log.info(f"Constraint stages enabled: {', '.join(enabled)}",
                 complexity=self.problem_complexity,
                 num_stages=len(self.constraints_to_apply))


def determine_problem_complexity(
    num_requests: int,
    num_teachers: int,
    num_classes: int,
    model_complexity: float
) -> str:
    """
    Determine problem complexity based on various metrics.
    
    Args:
        num_requests: Number of lesson requests
        num_teachers: Number of teachers
        num_classes: Number of classes
        model_complexity: Calculated model complexity
        
    Returns:
        "small", "medium", or "large"
    """
    # Calculate complexity score
    score = 0
    
    # Request count (most important factor)
    if num_requests > 150:
        score += 3
    elif num_requests > 80:
        score += 2
    else:
        score += 1
    
    # Teacher count
    if num_teachers > 30:
        score += 2
    elif num_teachers > 15:
        score += 1
    
    # Class count
    if num_classes > 20:
        score += 2
    elif num_classes > 10:
        score += 1
    
    # Model complexity
    if model_complexity > 50000:
        score += 2
    elif model_complexity > 20000:
        score += 1
    
    # Determine complexity level
    if score >= 7:
        complexity = "large"
    elif score >= 4:
        complexity = "medium"
    else:
        complexity = "small"
    
    log.info(f"Problem complexity determined",
             complexity=complexity,
             score=score,
             num_requests=num_requests,
             num_teachers=num_teachers,
             num_classes=num_classes,
             model_complexity=int(model_complexity))
    
    return complexity
