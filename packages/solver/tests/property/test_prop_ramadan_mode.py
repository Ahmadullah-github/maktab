# ==============================================================================
# Property Tests: Ramadan Mode Configuration
#
# Tests for Ramadan mode handler behavior including period duration application
# and break configuration.
#
# Requirements: 1.1, 1.2, 1.3, 1.5
# ==============================================================================

from typing import Dict, Any, List, Optional

import pytest
from hypothesis import given, strategies as st, settings, assume

from afghanistan.ramadan_mode import (
    RamadanConfig,
    RamadanModeHandler,
)


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_period_duration(draw) -> int:
    """Generate a valid Ramadan period duration (15-60 minutes)."""
    return draw(st.integers(min_value=15, max_value=60))


@st.composite
def valid_break_config(draw) -> Optional[List[Dict[str, Any]]]:
    """Generate a valid break configuration or None."""
    if draw(st.booleans()):
        return None
    
    # Generate 1-3 break periods
    num_breaks = draw(st.integers(min_value=1, max_value=3))
    breaks = []
    for i in range(num_breaks):
        breaks.append({
            'afterPeriod': draw(st.integers(min_value=1, max_value=7)),
            'durationMinutes': draw(st.integers(min_value=5, max_value=30)),
            'name': draw(st.text(min_size=1, max_size=20, alphabet=st.characters(
                whitelist_categories=('L', 'N', 'Zs'),
                whitelist_characters=' '
            ))),
        })
    return breaks


@st.composite
def ramadan_config_enabled(draw) -> RamadanConfig:
    """Generate a RamadanConfig with enabled=True."""
    return RamadanConfig(
        enabled=True,
        period_duration=draw(valid_period_duration()),
        break_config=draw(valid_break_config()),
    )


@st.composite
def ramadan_config_disabled(draw) -> RamadanConfig:
    """Generate a RamadanConfig with enabled=False."""
    return RamadanConfig(
        enabled=False,
        period_duration=draw(valid_period_duration()),
        break_config=draw(valid_break_config()),
    )


@st.composite
def ramadan_config_any(draw) -> RamadanConfig:
    """Generate any valid RamadanConfig."""
    return RamadanConfig(
        enabled=draw(st.booleans()),
        period_duration=draw(valid_period_duration()),
        break_config=draw(valid_break_config()),
    )


@st.composite
def solver_input_data(draw) -> Dict[str, Any]:
    """Generate solver input data with config section."""
    return {
        'config': {
            'periodDurationMinutes': draw(st.integers(min_value=30, max_value=60)),
            'daysOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
            'periodsPerDay': draw(st.integers(min_value=5, max_value=10)),
        },
        'classes': [],
        'teachers': [],
        'subjects': [],
    }


@st.composite
def solver_config_dict(draw) -> Dict[str, Any]:
    """Generate a solver configuration dictionary with Ramadan settings."""
    return {
        'ramadanModeEnabled': draw(st.booleans()),
        'ramadanPeriodDuration': draw(valid_period_duration()),
        'ramadanBreakConfig': draw(valid_break_config()),
    }


# ==============================================================================
# Property Tests: Ramadan Mode Configuration
# ==============================================================================

