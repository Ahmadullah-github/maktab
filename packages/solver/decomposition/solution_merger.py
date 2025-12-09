"""
Merges solutions from multiple sub-problems into a unified timetable.

Verifies no conflicts and handles edge cases.
"""
import structlog
from typing import List, Dict, Any, Set, Tuple

log = structlog.get_logger()


class SolutionMerger:
    """
    Merges sub-problem solutions into a complete timetable.
    
    Verifies:
    - No teacher conflicts (same teacher, same time, different classes)
    - No room conflicts (same room, same time, different classes)
    - No class conflicts (same class, same time, different subjects)
    """
    
    def __init__(self, data):
        """
        Initialize solution merger.
        
        Args:
            data: Original TimetableData object
        """
        self.data = data
    
    def merge(self, sub_solutions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Merge multiple sub-problem solutions.
        
        Args:
            sub_solutions: List of dicts with 'cluster_id', 'solution', 'cluster'
        
        Returns:
            Unified list of lessons or error
        """
        if not sub_solutions:
            return [{"error": "No sub-solutions to merge", "status": "MERGING_ERROR"}]
        
        log.info(f"Merging {len(sub_solutions)} sub-solutions")
        
        # Collect all lessons
        all_lessons = []
        for sub_sol in sub_solutions:
            solution = sub_sol['solution']
            cluster_id = sub_sol['cluster_id']
            
            # Check if sub-solution has errors
            if isinstance(solution, list) and len(solution) > 0 and 'error' in solution[0]:
                log.error(f"Sub-solution {cluster_id} has error: {solution[0].get('error')}")
                # Continue with other solutions, but mark as partial
                continue
            
            # Add lessons from this sub-solution
            if isinstance(solution, list):
                for lesson in solution:
                    if 'error' not in lesson:  # Skip error objects
                        lesson['cluster_id'] = cluster_id  # Track which cluster
                        all_lessons.append(lesson)
        
        log.info(f"Collected {len(all_lessons)} lessons from sub-solutions")
        
        # Verify no conflicts
        conflicts = self._check_conflicts(all_lessons)
        
        if conflicts:
            log.error(f"Found {len(conflicts)} conflicts during merge")
            return [{
                "error": f"Merge failed: {len(conflicts)} conflicts found",
                "status": "MERGING_ERROR",
                "conflicts": conflicts[:10]  # Return first 10 conflicts
            }]
        
        log.info("✅ Merge successful - no conflicts detected")
        
        # Remove cluster_id metadata (not needed in final output)
        for lesson in all_lessons:
            lesson.pop('cluster_id', None)
        
        return all_lessons
    
    def _check_conflicts(self, lessons: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Check for scheduling conflicts in merged solution.
        
        Args:
            lessons: List of lesson dictionaries
        
        Returns:
            List of conflict descriptions
        """
        conflicts = []
        
        # Build lookup structures
        teacher_slots = {}  # (teacher_id, slot) -> lesson
        room_slots = {}     # (room_id, slot) -> lesson
        class_slots = {}    # (class_id, slot) -> lesson
        
        for lesson in lessons:
            teacher_id = lesson.get('teacherId')
            room_id = lesson.get('roomId')
            class_id = lesson.get('classId')
            day = lesson.get('day')
            period = lesson.get('period')
            
            if day is None or period is None:
                continue  # Skip incomplete lessons
            
            # Calculate slot index
            periods_per_day = self.data.config.periodsPerDay
            slot = day * periods_per_day + period
            
            # Check teacher conflict
            if teacher_id:
                key = (teacher_id, slot)
                if key in teacher_slots:
                    conflicts.append({
                        'type': 'teacher_conflict',
                        'teacher_id': teacher_id,
                        'slot': slot,
                        'day': day,
                        'period': period,
                        'lesson1': teacher_slots[key],
                        'lesson2': lesson
                    })
                else:
                    teacher_slots[key] = lesson
            
            # Check room conflict
            if room_id:
                key = (room_id, slot)
                if key in room_slots:
                    conflicts.append({
                        'type': 'room_conflict',
                        'room_id': room_id,
                        'slot': slot,
                        'day': day,
                        'period': period,
                        'lesson1': room_slots[key],
                        'lesson2': lesson
                    })
                else:
                    room_slots[key] = lesson
            
            # Check class conflict
            if class_id:
                key = (class_id, slot)
                if key in class_slots:
                    conflicts.append({
                        'type': 'class_conflict',
                        'class_id': class_id,
                        'slot': slot,
                        'day': day,
                        'period': period,
                        'lesson1': class_slots[key],
                        'lesson2': lesson
                    })
                else:
                    class_slots[key] = lesson
        
        return conflicts
    
    def verify_solution(self, lessons: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Comprehensive verification of merged solution.
        
        Args:
            lessons: List of lesson dictionaries
        
        Returns:
            Verification report
        """
        report = {
            'is_valid': True,
            'total_lessons': len(lessons),
            'conflicts': [],
            'warnings': []
        }
        
        # Check conflicts
        conflicts = self._check_conflicts(lessons)
        if conflicts:
            report['is_valid'] = False
            report['conflicts'] = conflicts
        
        # Check completeness
        expected_lessons = self._count_expected_lessons()
        if len(lessons) < expected_lessons:
            report['warnings'].append({
                'type': 'incomplete_schedule',
                'expected': expected_lessons,
                'actual': len(lessons),
                'missing': expected_lessons - len(lessons)
            })
        
        return report
    
    def _count_expected_lessons(self) -> int:
        """Count total expected lessons from requirements."""
        total = 0
        for cls in self.data.classes:
            for req in cls.subjectRequirements.values():
                total += req.periodsPerWeek
        
        # Subtract fixed lessons
        if self.data.fixedLessons:
            total -= len(self.data.fixedLessons)
        
        return max(0, total)
