# ==============================================================================
# Property Tests: Constraint Registry
#
# **Feature: solver-refactoring, Property 2: Constraint Registry Completeness**
# **Validates: Requirements 2.2, 2.4**
#
# **Feature: solver-refactoring, Property 3: Constraint Categorization Correctness**
# **Validates: Requirements 2.3**
# ==============================================================================

from typing import Any, Dict, List, Optional

import pytest
from hypothesis import given, strategies as st, settings
from ortools.sat.python import cp_model

from constraints import (
    Constraint,
    HardConstraint,
    SoftConstraint,
    ConstraintRegistry,
    ConstraintStage,
    ConstraintPriority,
)


# ==============================================================================
# Mock Constraints for Testing
# ==============================================================================

class MockHardConstraint(HardConstraint):
    """Mock hard constraint for testing."""
    
    def __init__(self, name: str):
        super().__init__(name)
        self.apply_called = False
        self.apply_call_count = 0
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> None:
        self.apply_called = True
        self.apply_call_count += 1
        return None


class MockSoftConstraint(SoftConstraint):
    """Mock soft constraint for testing."""
    
    def __init__(self, name: str, weight: int = 1):
        super().__init__(name, weight)
        self.apply_called = False
        self.apply_call_count = 0
    
    def apply(self, model: cp_model.CpModel, context: Dict[str, Any]) -> List[Any]:
        self.apply_called = True
        self.apply_call_count += 1
        return [model.NewIntVar(0, 100, f"penalty_{self.name}")]


# ==============================================================================
# Hypothesis Strategies
# ==============================================================================

@st.composite
def constraint_name_strategy(draw):
    """Generate valid constraint names."""
    prefix = draw(st.sampled_from(["no_overlap", "same_day", "consecutive", "morning", "gaps", "spread"]))
    suffix = draw(st.integers(min_value=1, max_value=999))
    return f"{prefix}_{suffix}"


@st.composite
def hard_constraint_strategy(draw):
    """Generate a mock hard constraint."""
    name = draw(constraint_name_strategy())
    return MockHardConstraint(name)


@st.composite
def soft_constraint_strategy(draw):
    """Generate a mock soft constraint."""
    name = draw(constraint_name_strategy())
    weight = draw(st.integers(min_value=1, max_value=100))
    return MockSoftConstraint(name, weight)


@st.composite
def constraint_strategy(draw):
    """Generate either a hard or soft constraint."""
    is_hard = draw(st.booleans())
    if is_hard:
        return draw(hard_constraint_strategy())
    else:
        return draw(soft_constraint_strategy())


@st.composite
def constraint_stage_strategy(draw):
    """Generate a valid ConstraintStage."""
    return draw(st.sampled_from(list(ConstraintStage)))


@st.composite
def unique_constraints_strategy(draw, min_size=1, max_size=10):
    """Generate a list of constraints with unique names."""
    num_constraints = draw(st.integers(min_value=min_size, max_value=max_size))
    constraints = []
    
    for i in range(num_constraints):
        is_hard = draw(st.booleans())
        # Use index to ensure unique names
        name = f"constraint_{i}"
        
        if is_hard:
            constraints.append(MockHardConstraint(name))
        else:
            weight = draw(st.integers(min_value=1, max_value=100))
            constraints.append(MockSoftConstraint(name, weight))
    
    return constraints


# ==============================================================================
# Helper Functions
# ==============================================================================

def get_fresh_registry():
    """Get a fresh registry instance by resetting the singleton."""
    ConstraintRegistry.reset_instance()
    return ConstraintRegistry.get_instance()


def create_mock_model():
    """Create a mock CP-SAT model."""
    return cp_model.CpModel()


def create_mock_context():
    """Create a mock solver context."""
    return {"data": {}, "requests": []}


# ==============================================================================
# Fixtures (for non-property tests only)
# ==============================================================================

