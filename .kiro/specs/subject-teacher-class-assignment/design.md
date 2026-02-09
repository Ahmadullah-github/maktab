# Design Document: Subject-Teacher-Class Assignment System

## Overview

The Subject-Teacher-Class Assignment System enhances the existing Maktab
timetable application by providing comprehensive assignment management
capabilities. Rather than creating a standalone feature, this system integrates
seamlessly with the existing Teachers, Subjects, and Classes features through
enhanced UI components, validation logic, and data management patterns.

The design leverages the existing solver architecture, data models
(`Teacher.classAssignments`, `ClassGroup.subjectRequirements`), and UI patterns
while adding sophisticated assignment tracking, conflict detection, and workload
management capabilities.

## Architecture

### System Integration Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Subject-Teacher-Class Assignment System                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │   TeacherEditDrawer │  │   ClassEditDrawer   │  │  SubjectEditDrawer  │ │
│  │   + Assignments Tab │  │   + Enhanced        │  │  + Coverage Section │ │
│  │                     │  │     Subject Editor  │  │                     │ │
│  │  ┌───────────────┐  │  │                     │  │  ┌───────────────┐  │ │
│  │  │ Assignment    │  │  │  ┌───────────────┐  │  │  │ Coverage      │  │ │
│  │  │ Matrix        │  │  │  │ Teacher       │  │  │  │ Analysis      │  │ │
│  │  │               │  │  │  │ Dropdowns     │  │  │  │               │  │ │
│  │  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │ │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │ │
│  │  │ Workload      │  │  │  │ Assignment    │  │  │  │ Teacher       │  │ │
│  │  │ Calculator    │  │  │  │ Status        │  │  │  │ Compatibility │  │ │
│  │  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Shared Assignment Services                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ Assignment          │  │ Conflict            │  │ Workload            │ │
│  │ Validation Service  │  │ Detection Service   │  │ Calculation Service │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                            Data Layer Integration                            │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ Teacher.            │  │ ClassGroup.         │  │ Enhanced API        │ │
│  │ classAssignments    │  │ subjectRequirements │  │ Endpoints           │ │
│  │ (Enhanced)          │  │ (Enhanced)          │  │                     │ │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   UI Components  │───▶│  Assignment      │───▶│   API Layer      │
│   (Enhanced)     │    │  Services        │    │   (Enhanced)     │
└──────────────────┘    └──────────────────┘    └──────────────────┘
         │                        │                        │
         │                        ▼                        ▼
         │               ┌──────────────────┐    ┌──────────────────┐
         │               │  Validation &    │    │   Database       │
         │               │  Conflict        │    │   (Existing)     │
         │               │  Detection       │    │                  │
         │               └──────────────────┘    └──────────────────┘
         │                        │                        │
         ▼                        │                        │
┌──────────────────┐              │                        │
│  TanStack Query  │◀─────────────┴────────────────────────┘
│  Cache           │
│  (Enhanced)      │
└──────────────────┘
```

## Components and Interfaces

### Enhanced File Structure

```
packages/web/src/features/
├── teachers/
│   ├── components/
│   │   ├── TeacherEditDrawer.tsx        # Enhanced with assignments tab
│   │   ├── TeacherAssignmentMatrix.tsx  # NEW: Assignment grid
│   │   └── TeacherWorkloadCalculator.tsx # NEW: Workload display
│   ├── hooks/
│   │   ├── useTeacherAssignments.ts     # NEW: Assignment operations
│   │   └── useTeacherWorkload.ts        # NEW: Workload calculations
│   └── utils/
│       └── assignmentHelpers.ts         # NEW: Assignment utilities
├── classes/
│   ├── components/
│   │   ├── ClassEditDrawer.tsx          # Enhanced subjects tab
│   │   └── SubjectRequirementsEditor.tsx # Enhanced with teacher dropdowns
│   └── hooks/
│       └── useClassAssignments.ts       # NEW: Class assignment operations
├── subjects/
│   ├── components/
│   │   ├── SubjectEditDrawer.tsx        # Enhanced with coverage section
│   │   └── SubjectCoverageView.tsx      # NEW: Coverage analysis
│   └── hooks/
│       └── useSubjectCoverage.ts        # NEW: Coverage calculations
└── assignments/                         # NEW: Shared assignment logic
    ├── services/
    │   ├── assignmentValidation.ts      # Assignment validation logic
    │   ├── conflictDetection.ts         # Conflict detection algorithms
    │   └── workloadCalculation.ts       # Workload computation
    ├── hooks/
    │   ├── useAssignmentOperations.ts   # Core assignment CRUD
    │   └── useConflictDetection.ts      # Real-time conflict checking
    ├── types/
    │   └── assignment.types.ts          # Shared type definitions
    └── utils/
        ├── assignmentSerialization.ts  # JSON serialization helpers
        └── assignmentValidators.ts     # Validation utilities
