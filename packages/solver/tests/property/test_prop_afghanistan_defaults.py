# ==============================================================================
# Property Tests: Afghanistan Default Configuration
#
# Tests for default settings application and override behavior.
#
# Requirements: 3.1, 3.2, 3.3, 3.4
# ==============================================================================

from typing import Dict, Any, List, Optional

import pytest
from hypothesis import given, strategies as st, settings, assume

from afghanistan.defaults import (
    DEFAULT_DAYS_OF_WEEK,
    DEFAULT_PERIODS_PER_DAY,
    DEFAULT_CONFIG,
    apply_defaults,
    validate_config,
)


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

VALID_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']


@st.composite
def valid_days_of_week(draw) -> List[str]:
    """Generate a valid non-empty list of days."""
    days = draw(st.lists(
        st.sampled_from(VALID_DAYS),
        min_size=1,
        max_size=7,
        unique=True,
    ))
    return days


@st.composite
def valid_periods_per_day(draw) -> int:
    """Generate a valid periods per day value (1-12)."""
    return draw(st.integers(min_value=1, max_value=12))


@st.composite
def valid_periods_per_day_map(draw, days: List[str]) -> Dict[str, int]:
    """Generate a valid periodsPerDayMap for given days."""
    return {day: draw(st.integers(min_value=1, max_value=12)) for day in days}


@st.composite
def partial_config(draw) -> Dict[str, Any]:
    """Generate a partial config with some fields missing."""
    config = {}
    
    # Randomly include or exclude each field
    if draw(st.booleans()):
        config['daysOfWeek'] = draw(valid_days_of_week())
    
    if draw(st.booleans()):
        config['periodsPerDay'] = draw(valid_periods_per_day())
    
    if draw(st.booleans()):
        config['ramadanModeEnabled'] = draw(st.booleans())
    
    if draw(st.booleans()):
        config['ramadanPeriodDuration'] = draw(st.integers(min_value=15, max_value=60))
    
    if draw(st.booleans()):
        config['enableMinistryValidation'] = draw(st.booleans())
    
    if draw(st.booleans()):
        config['ministryValidationMode'] = draw(st.sampled_from(['warn', 'strict', 'off']))
    
    if draw(st.booleans()):
        config['customCurriculumMode'] = draw(st.booleans())
    
    if draw(st.booleans()):
        config['lowResourceMode'] = draw(st.booleans())
    
    if draw(st.booleans()):
        config['enforceGenderSeparation'] = draw(st.booleans())
    
    return config


@st.composite
def complete_config(draw) -> Dict[str, Any]:
    """Generate a complete valid config with all fields."""
    days = draw(valid_days_of_week())
    return {
        'daysOfWeek': days,
        'periodsPerDay': draw(valid_periods_per_day()),
        'ramadanModeEnabled': draw(st.booleans()),
        'ramadanPeriodDuration': draw(st.integers(min_value=15, max_value=60)),
        'enableMinistryValidation': draw(st.booleans()),
        'ministryValidationMode': draw(st.sampled_from(['warn', 'strict', 'off'])),
        'customCurriculumMode': draw(st.booleans()),
        'lowResourceMode': draw(st.booleans()),
        'enforceGenderSeparation': draw(st.booleans()),
    }


# ==============================================================================
# Property Tests: Default Settings Application
# ==============================================================================

