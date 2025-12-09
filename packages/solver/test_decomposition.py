"""
Comprehensive test suite for Phase 4 decomposition solver.

Tests clustering algorithms, merging logic, and performance.
"""
import sys
import json
import time
from typing import Dict, List, Any

# Test the decomposition system
try:
    from decomposition import DecompositionSolver, ClassClusterBuilder, SolutionMerger
    from decomposition.decomposition_solver import DecompositionStrategy
    print("[OK] Successfully imported decomposition modules")
except ImportError as e:
    print(f"[ERROR] Failed to import decomposition modules: {e}")
    sys.exit(1)


class TestDecompositionSolver:
    """Test suite for decomposition solver."""
    
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.test_results = []
    
    def run_test(self, test_name: str, test_func):
        """Run a single test and track results."""
        print(f"\n{'='*60}")
        print(f"TEST: {test_name}")
        print(f"{'='*60}")
        
        try:
            start_time = time.time()
            result = test_func()
            elapsed = time.time() - start_time
            
            if result:
                print(f"[PASS] PASSED ({elapsed:.2f}s)")
                self.tests_passed += 1
                self.test_results.append({
                    'test': test_name,
                    'status': 'PASSED',
                    'time': elapsed
                })
            else:
                print(f"[FAIL] FAILED ({elapsed:.2f}s)")
                self.tests_failed += 1
                self.test_results.append({
                    'test': test_name,
                    'status': 'FAILED',
                    'time': elapsed
                })
        
        except Exception as e:
            print(f"[EXCEPTION] EXCEPTION: {e}")
            self.tests_failed += 1
            self.test_results.append({
                'test': test_name,
                'status': 'EXCEPTION',
                'error': str(e)
            })
    
    def print_summary(self):
        """Print test summary."""
        print(f"\n{'='*60}")
        print("TEST SUMMARY")
        print(f"{'='*60}")
        print(f"Total tests: {self.tests_passed + self.tests_failed}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_failed}")
        print(f"Success rate: {self.tests_passed / (self.tests_passed + self.tests_failed) * 100:.1f}%")
        print(f"{'='*60}\n")
        
        if self.tests_failed > 0:
            print("FAILED TESTS:")
            for result in self.test_results:
                if result['status'] != 'PASSED':
                    print(f"  - {result['test']}: {result.get('error', 'Failed')}")


