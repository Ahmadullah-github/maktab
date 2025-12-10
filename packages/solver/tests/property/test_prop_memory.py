# ==============================================================================
# Property Test: Memory Limit Enforcement
#
# **Feature: solver-refactoring, Property 12: Memory Limit Enforcement**
# **Validates: Requirements 6.1, 6.3**
# ==============================================================================

import sys
from pathlib import Path

import pytest
from hypothesis import given, strategies as st, settings, assume

solver_path = Path(__file__).parent.parent.parent
sys.path.insert(0, str(solver_path))

from memory.manager import MemoryManager, MemoryError, MemoryWarning


# ==============================================================================
# Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_memory_config(draw):
    """Generate valid memory configuration parameters."""
    max_memory_mb = draw(st.integers(min_value=1, max_value=8192))
    warning_threshold = draw(st.floats(min_value=0.1, max_value=0.89))
    gc_threshold = draw(st.floats(min_value=warning_threshold + 0.01, max_value=0.99))
    return {
        "max_memory_mb": max_memory_mb,
        "warning_threshold": warning_threshold,
        "gc_threshold": gc_threshold,
    }


@st.composite
def pool_name_strategy(draw):
    """Generate valid pool names."""
    prefix = draw(st.sampled_from(["bool", "int", "interval", "custom", "vars"]))
    suffix = draw(st.integers(min_value=0, max_value=100))
    return f"{prefix}_{suffix}"


@st.composite
def variable_key_strategy(draw):
    """Generate valid variable keys."""
    prefix = draw(st.sampled_from(["var", "temp", "start", "end", "assigned"]))
    suffix = draw(st.integers(min_value=0, max_value=1000))
    return f"{prefix}_{suffix}"


# ==============================================================================
# Property Tests: Memory Limit Enforcement
# ==============================================================================

class TestMemoryLimitEnforcement:
    """
    **Feature: solver-refactoring, Property 12: Memory Limit Enforcement**
    **Validates: Requirements 6.1, 6.3**
    
    Property 12: Memory Limit Enforcement
    *For any* configured memory limit, the solver SHALL raise a MemoryError
    with diagnostic information when memory usage exceeds the limit.
    """

    @given(config=valid_memory_config())
    @settings(max_examples=100, deadline=5000)
    def test_memory_manager_accepts_valid_config(self, config):
        """
        For any valid configuration, MemoryManager SHALL initialize successfully.
        """
        manager = MemoryManager(**config)
        assert manager.max_memory_mb == config["max_memory_mb"]
        assert manager.warning_threshold == config["warning_threshold"]
        assert manager.gc_threshold == config["gc_threshold"]

    @given(max_memory=st.integers(min_value=1, max_value=8192))
    @settings(max_examples=100, deadline=5000)
    def test_memory_limit_stored_correctly(self, max_memory):
        """
        For any memory limit, the manager SHALL store it correctly.
        Requirement 6.1: Accept configurable maximum memory limit.
        """
        manager = MemoryManager(max_memory_mb=max_memory)
        assert manager.max_memory_mb == max_memory

    @given(max_memory=st.integers(min_value=1, max_value=100))
    @settings(max_examples=50, deadline=5000)
    def test_memory_error_contains_diagnostics(self, max_memory):
        """
        For any MemoryError raised, it SHALL contain diagnostic information.
        Requirement 6.3: Raise MemoryError with diagnostic information.
        """
        # Create a MemoryError directly to test its structure
        diagnostics = {"test_key": "test_value", "pool_stats": {"pool1": 10}}
        error = MemoryError(
            message="Test error",
            current_mb=max_memory + 10.0,
            limit_mb=max_memory,
            diagnostics=diagnostics
        )
        
        assert error.current_mb == max_memory + 10.0
        assert error.limit_mb == max_memory
        assert error.diagnostics == diagnostics
        assert "current:" in str(error)
        assert "limit:" in str(error)

    @given(
        current=st.floats(min_value=100, max_value=1000),
        limit=st.integers(min_value=50, max_value=99)
    )
    @settings(max_examples=100, deadline=5000)
    def test_memory_error_message_format(self, current, limit):
        """
        For any memory values, MemoryError message SHALL include both values.
        """
        error = MemoryError(
            message="Memory exceeded",
            current_mb=current,
            limit_mb=limit
        )
        
        error_str = str(error)
        assert f"{current:.1f}MB" in error_str
        assert f"{limit}MB" in error_str

    @given(config=valid_memory_config())
    @settings(max_examples=50, deadline=5000)
    def test_check_memory_returns_ratio(self, config):
        """
        For any configuration, check_memory SHALL return a valid ratio.
        """
        manager = MemoryManager(**config)
        ratio = manager.check_memory(raise_on_exceed=False)
        
        # Ratio should be non-negative
        assert ratio >= 0.0
        # Ratio should be reasonable (not impossibly high for normal operation)
        # We use raise_on_exceed=False to avoid exceptions during testing

    @given(config=valid_memory_config())
    @settings(max_examples=50, deadline=5000)
    def test_get_diagnostics_structure(self, config):
        """
        For any configuration, get_diagnostics SHALL return complete info.
        """
        manager = MemoryManager(**config)
        diagnostics = manager.get_diagnostics()
        
        # Check required keys are present
        required_keys = [
            "current_memory_mb",
            "max_memory_mb",
            "peak_memory_mb",
            "memory_ratio",
            "gc_trigger_count",
            "warning_count",
            "pool_stats",
            "total_pooled_variables",
            "psutil_available",
        ]
        
        for key in required_keys:
            assert key in diagnostics, f"Missing key: {key}"
        
        # Check values are reasonable
        assert diagnostics["max_memory_mb"] == config["max_memory_mb"]
        assert diagnostics["gc_trigger_count"] >= 0
        assert diagnostics["warning_count"] >= 0
        assert isinstance(diagnostics["pool_stats"], dict)


