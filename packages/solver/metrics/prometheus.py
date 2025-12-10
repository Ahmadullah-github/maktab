"""Prometheus metrics export for solver monitoring.

This module provides metrics collection and export in Prometheus format
for monitoring solver performance and health.

Requirements: 9.1, 9.2, 9.3, 9.4
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum
import time
import threading


class MetricType(Enum):
    """Types of metrics supported."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"


@dataclass
class MetricValue:
    """Represents a metric value with optional labels."""
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: Optional[float] = None


class Counter:
    """A counter metric that only increases.
    
    Counters track cumulative values that only go up, like total
    number of constraints applied or jobs processed.
    """
    
    def __init__(self, name: str, description: str, label_names: Optional[List[str]] = None):
        """Initialize counter.
        
        Args:
            name: Metric name (e.g., 'solver_constraints_applied_total')
            description: Human-readable description
            label_names: Optional list of label names for this metric
        """
        self.name = name
        self.description = description
        self.label_names = label_names or []
        self._values: Dict[Tuple[str, ...], float] = {}
        self._lock = threading.Lock()
    
    def inc(self, amount: float = 1.0, **labels: str) -> None:
        """Increment the counter.
        
        Args:
            amount: Amount to increment by (must be positive)
            **labels: Label values for this observation
        """
        if amount < 0:
            raise ValueError("Counter can only be incremented by positive values")
        
        label_key = self._make_label_key(labels)
        with self._lock:
            self._values[label_key] = self._values.get(label_key, 0.0) + amount
    
    def get(self, **labels: str) -> float:
        """Get current counter value.
        
        Args:
            **labels: Label values to look up
            
        Returns:
            Current counter value (0.0 if not set)
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            return self._values.get(label_key, 0.0)
    
    def _make_label_key(self, labels: Dict[str, str]) -> Tuple[str, ...]:
        """Create a hashable key from labels."""
        return tuple(labels.get(name, "") for name in self.label_names)
    
    def collect(self) -> List[MetricValue]:
        """Collect all metric values."""
        with self._lock:
            if not self._values:
                return [MetricValue(value=0.0)]
            return [
                MetricValue(
                    value=value,
                    labels=dict(zip(self.label_names, key))
                )
                for key, value in self._values.items()
            ]
    
    def reset(self) -> None:
        """Reset counter to zero (mainly for testing)."""
        with self._lock:
            self._values.clear()


class Gauge:
    """A gauge metric that can go up and down.
    
    Gauges track values that can increase or decrease, like
    current memory usage or solution quality score.
    """
    
    def __init__(self, name: str, description: str, label_names: Optional[List[str]] = None):
        """Initialize gauge.
        
        Args:
            name: Metric name (e.g., 'solver_solution_quality_score')
            description: Human-readable description
            label_names: Optional list of label names
        """
        self.name = name
        self.description = description
        self.label_names = label_names or []
        self._values: Dict[Tuple[str, ...], float] = {}
        self._lock = threading.Lock()
    
    def set(self, value: float, **labels: str) -> None:
        """Set the gauge to a specific value.
        
        Args:
            value: Value to set
            **labels: Label values for this observation
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            self._values[label_key] = value
    
    def inc(self, amount: float = 1.0, **labels: str) -> None:
        """Increment the gauge.
        
        Args:
            amount: Amount to increment by
            **labels: Label values
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            self._values[label_key] = self._values.get(label_key, 0.0) + amount
    
    def dec(self, amount: float = 1.0, **labels: str) -> None:
        """Decrement the gauge.
        
        Args:
            amount: Amount to decrement by
            **labels: Label values
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            self._values[label_key] = self._values.get(label_key, 0.0) - amount
    
    def get(self, **labels: str) -> float:
        """Get current gauge value.
        
        Args:
            **labels: Label values to look up
            
        Returns:
            Current gauge value (0.0 if not set)
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            return self._values.get(label_key, 0.0)
    
    def _make_label_key(self, labels: Dict[str, str]) -> Tuple[str, ...]:
        """Create a hashable key from labels."""
        return tuple(labels.get(name, "") for name in self.label_names)
    
    def collect(self) -> List[MetricValue]:
        """Collect all metric values."""
        with self._lock:
            if not self._values:
                return [MetricValue(value=0.0)]
            return [
                MetricValue(
                    value=value,
                    labels=dict(zip(self.label_names, key))
                )
                for key, value in self._values.items()
            ]
    
    def reset(self) -> None:
        """Reset gauge to zero (mainly for testing)."""
        with self._lock:
            self._values.clear()


class Histogram:
    """A histogram metric for tracking distributions.
    
    Histograms track the distribution of values, like solve duration,
    using configurable buckets.
    """
    
    DEFAULT_BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, float('inf'))
    
    def __init__(
        self, 
        name: str, 
        description: str, 
        buckets: Optional[Tuple[float, ...]] = None,
        label_names: Optional[List[str]] = None
    ):
        """Initialize histogram.
        
        Args:
            name: Metric name (e.g., 'solver_duration_seconds')
            description: Human-readable description
            buckets: Bucket boundaries (must include +Inf)
            label_names: Optional list of label names
        """
        self.name = name
        self.description = description
        self.buckets = buckets or self.DEFAULT_BUCKETS
        self.label_names = label_names or []
        
        # Ensure buckets end with +Inf
        if self.buckets[-1] != float('inf'):
            self.buckets = tuple(list(self.buckets) + [float('inf')])
        
        self._bucket_counts: Dict[Tuple[str, ...], List[int]] = {}
        self._sums: Dict[Tuple[str, ...], float] = {}
        self._counts: Dict[Tuple[str, ...], int] = {}
        self._lock = threading.Lock()
    
    def observe(self, value: float, **labels: str) -> None:
        """Record an observation.
        
        Args:
            value: Value to observe
            **labels: Label values for this observation
        """
        label_key = self._make_label_key(labels)
        
        with self._lock:
            # Initialize if needed
            if label_key not in self._bucket_counts:
                self._bucket_counts[label_key] = [0] * len(self.buckets)
                self._sums[label_key] = 0.0
                self._counts[label_key] = 0
            
            # Update buckets
            for i, bucket in enumerate(self.buckets):
                if value <= bucket:
                    self._bucket_counts[label_key][i] += 1
            
            # Update sum and count
            self._sums[label_key] += value
            self._counts[label_key] += 1
    
    def get_sum(self, **labels: str) -> float:
        """Get sum of all observations.
        
        Args:
            **labels: Label values to look up
            
        Returns:
            Sum of observations (0.0 if none)
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            return self._sums.get(label_key, 0.0)
    
    def get_count(self, **labels: str) -> int:
        """Get count of all observations.
        
        Args:
            **labels: Label values to look up
            
        Returns:
            Count of observations (0 if none)
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            return self._counts.get(label_key, 0)
    
    def get_bucket_count(self, bucket_le: float, **labels: str) -> int:
        """Get count for a specific bucket.
        
        Args:
            bucket_le: Bucket upper bound (le = less than or equal)
            **labels: Label values to look up
            
        Returns:
            Cumulative count for bucket
        """
        label_key = self._make_label_key(labels)
        with self._lock:
            if label_key not in self._bucket_counts:
                return 0
            for i, bucket in enumerate(self.buckets):
                if bucket == bucket_le or (bucket_le == float('inf') and bucket == float('inf')):
                    return self._bucket_counts[label_key][i]
            return 0
    
    def _make_label_key(self, labels: Dict[str, str]) -> Tuple[str, ...]:
        """Create a hashable key from labels."""
        return tuple(labels.get(name, "") for name in self.label_names)
    
    def collect(self) -> List[MetricValue]:
        """Collect all metric values including buckets."""
        results = []
        with self._lock:
            for label_key, bucket_counts in self._bucket_counts.items():
                base_labels = dict(zip(self.label_names, label_key))
                
                # Add bucket counts
                for i, bucket in enumerate(self.buckets):
                    bucket_labels = {**base_labels, "le": str(bucket) if bucket != float('inf') else "+Inf"}
                    results.append(MetricValue(
                        value=float(bucket_counts[i]),
                        labels=bucket_labels
                    ))
                
                # Add sum
                results.append(MetricValue(
                    value=self._sums[label_key],
                    labels={**base_labels, "_type": "sum"}
                ))
                
                # Add count
                results.append(MetricValue(
                    value=float(self._counts[label_key]),
                    labels={**base_labels, "_type": "count"}
                ))
        
        return results
    
    def reset(self) -> None:
        """Reset histogram (mainly for testing)."""
        with self._lock:
            self._bucket_counts.clear()
            self._sums.clear()
            self._counts.clear()


# Global metric instances
# Requirements: 9.1 - solve_duration_seconds as Histogram
solve_duration = Histogram(
    name="solver_duration_seconds",
    description="Time spent solving timetable problems",
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0, 600.0, float('inf'))
)

# Requirements: 9.2 - constraints_applied_total as Counter
constraints_applied = Counter(
    name="solver_constraints_applied_total",
    description="Total number of constraints applied",
    label_names=["constraint_type", "stage"]
)

# Requirements: 9.3 - solution_quality_score as Gauge
solution_quality = Gauge(
    name="solver_solution_quality_score",
    description="Quality score of the solution (0-100)"
)

# Additional useful metrics
memory_usage = Gauge(
    name="solver_memory_usage_bytes",
    description="Current memory usage in bytes"
)

clusters_solved = Counter(
    name="solver_clusters_solved_total",
    description="Total number of clusters solved",
    label_names=["status"]  # success, failed
)


class MetricsExporter:
    """Exports solver metrics in Prometheus format.
    
    This class provides methods to record metrics and export them
    in the Prometheus text exposition format.
    
    Requirements: 9.1, 9.2, 9.3, 9.4
    """
    
    _instance: Optional['MetricsExporter'] = None
    _lock = threading.Lock()
    
    def __init__(self):
        """Initialize metrics exporter."""
        self._metrics: Dict[str, object] = {
            "solver_duration_seconds": solve_duration,
            "solver_constraints_applied_total": constraints_applied,
            "solver_solution_quality_score": solution_quality,
            "solver_memory_usage_bytes": memory_usage,
            "solver_clusters_solved_total": clusters_solved,
        }
    
    @classmethod
    def get_instance(cls) -> 'MetricsExporter':
        """Get singleton instance of MetricsExporter."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance
    
    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton instance (for testing)."""
        with cls._lock:
            cls._instance = None
    
    @staticmethod
    def record_solve_duration(duration_seconds: float) -> None:
        """Record solve duration.
        
        Args:
            duration_seconds: Time spent solving in seconds
            
        Requirements: 9.1
        """
        solve_duration.observe(duration_seconds)
    
    @staticmethod
    def record_constraint_applied(constraint_type: str, stage: str) -> None:
        """Record constraint application.
        
        Args:
            constraint_type: Type of constraint (e.g., 'no_class_overlap')
            stage: Stage when applied (e.g., 'ESSENTIAL', 'IMPORTANT')
            
        Requirements: 9.2
        """
        constraints_applied.inc(constraint_type=constraint_type, stage=stage)
    
    @staticmethod
    def record_solution_quality(score: float) -> None:
        """Record solution quality score.
        
        Args:
            score: Quality score (typically 0-100)
            
        Requirements: 9.3
        """
        solution_quality.set(score)
    
    @staticmethod
    def record_memory_usage(bytes_used: int) -> None:
        """Record current memory usage.
        
        Args:
            bytes_used: Memory usage in bytes
        """
        memory_usage.set(float(bytes_used))
    
    @staticmethod
    def record_cluster_solved(success: bool) -> None:
        """Record cluster solve completion.
        
        Args:
            success: Whether the cluster was solved successfully
        """
        status = "success" if success else "failed"
        clusters_solved.inc(status=status)
    
    def get_metrics(self) -> bytes:
        """Get metrics in Prometheus text exposition format.
        
        Returns:
            Metrics as bytes in Prometheus format
            
        Requirements: 9.4
        """
        lines = []
        
        for name, metric in self._metrics.items():
            # Add HELP line
            lines.append(f"# HELP {name} {metric.description}")
            
            # Add TYPE line
            if isinstance(metric, Counter):
                lines.append(f"# TYPE {name} counter")
            elif isinstance(metric, Gauge):
                lines.append(f"# TYPE {name} gauge")
            elif isinstance(metric, Histogram):
                lines.append(f"# TYPE {name} histogram")
            
            # Add metric values
            for mv in metric.collect():
                if mv.labels:
                    # Filter out internal labels
                    display_labels = {k: v for k, v in mv.labels.items() if not k.startswith("_")}
                    if display_labels:
                        label_str = ",".join(f'{k}="{v}"' for k, v in display_labels.items())
                        
                        # Handle histogram special cases
                        if isinstance(metric, Histogram):
                            if "_type" in mv.labels:
                                suffix = "_" + mv.labels["_type"]
                                lines.append(f"{name}{suffix}{{{label_str}}} {mv.value}")
                            elif "le" in mv.labels:
                                lines.append(f"{name}_bucket{{{label_str}}} {mv.value}")
                        else:
                            lines.append(f"{name}{{{label_str}}} {mv.value}")
                    else:
                        # Histogram sum/count without other labels
                        if isinstance(metric, Histogram) and "_type" in mv.labels:
                            suffix = "_" + mv.labels["_type"]
                            lines.append(f"{name}{suffix} {mv.value}")
                        else:
                            lines.append(f"{name} {mv.value}")
                else:
                    lines.append(f"{name} {mv.value}")
        
        return "\n".join(lines).encode("utf-8")
    
    def reset_all(self) -> None:
        """Reset all metrics (mainly for testing)."""
        for metric in self._metrics.values():
            metric.reset()


class Timer:
    """Context manager for timing operations.
    
    Usage:
        with Timer() as t:
            # do work
        MetricsExporter.record_solve_duration(t.elapsed)
    """
    
    def __init__(self):
        """Initialize timer."""
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
    
    def __enter__(self) -> 'Timer':
        """Start timing."""
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, *args) -> None:
        """Stop timing."""
        self.end_time = time.perf_counter()
    
    @property
    def elapsed(self) -> float:
        """Get elapsed time in seconds."""
        if self.start_time is None:
            return 0.0
        end = self.end_time if self.end_time is not None else time.perf_counter()
        return end - self.start_time