@pytest.fixture(autouse=True)
def reset_registry():
    """Reset the singleton registry before and after each test."""
    ConstraintRegistry.reset_instance()
    yield
    ConstraintRegistry.reset_instance()


# ==============================================================================
# Property Tests
# ==============================================================================

class TestConstraintRegistryCompleteness:
    """
    **Feature: solver-refactoring, Property 2: Constraint Registry Completeness**
    **Validates: Requirements 2.2, 2.4**
    
    For any set of constraints registered with the ConstraintRegistry,
    calling apply_all(model, context, stage) SHALL invoke the apply()
    method on every enabled constraint matching that stage.
    """

    @given(constraints=unique_constraints_strategy(min_size=1, max_size=5))
    @settings(max_examples=100, deadline=10000)
    def test_apply_all_invokes_all_enabled_constraints(self, constraints):
        """
        For any set of registered constraints, apply_all SHALL invoke
        apply() on every enabled constraint for the specified stage.
        """
        registry = get_fresh_registry()
        model = create_mock_model()
        context = create_mock_context()
        
        # Register all constraints at ESSENTIAL stage
        for constraint in constraints:
            registry.register(constraint, ConstraintStage.ESSENTIAL)
        
        # Apply all constraints
        registry.apply_all(model, context, ConstraintStage.ESSENTIAL)
        
        # Verify all enabled constraints were applied
        for constraint in constraints:
            if constraint.enabled:
                assert constraint.apply_called, f"Constraint {constraint.name} was not applied"
                assert constraint.applied, f"Constraint {constraint.name} applied flag not set"

    @given(
        constraints=unique_constraints_strategy(min_size=2, max_size=5),
        stage=constraint_stage_strategy()
    )
    @settings(max_examples=100, deadline=10000)
    def test_apply_all_only_applies_matching_stage(self, constraints, stage):
        """
        apply_all SHALL only invoke constraints registered at the specified stage.
        """
        registry = get_fresh_registry()
        model = create_mock_model()
        context = create_mock_context()
        
        # Register constraints at different stages
        for i, constraint in enumerate(constraints):
            # Alternate between stages
            constraint_stage = list(ConstraintStage)[i % len(ConstraintStage)]
            registry.register(constraint, constraint_stage)
        
        # Apply only the specified stage
        registry.apply_all(model, context, stage)
        
        # Verify only matching stage constraints were applied
        for i, constraint in enumerate(constraints):
            constraint_stage = list(ConstraintStage)[i % len(ConstraintStage)]
            if constraint_stage == stage and constraint.enabled:
                assert constraint.apply_called, f"Constraint {constraint.name} at stage {stage} was not applied"
            elif constraint_stage != stage:
                assert not constraint.apply_called, f"Constraint {constraint.name} at wrong stage was applied"

    @given(constraints=unique_constraints_strategy(min_size=1, max_size=5))
    @settings(max_examples=50, deadline=10000)
    def test_disabled_constraints_not_applied(self, constraints):
        """
        Disabled constraints SHALL NOT have apply() invoked.
        """
        registry = get_fresh_registry()
        model = create_mock_model()
        context = create_mock_context()
        
        # Disable half the constraints
        for i, constraint in enumerate(constraints):
            if i % 2 == 0:
                constraint.disable()
            registry.register(constraint, ConstraintStage.ESSENTIAL)
        
        # Apply all
        registry.apply_all(model, context, ConstraintStage.ESSENTIAL)
        
        # Verify disabled constraints were not applied
        for i, constraint in enumerate(constraints):
            if i % 2 == 0:  # Disabled
                assert not constraint.apply_called, f"Disabled constraint {constraint.name} was applied"
            else:  # Enabled
                assert constraint.apply_called, f"Enabled constraint {constraint.name} was not applied"

    @given(constraints=unique_constraints_strategy(min_size=1, max_size=5))
    @settings(max_examples=50, deadline=10000)
    def test_get_constraints_returns_all_registered(self, constraints):
        """
        get_constraints() SHALL return all registered constraints.
        """
        registry = get_fresh_registry()
        
        # Register constraints at various stages
        for i, constraint in enumerate(constraints):
            stage = list(ConstraintStage)[i % len(ConstraintStage)]
            registry.register(constraint, stage)
        
        # Get all constraints
        all_constraints = registry.get_constraints()
        
        # Verify all registered constraints are returned
        registered_names = {c.name for c in constraints}
        returned_names = {c.name for c in all_constraints}
        assert registered_names == returned_names

    @given(
        constraints=unique_constraints_strategy(min_size=1, max_size=5),
        stage=constraint_stage_strategy()
    )
    @settings(max_examples=50, deadline=10000)
    def test_get_constraints_by_stage(self, constraints, stage):
        """
        get_constraints(stage) SHALL return only constraints for that stage.
        """
        registry = get_fresh_registry()
        
        # Register constraints at various stages
        expected_at_stage = []
        for i, constraint in enumerate(constraints):
            constraint_stage = list(ConstraintStage)[i % len(ConstraintStage)]
            registry.register(constraint, constraint_stage)
            if constraint_stage == stage:
                expected_at_stage.append(constraint.name)
        
        # Get constraints for specific stage
        stage_constraints = registry.get_constraints(stage)
        
        # Verify only matching constraints returned
        returned_names = {c.name for c in stage_constraints}
        assert returned_names == set(expected_at_stage)


