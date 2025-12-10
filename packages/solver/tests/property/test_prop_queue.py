# ==============================================================================
#
#  Property-Based Tests for Queue System
#
#  Description:
#  Property-based tests for queue result storage and retry logic using Hypothesis.
#
#  **Feature: solver-refactoring, Property 15: Queue Result Storage**
#  **Feature: solver-refactoring, Property 16: Queue Retry Logic**
#  **Validates: Requirements 8.2, 8.3**
#
# ==============================================================================

import time
import uuid
from typing import Dict, Any, Optional
from unittest.mock import Mock, MagicMock

import pytest
from hypothesis import given, strategies as st, assume, settings
from hypothesis import HealthCheck

from job_queue.job import SolverJob, SolverResult, create_job, validate_job_data
from job_queue.worker import RedisResultStore, SolverWorker
from models.output import SolverStatus, SolverOutput


# ==============================================================================
# Test Data Generators
# ==============================================================================

@st.composite
def job_id_strategy(draw):
    """Generate valid job IDs."""
    return draw(st.text(min_size=1, max_size=50, alphabet=st.characters(whitelist_categories=('Lu', 'Ll', 'Nd', 'Pc'))))


@st.composite
def solver_status_strategy(draw):
    """Generate valid solver statuses."""
    return draw(st.sampled_from([
        SolverStatus.SUCCESS,
        SolverStatus.ERROR,
        SolverStatus.TIMEOUT,
        SolverStatus.INFEASIBLE,
        SolverStatus.PARTIAL
    ]))


@st.composite
def minimal_input_data_strategy(draw):
    """Generate minimal valid input data for solver jobs."""
    periods_per_day = draw(st.integers(min_value=1, max_value=8))
    days = draw(st.lists(
        st.sampled_from(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]),
        min_size=1, max_size=7, unique=True
    ))
    
    periods_map = {day: periods_per_day for day in days}
    
    return {
        "teachers": [],
        "classes": [],
        "subjects": [],
        "rooms": [],
        "globalConfig": {
            "periodsPerDayMap": periods_map,
            "daysOfWeek": days
        }
    }


@st.composite
def solver_job_strategy(draw):
    """Generate valid SolverJob instances."""
    job_id = draw(job_id_strategy())
    input_data = draw(minimal_input_data_strategy())
    time_limit = draw(st.integers(min_value=10, max_value=3600))
    strategy = draw(st.sampled_from(["fast", "balanced", "thorough"]))
    retry_count = draw(st.integers(min_value=0, max_value=10))
    max_retries = draw(st.integers(min_value=retry_count, max_value=10))
    
    return SolverJob(
        job_id=job_id,
        input_data=input_data,
        time_limit_seconds=time_limit,
        strategy=strategy,
        retry_count=retry_count,
        max_retries=max_retries
    )


@st.composite
def solver_result_strategy(draw):
    """Generate valid SolverResult instances."""
    job_id = draw(job_id_strategy())
    status = draw(solver_status_strategy())
    processing_time = draw(st.floats(min_value=0.1, max_value=3600.0))
    retry_count = draw(st.integers(min_value=0, max_value=10))
    
    # Generate appropriate output/error based on status
    if status == SolverStatus.SUCCESS:
        output = SolverOutput(schedule=[], status=status)
        error = None
    else:
        output = None
        error = draw(st.text(min_size=1, max_size=200))
    
    return SolverResult(
        job_id=job_id,
        status=status,
        output=output,
        error=error,
        processing_time_seconds=processing_time,
        retry_count=retry_count
    )


# ==============================================================================
# Property 15: Queue Result Storage
# ==============================================================================

class MockRedisClient:
    """Mock Redis client for testing."""
    
    def __init__(self):
        self.data = {}
        self.ttl_data = {}
    
    def setex(self, key: str, ttl: int, value: str) -> None:
        """Set key with expiration."""
        self.data[key] = value
        self.ttl_data[key] = ttl
    
    def get(self, key: str) -> Optional[str]:
        """Get value by key."""
        return self.data.get(key)
    
    def delete(self, key: str) -> int:
        """Delete key."""
        if key in self.data:
            del self.data[key]
            if key in self.ttl_data:
                del self.ttl_data[key]
            return 1
        return 0


