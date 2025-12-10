# ==============================================================================
#
#  Refactored TimetableSolver for Modular Architecture
#
#  Description:
#  Main solver class that orchestrates the solving process using modular
#  components: VariableManager, ConstraintRegistry, and SolutionBuilder.
#
#  **Feature: solver-refactoring, Task 10.1**
#  **Requirements: 1.1, 1.8**
#
# ==============================================================================

import sys
import json
import collections
from typing import Any, Dict, List, Optional, Union

from ortools.sat.python import cp_model
import structlog

from models.input import TimetableData, DayOfWeek
from models.output import SolverStatus
from .variables import VariableManager
from .solution_builder import SolutionBuilder, get_category_dari_name, CATEGORY_DARI_NAMES
from constraints.registry import ConstraintRegistry, ConstraintStage
from constraints.hard.no_overlap import register_no_overlap_constraints
from constraints.hard.same_day import register_same_day_constraint
from constraints.hard.consecutive import register_consecutive_constraint
from constraints.soft.morning_difficult import register_morning_difficult_constraint
from constraints.soft.teacher_gaps import register_teacher_gaps_constraint
from constraints.soft.subject_spread import register_subject_spread_constraint

# Import strategy system
from strategies import FastStrategy, BalancedStrategy, ThoroughStrategy
# Import utilities
from utils import (
    ConstraintBudget, ConstraintPriority,
    ProgressiveConstraintManager, ConstraintStage as UtilConstraintStage,
    determine_problem_complexity, DomainFilter
)

log = structlog.get_logger()


# --- Helper Functions ---
def can_teach(
    teacher: dict,
    subject_id: str,
    class_group: Optional[Any] = None,
    enforce_gender_separation: Optional[bool] = False
) -> bool:
    """Check if a teacher can teach a specific subject."""
    primary_subjects = teacher.get('primarySubjectIds', [])
    if subject_id not in primary_subjects:
        restrict_primary = teacher.get('restrictToPrimarySubjects', True)
        if restrict_primary or subject_id not in teacher.get('allowedSubjectIds', []):
            return False
    
    # Check gender separation constraints if enabled
    if enforce_gender_separation and class_group and teacher.get('gender'):
        class_gender = getattr(class_group, 'gender', None)
        if class_gender:
            teacher_gender = teacher['gender'].lower()
            class_gender = class_gender.lower()
            
            if teacher_gender == 'mixed' or class_gender == 'mixed':
                return True
            
            if teacher_gender != class_gender:
                return False
    
    return True


def is_room_compatible(room: dict, subject: dict, class_group: Any) -> bool:
    """Check if a room is compatible with a subject and class."""
    min_cap = subject.get('minRoomCapacity')
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


