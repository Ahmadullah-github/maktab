"""Property-based tests for metrics export.

**Feature: solver-refactoring, Property 17: Metrics Counter Increment**
**Validates: Requirements 9.2**

Tests that for any constraint applied during solving, the constraints_applied_total
counter is incremented with the correct constraint type and stage labels.
"""

import pytest
from hypothesis import given, strategies as st, settings

from metrics.prometheus import (
    MetricsExporter,
    Counter,
    Gauge,
    Histogram,
    Timer,
    constraints_applied,
    solve_duration,
    solution_quality,
    memory_usage,
    clusters_solved,
)


# Strategies for generating test data
constraint_types = st.sampled_from([
    "no_class_overlap",
    "no_teacher_overlap", 
    "no_room_overlap",
    "same_day",
    "consecutive",
    "prefer_morning_difficult",
    "avoid_teacher_gaps",
    "subject_spread",
])

stages = st.sampled_from(["ESSENTIAL", "IMPORTANT", "OPTIONAL"])

# Strategy for valid metric names (alphanumeric with underscores)
metric_names = st.text(
    alphabet=st.sampled_from("abcdefghijklmnopqrstuvwxyz_"),
    min_size=1,
    max_size=30
).filter(lambda x: not x.startswith("_") and not x.endswith("_"))


class TestMetricsCounterIncrement:
    """Property 17: Metrics Counter Increment
    
    For any constraint applied during solving, the constraints_applied_total
    counter SHALL be incremented with the correct constraint type and stage labels.
    """
    
    def setup_method(self):
        """Reset metrics before each test."""
        constraints_applied.reset()
    
    # **Feature: solver-refactoring, Property 17: Metrics Counter Increment**
    @given(
        constraint_type=constraint_types,
        stage=stages,
        count=st.integers(min_value=1, max_value=100)
    )
    @settings(max_examples=100)
    def test_counter_increments_correctly(self, constraint_type: str, stage: str, count: int):
        """For any constraint type and stage, counter increments by exact amount."""
        constraints_applied.reset()
        
        # Record multiple constraint applications
        for _ in range(count):
            MetricsExporter.record_constraint_applied(constraint_type, stage)
        
        # Verify counter value
        actual = constraints_applied.get(constraint_type=constraint_type, stage=stage)
        assert actual == count, f"Expected {count}, got {actual}"
    
    # **Feature: solver-refactoring, Property 17: Metrics Counter Increment**
    @given(
        types_and_stages=st.lists(
            st.tuples(constraint_types, stages),
            min_size=1,
            max_size=50
        )
    )
    @settings(max_examples=100)
    def test_counter_tracks_labels_independently(self, types_and_stages):
        """For any set of constraint applications, each label combination is tracked independently."""
        constraints_applied.reset()
        
        # Count expected values
        expected_counts = {}
        for constraint_type, stage in types_and_stages:
            key = (constraint_type, stage)
            expected_counts[key] = expected_counts.get(key, 0) + 1
            MetricsExporter.record_constraint_applied(constraint_type, stage)
        
        # Verify each label combination
        for (constraint_type, stage), expected in expected_counts.items():
            actual = constraints_applied.get(constraint_type=constraint_type, stage=stage)
            assert actual == expected, f"For {constraint_type}/{stage}: expected {expected}, got {actual}"
    
    # **Feature: solver-refactoring, Property 17: Metrics Counter Increment**
    @given(
        constraint_type=constraint_types,
        stage=stages
    )
    @settings(max_examples=50)
    def test_counter_only_increases(self, constraint_type: str, stage: str):
        """Counter values can only increase, never decrease."""
        constraints_applied.reset()
        
        values = []
        for i in range(5):
            MetricsExporter.record_constraint_applied(constraint_type, stage)
            values.append(constraints_applied.get(constraint_type=constraint_type, stage=stage))
        
        # Verify monotonic increase
        for i in range(1, len(values)):
            assert values[i] >= values[i-1], "Counter decreased"
            assert values[i] == values[i-1] + 1, "Counter didn't increment by 1"


