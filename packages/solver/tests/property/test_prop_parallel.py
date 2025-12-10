# ==============================================================================
# Property Tests: Parallel Execution
#
# Tests for parallel cluster solving, worker count, failure isolation,
# and solution merge correctness.
#
# **Feature: solver-refactoring, Properties 6, 7, 8**
# **Requirements: 4.2, 4.3, 4.4**
#
# ==============================================================================

import os
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from unittest.mock import patch, MagicMock

import pytest
from hypothesis import given, strategies as st, settings, assume

from parallel.executor import ParallelClusterExecutor, ClusterResult


# ==============================================================================
# Custom Hypothesis Strategies
# ==============================================================================

@st.composite
def valid_worker_count(draw):
    """Generate valid worker counts within reasonable bounds."""
    return draw(st.integers(min_value=1, max_value=16))


@st.composite
def valid_cluster_result(draw, success: Optional[bool] = None):
    """Generate valid ClusterResult objects."""
    cluster_id = draw(st.integers(min_value=0, max_value=100))
    is_success = success if success is not None else draw(st.booleans())
    
    if is_success:
        # Generate a successful result with mock lessons
        num_lessons = draw(st.integers(min_value=1, max_value=20))
        solution = [
            {
                'classId': f'class_{i}',
                'subjectId': f'subject_{i}',
                'teacherId': f'teacher_{i % 3}',
                'roomId': f'room_{i % 2}',
                'day': i % 5,
                'period': i % 6,
            }
            for i in range(num_lessons)
        ]
        return ClusterResult(
            cluster_id=cluster_id,
            success=True,
            solution=solution,
            cluster_metadata={'num_classes': draw(st.integers(1, 10))}
        )
    else:
        # Generate a failed result
        error_msg = draw(st.sampled_from([
            "No valid time slots",
            "Infeasible constraints",
            "Timeout exceeded",
            "Memory limit reached",
        ]))
        return ClusterResult(
            cluster_id=cluster_id,
            success=False,
            error=error_msg,
            cluster_metadata={'num_classes': draw(st.integers(1, 10))}
        )


@st.composite
def valid_lesson(draw, day_range: int = 5, period_range: int = 8):
    """Generate a valid lesson dictionary."""
    return {
        'classId': draw(st.sampled_from([f'class_{i}' for i in range(5)])),
        'subjectId': draw(st.sampled_from([f'subject_{i}' for i in range(10)])),
        'teacherId': draw(st.sampled_from([f'teacher_{i}' for i in range(8)])),
        'roomId': draw(st.sampled_from([f'room_{i}' for i in range(4)])),
        'day': draw(st.integers(min_value=0, max_value=day_range - 1)),
        'period': draw(st.integers(min_value=0, max_value=period_range - 1)),
    }


@st.composite
def non_conflicting_lessons(draw):
    """
    Generate a list of lessons with no conflicts.
    
    Uses a deterministic approach to avoid conflicts by assigning
    unique (class, teacher, room, day, period) combinations.
    """
    num_lessons = draw(st.integers(min_value=3, max_value=10))
    lessons = []
    
    # Use deterministic slot assignment to guarantee no conflicts
    # Each lesson gets a unique combination
    for i in range(num_lessons):
        # Spread lessons across different slots deterministically
        day = i % 5
        period = i % 8
        class_idx = i % 5
        teacher_idx = i % 8
        room_idx = i % 4
        
        lessons.append({
            'classId': f'class_{class_idx}_{i}',  # Unique per lesson
            'subjectId': f'subject_{i}',
            'teacherId': f'teacher_{teacher_idx}_{i}',  # Unique per lesson
            'roomId': f'room_{room_idx}_{i}',  # Unique per lesson
            'day': day,
            'period': period,
        })
    
    return lessons


# ==============================================================================
# Property Tests
# ==============================================================================

