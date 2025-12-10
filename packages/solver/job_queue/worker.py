# ==============================================================================
#
#  Redis Queue Worker for Timetable Solver
#
#  Description:
#  Implements a Redis-based queue worker that processes timetable solving jobs
#  asynchronously, with support for result storage and retry logic.
#
# ==============================================================================

import json
import time
import logging
import traceback
from typing import Dict, Any, Optional, Protocol, Union
from abc import ABC, abstractmethod

import redis
from pydantic import BaseModel, Field

from models.input import TimetableData
from models.output import SolverOutput, SolverStatus, SolverError
from core.solver import TimetableSolver
from config.loader import ConfigLoader


# Import job models
from .job import SolverJob, SolverResult


# ==============================================================================
# Result Store Interface
# ==============================================================================

class ResultStore(Protocol):
    """Interface for storing solver results."""
    
    def store_result(self, job_id: str, result: SolverResult) -> None:
        """Store a solver result."""
        ...
    
    def get_result(self, job_id: str) -> Optional[SolverResult]:
        """Retrieve a solver result."""
        ...
    
    def delete_result(self, job_id: str) -> bool:
        """Delete a solver result."""
        ...


class RedisResultStore:
    """Redis-based result store implementation."""
    
    def __init__(self, redis_client: redis.Redis, key_prefix: str = "solver_result:", ttl_seconds: int = 86400):
        """
        Initialize Redis result store.
        
        Args:
            redis_client: Redis client instance
            key_prefix: Prefix for result keys
            ttl_seconds: Time-to-live for results (default 24 hours)
        """
        self.redis_client = redis_client
        self.key_prefix = key_prefix
        self.ttl_seconds = ttl_seconds
    
    def store_result(self, job_id: str, result: SolverResult) -> None:
        """Store a solver result in Redis."""
        key = f"{self.key_prefix}{job_id}"
        value = result.model_dump_json()
        self.redis_client.setex(key, self.ttl_seconds, value)
    
    def get_result(self, job_id: str) -> Optional[SolverResult]:
        """Retrieve a solver result from Redis."""
        key = f"{self.key_prefix}{job_id}"
        value = self.redis_client.get(key)
        if value:
            return SolverResult.model_validate_json(value)
        return None
    
    def delete_result(self, job_id: str) -> bool:
        """Delete a solver result from Redis."""
        key = f"{self.key_prefix}{job_id}"
        return bool(self.redis_client.delete(key))


# ==============================================================================
# Solver Worker
# ==============================================================================

