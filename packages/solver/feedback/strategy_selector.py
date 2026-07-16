# ==============================================================================
#
#  Strategy Selector for Timetable Solver
#
#  Description:
#  Auto-selects the optimal solver strategy based on problem size (total lessons).
#  Supports user override for explicit strategy selection.
#
# ==============================================================================

from typing import Dict, Any, Optional

from models.input import TimetableData


# ==============================================================================
# Threshold Constants
# ==============================================================================

# Total lessons threshold below which a thorough search is affordable.
FAST_THRESHOLD = 200

# Total lessons threshold for balanced strategy (medium schools)
# Above this threshold, fast search effort is safer.
BALANCED_THRESHOLD = 500


# ==============================================================================
# Strategy Selector Class
# ==============================================================================

class StrategySelector:
    """
    Selects the optimal solver strategy based on problem size.
    
    Strategy selection rules (objectives are identical for every strategy):
    - total_lessons < FAST_THRESHOLD (200): "thorough" strategy
    - FAST_THRESHOLD <= total_lessons < BALANCED_THRESHOLD (500): "balanced" strategy
    - total_lessons >= BALANCED_THRESHOLD (500): "fast" strategy
    
    User can override automatic selection by providing explicit strategy.
    """
    
    def __init__(self, data: TimetableData):
        """
        Initialize the strategy selector with timetable data.
        
        Args:
            data: The TimetableData containing classes and subject requirements.
        """
        self.data = data
        self.total_lessons = self._count_total_lessons()
    
    def _count_total_lessons(self) -> int:
        """
        Count total lessons to schedule across all classes.
        
        Returns:
            Total number of lesson periods required per week.
        """
        total = 0
        for cls in self.data.classes:
            for req in cls.subjectRequirements.values():
                total += req.periodsPerWeek
        return total
    
    def select(self, user_strategy: Optional[str] = None) -> Dict[str, Any]:
        """
        Select strategy and return metadata.
        
        Args:
            user_strategy: Optional user-specified strategy to override auto-selection.
                          Valid values: "fast", "balanced", "thorough"
        
        Returns:
            Dictionary containing:
            - strategy_selected: The selected strategy name
            - strategy_overridden: True if user specified strategy, False otherwise
            - strategy_reason: Human-readable explanation for selection
            - total_lessons: Total lesson count used for auto-selection
        """
        if user_strategy:
            return {
                "strategy_selected": user_strategy,
                "strategy_overridden": True,
                "strategy_reason": "User specified",
                "total_lessons": self.total_lessons
            }
        
        # Auto-select based on total lessons
        if self.total_lessons < FAST_THRESHOLD:
            strategy = "thorough"
            reason = f"Small school ({self.total_lessons} lessons < {FAST_THRESHOLD})"
        elif self.total_lessons < BALANCED_THRESHOLD:
            strategy = "balanced"
            reason = f"Medium school ({FAST_THRESHOLD} <= {self.total_lessons} lessons < {BALANCED_THRESHOLD})"
        else:
            strategy = "fast"
            reason = f"Large school ({self.total_lessons} lessons >= {BALANCED_THRESHOLD})"
        
        return {
            "strategy_selected": strategy,
            "strategy_overridden": False,
            "strategy_reason": reason,
            "total_lessons": self.total_lessons
        }
