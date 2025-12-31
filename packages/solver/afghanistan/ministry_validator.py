# ==============================================================================
#
#  Ministry of Education Validator for Afghanistan Schools
#
#  Description:
#  Provides optional validation of curriculum against Afghanistan Ministry of
#  Education requirements. Supports warn, strict, and off modes.
#  
#  Now supports school-specific curriculum customizations via CurriculumProvider.
#
#  Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
#
# ==============================================================================

from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field

from .curriculum import CurriculumProvider, get_grade_category, get_expected_periods


# ==============================================================================
# Enums
# ==============================================================================

class ValidationMode(str, Enum):
    """
    Ministry validation enforcement mode.
    
    - WARN: Return warnings without blocking timetable generation
    - STRICT: Block timetable generation if requirements not met
    - OFF: Skip all Ministry curriculum checks
    
    Requirements: 2.1, 2.2, 2.3
    """
    WARN = "warn"
    STRICT = "strict"
    OFF = "off"


# ==============================================================================
# Result Model
# ==============================================================================

class MinistryValidationResult(BaseModel):
    """
    Result of Ministry curriculum validation.
    
    Attributes:
        is_compliant: Whether the curriculum meets Ministry requirements
        warnings: List of warning messages (non-blocking)
        errors: List of error messages (blocking in strict mode)
        
    Requirements: 2.1, 2.2, 2.3
    """
    is_compliant: bool = Field(
        default=True,
        description="Whether the curriculum meets Ministry requirements"
    )
    warnings: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of warning messages"
    )
    errors: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="List of error messages"
    )


# ==============================================================================
# Validator Class
# ==============================================================================

