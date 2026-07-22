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
        self.fixed_lessons = data.fixedLessons
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

    @staticmethod
    def _lesson_identity(lesson: Lesson) -> tuple:
        return (
            lesson.classId,
            lesson.subjectId,
            tuple(sorted(lesson.teacherIds)),
            lesson.roomId,
            lesson.isFixed,
        )

    @staticmethod
    def _dedupe_violations(
        violations: List[ConstraintViolation],
    ) -> List[ConstraintViolation]:
        unique: List[ConstraintViolation] = []
        seen = set()
        for violation in violations:
            key = (
                violation.type,
                violation.severity,
                violation.message,
                str(sorted(violation.details.items())),
            )
            if key not in seen:
                seen.add(key)
                unique.append(violation)
        return unique

    def _check_fixed_lesson_anchors(
        self, lessons: List[Lesson]
    ) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        remaining = list(lessons)
        for anchor in self.fixed_lessons:
            # Identical lessons can occur more than once. Consume an unchanged
            # instance first so input ordering cannot create a false move.
            match_index = next(
                (
                    index
                    for index, lesson in enumerate(remaining)
                    if self._lesson_identity(lesson) == self._lesson_identity(anchor)
                    and lesson.day == anchor.day
                    and lesson.periodIndex == anchor.periodIndex
                ),
                None,
            )
            if match_index is not None:
                remaining.pop(match_index)
                continue

            match_index = next(
                (
                    index
                    for index, lesson in enumerate(remaining)
                    if self._lesson_identity(lesson) == self._lesson_identity(anchor)
                ),
                None,
            )
            if match_index is None:
                violations.append(
                    ConstraintViolation(
                        type="FIXED_LESSON_CHANGED",
                        severity="hard",
                        message="A fixed lesson was removed or its identity was changed",
                        message_farsi="یک درس ثابت حذف شده یا مشخصات آن تغییر کرده است",
                        details={
                            "classId": anchor.classId,
                            "subjectId": anchor.subjectId,
                        },
                    )
                )
                continue

            lesson = remaining.pop(match_index)
            if lesson.day != anchor.day or lesson.periodIndex != anchor.periodIndex:
                violations.append(
                    ConstraintViolation(
                        type="FIXED_LESSON_MOVED",
                        severity="hard",
                        message="Fixed lessons cannot be moved",
                        message_farsi="درس‌های ثابت قابل جابه‌جایی نیستند",
                        details={
                            "classId": anchor.classId,
                            "subjectId": anchor.subjectId,
                            "day": anchor.day,
                            "period": anchor.periodIndex,
                        },
                    )
                )
        return violations

    def _check_consecutive_constraints(
        self, lessons: List[Lesson]
    ) -> List[ConstraintViolation]:
        violations: List[ConstraintViolation] = []
        groups: Dict[tuple, List[Lesson]] = {}
        for lesson in lessons:
            groups.setdefault(
                (lesson.classId, lesson.subjectId, lesson.day), []
            ).append(lesson)

        allow_consecutive = self.config.get(
            "allowConsecutivePeriodsForSameSubject", True
        ) is not False
        for (class_id, subject_id, day), group in groups.items():
            occupied = sorted(
                period
                for lesson in group
                for period in range(
                    lesson.periodIndex,
                    lesson.periodIndex + max(1, lesson.duration),
                )
            )
            if len(occupied) > 2:
                violations.append(
                    ConstraintViolation(
                        type="MAX_DAILY_SUBJECT_PERIODS_EXCEEDED",
                        severity="hard",
                        message="A subject may use at most two periods per class per day",
                        message_farsi="یک مضمون در هر صنف حداکثر دو ساعت در روز می‌تواند داشته باشد",
                        details={
                            "classId": class_id,
                            "subjectId": subject_id,
                            "day": day,
                            "periodCount": len(occupied),
                        },
                    )
                )
            elif len(occupied) > 1 and not allow_consecutive:
                violations.append(
                    ConstraintViolation(
                        type="CONSECUTIVE_PERIODS_DISABLED",
                        severity="hard",
                        message="Consecutive periods for the same subject are disabled",
                        message_farsi="ساعات متوالی برای یک مضمون غیرفعال است",
                        details={
                            "classId": class_id,
                            "subjectId": subject_id,
                            "day": day,
                        },
                    )
                )
            elif len(occupied) == 2 and occupied[1] != occupied[0] + 1:
                violations.append(
                    ConstraintViolation(
                        type="NON_CONSECUTIVE_SUBJECT_PERIODS",
                        severity="hard",
                        message="Two same-day periods of a subject must be adjacent",
                        message_farsi="دو ساعت یک مضمون در یک روز باید پی‌هم باشند",
                        details={
                            "classId": class_id,
                            "subjectId": subject_id,
                            "day": day,
                            "periods": occupied,
                        },
                    )
                )
        return violations

    def _validate_entire_schedule(
        self, lessons: Optional[List[Lesson]] = None
    ) -> List[ConstraintViolation]:
        schedule = list(lessons if lessons is not None else self.assignments)
        violations: List[ConstraintViolation] = []
        valid_days = set(self.config.get("daysOfWeek") or [])

        for lesson in schedule:
            duration = max(1, lesson.duration)
            day_limit = self._day_period_limit(lesson.day)
            if (
                (valid_days and lesson.day not in valid_days)
                or day_limit is None
                or lesson.periodIndex < 0
                or lesson.periodIndex + duration > day_limit
            ):
                violations.append(
                    ConstraintViolation(
                        type="PERIOD_OUT_OF_BOUNDS",
                        severity="hard",
                        message="A lesson extends beyond the configured school day",
                        message_farsi="یک درس از محدودهٔ ساعات روز مکتب بیرون می‌رود",
                        details={
                            "classId": lesson.classId,
                            "day": lesson.day,
                            "period": lesson.periodIndex,
                            "duration": duration,
                            "periodLimit": day_limit,
                        },
                    )
                )
                continue

            for teacher_id in lesson.teacherIds:
                teacher = self.teachers.get(teacher_id)
                if not teacher:
                    violations.append(
                        ConstraintViolation(
                            type="MISSING_TEACHER",
                            severity="hard",
                            message=f"Teacher {teacher_id} is not active",
                            message_farsi=f"استاد {teacher_id} فعال نیست",
                            details={"teacherId": teacher_id},
                        )
                    )
                elif any(
                    not self._is_available(teacher, lesson.day, lesson.periodIndex + offset)
                    for offset in range(duration)
                ):
                    violations.append(
                        ConstraintViolation(
                            type="TEACHER_UNAVAILABLE",
                            severity="hard",
                            message="A teacher is unavailable for the full lesson",
                            message_farsi="استاد برای تمام مدت درس در دسترس نیست",
                            details={
                                "teacherId": teacher_id,
                                "day": lesson.day,
                                "period": lesson.periodIndex,
                                "duration": duration,
                            },
                        )
                    )

            subject = self.subjects.get(lesson.subjectId, {})
            class_group = self.classes.get(lesson.classId, {})
            if lesson.subjectId not in self.subjects:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_SUBJECT",
                        severity="hard",
                        message=f"Subject {lesson.subjectId} is not active",
                        message_farsi=f"مضمون {lesson.subjectId} فعال نیست",
                        details={"subjectId": lesson.subjectId},
                    )
                )
            if lesson.classId not in self.classes:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_CLASS",
                        severity="hard",
                        message=f"Class {lesson.classId} is not active",
                        message_farsi=f"صنف {lesson.classId} فعال نیست",
                        details={"classId": lesson.classId},
                    )
                )
            fixed_room_id = class_group.get("fixedRoomId")
            room = self.rooms.get(lesson.roomId) if lesson.roomId else None
            required_type = subject.get("requiredRoomType")
            required_features = set(subject.get("requiredFeatures") or [])
            subject_min_capacity = int(subject.get("minRoomCapacity") or 0)
            room_is_required = bool(
                fixed_room_id
                or required_type
                or required_features
                or subject_min_capacity > 0
            )

            if lesson.roomId and not room:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_ROOM",
                        severity="hard",
                        message=f"Room {lesson.roomId} is not active",
                        message_farsi=f"اتاق {lesson.roomId} فعال نیست",
                        details={"roomId": lesson.roomId},
                    )
                )
            elif not room and room_is_required:
                violations.append(
                    ConstraintViolation(
                        type="MISSING_REQUIRED_ROOM",
                        severity="hard",
                        message="The lesson requires an active room",
                        message_farsi="این درس به یک اتاق فعال نیاز دارد",
                        details={
                            "roomId": lesson.roomId,
                            "subjectId": lesson.subjectId,
                            "classId": lesson.classId,
                        },
                    )
                )
            elif room and fixed_room_id and lesson.roomId != fixed_room_id:
                violations.append(
                    ConstraintViolation(
                        type="FIXED_ROOM_MISMATCH",
                        severity="hard",
                        message="The class must use its fixed room",
                        message_farsi="صنف باید از اتاق ثابت خود استفاده کند",
                        details={
                            "classId": lesson.classId,
                            "requiredRoomId": fixed_room_id,
                            "actualRoomId": lesson.roomId,
                        },
                    )
                )
            elif room and not fixed_room_id:
                room_features = set(room.get("features") or [])
                min_capacity = max(
                    subject_min_capacity,
                    int(class_group.get("studentCount") or 0),
                )
                mismatch: Dict[str, Any] = {}
                if required_type and room.get("type") != required_type:
                    mismatch["requiredType"] = required_type
                    mismatch["actualType"] = room.get("type")
                if int(room.get("capacity") or 0) < min_capacity:
                    mismatch["requiredCapacity"] = min_capacity
                    mismatch["actualCapacity"] = int(room.get("capacity") or 0)
                missing_features = sorted(required_features - room_features)
                if missing_features:
                    mismatch["missingFeatures"] = missing_features
                if mismatch:
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_INCOMPATIBLE",
                            severity="hard",
                            message="The lesson room does not satisfy its hard requirements",
                            message_farsi="اتاق درس شرایط الزامی آن را برآورده نمی‌کند",
                            details={
                                "roomId": lesson.roomId,
                                "subjectId": lesson.subjectId,
                                **mismatch,
                            },
                        )
                    )
                if any(
                    self._slot_is_unavailable(
                        room, lesson.day, lesson.periodIndex + offset
                    )
                    for offset in range(duration)
                ):
                    violations.append(
                        ConstraintViolation(
                            type="ROOM_UNAVAILABLE",
                            severity="hard",
                            message="The room is unavailable for the full lesson",
                            message_farsi="اتاق برای تمام مدت درس در دسترس نیست",
                            details={
                                "roomId": lesson.roomId,
                                "day": lesson.day,
                                "period": lesson.periodIndex,
                                "duration": duration,
                            },
                        )
                    )

        for index, first in enumerate(schedule):
            for second in schedule[index + 1 :]:
                if first.day != second.day or not self._intervals_overlap(
                    first.periodIndex,
                    max(1, first.duration),
                    second.periodIndex,
                    max(1, second.duration),
                ):
                    continue
                conflict_type = None
                resource_id = None
                if first.classId == second.classId:
                    conflict_type = "CLASS_CONFLICT"
                    resource_id = first.classId
                elif set(first.teacherIds).intersection(second.teacherIds):
                    conflict_type = "TEACHER_CONFLICT"
                    resource_id = next(iter(set(first.teacherIds).intersection(second.teacherIds)))
                elif first.roomId and first.roomId == second.roomId:
                    conflict_type = "ROOM_CONFLICT"
                    resource_id = first.roomId
                if conflict_type:
                    violations.append(
                        ConstraintViolation(
                            type=conflict_type,
                            severity="hard",
                            message=f"{conflict_type.replace('_', ' ').title()} in timetable",
                            message_farsi="در جدول زمانی تداخل ایجاد شده است",
                            details={
                                "resourceId": resource_id,
                                "day": first.day,
                                "firstPeriod": first.periodIndex,
                                "secondPeriod": second.periodIndex,
                            },
                        )
                    )

        violations.extend(self._check_consecutive_constraints(schedule))
        violations.extend(self._check_fixed_lesson_anchors(schedule))
        return self._dedupe_violations(violations)

    def validate_schedule(self) -> SwapResolution:
        """Validate a complete edited timetable before persistence."""
        start_time = time.time()
        errors = self._validate_entire_schedule()
        return SwapResolution(
            is_valid=len(errors) == 0,
            can_proceed_with_warning=False,
            errors=errors,
            warnings=[],
            affected_lessons=[],
            total_moves=0,
            solve_time_ms=int((time.time() - start_time) * 1000),
        )

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

            for teacher_id in lesson.teacherIds:
                teacher = self.teachers.get(teacher_id)
                if not teacher:
                    violations.append(
                        ConstraintViolation(
                            type="MISSING_TEACHER",
                            severity="hard",
                            message=f"Teacher {teacher_id} is not active",
                            message_farsi=f"استاد {teacher_id} فعال نیست",
                            details={"teacherId": teacher_id},
                        )
                    )
                elif any(
                    not self._is_available(
                        teacher, destination_day, destination_period + offset
                    )
                    for offset in range(duration)
                ):
                    violations.append(
                        ConstraintViolation(
                            type="TEACHER_UNAVAILABLE",
                            severity="hard",
                            message=f"Teacher {teacher.get('fullName', teacher_id)} is unavailable for the full moved lesson",
                            message_farsi=f"استاد {teacher.get('fullName', teacher_id)} برای تمام مدت درس جابه‌جا شده در دسترس نیست",
                            details={
                                "teacherId": teacher_id,
                                "day": destination_day,
                                "period": destination_period,
                                "duration": duration,
                            },
                        )
                    )

            subject = self.subjects.get(lesson.subjectId, {})
            class_group = self.classes.get(lesson.classId, {})
            room = self.rooms.get(lesson.roomId) if lesson.roomId else None
            fixed_room_id = class_group.get("fixedRoomId")
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
            elif fixed_room_id and lesson.roomId != fixed_room_id:
                violations.append(
                    ConstraintViolation(
                        type="FIXED_ROOM_MISMATCH",
                        severity="hard",
                        message=f"Class {lesson.classId} must use its fixed room",
                        message_farsi=f"صنف {lesson.classId} باید از اتاق ثابت خود استفاده کند",
                        details={
                            "classId": lesson.classId,
                            "requiredRoomId": fixed_room_id,
                            "actualRoomId": lesson.roomId,
                        },
                    )
                )
            elif not fixed_room_id:
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
                elif set(existing.teacherIds).intersection(lesson.teacherIds):
                    conflict_type = "TEACHER_CONFLICT"
                    conflict_resource = next(
                        iter(set(existing.teacherIds).intersection(lesson.teacherIds))
                    )
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
                    or bool(set(first_lesson.teacherIds).intersection(second_lesson.teacherIds))
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

        # Validate the complete proposed draft, not only the two destination cells.
        # This keeps fixed lessons, consecutive rules, and every resource collision
        # under the same persistence-time contract.
        simulated_lessons: List[Lesson] = []
        for lesson in self.assignments:
            if lesson is source_lesson:
                simulated_lessons.append(
                    lesson.model_copy(
                        update={
                            "day": swap_request.target_slot.day,
                            "periodIndex": swap_request.target_slot.period,
                        }
                    )
                )
            elif target_lesson is not None and lesson is target_lesson:
                simulated_lessons.append(
                    lesson.model_copy(
                        update={
                            "day": swap_request.source_slot.day,
                            "periodIndex": swap_request.source_slot.period,
                        }
                    )
                )
            else:
                simulated_lessons.append(lesson)

        errors.extend(self._validate_entire_schedule(simulated_lessons))

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
        source_has_fixed_room = bool(
            self.classes.get(source.classId, {}).get("fixedRoomId")
        )

        if required_room_type and source.roomId and not source_has_fixed_room:
            # When swapping to empty slot, check if source room type is still valid
            # (room doesn't change in swap to empty, so this is always valid)
            pass

        if required_room_type and target and target.roomId and not source_has_fixed_room:
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
            target_has_fixed_room = bool(
                self.classes.get(target.classId, {}).get("fixedRoomId")
            )

            if required_room_type and source.roomId and not target_has_fixed_room:
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
        for teacher_id in source.teacherIds:
            violations.extend(
                self._teacher_preference_violations(
                    teacher_id, request.target_slot.period
                )
            )

        # Check target teacher preference at source slot (only if target exists)
        if target:
            for teacher_id in target.teacherIds:
                violations.extend(
                    self._teacher_preference_violations(
                        teacher_id, request.source_slot.period
                    )
                )

        return violations

    def _teacher_preference_violations(
        self, teacher_id: str, destination_period: int
    ) -> List[ConstraintViolation]:
        teacher = self.teachers.get(teacher_id, {})
        preference = teacher.get("timePreference")
        violates = (
            preference == "Morning" and self._is_afternoon_period(destination_period)
        ) or (
            preference == "Afternoon"
            and not self._is_afternoon_period(destination_period)
        )
        if not violates:
            return []
        destination = "afternoon" if self._is_afternoon_period(destination_period) else "morning"
        return [
            ConstraintViolation(
                type="TEACHER_PREFERENCE",
                severity="soft",
                message=f"Teacher {teacher.get('fullName', teacher_id)} prefers {str(preference).lower()} but would be scheduled in {destination}",
                message_farsi=f"ترجیح زمانی استاد {teacher.get('fullName', teacher_id)} در جابه‌جایی رعایت نمی‌شود",
                details={
                    "teacherId": teacher_id,
                    "teacherName": teacher.get("fullName"),
                    "preference": preference,
                    "period": destination_period,
                },
            )
        ]

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
                teacher_ids=source.teacherIds,
                room_id=source.roomId,
                from_day=source.day,
                from_period=source.periodIndex,
                to_day=request.target_slot.day,
                to_period=request.target_slot.period,
                is_fixed=source.isFixed,
            )
        )

        # Only move target lesson if it exists (not swapping to empty slot)
        if target:
            moves.append(
                LessonMove(
                    class_id=target.classId,
                    subject_id=target.subjectId,
                    teacher_id=target.teacherId,
                    teacher_ids=target.teacherIds,
                    room_id=target.roomId,
                    from_day=target.day,
                    from_period=target.periodIndex,
                    to_day=request.source_slot.day,
                    to_period=request.source_slot.period,
                    is_fixed=target.isFixed,
                )
            )

        return moves
