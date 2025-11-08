# ==============================================================================
#
#  Enhanced Production-Ready Automated Timetable Solver
#
#  Description:
#  This script combines Pydantic data models for robust validation and a
#  Google OR-Tools (CP-SAT) solver to tackle the school timetabling problem.
#  Enhanced with better optimization algorithms and improved constraint handling.
#
#  Author: Enhanced by Qoder AI
#  Version: 2.0
#  Date: October 12, 2025
#
# ==============================================================================

import sys
import json
import collections
import math
import re
from enum import Enum
from typing import List, Dict, Optional, Any, Union

# --- Third-party libraries ---
try:
    from pydantic import BaseModel, Field, validator, model_validator
    from ortools.sat.python import cp_model
    import structlog
    # Import strategy system
    from strategies import FastStrategy, BalancedStrategy, ThoroughStrategy
    # Import Phase 3 optimization utilities
    from utils import (
        ConstraintBudget, ConstraintPriority,
        ProgressiveConstraintManager, ConstraintStage,
        determine_problem_complexity, DomainFilter
    )
    # Import Phase 4 decomposition solver
    from decomposition import DecompositionSolver
except ImportError as e:
    print(
        f"ERROR: Missing required libraries. Please install them via pip:\n"
        f"pip install pydantic google-ortools structlog\n"
        f"Import error: {e}",
        file=sys.stderr
    )
    sys.exit(1)


# ==============================================================================
# 1. PYDANTIC DATA MODELS (Defines the data contract)
#    - This section mirrors the Zod schema for identical validation.
# ==============================================================================

# --------------------
# Primitives & Enums
# --------------------

class DayOfWeek(str, Enum):
    MONDAY = 'Monday'
    TUESDAY = 'Tuesday'
    WEDNESDAY = 'Wednesday'
    THURSDAY = 'Thursday'
    FRIDAY = 'Friday'
    SATURDAY = 'Saturday'
    SUNDAY = 'Sunday'

TIME_REGEX = r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
ISO_DATE_REGEX = r'^\d{4}-\d{2}-\d{2}$'

# --------------------
# Sub-Models
# --------------------

class Period(BaseModel):
    index: int = Field(ge=0)
    startTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    endTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    duration: Optional[int] = Field(default=None, gt=0)  # Add duration field
    isBreak: Optional[bool] = Field(default=False)  # Add break indicator
    shift: Optional[str] = Field(default=None)  # Shift identifier for multi-shift support

class UnavailableSlot(BaseModel):
    day: Union[DayOfWeek, str]
    periods: List[int]

class BreakPeriodConfig(BaseModel):
    afterPeriod: int = Field(ge=1, le=11)  # Break after period N
    duration: int = Field(ge=0, le=120)    # 0 = no break

class GlobalConfig(BaseModel):
    daysOfWeek: List[DayOfWeek] = Field(min_length=1)
    
    # NEW: Dynamic periods per day (Req 6-7) - Different periods for different days
    periodsPerDayMap: Optional[Dict[DayOfWeek, int]] = Field(default=None)
    
    # OLD: Keep for backward compatibility
    periodsPerDay: int = Field(gt=0)
    
    schoolStartTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    periodDurationMinutes: Optional[int] = Field(default=None, gt=0)
    periods: Optional[List[Period]] = None
    breakPeriods: Optional[List[BreakPeriodConfig]] = Field(default=None)  # Changed type
    prayerBreaks: Optional[List[UnavailableSlot]] = Field(default=None)  # Prayer/respect breaks
    timezone: Optional[str] = Field(default=None)
    # Performance optimization settings
    solverTimeLimitSeconds: Optional[int] = Field(default=600, ge=1)
    solverOptimizationLevel: Optional[int] = Field(default=2, ge=0, le=2)
    enableGracefulDegradation: Optional[bool] = Field(default=True)
    # Gender separation support
    enforceGenderSeparation: Optional[bool] = Field(default=False)  # Enable gender separation constraints
    # Multi-shift support
    shifts: Optional[List[Dict[str, Any]]] = Field(default=None)  # Shift definitions with start/end times
    
    @model_validator(mode='after')
    def ensure_periods_format(self):
        """Convert between old and new period formats for backward compatibility (Req 6)."""
        # If old format only, convert to new
        if not self.periodsPerDayMap and self.periodsPerDay:
            self.periodsPerDayMap = {
                day: self.periodsPerDay 
                for day in self.daysOfWeek
            }
        
        # If new format only, set periodsPerDay for compatibility
        if self.periodsPerDayMap and not self.periodsPerDay:
            self.periodsPerDay = max(self.periodsPerDayMap.values())
        
        # Validate new format if present
        if self.periodsPerDayMap:
            for day in self.daysOfWeek:
                if day not in self.periodsPerDayMap:
                    raise ValueError(f"periodsPerDayMap missing entry for {day.value}")
                periods = self.periodsPerDayMap[day]
                if not 1 <= periods <= 12:
                    raise ValueError(f"{day.value}: periods must be 1-12, got {periods}")
        
        return self

class GlobalPreferences(BaseModel):
    avoidTeacherGapsWeight: float = Field(default=1.0, ge=0)
    avoidClassGapsWeight: float = Field(default=1.0, ge=0)
    distributeDifficultSubjectsWeight: float = Field(default=0.8, ge=0)
    balanceTeacherLoadWeight: float = Field(default=0.7, ge=0)
    minimizeRoomChangesWeight: float = Field(default=0.3, ge=0)
    preferMorningForDifficultWeight: float = Field(default=0.5, ge=0)
    respectTeacherTimePreferenceWeight: float = Field(default=0.5, ge=0)
    respectTeacherRoomPreferenceWeight: float = Field(default=0.2, ge=0)
    allowConsecutivePeriodsForSameSubject: bool = True
    # New soft objectives
    avoidFirstLastPeriodWeight: float = Field(default=0.0, ge=0)
    subjectSpreadWeight: float = Field(default=0.0, ge=0)