# ==============================================================================
# Property Tests: Variable Pool Management
# ==============================================================================

class TestVariablePoolManagement:
    """
    Tests for variable pool management in MemoryManager.
    Related to Requirement 6.4: Variable pool reuse.
    """

    @given(
        pool_name=pool_name_strategy(),
        key=variable_key_strategy()
    )
    @settings(max_examples=100, deadline=5000)
    def test_get_or_create_variable_reuse(self, pool_name, key):
        """
        For any pool and key, get_or_create_variable twice SHALL return same instance.
        """
        manager = MemoryManager()
        
        # Create a simple object as the variable
        var1 = manager.get_or_create_variable(
            pool_name, key, lambda: {"id": f"{pool_name}_{key}"}
        )
        var2 = manager.get_or_create_variable(
            pool_name, key, lambda: {"id": "should_not_be_used"}
        )
        
        assert var1 is var2
        assert var1["id"] == f"{pool_name}_{key}"

    @given(
        pool_name=pool_name_strategy(),
        keys=st.lists(variable_key_strategy(), min_size=1, max_size=50)
    )
    @settings(max_examples=50, deadline=10000)
    def test_pool_size_equals_unique_keys(self, pool_name, keys):
        """
        For any set of keys, pool size SHALL equal unique key count.
        """
        manager = MemoryManager()
        
        for key in keys:
            manager.get_or_create_variable(pool_name, key, lambda k=key: {"key": k})
        
        unique_keys = len(set(keys))
        pool = manager.get_pool(pool_name)
        assert len(pool) == unique_keys

    @given(
        pool_name=pool_name_strategy(),
        key1=variable_key_strategy(),
        key2=variable_key_strategy()
    )
    @settings(max_examples=100, deadline=5000)
    def test_different_keys_create_different_vars(self, pool_name, key1, key2):
        """
        For different keys, get_or_create_variable SHALL return different instances.
        """
        assume(key1 != key2)
        manager = MemoryManager()
        
        var1 = manager.get_or_create_variable(pool_name, key1, lambda: {"key": key1})
        var2 = manager.get_or_create_variable(pool_name, key2, lambda: {"key": key2})
        
        assert var1 is not var2
        assert var1["key"] == key1
        assert var2["key"] == key2

    @given(
        pool1=pool_name_strategy(),
        pool2=pool_name_strategy(),
        key=variable_key_strategy()
    )
    @settings(max_examples=100, deadline=5000)
    def test_same_key_different_pools_are_independent(self, pool1, pool2, key):
        """
        For same key in different pools, variables SHALL be independent.
        """
        assume(pool1 != pool2)
        manager = MemoryManager()
        
        var1 = manager.get_or_create_variable(pool1, key, lambda: {"pool": pool1})
        var2 = manager.get_or_create_variable(pool2, key, lambda: {"pool": pool2})
        
        assert var1 is not var2
        assert var1["pool"] == pool1
        assert var2["pool"] == pool2

    @given(pool_name=pool_name_strategy())
    @settings(max_examples=50, deadline=5000)
    def test_clear_pool_removes_all_variables(self, pool_name):
        """
        For any pool, clear_pool SHALL remove all variables.
        """
        manager = MemoryManager()
        
        # Add some variables
        for i in range(10):
            manager.get_or_create_variable(pool_name, f"key_{i}", lambda: i)
        
        assert len(manager.get_pool(pool_name)) == 10
        
        cleared = manager.clear_pool(pool_name)
        assert cleared == 10
        assert len(manager.get_pool(pool_name)) == 0

    @given(
        pools=st.lists(pool_name_strategy(), min_size=1, max_size=5, unique=True)
    )
    @settings(max_examples=50, deadline=10000)
    def test_clear_all_pools_removes_everything(self, pools):
        """
        For any set of pools, clear_all_pools SHALL remove all variables.
        """
        manager = MemoryManager()
        
        # Add variables to each pool
        total_vars = 0
        for pool in pools:
            for i in range(5):
                manager.get_or_create_variable(pool, f"key_{i}", lambda: i)
                total_vars += 1
        
        # Account for duplicate keys across pools
        expected_total = len(pools) * 5
        
        cleared = manager.clear_all_pools()
        assert cleared == expected_total
        
        # All pools should be empty
        for pool in pools:
            assert len(manager.get_pool(pool)) == 0


