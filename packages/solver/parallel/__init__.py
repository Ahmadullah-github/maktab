# ==============================================================================
#
#  Parallel Execution Module
#
#  Description:
#  Provides parallel cluster solving capabilities for large timetabling problems.
#  Uses ProcessPoolExecutor for true parallelism across CPU cores.
#  Includes checkpoint/resume capability for long-running solves.
#
#  Requirements: 4.1, 4.2, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
#
# ==============================================================================

from .executor import ParallelClusterExecutor, ClusterResult
from .checkpoint import (
    Checkpoint,
    CheckpointManager,
    CheckpointError,
    CheckpointNotFoundError,
    CheckpointCorruptError,
    CheckpointValidationError,
)

__all__ = [
    "ParallelClusterExecutor",
    "ClusterResult",
    "Checkpoint",
    "CheckpointManager",
    "CheckpointError",
    "CheckpointNotFoundError",
    "CheckpointCorruptError",
    "CheckpointValidationError",
]
