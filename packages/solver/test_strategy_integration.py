#!/usr/bin/env python3
"""Test script for strategy integration."""
import sys
import json

# Test data - minimal timetable to verify strategy selection
test_data = {
    "config": {
        "daysOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        "periodsPerDay": 7,
        "schoolStartTime": "08:00",
        "periodDurationMinutes": 45,
        "solverTimeLimitSeconds": 60,  # Short time for testing
        "solverOptimizationLevel": 2,  # Request Thorough, but should auto-select
        "enableGracefulDegradation": True,
        "enforceGenderSeparation": False
    },
    "preferences": {
        "avoidTeacherGapsWeight": 1.0,
        "avoidClassGapsWeight": 1.0
    },
    "teachers": [
        {
            "id": "t1",
            "fullName": "Teacher 1",
            "primarySubjectIds": ["math", "physics"],
            "allowedSubjectIds": [],
            "restrictToPrimarySubjects": False,
            "maxPeriodsPerWeek": 30,
            "maxConsecutivePeriods": 5,
            "availability": {
                "Saturday": [True] * 7,
                "Sunday": [True] * 7,
                "Monday": [True] * 7,
                "Tuesday": [True] * 7,
                "Wednesday": [True] * 7,
                "Thursday": [True] * 7
            }
        },
        {
            "id": "t2",
            "fullName": "Teacher 2",
            "primarySubjectIds": ["math", "chemistry"],
            "allowedSubjectIds": [],
            "restrictToPrimarySubjects": False,
            "maxPeriodsPerWeek": 30,
            "maxConsecutivePeriods": 5,
            "availability": {
                "Saturday": [True] * 7,
                "Sunday": [True] * 7,
                "Monday": [True] * 7,
                "Tuesday": [True] * 7,
                "Wednesday": [True] * 7,
                "Thursday": [True] * 7
            }
        },
        {
            "id": "t3",
            "fullName": "Teacher 3",
            "primarySubjectIds": ["english"],
            "allowedSubjectIds": ["math"],
            "restrictToPrimarySubjects": False,
            "maxPeriodsPerWeek": 30,
            "maxConsecutivePeriods": 5,
            "availability": {
                "Saturday": [True] * 7,
                "Sunday": [True] * 7,
                "Monday": [True] * 7,
                "Tuesday": [True] * 7,
                "Wednesday": [True] * 7,
                "Thursday": [True] * 7
            }
        }
    ],
    "subjects": [
        {
            "id": "math",
            "name": "Mathematics",
            "difficulty": "difficult"
        },
        {
            "id": "physics",
            "name": "Physics",
            "difficulty": "normal"
        },
        {
            "id": "chemistry",
            "name": "Chemistry",
            "difficulty": "normal"
        },
        {
            "id": "english",
            "name": "English",
            "difficulty": "normal"
        }
    ],
    "rooms": [
        {
            "id": "r1",
            "name": "Room 1",
            "capacity": 35,
            "type": "regular",
            "features": []
        },
        {
            "id": "r2",
            "name": "Room 2",
            "capacity": 35,
            "type": "regular",
            "features": []
        },
        {
            "id": "r3",
            "name": "Room 3",
            "capacity": 35,
            "type": "regular",
            "features": []
        }
    ],
    "classes": [
        {
            "id": "c1",
            "name": "Class 7A",
            "grade": 7,
            "studentCount": 30,
            "subjectRequirements": {
                "math": {
                    "periodsPerWeek": 4,
                    "consecutivePeriods": 1
                },
                "physics": {
                    "periodsPerWeek": 3,
                    "consecutivePeriods": 1
                },
                "english": {
                    "periodsPerWeek": 3,
                    "consecutivePeriods": 1
                }
            },
            "unavailablePeriods": []
        },
        {
            "id": "c2",
            "name": "Class 7B",
            "grade": 7,
            "studentCount": 28,
            "subjectRequirements": {
                "math": {
                    "periodsPerWeek": 4,
                    "consecutivePeriods": 1
                },
                "chemistry": {
                    "periodsPerWeek": 3,
                    "consecutivePeriods": 1
                },
                "english": {
                    "periodsPerWeek": 3,
                    "consecutivePeriods": 1
                }
            },
            "unavailablePeriods": []
        }
    ],
    "fixedLessons": []
}

print("\n" + "="*80, file=sys.stderr)
print("TESTING STRATEGY INTEGRATION", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)

print("Test Data Characteristics:", file=sys.stderr)
print(f"  - Teachers: {len(test_data['teachers'])}", file=sys.stderr)
print(f"  - Classes: {len(test_data['classes'])}", file=sys.stderr)
print(f"  - Subjects: {len(test_data['subjects'])}", file=sys.stderr)
print(f"  - Rooms: {len(test_data['rooms'])}", file=sys.stderr)
print(f"  - Total requests: ~20 (2 classes x 10 periods)", file=sys.stderr)
print(f"  - Requested optimization level: 2 (Thorough)", file=sys.stderr)
print("", file=sys.stderr)

print("Expected Strategy: BALANCED or THOROUGH", file=sys.stderr)
print("   (avg_teachers should be ~2-3 for this data)", file=sys.stderr)
print("", file=sys.stderr)

print("Running solver...", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)

# Write to stdout as JSON for the solver to read
json.dump(test_data, sys.stdout)
sys.stdout.write('\n')
sys.stdout.flush()
