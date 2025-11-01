#!/usr/bin/env python3
"""
Run incremental scale tests for timetable solver.
Collects performance metrics and validates results.
"""

import json
import sys
import time
import subprocess
from typing import Dict, List, Tuple

def run_solver_test(test_file: str) -> Tuple[Dict, float, bool]:
    """Run solver with test file and return solution, time, and success status."""
    print(f"\n{'='*70}")
    print(f"Running test: {test_file}")
    print(f"{'='*70}")
    
    try:
        with open(test_file, 'r', encoding='utf-8') as f:
            test_data = json.load(f)
        
        # Print test info
        meta = test_data.get('meta', {})
        print(f"Test: {meta.get('test_name', 'Unknown')}")
        print(f"Classes: {meta.get('num_classes', 0)}")
        print(f"Subjects: {meta.get('num_subjects', 0)}")
        print(f"Teachers: {meta.get('num_teachers', 0)}")
        print(f"Rooms: {meta.get('num_rooms', 0)}")
        
        # Start timer
        start_time = time.time()
        
        # Run solver
        print("\nStarting solver...")
        result = subprocess.run(
            ['python', 'solver_enhanced.py'],
            input=json.dumps(test_data),
            capture_output=True,
            text=True,
            timeout=test_data['config'].get('solverTimeLimitSeconds', 1800) + 60
        )
        
        elapsed_time = time.time() - start_time
        
        # Print stderr (contains solver logs)
        if result.stderr:
            print("\nSolver logs:")
            for line in result.stderr.split('\n')[-10:]:  # Last 10 lines
                if line.strip():
                    print(f"  {line}")
        
        # Parse result
        if result.returncode == 0:
            try:
                # Try to extract JSON from stdout (might have other text before/after)
                stdout_lines = result.stdout.strip()
                
                # Look for JSON array or object
                if stdout_lines.startswith('[') or stdout_lines.startswith('{'):
                    solution = json.loads(stdout_lines)
                else:
                    # Try to find JSON in the output
                    json_start = stdout_lines.find('[')
                    if json_start == -1:
                        json_start = stdout_lines.find('{')
                    
                    if json_start != -1:
                        solution = json.loads(stdout_lines[json_start:])
                    else:
                        raise json.JSONDecodeError("No JSON found in output", stdout_lines, 0)
                
                # Check for errors in solution
                if solution and isinstance(solution, list) and len(solution) > 0:
                    if isinstance(solution[0], dict) and 'error' in solution[0]:
                        print(f"\n❌ Solver returned error: {solution[0]['error']}")
                        print(f"Status: {solution[0].get('status', 'Unknown')}")
                        return solution, elapsed_time, False
                    else:
                        print(f"\n✓ Solution found!")
                        print(f"Lessons scheduled: {len(solution)}")
                        print(f"Solve time: {elapsed_time:.2f} seconds")
                        return solution, elapsed_time, True
                else:
                    print(f"\n✓ Empty solution (no lessons to schedule)")
                    return solution, elapsed_time, True
                    
            except json.JSONDecodeError as e:
                print(f"\n❌ Failed to parse solver output: {e}")
                print(f"Output: {result.stdout[:500]}")
                return None, elapsed_time, False
        else:
            print(f"\n❌ Solver failed with return code: {result.returncode}")
            print(f"Error output: {result.stderr[:1000]}")
            return None, elapsed_time, False
            
    except subprocess.TimeoutExpired:
        print(f"\n❌ Solver timed out")
        return None, test_data['config'].get('solverTimeLimitSeconds', 1800), False
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()
        return None, 0, False


