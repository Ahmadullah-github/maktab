"""Test CHUNK 4: Custom Subjects validation."""

from solver_enhanced import TimetableData
import json

print("Testing CHUNK 4: Custom Subjects Validation")
print("=" * 50)

# Base test data
base_data = {
    "config": {
        "daysOfWeek": ["Monday", "Tuesday", "Wednesday"],
        "periodsPerDay": 5,
        "periodsPerDayMap": {"Monday": 5, "Tuesday": 5, "Wednesday": 5},
        "solverTimeLimitSeconds": 60
    },
    "rooms": [{"id": "ROOM_1", "name": "Room 1", "capacity": 30, "type": "Classroom"}],
    "classes": [{
        "id": "CLASS_1",
        "name": "Class 1",
        "studentCount": 25,
        "gradeLevel": 10,
        "category": "High",
        "subjectRequirements": {
            "SUBJ_CUSTOM": {"periodsPerWeek": 5}
        }
    }],
    "teachers": [{
        "id": "TEACHER_1",
        "fullName": "Teacher One",
        "primarySubjectIds": ["SUBJ_CUSTOM"],
        "availability": {
            "Monday": [True] * 5,
            "Tuesday": [True] * 5,
            "Wednesday": [True] * 5
        },
        "maxPeriodsPerWeek": 20
    }]
}

# Test 1: Valid custom subject
print("\nTest 1: Valid custom subject with category")
data1 = base_data.copy()
data1["subjects"] = [{
    "id": "SUBJ_CUSTOM",
    "name": "Advanced Quran Studies",
    "isCustom": True,
    "customCategory": "High"
}]

try:
    validated = TimetableData(**data1)
    print("  ✓ PASS: Valid custom subject accepted")
except Exception as e:
    print(f"  ✗ FAIL: {e}")

# Test 2: Custom subject without category (should work)
print("\nTest 2: Valid custom subject without category")
data2 = base_data.copy()
data2["subjects"] = [{
    "id": "SUBJ_CUSTOM",
    "name": "Art Class",
    "isCustom": True
    # No customCategory - should be fine
}]

try:
    validated = TimetableData(**data2)
    print("  ✓ PASS: Custom subject without category accepted")
except Exception as e:
    print(f"  ✗ FAIL: {e}")

# Test 3: Standard subject (not custom)
print("\nTest 3: Standard subject (isCustom=False)")
data3 = base_data.copy()
data3["subjects"] = [{
    "id": "SUBJ_CUSTOM",
    "name": "Mathematics",
    "isCustom": False
}]

try:
    validated = TimetableData(**data3)
    print("  ✓ PASS: Standard subject accepted")
except Exception as e:
    print(f"  ✗ FAIL: {e}")

# Test 4: Invalid category (should fail)
print("\nTest 4: Invalid customCategory (should fail)")
data4 = base_data.copy()
data4["subjects"] = [{
    "id": "SUBJ_CUSTOM",
    "name": "Invalid Subject",
    "isCustom": True,
    "customCategory": "Elementary"  # Invalid!
}]

try:
    validated = TimetableData(**data4)
    print("  ✗ FAIL: Should have rejected invalid category")
except ValueError as e:
    if "Custom Subject Error" in str(e) and "invalid customCategory" in str(e):
        print(f"  ✓ PASS: Correctly rejected invalid category")
        print(f"    Error: {str(e)[:80]}...")
    else:
        print(f"  ✗ FAIL: Wrong error: {e}")

# Test 5: Multiple custom subjects
print("\nTest 5: Multiple custom subjects with different categories")
data5 = base_data.copy()
data5["classes"][0]["subjectRequirements"] = {
    "SUBJ_QURAN": {"periodsPerWeek": 3},
    "SUBJ_CS": {"periodsPerWeek": 2}
}
data5["subjects"] = [
    {
        "id": "SUBJ_QURAN",
        "name": "Quran Studies",
        "isCustom": True,
        "customCategory": "High"
    },
    {
        "id": "SUBJ_CS",
        "name": "Computer Science",
        "isCustom": True,
        "customCategory": "High"
    }
]
data5["teachers"][0]["primarySubjectIds"] = ["SUBJ_QURAN", "SUBJ_CS"]

try:
    validated = TimetableData(**data5)
    print("  ✓ PASS: Multiple custom subjects accepted")
    print(f"    Custom subjects count: {sum(1 for s in validated.subjects if s.isCustom)}")
except Exception as e:
    print(f"  ✗ FAIL: {e}")

# Test 6: All valid categories
print("\nTest 6: All four valid categories")
valid_categories = ["Alpha-Primary", "Beta-Primary", "Middle", "High"]
for i, category in enumerate(valid_categories):
    data = json.loads(json.dumps(base_data))  # Deep copy
    data["subjects"] = [{
        "id": "SUBJ_CUSTOM",
        "name": f"Subject for {category}",
        "isCustom": True,
        "customCategory": category
    }]
    # Make sure class requirements match
    data["classes"][0]["subjectRequirements"] = {
        "SUBJ_CUSTOM": {"periodsPerWeek": 5}
    }
    # Make sure teacher can teach it
    data["teachers"][0]["primarySubjectIds"] = ["SUBJ_CUSTOM"]
    
    try:
        validated = TimetableData(**data)
        print(f"  ✓ PASS: {category:15s} accepted")
    except Exception as e:
        print(f"  ✗ FAIL: {category:15s} rejected: {e}")

print("\n" + "=" * 50)
print("✓ All CHUNK 4 custom subject tests completed!")
