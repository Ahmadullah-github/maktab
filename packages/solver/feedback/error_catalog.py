# ==============================================================================
#
#  Error Catalog for Timetable Solver
#
#  Description:
#  Central registry of all error codes with message templates in Farsi and English.
#  This module defines the error contract between the solver, API, and UI.
#
#  Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.1, 7.2
#
# ==============================================================================

from enum import Enum
from typing import Dict, List

from pydantic import BaseModel


class ErrorSeverity(str, Enum):
    """Severity levels for solver feedback.
    
    - ERROR: Blocks timetable generation
    - WARNING: Allows proceed but indicates potential issues
    - INFO: Suggestion only, no impact on generation
    """
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ErrorCode(str, Enum):
    """Unique identifiers for all solver error types.
    
    Naming convention: CATEGORY_SPECIFIC_ERROR (e.g., TEACHER_OVERLOAD)
    Requirements: 7.1
    """
    # Teacher errors
    TEACHER_OVERLOAD = "TEACHER_OVERLOAD"
    TEACHER_AVAILABILITY_CONFLICT = "TEACHER_AVAILABILITY_CONFLICT"
    NO_QUALIFIED_TEACHER = "NO_QUALIFIED_TEACHER"
    TEACHER_OVERLOAD_PREDICTED = "TEACHER_OVERLOAD_PREDICTED"
    
    # Room errors
    ROOM_CONFLICT = "ROOM_CONFLICT"
    ROOM_CAPACITY_WARNING = "ROOM_CAPACITY_WARNING"
    
    # Class errors
    CLASS_PERIOD_SHORTAGE = "CLASS_PERIOD_SHORTAGE"
    
    # Solver errors
    NO_FEASIBLE_SOLUTION = "NO_FEASIBLE_SOLUTION"
    SOLVER_TIMEOUT = "SOLVER_TIMEOUT"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class ErrorDefinition(BaseModel):
    """Definition of an error type with message templates.
    
    Attributes:
        code: Unique error code identifier
        severity: Error severity level (error, warning, info)
        message_key: i18n lookup key for UI translation
        message_farsi_template: Farsi message template with {placeholders}
        message_english_template: English message template with {placeholders}
        required_context_keys: List of context keys required to format the message
    """
    code: ErrorCode
    severity: ErrorSeverity
    message_key: str
    message_farsi_template: str
    message_english_template: str
    required_context_keys: List[str]


# ==============================================================================
# Error Definitions Registry
# Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 7.2
# ==============================================================================

