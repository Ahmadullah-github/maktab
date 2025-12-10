"""
Property-based tests for decomposition partition correctness.

Tests that decomposition creates clusters where every lesson appears
in exactly one cluster (no duplicates, no omissions).
"""

import pytest
from hypothesis import given, strategies as st, assume, settings, HealthCheck
from typing import List, Dict, Set, Any

from models.input import (
    TimetableData, GlobalConfig, ClassGroup, Teacher, Subject, Room,
    SubjectRequirement, DayOfWeek
)
from decomposition.cluster_builder import ClassClusterBuilder


def count_total_lessons(data: TimetableData) -> int:
    """Count total lessons in the original problem."""
    total = 0
    for cls in data.classes:
        for req in cls.subjectRequirements.values():
            total += req.periodsPerWeek
    
    # Subtract fixed lessons (they're already scheduled)
    if data.fixedLessons:
        total -= len(data.fixedLessons)
    
    return max(0, total)


def count_cluster_lessons(clusters: List[Dict[str, Any]]) -> int:
    """Count total lessons across all clusters."""
    return sum(cluster['num_requests'] for cluster in clusters)


def get_all_classes_in_clusters(clusters: List[Dict[str, Any]]) -> Set[str]:
    """Get all class IDs that appear in clusters."""
    all_classes = set()
    for cluster in clusters:
        all_classes.update(cluster['classes'])
    return all_classes


def check_class_uniqueness(clusters: List[Dict[str, Any]]) -> bool:
    """Check that each class appears in exactly one cluster."""
    seen_classes = set()
    for cluster in clusters:
        for class_id in cluster['classes']:
            if class_id in seen_classes:
                return False  # Duplicate class
            seen_classes.add(class_id)
    return True


# Simplified strategies for testing
@st.composite
def simple_timetable_data(draw):
    """Generate a simple but valid TimetableData for testing."""
    # Fixed small configuration to avoid complexity
    config = GlobalConfig(
        daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY],
        periodsPerDay=6  # 18 total periods per week
    )
    
    # Fixed subjects
    subjects = [
        Subject(id="math", name="Mathematics", requiredRoomType="classroom"),
        Subject(id="english", name="English", requiredRoomType="classroom"),
        Subject(id="science", name="Science", requiredRoomType="lab"),
    ]
    
    # Fixed rooms
    rooms = [
        Room(id="r1", name="Room 1", capacity=30, type="classroom"),
        Room(id="r2", name="Room 2", capacity=30, type="classroom"),
        Room(id="lab1", name="Lab 1", capacity=25, type="lab"),
    ]
    
    # Fixed availability for all teachers
    availability = {
        DayOfWeek.MONDAY: [True] * 6,
        DayOfWeek.TUESDAY: [True] * 6,
        DayOfWeek.WEDNESDAY: [True] * 6,
    }
    
    # Generate 3-5 teachers
    num_teachers = draw(st.integers(min_value=3, max_value=5))
    teachers = []
    for i in range(num_teachers):
        # Each teacher can teach 1-2 subjects
        subject_count = draw(st.integers(min_value=1, max_value=2))
        primary_subjects = draw(st.lists(
            st.sampled_from(["math", "english", "science"]),
            min_size=subject_count,
            max_size=subject_count,
            unique=True
        ))
        
        teachers.append(Teacher(
            id=f"t{i+1}",
            fullName=f"Teacher {i+1}",
            primarySubjectIds=primary_subjects,
            availability=availability,
            maxPeriodsPerWeek=18
        ))
    
    # Generate 3-4 classes, each with exactly 18 periods (no empty periods)
    num_classes = draw(st.integers(min_value=3, max_value=4))
    classes = []
    for i in range(num_classes):
        # Distribute 18 periods across subjects to avoid empty periods
        math_periods = draw(st.integers(min_value=4, max_value=8))
        english_periods = draw(st.integers(min_value=4, max_value=8))
        science_periods = 18 - math_periods - english_periods
        
        # Ensure science gets at least 2 periods
        assume(science_periods >= 2)
        
        classes.append(ClassGroup(
            id=f"c{i+1}",
            name=f"Class {i+1}",
            studentCount=25,
            subjectRequirements={
                "math": SubjectRequirement(periodsPerWeek=math_periods),
                "english": SubjectRequirement(periodsPerWeek=english_periods),
                "science": SubjectRequirement(periodsPerWeek=science_periods),
            },
            gradeLevel=draw(st.integers(min_value=1, max_value=12))
        ))
    
    return TimetableData(
        config=config,
        rooms=rooms,
        subjects=subjects,
        teachers=teachers,
        classes=classes
    )


