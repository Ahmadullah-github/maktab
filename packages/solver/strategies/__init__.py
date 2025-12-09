"""Solver strategies module."""
from .base import SolverStrategy
from .fast_solver import FastStrategy
from .balanced_solver import BalancedStrategy
from .thorough_solver import ThoroughStrategy

__all__ = [
    'SolverStrategy',
    'FastStrategy',
    'BalancedStrategy',
    'ThoroughStrategy',
]