```

### Core Component Interfaces

```typescript
// TeacherAssignmentMatrix.tsx
interface TeacherAssignmentMatrixProps {
  teacherId: number;
  teacher: Teacher;
  assignments: EnhancedClassAssignment[];
  onAssignmentChange: (assignments: EnhancedClassAssignment[]) => void;
  availableSubjects: Subject[];
  availableClasses: ClassGroup[];
  isLoading?: boolean;
}

// TeacherWorkloadCalculator.tsx
interface TeacherWorkloadCalculatorProps {
  teacherId: number;
  assignments: EnhancedClassAssignment[];
  maxPeriodsPerWeek: number;
  showBreakdown?: boolean;
  onWorkloadExceeded?: (exceeded: boolean) => void;
}

// SubjectRequirementsEditor.tsx (Enhanced)
interface SubjectRequirementsEditorProps {
  classId: number;
  value: EnhancedSubjectRequirement[];
  onChange: (requirements: EnhancedSubjectRequirement[]) => void;
  availableSubjects: Subject[];
  availableTeachers: Teacher[];
  showTeacherAssignments: boolean; // NEW
  conflictDetection: boolean; // NEW
}

// SubjectCoverageView.tsx
interface SubjectCoverageViewProps {
  subjectId: number;
  subject: Subject;
  teacherCompatibility: TeacherCompatibility[];
  classCoverage: ClassCoverage[];
  onQuickAssign?: (teacherId: number, classId: number) => void;
}
```

## Data Models

### Enhanced Data Structures

```typescript
// Enhanced ClassAssignment (extends existing)
interface EnhancedClassAssignment {
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number; // NEW: Calculated from subject requirements
  totalPeriods: number; // NEW: classIds.length * periodsPerWeek
  conflicts?: AssignmentConflict[]; // NEW: Detected conflicts
  status: AssignmentStatus; // NEW: assigned | partial | conflict
}

// Enhanced SubjectRequirement (extends existing)
interface EnhancedSubjectRequirement {
  subjectId: number;
  periodsPerWeek: number;
  teacherId?: number; // NEW: Assigned teacher
  assignmentStatus: AssignmentStatus; // NEW: assigned | unassigned | conflict
  conflicts?: AssignmentConflict[]; // NEW: Detected conflicts
}

// Assignment Status Types
type AssignmentStatus = 'assigned' | 'unassigned' | 'partial' | 'conflict';

// Conflict Detection
interface AssignmentConflict {
  type: ConflictType;
  severity: 'warning' | 'error';
  message: string;
  affectedEntities: {
    teacherId?: number;
    subjectId?: number;
    classId?: number;
  };
  suggestedResolution?: string;
}

type ConflictType =
  | 'workload_exceeded'
  | 'subject_incompatible'
  | 'availability_conflict'
  | 'coverage_insufficient'
  | 'duplicate_assignment';

