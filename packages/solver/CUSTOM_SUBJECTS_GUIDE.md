# Custom Subjects Guide
**Afghanistan Education Ministry - Maktab Timetable System**

---

## Overview

The Maktab timetable solver supports **custom subjects** beyond the default Afghanistan curriculum. This allows schools to add specialized subjects like:
- Advanced Quran Studies
- Computer Programming
- English Literature
- Regional Language Studies
- Vocational Training
- Sports Specialization

Custom subjects work seamlessly with the solver - they're treated like any other subject!

---

## How to Add Custom Subjects

### Step 1: Define the Custom Subject

Add to the `subjects` array with `isCustom: true`:

```json
{
  "subjects": [
    // Standard subjects
    {
      "id": "SUBJ_MATH",
      "name": "Mathematics",
      "isCustom": false
    },
    // Custom subject
    {
      "id": "SUBJ_QURAN_ADV",
      "name": "Advanced Quran Studies",
      "isCustom": true,
      "customCategory": "High"
    }
  ]
}
```

#### Fields:
- **`id`** (required): Unique identifier (e.g., "SUBJ_QURAN_ADV")
- **`name`** (required): Display name (e.g., "Advanced Quran Studies")
- **`isCustom`** (required): Set to `true` for custom subjects
- **`customCategory`** (optional): Target grade category
  - Valid values: `"Alpha-Primary"`, `"Beta-Primary"`, `"Middle"`, `"High"`
  - Use this to indicate which grade levels the subject is designed for

### Step 2: Add to Class Requirements

Add the custom subject to class `subjectRequirements` like any other subject:

```json
{
  "classes": [
    {
      "id": "CLASS_10A",
      "name": "Class 10-A",
      "gradeLevel": 10,
      "category": "High",
      "subjectRequirements": {
        "SUBJ_MATH": { "periodsPerWeek": 6 },
        "SUBJ_PHYSICS": { "periodsPerWeek": 5 },
        "SUBJ_QURAN_ADV": { "periodsPerWeek": 3 }  // Custom subject!
      }
    }
  ]
}
```

### Step 3: Assign Teachers

Ensure at least one teacher can teach the custom subject:

```json
{
  "teachers": [
    {
      "id": "TEACHER_IMAM",
      "fullName": "Maulvi Ahmad",
      "primarySubjectIds": ["SUBJ_QURAN_ADV"],
      "availability": { /* ... */ },
      "maxPeriodsPerWeek": 20
    }
  ]
}
```

### Step 4: Solve!

The solver will automatically:
- ✅ Schedule the custom subject
- ✅ Assign qualified teachers
- ✅ Respect all constraints
- ✅ Include it in the output

---

## Examples

### Example 1: Computer Science for High School

```json
{
  "id": "SUBJ_CS",
  "name": "Computer Science",
  "isCustom": true,
  "customCategory": "High",
  "requiredRoomType": "Computer Lab"
}
```

### Example 2: Local Language for Primary

```json
{
  "id": "SUBJ_UZBEK",
  "name": "Uzbek Language",
  "isCustom": true,
  "customCategory": "Alpha-Primary"
}
```

### Example 3: Vocational Training for Middle School

```json
{
  "id": "SUBJ_CARPENTRY",
  "name": "Carpentry Workshop",
  "isCustom": true,
  "customCategory": "Middle",
  "requiredRoomType": "Workshop",
  "minRoomCapacity": 15
}
```

---

## Validation

The system validates custom subjects:

### ✅ Valid Configuration
```json
{
  "id": "SUBJ_ART",
  "name": "Art & Calligraphy",
  "isCustom": true,
  "customCategory": "Beta-Primary"  // Valid category
}
```

### ❌ Invalid Configuration
```json
{
  "id": "SUBJ_ART",
  "name": "Art & Calligraphy",
  "isCustom": true,
  "customCategory": "Elementary"  // Invalid! Must be one of the 4 categories
}
```

**Error Message:**
```
Custom Subject Error: Subject 'Art & Calligraphy' (ID: SUBJ_ART) has invalid 
customCategory 'Elementary'. Valid values: Alpha-Primary, Beta-Primary, Middle, High
```

---

## Solver Behavior

Custom subjects are treated **identically** to standard subjects:

1. **Scheduling:** Same constraints apply (teacher availability, room requirements, etc.)
2. **Period Allocation:** Respects `periodsPerWeek` like any subject
3. **Teacher Assignment:** Must have qualified teacher
4. **Room Assignment:** Respects room requirements if specified
5. **Output:** Included in solution with `isCustom` flag for UI display

---

## Display in UI

The solution metadata includes custom subject information:

```json
{
  "schedule": [ /* lessons */ ],
  "metadata": {
    "subjects": [
      {
        "subjectId": "SUBJ_QURAN_ADV",
        "subjectName": "Advanced Quran Studies",
        "isCustom": true,
        "customCategory": "High"
      }
    ],
    "statistics": {
      "customSubjects": 3  // Count of custom subjects
    }
  }
}
```

### UI Recommendations:
- Display custom subjects with special badge/icon
- Filter by `isCustom` flag
- Group by `customCategory`
- Show custom subject count in statistics

---

## Best Practices

### ✅ DO:
- Use descriptive IDs (e.g., `SUBJ_QURAN_ADV` not `SUBJ_001`)
- Set `customCategory` for grade-specific subjects
- Ensure teachers are qualified for custom subjects
- Specify room requirements if needed
- Test with small data first

### ❌ DON'T:
- Mix custom and standard subjects with same ID
- Forget to assign teachers who can teach custom subjects
- Use invalid category names
- Over-complicate - keep it simple!

---

## FAQ

**Q: Can I have unlimited custom subjects?**  
A: Yes! The solver handles custom subjects like any other subject.

**Q: Do custom subjects affect solver performance?**  
A: No, they're treated identically to standard subjects.

**Q: Can a custom subject be required by multiple classes?**  
A: Absolutely! Just add it to each class's `subjectRequirements`.

**Q: Can I update a standard subject to be custom?**  
A: Yes, just set `isCustom: true`. Backward compatible.

**Q: Do I need to specify `customCategory`?**  
A: No, it's optional. Use it if the subject is grade-specific.

**Q: Can custom subjects have single-teacher mode?**  
A: Yes! Single-teacher mode works with all subjects (custom or standard).

---

## Support

For issues or questions:
1. Check validation error messages
2. Review this guide
3. Check test files: `test_requirements_models.py`
4. Consult main documentation

---

**Happy scheduling with custom subjects!** 🎓
