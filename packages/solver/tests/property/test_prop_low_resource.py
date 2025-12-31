# ==============================================================================
# Property Tests: Low-Resource Mode Parameters
#
# Tests for low-resource mode handler behavior including worker thread limits,
# memory limits, and first-solution acceptance.
#
# Requirements: 4.1, 4.2, 4.3, 4.4
# ==============================================================================

from typing import Dict, Any
from unittest.mock import MagicMock

import pytest
from hypothesis import given, strategies as st, settings

from afghanistan.low_resource import (
    MAX_WORKERS,
    MAX_MEMORY_MB,
    LowResourceHandler,
)


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def solver_config_dict(draw) -> Dict[str, Any]:
    """Generate a solver configuration dictionary with low-resource settings."""
    return {
        'lowResourceMode': draw(st.booleans()),
        'daysOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'],
        'periodsPerDay': draw(st.integers(min_value=5, max_value=10)),
    }


# ==============================================================================
# Property Tests: Low-Resource Mode Parameters
# ==============================================================================

class TestLowResourceModeParameters:
    """
    **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
    **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    
    For any solver execution with lowResourceMode=true, the solver SHALL use
    max 2 worker threads, max 512MB memory, and accept the first feasible
    solution. When lowResourceMode=false, standard resource allocation SHALL
    be used.
    """

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_low_resource_mode_limits_workers(self, enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.1**
        
        WHEN low-resource mode is enabled THEN the solver SHALL limit worker
        threads to 2 (instead of default 8).
        """
        handler = LowResourceHandler(enabled=enabled)
        
        # Use get_solver_parameters to verify behavior without mocking
        params = handler.get_solver_parameters()
        
        if enabled:
            # Verify worker threads are limited to MAX_WORKERS (2)
            assert params is not None
            assert params['num_workers'] == MAX_WORKERS
            assert MAX_WORKERS == 2  # Verify constant value
        else:
            # Verify no parameters are returned when disabled
            assert params is None

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_low_resource_mode_limits_memory(self, enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.2**
        
        WHEN low-resource mode is enabled THEN the solver SHALL limit maximum
        memory usage to 512MB.
        """
        handler = LowResourceHandler(enabled=enabled)
        
        # Use get_solver_parameters to verify behavior without mocking
        params = handler.get_solver_parameters()
        
        if enabled:
            # Verify memory is limited to MAX_MEMORY_MB (512)
            assert params is not None
            assert params['max_memory_in_mb'] == MAX_MEMORY_MB
            assert MAX_MEMORY_MB == 512  # Verify constant value
        else:
            # Verify no parameters are returned when disabled
            assert params is None

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_enabled_low_resource_mode_accepts_first_solution(self, enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.3**
        
        WHEN low-resource mode is enabled THEN the solver SHALL accept the
        first feasible solution without extensive optimization.
        """
        handler = LowResourceHandler(enabled=enabled)
        
        # Use get_solver_parameters to verify behavior without mocking
        params = handler.get_solver_parameters()
        
        if enabled:
            # Verify first solution acceptance is enabled
            assert params is not None
            assert params['stop_after_first_solution'] is True
        else:
            # Verify no parameters are returned when disabled
            assert params is None

    def test_disabled_low_resource_mode_uses_standard_allocation(self):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.4**
        
        WHEN low-resource mode is disabled THEN the solver SHALL use standard
        resource allocation based on the selected strategy.
        """
        handler = LowResourceHandler(enabled=False)
        
        # Use get_solver_parameters to verify behavior
        params = handler.get_solver_parameters()
        
        # Verify no parameters are returned when disabled
        assert params is None
        
        # Also verify metadata reflects disabled state
        metadata = handler.get_metadata()
        assert metadata['lowResourceMode'] is False
        assert metadata['maxWorkers'] is None
        assert metadata['maxMemoryMb'] is None

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_get_metadata_returns_correct_info(self, enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
        
        The handler SHALL return correct metadata about low-resource mode
        settings for inclusion in solver response.
        """
        handler = LowResourceHandler(enabled=enabled)
        metadata = handler.get_metadata()
        
        # Verify metadata structure
        assert 'lowResourceMode' in metadata
        assert 'maxWorkers' in metadata
        assert 'maxMemoryMb' in metadata
        
        # Verify metadata values
        assert metadata['lowResourceMode'] == enabled
        
        if enabled:
            assert metadata['maxWorkers'] == MAX_WORKERS
            assert metadata['maxMemoryMb'] == MAX_MEMORY_MB
        else:
            assert metadata['maxWorkers'] is None
            assert metadata['maxMemoryMb'] is None

    @given(solver_config=solver_config_dict())
    @settings(max_examples=100, deadline=5000)
    def test_from_solver_config_creates_correct_handler(
        self, solver_config: Dict[str, Any]
    ):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
        
        WHEN creating a handler from solver config dictionary THEN the handler
        SHALL correctly extract and use low-resource settings.
        """
        handler = LowResourceHandler.from_solver_config(solver_config)
        
        # Verify config was correctly extracted
        assert handler.enabled == solver_config['lowResourceMode']

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_get_solver_parameters_returns_correct_values(self, enabled: bool):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
        
        The handler SHALL return correct solver parameters when queried.
        """
        handler = LowResourceHandler(enabled=enabled)
        params = handler.get_solver_parameters()
        
        if enabled:
            assert params is not None
            assert params['num_workers'] == MAX_WORKERS
            assert params['max_memory_in_mb'] == MAX_MEMORY_MB
            assert params['stop_after_first_solution'] is True
            assert params['linearization_level'] == 0
        else:
            assert params is None


# ==============================================================================
# Property Tests: Low-Resource Mode Constants
# ==============================================================================

class TestLowResourceModeConstants:
    """
    Tests for low-resource mode constant values.
    """

    def test_max_workers_constant_value(self):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.1**
        
        MAX_WORKERS constant SHALL be 2.
        """
        assert MAX_WORKERS == 2

    def test_max_memory_mb_constant_value(self):
        """
        **Feature: solver-afghanistan-features, Property 7: Low-Resource Mode Parameters**
        **Validates: Requirements 4.2**
        
        MAX_MEMORY_MB constant SHALL be 512.
        """
        assert MAX_MEMORY_MB == 512


# ==============================================================================
# Property Tests: Low-Resource Mode Idempotence
# ==============================================================================

class TestLowResourceModeIdempotence:
    """
    Tests for idempotent behavior of low-resource mode handler.
    """

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_configure_solver_is_idempotent(self, enabled: bool):
        """
        Configuring solver twice SHALL produce the same result as configuring once.
        """
        handler = LowResourceHandler(enabled=enabled)
        
        # Create a mock solver with parameters
        mock_solver = MagicMock()
        mock_solver.parameters = MagicMock()
        
        # Configure twice
        handler.configure_solver(mock_solver)
        handler.configure_solver(mock_solver)
        
        if enabled:
            # Verify parameters are set to the same values
            assert mock_solver.parameters.num_workers == MAX_WORKERS
            assert mock_solver.parameters.max_memory_in_mb == MAX_MEMORY_MB
            assert mock_solver.parameters.stop_after_first_solution is True

    @given(st.booleans())
    @settings(max_examples=100, deadline=5000)
    def test_get_metadata_is_consistent(self, enabled: bool):
        """
        Getting metadata multiple times SHALL return consistent results.
        """
        handler = LowResourceHandler(enabled=enabled)
        
        metadata1 = handler.get_metadata()
        metadata2 = handler.get_metadata()
        
        assert metadata1 == metadata2
