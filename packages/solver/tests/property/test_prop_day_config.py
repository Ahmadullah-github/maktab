# ==============================================================================
# Property Tests: Day Configuration Respect
#
# **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
# **Validates: Requirements 5.1, 5.2, 5.4**
#
# For any periodsPerDayMap configuration, the solver SHALL generate schedules
# that respect the per-day period limits AND allow any valid combination of
# days (Saturday through Friday).
# ==============================================================================

from typing import Any, Dict, List, Optional
import collections

import pytest
from hypothesis import given, strategies as st, settings, assume

from models.input import DayOfWeek, GlobalConfig


# ==============================================================================
# Constants
# ==============================================================================

ALL_DAYS = [
    'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
]

AFGHAN_DEFAULT_DAYS = [
    'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'
]


# ==============================================================================
# Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_days_subset(draw) -> List[str]:
    """Generate a valid non-empty subset of days."""
    days = draw(st.lists(
        st.sampled_from(ALL_DAYS),
        min_size=1,
        max_size=7,
        unique=True,
    ))
    return days


@st.composite
def periods_per_day_map_strategy(draw, days: List[str]) -> Dict[str, int]:
    """Generate a valid periodsPerDayMap for given days.
    
    Each day gets between 1 and 12 periods.
    """
    return {day: draw(st.integers(min_value=1, max_value=12)) for day in days}


@st.composite
def variable_periods_config(draw) -> Dict[str, Any]:
    """Generate a configuration with variable periods per day.
    
    This ensures at least two days have different period counts to test
    the variable periods functionality.
    """
    days = draw(valid_days_subset())
    assume(len(days) >= 2)  # Need at least 2 days for variable periods
    
    periods_map = draw(periods_per_day_map_strategy(days))
    
    # Ensure at least two days have different period counts
    periods_values = list(periods_map.values())
    assume(len(set(periods_values)) >= 2)
    
    return {
        'days': days,
        'periods_per_day_map': periods_map,
        'max_periods': max(periods_map.values()),
        'min_periods': min(periods_map.values()),
    }


@st.composite
def uniform_periods_config(draw) -> Dict[str, Any]:
    """Generate a configuration with uniform periods per day."""
    days = draw(valid_days_subset())
    periods = draw(st.integers(min_value=1, max_value=12))
    
    periods_map = {day: periods for day in days}
    
    return {
        'days': days,
        'periods_per_day_map': periods_map,
        'max_periods': periods,
        'min_periods': periods,
    }


# ==============================================================================
# Helper Functions
# ==============================================================================

def build_blocked_slots_for_periods_map(
    days: List[str],
    periods_per_day_map: Dict[str, int],
    num_classes: int = 1
) -> List[List[int]]:
    """Build blocked slots matrix respecting periodsPerDayMap.
    
    This simulates what the solver does internally to block slots
    that exceed the per-day period limit.
    
    Args:
        days: List of day names
        periods_per_day_map: Map of day name to number of periods
        num_classes: Number of classes
    
    Returns:
        Blocked slots matrix where 1 = blocked, 0 = available
    """
    num_days = len(days)
    max_periods = max(periods_per_day_map.values())
    num_slots = num_days * max_periods
    
    # Initialize all slots as available
    blocked = [[0] * num_slots for _ in range(num_classes)]
    
    # Block slots that exceed per-day limits
    day_map = {day: idx for idx, day in enumerate(days)}
    
    for day_str, periods_for_day in periods_per_day_map.items():
        if day_str not in day_map:
            continue
        d_idx = day_map[day_str]
        # Block all periods beyond the day's limit
        for p in range(periods_for_day, max_periods):
            slot = d_idx * max_periods + p
            for c_idx in range(num_classes):
                blocked[c_idx][slot] = 1
    
    return blocked


def get_available_slots_per_day(
    days: List[str],
    periods_per_day_map: Dict[str, int],
    blocked_slots: List[List[int]],
    class_idx: int = 0
) -> Dict[str, List[int]]:
    """Get available slots for each day.
    
    Args:
        days: List of day names
        periods_per_day_map: Map of day name to number of periods
        blocked_slots: Blocked slots matrix
        class_idx: Class index to check
    
    Returns:
        Dict mapping day name to list of available period indices
    """
    max_periods = max(periods_per_day_map.values())
    day_map = {day: idx for idx, day in enumerate(days)}
    
    available = {}
    for day in days:
        d_idx = day_map[day]
        day_available = []
        for p in range(max_periods):
            slot = d_idx * max_periods + p
            if blocked_slots[class_idx][slot] == 0:
                day_available.append(p)
        available[day] = day_available
    
    return available


