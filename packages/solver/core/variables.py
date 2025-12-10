# ==============================================================================
#
#  Variable Manager for Timetable Solver
#
#  Description:
#  Manages CP-SAT variable creation with memory optimization through variable
#  pooling. Extracts variable creation logic from the monolithic solver.
#
#  **Feature: solver-refactoring, Task 8.1**
#  **Requirements: 1.2, 6.4**
#
# ==============================================================================

import collections
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from ortools.sat.python import cp_model

from models.input import TimetableData, DayOfWeek, ClassGroup


T = TypeVar('T')


class VariableManager:
    """
    Manages CP-SAT variable creation with memory optimization.
    
    This class provides:
    - Variable pooling for memory optimization (Requirement 6.4)
    - Centralized variable creation methods (Requirement 1.2)
    - Caching of computed domains to avoid redundant calculations
    
    Example:
        >>> manager = VariableManager(model, data, data_dict, mappings)
        >>> start_vars = manager.create_start_variables(requests)
        >>> teacher_vars = manager.create_teacher_variables(requests)
        >>> room_vars = manager.create_room_variables(requests)
    """
    
    def __init__(
        self,
        model: cp_model.CpModel,
        data: TimetableData,
        data_dict: Dict[str, Any],
        class_map: Dict[str, int],
        teacher_map: Dict[str, int],
        subject_map: Dict[str, int],
        room_map: Dict[str, int],
        day_map: Dict[str, int],
        num_slots: int,
        num_periods_per_day: int,
        teacher_availability: List[List[int]],
        room_availability: List[List[int]],
        class_blocked_slots: List[List[int]],
    ):
        """
        Initialize the VariableManager.
        
        Args:
            model: The CP-SAT model to create variables in.
            data: The validated TimetableData input.
            data_dict: Dictionary representation of data for compatibility.
            class_map: Mapping from class ID to index.
            teacher_map: Mapping from teacher ID to index.
            subject_map: Mapping from subject ID to index.
            room_map: Mapping from room ID to index.
            day_map: Mapping from day string to index.
            num_slots: Total number of time slots.
            num_periods_per_day: Number of periods per day.
            teacher_availability: Availability matrix for teachers.
            room_availability: Availability matrix for rooms.
            class_blocked_slots: Blocked slots matrix for classes.
        """
        self.model = model
        self.data = data
        self.data_dict = data_dict
        self.class_map = class_map
        self.teacher_map = teacher_map
        self.subject_map = subject_map
        self.room_map = room_map
        self.day_map = day_map
        self.num_slots = num_slots
        self.num_periods_per_day = num_periods_per_day
        self.teacher_availability = teacher_availability
        self.room_availability = room_availability
        self.class_blocked_slots = class_blocked_slots
        
        # Variable pools for memory optimization (Requirement 6.4)
        self._bool_var_pool: Dict[str, cp_model.IntVar] = {}
        self._int_var_pool: Dict[str, cp_model.IntVar] = {}
        self._interval_var_pool: Dict[str, cp_model.IntervalVar] = {}
        
        # Domain cache to avoid redundant calculations
        self._allowed_domains: Dict[Tuple[str, str], Dict[str, Any]] = {}
        
        # Assignment variable cache
        self._is_assigned_cache: Dict[Tuple[int, Optional[int], Optional[int]], cp_model.IntVar] = {}
    
    def get_or_create_bool_var(self, key: str) -> cp_model.IntVar:
        """
        Get a cached boolean variable or create a new one.
        
        This implements variable pooling for memory optimization (Requirement 6.4).
        If a variable with the same key already exists, it is returned instead
        of creating a new one.
        
        Args:
            key: Unique identifier for the boolean variable.
        
        Returns:
            The boolean variable (existing or newly created).
        """
        if key in self._bool_var_pool:
            return self._bool_var_pool[key]
        
        var = self.model.NewBoolVar(key)
        self._bool_var_pool[key] = var
        return var
    
    def get_or_create_int_var(
        self,
        key: str,
        lower_bound: int,
        upper_bound: int
    ) -> cp_model.IntVar:
        """
        Get a cached integer variable or create a new one.
        
        Args:
            key: Unique identifier for the integer variable.
            lower_bound: Minimum value for the variable.
            upper_bound: Maximum value for the variable.
        
        Returns:
            The integer variable (existing or newly created).
        """
        if key in self._int_var_pool:
            return self._int_var_pool[key]
        
        var = self.model.NewIntVar(lower_bound, upper_bound, key)
        self._int_var_pool[key] = var
        return var
    
    def get_or_create_variable(
        self,
        pool_name: str,
        key: str,
        factory: Callable[[], T]
    ) -> T:
        """
        Get a variable from a named pool or create it using the factory.
        
        This is a generic method for variable pooling that works with any
        variable type.
        
        Args:
            pool_name: Name of the pool ('bool', 'int', 'interval').
            key: Unique identifier for the variable.
            factory: Callable that creates the variable if not found.
        
        Returns:
            The variable (existing or newly created).
        """
        pool = self._get_pool(pool_name)
        if key in pool:
            return pool[key]
        
        var = factory()
        pool[key] = var
        return var
    
    def _get_pool(self, pool_name: str) -> Dict[str, Any]:
        """Get the appropriate variable pool by name."""
        if pool_name == 'bool':
            return self._bool_var_pool
        elif pool_name == 'int':
            return self._int_var_pool
        elif pool_name == 'interval':
            return self._interval_var_pool
        else:
            raise ValueError(f"Unknown pool name: {pool_name}")
    
    def get_or_create_is_assigned(
        self,
        r_idx: int,
        t_idx: Optional[int] = None,
        rm_idx: Optional[int] = None
    ) -> cp_model.IntVar:
        """
        Get or create a boolean variable representing assignment.
        
        Creates a boolean variable that indicates whether a specific teacher
        or room is assigned to a request.
        
        Args:
            r_idx: Request index.
            t_idx: Teacher index (if checking teacher assignment).
            rm_idx: Room index (if checking room assignment).
        
        Returns:
            Boolean variable for the assignment.
        
        Raises:
            ValueError: If neither t_idx nor rm_idx is provided.
        """
        if t_idx is None and rm_idx is None:
            raise ValueError("Either t_idx or rm_idx must be provided")
        
        key = (r_idx, t_idx, rm_idx)
        if key in self._is_assigned_cache:
            return self._is_assigned_cache[key]
        
        if t_idx is not None:
            var = self.model.NewBoolVar(f'is_assigned_t_{r_idx}_{t_idx}')
        else:
            var = self.model.NewBoolVar(f'is_assigned_r_{r_idx}_{rm_idx}')
        
        self._is_assigned_cache[key] = var
        return var
    
    def compute_allowed_starts(
        self,
        c_idx: int,
        allowed_teachers: List[int],
        allowed_rooms: List[int],
        length: int
    ) -> List[int]:
        """
        Compute allowed start slots that satisfy all constraints.
        
        Args:
            c_idx: Class index.
            allowed_teachers: List of allowed teacher indices.
            allowed_rooms: List of allowed room indices.
            length: Length of the request in periods.
        
        Returns:
            List of allowed start slot indices.
        """
        allowed_starts = []
        
        for s in range(0, self.num_slots - length + 1):
            ok = True
            
            for o in range(length):
                slot = s + o
                
                # Check class blocked slots
                if self.class_blocked_slots[c_idx][slot]:
                    ok = False
                    break
                
                # Check if at least one teacher is available
                teacher_available = any(
                    self.teacher_availability[t_idx][slot]
                    for t_idx in allowed_teachers
                )
                if not teacher_available:
                    ok = False
                    break
                
                # Check if at least one room is available
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
    
    def get_or_compute_allowed_domain(
        self,
        class_id: str,
        subject_id: str,
        class_group: ClassGroup,
        can_teach_func: Callable,
        is_room_compatible_func: Callable,
    ) -> Dict[str, Any]:
        """
        Get cached allowed domain or compute it.
        
        Args:
            class_id: Class ID.
            subject_id: Subject ID.
            class_group: ClassGroup object.
            can_teach_func: Function to check if teacher can teach subject.
            is_room_compatible_func: Function to check room compatibility.
        
        Returns:
            Dictionary with 'teachers', 'rooms', and 'starts' keys.
        """
        domain_key = (class_id, subject_id)
        if domain_key in self._allowed_domains:
            return self._allowed_domains[domain_key]
        
        # This method returns the cached domain or None if not computed
        # The actual computation should be done by the caller
        return None
    
    def cache_allowed_domain(
        self,
        class_id: str,
        subject_id: str,
        domain: Dict[str, Any]
    ) -> None:
        """
        Cache an allowed domain for future use.
        
        Args:
            class_id: Class ID.
            subject_id: Subject ID.
            domain: Dictionary with 'teachers', 'rooms', and 'starts' keys.
        """
        domain_key = (class_id, subject_id)
        self._allowed_domains[domain_key] = domain
    
    def create_start_variables(
        self,
        requests: List[Dict[str, Any]],
        allowed_domains: Dict[Tuple[str, str], Dict[str, Any]]
    ) -> List[cp_model.IntVar]:
        """
        Create start time variables for each request.
        
        Args:
            requests: List of scheduling requests.
            allowed_domains: Pre-computed allowed domains for each class/subject.
        
        Returns:
            List of start time variables, one per request.
        """
        start_vars = []
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            s_id = req['subject_id']
            domain_key = (c_id, s_id)
            
            allowed_starts = allowed_domains[domain_key]['starts']
            start_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_starts),
                f'start_{r_idx}'
            )
            start_vars.append(start_var)
        
        return start_vars
    
    def create_teacher_variables(
        self,
        requests: List[Dict[str, Any]],
        allowed_domains: Dict[Tuple[str, str], Dict[str, Any]]
    ) -> List[cp_model.IntVar]:
        """
        Create teacher assignment variables for each request.
        
        Args:
            requests: List of scheduling requests.
            allowed_domains: Pre-computed allowed domains for each class/subject.
        
        Returns:
            List of teacher assignment variables, one per request.
        """
        teacher_vars = []
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            s_id = req['subject_id']
            domain_key = (c_id, s_id)
            
            allowed_teachers = allowed_domains[domain_key]['teachers']
            teacher_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_teachers),
                f'teacher_{r_idx}'
            )
            teacher_vars.append(teacher_var)
        
        return teacher_vars
    
    def create_room_variables(
        self,
        requests: List[Dict[str, Any]],
        allowed_domains: Dict[Tuple[str, str], Dict[str, Any]]
    ) -> List[cp_model.IntVar]:
        """
        Create room assignment variables for each request.
        
        Args:
            requests: List of scheduling requests.
            allowed_domains: Pre-computed allowed domains for each class/subject.
        
        Returns:
            List of room assignment variables, one per request.
        """
        room_vars = []
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            s_id = req['subject_id']
            domain_key = (c_id, s_id)
            
            allowed_rooms = allowed_domains[domain_key]['rooms']
            room_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_rooms),
                f'room_{r_idx}'
            )
            room_vars.append(room_var)
        
        return room_vars
    
    def create_interval_variables(
        self,
        requests: List[Dict[str, Any]],
        start_vars: List[cp_model.IntVar]
    ) -> Tuple[
        Dict[int, List[cp_model.IntervalVar]],
        Dict[int, List[cp_model.IntervalVar]],
        Dict[int, List[cp_model.IntervalVar]]
    ]:
        """
        Create interval variables for no-overlap constraints.
        
        Args:
            requests: List of scheduling requests.
            start_vars: List of start time variables.
        
        Returns:
            Tuple of (class_intervals, teacher_intervals, room_intervals) dictionaries.
        """
        class_intervals: Dict[int, List[cp_model.IntervalVar]] = collections.defaultdict(list)
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            length = req['length']
            c_idx = self.class_map[c_id]
            start_var = start_vars[r_idx]
            
            # Create explicit end variable for safer interval creation
            end_var = self.model.NewIntVar(0, self.num_slots, f'end_{r_idx}')
            self.model.Add(end_var == start_var + length)
            
            interval = self.model.NewIntervalVar(
                start_var, length, end_var, f'interval_{r_idx}'
            )
            class_intervals[c_idx].append(interval)
        
        # Teacher and room intervals are created separately with optional intervals
        teacher_intervals: Dict[int, List[cp_model.IntervalVar]] = collections.defaultdict(list)
        room_intervals: Dict[int, List[cp_model.IntervalVar]] = collections.defaultdict(list)
        
        return class_intervals, teacher_intervals, room_intervals
    
    def create_optional_teacher_intervals(
        self,
        requests: List[Dict[str, Any]],
        start_vars: List[cp_model.IntVar],
        teacher_vars: List[cp_model.IntVar],
        allowed_domains: Dict[Tuple[str, str], Dict[str, Any]]
    ) -> Dict[int, List[cp_model.IntervalVar]]:
        """
        Create optional interval variables for teacher no-overlap constraints.
        
        Args:
            requests: List of scheduling requests.
            start_vars: List of start time variables.
            teacher_vars: List of teacher assignment variables.
            allowed_domains: Pre-computed allowed domains.
        
        Returns:
            Dictionary mapping teacher index to list of optional intervals.
        """
        teacher_intervals: Dict[int, List[cp_model.IntervalVar]] = collections.defaultdict(list)
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            s_id = req['subject_id']
            length = req['length']
            domain_key = (c_id, s_id)
            
            allowed_teachers = allowed_domains[domain_key]['teachers']
            start_var = start_vars[r_idx]
            teacher_var = teacher_vars[r_idx]
            
            for t_idx in allowed_teachers:
                is_assigned = self.get_or_create_is_assigned(r_idx, t_idx=t_idx)
                self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())
                
                end_var = self.model.NewIntVar(0, self.num_slots, f'end_t_{r_idx}_{t_idx}')
                self.model.Add(end_var == start_var + length)
                
                opt_interval = self.model.NewOptionalIntervalVar(
                    start_var, length, end_var, is_assigned, f'opt_t_{r_idx}_{t_idx}'
                )
                teacher_intervals[t_idx].append(opt_interval)
        
        return teacher_intervals
    
    def create_optional_room_intervals(
        self,
        requests: List[Dict[str, Any]],
        start_vars: List[cp_model.IntVar],
        room_vars: List[cp_model.IntVar],
        allowed_domains: Dict[Tuple[str, str], Dict[str, Any]]
    ) -> Dict[int, List[cp_model.IntervalVar]]:
        """
        Create optional interval variables for room no-overlap constraints.
        
        Args:
            requests: List of scheduling requests.
            start_vars: List of start time variables.
            room_vars: List of room assignment variables.
            allowed_domains: Pre-computed allowed domains.
        
        Returns:
            Dictionary mapping room index to list of optional intervals.
        """
        room_intervals: Dict[int, List[cp_model.IntervalVar]] = collections.defaultdict(list)
        
        for r_idx, req in enumerate(requests):
            c_id = req['class_id']
            s_id = req['subject_id']
            length = req['length']
            domain_key = (c_id, s_id)
            
            allowed_rooms = allowed_domains[domain_key]['rooms']
            start_var = start_vars[r_idx]
            room_var = room_vars[r_idx]
            
            for rm_idx in allowed_rooms:
                is_assigned = self.get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
                self.model.Add(room_var == rm_idx).OnlyEnforceIf(is_assigned)
                self.model.Add(room_var != rm_idx).OnlyEnforceIf(is_assigned.Not())
                
                end_var = self.model.NewIntVar(0, self.num_slots, f'end_r_{r_idx}_{rm_idx}')
                self.model.Add(end_var == start_var + length)
                
                opt_interval = self.model.NewOptionalIntervalVar(
                    start_var, length, end_var, is_assigned, f'opt_r_{r_idx}_{rm_idx}'
                )
                room_intervals[rm_idx].append(opt_interval)
        
        return room_intervals
    
    def create_fixed_lesson_intervals(
        self,
        fixed_lessons: List[Any],
        class_intervals: Dict[int, List[cp_model.IntervalVar]],
        teacher_intervals: Dict[int, List[cp_model.IntervalVar]],
        room_intervals: Dict[int, List[cp_model.IntervalVar]]
    ) -> None:
        """
        Create fixed interval variables for pre-scheduled lessons.
        
        Args:
            fixed_lessons: List of fixed lessons.
            class_intervals: Dictionary to add class intervals to.
            teacher_intervals: Dictionary to add teacher intervals to.
            room_intervals: Dictionary to add room intervals to.
        """
        if not fixed_lessons:
            return
        
        for i, lesson in enumerate(fixed_lessons):
            c_idx = self.class_map[lesson.classId]
            day_str = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            slot = self.day_map[day_str] * self.num_periods_per_day + lesson.periodIndex
            
            interval = self.model.NewFixedSizeIntervalVar(slot, 1, f'fixed_{i}')
            class_intervals[c_idx].append(interval)
            
            # Attach interval to all teachers
            for teacher_id in lesson.teacherIds:
                t_idx = self.teacher_map[teacher_id]
                teacher_intervals[t_idx].append(interval)
            
            # Attach interval to room if specified
            if lesson.roomId:
                rm_idx = self.room_map.get(lesson.roomId)
                if rm_idx is not None:
                    room_intervals[rm_idx].append(interval)
    
    def get_pool_stats(self) -> Dict[str, int]:
        """
        Get statistics about variable pool usage.
        
        Returns:
            Dictionary with pool sizes.
        """
        return {
            'bool_vars': len(self._bool_var_pool),
            'int_vars': len(self._int_var_pool),
            'interval_vars': len(self._interval_var_pool),
            'is_assigned_vars': len(self._is_assigned_cache),
            'cached_domains': len(self._allowed_domains),
        }
    
    def clear_pools(self) -> None:
        """Clear all variable pools (for memory management)."""
        self._bool_var_pool.clear()
        self._int_var_pool.clear()
        self._interval_var_pool.clear()
        self._is_assigned_cache.clear()
        self._allowed_domains.clear()
