"""Preference-aware quality reporting for generated timetables."""
from collections import defaultdict
from typing import Any, Dict, Iterable, List, Set, Tuple

from feedback.response_models import (
    AffectedEntity,
    ObjectiveResult,
    QualityBreakdown,
    QualityScore,
    Suggestion,
)
from models.input import DayOfWeek, TimetableData
from models.output import ScheduledLesson


WEIGHT_FIELDS = {
    "avoidTeacherGaps": "avoidTeacherGapsWeight",
    "avoidClassGaps": "avoidClassGapsWeight",
    "distributeDifficultSubjects": "distributeDifficultSubjectsWeight",
    "balanceTeacherLoad": "balanceTeacherLoadWeight",
    "minimizeRoomChanges": "minimizeRoomChangesWeight",
    "preferMorningForDifficult": "preferMorningForDifficultWeight",
    "respectTeacherTimePreference": "respectTeacherTimePreferenceWeight",
    "respectTeacherRoomPreference": "respectTeacherRoomPreferenceWeight",
    "respectPreferredColleagues": "respectPreferredColleaguesWeight",
    "preferClassHomeRoom": "preferClassHomeRoomWeight",
    "respectSubjectDesiredFeatures": "respectSubjectDesiredFeaturesWeight",
    "subjectSpread": "subjectSpreadWeight",
}