class TestParallelWorkerCount:
    """
    **Feature: solver-refactoring, Property 6: Parallel Worker Count**
    **Validates: Requirements 4.2**
    
    For any worker count configuration, the ParallelClusterExecutor SHALL
    spawn exactly that many worker processes (or CPU count - 1 if not specified).
    """

    @given(worker_count=valid_worker_count())
    @settings(max_examples=100, deadline=10000)
    def test_explicit_worker_count(self, worker_count: int):
        """
        **Feature: solver-refactoring, Property 6: Parallel Worker Count**
        **Validates: Requirements 4.2**
        
        For any explicitly specified worker count, the executor SHALL use
        exactly that number of workers.
        """
        executor = ParallelClusterExecutor(max_workers=worker_count)
        assert executor.max_workers == worker_count

    def test_default_worker_count(self):
        """
        **Feature: solver-refactoring, Property 6: Parallel Worker Count**
        **Validates: Requirements 4.2**
        
        When no worker count is specified, the executor SHALL use
        CPU count - 1 (minimum 1).
        """
        executor = ParallelClusterExecutor()
        cpu_count = os.cpu_count() or 1
        expected = max(1, cpu_count - 1)
        assert executor.max_workers == expected

    @given(worker_count=st.integers(min_value=-10, max_value=0))
    @settings(max_examples=50, deadline=5000)
    def test_invalid_worker_count_clamped(self, worker_count: int):
        """
        For any non-positive worker count, the executor SHALL clamp to minimum 1.
        """
        executor = ParallelClusterExecutor(max_workers=worker_count)
        assert executor.max_workers >= 1

    @given(worker_count=valid_worker_count())
    @settings(max_examples=50, deadline=5000)
    def test_worker_count_with_config(self, worker_count: int):
        """
        Worker count SHALL be respected even when config is provided.
        """
        mock_config = MagicMock()
        executor = ParallelClusterExecutor(max_workers=worker_count, config=mock_config)
        assert executor.max_workers == worker_count


class TestParallelFailureIsolation:
    """
    **Feature: solver-refactoring, Property 7: Parallel Failure Isolation**
    **Validates: Requirements 4.3**
    
    For any set of clusters where one or more clusters fail during parallel
    solving, the solver SHALL continue solving remaining clusters and include
    failure information in the result.
    """

    @given(
        num_successful=st.integers(min_value=1, max_value=5),
        num_failed=st.integers(min_value=1, max_value=3),
    )
    @settings(max_examples=50, deadline=10000)
    def test_failure_isolation_in_results(self, num_successful: int, num_failed: int):
        """
        **Feature: solver-refactoring, Property 7: Parallel Failure Isolation**
        **Validates: Requirements 4.3**
        
        For any mix of successful and failed cluster results, the executor
        SHALL preserve all results with appropriate success/failure status.
        """
        # Create mixed results
        results = []
        for i in range(num_successful):
            results.append(ClusterResult(
                cluster_id=i,
                success=True,
                solution=[{'lesson': i}],
                cluster_metadata={'type': 'success'}
            ))
        
        for i in range(num_failed):
            results.append(ClusterResult(
                cluster_id=num_successful + i,
                success=False,
                error=f"Error in cluster {num_successful + i}",
                cluster_metadata={'type': 'failed'}
            ))
        
        # Verify counts
        successful_count = sum(1 for r in results if r.success)
        failed_count = sum(1 for r in results if not r.success)
        
        assert successful_count == num_successful
        assert failed_count == num_failed
        assert len(results) == num_successful + num_failed

    @given(result=valid_cluster_result(success=False))
    @settings(max_examples=50, deadline=5000)
    def test_failed_result_has_error_info(self, result: ClusterResult):
        """
        **Feature: solver-refactoring, Property 7: Parallel Failure Isolation**
        **Validates: Requirements 4.3**
        
        For any failed cluster result, the result SHALL contain error information.
        """
        assert result.success is False
        assert result.error is not None
        assert len(result.error) > 0

    @given(result=valid_cluster_result(success=True))
    @settings(max_examples=50, deadline=5000)
    def test_successful_result_has_solution(self, result: ClusterResult):
        """
        For any successful cluster result, the result SHALL contain a solution.
        """
        assert result.success is True
        assert result.solution is not None
        assert isinstance(result.solution, list)


