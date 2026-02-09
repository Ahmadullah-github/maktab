# Solver Error Reference Guide

A comprehensive reference of all error situations the timetable solver can
produce, with real examples for frontend user-friendly message handling.

---

## Table of Contents

1. [Response Structure](#response-structure)
2. [Error Severity Levels](#error-severity-levels)
3. [Error Categories](#error-categories)
   - [Validation Errors (Pre-Solve)](#1-validation-errors-pre-solve)
   - [Teacher Errors](#2-teacher-errors)
   - [Room Errors](#3-room-errors)
   - [Class Errors](#4-class-errors)
   - [Subject Errors](#5-subject-errors)
   - [Solver Runtime Errors](#6-solver-runtime-errors)
   - [Ministry Validation Errors](#7-ministry-validation-errors)
4. [Error Code Reference Table](#error-code-reference-table)
5. [Frontend Handling Recommendations](#frontend-handling-recommendations)

---

## Response Structure

All solver responses follow this standardized structure:

```typescript
interface SolverResponse {
  status: 'success' | 'partial' | 'failed';
  data: TimetableData | null;
  errors: SolverErrorDetail[]; // Blocking errors (severity="error")
  warnings: SolverErrorDetail[]; // Non-blocking warnings (severity="warning")
  quality_score: QualityScore | null;
  metadata: SolverResponseMetadata;
}

interface SolverErrorDetail {
  error_code: string; // Unique error identifier
  severity: 'error' | 'warning' | 'info';
  message_key: string; // i18n lookup key
  message_farsi: string; // Localized Farsi message
  message_english: string; // English fallback
  affected_entities: AffectedEntity[];
  context: Record<string, any>; // Additional data for UI
}

interface AffectedEntity {
  entity_type: 'teacher' | 'class' | 'room' | 'subject';
  entity_id: string;
  entity_name: string;
}
```

---

## Error Severity Levels

| Severity  | Description                 | UI Behavior                        |
| --------- | --------------------------- | ---------------------------------- |
| `error`   | Blocks timetable generation | Show error modal, prevent proceed  |
| `warning` | Allows proceed with issues  | Show warning banner, allow proceed |
| `info`    | Suggestion only             | Show info tooltip or hint          |

---

## Error Categories

### 1. Validation Errors (Pre-Solve)

These errors occur during input validation before the solver runs.

#### 1.1 Period Configuration Errors

**Error: Missing Period Count for Day**

```json
{
  "error_code": "PERIOD_CONFIG_MISSING_DAY",
  "severity": "error",
  "message_farsi": "خطای تنظیمات دوره: تعداد ساعات برای روز Saturday مشخص نشده است. لطفاً ساعات را برای همه روزهای فعال مشخص کنید.",
  "message_english": "Period Configuration Error: Missing period count for Saturday. Please specify periods for all enabled days.",
  "context": {
    "missingDay": "Saturday"
  }
}
```

**Error: Periods Out of Range**

```json
{
  "error_code": "PERIOD_CONFIG_OUT_OF_RANGE",
  "severity": "error",
  "message_farsi": "خطای تنظیمات دوره: روز Saturday دارای 15 ساعت است. باید بین 1 تا 12 باشد.",
  "message_english": "Period Configuration Error: Saturday has 15 periods. Must be between 1 and 12.",
  "context": {
    "day": "Saturday",
    "periods": 15,
    "minAllowed": 1,
    "maxAllowed": 12
  }
}
```

**Error: Invalid Category in Per-Category Periods**

```json
{
  "error_code": "INVALID_CATEGORY",
  "severity": "error",
  "message_farsi": "دسته‌بندی نامعتبر 'Elementary'. باید یکی از موارد زیر باشد: Alpha-Primary, Beta-Primary, Middle, High",
  "message_english": "Invalid category 'Elementary'. Must be one of: Alpha-Primary, Beta-Primary, Middle, High",
  "context": {
    "invalidCategory": "Elementary",
    "validCategories": ["Alpha-Primary", "Beta-Primary", "Middle", "High"]
  }
}
```

---

#### 1.2 Teacher Availability Errors

**Error: Missing Availability for Day**

```json
{
  "error_code": "TEACHER_AVAILABILITY_MISSING_DAY",
  "severity": "error",
  "message_farsi": "خطای دسترسی استاد: استاد 'احمد احمدی' (شناسه: T001) دسترسی برای روز Saturday ندارد.",
  "message_english": "Teacher Availability Error: Teacher 'Ahmad Ahmadi' (ID: T001) is missing availability for Saturday.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T001",
      "entity_name": "احمد احمدی"
    }
  ],
  "context": {
    "teacherId": "T001",
    "teacherName": "احمد احمدی",
    "missingDay": "Saturday"
  }
}
```

**Error: Wrong Period Count in Availability**

```json
{
  "error_code": "TEACHER_AVAILABILITY_PERIOD_MISMATCH",
  "severity": "error",
  "message_farsi": "خطای دسترسی استاد: استاد 'احمد احمدی' برای روز Saturday دارای 5 ساعت است اما تنظیمات 7 ساعت انتظار دارد. لطفاً دسترسی استاد را با تنظیمات دوره هماهنگ کنید.",
  "message_english": "Teacher Availability Error: Teacher 'Ahmad Ahmadi' has 5 periods for Saturday but configuration expects 7. Please update teacher availability to match period configuration.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T001",
      "entity_name": "احمد احمدی"
    }
  ],
  "context": {
    "teacherId": "T001",
    "teacherName": "احمد احمدی",
    "day": "Saturday",
    "actualPeriods": 5,
    "expectedPeriods": 7
  }
}
```

---

#### 1.3 Subject Reference Errors

**Error: Unknown Subject Reference**

```json
{
  "error_code": "UNKNOWN_SUBJECT_REFERENCE",
  "severity": "error",
  "message_farsi": "خطای ارجاع مضمون: صنف 'صنف اول الف' (شناسه: C001) به مضمون ناشناخته 'MATHH' ارجاع داده است. آیا منظور شما 'MATH' بود؟",
  "message_english": "Subject Reference Error: Class 'Class 1A' (ID: C001) references unknown subject 'MATHH'. Did you mean: MATH?",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "classId": "C001",
    "className": "صنف اول الف",
    "unknownSubjectId": "MATHH",
    "suggestion": "MATH"
  }
}
```

**Error: Invalid Custom Subject Category**

```json
{
  "error_code": "INVALID_CUSTOM_SUBJECT_CATEGORY",
  "severity": "error",
  "message_farsi": "خطای مضمون سفارشی: مضمون 'کمپیوتر' (شناسه: COMP) دارای دسته‌بندی نامعتبر 'Primary' است. مقادیر معتبر: Alpha-Primary, Beta-Primary, Middle, High",
  "message_english": "Custom Subject Error: Subject 'Computer' (ID: COMP) has invalid customCategory 'Primary'. Valid values: Alpha-Primary, Beta-Primary, Middle, High",
  "affected_entities": [
    {
      "entity_type": "subject",
      "entity_id": "COMP",
      "entity_name": "کمپیوتر"
    }
  ],
  "context": {
    "subjectId": "COMP",
    "subjectName": "کمپیوتر",
    "invalidCategory": "Primary",
    "validCategories": ["Alpha-Primary", "Beta-Primary", "Middle", "High"]
  }
}
```

---

### 2. Teacher Errors

#### 2.1 Teacher Overload

**Error Code: `TEACHER_OVERLOAD`**

```json
{
  "error_code": "TEACHER_OVERLOAD",
  "severity": "error",
  "message_key": "error.teacher.overload",
  "message_farsi": "استاد احمد احمدی بیشتر از 25 ساعت در هفته تدریس نمیتواند، اما 32 ساعت نیاز است",
  "message_english": "Teacher Ahmad Ahmadi cannot teach more than 25 periods per week, but 32 periods are required",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T001",
      "entity_name": "احمد احمدی"
    }
  ],
  "context": {
    "teacherId": "T001",
    "teacherName": "احمد احمدی",
    "availablePeriods": 25,
    "requiredPeriods": 32
  }
}
```

**Pre-Solve Predicted Overload: `TEACHER_OVERLOAD_PREDICTED`**

```json
{
  "error_code": "TEACHER_OVERLOAD_PREDICTED",
  "severity": "error",
  "message_key": "error.teacher.overload_predicted",
  "message_farsi": "استاد محمد کریمی بیشتر از 20 ساعت در هفته تدریس نمیتواند، اما 28 ساعت نیاز است",
  "message_english": "Teacher Mohammad Karimi cannot teach more than 20 periods per week, but 28 periods are required",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T002",
      "entity_name": "محمد کریمی"
    }
  ],
  "context": {
    "teacherId": "T002",
    "teacherName": "محمد کریمی",
    "availablePeriods": 20,
    "requiredPeriods": 28
  }
}
```

---

#### 2.2 Teacher Availability Conflict

**Error Code: `TEACHER_AVAILABILITY_CONFLICT`**

```json
{
  "error_code": "TEACHER_AVAILABILITY_CONFLICT",
  "severity": "error",
  "message_key": "error.teacher.availability_conflict",
  "message_farsi": "استاد فاطمه رحیمی در هیچ یک از ساعات مورد نیاز برای ریاضی در دسترس نیست",
  "message_english": "Teacher Fatima Rahimi is not available for any of the periods required for Mathematics",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T003",
      "entity_name": "فاطمه رحیمی"
    },
    {
      "entity_type": "subject",
      "entity_id": "MATH",
      "entity_name": "ریاضی"
    }
  ],
  "context": {
    "teacherId": "T003",
    "teacherName": "فاطمه رحیمی",
    "subjectId": "MATH",
    "subjectName": "ریاضی"
  }
}
```

---

#### 2.3 No Qualified Teacher

**Error Code: `NO_QUALIFIED_TEACHER`**

```json
{
  "error_code": "NO_QUALIFIED_TEACHER",
  "severity": "error",
  "message_key": "error.teacher.no_qualified",
  "message_farsi": "برای مضمون فزیک در صنف دهم الف استاد واجد شرایط وجود ندارد",
  "message_english": "No qualified teacher exists for subject Physics in class 10A",
  "affected_entities": [
    {
      "entity_type": "subject",
      "entity_id": "PHYS",
      "entity_name": "فزیک"
    },
    {
      "entity_type": "class",
      "entity_id": "C010A",
      "entity_name": "دهم الف"
    }
  ],
  "context": {
    "subjectId": "PHYS",
    "subjectName": "فزیک",
    "classId": "C010A",
    "className": "دهم الف"
  }
}
```

---

### 3. Room Errors

#### 3.1 Room Conflict

**Error Code: `ROOM_CONFLICT`**

```json
{
  "error_code": "ROOM_CONFLICT",
  "severity": "error",
  "message_key": "error.room.conflict",
  "message_farsi": "اتاق لابراتوار کمپیوتر در Saturday ساعت 3 دو صنف دارد: صنف نهم الف و صنف دهم ب",
  "message_english": "Room Computer Lab has two classes at Saturday period 3: Class 9A and Class 10B",
  "affected_entities": [
    {
      "entity_type": "room",
      "entity_id": "R_COMP_LAB",
      "entity_name": "لابراتوار کمپیوتر"
    },
    {
      "entity_type": "class",
      "entity_id": "C009A",
      "entity_name": "صنف نهم الف"
    },
    {
      "entity_type": "class",
      "entity_id": "C010B",
      "entity_name": "صنف دهم ب"
    }
  ],
  "context": {
    "roomId": "R_COMP_LAB",
    "roomName": "لابراتوار کمپیوتر",
    "dayName": "Saturday",
    "periodNumber": 3,
    "class1Id": "C009A",
    "class1Name": "صنف نهم الف",
    "class2Id": "C010B",
    "class2Name": "صنف دهم ب"
  }
}
```

---

#### 3.2 Room Capacity Warning

**Error Code: `ROOM_CAPACITY_WARNING`**

```json
{
  "error_code": "ROOM_CAPACITY_WARNING",
  "severity": "warning",
  "message_key": "warning.room.capacity",
  "message_farsi": "ظرفیت اتاق‌ها ممکن است کافی نباشد: 180 ساعت نیاز، 150 ساعت موجود",
  "message_english": "Room capacity may be insufficient: 180 periods required, 150 periods available",
  "affected_entities": [],
  "context": {
    "requiredPeriods": 180,
    "availablePeriods": 150
  }
}
```

---

#### 3.3 Fixed Room Incompatible

**Runtime Error (not structured)**

```json
{
  "error_code": "FIXED_ROOM_INCOMPATIBLE",
  "severity": "error",
  "message_farsi": "اتاق ثابت برای صنف 'صنف اول الف' با مضمون 'کمپیوتر' سازگار نیست",
  "message_english": "Fixed room incompatible for class 'Class 1A' and subject 'Computer'",
  "context": {
    "classId": "C001",
    "className": "صنف اول الف",
    "subjectId": "COMP",
    "subjectName": "کمپیوتر",
    "fixedRoomId": "R001"
  }
}
```

---

### 4. Class Errors

#### 4.1 Empty Periods Error

```json
{
  "error_code": "EMPTY_PERIODS_ERROR",
  "severity": "error",
  "message_farsi": "خطای ساعات خالی: صنف 'صنف اول الف' (شناسه: C001) دارای 3 ساعت خالی در هفته است (27 ساعت نیاز در مقابل 30 ساعت موجود).\nبرنامه باید بدون ساعت خالی باشد. پیشنهادات:\n  1. 3 ساعت بیشتر به مضامین موجود اضافه کنید\n  2. مضمون جدید با مجموع 3 ساعت اضافه کنید\n  3. برنامه هفتگی را 3 ساعت کاهش دهید",
  "message_english": "Empty Periods Error: Class 'Class 1A' (ID: C001) has 3 empty period(s) per week (27 required vs 30 available).\nSchedule must have NO empty periods. Suggestions:\n  1. Add 3 more period(s) to existing subjects\n  2. Add new subject(s) totaling 3 period(s)\n  3. Reduce weekly schedule by 3 period(s)",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "classId": "C001",
    "className": "صنف اول الف",
    "requiredPeriods": 27,
    "availablePeriods": 30,
    "gap": 3
  }
}
```

---

#### 4.2 Over-Allocation Error

```json
{
  "error_code": "OVER_ALLOCATION_ERROR",
  "severity": "error",
  "message_farsi": "خطای تخصیص بیش از حد: صنف 'صنف دوم ب' (شناسه: C002) به 35 ساعت نیاز دارد اما فقط 30 ساعت موجود است.\nشما به 5 ساعت کمتر نیاز دارید. پیشنهادات:\n  1. ساعات برخی مضامین را 5 ساعت کاهش دهید\n  2. 5 ساعت بیشتر به برنامه هفتگی اضافه کنید",
  "message_english": "Over-Allocation Error: Class 'Class 2B' (ID: C002) requires 35 periods but only 30 are available.\nYou need 5 fewer period(s). Suggestions:\n  1. Reduce periods for some subjects by 5 total\n  2. Add 5 more period(s) to the weekly schedule",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C002",
      "entity_name": "صنف دوم ب"
    }
  ],
  "context": {
    "classId": "C002",
    "className": "صنف دوم ب",
    "requiredPeriods": 35,
    "availablePeriods": 30,
    "excess": 5
  }
}
```

---

#### 4.3 Class Period Shortage

**Error Code: `CLASS_PERIOD_SHORTAGE`**

```json
{
  "error_code": "CLASS_PERIOD_SHORTAGE",
  "severity": "error",
  "message_key": "error.class.period_shortage",
  "message_farsi": "صنف صنف سوم الف به 35 ساعت نیاز دارد اما فقط 30 ساعت موجود است",
  "message_english": "Class 3A requires 35 hours but only 30 hours are available",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C003A",
      "entity_name": "صنف سوم الف"
    }
  ],
  "context": {
    "classId": "C003A",
    "className": "صنف سوم الف",
    "requiredHours": 35,
    "availableHours": 30
  }
}
```

---

### 5. Subject Errors

#### 5.1 Subject Distribution Warning

```json
{
  "error_code": "SUBJECT_DISTRIBUTION_WARNING",
  "severity": "warning",
  "message_key": "warning.subject.distribution",
  "message_farsi": "مضمون ریاضی در صنف صنف اول الف به حداقل 7 روز نیاز دارد اما فقط 6 روز موجود است",
  "message_english": "Subject Mathematics in class Class 1A requires minimum 7 days but only 6 days are available",
  "affected_entities": [
    {
      "entity_type": "subject",
      "entity_id": "MATH",
      "entity_name": "ریاضی"
    },
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "subjectId": "MATH",
    "subjectName": "ریاضی",
    "classId": "C001",
    "className": "صنف اول الف",
    "minDaysRequired": 7,
    "availableDays": 6
  }
}
```

---

#### 5.2 Subject Consecutive Warning

```json
{
  "error_code": "SUBJECT_CONSECUTIVE_WARNING",
  "severity": "warning",
  "message_key": "warning.subject.consecutive",
  "message_farsi": "مضمون انگلیسی در صنف صنف دوم الف به 8 ساعت نیاز دارد اما با حداکثر 1 ساعت متوالی فقط 6 ساعت ممکن است",
  "message_english": "Subject English in class Class 2A requires 8 periods but with max 1 consecutive only 6 periods are possible",
  "affected_entities": [
    {
      "entity_type": "subject",
      "entity_id": "ENG",
      "entity_name": "انگلیسی"
    },
    {
      "entity_type": "class",
      "entity_id": "C002A",
      "entity_name": "صنف دوم الف"
    }
  ],
  "context": {
    "subjectId": "ENG",
    "subjectName": "انگلیسی",
    "classId": "C002A",
    "className": "صنف دوم الف",
    "periodsRequired": 8,
    "maxConsecutive": 1,
    "maxPossible": 6
  }
}
```

---

### 6. Solver Runtime Errors

#### 6.1 No Feasible Solution

**Error Code: `NO_FEASIBLE_SOLUTION`**

```json
{
  "error_code": "NO_FEASIBLE_SOLUTION",
  "severity": "error",
  "message_key": "error.solver.no_feasible_solution",
  "message_farsi": "با محدودیت‌های فعلی امکان ایجاد جدول زمانی وجود ندارد. لطفاً محدودیت‌ها را بررسی کنید",
  "message_english": "No valid timetable can be created with the current constraints. Please review the constraints",
  "affected_entities": [],
  "context": {}
}
```

---

#### 6.2 Solver Timeout

**Error Code: `SOLVER_TIMEOUT`**

```json
{
  "error_code": "SOLVER_TIMEOUT",
  "severity": "error",
  "message_key": "error.solver.timeout",
  "message_farsi": "زمان حل از حد مجاز (600 ثانیه) گذشت. لطفاً محدودیت‌ها را ساده‌تر کنید یا زمان را افزایش دهید",
  "message_english": "Solver exceeded time limit (600 seconds). Please simplify constraints or increase the time limit",
  "affected_entities": [],
  "context": {
    "timeoutSeconds": 600
  }
}
```

---

#### 6.3 Internal Error

**Error Code: `INTERNAL_ERROR`**

```json
{
  "error_code": "INTERNAL_ERROR",
  "severity": "error",
  "message_key": "error.solver.internal",
  "message_farsi": "خطای داخلی رخ داد. لطفاً دوباره تلاش کنید",
  "message_english": "An internal error occurred. Please try again",
  "affected_entities": [],
  "context": {
    "debug": {
      "exception_type": "RuntimeError",
      "exception_message": "Unexpected solver state"
    }
  }
}
```

---

#### 6.4 No Valid Teachers or Rooms

```json
{
  "error_code": "NO_VALID_RESOURCES",
  "severity": "error",
  "message_farsi": "هیچ استاد یا اتاق معتبری برای صنف 'صنف اول الف' و مضمون 'فزیک' وجود ندارد",
  "message_english": "No valid teachers or rooms for class 'Class 1A', subject 'Physics'",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    },
    {
      "entity_type": "subject",
      "entity_id": "PHYS",
      "entity_name": "فزیک"
    }
  ],
  "context": {
    "classId": "C001",
    "className": "صنف اول الف",
    "subjectId": "PHYS",
    "subjectName": "فزیک"
  }
}
```

---

#### 6.5 No Valid Time Slots

```json
{
  "error_code": "NO_VALID_TIME_SLOTS",
  "severity": "error",
  "message_farsi": "هیچ ساعت معتبری برای صنف 'صنف دوم الف' و مضمون 'ریاضی' وجود ندارد",
  "message_english": "No valid time slots for class 'Class 2A', subject 'Mathematics'",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C002A",
      "entity_name": "صنف دوم الف"
    },
    {
      "entity_type": "subject",
      "entity_id": "MATH",
      "entity_name": "ریاضی"
    }
  ],
  "context": {
    "classId": "C002A",
    "className": "صنف دوم الف",
    "subjectId": "MATH",
    "subjectName": "ریاضی"
  }
}
```

---

### 7. Ministry Validation Errors

These errors occur when Ministry of Education curriculum validation is enabled.

#### 7.1 Subject Hours Below Minimum

```json
{
  "error_code": "MINISTRY_SUBJECT_HOURS",
  "severity": "warning",
  "message_farsi": "صنف صنف اول الف: مضمون ریاضی حداقل 6 ساعت نیاز دارد، اما 4 ساعت تنظیم شده",
  "message_english": "Class 1A: Mathematics requires minimum 6 periods, but 4 configured",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "type": "MINISTRY_SUBJECT_HOURS",
    "className": "صنف اول الف",
    "classId": "C001",
    "gradeLevel": 1,
    "subjectName": "ریاضی",
    "subjectNameEn": "Mathematics",
    "isCore": true,
    "requiredPeriods": 6,
    "configuredPeriods": 4
  }
}
```

---

#### 7.2 Total Periods Mismatch

```json
{
  "error_code": "TOTAL_PERIODS_MISMATCH",
  "severity": "warning",
  "message_farsi": "صنف صنف دوم الف: مجموع ساعات (28) با استندرد (30) مطابقت ندارد",
  "message_english": "Class 2A: Total periods (28) doesn't match expected (30)",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C002A",
      "entity_name": "صنف دوم الف"
    }
  ],
  "context": {
    "type": "TOTAL_PERIODS_MISMATCH",
    "className": "صنف دوم الف",
    "classId": "C002A",
    "gradeLevel": 2,
    "expectedPeriods": 30,
    "actualPeriods": 28,
    "difference": 2
  }
}
```

---

### 8. Single-Teacher Mode Errors

#### 8.1 Unknown Class Teacher

```json
{
  "error_code": "SINGLE_TEACHER_UNKNOWN_TEACHER",
  "severity": "error",
  "message_farsi": "خطای حالت تک‌استاد: صنف 'صنف اول الف' (شناسه: C001) به شناسه استاد ناشناخته 'T999' ارجاع داده است. لطفاً یک استاد معتبر تعیین کنید.",
  "message_english": "Single-Teacher Mode Error: Class 'Class 1A' (ID: C001) references unknown teacher ID 'T999'. Please assign a valid teacher.",
  "affected_entities": [
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "classId": "C001",
    "className": "صنف اول الف",
    "unknownTeacherId": "T999"
  }
}
```

---

#### 8.2 Teacher Cannot Teach Required Subjects

```json
{
  "error_code": "SINGLE_TEACHER_MISSING_SUBJECTS",
  "severity": "error",
  "message_farsi": "خطای حالت تک‌استاد: استاد 'احمد احمدی' به صنف 'صنف اول الف' تعیین شده اما نمیتواند تدریس کند: انگلیسی، ورزش. لطفاً صلاحیت‌های مضمون استاد را به‌روز کنید.",
  "message_english": "Single-Teacher Mode Error: Teacher 'Ahmad Ahmadi' is assigned to class 'Class 1A' but cannot teach: English, Physical Education. Please update teacher's subject qualifications.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T001",
      "entity_name": "احمد احمدی"
    },
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "teacherId": "T001",
    "teacherName": "احمد احمدی",
    "classId": "C001",
    "className": "صنف اول الف",
    "missingSubjects": ["انگلیسی", "ورزش"]
  }
}
```

---

#### 8.3 Teacher Max Periods Insufficient

```json
{
  "error_code": "SINGLE_TEACHER_MAX_PERIODS",
  "severity": "error",
  "message_farsi": "خطای حالت تک‌استاد: استاد 'فاطمه رحیمی' دارای maxPeriodsPerWeek=20 است اما صنف 'صنف اول الف' به 30 ساعت در هفته نیاز دارد. لطفاً maxPeriodsPerWeek استاد را افزایش دهید یا نیازهای صنف را کاهش دهید.",
  "message_english": "Single-Teacher Mode Error: Teacher 'Fatima Rahimi' has maxPeriodsPerWeek=20 but class 'Class 1A' needs 30 periods/week. Please increase teacher's maxPeriodsPerWeek or reduce class requirements.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T003",
      "entity_name": "فاطمه رحیمی"
    },
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "teacherId": "T003",
    "teacherName": "فاطمه رحیمی",
    "classId": "C001",
    "className": "صنف اول الف",
    "teacherMaxPeriods": 20,
    "classRequiredPeriods": 30
  }
}
```

---

#### 8.4 Teacher Availability Insufficient

```json
{
  "error_code": "SINGLE_TEACHER_AVAILABILITY",
  "severity": "error",
  "message_farsi": "خطای حالت تک‌استاد: استاد 'محمد کریمی' فقط 25 ساعت در دسترس دارد اما صنف 'صنف اول الف' به 30 ساعت نیاز دارد. لطفاً دسترسی استاد را افزایش دهید یا برنامه صنف را تنظیم کنید.",
  "message_english": "Single-Teacher Mode Error: Teacher 'Mohammad Karimi' has only 25 available periods but class 'Class 1A' needs 30 periods. Please increase teacher availability or adjust class schedule.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T002",
      "entity_name": "محمد کریمی"
    },
    {
      "entity_type": "class",
      "entity_id": "C001",
      "entity_name": "صنف اول الف"
    }
  ],
  "context": {
    "teacherId": "T002",
    "teacherName": "محمد کریمی",
    "classId": "C001",
    "className": "صنف اول الف",
    "availablePeriods": 25,
    "requiredPeriods": 30
  }
}
```

---

### 9. Class Teacher Errors (Non-Single-Teacher Mode)

#### 9.1 Class Teacher Cannot Teach Any Subject

```json
{
  "error_code": "CLASS_TEACHER_NO_SUBJECTS",
  "severity": "error",
  "message_farsi": "خطای استاد نگران: استاد 'علی رضایی' به عنوان استاد نگران صنف 'صنف پنجم الف' تعیین شده اما نمیتواند هیچ یک از مضامین صنف را تدریس کند.\n  استاد میتواند تدریس کند: ریاضی، فزیک\n  صنف نیاز دارد: انگلیسی، تاریخ، جغرافیه\nلطفاً استاد نگران دیگری تعیین کنید یا صلاحیت‌های مضمون استاد را به‌روز کنید.",
  "message_english": "Class Teacher Error: Teacher 'Ali Rezaei' is assigned as class teacher for 'Class 5A' but cannot teach any of the class's subjects.\n  Teacher can teach: Mathematics, Physics\n  Class requires: English, History, Geography\nPlease assign a different class teacher or update teacher's subject qualifications.",
  "affected_entities": [
    {
      "entity_type": "teacher",
      "entity_id": "T004",
      "entity_name": "علی رضایی"
    },
    {
      "entity_type": "class",
      "entity_id": "C005A",
      "entity_name": "صنف پنجم الف"
    }
  ],
  "context": {
    "teacherId": "T004",
    "teacherName": "علی رضایی",
    "classId": "C005A",
    "className": "صنف پنجم الف",
    "teacherSubjects": ["ریاضی", "فزیک"],
    "classSubjects": ["انگلیسی", "تاریخ", "جغرافیه"]
  }
}
```

---

### 10. Fixed Lesson Errors

#### 10.1 Unknown Class in Fixed Lesson

```json
{
  "error_code": "FIXED_LESSON_UNKNOWN_CLASS",
  "severity": "error",
  "message_farsi": "درس ثابت 0 دارای شناسه صنف ناشناخته 'C999' است — لطفاً تعریفات صنف را بررسی کنید",
  "message_english": "Fixed lesson 0 has unknown classId 'C999' — please check class definitions",
  "context": {
    "lessonIndex": 0,
    "unknownClassId": "C999"
  }
}
```

---

#### 10.2 Unknown Subject in Fixed Lesson

```json
{
  "error_code": "FIXED_LESSON_UNKNOWN_SUBJECT",
  "severity": "error",
  "message_farsi": "درس ثابت 1 دارای شناسه مضمون ناشناخته 'SUBJ999' است — لطفاً تعریفات مضمون را بررسی کنید",
  "message_english": "Fixed lesson 1 has unknown subjectId 'SUBJ999' — please check subject definitions",
  "context": {
    "lessonIndex": 1,
    "unknownSubjectId": "SUBJ999"
  }
}
```

---

#### 10.3 Unknown Room in Fixed Lesson

```json
{
  "error_code": "FIXED_LESSON_UNKNOWN_ROOM",
  "severity": "error",
  "message_farsi": "درس ثابت 2 دارای شناسه اتاق ناشناخته 'R999' است — لطفاً تعریفات اتاق را بررسی کنید",
  "message_english": "Fixed lesson 2 has unknown roomId 'R999' — please check room definitions",
  "context": {
    "lessonIndex": 2,
    "unknownRoomId": "R999"
  }
}
```

---

#### 10.4 Unknown Teacher in Fixed Lesson

```json
{
  "error_code": "FIXED_LESSON_UNKNOWN_TEACHER",
  "severity": "error",
  "message_farsi": "درس ثابت 3 دارای شناسه استاد ناشناخته 'T999' است — لطفاً تعریفات استاد را بررسی کنید",
  "message_english": "Fixed lesson 3 has unknown teacherId 'T999' — please check teacher definitions",
  "context": {
    "lessonIndex": 3,
    "unknownTeacherId": "T999"
  }
}
```

---

## Error Code Reference Table

| Error Code                      | Severity      | Category | i18n Key                              |
| ------------------------------- | ------------- | -------- | ------------------------------------- |
| `TEACHER_OVERLOAD`              | error         | Teacher  | `error.teacher.overload`              |
| `TEACHER_OVERLOAD_PREDICTED`    | error         | Teacher  | `error.teacher.overload_predicted`    |
| `TEACHER_AVAILABILITY_CONFLICT` | error         | Teacher  | `error.teacher.availability_conflict` |
| `NO_QUALIFIED_TEACHER`          | error         | Teacher  | `error.teacher.no_qualified`          |
| `ROOM_CONFLICT`                 | error         | Room     | `error.room.conflict`                 |
| `ROOM_CAPACITY_WARNING`         | warning       | Room     | `warning.room.capacity`               |
| `CLASS_PERIOD_SHORTAGE`         | error         | Class    | `error.class.period_shortage`         |
| `NO_FEASIBLE_SOLUTION`          | error         | Solver   | `error.solver.no_feasible_solution`   |
| `SOLVER_TIMEOUT`                | error         | Solver   | `error.solver.timeout`                |
| `INTERNAL_ERROR`                | error         | Solver   | `error.solver.internal`               |
| `SUBJECT_DISTRIBUTION_WARNING`  | warning       | Subject  | `warning.subject.distribution`        |
| `SUBJECT_CONSECUTIVE_WARNING`   | warning       | Subject  | `warning.subject.consecutive`         |
| `MINISTRY_SUBJECT_HOURS`        | warning/error | Ministry | -                                     |
| `TOTAL_PERIODS_MISMATCH`        | warning/error | Ministry | -                                     |

---

## Frontend Handling Recommendations

### 1. Error Display Strategy

```typescript
// Recommended error handling in React
function handleSolverResponse(response: SolverResponse) {
  if (response.status === 'failed') {
    // Show blocking error modal
    showErrorModal({
      title: 'خطا در ایجاد جدول زمانی',
      errors: response.errors,
      showAffectedEntities: true,
    });
  } else if (response.status === 'partial') {
    // Show warning banner but allow proceed
    showWarningBanner({
      title: 'جدول زمانی با هشدار ایجاد شد',
      warnings: response.warnings,
    });
  }
}
```

### 2. Entity Highlighting

Use `affected_entities` to highlight problematic items in the UI:

```typescript
function highlightAffectedEntities(entities: AffectedEntity[]) {
  entities.forEach((entity) => {
    switch (entity.entity_type) {
      case 'teacher':
        highlightTeacherCard(entity.entity_id);
        break;
      case 'class':
        highlightClassRow(entity.entity_id);
        break;
      case 'room':
        highlightRoomCard(entity.entity_id);
        break;
      case 'subject':
        highlightSubjectChip(entity.entity_id);
        break;
    }
  });
}
```

### 3. i18n Integration

```typescript
// Use message_key for i18n lookup, fallback to message_farsi
function getErrorMessage(error: SolverErrorDetail, locale: string) {
  const translated = i18n.t(error.message_key, error.context);
  if (translated !== error.message_key) {
    return translated;
  }
  return locale === 'fa' ? error.message_farsi : error.message_english;
}
```

### 4. Error Grouping

Group errors by category for better UX:

```typescript
function groupErrorsByCategory(errors: SolverErrorDetail[]) {
  return {
    teacher: errors.filter((e) => e.error_code.startsWith('TEACHER')),
    room: errors.filter((e) => e.error_code.startsWith('ROOM')),
    class: errors.filter((e) => e.error_code.startsWith('CLASS')),
    subject: errors.filter((e) => e.error_code.startsWith('SUBJECT')),
    solver: errors.filter((e) =>
      ['NO_FEASIBLE_SOLUTION', 'SOLVER_TIMEOUT', 'INTERNAL_ERROR'].includes(
        e.error_code
      )
    ),
  };
}
```

### 5. Actionable Suggestions

Display suggestions from quality score:

```typescript
interface Suggestion {
  suggestion_code: string;
  message_farsi: string;
  affected_entities: AffectedEntity[];
  expected_improvement: number;
}

// Suggestion codes and their actions
const SUGGESTION_ACTIONS = {
  REDUCE_TEACHER_GAPS: 'Navigate to teacher schedule view',
  MOVE_DIFFICULT_TO_MORNING: 'Navigate to class schedule view',
  SPREAD_SUBJECT_ACROSS_DAYS: 'Navigate to subject requirements',
  BALANCE_TEACHER_LOAD: 'Navigate to teacher workload view',
};
```

---

## Pydantic Validation Errors

When input data fails Pydantic validation, errors follow this pattern:

```json
{
  "error_code": "VALIDATION_ERROR",
  "severity": "error",
  "message_farsi": "ساختار داده جدول زمانی نامعتبر است: [جزئیات خطا]",
  "message_english": "Invalid timetable data structure: [error details]",
  "context": {
    "validation_errors": [
      {
        "loc": ["teachers", 0, "primarySubjectIds"],
        "msg": "ensure this value has at least 1 items",
        "type": "value_error.list.min_items"
      }
    ]
  }
}
```

### Common Pydantic Validation Errors

| Field                          | Error            | Message                                           |
| ------------------------------ | ---------------- | ------------------------------------------------- |
| `teachers[].primarySubjectIds` | Empty list       | "ensure this value has at least 1 items"          |
| `rooms`                        | Empty list       | "ensure this value has at least 1 items"          |
| `config.periodsPerDay`         | Zero or negative | "ensure this value is greater than 0"             |
| `teachers[].maxPeriodsPerWeek` | Negative         | "ensure this value is greater than or equal to 0" |
| `classes[].gradeLevel`         | Out of range     | "ensure this value is greater than or equal to 1" |

---

## Quality Score Warnings

When timetable is generated but quality is low:

```json
{
  "quality_score": {
    "overall": 65,
    "breakdown": {
      "teacher_gaps": {
        "count": 8,
        "penalty": 16,
        "details": [...]
      },
      "afternoon_difficult_subjects": {
        "count": 5,
        "penalty": 15,
        "details": [...]
      },
      "same_day_subject_repetition": {
        "count": 3,
        "penalty": 3,
        "details": [...]
      },
      "teacher_load_balance": {
        "variance": 0.15,
        "penalty": 1
      }
    },
    "suggestions": [
      {
        "suggestion_code": "REDUCE_TEACHER_GAPS",
        "message_farsi": "برای کاهش ساعات خالی، برنامه استاد احمد احمدی را در روز Saturday فشرده‌تر کنید",
        "affected_entities": [...],
        "expected_improvement": 10
      }
    ]
  }
}
```

---

## Response Status Summary

| Status    | Meaning                           | UI Action                             |
| --------- | --------------------------------- | ------------------------------------- |
| `success` | Timetable generated successfully  | Show timetable, display quality score |
| `partial` | Timetable generated with warnings | Show timetable with warning banner    |
| `failed`  | Timetable generation failed       | Show error modal, no timetable        |

---

_Document generated for Maktab Timetable Solver v2.0_