class TestRamadanModeConfiguration:
    """
    **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
    **Validates: Requirements 1.1, 1.2, 1.3, 1.5**
    
    For any solver input with ramadanModeEnabled=true, the solver SHALL use
    ramadanPeriodDuration for period calculations AND apply ramadanBreakConfig
    if provided. When ramadanModeEnabled=false, standard configurations SHALL
    be used.
    """

    @given(config=ramadan_config_enabled(), data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_ramadan_mode_uses_ramadan_period_duration(
        self, config: RamadanConfig, data: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.1**
        
        WHEN Ramadan mode is enabled THEN the solver SHALL use the configured
        ramadanPeriodDuration instead of the standard period duration.
        """
        original_duration = data['config']['periodDurationMinutes']
        handler = RamadanModeHandler(config)
        
        result = handler.apply_to_input(data)
        
        # Verify Ramadan period duration is applied
        assert result['config']['periodDurationMinutes'] == config.period_duration
        # Verify it's different from original (unless they happen to match)
        if original_duration != config.period_duration:
            assert result['config']['periodDurationMinutes'] != original_duration

    @given(config=ramadan_config_enabled(), data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_ramadan_mode_applies_break_config_when_provided(
        self, config: RamadanConfig, data: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.2**
        
        WHEN Ramadan mode is enabled AND ramadanBreakConfig is provided THEN
        the solver SHALL apply the configured break periods.
        """
        assume(config.break_config is not None)
        
        handler = RamadanModeHandler(config)
        result = handler.apply_to_input(data)
        
        # Verify break config is applied
        assert 'breakPeriods' in result['config']
        assert result['config']['breakPeriods'] == config.break_config

    @given(data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_ramadan_mode_without_break_config_preserves_existing(
        self, data: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.2**
        
        WHEN Ramadan mode is enabled AND ramadanBreakConfig is None THEN
        the solver SHALL NOT modify existing break configuration.
        """
        config = RamadanConfig(enabled=True, period_duration=35, break_config=None)
        
        # Add existing break config to data
        existing_breaks = [{'afterPeriod': 3, 'durationMinutes': 15, 'name': 'Lunch'}]
        data['config']['breakPeriods'] = existing_breaks
        
        handler = RamadanModeHandler(config)
        result = handler.apply_to_input(data)
        
        # Verify existing break config is preserved (not overwritten with None)
        assert result['config']['breakPeriods'] == existing_breaks

    @given(config=ramadan_config_disabled(), data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_disabled_ramadan_mode_uses_standard_configuration(
        self, config: RamadanConfig, data: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.3**
        
        WHEN Ramadan mode is disabled THEN the solver SHALL use standard
        period durations and break configurations.
        """
        original_duration = data['config']['periodDurationMinutes']
        original_data = {
            'config': data['config'].copy(),
            'classes': data['classes'],
            'teachers': data['teachers'],
            'subjects': data['subjects'],
        }
        
        handler = RamadanModeHandler(config)
        result = handler.apply_to_input(data)
        
        # Verify standard configuration is preserved
        assert result['config']['periodDurationMinutes'] == original_duration
        # Verify no break config was added
        if 'breakPeriods' not in original_data['config']:
            assert 'breakPeriods' not in result['config'] or result['config'].get('breakPeriods') is None

    @given(config=ramadan_config_any())
    @settings(max_examples=100, deadline=5000)
    def test_get_metadata_returns_correct_ramadan_info(self, config: RamadanConfig):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.5**
        
        WHEN the solver receives input data THEN the solver SHALL check for
        ramadanModeEnabled flag and return appropriate metadata.
        """
        handler = RamadanModeHandler(config)
        metadata = handler.get_metadata()
        
        # Verify metadata structure
        assert 'ramadanModeEnabled' in metadata
        assert 'ramadanPeriodDuration' in metadata
        
        # Verify metadata values
        assert metadata['ramadanModeEnabled'] == config.enabled
        
        if config.enabled:
            assert metadata['ramadanPeriodDuration'] == config.period_duration
        else:
            assert metadata['ramadanPeriodDuration'] is None

    @given(solver_config=solver_config_dict())
    @settings(max_examples=100, deadline=5000)
    def test_from_solver_config_creates_correct_handler(
        self, solver_config: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.5**
        
        WHEN creating a handler from solver config dictionary THEN the handler
        SHALL correctly extract and use Ramadan settings.
        """
        handler = RamadanModeHandler.from_solver_config(solver_config)
        
        # Verify config was correctly extracted
        assert handler.config.enabled == solver_config['ramadanModeEnabled']
        assert handler.config.period_duration == solver_config['ramadanPeriodDuration']
        assert handler.config.break_config == solver_config['ramadanBreakConfig']

    @given(data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_apply_to_input_creates_config_if_missing(self, data: Dict[str, Any]):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.1**
        
        WHEN apply_to_input is called on data without config THEN the handler
        SHALL create the config section.
        """
        config = RamadanConfig(enabled=True, period_duration=35)
        handler = RamadanModeHandler(config)
        
        # Remove config from data
        data_without_config: Dict[str, Any] = {
            'classes': data['classes'],
            'teachers': data['teachers'],
            'subjects': data['subjects'],
        }
        
        result = handler.apply_to_input(data_without_config)
        
        # Verify config was created
        assert 'config' in result
        assert result['config']['periodDurationMinutes'] == 35

    @given(
        period_duration=valid_period_duration(),
        break_config=valid_break_config(),
    )
    @settings(max_examples=100, deadline=5000)
    def test_ramadan_config_validation(
        self, period_duration: int, break_config: Optional[List[Dict[str, Any]]]
    ):
        """
        **Feature: solver-afghanistan-features, Property 1: Ramadan Mode Configuration**
        **Validates: Requirements 1.1, 1.2**
        
        RamadanConfig SHALL accept valid period durations (15-60) and break configs.
        """
        # This should not raise any validation errors
        config = RamadanConfig(
            enabled=True,
            period_duration=period_duration,
            break_config=break_config,
        )
        
        assert config.period_duration >= 15
        assert config.period_duration <= 60
        assert config.enabled is True


# ==============================================================================
# Property Tests: Ramadan Mode Idempotence
# ==============================================================================

class TestRamadanModeIdempotence:
    """
    Tests for idempotent behavior of Ramadan mode handler.
    """

    @given(config=ramadan_config_enabled(), data=solver_input_data())
    @settings(max_examples=100, deadline=5000)
    def test_apply_to_input_is_idempotent(
        self, config: RamadanConfig, data: Dict[str, Any]
    ):
        """
        Applying Ramadan mode twice SHALL produce the same result as applying once.
        """
        handler = RamadanModeHandler(config)
        
        result1 = handler.apply_to_input(data.copy())
        result2 = handler.apply_to_input(result1.copy())
        
        # Verify idempotence
        assert result1['config']['periodDurationMinutes'] == result2['config']['periodDurationMinutes']
        if config.break_config is not None:
            assert result1['config'].get('breakPeriods') == result2['config'].get('breakPeriods')