class QualityScorer:
    """Measure exactly the soft objectives selected by the headteacher."""

    def __init__(self, schedule: List[ScheduledLesson], data: TimetableData):
        self.schedule = schedule
        self.data = data
        self.days = [day.value if isinstance(day, DayOfWeek) else str(day) for day in data.config.daysOfWeek]
        self.teacher_map = {teacher.id: teacher for teacher in data.teachers}
        self.class_map = {group.id: group for group in data.classes}
        self.subject_map = {subject.id: subject for subject in data.subjects}
        self.room_map = {room.id: room for room in data.rooms}
        self.teacher_day: Dict[Tuple[str, str], Set[int]] = defaultdict(set)
        self.class_day: Dict[Tuple[str, str], Set[int]] = defaultdict(set)
        self.class_subject_day: Dict[Tuple[str, str, str], Set[int]] = defaultdict(set)
        for lesson in schedule:
            day = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            self.class_day[(lesson.classId, day)].add(lesson.periodIndex)
            self.class_subject_day[(lesson.classId, lesson.subjectId, day)].add(lesson.periodIndex)
            for teacher_id in lesson.teacherIds:
                self.teacher_day[(teacher_id, day)].add(lesson.periodIndex)

    def calculate(self) -> QualityScore:
        metrics = self._measure_all()
        results: List[ObjectiveResult] = []
        weighted_total = 0.0
        total_strength = 0.0
        preferences = self.data.preferences

        for key, field in WEIGHT_FIELDS.items():
            strength = float(getattr(preferences, field, 0) if preferences else 0)
            if strength <= 0:
                continue
            violation, opportunity, affected = metrics[key]
            denominator = max(opportunity, violation)
            satisfaction = 100 if denominator == 0 else round(100 * (1 - violation / denominator))
            satisfaction = max(0, min(100, satisfaction))
            result = ObjectiveResult(
                key=key,
                strength=strength,
                violation_units=violation,
                opportunity_units=opportunity,
                satisfaction_percent=satisfaction,
                affected_entities=affected[:5],
            )
            results.append(result)
            weighted_total += strength * satisfaction
            total_strength += strength

        overall = round(weighted_total / total_strength) if total_strength else 100
        suggestions = self._suggestions(results)

        # Preserve the former four fields while clients migrate to objective_results.
        legacy = QualityBreakdown(
            teacher_gaps=self._legacy_metric(metrics["avoidTeacherGaps"]),
            afternoon_difficult_subjects=self._legacy_metric(metrics["preferMorningForDifficult"]),
            same_day_subject_repetition=self._legacy_metric(metrics["subjectSpread"]),
            teacher_load_balance=self._legacy_metric(metrics["balanceTeacherLoad"]),
        )
        return QualityScore(
            overall=overall,
            breakdown=legacy,
            objective_results=results,
            suggestions=suggestions,
        )

    @staticmethod
    def _legacy_metric(metric: Tuple[int, int, List[AffectedEntity]]) -> Dict[str, Any]:
        violation, _opportunity, affected = metric
        return {"count": violation, "penalty": violation, "details": [item.model_dump() for item in affected[:5]]}

    def _measure_all(self) -> Dict[str, Tuple[int, int, List[AffectedEntity]]]:
        metrics: Dict[str, Tuple[int, int, List[AffectedEntity]]] = {}
        metrics["avoidTeacherGaps"] = self._gap_metric(self.teacher_day, "teacher", self.teacher_map)
        metrics["avoidClassGaps"] = self._gap_metric(self.class_day, "class", self.class_map)
        metrics["subjectSpread"] = self._subject_spread()
        metrics["distributeDifficultSubjects"] = self._difficult_distribution()
        metrics["balanceTeacherLoad"] = self._teacher_load_balance()
        metrics["preferMorningForDifficult"] = self._morning_difficult()
        metrics["respectTeacherTimePreference"] = self._teacher_time()
        metrics["respectTeacherRoomPreference"] = self._teacher_room()
        metrics["respectPreferredColleagues"] = self._preferred_colleagues()
        metrics["preferClassHomeRoom"] = self._home_room()
        metrics["respectSubjectDesiredFeatures"] = self._desired_features()
        metrics["minimizeRoomChanges"] = self._room_stability()
        return metrics

    def _entity(self, entity_type: str, entity_id: str, entity: Any) -> AffectedEntity:
        name = getattr(entity, "fullName", None) or getattr(entity, "name", None) or entity_id
        return AffectedEntity(entity_type=entity_type, entity_id=entity_id, entity_name=name)

    def _gap_metric(self, grouped, entity_type: str, lookup) -> Tuple[int, int, List[AffectedEntity]]:
        violations = opportunities = 0
        affected = []
        for (entity_id, _day), periods in grouped.items():
            ordered = sorted(periods)
            if len(ordered) < 2:
                continue
            gaps = sum(max(0, right - left - 1) for left, right in zip(ordered, ordered[1:]))
            opportunities += max(0, ordered[-1] - ordered[0] - 1)
            if gaps:
                violations += gaps
                affected.append(self._entity(entity_type, entity_id, lookup.get(entity_id)))
        return violations, opportunities, affected

    def _subject_spread(self):
        violations = opportunities = 0
        affected = []
        for (class_id, subject_id, _day), periods in self.class_subject_day.items():
            extra = max(0, len(periods) - 1)
            opportunities += len(periods)
            if extra:
                violations += extra
                affected.append(self._entity("class", class_id, self.class_map.get(class_id)))
        return violations, opportunities, affected

    def _difficult_distribution(self):
        difficult = {subject.id for subject in self.data.subjects if subject.isDifficult}
        per_day: Dict[Tuple[str, str], Set[str]] = defaultdict(set)
        for class_id, subject_id, day in self.class_subject_day:
            if subject_id in difficult:
                per_day[(class_id, day)].add(subject_id)
        violations = sum(max(0, len(subjects) - 1) for subjects in per_day.values())
        opportunities = sum(len(subjects) for subjects in per_day.values())
        affected = [
            self._entity("class", class_id, self.class_map.get(class_id))
            for (class_id, _day), subjects in per_day.items() if len(subjects) > 1
        ]
        return violations, opportunities, affected

    def _teacher_load_balance(self):
        violations = opportunities = 0
        affected = []
        for teacher_id, teacher in self.teacher_map.items():
            loads = [
                len(self.teacher_day.get((teacher_id, day), set()))
                for day in self.days
                if any(
                    self._teacher_is_available(teacher, day, period)
                    for period in range(self._periods_for_day(day))
                )
            ]
            if not loads:
                continue
            total = sum(loads)
            if not total:
                continue
            target = total // max(1, len(self.days))
            deviation = sum(abs(load - target) for load in loads)
            opportunities += total
            if deviation:
                violations += deviation
                affected.append(self._entity("teacher", teacher_id, teacher))
        return violations, opportunities, affected

    def _periods_for_day(self, day: str) -> int:
        mapping = self.data.config.periodsPerDayMap or {}
        for key, value in mapping.items():
            if (key.value if isinstance(key, DayOfWeek) else str(key)) == day:
                return value
        return self.data.config.periodsPerDay

    def _morning_difficult(self):
        violations = opportunities = 0
        affected = []
        for lesson in self.schedule:
            subject = self.subject_map.get(lesson.subjectId)
            if not subject or not subject.isDifficult:
                continue
            day = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            cutoff = max(1, (self._periods_for_day(day) + 1) // 2)
            opportunities += 1
            if lesson.periodIndex >= cutoff:
                violations += 1
                affected.append(self._entity("subject", lesson.subjectId, subject))
        return violations, opportunities, affected

    def _teacher_time(self):
        violations = opportunities = 0
        affected = []
        for lesson in self.schedule:
            day = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            cutoff = max(1, (self._periods_for_day(day) + 1) // 2)
            for teacher_id in lesson.teacherIds:
                teacher = self.teacher_map.get(teacher_id)
                preference = getattr(getattr(teacher, "timePreference", None), "value", getattr(teacher, "timePreference", None))
                if preference not in ("Morning", "Afternoon"):
                    continue
                opportunities += 1
                wrong = (preference == "Morning" and lesson.periodIndex >= cutoff) or (preference == "Afternoon" and lesson.periodIndex < cutoff)
                if wrong:
                    violations += 1
                    affected.append(self._entity("teacher", teacher_id, teacher))
        return violations, opportunities, affected

    def _teacher_room(self):
        violations = opportunities = 0
        affected = []
        for lesson in self.schedule:
            for teacher_id in lesson.teacherIds:
                teacher = self.teacher_map.get(teacher_id)
                preferred = set(getattr(teacher, "preferredRoomIds", None) or [])
                if not preferred:
                    continue
                opportunities += 1
                if lesson.roomId not in preferred:
                    violations += 1
                    affected.append(self._entity("teacher", teacher_id, teacher))
        return violations, opportunities, affected

    def _preferred_colleagues(self):
        pairs = set()
        for teacher_id, teacher in self.teacher_map.items():
            for colleague in teacher.preferredColleagues or []:
                if colleague in self.teacher_map and colleague != teacher_id:
                    pairs.add(tuple(sorted((teacher_id, colleague))))
        violations = opportunities = 0
        affected = []
        for left, right in pairs:
            pair_violations = 0
            for day in self.days:
                left_busy = self.teacher_day.get((left, day), set())
                right_busy = self.teacher_day.get((right, day), set())
                periods = self._periods_for_day(day)
                for period in range(periods):
                    if not (
                        self._teacher_is_available(self.teacher_map[left], day, period)
                        and self._teacher_is_available(self.teacher_map[right], day, period)
                    ):
                        continue
                    opportunities += 1
                    pair_violations += (period in left_busy) != (period in right_busy)
            if pair_violations:
                violations += pair_violations
                affected.append(self._entity("teacher", left, self.teacher_map[left]))
                affected.append(self._entity("teacher", right, self.teacher_map[right]))
        return violations, opportunities, affected

    @staticmethod
    def _teacher_is_available(teacher: Any, day: str, period: int) -> bool:
        availability = getattr(teacher, "availability", {}) or {}
        day_values = None
        for key, values in availability.items():
            normalized = key.value if isinstance(key, DayOfWeek) else str(key)
            if normalized == day:
                day_values = values
                break
        if day_values is not None and (
            period >= len(day_values) or not day_values[period]
        ):
            return False

        for slot in getattr(teacher, "unavailable", None) or []:
            slot_day = slot.day.value if isinstance(slot.day, DayOfWeek) else str(slot.day)
            if slot_day == day and period in slot.periods:
                return False
        return True

    def _home_room(self):
        violations = opportunities = 0
        affected = []
        for lesson in self.schedule:
            group = self.class_map.get(lesson.classId)
            home = getattr(group, "homeRoomId", None)
            if not home:
                continue
            opportunities += 1
            if lesson.roomId != home:
                violations += 1
                affected.append(self._entity("class", lesson.classId, group))
        return violations, opportunities, affected

    def _desired_features(self):
        violations = opportunities = 0
        affected = []
        for lesson in self.schedule:
            subject = self.subject_map.get(lesson.subjectId)
            desired = set(getattr(subject, "desiredFeatures", None) or [])
            if not desired:
                continue
            room = self.room_map.get(lesson.roomId)
            available = set(getattr(room, "features", None) or [])
            missing = len(desired - available)
            opportunities += len(desired)
            if missing:
                violations += missing
                affected.append(self._entity("subject", lesson.subjectId, subject))
        return violations, opportunities, affected

    def _room_stability(self):
        rooms: Dict[str, Set[str]] = defaultdict(set)
        for lesson in self.schedule:
            if lesson.roomId:
                rooms[lesson.classId].add(lesson.roomId)
        violations = sum(max(0, len(values) - 1) for values in rooms.values())
        opportunities = sum(len(values) for values in rooms.values())
        affected = [
            self._entity("class", class_id, self.class_map.get(class_id))
            for class_id, values in rooms.items() if len(values) > 1
        ]
        return violations, opportunities, affected

    def _suggestions(self, results: Iterable[ObjectiveResult]) -> List[Suggestion]:
        ranked = sorted(
            (result for result in results if result.violation_units > 0),
            key=lambda result: result.strength * (100 - result.satisfaction_percent),
            reverse=True,
        )[:3]
        return [
            Suggestion(
                suggestion_code=f"IMPROVE_{result.key.upper()}",
                message_key=f"quality.suggestions.{result.key}",
                message_params={"count": result.violation_units},
                message_farsi="این ترجیح در برخی ساعات برآورده نشد؛ داده‌های مرتبط را بررسی کنید.",
                message_english="This preference could not be fully satisfied; review the affected data.",
                affected_entities=result.affected_entities,
                expected_improvement=min(10, 100 - result.satisfaction_percent),
            )
            for result in ranked
        ]
