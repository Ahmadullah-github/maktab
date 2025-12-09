import json
import sys
import os

# Test data that matches the expected format
test_data = {
    "config": {
        "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        "periodsPerDay": 7,
        "schoolStartTime": "08:00",
        "periodDurationMinutes": 45,
        "periods": [],
        "breakPeriods": [3],
        "timezone": "Asia/Kabul"
    },
    "preferences": {
        "avoidTeacherGapsWeight": 1.0,
        "avoidClassGapsWeight": 1.0,
        "distributeDifficultSubjectsWeight": 0.8,
        "balanceTeacherLoadWeight": 0.7,
        "minimizeRoomChangesWeight": 0.3,
        "preferMorningForDifficultWeight": 0.5,
        "respectTeacherTimePreferenceWeight": 0.5,
        "respectTeacherRoomPreferenceWeight": 0.2,
        "allowConsecutivePeriodsForSameSubject": True
    },
    "rooms": [
        {
            "id": "1",
            "name": "Room 1",
            "capacity": 30,
            "type": "classroom",
            "features": ["whiteboard", "projector"]
        }
    ],
    "subjects": [
        {
            "id": "1",
            "name": "Mathematics",
            "code": "MATH101",
            "isDifficult": True,
            "requiredRoomType": "classroom"
        }
    ],
    "teachers": [
        {
            "id": "1",
            "fullName": "John Doe",
            "primarySubjectIds": ["1"],
            "availability": {
                "Monday": [True, True, True, False, True, True, True],
                "Tuesday": [True, True, True, False, True, True, True],
                "Wednesday": [True, True, True, False, True, True, True],
                "Thursday": [True, True, True, False, True, True, True],
                "Friday": [True, True, True, False, True, True, True]
            },
            "maxPeriodsPerWeek": 20,
            "timePreference": "Morning"
        }
    ],
    "classes": [
        {
            "id": "1",
            "name": "Class 1A",
            "studentCount": 25,
            "subjectRequirements": {
                "1": {
                    "periodsPerWeek": 5,
                    "minConsecutive": 1,
                    "maxConsecutive": 2
                }
            }
        }
    ]
}

# Write the test data to a file
with open('test_data.json', 'w') as f:
    json.dump(test_data, f, indent=2)

print("Test data written to test_data.json")
print("You can test the solver with:")
print("cd dist && cat ../test_data.json | python solver_enhanced.py")