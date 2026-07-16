# ==============================================================================
#
#  Pre-solve Analyzer for Timetable Solver
#
#  Description:
#  Fast validation before attempting to solve. Detects potential issues early
#  to provide immediate feedback without waiting for a failed solve attempt.
#
#  Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
#
# ==============================================================================

import time
from typing import List, Optional

from pydantic import BaseModel, Field

from feedback.error_catalog import ErrorCode, ErrorSeverity, ERROR_DEFINITIONS
from feedback.error_builder import build_error
from feedback.response_models import SolverErrorDetail, Suggestion, AffectedEntity
from models.input import TimetableData, DayOfWeek


class PreSolveResult(BaseModel):
    """Result of pre-solve analysis.

    Requirements: 3.1, 3.2, 3.3

    Attributes:
        can_proceed: Whether solving can proceed (True if no blocking errors)
        errors: List of blocking errors (severity="error")
        warnings: List of non-blocking warnings (severity="warning")
        suggestions: List of suggestions for improvement
        analysis_time_ms: Time taken for analysis in milliseconds
    """

    can_proceed: bool = Field(
        ..., description="Whether solving can proceed (no blocking errors)"
    )
    errors: List[SolverErrorDetail] = Field(
        default_factory=list, description="List of blocking errors"
    )
    warnings: List[SolverErrorDetail] = Field(
        default_factory=list, description="List of non-blocking warnings"
    )
    suggestions: List[Suggestion] = Field(
        default_factory=list, description="List of suggestions for improvement"
    )
    analysis_time_ms: int = Field(
        ..., ge=0, description="Time taken for analysis in milliseconds"
    )