def create_test_data(num_classes: int, num_teachers: int, lessons_per_class: int) -> dict:
    """
    Create synthetic test data for testing.
    
    Args:
        num_classes: Number of classes
        num_teachers: Number of teachers
        lessons_per_class: Lessons per class per week
    
    Returns:
        Test data dictionary
    """
    # Create subjects
    subjects = []
    for i in range(5):  # 5 subjects
        subjects.append({
            'id': f'subject_{i+1}',
            'name': f'Subject {i+1}',
            'code': f'S{i+1}'
        })
    
    # Create teachers
    teachers = []
    for i in range(num_teachers):
        # Each teacher can teach 1-2 subjects
        primary_subjects = [f'subject_{(i % 5) + 1}']
        allowed_subjects = [f'subject_{((i + 1) % 5) + 1}']
        
        teachers.append({
            'id': f'teacher_{i+1}',
            'fullName': f'Teacher {i+1}',
            'primarySubjectIds': primary_subjects,
            'allowedSubjectIds': allowed_subjects,
            'restrictToPrimarySubjects': False,
            'availability': {
                'Saturday': [True] * 6,
                'Sunday': [True] * 6,
                'Monday': [True] * 6,
                'Tuesday': [True] * 6,
                'Wednesday': [True] * 6
            },
            'maxPeriodsPerWeek': 30,
            'maxPeriodsPerDay': 6,
            'maxConsecutivePeriods': 3
        })
    
    # Create rooms
    rooms = []
    for i in range(max(10, num_classes)):
        rooms.append({
            'id': f'room_{i+1}',
            'name': f'Room {i+1}',
            'capacity': 40,
            'type': 'classroom',
            'features': []
        })
    
    # Create classes
    classes = []
    for i in range(num_classes):
        subject_requirements = {}
        
        # Each class needs lessons from different subjects
        # Distribute lessons_per_class across 5 subjects
        periods_per_subject = max(3, lessons_per_class // 5)
        for j in range(5):  # All 5 subjects
            subject_id = f'subject_{(j % 5) + 1}'
            subject_requirements[subject_id] = {
                'periodsPerWeek': periods_per_subject
            }
        
        classes.append({
            'id': f'class_{i+1}',
            'name': f'Class {i+1}',
            'studentCount': 30,
            'subjectRequirements': subject_requirements,
            'meta': {
                'gradeLevel': f'grade_{(i // 3) + 1}'  # Group classes by grade
            }
        })
    
    # Create config
    config = {
        'schoolName': 'Test School',
        'daysOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
        'periodsPerDay': 6,
        'solverTimeLimitSeconds': 300,
        'enableGracefulDegradation': True,
        'solverOptimizationLevel': 2
    }
    
    return {
        'config': config,
        'subjects': subjects,
        'teachers': teachers,
        'rooms': rooms,
        'classes': classes,
        'fixedLessons': []
    }


def test_small_problem_no_decomposition():
    """Test that small problems don't trigger decomposition."""
    print("Creating small problem (6 classes, 100 requests)...")
    
    # This should NOT trigger decomposition
    test_data = create_test_data(num_classes=6, num_teachers=10, lessons_per_class=15)
    
    from pydantic import BaseModel
    # Import TimetableData model
    sys.path.insert(0, '.')
    from solver_enhanced import TimetableData, TimetableSolver
    
    data = TimetableData(**test_data)
    decomp_solver = DecompositionSolver(data, TimetableSolver)
    
    # Should not decompose
    should_decomp = decomp_solver.should_decompose()
    print(f"Should decompose: {should_decomp}")
    print(f"Number of requests: {decomp_solver.num_requests}")
    
    if not should_decomp:
        print("[OK] Correctly decided NOT to decompose small problem")
        return True
    else:
        print("[FAIL] Incorrectly decided to decompose small problem")
        return False


def test_large_problem_triggers_decomposition():
    """Test that large problems trigger decomposition."""
    print("Creating large problem (12 classes, 250+ requests)...")
    
    # This SHOULD trigger decomposition
    test_data = create_test_data(num_classes=12, num_teachers=20, lessons_per_class=25)
    
    sys.path.insert(0, '.')
    from solver_enhanced import TimetableData, TimetableSolver
    
    data = TimetableData(**test_data)
    decomp_solver = DecompositionSolver(data, TimetableSolver)
    
    # Should decompose
    should_decomp = decomp_solver.should_decompose()
    print(f"Should decompose: {should_decomp}")
    print(f"Number of requests: {decomp_solver.num_requests}")
    
    if should_decomp:
        print("[OK] Correctly decided to decompose large problem")
        return True
    else:
        print("[FAIL] Failed to detect large problem")
        return False


def test_class_clustering():
    """Test class clustering algorithm."""
    print("Testing class clustering...")
    
    test_data = create_test_data(num_classes=9, num_teachers=15, lessons_per_class=20)
    
    sys.path.insert(0, '.')
    from solver_enhanced import TimetableData
    
    data = TimetableData(**test_data)
    builder = ClassClusterBuilder(data)
    
    # Build clusters
    clusters = builder.build_clusters()
    
    print(f"Created {len(clusters)} clusters")
    for i, cluster in enumerate(clusters):
        print(f"  Cluster {i+1}: {cluster['num_classes']} classes, "
              f"{cluster['num_requests']} requests, {cluster['num_teachers']} teachers")
    
    # Validate clusters
    total_classes = sum(c['num_classes'] for c in clusters)
    print(f"Total classes in clusters: {total_classes} (expected: 9)")
    
    if total_classes == 9 and len(clusters) >= 1:
        print("[OK] Clustering algorithm working correctly")
        return True
    else:
        print("[FAIL] Clustering algorithm failed")
        return False


def test_strategy_selection():
    """Test strategy selection logic."""
    print("Testing strategy selection...")
    
    # Small problem
    small_data = create_test_data(num_classes=4, num_teachers=8, lessons_per_class=12)
    
    sys.path.insert(0, '.')
    from solver_enhanced import TimetableData, TimetableSolver
    
    data = TimetableData(**small_data)
    decomp_solver = DecompositionSolver(data, TimetableSolver)
    
    strategy = decomp_solver.choose_strategy()
    print(f"Small problem strategy: {strategy}")
    
    if strategy == DecompositionStrategy.NONE:
        print("[OK] Correctly chose NONE for small problem")
    else:
        print("[FAIL] Wrong strategy for small problem")
        return False
    
    # Large problem
    large_data = create_test_data(num_classes=12, num_teachers=20, lessons_per_class=25)
    data_large = TimetableData(**large_data)
    decomp_solver_large = DecompositionSolver(data_large, TimetableSolver)
    
    strategy_large = decomp_solver_large.choose_strategy()
    print(f"Large problem strategy: {strategy_large}")
    
    if strategy_large == DecompositionStrategy.CLASS_CLUSTERING:
        print("[OK] Correctly chose CLASS_CLUSTERING for large problem")
        return True
    else:
        print("[FAIL] Wrong strategy for large problem")
        return False


def test_solution_merger_conflict_detection():
    """Test solution merger conflict detection."""
    print("Testing solution merger conflict detection...")
    
    test_data = create_test_data(num_classes=3, num_teachers=5, lessons_per_class=10)
    
    sys.path.insert(0, '.')
    from solver_enhanced import TimetableData
    
    data = TimetableData(**test_data)
    merger = SolutionMerger(data)
    
    # Create test lessons with NO conflicts
    lessons_no_conflict = [
        {'teacherId': 'teacher_1', 'roomId': 'room_1', 'classId': 'class_1', 
         'day': 0, 'period': 0, 'subjectId': 'subject_1'},
        {'teacherId': 'teacher_2', 'roomId': 'room_2', 'classId': 'class_2', 
         'day': 0, 'period': 0, 'subjectId': 'subject_2'},
        {'teacherId': 'teacher_1', 'roomId': 'room_1', 'classId': 'class_1', 
         'day': 0, 'period': 1, 'subjectId': 'subject_1'},
    ]
    
    conflicts = merger._check_conflicts(lessons_no_conflict)
    print(f"Conflicts found (should be 0): {len(conflicts)}")
    
    if len(conflicts) == 0:
        print("[OK] No conflicts detected (correct)")
    else:
        print("[FAIL] False positive conflicts detected")
        return False
    
    # Create test lessons WITH conflicts
    lessons_with_conflict = [
        {'teacherId': 'teacher_1', 'roomId': 'room_1', 'classId': 'class_1', 
         'day': 0, 'period': 0, 'subjectId': 'subject_1'},
        {'teacherId': 'teacher_1', 'roomId': 'room_2', 'classId': 'class_2', 
         'day': 0, 'period': 0, 'subjectId': 'subject_2'},  # Same teacher, same time!
    ]
    
    conflicts = merger._check_conflicts(lessons_with_conflict)
    print(f"Conflicts found (should be 1): {len(conflicts)}")
    
    if len(conflicts) == 1 and conflicts[0]['type'] == 'teacher_conflict':
        print("[OK] Teacher conflict correctly detected")
        return True
    else:
        print("[FAIL] Failed to detect teacher conflict")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*60)
    print("PHASE 4.2 DECOMPOSITION SOLVER TEST SUITE")
    print("="*60 + "\n")
    
    test_runner = TestDecompositionSolver()
    
    # Run tests
    test_runner.run_test("Small problem - no decomposition", test_small_problem_no_decomposition)
    test_runner.run_test("Large problem - triggers decomposition", test_large_problem_triggers_decomposition)
    test_runner.run_test("Class clustering algorithm", test_class_clustering)
    test_runner.run_test("Strategy selection logic", test_strategy_selection)
    test_runner.run_test("Solution merger - conflict detection", test_solution_merger_conflict_detection)
    
    # Print summary
    test_runner.print_summary()
    
    # Exit with appropriate code
    if test_runner.tests_failed > 0:
        sys.exit(1)
    else:
        print("\n[SUCCESS] All tests passed! Decomposition solver is working correctly.\n")
        sys.exit(0)


if __name__ == '__main__':
    main()