class Room(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    capacity: int = Field(ge=0)
    type: str
    features: Optional[List[str]] = Field(default=None)
    unavailable: Optional[List[UnavailableSlot]] = Field(default=None)
    meta: Optional[Dict[str, Any]] = Field(default=None)

class Subject(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    code: Optional[str] = Field(default=None)
    requiredRoomType: Optional[Union[str, None]] = Field(default=None)
    requiredFeatures: Optional[List[str]] = Field(default=None)
    desiredFeatures: Optional[List[str]] = Field(default=None)
    isDifficult: Optional[bool] = Field(default=None)
    minRoomCapacity: Optional[int] = Field(default=None, ge=0)
    
    # NEW: Custom subject flag (Req 5) - Beyond default curriculum
    isCustom: bool = Field(default=False)
    customCategory: Optional[str] = Field(default=None)  # For which grade category
    
    meta: Optional[Dict[str, Any]] = Field(default=None)

class TimePreference(str, Enum):
    MORNING = 'Morning'
    AFTERNOON = 'Afternoon'
    NONE = 'None'

class Teacher(BaseModel):
    id: str = Field(min_length=1)
    fullName: str = Field(min_length=1)
    primarySubjectIds: List[str] = Field(min_length=1)
    allowedSubjectIds: Optional[List[str]] = Field(default=None)
    restrictToPrimarySubjects: Optional[bool] = Field(default=None)
    availability: Dict[DayOfWeek, List[bool]]
    unavailable: Optional[List[UnavailableSlot]] = Field(default=None)
    maxPeriodsPerWeek: int = Field(ge=0)
    maxPeriodsPerDay: Optional[int] = Field(default=None, ge=0)
    maxConsecutivePeriods: Optional[int] = Field(default=None, ge=0)
    timePreference: Optional[TimePreference] = Field(default=None)
    preferredRoomIds: Optional[List[str]] = Field(default=None)
    preferredColleagues: Optional[List[str]] = Field(default=None)  # New field for collaboration preferences
    meta: Optional[Dict[str, Any]] = Field(default=None)
    
    # Gender separation support
    gender: Optional[str] = Field(default=None)  # e.g., "male", "female", "mixed"

class SubjectRequirement(BaseModel):
    periodsPerWeek: int = Field(ge=0)
    minConsecutive: Optional[int] = Field(None, gt=0)
    maxConsecutive: Optional[int] = Field(None, gt=0)
    minDaysPerWeek: Optional[int] = Field(None, gt=0)
    maxDaysPerWeek: Optional[int] = Field(None, gt=0)

class ClassGroup(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    studentCount: int = Field(ge=0)
    subjectRequirements: Dict[str, SubjectRequirement]
    fixedRoomId: Optional[str] = Field(default=None)  # Lock class to specific room (hard constraint)
    
    # NEW: Single-teacher mode (Req 2-3) - One teacher for all subjects
    singleTeacherMode: bool = Field(default=False)
    classTeacherId: Optional[str] = Field(default=None)
    
    # NEW: Grade classification (Req 1) - Afghanistan education system
    gradeLevel: Optional[int] = Field(default=None, ge=1, le=12)
    category: Optional[str] = Field(default=None)  # Auto-determined if gradeLevel set
    
    meta: Optional[Dict[str, Any]] = Field(None)
    
    # Gender separation support
    gender: Optional[str] = Field(default=None)  # e.g., "male", "female", "mixed"
    
    @model_validator(mode='after')
    def determine_category(self):
        """Auto-determine category from gradeLevel (Req 1)."""
        if self.gradeLevel and not self.category:
            if 1 <= self.gradeLevel <= 3:
                self.category = "Alpha-Primary"
            elif 4 <= self.gradeLevel <= 6:
                self.category = "Beta-Primary"
            elif 7 <= self.gradeLevel <= 9:
                self.category = "Middle"
            elif 10 <= self.gradeLevel <= 12:
                self.category = "High"
        return self

class SchoolEvent(BaseModel):
    id: Optional[str] = Field(default=None, min_length=1)
    name: str = Field(min_length=1)
    day: Union[DayOfWeek, str]
    periods: List[int]
    startDate: Optional[str] = Field(default=None, pattern=ISO_DATE_REGEX)
    endDate: Optional[str] = Field(default=None, pattern=ISO_DATE_REGEX)
    appliesToClassIds: Optional[List[str]] = Field(default=None)
    meta: Optional[Dict[str, Any]] = Field(default=None)

class BaseLesson(BaseModel):
    day: DayOfWeek
    periodIndex: int = Field(ge=0)
    classId: str = Field(min_length=1)
    subjectId: str = Field(min_length=1)
    teacherIds: List[str] = Field(default_factory=list, min_length=1)
    roomId: Optional[str] = Field(default=None, min_length=1)

class FixedLesson(BaseLesson):
    id: Optional[str] = Field(None, min_length=1)
    createdBy: Optional[str] = None
    note: Optional[str] = None

# --------------------
# Main TimetableData Schema
# --------------------

class TimetableData(BaseModel):
    class Meta(BaseModel):
        academicYear: Optional[str] = Field(default=None)
        term: Optional[str] = Field(default=None)
        createdAt: Optional[str] = Field(default=None)
        version: Optional[str] = Field(default=None)

    meta: Optional[Meta] = Field(default=None)
    config: GlobalConfig
    preferences: Optional[GlobalPreferences] = Field(default=None)
    rooms: List[Room] = Field(min_length=1)
    subjects: List[Subject] = Field(min_length=1)
    teachers: List[Teacher] = Field(min_length=1)
    classes: List[ClassGroup] = Field(min_length=1)
    fixedLessons: Optional[List[FixedLesson]] = Field(default=None)
    schoolEvents: Optional[List[SchoolEvent]] = Field(default=None)

    # ========== CHUNK 2: NEW VALIDATION METHODS ==========
    
    def validate_period_configuration(self):
        """Validate period configuration consistency (Req 6) - Task 2.1."""
        cfg = self.config
        
        # Check periodsPerDayMap completeness
        if cfg.periodsPerDayMap:
            for day in cfg.daysOfWeek:
                if day not in cfg.periodsPerDayMap:
                    raise ValueError(
                        f"Period Configuration Error: Missing period count for {day.value}. "
                        f"Please specify periods for all enabled days."
                    )
                
                periods = cfg.periodsPerDayMap[day]
                if not 1 <= periods <= 12:
                    raise ValueError(
                        f"Period Configuration Error: {day.value} has {periods} periods. "
                        f"Must be between 1 and 12."
                    )
        
        return self
    
    def validate_teacher_availability_structure(self):
        """Validate teacher availability matches period config (Req 8) - Task 2.2."""
        cfg = self.config
        
        for teacher in self.teachers:
            for day in cfg.daysOfWeek:
                day_str = day.value if isinstance(day, DayOfWeek) else str(day)
                
                if day_str not in teacher.availability:
                    raise ValueError(
                        f"Teacher Availability Error: Teacher '{teacher.fullName}' (ID: {teacher.id}) "
                        f"is missing availability for {day_str}."
                    )
                
                expected_periods = cfg.periodsPerDayMap.get(day, cfg.periodsPerDay)
                actual_periods = len(teacher.availability[day_str])
                
                if actual_periods != expected_periods:
                    raise ValueError(
                        f"Teacher Availability Error: Teacher '{teacher.fullName}' "
                        f"has {actual_periods} periods for {day_str} "
                        f"but configuration expects {expected_periods}. "
                        f"Please update teacher availability to match period configuration."
                    )
        
        return self
    
    def validate_subject_references(self):
        """Enhanced validation including custom subjects (Req 5) - Task 2.3."""
        subject_ids = {s.id for s in self.subjects}
        
        for cls in self.classes:
            for subject_id in cls.subjectRequirements.keys():
                if subject_id not in subject_ids:
                    # Find if it's a typo - suggest similar subjects
                    similar = [s for s in subject_ids if subject_id.lower() in s.lower()]
                    suggestion = f" Did you mean: {similar[0]}?" if similar else ""
                    
                    raise ValueError(
                        f"Subject Reference Error: Class '{cls.name}' (ID: {cls.id}) "
                        f"references unknown subject '{subject_id}'.{suggestion}"
                    )
        
        return self
    
    def validate_custom_subjects(self):
        """Validate custom subjects are properly configured (Req 5) - Task 4.2."""
        valid_categories = ["Alpha-Primary", "Beta-Primary", "Middle", "High"]
        
        for subject in self.subjects:
            if subject.isCustom:
                # Custom subjects should have valid category if specified
                if subject.customCategory:
                    if subject.customCategory not in valid_categories:
                        raise ValueError(
                            f"Custom Subject Error: Subject '{subject.name}' (ID: {subject.id}) "
                            f"has invalid customCategory '{subject.customCategory}'. "
                            f"Valid values: {', '.join(valid_categories)}"
                        )
        
        return self
    
    # ========== END CHUNK 2 VALIDATIONS ==========

    @model_validator(mode='after')
    def validate_all_cross_references(self):
        """Performs complex cross-field validations equivalent to Zod's superRefine."""
        cfg = self.config
        teachers, rooms, subjects, classes = self.teachers, self.rooms, self.subjects, self.classes
        fixed_lessons, school_events = self.fixedLessons, self.schoolEvents
        periods_per_day = cfg.periodsPerDay

        # CHUNK 2: NEW VALIDATIONS (called first for better error messages)
        self.validate_period_configuration()
        self.validate_teacher_availability_structure()
        self.validate_subject_references()
        
        # CHUNK 4: Custom subject validation
        self.validate_custom_subjects()
        
        # --- Sub-validator for referential integrity ---
        subject_ids = {s.id for s in subjects}
        teacher_ids = {t.id for t in teachers}
        room_ids = {r.id for r in rooms}
        class_ids = {c.id for c in classes}

        # Validate teacher subject references (primary subjects)
        for i, teacher in enumerate(teachers):
            for sid in teacher.primarySubjectIds:
                if sid not in subject_ids:
                    raise ValueError(f"Teacher '{teacher.id}' has unknown primarySubjectId '{sid}' — please check subject definitions")

        # Validate fixed lessons
        if fixed_lessons:
            for i, lesson in enumerate(fixed_lessons):
                if lesson.classId not in class_ids:
                    raise ValueError(f"Fixed lesson {i} has unknown classId '{lesson.classId}' — please check class definitions")
                if lesson.subjectId not in subject_ids:
                    raise ValueError(f"Fixed lesson {i} has unknown subjectId '{lesson.subjectId}' — please check subject definitions")
                if lesson.roomId and lesson.roomId not in room_ids:
                    raise ValueError(f"Fixed lesson {i} has unknown roomId '{lesson.roomId}' — please check room definitions")
                for tid in lesson.teacherIds:
                    if tid not in teacher_ids:
                        raise ValueError(f"Fixed lesson {i} has unknown teacherId '{tid}' — please check teacher definitions")

        return self

# ==============================================================================
# 2. LOGGING, HELPERS, AND SOLVER IMPLEMENTATION
# ==============================================================================

# ========== CHUNK 3: GRADE CATEGORY HELPERS ==========

# Category mapping constants (Req 1: Four-category grade classification)
CATEGORY_DARI_NAMES = {
    "Alpha-Primary": "ابتداییه دوره اول",
    "Beta-Primary": "ابتداییه دوره دوم",
    "Middle": "متوسطه",
    "High": "لیسه"
}

def get_category_from_grade(grade: int) -> str:
    """Determine category from grade level (Req 1)."""
    if 1 <= grade <= 3:
        return "Alpha-Primary"
    elif 4 <= grade <= 6:
        return "Beta-Primary"
    elif 7 <= grade <= 9:
        return "Middle"
    elif 10 <= grade <= 12:
        return "High"
    else:
        raise ValueError(f"Invalid grade level: {grade}. Must be 1-12.")

def get_category_dari_name(category: str) -> str:
    """Get Dari name for category (Req 1)."""
    return CATEGORY_DARI_NAMES.get(category, category)

def enhance_solution_with_metadata(solution: List[Dict], data: 'TimetableData') -> Dict[str, Any]:
    """
    Enhance solution with metadata including category information (Req 1).
    
    Args:
        solution: List of scheduled lessons
        data: TimetableData object with class information
    
    Returns:
        Dictionary with 'schedule' and 'metadata' keys
    """
    # Build class metadata with category information
    class_metadata = []
    for cls in data.classes:
        class_info = {
            "classId": cls.id,
            "className": cls.name,
            "gradeLevel": cls.gradeLevel,
            "category": cls.category,
            "categoryDari": get_category_dari_name(cls.category) if cls.category else None,
            "studentCount": cls.studentCount,
            "singleTeacherMode": cls.singleTeacherMode,
            "classTeacherId": cls.classTeacherId if cls.singleTeacherMode else None
        }
        class_metadata.append(class_info)
    
    # Build subject metadata
    subject_metadata = []
    for subj in data.subjects:
        subject_info = {
            "subjectId": subj.id,
            "subjectName": subj.name,
            "isCustom": subj.isCustom,
            "customCategory": subj.customCategory
        }
        subject_metadata.append(subject_info)
    
    # Calculate period configuration
    period_config = {
        "periodsPerDayMap": {day.value: periods for day, periods in data.config.periodsPerDayMap.items()} if data.config.periodsPerDayMap else {},
        "totalPeriodsPerWeek": sum(data.config.periodsPerDayMap.values()) if data.config.periodsPerDayMap else len(data.config.daysOfWeek) * data.config.periodsPerDay
    }
    
    # Build statistics
    statistics = {
        "totalClasses": len(data.classes),
        "singleTeacherClasses": sum(1 for c in data.classes if c.singleTeacherMode),
        "multiTeacherClasses": sum(1 for c in data.classes if not c.singleTeacherMode),
        "customSubjects": sum(1 for s in data.subjects if s.isCustom),
        "categoryCounts": {
            "Alpha-Primary": sum(1 for c in data.classes if c.category == "Alpha-Primary"),
            "Beta-Primary": sum(1 for c in data.classes if c.category == "Beta-Primary"),
            "Middle": sum(1 for c in data.classes if c.category == "Middle"),
            "High": sum(1 for c in data.classes if c.category == "High")
        },
        "totalLessons": len(solution)
    }
    
    return {
        "schedule": solution,
        "metadata": {
            "classes": class_metadata,
            "subjects": subject_metadata,
            "periodConfiguration": period_config,
            "statistics": statistics
        }
    }

# ========== END CHUNK 3 GRADE CATEGORY HELPERS ==========

# --- Logging Configuration ---
structlog.configure(
    processors=[
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    logger_factory=structlog.PrintLoggerFactory(file=sys.stderr),  # Log to stderr, not stdout
)
log = structlog.get_logger()

# --- Progress Reporter ---
class ProgressReporter:
    """Reports progress updates during solver execution."""
    
    def __init__(self, enabled=True):
        self.enabled = enabled
        self.current_stage = ""
        self.current_progress = 0
    
    def report(self, stage: str, progress: int, message: str, details: Optional[Dict[str, Any]] = None):
        """Emit a progress event to stderr as JSON."""
        if not self.enabled:
            return
        
        self.current_stage = stage
        self.current_progress = progress
        
        progress_event = {
            "event": "progress",
            "stage": stage,
            "progress": progress,
            "message": message,
            "timestamp": json.dumps(None)  # Will be added by structlog
        }
        
        if details:
            progress_event["details"] = details
        
        # Print to stderr as JSON (API layer will parse this)
        print(json.dumps(progress_event), file=sys.stderr, flush=True)
    
    def report_error(self, error_type: str, error_category: str, details: str, 
                    affected_entities: Optional[List[Dict[str, str]]] = None,
                    suggested_step: Optional[str] = None,
                    actionable_fix: Optional[str] = None,
                    diagnostic_info: Optional[Dict[str, Any]] = None,
                    constraint: Optional[str] = None):
        """Emit an enhanced error event to stderr as JSON."""
        error_event = {
            "event": "error",
            "error_type": error_type,
            "error_category": error_category,
            "details": details,
        }
        
        if affected_entities:
            error_event["affected_entities"] = affected_entities
        if suggested_step:
            error_event["suggested_step"] = suggested_step
        if actionable_fix:
            error_event["actionable_fix"] = actionable_fix
        if diagnostic_info:
            error_event["diagnostic_info"] = diagnostic_info
        if constraint:
            error_event["constraint"] = constraint
        
        # Print to stderr as JSON
        print(json.dumps(error_event), file=sys.stderr, flush=True)

# Global progress reporter instance
progress_reporter = ProgressReporter(enabled=True)

# --- Helper Functions ---
def can_teach(teacher: dict, subject_id: str, class_group: Optional[dict] = None, enforce_gender_separation: Optional[bool] = False) -> bool:
    # Handle both string and enum values for primarySubjectIds
    primary_subjects = teacher.get('primarySubjectIds', [])
    if subject_id not in primary_subjects:
        # Handle both string and enum values for allowedSubjectIds
        restrict_primary = teacher.get('restrictToPrimarySubjects', True)
        if restrict_primary or subject_id not in teacher.get('allowedSubjectIds', []):
            return False
    
    # Check gender separation constraints if enabled
    if enforce_gender_separation and class_group and teacher.get('gender') and hasattr(class_group, 'gender') and class_group.gender:
        teacher_gender = teacher['gender'].lower()
        class_gender = class_group.gender.lower()
        
        # If either is mixed, allow teaching
        if teacher_gender == 'mixed' or class_gender == 'mixed':
            return True
        
        # Otherwise, genders must match
        if teacher_gender != class_gender:
            return False
    
    return True

def is_room_compatible(room: dict, subject: dict, class_group) -> bool:
    min_cap = subject.get('minRoomCapacity')
    # If minRoomCapacity is None, treat as 0
    if min_cap is None:
        min_cap = 0
    if room['capacity'] < max(class_group.studentCount, min_cap):
        return False
    req_type = subject.get('requiredRoomType')
    if req_type and room['type'] != req_type:
        return False
    req_features = set(subject.get('requiredFeatures') or [])
    if not req_features.issubset(set(room.get('features', []))):
        return False
    return True

# --- The Main Solver Class ---
class TimetableSolver:
    """Enhanced constraint satisfaction solver for school timetabling with improved optimization."""
    
    def __init__(self, timetable_data: Dict):
        try:
            progress_reporter.report("validation", 5, "Validating input data...")
            self.data = TimetableData(**timetable_data)
            # Use model_dump instead of dict for better compatibility with Pydantic v2
            self.data_dict = self.data.model_dump(exclude_none=True) # Use dict for easier access
            log.info("Input data validated successfully against Pydantic models.")
            progress_reporter.report("validation", 10, "Input data validated successfully", {
                "teachers": len(self.data.teachers),
                "rooms": len(self.data.rooms),
                "classes": len(self.data.classes),
                "subjects": len(self.data.subjects)
            })
        except Exception as e:
            log.error("Data validation failed", error=str(e))
            # Emit enhanced error
            progress_reporter.report_error(
                error_type="VALIDATION_ERROR",
                error_category="data_structure",
                details=f"Invalid timetable data structure: {e}",
                suggested_step="school-info",
                actionable_fix="Please check your input data structure and ensure all required fields are present."
            )
            raise ValueError(f"Invalid timetable data structure: {e}")

        self.model = cp_model.CpModel()
        self._prepare_data_maps()
        self._process_requests()

    def solve(self, time_limit_seconds: int = 600, enable_graceful_degradation: bool = True, 
              optimization_level: int = 2) -> List[Dict]:
        """
        Solve the timetable problem with configurable optimization level.
        
        Args:
            time_limit_seconds: Maximum time to spend solving
            enable_graceful_degradation: Whether to return partial solutions for infeasible problems
            optimization_level: 0=fastest, 1=balanced, 2=thorough (default)
        """
        try:
            # Use configuration values if provided in the data
            if hasattr(self.data.config, 'solverTimeLimitSeconds') and self.data.config.solverTimeLimitSeconds:
                time_limit_seconds = self.data.config.solverTimeLimitSeconds
                
            if hasattr(self.data.config, 'solverOptimizationLevel') and self.data.config.solverOptimizationLevel is not None:
                optimization_level = self.data.config.solverOptimizationLevel
                
            if hasattr(self.data.config, 'enableGracefulDegradation') and self.data.config.enableGracefulDegradation is not None:
                enable_graceful_degradation = self.data.config.enableGracefulDegradation
            
            log.info("Starting timetable solve process...", time_limit=time_limit_seconds, 
                     num_requests=self.num_requests, optimization_level=optimization_level)
            if not self.requests and not self.data.fixedLessons:
                return []
            
            # Initialize available strategies
            available_strategies = {
                0: FastStrategy(),
                1: BalancedStrategy(),
                2: ThoroughStrategy()
            }

            # Create variables first - this populates allowed_domains
            self._create_variables()
            
            # Phase 3 Optimization: Build request-resource mappings for fast lookups
            self._build_request_mappings()
            
            # Default strategy selection (will be overridden if complexity calculation succeeds)
            selected_strategy = available_strategies[optimization_level]
            problem_size = {
                'num_requests': self.num_requests,
                'num_teachers': len(self.data.teachers),
                'num_classes': len(self.data.classes),
                'avg_teachers': 10  # Default assumption
            }
            
            # NOW calculate model complexity after domains are populated
            if self.num_requests > 0 and self.allowed_domains:
                total_allowed_teachers = sum(len(domain_info['teachers']) for domain_info in self.allowed_domains.values())
                total_allowed_rooms = sum(len(domain_info['rooms']) for domain_info in self.allowed_domains.values())
                avg_allowed_teachers = total_allowed_teachers / len(self.allowed_domains) if len(self.allowed_domains) > 0 else 0
                avg_allowed_rooms = total_allowed_rooms / len(self.allowed_domains) if len(self.allowed_domains) > 0 else 0
                model_complexity = self.num_requests * avg_allowed_teachers * avg_allowed_rooms
                
                # Log model size metrics
                log.info("Model size metrics", 
                         num_requests=self.num_requests,
                         unique_domains=len(self.allowed_domains),
                         avg_allowed_teachers=f"{avg_allowed_teachers:.1f}",
                         avg_allowed_rooms=f"{avg_allowed_rooms:.1f}",
                         model_complexity=int(model_complexity))
                
                progress_reporter.report("variable_creation", 35, f"Model complexity: {int(model_complexity):,}", {
                    "model_complexity": int(model_complexity),
                    "avg_teachers": round(avg_allowed_teachers, 1),
                    "avg_rooms": round(avg_allowed_rooms, 1)
                })
                
                # Automatic strategy selection based on problem characteristics
                problem_size = {
                    'num_requests': self.num_requests,
                    'num_teachers': len(self.data.teachers),
                    'num_classes': len(self.data.classes),
                    'avg_teachers': avg_allowed_teachers
                }
                
                # Try each strategy to see which one is appropriate
                selected_strategy = None
                for level in [optimization_level, 1, 0]:  # Try requested level, then fallback
                    strategy = available_strategies[level]
                    if strategy.should_use_for_problem(problem_size, model_complexity):
                        selected_strategy = strategy
                        optimization_level = level
                        break
                
                # Fallback to fast if no strategy matches
                if selected_strategy is None:
                    selected_strategy = available_strategies[0]
                    optimization_level = 0
                
                log.info(f"Selected strategy: {selected_strategy.name}", 
                         optimization_level=optimization_level,
                         avg_teachers=round(avg_allowed_teachers, 1))
                
                # Detect highly constrained problems (very few teacher options)
                is_highly_constrained = avg_allowed_teachers < 2.5
                
                if is_highly_constrained:
                    log.warning(f"Highly constrained problem detected: avg {avg_allowed_teachers:.1f} teachers per subject")
                    log.warning("This problem may be infeasible or very difficult to solve. Consider:")
                    log.warning("  1. Adding more teachers who can teach these subjects")
                    log.warning("  2. Relaxing teacher maxPeriodsPerWeek limits")
                    log.warning("  3. Reducing maxConsecutivePeriods constraints")
                    log.warning("  4. Checking teacher availability windows")
                    
                    progress_reporter.report("variable_creation", 38, f"⚠️ Highly constrained problem - using {selected_strategy.name} strategy", {
                        "avg_teachers": round(avg_allowed_teachers, 1),
                        "strategy": selected_strategy.name,
                        "optimization_level": optimization_level,
                        "reason": "very_few_teacher_options",
                        "warning": "Problem may be difficult or infeasible"
                    })
                else:
                    progress_reporter.report("variable_creation", 38, f"Using {selected_strategy.name} strategy", {
                        "strategy": selected_strategy.name,
                        "optimization_level": optimization_level,
                        "model_complexity": int(model_complexity)
                    })
                
                # Hard limit to prevent extremely large models
                hard_limit = 500000
                if model_complexity > hard_limit:
                    error_message = f"Model too complex to solve: {int(model_complexity):,} > {hard_limit:,}. " \
                                  f"Try reducing the number of requests, teachers, or rooms, or enable graceful degradation."
                    log.error(error_message)
                    
                    progress_reporter.report_error(
                        error_type="MODEL_TOO_COMPLEX",
                        error_category="complexity_limit",
                        details=error_message,
                        suggested_step="review",
                        actionable_fix=f"Your school configuration is too large. Reduce classes ({len(self.data.classes)}), teachers ({len(self.data.teachers)}), or subject requirements to simplify the problem.",
                        diagnostic_info={
                            "model_complexity": int(model_complexity),
                            "complexity_limit": hard_limit,
                            "num_requests": self.num_requests,
                            "num_teachers": len(self.data.teachers),
                            "num_rooms": len(self.data.rooms),
                            "num_classes": len(self.data.classes)
                        }
                    )
                    
                    return [{"error": error_message, "status": "MODEL_TOO_COMPLEX", 
                             "model_complexity": int(model_complexity), "complexity_limit": hard_limit}]
            
            # Phase 3.2-3.3: Initialize constraint budget and progressive manager
            problem_complexity_level = determine_problem_complexity(
                num_requests=self.num_requests,
                num_teachers=len(self.data.teachers),
                num_classes=len(self.data.classes),
                model_complexity=model_complexity
            )
            
            # Create constraint budget (max penalty variables)
            max_penalty_vars = 5000 if problem_complexity_level == "small" else (2000 if problem_complexity_level == "medium" else 1000)
            self.constraint_budget = ConstraintBudget(max_penalty_vars=max_penalty_vars, problem_size=problem_complexity_level)
            
            # Create progressive constraint manager
            self.progressive_manager = ProgressiveConstraintManager(problem_complexity=problem_complexity_level)
            self.progressive_manager.log_configuration()
            
            # Apply hard constraints (always)
            self._apply_hard_constraints()
            
            # For highly constrained problems, skip soft constraints entirely
            # Let solver focus on finding ANY feasible solution first
            skip_soft_for_constrained = (self.num_requests > 0 and self.allowed_domains and 
                                        sum(len(d['teachers']) for d in self.allowed_domains.values()) / len(self.allowed_domains) < 2.5)
            
            # Phase 3.3: Progressive soft constraint application
            if optimization_level > 0 and not skip_soft_for_constrained:
                # Apply soft constraints progressively based on problem complexity
                self._apply_soft_constraints_progressive()
            elif skip_soft_for_constrained:
                log.warning("Skipping soft constraints for highly constrained problem - focusing on feasibility")
                progress_reporter.report("soft_constraints", 60, "Skipping optimizations - focusing on finding any valid solution")

            self.solver = cp_model.CpSolver()
            
            # Configure solver parameters using selected strategy
            solver_params = selected_strategy.get_solver_parameters(time_limit_seconds, problem_size)
            
            # Apply strategy parameters to solver
            for param_name, param_value in solver_params.items():
                if hasattr(self.solver.parameters, param_name):
                    setattr(self.solver.parameters, param_name, param_value)
                    log.debug(f"Set solver parameter: {param_name} = {param_value}")
                else:
                    log.warning(f"Unknown solver parameter: {param_name}")
            
            log.info(f"Solver configured with {selected_strategy.name} strategy", 
                     workers=solver_params.get('num_workers', 8),
                     time_limit=solver_params.get('max_time_in_seconds', time_limit_seconds))

            progress_reporter.report("solving", 65, "Starting constraint solver...", {
                "time_limit": time_limit_seconds,
                "optimization_level": optimization_level
            })
            
            status = self.solver.Solve(self.model)
            log.info("Solve finished.", status=self.solver.StatusName(status), 
                     wall_time=f"{self.solver.WallTime():.2f}s")
            
            progress_reporter.report("solving", 90, f"Solver completed with status: {self.solver.StatusName(status)}", {
                "status": self.solver.StatusName(status),
                "wall_time": f"{self.solver.WallTime():.2f}s"
            })

            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                progress_reporter.report("building_solution", 95, "Building final timetable...")
                return self._build_solution()
            elif enable_graceful_degradation and status == cp_model.INFEASIBLE:
                # Try to find a partial solution by returning fixed lessons only
                log.info("Attempting graceful degradation - returning fixed lessons only...")
                return self._build_fixed_lessons_only()
            elif status == cp_model.INFEASIBLE:
                # Export model summary for debugging
                self._export_model_summary()
                error_message = f"No feasible solution exists for the given constraints. The requirements cannot be satisfied simultaneously."
                log.warning(error_message)
                
                # Enhanced error reporting for INFEASIBLE
                progress_reporter.report_error(
                    error_type="INFEASIBLE",
                    error_category="constraint_conflict",
                    details=error_message,
                    suggested_step="review",
                    actionable_fix="Review the constraints in your configuration. Common issues: insufficient teachers, room capacity conflicts, or conflicting time requirements. Try enabling graceful degradation or reducing subject requirements.",
                    diagnostic_info={
                        "num_requests": self.num_requests,
                        "num_teachers": len(self.data.teachers),
                        "num_rooms": len(self.data.rooms),
                        "solver_status": self.solver.StatusName(status)
                    }
                )
                
                return [{"error": error_message, "status": self.solver.StatusName(status)}]
            else:
                error_message = f"Solver could not find a solution. Status: {self.solver.StatusName(status)}"
                log.warning(error_message)
                
                progress_reporter.report_error(
                    error_type="SOLVER_FAILED",
                    error_category="solving_error",
                    details=error_message,
                    suggested_step="review",
                    actionable_fix="The solver terminated without finding a solution. Try increasing the time limit, reducing optimization level, or simplifying constraints.",
                    diagnostic_info={
                        "solver_status": self.solver.StatusName(status),
                        "wall_time": f"{self.solver.WallTime():.2f}s"
                    }
                )
                
                return [{"error": error_message, "status": self.solver.StatusName(status)}]
        except Exception as e:
            error_message = f"Error during solving process: {str(e)}"
            log.error(error_message, exc_info=True)
            return [{"error": error_message, "status": "SOLVING_ERROR"}]
            
    def _build_fixed_lessons_only(self) -> List[Dict]:
        """Return only the fixed lessons when no complete solution can be found."""
        try:
            solution = []
            for lesson in self.data.fixedLessons or []:
                # Use normalized day string
                day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
                solution.append({
                    "day": day_str, "periodIndex": lesson.periodIndex, "classId": lesson.classId,
                    "subjectId": lesson.subjectId, "teacherIds": lesson.teacherIds,
                    "roomId": lesson.roomId, "isFixed": True
                })
            log.info(f"Returning fixed lessons only: {len(solution)} entries")
            return solution
        except Exception as e:
            error_message = f"Error building fixed lessons only: {str(e)}"
            log.error(error_message, exc_info=True)
            return [{"error": error_message, "status": "FIXED_LESSONS_ERROR"}]

    def _build_availability_matrix(self, entities: List[Dict]) -> List[List[int]]:
        matrix = [[1] * self.num_slots for _ in entities]  # Use 1/0 instead of True/False
        for e_idx, entity in enumerate(entities):
            if 'availability' in entity:
                for day_str, avail_list in entity['availability'].items():
                    if day_str not in self.day_map: continue
                    d_idx = self.day_map[day_str]
                    for p, is_avail in enumerate(avail_list):
                        if not is_avail: matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
            if 'unavailable' in entity:
                for u in entity['unavailable']:
                    if u['day'] in self.day_map:
                        d_idx = self.day_map[u['day']]
                        for p in u['periods']:
                            if 0 <= p < self.num_periods_per_day: matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
        return matrix

    def _build_class_blocked_slots(self) -> List[List[int]]:
        blocked = [[0] * self.num_slots for _ in self.data.classes]  # Use 1/0 instead of True/False
        cfg = self.data.config
        
        # Note: breakPeriods are gaps between teaching periods, not scheduled slots
        # So we don't block any periods for regular breaks
        
        # Apply prayer breaks
        for prayer_break in cfg.prayerBreaks or []:
            day_str = prayer_break.day.value if isinstance(prayer_break.day, DayOfWeek) else str(prayer_break.day)
            if day_str in self.day_map:
                d_idx = self.day_map[day_str]
                for c_idx in range(len(self.data.classes)):
                    for p in prayer_break.periods:
                        if 0 <= p < self.num_periods_per_day:
                            blocked[c_idx][d_idx * self.num_periods_per_day + p] = 1
        
        # Apply school events
        for ev in self.data.schoolEvents or []:
            day_str = ev.day.value if isinstance(ev.day, DayOfWeek) else str(ev.day)
            if day_str in self.day_map:
                d_idx = self.day_map[day_str]
                class_ids = ev.appliesToClassIds or list(self.class_map.keys())
                for c_id in class_ids:
                    c_idx = self.class_map[c_id]
                    for p in ev.periods:
                        if 0 <= p < self.num_periods_per_day:
                            blocked[c_idx][d_idx * self.num_periods_per_day + p] = 1
        return blocked

    def _normalize_days(self):
        """Normalize all Day values to canonical strings."""
        self.days = [d.value if isinstance(d, DayOfWeek) else str(d) for d in self.data.config.daysOfWeek]
        self.day_map = {day: idx for idx, day in enumerate(self.days)}

    def _compute_allowed_starts(self, c_idx: int, allowed_teachers: List[int], allowed_rooms: List[int], length: int) -> List[int]:
        """Compute the set of allowed start slots that satisfy all constraints."""
        allowed_starts = []
        
        # For each possible start slot
        for s in range(0, self.num_slots - length + 1):
            ok = True
            
            # Check each offset in the request
            for o in range(length):
                slot = s + o
                day_idx, period_idx = divmod(slot, self.num_periods_per_day)
                
                # Check class blocked slots
                if self.class_blocked_slots[c_idx][slot]:
                    ok = False
                    break
                
                # Check if there exists at least one allowed teacher available at this slot
                teacher_available = False
                for t_idx in allowed_teachers:
                    if self.teacher_availability[t_idx][slot]:
                        teacher_available = True
                        break
                
                if not teacher_available:
                    ok = False
                    break
                
                # Check if there exists at least one allowed room available at this slot
                room_available = False
                for rm_idx in allowed_rooms:
                    if self.room_availability[rm_idx][slot]:
                        room_available = True
                        break
                
                if not room_available:
                    ok = False
                    break
            
            if ok:
                allowed_starts.append(s)
        
        return allowed_starts

    def _get_or_create_is_assigned(self, r_idx: int, t_idx: Optional[int] = None, rm_idx: Optional[int] = None) -> cp_model.IntVar:
        """Get or create a boolean variable to represent if a teacher or room is assigned to a request."""
        if t_idx is not None:
            key = (r_idx, t_idx, None)
        elif rm_idx is not None:
            key = (r_idx, None, rm_idx)
        else:
            raise ValueError("Either t_idx or rm_idx must be provided")
            
        if key in self.is_assigned_cache:
            return self.is_assigned_cache[key]
            
        if t_idx is not None:
            var = self.model.NewBoolVar(f'is_assigned_t_{r_idx}_{t_idx}')
        else:
            var = self.model.NewBoolVar(f'is_assigned_r_{r_idx}_{rm_idx}')
            
        self.is_assigned_cache[key] = var
        return var

    def _prepare_data_maps(self):
        cfg = self.data.config
        self._normalize_days()
        self.num_days = len(self.days)
        self.num_periods_per_day = cfg.periodsPerDay
        
        # Handle multi-shift support
        if cfg.shifts:
            # For now, we'll keep the same structure but note that shifts are supported
            # In a more advanced implementation, we could modify how slots are calculated
            pass
        
        self.num_slots = self.num_days * self.num_periods_per_day

        self.class_map = {c.id: i for i, c in enumerate(self.data.classes)}
        self.teacher_map = {t.id: i for i, t in enumerate(self.data.teachers)}
        self.subject_map = {s.id: i for i, s in enumerate(self.data.subjects)}
        self.room_map = {r.id: i for i, r in enumerate(self.data.rooms)}

        self.teacher_availability = self._build_availability_matrix(self.data_dict['teachers'])
        self.room_availability = self._build_availability_matrix(self.data_dict['rooms'])
        self.class_blocked_slots = self._build_class_blocked_slots()
        
        # Initialize cache attributes
        self.allowed_domains = {}  # Maps (c_id, s_id) to {teachers, rooms, starts}
        self.is_assigned_cache = {}  # Maps (r_idx, t_idx) or (r_idx, rm_idx) to boolean variables
        
        # Phase 3 Optimization: Pre-computed mappings for O(1) lookups
        self.teacher_to_requests = collections.defaultdict(list)  # teacher_idx -> [request_indices]
        self.class_to_requests = collections.defaultdict(list)     # class_id -> [request_indices]
        self.subject_to_requests = collections.defaultdict(list)   # subject_id -> [request_indices]
        self.request_to_teachers = {}  # request_idx -> [allowed_teacher_indices]
        
        # Phase 3.4: Initialize domain filter for early pruning
        self.domain_filter = DomainFilter(
            self.data, 
            self.teacher_map, 
            self.room_map, 
            self.subject_map, 
            self.class_map
        )

    def _process_requests(self):
        reqs_to_schedule = collections.defaultdict(lambda: collections.defaultdict(int))
        for cls in self.data.classes:
            for subj_id, req in cls.subjectRequirements.items():
                reqs_to_schedule[cls.id][subj_id] = req.periodsPerWeek
        
        if self.data.fixedLessons:
            for lesson in self.data.fixedLessons:
                if lesson.classId in reqs_to_schedule and lesson.subjectId in reqs_to_schedule[lesson.classId]:
                    reqs_to_schedule[lesson.classId][lesson.subjectId] -= 1

        self.requests = []
        for cls in self.data.classes:
            for subj_id, req in cls.subjectRequirements.items():
                periods_to_schedule = reqs_to_schedule[cls.id][subj_id]
                min_c, max_c = req.minConsecutive or 1, req.maxConsecutive or periods_to_schedule
                # Enforce global toggle to disallow consecutive blocks if requested
                try:
                    if self.data.preferences and (self.data.preferences.allowConsecutivePeriodsForSameSubject is False):
                        min_c, max_c = 1, 1
                except Exception:
                    # If preferences missing or malformed, keep defaults (safe fallback)
                    pass
                while periods_to_schedule > 0:
                    block_size = min(periods_to_schedule, max_c)
                    if periods_to_schedule >= min_c and 0 < periods_to_schedule - block_size < min_c:
                         block_size = min_c
                    self.requests.append({'class_id': cls.id, 'subject_id': subj_id, 'length': block_size})
                    periods_to_schedule -= block_size
        self.num_requests = len(self.requests)
    
    def _build_request_mappings(self):
        """
        Phase 3 Optimization: Build pre-computed mappings for O(1) lookups.
        This avoids O(T×R) loops in constraint generation.
        Called after variables are created and allowed_domains is populated.
        """
        log.info("Building request-resource mappings for optimization...")
        
        for r_idx, req in enumerate(self.requests):
            class_id = req['class_id']
            subject_id = req['subject_id']
            
            # Map class -> requests
            self.class_to_requests[class_id].append(r_idx)
            
            # Map subject -> requests
            self.subject_to_requests[subject_id].append(r_idx)
            
            # Get allowed teachers for this request (from allowed_domains cache)
            key = (class_id, subject_id)
            if key in self.allowed_domains:
                allowed_teachers = self.allowed_domains[key]['teachers']
                self.request_to_teachers[r_idx] = allowed_teachers
                
                # Map each teacher -> requests they can teach
                for t_idx in allowed_teachers:
                    self.teacher_to_requests[t_idx].append(r_idx)
            else:
                # Fallback: compute allowed teachers on the fly
                c_idx = self.class_map[class_id]
                s_idx = self.subject_map[subject_id]
                class_group = self.data.classes[c_idx]
                allowed_teachers = [
                    self.teacher_map[t['id']] 
                    for t in self.data_dict['teachers'] 
                    if can_teach(t, subject_id, class_group, self.data.config.enforceGenderSeparation or False)
                ]
                self.request_to_teachers[r_idx] = allowed_teachers
                for t_idx in allowed_teachers:
                    self.teacher_to_requests[t_idx].append(r_idx)
        
        log.info(f"Request mappings built: {len(self.teacher_to_requests)} teachers, {len(self.requests)} requests")

    def _build_solution(self) -> List[Dict]:
        solution = []
        rev_maps = {
            'class': {v: k for k, v in self.class_map.items()},
            'teacher': {v: k for k, v in self.teacher_map.items()},
            'subject': {v: k for k, v in self.subject_map.items()},
            'room': {v: k for k, v in self.room_map.items()}
        }

        for r_idx, req in enumerate(self.requests):
            start, teacher_idx, room_idx = self.solver.Value(self.start_vars[r_idx]), self.solver.Value(self.teacher_vars[r_idx]), self.solver.Value(self.room_vars[r_idx])
            for offset in range(req['length']):
                slot = start + offset
                day_idx, period_idx = divmod(slot, self.num_periods_per_day)
                solution.append({
                    "day": self.days[day_idx], "periodIndex": period_idx, "classId": req['class_id'],
                    "subjectId": req['subject_id'], "teacherIds": [rev_maps['teacher'][teacher_idx]],
                    "roomId": rev_maps['room'][room_idx], "isFixed": False
                })

        for lesson in self.data.fixedLessons or []:
            # Use normalized day string
            day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            solution.append({
                "day": day_str, "periodIndex": lesson.periodIndex, "classId": lesson.classId,
                "subjectId": lesson.subjectId, "teacherIds": lesson.teacherIds,
                "roomId": lesson.roomId, "isFixed": True
            })

        solution.sort(key=lambda x: (self.day_map[x['day']], x['periodIndex'], x['classId']))
        progress_reporter.report("building_solution", 100, "Timetable generated successfully!", {
            "total_lessons": len(solution)
        })
        return solution

    def _create_variables(self):
        """Creates all necessary CP-SAT model variables."""
        try:
            progress_reporter.report("variable_creation", 15, "Creating decision variables...", {
                "num_requests": self.num_requests
            })
            
            self.start_vars, self.teacher_vars, self.room_vars = [], [], []
            self.class_intervals = collections.defaultdict(list)
            self.teacher_intervals = collections.defaultdict(list)
            self.room_intervals = collections.defaultdict(list)
            
            # Cache allowed domains for performance
            self.allowed_domains = {}  # Maps (c_id, s_id) to {teachers, rooms, starts}
            
            # Cache boolean variables to reduce proliferation
            self.is_assigned_cache = {}  # Maps (r_idx, t_idx) or (r_idx, rm_idx) to boolean variables
            
            log.info("Starting variable creation", num_requests=self.num_requests)

            for r_idx, req in enumerate(self.requests):
                c_id, s_id, length = req['class_id'], req['subject_id'], req['length']
                c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]

                # Check if we've already computed allowed domains for this class/subject combination
                domain_key = (c_id, s_id)
                if domain_key in self.allowed_domains:
                    domain_info = self.allowed_domains[domain_key]
                    allowed_teachers = domain_info['teachers']
                    allowed_rooms = domain_info['rooms']
                    allowed_starts = domain_info['starts']
                else:
                    # Compute allowed domains
                    allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                    
                    # FIXED ROOM CONSTRAINT: Check if class has a fixed room requirement
                    fixed_room_id = getattr(class_group, 'fixedRoomId', None)
                    if fixed_room_id and fixed_room_id in self.room_map:
                        # Hard constraint: restrict to single room
                        fixed_room_idx = self.room_map[fixed_room_id]
                        fixed_room = self.data_dict['rooms'][fixed_room_idx]
                        
                        # Validate that the fixed room is compatible
                        if is_room_compatible(fixed_room, subject, class_group):
                            allowed_rooms = [fixed_room_idx]
                            log.info("Fixed room constraint applied", 
                                     request=r_idx, 
                                     class_id=c_id, 
                                     class_name=class_group.name,
                                     subject_id=s_id,
                                     fixed_room_id=fixed_room_id,
                                     fixed_room_name=fixed_room['name'])
                        else:
                            # Fixed room is incompatible - error
                            reasons = []
                            min_cap = subject.get('minRoomCapacity', 0)
                            if fixed_room['capacity'] < max(class_group.studentCount, min_cap):
                                reasons.append(f"capacity {fixed_room['capacity']} < required {max(class_group.studentCount, min_cap)}")
                            req_type = subject.get('requiredRoomType')
                            if req_type and fixed_room['type'] != req_type:
                                reasons.append(f"type '{fixed_room['type']}' != required '{req_type}'")
                            req_features = set(subject.get('requiredFeatures') or [])
                            room_features = set(fixed_room.get('features', []))
                            if not req_features.issubset(room_features):
                                reasons.append(f"missing features: {req_features - room_features}")
                            
                            raise RuntimeError(json.dumps({
                                "error": f"Fixed room is incompatible with requirements for class '{c_id}' and subject '{s_id}'",
                                "class": {"id": c_id, "name": class_group.name, "fixedRoomId": fixed_room_id},
                                "subject": {"id": s_id, "name": subject['name']},
                                "fixed_room": {"id": fixed_room_id, "name": fixed_room['name']},
                                "incompatibility_reasons": reasons
                            }, indent=2))
                    else:
                        # Normal room filtering - no fixed room
                        allowed_rooms = [self.room_map[r['id']] for r in self.data_dict['rooms'] if is_room_compatible(r, subject, class_group)]
                    
                    if not allowed_teachers or not allowed_rooms:
                        # Create detailed diagnostic for unschedulable request
                        teacher_details = []
                        for t_idx in allowed_teachers:
                            teacher_dict = self.data_dict['teachers'][t_idx]
                            teacher = self.data.teachers[t_idx]
                            reasons = []
                            if not can_teach(teacher_dict, s_id, None, False):
                                reasons.append("not primary/allowed subject")
                            if teacher.maxPeriodsPerWeek <= 0:
                                reasons.append("max periods per week is 0")
                            teacher_details.append({
                                "id": teacher.id,
                                "name": teacher.fullName,
                                "reasons": reasons
                            })
                        
                        room_details = []
                        for rm_idx in allowed_rooms:
                            room = self.data.rooms[rm_idx]
                            reasons = []
                            if room.capacity < max(class_group.studentCount, subject.get('minRoomCapacity', 0)):
                                reasons.append("insufficient capacity")
                            req_type = subject.get('requiredRoomType')
                            if req_type and room.type != req_type:
                                reasons.append(f"wrong type (need {req_type}, has {room.type})")
                            room_details.append({
                                "id": room.id,
                                "name": room.name,
                                "reasons": reasons
                            })
                        
                        raise RuntimeError(json.dumps({
                            "error": f"No valid teacher or room for subject '{s_id}' and class '{c_id}'",
                            "class": {"id": c_id, "name": class_group.name, "studentCount": class_group.studentCount},
                            "subject": {"id": s_id, "name": subject['name'], "minRoomCapacity": subject.get('minRoomCapacity', 0)},
                            "candidate_teachers": teacher_details,
                            "candidate_rooms": room_details
                        }, indent=2))

                    # Compute allowed start slots based on availability and blocked slots
                    allowed_starts = self._compute_allowed_starts(c_idx, allowed_teachers, allowed_rooms, length)
                    if not allowed_starts:
                        # Create detailed diagnostic for unschedulable request
                        teacher_names = [self.data.teachers[t_idx].fullName for t_idx in allowed_teachers]
                        room_names = [self.data.rooms[rm_idx].name for rm_idx in allowed_rooms]
                        
                        # Analyze why no starts are allowed
                        blocking_reasons = []
                        for t_idx in allowed_teachers:
                            teacher = self.data.teachers[t_idx]
                            unavailable_count = sum(1 for slot in range(self.num_slots) if not self.teacher_availability[t_idx][slot])
                            if unavailable_count > 0:
                                blocking_reasons.append(f"Teacher {teacher.fullName} unavailable for {unavailable_count}/{self.num_slots} slots")
                        
                        for rm_idx in allowed_rooms:
                            room = self.data.rooms[rm_idx]
                            unavailable_count = sum(1 for slot in range(self.num_slots) if not self.room_availability[rm_idx][slot])
                            if unavailable_count > 0:
                                blocking_reasons.append(f"Room {room.name} unavailable for {unavailable_count}/{self.num_slots} slots")
                        
                        class_blocked_count = sum(self.class_blocked_slots[c_idx])
                        if class_blocked_count > 0:
                            blocking_reasons.append(f"Class blocked for {class_blocked_count}/{self.num_slots} slots")
                        
                        raise RuntimeError(json.dumps({
                            "error": f"No allowed starts for request {r_idx} ({c_id},{s_id})",
                            "class": {"id": c_id, "name": class_group.name, "studentCount": class_group.studentCount},
                            "subject": {"id": s_id, "name": subject['name'], "minRoomCapacity": subject.get('minRoomCapacity', 0)},
                            "request_length": length,
                            "blocking_reasons": blocking_reasons,
                            "allowed_teachers": teacher_names,
                            "allowed_rooms": room_names
                        }, indent=2))
                    
                    # Cache the computed domains
                    self.allowed_domains[domain_key] = {
                        'teachers': allowed_teachers,
                        'rooms': allowed_rooms,
                        'starts': allowed_starts
                    }

                start_var = self.model.NewIntVarFromDomain(cp_model.Domain.FromValues(allowed_starts), f'start_{r_idx}')
                teacher_var = self.model.NewIntVarFromDomain(cp_model.Domain.FromValues(allowed_teachers), f'teacher_{r_idx}')
                room_var = self.model.NewIntVarFromDomain(cp_model.Domain.FromValues(allowed_rooms), f'room_{r_idx}')
                
                self.start_vars.append(start_var)
                self.teacher_vars.append(teacher_var)
                self.room_vars.append(room_var)

                # Create explicit end variable for safer interval creation
                end_var = self.model.NewIntVar(0, self.num_slots, f'end_{r_idx}')
                self.model.Add(end_var == start_var + length)
                interval = self.model.NewIntervalVar(start_var, length, end_var, f'interval_{r_idx}')
                self.class_intervals[c_idx].append(interval)

                for t_idx in allowed_teachers:
                    # Get or create a boolean variable to represent if this teacher is assigned
                    is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                    self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                    self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                    # Create explicit end variable for optional interval
                    end_var = self.model.NewIntVar(0, self.num_slots, f'end_t_{r_idx}_{t_idx}')
                    self.model.Add(end_var == start_var + length)
                    self.teacher_intervals[t_idx].append(self.model.NewOptionalIntervalVar(start_var, length, end_var, is_assigned, f'opt_t_{r_idx}_{t_idx}'))
                for rm_idx in allowed_rooms:
                    # Get or create a boolean variable to represent if this room is assigned
                    is_assigned = self._get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
                    self.model.Add(room_var == rm_idx).OnlyEnforceIf(is_assigned)
                    self.model.Add(room_var != rm_idx).OnlyEnforceIf(is_assigned.Not())
                    # Create explicit end variable for optional interval
                    end_var = self.model.NewIntVar(0, self.num_slots, f'end_r_{r_idx}_{rm_idx}')
                    self.model.Add(end_var == start_var + length)
                    self.room_intervals[rm_idx].append(self.model.NewOptionalIntervalVar(start_var, length, end_var, is_assigned, f'opt_r_{r_idx}_{rm_idx}'))

            if self.data.fixedLessons:
                for i, lesson in enumerate(self.data.fixedLessons):
                    c_idx = self.class_map[lesson.classId]
                    # Use normalized day string
                    day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
                    slot = self.day_map[day_str] * self.num_periods_per_day + lesson.periodIndex
                    interval = self.model.NewFixedSizeIntervalVar(slot, 1, f'fixed_{i}')
                    self.class_intervals[c_idx].append(interval)
                    
                    # Attach interval to all teachers in teacherIds
                    for teacher_id in lesson.teacherIds:
                        t_idx = self.teacher_map[teacher_id]
                        self.teacher_intervals[t_idx].append(interval)
                    
                    # Attach interval to room if specified
                    if lesson.roomId:
                        r_idx = self.room_map.get(lesson.roomId)
                        if r_idx is not None: 
                            self.room_intervals[r_idx].append(interval)
        except Exception as e:
            error_message = f"Error creating variables: {str(e)}"
            log.error(error_message, exc_info=True)
            raise RuntimeError(error_message) from e
        
        # Log summary of created variables
        total_intervals = sum(len(intervals) for intervals in self.class_intervals.values())
        total_teacher_intervals = sum(len(intervals) for intervals in self.teacher_intervals.values())
        total_room_intervals = sum(len(intervals) for intervals in self.room_intervals.values())
        log.info("Variable creation completed", 
                 start_vars=len(self.start_vars),
                 teacher_vars=len(self.teacher_vars),
                 room_vars=len(self.room_vars),
                 class_intervals=total_intervals,
                 teacher_intervals=total_teacher_intervals,
                 room_intervals=total_room_intervals,
                 cached_domains=len(self.allowed_domains),
                 cached_booleans=len(self.is_assigned_cache))
        
        progress_reporter.report("variable_creation", 30, "Decision variables created successfully", {
            "start_vars": len(self.start_vars),
            "teacher_vars": len(self.teacher_vars),
            "room_vars": len(self.room_vars),
            "total_intervals": total_intervals
        })

    def _apply_hard_constraints(self):
        progress_reporter.report("hard_constraints", 35, "Applying hard constraints...")
        log.info("Applying hard constraints...")
        constraints_applied = 0
        # No Overlaps for all resources
        for intervals in list(self.class_intervals.values()) + list(self.teacher_intervals.values()) + list(self.room_intervals.values()):
            if intervals: 
                self.model.AddNoOverlap(intervals)
                constraints_applied += 1
        log.info("Applied no-overlap constraints", count=constraints_applied)

        # Ensure lessons don't span multiple days - optimized version
        periods_per_day_var = self.model.NewConstant(self.num_periods_per_day)
        for r_idx, req in enumerate(self.requests):
            start = self.start_vars[r_idx]
            length = req['length']
            # Use a more efficient approach for day constraints
            start_day = self.model.NewIntVar(0, self.num_days - 1, f'start_day_{r_idx}')
            self.model.AddDivisionEquality(start_day, start, periods_per_day_var)
            
            # For multi-period requests, ensure they fit within the same day
            if length > 1:
                end_slot = self.model.NewIntVar(0, self.num_slots - 1, f'end_slot_{r_idx}')
                self.model.Add(end_slot == start + length - 1)
                end_day = self.model.NewIntVar(0, self.num_days - 1, f'end_day_{r_idx}')
                self.model.AddDivisionEquality(end_day, end_slot, periods_per_day_var)
                # Ensure start and end are on the same day
                self.model.Add(start_day == end_day)
        
        # AFGHANISTAN SCHOOL RULES: Consecutive Period Constraints
        # Rule 1: Max 2 periods per day per subject (ALWAYS)
        # Rule 2a: If consecutive DISABLED (=1), max 1 period per day
        # Rule 2b: If consecutive ENABLED (>=2), if 2 periods on same day they MUST be adjacent
        log.info("Applying consecutive period constraints (Afghanistan rules)...")
        
        # Group requests by (class, subject, day) to track lessons per day
        class_subject_day_lessons = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(list)))
        
        for r_idx, req in enumerate(self.requests):
            class_id = req['class_id']
            subject_id = req['subject_id']
            c_idx = self.class_map[class_id]
            class_group = self.data.classes[c_idx]
            
            # Get request's day and period
            start = self.start_vars[r_idx]
            start_day = self.model.NewIntVar(0, self.num_days - 1, f'consec_day_{r_idx}')
            self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
            
            start_period = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'consec_period_{r_idx}')
            self.model.AddModuloEquality(start_period, start, self.num_periods_per_day)
            
            # Store for each possible day
            for day_idx in range(self.num_days):
                class_subject_day_lessons[class_id][subject_id][day_idx].append({
                    'r_idx': r_idx,
                    'start_day': start_day,
                    'start_period': start_period,
                    'length': req['length']
                })
        
        # Apply constraints
        consecutive_constraints_added = 0
        for class_id, subjects in class_subject_day_lessons.items():
            c_idx = self.class_map[class_id]
            class_group = self.data.classes[c_idx]
            
            for subject_id, days in subjects.items():
                subject_req = class_group.subjectRequirements[subject_id]
                consecutive_setting = subject_req.consecutivePeriods if hasattr(subject_req, 'consecutivePeriods') else 1
                
                # Handle None or invalid values
                if consecutive_setting is None:
                    consecutive_setting = 1
                
                for day_idx, lessons in days.items():
                    if len(lessons) == 0:
                        continue
                    
                    # Count how many lessons of this subject are actually on this day
                    lessons_on_day_bools = []
                    for lesson in lessons:
                        is_on_day = self.model.NewBoolVar(f'on_day_{lesson["r_idx"]}_{day_idx}')
                        self.model.Add(lesson['start_day'] == day_idx).OnlyEnforceIf(is_on_day)
                        self.model.Add(lesson['start_day'] != day_idx).OnlyEnforceIf(is_on_day.Not())
                        lessons_on_day_bools.append(is_on_day)
                    
                    lessons_count = self.model.NewIntVar(0, len(lessons), f'count_{class_id}_{subject_id}_{day_idx}')
                    self.model.Add(lessons_count == sum(lessons_on_day_bools))
                    
                    # HARD CONSTRAINT 1: Max 2 periods per day per subject (ALWAYS)
                    self.model.Add(lessons_count <= 2)
                    consecutive_constraints_added += 1
                    
                    if consecutive_setting == 1:
                        # HARD CONSTRAINT 2a: If consecutive DISABLED, max 1 period per day
                        self.model.Add(lessons_count <= 1)
                        consecutive_constraints_added += 1
                    
                    elif consecutive_setting >= 2:
                        # HARD CONSTRAINT 2b: If 2 lessons on same day, they MUST be adjacent (side-by-side)
                        if len(lessons) >= 2:
                            # Check all pairs of lessons
                            for i, lesson_i in enumerate(lessons):
                                for j, lesson_j in enumerate(lessons[i+1:], start=i+1):
                                    # Boolean: are both lessons on this day?
                                    both_on_day = self.model.NewBoolVar(f'both_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}_day_{day_idx}')
                                    is_i_on_day = lessons_on_day_bools[i]
                                    is_j_on_day = lessons_on_day_bools[j]
                                    self.model.AddBoolAnd([is_i_on_day, is_j_on_day]).OnlyEnforceIf(both_on_day)
                                    self.model.AddBoolOr([is_i_on_day.Not(), is_j_on_day.Not()]).OnlyEnforceIf(both_on_day.Not())
                                    
                                    # If both on same day, they MUST be adjacent (no gap)
                                    # Adjacent means: period_j == period_i + length_i OR period_i == period_j + length_j
                                    end_i = self.model.NewIntVar(0, self.num_periods_per_day, f'end_{lesson_i["r_idx"]}')
                                    self.model.Add(end_i == lesson_i['start_period'] + lesson_i['length'])
                                    
                                    end_j = self.model.NewIntVar(0, self.num_periods_per_day, f'end_{lesson_j["r_idx"]}')
                                    self.model.Add(end_j == lesson_j['start_period'] + lesson_j['length'])
                                    
                                    # j immediately after i (no gap)
                                    j_after_i = self.model.NewBoolVar(f'j_after_i_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}')
                                    self.model.Add(lesson_j['start_period'] == end_i).OnlyEnforceIf(j_after_i)
                                    
                                    # i immediately after j (no gap)
                                    i_after_j = self.model.NewBoolVar(f'i_after_j_{lesson_i["r_idx"]}_{lesson_j["r_idx"]}')
                                    self.model.Add(lesson_i['start_period'] == end_j).OnlyEnforceIf(i_after_j)
                                    
                                    # If both on same day, one of these MUST be true (they must be adjacent)
                                    self.model.AddBoolOr([j_after_i, i_after_j]).OnlyEnforceIf(both_on_day)
                                    consecutive_constraints_added += 1
        
        log.info(f"Consecutive constraints applied: {consecutive_constraints_added} constraints added")
        
        # Enforce day distribution constraints - optimized
        # Only apply if there are actual day distribution requirements
        has_day_distribution = any(
            req.minDaysPerWeek or req.maxDaysPerWeek 
            for cls in self.data.classes 
            for req in cls.subjectRequirements.values()
        )
        
        if has_day_distribution:
            class_subject_days = collections.defaultdict(lambda: collections.defaultdict(set))
            periods_per_day_var = self.model.NewConstant(self.num_periods_per_day)
            for r_idx, req in enumerate(self.requests):
                class_id = req['class_id']
                subject_id = req['subject_id']
                c_idx = self.class_map[class_id]
                class_group = self.data.classes[c_idx]
                subject_req = class_group.subjectRequirements[subject_id]
                
                # Only track if there are day distribution requirements
                if subject_req.minDaysPerWeek or subject_req.maxDaysPerWeek:
                    start = self.start_vars[r_idx]
                    start_day = self.model.NewIntVar(0, self.num_days - 1, f'start_day_dist_{r_idx}')
                    self.model.AddDivisionEquality(start_day, start, periods_per_day_var)
                    class_subject_days[class_id][subject_id].add((r_idx, start_day))
            
            # Apply minDaysPerWeek and maxDaysPerWeek constraints
            for class_id, subjects in class_subject_days.items():
                c_idx = self.class_map[class_id]
                class_group = self.data.classes[c_idx]
                for subject_id, request_days in subjects.items():
                    subject_req = class_group.subjectRequirements[subject_id]
                    
                    # Only apply if there are actual requirements
                    if subject_req.minDaysPerWeek or subject_req.maxDaysPerWeek:
                        # Create boolean variables for each day to track if subject is scheduled that day
                        day_scheduled = []
                        for day_idx in range(self.num_days):
                            is_scheduled = self.model.NewBoolVar(f'{class_id}_{subject_id}_day_{day_idx}')
                            day_scheduled.append(is_scheduled)
                            
                            # Check if any request for this subject is scheduled on this day
                            day_requests = []
                            for r_idx, start_day_var in request_days:
                                same_day = self.model.NewBoolVar(f'{class_id}_{subject_id}_req_{r_idx}_day_{day_idx}')
                                self.model.Add(start_day_var == day_idx).OnlyEnforceIf(same_day)
                                self.model.Add(start_day_var != day_idx).OnlyEnforceIf(same_day.Not())
                                day_requests.append(same_day)
                            
                            # If any request is on this day, then subject is scheduled on this day
                            if day_requests:
                                self.model.AddBoolOr(day_requests).OnlyEnforceIf(is_scheduled)
                                # If no request is on this day, then subject is not scheduled on this day
                                for req_var in day_requests:
                                    self.model.AddImplication(req_var, is_scheduled)
                        
                        # Count total days scheduled
                        days_count = self.model.NewIntVar(0, self.num_days, f'{class_id}_{subject_id}_days_count')
                        self.model.Add(days_count == sum(day_scheduled))
                        
                        # Apply minDaysPerWeek constraint
                        if subject_req.minDaysPerWeek:
                            self.model.Add(days_count >= subject_req.minDaysPerWeek)
                        
                        # Apply maxDaysPerWeek constraint
                        if subject_req.maxDaysPerWeek:
                            self.model.Add(days_count <= subject_req.maxDaysPerWeek)
        
        # Enforce break period constraints - optimized
        # Only apply if there are actual break periods
        if self.data.config.breakPeriods:
            for r_idx, req in enumerate(self.requests):
                start = self.start_vars[r_idx]
                length = req['length']
                c_idx = self.class_map[req['class_id']]
                
                # For each period in the request, ensure it's not during a break
                for offset in range(length):
                    slot_var = self.model.NewIntVar(0, self.num_slots - 1, f'slot_{r_idx}_{offset}')
                    self.model.Add(slot_var == start + offset)
                    
                    # Check if this slot is a break period for this class
                    is_break = self.model.NewBoolVar(f'is_break_{r_idx}_{offset}')
                    self.model.AddElement(slot_var, self.class_blocked_slots[c_idx], is_break)
                    
                    # Ensure the slot is not a break period (0 means not blocked/break)
                    self.model.Add(is_break == 0)
        
        # CRITICAL: Prevent gaps in class schedules - students must have consecutive lessons
        # This is a HARD CONSTRAINT as per Afghan school regulations - ALL periods must be filled
        log.info("Applying gap prevention HARD constraints for classes...")
        class_day_lessons = collections.defaultdict(lambda: collections.defaultdict(list))
        
        # Collect all lessons for each class-day combination
        for r_idx, req in enumerate(self.requests):
            class_id = req['class_id']
            c_idx = self.class_map[class_id]
            start = self.start_vars[r_idx]
            length = req['length']
            
            # Get the day for this request
            start_day = self.model.NewIntVar(0, self.num_days - 1, f'gap_prevent_start_day_{r_idx}')
            self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
            
            # Get the period within the day
            start_period = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'gap_prevent_period_{r_idx}')
            self.model.AddModuloEquality(start_period, start, self.num_periods_per_day)
            
            # Store for each possible day
            for day_idx in range(self.num_days):
                class_day_lessons[class_id][day_idx].append((r_idx, start_day, start_period, length))
        
        # For each class-day combination with multiple lessons, penalize gaps
        gap_penalties = []
        for class_id, days in class_day_lessons.items():
            c_idx = self.class_map[class_id]
            for day_idx, lessons in days.items():
                if len(lessons) <= 1:
                    continue  # No gap possible with 0 or 1 lesson
                
                # Collect all lesson periods for this class-day
                lesson_vars = []
                for r_idx, start_day, start_period, length in lessons:
                    # Create boolean: is this lesson on this day?
                    is_on_day = self.model.NewBoolVar(f'gap_on_day_{r_idx}_{day_idx}')
                    self.model.Add(start_day == day_idx).OnlyEnforceIf(is_on_day)
                    self.model.Add(start_day != day_idx).OnlyEnforceIf(is_on_day.Not())
                    
                    lesson_vars.append((r_idx, start_day, start_period, length, is_on_day))
                
                # Count how many lessons are actually on this day
                lessons_on_day = self.model.NewIntVar(0, len(lessons), f'gap_count_{class_id}_{day_idx}')
                self.model.Add(lessons_on_day == sum(var[4] for var in lesson_vars))
                
                # If at least 2 lessons on this day, calculate gap penalty
                has_multiple_lessons = self.model.NewBoolVar(f'gap_multiple_{class_id}_{day_idx}')
                self.model.Add(lessons_on_day >= 2).OnlyEnforceIf(has_multiple_lessons)
                self.model.Add(lessons_on_day < 2).OnlyEnforceIf(has_multiple_lessons.Not())
                
                # Calculate total duration of lessons on this day
                total_duration = self.model.NewIntVar(0, self.num_periods_per_day, f'gap_duration_{class_id}_{day_idx}')
                duration_sum = sum(var[4] * var[3] for var in lesson_vars)  # is_on_day * length
                self.model.Add(total_duration == duration_sum)
                
                # Calculate span (max end - min start)
                min_start = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'gap_min_start_{class_id}_{day_idx}')
                max_end = self.model.NewIntVar(0, self.num_periods_per_day, f'gap_max_end_{class_id}_{day_idx}')
                
                # For lessons on this day, find min start and max end
                start_periods = []
                end_periods = []
                for r_idx, start_day, start_period, length, is_on_day in lesson_vars:
                    # Conditional start period (if on this day, use start_period, else use max value)
                    cond_start = self.model.NewIntVar(0, self.num_periods_per_day, f'gap_cond_start_{r_idx}_{day_idx}')
                    self.model.Add(cond_start == start_period).OnlyEnforceIf(is_on_day)
                    self.model.Add(cond_start == self.num_periods_per_day - 1).OnlyEnforceIf(is_on_day.Not())
                    start_periods.append(cond_start)
                    
                    # Conditional end period (if on this day, use end, else use 0)
                    end_period = self.model.NewIntVar(0, self.num_periods_per_day, f'gap_end_{r_idx}_{day_idx}')
                    self.model.Add(end_period == start_period + length).OnlyEnforceIf(is_on_day)
                    self.model.Add(end_period == 0).OnlyEnforceIf(is_on_day.Not())
                    end_periods.append(end_period)
                
                if start_periods and end_periods:
                    self.model.AddMinEquality(min_start, start_periods)
                    self.model.AddMaxEquality(max_end, end_periods)
                    
                    # Span = max_end - min_start
                    span = self.model.NewIntVar(0, self.num_periods_per_day, f'gap_span_{class_id}_{day_idx}')
                    self.model.Add(span == max_end - min_start)
                    
                    # HARD CONSTRAINT: If multiple lessons on this day, span MUST equal total duration (no gaps!)
                    # This forces: (last_lesson_end - first_lesson_start) == sum(all_lesson_durations)
                    # Which mathematically proves no gaps exist!
                    # This is MANDATORY for Afghan schools where all periods must be filled
                    self.model.Add(span == total_duration).OnlyEnforceIf(has_multiple_lessons)
        
        log.info("Gap prevention HARD constraints applied successfully")
        
        # CRITICAL: Teacher Continuity Constraint (Afghanistan School Rule)
        # One subject in one class must be taught by THE SAME teacher throughout the week
        log.info("Applying teacher continuity constraint (same teacher per class-subject)...")
        class_subject_requests = collections.defaultdict(list)
        
        # Group all requests by (class_id, subject_id)
        for r_idx, req in enumerate(self.requests):
            class_id = req['class_id']
            subject_id = req['subject_id']
            key = (class_id, subject_id)
            class_subject_requests[key].append(r_idx)
        
        # For each (class, subject) with multiple requests, enforce same teacher
        continuity_constraints_added = 0
        for (class_id, subject_id), request_indices in class_subject_requests.items():
            if len(request_indices) > 1:
                # All requests for this class-subject must have the same teacher
                first_request_idx = request_indices[0]
                first_teacher_var = self.teacher_vars[first_request_idx]
                
                for r_idx in request_indices[1:]:
                    # Force this request to have the same teacher as the first request
                    self.model.Add(self.teacher_vars[r_idx] == first_teacher_var)
                    continuity_constraints_added += 1
                
                log.debug(f"Teacher continuity: class {class_id}, subject {subject_id}, {len(request_indices)} lessons must have same teacher")
        
        log.info(f"Teacher continuity constraints applied: {continuity_constraints_added} constraints added")
        
        # Teacher Workload Constraints - Phase 3 Optimized using pre-computed mappings
        log.info("Applying teacher workload constraints (Phase 3 optimized)...")
        for t_idx, teacher in enumerate(self.data.teachers):
            # Phase 3: Use pre-computed teacher_to_requests mapping
            # BEFORE: O(teachers × all_requests) - checked every request for every teacher
            # AFTER: O(teachers × relevant_requests) - only check requests this teacher can teach
            relevant_requests = self.teacher_to_requests.get(t_idx, [])
            
            if not relevant_requests and teacher.maxPeriodsPerWeek > 0:
                # Teacher has no requests they can teach - just check fixed lessons
                fixed_load = sum(1 for fl in self.data.fixedLessons or [] if t_idx == self.teacher_map[fl.teacherIds[0]])
                # No constraint needed if no dynamic or fixed load
                continue
            
            # Dynamic load calculation - only loop through relevant requests
            dynamic_load = 0
            for r_idx in relevant_requests:
                # Create a boolean variable to check if this teacher is assigned to this request
                is_assigned = self.model.NewBoolVar(f'is_assigned_{r_idx}_{t_idx}')
                self.model.Add(self.teacher_vars[r_idx] == t_idx).OnlyEnforceIf(is_assigned)
                self.model.Add(self.teacher_vars[r_idx] != t_idx).OnlyEnforceIf(is_assigned.Not())
                dynamic_load += is_assigned * self.requests[r_idx]['length']
            
            fixed_load = sum(1 for fl in self.data.fixedLessons or [] if t_idx == self.teacher_map[fl.teacherIds[0]])
            self.model.Add(dynamic_load + fixed_load <= teacher.maxPeriodsPerWeek)
            
            # Add max periods per day constraint - Phase 3 Optimized
            if teacher.maxPeriodsPerDay and teacher.maxPeriodsPerDay > 0:
                for day_idx in range(self.num_days):
                    day_load = 0
                    # Phase 3: Only loop through relevant requests for this teacher
                    for r_idx in relevant_requests:
                        # Create a boolean variable to check if this teacher is assigned to this request
                        is_assigned = self.model.NewBoolVar(f'day_load_is_assigned_{r_idx}_{t_idx}_{day_idx}')
                        self.model.Add(self.teacher_vars[r_idx] == t_idx).OnlyEnforceIf(is_assigned)
                        self.model.Add(self.teacher_vars[r_idx] != t_idx).OnlyEnforceIf(is_assigned.Not())
                        
                        # Check if this request is on the current day
                        start = self.start_vars[r_idx]
                        start_day = self.model.NewIntVar(0, self.num_days - 1, f'day_load_start_day_{r_idx}_{t_idx}_{day_idx}')
                        self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
                        is_on_day = self.model.NewBoolVar(f'day_load_is_on_day_{r_idx}_{t_idx}_{day_idx}')
                        self.model.Add(start_day == day_idx).OnlyEnforceIf(is_on_day)
                        self.model.Add(start_day != day_idx).OnlyEnforceIf(is_on_day.Not())
                        
                        # If assigned and on this day, add to day load
                        is_assigned_and_on_day = self.model.NewBoolVar(f'day_load_is_assigned_and_on_day_{r_idx}_{t_idx}_{day_idx}')
                        self.model.AddBoolAnd([is_assigned, is_on_day]).OnlyEnforceIf(is_assigned_and_on_day)
                        self.model.AddBoolOr([is_assigned.Not(), is_on_day.Not()]).OnlyEnforceIf(is_assigned_and_on_day.Not())
                        
                        day_load += is_assigned_and_on_day * self.requests[r_idx]['length']
                    
                    self.model.Add(day_load <= teacher.maxPeriodsPerDay)
            
            # Add max consecutive periods constraint
            if teacher.maxConsecutivePeriods and teacher.maxConsecutivePeriods > 0:
                log.info(f"Applying maxConsecutivePeriods constraint for teacher {teacher.fullName}: max {teacher.maxConsecutivePeriods} consecutive periods")
                
                for day_idx in range(self.num_days):
                    # For each day, check all possible windows of consecutive periods
                    for start_period in range(self.num_periods_per_day):
                        # Check windows from maxConsecutivePeriods+1 to num_periods_per_day
                        # If we have a window longer than allowed, at least one period must be free
                        max_window = min(self.num_periods_per_day - start_period, teacher.maxConsecutivePeriods + 1)
                        
                        if max_window <= teacher.maxConsecutivePeriods:
                            continue  # This window is small enough, no constraint needed
                        
                        # Create boolean variables for each period in the window
                        # to check if teacher is teaching in that period
                        period_teaching = []
                        for period_offset in range(max_window):
                            period_idx = start_period + period_offset
                            slot_idx = day_idx * self.num_periods_per_day + period_idx
                            
                            # Check if teacher is teaching in this slot
                            is_teaching_in_slot = self.model.NewBoolVar(f'teacher_{t_idx}_teaching_day{day_idx}_period{period_idx}')
                            
                            # Phase 3: Only check relevant requests for this teacher
                            teaching_conditions = []
                            for r_idx in relevant_requests:
                                req = self.requests[r_idx]
                                
                                # Check if this request is taught by this teacher and occupies this slot
                                is_assigned_to_teacher = self.model.NewBoolVar(f'consecutive_assigned_{r_idx}_{t_idx}_slot{slot_idx}')
                                self.model.Add(self.teacher_vars[r_idx] == t_idx).OnlyEnforceIf(is_assigned_to_teacher)
                                self.model.Add(self.teacher_vars[r_idx] != t_idx).OnlyEnforceIf(is_assigned_to_teacher.Not())
                                
                                # Check if this slot is within the request's time range
                                start = self.start_vars[r_idx]
                                length = req['length']
                                
                                # slot_idx must be >= start and < start + length
                                slot_in_range = self.model.NewBoolVar(f'consecutive_in_range_{r_idx}_slot{slot_idx}')
                                self.model.Add(start <= slot_idx).OnlyEnforceIf(slot_in_range)
                                self.model.Add(start + length > slot_idx).OnlyEnforceIf(slot_in_range)
                                self.model.AddBoolOr([
                                    self.model.NewBoolVar(f'consecutive_before_{r_idx}_slot{slot_idx}'),
                                    self.model.NewBoolVar(f'consecutive_after_{r_idx}_slot{slot_idx}')
                                ]).OnlyEnforceIf(slot_in_range.Not())
                                self.model.Add(start > slot_idx).OnlyEnforceIf(
                                    self.model.NewBoolVar(f'consecutive_before_{r_idx}_slot{slot_idx}')
                                )
                                self.model.Add(start + length <= slot_idx).OnlyEnforceIf(
                                    self.model.NewBoolVar(f'consecutive_after_{r_idx}_slot{slot_idx}')
                                )
                                
                                # Teaching in this slot if assigned to teacher AND slot in range
                                is_teaching_this_request = self.model.NewBoolVar(f'consecutive_teaching_{r_idx}_{t_idx}_slot{slot_idx}')
                                self.model.AddBoolAnd([is_assigned_to_teacher, slot_in_range]).OnlyEnforceIf(is_teaching_this_request)
                                self.model.AddBoolOr([is_assigned_to_teacher.Not(), slot_in_range.Not()]).OnlyEnforceIf(is_teaching_this_request.Not())
                                
                                teaching_conditions.append(is_teaching_this_request)
                            
                            # Teacher is teaching in this slot if any request meets the conditions
                            if teaching_conditions:
                                self.model.AddBoolOr(teaching_conditions).OnlyEnforceIf(is_teaching_in_slot)
                                # Ensure if no request is teaching, the teacher is not teaching
                                self.model.AddBoolAnd([cond.Not() for cond in teaching_conditions]).OnlyEnforceIf(is_teaching_in_slot.Not())
                            else:
                                self.model.Add(is_teaching_in_slot == 0)
                            
                            period_teaching.append(is_teaching_in_slot)
                        
                        # In any window of (maxConsecutivePeriods + 1) consecutive periods,
                        # at least one period must be free (not teaching)
                        if len(period_teaching) > teacher.maxConsecutivePeriods:
                            # Sum of teaching periods in window must be <= maxConsecutivePeriods
                            self.model.Add(sum(period_teaching) <= teacher.maxConsecutivePeriods)
        
        log.info("Hard constraints applied successfully")
        progress_reporter.report("hard_constraints", 50, "Hard constraints applied successfully")
            
    def _export_model_summary(self):
        """Export a summary of the model for debugging purposes."""
        try:
            summary = {
                "model_stats": {
                    "num_requests": self.num_requests,
                    "num_teachers": len(self.data.teachers),
                    "num_rooms": len(self.data.rooms),
                    "num_classes": len(self.data.classes),
                    "num_periods_per_day": self.num_periods_per_day,
                    "num_days": self.num_days,
                    "num_slots": self.num_slots
                },
                "variable_counts": {
                    "start_vars": len(self.start_vars),
                    "teacher_vars": len(self.teacher_vars),
                    "room_vars": len(self.room_vars)
                },
                "interval_counts": {
                    "class_intervals": sum(len(intervals) for intervals in self.class_intervals.values()),
                    "teacher_intervals": sum(len(intervals) for intervals in self.teacher_intervals.values()),
                    "room_intervals": sum(len(intervals) for intervals in self.room_intervals.values())
                },
                "cache_stats": {
                    "cached_domains": len(self.allowed_domains),
                    "cached_booleans": len(self.is_assigned_cache)
                }
            }
            
            log.info("Model summary for debugging", **summary)
        except Exception as e:
            log.warning("Failed to generate model summary", error=str(e))
    
    def _apply_soft_constraints_progressive(self):
        """
        Phase 3.3: Apply soft constraints progressively based on problem complexity.
        
        Uses ConstraintBudget and ProgressiveConstraintManager to:
        1. Limit total penalty variables
        2. Prioritize important constraints
        3. Skip low-priority constraints for large problems
        """
        if not self.data.preferences:
            log.info("No preferences provided, skipping soft constraints")
            progress_reporter.report("soft_constraints", 60, "No soft constraints to apply")
            return
        
        progress_reporter.report("soft_constraints", 55, "Applying soft constraints progressively...")
        log.info("Applying soft constraints with budget control...")
        
        self.penalties = []
        prefs = self.data.preferences
        
        # CRITICAL SOFT CONSTRAINTS (always apply if budget allows)
        if self.progressive_manager.should_apply_constraint(ConstraintStage.CRITICAL_SOFT):
            self._apply_critical_soft_constraints()
        
        # IMPORTANT SOFT CONSTRAINTS (apply for small/medium problems)
        if self.progressive_manager.should_apply_constraint(ConstraintStage.IMPORTANT_SOFT):
            self._apply_important_soft_constraints()
        
        # OPTIONAL SOFT CONSTRAINTS (apply only for small problems)
        if self.progressive_manager.should_apply_constraint(ConstraintStage.OPTIONAL_SOFT):
            self._apply_optional_soft_constraints()
        
        # Log budget usage
        self.constraint_budget.log_summary()
        
        # Minimize total penalty
        if self.penalties:
            log.info(f"Minimizing {len(self.penalties)} penalty variables")
            progress_reporter.report("soft_constraints", 60, f"Optimizing {len(self.penalties)} soft constraints")
            self.model.Minimize(sum(self.penalties))
        else:
            log.info("No penalty variables created")
            progress_reporter.report("soft_constraints", 60, "No soft constraints applied")
    
    def _apply_critical_soft_constraints(self):
        """Apply critical soft constraints (highest priority)."""
        log.info("Applying CRITICAL soft constraints...")
        prefs = self.data.preferences
        
        # 1. Avoid First/Last Period (CRITICAL for student wellbeing)
        weight = int((getattr(prefs, 'avoidFirstLastPeriodWeight', 0.0) or 0.0) * 100)
        if weight > 0 and self.constraint_budget.can_add_penalty(ConstraintPriority.CRITICAL, self.num_requests * 2):
            log.info("Applying avoid first/last period constraint")
            for r_idx, _ in enumerate(self.requests):
                if not self.constraint_budget.allocate_penalty(ConstraintPriority.CRITICAL, 2):
                    break  # Budget exhausted
                
                period_in_day = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'fld_period_in_day_{r_idx}')
                self.model.AddModuloEquality(period_in_day, self.start_vars[r_idx], self.num_periods_per_day)
                is_first = self.model.NewBoolVar(f'is_first_period_{r_idx}')
                is_last = self.model.NewBoolVar(f'is_last_period_{r_idx}')
                self.model.Add(period_in_day == 0).OnlyEnforceIf(is_first)
                self.model.Add(period_in_day != 0).OnlyEnforceIf(is_first.Not())
                self.model.Add(period_in_day == (self.num_periods_per_day - 1)).OnlyEnforceIf(is_last)
                self.model.Add(period_in_day != (self.num_periods_per_day - 1)).OnlyEnforceIf(is_last.Not())
                self.penalties.append(weight * is_first)
                self.penalties.append(weight * is_last)
        
        # 2. Prefer Morning for Difficult Subjects (CRITICAL for student performance)
        weight = int(prefs.preferMorningForDifficultWeight * 100)
        if weight > 0:
            morning_cutoff = math.ceil(self.num_periods_per_day / 2)
            difficult_requests = [r_idx for r_idx, req in enumerate(self.requests) 
                                if self.data.subjects[self.subject_map[req['subject_id']]].isDifficult]
            
            if self.constraint_budget.can_add_penalty(ConstraintPriority.CRITICAL, len(difficult_requests)):
                log.info(f"Applying prefer morning for {len(difficult_requests)} difficult subject requests")
                for r_idx in difficult_requests:
                    if not self.constraint_budget.allocate_penalty(ConstraintPriority.CRITICAL, 1):
                        break
                    
                    period_in_day = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'period_in_day_{r_idx}')
                    self.model.AddModuloEquality(period_in_day, self.start_vars[r_idx], self.num_periods_per_day)
                    is_afternoon = self.model.NewBoolVar(f'afternoon_{r_idx}')
                    self.model.Add(period_in_day >= morning_cutoff).OnlyEnforceIf(is_afternoon)
                    self.penalties.append(weight * is_afternoon)
    
    def _apply_important_soft_constraints(self):
        """Apply important soft constraints (medium priority)."""
        log.info("Applying IMPORTANT soft constraints...")
        prefs = self.data.preferences
        
        # Subject spread across days (avoid clustering)
        weight = int((getattr(prefs, 'subjectSpreadWeight', 0.0) or 0.0) * 100)
        if weight > 0:
            pair_to_indices = collections.defaultdict(list)
            for idx, r in enumerate(self.requests):
                pair_to_indices[(r['class_id'], r['subject_id'])].append(idx)
            
            periods_per_day_const = self.model.NewConstant(self.num_periods_per_day)
            for (c_id, s_id), indices in pair_to_indices.items():
                if len(indices) <= 1:
                    continue
                
                # Estimate penalties needed for this class-subject
                num_pairs = (len(indices) * (len(indices) - 1)) // 2
                if not self.constraint_budget.can_add_penalty(ConstraintPriority.MEDIUM, num_pairs):
                    continue  # Skip this class-subject if over budget
                
                day_vars = []
                for i, r_idx in enumerate(indices):
                    day = self.model.NewIntVar(0, self.num_days - 1, f'spread_day_{c_id}_{s_id}_{r_idx}')
                    self.model.AddDivisionEquality(day, self.start_vars[r_idx], periods_per_day_const)
                    day_vars.append(day)
                
                # Pairwise same-day penalties
                for i in range(len(day_vars)):
                    for j in range(i + 1, len(day_vars)):
                        if not self.constraint_budget.allocate_penalty(ConstraintPriority.MEDIUM, 1):
                            break
                        
                        same_day = self.model.NewBoolVar(f'same_day_{c_id}_{s_id}_{indices[i]}_{indices[j]}')
                        self.model.Add(day_vars[i] == day_vars[j]).OnlyEnforceIf(same_day)
                        self.model.Add(day_vars[i] != day_vars[j]).OnlyEnforceIf(same_day.Not())
                        self.penalties.append(weight * same_day)
    
    def _apply_optional_soft_constraints(self):
        """Apply optional soft constraints (lowest priority, only for small problems)."""
        log.info("Applying OPTIONAL soft constraints...")
        # Teacher time preferences, room change minimization, etc.
        # These are nice-to-have but not critical
        # Only applied for small problems with plenty of budget
        pass
    
    def _apply_soft_constraints(self):
        if not self.data.preferences: 
            log.info("No preferences provided, skipping soft constraints")
            progress_reporter.report("soft_constraints", 60, "No soft constraints to apply")
            return
        progress_reporter.report("soft_constraints", 55, "Applying soft constraints...")
        log.info("Applying soft constraints...")
        self.penalties = []
        prefs = self.data.preferences
        
        # Adaptive constraint limiting for large problems
        is_large_problem = self.num_requests > 200
        is_very_large_problem = self.num_requests > 400
        max_penalties = 500 if is_large_problem else 1000  # Limit penalty variables
        
        if is_large_problem:
            log.info(f"Large problem detected ({self.num_requests} requests), limiting soft constraints")
            progress_reporter.report("soft_constraints", 56, f"Limiting optimizations for large problem ({self.num_requests} requests)")

        # Prefer Morning for Difficult Subjects
        weight = int(prefs.preferMorningForDifficultWeight * 100)
        if weight > 0:
            morning_cutoff = math.ceil(self.num_periods_per_day / 2)
            for r_idx, req in enumerate(self.requests):
                subject = self.data.subjects[self.subject_map[req['subject_id']]]
                if subject.isDifficult:
                    # Fix the modulo issue - use AddModuloEquality
                    period_in_day = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'period_in_day_{r_idx}')
                    self.model.AddModuloEquality(period_in_day, self.start_vars[r_idx], self.num_periods_per_day)
                    is_afternoon = self.model.NewBoolVar(f'afternoon_{r_idx}')
                    self.model.Add(period_in_day >= morning_cutoff).OnlyEnforceIf(is_afternoon)
                    self.penalties.append(weight * is_afternoon)

        # Avoid First/Last Period assignments
        try:
            weight = int((getattr(prefs, 'avoidFirstLastPeriodWeight', 0.0) or 0.0) * 100)
        except Exception:
            weight = 0
        if weight > 0:
            for r_idx, _ in enumerate(self.requests):
                period_in_day = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'fld_period_in_day_{r_idx}')
                self.model.AddModuloEquality(period_in_day, self.start_vars[r_idx], self.num_periods_per_day)
                is_first = self.model.NewBoolVar(f'is_first_period_{r_idx}')
                is_last = self.model.NewBoolVar(f'is_last_period_{r_idx}')
                # Enforce equivalence for correctness
                self.model.Add(period_in_day == 0).OnlyEnforceIf(is_first)
                self.model.Add(period_in_day != 0).OnlyEnforceIf(is_first.Not())
                self.model.Add(period_in_day == (self.num_periods_per_day - 1)).OnlyEnforceIf(is_last)
                self.model.Add(period_in_day != (self.num_periods_per_day - 1)).OnlyEnforceIf(is_last.Not())
                self.penalties.append(weight * is_first)
                self.penalties.append(weight * is_last)

        # Subject spread across days (avoid clustering same subject on the same day)
        try:
            weight = int((getattr(prefs, 'subjectSpreadWeight', 0.0) or 0.0) * 100)
        except Exception:
            weight = 0
        if weight > 0:
            # Group requests by (class_id, subject_id)
            pair_to_indices: Dict[Tuple[str, str], List[int]] = collections.defaultdict(list)
            for idx, r in enumerate(self.requests):
                pair_to_indices[(r['class_id'], r['subject_id'])].append(idx)

            periods_per_day_const = self.model.NewConstant(self.num_periods_per_day)
            for (c_id, s_id), indices in pair_to_indices.items():
                if len(indices) <= 1:
                    continue
                # Create day vars for each request
                day_vars = []
                for i, r_idx in enumerate(indices):
                    day = self.model.NewIntVar(0, self.num_days - 1, f'spread_day_{c_id}_{s_id}_{r_idx}')
                    self.model.AddDivisionEquality(day, self.start_vars[r_idx], periods_per_day_const)
                    day_vars.append(day)
                # Pairwise same-day penalties
                n = len(day_vars)
                for i in range(n):
                    for j in range(i + 1, n):
                        same_day = self.model.NewBoolVar(f'same_day_{c_id}_{s_id}_{indices[i]}_{indices[j]}')
                        # day_i == day_j  <=> same_day
                        # Forward implication
                        self.model.Add(day_vars[i] == day_vars[j]).OnlyEnforceIf(same_day)
                        # Reverse: if not same_day, they can be different; to tighten, add != under Not()
                        self.model.Add(day_vars[i] != day_vars[j]).OnlyEnforceIf(same_day.Not())
                        self.penalties.append(weight * same_day)
        
        # Respect Teacher Time Preferences
        weight = int(prefs.respectTeacherTimePreferenceWeight * 100)
        if weight > 0:
            morning_cutoff = math.ceil(self.num_periods_per_day / 2)
            for r_idx, req in enumerate(self.requests):
                # Get the assigned teacher for this request
                teacher_var = self.teacher_vars[r_idx]
                
                # For each possible teacher, check their time preference
                # Get the domain of allowed teachers for this request
                c_id, s_id = req['class_id'], req['subject_id']
                c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]
                allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                
                for t_idx in allowed_teachers:
                    teacher = self.data.teachers[t_idx]
                    if teacher.timePreference:
                        # Create a boolean to check if this teacher is assigned
                        is_assigned = self.model.NewBoolVar(f'teacher_{t_idx}_assigned_{r_idx}')
                        self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                        self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                        
                        # Check if the assignment violates the teacher's time preference
                        period_in_day = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'period_in_day_teacher_{r_idx}_{t_idx}')
                        self.model.AddModuloEquality(period_in_day, self.start_vars[r_idx], self.num_periods_per_day)
                        
                        # Penalty if morning teacher gets afternoon slot
                        if teacher.timePreference == TimePreference.MORNING:
                            is_afternoon = self.model.NewBoolVar(f'morning_teacher_afternoon_{r_idx}_{t_idx}')
                            self.model.Add(period_in_day >= morning_cutoff).OnlyEnforceIf(is_afternoon)
                            # Apply penalty only if teacher is assigned AND in afternoon
                            penalty_var = self.model.NewBoolVar(f'morning_penalty_{r_idx}_{t_idx}')
                            self.model.AddBoolAnd([is_assigned, is_afternoon]).OnlyEnforceIf(penalty_var)
                            self.model.AddBoolOr([is_assigned.Not(), is_afternoon.Not()]).OnlyEnforceIf(penalty_var.Not())
                            self.penalties.append(weight * penalty_var)
                        
                        # Penalty if afternoon teacher gets morning slot
                        elif teacher.timePreference == TimePreference.AFTERNOON:
                            is_morning = self.model.NewBoolVar(f'afternoon_teacher_morning_{r_idx}_{t_idx}')
                            self.model.Add(period_in_day < morning_cutoff).OnlyEnforceIf(is_morning)
                            # Apply penalty only if teacher is assigned AND in morning
                            penalty_var = self.model.NewBoolVar(f'afternoon_penalty_{r_idx}_{t_idx}')
                            self.model.AddBoolAnd([is_assigned, is_morning]).OnlyEnforceIf(penalty_var)
                            self.model.AddBoolOr([is_assigned.Not(), is_morning.Not()]).OnlyEnforceIf(penalty_var.Not())
                            self.penalties.append(weight * penalty_var)
        
        # Respect Teacher Room Preferences
        weight = int(prefs.respectTeacherRoomPreferenceWeight * 100)
        if weight > 0:
            for r_idx, req in enumerate(self.requests):
                # Get the assigned teacher and room for this request
                teacher_var = self.teacher_vars[r_idx]
                room_var = self.room_vars[r_idx]
                
                # Get the domain of allowed teachers and rooms for this request
                c_id, s_id = req['class_id'], req['subject_id']
                c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]
                allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                allowed_rooms = [self.room_map[r['id']] for r in self.data_dict['rooms'] if is_room_compatible(r, subject, class_group)]
                
                # For each possible teacher, check their room preferences
                for t_idx in allowed_teachers:
                    teacher = self.data.teachers[t_idx]
                    if teacher.preferredRoomIds:
                        # Create a boolean to check if this teacher is assigned
                        is_assigned = self.model.NewBoolVar(f'teacher_{t_idx}_room_assigned_{r_idx}')
                        self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                        self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                        
                        # For each preferred room, check if it's assigned
                        preferred_rooms = set(teacher.preferredRoomIds)
                        for rm_idx in allowed_rooms:
                            room = self.data.rooms[rm_idx]
                            if room.id in preferred_rooms:
                                # This room is preferred, no penalty
                                continue
                            else:
                                # This room is not preferred, add penalty if assigned
                                is_room_assigned = self.model.NewBoolVar(f'room_{rm_idx}_assigned_{r_idx}')
                                self.model.Add(room_var == rm_idx).OnlyEnforceIf(is_room_assigned)
                                self.model.Add(room_var != rm_idx).OnlyEnforceIf(is_room_assigned.Not())
                                
                                # Apply penalty only if teacher is assigned AND non-preferred room is assigned
                                penalty_var = self.model.NewBoolVar(f'room_penalty_{r_idx}_{t_idx}_{rm_idx}')
                                self.model.AddBoolAnd([is_assigned, is_room_assigned]).OnlyEnforceIf(penalty_var)
                                self.model.AddBoolOr([is_assigned.Not(), is_room_assigned.Not()]).OnlyEnforceIf(penalty_var.Not())
                                self.penalties.append(weight * penalty_var)
        
        # Respect Teacher Collaboration Preferences with improved algorithm
        # SKIP for very large problems - this is O(n²) complexity
        if is_very_large_problem:
            log.info("Skipping teacher collaboration constraints for very large problem")
        else:
            weight = 50  # Fixed weight for collaboration preferences
            collaboration_count = 0
            for r_idx, req in enumerate(self.requests):
                if len(self.penalties) >= max_penalties:
                    log.warning(f"Reached penalty limit ({max_penalties}), skipping remaining collaboration constraints")
                    break
                # Get the assigned teacher for this request
                teacher_var = self.teacher_vars[r_idx]
                
                # For each possible teacher, check their collaboration preferences
                c_id, s_id = req['class_id'], req['subject_id']
                c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]
                allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                
                for t_idx in allowed_teachers:
                    teacher = self.data.teachers[t_idx]
                    if teacher.preferredColleagues:
                        # Create a boolean to check if this teacher is assigned
                        is_assigned = self.model.NewBoolVar(f'teacher_{t_idx}_collab_assigned_{r_idx}')
                        self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                        self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                        
                        # Check if any of the teacher's preferred colleagues are also assigned to lessons
                        # at the same time (same day and period)
                        colleague_rewards = []
                        for col_id in teacher.preferredColleagues:
                            if col_id in self.teacher_map:
                                col_idx = self.teacher_map[col_id]
                                # Check if colleague is assigned to any lesson at the same time
                                for other_r_idx, other_req in enumerate(self.requests):
                                    if other_r_idx != r_idx:
                                        other_teacher_var = self.teacher_vars[other_r_idx]
                                        is_colleague_assigned = self.model.NewBoolVar(f'colleague_{col_idx}_assigned_{other_r_idx}_{r_idx}_{t_idx}')
                                        self.model.Add(other_teacher_var == col_idx).OnlyEnforceIf(is_colleague_assigned)
                                        self.model.Add(other_teacher_var != col_idx).OnlyEnforceIf(is_colleague_assigned.Not())
                                        
                                        # Check if lessons are on the same day and period
                                        same_day = self.model.NewBoolVar(f'same_day_{r_idx}_{other_r_idx}_{t_idx}_{col_idx}')
                                        same_period = self.model.NewBoolVar(f'same_period_{r_idx}_{other_r_idx}_{t_idx}_{col_idx}')
                                        both_assigned = self.model.NewBoolVar(f'both_assigned_{r_idx}_{other_r_idx}_{t_idx}_{col_idx}')
                                        
                                        # Same day check
                                        start_day_1 = self.model.NewIntVar(0, self.num_days - 1, f'start_day_1_{r_idx}_{t_idx}_{col_idx}')
                                        start_day_2 = self.model.NewIntVar(0, self.num_days - 1, f'start_day_2_{other_r_idx}_{t_idx}_{col_idx}')
                                        self.model.AddDivisionEquality(start_day_1, self.start_vars[r_idx], self.model.NewConstant(self.num_periods_per_day))
                                        self.model.AddDivisionEquality(start_day_2, self.start_vars[other_r_idx], self.model.NewConstant(self.num_periods_per_day))
                                        self.model.Add(start_day_1 == start_day_2).OnlyEnforceIf(same_day)
                                        self.model.Add(start_day_1 != start_day_2).OnlyEnforceIf(same_day.Not())
                                        
                                        # Same period check
                                        period_1 = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'period_1_{r_idx}_{t_idx}_{col_idx}')
                                        period_2 = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'period_2_{other_r_idx}_{t_idx}_{col_idx}')
                                        self.model.AddModuloEquality(period_1, self.start_vars[r_idx], self.num_periods_per_day)
                                        self.model.AddModuloEquality(period_2, self.start_vars[other_r_idx], self.num_periods_per_day)
                                        self.model.Add(period_1 == period_2).OnlyEnforceIf(same_period)
                                        self.model.Add(period_1 != period_2).OnlyEnforceIf(same_period.Not())
                                        
                                        # Both teachers assigned
                                        self.model.AddBoolAnd([is_assigned, is_colleague_assigned]).OnlyEnforceIf(both_assigned)
                                        self.model.AddBoolOr([is_assigned.Not(), is_colleague_assigned.Not()]).OnlyEnforceIf(both_assigned.Not())
                                        
                                        # Reward for having preferred colleague in same time slot
                                        reward = self.model.NewBoolVar(f'reward_{r_idx}_{other_r_idx}_{t_idx}_{col_idx}')
                                        self.model.AddBoolAnd([same_day, same_period, both_assigned]).OnlyEnforceIf(reward)
                                        self.model.AddBoolOr([same_day.Not(), same_period.Not(), both_assigned.Not()]).OnlyEnforceIf(reward.Not())
                                        
                                        colleague_rewards.append(reward)
                        
                        # Apply negative penalty (reward) if any preferred colleague is scheduled together
                        if colleague_rewards:
                            has_preferred_colleague = self.model.NewBoolVar(f'has_preferred_colleague_{r_idx}_{t_idx}')
                            self.model.AddBoolOr(colleague_rewards).OnlyEnforceIf(has_preferred_colleague)
                            self.model.AddBoolAnd([r.Not() for r in colleague_rewards]).OnlyEnforceIf(has_preferred_colleague.Not())
                            # Negative penalty (reward) - reduces the overall penalty
                            self.penalties.append(-weight * has_preferred_colleague)
        
        # Avoid Teacher Gaps with improved algorithm
        # Simplify or skip for very large problems - this is expensive
        weight = int(prefs.avoidTeacherGapsWeight * 100)
        if weight > 0 and not is_very_large_problem:
            for t_idx, teacher in enumerate(self.data.teachers):
                if len(self.penalties) >= max_penalties:
                    log.warning(f"Reached penalty limit ({max_penalties}), skipping remaining gap avoidance constraints")
                    break
                    
                # Track teacher's scheduled periods across all days
                teacher_day_intervals = collections.defaultdict(list)  # day -> list of interval variables
                
                # Collect all intervals for this teacher
                for r_idx in range(self.num_requests):
                    req = self.requests[r_idx]
                    # Check if this teacher can teach this request
                    c_id, s_id = req['class_id'], req['subject_id']
                    c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                    subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]
                    allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                    
                    if t_idx in allowed_teachers:
                        # Get or create a boolean to check if this teacher is assigned to this request
                        is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                        
                        # If assigned, track the interval
                        start = self.start_vars[r_idx]
                        length = req['length']
                        
                        # Get the day for this request
                        start_day = self.model.NewIntVar(0, self.num_days - 1, f'teacher_{t_idx}_start_day_{r_idx}')
                        self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
                        
                        # Create interval for this request
                        interval = self.model.NewIntervalVar(start, length, start + length, f'teacher_{t_idx}_interval_{r_idx}')
                        
                        # Create optional interval that is only active if teacher is assigned
                        optional_interval = self.model.NewOptionalIntervalVar(start, length, start + length, is_assigned, f'teacher_{t_idx}_optional_interval_{r_idx}')
                        teacher_day_intervals[start_day].append(optional_interval)
                
                # For each day, minimize gaps between scheduled periods using aggregated penalty
                for day_idx in range(self.num_days):
                    if day_idx in teacher_day_intervals:
                        intervals = teacher_day_intervals[day_idx]
                        if len(intervals) > 1:
                            # Calculate total gap for this teacher on this day
                            total_gap = self.model.NewIntVar(0, self.num_periods_per_day * len(intervals), f'teacher_{t_idx}_day_{day_idx}_total_gap')
                            gap_components = []
                            
                            # Sort intervals by start time to calculate gaps properly
                            # We'll add constraints to ensure proper ordering and gap calculation
                            for i in range(len(intervals) - 1):
                                interval1 = intervals[i]
                                interval2 = intervals[i + 1]
                                
                                # Calculate gap between consecutive intervals
                                gap = self.model.NewIntVar(0, self.num_periods_per_day, f'teacher_{t_idx}_day_{day_idx}_gap_{i}')
                                self.model.Add(gap == interval2.StartExpr() - interval1.EndExpr())
                                gap_components.append(gap)
                            
                            # Sum all gaps for this day
                            if gap_components:
                                self.model.Add(total_gap == sum(gap_components))
                                # Add single penalty for total gap
                                gap_penalty = self.model.NewIntVar(0, self.num_periods_per_day * len(intervals) * weight, f'teacher_{t_idx}_day_{day_idx}_gap_penalty')
                                self.model.Add(gap_penalty == total_gap * weight)
                                self.penalties.append(gap_penalty)
        
        # Avoid Class Gaps with improved algorithm using aggregated penalties
        weight = int(prefs.avoidClassGapsWeight * 100)
        if weight > 0:
            # Track class gaps per day using aggregated variables
            class_day_gaps = collections.defaultdict(lambda: collections.defaultdict(list))  # class -> day -> gaps
            
            for r_idx, req in enumerate(self.requests):
                c_idx = self.class_map[req['class_id']]
                start = self.start_vars[r_idx]
                length = req['length']
                
                # Get the day for this request
                start_day = self.model.NewIntVar(0, self.num_days - 1, f'class_{c_idx}_start_day_{r_idx}')
                self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
                
                # Store start and end times for gap calculation
                class_day_gaps[c_idx][start_day].append((start, start + length, r_idx))
            
            # Calculate aggregated penalties for each class-day combination
            for c_idx, day_gaps in class_day_gaps.items():
                class_group = self.data.classes[c_idx]
                for day_idx, intervals in day_gaps.items():
                    if len(intervals) > 1:
                        # Calculate spread penalty using aggregated approach
                        start_vars = [interval[0] for interval in intervals]  # start times
                        end_vars = [interval[1] for interval in intervals]    # end times
                        
                        if start_vars and end_vars:
                            min_start = self.model.NewIntVar(0, self.num_slots, f'class_{c_idx}_day_{day_idx}_min_start')
                            max_end = self.model.NewIntVar(0, self.num_slots, f'class_{c_idx}_day_{day_idx}_max_end')
                            self.model.AddMinEquality(min_start, start_vars)
                            self.model.AddMaxEquality(max_end, end_vars)
                            
                            # Spread is the difference between max end and min start
                            spread = self.model.NewIntVar(0, self.num_periods_per_day, f'class_{c_idx}_day_{day_idx}_spread')
                            self.model.Add(spread == max_end - min_start)
                            
                            # Add single penalty for spread (scaled)
                            spread_penalty = self.model.NewIntVar(0, self.num_periods_per_day * weight, f'class_{c_idx}_day_{day_idx}_spread_penalty')
                            self.model.Add(spread_penalty == spread * weight)
                            self.penalties.append(spread_penalty)
        
        # Distribute Difficult Subjects with improved algorithm
        weight = int(prefs.distributeDifficultSubjectsWeight * 100)
        if weight > 0:
            # Track difficult subjects per day
            difficult_subjects_per_day = collections.defaultdict(list)  # day -> list of request indices
            
            for r_idx, req in enumerate(self.requests):
                subject = self.data.subjects[self.subject_map[req['subject_id']]]
                if subject.isDifficult:
                    start = self.start_vars[r_idx]
                    start_day = self.model.NewIntVar(0, self.num_days - 1, f'difficult_start_day_{r_idx}')
                    self.model.AddDivisionEquality(start_day, start, self.model.NewConstant(self.num_periods_per_day))
                    difficult_subjects_per_day[start_day].append(r_idx)
            
            # Calculate variance in distribution and penalize high variance
            if difficult_subjects_per_day:
                # Count difficult subjects per day
                day_counts = []
                for day_idx in range(self.num_days):
                    count_var = self.model.NewIntVar(0, len(self.requests), f'difficult_count_day_{day_idx}')
                    if day_idx in difficult_subjects_per_day:
                        self.model.Add(count_var == len(difficult_subjects_per_day[day_idx]))
                    else:
                        self.model.Add(count_var == 0)
                    day_counts.append(count_var)
                
                # Calculate average
                total_difficult = sum(len(reqs) for reqs in difficult_subjects_per_day.values())
                avg_count = total_difficult / self.num_days if self.num_days > 0 else 0
                
                # Penalize deviation from average
                for day_idx, count_var in enumerate(day_counts):
                    deviation = self.model.NewIntVar(0, len(self.requests), f'difficult_deviation_day_{day_idx}')
                    # Absolute deviation from average
                    self.model.AddAbsEquality(deviation, count_var - int(avg_count))
                    deviation_penalty = self.model.NewIntVar(0, len(self.requests) * 100, f'difficult_deviation_penalty_day_{day_idx}')
                    self.model.Add(deviation_penalty == deviation * weight)
                    self.penalties.append(deviation_penalty)
        
        # Balance Teacher Load with improved algorithm using aggregated penalties
        weight = int(prefs.balanceTeacherLoadWeight * 100)
        if weight > 0:
            # Calculate teacher workloads using cached is_assigned variables
            teacher_workloads = []
            for t_idx, teacher in enumerate(self.data.teachers):
                # Dynamic load calculation using cached boolean variables
                dynamic_load = self.model.NewIntVar(0, teacher.maxPeriodsPerWeek, f'teacher_{t_idx}_dynamic_load')
                load_components = []
                
                for r_idx in range(self.num_requests):
                    # Only count if this teacher is in the allowed teachers for this request
                    req = self.requests[r_idx]
                    c_id, s_id = req['class_id'], req['subject_id']
                    c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
                    subject, class_group = self.data_dict['subjects'][s_idx], self.data.classes[c_idx]
                    allowed_teachers = [self.teacher_map[t['id']] for t in self.data_dict['teachers'] if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)]
                    
                    if t_idx in allowed_teachers:
                        # Get or create a boolean variable to check if this teacher is assigned to this request
                        is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                        load_components.append(is_assigned * self.requests[r_idx]['length'])
                
                if load_components:
                    self.model.Add(dynamic_load == sum(load_components))
                else:
                    self.model.Add(dynamic_load == 0)
                
                teacher_workloads.append(dynamic_load)
            
            # Calculate average workload
            if teacher_workloads:
                total_workload = self.model.NewIntVar(0, sum(t.maxPeriodsPerWeek for t in self.data.teachers), 'total_teacher_workload')
                self.model.Add(total_workload == sum(teacher_workloads))
                if len(self.data.teachers) > 0:
                    avg_workload_var = self.model.NewIntVar(0, sum(t.maxPeriodsPerWeek for t in self.data.teachers), 'avg_teacher_workload')
                    self.model.AddDivisionEquality(avg_workload_var, total_workload, len(self.data.teachers))
                else:
                    avg_workload_var = self.model.NewConstant(0)
                
                # Penalize deviation from average using aggregated penalty
                total_deviation = self.model.NewIntVar(0, sum(t.maxPeriodsPerWeek for t in self.data.teachers), 'total_teacher_workload_deviation')
                deviation_components = []
                
                for t_idx, workload in enumerate(teacher_workloads):
                    deviation = self.model.NewIntVar(0, max(t.maxPeriodsPerWeek for t in self.data.teachers), f'teacher_{t_idx}_workload_deviation')
                    # Absolute deviation from average
                    diff = self.model.NewIntVar(-max(t.maxPeriodsPerWeek for t in self.data.teachers), max(t.maxPeriodsPerWeek for t in self.data.teachers), f'teacher_{t_idx}_workload_diff')
                    self.model.Add(diff == workload - avg_workload_var)
                    self.model.AddAbsEquality(deviation, diff)
                    deviation_components.append(deviation)
                
                # Aggregate all deviations into a single penalty
                if deviation_components:
                    self.model.Add(total_deviation == sum(deviation_components))
                    total_deviation_penalty = self.model.NewIntVar(0, sum(t.maxPeriodsPerWeek for t in self.data.teachers) * weight, 'total_teacher_workload_deviation_penalty')
                    self.model.Add(total_deviation_penalty == total_deviation * weight)
                    self.penalties.append(total_deviation_penalty)
        
        # Minimize Room Changes for Classes with improved algorithm using aggregated penalties
        weight = int(prefs.minimizeRoomChangesWeight * 100)
        if weight > 0:
            # Track room changes for each class using aggregated approach
            class_room_changes = collections.defaultdict(int)  # class -> total room changes
            
            for c_idx, class_group in enumerate(self.data.classes):
                class_requests = []
                for r_idx, req in enumerate(self.requests):
                    if req['class_id'] == class_group.id:
                        class_requests.append(r_idx)
                
                # For consecutive requests, count room changes
                if len(class_requests) > 1:
                    room_change_count = self.model.NewIntVar(0, len(class_requests) - 1, f'class_{c_idx}_room_change_count')
                    change_components = []
                    
                    for i in range(len(class_requests) - 1):
                        r1_idx = class_requests[i]
                        r2_idx = class_requests[i + 1]
                        
                        # Check if rooms are different
                        room1 = self.room_vars[r1_idx]
                        room2 = self.room_vars[r2_idx]
                        
                        # Create boolean to check if rooms are different
                        rooms_different = self.model.NewBoolVar(f'class_{c_idx}_rooms_different_{i}')
                        self.model.Add(room1 != room2).OnlyEnforceIf(rooms_different)
                        self.model.Add(room1 == room2).OnlyEnforceIf(rooms_different.Not())
                        change_components.append(rooms_different)
                    
                    # Aggregate all room changes for this class
                    if change_components:
                        self.model.Add(room_change_count == sum(change_components))
                        # Single penalty for total room changes for this class
                        room_change_penalty = self.model.NewIntVar(0, (len(class_requests) - 1) * weight, f'class_{c_idx}_room_change_penalty')
                        self.model.Add(room_change_penalty == room_change_count * weight)
                        self.penalties.append(room_change_penalty)

        if self.penalties:
            actual_penalty_count = len(self.penalties)
            log.info("Applying objective function", penalty_count=actual_penalty_count)
            
            if is_large_problem or is_very_large_problem:
                problem_size = "very large" if is_very_large_problem else "large"
                log.info(f"Optimized for {problem_size} problem: {actual_penalty_count} penalties applied (limit: {max_penalties})")
                progress_reporter.report("soft_constraints", 58, f"Optimizations limited for {problem_size} problem", {
                    "penalties_applied": actual_penalty_count,
                    "penalty_limit": max_penalties,
                    "skipped_expensive": is_very_large_problem
                })
            
            self.model.Minimize(sum(self.penalties))
            progress_reporter.report("soft_constraints", 60, "Soft constraints and optimization objectives applied", {
                "penalty_count": actual_penalty_count
            })
        else:
            log.info("No penalties to apply")
            progress_reporter.report("soft_constraints", 60, "No optimization penalties to apply")

