# ==============================================================================
# Property Tests: Configuration System
#
# Tests for configuration round-trip, override, and environment variable handling.
#
# ==============================================================================

import os
import tempfile
from pathlib import Path
from typing import Dict, List

import pytest
import yaml
from hypothesis import given, strategies as st, settings, assume

from config.schema import (
    DecompositionConfig,
    StrategyConfig,
    MemoryConfig,
    CheckpointConfig,
    ConstraintBudgetConfig,
    SolverConfig,
)
from config.loader import ConfigLoader


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_decomposition_config(draw):
    """Generate valid DecompositionConfig respecting schema constraints."""
    # Schema constraints: threshold >= 50, large_threshold >= 100, very_large_threshold >= 150
    threshold = draw(st.integers(min_value=50, max_value=500))
    # large_threshold must be >= max(100, threshold)
    large_threshold = draw(st.integers(min_value=max(100, threshold), max_value=1000))
    # very_large_threshold must be >= max(150, large_threshold)
    very_large_threshold = draw(st.integers(min_value=max(150, large_threshold), max_value=1500))
    
    return DecompositionConfig(
        enabled=draw(st.booleans()),
        threshold=threshold,
        large_threshold=large_threshold,
        very_large_threshold=very_large_threshold,
        max_cluster_size=draw(st.integers(min_value=50, max_value=500)),
    )


@st.composite
def valid_strategy_config(draw):
    """Generate valid StrategyConfig."""
    soft_constraints = draw(st.lists(
        st.sampled_from([
            "avoid_teacher_gaps",
            "prefer_morning_difficult",
            "subject_spread",
            "balance_teacher_load",
        ]),
        max_size=4,
        unique=True,
    ))
    
    return StrategyConfig(
        workers=draw(st.integers(min_value=1, max_value=16)),
        max_time_seconds=draw(st.integers(min_value=10, max_value=3600)),
        probing_level=draw(st.integers(min_value=0, max_value=3)),
        linearization_level=draw(st.integers(min_value=0, max_value=2)),
        soft_constraints=soft_constraints,
    )



@st.composite
def valid_memory_config(draw):
    """Generate valid MemoryConfig respecting schema constraints."""
    # Schema: warning_threshold >= 0.5, gc_threshold >= 0.6
    # Also: gc_threshold > warning_threshold (logical constraint)
    warning = draw(st.floats(min_value=0.5, max_value=0.85))
    # gc must be >= max(0.6, warning + 0.01) and <= 0.99
    gc_min = max(0.6, warning + 0.01)
    gc = draw(st.floats(min_value=gc_min, max_value=0.99))
    
    return MemoryConfig(
        max_memory_mb=draw(st.integers(min_value=512, max_value=16384)),
        warning_threshold=warning,
        gc_threshold=gc,
    )


@st.composite
def valid_checkpoint_config(draw):
    """Generate valid CheckpointConfig."""
    return CheckpointConfig(
        enabled=draw(st.booleans()),
        directory=draw(st.sampled_from([
            "./checkpoints",
            "/tmp/solver_checkpoints",
            "./data/checkpoints",
        ])),
        save_interval_seconds=draw(st.integers(min_value=10, max_value=300)),
    )


@st.composite
def valid_constraint_budget_config(draw):
    """Generate valid ConstraintBudgetConfig."""
    large = draw(st.integers(min_value=100, max_value=2000))
    medium = draw(st.integers(min_value=large, max_value=5000))
    small = draw(st.integers(min_value=medium, max_value=10000))
    
    return ConstraintBudgetConfig(
        small_problem_max=small,
        medium_problem_max=medium,
        large_problem_max=large,
    )


@st.composite
def valid_solver_config(draw):
    """Generate valid SolverConfig."""
    strategies = {}
    for name in ["fast", "balanced", "thorough"]:
        strategies[name] = draw(valid_strategy_config())
    
    return SolverConfig(
        decomposition=draw(valid_decomposition_config()),
        strategies=strategies,
        constraint_budget=draw(valid_constraint_budget_config()),
        memory=draw(valid_memory_config()),
        checkpoints=draw(valid_checkpoint_config()),
        max_time_seconds=draw(st.none() | st.integers(min_value=10, max_value=3600)),
    )


# ==============================================================================
# Property Tests
# ==============================================================================

