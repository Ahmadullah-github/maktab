# ==============================================================================
#
#  Swap Validator - Core Logic for Swap Validation
#
#  Description:
#  Validates lesson swaps and finds minimal disruption solutions using CP-SAT.
#  Reuses existing constraint infrastructure from the main solver.
#
# ==============================================================================

import time
from typing import List, Dict, Optional, Any
from ortools.sat.python import cp_model

from models.swap import (
    SwapRequest,
    SwapResolution,
    ConstraintViolation,
    LessonMove,
    Lesson,
    ConstraintData,
)
import structlog

log = structlog.get_logger()


class SwapValidator:
    """Validates lesson swaps and finds minimal disruption solutions."""

    def __init__(self, constraint_data: Dict[str, Any]):
        """Initialize validator with constraint data."""
        data = ConstraintData(**constraint_data)

        self.teachers = {t["id"]: t for t in data.teachers}
        self.subjects = {s["id"]: s for s in data.subjects}
        self.rooms = {r["id"]: r for r in data.rooms}
        self.classes = {c["id"]: c for c in data.classes}
        self.assignments = data.assignments
        self.timetable_data = data.timetableData
        self.config = data.config

        self._build_slot_index()

        log.info(
            "SwapValidator initialized",
            teachers=len(self.teachers),
            subjects=len(self.subjects),
            rooms=len(self.rooms),
            classes=len(self.classes),
            assignments=len(self.assignments),
        )

    def _build_slot_index(self) -> None:
        """Build index for fast slot lookups."""
        self.slot_index: Dict[str, Lesson] = {}

        for lesson in self.assignments:
            key = f"{lesson.classId}_{lesson.day}_{lesson.periodIndex}"
            self.slot_index[key] = lesson

    def _get_lesson_at_slot(
        self, class_id: str, day: str, period: int
    ) -> Optional[Lesson]:
        """Find lesson at specific slot."""
        key = f"{class_id}_{day}_{period}"
        return self.slot_index.get(key)

    def _is_same_slot(
        self, lesson: Lesson, class_id: str, day: str, period: int
    ) -> bool:
        """Check if lesson is at the specified slot."""
        return (
            lesson.classId == class_id
            and lesson.day == day
            and lesson.periodIndex == period
        )

    @staticmethod
    def _intervals_overlap(
        first_start: int, first_duration: int, second_start: int, second_duration: int
    ) -> bool:
        return first_start < second_start + second_duration and second_start < first_start + first_duration

    def _day_period_limit(self, day: str) -> Optional[int]:
        periods = self.config.get("periodsPerDay")
        if isinstance(periods, dict):
            value = periods.get(day)
            return int(value) if isinstance(value, (int, float)) else None
        if isinstance(periods, (int, float)):
            return int(periods)
        return None

    @staticmethod
    def _matches_lesson(first: Lesson, second: Optional[Lesson]) -> bool:
        if second is None:
            return False
        return (
            first.classId == second.classId
            and first.subjectId == second.subjectId
            and first.day == second.day
            and first.periodIndex == second.periodIndex
        )

    @staticmethod
    def _slot_is_unavailable(resource: Dict[str, Any], day: str, period: int) -> bool:
        unavailable = resource.get("unavailable") or []
        if isinstance(unavailable, list):
            for entry in unavailable:
                if not isinstance(entry, dict) or entry.get("day") != day:
                    continue
                if entry.get("period") == period:
                    return True
                if period in (entry.get("periods") or []):
                    return True
        elif isinstance(unavailable, dict):
            day_value = unavailable.get(day)
            if isinstance(day_value, list) and period < len(day_value):
                return day_value[period] is True
        return False

    def _check_full_move_constraints(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Validate the complete simulated swap while resources follow lessons."""
        violations: List[ConstraintViolation] = []
        moves = [
            (source, request.target_slot.day, request.target_slot.period),
        ]
        if target:
            moves.append((target, request.source_slot.day, request.source_slot.period))

        moving_lessons = [source, target]

        for lesson, destination_day, destination_period in moves:
            duration = max(1, lesson.duration)
            day_limit = self._day_period_limit(destination_day)
            if (
                day_limit is None
                or destination_period < 0
                or destination_period + duration > day_limit
            ):
                violations.append(
                    ConstraintViolation(
                        type="PERIOD_OUT_OF_BOUNDS",
                        severity="hard",
                        message="Moved lesson would extend beyond the configured school day",
                        message_farsi="درس جابه‌جا شده از محدودهٔ ساعات روز مکتب بیرون می‌رود",
                        details={
                            "classId": lesson.classId,
                            "day": destination_day,
                            "period": destination_period,
                            "duration": duration,
                            "periodLimit": day_limit,
                        },
                    )
                )
                continue

            teacher = self.teachers.get(lesson.teacherId)
            if not teacher:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_TEACHER",
                        severity="hard",
                        message=f"Teacher {lesson.teacherId} is not active",
                        message_farsi=f"استاد {lesson.teacherId} فعال نیست",
                        details={"teacherId": lesson.teacherId},
                    )
                )
            elif any(
                not self._is_available(teacher, destination_day, destination_period + offset)
                for offset in range(duration)
            ):
                violations.append(
                    ConstraintViolation(
                        type="TEACHER_UNAVAILABLE",
                        severity="hard",
                        message=f"Teacher {teacher.get('fullName', lesson.teacherId)} is unavailable for the full moved lesson",
                        message_farsi=f"استاد {teacher.get('fullName', lesson.teacherId)} برای تمام مدت درس جابه‌جا شده در دسترس نیست",
                        details={
                            "teacherId": lesson.teacherId,
                            "day": destination_day,
                            "period": destination_period,
                            "duration": duration,
                        },
                    )
                )

            subject = self.subjects.get(lesson.subjectId, {})
            class_group = self.classes.get(lesson.classId, {})
            room = self.rooms.get(lesson.roomId) if lesson.roomId else None
            required_type = subject.get("requiredRoomType")
            required_features = set(subject.get("requiredFeatures") or [])
            min_capacity = max(
                int(subject.get("minRoomCapacity") or 0),
                int(class_group.get("studentCount") or 0),
            )

            if not room:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_ROOM",
                        severity="hard",
                        message="Moved lesson has no active room",
                        message_farsi="درس جابه‌جا شده اتاق فعال ندارد",
                        details={"roomId": lesson.roomId, "subjectId": lesson.subjectId},
                    )
                )
            else:
                room_features = set(room.get("features") or [])
                mismatch_details: Dict[str, Any] = {}
                if required_type and room.get("type") != required_type:
                    mismatch_details["requiredType"] = required_type
                    mismatch_details["actualType"] = room.get("type")
                if int(room.get("capacity") or 0) < min_capacity:
                    mismatch_details["requiredCapacity"] = min_capacity
                    mismatch_details["actualCapacity"] = int(room.get("capacity") or 0)
                missing_features = sorted(required_features - room_features)
                if missing_features:
                    mismatch_details["missingFeatures"] = missing_features
                if mismatch_details:
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_INCOMPATIBLE",
                            severity="hard",
                            message="The lesson's room does not satisfy its hard requirements",
                            message_farsi="اتاق درس شرایط الزامی آن را برآورده نمی‌کند",
                            details={
                                "roomId": lesson.roomId,
                                "subjectId": lesson.subjectId,
                                **mismatch_details,
                            },
                        )
                    )
                if any(
                    self._slot_is_unavailable(
                        room, destination_day, destination_period + offset
                    )
                    for offset in range(duration)
                ):
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_UNAVAILABLE",
                            severity="hard",
                            message="The lesson's room is unavailable for the full moved lesson",
                            message_farsi="اتاق درس برای تمام مدت درس جابه‌جا شده در دسترس نیست",
                            details={
                                "roomId": lesson.roomId,
                                "day": destination_day,
                                "period": destination_period,
                                "duration": duration,
                            },
                        )
                    )

            for existing in self.assignments:
                if any(self._matches_lesson(existing, moved) for moved in moving_lessons):
                    continue
                if existing.day != destination_day or not self._intervals_overlap(
                    destination_period,
                    duration,
                    existing.periodIndex,
                    max(1, existing.duration),
                ):
                    continue

                conflict_type = None
                conflict_resource = None
                if existing.classId == lesson.classId:
                    conflict_type = "CLASS_CONFLICT"
                    conflict_resource = lesson.classId
                elif existing.teacherId == lesson.teacherId:
                    conflict_type = "TEACHER_CONFLICT"
                    conflict_resource = lesson.teacherId
                elif lesson.roomId and existing.roomId == lesson.roomId:
                    conflict_type = "ROOM_CONFLICT"
                    conflict_resource = lesson.roomId

                if conflict_type:
                    violations.append(
                        ConstraintViolation(
                            type=conflict_type,
                            severity="hard",
                            message=f"{conflict_type.replace('_', ' ').title()} after swap",
                            message_farsi="پس از جابه‌جایی تداخل زمانی ایجاد می‌شود",
                            details={
                                "resourceId": conflict_resource,
                                "conflictingClass": existing.classId,
                                "day": destination_day,
                                "period": destination_period,
                                "duration": duration,
                            },
                        )
                    )

        if len(moves) == 2:
            first, second = moves
            first_lesson, first_day, first_period = first
            second_lesson, second_day, second_period = second
            if first_day == second_day and self._intervals_overlap(
                first_period,
                max(1, first_lesson.duration),
                second_period,
                max(1, second_lesson.duration),
            ):
                shared = (
                    first_lesson.classId == second_lesson.classId
                    or first_lesson.teacherId == second_lesson.teacherId
                    or (
                        first_lesson.roomId is not None
                        and first_lesson.roomId == second_lesson.roomId
                    )
                )
                if shared:
                    violations.append(
                        ConstraintViolation(
                            type="SWAPPED_LESSON_CONFLICT",
                            severity="hard",
                            message="The two moved lessons would overlap a shared resource",
                            message_farsi="دو درس جابه‌جا شده در یک منبع مشترک تداخل می‌کنند",
                            details={"day": first_day},
                        )
                    )

        return violations

    def validate_swap(self, swap_request: SwapRequest) -> SwapResolution:
        """Validates a swap operation and finds minimal disruption solution."""
        start_time = time.time()

        log.info(
            "Validating swap",
            source=swap_request.source_slot.model_dump(),
            target=swap_request.target_slot.model_dump(),
        )

        errors: List[ConstraintViolation] = []
        warnings: List[ConstraintViolation] = []
        affected_lessons: List[LessonMove] = []

        source_lesson = self._get_lesson_at_slot(
            swap_request.source_slot.classId,
            swap_request.source_slot.day,
            swap_request.source_slot.period,
        )

        target_lesson = self._get_lesson_at_slot(
            swap_request.target_slot.classId,
            swap_request.target_slot.day,
            swap_request.target_slot.period,
        )

        # Source slot must have a lesson (can't swap from empty slot)
        if not source_lesson:
            errors.append(
                ConstraintViolation(
                    type="EMPTY_SOURCE_SLOT",
                    severity="hard",
                    message=f"No lesson found at source slot",
                    message_farsi="هیچ درسی در زمان مبدأ یافت نشد",
                    details={
                        "classId": swap_request.source_slot.classId,
                        "day": swap_request.source_slot.day,
                        "period": swap_request.source_slot.period,
                    },
                )
            )
            solve_time_ms = int((time.time() - start_time) * 1000)
            return SwapResolution(
                is_valid=False,
                can_proceed_with_warning=False,
                errors=errors,
                warnings=warnings,
                affected_lessons=[],
                total_moves=0,
                solve_time_ms=solve_time_ms,
            )

        # Target slot can be empty (swap to empty slot is valid)
        # If target is empty, we only need to validate source lesson constraints

        # Check constraints (handle empty target slot)
        errors.extend(
            self._check_full_move_constraints(
                source_lesson, target_lesson, swap_request
            )
        )

        consecutive_issues = self._check_consecutive_periods(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(consecutive_issues)

        difficult_afternoon = self._check_difficult_subject_timing(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(difficult_afternoon)

        teacher_preference = self._check_teacher_preferences(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(teacher_preference)

        if len(errors) == 0:
            affected_lessons = self._find_minimal_disruption_solution(
                source_lesson, target_lesson, swap_request
            )

        solve_time_ms = int((time.time() - start_time) * 1000)

        log.info(
            "Swap validation complete",
            is_valid=len(errors) == 0,
            errors=len(errors),
            warnings=len(warnings),
            affected_lessons=len(affected_lessons),
            solve_time_ms=solve_time_ms,
        )

        return SwapResolution(
            is_valid=len(errors) == 0,
            can_proceed_with_warning=len(errors) == 0 and len(warnings) > 0,
            errors=errors,
            warnings=warnings,
            affected_lessons=affected_lessons,
            total_moves=len(affected_lessons),
            solve_time_ms=solve_time_ms,
        )

    def _is_available(self, teacher: Dict[str, Any], day: str, period: int) -> bool:
        """Check whether a teacher is available at a given day/period."""
        availability = teacher.get("availability") or {}
        day_availability = availability.get(day)

        if not isinstance(day_availability, list):
            return not self._slot_is_unavailable(teacher, day, period)

        if period < 0 or period >= len(day_availability):
            return False

        return day_availability[period] is not False and not self._slot_is_unavailable(
            teacher, day, period
        )

    def _check_teacher_availability(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check whether the moved teachers are available in their target slots."""
        violations = []

        source_teacher = self.teachers.get(source.teacherId)
        if source_teacher and not self._is_available(
            source_teacher, request.target_slot.day, request.target_slot.period
        ):
            violations.append(
                ConstraintViolation(
                    type="TEACHER_UNAVAILABLE",
                    severity="hard",
                    message=f"Teacher {source_teacher.get('fullName', source.teacherId)} is unavailable at target time",
                    message_farsi=f"استاد {source_teacher.get('fullName', source.teacherId)} در زمان مقصد در دسترس نیست",
                    details={
                        "teacherId": source.teacherId,
                        "teacherName": source_teacher.get("fullName"),
                        "day": request.target_slot.day,
                        "period": request.target_slot.period,
                    },
                )
            )

        if target:
            target_teacher = self.teachers.get(target.teacherId)
            if target_teacher and not self._is_available(
                target_teacher, request.source_slot.day, request.source_slot.period
            ):
                violations.append(
                    ConstraintViolation(
                        type="TEACHER_UNAVAILABLE",
                        severity="hard",
                        message=f"Teacher {target_teacher.get('fullName', target.teacherId)} is unavailable at source time",
                        message_farsi=f"استاد {target_teacher.get('fullName', target.teacherId)} در زمان مبدأ در دسترس نیست",
                        details={
                            "teacherId": target.teacherId,
                            "teacherName": target_teacher.get("fullName"),
                            "day": request.source_slot.day,
                            "period": request.source_slot.period,
                        },
                    )
                )

        return violations

    def _check_teacher_conflicts(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if teacher would be double-booked after swap."""
        violations = []

        # Check if source teacher has conflict at target slot
        source_teacher = self.teachers.get(source.teacherId)
        if source_teacher:
            for lesson in self.assignments:
                if self._is_same_slot(
                    lesson,
                    request.target_slot.classId,
                    request.target_slot.day,
                    request.target_slot.period,
                ):
                    continue

                if (
                    lesson.teacherId == source.teacherId
                    and lesson.day == request.target_slot.day
                    and lesson.periodIndex == request.target_slot.period
                ):
                    violations.append(
                        ConstraintViolation(
                            type="TEACHER_CONFLICT",
                            severity="hard",
                            message=f"Teacher {source_teacher.get('fullName', source.teacherId)} already has a lesson at target time",
                            message_farsi=f"استاد {source_teacher.get('fullName', source.teacherId)} در زمان مقصد درس دیگری دارد",
                            details={
                                "teacherId": source.teacherId,
                                "teacherName": source_teacher.get("fullName"),
                                "conflictingClass": lesson.classId,
                                "day": lesson.day,
                                "period": lesson.periodIndex,
                            },
                        )
                    )

        # Check if target teacher has conflict at source slot (only if target exists)
        if target:
            target_teacher = self.teachers.get(target.teacherId)
            if target_teacher:
                for lesson in self.assignments:
                    if self._is_same_slot(
                        lesson,
                        request.source_slot.classId,
                        request.source_slot.day,
                        request.source_slot.period,
                    ):
                        continue

                    if (
                        lesson.teacherId == target.teacherId
                        and lesson.day == request.source_slot.day
                        and lesson.periodIndex == request.source_slot.period
                    ):
                        violations.append(
                            ConstraintViolation(
                                type="TEACHER_CONFLICT",
                                severity="hard",
                                message=f"Teacher {target_teacher.get('fullName', target.teacherId)} already has a lesson at source time",
                                message_farsi=f"استاد {target_teacher.get('fullName', target.teacherId)} در زمان مبدأ درس دیگری دارد",
                                details={
                                    "teacherId": target.teacherId,
                                    "teacherName": target_teacher.get("fullName"),
                                    "conflictingClass": lesson.classId,
                                    "day": lesson.day,
                                    "period": lesson.periodIndex,
                                },
                            )
                        )

        return violations

    def _check_class_conflicts(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if either class would be double-booked after the swap."""
        violations = []

        source_class_conflict = self._get_lesson_at_slot(
            source.classId, request.target_slot.day, request.target_slot.period
        )
        if source_class_conflict and not (
            target
            and self._is_same_slot(
                source_class_conflict, target.classId, target.day, target.periodIndex
            )
        ):
            violations.append(
                ConstraintViolation(
                    type="CLASS_CONFLICT",
                    severity="hard",
                    message=f"Class {source.classId} already has a lesson at target time",
                    message_farsi=f"صنف {source.classId} در زمان مقصد درس دیگری دارد",
                    details={
                        "classId": source.classId,
                        "conflictingSubject": source_class_conflict.subjectId,
                        "day": request.target_slot.day,
                        "period": request.target_slot.period,
                    },
                )
            )

        if target:
            target_class_conflict = self._get_lesson_at_slot(
                target.classId, request.source_slot.day, request.source_slot.period
            )
            if target_class_conflict and not self._is_same_slot(
                target_class_conflict, source.classId, source.day, source.periodIndex
            ):
                violations.append(
                    ConstraintViolation(
                        type="CLASS_CONFLICT",
                        severity="hard",
                        message=f"Class {target.classId} already has a lesson at source time",
                        message_farsi=f"صنف {target.classId} در زمان مبدأ درس دیگری دارد",
                        details={
                            "classId": target.classId,
                            "conflictingSubject": target_class_conflict.subjectId,
                            "day": request.source_slot.day,
                            "period": request.source_slot.period,
                        },
                    )
                )

        return violations

    def _check_room_conflicts(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if room would be double-booked after swap."""
        violations = []

        # Check if source room has conflict at target slot
        if source.roomId:
            for lesson in self.assignments:
                if self._is_same_slot(
                    lesson,
                    request.target_slot.classId,
                    request.target_slot.day,
                    request.target_slot.period,
                ):
                    continue

                if (
                    lesson.roomId == source.roomId
                    and lesson.day == request.target_slot.day
                    and lesson.periodIndex == request.target_slot.period
                ):
                    room = self.rooms.get(source.roomId, {})
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_CONFLICT",
                            severity="hard",
                            message=f"Room {room.get('name', source.roomId)} is already occupied at target time",
                            message_farsi=f"اتاق {room.get('name', source.roomId)} در زمان مقصد اشغال است",
                            details={
                                "roomId": source.roomId,
                                "roomName": room.get("name"),
                                "conflictingClass": lesson.classId,
                                "day": lesson.day,
                                "period": lesson.periodIndex,
                            },
                        )
                    )

        # Check if target room has conflict at source slot (only if target exists)
        if target and target.roomId:
            for lesson in self.assignments:
                if self._is_same_slot(
                    lesson,
                    request.source_slot.classId,
                    request.source_slot.day,
                    request.source_slot.period,
                ):
                    continue

                if (
                    lesson.roomId == target.roomId
                    and lesson.day == request.source_slot.day
                    and lesson.periodIndex == request.source_slot.period
                ):
                    room = self.rooms.get(target.roomId, {})
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_CONFLICT",
                            severity="hard",
                            message=f"Room {room.get('name', target.roomId)} is already occupied at source time",
                            message_farsi=f"اتاق {room.get('name', target.roomId)} در زمان مبدأ اشغال است",
                            details={
                                "roomId": target.roomId,
                                "roomName": room.get("name"),
                                "conflictingClass": lesson.classId,
                                "day": lesson.day,
                                "period": lesson.periodIndex,
                            },
                        )
                    )

        return violations

    def _check_room_type_requirements(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if room type matches subject requirements after swap."""
        violations = []

        # Check if source subject's room type requirement is met at target slot
        source_subject = self.subjects.get(source.subjectId, {})
        required_room_type = source_subject.get("requiredRoomType")

        if required_room_type and source.roomId:
            # When swapping to empty slot, check if source room type is still valid
            # (room doesn't change in swap to empty, so this is always valid)
            pass

        if required_room_type and target and target.roomId:
            target_room = self.rooms.get(target.roomId, {})
            if target_room.get("type") != required_room_type:
                violations.append(
                    ConstraintViolation(
                        type="ROOM_TYPE_MISMATCH",
                        severity="hard",
                        message=f"Subject {source_subject.get('name', source.subjectId)} requires {required_room_type} but target room is {target_room.get('type')}",
                        message_farsi=f"درس {source_subject.get('name', source.subjectId)} نیاز به {required_room_type} دارد اما اتاق مقصد {target_room.get('type')} است",
                        details={
                            "subjectId": source.subjectId,
                            "subjectName": source_subject.get("name"),
                            "requiredType": required_room_type,
                            "actualType": target_room.get("type"),
                            "roomId": target.roomId,
                            "roomName": target_room.get("name"),
                        },
                    )
                )

        # Check if target subject's room type requirement is met at source slot (only if target exists)
        if target:
            target_subject = self.subjects.get(target.subjectId, {})
            required_room_type = target_subject.get("requiredRoomType")

            if required_room_type and source.roomId:
                source_room = self.rooms.get(source.roomId, {})
                if source_room.get("type") != required_room_type:
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_TYPE_MISMATCH",
                            severity="hard",
                            message=f"Subject {target_subject.get('name', target.subjectId)} requires {required_room_type} but source room is {source_room.get('type')}",
                            message_farsi=f"درس {target_subject.get('name', target.subjectId)} نیاز به {required_room_type} دارد اما اتاق مبدأ {source_room.get('type')} است",
                            details={
                                "subjectId": target.subjectId,
                                "subjectName": target_subject.get("name"),
                                "requiredType": required_room_type,
                                "actualType": source_room.get("type"),
                                "roomId": source.roomId,
                                "roomName": source_room.get("name"),
                            },
                        )
                    )

        return violations

    def _check_consecutive_periods(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if teacher exceeds max consecutive periods after swap."""
        violations = []

        # Check source teacher at target slot
        source_teacher = self.teachers.get(source.teacherId, {})
        max_consecutive = source_teacher.get("maxConsecutivePeriods")

        if max_consecutive:
            consecutive_count = self._count_consecutive_periods(
                source.teacherId,
                request.target_slot.day,
                request.target_slot.period,
                exclude_period=source.periodIndex
                if source.day == request.target_slot.day
                else None,
            )
            if consecutive_count > max_consecutive:
                violations.append(
                    ConstraintViolation(
                        type="CONSECUTIVE_EXCEEDED",
                        severity="soft",
                        message=f"Teacher {source_teacher.get('fullName', source.teacherId)} would exceed max consecutive periods ({max_consecutive})",
                        message_farsi=f"استاد {source_teacher.get('fullName', source.teacherId)} از حداکثر ساعات متوالی ({max_consecutive}) تجاوز می‌کند",
                        details={
                            "teacherId": source.teacherId,
                            "teacherName": source_teacher.get("fullName"),
                            "maxConsecutive": max_consecutive,
                            "actualConsecutive": consecutive_count,
                        },
                    )
                )

        # Check target teacher at source slot (only if target exists)
        if target:
            target_teacher = self.teachers.get(target.teacherId, {})
            max_consecutive = target_teacher.get("maxConsecutivePeriods")

            if max_consecutive:
                consecutive_count = self._count_consecutive_periods(
                    target.teacherId,
                    request.source_slot.day,
                    request.source_slot.period,
                    exclude_period=target.periodIndex
                    if target.day == request.source_slot.day
                    else None,
                )
                if consecutive_count > max_consecutive:
                    violations.append(
                        ConstraintViolation(
                            type="CONSECUTIVE_EXCEEDED",
                            severity="soft",
                            message=f"Teacher {target_teacher.get('fullName', target.teacherId)} would exceed max consecutive periods ({max_consecutive})",
                            message_farsi=f"استاد {target_teacher.get('fullName', target.teacherId)} از حداکثر ساعات متوالی ({max_consecutive}) تجاوز می‌کند",
                            details={
                                "teacherId": target.teacherId,
                                "teacherName": target_teacher.get("fullName"),
                                "maxConsecutive": max_consecutive,
                                "actualConsecutive": consecutive_count,
                            },
                        )
                    )

        return violations

    def _count_consecutive_periods(
        self,
        teacher_id: str,
        day: str,
        period: int,
        exclude_period: Optional[int] = None,
    ) -> int:
        """Count consecutive periods for a teacher around a specific time."""
        teacher_lessons = [
            l
            for l in self.assignments
            if l.teacherId == teacher_id
            and l.day == day
            and (exclude_period is None or l.periodIndex != exclude_period)
        ]
        teacher_lessons.sort(key=lambda l: l.periodIndex)

        consecutive = 1

        for i in range(period - 1, -1, -1):
            if any(l.periodIndex == i for l in teacher_lessons):
                consecutive += 1
            else:
                break

        for i in range(period + 1, 20):
            if any(l.periodIndex == i for l in teacher_lessons):
                consecutive += 1
            else:
                break

        return consecutive

    def _check_difficult_subject_timing(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if difficult subject scheduled in afternoon (soft constraint)."""
        violations = []

        # Check source subject at target slot
        source_subject = self.subjects.get(source.subjectId, {})
        if source_subject.get("isDifficult"):
            if self._is_afternoon_period(request.target_slot.period):
                violations.append(
                    ConstraintViolation(
                        type="DIFFICULT_AFTERNOON",
                        severity="soft",
                        message=f"Difficult subject {source_subject.get('name', source.subjectId)} scheduled in afternoon",
                        message_farsi=f"درس سخت {source_subject.get('name', source.subjectId)} در بعد از ظهر برنامه‌ریزی شده است",
                        details={
                            "subjectId": source.subjectId,
                            "subjectName": source_subject.get("name"),
                            "period": request.target_slot.period,
                        },
                    )
                )

        # Check target subject at source slot (only if target exists)
        if target:
            target_subject = self.subjects.get(target.subjectId, {})
            if target_subject.get("isDifficult"):
                if self._is_afternoon_period(request.source_slot.period):
                    violations.append(
                        ConstraintViolation(
                            type="DIFFICULT_AFTERNOON",
                            severity="soft",
                            message=f"Difficult subject {target_subject.get('name', target.subjectId)} scheduled in afternoon",
                            message_farsi=f"درس سخت {target_subject.get('name', target.subjectId)} در بعد از ظهر برنامه‌ریزی شده است",
                            details={
                                "subjectId": target.subjectId,
                                "subjectName": target_subject.get("name"),
                                "period": request.source_slot.period,
                            },
                        )
                    )

        return violations

    def _is_afternoon_period(self, period: int) -> bool:
        """Check if period is in the afternoon (period index 4 and later)."""
        return period >= 4

    def _check_teacher_preferences(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[ConstraintViolation]:
        """Check if swap violates teacher time preferences (soft constraint)."""
        violations = []

        # Check source teacher preference at target slot
        source_teacher = self.teachers.get(source.teacherId, {})
        time_pref = source_teacher.get("timePreference")

        if time_pref == "Morning" and self._is_afternoon_period(
            request.target_slot.period
        ):
            violations.append(
                ConstraintViolation(
                    type="TEACHER_PREFERENCE",
                    severity="soft",
                    message=f"Teacher {source_teacher.get('fullName', source.teacherId)} prefers morning but would be scheduled in afternoon",
                    message_farsi=f"استاد {source_teacher.get('fullName', source.teacherId)} صبح را ترجیح می‌دهد اما در بعد از ظهر برنامه‌ریزی می‌شود",
                    details={
                        "teacherId": source.teacherId,
                        "teacherName": source_teacher.get("fullName"),
                        "preference": time_pref,
                        "period": request.target_slot.period,
                    },
                )
            )
        elif time_pref == "Afternoon" and not self._is_afternoon_period(
            request.target_slot.period
        ):
            violations.append(
                ConstraintViolation(
                    type="TEACHER_PREFERENCE",
                    severity="soft",
                    message=f"Teacher {source_teacher.get('fullName', source.teacherId)} prefers afternoon but would be scheduled in morning",
                    message_farsi=f"استاد {source_teacher.get('fullName', source.teacherId)} بعد از ظهر را ترجیح می‌دهد اما در صبح برنامه‌ریزی می‌شود",
                    details={
                        "teacherId": source.teacherId,
                        "teacherName": source_teacher.get("fullName"),
                        "preference": time_pref,
                        "period": request.target_slot.period,
                    },
                )
            )

        # Check target teacher preference at source slot (only if target exists)
        if target:
            target_teacher = self.teachers.get(target.teacherId, {})
            time_pref = target_teacher.get("timePreference")

            if time_pref == "Morning" and self._is_afternoon_period(
                request.source_slot.period
            ):
                violations.append(
                    ConstraintViolation(
                        type="TEACHER_PREFERENCE",
                        severity="soft",
                        message=f"Teacher {target_teacher.get('fullName', target.teacherId)} prefers morning but would be scheduled in afternoon",
                        message_farsi=f"استاد {target_teacher.get('fullName', target.teacherId)} صبح را ترجیح می‌دهد اما در بعد از ظهر برنامه‌ریزی می‌شود",
                        details={
                            "teacherId": target.teacherId,
                            "teacherName": target_teacher.get("fullName"),
                            "preference": time_pref,
                            "period": request.source_slot.period,
                        },
                    )
                )
            elif time_pref == "Afternoon" and not self._is_afternoon_period(
                request.source_slot.period
            ):
                violations.append(
                    ConstraintViolation(
                        type="TEACHER_PREFERENCE",
                        severity="soft",
                        message=f"Teacher {target_teacher.get('fullName', target.teacherId)} prefers afternoon but would be scheduled in morning",
                        message_farsi=f"استاد {target_teacher.get('fullName', target.teacherId)} بعد از ظهر را ترجیح می‌دهد اما در صبح برنامه‌ریزی می‌شود",
                        details={
                            "teacherId": target.teacherId,
                            "teacherName": target_teacher.get("fullName"),
                            "preference": time_pref,
                            "period": request.source_slot.period,
                        },
                    )
                )

        return violations

    def _find_minimal_disruption_solution(
        self, source: Lesson, target: Optional[Lesson], request: SwapRequest
    ) -> List[LessonMove]:
        """Find minimal number of lesson moves for the swap."""
        moves = []

        # Always move source lesson to target slot
        moves.append(
            LessonMove(
                class_id=source.classId,
                subject_id=source.subjectId,
                teacher_id=source.teacherId,
                room_id=source.roomId,
                from_day=source.day,
                from_period=source.periodIndex,
                to_day=request.target_slot.day,
                to_period=request.target_slot.period,
            )
        )

        # Only move target lesson if it exists (not swapping to empty slot)
        if target:
            moves.append(
                LessonMove(
                    class_id=target.classId,
                    subject_id=target.subjectId,
                    teacher_id=target.teacherId,
                    room_id=target.roomId,
                    from_day=target.day,
                    from_period=target.periodIndex,
                    to_day=request.source_slot.day,
                    to_period=request.source_slot.period,
                )
            )

        return moves