class TestConstraintCategorizationCorrectness:
    """
    **Feature: solver-refactoring, Property 3: Constraint Categorization Correctness**
    **Validates: Requirements 2.3**
    
    For any constraint registered with the ConstraintRegistry, the constraint
    SHALL be categorized by its is_hard property (hard/soft) and priority
    property (CRITICAL/HIGH/MEDIUM/LOW).
    """

    @given(constraint=hard_constraint_strategy())
    @settings(max_examples=100, deadline=5000)
    def test_hard_constraints_categorized_correctly(self, constraint):
        """
        Hard constraints SHALL have is_hard=True.
        """
        registry = get_fresh_registry()
        registry.register(constraint)
        
        # Verify categorization
        assert constraint.is_hard is True
        assert constraint.weight == 0  # Hard constraints have weight 0

    @given(constraint=soft_constraint_strategy())
    @settings(max_examples=100, deadline=5000)
    def test_soft_constraints_categorized_correctly(self, constraint):
        """
        Soft constraints SHALL have is_hard=False and a positive weight.
        """
        registry = get_fresh_registry()
        registry.register(constraint)
        
        # Verify categorization
        assert constraint.is_hard is False
        assert constraint.weight > 0

    @given(constraint=hard_constraint_strategy())
    @settings(max_examples=50, deadline=5000)
    def test_hard_constraints_default_to_essential_stage(self, constraint):
        """
        Hard constraints registered without explicit stage SHALL default to ESSENTIAL.
        """
        registry = get_fresh_registry()
        registry.register(constraint)  # No stage specified
        
        # Verify it's in ESSENTIAL stage
        essential_constraints = registry.get_constraints(ConstraintStage.ESSENTIAL)
        assert any(c.name == constraint.name for c in essential_constraints)

    @given(constraint=soft_constraint_strategy())
    @settings(max_examples=50, deadline=5000)
    def test_soft_constraints_default_to_important_stage(self, constraint):
        """
        Soft constraints registered without explicit stage SHALL default to IMPORTANT.
        """
        registry = get_fresh_registry()
        registry.register(constraint)  # No stage specified
        
        # Verify it's in IMPORTANT stage
        important_constraints = registry.get_constraints(ConstraintStage.IMPORTANT)
        assert any(c.name == constraint.name for c in important_constraints)

    @given(
        constraint=constraint_strategy(),
        stage=constraint_stage_strategy()
    )
    @settings(max_examples=100, deadline=5000)
    def test_explicit_stage_overrides_default(self, constraint, stage):
        """
        Explicit stage parameter SHALL override the default stage assignment.
        """
        registry = get_fresh_registry()
        registry.register(constraint, stage)
        
        # Verify it's in the specified stage
        stage_constraints = registry.get_constraints(stage)
        assert any(c.name == constraint.name for c in stage_constraints)
        
        # Verify it's not in other stages
        for other_stage in ConstraintStage:
            if other_stage != stage:
                other_constraints = registry.get_constraints(other_stage)
                assert not any(c.name == constraint.name for c in other_constraints)

    @given(constraints=unique_constraints_strategy(min_size=2, max_size=5))
    @settings(max_examples=50, deadline=10000)
    def test_mixed_constraints_categorized_correctly(self, constraints):
        """
        A mix of hard and soft constraints SHALL each be categorized correctly.
        """
        registry = get_fresh_registry()
        
        for constraint in constraints:
            registry.register(constraint)
        
        # Verify each constraint's categorization
        for constraint in constraints:
            retrieved = registry.get_constraint_by_name(constraint.name)
            assert retrieved is not None
            assert retrieved.is_hard == constraint.is_hard
            assert retrieved.weight == constraint.weight


