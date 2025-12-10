# ==============================================================================
#
#  Input Data Models for Timetable Solver
#
#  Description:
#  Pydantic data models for robust validation of timetable input data.
#  These models define the data contract for the solver.
#
# ==============================================================================

import re
from enum import Enum
from typing import List, Dict, Optional, Any, Union

from pydantic import BaseModel, Field, model_validator


# ==============================================================================
# Primitives & Enums
# ==============================================================================

TIME_REGEX = r'^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
ISO_DATE_REGEX = r'^\d{4}-\d{2}-\d{2}$'


class DayOfWeek(str, Enum):
    MONDAY = 'Monday'
    TUESDAY = 'Tuesday'
    WEDNESDAY = 'Wednesday'
    THURSDAY = 'Thursday'
    FRIDAY = 'Friday'
    SATURDAY = 'Saturday'
    SUNDAY = 'Sunday'


class TimePreference(str, Enum):
    MORNING = 'Morning'
    AFTERNOON = 'Afternoon'
    NONE = 'None'


# ==============================================================================
# Sub-Models
# ==============================================================================

class Period(BaseModel):
    """Represents a single period in the school day."""
    index: int = Field(ge=0)
    startTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    endTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    duration: Optional[int] = Field(default=None, gt=0)
    isBreak: Optional[bool] = Field(default=False)
    shift: Optional[str] = Field(default=None)


class UnavailableSlot(BaseModel):
    """Represents a time slot when a resource is unavailable."""
    day: Union[DayOfWeek, str]
    periods: List[int]


class BreakPeriodConfig(BaseModel):
    """Configuration for break periods."""
    afterPeriod: int = Field(ge=1, le=11)
    duration: int = Field(ge=0, le=120)


class GlobalConfig(BaseModel):
    """Global configuration for the timetable."""
    daysOfWeek: List[DayOfWeek] = Field(min_length=1)
    
    # Dynamic periods per day (different periods for different days)
    periodsPerDayMap: Optional[Dict[DayOfWeek, int]] = Field(default=None)
    
    # Per-category periods (different periods for different grade categories)
    categoryPeriodsPerDayMap: Optional[Dict[str, Dict[DayOfWeek, int]]] = Field(default=None)
    
    # Legacy: Keep for backward compatibility
    periodsPerDay: int = Field(gt=0)
    
    schoolStartTime: Optional[str] = Field(default=None, pattern=TIME_REGEX)
    periodDurationMinutes: Optional[int] = Field(default=None, gt=0)
    periods: Optional[List[Period]] = None
    breakPeriods: Optional[List[BreakPeriodConfig]] = Field(default=None)
    prayerBreaks: Optional[List[UnavailableSlot]] = Field(default=None)
    timezone: Optional[str] = Field(default=None)
    
    # Performance optimization settings
    solverTimeLimitSeconds: Optional[int] = Field(default=600, ge=1)
    solverOptimizationLevel: Optional[int] = Field(default=2, ge=0, le=2)
    enableGracefulDegradation: Optional[bool] = Field(default=True)
    
    # Gender separation support
    enforceGenderSeparation: Optional[bool] = Field(default=False)
    
    # Multi-shift support
    shifts: Optional[List[Dict[str, Any]]] = Field(default=None)
    
    @model_validator(mode='after')
    def ensure_periods_format(self):
        """Convert between old and new period formats for backward compatibility."""
        # Validate per-category periods if present
        if self.categoryPeriodsPerDayMap:
            valid_categories = {"Alpha-Primary", "Beta-Primary", "Middle", "High"}
            for category, day_map in self.categoryPeriodsPerDayMap.items():
                if category not in valid_categories:
                    raise ValueError(f"Invalid category '{category}'. Must be one of: {valid_categories}")
                
                for day in self.daysOfWeek:
                    if day not in day_map:
                        raise ValueError(f"Category '{category}' missing period count for {day.value}")
                    periods = day_map[day]
                    if not 1 <= periods <= 12:
                        raise ValueError(f"Category '{category}', {day.value}: periods must be 1-12, got {periods}")
            
            # Set global periodsPerDay to maximum
            max_periods = max(
                max(day_map.values()) 
                for day_map in self.categoryPeriodsPerDayMap.values()
            )
            self.periodsPerDay = max_periods
            
            # Set periodsPerDayMap to maximum across categories for each day
            self.periodsPerDayMap = {}
            for day in self.daysOfWeek:
                max_for_day = max(
                    day_map.get(day, 0)
                    for day_map in self.categoryPeriodsPerDayMap.values()
                )
                self.periodsPerDayMap[day] = max_for_day
        
        # If old format only, convert to new
        elif not self.periodsPerDayMap and self.periodsPerDay:
            self.periodsPerDayMap = {
                day: self.periodsPerDay 
                for day in self.daysOfWeek
            }
        
        # If new format only, set periodsPerDay for compatibility
        elif self.periodsPerDayMap and not self.periodsPerDay:
            self.periodsPerDay = max(self.periodsPerDayMap.values())
        
        # Validate periodsPerDayMap if present
        if self.periodsPerDayMap:
            for day in self.daysOfWeek:
                if day not in self.periodsPerDayMap:
                    raise ValueError(f"periodsPerDayMap missing entry for {day.value}")
                periods = self.periodsPerDayMap[day]
                if not 1 <= periods <= 12:
                    raise ValueError(f"{day.value}: periods must be 1-12, got {periods}")
        
        return self