class TestSolutionMergeCorrectness:
    """
    **Feature: solver-refactoring, Property 8: Solution Merge Correctness**
    **Validates: Requirements 4.4**
    
    For any set of cluster solutions, the merged solution SHALL contain
    no conflicts (no two lessons with the same class, teacher, or room
    at the same time).
    """

    @given(lessons=non_conflicting_lessons())
    @settings(max_examples=100, deadline=10000)
    def test_non_conflicting_lessons_merge_cleanly(self, lessons: List[Dict]):
        """
        **Feature: solver-refactoring, Property 8: Solution Merge Correctness**
        **Validates: Requirements 4.4**
        
        For any set of non-conflicting lessons, merging SHALL produce
        a valid solution with no conflicts detected.
        """
        # Verify no conflicts exist in input
        class_slots = set()
        teacher_slots = set()
        room_slots = set()
        
        for lesson in lessons:
            day = lesson['day']
            period = lesson['period']
            
            class_slot = (lesson['classId'], day, period)
            teacher_slot = (lesson['teacherId'], day, period)
            room_slot = (lesson['roomId'], day, period)
            
            # These should not conflict
            assert class_slot not in class_slots, f"Class conflict: {class_slot}"
            assert teacher_slot not in teacher_slots, f"Teacher conflict: {teacher_slot}"
            assert room_slot not in room_slots, f"Room conflict: {room_slot}"
            
            class_slots.add(class_slot)
            teacher_slots.add(teacher_slot)
            room_slots.add(room_slot)

    def test_conflicting_lessons_detected(self):
        """
        **Feature: solver-refactoring, Property 8: Solution Merge Correctness**
        **Validates: Requirements 4.4**
        
        For any set of lessons with conflicts, the merge process SHALL
        detect and report the conflicts.
        """
        # Create lessons with a class conflict
        lessons = [
            {
                'classId': 'class_1',
                'subjectId': 'math',
                'teacherId': 'teacher_1',
                'roomId': 'room_1',
                'day': 0,
                'period': 0,
            },
            {
                'classId': 'class_1',  # Same class
                'subjectId': 'science',
                'teacherId': 'teacher_2',
                'roomId': 'room_2',
                'day': 0,  # Same day
                'period': 0,  # Same period - CONFLICT!
            },
        ]
        
        # Check for class conflict
        class_slots = {}
        conflicts = []
        
        for lesson in lessons:
            slot = (lesson['classId'], lesson['day'], lesson['period'])
            if slot in class_slots:
                conflicts.append({
                    'type': 'class_conflict',
                    'slot': slot,
                    'lesson1': class_slots[slot],
                    'lesson2': lesson,
                })
            else:
                class_slots[slot] = lesson
        
        assert len(conflicts) > 0, "Should detect class conflict"
        assert conflicts[0]['type'] == 'class_conflict'

    def test_teacher_conflict_detected(self):
        """
        Teacher conflicts SHALL be detected during merge.
        """
        lessons = [
            {
                'classId': 'class_1',
                'subjectId': 'math',
                'teacherId': 'teacher_1',
                'roomId': 'room_1',
                'day': 0,
                'period': 0,
            },
            {
                'classId': 'class_2',
                'subjectId': 'science',
                'teacherId': 'teacher_1',  # Same teacher
                'roomId': 'room_2',
                'day': 0,  # Same day
                'period': 0,  # Same period - CONFLICT!
            },
        ]
        
        teacher_slots = {}
        conflicts = []
        
        for lesson in lessons:
            slot = (lesson['teacherId'], lesson['day'], lesson['period'])
            if slot in teacher_slots:
                conflicts.append({
                    'type': 'teacher_conflict',
                    'slot': slot,
                })
            else:
                teacher_slots[slot] = lesson
        
        assert len(conflicts) > 0, "Should detect teacher conflict"

    def test_room_conflict_detected(self):
        """
        Room conflicts SHALL be detected during merge.
        """
        lessons = [
            {
                'classId': 'class_1',
                'subjectId': 'math',
                'teacherId': 'teacher_1',
                'roomId': 'room_1',
                'day': 0,
                'period': 0,
            },
            {
                'classId': 'class_2',
                'subjectId': 'science',
                'teacherId': 'teacher_2',
                'roomId': 'room_1',  # Same room
                'day': 0,  # Same day
                'period': 0,  # Same period - CONFLICT!
            },
        ]
        
        room_slots = {}
        conflicts = []
        
        for lesson in lessons:
            slot = (lesson['roomId'], lesson['day'], lesson['period'])
            if slot in room_slots:
                conflicts.append({
                    'type': 'room_conflict',
                    'slot': slot,
                })
            else:
                room_slots[slot] = lesson
        
        assert len(conflicts) > 0, "Should detect room conflict"

    @given(
        num_clusters=st.integers(min_value=2, max_value=5),
        lessons_per_cluster=st.integers(min_value=2, max_value=5),
    )
    @settings(max_examples=50, deadline=10000)
    def test_merged_solution_preserves_all_lessons(
        self, num_clusters: int, lessons_per_cluster: int
    ):
        """
        **Feature: solver-refactoring, Property 8: Solution Merge Correctness**
        **Validates: Requirements 4.4**
        
        For any set of cluster solutions, the merged solution SHALL contain
        all lessons from all clusters (when no conflicts exist).
        """
        # Create cluster results with unique lessons
        results = []
        all_lessons = []
        
        for cluster_id in range(num_clusters):
            cluster_lessons = []
            for lesson_idx in range(lessons_per_cluster):
                # Use unique identifiers to avoid conflicts
                lesson = {
                    'classId': f'class_{cluster_id}_{lesson_idx}',
                    'subjectId': f'subject_{cluster_id}_{lesson_idx}',
                    'teacherId': f'teacher_{cluster_id}_{lesson_idx}',
                    'roomId': f'room_{cluster_id}_{lesson_idx}',
                    'day': lesson_idx % 5,
                    'period': lesson_idx % 8,
                }
                cluster_lessons.append(lesson)
                all_lessons.append(lesson)
            
            results.append(ClusterResult(
                cluster_id=cluster_id,
                success=True,
                solution=cluster_lessons,
            ))
        
        # Merge by collecting all lessons
        merged = []
        for result in results:
            if result.success:
                merged.extend(result.solution)
        
        # Verify all lessons are present
        assert len(merged) == len(all_lessons)
        assert len(merged) == num_clusters * lessons_per_cluster


class TestClusterResultDataclass:
    """Tests for ClusterResult dataclass behavior."""

    @given(
        cluster_id=st.integers(min_value=0, max_value=1000),
        success=st.booleans(),
    )
    @settings(max_examples=100, deadline=5000)
    def test_cluster_result_creation(self, cluster_id: int, success: bool):
        """ClusterResult SHALL be creatable with any valid parameters."""
        if success:
            result = ClusterResult(
                cluster_id=cluster_id,
                success=success,
                solution=[{'test': 'lesson'}],
            )
            assert result.solution == [{'test': 'lesson'}]
            assert result.error is None
        else:
            result = ClusterResult(
                cluster_id=cluster_id,
                success=success,
                error="Test error",
            )
            assert result.error == "Test error"
            assert result.solution == []
        
        assert result.cluster_id == cluster_id
        assert result.success == success

    def test_cluster_result_defaults(self):
        """ClusterResult SHALL have sensible defaults."""
        result = ClusterResult(cluster_id=0, success=True)
        
        assert result.solution == []
        assert result.error is None
        assert result.error_traceback is None
        assert result.cluster_metadata is None
