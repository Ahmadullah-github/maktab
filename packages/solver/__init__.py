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

# Core solver components
from .core import TimetableSolver, VariableManager, SolutionBuilder

# Configuration system
from .config import ConfigLoader, SolverConfig

# Data models
from .models import TimetableData

# Constraint system
from .constraints import ConstraintRegistry, ConstraintStage

# For backward compatibility, expose the main solve function
from .solver import solve_with_decomposition_if_beneficial, main

__version__ = "2.0.0"
__author__ = "Ahmadullah Ahmadi"

__all__ = [
    # Core components
    'TimetableSolver',
    'VariableManager', 
    'SolutionBuilder',
    
    # Configuration
    'ConfigLoader',
    'SolverConfig',
    
    # Data models
    'TimetableData',
    
    # Constraints
    'ConstraintRegistry',
    'ConstraintStage',
    
    # Entry point functions
    'solve_with_decomposition_if_beneficial',
    'main',
    
    # Metadata
    '__version__',
    '__author__'
]