// Workload Calculation
interface TeacherWorkload {
  teacherId: number;
  totalPeriods: number;
  maxPeriods: number;
  utilizationPercentage: number;
  breakdown: WorkloadBreakdown[];
  status: 'underloaded' | 'optimal' | 'near_capacity' | 'overloaded';
}

interface WorkloadBreakdown {
  subjectId: number;
  subjectName: string;
  classIds: number[];
  periodsPerWeek: number;
  totalPeriods: number;
}

// Coverage Analysis
interface SubjectCoverage {
  subjectId: number;
  totalClassesRequiring: number;
  assignedClasses: number;
  unassignedClasses: ClassCoverageDetail[];
  teacherDistribution: TeacherCoverageDetail[];
  coveragePercentage: number;
  status: 'complete' | 'partial' | 'uncovered';
}

interface ClassCoverageDetail {
  classId: number;
  className: string;
  periodsPerWeek: number;
  assignmentStatus: AssignmentStatus;
  conflicts?: AssignmentConflict[];
}

interface TeacherCoverageDetail {
  teacherId: number;
  teacherName: string;
  assignedClasses: number[];
  totalPeriods: number;
  compatibility: 'primary' | 'allowed' | 'restricted';
}

// Teacher Compatibility
interface TeacherCompatibility {
  teacherId: number;
  teacherName: string;
  subjectId: number;
  compatibility: 'primary' | 'allowed' | 'incompatible';
  currentWorkload: number;
  maxWorkload: number;
  availableCapacity: number;
}
```

### API Enhancement Patterns

```typescript
// New API endpoints for assignment operations
interface AssignmentAPI {
  // Assignment validation
  validateAssignment(
    request: AssignmentValidationRequest
  ): Promise<ValidationResult>;

  // Assignment operations
  assignTeacher(request: AssignTeacherRequest): Promise<AssignmentResult>;
  unassignTeacher(request: UnassignTeacherRequest): Promise<void>;
  bulkAssign(request: BulkAssignRequest): Promise<BulkAssignResult>;

  // Analysis endpoints
  getTeacherWorkload(teacherId: number): Promise<TeacherWorkload>;
  getSubjectCoverage(subjectId: number): Promise<SubjectCoverage>;
  getAssignmentConflicts(): Promise<AssignmentConflict[]>;

  // Recommendation endpoints
  getAssignmentRecommendations(
    classId: number,
    subjectId: number
  ): Promise<TeacherRecommendation[]>;
  getWorkloadBalancingRecommendations(): Promise<WorkloadRecommendation[]>;
}

// Request/Response types
interface AssignmentValidationRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number;
}

interface ValidationResult {
  isValid: boolean;
  conflicts: AssignmentConflict[];
  warnings: AssignmentConflict[];
}

interface AssignTeacherRequest {
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek: number;
}

interface AssignmentResult {
  success: boolean;
  updatedTeacher: Teacher;
  updatedClasses: ClassGroup[];
  conflicts: AssignmentConflict[];
}
```

### Serialization Enhancements

```typescript
// Enhanced serialization for existing JSON fields
export function serializeEnhancedClassAssignments(
  assignments: EnhancedClassAssignment[]
): string {
  // Convert enhanced assignments back to solver-compatible format
  const solverFormat = assignments.map((assignment) => ({
    subjectId: assignment.subjectId,
    classIds: assignment.classIds,
    // Additional metadata for UI can be stored in meta field
  }));
  return JSON.stringify(solverFormat);
}

