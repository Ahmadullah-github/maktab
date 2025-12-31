# ==============================================================================
#
#  Ramadan Mode Handler for Afghanistan Schools
#
#  Description:
#  Provides Ramadan-specific scheduling adjustments including shorter periods
#  and adjusted break times during the month of Ramadan.
#
#  Requirements: 1.1, 1.2, 1.3, 1.5
#
# ==============================================================================

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ==============================================================================
# Configuration Model
# ==============================================================================

class RamadanConfig(BaseModel):
    """
    Configuration for Ramadan mode scheduling adjustments.
    
    Attributes:
        enabled: Whether Ramadan mode is active
        period_duration: Duration of each period in minutes (default 35)
        break_config: Optional list of break period configurations
        
    Requirements: 1.1, 1.2, 1.3
    """
    enabled: bool = Field(default=False, description="Whether Ramadan mode is active")
    period_duration: int = Field(
        default=35,
        ge=15,
        le=60,
        description="Duration of each period in minutes during Ramadan"
    )
    break_config: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Optional break period configurations for Ramadan"
    )


# ==============================================================================
# Handler Class
# ==============================================================================

class RamadanModeHandler:
    """
    Handler for applying Ramadan mode settings to solver input.
    
    This handler modifies solver input data to use Ramadan-specific
    configurations when enabled, including shorter period durations
    and adjusted break times.
    
    Requirements: 1.1, 1.2, 1.3, 1.5
    
    Example:
        >>> config = RamadanConfig(enabled=True, period_duration=35)
        >>> handler = RamadanModeHandler(config)
        >>> data = {'config': {'periodDurationMinutes': 45}}
        >>> result = handler.apply_to_input(data)
        >>> result['config']['periodDurationMinutes']
        35
    """
    
    def __init__(self, config: RamadanConfig):
        """
        Initialize the Ramadan mode handler.
        
        Args:
            config: RamadanConfig instance with Ramadan mode settings
        """
        self.config = config
    
    def apply_to_input(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Apply Ramadan mode settings to solver input data.
        
        When Ramadan mode is enabled, this method:
        1. Overrides the period duration with ramadanPeriodDuration
        2. Applies the ramadanBreakConfig if provided
        
        When Ramadan mode is disabled, the data is returned unchanged.
        
        Args:
            data: Solver input data dictionary containing a 'config' key
            
        Returns:
            Modified data dictionary with Ramadan settings applied (if enabled)
            
        Requirements: 1.1, 1.2, 1.3, 1.5
        """
        if not self.config.enabled:
            return data
        
        # Ensure config exists
        if 'config' not in data:
            data['config'] = {}
        
        # Override period duration with Ramadan-specific duration
        # Requirement 1.1: Use ramadanPeriodDuration instead of standard duration
        data['config']['periodDurationMinutes'] = self.config.period_duration
        
        # Apply break configuration if provided
        # Requirement 1.2: Apply ramadanBreakConfig for break periods
        if self.config.break_config is not None:
            data['config']['breakPeriods'] = self.config.break_config
        
        return data
    
    def get_metadata(self) -> Dict[str, Any]:
        """
        Return metadata about Ramadan mode for inclusion in solver response.
        
        This metadata can be included in the solver response to inform
        the client about the Ramadan mode settings that were applied.
        
        Returns:
            Dictionary containing Ramadan mode metadata:
            - ramadanModeEnabled: Whether Ramadan mode was active
            - ramadanPeriodDuration: The period duration used (if enabled)
            
        Requirements: 1.5
        """
        return {
            'ramadanModeEnabled': self.config.enabled,
            'ramadanPeriodDuration': (
                self.config.period_duration if self.config.enabled else None
            )
        }
    
    @classmethod
    def from_solver_config(cls, config: Dict[str, Any]) -> 'RamadanModeHandler':
        """
        Create a RamadanModeHandler from solver configuration dictionary.
        
        This factory method extracts Ramadan-related settings from a
        solver configuration dictionary and creates a handler instance.
        
        Args:
            config: Solver configuration dictionary with optional keys:
                - ramadanModeEnabled: bool
                - ramadanPeriodDuration: int
                - ramadanBreakConfig: list or None
                
        Returns:
            RamadanModeHandler instance configured from the dictionary
            
        Example:
            >>> config = {'ramadanModeEnabled': True, 'ramadanPeriodDuration': 30}
            >>> handler = RamadanModeHandler.from_solver_config(config)
            >>> handler.config.enabled
            True
            >>> handler.config.period_duration
            30
        """
        ramadan_config = RamadanConfig(
            enabled=config.get('ramadanModeEnabled', False),
            period_duration=config.get('ramadanPeriodDuration', 35),
            break_config=config.get('ramadanBreakConfig')
        )
        return cls(ramadan_config)
