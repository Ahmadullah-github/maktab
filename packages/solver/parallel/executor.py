# ==============================================================================
#
#  Parallel Cluster Executor
#
#  Description:
#  Executes cluster solving in parallel using ProcessPoolExecutor.
#  Supports configurable worker count and graceful failure handling.
#
#  **Feature: solver-refactoring, Task 14.1**
#  **Requirements: 4.1, 4.2, 4.3, 4.4**
#
# ==============================================================================

import os
import copy
import traceback
from concurrent.futures import ProcessPoolExecutor, as_completed, Future
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Type, Union

import structlog

log = structlog.get_logger()


@dataclass
class ClusterResult:
    """
    Result from solving a single cluster.
    
    Attributes:
        cluster_id: Identifier for the cluster
        success: Whether solving succeeded
        solution: List of scheduled lessons (if successful)
        error: Error message (if failed)
        error_traceback: Full traceback (if failed)
        cluster_metadata: Original cluster metadata
    """
    cluster_id: int
    success: bool
    solution: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    error_traceback: Optional[str] = None
    cluster_metadata: Optional[Dict[str, Any]] = None


def _solve_cluster_worker(
    cluster_data: Dict[str, Any],
    solver_module: str,
    solver_class_name: str,
    solver_kwargs: Dict[str, Any]
) -> ClusterResult:
    """
    Worker function that runs in a subprocess to solve a single cluster.
    
    This function is designed to be picklable for ProcessPoolExecutor.
    It imports the solver class dynamically to avoid pickling issues.
    
    Args:
        cluster_data: Dictionary containing:
            - 'cluster_id': int
            - 'sub_problem_data': dict (serialized TimetableData)
            - 'cluster_metadata': dict
        solver_module: Module path for the solver class
        solver_class_name: Name of the solver class
        solver_kwargs: Keyword arguments to pass to solver.solve()
    
    Returns:
        ClusterResult with solution or error information
    """
    cluster_id = cluster_data['cluster_id']
    sub_problem_data = cluster_data['sub_problem_data']
    cluster_metadata = cluster_data.get('cluster_metadata', {})
    
    try:
        # Dynamic import to avoid pickling issues
        import importlib
        module = importlib.import_module(solver_module)
        solver_class = getattr(module, solver_class_name)
        
        # Create solver instance and solve
        solver = solver_class(sub_problem_data)
        solution = solver.solve(**solver_kwargs)
        
        # Check if solution indicates an error
        if isinstance(solution, list) and len(solution) > 0 and 'error' in solution[0]:
            return ClusterResult(
                cluster_id=cluster_id,
                success=False,
                error=solution[0].get('error', 'Unknown error'),
                cluster_metadata=cluster_metadata
            )
        
        return ClusterResult(
            cluster_id=cluster_id,
            success=True,
            solution=solution if isinstance(solution, list) else [],
            cluster_metadata=cluster_metadata
        )
        
    except Exception as e:
        return ClusterResult(
            cluster_id=cluster_id,
            success=False,
            error=str(e),
            error_traceback=traceback.format_exc(),
            cluster_metadata=cluster_metadata
        )