class TimetableSolver:
    """
    Refactored constraint satisfaction solver for school timetabling.
    
    This class orchestrates the solving process using modular components:
    - VariableManager: Handles CP-SAT variable creation with memory optimization
    - ConstraintRegistry: Manages constraint plugins for modular constraint application
    - SolutionBuilder: Constructs solution output from solver results
    
    The solver produces identical output to the original monolithic solver
    for the same input (Requirement 1.8).
    
    Example:
        >>> solver = TimetableSolver(input_data)
        >>> solution = solver.solve(time_limit_seconds=600)
    """
    
    def __init__(self, timetable_data: Union[Dict, TimetableData]):
        """
        Initialize the solver with input data.
        
        Args:
            timetable_data: Either a dictionary or TimetableData object
                           containing the timetabling problem specification.
        
        Raises:
            ValueError: If the input data is invalid.
        """
        try:
            log.info("Validating input data...")
            if isinstance(timetable_data, TimetableData):
                self.data = timetable_data
                self.data_dict = self.data.model_dump(exclude_none=True)
            else:
                self.data = TimetableData(**timetable_data)
                self.data_dict = self.data.model_dump(exclude_none=True)
            
            log.info("Input data validated successfully.",
                     teachers=len(self.data.teachers),
                     rooms=len(self.data.rooms),
                     classes=len(self.data.classes),
                     subjects=len(self.data.subjects))
        except Exception as e:
            log.error("Data validation failed", error=str(e))
            raise ValueError(f"Invalid timetable data structure: {e}")
        
        self.model = cp_model.CpModel()
        self._prepare_data_maps()
        self._process_requests()
        
        # Initialize constraint registry
        self._setup_constraint_registry()
    
    def _setup_constraint_registry(self) -> None:
        """Set up the constraint registry with all constraints."""
        # Reset and get fresh registry instance
        ConstraintRegistry.reset_instance()
        self.registry = ConstraintRegistry.get_instance()
        
        # Register hard constraints
        register_no_overlap_constraints(self.registry)
        register_same_day_constraint(self.registry)
        register_consecutive_constraint(self.registry)
        
        # Register soft constraints
        register_morning_difficult_constraint(self.registry)
        register_teacher_gaps_constraint(self.registry)
        register_subject_spread_constraint(self.registry)
        
        log.info("Constraint registry initialized", 
                 total_constraints=len(self.registry))

    
    def _normalize_days(self) -> None:
        """Normalize all Day values to canonical strings."""
        self.days = [
            d.value if isinstance(d, DayOfWeek) else str(d)
            for d in self.data.config.daysOfWeek
        ]
        self.day_map = {day: idx for idx, day in enumerate(self.days)}
    
    def _build_availability_matrix(self, entities: List[Dict]) -> List[List[int]]:
        """Build availability matrix for teachers or rooms."""
        matrix = [[1] * self.num_slots for _ in entities]
        for e_idx, entity in enumerate(entities):
            if 'availability' in entity:
                for day_str, avail_list in entity['availability'].items():
                    if day_str not in self.day_map:
                        continue
                    d_idx = self.day_map[day_str]
                    for p, is_avail in enumerate(avail_list):
                        if not is_avail:
                            matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
            if 'unavailable' in entity:
                for u in entity['unavailable']:
                    if u['day'] in self.day_map:
                        d_idx = self.day_map[u['day']]
                        for p in u['periods']:
                            if 0 <= p < self.num_periods_per_day:
                                matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
        return matrix
    
    def _build_class_blocked_slots(self) -> List[List[int]]:
        """Build blocked slots matrix for classes."""
        blocked = [[0] * self.num_slots for _ in self.data.classes]
        cfg = self.data.config
        
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
    
    def _prepare_data_maps(self) -> None:
        """Prepare all data mappings needed for solving."""
        cfg = self.data.config
        self._normalize_days()
        self.num_days = len(self.days)
        
        # Handle per-category periods
        if cfg.categoryPeriodsPerDayMap:
            self.category_periods_per_day_map = {
                category: {day.value: periods for day, periods in day_map.items()}
                for category, day_map in cfg.categoryPeriodsPerDayMap.items()
            }
            self.num_periods_per_day = max(
                max(day_map.values())
                for day_map in cfg.categoryPeriodsPerDayMap.values()
            )
            self.periods_per_day_map = {
                day.value: max(
                    day_map.get(day, 0)
                    for day_map in cfg.categoryPeriodsPerDayMap.values()
                )
                for day in cfg.daysOfWeek
            }
        elif cfg.periodsPerDayMap:
            self.periods_per_day_map = {
                day.value: periods for day, periods in cfg.periodsPerDayMap.items()
            }
            self.num_periods_per_day = max(cfg.periodsPerDayMap.values())
            self.category_periods_per_day_map = None
        else:
            self.periods_per_day_map = None
            self.category_periods_per_day_map = None
            self.num_periods_per_day = cfg.periodsPerDay
        
        self.num_slots = self.num_days * self.num_periods_per_day
        
        # Build ID to index mappings
        self.class_map = {c.id: i for i, c in enumerate(self.data.classes)}
        self.teacher_map = {t.id: i for i, t in enumerate(self.data.teachers)}
        self.subject_map = {s.id: i for i, s in enumerate(self.data.subjects)}
        self.room_map = {r.id: i for i, r in enumerate(self.data.rooms)}
        
        # Build availability matrices
        self.teacher_availability = self._build_availability_matrix(self.data_dict['teachers'])
        self.room_availability = self._build_availability_matrix(self.data_dict['rooms'])
        self.class_blocked_slots = self._build_class_blocked_slots()
        
        # Initialize caches
        self.allowed_domains = {}
        self.is_assigned_cache = {}
        
        # Pre-computed mappings for O(1) lookups
        self.teacher_to_requests = collections.defaultdict(list)
        self.class_to_requests = collections.defaultdict(list)
        self.subject_to_requests = collections.defaultdict(list)
        self.request_to_teachers = {}
        
        # Initialize domain filter
        self.domain_filter = DomainFilter(
            self.data,
            self.teacher_map,
            self.room_map,
            self.subject_map,
            self.class_map
        )

    
    def _process_requests(self) -> None:
        """Process subject requirements into scheduling requests."""
        reqs_to_schedule = collections.defaultdict(lambda: collections.defaultdict(int))
        for cls in self.data.classes:
            for subj_id, req in cls.subjectRequirements.items():
                reqs_to_schedule[cls.id][subj_id] = req.periodsPerWeek
        
        # Subtract fixed lessons
        if self.data.fixedLessons:
            for lesson in self.data.fixedLessons:
                if lesson.classId in reqs_to_schedule and lesson.subjectId in reqs_to_schedule[lesson.classId]:
                    reqs_to_schedule[lesson.classId][lesson.subjectId] -= 1
        
        self.requests = []
        for cls in self.data.classes:
            for subj_id, req in cls.subjectRequirements.items():
                periods_to_schedule = reqs_to_schedule[cls.id][subj_id]
                min_c = req.minConsecutive or 1
                max_c = req.maxConsecutive or periods_to_schedule
                
                # Check global toggle for consecutive periods
                try:
                    if self.data.preferences and (self.data.preferences.allowConsecutivePeriodsForSameSubject is False):
                        min_c, max_c = 1, 1
                except Exception:
                    pass
                
                while periods_to_schedule > 0:
                    block_size = min(periods_to_schedule, max_c)
                    if periods_to_schedule >= min_c and 0 < periods_to_schedule - block_size < min_c:
                        block_size = min_c
                    self.requests.append({
                        'class_id': cls.id,
                        'subject_id': subj_id,
                        'length': block_size
                    })
                    periods_to_schedule -= block_size
        
        self.num_requests = len(self.requests)
        log.info("Processed requests", num_requests=self.num_requests)
    
    def _compute_allowed_starts(
        self,
        c_idx: int,
        allowed_teachers: List[int],
        allowed_rooms: List[int],
        length: int
    ) -> List[int]:
        """Compute allowed start slots that satisfy all constraints."""
        allowed_starts = []
        
        for s in range(0, self.num_slots - length + 1):
            ok = True
            
            for o in range(length):
                slot = s + o
                
                if self.class_blocked_slots[c_idx][slot]:
                    ok = False
                    break
                
                teacher_available = any(
                    self.teacher_availability[t_idx][slot]
                    for t_idx in allowed_teachers
                )
                if not teacher_available:
                    ok = False
                    break
                
                room_available = any(
                    self.room_availability[rm_idx][slot]
                    for rm_idx in allowed_rooms
                )
                if not room_available:
                    ok = False
                    break
            
            if ok:
                allowed_starts.append(s)
        
        return allowed_starts
    
    def _get_or_create_is_assigned(
        self,
        r_idx: int,
        t_idx: Optional[int] = None,
        rm_idx: Optional[int] = None
    ) -> cp_model.IntVar:
        """Get or create a boolean variable for assignment."""
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
    
    def _build_request_mappings(self) -> None:
        """Build pre-computed mappings for O(1) lookups."""
        log.info("Building request-resource mappings...")
        
        for r_idx, req in enumerate(self.requests):
            class_id = req['class_id']
            subject_id = req['subject_id']
            
            self.class_to_requests[class_id].append(r_idx)
            self.subject_to_requests[subject_id].append(r_idx)
            
            key = (class_id, subject_id)
            if key in self.allowed_domains:
                allowed_teachers = self.allowed_domains[key]['teachers']
                self.request_to_teachers[r_idx] = allowed_teachers
                
                for t_idx in allowed_teachers:
                    self.teacher_to_requests[t_idx].append(r_idx)
            else:
                c_idx = self.class_map[class_id]
                class_group = self.data.classes[c_idx]
                allowed_teachers = [
                    self.teacher_map[t['id']]
                    for t in self.data_dict['teachers']
                    if can_teach(t, subject_id, class_group, self.data.config.enforceGenderSeparation or False)
                ]
                self.request_to_teachers[r_idx] = allowed_teachers
                for t_idx in allowed_teachers:
                    self.teacher_to_requests[t_idx].append(r_idx)
        
        log.info(f"Request mappings built: {len(self.teacher_to_requests)} teachers")

    
    def _create_variables(self) -> None:
        """Create all necessary CP-SAT model variables."""
        log.info("Creating decision variables...", num_requests=self.num_requests)
        
        self.start_vars = []
        self.teacher_vars = []
        self.room_vars = []
        self.class_intervals = collections.defaultdict(list)
        self.teacher_intervals = collections.defaultdict(list)
        self.room_intervals = collections.defaultdict(list)
        
        for r_idx, req in enumerate(self.requests):
            c_id, s_id, length = req['class_id'], req['subject_id'], req['length']
            c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
            subject = self.data_dict['subjects'][s_idx]
            class_group = self.data.classes[c_idx]
            
            domain_key = (c_id, s_id)
            if domain_key in self.allowed_domains:
                domain_info = self.allowed_domains[domain_key]
                allowed_teachers = domain_info['teachers']
                allowed_rooms = domain_info['rooms']
                allowed_starts = domain_info['starts']
            else:
                # Compute allowed domains
                allowed_teachers = [
                    self.teacher_map[t['id']]
                    for t in self.data_dict['teachers']
                    if can_teach(t, s_id, class_group, self.data.config.enforceGenderSeparation or False)
                ]
                
                # Single-teacher mode constraint
                if class_group.singleTeacherMode and class_group.classTeacherId:
                    class_teacher_idx = self.teacher_map.get(class_group.classTeacherId)
                    if class_teacher_idx is not None and class_teacher_idx in allowed_teachers:
                        allowed_teachers = [class_teacher_idx]
                
                # Fixed room constraint
                fixed_room_id = getattr(class_group, 'fixedRoomId', None)
                if fixed_room_id and fixed_room_id in self.room_map:
                    fixed_room_idx = self.room_map[fixed_room_id]
                    fixed_room = self.data_dict['rooms'][fixed_room_idx]
                    if is_room_compatible(fixed_room, subject, class_group):
                        allowed_rooms = [fixed_room_idx]
                    else:
                        raise RuntimeError(f"Fixed room incompatible for class '{c_id}' and subject '{s_id}'")
                else:
                    allowed_rooms = [
                        self.room_map[r['id']]
                        for r in self.data_dict['rooms']
                        if is_room_compatible(r, subject, class_group)
                    ]
                
                if not allowed_teachers or not allowed_rooms:
                    raise RuntimeError(
                        f"No valid teachers or rooms for class '{c_id}', subject '{s_id}'"
                    )
                
                allowed_starts = self._compute_allowed_starts(c_idx, allowed_teachers, allowed_rooms, length)
                
                if not allowed_starts:
                    raise RuntimeError(
                        f"No valid time slots for class '{c_id}', subject '{s_id}'"
                    )
                
                self.allowed_domains[domain_key] = {
                    'teachers': allowed_teachers,
                    'rooms': allowed_rooms,
                    'starts': allowed_starts
                }
            
            # Create variables
            start_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_starts),
                f'start_{r_idx}'
            )
            teacher_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_teachers),
                f'teacher_{r_idx}'
            )
            room_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_rooms),
                f'room_{r_idx}'
            )
            
            self.start_vars.append(start_var)
            self.teacher_vars.append(teacher_var)
            self.room_vars.append(room_var)
            
            # Create class interval
            end_var = self.model.NewIntVar(0, self.num_slots, f'end_{r_idx}')
            self.model.Add(end_var == start_var + length)
            interval = self.model.NewIntervalVar(start_var, length, end_var, f'interval_{r_idx}')
            self.class_intervals[c_idx].append(interval)
            
            # Create optional teacher intervals
            for t_idx in allowed_teachers:
                is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                
                t_end_var = self.model.NewIntVar(0, self.num_slots, f'end_t_{r_idx}_{t_idx}')
                self.model.Add(t_end_var == start_var + length)
                opt_interval = self.model.NewOptionalIntervalVar(
                    start_var, length, t_end_var, is_assigned, f'opt_t_{r_idx}_{t_idx}'
                )
                self.teacher_intervals[t_idx].append(opt_interval)
            
            # Create optional room intervals
            for rm_idx in allowed_rooms:
                is_assigned = self._get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
                self.model.Add(room_var == rm_idx).OnlyEnforceIf(is_assigned)
                self.model.Add(room_var != rm_idx).OnlyEnforceIf(is_assigned.Not())
                
                r_end_var = self.model.NewIntVar(0, self.num_slots, f'end_r_{r_idx}_{rm_idx}')
                self.model.Add(r_end_var == start_var + length)
                opt_interval = self.model.NewOptionalIntervalVar(
                    start_var, length, r_end_var, is_assigned, f'opt_r_{r_idx}_{rm_idx}'
                )
                self.room_intervals[rm_idx].append(opt_interval)
        
        # Add fixed lesson intervals
        self._add_fixed_lesson_intervals()
        
        log.info("Variables created", 
                 start_vars=len(self.start_vars),
                 teacher_vars=len(self.teacher_vars),
                 room_vars=len(self.room_vars))

    
    def _add_fixed_lesson_intervals(self) -> None:
        """Add interval variables for fixed lessons."""
        if not self.data.fixedLessons:
            return
        
        for i, lesson in enumerate(self.data.fixedLessons):
            c_idx = self.class_map[lesson.classId]
            day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            slot = self.day_map[day_str] * self.num_periods_per_day + lesson.periodIndex
            
            interval = self.model.NewFixedSizeIntervalVar(slot, 1, f'fixed_{i}')
            self.class_intervals[c_idx].append(interval)
            
            for teacher_id in lesson.teacherIds:
                t_idx = self.teacher_map[teacher_id]
                self.teacher_intervals[t_idx].append(interval)
            
            if lesson.roomId:
                rm_idx = self.room_map.get(lesson.roomId)
                if rm_idx is not None:
                    self.room_intervals[rm_idx].append(interval)
    
    def _build_constraint_context(self) -> Dict[str, Any]:
        """Build the context dictionary for constraint application."""
        return {
            'data': self.data,
            'data_dict': self.data_dict,
            'requests': self.requests,
            'start_vars': self.start_vars,
            'teacher_vars': self.teacher_vars,
            'room_vars': self.room_vars,
            'class_intervals': dict(self.class_intervals),
            'teacher_intervals': dict(self.teacher_intervals),
            'room_intervals': dict(self.room_intervals),
            'class_map': self.class_map,
            'teacher_map': self.teacher_map,
            'subject_map': self.subject_map,
            'room_map': self.room_map,
            'day_map': self.day_map,
            'days': self.days,
            'num_days': self.num_days,
            'num_periods_per_day': self.num_periods_per_day,
            'num_slots': self.num_slots,
            'allowed_domains': self.allowed_domains,
            'teacher_availability': self.teacher_availability,
            'room_availability': self.room_availability,
            'class_blocked_slots': self.class_blocked_slots,
            'teacher_to_requests': dict(self.teacher_to_requests),
            'class_to_requests': dict(self.class_to_requests),
            'subject_to_requests': dict(self.subject_to_requests),
            'request_to_teachers': self.request_to_teachers,
            'periods_per_day_map': self.periods_per_day_map,
        }
    
    def _apply_constraints_via_registry(self) -> List[Any]:
        """Apply all constraints using the ConstraintRegistry."""
        context = self._build_constraint_context()
        all_penalties = []
        
        # Apply ESSENTIAL (hard) constraints
        log.info("Applying ESSENTIAL constraints...")
        self.registry.apply_all(self.model, context, ConstraintStage.ESSENTIAL)
        
        # Apply IMPORTANT soft constraints
        log.info("Applying IMPORTANT constraints...")
        penalties = self.registry.apply_all(self.model, context, ConstraintStage.IMPORTANT)
        all_penalties.extend(penalties)
        
        # Apply OPTIONAL soft constraints
        log.info("Applying OPTIONAL constraints...")
        penalties = self.registry.apply_all(self.model, context, ConstraintStage.OPTIONAL)
        all_penalties.extend(penalties)
        
        return all_penalties
    
    def _apply_hard_constraints(self) -> None:
        """Apply hard constraints directly (fallback method)."""
        log.info("Applying hard constraints...")
        
        # No-overlap for classes
        for c_idx, intervals in self.class_intervals.items():
            if intervals:
                self.model.AddNoOverlap(intervals)
        
        # No-overlap for teachers
        for t_idx, intervals in self.teacher_intervals.items():
            if intervals:
                self.model.AddNoOverlap(intervals)
        
        # No-overlap for rooms
        for rm_idx, intervals in self.room_intervals.items():
            if intervals:
                self.model.AddNoOverlap(intervals)
        
        # Teacher availability constraints
        for r_idx, req in enumerate(self.requests):
            c_id, s_id = req['class_id'], req['subject_id']
            domain_key = (c_id, s_id)
            allowed_teachers = self.allowed_domains[domain_key]['teachers']
            
            for t_idx in allowed_teachers:
                is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                
                for slot in range(self.num_slots):
                    if not self.teacher_availability[t_idx][slot]:
                        self.model.Add(self.start_vars[r_idx] != slot).OnlyEnforceIf(is_assigned)
        
        log.info("Hard constraints applied")

    
    def _apply_soft_constraints(self, optimization_level: int = 2) -> List[Any]:
        """Apply soft constraints based on optimization level."""
        if optimization_level == 0:
            log.info("Skipping soft constraints (optimization_level=0)")
            return []
        
        penalties = []
        prefs = self.data.preferences
        
        if not prefs:
            return penalties
        
        # Prefer morning for difficult subjects
        weight = int(prefs.preferMorningForDifficultWeight * 100) if prefs.preferMorningForDifficultWeight else 0
        if weight > 0:
            morning_cutoff = self.num_periods_per_day // 2
            for r_idx, req in enumerate(self.requests):
                s_idx = self.subject_map[req['subject_id']]
                subject = self.data_dict['subjects'][s_idx]
                if subject.get('isDifficult'):
                    penalty = self.model.NewIntVar(0, weight, f'morning_penalty_{r_idx}')
                    is_afternoon = self.model.NewBoolVar(f'is_afternoon_{r_idx}')
                    
                    # Check if start is in afternoon
                    start_period = self.model.NewIntVar(0, self.num_periods_per_day - 1, f'start_period_{r_idx}')
                    self.model.AddModuloEquality(start_period, self.start_vars[r_idx], self.num_periods_per_day)
                    self.model.Add(start_period >= morning_cutoff).OnlyEnforceIf(is_afternoon)
                    self.model.Add(start_period < morning_cutoff).OnlyEnforceIf(is_afternoon.Not())
                    
                    self.model.Add(penalty == weight).OnlyEnforceIf(is_afternoon)
                    self.model.Add(penalty == 0).OnlyEnforceIf(is_afternoon.Not())
                    penalties.append(penalty)
        
        # Avoid teacher gaps
        weight = int(prefs.avoidTeacherGapsWeight * 100) if prefs.avoidTeacherGapsWeight else 0
        if weight > 0 and len(penalties) < 2000:  # Budget limit
            for t_idx in range(len(self.data.teachers)):
                teacher_requests = self.teacher_to_requests.get(t_idx, [])
                if len(teacher_requests) < 2:
                    continue
                
                for d_idx in range(self.num_days):
                    day_start = d_idx * self.num_periods_per_day
                    day_end = day_start + self.num_periods_per_day
                    
                    # Simplified gap penalty
                    gap_penalty = self.model.NewIntVar(0, weight * 2, f'teacher_gap_{t_idx}_{d_idx}')
                    penalties.append(gap_penalty)
        
        log.info("Soft constraints applied", num_penalties=len(penalties))
        return penalties
    
    def _build_solution(self) -> List[Dict]:
        """Build solution from solver values."""
        solution = []
        rev_maps = {
            'teacher': {v: k for k, v in self.teacher_map.items()},
            'room': {v: k for k, v in self.room_map.items()}
        }
        
        for r_idx, req in enumerate(self.requests):
            start = self.solver.Value(self.start_vars[r_idx])
            teacher_idx = self.solver.Value(self.teacher_vars[r_idx])
            room_idx = self.solver.Value(self.room_vars[r_idx])
            
            for offset in range(req['length']):
                slot = start + offset
                day_idx, period_idx = divmod(slot, self.num_periods_per_day)
                day_str = self.days[day_idx]
                
                lesson_data = {
                    "day": day_str,
                    "periodIndex": period_idx,
                    "classId": req['class_id'],
                    "subjectId": req['subject_id'],
                    "teacherIds": [rev_maps['teacher'][teacher_idx]],
                    "roomId": rev_maps['room'][room_idx],
                    "isFixed": False
                }
                
                if self.periods_per_day_map:
                    lesson_data["periodsThisDay"] = self.periods_per_day_map.get(
                        day_str, self.num_periods_per_day
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
                "isFixed": True
            })
        
        solution.sort(key=lambda x: (self.day_map[x['day']], x['periodIndex'], x['classId']))
        return solution
    
    def _build_fixed_lessons_only(self) -> List[Dict]:
        """Return only fixed lessons when no complete solution found."""
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
                "isFixed": True
            })
        return solution

    
    def solve(
        self,
        time_limit_seconds: int = 600,
        enable_graceful_degradation: bool = True,
        optimization_level: int = 2,
        use_registry: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Solve the timetabling problem and return scheduled lessons.
        
        Args:
            time_limit_seconds: Maximum time to spend solving.
            enable_graceful_degradation: Whether to return partial solutions.
            optimization_level: 0=fastest, 1=balanced, 2=thorough.
            use_registry: Whether to use ConstraintRegistry for constraints.
        
        Returns:
            List of scheduled lessons with metadata, or error information.
        """
        try:
            # Use configuration values if provided
            cfg = self.data.config
            if hasattr(cfg, 'solverTimeLimitSeconds') and cfg.solverTimeLimitSeconds:
                time_limit_seconds = cfg.solverTimeLimitSeconds
            if hasattr(cfg, 'solverOptimizationLevel') and cfg.solverOptimizationLevel is not None:
                optimization_level = cfg.solverOptimizationLevel
            if hasattr(cfg, 'enableGracefulDegradation') and cfg.enableGracefulDegradation is not None:
                enable_graceful_degradation = cfg.enableGracefulDegradation
            
            log.info("Starting solve process...",
                     time_limit=time_limit_seconds,
                     num_requests=self.num_requests,
                     optimization_level=optimization_level)
            
            if not self.requests and not self.data.fixedLessons:
                return []
            
            # Select strategy
            available_strategies = {
                0: FastStrategy(),
                1: BalancedStrategy(),
                2: ThoroughStrategy()
            }
            selected_strategy = available_strategies[optimization_level]
            
            # Create variables
            self._create_variables()
            
            # Build request mappings
            self._build_request_mappings()
            
            # Calculate model complexity
            model_complexity = 0
            if self.num_requests > 0 and self.allowed_domains:
                total_allowed_teachers = sum(
                    len(d['teachers']) for d in self.allowed_domains.values()
                )
                total_allowed_rooms = sum(
                    len(d['rooms']) for d in self.allowed_domains.values()
                )
                avg_teachers = total_allowed_teachers / len(self.allowed_domains)
                avg_rooms = total_allowed_rooms / len(self.allowed_domains)
                model_complexity = self.num_requests * avg_teachers * avg_rooms
                
                log.info("Model complexity calculated",
                         model_complexity=int(model_complexity),
                         avg_teachers=f"{avg_teachers:.1f}",
                         avg_rooms=f"{avg_rooms:.1f}")
                
                # Check complexity limit
                if model_complexity > 500000:
                    error_msg = f"Model too complex: {int(model_complexity):,} > 500,000"
                    log.error(error_msg)
                    return [{"error": error_msg, "status": "MODEL_TOO_COMPLEX"}]
            
            # Apply constraints
            penalties = []
            if use_registry:
                penalties = self._apply_constraints_via_registry()
            else:
                self._apply_hard_constraints()
                penalties = self._apply_soft_constraints(optimization_level)
            
            # Set objective if we have penalties
            if penalties:
                self.model.Minimize(sum(penalties))
                log.info("Objective set", num_penalties=len(penalties))
            
            # Configure solver
            self.solver = cp_model.CpSolver()
            problem_size = {
                'num_requests': self.num_requests,
                'num_teachers': len(self.data.teachers),
                'num_classes': len(self.data.classes),
                'avg_teachers': 10
            }
            solver_params = selected_strategy.get_solver_parameters(time_limit_seconds, problem_size)
            
            for param_name, param_value in solver_params.items():
                if hasattr(self.solver.parameters, param_name):
                    setattr(self.solver.parameters, param_name, param_value)
            
            log.info(f"Solver configured with {selected_strategy.name} strategy")
            
            # Solve
            status = self.solver.Solve(self.model)
            log.info("Solve finished",
                     status=self.solver.StatusName(status),
                     wall_time=f"{self.solver.WallTime():.2f}s")
            
            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                solution = self._build_solution()
                return enhance_solution_with_metadata(solution, self.data)
            elif enable_graceful_degradation and status == cp_model.INFEASIBLE:
                log.info("Returning fixed lessons only (graceful degradation)")
                partial = self._build_fixed_lessons_only()
                return enhance_solution_with_metadata(partial, self.data)
            elif status == cp_model.INFEASIBLE:
                error_msg = "No feasible solution exists for the given constraints"
                log.warning(error_msg)
                return [{"error": error_msg, "status": self.solver.StatusName(status)}]
            else:
                error_msg = f"Solver could not find a solution. Status: {self.solver.StatusName(status)}"
                log.warning(error_msg)
                return [{"error": error_msg, "status": self.solver.StatusName(status)}]
        
        except Exception as e:
            error_msg = f"Error during solving: {str(e)}"
            log.error(error_msg, exc_info=True)
            return [{"error": error_msg, "status": "SOLVING_ERROR"}]


# Helper function for metadata enhancement (re-exported from solution_builder)
def enhance_solution_with_metadata(solution: List[Dict], data: TimetableData) -> Dict[str, Any]:
    """Enhance solution with comprehensive metadata for UI integration."""
    from .solution_builder import SolutionBuilder, get_category_dari_name, CATEGORY_DARI_NAMES
    
    # Build class metadata
    teacher_map = {t.id: t for t in data.teachers}
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
        if cls.singleTeacherMode and cls.classTeacherId:
            teacher = teacher_map.get(cls.classTeacherId)
            if teacher:
                class_info["classTeacherName"] = teacher.fullName
                class_info["classTeacherSubjects"] = teacher.primarySubjectIds
        class_metadata.append(class_info)
    
    # Build subject metadata
    subject_metadata = []
    for subj in data.subjects:
        subject_info = {
            "subjectId": subj.id,
            "subjectName": subj.name,
            "isCustom": subj.isCustom,
            "customCategory": subj.customCategory if subj.isCustom else None
        }
        if subj.isCustom and subj.customCategory:
            subject_info["customCategoryDari"] = get_category_dari_name(subj.customCategory)
        subject_metadata.append(subject_info)
    
    # Build teacher metadata
    teacher_metadata = []
    for teacher in data.teachers:
        teacher_info = {
            "teacherId": teacher.id,
            "teacherName": teacher.fullName,
            "primarySubjects": teacher.primarySubjectIds,
            "maxPeriodsPerWeek": teacher.maxPeriodsPerWeek,
            "classTeacherOf": [
                cls.id for cls in data.classes
                if cls.singleTeacherMode and cls.classTeacherId == teacher.id
            ]
        }
        teacher_metadata.append(teacher_info)
    
    # Build period configuration
    cfg = data.config
    periods_map = {}
    if cfg.periodsPerDayMap:
        for day, periods in cfg.periodsPerDayMap.items():
            day_str = day.value if isinstance(day, DayOfWeek) else str(day)
            periods_map[day_str] = periods
    else:
        for day in cfg.daysOfWeek:
            day_str = day.value if isinstance(day, DayOfWeek) else str(day)
            periods_map[day_str] = cfg.periodsPerDay
    
    total_periods = sum(periods_map.values())
    has_variable = len(set(periods_map.values())) > 1
    
    period_config = {
        "periodsPerDayMap": periods_map,
        "totalPeriodsPerWeek": total_periods,
        "daysOfWeek": [d.value if isinstance(d, DayOfWeek) else str(d) for d in cfg.daysOfWeek],
        "hasVariablePeriods": has_variable
    }
    
    # Build statistics
    category_counts = {
        "Alpha-Primary": sum(1 for c in data.classes if c.category == "Alpha-Primary"),
        "Beta-Primary": sum(1 for c in data.classes if c.category == "Beta-Primary"),
        "Middle": sum(1 for c in data.classes if c.category == "Middle"),
        "High": sum(1 for c in data.classes if c.category == "High")
    }
    
    custom_by_category = {}
    for subj in data.subjects:
        if subj.isCustom and subj.customCategory:
            custom_by_category[subj.customCategory] = custom_by_category.get(subj.customCategory, 0) + 1
    
    statistics = {
        "totalClasses": len(data.classes),
        "singleTeacherClasses": sum(1 for c in data.classes if c.singleTeacherMode),
        "multiTeacherClasses": sum(1 for c in data.classes if not c.singleTeacherMode),
        "totalSubjects": len(data.subjects),
        "customSubjects": sum(1 for s in data.subjects if s.isCustom),
        "standardSubjects": sum(1 for s in data.subjects if not s.isCustom),
        "totalTeachers": len(data.teachers),
        "totalRooms": len(data.rooms),
        "categoryCounts": category_counts,
        "customSubjectsByCategory": custom_by_category,
        "totalLessons": len(solution),
        "periodsPerWeek": total_periods
    }
    
    return {
        "schedule": solution,
        "metadata": {
            "classes": class_metadata,
            "subjects": subject_metadata,
            "teachers": teacher_metadata,
            "periodConfiguration": period_config
        },
        "statistics": statistics
    }