ERROR_DEFINITIONS: Dict[ErrorCode, ErrorDefinition] = {
    # -------------------------------------------------------------------------
    # Teacher Errors
    # -------------------------------------------------------------------------
    
    # Requirement 2.1: Teacher overload error
    ErrorCode.TEACHER_OVERLOAD: ErrorDefinition(
        code=ErrorCode.TEACHER_OVERLOAD,
        severity=ErrorSeverity.ERROR,
        message_key="error.teacher.overload",
        message_farsi_template=(
            "استاد {teacherName} بیشتر از {availablePeriods} ساعت در هفته "
            "تدریس نمیتواند، اما {requiredPeriods} ساعت نیاز است"
        ),
        message_english_template=(
            "Teacher {teacherName} cannot teach more than {availablePeriods} "
            "periods per week, but {requiredPeriods} periods are required"
        ),
        required_context_keys=["teacherName", "teacherId", "availablePeriods", "requiredPeriods"],
    ),
    
    # Pre-solve predicted teacher overload (Requirement 3.4)
    ErrorCode.TEACHER_OVERLOAD_PREDICTED: ErrorDefinition(
        code=ErrorCode.TEACHER_OVERLOAD_PREDICTED,
        severity=ErrorSeverity.ERROR,
        message_key="error.teacher.overload_predicted",
        message_farsi_template=(
            "استاد {teacherName} بیشتر از {availablePeriods} ساعت در هفته "
            "تدریس نمیتواند، اما {requiredPeriods} ساعت نیاز است"
        ),
        message_english_template=(
            "Teacher {teacherName} cannot teach more than {availablePeriods} "
            "periods per week, but {requiredPeriods} periods are required"
        ),
        required_context_keys=["teacherName", "teacherId", "availablePeriods", "requiredPeriods"],
    ),
    
    # Requirement 2.5: Teacher availability conflict
    ErrorCode.TEACHER_AVAILABILITY_CONFLICT: ErrorDefinition(
        code=ErrorCode.TEACHER_AVAILABILITY_CONFLICT,
        severity=ErrorSeverity.ERROR,
        message_key="error.teacher.availability_conflict",
        message_farsi_template=(
            "استاد {teacherName} در هیچ یک از ساعات مورد نیاز برای "
            "{subjectName} در دسترس نیست"
        ),
        message_english_template=(
            "Teacher {teacherName} is not available for any of the periods "
            "required for {subjectName}"
        ),
        required_context_keys=["teacherName", "teacherId", "subjectName", "subjectId"],
    ),
    
    # Requirement 2.4: No qualified teacher
    ErrorCode.NO_QUALIFIED_TEACHER: ErrorDefinition(
        code=ErrorCode.NO_QUALIFIED_TEACHER,
        severity=ErrorSeverity.ERROR,
        message_key="error.teacher.no_qualified",
        message_farsi_template=(
            "برای مضمون {subjectName} در صنف {className} استاد واجد شرایط وجود ندارد"
        ),
        message_english_template=(
            "No qualified teacher exists for subject {subjectName} in class {className}"
        ),
        required_context_keys=["subjectName", "subjectId", "className", "classId"],
    ),
    
    # -------------------------------------------------------------------------
    # Room Errors
    # -------------------------------------------------------------------------
    
    # Requirement 2.2: Room conflict
    ErrorCode.ROOM_CONFLICT: ErrorDefinition(
        code=ErrorCode.ROOM_CONFLICT,
        severity=ErrorSeverity.ERROR,
        message_key="error.room.conflict",
        message_farsi_template=(
            "اتاق {roomName} در {dayName} ساعت {periodNumber} دو صنف دارد: "
            "{class1Name} و {class2Name}"
        ),
        message_english_template=(
            "Room {roomName} has two classes at {dayName} period {periodNumber}: "
            "{class1Name} and {class2Name}"
        ),
        required_context_keys=[
            "roomName", "roomId", "dayName", "periodNumber",
            "class1Name", "class1Id", "class2Name", "class2Id"
        ],
    ),
    
    # Requirement 3.5: Room capacity warning
    ErrorCode.ROOM_CAPACITY_WARNING: ErrorDefinition(
        code=ErrorCode.ROOM_CAPACITY_WARNING,
        severity=ErrorSeverity.WARNING,
        message_key="warning.room.capacity",
        message_farsi_template=(
            "ظرفیت اتاق‌ها ممکن است کافی نباشد: {requiredPeriods} ساعت نیاز، "
            "{availablePeriods} ساعت موجود"
        ),
        message_english_template=(
            "Room capacity may be insufficient: {requiredPeriods} periods required, "
            "{availablePeriods} periods available"
        ),
        required_context_keys=["requiredPeriods", "availablePeriods"],
    ),
    
    # -------------------------------------------------------------------------
    # Class Errors
    # -------------------------------------------------------------------------
    
    # Requirement 2.3: Class period shortage
    ErrorCode.CLASS_PERIOD_SHORTAGE: ErrorDefinition(
        code=ErrorCode.CLASS_PERIOD_SHORTAGE,
        severity=ErrorSeverity.ERROR,
        message_key="error.class.period_shortage",
        message_farsi_template=(
            "صنف {className} به {requiredHours} ساعت نیاز دارد اما فقط "
            "{availableHours} ساعت موجود است"
        ),
        message_english_template=(
            "Class {className} requires {requiredHours} hours but only "
            "{availableHours} hours are available"
        ),
        required_context_keys=["className", "classId", "requiredHours", "availableHours"],
    ),
    
    # -------------------------------------------------------------------------
    # Solver Errors
    # -------------------------------------------------------------------------
    
    # Requirement 2.6: No feasible solution
    ErrorCode.NO_FEASIBLE_SOLUTION: ErrorDefinition(
        code=ErrorCode.NO_FEASIBLE_SOLUTION,
        severity=ErrorSeverity.ERROR,
        message_key="error.solver.no_feasible_solution",
        message_farsi_template=(
            "با محدودیت‌های فعلی امکان ایجاد جدول زمانی وجود ندارد. "
            "لطفاً محدودیت‌ها را بررسی کنید"
        ),
        message_english_template=(
            "No valid timetable can be created with the current constraints. "
            "Please review the constraints"
        ),
        required_context_keys=[],
    ),
    
    # Solver timeout
    ErrorCode.SOLVER_TIMEOUT: ErrorDefinition(
        code=ErrorCode.SOLVER_TIMEOUT,
        severity=ErrorSeverity.ERROR,
        message_key="error.solver.timeout",
        message_farsi_template=(
            "زمان حل از حد مجاز ({timeoutSeconds} ثانیه) گذشت. "
            "لطفاً محدودیت‌ها را ساده‌تر کنید یا زمان را افزایش دهید"
        ),
        message_english_template=(
            "Solver exceeded time limit ({timeoutSeconds} seconds). "
            "Please simplify constraints or increase the time limit"
        ),
        required_context_keys=["timeoutSeconds"],
    ),
    
    # Requirement 7.5: Internal error (unknown errors)
    ErrorCode.INTERNAL_ERROR: ErrorDefinition(
        code=ErrorCode.INTERNAL_ERROR,
        severity=ErrorSeverity.ERROR,
        message_key="error.solver.internal",
        message_farsi_template="خطای داخلی رخ داد. لطفاً دوباره تلاش کنید",
        message_english_template="An internal error occurred. Please try again",
        required_context_keys=[],
    ),
}
