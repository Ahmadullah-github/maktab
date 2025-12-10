# ==============================================================================
# Property Tests: Checkpoint/Resume Capability
#
# Tests for checkpoint saving, loading, validation, and resume correctness.
#
# **Feature: solver-refactoring, Properties 9, 10, 11**
# **Requirements: 5.1, 5.2, 5.3, 5.5**
#
# ==============================================================================

import os
import tempfile
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List

import pytest
from hypothesis import given, strategies as st, settings, assume, HealthCheck

from parallel.checkpoint import (
    Checkpoint,
    CheckpointManager,
    CheckpointError,
    CheckpointCorruptError,
    CheckpointValidationError,
    CHECKPOINT_SCHEMA_VERSION,
)


# ==============================================================================
# Helper Context Manager
# ==============================================================================

@contextmanager
def temp_checkpoint_manager():
    """Context manager that creates a temporary checkpoint directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield CheckpointManager(checkpoint_dir=tmpdir)


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_job_id(draw):
    """Generate valid job IDs (alphanumeric with dashes/underscores)."""
    prefix = draw(st.sampled_from(["job", "solve", "task", "run"]))
    suffix = draw(st.integers(min_value=1, max_value=99999))
    return f"{prefix}_{suffix}"


@st.composite
def valid_input_data(draw):
    """Generate valid input data dictionaries."""
    num_classes = draw(st.integers(min_value=1, max_value=5))
    num_teachers = draw(st.integers(min_value=1, max_value=5))
    
    return {
        "config": {
            "daysOfWeek": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
            "periodsPerDay": draw(st.integers(min_value=4, max_value=8)),
        },
        "classes": [
            {"id": f"class_{i}", "name": f"Class {i}", "gradeLevel": (i % 12) + 1}
            for i in range(num_classes)
        ],
        "teachers": [
            {"id": f"teacher_{i}", "name": f"Teacher {i}"}
            for i in range(num_teachers)
        ],
        "subjects": [
            {"id": "MATH", "name": "Mathematics"},
            {"id": "SCIENCE", "name": "Science"},
        ],
        "rooms": [
            {"id": "room_1", "name": "Room 1", "capacity": 30},
        ],
    }


@st.composite
def valid_partial_solution(draw):
    """Generate valid partial solution (list of scheduled lessons)."""
    num_lessons = draw(st.integers(min_value=0, max_value=20))
    
    return [
        {
            "classId": f"class_{i % 5}",
            "subjectId": draw(st.sampled_from(["MATH", "SCIENCE", "ENGLISH"])),
            "teacherId": f"teacher_{i % 3}",
            "roomId": f"room_{i % 2}",
            "day": i % 5,
            "period": i % 6,
        }
        for i in range(num_lessons)
    ]


@st.composite
def valid_cluster_lists(draw):
    """Generate valid completed and pending cluster lists."""
    total_clusters = draw(st.integers(min_value=1, max_value=10))
    num_completed = draw(st.integers(min_value=0, max_value=total_clusters))
    
    all_clusters = list(range(total_clusters))
    completed = all_clusters[:num_completed]
    pending = all_clusters[num_completed:]
    
    return completed, pending


@st.composite
def valid_checkpoint_data(draw):
    """Generate all data needed to create a valid checkpoint."""
    job_id = draw(valid_job_id())
    input_data = draw(valid_input_data())
    partial_solution = draw(valid_partial_solution())
    completed, pending = draw(valid_cluster_lists())
    metadata = draw(st.fixed_dictionaries({
        "strategy": st.sampled_from(["fast", "balanced", "thorough"]),
    }))
    
    return {
        "job_id": job_id,
        "input_data": input_data,
        "partial_solution": partial_solution,
        "completed_clusters": completed,
        "pending_clusters": pending,
        "metadata": metadata,
    }


# ==============================================================================
# Test Fixtures
# ==============================================================================

@pytest.fixture
def temp_checkpoint_dir():
    """Create a temporary directory for checkpoint tests."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def checkpoint_manager(temp_checkpoint_dir):
    """Create a CheckpointManager with a temporary directory."""
    return CheckpointManager(checkpoint_dir=temp_checkpoint_dir)


# ==============================================================================
# Property Tests: Checkpoint Completeness (Property 9)
# ==============================================================================

