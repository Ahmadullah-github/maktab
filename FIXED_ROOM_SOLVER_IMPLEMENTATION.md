# Fixed Room Solver Implementation Guide

## Changes Required in solver_enhanced.py

### 1. Pydantic Model Updated ✓
The `ClassGroup` model now includes `fixedRoomId`:
```python
class ClassGroup(BaseModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    studentCount: int = Field(ge=0)
    subjectRequirements: Dict[str, SubjectRequirement]
    fixedRoomId: Optional[str] = Field(default=None)  # ✓ ADDED
    meta: Optional[Dict[str, Any]] = Field(None)
    gender: Optional[str] = Field(default=None)
```

### 2. Hard Constraint Logic - Line ~707

**LOCATION**: In `_create_variables()` method, after line 707 where `allowed_rooms` is computed

**REPLACE THIS** (line 708):
```python
allowed_rooms = [self.room_map[r['id']] for r in self.data_dict['rooms'] if is_room_compatible(r, subject, class_group)]
```

**WITH THIS**:
```python
# FIXED ROOM CONSTRAINT: Check if class has a fixed room requirement
fixed_room_id = getattr(class_group, 'fixedRoomId', None)
if fixed_room_id and fixed_room_id in self.room_map:
    # Hard constraint: restrict to single room
    fixed_room_idx = self.room_map[fixed_room_id]
    fixed_room = self.data_dict['rooms'][fixed_room_idx]
    
    # Validate that the fixed room is compatible
    if is_room_compatible(fixed_room, subject, class_group):
        allowed_rooms = [fixed_room_idx]
        log.info("Fixed room constraint applied", 
                 request=r_idx, 
                 class_id=c_id, 
                 class_name=class_group.name,
                 subject_id=s_id,
                 fixed_room_id=fixed_room_id,
                 fixed_room_name=fixed_room['name'])
    else:
        # Fixed room is incompatible - error
        reasons = []
        min_cap = subject.get('minRoomCapacity', 0)
        if fixed_room['capacity'] < max(class_group.studentCount, min_cap):
            reasons.append(f"capacity {fixed_room['capacity']} < required {max(class_group.studentCount, min_cap)}")
        req_type = subject.get('requiredRoomType')
        if req_type and fixed_room['type'] != req_type:
            reasons.append(f"type mismatch")
        req_features = set(subject.get('requiredFeatures') or [])
        if not req_features.issubset(set(fixed_room.get('features', []))):
            reasons.append(f"missing features")
        
        raise RuntimeError(json.dumps({
            "error": "Fixed room incompatible with requirements",
            "class": {"id": c_id, "name": class_group.name, "fixedRoomId": fixed_room_id},
            "subject": {"id": s_id, "name": subject['name']},
            "fixed_room": {"id": fixed_room_id, "name": fixed_room['name']},
            "reasons": reasons
        }, indent=2))
else:
    # Normal room filtering - no fixed room
    allowed_rooms = [self.room_map[r['id']] for r in self.data_dict['rooms'] if is_room_compatible(r, subject, class_group)]
```

## How It Works

1. **Check for fixedRoomId**: When creating variables for each class-subject request, check if the class has `fixedRoomId` set
2. **Restrict Domain**: If fixedRoomId exists, restrict `allowed_rooms` list to contain ONLY that room index
3. **Validate Compatibility**: Ensure the fixed room meets subject requirements (capacity, type, features)
4. **Error Handling**: If fixed room is incompatible, raise detailed error before solving
5. **CP-SAT Variable**: The `room_var` is created with domain restricted to single value: `[fixed_room_idx]`
6. **Hard Constraint**: OR-Tools CP-SAT automatically enforces this as the ONLY possible room assignment

## Result

When `fixedRoomId` is set for a class:
- All lessons for that class will be assigned to the specified room
- No other room can be used (hard constraint)
- Solver will fail if the fixed room creates schedule conflicts (e.g., multiple classes locked to same room with overlapping times)

## Testing

Test case JSON:
```json
{
  "classes": [
    {
      "id": "c1",
      "name": "Grade7-A",
      "studentCount": 30,
      "fixedRoomId": "room-lab1",
      "subjectRequirements": {"math": {"periodsPerWeek": 5}}
    }
  ]
}
```

Expected: All math lessons for Grade7-A scheduled in room-lab1.
