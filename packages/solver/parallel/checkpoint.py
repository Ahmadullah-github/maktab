# ==============================================================================
#
#  Checkpoint Manager for Solver Pause/Resume
#
#  Description:
#  Manages solver checkpoints for pause/resume capability during long-running
#  solves. Checkpoints are saved after each cluster completion and can be
#  used to resume solving from where it stopped.
#
#  **Feature: solver-refactoring, Task 15.1**
#  **Requirements: 5.1, 5.2, 5.3, 5.4, 5.5**
#
# ==============================================================================

import hashlib
import os
import pickle
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import structlog

log = structlog.get_logger()


# Schema version for checkpoint validation
CHECKPOINT_SCHEMA_VERSION = "1.0.0"


@dataclass
class Checkpoint:
    """
    Represents a saved solver checkpoint.
    
    A checkpoint contains all information needed to resume solving
    from where it was paused.
    
    Attributes:
        job_id: Unique identifier for the solve job
        schema_version: Version of the checkpoint schema
        input_data: Original input data (serialized TimetableData)
        input_hash: Hash of input data for validation
        partial_solution: List of scheduled lessons from completed clusters
        completed_clusters: List of cluster IDs that have been solved
        pending_clusters: List of cluster IDs still to be solved
        created_at: Timestamp when checkpoint was created
        updated_at: Timestamp when checkpoint was last updated
        metadata: Additional metadata (strategy, config, etc.)
    
    Requirements:
        - 5.1: Save checkpoints after each cluster completion
        - 5.2: Persist input data, partial solution, completed/pending clusters
    """
    job_id: str
    schema_version: str
    input_data: Dict[str, Any]
    input_hash: str
    partial_solution: List[Dict[str, Any]]
    completed_clusters: List[int]
    pending_clusters: List[int]
    created_at: float
    updated_at: float
    metadata: Dict[str, Any] = field(default_factory=dict)


class CheckpointError(Exception):
    """Base exception for checkpoint-related errors."""
    pass


class CheckpointNotFoundError(CheckpointError):
    """Raised when a checkpoint file is not found."""
    pass


class CheckpointCorruptError(CheckpointError):
    """Raised when a checkpoint file is corrupted or invalid."""
    pass


class CheckpointValidationError(CheckpointError):
    """Raised when checkpoint validation fails."""
    pass


