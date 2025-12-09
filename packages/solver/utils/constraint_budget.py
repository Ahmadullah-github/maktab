"""
Phase 3.2: Constraint Budgeting System

Prevents constraint explosion by limiting the number of penalty variables.
Prioritizes important constraints over nice-to-have ones.
"""
import structlog
from enum import Enum
from typing import Optional

log = structlog.get_logger()


class ConstraintPriority(Enum):
    """Priority levels for soft constraints."""
    CRITICAL = 1    # Must have (e.g., avoid first/last period for difficult subjects)
    HIGH = 2        # Very important (e.g., teacher load balancing)
    MEDIUM = 3      # Important (e.g., subject spread throughout week)
    LOW = 4         # Nice to have (e.g., minimize room changes)


class ConstraintBudget:
    """
    Manages budget for soft constraint penalty variables.
    
    Prevents performance degradation by limiting total penalty variables.
    Uses priority-based allocation to ensure important constraints are applied.
    """
    
    def __init__(self, max_penalty_vars: int = 2000, problem_size: str = "medium"):
        """
        Initialize constraint budget.
        
        Args:
            max_penalty_vars: Maximum number of penalty variables allowed
            problem_size: "small", "medium", or "large" - affects default budgets
        """
        self.max_penalty_vars = max_penalty_vars
        self.problem_size = problem_size
        self.penalty_vars_used = 0
        
        # Budget allocation per priority (percentage of total)
        if problem_size == "small":
            self.allocations = {
                ConstraintPriority.CRITICAL: 0.50,  # 50% for critical
                ConstraintPriority.HIGH: 0.30,      # 30% for high
                ConstraintPriority.MEDIUM: 0.15,    # 15% for medium
                ConstraintPriority.LOW: 0.05        # 5% for low
            }
        elif problem_size == "large":
            self.allocations = {
                ConstraintPriority.CRITICAL: 0.70,  # 70% for critical
                ConstraintPriority.HIGH: 0.25,      # 25% for high
                ConstraintPriority.MEDIUM: 0.05,    # 5% for medium
                ConstraintPriority.LOW: 0.00        # Skip low priority
            }
        else:  # medium
            self.allocations = {
                ConstraintPriority.CRITICAL: 0.60,  # 60% for critical
                ConstraintPriority.HIGH: 0.25,      # 25% for high
                ConstraintPriority.MEDIUM: 0.10,    # 10% for medium
                ConstraintPriority.LOW: 0.05        # 5% for low
            }
        
        # Track usage per priority
        self.used_per_priority = {p: 0 for p in ConstraintPriority}
        self.budget_per_priority = {
            p: int(max_penalty_vars * alloc) 
            for p, alloc in self.allocations.items()
        }
        
        log.info(f"Constraint budget initialized", 
                 max_penalty_vars=max_penalty_vars,
                 problem_size=problem_size,
                 budgets={p.name: v for p, v in self.budget_per_priority.items()})
    
    def can_add_penalty(self, priority: ConstraintPriority, count: int = 1) -> bool:
        """
        Check if we can add penalty variables for this priority level.
        
        Args:
            priority: Priority level of the constraint
            count: Number of penalty variables to add
            
        Returns:
            True if within budget, False otherwise
        """
        # Check global budget
        if self.penalty_vars_used + count > self.max_penalty_vars:
            return False
        
        # Check priority-specific budget
        budget = self.budget_per_priority[priority]
        used = self.used_per_priority[priority]
        
        if used + count > budget:
            return False
        
        return True
    
    def allocate_penalty(self, priority: ConstraintPriority, count: int = 1) -> bool:
        """
        Allocate penalty variables if within budget.
        
        Args:
            priority: Priority level of the constraint
            count: Number of penalty variables to allocate
            
        Returns:
            True if allocated successfully, False if over budget
        """
        if not self.can_add_penalty(priority, count):
            log.debug(f"Constraint budget exhausted for {priority.name}", 
                     used=self.used_per_priority[priority],
                     budget=self.budget_per_priority[priority])
            return False
        
        self.penalty_vars_used += count
        self.used_per_priority[priority] += count
        return True
    
    def get_remaining_budget(self, priority: Optional[ConstraintPriority] = None) -> int:
        """
        Get remaining budget for a priority level or total.
        
        Args:
            priority: Priority level, or None for total
            
        Returns:
            Number of penalty variables remaining
        """
        if priority is None:
            return self.max_penalty_vars - self.penalty_vars_used
        
        budget = self.budget_per_priority[priority]
        used = self.used_per_priority[priority]
        return budget - used
    
    def get_usage_stats(self) -> dict:
        """Get current usage statistics."""
        return {
            "total_used": self.penalty_vars_used,
            "total_budget": self.max_penalty_vars,
            "utilization": f"{self.penalty_vars_used / self.max_penalty_vars * 100:.1f}%",
            "per_priority": {
                p.name: {
                    "used": self.used_per_priority[p],
                    "budget": self.budget_per_priority[p],
                    "remaining": self.budget_per_priority[p] - self.used_per_priority[p]
                }
                for p in ConstraintPriority
            }
        }
    
    def log_summary(self):
        """Log budget usage summary."""
        stats = self.get_usage_stats()
        log.info(f"Constraint budget summary",
                 total_used=stats["total_used"],
                 total_budget=stats["total_budget"],
                 utilization=stats["utilization"])
        
        for priority_name, priority_stats in stats["per_priority"].items():
            if priority_stats["budget"] > 0:
                log.info(f"  {priority_name}: {priority_stats['used']}/{priority_stats['budget']} "
                        f"({priority_stats['remaining']} remaining)")
