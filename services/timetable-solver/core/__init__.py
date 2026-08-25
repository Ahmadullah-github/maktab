"""Core solver components.

This module contains the core components of the timetable solver:
- TimetableSolver: Main solver class that orchestrates the solving process
- VariableManager: Manages CP-SAT variable creation with memory optimization
- SolutionBuilder: Builds solution output from solver results
"""

from .solution_builder import SolutionBuilder
from .solver import TimetableSolver
from .variables import VariableManager

__all__ = ["TimetableSolver", "VariableManager", "SolutionBuilder"]