class TestDecompositionPartition:
    """Property tests for decomposition partition correctness."""
    
    # **Feature: solver-refactoring, Property 20: Decomposition Partition**
    @given(simple_timetable_data())
    @settings(suppress_health_check=[HealthCheck.large_base_example])
    def test_every_lesson_appears_exactly_once(self, data: TimetableData):
        """For any decomposition into clusters, every lesson should appear in exactly one cluster."""
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        # Count original lessons
        original_lesson_count = count_total_lessons(data)
        
        # Count lessons in clusters
        cluster_lesson_count = count_cluster_lessons(clusters)
        
        assert cluster_lesson_count == original_lesson_count, (
            f"Lesson count mismatch: original={original_lesson_count}, "
            f"clusters={cluster_lesson_count}. Some lessons were lost or duplicated."
        )
    
    # **Feature: solver-refactoring, Property 20: Decomposition Partition**
    @given(simple_timetable_data())
    @settings(suppress_health_check=[HealthCheck.large_base_example])
    def test_every_class_appears_exactly_once(self, data: TimetableData):
        """For any decomposition into clusters, every class should appear in exactly one cluster."""
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        # Get original class IDs
        original_classes = {cls.id for cls in data.classes}
        
        # Get classes from clusters
        cluster_classes = get_all_classes_in_clusters(clusters)
        
        # Check completeness (no missing classes)
        missing_classes = original_classes - cluster_classes
        assert not missing_classes, (
            f"Missing classes in clusters: {missing_classes}"
        )
        
        # Check no extra classes
        extra_classes = cluster_classes - original_classes
        assert not extra_classes, (
            f"Extra classes in clusters: {extra_classes}"
        )
        
        # Check uniqueness (no class appears in multiple clusters)
        assert check_class_uniqueness(clusters), (
            "Some classes appear in multiple clusters"
        )
    
    # **Feature: solver-refactoring, Property 20: Decomposition Partition**
    @given(simple_timetable_data())
    @settings(suppress_health_check=[HealthCheck.large_base_example])
    def test_clusters_are_non_empty(self, data: TimetableData):
        """For any decomposition, all clusters should be non-empty."""
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        for i, cluster in enumerate(clusters):
            assert len(cluster['classes']) > 0, (
                f"Cluster {i} is empty"
            )
            assert cluster['num_requests'] > 0, (
                f"Cluster {i} has no lesson requests"
            )
    
    # **Feature: solver-refactoring, Property 20: Decomposition Partition**
    @given(simple_timetable_data())
    @settings(suppress_health_check=[HealthCheck.large_base_example])
    def test_cluster_metadata_consistency(self, data: TimetableData):
        """For any decomposition, cluster metadata should be consistent with actual data."""
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        for cluster in clusters:
            # Check class count matches
            assert cluster['num_classes'] == len(cluster['classes']), (
                f"Cluster {cluster['cluster_id']}: num_classes mismatch"
            )
            
            # Check teacher count matches
            assert cluster['num_teachers'] == len(cluster['teachers']), (
                f"Cluster {cluster['cluster_id']}: num_teachers mismatch"
            )
            
            # Verify lesson count by manually counting
            manual_count = 0
            for class_id in cluster['classes']:
                cls = next(c for c in data.classes if c.id == class_id)
                for req in cls.subjectRequirements.values():
                    manual_count += req.periodsPerWeek
            
            assert cluster['num_requests'] == manual_count, (
                f"Cluster {cluster['cluster_id']}: lesson count mismatch. "
                f"Expected {manual_count}, got {cluster['num_requests']}"
            )
    
    # **Feature: solver-refactoring, Property 20: Decomposition Partition**
    @given(simple_timetable_data())
    @settings(suppress_health_check=[HealthCheck.large_base_example])
    def test_sub_problem_data_completeness(self, data: TimetableData):
        """For any cluster, sub-problem data should contain all necessary information."""
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        for cluster in clusters:
            sub_data = builder.create_sub_problem_data(cluster)
            
            # Check classes are correctly filtered
            sub_class_ids = {c.id for c in sub_data.classes}
            expected_class_ids = set(cluster['classes'])
            assert sub_class_ids == expected_class_ids, (
                f"Cluster {cluster['cluster_id']}: class filtering incorrect"
            )
            
            # Check teachers are correctly filtered
            sub_teacher_ids = {t.id for t in sub_data.teachers}
            expected_teacher_ids = set(cluster['teachers'])
            assert sub_teacher_ids == expected_teacher_ids, (
                f"Cluster {cluster['cluster_id']}: teacher filtering incorrect"
            )
            
            # Check that all subjects needed by classes are available
            needed_subjects = set()
            for cls in sub_data.classes:
                needed_subjects.update(cls.subjectRequirements.keys())
            
            available_subjects = {s.id for s in sub_data.subjects}
            missing_subjects = needed_subjects - available_subjects
            assert not missing_subjects, (
                f"Cluster {cluster['cluster_id']}: missing subjects {missing_subjects}"
            )
    
    def test_single_class_no_decomposition(self):
        """Single class should not be decomposed."""
        # Create minimal data with one class - ensure no empty periods
        config = GlobalConfig(
            daysOfWeek=[DayOfWeek.MONDAY, DayOfWeek.TUESDAY],
            periodsPerDay=5  # 10 total periods per week
        )
        
        subjects = [
            Subject(id="math", name="Mathematics", requiredRoomType="classroom"),
            Subject(id="english", name="English", requiredRoomType="classroom")
        ]
        room = Room(id="r1", name="Room 1", capacity=30, type="classroom")
        teacher = Teacher(
            id="t1",
            fullName="Teacher 1",
            primarySubjectIds=["math", "english"],
            availability={
                DayOfWeek.MONDAY: [True] * 5,
                DayOfWeek.TUESDAY: [True] * 5,
            },
            maxPeriodsPerWeek=20
        )
        # Use exactly 10 periods to match the schedule (no empty periods)
        class_group = ClassGroup(
            id="c1",
            name="Class 1",
            studentCount=25,
            subjectRequirements={
                "math": SubjectRequirement(periodsPerWeek=6),
                "english": SubjectRequirement(periodsPerWeek=4)
            }
        )
        
        data = TimetableData(
            config=config,
            rooms=[room],
            subjects=subjects,
            teachers=[teacher],
            classes=[class_group]
        )
        
        builder = ClassClusterBuilder(data)
        clusters = builder.build_clusters()
        
        # Should have exactly one cluster with the single class
        assert len(clusters) == 1, f"Expected 1 cluster, got {len(clusters)}"
        assert clusters[0]['classes'] == ['c1'], f"Expected class c1, got {clusters[0]['classes']}"
        assert clusters[0]['num_requests'] == 10, f"Expected 10 requests, got {clusters[0]['num_requests']}"