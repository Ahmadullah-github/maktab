# ==============================================================================
#
#  Quality Scorer for Timetable Solver
#
#  Description:
#  Calculates quality metrics for generated timetables. Evaluates soft constraint
#  satisfaction and provides actionable suggestions for improvement.
#
#  Requirements: 4.1, 4.2
#
# ==============================================================================

from typing import Any, Dict, List, Optional, Set, Tuple
from collections import defaultdict

from models.input import TimetableData, DayOfWeek
from models.output import ScheduledLesson
from feedback.response_models import (
    AffectedEntity,
    QualityBreakdown,
    QualityScore,
    Suggestion,
)


# ==============================================================================
# Penalty Constants
# ==============================================================================

TEACHER_GAP_PENALTY = 2
AFTERNOON_DIFFICULT_PENALTY = 3
SAME_DAY_REPETITION_PENALTY = 1
UNBALANCED_LOAD_PENALTY = 5

# Base score from which penalties are subtracted
BASE_SCORE = 100

# Threshold for generating suggestions
SUGGESTION_THRESHOLD = 70

# Period index threshold for "afternoon" (periods after this are afternoon)
# Typically periods 0-3 are morning, 4+ are afternoon
AFTERNOON_PERIOD_THRESHOLD = 4


class QualityScorer:
    """
    Calculates quality metrics for generated timetables.
    
    The quality score starts at 100 and penalties are subtracted based on:
    - Teacher gaps (free periods between teaching periods on same day)
    - Difficult subjects scheduled in afternoon
    - Same subject appearing multiple times on same day for a class
    - Unbalanced teacher workload distribution
    
    Attributes:
        schedule: List of scheduled lessons
        data: Input timetable data with configuration
    """
    
    def __init__(
        self,
        schedule: List[ScheduledLesson],
        data: TimetableData
    ):
        """
        Initialize the quality scorer.
        
        Args:
            schedule: List of scheduled lessons from solver
            data: Input timetable data with teachers, subjects, classes, etc.
        """
        self.schedule = schedule
        self.data = data
        
        # Build lookup maps for efficient access
        self._teacher_map = {t.id: t for t in data.teachers}
        self._subject_map = {s.id: s for s in data.subjects}
        self._class_map = {c.id: c for c in data.classes}
        
    def calculate(self) -> QualityScore:
        """
        Calculate overall quality score with breakdown.
        
        Returns:
            QualityScore with overall score (0-100), breakdown, and suggestions
        """
        # Calculate each component
        teacher_gaps = self._count_teacher_gaps()
        afternoon_difficult = self._count_afternoon_difficult()
        same_day_repetition = self._count_same_day_repetition()
        load_balance = self._calculate_load_balance()
        
        # Build breakdown
        breakdown = QualityBreakdown(
            teacher_gaps=teacher_gaps,
            afternoon_difficult_subjects=afternoon_difficult,
            same_day_subject_repetition=same_day_repetition,
            teacher_load_balance=load_balance,
        )
        
        # Calculate overall score
        total_penalty = (
            teacher_gaps["penalty"] +
            afternoon_difficult["penalty"] +
            same_day_repetition["penalty"] +
            load_balance["penalty"]
        )
        overall = max(0, min(100, BASE_SCORE - total_penalty))
        
        # Generate suggestions if score is low
        suggestions = self._generate_suggestions(breakdown, overall)
        
        return QualityScore(
            overall=overall,
            breakdown=breakdown,
            suggestions=suggestions,
        )
    
    def _count_teacher_gaps(self) -> Dict[str, Any]:
        """
        Count gaps in teacher schedules.
        
        A gap is a free period between two teaching periods on the same day.
        
        Returns:
            Dict with count, penalty, and details of gaps
        """
        # Group lessons by teacher and day
        teacher_day_periods: Dict[str, Dict[str, List[int]]] = defaultdict(
            lambda: defaultdict(list)
        )
        
        for lesson in self.schedule:
            for teacher_id in lesson.teacherIds:
                day_key = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
                teacher_day_periods[teacher_id][day_key].append(lesson.periodIndex)
        
        total_gaps = 0
        details: List[Dict[str, Any]] = []
        
        for teacher_id, day_periods in teacher_day_periods.items():
            teacher = self._teacher_map.get(teacher_id)
            teacher_name = teacher.fullName if teacher else teacher_id
            
            for day, periods in day_periods.items():
                if len(periods) < 2:
                    continue
                    
                sorted_periods = sorted(periods)
                gaps_on_day = 0
                
                for i in range(len(sorted_periods) - 1):
                    gap = sorted_periods[i + 1] - sorted_periods[i] - 1
                    if gap > 0:
                        gaps_on_day += gap
                
                if gaps_on_day > 0:
                    total_gaps += gaps_on_day
                    details.append({
                        "teacherId": teacher_id,
                        "teacherName": teacher_name,
                        "day": day,
                        "gapCount": gaps_on_day,
                        "periods": sorted_periods,
                    })
        
        return {
            "count": total_gaps,
            "penalty": total_gaps * TEACHER_GAP_PENALTY,
            "details": details,
        }
    
    def _count_afternoon_difficult(self) -> Dict[str, Any]:
        """
        Count difficult subjects scheduled in afternoon.
        
        Difficult subjects (isDifficult=True) should ideally be scheduled
        in the morning when students are more alert.
        
        Returns:
            Dict with count, penalty, and details
        """
        count = 0
        details: List[Dict[str, Any]] = []
        
        for lesson in self.schedule:
            subject = self._subject_map.get(lesson.subjectId)
            if not subject or not subject.isDifficult:
                continue
                
            if lesson.periodIndex >= AFTERNOON_PERIOD_THRESHOLD:
                count += 1
                cls = self._class_map.get(lesson.classId)
                class_name = cls.name if cls else lesson.classId
                
                day_key = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
                
                details.append({
                    "subjectId": lesson.subjectId,
                    "subjectName": subject.name,
                    "classId": lesson.classId,
                    "className": class_name,
                    "day": day_key,
                    "periodIndex": lesson.periodIndex,
                })
        
        return {
            "count": count,
            "penalty": count * AFTERNOON_DIFFICULT_PENALTY,
            "details": details,
        }
    
    def _count_same_day_repetition(self) -> Dict[str, Any]:
        """
        Count same subject appearing multiple times on same day for a class.
        
        While sometimes necessary, having the same subject multiple times
        in one day can be suboptimal for learning.
        
        Returns:
            Dict with count, penalty, and details
        """
        # Group by class, day, and subject
        class_day_subjects: Dict[str, Dict[str, Dict[str, int]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(int))
        )
        
        for lesson in self.schedule:
            day_key = lesson.day.value if isinstance(lesson.day, DayOfWeek) else str(lesson.day)
            class_day_subjects[lesson.classId][day_key][lesson.subjectId] += 1
        
        repetition_count = 0
        details: List[Dict[str, Any]] = []
        
        for class_id, day_subjects in class_day_subjects.items():
            cls = self._class_map.get(class_id)
            class_name = cls.name if cls else class_id
            
            for day, subjects in day_subjects.items():
                for subject_id, count in subjects.items():
                    if count > 1:
                        # Count extra occurrences (beyond the first)
                        extra = count - 1
                        repetition_count += extra
                        
                        subject = self._subject_map.get(subject_id)
                        subject_name = subject.name if subject else subject_id
                        
                        details.append({
                            "classId": class_id,
                            "className": class_name,
                            "subjectId": subject_id,
                            "subjectName": subject_name,
                            "day": day,
                            "occurrences": count,
                        })
        
        return {
            "count": repetition_count,
            "penalty": repetition_count * SAME_DAY_REPETITION_PENALTY,
            "details": details,
        }
    
    def _calculate_load_balance(self) -> Dict[str, Any]:
        """
        Calculate teacher workload balance.
        
        Measures variance in teacher period counts relative to their
        maximum allowed periods. High variance indicates unbalanced load.
        
        Returns:
            Dict with variance and penalty
        """
        # Count periods per teacher
        teacher_periods: Dict[str, int] = defaultdict(int)
        
        for lesson in self.schedule:
            for teacher_id in lesson.teacherIds:
                teacher_periods[teacher_id] += 1
        
        if not teacher_periods:
            return {"variance": 0.0, "penalty": 0}
        
        # Calculate utilization ratios (actual / max)
        utilization_ratios: List[float] = []
        
        for teacher_id, period_count in teacher_periods.items():
            teacher = self._teacher_map.get(teacher_id)
            if teacher and teacher.maxPeriodsPerWeek > 0:
                ratio = period_count / teacher.maxPeriodsPerWeek
                utilization_ratios.append(ratio)
        
        if not utilization_ratios:
            return {"variance": 0.0, "penalty": 0}
        
        # Calculate variance
        mean_ratio = sum(utilization_ratios) / len(utilization_ratios)
        variance = sum((r - mean_ratio) ** 2 for r in utilization_ratios) / len(utilization_ratios)
        
        # Penalty based on variance (higher variance = higher penalty)
        # Scale variance to a reasonable penalty range
        penalty = int(variance * 100 * UNBALANCED_LOAD_PENALTY)
        
        return {
            "variance": round(variance, 4),
            "penalty": penalty,
        }
    
    def _generate_suggestions(
        self,
        breakdown: QualityBreakdown,
        overall: int
    ) -> List[Suggestion]:
        """
        Generate actionable suggestions based on quality breakdown.
        
        Suggestions are generated when overall score is below threshold,
        focusing on the highest penalty categories.
        
        Args:
            breakdown: Quality breakdown with component scores
            overall: Overall quality score
            
        Returns:
            List of suggestions for improvement
        """
        if overall >= SUGGESTION_THRESHOLD:
            return []
        
        suggestions: List[Suggestion] = []
        
        # Find highest penalty category
        penalties = [
            ("teacher_gaps", breakdown.teacher_gaps["penalty"], breakdown.teacher_gaps),
            ("afternoon_difficult", breakdown.afternoon_difficult_subjects["penalty"], breakdown.afternoon_difficult_subjects),
            ("same_day_repetition", breakdown.same_day_subject_repetition["penalty"], breakdown.same_day_subject_repetition),
            ("load_balance", breakdown.teacher_load_balance["penalty"], breakdown.teacher_load_balance),
        ]
        
        # Sort by penalty descending
        penalties.sort(key=lambda x: x[1], reverse=True)
        
        for category, penalty, data in penalties:
            if penalty <= 0:
                continue
                
            suggestion = self._create_suggestion_for_category(category, data)
            if suggestion:
                suggestions.append(suggestion)
                # Generate at least one suggestion, but can add more if needed
                if len(suggestions) >= 1:
                    break
        
        return suggestions
    
    def _create_suggestion_for_category(
        self,
        category: str,
        data: Dict[str, Any]
    ) -> Optional[Suggestion]:
        """
        Create a suggestion for a specific penalty category.
        
        Args:
            category: Category name
            data: Category data with details
            
        Returns:
            Suggestion or None if no suggestion can be made
        """
        if category == "teacher_gaps" and data.get("details"):
            detail = data["details"][0]
            return Suggestion(
                suggestion_code="REDUCE_TEACHER_GAPS",
                message_farsi=f"برای کاهش ساعات خالی، برنامه استاد {detail['teacherName']} را در روز {detail['day']} فشرده‌تر کنید",
                affected_entities=[
                    AffectedEntity(
                        entity_type="teacher",
                        entity_id=detail["teacherId"],
                        entity_name=detail["teacherName"],
                    )
                ],
                expected_improvement=min(data["penalty"], 10),
            )
        
        elif category == "afternoon_difficult" and data.get("details"):
            detail = data["details"][0]
            return Suggestion(
                suggestion_code="MOVE_DIFFICULT_TO_MORNING",
                message_farsi=f"مضمون {detail['subjectName']} را برای صنف {detail['className']} به صبح انتقال دهید برای نتیجه بهتر",
                affected_entities=[
                    AffectedEntity(
                        entity_type="class",
                        entity_id=detail["classId"],
                        entity_name=detail["className"],
                    ),
                    AffectedEntity(
                        entity_type="subject",
                        entity_id=detail["subjectId"],
                        entity_name=detail["subjectName"],
                    ),
                ],
                expected_improvement=min(data["penalty"], 10),
            )
        
        elif category == "same_day_repetition" and data.get("details"):
            detail = data["details"][0]
            return Suggestion(
                suggestion_code="SPREAD_SUBJECT_ACROSS_DAYS",
                message_farsi=f"مضمون {detail['subjectName']} را برای صنف {detail['className']} در روزهای مختلف پخش کنید",
                affected_entities=[
                    AffectedEntity(
                        entity_type="class",
                        entity_id=detail["classId"],
                        entity_name=detail["className"],
                    ),
                    AffectedEntity(
                        entity_type="subject",
                        entity_id=detail["subjectId"],
                        entity_name=detail["subjectName"],
                    ),
                ],
                expected_improvement=min(data["penalty"], 10),
            )
        
        elif category == "load_balance":
            return Suggestion(
                suggestion_code="BALANCE_TEACHER_LOAD",
                message_farsi="توزیع ساعات تدریس بین استادان را متعادل‌تر کنید",
                affected_entities=[],
                expected_improvement=min(data["penalty"], 10),
            )
        
        return None