# ==============================================================================
# 3. SCRIPT EXECUTION ENTRYPOINT
# ==============================================================================

def solve_with_decomposition_if_beneficial(input_data: dict) -> List[Dict]:
    """
    Intelligently choose between regular solver and decomposition solver.
    
    Uses DecompositionSolver to analyze problem size and decide whether
    decomposition would be beneficial.
    
    Args:
        input_data: Validated input data dictionary
    
    Returns:
        List of scheduled lessons or error
    """
    # Parse input data into Pydantic model for analysis
    data = TimetableData(**input_data)
    
    # Get solver parameters from config
    time_limit = input_data.get('config', {}).get('solverTimeLimitSeconds', 600)
    enable_degradation = input_data.get('config', {}).get('enableGracefulDegradation', True)
    optimization_level = input_data.get('config', {}).get('solverOptimizationLevel', 2)
    
    # Create decomposition solver (pass DICT, not TimetableData)
    # DecompositionSolver will parse it internally
    decomp_solver = DecompositionSolver(input_data, TimetableSolver)
    
    log.info("Using intelligent solver selection (Phase 4 decomposition)",
             num_requests=decomp_solver.num_requests,
             num_classes=len(data.classes),
             num_teachers=len(data.teachers))
    
    # Solve (DecompositionSolver will choose the best approach)
    solution = decomp_solver.solve(
        time_limit_seconds=time_limit,
        enable_graceful_degradation=enable_degradation,
        optimization_level=optimization_level
    )
    
    return solution