class CheckpointManager:
    """
    Manages solver checkpoints for pause/resume capability.
    
    This class handles saving, loading, validating, and deleting checkpoints
    during long-running solve operations. Checkpoints enable:
    - Pausing and resuming solves
    - Recovery from crashes
    - Progress tracking
    
    Example:
        >>> manager = CheckpointManager(checkpoint_dir="./checkpoints")
        >>> 
        >>> # Save a checkpoint
        >>> checkpoint_path = manager.save(
        ...     job_id="job_123",
        ...     input_data={"config": {...}, "classes": [...]},
        ...     partial_solution=[{"classId": "1A", ...}],
        ...     completed_clusters=[0, 1],
        ...     pending_clusters=[2, 3, 4]
        ... )
        >>> 
        >>> # Load and resume
        >>> checkpoint = manager.load("job_123")
        >>> if checkpoint and manager.validate(checkpoint, current_input):
        ...     # Resume from checkpoint
        ...     pass
        >>> 
        >>> # Delete after completion
        >>> manager.delete("job_123")
    
    Requirements:
        - 5.1: Save checkpoints after each cluster completion
        - 5.2: Persist input data, partial solution, completed/pending clusters
        - 5.3: Load checkpoint and continue from saved state
        - 5.4: Delete checkpoint after successful completion
        - 5.5: Validate checkpoint matches current input schema
    """
    
    def __init__(self, checkpoint_dir: str = "./checkpoints"):
        """
        Initialize the checkpoint manager.
        
        Args:
            checkpoint_dir: Directory to store checkpoint files.
                           Will be created if it doesn't exist.
        """
        self.checkpoint_dir = Path(checkpoint_dir)
        self._ensure_directory()
        
        log.info(
            "CheckpointManager initialized",
            checkpoint_dir=str(self.checkpoint_dir)
        )
    
    def _ensure_directory(self) -> None:
        """Ensure the checkpoint directory exists."""
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
    
    def _get_checkpoint_path(self, job_id: str) -> Path:
        """Get the file path for a checkpoint."""
        # Sanitize job_id to prevent path traversal
        safe_job_id = "".join(c for c in job_id if c.isalnum() or c in "-_")
        return self.checkpoint_dir / f"{safe_job_id}.checkpoint"
    
    def _compute_input_hash(self, input_data: Dict[str, Any]) -> str:
        """
        Compute a hash of the input data for validation.
        
        This hash is used to verify that a checkpoint matches
        the current input when resuming.
        
        Args:
            input_data: Input data dictionary
            
        Returns:
            SHA-256 hash of the serialized input data
        """
        # Serialize input data deterministically
        serialized = pickle.dumps(input_data, protocol=pickle.HIGHEST_PROTOCOL)
        return hashlib.sha256(serialized).hexdigest()
    
    def save(
        self,
        job_id: str,
        input_data: Dict[str, Any],
        partial_solution: List[Dict[str, Any]],
        completed_clusters: List[int],
        pending_clusters: List[int],
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Save a checkpoint to disk.
        
        Args:
            job_id: Unique identifier for the solve job
            input_data: Original input data (serialized TimetableData)
            partial_solution: List of scheduled lessons from completed clusters
            completed_clusters: List of cluster IDs that have been solved
            pending_clusters: List of cluster IDs still to be solved
            metadata: Optional additional metadata
            
        Returns:
            Path to the saved checkpoint file
            
        Raises:
            CheckpointError: If saving fails
            
        Requirements:
            - 5.1: Save checkpoints after each cluster completion
            - 5.2: Persist input data, partial solution, completed/pending clusters
        """
        checkpoint_path = self._get_checkpoint_path(job_id)
        current_time = time.time()
        
        # Check if updating existing checkpoint
        existing = self.load(job_id)
        created_at = existing.created_at if existing else current_time
        
        checkpoint = Checkpoint(
            job_id=job_id,
            schema_version=CHECKPOINT_SCHEMA_VERSION,
            input_data=input_data,
            input_hash=self._compute_input_hash(input_data),
            partial_solution=partial_solution,
            completed_clusters=completed_clusters,
            pending_clusters=pending_clusters,
            created_at=created_at,
            updated_at=current_time,
            metadata=metadata or {}
        )
        
        try:
            # Write to temp file first, then rename for atomicity
            temp_path = checkpoint_path.with_suffix('.tmp')
            with open(temp_path, 'wb') as f:
                pickle.dump(checkpoint, f, protocol=pickle.HIGHEST_PROTOCOL)
            
            # Atomic rename
            temp_path.rename(checkpoint_path)
            
            log.info(
                "Checkpoint saved",
                job_id=job_id,
                completed_clusters=len(completed_clusters),
                pending_clusters=len(pending_clusters),
                partial_solution_size=len(partial_solution),
                path=str(checkpoint_path)
            )
            
            return str(checkpoint_path)
            
        except Exception as e:
            log.error(
                "Failed to save checkpoint",
                job_id=job_id,
                error=str(e)
            )
            # Clean up temp file if it exists
            if temp_path.exists():
                temp_path.unlink()
            raise CheckpointError(f"Failed to save checkpoint: {e}") from e
    
    def load(self, job_id: str) -> Optional[Checkpoint]:
        """
        Load a checkpoint from disk.
        
        Args:
            job_id: Unique identifier for the solve job
            
        Returns:
            Checkpoint object if found, None otherwise
            
        Raises:
            CheckpointCorruptError: If checkpoint file is corrupted
            
        Requirements:
            - 5.3: Load checkpoint and continue from saved state
        """
        checkpoint_path = self._get_checkpoint_path(job_id)
        
        if not checkpoint_path.exists():
            log.debug("Checkpoint not found", job_id=job_id)
            return None
        
        try:
            with open(checkpoint_path, 'rb') as f:
                checkpoint = pickle.load(f)
            
            # Verify it's a valid Checkpoint object
            if not isinstance(checkpoint, Checkpoint):
                raise CheckpointCorruptError(
                    f"Invalid checkpoint type: {type(checkpoint)}"
                )
            
            log.info(
                "Checkpoint loaded",
                job_id=job_id,
                schema_version=checkpoint.schema_version,
                completed_clusters=len(checkpoint.completed_clusters),
                pending_clusters=len(checkpoint.pending_clusters)
            )
            
            return checkpoint
            
        except pickle.UnpicklingError as e:
            log.error(
                "Checkpoint file corrupted",
                job_id=job_id,
                error=str(e)
            )
            raise CheckpointCorruptError(
                f"Checkpoint file corrupted: {e}"
            ) from e
        except Exception as e:
            log.error(
                "Failed to load checkpoint",
                job_id=job_id,
                error=str(e)
            )
            raise CheckpointCorruptError(
                f"Failed to load checkpoint: {e}"
            ) from e
    
    def delete(self, job_id: str) -> bool:
        """
        Delete a checkpoint file.
        
        Args:
            job_id: Unique identifier for the solve job
            
        Returns:
            True if checkpoint was deleted, False if it didn't exist
            
        Requirements:
            - 5.4: Delete checkpoint after successful completion
        """
        checkpoint_path = self._get_checkpoint_path(job_id)
        
        if not checkpoint_path.exists():
            log.debug("Checkpoint not found for deletion", job_id=job_id)
            return False
        
        try:
            checkpoint_path.unlink()
            log.info("Checkpoint deleted", job_id=job_id)
            return True
        except Exception as e:
            log.error(
                "Failed to delete checkpoint",
                job_id=job_id,
                error=str(e)
            )
            return False
    
    def validate(
        self,
        checkpoint: Checkpoint,
        input_data: Dict[str, Any]
    ) -> bool:
        """
        Validate that a checkpoint matches the current input.
        
        This method verifies:
        1. Schema version compatibility
        2. Input data hash matches
        3. Checkpoint structure is valid
        
        Args:
            checkpoint: Checkpoint to validate
            input_data: Current input data to compare against
            
        Returns:
            True if checkpoint is valid and matches input
            
        Raises:
            CheckpointValidationError: If validation fails with details
            
        Requirements:
            - 5.5: Validate checkpoint matches current input schema
        """
        errors = []
        
        # Check schema version
        if checkpoint.schema_version != CHECKPOINT_SCHEMA_VERSION:
            errors.append(
                f"Schema version mismatch: checkpoint={checkpoint.schema_version}, "
                f"current={CHECKPOINT_SCHEMA_VERSION}"
            )
        
        # Check input hash
        current_hash = self._compute_input_hash(input_data)
        if checkpoint.input_hash != current_hash:
            errors.append(
                "Input data hash mismatch: checkpoint was created with different input"
            )
        
        # Validate checkpoint structure
        if not isinstance(checkpoint.completed_clusters, list):
            errors.append("completed_clusters must be a list")
        
        if not isinstance(checkpoint.pending_clusters, list):
            errors.append("pending_clusters must be a list")
        
        if not isinstance(checkpoint.partial_solution, list):
            errors.append("partial_solution must be a list")
        
        # Check for duplicate cluster IDs
        all_clusters = checkpoint.completed_clusters + checkpoint.pending_clusters
        if len(all_clusters) != len(set(all_clusters)):
            errors.append("Duplicate cluster IDs found in completed/pending lists")
        
        if errors:
            log.warning(
                "Checkpoint validation failed",
                job_id=checkpoint.job_id,
                errors=errors
            )
            raise CheckpointValidationError(
                f"Checkpoint validation failed: {'; '.join(errors)}"
            )
        
        log.info(
            "Checkpoint validated successfully",
            job_id=checkpoint.job_id
        )
        return True
    
    def exists(self, job_id: str) -> bool:
        """
        Check if a checkpoint exists for the given job.
        
        Args:
            job_id: Unique identifier for the solve job
            
        Returns:
            True if checkpoint exists
        """
        return self._get_checkpoint_path(job_id).exists()
    
    def list_checkpoints(self) -> List[str]:
        """
        List all checkpoint job IDs in the checkpoint directory.
        
        Returns:
            List of job IDs with existing checkpoints
        """
        checkpoints = []
        for path in self.checkpoint_dir.glob("*.checkpoint"):
            job_id = path.stem
            checkpoints.append(job_id)
        return checkpoints
    
    def get_checkpoint_info(self, job_id: str) -> Optional[Dict[str, Any]]:
        """
        Get summary information about a checkpoint without loading full data.
        
        Args:
            job_id: Unique identifier for the solve job
            
        Returns:
            Dictionary with checkpoint summary, or None if not found
        """
        checkpoint = self.load(job_id)
        if not checkpoint:
            return None
        
        return {
            "job_id": checkpoint.job_id,
            "schema_version": checkpoint.schema_version,
            "created_at": checkpoint.created_at,
            "updated_at": checkpoint.updated_at,
            "completed_clusters": len(checkpoint.completed_clusters),
            "pending_clusters": len(checkpoint.pending_clusters),
            "partial_solution_size": len(checkpoint.partial_solution),
            "metadata": checkpoint.metadata
        }
    
    def cleanup_old_checkpoints(self, max_age_seconds: float = 86400) -> int:
        """
        Remove checkpoints older than the specified age.
        
        Args:
            max_age_seconds: Maximum age in seconds (default: 24 hours)
            
        Returns:
            Number of checkpoints deleted
        """
        current_time = time.time()
        deleted_count = 0
        
        for job_id in self.list_checkpoints():
            try:
                checkpoint = self.load(job_id)
                if checkpoint and (current_time - checkpoint.updated_at) > max_age_seconds:
                    if self.delete(job_id):
                        deleted_count += 1
            except CheckpointCorruptError:
                # Delete corrupted checkpoints
                if self.delete(job_id):
                    deleted_count += 1
        
        if deleted_count > 0:
            log.info(
                "Cleaned up old checkpoints",
                deleted_count=deleted_count,
                max_age_seconds=max_age_seconds
            )
        
        return deleted_count
