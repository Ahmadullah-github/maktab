"""
Decomposition solver for large timetabling problems.

Breaks problems into smaller sub-problems, solves them independently,
then merges the solutions.
"""

from .decomposition_solver import DecompositionSolver
from .cluster_builder import ClassClusterBuilder
from .solution_merger import SolutionMerger

__all__ = [
    'DecompositionSolver',
    'ClassClusterBuilder',
    'SolutionMerger'
]