# **Feature: solver-refactoring, Property 15: Queue Result Storage**
@given(solver_result_strategy())
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_result_storage_completeness(result: SolverResult):
    """
    For any SolverResult stored in the result store, retrieving it by job_id
    SHALL return an equivalent result object.
    
    **Validates: Requirements 8.2**
    """
    # Create mock Redis client and result store
    mock_redis = MockRedisClient()
    result_store = RedisResultStore(mock_redis, key_prefix="test:", ttl_seconds=3600)
    
    # Store the result
    result_store.store_result(result.job_id, result)
    
    # Retrieve the result
    retrieved_result = result_store.get_result(result.job_id)
    
    # Verify the result was stored and retrieved correctly
    assert retrieved_result is not None, f"Result for job {result.job_id} should be retrievable"
    assert retrieved_result.job_id == result.job_id, "Job ID should match"
    assert retrieved_result.status == result.status, "Status should match"
    assert retrieved_result.retry_count == result.retry_count, "Retry count should match"
    
    # Verify processing time is preserved (with small tolerance for float precision)
    if result.processing_time_seconds is not None:
        assert retrieved_result.processing_time_seconds is not None
        assert abs(retrieved_result.processing_time_seconds - result.processing_time_seconds) < 0.001
    
    # Verify error message is preserved
    if result.error is not None:
        assert retrieved_result.error == result.error, "Error message should match"
    
    # Verify output is preserved for successful results
    if result.output is not None:
        assert retrieved_result.output is not None, "Output should be preserved"
        assert retrieved_result.output.status == result.output.status, "Output status should match"


# **Feature: solver-refactoring, Property 15: Queue Result Storage**
@given(st.lists(solver_result_strategy(), min_size=1, max_size=10))
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_result_storage_isolation(results: list[SolverResult]):
    """
    For any set of results stored with different job IDs, each result
    SHALL be retrievable independently without affecting others.
    
    **Validates: Requirements 8.2**
    """
    # Ensure all job IDs are unique
    job_ids = [r.job_id for r in results]
    assume(len(set(job_ids)) == len(job_ids))
    
    # Create mock Redis client and result store
    mock_redis = MockRedisClient()
    result_store = RedisResultStore(mock_redis, key_prefix="test:", ttl_seconds=3600)
    
    # Store all results
    for result in results:
        result_store.store_result(result.job_id, result)
    
    # Verify each result can be retrieved independently
    for original_result in results:
        retrieved_result = result_store.get_result(original_result.job_id)
        assert retrieved_result is not None, f"Result for job {original_result.job_id} should exist"
        assert retrieved_result.job_id == original_result.job_id, "Job ID should match"
        assert retrieved_result.status == original_result.status, "Status should match"


# **Feature: solver-refactoring, Property 15: Queue Result Storage**
@given(solver_result_strategy())
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_result_deletion(result: SolverResult):
    """
    For any stored result, deleting it by job_id SHALL make it no longer
    retrievable and return True. Deleting a non-existent result SHALL return False.
    
    **Validates: Requirements 8.2**
    """
    # Create mock Redis client and result store
    mock_redis = MockRedisClient()
    result_store = RedisResultStore(mock_redis, key_prefix="test:", ttl_seconds=3600)
    
    # Store the result
    result_store.store_result(result.job_id, result)
    
    # Verify it exists
    assert result_store.get_result(result.job_id) is not None
    
    # Delete the result
    deleted = result_store.delete_result(result.job_id)
    assert deleted is True, "Deleting existing result should return True"
    
    # Verify it no longer exists
    assert result_store.get_result(result.job_id) is None, "Deleted result should not be retrievable"
    
    # Try to delete again
    deleted_again = result_store.delete_result(result.job_id)
    assert deleted_again is False, "Deleting non-existent result should return False"


# ==============================================================================
# Property 16: Queue Retry Logic
# ==============================================================================

# **Feature: solver-refactoring, Property 16: Queue Retry Logic**
@given(solver_job_strategy())
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_retry_logic_increment(job: SolverJob):
    """
    For any job with retry_count < max_retries, calling increment_retry()
    SHALL return a new job with retry_count + 1.
    
    **Validates: Requirements 8.3**
    """
    assume(job.retry_count < job.max_retries)
    
    # Increment retry count
    retry_job = job.increment_retry()
    
    # Verify retry count was incremented
    assert retry_job.retry_count == job.retry_count + 1, "Retry count should be incremented"
    
    # Verify other fields remain the same
    assert retry_job.job_id == job.job_id, "Job ID should remain the same"
    assert retry_job.input_data == job.input_data, "Input data should remain the same"
    assert retry_job.max_retries == job.max_retries, "Max retries should remain the same"
    assert retry_job.strategy == job.strategy, "Strategy should remain the same"