class TestConfigRoundTrip:
    """
    **Feature: solver-refactoring, Property 4: Configuration Round-Trip**
    **Validates: Requirements 3.6, 10.2**
    
    For any valid SolverConfig object, serializing to YAML and deserializing
    back SHALL produce an equivalent configuration object.
    """

    @given(config=valid_solver_config())
    @settings(max_examples=100, deadline=10000)
    def test_yaml_roundtrip(self, config: SolverConfig):
        """
        **Feature: solver-refactoring, Property 4: Configuration Round-Trip**
        **Validates: Requirements 3.6, 10.2**
        
        For any valid SolverConfig, serializing to YAML and deserializing
        back SHALL produce an equivalent configuration object.
        """
        # Serialize to YAML
        config_dict = config.model_dump()
        yaml_str = yaml.dump(config_dict)
        
        # Deserialize back
        loaded_dict = yaml.safe_load(yaml_str)
        restored = SolverConfig.model_validate(loaded_dict)
        
        # Verify equivalence - decomposition
        assert restored.decomposition.enabled == config.decomposition.enabled
        assert restored.decomposition.threshold == config.decomposition.threshold
        assert restored.decomposition.large_threshold == config.decomposition.large_threshold
        assert restored.decomposition.very_large_threshold == config.decomposition.very_large_threshold
        assert restored.decomposition.max_cluster_size == config.decomposition.max_cluster_size
        
        # Verify equivalence - memory
        assert restored.memory.max_memory_mb == config.memory.max_memory_mb
        assert abs(restored.memory.warning_threshold - config.memory.warning_threshold) < 0.001
        assert abs(restored.memory.gc_threshold - config.memory.gc_threshold) < 0.001
        
        # Verify equivalence - strategies
        assert set(restored.strategies.keys()) == set(config.strategies.keys())
        for name in config.strategies:
            orig = config.strategies[name]
            rest = restored.strategies[name]
            assert rest.workers == orig.workers
            assert rest.max_time_seconds == orig.max_time_seconds
            assert rest.probing_level == orig.probing_level
            assert rest.linearization_level == orig.linearization_level
            assert set(rest.soft_constraints) == set(orig.soft_constraints)
        
        # Verify equivalence - constraint budget
        assert restored.constraint_budget.small_problem_max == config.constraint_budget.small_problem_max
        assert restored.constraint_budget.medium_problem_max == config.constraint_budget.medium_problem_max
        assert restored.constraint_budget.large_problem_max == config.constraint_budget.large_problem_max
        
        # Verify equivalence - checkpoints
        assert restored.checkpoints.enabled == config.checkpoints.enabled
        assert restored.checkpoints.directory == config.checkpoints.directory
        assert restored.checkpoints.save_interval_seconds == config.checkpoints.save_interval_seconds
        
        # Verify equivalence - max_time_seconds
        assert restored.max_time_seconds == config.max_time_seconds


    @given(config=valid_solver_config())
    @settings(max_examples=100, deadline=10000)
    def test_file_roundtrip(self, config: SolverConfig):
        """
        For any valid SolverConfig, saving to file and loading back
        SHALL produce an equivalent configuration object.
        """
        with tempfile.NamedTemporaryFile(suffix=".yaml", delete=False) as f:
            temp_path = Path(f.name)
        
        try:
            # Save to file
            ConfigLoader.save(config, temp_path)
            
            # Load back
            restored = ConfigLoader.load(temp_path)
            
            # Verify key fields
            assert restored.decomposition.threshold == config.decomposition.threshold
            assert restored.memory.max_memory_mb == config.memory.max_memory_mb
            assert set(restored.strategies.keys()) == set(config.strategies.keys())
        finally:
            temp_path.unlink(missing_ok=True)

    @given(config=valid_decomposition_config())
    @settings(max_examples=100, deadline=5000)
    def test_decomposition_config_roundtrip(self, config: DecompositionConfig):
        """DecompositionConfig round-trip serialization."""
        yaml_str = yaml.dump(config.model_dump())
        loaded = yaml.safe_load(yaml_str)
        restored = DecompositionConfig.model_validate(loaded)
        
        assert restored.enabled == config.enabled
        assert restored.threshold == config.threshold
        assert restored.large_threshold == config.large_threshold
        assert restored.very_large_threshold == config.very_large_threshold
        assert restored.max_cluster_size == config.max_cluster_size

    @given(config=valid_strategy_config())
    @settings(max_examples=100, deadline=5000)
    def test_strategy_config_roundtrip(self, config: StrategyConfig):
        """StrategyConfig round-trip serialization."""
        yaml_str = yaml.dump(config.model_dump())
        loaded = yaml.safe_load(yaml_str)
        restored = StrategyConfig.model_validate(loaded)
        
        assert restored.workers == config.workers
        assert restored.max_time_seconds == config.max_time_seconds
        assert restored.probing_level == config.probing_level
        assert restored.linearization_level == config.linearization_level
        assert set(restored.soft_constraints) == set(config.soft_constraints)



