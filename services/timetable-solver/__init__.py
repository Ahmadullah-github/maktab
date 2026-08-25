"""
Timetable Solver Package

A modular constraint-based timetable solver for educational institutions.
Uses Google OR-Tools CP-SAT solver with Pydantic data validation.

Main Components:
- TimetableSolver: Main solver class
- Configuration system with YAML support
- Constraint plugin system
- Parallel solving for large problems
- Memory management and metrics export

Usage:
    from solver import TimetableSolver
    from solver.config import ConfigLoader

    config = ConfigLoader.load()
    solver = TimetableSolver(input_data, config)
    solution = solver.solve()
"""

import sys
from pathlib import Path

# Add the solver package directory to sys.path for absolute imports
_solver_path = Path(__file__).parent
if str(_solver_path) not in sys.path:
    sys.path.insert(0, str(_solver_path))

if __package__:
    from .config import ConfigLoader, SolverConfig
    from .constraints import ConstraintRegistry, ConstraintStage
    from .core import SolutionBuilder, TimetableSolver, VariableManager
    from .models import TimetableData
    from .solver import main, solve_with_decomposition_if_beneficial
else:
    # Pytest imports this file as top-level ``__init__`` because the directory name
    # contains a hyphen. Keep the documented root-level test command working.
    from config import ConfigLoader, SolverConfig
    from constraints import ConstraintRegistry, ConstraintStage
    from core import SolutionBuilder, TimetableSolver, VariableManager
    from models import TimetableData
    from solver import main, solve_with_decomposition_if_beneficial

__version__ = "2.0.0"
__author__ = "Ahmadullah Ahmadi"

__all__ = [
    # Core components
    "TimetableSolver",
    "VariableManager",
    "SolutionBuilder",
    # Configuration
    "ConfigLoader",
    "SolverConfig",
    # Data models
    "TimetableData",
    # Constraints
    "ConstraintRegistry",
    "ConstraintStage",
    # Entry point functions
    "solve_with_decomposition_if_beneficial",
    "main",
    # Metadata
    "__version__",
    "__author__",
]