class GlobalPreferences(BaseModel):
    """Global preferences for optimization."""
    avoidTeacherGapsWeight: float = Field(default=1.0, ge=0)
    avoidClassGapsWeight: float = Field(default=1.0, ge=0)
    distributeDifficultSubjectsWeight: float = Field(default=0.8, ge=0)
    balanceTeacherLoadWeight: float = Field(default=0.7, ge=0)
    minimizeRoomChangesWeight: float = Field(default=0.3, ge=0)
    preferMorningForDifficultWeight: float = Field(default=0.5, ge=0)
    respectTeacherTimePreferenceWeight: float = Field(default=0.5, ge=0)
    respectTeacherRoomPreferenceWeight: float = Field(default=0.2, ge=0)
    allowConsecutivePeriodsForSameSubject: bool = True
    avoidFirstLastPeriodWeight: float = Field(default=0.0, ge=0)
    subjectSpreadWeight: float = Field(default=0.0, ge=0)


class Room(BaseModel):
    """Represents a room in the school."""
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    capacity: int = Field(ge=0)
    type: str
    features: Optional[List[str]] = Field(default=None)
    unavailable: Optional[List[UnavailableSlot]] = Field(default=None)
    meta: Optional[Dict[str, Any]] = Field(default=None)


class Subject(BaseModel):
    """Represents a subject in the curriculum."""
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    code: Optional[str] = Field(default=None)
    requiredRoomType: Optional[Union[str, None]] = Field(default=None)
    requiredFeatures: Optional[List[str]] = Field(default=None)
    desiredFeatures: Optional[List[str]] = Field(default=None)
    isDifficult: Optional[bool] = Field(default=None)
    minRoomCapacity: Optional[int] = Field(default=None, ge=0)
    
    # Custom subject flag (beyond default curriculum)
    isCustom: bool = Field(default=False)
    customCategory: Optional[str] = Field(default=None)
    
    meta: Optional[Dict[str, Any]] = Field(default=None)


class Teacher(BaseModel):
    """Represents a teacher."""
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
    preferredColleagues: Optional[List[str]] = Field(default=None)
    meta: Optional[Dict[str, Any]] = Field(default=None)
    
    # Gender separation support
    gender: Optional[str] = Field(default=None)


class SubjectRequirement(BaseModel):
    """Represents subject requirements for a class."""
    periodsPerWeek: int = Field(ge=0)
    minConsecutive: Optional[int] = Field(None, gt=0)
    maxConsecutive: Optional[int] = Field(None, gt=0)
    minDaysPerWeek: Optional[int] = Field(None, gt=0)
    maxDaysPerWeek: Optional[int] = Field(None, gt=0)


class ClassGroup(BaseModel):
    """Represents a class group."""
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    studentCount: int = Field(ge=0)
    subjectRequirements: Dict[str, SubjectRequirement]
    fixedRoomId: Optional[str] = Field(default=None)
    
    # Single-teacher mode (one teacher for all subjects)
    singleTeacherMode: bool = Field(default=False)
    classTeacherId: Optional[str] = Field(default=None)
    
    # Grade classification (Afghanistan education system)
    gradeLevel: Optional[int] = Field(default=None, ge=1, le=12)
    category: Optional[str] = Field(default=None)
    
    meta: Optional[Dict[str, Any]] = Field(None)
    
    # Gender separation support
    gender: Optional[str] = Field(default=None)
    
    @model_validator(mode='after')
    def determine_category(self):
        """Auto-determine category from gradeLevel."""
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
    """Represents a school event that blocks time slots."""
    id: Optional[str] = Field(default=None, min_length=1)
    name: str = Field(min_length=1)
    day: Union[DayOfWeek, str]
    periods: List[int]
    startDate: Optional[str] = Field(default=None, pattern=ISO_DATE_REGEX)
    endDate: Optional[str] = Field(default=None, pattern=ISO_DATE_REGEX)
    appliesToClassIds: Optional[List[str]] = Field(default=None)
    meta: Optional[Dict[str, Any]] = Field(default=None)