export function deserializeEnhancedClassAssignments(
  json: string,
  subjects: Subject[],
  classes: ClassGroup[]
): EnhancedClassAssignment[] {
  // Parse solver format and enhance with calculated fields
  const parsed = JSON.parse(json || '[]');
  return parsed.map((assignment) => ({
    ...assignment,
    periodsPerWeek: calculatePeriodsPerWeek(assignment, subjects, classes),
    totalPeriods: calculateTotalPeriods(assignment, subjects, classes),
    status: calculateAssignmentStatus(assignment),
    conflicts: detectAssignmentConflicts(assignment),
  }));
}
```

Now I need to use the prework tool to analyze the acceptance criteria before
writing the correctness properties:

<function_calls> <invoke name="prework">
<parameter name="featureName">subject-teacher-class-assignment

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

Based on the prework analysis, the following correctness properties have been
identified for property-based testing:

### Property 1: Teacher-Subject Compatibility Validation

_For any_ teacher and subject combination, the assignment validation should
return true if and only if the subject is in the teacher's primarySubjectIds
(when restrictToPrimarySubjects is true) or in either primarySubjectIds or
allowedSubjectIds (when restrictToPrimarySubjects is false).

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 2: Workload Calculation Accuracy

_For any_ teacher with a set of assignments, the calculated total workload
should equal the sum of (periodsPerWeek × number of classes) across all
assignments.

**Validates: Requirements 2.2, 2.5**

### Property 3: Workload Threshold Detection

_For any_ teacher workload calculation, the system should correctly identify
workload status: 'near_capacity' when within 5 periods of maximum, 'overloaded'
when exceeding maximum, and 'optimal' otherwise.

**Validates: Requirements 2.3, 2.4**

### Property 4: Assignment Conflict Detection

_For any_ assignment that would cause a teacher's workload to exceed their
maxPeriodsPerWeek, the conflict detection system should flag this as a
'workload_exceeded' conflict.

**Validates: Requirements 6.1, 6.2**

### Property 5: Bidirectional Assignment Synchronization

_For any_ assignment operation, updating a teacher's classAssignments should
result in corresponding updates to the affected classes' subjectRequirements,
and vice versa.

**Validates: Requirements 3.5, 7.1, 7.2**

### Property 6: Assignment Status Calculation

_For any_ class-subject requirement, the assignment status should be 'assigned'
when a compatible teacher is assigned, 'unassigned' when no teacher is assigned,
and 'conflict' when the assigned teacher is incompatible or overloaded.

**Validates: Requirements 3.6, 4.4**

### Property 7: Coverage Percentage Calculation

_For any_ subject, the coverage percentage should equal (number of assigned
classes / total classes requiring the subject) × 100.

**Validates: Requirements 4.2, 4.5**

### Property 8: Teacher Filtering for Subject Compatibility

_For any_ subject and list of teachers, the filtered list of compatible teachers
should contain only those teachers who can teach the subject according to their
primarySubjectIds and allowedSubjectIds settings.

**Validates: Requirements 5.5, 4.3**

### Property 9: Real-time UI Synchronization

_For any_ assignment change, all related UI components (workload indicators,
assignment matrices, status indicators) should reflect the new state
immediately.

**Validates: Requirements 8.4, 8.5**

### Property 10: Assignment Data Serialization Round-trip

_For any_ valid EnhancedClassAssignment array, serializing to JSON and then
deserializing should produce an equivalent array with the same assignment
relationships and calculated fields.

**Validates: Requirements 7.4, 7.5**

### Property 11: Conflict Resolution State Updates

_For any_ detected conflict, resolving the conflict (by removing assignments,
changing teacher subjects, etc.) should result in the conflict being removed
from all related entities and UI components.

**Validates: Requirements 6.6**

### Property 12: Performance Requirements Compliance

_For any_ assignment operation on datasets within specified limits (100
teachers, 50 classes), the operation should complete within the specified time
thresholds (2s for loading, 500ms for calculations, 1s for validation).

**Validates: Requirements 11.1, 11.2, 11.3**

### Property 13: Data Persistence Consistency

_For any_ assignment operation that succeeds, the changes should be immediately
available in subsequent database queries without requiring page refresh.

**Validates: Requirements 9.1, 9.2**

### Property 14: Error Handling and Recovery

_For any_ assignment operation that fails due to validation errors, the system
should maintain data consistency and not leave partial assignments in the
database.

**Validates: Requirements 9.5**

## Error Handling

### Assignment Validation Errors

```typescript
// Assignment validation error types
export enum AssignmentErrorCode {
  TEACHER_SUBJECT_INCOMPATIBLE = 'teacher_subject_incompatible',
  WORKLOAD_EXCEEDED = 'workload_exceeded',
  AVAILABILITY_CONFLICT = 'availability_conflict',
  DUPLICATE_ASSIGNMENT = 'duplicate_assignment',
  INVALID_PERIODS = 'invalid_periods',
  CLASS_NOT_FOUND = 'class_not_found',
  SUBJECT_NOT_FOUND = 'subject_not_found',
  TEACHER_NOT_FOUND = 'teacher_not_found',
}

