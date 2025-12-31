# ==============================================================================
#
#  Low-Resource Mode Handler for Afghanistan Schools
#
#  Description:
#  Provides low-resource mode configuration for running the solver on older
#  computers with limited CPU and memory resources.
#
#  Requirements: 4.1, 4.2, 4.3, 4.4
#
# ==============================================================================

from typing import Dict, Any, Optional


# ==============================================================================
# Constants
# ==============================================================================

# Maximum worker threads in low-resource mode
# Requirement 4.1: Limit worker threads to 2 (instead of default 8)
MAX_WORKERS: int = 2

# Maximum memory usage in megabytes
# Requirement 4.2: Limit maximum memory usage to 512MB
MAX_MEMORY_MB: int = 512


# ==============================================================================
# Handler Class
# ==============================================================================

class LowResourceHandler:
    """
    Handler for configuring the solver for low-resource environments.
    
    This handler modifies solver parameters to reduce CPU and memory usage
    when running on older computers with limited hardware resources.
    
    Requirements: 4.1, 4.2, 4.3, 4.4
    
    Example:
        >>> handler = LowResourceHandler(enabled=True)
        >>> from ortools.sat.python import cp_model
        >>> solver = cp_model.CpSolver()
        >>> handler.configure_solver(solver)
        >>> solver.parameters.num_workers
        2
    """
    
    def __init__(self, enabled: bool = False):
        """
        Initialize the low-resource mode handler.
        
        Args:
            enabled: Whether low-resource mode is active
        """
        self.enabled = enabled
    
    def configure_solver(self, solver: Any) -> None:
        """
        Configure solver parameters for low-resource mode.
        
        When low-resource mode is enabled, this method:
        1. Limits worker threads to MAX_WORKERS (2)
        2. Limits memory usage to MAX_MEMORY_MB (512MB)
        3. Accepts the first feasible solution without extensive optimization
        4. Reduces search effort by setting linearization_level to 0
        
        When low-resource mode is disabled, the solver is not modified.
        
        Args:
            solver: OR-Tools CpSolver instance to configure
            
        Requirements: 4.1, 4.2, 4.3, 4.4
        """
        if not self.enabled:
            return
        
        # Requirement 4.1: Limit worker threads to 2
        solver.parameters.num_workers = MAX_WORKERS
        
        # Requirement 4.2: Limit maximum memory usage to 512MB
        # Note: OR-Tools uses max_memory_in_mb parameter
        solver.parameters.max_memory_in_mb = MAX_MEMORY_MB
        
        # Requirement 4.3: Accept first feasible solution without extensive optimization
        solver.parameters.stop_after_first_solution = True
        
        # Reduce search effort for faster solving on limited hardware
        solver.parameters.linearization_level = 0
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Return metadata about low-resource mode for inclusion in solver response.
        
        This metadata can be included in the solver response to inform
        the client about the low-resource mode settings that were applied.
        
        Returns:
            Dictionary containing low-resource mode metadata:
            - lowResourceMode: Whether low-resource mode was active
            - maxWorkers: The max workers used (if enabled)
            - maxMemoryMb: The max memory used (if enabled)
            
        Requirements: 4.4
        """
        return {
            'lowResourceMode': self.enabled,
            'maxWorkers': MAX_WORKERS if self.enabled else None,
            'maxMemoryMb': MAX_MEMORY_MB if self.enabled else None,
        }
    
    @classmethod
    def from_solver_config(cls, config: Dict[str, Any]) -> 'LowResourceHandler':
        """
        Create a LowResourceHandler from solver configuration dictionary.
        
        This factory method extracts low-resource settings from a
        solver configuration dictionary and creates a handler instance.
        
        Args:
            config: Solver configuration dictionary with optional key:
                - lowResourceMode: bool
                
        Returns:
            LowResourceHandler instance configured from the dictionary
            
        Example:
            >>> config = {'lowResourceMode': True}
            >>> handler = LowResourceHandler.from_solver_config(config)
            >>> handler.enabled
            True
        """
        return cls(enabled=config.get('lowResourceMode', False))
    
    def get_solver_parameters(self) -> Optional[Dict[str, Any]]:
        """
        Get the solver parameters that would be applied in low-resource mode.
        
        This method returns the parameters without requiring an actual solver
        instance, useful for testing and inspection.
        
        Returns:
            Dictionary of solver parameters if enabled, None otherwise
        """
        if not self.enabled:
            return None
        
        return {
            'num_workers': MAX_WORKERS,
            'max_memory_in_mb': MAX_MEMORY_MB,
            'stop_after_first_solution': True,
            'linearization_level': 0,
        }