def validate_solution(solution: List[Dict], test_data: Dict) -> Dict:
    """Validate solution for constraint violations."""
    if not solution or not isinstance(solution, list):
        return {"valid": False, "errors": ["Invalid solution format"]}
    
    errors = []
    warnings = []
    
    # Check for gaps in class schedules
    class_schedules = {}
    for lesson in solution:
        if lesson.get('isFixed'):
            continue
        
        class_id = lesson.get('classId')
        day = lesson.get('day')
        period = lesson.get('periodIndex')
        
        if not class_id or day is None or period is None:
            errors.append(f"Invalid lesson format: {lesson}")
            continue
        
        if class_id not in class_schedules:
            class_schedules[class_id] = {}
        if day not in class_schedules[class_id]:
            class_schedules[class_id][day] = []
        
        class_schedules[class_id][day].append(period)
    
    # Check for gaps
    gaps_found = []
    for class_id, days in class_schedules.items():
        for day, periods in days.items():
            if len(periods) > 1:
                periods_sorted = sorted(periods)
                min_period = min(periods_sorted)
                max_period = max(periods_sorted)
                expected_span = max_period - min_period + 1
                actual_count = len(periods_sorted)
                
                if expected_span != actual_count:
                    gap = expected_span - actual_count
                    gaps_found.append(f"Class {class_id} on {day}: {gap} gap(s) between periods {min_period}-{max_period}")
    
    if gaps_found:
        errors.extend(gaps_found)
    
    # Check for overlaps (same class, teacher, or room at same time)
    time_slots = {}
    for lesson in solution:
        day = lesson.get('day')
        period = lesson.get('periodIndex')
        slot = f"{day}_{period}"
        
        if slot not in time_slots:
            time_slots[slot] = {'classes': [], 'teachers': [], 'rooms': []}
        
        class_id = lesson.get('classId')
        if class_id:
            if class_id in time_slots[slot]['classes']:
                errors.append(f"Class overlap: {class_id} at {slot}")
            time_slots[slot]['classes'].append(class_id)
        
        for teacher_id in lesson.get('teacherIds', []):
            if teacher_id in time_slots[slot]['teachers']:
                errors.append(f"Teacher overlap: {teacher_id} at {slot}")
            time_slots[slot]['teachers'].append(teacher_id)
        
        room_id = lesson.get('roomId')
        if room_id:
            if room_id in time_slots[slot]['rooms']:
                errors.append(f"Room overlap: {room_id} at {slot}")
            time_slots[slot]['rooms'].append(room_id)
    
    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "gaps_found": len(gaps_found)
    }


def main():
    """Run all tests and generate report."""
    tests = [
        ("test_6_classes.json", "6 Classes (Grades 7-8)"),
        ("test_12_classes.json", "12 Classes (Grades 7-10)"),
        ("test_18_classes_full.json", "18 Classes (Full Scale)")
    ]
    
    results = []
    
    for test_file, test_name in tests:
        print(f"\n\n{'#'*70}")
        print(f"# TEST: {test_name}")
        print(f"{'#'*70}")
        
        solution, elapsed_time, success = run_solver_test(test_file)
        
        # Load test data for validation
        with open(test_file, 'r', encoding='utf-8') as f:
            test_data = json.load(f)
        
        # Validate solution if successful
        validation = None
        if success and solution:
            print("\nValidating solution...")
            validation = validate_solution(solution, test_data)
            
            if validation['valid']:
                print("✓ Solution is valid (no constraint violations)")
                if validation['gaps_found'] == 0:
                    print("✓ NO GAPS found in class schedules!")
                else:
                    print(f"⚠️ {validation['gaps_found']} gaps found")
            else:
                print(f"❌ Solution has {len(validation['errors'])} errors:")
                for error in validation['errors'][:10]:
                    print(f"  - {error}")
        
        results.append({
            "test_name": test_name,
            "test_file": test_file,
            "success": success,
            "elapsed_time": elapsed_time,
            "num_lessons": len(solution) if solution else 0,
            "validation": validation,
            "meta": test_data.get('meta', {})
        })
        
        # Stop if test failed
        if not success:
            print(f"\n⚠️ Test failed, stopping incremental tests")
            break
    
    # Generate summary report
    print(f"\n\n{'='*70}")
    print("SUMMARY REPORT")
    print(f"{'='*70}")
    
    for result in results:
        status = "✓ PASS" if result['success'] else "❌ FAIL"
        print(f"\n{result['test_name']}: {status}")
        print(f"  Time: {result['elapsed_time']:.2f}s")
        print(f"  Lessons: {result['num_lessons']}")
        print(f"  Classes: {result['meta'].get('num_classes', 0)}")
        print(f"  Subjects: {result['meta'].get('num_subjects', 0)}")
        
        if result['validation']:
            print(f"  Valid: {result['validation']['valid']}")
            print(f"  Gaps: {result['validation']['gaps_found']}")
            if result['validation']['errors']:
                print(f"  Errors: {len(result['validation']['errors'])}")
    
    # Save detailed results
    with open("scale_test_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n✓ Detailed results saved to scale_test_results.json")
    
    # Exit with success if all tests passed
    all_passed = all(r['success'] for r in results)
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()