// Error handling service
export class AssignmentErrorHandler {
  static handleValidationError(error: AssignmentConflict): string {
    const errorMessages = {
      [AssignmentErrorCode.TEACHER_SUBJECT_INCOMPATIBLE]:
        'این معلم مجاز به تدریس این مضمون نیست',
      [AssignmentErrorCode.WORKLOAD_EXCEEDED]:
        'تخصیص این کلاس باعث تجاوز از حداکثر ساعات معلم می‌شود',
      [AssignmentErrorCode.AVAILABILITY_CONFLICT]:
        'معلم در این زمان در دسترس نیست',
      [AssignmentErrorCode.DUPLICATE_ASSIGNMENT]: 'این تخصیص قبلاً وجود دارد',
      [AssignmentErrorCode.INVALID_PERIODS]: 'تعداد ساعات نامعتبر است',
    };

    return (
      errorMessages[error.type as AssignmentErrorCode] || 'خطای نامشخص در تخصیص'
    );
  }

  static handleApiError(error: unknown): AssignmentConflict {
    if (error instanceof Error) {
      return {
        type: 'api_error',
        severity: 'error',
        message: error.message,
        affectedEntities: {},
      };
    }

    return {
      type: 'unknown_error',
      severity: 'error',
      message: 'خطای نامشخص رخ داده است',
      affectedEntities: {},
    };
  }
}
```

### Conflict Resolution Strategies

```typescript
// Conflict resolution service
export class ConflictResolutionService {
  static suggestResolutions(
    conflict: AssignmentConflict
  ): ResolutionSuggestion[] {
    switch (conflict.type) {
      case 'workload_exceeded':
        return [
          {
            type: 'reduce_assignments',
            description: 'کاهش تعداد کلاس‌های تخصیص یافته',
            action: () => this.suggestAssignmentReduction(conflict),
          },
          {
            type: 'increase_max_periods',
            description: 'افزایش حداکثر ساعات معلم',
            action: () => this.suggestWorkloadIncrease(conflict),
          },
          {
            type: 'reassign_to_other_teacher',
            description: 'تخصیص به معلم دیگر',
            action: () => this.suggestAlternativeTeacher(conflict),
          },
        ];

      case 'subject_incompatible':
        return [
          {
            type: 'add_subject_to_teacher',
            description: 'افزودن مضمون به لیست مضامین معلم',
            action: () => this.suggestSubjectAddition(conflict),
          },
          {
            type: 'assign_compatible_teacher',
            description: 'انتخاب معلم مناسب',
            action: () => this.suggestCompatibleTeacher(conflict),
          },
        ];

      default:
        return [];
    }
  }
}

interface ResolutionSuggestion {
  type: string;
  description: string;
  action: () => Promise<void>;
}
```

### Data Consistency Safeguards

```typescript
// Transaction-like operations for assignment changes
export class AssignmentTransactionService {
  static async executeAssignmentTransaction(
    operations: AssignmentOperation[]
  ): Promise<AssignmentTransactionResult> {
    const rollbackOperations: AssignmentOperation[] = [];

    try {
      // Execute operations and collect rollback data
      for (const operation of operations) {
        const rollback = await this.executeOperation(operation);
        rollbackOperations.unshift(rollback); // Reverse order for rollback
      }

      return { success: true, conflicts: [] };
    } catch (error) {
      // Rollback all operations
      for (const rollback of rollbackOperations) {
        await this.executeOperation(rollback);
      }

      return {
        success: false,
        conflicts: [AssignmentErrorHandler.handleApiError(error)],
      };
    }
  }
}

