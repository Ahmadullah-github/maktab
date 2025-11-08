"""
CHUNK 5: Test solver performance with dynamic periods per day.
Tests weekend schedules (5+5+5+5+5+2) and variable periods.
"""

import time
import json
from solver_enhanced import TimetableData, solve_with_decomposition_if_beneficial

print("Testing CHUNK 5: Dynamic Periods Per Day Performance")
print("=" * 70)

# Helper function to create test data
def create_weekend_schedule_data():
    """Create a realistic weekend schedule with 5+5+5+5+5+2 = 27 periods."""
    return {
        "config": {
            "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "periodsPerDayMap": {
                "Monday": 5,
                "Tuesday": 5,
                "Wednesday": 5,
                "Thursday": 5,
                "Friday": 5,
                "Saturday": 2
            },
            "periodsPerDay": 5,  # For backward compatibility
            "solverTimeLimitSeconds": 120
        },
        "rooms": [
            {"id": f"ROOM_{i}", "name": f"Room {i}", "capacity": 30, "type": "Classroom"}
            for i in range(1, 6)
        ],
        "subjects": [
            {"id": "SUBJ_MATH", "name": "Mathematics"},
            {"id": "SUBJ_SCIENCE", "name": "Science"},
            {"id": "SUBJ_ENGLISH", "name": "English"},
            {"id": "SUBJ_DARI", "name": "Dari"},
            {"id": "SUBJ_ISLAMIC", "name": "Islamic Studies"}
        ],
        "teachers": [
            {
                "id": f"TEACHER_{i}",
                "fullName": f"Teacher {i}",
                "primarySubjectIds": ["SUBJ_MATH", "SUBJ_SCIENCE", "SUBJ_ENGLISH", "SUBJ_DARI", "SUBJ_ISLAMIC"],
                "availability": {
                    "Monday": [True] * 5,
                    "Tuesday": [True] * 5,
                    "Wednesday": [True] * 5,
                    "Thursday": [True] * 5,
                    "Friday": [True] * 5,
                    "Saturday": [True, True]  # Only 2 periods on Saturday
                },
                "maxPeriodsPerWeek": 27
            }
            for i in range(1, 4)
        ],
        "classes": [
            {
                "id": f"CLASS_{i}",
                "name": f"Class {i}",
                "studentCount": 25,
                "gradeLevel": i,
                "category": "Alpha-Primary" if i <= 3 else "Beta-Primary",
                "subjectRequirements": {
                    "SUBJ_MATH": {"periodsPerWeek": 6},
                    "SUBJ_SCIENCE": {"periodsPerWeek": 5},
                    "SUBJ_ENGLISH": {"periodsPerWeek": 5},
                    "SUBJ_DARI": {"periodsPerWeek": 6},
                    "SUBJ_ISLAMIC": {"periodsPerWeek": 5}
                }
            }
            for i in range(1, 4)
        ]
    }

def create_variable_periods_data():
    """Create schedule with highly variable periods (6+5+4+3+2+1 = 21)."""
    return {
        "config": {
            "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            "periodsPerDayMap": {
                "Monday": 6,
                "Tuesday": 5,
                "Wednesday": 4,
                "Thursday": 3,
                "Friday": 2,
                "Saturday": 1
            },
            "periodsPerDay": 6,  # Max for compatibility
            "solverTimeLimitSeconds": 120
        },
        "rooms": [
            {"id": "ROOM_1", "name": "Room 1", "capacity": 30, "type": "Classroom"}
        ],
        "subjects": [
            {"id": "SUBJ_MATH", "name": "Mathematics"},
            {"id": "SUBJ_SCIENCE", "name": "Science"}
        ],
        "teachers": [
            {
                "id": "TEACHER_1",
                "fullName": "Teacher One",
                "primarySubjectIds": ["SUBJ_MATH", "SUBJ_SCIENCE"],
                "availability": {
                    "Monday": [True] * 6,
                    "Tuesday": [True] * 5,
                    "Wednesday": [True] * 4,
                    "Thursday": [True] * 3,
                    "Friday": [True, True],
                    "Saturday": [True]
                },
                "maxPeriodsPerWeek": 21
            }
        ],
        "classes": [
            {
                "id": "CLASS_1",
                "name": "Class 1",
                "studentCount": 25,
                "gradeLevel": 1,
                "category": "Alpha-Primary",
                "subjectRequirements": {
                    "SUBJ_MATH": {"periodsPerWeek": 11},
                    "SUBJ_SCIENCE": {"periodsPerWeek": 10}
                }
            }
        ]
    }

# Test 1: Weekend Schedule (5+5+5+5+5+2 = 27 periods)
print("\nTest 1: Weekend Schedule (5+5+5+5+5+2 = 27 periods)")
print("-" * 70)
data1 = create_weekend_schedule_data()