class TestCheckpointCompleteness:
    """
    **Feature: solver-refactoring, Property 9: Checkpoint Completeness**
    **Validates: Requirements 5.1, 5.2**
    
    For any checkpoint saved during solving, the checkpoint SHALL contain:
    input data, partial solution, list of completed cluster IDs, and list
    of pending cluster IDs.
    """

    @given(data=valid_checkpoint_data())
    @settings(max_examples=100, deadline=10000)
    def test_checkpoint_contains_all_required_fields(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 9: Checkpoint Completeness**
        **Validates: Requirements 5.1, 5.2**
        
        For any valid checkpoint data, the saved checkpoint SHALL contain
        all required fields: input_data, partial_solution, completed_clusters,
        and pending_clusters.
        """
        with temp_checkpoint_manager() as manager:
            # Save checkpoint
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
                metadata=data["metadata"],
            )
            
            # Load and verify
            checkpoint = manager.load(data["job_id"])
            
            assert checkpoint is not None, "Checkpoint should be loadable"
            
            # Verify all required fields are present
            assert checkpoint.job_id == data["job_id"]
            assert checkpoint.input_data == data["input_data"]
            assert checkpoint.partial_solution == data["partial_solution"]
            assert checkpoint.completed_clusters == data["completed_clusters"]
            assert checkpoint.pending_clusters == data["pending_clusters"]
            assert checkpoint.metadata == data["metadata"]
            
            # Verify schema version is set
            assert checkpoint.schema_version == CHECKPOINT_SCHEMA_VERSION
            
            # Verify timestamps are set
            assert checkpoint.created_at > 0
            assert checkpoint.updated_at > 0
            assert checkpoint.updated_at >= checkpoint.created_at
            
            # Verify input hash is computed
            assert checkpoint.input_hash is not None
            assert len(checkpoint.input_hash) == 64  # SHA-256 hex length

    @given(
        input_data=valid_input_data(),
        partial_solution=valid_partial_solution(),
    )
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_preserves_input_data_exactly(
        self,
        input_data: Dict[str, Any],
        partial_solution: List[Dict],
    ):
        """
        **Feature: solver-refactoring, Property 9: Checkpoint Completeness**
        **Validates: Requirements 5.2**
        
        For any input data, the checkpoint SHALL preserve the exact input
        data without modification.
        """
        with temp_checkpoint_manager() as manager:
            job_id = "test_preserve_input"
            
            manager.save(
                job_id=job_id,
                input_data=input_data,
                partial_solution=partial_solution,
                completed_clusters=[0, 1],
                pending_clusters=[2, 3],
            )
            
            checkpoint = manager.load(job_id)
            
            # Deep equality check
            assert checkpoint.input_data == input_data
            assert checkpoint.partial_solution == partial_solution

    @given(completed=st.lists(st.integers(0, 100), min_size=0, max_size=10, unique=True))
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_preserves_cluster_lists(self, completed: List[int]):
        """
        **Feature: solver-refactoring, Property 9: Checkpoint Completeness**
        **Validates: Requirements 5.2**
        
        For any cluster lists, the checkpoint SHALL preserve the exact
        cluster IDs in completed and pending lists.
        """
        with temp_checkpoint_manager() as manager:
            # Create pending as complement
            all_clusters = set(range(max(completed) + 5)) if completed else set(range(5))
            pending = list(all_clusters - set(completed))
            
            manager.save(
                job_id="test_clusters",
                input_data={"test": "data"},
                partial_solution=[],
                completed_clusters=completed,
                pending_clusters=pending,
            )
            
            checkpoint = manager.load("test_clusters")
            
            assert checkpoint.completed_clusters == completed
            assert checkpoint.pending_clusters == pending


# ==============================================================================
# Property Tests: Checkpoint Resume Correctness (Property 10)
# ==============================================================================

class TestCheckpointResumeCorrectness:
    """
    **Feature: solver-refactoring, Property 10: Checkpoint Resume Correctness**
    **Validates: Requirements 5.3**
    
    For any valid checkpoint, resuming from that checkpoint SHALL continue
    solving from the saved state and produce a complete solution equivalent
    to solving from scratch.
    """

    @given(data=valid_checkpoint_data())
    @settings(max_examples=100, deadline=10000)
    def test_checkpoint_round_trip(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 10: Checkpoint Resume Correctness**
        **Validates: Requirements 5.3**
        
        For any checkpoint data, saving and loading SHALL produce an
        equivalent checkpoint that can be used to resume solving.
        """
        with temp_checkpoint_manager() as manager:
            # Save
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
                metadata=data["metadata"],
            )
            
            # Load
            checkpoint = manager.load(data["job_id"])
            
            # Verify round-trip preserves all data needed for resume
            assert checkpoint.job_id == data["job_id"]
            assert checkpoint.input_data == data["input_data"]
            assert checkpoint.partial_solution == data["partial_solution"]
            assert checkpoint.completed_clusters == data["completed_clusters"]
            assert checkpoint.pending_clusters == data["pending_clusters"]
            
            # Verify we can determine what work remains
            total_clusters = len(checkpoint.completed_clusters) + len(checkpoint.pending_clusters)
            assert total_clusters == len(data["completed_clusters"]) + len(data["pending_clusters"])

    @given(data=valid_checkpoint_data())
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_update_preserves_created_at(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 10: Checkpoint Resume Correctness**
        **Validates: Requirements 5.3**
        
        When updating a checkpoint, the original created_at timestamp
        SHALL be preserved while updated_at is refreshed.
        """
        with temp_checkpoint_manager() as manager:
            # Initial save
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=[],
                completed_clusters=[],
                pending_clusters=data["pending_clusters"],
            )
            
            checkpoint1 = manager.load(data["job_id"])
            original_created_at = checkpoint1.created_at
            
            # Small delay to ensure different timestamp
            time.sleep(0.01)
            
            # Update with more progress
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
            )
            
            checkpoint2 = manager.load(data["job_id"])
            
            # created_at should be preserved
            assert checkpoint2.created_at == original_created_at
            # updated_at should be newer
            assert checkpoint2.updated_at >= checkpoint2.created_at

    @given(data=valid_checkpoint_data())
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_delete_after_completion(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 10: Checkpoint Resume Correctness**
        **Validates: Requirements 5.4**
        
        After successful completion, deleting the checkpoint SHALL remove
        it from storage.
        """
        with temp_checkpoint_manager() as manager:
            # Save
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
            )
            
            # Verify exists
            assert manager.exists(data["job_id"])
            
            # Delete
            result = manager.delete(data["job_id"])
            assert result is True
            
            # Verify deleted
            assert not manager.exists(data["job_id"])
            assert manager.load(data["job_id"]) is None