class BaseLesson(BaseModel):
    """Base class for lessons."""
    day: DayOfWeek
    periodIndex: int = Field(ge=0)
    classId: str = Field(min_length=1)
    subjectId: str = Field(min_length=1)
    teacherIds: List[str] = Field(default_factory=list, min_length=1)
    roomId: Optional[str] = Field(default=None, min_length=1)


class FixedLesson(BaseLesson):
    """Represents a pre-scheduled fixed lesson."""
    id: Optional[str] = Field(None, min_length=1)
    createdBy: Optional[str] = None
    note: Optional[str] = None


# ==============================================================================
# Main TimetableData Schema
# ==============================================================================

class TimetableData(BaseModel):
    """Main input data model for the timetable solver."""
    
    class Meta(BaseModel):
        """Metadata about the timetable."""
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

    def validate_period_configuration(self):
        """Validate period configuration consistency."""
        from validation.period_config import validate_period_configuration
        validate_period_configuration(self)
        return self
    
    def validate_teacher_availability_structure(self):
        """Validate teacher availability matches period config."""
        from validation.teacher_availability import validate_teacher_availability_structure
        validate_teacher_availability_structure(self)
        return self
    
    def validate_subject_references(self):
        """Enhanced validation including custom subjects."""
        from validation.subject_references import validate_subject_references
        validate_subject_references(self)
        return self
    
    def validate_custom_subjects(self):
        """Validate custom subjects are properly configured."""
        from validation.subject_references import validate_custom_subjects
        validate_custom_subjects(self)
        return self
    
    def validate_single_teacher_feasibility(self):
        """Validate single-teacher mode is feasible."""
        cfg = self.config
        
        for cls in self.classes:
            if not cls.singleTeacherMode:
                continue
            
            teacher = next((t for t in self.teachers if t.id == cls.classTeacherId), None)
            if not teacher:
                raise ValueError(
                    f"Single-Teacher Mode Error: Class '{cls.name}' (ID: {cls.id}) "
                    f"references unknown teacher ID '{cls.classTeacherId}'. "
                    f"Please assign a valid teacher."
                )
            
            required_subjects = set(cls.subjectRequirements.keys())
            teacher_subjects = set(teacher.primarySubjectIds)
            if hasattr(teacher, 'allowedSubjectIds') and teacher.allowedSubjectIds:
                teacher_subjects.update(teacher.allowedSubjectIds)
            
            missing_subjects = required_subjects - teacher_subjects
            if missing_subjects:
                subject_names = [
                    next((s.name for s in self.subjects if s.id == sid), sid)
                    for sid in missing_subjects
                ]
                raise ValueError(
                    f"Single-Teacher Mode Error: Teacher '{teacher.fullName}' "
                    f"is assigned to class '{cls.name}' but cannot teach: "
                    f"{', '.join(subject_names)}. "
                    f"Please update teacher's subject qualifications."
                )
            
            total_periods_needed = sum(req.periodsPerWeek for req in cls.subjectRequirements.values())
            
            available_periods = 0
            for day in cfg.daysOfWeek:
                day_str = day.value if isinstance(day, DayOfWeek) else str(day)
                availability = teacher.availability.get(day_str, [])
                available_periods += sum(availability)
            
            if teacher.maxPeriodsPerWeek < total_periods_needed:
                raise ValueError(
                    f"Single-Teacher Mode Error: Teacher '{teacher.fullName}' "
                    f"has maxPeriodsPerWeek={teacher.maxPeriodsPerWeek} but class '{cls.name}' "
                    f"needs {total_periods_needed} periods/week. "
                    f"Please increase teacher's maxPeriodsPerWeek or reduce class requirements."
                )
            
            if available_periods < total_periods_needed:
                raise ValueError(
                    f"Single-Teacher Mode Error: Teacher '{teacher.fullName}' "
                    f"has only {available_periods} available periods but class '{cls.name}' "
                    f"needs {total_periods_needed} periods. "
                    f"Please increase teacher availability or adjust class schedule."
                )
        
        return self
    
    def validate_class_teacher_feasibility(self):
        """Validate class teacher can teach at least one subject for their class.
        
        When classTeacherId is set (without singleTeacherMode), the class teacher
        must be able to teach at least one subject from the class's requirements.
        This is a pre-solve validation to catch configuration errors early.
        """
        for cls in self.classes:
            # Skip if no class teacher or if singleTeacherMode (handled separately)
            if not cls.classTeacherId or cls.singleTeacherMode:
                continue
            
            # Find the class teacher
            teacher = next((t for t in self.teachers if t.id == cls.classTeacherId), None)
            if not teacher:
                raise ValueError(
                    f"Class Teacher Error (خطای استاد نگران): Class '{cls.name}' (ID: {cls.id}) "
                    f"references unknown teacher ID '{cls.classTeacherId}'. "
                    f"Please assign a valid teacher as class teacher."
                )
            
            # Get subjects the teacher can teach
            teacher_subjects = set(teacher.primarySubjectIds)
            if teacher.allowedSubjectIds:
                # Only include allowed subjects if not restricted to primary
                if not teacher.restrictToPrimarySubjects:
                    teacher_subjects.update(teacher.allowedSubjectIds)
            
            # Get subjects required by the class
            class_subjects = set(cls.subjectRequirements.keys())
            
            # Find overlap
            teachable_subjects = teacher_subjects & class_subjects
            
            if not teachable_subjects:
                teacher_subject_names = [
                    next((s.name for s in self.subjects if s.id == sid), sid)
                    for sid in teacher_subjects
                ]
                class_subject_names = [
                    next((s.name for s in self.subjects if s.id == sid), sid)
                    for sid in class_subjects
                ]
                raise ValueError(
                    f"Class Teacher Error (خطای استاد نگران): Teacher '{teacher.fullName}' "
                    f"is assigned as class teacher for '{cls.name}' but cannot teach any "
                    f"of the class's subjects.\n"
                    f"  Teacher can teach: {', '.join(teacher_subject_names)}\n"
                    f"  Class requires: {', '.join(class_subject_names)}\n"
                    f"Please assign a different class teacher or update teacher's subject qualifications."
                )
        
        return self
    
    def validate_no_empty_periods_feasibility(self):
        """Validate period allocation prevents empty periods."""
        cfg = self.config
        
        for cls in self.classes:
            if cfg.categoryPeriodsPerDayMap and cls.category:
                category_map = cfg.categoryPeriodsPerDayMap.get(cls.category)
                if category_map:
                    total_available = sum(category_map.values())
                else:
                    total_available = sum(cfg.periodsPerDayMap.values()) if cfg.periodsPerDayMap else (cfg.periodsPerDay * len(cfg.daysOfWeek))
            else:
                total_available = sum(cfg.periodsPerDayMap.values()) if cfg.periodsPerDayMap else (cfg.periodsPerDay * len(cfg.daysOfWeek))
            
            total_required = sum(
                req.periodsPerWeek 
                for req in cls.subjectRequirements.values()
            )
            
            if total_required < total_available:
                gap = total_available - total_required
                raise ValueError(
                    f"Empty Periods Error: Class '{cls.name}' (ID: {cls.id}) "
                    f"has {gap} empty period(s) per week ({total_required} required vs {total_available} available). "
                    f"\nSchedule must have NO empty periods. Suggestions:"
                    f"\n  1. Add {gap} more period(s) to existing subjects"
                    f"\n  2. Add new subject(s) totaling {gap} period(s)"
                    f"\n  3. Reduce weekly schedule by {gap} period(s)"
                )
            
            elif total_required > total_available:
                excess = total_required - total_available
                raise ValueError(
                    f"Over-Allocation Error: Class '{cls.name}' (ID: {cls.id}) "
                    f"requires {total_required} periods but only {total_available} are available. "
                    f"\nYou need {excess} fewer period(s). Suggestions:"
                    f"\n  1. Reduce periods for some subjects by {excess} total"
                    f"\n  2. Add {excess} more period(s) to the weekly schedule"
                )
        
        return self

    @model_validator(mode='after')
    def validate_all_cross_references(self):
        """Performs complex cross-field validations."""
        cfg = self.config
        teachers, rooms, subjects, classes = self.teachers, self.rooms, self.subjects, self.classes
        fixed_lessons, school_events = self.fixedLessons, self.schoolEvents

        # Run all validations
        self.validate_period_configuration()
        self.validate_teacher_availability_structure()
        self.validate_subject_references()
        self.validate_custom_subjects()
        self.validate_single_teacher_feasibility()
        self.validate_class_teacher_feasibility()
        self.validate_no_empty_periods_feasibility()
        
        # Referential integrity checks
        subject_ids = {s.id for s in subjects}
        teacher_ids = {t.id for t in teachers}
        room_ids = {r.id for r in rooms}
        class_ids = {c.id for c in classes}

        # Validate teacher subject references
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