interface AssignmentOperation {
  type: 'assign' | 'unassign' | 'update';
  teacherId: number;
  subjectId: number;
  classIds: number[];
  periodsPerWeek?: number;
}

interface AssignmentTransactionResult {
  success: boolean;
  conflicts: AssignmentConflict[];
}
```

## Testing Strategy

### Dual Testing Approach

The Subject-Teacher-Class Assignment System requires both unit tests and
property-based tests to ensure comprehensive coverage:

- **Unit Tests**: Verify specific examples, edge cases, and integration points
  between components
- **Property-Based Tests**: Verify universal properties that should hold across
  all valid inputs and assignment combinations

### Property-Based Testing Framework

- **Library**: fast-check (JavaScript/TypeScript property-based testing library)
- **Minimum Iterations**: 100 per property test
- **Test Location**: `packages/web/src/features/assignments/__tests__/`

### Test File Structure

```
packages/web/src/features/assignments/__tests__/
├── unit/
│   ├── assignmentValidation.test.ts
│   ├── conflictDetection.test.ts
│   ├── workloadCalculation.test.ts
│   └── assignmentSerialization.test.ts
├── property/
│   ├── teacherCompatibility.property.test.ts
│   ├── workloadCalculation.property.test.ts
│   ├── conflictDetection.property.test.ts
│   ├── assignmentSynchronization.property.test.ts
│   └── coverageCalculation.property.test.ts
├── integration/
│   ├── assignmentAPI.integration.test.ts
│   └── uiSynchronization.integration.test.ts
└── performance/
    ├── assignmentPerformance.test.ts
    └── bulkOperations.test.ts