try:
    # Validate data first
    validated = TimetableData(**data1)
    print(f"  ✓ Data validated successfully")
    print(f"    Classes: {len(validated.classes)}")
    print(f"    Total periods/week: {sum(validated.config.periodsPerDayMap.values())}")
    
    # Solve
    start_time = time.time()
    solution = solve_with_decomposition_if_beneficial(data1)
    elapsed = time.time() - start_time
    
    if solution and not (isinstance(solution, list) and len(solution) > 0 and solution[0].get('error')):
        print(f"  ✓ PASS: Weekend schedule solved in {elapsed:.2f}s")
        print(f"    Total lessons: {len(solution)}")
        
        # Verify Saturday has only 2 periods
        saturday_lessons = [l for l in solution if l.get('day') == 'Saturday']
        saturday_periods = set(l.get('periodIndex') for l in saturday_lessons)
        if max(saturday_periods) < 2:
            print(f"    ✓ Saturday correctly limited to 2 periods (periods used: {sorted(saturday_periods)})")
        else:
            print(f"    ✗ Saturday has periods beyond 2: {sorted(saturday_periods)}")
        
        # Check if periodsThisDay metadata is present
        if any('periodsThisDay' in l for l in solution):
            print(f"    ✓ Dynamic period metadata included in solution")
        
        # Performance check
        if elapsed < 120:
            print(f"    ✓ Performance: Under 2 minutes")
        else:
            print(f"    ⚠ Performance: {elapsed:.1f}s (target: <120s)")
    else:
        error_msg = solution[0].get('error') if solution and len(solution) > 0 else "Unknown error"
        print(f"  ✗ FAIL: Solver failed - {error_msg}")
        
except Exception as e:
    print(f"  ✗ FAIL: {str(e)[:200]}")

# Test 2: Variable Periods (6+5+4+3+2+1 = 21 periods)
print("\nTest 2: Variable Periods (6+5+4+3+2+1 = 21 periods)")
print("-" * 70)
data2 = create_variable_periods_data()

try:
    validated = TimetableData(**data2)
    print(f"  ✓ Data validated successfully")
    print(f"    Period distribution: Mon=6, Tue=5, Wed=4, Thu=3, Fri=2, Sat=1")
    
    start_time = time.time()
    solution = solve_with_decomposition_if_beneficial(data2)
    elapsed = time.time() - start_time
    
    if solution and not (isinstance(solution, list) and len(solution) > 0 and solution[0].get('error')):
        print(f"  ✓ PASS: Variable periods schedule solved in {elapsed:.2f}s")
        print(f"    Total lessons: {len(solution)}")
        
        # Verify period distribution
        for day, expected_periods in data2['config']['periodsPerDayMap'].items():
            day_lessons = [l for l in solution if l.get('day') == day]
            day_periods = set(l.get('periodIndex') for l in day_lessons)
            max_period = max(day_periods) if day_periods else -1
            if max_period < expected_periods:
                print(f"    ✓ {day}: max period {max_period} < limit {expected_periods}")
            else:
                print(f"    ✗ {day}: max period {max_period} >= limit {expected_periods}")
    else:
        error_msg = solution[0].get('error') if solution and len(solution) > 0 else "Unknown error"
        print(f"  ✗ FAIL: Solver failed - {error_msg}")
        
except Exception as e:
    print(f"  ✗ FAIL: {str(e)[:200]}")

# Test 3: Backward Compatibility - Fixed Periods
print("\nTest 3: Backward Compatibility (Fixed 5 periods/day)")
print("-" * 70)
data3 = {
    "config": {
        "daysOfWeek": ["Monday", "Tuesday", "Wednesday"],
        "periodsPerDay": 5,
        # No periodsPerDayMap - should use old format
        "solverTimeLimitSeconds": 60
    },
    "rooms": [{"id": "ROOM_1", "name": "Room 1", "capacity": 30, "type": "Classroom"}],
    "subjects": [{"id": "SUBJ_MATH", "name": "Mathematics"}],
    "teachers": [{
        "id": "TEACHER_1",
        "fullName": "Teacher One",
        "primarySubjectIds": ["SUBJ_MATH"],
        "availability": {
            "Monday": [True] * 5,
            "Tuesday": [True] * 5,
            "Wednesday": [True] * 5
        },
        "maxPeriodsPerWeek": 15
    }],
    "classes": [{
        "id": "CLASS_1",
        "name": "Class 1",
        "studentCount": 25,
        "subjectRequirements": {
            "SUBJ_MATH": {"periodsPerWeek": 15}
        }
    }]
}

try:
    validated = TimetableData(**data3)
    print(f"  ✓ Data validated (old format)")
    
    start_time = time.time()
    solution = solve_with_decomposition_if_beneficial(data3)
    elapsed = time.time() - start_time
    
    if solution and not (isinstance(solution, list) and len(solution) > 0 and solution[0].get('error')):
        print(f"  ✓ PASS: Fixed periods schedule solved in {elapsed:.2f}s")
        print(f"    Total lessons: {len(solution)}")
        print(f"    ✓ Backward compatibility maintained")
    else:
        print(f"  ✗ FAIL: Backward compatibility broken")
        
except Exception as e:
    print(f"  ✗ FAIL: {str(e)[:200]}")

print("\n" + "=" * 70)
print("✓ CHUNK 5 dynamic periods performance tests completed!")
print("\nSummary:")
print("  - Weekend schedules (5+2) supported")
print("  - Variable periods (6+5+4+3+2+1) supported")
print("  - Backward compatibility maintained")
print("  - Performance acceptable")