class PreSolveAnalyzer:
    """Analyzer for pre-solve validation.

    Performs fast validation checks before attempting to solve to detect
    potential issues early and provide immediate feedback.

    Requirements: 3.1, 3.2, 3.3
    """

    def __init__(self, data: TimetableData):
        """Initialize the analyzer with timetable data.

        Args:
            data: The timetable input data to analyze
        """
        self.data = data

    def analyze(self) -> PreSolveResult:
        """Run all pre-solve checks and return results.

        Performs the following checks:
        1. Teacher capacity - checks if any teacher is over-assigned
        2. Room capacity - checks if total room-periods are sufficient
        3. Subject distribution - checks if subject distribution is feasible

        Requirements: 3.1, 3.2, 3.3

        Returns:
            PreSolveResult with can_proceed, errors, warnings, and suggestions
        """
        start_time = time.time()

        errors: List[SolverErrorDetail] = []
        warnings: List[SolverErrorDetail] = []
        suggestions: List[Suggestion] = []

        # Check teacher capacity (Requirement 3.4)
        errors.extend(self._check_teacher_capacity())

        # Check room type requirements (subjects needing specific room types)
        errors.extend(self._check_room_type_requirements())

        # The Afghanistan daily subject limit is hard, so reject impossible
        # weekly requirements before building the CP-SAT model.
        errors.extend(self._check_consecutive_feasibility())

        # Check room capacity (Requirement 3.5)
        warnings.extend(self._check_room_capacity())

        # Check subject distribution feasibility
        warnings.extend(self._check_subject_distribution())

        # Calculate analysis time
        elapsed_ms = int((time.time() - start_time) * 1000)

        # can_proceed is True only if there are no errors
        can_proceed = len(errors) == 0

        return PreSolveResult(
            can_proceed=can_proceed,
            errors=errors,
            warnings=warnings,
            suggestions=suggestions,
            analysis_time_ms=elapsed_ms,
        )

    def _check_teacher_capacity(self) -> List[SolverErrorDetail]:
        """Check if any teacher is over-assigned.

        For each teacher, sums assigned periods across all classes.
        If sum > maxPeriodsPerWeek, adds TEACHER_OVERLOAD_PREDICTED error.

        Requirements: 3.4

        Returns:
            List of SolverErrorDetail for over-assigned teachers
        """
        errors: List[SolverErrorDetail] = []

        # Only count work that is mathematically mandatory. The previous
        # equal-share estimate could reject feasible asymmetric allocations
        # (for example capacities 2 and 8 serving a demand of 10).
        teacher_periods: dict[str, int] = {t.id: 0 for t in self.data.teachers}
        fixed_by_pair = {}
        for assignment in self.data.fixedTeacherAssignments or []:
            if assignment.isFixed:
                fixed_by_pair.setdefault(
                    (assignment.classId, assignment.subjectId), []
                ).append(assignment)

        flexible_demands = []
        for cls in self.data.classes:
            # In single-teacher mode, all periods go to the class teacher
            if cls.singleTeacherMode and cls.classTeacherId:
                total_periods = sum(
                    req.periodsPerWeek for req in cls.subjectRequirements.values()
                )
                if cls.classTeacherId in teacher_periods:
                    teacher_periods[cls.classTeacherId] += total_periods
            else:
                # For each subject requirement, find teachers who can teach it
                for subject_id, req in cls.subjectRequirements.items():
                    # Find teachers who can teach this subject
                    qualified_teachers = [
                        t
                        for t in self.data.teachers
                        if subject_id in t.primarySubjectIds
                        or (t.allowedSubjectIds and subject_id in t.allowedSubjectIds)
                    ]

                    fixed = fixed_by_pair.get((cls.id, subject_id), [])
                    fixed_periods = 0
                    for assignment in fixed:
                        if assignment.teacherId in teacher_periods:
                            teacher_periods[assignment.teacherId] += assignment.periodsPerWeek
                            fixed_periods += assignment.periodsPerWeek
                    remaining = max(0, req.periodsPerWeek - fixed_periods)
                    if remaining == 0:
                        continue
                    if len(qualified_teachers) == 1:
                        teacher_periods[qualified_teachers[0].id] += remaining
                    elif len(qualified_teachers) > 1:
                        flexible_demands.append((remaining, qualified_teachers))

        # Check each teacher against their max
        for teacher in self.data.teachers:
            assigned = teacher_periods.get(teacher.id, 0)
            if assigned > teacher.maxPeriodsPerWeek:
                error = build_error(
                    ErrorCode.TEACHER_OVERLOAD_PREDICTED,
                    {
                        "teacherName": teacher.fullName,
                        "teacherId": teacher.id,
                        "availablePeriods": teacher.maxPeriodsPerWeek,
                        "requiredPeriods": assigned,
                    },
                )
                errors.append(error)

        # This aggregate bound is necessary, never speculative: all flexible
        # demand must fit into the residual capacity of at least one eligible
        # teacher. It intentionally leaves the exact allocation to CP-SAT.
        if not errors and flexible_demands:
            eligible_ids = {
                teacher.id for _, teachers in flexible_demands for teacher in teachers
            }
            flexible_required = sum(periods for periods, _ in flexible_demands)
            residual_capacity = sum(
                max(0, teacher.maxPeriodsPerWeek - teacher_periods[teacher.id])
                for teacher in self.data.teachers
                if teacher.id in eligible_ids
            )
            if flexible_required > residual_capacity:
                errors.append(
                    build_error(
                        ErrorCode.TEACHER_OVERLOAD_PREDICTED,
                        {
                            "teacherName": "Eligible teacher pool",
                            "teacherId": "pool",
                            "availablePeriods": residual_capacity,
                            "requiredPeriods": flexible_required,
                        },
                    )
                )

        return errors

    def _check_consecutive_feasibility(self) -> List[SolverErrorDetail]:
        errors: List[SolverErrorDetail] = []
        number_of_days = len(self.data.config.daysOfWeek)
        allow_consecutive = bool(
            getattr(
                self.data.preferences,
                "allowConsecutivePeriodsForSameSubject",
                True,
            ) if self.data.preferences else True
        )
        for class_group in self.data.classes:
            for subject_id, requirement in class_group.subjectRequirements.items():
                daily_limit = 1 if not allow_consecutive else min(
                    2, requirement.maxConsecutive or 2
                )
                maximum = number_of_days * daily_limit
                if requirement.periodsPerWeek <= maximum:
                    continue
                subject = next(
                    (item for item in self.data.subjects if item.id == subject_id),
                    None,
                )
                subject_name = subject.name if subject else subject_id
                errors.append(
                    SolverErrorDetail(
                        error_code="SUBJECT_DAILY_LIMIT_INFEASIBLE",
                        severity="error",
                        message_key="errors.subjectDailyLimitInfeasible",
                        message_farsi=(
                            f"{subject_name} برای {class_group.name} به "
                            f"{requirement.periodsPerWeek} ساعت نیاز دارد، اما با این تنظیم "
                            f"حداکثر {maximum} ساعت ممکن است. ساعات متوالی را فعال کنید، "
                            "روز درسی اضافه کنید یا نیاز مضمون را کاهش دهید."
                        ),
                        message_english=(
                            f"{subject_name} for {class_group.name} requires "
                            f"{requirement.periodsPerWeek} periods, but this setting permits "
                            f"at most {maximum}. Enable consecutive periods, add teaching "
                            "days, or reduce the requirement."
                        ),
                        affected_entities=[
                            AffectedEntity(
                                entity_type="class",
                                entity_id=class_group.id,
                                entity_name=class_group.name,
                            ),
                            AffectedEntity(
                                entity_type="subject",
                                entity_id=subject_id,
                                entity_name=subject_name,
                            ),
                        ],
                        context={
                            "periodsRequired": requirement.periodsPerWeek,
                            "maximumPeriods": maximum,
                            "dailyLimit": daily_limit,
                            "suggestions": [
                                "enable_consecutive_periods",
                                "add_teaching_days",
                                "reduce_subject_requirement",
                            ],
                        },
                    )
                )
        return errors

    def _check_room_capacity(self) -> List[SolverErrorDetail]:
        """Check if total room-periods are sufficient.

        Calculates total required room-periods across all classes and
        compares with total available room-periods.

        Requirements: 3.5

        Returns:
            List of SolverErrorDetail warnings if capacity may be insufficient
        """
        warnings: List[SolverErrorDetail] = []

        # Calculate total required room-periods
        total_required = 0
        for cls in self.data.classes:
            # If class has a fixed room, it doesn't compete for general rooms
            if cls.fixedRoomId:
                continue

            for req in cls.subjectRequirements.values():
                total_required += req.periodsPerWeek

        # Calculate total available room-periods
        # Available = number of rooms * periods per week
        cfg = self.data.config

        # Count rooms that are not fixed to specific classes
        fixed_room_ids = {
            cls.fixedRoomId for cls in self.data.classes if cls.fixedRoomId
        }
        available_rooms = [r for r in self.data.rooms if r.id not in fixed_room_ids]

        # Calculate periods per week
        if cfg.periodsPerDayMap:
            periods_per_week = sum(cfg.periodsPerDayMap.values())
        else:
            periods_per_week = cfg.periodsPerDay * len(cfg.daysOfWeek)

        total_available = len(available_rooms) * periods_per_week

        # If required > available, add warning
        if total_required > total_available:
            warning = build_error(
                ErrorCode.ROOM_CAPACITY_WARNING,
                {
                    "requiredPeriods": total_required,
                    "availablePeriods": total_available,
                },
            )
            warnings.append(warning)

        return warnings

    def _check_room_type_requirements(self) -> List[SolverErrorDetail]:
        """Check if subjects requiring specific room types have matching rooms.

        For each subject that has a requiredRoomType, checks if at least one
        room of that type exists. If not, adds a MISSING_ROOM_TYPE error.

        Returns:
            List of SolverErrorDetail errors for missing room types
        """
        errors: List[SolverErrorDetail] = []

        # Build a set of available room types
        available_room_types = {room.type for room in self.data.rooms if room.type}

        # Track which room types we've already reported as missing
        reported_missing_types: dict[str, List[str]] = (
            {}
        )  # room_type -> [subject_names]

        # Check each subject's room type requirement
        for subject in self.data.subjects:
            if (
                subject.requiredRoomType
                and subject.requiredRoomType not in available_room_types
            ):
                room_type = subject.requiredRoomType
                if room_type not in reported_missing_types:
                    reported_missing_types[room_type] = []
                reported_missing_types[room_type].append(subject.name)

        # Create one error per missing room type (with all affected subjects)
        for room_type, subject_names in reported_missing_types.items():
            # Get the first subject for the error (we'll list all in context)
            first_subject = next(
                (s for s in self.data.subjects if s.requiredRoomType == room_type),
                None,
            )

            if first_subject:
                # Build affected entities for all subjects needing this room type
                affected_entities = [
                    AffectedEntity(
                        entity_type="subject",
                        entity_id=s.id,
                        entity_name=s.name,
                    )
                    for s in self.data.subjects
                    if s.requiredRoomType == room_type
                ]

                # Create a detailed error message
                if len(subject_names) == 1:
                    message_farsi = (
                        f"مضمون '{subject_names[0]}' به اتاق نوع '{room_type}' نیاز دارد، "
                        f"اما هیچ اتاقی از این نوع وجود ندارد"
                    )
                    message_english = (
                        f"Subject '{subject_names[0]}' requires room type '{room_type}', "
                        f"but no room of this type exists"
                    )
                else:
                    subjects_list = "، ".join(subject_names[:3])
                    if len(subject_names) > 3:
                        subjects_list += f" و {len(subject_names) - 3} مضمون دیگر"
                    message_farsi = (
                        f"مضامین ({subjects_list}) به اتاق نوع '{room_type}' نیاز دارند، "
                        f"اما هیچ اتاقی از این نوع وجود ندارد"
                    )
                    message_english = (
                        f"Subjects ({', '.join(subject_names[:3])}"
                        f"{f' and {len(subject_names) - 3} more' if len(subject_names) > 3 else ''}) "
                        f"require room type '{room_type}', but no room of this type exists"
                    )

                error = SolverErrorDetail(
                    error_code="MISSING_ROOM_TYPE",
                    severity="error",
                    message_key="error.room.missing_type",
                    message_farsi=message_farsi,
                    message_english=message_english,
                    affected_entities=affected_entities,
                    context={
                        "roomType": room_type,
                        "subjectNames": subject_names,
                        "subjectCount": len(subject_names),
                        "suggestion_farsi": f"لطفاً یک اتاق از نوع '{room_type}' اضافه کنید یا نوع اتاق مورد نیاز مضامین را تغییر دهید",
                        "suggestion_english": f"Please add a room of type '{room_type}' or change the required room type for these subjects",
                    },
                )
                errors.append(error)

        return errors

    def _check_subject_distribution(self) -> List[SolverErrorDetail]:
        """Check if subject distribution is feasible.

        Checks if any subject requires more periods than available days,
        which would make distribution impossible.

        Requirements: 3.1

        Returns:
            List of SolverErrorDetail warnings for distribution issues
        """
        warnings: List[SolverErrorDetail] = []

        cfg = self.data.config
        num_days = len(cfg.daysOfWeek)

        for cls in self.data.classes:
            for subject_id, req in cls.subjectRequirements.items():
                # If minDaysPerWeek is specified and exceeds available days
                if req.minDaysPerWeek and req.minDaysPerWeek > num_days:
                    subject = next(
                        (s for s in self.data.subjects if s.id == subject_id), None
                    )
                    subject_name = subject.name if subject else subject_id

                    # Create a warning using a generic approach
                    # (No specific error code for this, so we use a custom warning)
                    warning = SolverErrorDetail(
                        error_code="SUBJECT_DISTRIBUTION_WARNING",
                        severity="warning",
                        message_key="warning.subject.distribution",
                        message_farsi=(
                            f"مضمون {subject_name} در صنف {cls.name} به حداقل "
                            f"{req.minDaysPerWeek} روز نیاز دارد اما فقط {num_days} روز موجود است"
                        ),
                        message_english=(
                            f"Subject {subject_name} in class {cls.name} requires minimum "
                            f"{req.minDaysPerWeek} days but only {num_days} days are available"
                        ),
                        affected_entities=[
                            AffectedEntity(
                                entity_type="subject",
                                entity_id=subject_id,
                                entity_name=subject_name,
                            ),
                            AffectedEntity(
                                entity_type="class",
                                entity_id=cls.id,
                                entity_name=cls.name,
                            ),
                        ],
                        context={
                            "subjectId": subject_id,
                            "subjectName": subject_name,
                            "classId": cls.id,
                            "className": cls.name,
                            "minDaysRequired": req.minDaysPerWeek,
                            "availableDays": num_days,
                        },
                    )
                    warnings.append(warning)

                # Check if periods per week exceeds what's possible with maxConsecutive
                if req.maxConsecutive and req.periodsPerWeek > 0:
                    # Max periods possible = maxConsecutive * num_days
                    max_possible = req.maxConsecutive * num_days
                    if req.periodsPerWeek > max_possible:
                        subject = next(
                            (s for s in self.data.subjects if s.id == subject_id), None
                        )
                        subject_name = subject.name if subject else subject_id

                        warning = SolverErrorDetail(
                            error_code="SUBJECT_CONSECUTIVE_WARNING",
                            severity="warning",
                            message_key="warning.subject.consecutive",
                            message_farsi=(
                                f"مضمون {subject_name} در صنف {cls.name} به "
                                f"{req.periodsPerWeek} ساعت نیاز دارد اما با حداکثر "
                                f"{req.maxConsecutive} ساعت متوالی فقط {max_possible} ساعت ممکن است"
                            ),
                            message_english=(
                                f"Subject {subject_name} in class {cls.name} requires "
                                f"{req.periodsPerWeek} periods but with max {req.maxConsecutive} "
                                f"consecutive only {max_possible} periods are possible"
                            ),
                            affected_entities=[
                                AffectedEntity(
                                    entity_type="subject",
                                    entity_id=subject_id,
                                    entity_name=subject_name,
                                ),
                                AffectedEntity(
                                    entity_type="class",
                                    entity_id=cls.id,
                                    entity_name=cls.name,
                                ),
                            ],
                            context={
                                "subjectId": subject_id,
                                "subjectName": subject_name,
                                "classId": cls.id,
                                "className": cls.name,
                                "periodsRequired": req.periodsPerWeek,
                                "maxConsecutive": req.maxConsecutive,
                                "maxPossible": max_possible,
                            },
                        )
                        warnings.append(warning)

        return warnings