```

### Property Test Annotations

Each property-based test must be tagged with a comment referencing the design
document:

```typescript
/**
 * **Feature: subject-teacher-class-assignment, Property 1: Teacher-Subject Compatibility Validation**
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
test.prop([teacherArb, subjectArb], { numRuns: 100 })(
  'assignment validation respects teacher subject compatibility',
  (teacher, subject) => {
    const isValid = validateTeacherSubjectCompatibility(teacher, subject);

    if (teacher.restrictToPrimarySubjects) {
      return isValid === teacher.primarySubjectIds.includes(subject.id);
    } else {
      return (
        isValid ===
        (teacher.primarySubjectIds.includes(subject.id) ||
          teacher.allowedSubjectIds.includes(subject.id))
      );
    }
  }
);
```

### Generators for Property Tests

```typescript
// test-utils/assignmentGenerators.ts
import * as fc from 'fast-check';

export const teacherArb: fc.Arbitrary<Teacher> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  fullName: fc.string({ minLength: 1, maxLength: 50 }),
  primarySubjectIds: fc.array(fc.integer({ min: 1, max: 100 }), {
    minLength: 1,
    maxLength: 5,
  }),
  allowedSubjectIds: fc.array(fc.integer({ min: 1, max: 100 }), {
    maxLength: 10,
  }),
  restrictToPrimarySubjects: fc.boolean(),
  maxPeriodsPerWeek: fc.integer({ min: 10, max: 40 }),
  maxPeriodsPerDay: fc.integer({ min: 4, max: 8 }),
});

export const subjectArb: fc.Arbitrary<Subject> = fc.record({
  id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 30 }),
  periodsPerWeek: fc.integer({ min: 1, max: 6 }),
  grade: fc.integer({ min: 1, max: 12 }),
});

export const classGroupArb: fc.Arbitrary<ClassGroup> = fc.record({
  id: fc.integer({ min: 1, max: 1000 }),
  name: fc.string({ minLength: 1, maxLength: 20 }),
  grade: fc.integer({ min: 1, max: 12 }),
  studentCount: fc.integer({ min: 10, max: 40 }),
});

export const assignmentArb: fc.Arbitrary<EnhancedClassAssignment> = fc.record({
  subjectId: fc.integer({ min: 1, max: 100 }),
  classIds: fc.array(fc.integer({ min: 1, max: 1000 }), {
    minLength: 1,
    maxLength: 5,
  }),
  periodsPerWeek: fc.integer({ min: 1, max: 6 }),
});

// Complex scenario generators
export const assignmentScenarioArb = fc.record({
  teachers: fc.array(teacherArb, { minLength: 5, maxLength: 20 }),
  subjects: fc.array(subjectArb, { minLength: 10, maxLength: 30 }),
  classes: fc.array(classGroupArb, { minLength: 10, maxLength: 50 }),
});
```

### Unit Test Examples

```typescript
// assignmentValidation.test.ts
describe('Assignment Validation', () => {
  it('should reject assignment when teacher cannot teach subject', () => {
    const teacher: Teacher = {
      id: 1,
      primarySubjectIds: [1, 2],
      allowedSubjectIds: [3],
      restrictToPrimarySubjects: true,
      maxPeriodsPerWeek: 30,
    };

    const subject: Subject = { id: 4, name: 'Physics' };

    const result = validateTeacherSubjectCompatibility(teacher, subject);
    expect(result).toBe(false);
  });

  it('should calculate workload correctly for multiple assignments', () => {
    const assignments: EnhancedClassAssignment[] = [
      { subjectId: 1, classIds: [1, 2], periodsPerWeek: 4 },
      { subjectId: 2, classIds: [3], periodsPerWeek: 3 },
    ];

    const workload = calculateTeacherWorkload(assignments);
    expect(workload.totalPeriods).toBe(11); // (2 * 4) + (1 * 3)
  });
});
```

### Performance Test Examples

```typescript
// assignmentPerformance.test.ts
describe('Assignment Performance', () => {
  it('should load assignment data within 2 seconds for large datasets', async () => {
    const startTime = Date.now();

    // Generate large dataset
    const teachers = generateTeachers(100);
    const classes = generateClasses(50);
    const subjects = generateSubjects(30);

    const assignments = await loadAssignmentData(teachers, classes, subjects);

    const endTime = Date.now();
    expect(endTime - startTime).toBeLessThan(2000);
    expect(assignments).toBeDefined();
  });

  it('should calculate workload within 500ms', async () => {
    const teacher = generateTeacherWithManyAssignments(50);

    const startTime = Date.now();
    const workload = calculateTeacherWorkload(teacher.classAssignments);
    const endTime = Date.now();

    expect(endTime - startTime).toBeLessThan(500);
    expect(workload.totalPeriods).toBeGreaterThan(0);
  });
});
```

### Integration Test Strategy

```typescript
// assignmentAPI.integration.test.ts
describe('Assignment API Integration', () => {
  it('should maintain data consistency across assignment operations', async () => {
    // Create teacher, subject, and class
    const teacher = await createTeacher(teacherData);
    const subject = await createSubject(subjectData);
    const classGroup = await createClass(classData);

    // Assign teacher to subject in class
    await assignTeacher({
      teacherId: teacher.id,
      subjectId: subject.id,
      classIds: [classGroup.id],
      periodsPerWeek: 4,
    });

    // Verify bidirectional updates
    const updatedTeacher = await getTeacher(teacher.id);
    const updatedClass = await getClass(classGroup.id);

    expect(updatedTeacher.classAssignments).toContainEqual({
      subjectId: subject.id,
      classIds: [classGroup.id],
    });

    expect(updatedClass.subjectRequirements).toContainEqual({
      subjectId: subject.id,
      teacherId: teacher.id,
      periodsPerWeek: 4,
    });
  });
});
```

This comprehensive testing strategy ensures that the Subject-Teacher-Class
Assignment System maintains reliability, performance, and correctness across all
scenarios while integrating seamlessly with the existing Maktab architecture.