# ==============================================================================
# Property Tests: Checkpoint Validation (Property 11)
# ==============================================================================

class TestCheckpointValidation:
    """
    **Feature: solver-refactoring, Property 11: Checkpoint Validation**
    **Validates: Requirements 5.5**
    
    For any checkpoint loaded, the solver SHALL validate that the checkpoint's
    input data schema matches the current input schema and reject invalid
    checkpoints.
    """

    @given(data=valid_checkpoint_data())
    @settings(max_examples=100, deadline=10000)
    def test_checkpoint_validates_with_same_input(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 11: Checkpoint Validation**
        **Validates: Requirements 5.5**
        
        For any checkpoint, validation SHALL succeed when the current input
        matches the checkpoint's input.
        """
        with temp_checkpoint_manager() as manager:
            # Save
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
            )
            
            # Load
            checkpoint = manager.load(data["job_id"])
            
            # Validate with same input - should succeed
            result = manager.validate(checkpoint, data["input_data"])
            assert result is True

    @given(
        data=valid_checkpoint_data(),
        modified_key=st.sampled_from(["config", "classes", "teachers"]),
    )
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_rejects_different_input(
        self,
        data: Dict[str, Any],
        modified_key: str,
    ):
        """
        **Feature: solver-refactoring, Property 11: Checkpoint Validation**
        **Validates: Requirements 5.5**
        
        For any checkpoint, validation SHALL fail when the current input
        differs from the checkpoint's input.
        """
        with temp_checkpoint_manager() as manager:
            # Save with original input
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
            )
            
            checkpoint = manager.load(data["job_id"])
            
            # Modify input
            modified_input = data["input_data"].copy()
            if modified_key == "config":
                modified_input["config"] = {"daysOfWeek": ["MONDAY"], "periodsPerDay": 1}
            elif modified_key == "classes":
                modified_input["classes"] = [{"id": "new_class", "name": "New"}]
            else:
                modified_input["teachers"] = [{"id": "new_teacher", "name": "New"}]
            
            # Validate with different input - should fail
            with pytest.raises(CheckpointValidationError) as exc_info:
                manager.validate(checkpoint, modified_input)
            
            assert "hash mismatch" in str(exc_info.value).lower()

    @given(data=valid_checkpoint_data())
    @settings(max_examples=50, deadline=10000)
    def test_checkpoint_validates_no_duplicate_clusters(self, data: Dict[str, Any]):
        """
        **Feature: solver-refactoring, Property 11: Checkpoint Validation**
        **Validates: Requirements 5.5**
        
        Validation SHALL detect duplicate cluster IDs in completed/pending lists.
        """
        with temp_checkpoint_manager() as manager:
            # Create checkpoint with valid data first
            manager.save(
                job_id=data["job_id"],
                input_data=data["input_data"],
                partial_solution=data["partial_solution"],
                completed_clusters=data["completed_clusters"],
                pending_clusters=data["pending_clusters"],
            )
            
            checkpoint = manager.load(data["job_id"])
            
            # Manually corrupt the checkpoint to have duplicates
            if checkpoint.completed_clusters:
                # Add a duplicate from completed to pending
                checkpoint.pending_clusters = checkpoint.pending_clusters + [checkpoint.completed_clusters[0]]
                
                with pytest.raises(CheckpointValidationError) as exc_info:
                    manager.validate(checkpoint, data["input_data"])
                
                assert "duplicate" in str(exc_info.value).lower()

    def test_checkpoint_validates_schema_version(self, temp_checkpoint_dir):
        """
        **Feature: solver-refactoring, Property 11: Checkpoint Validation**
        **Validates: Requirements 5.5**
        
        Validation SHALL detect schema version mismatches.
        """
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        input_data = {"test": "data"}
        
        # Save checkpoint
        manager.save(
            job_id="test_schema",
            input_data=input_data,
            partial_solution=[],
            completed_clusters=[0],
            pending_clusters=[1, 2],
        )
        
        checkpoint = manager.load("test_schema")
        
        # Manually change schema version
        checkpoint.schema_version = "0.0.1"
        
        with pytest.raises(CheckpointValidationError) as exc_info:
            manager.validate(checkpoint, input_data)
        
        assert "schema version" in str(exc_info.value).lower()


# ==============================================================================
# Additional Unit Tests for Edge Cases
# ==============================================================================

class TestCheckpointManagerEdgeCases:
    """Additional tests for edge cases and error handling."""

    def test_load_nonexistent_checkpoint(self, temp_checkpoint_dir):
        """Loading a non-existent checkpoint SHALL return None."""
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        result = manager.load("nonexistent_job")
        assert result is None

    def test_delete_nonexistent_checkpoint(self, temp_checkpoint_dir):
        """Deleting a non-existent checkpoint SHALL return False."""
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        result = manager.delete("nonexistent_job")
        assert result is False

    def test_list_checkpoints(self, temp_checkpoint_dir):
        """list_checkpoints SHALL return all saved job IDs."""
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        
        # Save multiple checkpoints
        for i in range(3):
            manager.save(
                job_id=f"job_{i}",
                input_data={"id": i},
                partial_solution=[],
                completed_clusters=[],
                pending_clusters=[0],
            )
        
        checkpoints = manager.list_checkpoints()
        assert len(checkpoints) == 3
        assert set(checkpoints) == {"job_0", "job_1", "job_2"}

    def test_get_checkpoint_info(self, temp_checkpoint_dir):
        """get_checkpoint_info SHALL return summary without full data."""
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        
        manager.save(
            job_id="info_test",
            input_data={"large": "data" * 100},
            partial_solution=[{"lesson": i} for i in range(10)],
            completed_clusters=[0, 1, 2],
            pending_clusters=[3, 4],
            metadata={"strategy": "balanced"},
        )
        
        info = manager.get_checkpoint_info("info_test")
        
        assert info is not None
        assert info["job_id"] == "info_test"
        assert info["completed_clusters"] == 3
        assert info["pending_clusters"] == 2
        assert info["partial_solution_size"] == 10
        assert info["metadata"] == {"strategy": "balanced"}

    def test_job_id_sanitization(self, temp_checkpoint_dir):
        """Job IDs with special characters SHALL be sanitized."""
        manager = CheckpointManager(checkpoint_dir=temp_checkpoint_dir)
        
        # Try to save with potentially dangerous job_id
        manager.save(
            job_id="../../../etc/passwd",
            input_data={"test": "data"},
            partial_solution=[],
            completed_clusters=[],
            pending_clusters=[0],
        )
        
        # Should be sanitized and saved safely
        # The sanitized ID should not contain path separators
        checkpoints = manager.list_checkpoints()
        assert len(checkpoints) == 1
        assert "/" not in checkpoints[0]
        assert ".." not in checkpoints[0]