class TestCounterBasicProperties:
    """Test basic Counter properties."""
    
    def setup_method(self):
        """Reset for each test."""
        pass
    
    @given(
        name=metric_names,
        description=st.text(min_size=1, max_size=100)
    )
    @settings(max_examples=50)
    def test_counter_initialization(self, name: str, description: str):
        """Counter initializes with correct name and description."""
        counter = Counter(name, description)
        assert counter.name == name
        assert counter.description == description
        assert counter.get() == 0.0
    
    @given(amounts=st.lists(st.floats(min_value=0.001, max_value=1000.0), min_size=1, max_size=20))
    @settings(max_examples=50)
    def test_counter_sum_property(self, amounts):
        """Counter value equals sum of all increments."""
        counter = Counter("test_counter", "Test")
        
        for amount in amounts:
            counter.inc(amount)
        
        expected = sum(amounts)
        actual = counter.get()
        assert abs(actual - expected) < 0.001, f"Expected {expected}, got {actual}"
    
    def test_counter_rejects_negative_increment(self):
        """Counter raises error for negative increment."""
        counter = Counter("test_counter", "Test")
        
        with pytest.raises(ValueError, match="positive"):
            counter.inc(-1.0)


class TestGaugeProperties:
    """Test Gauge metric properties."""
    
    @given(value=st.floats(min_value=-1e6, max_value=1e6, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_gauge_set_get_roundtrip(self, value: float):
        """Gauge returns exactly what was set."""
        gauge = Gauge("test_gauge", "Test")
        gauge.set(value)
        assert gauge.get() == value
    
    @given(
        initial=st.floats(min_value=-1000, max_value=1000, allow_nan=False, allow_infinity=False),
        delta=st.floats(min_value=-100, max_value=100, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=50)
    def test_gauge_inc_dec_inverse(self, initial: float, delta: float):
        """Incrementing then decrementing by same amount returns to original."""
        gauge = Gauge("test_gauge", "Test")
        gauge.set(initial)
        gauge.inc(delta)
        gauge.dec(delta)
        
        assert abs(gauge.get() - initial) < 0.0001


class TestHistogramProperties:
    """Test Histogram metric properties."""
    
    @given(
        values=st.lists(
            st.floats(min_value=0.001, max_value=1000.0, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=50
        )
    )
    @settings(max_examples=50)
    def test_histogram_count_equals_observations(self, values):
        """Histogram count equals number of observations."""
        histogram = Histogram("test_histogram", "Test")
        
        for v in values:
            histogram.observe(v)
        
        assert histogram.get_count() == len(values)
    
    @given(
        values=st.lists(
            st.floats(min_value=0.001, max_value=100.0, allow_nan=False, allow_infinity=False),
            min_size=1,
            max_size=20
        )
    )
    @settings(max_examples=50)
    def test_histogram_sum_equals_total(self, values):
        """Histogram sum equals sum of all observations."""
        histogram = Histogram("test_histogram", "Test")
        
        for v in values:
            histogram.observe(v)
        
        expected = sum(values)
        actual = histogram.get_sum()
        assert abs(actual - expected) < 0.001
    
    @given(value=st.floats(min_value=0.001, max_value=100.0, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_histogram_inf_bucket_contains_all(self, value: float):
        """The +Inf bucket always contains all observations."""
        histogram = Histogram("test_histogram", "Test", buckets=(1.0, 10.0, float('inf')))
        histogram.observe(value)
        
        inf_count = histogram.get_bucket_count(float('inf'))
        assert inf_count == 1


class TestSolveDurationMetric:
    """Test solve_duration histogram metric."""
    
    def setup_method(self):
        """Reset metrics."""
        solve_duration.reset()
    
    @given(duration=st.floats(min_value=0.001, max_value=600.0, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_solve_duration_recorded(self, duration: float):
        """Solve duration is recorded correctly."""
        solve_duration.reset()
        MetricsExporter.record_solve_duration(duration)
        
        assert solve_duration.get_count() == 1
        assert abs(solve_duration.get_sum() - duration) < 0.001


class TestSolutionQualityMetric:
    """Test solution_quality gauge metric."""
    
    def setup_method(self):
        """Reset metrics."""
        solution_quality.reset()
    
    @given(score=st.floats(min_value=0.0, max_value=100.0, allow_nan=False, allow_infinity=False))
    @settings(max_examples=50)
    def test_solution_quality_recorded(self, score: float):
        """Solution quality score is recorded correctly."""
        solution_quality.reset()
        MetricsExporter.record_solution_quality(score)
        
        assert solution_quality.get() == score


class TestMetricsExporterFormat:
    """Test Prometheus format export."""
    
    def setup_method(self):
        """Reset all metrics."""
        exporter = MetricsExporter.get_instance()
        exporter.reset_all()
    
    def test_export_format_contains_help(self):
        """Export contains HELP lines for all metrics."""
        exporter = MetricsExporter.get_instance()
        output = exporter.get_metrics().decode("utf-8")
        
        assert "# HELP solver_duration_seconds" in output
        assert "# HELP solver_constraints_applied_total" in output
        assert "# HELP solver_solution_quality_score" in output
    
    def test_export_format_contains_type(self):
        """Export contains TYPE lines for all metrics."""
        exporter = MetricsExporter.get_instance()
        output = exporter.get_metrics().decode("utf-8")
        
        assert "# TYPE solver_duration_seconds histogram" in output
        assert "# TYPE solver_constraints_applied_total counter" in output
        assert "# TYPE solver_solution_quality_score gauge" in output
    
    @given(
        constraint_type=constraint_types,
        stage=stages
    )
    @settings(max_examples=20)
    def test_export_contains_labels(self, constraint_type: str, stage: str):
        """Export contains correct labels for counter metrics."""
        exporter = MetricsExporter.get_instance()
        exporter.reset_all()
        
        MetricsExporter.record_constraint_applied(constraint_type, stage)
        output = exporter.get_metrics().decode("utf-8")
        
        # Should contain the label values
        assert constraint_type in output
        assert stage in output


class TestTimerContext:
    """Test Timer context manager."""
    
    def test_timer_measures_elapsed(self):
        """Timer measures elapsed time correctly."""
        import time
        
        with Timer() as t:
            time.sleep(0.01)  # Sleep 10ms
        
        # Should be at least 10ms
        assert t.elapsed >= 0.01
        # Should be less than 100ms (reasonable upper bound)
        assert t.elapsed < 0.1
    
    def test_timer_elapsed_before_exit(self):
        """Timer can report elapsed time before context exit."""
        import time
        
        with Timer() as t:
            time.sleep(0.01)
            mid_elapsed = t.elapsed
            time.sleep(0.01)
        
        # Mid-point should be less than final
        assert mid_elapsed < t.elapsed
    
    def test_timer_not_started(self):
        """Timer returns 0 if not started."""
        t = Timer()
        assert t.elapsed == 0.0


class TestClustersSolvedMetric:
    """Test clusters_solved counter metric."""
    
    def setup_method(self):
        """Reset metrics."""
        clusters_solved.reset()
    
    @given(
        successes=st.integers(min_value=0, max_value=20),
        failures=st.integers(min_value=0, max_value=20)
    )
    @settings(max_examples=50)
    def test_clusters_tracked_by_status(self, successes: int, failures: int):
        """Cluster solves are tracked by success/failure status."""
        clusters_solved.reset()
        
        for _ in range(successes):
            MetricsExporter.record_cluster_solved(success=True)
        for _ in range(failures):
            MetricsExporter.record_cluster_solved(success=False)
        
        assert clusters_solved.get(status="success") == successes
        assert clusters_solved.get(status="failed") == failures