class TestConfigOverride:
    """
    **Feature: solver-refactoring, Property 5: Configuration Override**
    **Validates: Requirements 3.2, 3.3, 3.4**
    
    For any configuration values specified in solver_config.yaml, the solver
    SHALL use those values instead of defaults.
    """

    @given(
        threshold=st.integers(min_value=50, max_value=500),
        large_threshold=st.integers(min_value=100, max_value=800),
        max_cluster_size=st.integers(min_value=50, max_value=400),
    )
    @settings(max_examples=50, deadline=10000)
    def test_decomposition_override(
        self, threshold: int, large_threshold: int, max_cluster_size: int
    ):
        """
        **Feature: solver-refactoring, Property 5: Configuration Override**
        **Validates: Requirements 3.2**
        
        Decomposition thresholds from config file SHALL override defaults.
        """
        # Ensure valid ordering
        assume(large_threshold >= threshold)
        very_large = large_threshold + 100
        
        config_dict = {
            "decomposition": {
                "threshold": threshold,
                "large_threshold": large_threshold,
                "very_large_threshold": very_large,
                "max_cluster_size": max_cluster_size,
            }
        }
        
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            yaml.dump(config_dict, f)
            temp_path = Path(f.name)
        
        try:
            loaded = ConfigLoader.load(temp_path)
            
            assert loaded.decomposition.threshold == threshold
            assert loaded.decomposition.large_threshold == large_threshold
            assert loaded.decomposition.very_large_threshold == very_large
            assert loaded.decomposition.max_cluster_size == max_cluster_size
        finally:
            temp_path.unlink(missing_ok=True)


    @given(
        workers=st.integers(min_value=1, max_value=16),
        max_time=st.integers(min_value=10, max_value=3600),
        probing=st.integers(min_value=0, max_value=3),
    )
    @settings(max_examples=50, deadline=10000)
    def test_strategy_override(self, workers: int, max_time: int, probing: int):
        """
        **Feature: solver-refactoring, Property 5: Configuration Override**
        **Validates: Requirements 3.3**
        
        Strategy parameters from config file SHALL override defaults.
        """
        config_dict = {
            "strategies": {
                "balanced": {
                    "workers": workers,
                    "max_time_seconds": max_time,
                    "probing_level": probing,
                }
            }
        }
        
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            yaml.dump(config_dict, f)
            temp_path = Path(f.name)
        
        try:
            loaded = ConfigLoader.load(temp_path)
            balanced = loaded.strategies["balanced"]
            
            assert balanced.workers == workers
            assert balanced.max_time_seconds == max_time
            assert balanced.probing_level == probing
        finally:
            temp_path.unlink(missing_ok=True)

    @given(
        small_max=st.integers(min_value=1000, max_value=10000),
        medium_max=st.integers(min_value=500, max_value=5000),
        large_max=st.integers(min_value=100, max_value=2000),
    )
    @settings(max_examples=50, deadline=10000)
    def test_constraint_budget_override(
        self, small_max: int, medium_max: int, large_max: int
    ):
        """
        **Feature: solver-refactoring, Property 5: Configuration Override**
        **Validates: Requirements 3.4**
        
        Constraint budget values from config file SHALL override defaults.
        """
        config_dict = {
            "constraint_budget": {
                "small_problem_max": small_max,
                "medium_problem_max": medium_max,
                "large_problem_max": large_max,
            }
        }
        
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            yaml.dump(config_dict, f)
            temp_path = Path(f.name)
        
        try:
            loaded = ConfigLoader.load(temp_path)
            
            assert loaded.constraint_budget.small_problem_max == small_max
            assert loaded.constraint_budget.medium_problem_max == medium_max
            assert loaded.constraint_budget.large_problem_max == large_max
        finally:
            temp_path.unlink(missing_ok=True)