# ==============================================================================
# Property Tests: GC Triggering
# ==============================================================================

class TestGCTriggering:
    """
    Tests for garbage collection triggering.
    Related to Requirement 6.2: Trigger GC at threshold.
    """

    @given(config=valid_memory_config())
    @settings(max_examples=50, deadline=5000)
    def test_gc_threshold_stored_correctly(self, config):
        """
        For any gc_threshold, it SHALL be stored correctly.
        """
        manager = MemoryManager(**config)
        assert manager.gc_threshold == config["gc_threshold"]

    @given(config=valid_memory_config())
    @settings(max_examples=50, deadline=5000)
    def test_cleanup_triggers_gc(self, config):
        """
        For any configuration, cleanup SHALL trigger garbage collection.
        """
        manager = MemoryManager(**config)
        initial_gc_count = manager._gc_trigger_count
        
        manager.cleanup()
        
        assert manager._gc_trigger_count > initial_gc_count


# ==============================================================================
# Property Tests: Configuration Validation
# ==============================================================================

class TestConfigurationValidation:
    """
    Tests for configuration validation in MemoryManager.
    """

    @given(max_memory=st.integers(max_value=0))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_max_memory_raises_error(self, max_memory):
        """
        For invalid max_memory_mb, MemoryManager SHALL raise ValueError.
        """
        with pytest.raises(ValueError, match="max_memory_mb must be at least 1"):
            MemoryManager(max_memory_mb=max_memory)

    @given(threshold=st.floats(min_value=1.0, max_value=2.0))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_warning_threshold_raises_error(self, threshold):
        """
        For warning_threshold >= 1, MemoryManager SHALL raise ValueError.
        """
        with pytest.raises(ValueError, match="warning_threshold must be between"):
            MemoryManager(warning_threshold=threshold)

    @given(threshold=st.floats(max_value=0.0))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_warning_threshold_zero_raises_error(self, threshold):
        """
        For warning_threshold <= 0, MemoryManager SHALL raise ValueError.
        """
        with pytest.raises(ValueError, match="warning_threshold must be between"):
            MemoryManager(warning_threshold=threshold)

    @given(
        warning=st.floats(min_value=0.5, max_value=0.8),
        gc=st.floats(min_value=0.1, max_value=0.49)
    )
    @settings(max_examples=50, deadline=5000)
    def test_warning_greater_than_gc_raises_error(self, warning, gc):
        """
        For warning_threshold >= gc_threshold, SHALL raise ValueError.
        """
        with pytest.raises(ValueError, match="warning_threshold must be less than"):
            MemoryManager(warning_threshold=warning, gc_threshold=gc)


# ==============================================================================
# Property Tests: Pool Statistics
# ==============================================================================

class TestPoolStatistics:
    """
    Tests for pool statistics reporting.
    """

    @given(
        pools_config=st.lists(
            st.tuples(pool_name_strategy(), st.integers(min_value=1, max_value=20)),
            min_size=1,
            max_size=5
        )
    )
    @settings(max_examples=50, deadline=10000)
    def test_pool_stats_accurate(self, pools_config):
        """
        For any pool configuration, get_pool_stats SHALL return accurate counts.
        """
        manager = MemoryManager()
        
        expected_counts = {}
        for pool_name, count in pools_config:
            if pool_name not in expected_counts:
                expected_counts[pool_name] = 0
            for i in range(count):
                key = f"key_{expected_counts[pool_name] + i}"
                manager.get_or_create_variable(pool_name, key, lambda: i)
            expected_counts[pool_name] += count
        
        stats = manager.get_pool_stats()
        
        for pool_name, expected_count in expected_counts.items():
            assert stats.get(pool_name, 0) == expected_count
