# ==============================================================================
#
#  Solution Builder for Timetable Solver
#
#  Description:
#  Builds solution output from solver results, including scheduled lessons
#  and comprehensive metadata for UI integration.
#
#  **Feature: solver-refactoring, Task 9.1**
#  **Requirements: 1.3**
#
# ==============================================================================

from typing import Any, Dict, List, Optional

from ortools.sat.python import cp_model

from models.input import TimetableData, DayOfWeek
from models.output import (
    ScheduledLesson,
    SolutionMetadata,
    SolutionStatistics,
    ClassMetadata,
    SubjectMetadata,
    TeacherMetadata,
    PeriodConfiguration,
    SolverOutput,
    SolverStatus,
)


# Category mapping constants (Req 1: Four-category grade classification)
CATEGORY_DARI_NAMES = {
    "Alpha-Primary": "ابتداییه دوره اول",
    "Beta-Primary": "ابتداییه دوره دوم",
    "Middle": "متوسطه",
    "High": "لیسه"
}


def get_category_dari_name(category: str) -> Optional[str]:
    """Get Dari name for category (Req 1)."""
    return CATEGORY_DARI_NAMES.get(category)


def _day_to_string(day: Any) -> str:
    return day.value if isinstance(day, DayOfWeek) else str(day)


def normalize_break_periods(breaks: Optional[List[Dict[str, Any]]]) -> List[Dict[str, int]]:
    deduped: Dict[int, int] = {}

    for break_config in breaks or []:
        after_period = getattr(break_config, "afterPeriod", None)
        if after_period is None and isinstance(break_config, dict):
            after_period = break_config.get("afterPeriod")

        duration = getattr(break_config, "duration", None)
        if duration is None and isinstance(break_config, dict):
            duration = break_config.get("duration")

        if not isinstance(after_period, int) or after_period < 1:
            continue
        if not isinstance(duration, int) or duration <= 0:
            continue

        if after_period not in deduped:
            deduped[after_period] = duration

    return [
        {"afterPeriod": after_period, "duration": deduped[after_period]}
        for after_period in sorted(deduped)
    ]


def clamp_break_periods(
    breaks: Optional[List[Dict[str, Any]]],
    max_periods: int,
) -> List[Dict[str, int]]:
    if max_periods <= 1:
        return []

    return [
        break_config
        for break_config in normalize_break_periods(breaks)
        if break_config["afterPeriod"] < max_periods
    ]


def serialize_category_periods(
    category_periods_map: Optional[Dict[str, Dict[Any, int]]]
) -> Dict[str, Dict[str, int]]:
    serialized: Dict[str, Dict[str, int]] = {}

    if not category_periods_map:
        return serialized

    for category, day_map in category_periods_map.items():
        serialized[category] = {
            _day_to_string(day): periods for day, periods in day_map.items()
        }

    return serialized


def build_effective_break_periods_by_day(
    days: List[str],
    periods_map: Dict[str, int],
    shared_breaks: Optional[List[Dict[str, Any]]],
    break_periods_by_day: Optional[Dict[Any, List[Dict[str, Any]]]],
) -> Dict[str, List[Dict[str, int]]]:
    normalized_overrides = {
        _day_to_string(day): normalize_break_periods(breaks)
        for day, breaks in (break_periods_by_day or {}).items()
    }

    effective_breaks: Dict[str, List[Dict[str, int]]] = {}
    for day in days:
        max_periods = periods_map.get(day, 0)
        resolved_breaks = (
            normalized_overrides[day]
            if day in normalized_overrides
            else shared_breaks
        )
        effective_breaks[day] = clamp_break_periods(
            resolved_breaks,
            max_periods,
        )

    return effective_breaks


def has_variable_breaks(effective_breaks_by_day: Dict[str, List[Dict[str, int]]]) -> bool:
    signatures = {
        tuple((break_config["afterPeriod"], break_config["duration"]) for break_config in breaks)
        for breaks in effective_breaks_by_day.values()
    }
    return len(signatures) > 1


def build_period_configuration_metadata(cfg: Any) -> Dict[str, Any]:
    periods_map: Dict[str, int] = {}
    if cfg.periodsPerDayMap:
        for day, periods in cfg.periodsPerDayMap.items():
            periods_map[_day_to_string(day)] = periods
    else:
        for day in cfg.daysOfWeek:
            periods_map[_day_to_string(day)] = cfg.periodsPerDay

    total_periods = sum(periods_map.values())
    has_variable = len(set(periods_map.values())) > 1
    days_of_week = [_day_to_string(day) for day in cfg.daysOfWeek]
    shared_breaks = clamp_break_periods(cfg.breakPeriods, max(periods_map.values(), default=0))
    effective_breaks = build_effective_break_periods_by_day(
        days_of_week,
        periods_map,
        shared_breaks,
        cfg.breakPeriodsByDay,
    )

    return {
        "periodsPerDayMap": periods_map,
        "totalPeriodsPerWeek": total_periods,
        "daysOfWeek": days_of_week,
        "hasVariablePeriods": has_variable,
        "categoryPeriodsPerDayMap": serialize_category_periods(cfg.categoryPeriodsPerDayMap),
        "breakPeriodsDefault": shared_breaks,
        "breakPeriodsByDay": effective_breaks,
        "hasVariableBreaks": has_variable_breaks(effective_breaks),
    }