class TestDefaultSettingsApplication:
    """
    **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
    **Validates: Requirements 3.1, 3.2, 3.3**
    
    For any new school configuration or missing configuration fields, the system
    SHALL apply defaults: Saturday-Thursday for daysOfWeek, 7 for periodsPerDay,
    false for ramadanModeEnabled, false for enableMinistryValidation, false for
    lowResourceMode.
    """

    @given(config=partial_config())
    @settings(max_examples=100, deadline=5000)
    def test_missing_days_of_week_gets_default(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1, 3.2**
        
        When daysOfWeek is not specified, the system SHALL default to
        Saturday through Thursday.
        """
        # Remove daysOfWeek to test default application
        config.pop('daysOfWeek', None)
        
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify default days are applied
        assert result['config']['daysOfWeek'] == DEFAULT_DAYS_OF_WEEK
        assert 'Friday' not in result['config']['daysOfWeek']
        assert len(result['config']['daysOfWeek']) == 6

    @given(config=partial_config())
    @settings(max_examples=100, deadline=5000)
    def test_missing_periods_per_day_gets_default(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.3**
        
        When periodsPerDay is not specified, the system SHALL default to 7 periods.
        """
        # Remove periodsPerDay to test default application
        config.pop('periodsPerDay', None)
        
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify default periods are applied
        assert result['config']['periodsPerDay'] == DEFAULT_PERIODS_PER_DAY
        assert result['config']['periodsPerDay'] == 7

    @given(config=partial_config())
    @settings(max_examples=100, deadline=5000)
    def test_missing_ramadan_mode_gets_default(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1**
        
        When ramadanModeEnabled is not specified, the system SHALL default to false.
        """
        # Remove ramadanModeEnabled to test default application
        config.pop('ramadanModeEnabled', None)
        
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify default is applied
        assert result['config']['ramadanModeEnabled'] == False

    @given(config=partial_config())
    @settings(max_examples=100, deadline=5000)
    def test_missing_ministry_validation_gets_default(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1**
        
        When enableMinistryValidation is not specified, the system SHALL default to false.
        """
        # Remove enableMinistryValidation to test default application
        config.pop('enableMinistryValidation', None)
        
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify default is applied
        assert result['config']['enableMinistryValidation'] == False

    @given(config=partial_config())
    @settings(max_examples=100, deadline=5000)
    def test_missing_low_resource_mode_gets_default(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1**
        
        When lowResourceMode is not specified, the system SHALL default to false.
        """
        # Remove lowResourceMode to test default application
        config.pop('lowResourceMode', None)
        
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify default is applied
        assert result['config']['lowResourceMode'] == False

    @settings(max_examples=100, deadline=5000)
    @given(st.data())
    def test_empty_config_gets_all_defaults(self, data):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1, 3.2, 3.3**
        
        When config is empty, all defaults SHALL be applied.
        """
        input_data = {'config': {}}
        result = apply_defaults(input_data)
        
        # Verify all defaults are applied
        assert result['config']['daysOfWeek'] == DEFAULT_DAYS_OF_WEEK
        assert result['config']['periodsPerDay'] == DEFAULT_PERIODS_PER_DAY
        assert result['config']['ramadanModeEnabled'] == False
        assert result['config']['enableMinistryValidation'] == False
        assert result['config']['lowResourceMode'] == False
        assert result['config']['enforceGenderSeparation'] == False

    @settings(max_examples=100, deadline=5000)
    @given(st.data())
    def test_missing_config_key_creates_config(self, data):
        """
        **Feature: solver-afghanistan-features, Property 5: Default Settings Application**
        **Validates: Requirements 3.1, 3.2, 3.3**
        
        When 'config' key is missing from data, it SHALL be created with defaults.
        """
        input_data = {}  # No config key at all
        result = apply_defaults(input_data)
        
        # Verify config was created with defaults
        assert 'config' in result
        assert result['config']['daysOfWeek'] == DEFAULT_DAYS_OF_WEEK
        assert result['config']['periodsPerDay'] == DEFAULT_PERIODS_PER_DAY


# ==============================================================================
# Property Tests: Default Settings Override
# ==============================================================================

class TestDefaultSettingsOverride:
    """
    **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
    **Validates: Requirements 3.4**
    
    For any default setting, the user SHALL be able to override it with a custom
    value AND the custom value SHALL be used instead of the default.
    """

    @given(custom_days=valid_days_of_week())
    @settings(max_examples=100, deadline=5000)
    def test_custom_days_of_week_preserved(self, custom_days: List[str]):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user specifies daysOfWeek, the custom value SHALL be preserved.
        """
        data = {'config': {'daysOfWeek': custom_days}}
        result = apply_defaults(data)
        
        # Verify custom value is preserved
        assert result['config']['daysOfWeek'] == custom_days

    @given(custom_periods=valid_periods_per_day())
    @settings(max_examples=100, deadline=5000)
    def test_custom_periods_per_day_preserved(self, custom_periods: int):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user specifies periodsPerDay, the custom value SHALL be preserved.
        """
        data = {'config': {'periodsPerDay': custom_periods}}
        result = apply_defaults(data)
        
        # Verify custom value is preserved
        assert result['config']['periodsPerDay'] == custom_periods

    @given(ramadan_enabled=st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_custom_ramadan_mode_preserved(self, ramadan_enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user specifies ramadanModeEnabled, the custom value SHALL be preserved.
        """
        data = {'config': {'ramadanModeEnabled': ramadan_enabled}}
        result = apply_defaults(data)
        
        # Verify custom value is preserved
        assert result['config']['ramadanModeEnabled'] == ramadan_enabled

    @given(ministry_enabled=st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_custom_ministry_validation_preserved(self, ministry_enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user specifies enableMinistryValidation, the custom value SHALL be preserved.
        """
        data = {'config': {'enableMinistryValidation': ministry_enabled}}
        result = apply_defaults(data)
        
        # Verify custom value is preserved
        assert result['config']['enableMinistryValidation'] == ministry_enabled

    @given(low_resource=st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_custom_low_resource_mode_preserved(self, low_resource: bool):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user specifies lowResourceMode, the custom value SHALL be preserved.
        """
        data = {'config': {'lowResourceMode': low_resource}}
        result = apply_defaults(data)
        
        # Verify custom value is preserved
        assert result['config']['lowResourceMode'] == low_resource

    @given(config=complete_config())
    @settings(max_examples=100, deadline=5000)
    def test_complete_config_all_values_preserved(self, config: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 6: Default Settings Override**
        **Validates: Requirements 3.4**
        
        When user provides all config values, all custom values SHALL be preserved.
        """
        original_config = config.copy()
        data = {'config': config}
        result = apply_defaults(data)
        
        # Verify all custom values are preserved
        assert result['config']['daysOfWeek'] == original_config['daysOfWeek']
        assert result['config']['periodsPerDay'] == original_config['periodsPerDay']
        assert result['config']['ramadanModeEnabled'] == original_config['ramadanModeEnabled']
        assert result['config']['enableMinistryValidation'] == original_config['enableMinistryValidation']
        assert result['config']['lowResourceMode'] == original_config['lowResourceMode']


# ==============================================================================
# Property Tests: Configuration Validation
# ==============================================================================

class TestConfigValidation:
    """
    Tests for validate_config function.
    """

    @given(config=complete_config())
    @settings(max_examples=100, deadline=5000)
    def test_valid_config_has_no_errors(self, config: Dict[str, Any]):
        """
        A complete valid config SHALL produce no validation errors.
        """
        errors = validate_config(config)
        assert len(errors) == 0

    @settings(max_examples=100, deadline=5000)
    @given(st.data())
    def test_empty_config_has_required_field_errors(self, data):
        """
        An empty config SHALL produce errors for required fields.
        """
        errors = validate_config({})
        
        # Should have errors for missing required fields
        assert any('daysOfWeek' in e for e in errors)
        assert any('periodsPerDay' in e or 'periodsPerDayMap' in e for e in errors)

    @given(periods=st.integers(min_value=13, max_value=100))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_periods_per_day_produces_error(self, periods: int):
        """
        periodsPerDay outside valid range (1-12) SHALL produce validation error.
        """
        config = {
            'daysOfWeek': ['Saturday'],
            'periodsPerDay': periods,
        }
        errors = validate_config(config)
        
        assert any('periodsPerDay' in e and 'between 1 and 12' in e for e in errors)

    @given(invalid_mode=st.text(min_size=1).filter(lambda x: x not in ['warn', 'strict', 'off']))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_ministry_mode_produces_error(self, invalid_mode: str):
        """
        Invalid ministryValidationMode SHALL produce validation error.
        """
        config = {
            'daysOfWeek': ['Saturday'],
            'periodsPerDay': 7,
            'ministryValidationMode': invalid_mode,
        }
        errors = validate_config(config)
        
        assert any('ministryValidationMode' in e for e in errors)
