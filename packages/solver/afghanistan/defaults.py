# ==============================================================================
#
#  Default Configuration for Afghanistan Schools
#
#  Description:
#  Provides smart default settings based on common Afghan school configurations.
#  Implements "smart defaults + freedom to customize" philosophy.
#
#  Requirements: 3.1, 3.2, 3.3, 3.4
#
# ==============================================================================

from typing import Dict, Any, List


# ==============================================================================
# Default Constants
# ==============================================================================

# Afghan school week: Saturday through Thursday (Friday off)
DEFAULT_DAYS_OF_WEEK: List[str] = [
    'Saturday',
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
]

# Standard periods per day in Afghan schools
DEFAULT_PERIODS_PER_DAY: int = 7

# Complete default configuration dictionary
DEFAULT_CONFIG: Dict[str, Any] = {
    # Day configuration
    'daysOfWeek': DEFAULT_DAYS_OF_WEEK,
    'periodsPerDay': DEFAULT_PERIODS_PER_DAY,
    
    # Ramadan mode (disabled by default)
    'ramadanModeEnabled': False,
    'ramadanPeriodDuration': 35,  # minutes
    'ramadanBreakConfig': None,
    
    # Ministry validation (disabled by default)
    'enableMinistryValidation': False,
    'ministryValidationMode': 'warn',
    'customCurriculumMode': False,
    
    # Resource settings (standard by default)
    'lowResourceMode': False,
    
    # Gender separation (disabled by default)
    'enforceGenderSeparation': False,
    
    # Shift configuration (single shift by default)
    'shifts': None,
}


# ==============================================================================
# Functions
# ==============================================================================

def apply_defaults(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Apply default values to missing configuration fields.
    
    This function fills in missing config fields with Afghan school defaults.
    User-provided values are preserved (not overwritten).
    
    Args:
        data: Solver input data dictionary containing a 'config' key
        
    Returns:
        Modified data dictionary with defaults applied to missing fields
        
    Requirements: 3.1, 3.2, 3.3
    
    Example:
        >>> data = {'config': {'periodsPerDay': 8}}
        >>> result = apply_defaults(data)
        >>> result['config']['daysOfWeek']  # Default applied
        ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']
        >>> result['config']['periodsPerDay']  # User value preserved
        8
    """
    # Ensure config exists
    if 'config' not in data:
        data['config'] = {}
    
    config = data['config']
    
    # Apply day defaults if not specified
    if 'daysOfWeek' not in config or not config['daysOfWeek']:
        config['daysOfWeek'] = DEFAULT_DAYS_OF_WEEK.copy()
    
    # Apply period defaults if not specified
    if 'periodsPerDay' not in config or config['periodsPerDay'] is None:
        config['periodsPerDay'] = DEFAULT_PERIODS_PER_DAY
    
    # Apply Ramadan mode defaults
    if 'ramadanModeEnabled' not in config:
        config['ramadanModeEnabled'] = DEFAULT_CONFIG['ramadanModeEnabled']
    
    if 'ramadanPeriodDuration' not in config:
        config['ramadanPeriodDuration'] = DEFAULT_CONFIG['ramadanPeriodDuration']
    
    # Apply Ministry validation defaults
    if 'enableMinistryValidation' not in config:
        config['enableMinistryValidation'] = DEFAULT_CONFIG['enableMinistryValidation']
    
    if 'ministryValidationMode' not in config:
        config['ministryValidationMode'] = DEFAULT_CONFIG['ministryValidationMode']
    
    if 'customCurriculumMode' not in config:
        config['customCurriculumMode'] = DEFAULT_CONFIG['customCurriculumMode']
    
    # Apply resource mode defaults
    if 'lowResourceMode' not in config:
        config['lowResourceMode'] = DEFAULT_CONFIG['lowResourceMode']
    
    # Apply gender separation defaults
    if 'enforceGenderSeparation' not in config:
        config['enforceGenderSeparation'] = DEFAULT_CONFIG['enforceGenderSeparation']
    
    data['config'] = config
    return data


def validate_config(config: Dict[str, Any]) -> List[str]:
    """
    Validate configuration has required fields with valid values.
    
    Args:
        config: Configuration dictionary to validate
        
    Returns:
        List of validation error messages (empty if valid)
        
    Requirements: 3.1, 3.2, 3.3
    
    Example:
        >>> errors = validate_config({})
        >>> 'daysOfWeek is required' in errors
        True
        >>> errors = validate_config({'daysOfWeek': ['Saturday'], 'periodsPerDay': 7})
        >>> len(errors)
        0
    """
    errors: List[str] = []
    
    # Validate daysOfWeek
    if 'daysOfWeek' not in config or not config['daysOfWeek']:
        errors.append("daysOfWeek is required")
    else:
        days = config['daysOfWeek']
        if not isinstance(days, list):
            errors.append("daysOfWeek must be a list")
        elif len(days) == 0:
            errors.append("daysOfWeek cannot be empty")
        else:
            valid_days = {
                'Saturday', 'Sunday', 'Monday', 'Tuesday',
                'Wednesday', 'Thursday', 'Friday'
            }
            for day in days:
                if day not in valid_days:
                    errors.append(f"Invalid day '{day}' in daysOfWeek")
    
    # Validate periods configuration
    has_periods_per_day = 'periodsPerDay' in config and config['periodsPerDay'] is not None
    has_periods_map = 'periodsPerDayMap' in config and config['periodsPerDayMap'] is not None
    
    if not has_periods_per_day and not has_periods_map:
        errors.append("periodsPerDay or periodsPerDayMap is required")
    
    # Validate periodsPerDay range
    if has_periods_per_day:
        periods = config['periodsPerDay']
        if not isinstance(periods, int):
            errors.append("periodsPerDay must be an integer")
        elif periods < 1 or periods > 12:
            errors.append(f"periodsPerDay must be between 1 and 12, got {periods}")
    
    # Validate periodsPerDayMap if present
    if has_periods_map:
        periods_map = config['periodsPerDayMap']
        if not isinstance(periods_map, dict):
            errors.append("periodsPerDayMap must be a dictionary")
        else:
            for day, periods in periods_map.items():
                if not isinstance(periods, int):
                    errors.append(f"periodsPerDayMap[{day}] must be an integer")
                elif periods < 1 or periods > 12:
                    errors.append(
                        f"periodsPerDayMap[{day}] must be between 1 and 12, got {periods}"
                    )
    
    # Validate ministryValidationMode if present
    if 'ministryValidationMode' in config:
        mode = config['ministryValidationMode']
        valid_modes = {'warn', 'strict', 'off'}
        if mode not in valid_modes:
            errors.append(
                f"ministryValidationMode must be one of {valid_modes}, got '{mode}'"
            )
    
    # Validate ramadanPeriodDuration if present
    if 'ramadanPeriodDuration' in config:
        duration = config['ramadanPeriodDuration']
        if not isinstance(duration, int):
            errors.append("ramadanPeriodDuration must be an integer")
        elif duration < 15 or duration > 60:
            errors.append(
                f"ramadanPeriodDuration must be between 15 and 60 minutes, got {duration}"
            )
    
    return errors