def get_periods_for_class_day(
    cfg: Any,
    class_category: Optional[str],
    day_str: str,
    periods_per_day_map: Optional[Dict[str, int]],
    num_periods_per_day: int,
) -> int:
    if cfg.categoryPeriodsPerDayMap:
        if not class_category:
            raise ValueError(
                "Class category is required when categoryPeriodsPerDayMap is enabled"
            )

        category_map = cfg.categoryPeriodsPerDayMap.get(class_category)
        if not category_map:
            raise ValueError(
                f"Class category '{class_category}' has no period configuration"
            )

        for day, periods in category_map.items():
            if _day_to_string(day) == day_str:
                return periods

        raise ValueError(
            f"Class category '{class_category}' has no period configuration for {day_str}"
        )

    if periods_per_day_map:
        return periods_per_day_map.get(day_str, num_periods_per_day)

    return num_periods_per_day


class SolutionBuilder:
    """
    Builds solution output from solver results.
    
    This class provides:
    - Solution construction from CP-SAT solver values (Requirement 1.3)
    - Metadata generation for UI integration
    - Statistics calculation
    
    Example:
        >>> builder = SolutionBuilder(data, solver, requests, mappings)
        >>> solution = builder.build_solution(start_vars, teacher_vars, room_vars)
        >>> output = builder.build_output_with_metadata()
    """
    
    def __init__(
        self,
        data: TimetableData,
        solver: cp_model.CpSolver,
        requests: List[Dict[str, Any]],
        class_map: Dict[str, int],
        teacher_map: Dict[str, int],
        subject_map: Dict[str, int],
        room_map: Dict[str, int],
        day_map: Dict[str, int],
        days: List[str],
        num_periods_per_day: int,
        periods_per_day_map: Optional[Dict[str, int]] = None,
    ):
        """
        Initialize the SolutionBuilder.
        
        Args:
            data: The validated TimetableData input.
            solver: The solved CP-SAT solver instance.
            requests: List of scheduling requests.
            class_map: Mapping from class ID to index.
            teacher_map: Mapping from teacher ID to index.
            subject_map: Mapping from subject ID to index.
            room_map: Mapping from room ID to index.
            day_map: Mapping from day string to index.
            days: List of day strings in order.
            num_periods_per_day: Default number of periods per day.
            periods_per_day_map: Optional mapping of day to period count.
        """
        self.data = data
        self.solver = solver
        self.requests = requests
        self.class_map = class_map
        self.teacher_map = teacher_map
        self.subject_map = subject_map
        self.room_map = room_map
        self.day_map = day_map
        self.days = days
        self.num_periods_per_day = num_periods_per_day
        self.periods_per_day_map = periods_per_day_map
        
        # Build reverse maps for ID lookups
        self._rev_class_map = {v: k for k, v in class_map.items()}
        self._rev_teacher_map = {v: k for k, v in teacher_map.items()}
        self._rev_subject_map = {v: k for k, v in subject_map.items()}
        self._rev_room_map = {v: k for k, v in room_map.items()}
        
        # Build lookup maps for names
        self._class_name_map = {c.id: c.name for c in data.classes}
        self._teacher_name_map = {t.id: t.fullName for t in data.teachers}
        self._subject_name_map = {s.id: s.name for s in data.subjects}
        self._room_name_map = {r.id: r.name for r in data.rooms}
        self._class_category_map = {c.id: c.category for c in data.classes}
    
    def build_solution(
        self,
        start_vars: List[cp_model.IntVar],
        teacher_vars: List[cp_model.IntVar],
        room_vars: List[cp_model.IntVar],
    ) -> List[Dict[str, Any]]:
        """
        Build list of scheduled lessons from solver values.
        
        Args:
            start_vars: List of start time variables.
            teacher_vars: List of teacher assignment variables.
            room_vars: List of room assignment variables.
        
        Returns:
            List of scheduled lesson dictionaries.
        """
        solution = []
        
        # Build lessons from solved requests
        for r_idx, req in enumerate(self.requests):
            start = self.solver.Value(start_vars[r_idx])
            teacher_idx = self.solver.Value(teacher_vars[r_idx])
            room_idx = self.solver.Value(room_vars[r_idx])
            
            teacher_id = self._rev_teacher_map[teacher_idx]
            room_id = self._rev_room_map[room_idx]
            
            # Create a lesson for each period in the request
            for offset in range(req['length']):
                slot = start + offset
                day_idx, period_idx = divmod(slot, self.num_periods_per_day)
                day_str = self.days[day_idx]
                
                lesson_data = {
                    "day": day_str,
                    "periodIndex": period_idx,
                    "classId": req['class_id'],
                    "subjectId": req['subject_id'],
                    "teacherIds": [teacher_id],
                    "roomId": room_id,
                    "isFixed": False,
                }
                
                lesson_data["periodsThisDay"] = get_periods_for_class_day(
                    self.data.config,
                    self._class_category_map.get(req["class_id"]),
                    day_str,
                    self.periods_per_day_map,
                    self.num_periods_per_day,
                )
                
                solution.append(lesson_data)
        
        # Add fixed lessons
        for lesson in self.data.fixedLessons or []:
            day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            solution.append({
                "day": day_str,
                "periodIndex": lesson.periodIndex,
                "classId": lesson.classId,
                "subjectId": lesson.subjectId,
                "teacherIds": lesson.teacherIds,
                "roomId": lesson.roomId,
                "isFixed": True,
                "periodsThisDay": get_periods_for_class_day(
                    self.data.config,
                    self._class_category_map.get(lesson.classId),
                    day_str,
                    self.periods_per_day_map,
                    self.num_periods_per_day,
                ),
            })
        
        # Sort by day, period, and class
        solution.sort(key=lambda x: (
            self.day_map.get(x['day'], 0),
            x['periodIndex'],
            x['classId']
        ))
        
        return solution
    
    def build_fixed_lessons_only(self) -> List[Dict[str, Any]]:
        """
        Return only the fixed lessons when no complete solution can be found.
        
        Returns:
            List of fixed lesson dictionaries.
        """
        solution = []
        for lesson in self.data.fixedLessons or []:
            day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            solution.append({
                "day": day_str,
                "periodIndex": lesson.periodIndex,
                "classId": lesson.classId,
                "subjectId": lesson.subjectId,
                "teacherIds": lesson.teacherIds,
                "roomId": lesson.roomId,
                "isFixed": True,
                "periodsThisDay": get_periods_for_class_day(
                    self.data.config,
                    self._class_category_map.get(lesson.classId),
                    day_str,
                    self.periods_per_day_map,
                    self.num_periods_per_day,
                ),
            })
        return solution
    
    def add_metadata(self, solution: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Add comprehensive metadata to the solution for UI integration.
        
        Args:
            solution: List of scheduled lesson dictionaries.
        
        Returns:
            Dictionary with 'schedule', 'metadata', and 'statistics' keys.
        """
        # Build class metadata
        class_metadata = self._build_class_metadata()
        
        # Build subject metadata
        subject_metadata = self._build_subject_metadata()
        
        # Build teacher metadata
        teacher_metadata = self._build_teacher_metadata()
        
        # Build period configuration
        period_config = self._build_period_configuration()
        
        # Build statistics
        statistics = self._build_statistics(solution, period_config)
        
        return {
            "schedule": solution,
            "metadata": {
                "classes": class_metadata,
                "subjects": subject_metadata,
                "teachers": teacher_metadata,
                "periodConfiguration": period_config,
            },
            "statistics": statistics,
        }
    
    def _build_class_metadata(self) -> List[Dict[str, Any]]:
        """Build metadata for all classes."""
        teacher_map = {t.id: t for t in self.data.teachers}
        class_metadata = []
        
        for cls in self.data.classes:
            class_info = {
                "classId": cls.id,
                "className": cls.name,
                "gradeLevel": cls.gradeLevel,
                "category": cls.category,
                "categoryDari": get_category_dari_name(cls.category) if cls.category else None,
                "studentCount": cls.studentCount,
                "singleTeacherMode": cls.singleTeacherMode,
                "classTeacherId": cls.classTeacherId if cls.singleTeacherMode else None,
            }
            
            # Add class teacher details if in single-teacher mode
            if cls.singleTeacherMode and cls.classTeacherId:
                teacher = teacher_map.get(cls.classTeacherId)
                if teacher:
                    class_info["classTeacherName"] = teacher.fullName
                    class_info["classTeacherSubjects"] = teacher.primarySubjectIds
            
            class_metadata.append(class_info)
        
        return class_metadata
    
    def _build_subject_metadata(self) -> List[Dict[str, Any]]:
        """Build metadata for all subjects."""
        subject_metadata = []
        
        for subj in self.data.subjects:
            subject_info = {
                "subjectId": subj.id,
                "subjectName": subj.name,
                "isCustom": subj.isCustom,
                "customCategory": subj.customCategory if subj.isCustom else None,
            }
            
            # Add category Dari name for custom subjects
            if subj.isCustom and subj.customCategory:
                subject_info["customCategoryDari"] = get_category_dari_name(subj.customCategory)
            
            subject_metadata.append(subject_info)
        
        return subject_metadata
    
    def _build_teacher_metadata(self) -> List[Dict[str, Any]]:
        """Build metadata for all teachers."""
        teacher_metadata = []
        
        for teacher in self.data.teachers:
            teacher_info = {
                "teacherId": teacher.id,
                "teacherName": teacher.fullName,
                "primarySubjects": teacher.primarySubjectIds,
                "maxPeriodsPerWeek": teacher.maxPeriodsPerWeek,
                # Count classes where this teacher is the class teacher
                "classTeacherOf": [
                    cls.id for cls in self.data.classes
                    if cls.singleTeacherMode and cls.classTeacherId == teacher.id
                ],
            }
            teacher_metadata.append(teacher_info)
        
        return teacher_metadata
    
    def _build_period_configuration(self) -> Dict[str, Any]:
        """Build period configuration metadata."""
        return build_period_configuration_metadata(self.data.config)
    
    def _build_statistics(
        self,
        solution: List[Dict[str, Any]],
        period_config: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Build comprehensive statistics about the solution."""
        # Category counts
        category_counts = {
            "Alpha-Primary": sum(1 for c in self.data.classes if c.category == "Alpha-Primary"),
            "Beta-Primary": sum(1 for c in self.data.classes if c.category == "Beta-Primary"),
            "Middle": sum(1 for c in self.data.classes if c.category == "Middle"),
            "High": sum(1 for c in self.data.classes if c.category == "High"),
        }
        
        # Count custom subjects by category
        custom_subject_by_category = {}
        for subj in self.data.subjects:
            if subj.isCustom and subj.customCategory:
                custom_subject_by_category[subj.customCategory] = (
                    custom_subject_by_category.get(subj.customCategory, 0) + 1
                )
        
        return {
            "totalClasses": len(self.data.classes),
            "singleTeacherClasses": sum(1 for c in self.data.classes if c.singleTeacherMode),
            "multiTeacherClasses": sum(1 for c in self.data.classes if not c.singleTeacherMode),
            "totalSubjects": len(self.data.subjects),
            "customSubjects": sum(1 for s in self.data.subjects if s.isCustom),
            "standardSubjects": sum(1 for s in self.data.subjects if not s.isCustom),
            "totalTeachers": len(self.data.teachers),
            "totalRooms": len(self.data.rooms),
            "categoryCounts": category_counts,
            "customSubjectsByCategory": custom_subject_by_category,
            "totalLessons": len(solution),
            "periodsPerWeek": period_config["totalPeriodsPerWeek"],
        }
    
    def build_output_with_metadata(
        self,
        start_vars: List[cp_model.IntVar],
        teacher_vars: List[cp_model.IntVar],
        room_vars: List[cp_model.IntVar],
        solve_time_seconds: Optional[float] = None,
        strategy_name: Optional[str] = None,
        num_constraints: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Build complete output with solution and metadata.
        
        Args:
            start_vars: List of start time variables.
            teacher_vars: List of teacher assignment variables.
            room_vars: List of room assignment variables.
            solve_time_seconds: Optional solve time in seconds.
            strategy_name: Optional strategy name used.
            num_constraints: Optional number of constraints applied.
        
        Returns:
            Complete output dictionary with schedule, metadata, and statistics.
        """
        solution = self.build_solution(start_vars, teacher_vars, room_vars)
        output = self.add_metadata(solution)
        
        # Add solve-time statistics if provided
        if solve_time_seconds is not None:
            output["statistics"]["solveTimeSeconds"] = solve_time_seconds
        if strategy_name is not None:
            output["statistics"]["strategy"] = strategy_name
        if num_constraints is not None:
            output["statistics"]["numConstraintsApplied"] = num_constraints
        
        return output
    
    def build_partial_output(
        self,
        solve_time_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        Build output for partial/degraded solution (fixed lessons only).
        
        Args:
            solve_time_seconds: Optional solve time in seconds.
        
        Returns:
            Output dictionary with fixed lessons only.
        """
        solution = self.build_fixed_lessons_only()
        output = self.add_metadata(solution)
        
        if solve_time_seconds is not None:
            output["statistics"]["solveTimeSeconds"] = solve_time_seconds
        
        return output
