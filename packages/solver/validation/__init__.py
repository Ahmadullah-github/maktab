# ==============================================================================
#
#  Validation Module for Timetable Solver
#
#  Description:
#  This module contains validation functions for timetable input data.
#  Each submodule handles a specific aspect of validation.
#
# ==============================================================================

from .period_config import validate_period_configuration
from .teacher_availability import validate_teacher_availability_structure
from .subject_references import validate_subject_references, validate_custom_subjects

__all__ = [
    'validate_period_configuration',
    'validate_teacher_availability_structure',
    'validate_subject_references',
    'validate_custom_subjects',
]