class TestConstraintRegistrySingleton:
    """Tests for singleton pattern behavior."""

    def test_singleton_returns_same_instance(self):
        """get_instance() SHALL return the same instance."""
        ConstraintRegistry.reset_instance()
        instance1 = ConstraintRegistry.get_instance()
        instance2 = ConstraintRegistry.get_instance()
        assert instance1 is instance2

    def test_reset_creates_new_instance(self):
        """reset_instance() SHALL create a new instance on next get_instance()."""
        ConstraintRegistry.reset_instance()
        instance1 = ConstraintRegistry.get_instance()
        instance1.register(MockHardConstraint("test"))
        
        ConstraintRegistry.reset_instance()
        instance2 = ConstraintRegistry.get_instance()
        
        assert instance1 is not instance2
        assert len(instance2) == 0


class TestConstraintRegistryOperations:
    """Tests for registry operations."""

    @given(constraint=constraint_strategy())
    @settings(max_examples=50, deadline=5000)
    def test_unregister_removes_constraint(self, constraint):
        """unregister() SHALL remove the constraint from the registry."""
        registry = get_fresh_registry()
        registry.register(constraint)
        
        assert len(registry) == 1
        
        result = registry.unregister(constraint.name)
        
        assert result is True
        assert len(registry) == 0
        assert registry.get_constraint_by_name(constraint.name) is None

    def test_unregister_nonexistent_returns_false(self):
        """unregister() SHALL return False for non-existent constraints."""
        registry = get_fresh_registry()
        result = registry.unregister("nonexistent")
        assert result is False

    @given(constraint=constraint_strategy())
    @settings(max_examples=50, deadline=5000)
    def test_duplicate_registration_raises_error(self, constraint):
        """Registering a constraint with the same name SHALL raise ValueError."""
        registry = get_fresh_registry()
        registry.register(constraint)
        
        # Create another constraint with the same name
        duplicate = MockHardConstraint(constraint.name)
        
        with pytest.raises(ValueError, match="already registered"):
            registry.register(duplicate)

    @given(constraints=unique_constraints_strategy(min_size=1, max_size=5))
    @settings(max_examples=50, deadline=5000)
    def test_clear_removes_all_constraints(self, constraints):
        """clear() SHALL remove all registered constraints."""
        registry = get_fresh_registry()
        
        for constraint in constraints:
            registry.register(constraint)
        
        assert len(registry) == len(constraints)
        
        registry.clear()
        
        assert len(registry) == 0
        for constraint in constraints:
            assert registry.get_constraint_by_name(constraint.name) is None