def main():
    """Entry point: reads from stdin, solves, prints to stdout."""
    log.info("Python solver script started.")
    try:
        # Read input data with Unicode handling
        log.info("Reading input data from stdin...")
        raw = sys.stdin.buffer.read()
        try:
            text = raw.decode('utf-8')
        except UnicodeDecodeError:
            # try to unescape common double-escaped sequences
            text = raw.decode('utf-8', 'replace')
            log.warning("Unicode decode error encountered, using replacement characters")
        # If the string contains escaped unicode sequences like "\\u06...", unescape them
        if '\\u' in text:
            try:
                text = text.encode('utf-8').decode('unicode_escape')
                log.info("Unescaped Unicode sequences in input data")
            except Exception:
                log.warning("Could not unescape unicode sequences; continuing with best-effort decoding")
        input_data = json.loads(text)
        log.info("Input data received.", data_size=len(json.dumps(input_data)))
        
        # Validate input data structure
        if not isinstance(input_data, dict):
            raise ValueError("Input data must be a JSON object")
        
        # Check for required top-level keys
        required_keys = ['config', 'rooms', 'subjects', 'teachers', 'classes']
        missing_keys = [key for key in required_keys if key not in input_data]
        if missing_keys:
            raise ValueError(f"Missing required keys in input data: {missing_keys}")
        
        # Solve using intelligent decomposition (Phase 4)
        log.info("Initializing intelligent timetable solver...")
        log.info("Starting solve process with automatic decomposition detection...")
        
        solution = solve_with_decomposition_if_beneficial(input_data)
        
        # Report results
        if solution and not solution[0].get('error'):
            log.info("Solution generated successfully.", solution_size=len(solution))
            # Print only JSON to stdout, no other text
            sys.stdout.write(json.dumps(solution, indent=2))
            sys.stdout.write('\n')
        else:
            log.warning("Solver completed with issues.", solution_status=solution[0] if solution else "No solution")
            # Print only JSON to stdout, no other text
            sys.stdout.write(json.dumps(solution, indent=2))
            sys.stdout.write('\n')
            
    except json.JSONDecodeError as e:
        error_msg = f"Invalid JSON input: {str(e)}"
        log.error("JSON parsing failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "INVALID_INPUT", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except ValueError as e:
        error_msg = f"Data validation error: {str(e)}"
        log.error("Data validation failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "VALIDATION_ERROR", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except RuntimeError as e:
        error_str = str(e)
        # Check if the error message is already JSON
        try:
            error_data = json.loads(error_str)
            # It's already JSON, use it as-is
            error_data["status"] = "RUNTIME_ERROR"
            print(json.dumps(error_data, indent=2), file=sys.stderr)
        except json.JSONDecodeError:
            # It's a regular string, format it as before
            error_msg = f"Runtime error: {error_str}"
            log.error("Runtime error occurred.", error=error_msg, exc_info=True)
            print(json.dumps({"error": error_msg, "status": "RUNTIME_ERROR", "details": error_str}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        log.error("Solver script failed.", error=error_msg, exc_info=True)
        print(json.dumps({"error": error_msg, "status": "SOLVER_CRASH", "details": str(e)}), file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        log.info("Solver interrupted by user.")
        print(json.dumps({"error": "Solver interrupted by user", "status": "INTERRUPTED"}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()