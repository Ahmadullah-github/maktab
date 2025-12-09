#!/usr/bin/env python3
"""Test balanced strategy with good teacher coverage."""
import sys
import json

# Better test data - multiple teachers per subject (should select Balanced strategy)
test_data = {
    "config": {
        "daysOfWeek": ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
        "periodsPerDay": 7,
        "schoolStartTime": "08:00",
        "periodDurationMinutes": 45,
        "solverTimeLimitSeconds": 60,
        "solverOptimizationLevel": 2,  # Request Thorough
        "enableGracefulDegradation": True,
        "enforceGenderSeparation": False
    },
    "preferences": {
        "avoidTeacherGapsWeight": 1.0,
        "avoidClassGapsWeight": 1.0
    },
    "teachers": [
        # Math teachers (3 teachers can teach math)
        {
            "id": "t1",
            "fullName": "Math Teacher 1",
            "primarySubjectIds": ["math"],
            "allowedSubjectIds": ["physics"],
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
            "fullName": "Math Teacher 2",
            "primarySubjectIds": ["math"],
            "allowedSubjectIds": ["physics"],
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
            "fullName": "Science Teacher",
            "primarySubjectIds": ["physics", "chemistry"],
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
        },
        # English teachers (2 teachers)
        {
            "id": "t4",
            "fullName": "English Teacher 1",
            "primarySubjectIds": ["english"],
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
            "id": "t5",
            "fullName": "English Teacher 2",
            "primarySubjectIds": ["english"],
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
        }
    ],
    "subjects": [
        {"id": "math", "name": "Mathematics", "difficulty": "difficult"},
        {"id": "physics", "name": "Physics", "difficulty": "normal"},
        {"id": "chemistry", "name": "Chemistry", "difficulty": "normal"},
        {"id": "english", "name": "English", "difficulty": "normal"}
    ],
    "rooms": [
        {"id": "r1", "name": "Room 1", "capacity": 35, "type": "regular", "features": []},
        {"id": "r2", "name": "Room 2", "capacity": 35, "type": "regular", "features": []},
        {"id": "r3", "name": "Room 3", "capacity": 35, "type": "regular", "features": []}
    ],
    "classes": [
        {
            "id": "c1",
            "name": "Class 7A",
            "grade": 7,
            "studentCount": 30,
            "subjectRequirements": {
                "math": {"periodsPerWeek": 4, "consecutivePeriods": 1},
                "physics": {"periodsPerWeek": 2, "consecutivePeriods": 1},
                "english": {"periodsPerWeek": 3, "consecutivePeriods": 1}
            },
            "unavailablePeriods": []
        },
        {
            "id": "c2",
            "name": "Class 7B",
            "grade": 7,
            "studentCount": 28,
            "subjectRequirements": {
                "math": {"periodsPerWeek": 4, "consecutivePeriods": 1},
                "chemistry": {"periodsPerWeek": 2, "consecutivePeriods": 1},
                "english": {"periodsPerWeek": 3, "consecutivePeriods": 1}
            },
            "unavailablePeriods": []
        }
    ],
    "fixedLessons": []
}

print("\n" + "="*80, file=sys.stderr)
print("TESTING BALANCED STRATEGY (Good Teacher Coverage)", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)

print("Test Data Characteristics:", file=sys.stderr)
print(f"  - Teachers: {len(test_data['teachers'])} (multi-subject capable)", file=sys.stderr)
print(f"  - Classes: {len(test_data['classes'])}", file=sys.stderr)
print(f"  - Total requests: ~18 periods", file=sys.stderr)
print(f"  - Math: 3 teachers can teach it", file=sys.stderr)
print(f"  - English: 2 teachers", file=sys.stderr)
print(f"  - Physics/Chemistry: 2 teachers", file=sys.stderr)
print("", file=sys.stderr)

print("Expected Strategy: BALANCED or THOROUGH", file=sys.stderr)
print("   (avg_teachers should be >= 2.5)", file=sys.stderr)
print("", file=sys.stderr)

print("Running solver...", file=sys.stderr)
print("="*80 + "\n", file=sys.stderr)

json.dump(test_data, sys.stdout)
sys.stdout.write('\n')
sys.stdout.flush()