def verify_schedule_respects_periods_map(
    schedule: List[Dict[str, Any]],
    periods_per_day_map: Dict[str, int]
) -> bool:
    """Verify that a schedule respects the periodsPerDayMap limits.
    
    Args:
        schedule: List of scheduled lessons with 'day' and 'periodIndex' keys
        periods_per_day_map: Map of day name to max periods
    
    Returns:
        True if all lessons are within their day's period limit
    """
    for lesson in schedule:
        day = lesson.get('day')
        period_idx = lesson.get('periodIndex')
        
        if day not in periods_per_day_map:
            return False
        
        max_period = periods_per_day_map[day]
        if period_idx >= max_period:
            return False
    
    return True


# ==============================================================================
# Property Tests: Day Configuration Respect
# ==============================================================================

class TestDayConfigurationRespect:
    """
    **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
    **Validates: Requirements 5.1, 5.2, 5.4**
    
    For any periodsPerDayMap configuration, the solver SHALL generate schedules
    that respect the per-day period limits AND allow any valid combination of
    days (Saturday through Friday).
    """

    @given(config=variable_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_blocked_slots_respect_variable_periods(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
        **Validates: Requirements 5.1, 5.2, 5.4**
        
        For any periodsPerDayMap with variable periods, the blocked slots matrix
        SHALL block all slots beyond each day's period limit.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        max_periods = config['max_periods']
        
        # Build blocked slots
        blocked = build_blocked_slots_for_periods_map(days, periods_map, num_classes=1)
        
        # Get available slots per day
        available = get_available_slots_per_day(days, periods_map, blocked)
        
        # Verify each day has exactly the configured number of available periods
        for day in days:
            expected_periods = periods_map[day]
            actual_available = len(available[day])
            
            assert actual_available == expected_periods, (
                f"Day {day}: expected {expected_periods} available periods, "
                f"got {actual_available}"
            )
            
            # Verify available periods are 0 to (expected_periods - 1)
            assert available[day] == list(range(expected_periods)), (
                f"Day {day}: available periods should be 0 to {expected_periods - 1}, "
                f"got {available[day]}"
            )

    @given(config=variable_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_slots_beyond_limit_are_blocked(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
        **Validates: Requirements 5.4**
        
        For any day with fewer periods than the maximum, all slots beyond
        that day's limit SHALL be blocked.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        max_periods = config['max_periods']
        
        # Build blocked slots
        blocked = build_blocked_slots_for_periods_map(days, periods_map, num_classes=1)
        
        day_map = {day: idx for idx, day in enumerate(days)}
        
        # Check each day
        for day in days:
            d_idx = day_map[day]
            day_periods = periods_map[day]
            
            # All slots from day_periods to max_periods should be blocked
            for p in range(day_periods, max_periods):
                slot = d_idx * max_periods + p
                assert blocked[0][slot] == 1, (
                    f"Day {day}, period {p}: should be blocked "
                    f"(day has {day_periods} periods, max is {max_periods})"
                )
            
            # All slots from 0 to day_periods should be available
            for p in range(day_periods):
                slot = d_idx * max_periods + p
                assert blocked[0][slot] == 0, (
                    f"Day {day}, period {p}: should be available "
                    f"(day has {day_periods} periods)"
                )

    @given(config=uniform_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_uniform_periods_all_slots_available(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
        **Validates: Requirements 5.2**
        
        When all days have the same number of periods, no slots SHALL be blocked
        due to period limits.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        max_periods = config['max_periods']
        
        # Build blocked slots
        blocked = build_blocked_slots_for_periods_map(days, periods_map, num_classes=1)
        
        # All slots should be available (no blocking due to period limits)
        num_slots = len(days) * max_periods
        for slot in range(num_slots):
            assert blocked[0][slot] == 0, (
                f"Slot {slot} should be available when all days have same periods"
            )

    @given(days=valid_days_subset())
    @settings(max_examples=100, deadline=5000)
    def test_any_day_combination_allowed(self, days: List[str]):
        """
        **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
        **Validates: Requirements 5.1**
        
        The system SHALL allow any valid combination of days from Saturday
        through Friday.
        """
        # Create a periods map for the given days
        periods_map = {day: 7 for day in days}  # 7 periods each
        
        # Build blocked slots - should work for any day combination
        blocked = build_blocked_slots_for_periods_map(days, periods_map, num_classes=1)
        
        # Verify the structure is correct
        num_slots = len(days) * 7
        assert len(blocked[0]) == num_slots
        
        # All slots should be available
        assert all(slot == 0 for slot in blocked[0])

    @given(config=variable_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_total_available_slots_matches_sum(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 8: Day Configuration Respect**
        **Validates: Requirements 5.2, 5.4**
        
        The total number of available slots SHALL equal the sum of periods
        across all days in periodsPerDayMap.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        
        # Build blocked slots
        blocked = build_blocked_slots_for_periods_map(days, periods_map, num_classes=1)
        
        # Count available slots
        available_count = sum(1 for slot in blocked[0] if slot == 0)
        
        # Expected is sum of all periods
        expected_count = sum(periods_map.values())
        
        assert available_count == expected_count, (
            f"Expected {expected_count} available slots, got {available_count}"
        )


class TestScheduleValidation:
    """
    Tests for schedule validation against periodsPerDayMap.
    """

    @given(config=variable_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_valid_schedule_passes_validation(self, config: Dict[str, Any]):
        """
        A schedule with all lessons within period limits SHALL pass validation.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        
        # Create a valid schedule (all lessons within limits)
        schedule = []
        for day in days:
            max_period = periods_map[day]
            for p in range(max_period):
                schedule.append({
                    'day': day,
                    'periodIndex': p,
                    'classId': 'CLASS_1',
                    'subjectId': 'SUBJ_1',
                })
        
        assert verify_schedule_respects_periods_map(schedule, periods_map)

    @given(config=variable_periods_config())
    @settings(max_examples=100, deadline=5000)
    def test_invalid_schedule_fails_validation(self, config: Dict[str, Any]):
        """
        A schedule with lessons beyond period limits SHALL fail validation.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        
        # Find a day with fewer than max periods
        max_periods = config['max_periods']
        day_with_fewer = None
        for day in days:
            if periods_map[day] < max_periods:
                day_with_fewer = day
                break
        
        assume(day_with_fewer is not None)
        
        # Create an invalid schedule (lesson beyond limit)
        invalid_period = periods_map[day_with_fewer]  # First invalid period
        schedule = [{
            'day': day_with_fewer,
            'periodIndex': invalid_period,
            'classId': 'CLASS_1',
            'subjectId': 'SUBJ_1',
        }]
        
        assert not verify_schedule_respects_periods_map(schedule, periods_map)


class TestGlobalConfigPeriodsPerDayMap:
    """
    Tests for GlobalConfig periodsPerDayMap validation.
    """

    @given(days=valid_days_subset())
    @settings(max_examples=50, deadline=5000)
    def test_global_config_accepts_valid_periods_map(self, days: List[str]):
        """
        GlobalConfig SHALL accept a valid periodsPerDayMap with all days covered.
        """
        # Convert string days to DayOfWeek enum
        day_enums = [DayOfWeek(day) for day in days]
        
        # Create periods map
        periods_map = {DayOfWeek(day): 7 for day in days}
        
        # This should not raise
        config = GlobalConfig(
            daysOfWeek=day_enums,
            periodsPerDay=7,
            periodsPerDayMap=periods_map,
        )
        
        assert config.periodsPerDayMap is not None
        assert len(config.periodsPerDayMap) == len(days)

    @given(config=variable_periods_config())
    @settings(max_examples=50, deadline=5000)
    def test_global_config_preserves_explicit_periods_per_day(self, config: Dict[str, Any]):
        """
        When periodsPerDayMap is provided with explicit periodsPerDay,
        the explicit value SHALL be preserved.
        """
        days = config['days']
        periods_map = config['periods_per_day_map']
        max_periods = config['max_periods']
        
        # Convert to DayOfWeek enums
        day_enums = [DayOfWeek(day) for day in days]
        periods_map_enum = {DayOfWeek(day): periods for day, periods in periods_map.items()}
        
        # When explicit periodsPerDay is provided, it should be preserved
        explicit_periods = max_periods + 1  # Use a value different from max
        global_config = GlobalConfig(
            daysOfWeek=day_enums,
            periodsPerDay=explicit_periods,
            periodsPerDayMap=periods_map_enum,
        )
        
        # Explicit periodsPerDay should be preserved
        assert global_config.periodsPerDay == explicit_periods
        # periodsPerDayMap should also be preserved
        assert global_config.periodsPerDayMap is not None

