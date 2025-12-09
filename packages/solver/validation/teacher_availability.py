# ==============================================================================
#
#  Teacher Availability Validation
#
#  Description:
#  Validates teacher availability structure matches period configuration.
#  Ensures each teacher has availability defined for all days with correct
#  number of periods.
#
# ==============================================================================

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from models.input import TimetableData, DayOfWeek


def validate_teacher_availability_structure(data: 'TimetableData') -> 'TimetableData':
    """
    Validate teacher availability matches period configuration.
    
    Checks that:
    - Each teacher has availability defined for all enabled days
    - The number of periods in availability matches the expected periods for each day
    
    Args:
        data: TimetableData object to validate
        
    Returns:
        The validated TimetableData object
        
    Raises:
        ValueError: If teacher availability structure is invalid
    """
    from models.input import DayOfWeek
    
    cfg = data.config
    
    for teacher in data.teachers:
        for day in cfg.daysOfWeek:
            day_str = day.value if isinstance(day, DayOfWeek) else str(day)
            
            if day_str not in teacher.availability:
                raise ValueError(
                    f"Teacher Availability Error: Teacher '{teacher.fullName}' (ID: {teacher.id}) "
                    f"is missing availability for {day_str}."
                )
            
            expected_periods = cfg.periodsPerDayMap.get(day, cfg.periodsPerDay)
            actual_periods = len(teacher.availability[day_str])
            
            if actual_periods != expected_periods:
                raise ValueError(
                    f"Teacher Availability Error: Teacher '{teacher.fullName}' "
                    f"has {actual_periods} periods for {day_str} "
                    f"but configuration expects {expected_periods}. "
                    f"Please update teacher availability to match period configuration."
                )
    
    return data