class ParallelClusterExecutor:
    """
    Executes cluster solving in parallel using ProcessPoolExecutor.
    
    This class manages parallel execution of cluster solving, handling:
    - Configurable worker count (default: CPU count - 1)
    - Graceful failure handling (continues with other clusters if one fails)
    - Solution merging with conflict detection
    
    Example:
        >>> executor = ParallelClusterExecutor(max_workers=4)
        >>> results = executor.solve_clusters(
        ...     clusters=clusters,
        ...     solver_module='core.solver',
        ...     solver_class_name='TimetableSolver',
        ...     solver_kwargs={'time_limit_seconds': 300}
        ... )
    
    Requirements:
        - 4.1: Solve clusters in parallel using ProcessPoolExecutor
        - 4.2: Configurable number of workers (default: CPU count - 1)
        - 4.3: Continue solving other clusters if one fails
        - 4.4: Merge solutions and verify no conflicts
    """
    
    def __init__(
        self,
        max_workers: Optional[int] = None,
        config: Optional[Any] = None
    ):
        """
        Initialize the parallel executor.
        
        Args:
            max_workers: Maximum number of worker processes.
                        If None, defaults to CPU count - 1 (minimum 1).
            config: Optional SolverConfig for additional settings.
        """
        if max_workers is None:
            cpu_count = os.cpu_count() or 1
            self.max_workers = max(1, cpu_count - 1)
        else:
            self.max_workers = max(1, max_workers)
        
        self.config = config
        
        log.info(
            "ParallelClusterExecutor initialized",
            max_workers=self.max_workers,
            cpu_count=os.cpu_count()
        )
    
    def solve_clusters(
        self,
        clusters: List[Dict[str, Any]],
        solver_module: str = "core.solver",
        solver_class_name: str = "TimetableSolver",
        cluster_data_builder: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        **solver_kwargs
    ) -> List[ClusterResult]:
        """
        Solve multiple clusters in parallel.
        
        Args:
            clusters: List of cluster dictionaries from ClusterBuilder.
                     Each cluster should have 'cluster_id' and data needed
                     to create a sub-problem.
            solver_module: Module path for the solver class.
            solver_class_name: Name of the solver class to use.
            cluster_data_builder: Optional function to build sub-problem data
                                 from a cluster. If None, clusters must already
                                 contain 'sub_problem_data'.
            **solver_kwargs: Keyword arguments passed to solver.solve().
        
        Returns:
            List of ClusterResult objects, one per cluster.
            Failed clusters will have success=False with error details.
        
        Raises:
            ValueError: If clusters list is empty.
        """
        if not clusters:
            raise ValueError("No clusters provided for parallel solving")
        
        log.info(
            "Starting parallel cluster solving",
            num_clusters=len(clusters),
            max_workers=self.max_workers
        )
        
        # Prepare cluster data for workers
        cluster_work_items = []
        for cluster in clusters:
            cluster_id = cluster.get('cluster_id', len(cluster_work_items))
            
            # Build sub-problem data if builder provided
            if cluster_data_builder is not None:
                sub_problem_data = cluster_data_builder(cluster)
            elif 'sub_problem_data' in cluster:
                sub_problem_data = cluster['sub_problem_data']
            else:
                raise ValueError(
                    f"Cluster {cluster_id} missing 'sub_problem_data' and "
                    "no cluster_data_builder provided"
                )
            
            cluster_work_items.append({
                'cluster_id': cluster_id,
                'sub_problem_data': sub_problem_data,
                'cluster_metadata': {
                    k: v for k, v in cluster.items()
                    if k not in ('sub_problem_data',)
                }
            })
        
        # Execute in parallel
        results: List[ClusterResult] = []
        
        # Determine actual worker count (don't use more workers than clusters)
        actual_workers = min(self.max_workers, len(cluster_work_items))
        
        with ProcessPoolExecutor(max_workers=actual_workers) as executor:
            # Submit all tasks
            future_to_cluster: Dict[Future, int] = {}
            
            for work_item in cluster_work_items:
                future = executor.submit(
                    _solve_cluster_worker,
                    work_item,
                    solver_module,
                    solver_class_name,
                    solver_kwargs
                )
                future_to_cluster[future] = work_item['cluster_id']
            
            # Collect results as they complete
            for future in as_completed(future_to_cluster):
                cluster_id = future_to_cluster[future]
                
                try:
                    result = future.result()
                    results.append(result)
                    
                    if result.success:
                        log.info(
                            "Cluster solved successfully",
                            cluster_id=cluster_id,
                            num_lessons=len(result.solution)
                        )
                    else:
                        log.warning(
                            "Cluster solving failed",
                            cluster_id=cluster_id,
                            error=result.error
                        )
                        
                except Exception as e:
                    # Handle unexpected exceptions from the future
                    log.error(
                        "Unexpected error getting cluster result",
                        cluster_id=cluster_id,
                        error=str(e)
                    )
                    results.append(ClusterResult(
                        cluster_id=cluster_id,
                        success=False,
                        error=f"Future execution error: {str(e)}",
                        error_traceback=traceback.format_exc()
                    ))
        
        # Sort results by cluster_id for deterministic ordering
        results.sort(key=lambda r: r.cluster_id)
        
        # Log summary
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        
        log.info(
            "Parallel solving complete",
            total_clusters=len(results),
            successful=successful,
            failed=failed
        )
        
        return results
    
    def merge_solutions(
        self,
        results: List[ClusterResult],
        data: Any
    ) -> List[Dict[str, Any]]:
        """
        Merge solutions from multiple cluster results.
        
        This method combines solutions from all successful clusters
        and verifies there are no conflicts.
        
        Args:
            results: List of ClusterResult objects from solve_clusters().
            data: Original TimetableData for conflict checking.
        
        Returns:
            Merged list of scheduled lessons, or error dict if conflicts found.
        
        Requirements:
            - 4.4: Merge solutions and verify no conflicts exist
        """
        # Import here to avoid circular imports
        from decomposition.solution_merger import SolutionMerger
        
        # Convert ClusterResults to format expected by SolutionMerger
        sub_solutions = []
        failed_clusters = []
        
        for result in results:
            if result.success:
                sub_solutions.append({
                    'cluster_id': result.cluster_id,
                    'solution': result.solution,
                    'cluster': result.cluster_metadata or {}
                })
            else:
                failed_clusters.append({
                    'cluster_id': result.cluster_id,
                    'error': result.error
                })
        
        if not sub_solutions:
            return [{
                "error": "All clusters failed to solve",
                "status": "PARALLEL_ERROR",
                "failed_clusters": failed_clusters
            }]
        
        # Use SolutionMerger for conflict detection and merging
        merger = SolutionMerger(data)
        merged = merger.merge(sub_solutions)
        
        # Add information about failed clusters if any
        if failed_clusters and isinstance(merged, list) and len(merged) > 0:
            if 'error' not in merged[0]:
                # Solution is valid but some clusters failed
                log.warning(
                    "Some clusters failed during parallel solving",
                    failed_count=len(failed_clusters),
                    failed_clusters=failed_clusters
                )
        
        return merged
    
    def solve_and_merge(
        self,
        clusters: List[Dict[str, Any]],
        data: Any,
        solver_module: str = "core.solver",
        solver_class_name: str = "TimetableSolver",
        cluster_data_builder: Optional[Callable[[Dict[str, Any]], Dict[str, Any]]] = None,
        **solver_kwargs
    ) -> List[Dict[str, Any]]:
        """
        Convenience method to solve clusters and merge in one call.
        
        Args:
            clusters: List of cluster dictionaries.
            data: Original TimetableData for merging.
            solver_module: Module path for the solver class.
            solver_class_name: Name of the solver class.
            cluster_data_builder: Optional function to build sub-problem data.
            **solver_kwargs: Keyword arguments passed to solver.solve().
        
        Returns:
            Merged solution or error dict.
        """
        results = self.solve_clusters(
            clusters=clusters,
            solver_module=solver_module,
            solver_class_name=solver_class_name,
            cluster_data_builder=cluster_data_builder,
            **solver_kwargs
        )
        
        return self.merge_solutions(results, data)
