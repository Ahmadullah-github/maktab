# ==============================================================================
#
#  Job and Result Models for Queue-Based Solver
#
#  Description:
#  Pydantic models for solver jobs and results used in the queue-based
#  architecture. Defines the schema for job requests and processing results.
#
#  Requirements: 8.1
#
# ==============================================================================

import time
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field

from models.output import SolverOutput, SolverStatus


# ==============================================================================
# Job Model
# ==============================================================================

class SolverJob(BaseModel):
    """
    A solver job to be processed by the queue worker.
    
    This model defines the structure of jobs that are enqueued for processing
    by the distributed solver workers. Each job contains all the information
    needed to solve a timetabling problem independently.
    
    Requirements: 8.1
    """
    job_id: str = Field(description="Unique job identifier")
    input_data: Dict[str, Any] = Field(description="Timetable input data")
    config: Optional[Dict[str, Any]] = Field(default=None, description="Solver configuration overrides")
    time_limit_seconds: int = Field(default=600, description="Time limit for solving")
    strategy: str = Field(default="balanced", description="Solving strategy (fast/balanced/thorough)")
    retry_count: int = Field(default=0, description="Current retry attempt")
    max_retries: int = Field(default=3, description="Maximum retry attempts")
    created_at: float = Field(default_factory=time.time, description="Job creation timestamp")
    priority: int = Field(default=0, description="Job priority (higher = more urgent)")
    
    model_config = {
        "json_encoders": {
            # Ensure timestamps are serialized as floats
            float: lambda v: v
        }
    }
    
    def increment_retry(self) -> "SolverJob":
        """
        Create a new job instance with incremented retry count.
        
        Returns:
            New SolverJob instance with retry_count + 1
        """
        return self.model_copy(update={"retry_count": self.retry_count + 1})
    
    def should_retry(self) -> bool:
        """
        Check if this job should be retried.
        
        Returns:
            True if retry_count < max_retries
        """
        return self.retry_count < self.max_retries
    
    def get_backoff_seconds(self) -> int:
        """
        Calculate exponential backoff delay for retry.
        
        Returns:
            Backoff delay in seconds (2^retry_count)
        """
        return 2 ** self.retry_count


# ==============================================================================
# Result Model
# ==============================================================================

class SolverResult(BaseModel):
    """
    Result of a solver job processing.
    
    This model contains the outcome of processing a solver job, including
    the solution (if successful), error information (if failed), and
    metadata about the processing.
    
    Requirements: 8.1
    """
    job_id: str = Field(description="Job identifier")
    status: SolverStatus = Field(description="Solver status")
    output: Optional[SolverOutput] = Field(default=None, description="Solver output if successful")
    error: Optional[str] = Field(default=None, description="Error message if failed")
    processing_time_seconds: Optional[float] = Field(default=None, description="Time taken to process")
    completed_at: float = Field(default_factory=time.time, description="Completion timestamp")
    retry_count: int = Field(default=0, description="Number of retries attempted")
    worker_id: Optional[str] = Field(default=None, description="ID of worker that processed the job")
    
    model_config = {
        "json_encoders": {
            # Ensure timestamps are serialized as floats
            float: lambda v: v
        }
    }
    
    @classmethod
    def success(
        cls,
        job_id: str,
        output: SolverOutput,
        processing_time: float,
        retry_count: int = 0,
        worker_id: Optional[str] = None
    ) -> "SolverResult":
        """
        Create a successful result.
        
        Args:
            job_id: Job identifier
            output: Solver output
            processing_time: Processing time in seconds
            retry_count: Number of retries attempted
            worker_id: Worker that processed the job
            
        Returns:
            SolverResult with SUCCESS status
        """
        return cls(
            job_id=job_id,
            status=SolverStatus.SUCCESS,
            output=output,
            processing_time_seconds=processing_time,
            retry_count=retry_count,
            worker_id=worker_id
        )
    
    @classmethod
    def failure(
        cls,
        job_id: str,
        error: str,
        status: SolverStatus = SolverStatus.ERROR,
        processing_time: Optional[float] = None,
        retry_count: int = 0,
        worker_id: Optional[str] = None
    ) -> "SolverResult":
        """
        Create a failed result.
        
        Args:
            job_id: Job identifier
            error: Error message
            status: Error status (ERROR, TIMEOUT, INFEASIBLE, etc.)
            processing_time: Processing time in seconds
            retry_count: Number of retries attempted
            worker_id: Worker that processed the job
            
        Returns:
            SolverResult with error status
        """
        return cls(
            job_id=job_id,
            status=status,
            error=error,
            processing_time_seconds=processing_time,
            retry_count=retry_count,
            worker_id=worker_id
        )
    
    def is_success(self) -> bool:
        """Check if the result represents a successful solve."""
        return self.status == SolverStatus.SUCCESS
    
    def is_failure(self) -> bool:
        """Check if the result represents a failed solve."""
        return self.status in [SolverStatus.ERROR, SolverStatus.TIMEOUT, SolverStatus.INFEASIBLE]


# ==============================================================================
# Queue Statistics Model
# ==============================================================================

class QueueStatistics(BaseModel):
    """Statistics about the job queue."""
    total_jobs: int = Field(description="Total jobs processed")
    successful_jobs: int = Field(description="Successfully completed jobs")
    failed_jobs: int = Field(description="Failed jobs")
    pending_jobs: int = Field(description="Jobs currently in queue")
    average_processing_time: Optional[float] = Field(default=None, description="Average processing time in seconds")
    last_updated: float = Field(default_factory=time.time, description="Last update timestamp")
    
    def success_rate(self) -> float:
        """Calculate success rate as a percentage."""
        if self.total_jobs == 0:
            return 0.0
        return (self.successful_jobs / self.total_jobs) * 100.0


# ==============================================================================
# Utility Functions
# ==============================================================================

def create_job(
    job_id: str,
    input_data: Dict[str, Any],
    time_limit_seconds: int = 600,
    strategy: str = "balanced",
    config: Optional[Dict[str, Any]] = None,
    max_retries: int = 3,
    priority: int = 0
) -> SolverJob:
    """
    Create a solver job with the given parameters.
    
    Args:
        job_id: Unique job identifier
        input_data: Timetable input data
        time_limit_seconds: Time limit for solving
        strategy: Solving strategy
        config: Optional configuration overrides
        max_retries: Maximum retry attempts
        priority: Job priority
        
    Returns:
        SolverJob instance
    """
    return SolverJob(
        job_id=job_id,
        input_data=input_data,
        time_limit_seconds=time_limit_seconds,
        strategy=strategy,
        config=config,
        max_retries=max_retries,
        priority=priority
    )


def validate_job_data(job: SolverJob) -> bool:
    """
    Validate that a job contains the minimum required data.
    
    Args:
        job: Job to validate
        
    Returns:
        True if job data is valid
        
    Raises:
        ValueError: If job data is invalid
    """
    if not job.job_id:
        raise ValueError("Job ID is required")
    
    if not job.input_data:
        raise ValueError("Input data is required")
    
    # Check for required input data fields
    required_fields = ["teachers", "classes", "subjects", "rooms", "globalConfig"]
    for field in required_fields:
        if field not in job.input_data:
            raise ValueError(f"Required field '{field}' missing from input data")
    
    # Validate global config has period configuration
    global_config = job.input_data.get("globalConfig", {})
    if "periodsPerDayMap" not in global_config:
        raise ValueError("periodsPerDayMap is required in globalConfig")
    
    return True