class TestEnvOverride:
    """
    **Feature: solver-refactoring, Property 14: Environment Variable Override**
    **Validates: Requirements 7.4**
    
    For any environment variables SOLVER_MAX_MEMORY_MB and SOLVER_MAX_TIME_SECONDS,
    the solver SHALL use those values to configure memory and time limits.
    """

    @given(memory_mb=st.integers(min_value=512, max_value=16384))
    @settings(max_examples=50, deadline=10000)
    def test_memory_env_override(self, memory_mb: int):
        """
        **Feature: solver-refactoring, Property 14: Environment Variable Override**
        **Validates: Requirements 7.4**
        
        SOLVER_MAX_MEMORY_MB environment variable SHALL override memory config.
        """
        # Save original env
        original = os.environ.get("SOLVER_MAX_MEMORY_MB")
        
        try:
            os.environ["SOLVER_MAX_MEMORY_MB"] = str(memory_mb)
            
            # Load config (will apply env override)
            config = ConfigLoader.load()
            
            assert config.memory.max_memory_mb == memory_mb
        finally:
            # Restore original env
            if original is not None:
                os.environ["SOLVER_MAX_MEMORY_MB"] = original
            elif "SOLVER_MAX_MEMORY_MB" in os.environ:
                del os.environ["SOLVER_MAX_MEMORY_MB"]

    @given(time_seconds=st.integers(min_value=10, max_value=3600))
    @settings(max_examples=50, deadline=10000)
    def test_time_env_override(self, time_seconds: int):
        """
        **Feature: solver-refactoring, Property 14: Environment Variable Override**
        **Validates: Requirements 7.4**
        
        SOLVER_MAX_TIME_SECONDS environment variable SHALL override time config.
        """
        # Save original env
        original = os.environ.get("SOLVER_MAX_TIME_SECONDS")
        
        try:
            os.environ["SOLVER_MAX_TIME_SECONDS"] = str(time_seconds)
            
            # Load config (will apply env override)
            config = ConfigLoader.load()
            
            assert config.max_time_seconds == time_seconds
        finally:
            # Restore original env
            if original is not None:
                os.environ["SOLVER_MAX_TIME_SECONDS"] = original
            elif "SOLVER_MAX_TIME_SECONDS" in os.environ:
                del os.environ["SOLVER_MAX_TIME_SECONDS"]


    @given(
        memory_mb=st.integers(min_value=512, max_value=16384),
        time_seconds=st.integers(min_value=10, max_value=3600),
    )
    @settings(max_examples=50, deadline=10000)
    def test_both_env_overrides(self, memory_mb: int, time_seconds: int):
        """
        Both SOLVER_MAX_MEMORY_MB and SOLVER_MAX_TIME_SECONDS SHALL be applied.
        """
        # Save original env
        orig_memory = os.environ.get("SOLVER_MAX_MEMORY_MB")
        orig_time = os.environ.get("SOLVER_MAX_TIME_SECONDS")
        
        try:
            os.environ["SOLVER_MAX_MEMORY_MB"] = str(memory_mb)
            os.environ["SOLVER_MAX_TIME_SECONDS"] = str(time_seconds)
            
            config = ConfigLoader.load()
            
            assert config.memory.max_memory_mb == memory_mb
            assert config.max_time_seconds == time_seconds
        finally:
            # Restore original env
            if orig_memory is not None:
                os.environ["SOLVER_MAX_MEMORY_MB"] = orig_memory
            elif "SOLVER_MAX_MEMORY_MB" in os.environ:
                del os.environ["SOLVER_MAX_MEMORY_MB"]
            
            if orig_time is not None:
                os.environ["SOLVER_MAX_TIME_SECONDS"] = orig_time
            elif "SOLVER_MAX_TIME_SECONDS" in os.environ:
                del os.environ["SOLVER_MAX_TIME_SECONDS"]

    def test_env_override_with_file_config(self):
        """
        Environment variables SHALL override file-based configuration.
        """
        # Create config file with specific values
        config_dict = {
            "memory": {"max_memory_mb": 2048},
            "max_time_seconds": 300,
        }
        
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".yaml", delete=False
        ) as f:
            yaml.dump(config_dict, f)
            temp_path = Path(f.name)
        
        # Save original env
        orig_memory = os.environ.get("SOLVER_MAX_MEMORY_MB")
        orig_time = os.environ.get("SOLVER_MAX_TIME_SECONDS")
        
        try:
            # Set env vars to different values
            os.environ["SOLVER_MAX_MEMORY_MB"] = "8192"
            os.environ["SOLVER_MAX_TIME_SECONDS"] = "600"
            
            config = ConfigLoader.load(temp_path)
            
            # Env vars should override file values
            assert config.memory.max_memory_mb == 8192
            assert config.max_time_seconds == 600
        finally:
            temp_path.unlink(missing_ok=True)
            
            if orig_memory is not None:
                os.environ["SOLVER_MAX_MEMORY_MB"] = orig_memory
            elif "SOLVER_MAX_MEMORY_MB" in os.environ:
                del os.environ["SOLVER_MAX_MEMORY_MB"]
            
            if orig_time is not None:
                os.environ["SOLVER_MAX_TIME_SECONDS"] = orig_time
            elif "SOLVER_MAX_TIME_SECONDS" in os.environ:
                del os.environ["SOLVER_MAX_TIME_SECONDS"]
