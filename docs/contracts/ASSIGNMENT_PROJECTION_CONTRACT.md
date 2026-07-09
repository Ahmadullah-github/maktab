# Assignment Projection Contract

## Purpose

This document defines the phase-0 read contract for assignment-heavy screens.
These projections are the target API layer for phases 4 and 5.

Projection endpoints must be built from canonical assignment tables only. They
must not fall back to:

- `Teacher.classAssignments`
- `Teacher.primarySubjectIds`
- `Teacher.allowedSubjectIds`
- `ClassGroup.subjectRequirements[].teacherId`

## Shared Response Rules

All projection responses must:

1. Include stable entity identifiers used by the screen.
2. Include display-ready labels so the client does not need to stitch names from
   multiple endpoints just to render a row.
3. Include requirement totals, assigned totals, and remaining totals.
4. Include capability state for assigned or candidate teachers.
5. Include warning summaries for conflicts, over-assignment, or missing
   capability.
6. Exclude legacy mirror fields as authoritative payload members.

## Shared Shapes

### Requirement Summary

```json
{
  "requirementId": 101,
  "classId": 7,
  "className": "Grade 7 A",
  "subjectId": 12,
  "subjectName": "Mathematics",
  "requiredPeriodsPerWeek": 5,
  "assignedPeriodsPerWeek": 3,
  "remainingPeriodsPerWeek": 2,
  "allowSplitAssignment": false
}
```

### Assignment Summary

```json
{
  "assignmentId": 2001,
  "teacherId": 44,
  "teacherName": "Ahmad Rahimi",
  "assignedPeriodsPerWeek": 3,
  "isFixed": true,
  "source": "manual",
  "capabilityLevel": "primary"
}
```

### Warning Summary

```json
{
  "code": "missing_capability",
  "severity": "warning",
  "message": "Teacher is assigned without an active capability row."
}
```

## Endpoints

### `GET /api/assignment-matrix`

Purpose:
- Render the main assignment matrix screen.

Response shape:

```json
{
  "generatedAt": "2026-04-14T10:00:00.000Z",
  "classes": [
    {
      "classId": 7,
      "className": "Grade 7 A",
      "requirements": [
        {
          "requirementId": 101,
          "subjectId": 12,
          "subjectName": "Mathematics",
          "requiredPeriodsPerWeek": 5,
          "assignedPeriodsPerWeek": 3,
          "remainingPeriodsPerWeek": 2,
          "allowSplitAssignment": false,
          "assignments": [
            {
              "assignmentId": 2001,
              "teacherId": 44,
              "teacherName": "Ahmad Rahimi",
              "assignedPeriodsPerWeek": 3,
              "isFixed": true,
              "source": "manual",
              "capabilityLevel": "primary"
            }
          ],
          "warnings": []
        }
      ]
    }
  ]
}
```

### `GET /api/classes/:classId/assignment-view`

Purpose:
- Render a class-centric assignment screen.

Response shape:

```json
{
  "classId": 7,
  "className": "Grade 7 A",
  "classTeacherId": 9,
  "classTeacherName": "Supervisor Name",
  "requirements": [
    {
      "requirementId": 101,
      "subjectId": 12,
      "subjectName": "Mathematics",
      "requiredPeriodsPerWeek": 5,
      "assignedPeriodsPerWeek": 3,
      "remainingPeriodsPerWeek": 2,
      "allowSplitAssignment": false,
      "assignments": [],
      "warnings": []
    }
  ]
}
```

### `GET /api/subjects/:subjectId/coverage-view`

Purpose:
- Render subject coverage and gaps across classes.

Response shape:

```json
{
  "subjectId": 12,
  "subjectName": "Mathematics",
  "coverage": [
    {
      "requirementId": 101,
      "classId": 7,
      "className": "Grade 7 A",
      "requiredPeriodsPerWeek": 5,
      "assignedPeriodsPerWeek": 3,
      "remainingPeriodsPerWeek": 2,
      "assignments": [],
      "warnings": []
    }
  ]
}
```

### `GET /api/teachers/:teacherId/workload-view`

Purpose:
- Render teacher workload from canonical assignments and requirements.

Response shape:

```json
{
  "teacherId": 44,
  "teacherName": "Ahmad Rahimi",
  "maxPeriodsPerWeek": 24,
  "assignedPeriodsPerWeek": 18,
  "remainingCapacityPerWeek": 6,
  "capabilities": [
    {
      "subjectId": 12,
      "subjectName": "Mathematics",
      "capabilityLevel": "primary"
    }
  ],
  "assignments": [
    {
      "assignmentId": 2001,
      "requirementId": 101,
      "classId": 7,
      "className": "Grade 7 A",
      "subjectId": 12,
      "subjectName": "Mathematics",
      "assignedPeriodsPerWeek": 3,
      "isFixed": true,
      "source": "manual",
      "warnings": []
    }
  ]
}
```

### `GET /api/teachers/:teacherId/assignment-summary`

Purpose:
- Render compact teacher summaries for drawers, badges, and side panels.

Response shape:

```json
{
  "teacherId": 44,
  "teacherName": "Ahmad Rahimi",
  "subjectLoad": [
    {
      "subjectId": 12,
      "subjectName": "Mathematics",
      "classCount": 4,
      "assignedPeriodsPerWeek": 12
    }
  ],
  "totals": {
    "classCount": 4,
    "assignedPeriodsPerWeek": 18
  },
  "warnings": []
}
```

## Compatibility Rule

Legacy entity endpoints may continue to return compatibility fields during the
cutover. Assignment screens must treat projection endpoints as authoritative as
soon as they are available.