# **Feature: solver-refactoring, Property 16: Queue Retry Logic**
@given(solver_job_strategy())
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_retry_logic_should_retry(job: SolverJob):
    """
    For any job, should_retry() SHALL return True if and only if
    retry_count < max_retries.
    
    **Validates: Requirements 8.3**
    """
    expected_should_retry = job.retry_count < job.max_retries
    actual_should_retry = job.should_retry()
    
    assert actual_should_retry == expected_should_retry, \
        f"should_retry() should return {expected_should_retry} when retry_count={job.retry_count} and max_retries={job.max_retries}"


# **Feature: solver-refactoring, Property 16: Queue Retry Logic**
@given(st.integers(min_value=0, max_value=10))
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_retry_backoff_exponential(retry_count: int):
    """
    For any retry count, get_backoff_seconds() SHALL return 2^retry_count.
    
    **Validates: Requirements 8.3**
    """
    job = SolverJob(
        job_id="test",
        input_data={"teachers": [], "classes": [], "subjects": [], "rooms": [], "globalConfig": {"periodsPerDayMap": {"Monday": 6}}},
        retry_count=retry_count
    )
    
    expected_backoff = 2 ** retry_count
    actual_backoff = job.get_backoff_seconds()
    
    assert actual_backoff == expected_backoff, \
        f"Backoff should be 2^{retry_count} = {expected_backoff}, got {actual_backoff}"


# **Feature: solver-refactoring, Property 16: Queue Retry Logic**
@given(solver_job_strategy())
@settings(suppress_health_check=[HealthCheck.function_scoped_fixture])
def test_queue_retry_logic_max_retries_boundary(job: SolverJob):
    """
    For any job at the retry boundary (retry_count == max_retries),
    should_retry() SHALL return False.
    
    **Validates: Requirements 8.3**
    """
    # Create job at retry boundary
    boundary_job = job.model_copy(update={"retry_count": job.max_retries})
    
    assert not boundary_job.should_retry(), \
        f"Job with retry_count={boundary_job.retry_count} and max_retries={boundary_job.max_retries} should not retry"
    
    # Create job just before boundary
    if job.max_retries > 0:
        before_boundary_job = job.model_copy(update={"retry_count": job.max_retries - 1})
        assert before_boundary_job.should_retry(), \
            f"Job with retry_count={before_boundary_job.retry_count} and max_retries={before_boundary_job.max_retries} should retry"


# ==============================================================================
# Integration Tests
# ==============================================================================

def test_job_validation():
    """Test job validation utility function."""
    # Valid job
    valid_job = SolverJob(
        job_id="test_job",
        input_data={
            "teachers": [],
            "classes": [],
            "subjects": [],
            "rooms": [],
            "globalConfig": {
                "periodsPerDayMap": {"Monday": 6, "Tuesday": 6}
            }
        }
    )
    
    assert validate_job_data(valid_job) is True
    
    # Invalid job - missing job_id
    with pytest.raises(ValueError, match="Job ID is required"):
        invalid_job = valid_job.model_copy(update={"job_id": ""})
        validate_job_data(invalid_job)
    
    # Invalid job - missing required field
    with pytest.raises(ValueError, match="Required field 'teachers' missing"):
        invalid_job = valid_job.model_copy()
        invalid_job.input_data = {"classes": [], "subjects": [], "rooms": [], "globalConfig": {"periodsPerDayMap": {"Monday": 6}}}
        validate_job_data(invalid_job)


def test_result_factory_methods():
    """Test SolverResult factory methods."""
    job_id = "test_job"
    
    # Test success factory
    output = SolverOutput(schedule=[], status=SolverStatus.SUCCESS)
    success_result = SolverResult.success(job_id, output, 1.5)
    
    assert success_result.job_id == job_id
    assert success_result.status == SolverStatus.SUCCESS
    assert success_result.output == output
    assert success_result.processing_time_seconds == 1.5
    assert success_result.is_success() is True
    assert success_result.is_failure() is False
    
    # Test failure factory
    error_msg = "Test error"
    failure_result = SolverResult.failure(job_id, error_msg, SolverStatus.ERROR, 2.0)
    
    assert failure_result.job_id == job_id
    assert failure_result.status == SolverStatus.ERROR
    assert failure_result.error == error_msg
    assert failure_result.processing_time_seconds == 2.0
    assert failure_result.is_success() is False
    assert failure_result.is_failure() is True