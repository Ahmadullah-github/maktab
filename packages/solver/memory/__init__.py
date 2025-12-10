# ==============================================================================
#
#  Memory Management Module
#
#  Description:
#  Provides memory management capabilities for the timetable solver,
#  including memory limit checking, garbage collection triggering,
#  and variable pool management.
#
#  Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
#
# ==============================================================================

from .manager import MemoryManager, MemoryError, MemoryWarning

__all__ = ["MemoryManager", "MemoryError", "MemoryWarning"]