class MinistryValidator:
    """
    Validator for Afghanistan Ministry of Education curriculum requirements.
    
    This validator checks if class schedules meet the minimum subject hours
    required by the Ministry for each grade category.
    
    Now supports school-specific curriculum customizations via CurriculumProvider.
    When custom curriculum is provided from the API, it uses those requirements
    instead of the default ministry curriculum.
    
    Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
    
    Example:
        >>> validator = MinistryValidator(enabled=True, mode=ValidationMode.WARN)
        >>> result = validator.validate(solver_data)
        >>> if not result.is_compliant:
        ...     print(result.warnings)
    """
    
    def __init__(
        self,
        enabled: bool = False,
        mode: ValidationMode = ValidationMode.WARN,
        custom_curriculum: bool = False,
        curriculum_data: Optional[Dict[str, Any]] = None
    ):
        """
        Initialize the Ministry validator.
        
        Args:
            enabled: Whether Ministry validation is active
            mode: Validation mode (WARN, STRICT, or OFF)
            custom_curriculum: Whether custom curriculum mode is enabled
                              (skips Ministry validation)
            curriculum_data: Optional school-specific curriculum from API
        """
        self.enabled = enabled
        self.mode = mode
        self.custom_curriculum = custom_curriculum
        self.curriculum_provider = CurriculumProvider(curriculum_data)
    
    def validate(self, data: Dict[str, Any]) -> MinistryValidationResult:
        """
        Validate curriculum against Ministry requirements.
        
        When Ministry validation is disabled, custom curriculum mode is enabled,
        or mode is OFF, returns a compliant result with no warnings/errors.
        
        Args:
            data: Solver input data containing classes and subjects
            
        Returns:
            MinistryValidationResult with compliance status and any warnings/errors
            
        Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
        """
        # Skip validation if disabled, custom curriculum, or mode is OFF
        if not self.enabled or self.custom_curriculum or self.mode == ValidationMode.OFF:
            return MinistryValidationResult(is_compliant=True, warnings=[], errors=[])
        
        warnings: List[Dict[str, Any]] = []
        errors: List[Dict[str, Any]] = []
        
        # Build subject lookup map
        subjects = {s.get('id'): s for s in data.get('subjects', [])}
        
        # Check each class
        for cls in data.get('classes', []):
            grade_level = cls.get('gradeLevel')
            category = cls.get('category')
            
            if not grade_level and not category:
                continue
            
            # Get curriculum requirements for this grade
            if grade_level:
                curriculum_subjects = self.curriculum_provider.get_subjects_for_grade(grade_level)
            else:
                # Fallback to category-based lookup (legacy)
                continue
            
            subject_reqs = cls.get('subjectRequirements', {})
            
            for curriculum_subj in curriculum_subjects:
                subject_name = curriculum_subj.get('name')
                subject_name_en = curriculum_subj.get('nameEn', subject_name)
                min_periods = curriculum_subj.get('periodsPerWeek', 0)
                is_core = curriculum_subj.get('isCore', False)
                
                # Find configured periods for this subject
                configured_periods = self._find_subject_periods(
                    subject_reqs, subject_name, subjects
                )
                
                if configured_periods < min_periods:
                    class_name = cls.get('name', cls.get('id', 'نامشخص'))
                    
                    # Core subjects are errors in strict mode, others are warnings
                    severity = 'error' if (self.mode == ValidationMode.STRICT and is_core) else 'warning'
                    
                    issue = {
                        'type': 'MINISTRY_SUBJECT_HOURS',
                        'severity': severity,
                        'className': class_name,
                        'classId': cls.get('id'),
                        'gradeLevel': grade_level,
                        'subjectName': subject_name,
                        'subjectNameEn': subject_name_en,
                        'isCore': is_core,
                        'requiredPeriods': min_periods,
                        'configuredPeriods': configured_periods,
                        'messageFarsi': (
                            f"صنف {class_name}: مضمون {subject_name} حداقل "
                            f"{min_periods} ساعت نیاز دارد، اما {configured_periods} ساعت تنظیم شده"
                        ),
                        'messageEnglish': (
                            f"Class {class_name}: {subject_name_en} requires minimum "
                            f"{min_periods} periods, but {configured_periods} configured"
                        )
                    }
                    
                    if severity == 'error':
                        errors.append(issue)
                    else:
                        warnings.append(issue)
            
            # Check total periods for the grade
            if grade_level:
                expected_total = get_expected_periods(grade_level)
                actual_total = sum(
                    req.get('periodsPerWeek', 0) if isinstance(req, dict) else getattr(req, 'periodsPerWeek', 0)
                    for req in subject_reqs.values()
                )
                
                if actual_total != expected_total:
                    class_name = cls.get('name', cls.get('id', 'نامشخص'))
                    severity = 'error' if self.mode == ValidationMode.STRICT else 'warning'
                    
                    issue = {
                        'type': 'TOTAL_PERIODS_MISMATCH',
                        'severity': severity,
                        'className': class_name,
                        'classId': cls.get('id'),
                        'gradeLevel': grade_level,
                        'expectedPeriods': expected_total,
                        'actualPeriods': actual_total,
                        'difference': expected_total - actual_total,
                        'messageFarsi': (
                            f"صنف {class_name}: مجموع ساعات ({actual_total}) با استندرد "
                            f"({expected_total}) مطابقت ندارد"
                        ),
                        'messageEnglish': (
                            f"Class {class_name}: Total periods ({actual_total}) doesn't match "
                            f"expected ({expected_total})"
                        )
                    }
                    
                    if severity == 'error':
                        errors.append(issue)
                    else:
                        warnings.append(issue)
        
        is_compliant = len(errors) == 0
        
        return MinistryValidationResult(
            is_compliant=is_compliant,
            warnings=warnings,
            errors=errors
        )
    
    def _find_subject_periods(
        self,
        subject_reqs: Dict[str, Any],
        subject_name: str,
        subjects: Dict[str, Dict[str, Any]]
    ) -> int:
        """
        Find configured periods for a subject by name.
        
        Args:
            subject_reqs: Subject requirements from the class
            subject_name: Name of the subject to find (in Farsi)
            subjects: Map of subject ID to subject data
            
        Returns:
            Number of periods configured for the subject, or 0 if not found
        """
        for subj_id, req in subject_reqs.items():
            subj = subjects.get(subj_id, {})
            if subj.get('name') == subject_name:
                if isinstance(req, dict):
                    return req.get('periodsPerWeek', 0)
                else:
                    return getattr(req, 'periodsPerWeek', 0)
        
        return 0
    
    @classmethod
    def from_solver_config(cls, config: Dict[str, Any]) -> 'MinistryValidator':
        """
        Create a MinistryValidator from solver configuration dictionary.
        
        Args:
            config: Solver configuration dictionary with optional keys:
                - enableMinistryValidation: bool
                - ministryValidationMode: str ("warn", "strict", "off")
                - customCurriculumMode: bool
                - curriculum: dict (school-specific curriculum from API)
                
        Returns:
            MinistryValidator instance configured from the dictionary
        """
        enabled = config.get('enableMinistryValidation', False)
        mode_str = config.get('ministryValidationMode', 'warn')
        custom_curriculum = config.get('customCurriculumMode', False)
        curriculum_data = config.get('curriculum')
        
        try:
            mode = ValidationMode(mode_str)
        except ValueError:
            mode = ValidationMode.WARN
        
        return cls(
            enabled=enabled,
            mode=mode,
            custom_curriculum=custom_curriculum,
            curriculum_data=curriculum_data
        )
