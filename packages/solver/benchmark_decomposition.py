"""
Performance benchmarking suite for decomposition solver.

Tests different problem sizes and strategies to measure performance improvements.
"""
import sys
import json
import time
from typing import Dict, List, Tuple

print("[Benchmark] Decomposition Solver Performance Benchmark")
print("="*70)

# Import decomposition system
try:
    from decomposition import DecompositionSolver
    from solver_enhanced import TimetableData, TimetableSolver
    print("[OK] Imported solver modules\n")
except ImportError as e:
    print(f"[ERROR] Failed to import: {e}")
    sys.exit(1)


def create_benchmark_data(num_classes: int, requests_per_class: int) -> dict:
    """Create realistic benchmark data."""
    # Create subjects
    subjects = [
        {'id': f'subject_{i}', 'name': f'Subject {i}', 'code': f'S{i}'}
        for i in range(1, 11)  # 10 subjects
    ]
    
    # Create teachers (1 teacher per 2 subjects)
    teachers = []
    for i in range(1, 21):  # 20 teachers
        primary_subjects = [f'subject_{((i-1) % 10) + 1}']
        allowed_subjects = [f'subject_{(i % 10) + 1}']
        
        teachers.append({
            'id': f'teacher_{i}',
            'fullName': f'Teacher {i}',
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
            'maxConsecutivePeriods': 4
        })
    
    # Create rooms
    rooms = [
        {'id': f'room_{i}', 'name': f'Room {i}', 'capacity': 40, 
         'type': 'classroom', 'features': []}
        for i in range(1, max(15, num_classes + 5))
    ]
    
    # Create classes
    classes = []
    for i in range(1, num_classes + 1):
        subject_requirements = {}
        periods_per_subject = requests_per_class // 5
        
        for j in range(1, 6):  # 5 subjects per class
            subject_id = f'subject_{((i + j - 1) % 10) + 1}'
            subject_requirements[subject_id] = {
                'periodsPerWeek': periods_per_subject
            }
        
        classes.append({
            'id': f'class_{i}',
            'name': f'Class {i}',
            'studentCount': 30,
            'subjectRequirements': subject_requirements,
            'meta': {
                'gradeLevel': f'grade_{((i - 1) // 3) + 1}'
            }
        })
    
    config = {
        'schoolName': 'Benchmark School',
        'daysOfWeek': ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday'],
        'periodsPerDay': 6,
        'solverTimeLimitSeconds': 300,
        'enableGracefulDegradation': True,
        'solverOptimizationLevel': 0  # Fast mode for benchmarking
    }
    
    return {
        'config': config,
        'subjects': subjects,
        'teachers': teachers,
        'rooms': rooms,
        'classes': classes,
        'fixedLessons': []
    }


def run_benchmark(problem_name: str, num_classes: int, requests_per_class: int) -> Dict:
    """Run a single benchmark test."""
    print(f"\n{'='*70}")
    print(f"BENCHMARK: {problem_name}")
    print(f"{'='*70}")
    print(f"Classes: {num_classes}, Requests/Class: {requests_per_class}")
    
    # Create test data
    test_data = create_benchmark_data(num_classes, requests_per_class)
    data = TimetableData(**test_data)
    
    total_requests = sum(
        sum(req.periodsPerWeek for req in cls.subjectRequirements.values())
        for cls in data.classes
    )
    print(f"Total requests: {total_requests}")
    
    # Run with decomposition solver
    print("\nRunning with DecompositionSolver...")
    decomp_solver = DecompositionSolver(data, TimetableSolver)
    
    start_time = time.time()
    try:
        solution = decomp_solver.solve(
            time_limit_seconds=300,
            enable_graceful_degradation=True,
            optimization_level=0
        )
        elapsed = time.time() - start_time
        
        # Check result
        if solution and not (isinstance(solution, list) and len(solution) > 0 and 'error' in solution[0]):
            status = "SUCCESS"
            num_lessons = len(solution)
        else:
            status = "FAILED"
            num_lessons = 0
            error = solution[0].get('error', 'Unknown') if solution else 'No solution'
            print(f"[ERROR] {error}")
        
    except Exception as e:
        elapsed = time.time() - start_time
        status = "EXCEPTION"
        num_lessons = 0
        print(f"[EXCEPTION] {e}")
    
    # Print results
    print(f"\nResults:")
    print(f"  Status: {status}")
    print(f"  Time: {elapsed:.2f}s")
    print(f"  Lessons: {num_lessons}/{total_requests}")
    print(f"  Strategy: {decomp_solver.strategy.value if decomp_solver.strategy else 'N/A'}")
    
    return {
        'problem_name': problem_name,
        'num_classes': num_classes,
        'requests_per_class': requests_per_class,
        'total_requests': total_requests,
        'status': status,
        'time': elapsed,
        'lessons_scheduled': num_lessons,
        'strategy': decomp_solver.strategy.value if decomp_solver.strategy else 'none'
    }


def main():
    """Run all benchmarks."""
    results = []
    
    # Benchmark suite
    benchmarks = [
        ("Small Problem", 4, 12),      # ~48 requests
        ("Medium Problem", 8, 15),     # ~120 requests
        ("Large Problem", 12, 20),     # ~240 requests
        ("Very Large Problem", 16, 20),# ~320 requests
        ("Huge Problem", 20, 20),      # ~400 requests
    ]
    
    for problem_name, num_classes, requests_per_class in benchmarks:
        result = run_benchmark(problem_name, num_classes, requests_per_class)
        results.append(result)
        
        # Small delay between tests
        time.sleep(1)
    
    # Print summary
    print(f"\n{'='*70}")
    print("BENCHMARK SUMMARY")
    print(f"{'='*70}")
    print(f"{'Problem':<25} {'Requests':<12} {'Time':<12} {'Strategy':<20} {'Status':<10}")
    print("-"*70)
    
    for r in results:
        print(f"{r['problem_name']:<25} {r['total_requests']:<12} "
              f"{r['time']:<11.2f}s {r['strategy']:<20} {r['status']:<10}")
    
    print("-"*70)
    
    # Calculate speedup (comparing large vs small)
    if len(results) >= 3:
        small_time_per_request = results[0]['time'] / results[0]['total_requests']
        large_time = results[2]['time']
        large_requests = results[2]['total_requests']
        expected_time_without_decomp = small_time_per_request * large_requests
        
        if large_time > 0:
            speedup = expected_time_without_decomp / large_time
            print(f"\nEstimated Speedup for Large Problem: {speedup:.2f}x")
    
    # Save results to JSON
    with open('benchmark_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print("\n[OK] Benchmark results saved to benchmark_results.json")
    print("\n[DONE] Benchmark complete!")


if __name__ == '__main__':
    main()
