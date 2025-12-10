# ==============================================================================
#
#  Memory Manager for Timetable Solver
#
#  Description:
#  Manages memory usage during solving to ensure reliable operation on
#  resource-constrained systems. Implements memory limit checking,
#  garbage collection triggering, and variable pool management.
#
#  **Feature: solver-refactoring, Task 17.1**
#  **Requirements: 6.1, 6.2, 6.3, 6.4, 6.5**
#
# ==============================================================================

import gc
import os
import sys
from typing import Any, Callable, Dict, Optional, TypeVar

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False


T = TypeVar('T')


class MemoryError(Exception):
    """
    Raised when memory usage exceeds the configured limit.
    
    Includes diagnostic information about current memory state.
    
    Requirements: 6.3
    """
    
    def __init__(
        self,
        message: str,
        current_mb: float,
        limit_mb: int,
        diagnostics: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize MemoryError with diagnostic information.
        
        Args:
            message: Error message describing the memory issue.
            current_mb: Current memory usage in megabytes.
            limit_mb: Configured memory limit in megabytes.
            diagnostics: Additional diagnostic information.
        """
        self.current_mb = current_mb
        self.limit_mb = limit_mb
        self.diagnostics = diagnostics or {}
        
        full_message = (
            f"{message} "
            f"(current: {current_mb:.1f}MB, limit: {limit_mb}MB)"
        )
        if diagnostics:
            full_message += f"\nDiagnostics: {diagnostics}"
        
        super().__init__(full_message)


class MemoryWarning(Warning):
    """
    Warning issued when memory usage approaches the limit.
    
    Requirements: 6.2
    """
    pass


class MemoryManager:
    """
    Manages memory usage during solving.
    
    This class provides:
    - Memory limit checking (Requirement 6.1)
    - GC triggering at threshold (Requirement 6.2)
    - MemoryError with diagnostics when limit exceeded (Requirement 6.3)
    - Variable pool management for memory optimization (Requirement 6.4)
    - Memory usage tracking (Requirement 6.5)
    
    Example:
        >>> manager = MemoryManager(max_memory_mb=4096)
        >>> manager.check_memory()  # Returns current usage ratio
        >>> var = manager.get_or_create_variable('pool', 'key', factory_func)
    """
    
    def __init__(
        self,
        max_memory_mb: int = 4096,
        warning_threshold: float = 0.8,
        gc_threshold: float = 0.9
    ):
        """
        Initialize the MemoryManager.
        
        Args:
            max_memory_mb: Maximum memory usage in megabytes (Requirement 6.1).
                          Default is 4096 MB.
            warning_threshold: Memory usage ratio to trigger warning (Requirement 6.2).
                              Default is 0.8 (80%).
            gc_threshold: Memory usage ratio to trigger garbage collection.
                         Default is 0.9 (90%).
        
        Raises:
            ValueError: If thresholds are invalid.
        """
        if max_memory_mb < 1:
            raise ValueError("max_memory_mb must be at least 1")
        if not (0 < warning_threshold < 1):
            raise ValueError("warning_threshold must be between 0 and 1")
        if not (0 < gc_threshold <= 1):
            raise ValueError("gc_threshold must be between 0 and 1")
        if warning_threshold >= gc_threshold:
            raise ValueError("warning_threshold must be less than gc_threshold")
        
        self.max_memory_mb = max_memory_mb
        self.warning_threshold = warning_threshold
        self.gc_threshold = gc_threshold
        
        # Variable pools for memory optimization (Requirement 6.4)
        self._variable_pools: Dict[str, Dict[str, Any]] = {}
        
        # Tracking statistics
        self._gc_trigger_count = 0
        self._warning_count = 0
        self._peak_memory_mb = 0.0
        
        # Cache the process for psutil
        self._process = psutil.Process(os.getpid()) if PSUTIL_AVAILABLE else None
    
    def get_current_memory_mb(self) -> float:
        """
        Get current memory usage in megabytes.
        
        Uses psutil if available for accurate measurement,
        otherwise falls back to a rough estimate.
        
        Returns:
            Current memory usage in megabytes.
        """
        if PSUTIL_AVAILABLE and self._process:
            try:
                # Use RSS (Resident Set Size) for actual memory usage
                memory_info = self._process.memory_info()
                return memory_info.rss / (1024 * 1024)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        # Fallback: estimate from Python's tracked allocations
        # This is less accurate but works without psutil
        import tracemalloc
        if tracemalloc.is_tracing():
            current, _ = tracemalloc.get_traced_memory()
            return current / (1024 * 1024)
        
        # Last resort: use sys.getsizeof on known objects
        # This is very rough and likely underestimates
        return 0.0
    
    def get_memory_ratio(self) -> float:
        """
        Get current memory usage as a ratio of the limit.
        
        Returns:
            Memory usage ratio (0.0 to 1.0+).
        """
        current_mb = self.get_current_memory_mb()
        return current_mb / self.max_memory_mb if self.max_memory_mb > 0 else 0.0
    
    def check_memory(self, raise_on_exceed: bool = True) -> float:
        """
        Check current memory usage and take action if needed.
        
        This method:
        1. Gets current memory usage
        2. Updates peak memory tracking
        3. Triggers GC if at gc_threshold (Requirement 6.2)
        4. Raises MemoryError if limit exceeded (Requirement 6.3)
        
        Args:
            raise_on_exceed: If True, raise MemoryError when limit exceeded.
                            If False, just return the ratio.
        
        Returns:
            Current memory usage ratio.
        
        Raises:
            MemoryError: If memory exceeds limit and raise_on_exceed is True.
        """
        current_mb = self.get_current_memory_mb()
        ratio = current_mb / self.max_memory_mb if self.max_memory_mb > 0 else 0.0
        
        # Update peak memory tracking
        if current_mb > self._peak_memory_mb:
            self._peak_memory_mb = current_mb
        
        # Check if we need to trigger GC (Requirement 6.2)
        if ratio >= self.gc_threshold:
            self._trigger_gc()
            # Re-check after GC
            current_mb = self.get_current_memory_mb()
            ratio = current_mb / self.max_memory_mb if self.max_memory_mb > 0 else 0.0
        
        # Check if we exceed the limit (Requirement 6.3)
        if ratio > 1.0 and raise_on_exceed:
            diagnostics = self.get_diagnostics()
            raise MemoryError(
                "Memory usage exceeds configured limit",
                current_mb=current_mb,
                limit_mb=self.max_memory_mb,
                diagnostics=diagnostics
            )
        
        # Issue warning if approaching limit
        if ratio >= self.warning_threshold and ratio <= 1.0:
            self._warning_count += 1
            import warnings
            warnings.warn(
                f"Memory usage at {ratio*100:.1f}% of limit "
                f"({current_mb:.1f}MB / {self.max_memory_mb}MB)",
                MemoryWarning
            )
        
        return ratio
    
    def _trigger_gc(self) -> None:
        """
        Trigger garbage collection to free memory.
        
        Requirement 6.2: Trigger GC when memory approaches threshold.
        """
        self._gc_trigger_count += 1
        
        # Run full garbage collection
        gc.collect(generation=2)
        
        # Clear any caches that might be holding references
        gc.collect(generation=0)
        gc.collect(generation=1)
    
    def get_or_create_variable(
        self,
        pool_name: str,
        key: str,
        factory: Callable[[], T]
    ) -> T:
        """
        Get a variable from a named pool or create it using the factory.
        
        This implements variable pooling for memory optimization (Requirement 6.4).
        Variables with the same pool_name and key are reused instead of
        creating duplicates.
        
        Args:
            pool_name: Name of the variable pool.
            key: Unique identifier for the variable within the pool.
            factory: Callable that creates the variable if not found.
        
        Returns:
            The variable (existing or newly created).
        """
        if pool_name not in self._variable_pools:
            self._variable_pools[pool_name] = {}
        
        pool = self._variable_pools[pool_name]
        
        if key in pool:
            return pool[key]
        
        var = factory()
        pool[key] = var
        return var
    
    def get_pool(self, pool_name: str) -> Dict[str, Any]:
        """
        Get a variable pool by name.
        
        Args:
            pool_name: Name of the pool.
        
        Returns:
            The pool dictionary, or empty dict if not found.
        """
        return self._variable_pools.get(pool_name, {})
    
    def clear_pool(self, pool_name: str) -> int:
        """
        Clear a specific variable pool.
        
        Args:
            pool_name: Name of the pool to clear.
        
        Returns:
            Number of items cleared.
        """
        if pool_name in self._variable_pools:
            count = len(self._variable_pools[pool_name])
            self._variable_pools[pool_name].clear()
            return count
        return 0
    
    def clear_all_pools(self) -> int:
        """
        Clear all variable pools.
        
        Returns:
            Total number of items cleared.
        """
        total = sum(len(pool) for pool in self._variable_pools.values())
        self._variable_pools.clear()
        return total
    
    def cleanup(self) -> None:
        """
        Force garbage collection and clear all caches.
        
        This is useful after solving is complete to free memory.
        """
        self.clear_all_pools()
        self._trigger_gc()
    
    def get_diagnostics(self) -> Dict[str, Any]:
        """
        Get diagnostic information about memory state.
        
        Returns:
            Dictionary with memory diagnostics.
        """
        current_mb = self.get_current_memory_mb()
        
        pool_stats = {
            name: len(pool) for name, pool in self._variable_pools.items()
        }
        
        return {
            "current_memory_mb": round(current_mb, 2),
            "max_memory_mb": self.max_memory_mb,
            "peak_memory_mb": round(self._peak_memory_mb, 2),
            "memory_ratio": round(current_mb / self.max_memory_mb, 3) if self.max_memory_mb > 0 else 0,
            "gc_trigger_count": self._gc_trigger_count,
            "warning_count": self._warning_count,
            "pool_stats": pool_stats,
            "total_pooled_variables": sum(pool_stats.values()),
            "psutil_available": PSUTIL_AVAILABLE,
        }
    
    def get_pool_stats(self) -> Dict[str, int]:
        """
        Get statistics about variable pool usage.
        
        Returns:
            Dictionary mapping pool names to their sizes.
        """
        return {name: len(pool) for name, pool in self._variable_pools.items()}
    
    def __repr__(self) -> str:
        """Return string representation of MemoryManager."""
        current_mb = self.get_current_memory_mb()
        return (
            f"MemoryManager("
            f"max={self.max_memory_mb}MB, "
            f"current={current_mb:.1f}MB, "
            f"pools={len(self._variable_pools)})"
        )