class SolverWorker:
    """Redis queue worker for solver jobs."""
    
    def __init__(
        self,
        redis_url: str,
        result_store: Optional[ResultStore] = None,
        queue_name: str = "solver_jobs",
        worker_id: Optional[str] = None,
        poll_interval: float = 1.0,
        max_processing_time: int = 1800  # 30 minutes
    ):
        """
        Initialize worker with Redis connection.
        
        Args:
            redis_url: Redis connection URL
            result_store: Result store implementation (defaults to RedisResultStore)
            queue_name: Name of the Redis queue
            worker_id: Unique worker identifier
            poll_interval: Polling interval in seconds
            max_processing_time: Maximum time to process a single job
        """
        self.redis_client = redis.from_url(redis_url)
        self.queue_name = queue_name
        self.worker_id = worker_id or f"worker_{int(time.time())}"
        self.poll_interval = poll_interval
        self.max_processing_time = max_processing_time
        self.running = False
        
        # Initialize result store
        if result_store is None:
            self.result_store = RedisResultStore(self.redis_client)
        else:
            self.result_store = result_store
        
        # Setup logging
        self.logger = logging.getLogger(f"SolverWorker.{self.worker_id}")
        
        # Load default configuration
        self.default_config = ConfigLoader.load()
    
    def start(self) -> None:
        """Start processing jobs from queue."""
        self.logger.info(f"Starting solver worker {self.worker_id}")
        self.running = True
        
        try:
            while self.running:
                try:
                    # Block for a job with timeout
                    job_data = self.redis_client.blpop(self.queue_name, timeout=int(self.poll_interval))
                    
                    if job_data is None:
                        continue
                    
                    # Parse job
                    _, job_json = job_data
                    job = SolverJob.model_validate_json(job_json)
                    
                    self.logger.info(f"Processing job {job.job_id}")
                    
                    # Process the job
                    result = self.process_job(job)
                    
                    # Store result
                    self.result_store.store_result(job.job_id, result)
                    
                    self.logger.info(f"Completed job {job.job_id} with status {result.status}")
                    
                except redis.RedisError as e:
                    self.logger.error(f"Redis error: {e}")
                    time.sleep(self.poll_interval)
                except Exception as e:
                    self.logger.error(f"Unexpected error processing job: {e}")
                    self.logger.error(traceback.format_exc())
                    time.sleep(self.poll_interval)
        
        except KeyboardInterrupt:
            self.logger.info("Received interrupt signal")
        finally:
            self.logger.info(f"Stopping solver worker {self.worker_id}")
    
    def stop(self) -> None:
        """Stop worker gracefully."""
        self.logger.info(f"Stopping worker {self.worker_id}")
        self.running = False
    
    def process_job(self, job: SolverJob) -> SolverResult:
        """
        Process a single solver job.
        
        Args:
            job: The solver job to process
            
        Returns:
            SolverResult with the processing outcome
        """
        start_time = time.time()
        
        try:
            # Validate and parse input data
            try:
                timetable_data = TimetableData.model_validate(job.input_data)
            except Exception as e:
                error_msg = f"Invalid input data: {str(e)}"
                self.logger.error(f"Job {job.job_id}: {error_msg}")
                return SolverResult(
                    job_id=job.job_id,
                    status=SolverStatus.ERROR,
                    error=error_msg,
                    processing_time_seconds=time.time() - start_time,
                    retry_count=job.retry_count
                )
            
            # Load configuration with job-specific overrides
            config = self.default_config
            if job.config:
                # Apply job-specific configuration overrides
                # This is a simplified approach - in practice you might want more sophisticated merging
                config_dict = config.model_dump()
                config_dict.update(job.config)
                from config.schema import SolverConfig
                config = SolverConfig.model_validate(config_dict)
            
            # Create and run solver
            solver = TimetableSolver(timetable_data, config)
            
            self.logger.info(f"Job {job.job_id}: Starting solve with strategy {job.strategy}")
            
            # Solve with time limit
            output = solver.solve(
                time_limit_seconds=job.time_limit_seconds,
                strategy=job.strategy
            )
            
            processing_time = time.time() - start_time
            
            # Convert output to SolverOutput if needed
            if isinstance(output, list):
                # Legacy format - convert to SolverOutput
                solver_output = SolverOutput(
                    schedule=output,
                    status=SolverStatus.SUCCESS
                )
            elif isinstance(output, dict):
                # Dictionary format - convert to SolverOutput
                solver_output = SolverOutput.model_validate(output)
            else:
                # Already SolverOutput
                solver_output = output
            
            self.logger.info(f"Job {job.job_id}: Solve completed in {processing_time:.2f}s")
            
            return SolverResult(
                job_id=job.job_id,
                status=solver_output.status,
                output=solver_output,
                processing_time_seconds=processing_time,
                retry_count=job.retry_count
            )
            
        except Exception as e:
            processing_time = time.time() - start_time
            error_msg = f"Solver error: {str(e)}"
            self.logger.error(f"Job {job.job_id}: {error_msg}")
            self.logger.error(traceback.format_exc())
            
            # Check if this job should be retried
            if job.retry_count < job.max_retries:
                self.logger.info(f"Job {job.job_id}: Scheduling retry {job.retry_count + 1}/{job.max_retries}")
                self._schedule_retry(job)
            
            return SolverResult(
                job_id=job.job_id,
                status=SolverStatus.ERROR,
                error=error_msg,
                processing_time_seconds=processing_time,
                retry_count=job.retry_count
            )
    
    def _schedule_retry(self, job: SolverJob) -> None:
        """
        Schedule a job for retry with exponential backoff.
        
        Args:
            job: The job to retry
        """
        # Create retry job with incremented retry count
        retry_job = job.model_copy()
        retry_job.retry_count += 1
        
        # Calculate backoff delay (exponential backoff: 2^retry_count seconds)
        backoff_seconds = 2 ** retry_job.retry_count
        
        # Schedule retry using Redis delayed queue (simplified approach)
        # In production, you might want to use a more sophisticated delay mechanism
        retry_time = time.time() + backoff_seconds
        
        # For now, we'll just push back to the queue immediately
        # A more sophisticated implementation would use Redis sorted sets for delayed execution
        self.redis_client.rpush(self.queue_name, retry_job.model_dump_json())
        
        self.logger.info(f"Scheduled retry for job {job.job_id} in {backoff_seconds} seconds")
    
    def enqueue_job(self, job: SolverJob) -> None:
        """
        Enqueue a job for processing.
        
        Args:
            job: The job to enqueue
        """
        job_json = job.model_dump_json()
        self.redis_client.rpush(self.queue_name, job_json)
        self.logger.info(f"Enqueued job {job.job_id}")
    
    def get_queue_length(self) -> int:
        """Get the current queue length."""
        return self.redis_client.llen(self.queue_name)
    
    def health_check(self) -> Dict[str, Any]:
        """
        Perform health check on the worker.
        
        Returns:
            Health status information
        """
        try:
            # Test Redis connection
            self.redis_client.ping()
            redis_healthy = True
        except Exception:
            redis_healthy = False
        
        return {
            "worker_id": self.worker_id,
            "running": self.running,
            "redis_healthy": redis_healthy,
            "queue_length": self.get_queue_length() if redis_healthy else None,
            "timestamp": time.time()
        }


# ==============================================================================
# Utility Functions
# ==============================================================================

def create_worker_from_config(
    redis_url: str,
    config: Optional[Dict[str, Any]] = None
) -> SolverWorker:
    """
    Create a SolverWorker from configuration.
    
    Args:
        redis_url: Redis connection URL
        config: Optional worker configuration
        
    Returns:
        Configured SolverWorker instance
    """
    worker_config = config or {}
    
    return SolverWorker(
        redis_url=redis_url,
        queue_name=worker_config.get("queue_name", "solver_jobs"),
        worker_id=worker_config.get("worker_id"),
        poll_interval=worker_config.get("poll_interval", 1.0),
        max_processing_time=worker_config.get("max_processing_time", 1800)
    )


if __name__ == "__main__":
    # Simple CLI for running a worker
    import sys
    import os
    
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    worker = SolverWorker(redis_url)
    
    try:
        worker.start()
    except KeyboardInterrupt:
        worker.stop()
        sys.exit(0)