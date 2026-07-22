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
import os
import threading
import time
from typing import Any, Dict, List, Optional, Union

from ortools.sat.python import cp_model

try:
    import psutil
except ImportError:  # Optional in source checkouts; packaged builds install it.
    psutil = None

# Use centralized logging configuration
from config.logging import get_logger

from models.input import TimetableData, DayOfWeek
from models.output import SolverStatus
from core.variables import VariableManager
from core.solution_builder import (
    SolutionBuilder,
    build_period_configuration_metadata,
    get_category_dari_name,
    get_periods_for_class_day,
    CATEGORY_DARI_NAMES,
)
from constraints.registry import ConstraintRegistry, ConstraintStage
from constraints.hard.no_overlap import register_no_overlap_constraints
from constraints.hard.same_day import register_same_day_constraint
from constraints.hard.consecutive import register_consecutive_constraint
from constraints.hard.class_teacher import register_class_teacher_constraint

# Import strategy system
from strategies import FastStrategy, BalancedStrategy, ThoroughStrategy

# Import utilities
from utils import (
    DomainFilter,
)

# Import feedback modules for UX improvements
# Requirements: 1.1
from feedback import (
    ProgressReporter,
    QualityScorer,
    StrategySelector,
    build_error,
    build_internal_error,
    SolverResponse,
    ResponseStatus,
    SolverResponseMetadata,
    SolverErrorDetail,
    ErrorCode,
    SolveStage,
)

# Import Afghanistan-specific modules
# Requirements: 1.1, 2.1, 3.1, 4.1
from afghanistan import (
    apply_defaults,
    LowResourceHandler,
    MAX_WORKERS as LOW_RESOURCE_MAX_WORKERS,
    MAX_MEMORY_MB as LOW_RESOURCE_MAX_MEMORY_MB,
)

log = get_logger("solver.core")


class _IncumbentCallback(cp_model.CpSolverSolutionCallback):
    """Persist every feasible incumbent so cancellation never loses valid work."""

    def __init__(self, owner: "TimetableSolver", output_path: Optional[str], stop_after_first: bool):
        super().__init__()
        self.owner = owner
        self.output_path = output_path
        self.stop_after_first = stop_after_first
        self.solution_count = 0
        self.first_solution_seconds: Optional[float] = None
        self.started_at = time.monotonic()

    def on_solution_callback(self) -> None:
        self.solution_count += 1
        elapsed = time.monotonic() - self.started_at
        if self.first_solution_seconds is None:
            self.first_solution_seconds = elapsed

        if self.output_path:
            payload = {
                "schedule": self.owner._build_solution(self),
                "objectiveValue": float(self.ObjectiveValue()),
                "bestBound": float(self.BestObjectiveBound()),
                "solutionCount": self.solution_count,
                "timeToFirstFeasibleSeconds": self.first_solution_seconds,
            }
            temporary_path = f"{self.output_path}.tmp"
            try:
                with open(temporary_path, "w", encoding="utf-8") as handle:
                    json.dump(payload, handle, ensure_ascii=False)
                    handle.flush()
                    os.fsync(handle.fileno())
                os.replace(temporary_path, self.output_path)
            except OSError as error:
                log.warning("Unable to persist incumbent", error=str(error))

        if self.stop_after_first:
            self.StopSearch()


# --- Helper Functions ---
def can_teach(
    teacher: dict,
    subject_id: str,
    class_group: Optional[Any] = None,
    enforce_gender_separation: Optional[bool] = False,
) -> bool:
    """Check if a teacher can teach a specific subject."""
    primary_subjects = teacher.get("primarySubjectIds", [])
    if subject_id not in primary_subjects and subject_id not in teacher.get("allowedSubjectIds", []):
        return False

    # Check gender separation constraints if enabled
    if enforce_gender_separation and class_group and teacher.get("gender"):
        class_gender = getattr(class_group, "gender", None)
        if class_gender:
            teacher_gender = teacher["gender"].lower()
            class_gender = class_gender.lower()

            if teacher_gender == "mixed" or class_gender == "mixed":
                return True

            if teacher_gender != class_gender:
                return False

    return True


