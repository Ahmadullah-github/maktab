#!/usr/bin/env python3
"""Test thorough strategy with excellent teacher coverage."""
import sys
import json

# Excellent coverage - should select Thorough or Balanced
test_data = {
    "config": {
        "daysOfWeek": ["Saturday", "Sunday", "Monday"],  # Shorter week for faster solving
        "periodsPerDay": 5,
        "schoolStartTime": "08:00",
        "periodDurationMinutes": 45,
        "solverTimeLimitSeconds": 30,
        "solverOptimizationLevel": 2,
        "enableGracefulDegradation": True,
        "enforceGenderSeparation": False
    },
    "preferences": {"avoidTeacherGapsWeight": 0, "avoidClassGapsWeight": 0},
    "teachers": [
        # 6 teachers, all can teach math
        *[{
            "id": f"t{i}",
            "fullName": f"Teacher {i}",
            "primarySubjectIds": ["math"],
            "allowedSubjectIds": [],
            "restrictToPrimarySubjects": False,
            "maxPeriodsPerWeek": 25,
            "maxConsecutivePeriods": 5,
            "availability": {
                "Saturday": [True] * 5,
                "Sunday": [True] * 5,
                "Monday": [True] * 5
            }
        } for i in range(1, 7)]
    ],
    "subjects": [{"id": "math", "name": "Math", "difficulty": "normal"}],
    "rooms": [
        {"id": "r1", "name": "Room 1", "capacity": 35, "type": "regular", "features": []},
        {"id": "r2", "name": "Room 2", "capacity": 35, "type": "regular", "features": []}
    ],
    "classes": [
        {
            "id": "c1",
            "name": "Class 1",
            "grade": 7,
            "studentCount": 30,
            "subjectRequirements": {
                "math": {"periodsPerWeek": 2, "consecutivePeriods": 1}
            },
            "unavailablePeriods": []
        }
    ],
    "fixedLessons": []
}

print("\n" + "="*80, file=sys.stderr)
print("TESTING HIGH-COVERAGE STRATEGY", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)
print("Test: 6 teachers, 1 class, 2 math periods", file=sys.stderr)
print("Expected: BALANCED or THOROUGH (avg_teachers = 6.0)", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)

json.dump(test_data, sys.stdout)
sys.stdout.write('\n')
