#!/usr/bin/env python3
import json
from solver_enhanced import is_room_compatible, TimetableData

# Load test data
with open("test.json") as f:
    data = json.load(f)

# Parse with Pydantic
timetable_data = TimetableData(**data)

# Get Physics subject and 8/B class
physics_subject = None
class_8b = None
lab_room = None

for subject in timetable_data.subjects:
    if subject.id == 'PHY':
        physics_subject = subject
        break

for class_group in timetable_data.classes:
    if class_group.id == '8/B':
        class_8b = class_group
        break

for room in timetable_data.rooms:
    if room.type == 'lab':
        lab_room = room
        break

print("Physics subject:", physics_subject)
print("Class 8/B:", class_8b)
print("Lab room:", lab_room)

if physics_subject and class_8b and lab_room:
    print("\nTesting room compatibility:")
    print(f"Room capacity: {lab_room.capacity}")
    print(f"Class student count: {class_8b.studentCount}")
    print(f"Subject min room capacity: {physics_subject.minRoomCapacity}")
    print(f"Required room type: {physics_subject.requiredRoomType}")
    print(f"Room type: {lab_room.type}")
    
    # Convert to dict for the function
    physics_dict = physics_subject.model_dump()
    lab_dict = lab_room.model_dump()
    
    is_compatible = is_room_compatible(lab_dict, physics_dict, class_8b)
    print(f"Is compatible: {is_compatible}")
else:
    print("Could not find required data")