def is_room_compatible(room: dict, subject: dict, class_group: Any) -> bool:
    """Check if a room is compatible with a subject and class."""
    min_cap = subject.get("minRoomCapacity")
    if min_cap is None:
        min_cap = 0
    if room["capacity"] < max(class_group.studentCount, min_cap):
        return False
    req_type = subject.get("requiredRoomType")
    if req_type and room["type"] != req_type:
        return False
    req_features = set(subject.get("requiredFeatures") or [])
    if not req_features.issubset(set(room.get("features", []))):
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

            # Apply Afghanistan defaults to missing config fields
            # Requirements: 3.1, 3.2, 3.3
            if isinstance(timetable_data, TimetableData):
                self.data = timetable_data
                self.data_dict = self.data.model_dump(exclude_none=True)
                # Initialize handlers from existing config
                config_dict = self.data_dict.get("config", {})
                self._low_resource_handler = LowResourceHandler.from_solver_config(
                    config_dict
                )
            else:
                # Apply defaults before validation
                timetable_data = apply_defaults(timetable_data)

                config = timetable_data.get("config", {})
                # Initialize low-resource handler
                # Requirements: 4.1, 4.2, 4.3, 4.4
                self._low_resource_handler = LowResourceHandler.from_solver_config(
                    config
                )
                if self._low_resource_handler.enabled:
                    log.info(
                        "Low-resource mode enabled",
                        max_workers=LOW_RESOURCE_MAX_WORKERS,
                        max_memory_mb=LOW_RESOURCE_MAX_MEMORY_MB,
                    )

                self.data = TimetableData(**timetable_data)
                self.data_dict = self.data.model_dump(exclude_none=True)

            log.info(
                "Input data validated successfully.",
                teachers=len(self.data.teachers),
                rooms=len(self.data.rooms),
                classes=len(self.data.classes),
                subjects=len(self.data.subjects),
            )
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
        register_class_teacher_constraint(self.registry)

        log.info(
            "Constraint registry initialized", total_constraints=len(self.registry)
        )

    def _normalize_days(self) -> None:
        """Normalize all Day values to canonical strings."""
        self.days = [
            d.value if isinstance(d, DayOfWeek) else str(d)
            for d in self.data.config.daysOfWeek
        ]
        self.day_map = {day: idx for idx, day in enumerate(self.days)}

    def _periods_for_day(self, day_idx: int) -> int:
        """Return the usable width of the global grid for a day."""
        if self.periods_per_day_map:
            return self.periods_per_day_map.get(
                self.days[day_idx], self.num_periods_per_day
            )
        return self.num_periods_per_day

    def _build_availability_matrix(self, entities: List[Dict]) -> List[List[int]]:
        """Build availability matrix for teachers or rooms.

        This method also respects periodsPerDayMap by marking slots beyond
        the per-day limit as unavailable.

        Requirements: 5.1, 5.2, 5.4 - Day Configuration Respect
        """
        matrix = [[1] * self.num_slots for _ in entities]

        # First, mark slots beyond per-day limits as unavailable (Requirements: 5.1, 5.2, 5.4)
        if self.periods_per_day_map:
            for day_str, periods_for_day in self.periods_per_day_map.items():
                if day_str not in self.day_map:
                    continue
                d_idx = self.day_map[day_str]
                # Mark all periods beyond the day's limit as unavailable
                for p in range(periods_for_day, self.num_periods_per_day):
                    slot = d_idx * self.num_periods_per_day + p
                    for e_idx in range(len(entities)):
                        matrix[e_idx][slot] = 0

        for e_idx, entity in enumerate(entities):
            if "availability" in entity:
                for day_str, avail_list in entity["availability"].items():
                    if day_str not in self.day_map:
                        continue
                    d_idx = self.day_map[day_str]
                    for p, is_avail in enumerate(avail_list):
                        if not is_avail:
                            matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
            if "unavailable" in entity:
                for u in entity["unavailable"]:
                    if u["day"] in self.day_map:
                        d_idx = self.day_map[u["day"]]
                        for p in u["periods"]:
                            if 0 <= p < self.num_periods_per_day:
                                matrix[e_idx][d_idx * self.num_periods_per_day + p] = 0
        return matrix

    def _build_class_blocked_slots(self) -> List[List[int]]:
        """Build blocked slots matrix for classes.

        This method blocks slots that are unavailable for scheduling:
        1. School events
        2. Slots that exceed the per-day period limit (from periodsPerDayMap)

        Requirements: 5.1, 5.2, 5.4 - Day Configuration Respect
        """
        blocked = [[0] * self.num_slots for _ in self.data.classes]
        cfg = self.data.config

        # A category configuration is a per-class scheduling boundary. The
        # global periodsPerDayMap represents only the widest timetable grid and
        # must never be used to make shorter-category slots schedulable.
        for c_idx, class_group in enumerate(self.data.classes):
            for day_str, d_idx in self.day_map.items():
                periods_for_day = get_periods_for_class_day(
                    cfg,
                    class_group.category,
                    day_str,
                    self.periods_per_day_map,
                    self.num_periods_per_day,
                )
                for p in range(periods_for_day, self.num_periods_per_day):
                    slot = d_idx * self.num_periods_per_day + p
                    blocked[c_idx][slot] = 1

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
        self.teacher_availability = self._build_availability_matrix(
            self.data_dict["teachers"]
        )
        self.room_availability = self._build_availability_matrix(
            self.data_dict["rooms"]
        )
        self.class_blocked_slots = self._build_class_blocked_slots()
        self._validate_fixed_lesson_rooms()

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
            self.data, self.teacher_map, self.room_map, self.subject_map, self.class_map
        )

        # Build fixed teacher assignment lookup map
        # Key: (classId, subjectId) -> List of {teacherId, periodsPerWeek, isFixed}
        self.fixed_teacher_assignments = collections.defaultdict(list)
        if self.data.fixedTeacherAssignments:
            for assignment in self.data.fixedTeacherAssignments:
                key = (assignment.classId, assignment.subjectId)
                teacher_idx = self.teacher_map.get(assignment.teacherId)
                if teacher_idx is not None:
                    self.fixed_teacher_assignments[key].append(
                        {
                            "teacher_idx": teacher_idx,
                            "teacher_id": assignment.teacherId,
                            "periods": assignment.periodsPerWeek,
                            "is_fixed": assignment.isFixed,
                        }
                    )
            log.info(
                "Loaded fixed teacher assignments",
                count=len(self.data.fixedTeacherAssignments),
                unique_pairs=len(self.fixed_teacher_assignments),
            )

    def _effective_fixed_lesson_room_id(self, lesson: Any) -> Optional[str]:
        """Return the authoritative room for a pre-scheduled lesson."""
        class_group = self.data.classes[self.class_map[lesson.classId]]
        return class_group.fixedRoomId or lesson.roomId

    def _validate_fixed_lesson_rooms(self) -> None:
        """Apply the normal room contract to non-fixed pre-scheduled lessons.

        A class-level fixed room deliberately bypasses room metadata and room
        availability. Pre-scheduled lessons for all other classes must satisfy
        the same room existence, compatibility, and availability rules as
        generated lessons.
        """
        for i, lesson in enumerate(self.data.fixedLessons or []):
            class_group = self.data.classes[self.class_map[lesson.classId]]
            room_id = self._effective_fixed_lesson_room_id(lesson)
            if not room_id:
                raise ValueError(
                    f"Fixed lesson {i} for non-fixed class '{lesson.classId}' must have a roomId"
                )

            room_idx = self.room_map.get(room_id)
            if room_idx is None:
                raise ValueError(
                    f"Fixed lesson {i} has unknown effective roomId '{room_id}'"
                )

            if class_group.fixedRoomId:
                continue

            room = self.data_dict["rooms"][room_idx]
            subject = self.data_dict["subjects"][self.subject_map[lesson.subjectId]]
            if not is_room_compatible(room, subject, class_group):
                raise ValueError(
                    f"Fixed lesson {i} roomId '{room_id}' is incompatible with "
                    f"class '{lesson.classId}' and subject '{lesson.subjectId}'"
                )

            day_str = (
                lesson.day.value
                if isinstance(lesson.day, DayOfWeek)
                else str(lesson.day)
            )
            slot = (
                self.day_map[day_str] * self.num_periods_per_day
                + lesson.periodIndex
            )
            if not self.room_availability[room_idx][slot]:
                raise ValueError(
                    f"Fixed lesson {i} roomId '{room_id}' is unavailable on "
                    f"{day_str} at period {lesson.periodIndex}"
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
                if (
                    lesson.classId in reqs_to_schedule
                    and lesson.subjectId in reqs_to_schedule[lesson.classId]
                ):
                    reqs_to_schedule[lesson.classId][lesson.subjectId] -= 1

        self.requests = []
        for cls in self.data.classes:
            for subj_id, req in cls.subjectRequirements.items():
                periods_to_schedule = reqs_to_schedule[cls.id][subj_id]
                # Default to single-period lessons when no consecutive rule is
                # configured. Falling back to periods_to_schedule collapses an
                # entire weekly requirement into one giant block.
                min_c = req.minConsecutive or 1
                max_c = req.maxConsecutive or 1
                if max_c < min_c:
                    max_c = min_c

                # Split teacher allocations are expressed in individual
                # periods. Materialize single-period requests so any exact
                # distribution (for example 1+2) remains representable.
                if (cls.id, subj_id) in self.fixed_teacher_assignments:
                    min_c, max_c = 1, 1

                # Check global toggle for consecutive periods
                try:
                    if self.data.preferences and (
                        self.data.preferences.allowConsecutivePeriodsForSameSubject
                        is False
                    ):
                        min_c, max_c = 1, 1
                except Exception:
                    pass

                while periods_to_schedule > 0:
                    block_size = min(periods_to_schedule, max_c)
                    if (
                        periods_to_schedule >= min_c
                        and 0 < periods_to_schedule - block_size < min_c
                    ):
                        block_size = min_c
                    self.requests.append(
                        {
                            "class_id": cls.id,
                            "subject_id": subj_id,
                            "length": block_size,
                        }
                    )
                    periods_to_schedule -= block_size

        self.num_requests = len(self.requests)
        log.info("Processed requests", num_requests=self.num_requests)

    def _compute_allowed_starts(
        self,
        c_idx: int,
        allowed_teachers: List[int],
        allowed_rooms: List[int],
        length: int,
    ) -> List[int]:
        """Compute starts that fit the class grid and remain within one day.

        Resource availability is linked to the *selected* teacher and room by
        allowed-assignment tables in ``_create_variables``. Keeping it out of
        this aggregate pre-filter avoids the invalid "teacher A in period one,
        teacher B in period two" interpretation for multi-period lessons.
        """
        allowed_starts = []

        for s in range(0, self.num_slots - length + 1):
            if s // self.num_periods_per_day != (s + length - 1) // self.num_periods_per_day:
                continue

            ok = True
            for o in range(length):
                slot = s + o

                if self.class_blocked_slots[c_idx][slot]:
                    ok = False
                    break

            if ok:
                allowed_starts.append(s)

        return allowed_starts

    @staticmethod
    def _compute_resource_start_pairs(
        availability: List[List[int]],
        resource_indices: List[int],
        starts: List[int],
        length: int,
    ) -> List[List[int]]:
        """Return ``[start, resource]`` tuples available for the full lesson."""
        return [
            [start, resource_idx]
            for start in starts
            for resource_idx in resource_indices
            if all(availability[resource_idx][start + offset] for offset in range(length))
        ]

    def _get_or_create_is_assigned(
        self, r_idx: int, t_idx: Optional[int] = None, rm_idx: Optional[int] = None
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
            var = self.model.NewBoolVar(f"is_assigned_t_{r_idx}_{t_idx}")
        else:
            var = self.model.NewBoolVar(f"is_assigned_r_{r_idx}_{rm_idx}")

        self.is_assigned_cache[key] = var
        return var

    def _cache_fixed_assignment(
        self, r_idx: int, *, t_idx: Optional[int] = None, rm_idx: Optional[int] = None
    ) -> None:
        """Represent a singleton resource choice as a constant instead of a BoolVar."""
        key = (r_idx, t_idx, None) if t_idx is not None else (r_idx, None, rm_idx)
        self.is_assigned_cache[key] = self.model.NewConstant(1)

    def _build_request_mappings(self) -> None:
        """Build pre-computed mappings for O(1) lookups."""
        log.info("Building request-resource mappings...")

        for r_idx, req in enumerate(self.requests):
            class_id = req["class_id"]
            subject_id = req["subject_id"]

            self.class_to_requests[class_id].append(r_idx)
            self.subject_to_requests[subject_id].append(r_idx)

            key = (class_id, subject_id)
            if key in self.allowed_domains:
                allowed_teachers = self.allowed_domains[key]["teachers"]
                self.request_to_teachers[r_idx] = allowed_teachers

                for t_idx in allowed_teachers:
                    self.teacher_to_requests[t_idx].append(r_idx)
            else:
                c_idx = self.class_map[class_id]
                class_group = self.data.classes[c_idx]
                allowed_teachers = [
                    self.teacher_map[t["id"]]
                    for t in self.data_dict["teachers"]
                    if can_teach(
                        t,
                        subject_id,
                        class_group,
                        self.data.config.enforceGenderSeparation or False,
                    )
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
        self.request_allowed_teachers = []
        self.request_allowed_rooms = []
        self.request_allowed_starts = []

        for r_idx, req in enumerate(self.requests):
            c_id, s_id, length = req["class_id"], req["subject_id"], req["length"]
            c_idx, s_idx = self.class_map[c_id], self.subject_map[s_id]
            subject = self.data_dict["subjects"][s_idx]
            class_group = self.data.classes[c_idx]

            domain_key = (c_id, s_id)
            if domain_key in self.allowed_domains:
                domain_info = self.allowed_domains[domain_key]
                allowed_teachers = domain_info["teachers"]
                allowed_rooms = domain_info["rooms"]
                # Resource domains are shared by a class/subject pair, but
                # start domains depend on this request's block length. Reusing
                # the longest block's starts can incorrectly exclude a valid
                # single-period remainder.
                allowed_starts = self._compute_allowed_starts(
                    c_idx, allowed_teachers, allowed_rooms, length
                )
            else:
                # Compute allowed domains
                allowed_teachers = [
                    self.teacher_map[t["id"]]
                    for t in self.data_dict["teachers"]
                    if can_teach(
                        t,
                        s_id,
                        class_group,
                        self.data.config.enforceGenderSeparation or False,
                    )
                ]

                # Single-teacher mode constraint
                if class_group.singleTeacherMode and class_group.classTeacherId:
                    class_teacher_idx = self.teacher_map.get(class_group.classTeacherId)
                    if class_teacher_idx is None:
                        raise RuntimeError(
                            f"Single-teacher class references unknown teacher | class={c_id}"
                        )
                    # Grades 1–3 deliberately bypass subject-capability policy.
                    allowed_teachers = [class_teacher_idx]

                # Fixed/split counts are enforced after all request variables
                # exist. Do not collapse the domain here: a partially assigned
                # requirement may legitimately use another capable teacher for
                # its remaining periods.
                elif domain_key in self.fixed_teacher_assignments:
                    fixed_assignments = self.fixed_teacher_assignments[domain_key]
                    invalid_fixed = [
                        a["teacher_id"]
                        for a in fixed_assignments
                        if a["teacher_idx"] not in allowed_teachers
                    ]
                    if invalid_fixed:
                        raise RuntimeError(
                            f"Fixed teacher assignment is outside the capability domain | "
                            f"class={c_id} subject={s_id} teachers={invalid_fixed}"
                        )

                # A fixed room is an administrative override. Once a class is
                # locked to a room, room metadata (type, capacity, features,
                # and availability) must not narrow the scheduling domain.
                fixed_room_id = getattr(class_group, "fixedRoomId", None)
                if fixed_room_id:
                    fixed_room_idx = self.room_map.get(fixed_room_id)
                    if fixed_room_idx is None:
                        raise RuntimeError(
                            f"Fixed room not found for class '{c_id}' | room={fixed_room_id}"
                        )
                    allowed_rooms = [fixed_room_idx]
                else:
                    allowed_rooms = [
                        self.room_map[r["id"]]
                        for r in self.data_dict["rooms"]
                        if is_room_compatible(r, subject, class_group)
                    ]

                if not allowed_teachers or not allowed_rooms:
                    # Get subject name for better error message
                    subject_name = subject.get("name", s_id)
                    class_name = getattr(class_group, "name", c_id)

                    # Log detailed diagnostic info
                    log.error("=== ASSIGNMENT ERROR: No valid teachers/rooms ===")
                    log.error(f"Class: '{class_name}' (ID: {c_id})")
                    log.error(f"Subject: '{subject_name}' (ID: {s_id})")
                    log.error(f"Allowed teachers found: {len(allowed_teachers)}")
                    log.error(f"Allowed rooms found: {len(allowed_rooms)}")

                    if not allowed_teachers:
                        # Find which teachers COULD teach this subject
                        all_teachers_for_subject = [
                            t.get("fullName", t.get("id"))
                            for t in self.data_dict["teachers"]
                            if s_id in t.get("primarySubjectIds", [])
                        ]
                        log.error(
                            f"Teachers with subject {s_id} in primarySubjectIds: {all_teachers_for_subject}"
                        )

                        # Check if there's a fixed assignment that's invalid
                        if domain_key in self.fixed_teacher_assignments:
                            fixed = self.fixed_teacher_assignments[domain_key]
                            log.error(
                                f"Fixed assignments for this class/subject: {fixed}"
                            )

                    # Build detailed error message
                    error_details = []
                    if not allowed_teachers:
                        error_details.append(f"Allowed teachers found: 0")
                    if not allowed_rooms:
                        required_room_type = subject.get("requiredRoomType", "any")
                        log.error(f"Subject requires room type: {required_room_type}")
                        log.error(
                            f"Subject min capacity: {subject.get('minRoomCapacity', 0)}"
                        )
                        log.error(f"Class student count: {class_group.studentCount}")
                        error_details.append(f"Allowed rooms found: 0")
                        if required_room_type and required_room_type != "any":
                            error_details.append(
                                f"requires room type: {required_room_type}"
                            )

                    raise RuntimeError(
                        f"No valid teachers or rooms for class '{class_name}' (ID: {c_id}), "
                        f"subject '{subject_name}' (ID: {s_id}). "
                        f"{' | '.join(error_details)}"
                    )

                allowed_starts = self._compute_allowed_starts(
                    c_idx, allowed_teachers, allowed_rooms, length
                )

                if not allowed_starts:
                    raise RuntimeError(
                        f"No valid time slots for class '{c_id}', subject '{s_id}'"
                    )

                self.allowed_domains[domain_key] = {
                    "teachers": allowed_teachers,
                    "rooms": allowed_rooms,
                    "starts": allowed_starts,
                }

            teacher_start_pairs = self._compute_resource_start_pairs(
                self.teacher_availability, allowed_teachers, allowed_starts, length
            )
            fixed_room_override = bool(getattr(class_group, "fixedRoomId", None))
            room_start_pairs = (
                [
                    [start, room_idx]
                    for start in allowed_starts
                    for room_idx in allowed_rooms
                ]
                if fixed_room_override
                else self._compute_resource_start_pairs(
                    self.room_availability, allowed_rooms, allowed_starts, length
                )
            )
            teacher_starts = {pair[0] for pair in teacher_start_pairs}
            room_starts = {pair[0] for pair in room_start_pairs}
            allowed_starts = [
                start
                for start in allowed_starts
                if start in teacher_starts and start in room_starts
            ]
            allowed_start_set = set(allowed_starts)
            teacher_start_pairs = [
                pair for pair in teacher_start_pairs if pair[0] in allowed_start_set
            ]
            room_start_pairs = [
                pair for pair in room_start_pairs if pair[0] in allowed_start_set
            ]
            allowed_teachers = sorted({pair[1] for pair in teacher_start_pairs})
            allowed_rooms = sorted({pair[1] for pair in room_start_pairs})

            if not allowed_starts or not allowed_teachers or not allowed_rooms:
                raise RuntimeError(
                    f"No full-duration teacher/room availability for class '{c_id}', "
                    f"subject '{s_id}'"
                )

            # Create variables
            start_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_starts), f"start_{r_idx}"
            )
            teacher_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_teachers), f"teacher_{r_idx}"
            )
            room_var = self.model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(allowed_rooms), f"room_{r_idx}"
            )

            self.start_vars.append(start_var)
            self.teacher_vars.append(teacher_var)
            self.room_vars.append(room_var)
            self.request_allowed_teachers.append(allowed_teachers)
            self.request_allowed_rooms.append(allowed_rooms)
            self.request_allowed_starts.append(allowed_starts)

            # The chosen teacher and room must each be available at every
            # offset of this request, not merely at its first period.
            self.model.AddAllowedAssignments(
                [start_var, teacher_var], teacher_start_pairs
            )
            self.model.AddAllowedAssignments([start_var, room_var], room_start_pairs)

            # Create class interval
            end_var = self.model.NewIntVar(0, self.num_slots, f"end_{r_idx}")
            self.model.Add(end_var == start_var + length)
            interval = self.model.NewIntervalVar(
                start_var, length, end_var, f"interval_{r_idx}"
            )
            self.class_intervals[c_idx].append(interval)

            # Singleton domains need neither a selector BoolVar nor an optional
            # interval. This is common for fixed teaching and homeroom assignments.
            if len(allowed_teachers) == 1:
                self._cache_fixed_assignment(r_idx, t_idx=allowed_teachers[0])
                self.teacher_intervals[allowed_teachers[0]].append(interval)
            else:
                for t_idx in allowed_teachers:
                    is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)
                    self.model.Add(teacher_var == t_idx).OnlyEnforceIf(is_assigned)
                    self.model.Add(teacher_var != t_idx).OnlyEnforceIf(is_assigned.Not())

                    t_end_var = self.model.NewIntVar(
                        0, self.num_slots, f"end_t_{r_idx}_{t_idx}"
                    )
                    self.model.Add(t_end_var == start_var + length)
                    opt_interval = self.model.NewOptionalIntervalVar(
                        start_var, length, t_end_var, is_assigned, f"opt_t_{r_idx}_{t_idx}"
                    )
                    self.teacher_intervals[t_idx].append(opt_interval)

            if len(allowed_rooms) == 1:
                self._cache_fixed_assignment(r_idx, rm_idx=allowed_rooms[0])
                self.room_intervals[allowed_rooms[0]].append(interval)
            else:
                for rm_idx in allowed_rooms:
                    is_assigned = self._get_or_create_is_assigned(r_idx, rm_idx=rm_idx)
                    self.model.Add(room_var == rm_idx).OnlyEnforceIf(is_assigned)
                    self.model.Add(room_var != rm_idx).OnlyEnforceIf(is_assigned.Not())

                    r_end_var = self.model.NewIntVar(
                        0, self.num_slots, f"end_r_{r_idx}_{rm_idx}"
                    )
                    self.model.Add(r_end_var == start_var + length)
                    opt_interval = self.model.NewOptionalIntervalVar(
                        start_var, length, r_end_var, is_assigned, f"opt_r_{r_idx}_{rm_idx}"
                    )
                    self.room_intervals[rm_idx].append(opt_interval)

        # Add fixed lesson intervals
        self._add_fixed_lesson_intervals()

        log.info(
            "Variables created",
            start_vars=len(self.start_vars),
            teacher_vars=len(self.teacher_vars),
            room_vars=len(self.room_vars),
        )

    def _add_fixed_lesson_intervals(self) -> None:
        """Add interval variables for fixed lessons."""
        if not self.data.fixedLessons:
            return

        for i, lesson in enumerate(self.data.fixedLessons):
            c_idx = self.class_map[lesson.classId]
            day_str = (
                lesson.day.value
                if isinstance(lesson.day, DayOfWeek)
                else str(lesson.day)
            )
            slot = self.day_map[day_str] * self.num_periods_per_day + lesson.periodIndex

            interval = self.model.NewFixedSizeIntervalVar(slot, 1, f"fixed_{i}")
            self.class_intervals[c_idx].append(interval)

            for teacher_id in lesson.teacherIds:
                t_idx = self.teacher_map[teacher_id]
                self.teacher_intervals[t_idx].append(interval)

            room_id = self._effective_fixed_lesson_room_id(lesson)
            if room_id:
                rm_idx = self.room_map.get(room_id)
                if rm_idx is not None:
                    self.room_intervals[rm_idx].append(interval)

    def _build_constraint_context(self) -> Dict[str, Any]:
        """Build the context dictionary for constraint application."""
        return {
            "data": self.data,
            "data_dict": self.data_dict,
            "requests": self.requests,
            "start_vars": self.start_vars,
            "teacher_vars": self.teacher_vars,
            "room_vars": self.room_vars,
            "class_intervals": dict(self.class_intervals),
            "teacher_intervals": dict(self.teacher_intervals),
            "room_intervals": dict(self.room_intervals),
            "class_map": self.class_map,
            "teacher_map": self.teacher_map,
            "subject_map": self.subject_map,
            "room_map": self.room_map,
            "day_map": self.day_map,
            "days": self.days,
            "num_days": self.num_days,
            "num_periods_per_day": self.num_periods_per_day,
            "num_slots": self.num_slots,
            "allowed_domains": self.allowed_domains,
            "teacher_availability": self.teacher_availability,
            "room_availability": self.room_availability,
            "class_blocked_slots": self.class_blocked_slots,
            "teacher_to_requests": dict(self.teacher_to_requests),
            "class_to_requests": dict(self.class_to_requests),
            "subject_to_requests": dict(self.subject_to_requests),
            "request_to_teachers": self.request_to_teachers,
            "periods_per_day_map": self.periods_per_day_map,
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
        penalties = self.registry.apply_all(
            self.model, context, ConstraintStage.IMPORTANT
        )
        all_penalties.extend(penalties)

        # Apply OPTIONAL soft constraints
        log.info("Applying OPTIONAL constraints...")
        penalties = self.registry.apply_all(
            self.model, context, ConstraintStage.OPTIONAL
        )
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
            c_id, s_id = req["class_id"], req["subject_id"]
            domain_key = (c_id, s_id)
            allowed_teachers = self.allowed_domains[domain_key]["teachers"]

            for t_idx in allowed_teachers:
                is_assigned = self._get_or_create_is_assigned(r_idx, t_idx=t_idx)

                for slot in range(self.num_slots):
                    if not self.teacher_availability[t_idx][slot]:
                        self.model.Add(self.start_vars[r_idx] != slot).OnlyEnforceIf(
                            is_assigned
                        )

        log.info("Hard constraints applied")

    def _get_teacher_slot_occupancy(self, teacher_idx: int, slot: int):
        """Return a Boolean indicating whether a generated lesson uses a teacher at a slot."""
        cache = getattr(self, "_teacher_slot_occupancy", None)
        if cache is None:
            cache = {}
            self._teacher_slot_occupancy = cache
        key = (teacher_idx, slot)
        if key in cache:
            return cache[key]

        day_idx, period_idx = divmod(slot, self.num_periods_per_day)
        teacher_id = self.data.teachers[teacher_idx].id
        for lesson in self.data.fixedLessons or []:
            lesson_day = lesson.day.value if hasattr(lesson.day, "value") else str(lesson.day)
            if (
                teacher_id in lesson.teacherIds
                and self.day_map.get(lesson_day) == day_idx
                and lesson.periodIndex == period_idx
            ):
                occupied = self.model.NewConstant(1)
                cache[key] = occupied
                return occupied

        covering = []
        for r_idx, req in enumerate(self.requests):
            if teacher_idx not in self.request_allowed_teachers[r_idx]:
                continue
            length = req["length"]
            teacher_selected = self._get_or_create_is_assigned(r_idx, t_idx=teacher_idx)
            for start in self.request_allowed_starts[r_idx]:
                if not (start <= slot < start + length):
                    continue
                start_cache = getattr(self, "_request_start_indicators", None)
                if start_cache is None:
                    start_cache = {}
                    self._request_start_indicators = start_cache
                start_key = (r_idx, start)
                at_start = start_cache.get(start_key)
                if at_start is None:
                    at_start = self.model.NewBoolVar(
                        f"request_{r_idx}_starts_{start}"
                    )
                    self.model.Add(self.start_vars[r_idx] == start).OnlyEnforceIf(at_start)
                    self.model.Add(self.start_vars[r_idx] != start).OnlyEnforceIf(at_start.Not())
                    start_cache[start_key] = at_start
                covers = self.model.NewBoolVar(
                    f"teacher_{teacher_idx}_request_{r_idx}_covers_{slot}_from_{start}"
                )
                self.model.AddBoolAnd([teacher_selected, at_start]).OnlyEnforceIf(covers)
                self.model.AddBoolOr([teacher_selected.Not(), at_start.Not()]).OnlyEnforceIf(
                    covers.Not()
                )
                covering.append(covers)

        occupied = self.model.NewBoolVar(f"teacher_{teacher_idx}_occupied_{slot}")
        if covering:
            self.model.AddMaxEquality(occupied, covering)
        else:
            self.model.Add(occupied == 0)
        cache[key] = occupied
        return occupied

    def _get_request_start_indicator(self, request_idx: int, start: int):
        cache = getattr(self, "_request_start_indicators", None)
        if cache is None:
            cache = {}
            self._request_start_indicators = cache
        key = (request_idx, start)
        indicator = cache.get(key)
        if indicator is None:
            indicator = self.model.NewBoolVar(f"request_{request_idx}_starts_{start}")
            self.model.Add(self.start_vars[request_idx] == start).OnlyEnforceIf(indicator)
            self.model.Add(self.start_vars[request_idx] != start).OnlyEnforceIf(indicator.Not())
            cache[key] = indicator
        return indicator

    def _get_class_subject_slot_occupancy(
        self, class_id: str, subject_id: Optional[str], slot: int
    ):
        """Return class or class-subject occupancy for a single solver slot."""
        cache = getattr(self, "_class_subject_slot_occupancy", None)
        if cache is None:
            cache = {}
            self._class_subject_slot_occupancy = cache
        key = (class_id, subject_id, slot)
        if key in cache:
            return cache[key]

        day_idx, period_idx = divmod(slot, self.num_periods_per_day)
        for lesson in self.data.fixedLessons or []:
            lesson_day = lesson.day.value if hasattr(lesson.day, "value") else str(lesson.day)
            if (
                lesson.classId == class_id
                and (subject_id is None or lesson.subjectId == subject_id)
                and self.day_map.get(lesson_day) == day_idx
                and lesson.periodIndex == period_idx
            ):
                occupied = self.model.NewConstant(1)
                cache[key] = occupied
                return occupied

        covering = []
        for request_idx in self.class_to_requests.get(class_id, []):
            request = self.requests[request_idx]
            if subject_id is not None and request["subject_id"] != subject_id:
                continue
            for start in self.request_allowed_starts[request_idx]:
                if start <= slot < start + request["length"]:
                    covering.append(self._get_request_start_indicator(request_idx, start))

        occupied = self.model.NewBoolVar(
            f"class_{class_id}_{subject_id or 'all'}_occupied_{slot}"
        )
        if covering:
            self.model.AddMaxEquality(occupied, covering)
        else:
            self.model.Add(occupied == 0)
        cache[key] = occupied
        return occupied

    def _build_gap_units(self, occupancies: List[Any], name: str):
        """Count empty usable positions strictly between first and last occupancy."""
        count = len(occupancies)
        if count < 3:
            return None
        occupied_count = self.model.NewIntVar(0, count, f"{name}_occupied_count")
        self.model.Add(occupied_count == sum(occupancies))
        has_lesson = self.model.NewBoolVar(f"{name}_has_lesson")
        self.model.AddMaxEquality(has_lesson, occupancies)

        first_candidates = []
        last_candidates = []
        for index, occupied in enumerate(occupancies):
            first = self.model.NewIntVar(0, count, f"{name}_first_candidate_{index}")
            self.model.Add(first == index).OnlyEnforceIf(occupied)
            self.model.Add(first == count).OnlyEnforceIf(occupied.Not())
            first_candidates.append(first)

            last = self.model.NewIntVar(-1, count - 1, f"{name}_last_candidate_{index}")
            self.model.Add(last == index).OnlyEnforceIf(occupied)
            self.model.Add(last == -1).OnlyEnforceIf(occupied.Not())
            last_candidates.append(last)

        first_occupied = self.model.NewIntVar(0, count, f"{name}_first")
        last_occupied = self.model.NewIntVar(-1, count - 1, f"{name}_last")
        self.model.AddMinEquality(first_occupied, first_candidates)
        self.model.AddMaxEquality(last_occupied, last_candidates)
        span = self.model.NewIntVar(0, count, f"{name}_span")
        self.model.Add(span == last_occupied - first_occupied + 1).OnlyEnforceIf(has_lesson)
        self.model.Add(span == 0).OnlyEnforceIf(has_lesson.Not())
        gaps = self.model.NewIntVar(0, count, f"{name}_gaps")
        self.model.Add(gaps == span - occupied_count)
        return gaps

    def _apply_schedule_shape_preference_constraints(self) -> List[Any]:
        """Apply all class/teacher/subject objectives exposed by the settings UI."""
        preferences = self.data.preferences
        if not preferences:
            return []
        penalties: List[Any] = []

        teacher_gap_weight = int(preferences.avoidTeacherGapsWeight * 100)
        teacher_balance_weight = int(preferences.balanceTeacherLoadWeight * 100)
        for teacher_idx, teacher in enumerate(self.data.teachers):
            available_day_loads = []
            for day_idx in range(self.num_days):
                day_start = day_idx * self.num_periods_per_day
                valid_periods = self._periods_for_day(day_idx)
                usable = [
                    self._get_teacher_slot_occupancy(teacher_idx, day_start + period)
                    for period in range(valid_periods)
                    if self.teacher_availability[teacher_idx][day_start + period]
                ]
                if not usable:
                    continue
                load = self.model.NewIntVar(0, len(usable), f"teacher_{teacher_idx}_load_{day_idx}")
                self.model.Add(load == sum(usable))
                available_day_loads.append(load)
                if teacher_gap_weight > 0:
                    gaps = self._build_gap_units(usable, f"teacher_{teacher_idx}_day_{day_idx}")
                    if gaps is not None:
                        penalties.append(teacher_gap_weight * gaps)

            if teacher_balance_weight > 0 and len(available_day_loads) > 1:
                maximum_total = len(available_day_loads) * self.num_periods_per_day
                total = self.model.NewIntVar(0, maximum_total, f"teacher_{teacher_idx}_weekly_load")
                self.model.Add(total == sum(available_day_loads))
                target = self.model.NewIntVar(0, self.num_periods_per_day, f"teacher_{teacher_idx}_daily_target")
                self.model.AddDivisionEquality(target, total, len(available_day_loads))
                for day_idx, load in enumerate(available_day_loads):
                    deviation = self.model.NewIntVar(
                        0, self.num_periods_per_day, f"teacher_{teacher_idx}_load_deviation_{day_idx}"
                    )
                    self.model.AddAbsEquality(deviation, load - target)
                    penalties.append(teacher_balance_weight * deviation)

        class_gap_weight = int(preferences.avoidClassGapsWeight * 100)
        spread_weight = int(preferences.subjectSpreadWeight * 100)
        difficult_distribution_weight = int(
            preferences.distributeDifficultSubjectsWeight * 100
        )
        difficult_subjects = {
            subject.id for subject in self.data.subjects if bool(subject.isDifficult)
        }
        for class_group in self.data.classes:
            class_idx = self.class_map[class_group.id]
            subject_ids = list(class_group.subjectRequirements.keys())
            for day_idx in range(self.num_days):
                day_start = day_idx * self.num_periods_per_day
                valid_periods = self._periods_for_day(day_idx)
                usable_slots = [
                    day_start + period
                    for period in range(valid_periods)
                    if not self.class_blocked_slots[class_idx][day_start + period]
                ]
                if class_gap_weight > 0:
                    occupancy = [
                        self._get_class_subject_slot_occupancy(class_group.id, None, slot)
                        for slot in usable_slots
                    ]
                    gaps = self._build_gap_units(occupancy, f"class_{class_group.id}_day_{day_idx}")
                    if gaps is not None:
                        penalties.append(class_gap_weight * gaps)

                difficult_used = []
                for subject_id in subject_ids:
                    occupancy = [
                        self._get_class_subject_slot_occupancy(class_group.id, subject_id, slot)
                        for slot in usable_slots
                    ]
                    if not occupancy:
                        continue
                    daily_count = self.model.NewIntVar(
                        0, len(occupancy), f"class_{class_group.id}_{subject_id}_count_{day_idx}"
                    )
                    self.model.Add(daily_count == sum(occupancy))
                    if spread_weight > 0:
                        excess = self.model.NewIntVar(
                            0, max(0, len(occupancy) - 1),
                            f"class_{class_group.id}_{subject_id}_spread_excess_{day_idx}",
                        )
                        self.model.Add(excess >= daily_count - 1)
                        penalties.append(spread_weight * excess)
                    if subject_id in difficult_subjects:
                        used = self.model.NewBoolVar(
                            f"class_{class_group.id}_{subject_id}_used_{day_idx}"
                        )
                        self.model.AddMaxEquality(used, occupancy)
                        difficult_used.append(used)

                if difficult_distribution_weight > 0 and len(difficult_used) > 1:
                    excess = self.model.NewIntVar(
                        0, len(difficult_used) - 1,
                        f"class_{class_group.id}_difficult_excess_{day_idx}",
                    )
                    self.model.Add(excess >= sum(difficult_used) - 1)
                    penalties.append(difficult_distribution_weight * excess)

        morning_weight = int(preferences.preferMorningForDifficultWeight * 100)
        if morning_weight > 0:
            for request_idx, request in enumerate(self.requests):
                if request["subject_id"] not in difficult_subjects:
                    continue
                rows = []
                for start in self.request_allowed_starts[request_idx]:
                    day_idx, period_idx = divmod(start, self.num_periods_per_day)
                    cutoff = max(1, (self._periods_for_day(day_idx) + 1) // 2)
                    rows.append([start, int(period_idx >= cutoff)])
                late = self.model.NewBoolVar(f"difficult_subject_late_{request_idx}")
                self.model.AddAllowedAssignments([self.start_vars[request_idx], late], rows)
                penalties.append(morning_weight * late)

        log.info("Schedule shape preferences applied", num_penalties=len(penalties))
        return penalties

    def _apply_teacher_workload_constraints(self) -> None:
        """Enforce the teacher's contractual weekly workload limit."""
        for teacher_idx, teacher in enumerate(self.data.teachers):
            assignments = []
            for r_idx, req in enumerate(self.requests):
                if teacher_idx in self.request_allowed_teachers[r_idx]:
                    assignments.append(
                        req["length"]
                        * self._get_or_create_is_assigned(r_idx, t_idx=teacher_idx)
                    )

            fixed_weekly = sum(
                1
                for lesson in (self.data.fixedLessons or [])
                if teacher.id in lesson.teacherIds
            )
            self.model.Add(sum(assignments) + fixed_weekly <= teacher.maxPeriodsPerWeek)

        log.info("Teacher workload constraints applied")

    def _apply_teacher_assignment_constraints(self) -> List[Any]:
        """Enforce every canonical manual teacher allocation as a hard lock."""
        penalties = []

        requests_by_pair = collections.defaultdict(list)
        for r_idx, request in enumerate(self.requests):
            requests_by_pair[(request["class_id"], request["subject_id"])].append(r_idx)

        for pair, configured in self.fixed_teacher_assignments.items():
            request_indices = requests_by_pair.get(pair, [])
            total_periods = sum(self.requests[index]["length"] for index in request_indices)
            fixed_lessons_by_teacher = collections.Counter(
                self.teacher_map[teacher_id]
                for lesson in (self.data.fixedLessons or [])
                if lesson.classId == pair[0] and lesson.subjectId == pair[1]
                for teacher_id in lesson.teacherIds
                if teacher_id in self.teacher_map
            )
            generated_targets = {
                row["teacher_idx"]: max(
                    0,
                    row["periods"] - fixed_lessons_by_teacher[row["teacher_idx"]],
                )
                for row in configured
            }
            fixed_total = sum(generated_targets.values())
            if fixed_total > total_periods:
                raise RuntimeError(
                    f"Fixed teacher periods exceed requirement | class={pair[0]} "
                    f"subject={pair[1]} fixed={fixed_total} available={total_periods}"
                )

            for row in configured:
                teacher_idx = row["teacher_idx"]
                assigned_terms = [
                    self.requests[index]["length"]
                    * self._get_or_create_is_assigned(index, t_idx=teacher_idx)
                    for index in request_indices
                    if teacher_idx in self.request_allowed_teachers[index]
                ]
                assigned = sum(assigned_terms) if assigned_terms else 0
                target_periods = generated_targets[teacher_idx]
                self.model.Add(assigned == target_periods)

        return penalties

    def _apply_teacher_preference_constraints(self) -> List[Any]:
        """Apply time and preferred-colleague objectives."""
        prefs = self.data.preferences
        if not prefs:
            return []
        penalties = []
        time_weight = int(getattr(prefs, "respectTeacherTimePreferenceWeight", 0.5) * 100)
        if time_weight > 0:
            for r_idx, req in enumerate(self.requests):
                rows = []
                for teacher_idx in self.request_allowed_teachers[r_idx]:
                    preference = getattr(self.data.teachers[teacher_idx], "timePreference", None)
                    preference = preference.value if hasattr(preference, "value") else preference
                    preference = str(preference or "none").lower()
                    for start in self.request_allowed_starts[r_idx]:
                        period = start % self.num_periods_per_day
                        day_idx = start // self.num_periods_per_day
                        cutoff = max(1, (self._periods_for_day(day_idx) + 1) // 2)
                        violates = int(
                            (preference == "morning" and period >= cutoff)
                            or (preference == "afternoon" and period < cutoff)
                        )
                        rows.append([teacher_idx, start, violates])
                if rows and any(row[2] for row in rows):
                    violation = self.model.NewBoolVar(f"teacher_time_preference_{r_idx}")
                    self.model.AddAllowedAssignments(
                        [self.teacher_vars[r_idx], self.start_vars[r_idx], violation], rows
                    )
                    penalties.append(time_weight * violation)

        colleague_weight = int(getattr(prefs, "respectPreferredColleaguesWeight", 0.3) * 100)
        if colleague_weight > 0:
            pairs = set()
            for teacher_idx, teacher in enumerate(self.data.teachers):
                for colleague_id in getattr(teacher, "preferredColleagues", None) or []:
                    colleague_idx = self.teacher_map.get(str(colleague_id))
                    if colleague_idx is not None and colleague_idx != teacher_idx:
                        pairs.add(tuple(sorted((teacher_idx, colleague_idx))))
            for left, right in pairs:
                for slot in range(self.num_slots):
                    if not (
                        self.teacher_availability[left][slot]
                        and self.teacher_availability[right][slot]
                    ):
                        continue
                    left_busy = self._get_teacher_slot_occupancy(left, slot)
                    right_busy = self._get_teacher_slot_occupancy(right, slot)
                    mismatch = self.model.NewBoolVar(
                        f"preferred_colleagues_{left}_{right}_mismatch_{slot}"
                    )
                    self.model.Add(left_busy != right_busy).OnlyEnforceIf(mismatch)
                    self.model.Add(left_busy == right_busy).OnlyEnforceIf(mismatch.Not())
                    penalties.append(colleague_weight * mismatch)
        return penalties

    def _apply_room_preference_constraints(self) -> List[Any]:
        """Build room-related soft objectives using the selected resources."""
        prefs = self.data.preferences
        if not prefs or not self.requests:
            return []

        penalties: List[Any] = []

        home_weight = int(getattr(prefs, "preferClassHomeRoomWeight", 2.0) * 100)
        desired_weight = int(
            getattr(prefs, "respectSubjectDesiredFeaturesWeight", 0.5) * 100
        )
        teacher_room_weight = int(
            getattr(prefs, "respectTeacherRoomPreferenceWeight", 0.5) * 100
        )

        for r_idx, req in enumerate(self.requests):
            class_group = self.data.classes[self.class_map[req["class_id"]]]
            if getattr(class_group, "fixedRoomId", None):
                continue

            subject = self.data_dict["subjects"][self.subject_map[req["subject_id"]]]
            allowed_teachers = self.request_allowed_teachers[r_idx]
            allowed_rooms = self.request_allowed_rooms[r_idx]

            # A fixed room remains a hard constraint. A compatible home room is
            # a strong preference and never removes alternative room choices.
            home_room_id = getattr(class_group, "homeRoomId", None)
            fixed_room_id = getattr(class_group, "fixedRoomId", None)
            home_room_idx = self.room_map.get(home_room_id) if home_room_id else None
            if (
                home_weight > 0
                and not fixed_room_id
                and home_room_idx is not None
                and home_room_idx in allowed_rooms
            ):
                outside_home = self.model.NewBoolVar(f"outside_home_room_{r_idx}")
                self.model.Add(self.room_vars[r_idx] != home_room_idx).OnlyEnforceIf(
                    outside_home
                )
                self.model.Add(self.room_vars[r_idx] == home_room_idx).OnlyEnforceIf(
                    outside_home.Not()
                )
                penalties.append(home_weight * outside_home)

            desired_features = set(subject.get("desiredFeatures") or [])
            if desired_weight > 0 and desired_features:
                missing_by_room = [
                    len(
                        desired_features
                        - set(room.get("features") or [])
                    )
                    for room in self.data_dict["rooms"]
                ]
                max_missing = len(desired_features)
                if max_missing > 0 and any(missing_by_room[idx] for idx in allowed_rooms):
                    missing_count = self.model.NewIntVar(
                        0, max_missing, f"desired_features_missing_{r_idx}"
                    )
                    self.model.AddElement(
                        self.room_vars[r_idx], missing_by_room, missing_count
                    )
                    penalties.append(desired_weight * missing_count)

            if teacher_room_weight > 0:
                preference_rows = []
                has_explicit_preference = False
                for teacher_idx in allowed_teachers:
                    preferred_ids = {
                        str(value)
                        for value in (
                            self.data_dict["teachers"][teacher_idx].get(
                                "preferredRoomIds"
                            )
                            or []
                        )
                    }
                    has_explicit_preference = has_explicit_preference or bool(preferred_ids)
                    for room_idx in allowed_rooms:
                        room_id = str(self.data.rooms[room_idx].id)
                        penalty_value = int(
                            bool(preferred_ids) and room_id not in preferred_ids
                        )
                        preference_rows.append(
                            [teacher_idx, room_idx, penalty_value]
                        )

                if has_explicit_preference:
                    outside_preference = self.model.NewBoolVar(
                        f"outside_teacher_room_preference_{r_idx}"
                    )
                    self.model.AddAllowedAssignments(
                        [
                            self.teacher_vars[r_idx],
                            self.room_vars[r_idx],
                            outside_preference,
                        ],
                        preference_rows,
                    )
                    penalties.append(teacher_room_weight * outside_preference)

        room_change_weight = int(
            getattr(prefs, "minimizeRoomChangesWeight", 0.5) * 100
        )
        if room_change_weight > 0:
            fixed_rooms_by_class = collections.defaultdict(set)
            for lesson in self.data.fixedLessons or []:
                room_id = self._effective_fixed_lesson_room_id(lesson)
                if room_id in self.room_map:
                    fixed_rooms_by_class[lesson.classId].add(
                        self.room_map[room_id]
                    )

            for class_id, request_indices in self.class_to_requests.items():
                class_group = self.data.classes[self.class_map[class_id]]
                if getattr(class_group, "fixedRoomId", None):
                    continue

                fixed_room_indices = fixed_rooms_by_class.get(class_id, set())
                candidate_rooms = set(fixed_room_indices)
                for r_idx in request_indices:
                    candidate_rooms.update(self.request_allowed_rooms[r_idx])

                used_vars = []
                fixed_count = len(fixed_room_indices)
                for room_idx in sorted(candidate_rooms - fixed_room_indices):
                    assignments = [
                        self._get_or_create_is_assigned(r_idx, rm_idx=room_idx)
                        for r_idx in request_indices
                        if room_idx in self.request_allowed_rooms[r_idx]
                    ]
                    if not assignments:
                        continue
                    room_used = self.model.NewBoolVar(
                        f"class_{class_id}_uses_room_{room_idx}"
                    )
                    self.model.AddMaxEquality(room_used, assignments)
                    used_vars.append(room_used)

                max_extra = fixed_count + len(used_vars) - 1
                if max_extra > 0:
                    extra_rooms = self.model.NewIntVar(
                        0, max_extra, f"class_{class_id}_extra_distinct_rooms"
                    )
                    self.model.Add(
                        extra_rooms == fixed_count + sum(used_vars) - 1
                    )
                    penalties.append(room_change_weight * extra_rooms)

        log.info("Room preference constraints applied", num_penalties=len(penalties))
        return penalties

    def _apply_initial_solution_hints(self) -> int:
        """Warm-start improvement runs from the accepted timetable."""
        initial = self.data.config.initialSolution or []
        if not initial:
            return 0

        grouped: Dict[tuple, List[Dict[str, Any]]] = collections.defaultdict(list)
        for lesson in initial:
            if not isinstance(lesson, dict):
                continue
            grouped[(lesson.get("classId"), lesson.get("subjectId"))].append(lesson)
        for lessons in grouped.values():
            lessons.sort(key=lambda row: (self.day_map.get(str(row.get("day")), 999), row.get("periodIndex", 999)))

        hinted = 0
        offsets: Dict[tuple, int] = collections.defaultdict(int)
        for r_idx, request in enumerate(self.requests):
            key = (request["class_id"], request["subject_id"])
            candidates = grouped.get(key, [])
            offset = offsets[key]
            if offset >= len(candidates):
                continue
            lesson = candidates[offset]
            offsets[key] += max(1, request["length"])
            day_idx = self.day_map.get(str(lesson.get("day")))
            period_idx = lesson.get("periodIndex")
            if day_idx is None or not isinstance(period_idx, int):
                continue
            start = day_idx * self.num_periods_per_day + period_idx
            if start in self.request_allowed_starts[r_idx]:
                self.model.AddHint(self.start_vars[r_idx], start)
                hinted += 1
            teacher_ids = lesson.get("teacherIds") or []
            teacher_idx = self.teacher_map.get(teacher_ids[0]) if teacher_ids else None
            if teacher_idx in self.request_allowed_teachers[r_idx]:
                self.model.AddHint(self.teacher_vars[r_idx], teacher_idx)
            room_idx = self.room_map.get(lesson.get("roomId"))
            if room_idx in self.request_allowed_rooms[r_idx]:
                self.model.AddHint(self.room_vars[r_idx], room_idx)
        log.info("Initial solution hints applied", hinted_requests=hinted)
        return hinted

    def _build_solution(self, value_provider: Optional[Any] = None) -> List[Dict]:
        """Build solution from solver values."""
        values = value_provider or self.solver
        solution = []
        rev_maps = {
            "teacher": {v: k for k, v in self.teacher_map.items()},
            "room": {v: k for k, v in self.room_map.items()},
        }

        for r_idx, req in enumerate(self.requests):
            start = values.Value(self.start_vars[r_idx])
            teacher_idx = values.Value(self.teacher_vars[r_idx])
            room_idx = values.Value(self.room_vars[r_idx])

            for offset in range(req["length"]):
                slot = start + offset
                day_idx, period_idx = divmod(slot, self.num_periods_per_day)
                day_str = self.days[day_idx]

                lesson_data = {
                    "day": day_str,
                    "periodIndex": period_idx,
                    "classId": req["class_id"],
                    "subjectId": req["subject_id"],
                    "teacherIds": [rev_maps["teacher"][teacher_idx]],
                    "roomId": rev_maps["room"][room_idx],
                    "isFixed": any(
                        row["teacher_idx"] == teacher_idx
                        for row in self.fixed_teacher_assignments.get(
                            (req["class_id"], req["subject_id"]), []
                        )
                    ),
                }

                lesson_data["periodsThisDay"] = get_periods_for_class_day(
                    self.data.config,
                    next(
                        (
                            class_group.category
                            for class_group in self.data.classes
                            if class_group.id == req["class_id"]
                        ),
                        None,
                    ),
                    day_str,
                    self.periods_per_day_map,
                    self.num_periods_per_day,
                )

                solution.append(lesson_data)

        # Add fixed lessons
        for lesson in self.data.fixedLessons or []:
            day_str = (
                lesson.day.value
                if isinstance(lesson.day, DayOfWeek)
                else str(lesson.day)
            )
            room_id = self._effective_fixed_lesson_room_id(lesson)
            solution.append(
                {
                    "day": day_str,
                    "periodIndex": lesson.periodIndex,
                    "classId": lesson.classId,
                    "subjectId": lesson.subjectId,
                    "teacherIds": lesson.teacherIds,
                    "roomId": room_id,
                    "isFixed": True,
                    "periodsThisDay": get_periods_for_class_day(
                        self.data.config,
                        next(
                            (
                                class_group.category
                                for class_group in self.data.classes
                                if class_group.id == lesson.classId
                            ),
                            None,
                        ),
                        day_str,
                        self.periods_per_day_map,
                        self.num_periods_per_day,
                    ),
                }
            )

        solution.sort(
            key=lambda x: (self.day_map[x["day"]], x["periodIndex"], x["classId"])
        )
        return solution

    def _build_fixed_lessons_only(self) -> List[Dict]:
        """Return only fixed lessons when no complete solution found."""
        solution = []
        for lesson in self.data.fixedLessons or []:
            day_str = (
                lesson.day.value
                if isinstance(lesson.day, DayOfWeek)
                else str(lesson.day)
            )
            room_id = self._effective_fixed_lesson_room_id(lesson)
            solution.append(
                {
                    "day": day_str,
                    "periodIndex": lesson.periodIndex,
                    "classId": lesson.classId,
                    "subjectId": lesson.subjectId,
                    "teacherIds": lesson.teacherIds,
                    "roomId": room_id,
                    "isFixed": True,
                }
            )
        return solution

    def _get_afghanistan_metadata(self) -> Dict[str, Any]:
        """Get Afghanistan-specific metadata for response.

        Returns metadata about low-resource mode settings.

        Requirements: 4.4
        """
        metadata = {}

        # Add low-resource mode metadata
        if hasattr(self, "_low_resource_handler"):
            low_resource_meta = self._low_resource_handler.get_metadata()
            metadata["low_resource_mode"] = low_resource_meta.get(
                "lowResourceMode", False
            )
            metadata["max_workers"] = low_resource_meta.get("maxWorkers")
            metadata["max_memory_mb"] = low_resource_meta.get("maxMemoryMb")

        return metadata

    def solve(
        self,
        time_limit_seconds: int = 600,
        enable_graceful_degradation: bool = True,
        optimization_level: int = 2,
        use_registry: bool = True,
        user_strategy: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Solve the timetabling problem and return a SolverResponse.

        This method integrates all feedback modules:
        - ProgressReporter: Real-time progress updates (Requirements: 5.1, 5.2, 5.3)
        - StrategySelector: Auto-select strategy based on problem size (Requirements: 6.1-6.5)
        - QualityScorer: Calculate quality metrics for successful solves (Requirements: 4.1, 4.5)
        - error_builder: Standardized error handling (Requirements: 1.5, 2.1-2.6, 7.5)

        Args:
            time_limit_seconds: Maximum time to spend solving.
            enable_graceful_degradation: Whether to return partial solutions.
            optimization_level: 0=fastest, 1=balanced, 2=thorough (used if user_strategy not provided).
            use_registry: Whether to use ConstraintRegistry for constraints.
            user_strategy: Optional user-specified strategy ("fast", "balanced", "thorough").

        Returns:
            SolverResponse dict with status, data, errors, warnings, quality_score, and metadata.
        """
        start_time = time.time()

        # Initialize progress reporter (Requirements: 5.1, 5.2, 5.3)
        progress = ProgressReporter()

        # Initialize response components
        errors: List[SolverErrorDetail] = []
        warnings: List[SolverErrorDetail] = []
        quality_score = None
        strategy_metadata = {}

        try:
            # Report validation stage
            progress.report_stage(SolveStage.VALIDATION, 0.0)

            # Use configuration values if provided
            cfg = self.data.config
            if hasattr(cfg, "solverTimeLimitSeconds") and cfg.solverTimeLimitSeconds:
                time_limit_seconds = cfg.solverTimeLimitSeconds
            if (
                hasattr(cfg, "solverOptimizationLevel")
                and cfg.solverOptimizationLevel is not None
            ):
                optimization_level = cfg.solverOptimizationLevel
            if (
                hasattr(cfg, "enableGracefulDegradation")
                and cfg.enableGracefulDegradation is not None
            ):
                enable_graceful_degradation = cfg.enableGracefulDegradation

            # Strategy selection (Requirements: 6.1, 6.2, 6.3, 6.4, 6.5)
            strategy_selector = StrategySelector(self.data)
            strategy_metadata = strategy_selector.select(user_strategy)

            log.info(
                "Starting solve process...",
                time_limit=time_limit_seconds,
                num_requests=self.num_requests,
                strategy=strategy_metadata["strategy_selected"],
            )

            # Map strategy name to optimization level
            strategy_to_level = {"fast": 0, "balanced": 1, "thorough": 2}
            if not user_strategy:
                # Use auto-selected strategy
                optimization_level = strategy_to_level.get(
                    strategy_metadata["strategy_selected"], optimization_level
                )
            elif user_strategy in strategy_to_level:
                optimization_level = strategy_to_level[user_strategy]

            progress.report_stage(SolveStage.VALIDATION, 1.0)

            if not self.requests and not self.data.fixedLessons:
                # Empty input - return success with empty schedule
                solve_time = time.time() - start_time
                afghanistan_metadata = self._get_afghanistan_metadata()
                return SolverResponse(
                    status=ResponseStatus.SUCCESS,
                    data={"schedule": [], "metadata": {}, "statistics": {}},
                    errors=[],
                    warnings=[],
                    quality_score=None,
                    metadata=SolverResponseMetadata(
                        solve_time_seconds=solve_time,
                        **strategy_metadata,
                        **afghanistan_metadata,
                    ),
                ).model_dump()

            # Report model building stage
            progress.report_stage(SolveStage.MODEL_BUILDING, 0.0)

            # Select strategy
            available_strategies = {
                0: FastStrategy(),
                1: BalancedStrategy(),
                2: ThoroughStrategy(),
            }
            selected_strategy = available_strategies[optimization_level]

            # Create variables
            self._create_variables()
            progress.report_stage(SolveStage.MODEL_BUILDING, 0.5)

            # Build request mappings
            self._build_request_mappings()

            # Calculate model complexity
            model_complexity = 0
            if self.num_requests > 0 and self.allowed_domains:
                total_allowed_teachers = sum(
                    len(d["teachers"]) for d in self.allowed_domains.values()
                )
                total_allowed_rooms = sum(
                    len(d["rooms"]) for d in self.allowed_domains.values()
                )
                avg_teachers = total_allowed_teachers / len(self.allowed_domains)
                avg_rooms = total_allowed_rooms / len(self.allowed_domains)
                model_complexity = self.num_requests * avg_teachers * avg_rooms

                log.info(
                    "Model complexity calculated",
                    model_complexity=int(model_complexity),
                    avg_teachers=f"{avg_teachers:.1f}",
                    avg_rooms=f"{avg_rooms:.1f}",
                )

                # Check complexity limit
                if model_complexity > 500000:
                    error = build_error(
                        ErrorCode.INTERNAL_ERROR,
                        {
                            "debug": {
                                "model_complexity": int(model_complexity),
                                "limit": 500000,
                            }
                        },
                    )
                    solve_time = time.time() - start_time
                    afghanistan_metadata = self._get_afghanistan_metadata()
                    return SolverResponse(
                        status=ResponseStatus.FAILED,
                        data=None,
                        errors=[error],
                        warnings=[],
                        quality_score=None,
                        metadata=SolverResponseMetadata(
                            solve_time_seconds=solve_time,
                            **strategy_metadata,
                            **afghanistan_metadata,
                        ),
                    ).model_dump()

            progress.report_stage(SolveStage.MODEL_BUILDING, 1.0)

            # Apply constraints
            progress.report_stage(SolveStage.SOLVING_PHASE_1, 0.0)

            penalties = []
            if use_registry:
                penalties = self._apply_constraints_via_registry()
            else:
                self._apply_hard_constraints()

            self._apply_teacher_workload_constraints()
            penalties.extend(self._apply_teacher_assignment_constraints())
            penalties.extend(self._apply_schedule_shape_preference_constraints())
            penalties.extend(self._apply_teacher_preference_constraints())
            penalties.extend(self._apply_room_preference_constraints())

            # Set objective if we have penalties
            if penalties:
                self.model.Minimize(sum(penalties))
                log.info("Objective set", num_penalties=len(penalties))

            self._apply_initial_solution_hints()
            model_proto = self.model.Proto()
            model_variables = len(model_proto.variables)
            model_constraints = len(model_proto.constraints)

            # Configure solver
            self.solver = cp_model.CpSolver()
            problem_size = {
                "num_requests": self.num_requests,
                "num_teachers": len(self.data.teachers),
                "num_classes": len(self.data.classes),
                "avg_teachers": (
                    sum(len(values) for values in self.request_allowed_teachers)
                    / max(1, len(self.request_allowed_teachers))
                ),
            }
            solver_params = selected_strategy.get_solver_parameters(
                time_limit_seconds, problem_size
            )

            configured_workers = max(1, int(cfg.solverWorkers))
            solver_mode = cfg.solverMode
            if solver_mode == "quick":
                solver_params["max_time_in_seconds"] = min(
                    time_limit_seconds, cfg.solverQuickTimeLimitSeconds
                )
            solver_params["num_search_workers"] = configured_workers
            solver_params["max_memory_in_mb"] = int(cfg.solverMemoryLimitMb)

            for param_name, param_value in solver_params.items():
                if hasattr(self.solver.parameters, param_name):
                    setattr(self.solver.parameters, param_name, param_value)

            # Apply low-resource mode settings if enabled
            # Requirements: 4.1, 4.2, 4.3, 4.4
            if (
                hasattr(self, "_low_resource_handler")
                and self._low_resource_handler.enabled
            ):
                self._low_resource_handler.configure_solver(self.solver)
                log.info(
                    "Low-resource mode applied to solver",
                    max_workers=LOW_RESOURCE_MAX_WORKERS,
                    max_memory_mb=LOW_RESOURCE_MAX_MEMORY_MB,
                )

            log.info(
                f"Solver configured with {selected_strategy.name} strategy",
                mode=solver_mode,
                workers=configured_workers,
                first_phase_seconds=solver_params.get("max_time_in_seconds"),
                model_variables=model_variables,
                model_constraints=model_constraints,
            )

            progress.report_stage(SolveStage.SOLVING_PHASE_1, 0.5)

            control_stop = threading.Event()
            cancellation_seen = threading.Event()
            peak_memory_mb = 0.0

            def watch_for_cancellation() -> None:
                nonlocal peak_memory_mb
                control_file = cfg.runtimeControlFile
                while not control_stop.wait(0.25):
                    if psutil is not None:
                        try:
                            rss_mb = psutil.Process(os.getpid()).memory_info().rss / 1024 / 1024
                            peak_memory_mb = max(peak_memory_mb, rss_mb)
                        except (OSError, psutil.Error):
                            pass
                    if not control_file or not os.path.exists(control_file):
                        continue
                    try:
                        with open(control_file, "r", encoding="utf-8") as handle:
                            requested = bool(json.load(handle).get("cancel"))
                    except (OSError, ValueError, AttributeError):
                        requested = False
                    if requested:
                        cancellation_seen.set()
                        self.solver.StopSearch()
                        return

            watcher = threading.Thread(target=watch_for_cancellation, daemon=True)
            watcher.start()
            callback = _IncumbentCallback(
                self,
                cfg.incumbentFile,
                stop_after_first=solver_mode == "quick",
            )
            try:
                status = self.solver.Solve(self.model, callback)

                # Quick mode first uses a short feasibility budget. Only when no
                # valid incumbent exists do we spend the remaining hard budget.
                if (
                    solver_mode == "quick"
                    and status not in (cp_model.OPTIMAL, cp_model.FEASIBLE, cp_model.INFEASIBLE)
                    and not cancellation_seen.is_set()
                ):
                    fallback_seconds = max(
                        1,
                        cfg.solverFallbackTimeLimitSeconds
                        - cfg.solverQuickTimeLimitSeconds,
                    )
                    log.info(
                        "Quick phase found no incumbent; starting feasibility fallback",
                        fallback_seconds=fallback_seconds,
                    )
                    self.solver = cp_model.CpSolver()
                    solver_params["max_time_in_seconds"] = fallback_seconds
                    for param_name, param_value in solver_params.items():
                        if hasattr(self.solver.parameters, param_name):
                            setattr(self.solver.parameters, param_name, param_value)
                    callback = _IncumbentCallback(
                        self, cfg.incumbentFile, stop_after_first=True
                    )
                    status = self.solver.Solve(self.model, callback)
            finally:
                control_stop.set()
                watcher.join(timeout=1.0)

            progress.report_stage(SolveStage.SOLVING_PHASE_2, 1.0)

            log.info(
                "Solve finished",
                status=self.solver.StatusName(status),
                wall_time=f"{self.solver.WallTime():.2f}s",
            )

            # Report formatting stage
            progress.report_stage(SolveStage.FORMATTING, 0.0)

            solve_time = time.time() - start_time

            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                solution = self._build_solution()
                log.info(f"Built solution with {len(solution)} lessons")

                enhanced_data = enhance_solution_with_metadata(solution, self.data)
                log.info("Enhanced solution with metadata")

                # Calculate quality score (Requirements: 4.1, 4.5)
                from models.output import ScheduledLesson

                scheduled_lessons = [ScheduledLesson(**lesson) for lesson in solution]
                log.info(f"Created {len(scheduled_lessons)} ScheduledLesson objects")

                scorer = QualityScorer(scheduled_lessons, self.data)
                quality_score = scorer.calculate()
                preference_revision = (
                    self.data.meta.optimizationPreferencesRevision
                    if self.data.meta else None
                )
                enhanced_data.setdefault("metadata", {})["optimization"] = {
                    "preferencesRevision": preference_revision,
                    "effectivePreferences": (
                        self.data.preferences.model_dump()
                        if self.data.preferences else {}
                    ),
                    "qualityScore": quality_score.model_dump(),
                }
                enhanced_data.setdefault("statistics", {})["qualityScore"] = (
                    quality_score.overall
                )
                log.info(
                    f"Calculated quality score: {quality_score.overall if quality_score else 'None'}"
                )

                progress.report_stage(SolveStage.FORMATTING, 1.0)

                afghanistan_metadata = self._get_afghanistan_metadata()
                objective_value = float(self.solver.ObjectiveValue())
                best_bound = float(self.solver.BestObjectiveBound())
                relative_gap = abs(objective_value - best_bound) / max(
                    1.0, abs(objective_value)
                )
                log.info("Got Afghanistan metadata")

                log.info("Creating SolverResponse object...")
                response_obj = SolverResponse(
                    status=ResponseStatus.SUCCESS,
                    data=enhanced_data,
                    errors=[],
                    warnings=warnings,
                    quality_score=quality_score,
                    metadata=SolverResponseMetadata(
                        solve_time_seconds=solve_time,
                        optimization_preferences_revision=preference_revision,
                        enabled_objectives=[
                            result.key for result in quality_score.objective_results
                        ],
                        objective_value=objective_value,
                        best_bound=best_bound,
                        relative_gap=relative_gap,
                        time_to_first_feasible_seconds=callback.first_solution_seconds,
                        solution_count=callback.solution_count,
                        workers=configured_workers,
                        interrupted=cancellation_seen.is_set(),
                        model_variables=model_variables,
                        model_constraints=model_constraints,
                        peak_memory_mb=peak_memory_mb or None,
                        **strategy_metadata,
                        **afghanistan_metadata,
                    ),
                )
                log.info("SolverResponse object created, calling model_dump()...")
                result = response_obj.model_dump()
                log.info(f"model_dump() completed, result has {len(result)} keys")
                return result

            elif enable_graceful_degradation and status == cp_model.INFEASIBLE:
                log.info("Returning fixed lessons only (graceful degradation)")
                partial = self._build_fixed_lessons_only()
                enhanced_data = enhance_solution_with_metadata(partial, self.data)

                # Add warning about partial solution
                warning = build_error(ErrorCode.NO_FEASIBLE_SOLUTION, {})
                warning.severity = "warning"
                warnings.append(warning)

                progress.report_stage(SolveStage.FORMATTING, 1.0)

                afghanistan_metadata = self._get_afghanistan_metadata()
                return SolverResponse(
                    status=ResponseStatus.PARTIAL,
                    data=enhanced_data,
                    errors=[],
                    warnings=warnings,
                    quality_score=None,
                    metadata=SolverResponseMetadata(
                        solve_time_seconds=solve_time,
                        **strategy_metadata,
                        **afghanistan_metadata,
                    ),
                ).model_dump()

            elif status == cp_model.INFEASIBLE:
                # Build NO_FEASIBLE_SOLUTION error (Requirements: 2.6)
                error = build_error(ErrorCode.NO_FEASIBLE_SOLUTION, {})

                progress.report_stage(SolveStage.FORMATTING, 1.0)

                afghanistan_metadata = self._get_afghanistan_metadata()
                return SolverResponse(
                    status=ResponseStatus.FAILED,
                    data=None,
                    errors=[error],
                    warnings=[],
                    quality_score=None,
                    metadata=SolverResponseMetadata(
                        solve_time_seconds=solve_time,
                        **strategy_metadata,
                        **afghanistan_metadata,
                    ),
                ).model_dump()

            else:
                # Solver timeout or unknown status
                error = build_error(
                    ErrorCode.SOLVER_TIMEOUT, {"timeoutSeconds": time_limit_seconds}
                )

                progress.report_stage(SolveStage.FORMATTING, 1.0)

                afghanistan_metadata = self._get_afghanistan_metadata()
                return SolverResponse(
                    status=ResponseStatus.FAILED,
                    data=None,
                    errors=[error],
                    warnings=[],
                    quality_score=None,
                    metadata=SolverResponseMetadata(
                        solve_time_seconds=solve_time,
                        **strategy_metadata,
                        **afghanistan_metadata,
                    ),
                ).model_dump()

        except RuntimeError as e:
            # Handle known runtime errors (e.g., no valid teachers/rooms)
            error_msg = str(e)
            log.error("Runtime error during solving", error=error_msg)

            solve_time = time.time() - start_time

            # Try to determine specific error type from message
            if "no valid teachers" in error_msg.lower():
                # Extract class and subject info if possible
                error = build_internal_error(e)
            elif "no valid time slots" in error_msg.lower():
                error = build_internal_error(e)
            else:
                error = build_internal_error(e)

            afghanistan_metadata = self._get_afghanistan_metadata()
            return SolverResponse(
                status=ResponseStatus.FAILED,
                data=None,
                errors=[error],
                warnings=[],
                quality_score=None,
                metadata=SolverResponseMetadata(
                    solve_time_seconds=solve_time,
                    **strategy_metadata,
                    **afghanistan_metadata,
                ),
            ).model_dump()

        except Exception as e:
            # Handle unknown exceptions (Requirements: 7.5)
            log.error("Unexpected error during solving", error=str(e), exc_info=True)

            solve_time = time.time() - start_time
            error = build_internal_error(e)

            afghanistan_metadata = self._get_afghanistan_metadata()
            return SolverResponse(
                status=ResponseStatus.FAILED,
                data=None,
                errors=[error],
                warnings=[],
                quality_score=None,
                metadata=SolverResponseMetadata(
                    solve_time_seconds=solve_time,
                    **strategy_metadata,
                    **afghanistan_metadata,
                ),
            ).model_dump()


# Helper function for metadata enhancement (re-exported from solution_builder)
def enhance_solution_with_metadata(
    solution: List[Dict], data: TimetableData
) -> Dict[str, Any]:
    """Enhance solution with comprehensive metadata for UI integration."""
    from .solution_builder import (
        SolutionBuilder,
        get_category_dari_name,
        CATEGORY_DARI_NAMES,
    )

    # Build class metadata
    teacher_map = {t.id: t for t in data.teachers}
    class_metadata = []
    for cls in data.classes:
        class_info = {
            "classId": cls.id,
            "className": cls.name,
            "gradeLevel": cls.gradeLevel,
            "category": cls.category,
            "categoryDari": (
                get_category_dari_name(cls.category) if cls.category else None
            ),
            "studentCount": cls.studentCount,
            "fixedRoomId": cls.fixedRoomId,
            "singleTeacherMode": cls.singleTeacherMode,
            "classTeacherId": cls.classTeacherId,  # Include for all classes, not just singleTeacherMode
        }
        # Add class teacher details if assigned (for both singleTeacherMode and regular classes)
        if cls.classTeacherId:
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
            "customCategory": subj.customCategory if subj.isCustom else None,
        }
        if subj.isCustom and subj.customCategory:
            subject_info["customCategoryDari"] = get_category_dari_name(
                subj.customCategory
            )
        subject_metadata.append(subject_info)

    # Build teacher metadata
    teacher_metadata = []
    for teacher in data.teachers:
        teacher_info = {
            "teacherId": teacher.id,
            "teacherName": teacher.fullName,
            "primarySubjects": teacher.primarySubjectIds,
            "maxPeriodsPerWeek": teacher.maxPeriodsPerWeek,
            # Include all classes where this teacher is class teacher (not just singleTeacherMode)
            "classTeacherOf": [
                cls.id for cls in data.classes if cls.classTeacherId == teacher.id
            ],
        }
        teacher_metadata.append(teacher_info)

    # Build period configuration
    period_config = build_period_configuration_metadata(data.config)

    # Room names are required by the schedule UI and export pipeline. The raw
    # CP-SAT solution only contains room IDs, so enrich every lesson here while
    # the authoritative input entities are still available.
    room_map = {room.id: room for room in data.rooms}
    enhanced_solution = []
    for lesson in solution:
        room = room_map.get(lesson.get("roomId"))
        enhanced_solution.append(
            {
                **lesson,
                "roomName": room.name if room else lesson.get("roomName"),
            }
        )

    # Build statistics
    category_counts = {
        "Alpha-Primary": sum(1 for c in data.classes if c.category == "Alpha-Primary"),
        "Beta-Primary": sum(1 for c in data.classes if c.category == "Beta-Primary"),
        "Middle": sum(1 for c in data.classes if c.category == "Middle"),
        "High": sum(1 for c in data.classes if c.category == "High"),
    }

    custom_by_category = {}
    for subj in data.subjects:
        if subj.isCustom and subj.customCategory:
            custom_by_category[subj.customCategory] = (
                custom_by_category.get(subj.customCategory, 0) + 1
            )

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
        "periodsPerWeek": period_config["totalPeriodsPerWeek"],
    }

    return {
        "schedule": enhanced_solution,
        "metadata": {
            "classes": class_metadata,
            "subjects": subject_metadata,
            "teachers": teacher_metadata,
            "periodConfiguration": period_config,
        },
        "statistics": statistics,
    }
