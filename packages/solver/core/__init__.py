"""Core solver components.

This module contains the core components of the timetable solver:
- TimetableSolver: Main solver class that orchestrates the solving process
- VariableManager: Manages CP-SAT variable creation with memory optimization
- SolutionBuilder: Builds solution output from solver results
"""

from .variables import VariableManager
from .solution_builder import SolutionBuilder
from .solver import TimetableSolver

__all__ = ['TimetableSolver', 'VariableManager', 'SolutionBuilder']
