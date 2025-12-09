# ==============================================================================
#
#  Period Configuration Validation
#
#  Description:
#  Validates period configuration consistency for the timetable solver.
#  Ensures periodsPerDayMap is complete and values are within valid range.
#
# ==============================================================================

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.input import TimetableData


def validate_period_configuration(data: 'TimetableData') -> 'TimetableData':
    """
    Validate period configuration consistency.
    
    Checks that:
    - periodsPerDayMap contains entries for all enabled days
    - Period counts are within valid range (1-12)
    
    Args:
        data: TimetableData object to validate
        
    Returns:
        The validated TimetableData object
        
    Raises:
        ValueError: If period configuration is invalid
    """
    cfg = data.config
    
    if cfg.periodsPerDayMap:
        for day in cfg.daysOfWeek:
            if day not in cfg.periodsPerDayMap:
                raise ValueError(
                    f"Period Configuration Error: Missing period count for {day.value}. "
                    f"Please specify periods for all enabled days."
                )
            
            periods = cfg.periodsPerDayMap[day]
            if not 1 <= periods <= 12:
                raise ValueError(
                    f"Period Configuration Error: {day.value} has {periods} periods. "
                    f"Must be between 1 and 12."
                )
    
    return data
