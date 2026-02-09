# Swap Implementation Plan V2

**Document Version:** 2.0 **Date:** January 18, 2026 **Status:** Ready for
Implementation

---

## Executive Summary

This document provides a detailed, task-based implementation plan for the
cascading swap system with intelligent constraint data gathering. This plan
supersedes the original implementation timeline in
`UI_ENHANCING_AND_SWAP_IMPLEMENTATION.md` by incorporating an optimized approach
that leverages existing database entities for constraint validation.

### Key Improvements Over V1

1. **No New Database Tables**: All constraint data already exists in `Teacher`,
   `Subject`, `Room`, and `TeacherClassSubjectAssignment` entities
2. **Intelligent Data Gathering**: New `SwapConstraintGatherer` service extracts
   and transforms entity data for solver
3. **Performance Optimization**: 5-minute caching strategy reduces database
   queries to ~1ms after first request
4. **Parallel Queries**: All entity data fetched concurrently (5 queries total)
5. **Simplified Architecture**: Eliminates need for constraint-specific tables
   and migrations

### Timeline Overview

- **Total Duration**: 12-16 days (reduced from 14-22 days)
- **Phases**: 8 phases (same structure, optimized tasks)
- **Team Size**: 1-2 developers
- **Risk Level**: Medium (constraint solver integration complexity)

---

## Phase 0: Constraint Data Gathering Infrastructure

**Duration**: 2-3 days **Priority**: Critical (blocks Phase 7) **Dependencies**:
None

### Overview

Build the infrastructure to gather constraint data from existing database
entities and transform it into the format required by the Python constraint
solver.

### Task 0.1: Create SwapConstraintCache Service

**File**: `packages/api/src/services/SwapConstraintCache.ts`

**Description**: Implement LRU cache for constraint data with 5-minute TTL.

**Implementation**:

```typescript
import { LRUCache } from 'lru-cache';

export interface CachedConstraintData {
  teachers: TeacherConstraintData[];
  subjects: SubjectConstraintData[];
  rooms: RoomConstraintData[];
  assignments: AssignmentConstraintData[];
  timetableData: TimetableData;
  cachedAt: Date;
}

export class SwapConstraintCache {
  private cache: LRUCache<number, CachedConstraintData>;

  constructor() {
    this.cache = new LRUCache({
      max: 100, // Cache up to 100 timetables
      ttl: 5 * 60 * 1000, // 5 minutes
      updateAgeOnGet: true,
    });
  }

  get(timetableId: number): CachedConstraintData | undefined {
    return this.cache.get(timetableId);
  }

  set(timetableId: number, data: CachedConstraintData): void {
    this.cache.set(timetableId, data);
  }

  invalidate(timetableId: number): void {
    this.cache.delete(timetableId);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const swapConstraintCache = new SwapConstraintCache();
```

**Acceptance Criteria**:

- Cache stores constraint data with 5-minute TTL
- LRU eviction when max size reached
- Invalidation method for manual cache clearing
- Singleton instance exported

**Estimated Time**: 2-3 hours

### Task 0.2: Create SwapConstraintGatherer Service

**File**: `packages/api/src/services/SwapConstraintGatherer.ts`

**Description**: Service to extract and transform entity data into constraint
format for solver.

**Implementation**:

```typescript
import { Teacher } from '../entity/Teacher';
import { Subject } from '../entity/Subject';
import { Room } from '../entity/Room';
import { TeacherClassSubjectAssignment } from '../entity/TeacherClassSubjectAssignment';
import { Timetable } from '../entity/Timetable';
import { swapConstraintCache } from './SwapConstraintCache';

export interface TeacherConstraintData {
  id: string;
  availability: Record<string, boolean[]>; // day -> period availability
  timePreference: 'Morning' | 'Afternoon' | 'None';
  maxConsecutivePeriods: number;
  maxPeriodsPerWeek: number;
}

export interface SubjectConstraintData {
  id: string;
  requiredRoomType: string | null;
  isDifficult: boolean;
  minRoomCapacity: number;
}

export interface RoomConstraintData {
  id: string;
  type: string;
  capacity: number;
  features: string[];
  unavailable: Record<string, boolean[]>; // day -> period unavailability
}

export interface AssignmentConstraintData {
  teacherId: string;
  classId: string;
  subjectId: string;
  isFixed: boolean;
}

export interface TimetableData {
  lessons: any[]; // Parsed from timetable.data JSON
  periodsPerDay: Record<string, number>;
  daysOfWeek: string[];
}

export class SwapConstraintGatherer {
  /**
   * Gathers all constraint data for a timetable
   * Uses cache if available, otherwise queries database
   */
  async gatherConstraints(timetableId: number): Promise<CachedConstraintData> {
    // Check cache first
    const cached = swapConstraintCache.get(timetableId);
    if (cached) {
      return cached;
    }

    // Parallel database queries
    const [timetable, teachers, subjects, rooms, assignments] =
      await Promise.all([
        Timetable.findOne({ where: { id: timetableId, isDeleted: false } }),
        Teacher.find({ where: { isDeleted: false } }),
        Subject.find({ where: { isDeleted: false } }),
        Room.find({ where: { isDeleted: false } }),
        TeacherClassSubjectAssignment.find({ where: { isDeleted: false } }),
      ]);

    if (!timetable) {
      throw new Error(`Timetable ${timetableId} not found`);
    }

    // Transform entities to constraint format
    const constraintData: CachedConstraintData = {
      teachers: this.transformTeachers(teachers),
      subjects: this.transformSubjects(subjects),
      rooms: this.transformRooms(rooms),
      assignments: this.transformAssignments(assignments),
      timetableData: this.parseTimetableData(timetable),
      cachedAt: new Date(),
    };

    // Cache the result
    swapConstraintCache.set(timetableId, constraintData);

    return constraintData;
  }

  private transformTeachers(teachers: Teacher[]): TeacherConstraintData[] {
    return teachers.map((teacher) => ({
      id: teacher.id.toString(),
      availability: this.parseAvailability(teacher.availability),
      timePreference: teacher.timePreference || 'None',
      maxConsecutivePeriods: teacher.maxConsecutivePeriods || 4,
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 30,
    }));
  }

  private transformSubjects(subjects: Subject[]): SubjectConstraintData[] {
    return subjects.map((subject) => ({
      id: subject.id.toString(),
      requiredRoomType: subject.requiredRoomType || null,
      isDifficult: subject.isDifficult || false,
      minRoomCapacity: subject.minRoomCapacity || 0,
    }));
  }

  private transformRooms(rooms: Room[]): RoomConstraintData[] {
    return rooms.map((room) => ({
      id: room.id.toString(),
      type: room.type || 'normal',
      capacity: room.capacity || 0,
      features: this.parseFeatures(room.features),
      unavailable: this.parseUnavailability(room.unavailable),
    }));
  }

  private transformAssignments(
    assignments: TeacherClassSubjectAssignment[]
  ): AssignmentConstraintData[] {
    return assignments.map((assignment) => ({
      teacherId: assignment.teacherId.toString(),
      classId: assignment.classId.toString(),
      subjectId: assignment.subjectId.toString(),
      isFixed: assignment.isFixed,
    }));
  }

  private parseTimetableData(timetable: Timetable): TimetableData {
    const data = JSON.parse(timetable.data);
    return {
      lessons: data.lessons || [],
      periodsPerDay: data.periodsPerDay || {},
      daysOfWeek: data.daysOfWeek || [
        'Saturday',
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
      ],
    };
  }

  private parseAvailability(
    availabilityJson: string | null
  ): Record<string, boolean[]> {
    if (!availabilityJson) return {};
    try {
      return JSON.parse(availabilityJson);
    } catch {
      return {};
    }
  }

  private parseFeatures(featuresJson: string | null): string[] {
    if (!featuresJson) return [];
    try {
      return JSON.parse(featuresJson);
    } catch {
      return [];
    }
  }

  private parseUnavailability(
    unavailableJson: string | null
  ): Record<string, boolean[]> {
    if (!unavailableJson) return {};
    try {
      return JSON.parse(unavailableJson);
    } catch {
      return {};
    }
  }
}

export const swapConstraintGatherer = new SwapConstraintGatherer();
```

**Acceptance Criteria**:

- Parallel database queries (5 queries)
- Transforms all entities to constraint format
- Parses JSON fields correctly
- Caches results automatically
- Performance: <100ms for first request, <1ms for cached

**Estimated Time**: 6-8 hours

### Task 0.3: Create Swap Validation API Endpoint

**File**: `packages/api/src/routes/swap.routes.ts`

**Description**: API endpoint to validate swap operations using constraint data.

**Implementation**:

```typescript
import { Router } from 'express';
import { swapConstraintGatherer } from '../services/SwapConstraintGatherer';
import { validateSwapRequest } from '../schemas/swap.schema';

const router = Router();

/**
 * POST /api/swap/validate
 * Validates a swap operation against constraints
 */
router.post('/validate', async (req, res) => {
  try {
    // Validate request body
    const swapRequest = validateSwapRequest(req.body);

    // Gather constraint data
    const constraints = await swapConstraintGatherer.gatherConstraints(
      swapRequest.timetableId
    );

    // TODO: Phase 7 - Call Python solver for validation
    // For now, return constraint data for testing
    res.json({
      success: true,
      constraints,
      message: 'Constraint data gathered successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/swap/execute
 * Executes a validated swap operation
 */
router.post('/execute', async (req, res) => {
  try {
    // TODO: Phase 7 - Implement swap execution
    res.status(501).json({
      success: false,
      error: 'Not implemented yet',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
```

**File**: `packages/api/src/schemas/swap.schema.ts`

```typescript
import { z } from 'zod';

export const swapRequestSchema = z.object({
  timetableId: z.number(),
  sourceSlot: z.object({
    classId: z.string(),
    day: z.string(),
    period: z.number(),
  }),
  targetSlot: z.object({
    classId: z.string(),
    day: z.string(),
    period: z.number(),
  }),
});

export type SwapRequest = z.infer<typeof swapRequestSchema>;

export function validateSwapRequest(data: unknown): SwapRequest {
  return swapRequestSchema.parse(data);
}
```

**Acceptance Criteria**:

- `/api/swap/validate` endpoint returns constraint data
- Request validation with Zod
- Error handling for missing timetable
- Cache integration working
- Response time <150ms (first request), <10ms (cached)

**Estimated Time**: 3-4 hours

### Task 0.4: Unit Tests for Constraint Gathering

**Files**:

- `packages/api/src/services/__tests__/SwapConstraintGatherer.test.ts`
- `packages/api/src/services/__tests__/SwapConstraintCache.test.ts`

**Description**: Comprehensive tests for constraint gathering and caching.

**Test Cases**:

1. Cache hit/miss scenarios
2. TTL expiration
3. Parallel query execution
4. Entity transformation correctness
5. JSON parsing edge cases
6. Error handling for missing timetable

**Acceptance Criteria**:

- 90%+ code coverage
- All edge cases tested
- Performance benchmarks included

**Estimated Time**: 4-5 hours

---

## Phase 1: Grid Layout Refactoring (Days-as-Columns)

**Duration**: 2-3 days **Priority**: High **Dependencies**: None

### Overview

Transpose the current grid layout from days-as-rows/periods-as-columns to
days-as-columns/periods-as-rows. This is a pure UI refactoring with no business
logic changes.

### Task 1.1: Update ScheduleGrid Component

**File**: `packages/web/src/features/schedule/components/grid/ScheduleGrid.tsx`

**Changes**:

- Swap row/column iteration logic
- Update grid template:
  `grid-template-columns: auto repeat(${days.length}, 1fr)`
- Update header row to show days horizontally
- Update period labels to show vertically (first column)
- Maintain all existing props and functionality

**Before** (current):

```
        | Period 1 | Period 2 | Period 3 |
Saturday|   Math   | Physics  | English  |
Sunday  | History  |  Dari    |  Sport   |
```

**After** (new):

```
         | Saturday | Sunday   | Monday   |
Period 1 |   Math   | History  | Biology  |
Period 2 | Physics  |  Dari    | English  |
Period 3 | English  |  Sport   | Chemistry|
```

**Acceptance Criteria**:

- Grid displays days as columns
- Periods display as rows
- All existing features work (highlighting, selection, etc.)
- No visual regressions
- Responsive to different periodsPerDay configurations

**Estimated Time**: 4-6 hours

### Task 1.2: Update ScheduleCell Styling

**File**: `packages/web/src/features/schedule/components/grid/ScheduleCell.tsx`

**Changes**:

- Adjust cell dimensions for new orientation
- Update text layout for vertical stacking
- Ensure RTL compatibility maintained
- Test with all cellSize options (compact, normal, large)

**Acceptance Criteria**:

- Cells render correctly in new layout
- Text doesn't overflow
- All display settings work (showTeacherName, showRoomName, etc.)
- Color coding still functional

**Estimated Time**: 2-3 hours

### Task 1.3: Update View Components

**Files**:

- `packages/web/src/features/schedule/components/views/ClassScheduleView.tsx`
- `packages/web/src/features/schedule/components/views/TeacherScheduleView.tsx`

**Changes**:

- Verify grid integration with new layout
- Update any layout-specific styling
- Test with different class/teacher selections

**Acceptance Criteria**:

- Both views render correctly
- Navigation between classes/teachers works
- No layout issues with sidebar

**Estimated Time**: 2-3 hours

### Task 1.4: Visual Testing & Refinement

**Description**: Manual testing across different scenarios

**Test Scenarios**:

1. Variable periods per day (Saturday=7, Thursday=4)
2. Different display settings (compact, normal, large)
3. Different color coding modes
4. Teacher highlighting
5. Empty schedule state
6. Single-teacher mode classes

**Acceptance Criteria**:

- All scenarios render correctly
- No visual glitches or overlaps
- Performance acceptable (no lag)

**Estimated Time**: 3-4 hours

---

## Phase 2: Drag-and-Drop Foundation

**Duration**: 1-2 days **Priority**: High **Dependencies**: Phase 1 complete

### Overview

Update existing drag-and-drop implementation to work with new grid layout. No
functional changes to swap logic yet.

### Task 2.1: Update DraggableCell Component

**File**: `packages/web/src/features/schedule/components/grid/DraggableCell.tsx`

**Changes**:

- Verify drag data structure still correct
- Test drag preview with new layout
- Ensure drag styles work (opacity, scale)

**Acceptance Criteria**:

- Cells can be dragged
- Drag preview shows correctly
- Drag data includes correct slot information

**Estimated Time**: 2-3 hours

### Task 2.2: Update DroppableCell Component

**File**: `packages/web/src/features/schedule/components/grid/DroppableCell.tsx`

**Changes**:

- Verify drop target detection
- Test hover feedback with new layout
- Ensure drop validation works

**Acceptance Criteria**:

- Drop targets highlight on hover
- Drop validation prevents invalid drops
- Visual feedback clear and responsive

**Estimated Time**: 2-3 hours

### Task 2.3: Update useDragDrop Hook

**File**: `packages/web/src/features/schedule/hooks/useDragDrop.ts`

**Changes**:

- Review slot key generation (should still be `${day}-${period}`)
- Verify drag/drop event handlers
- Test with new grid layout

**Acceptance Criteria**:

- Drag and drop works end-to-end
- No console errors
- Performance acceptable

**Estimated Time**: 2-3 hours

---

## Phase 3: Python Constraint Solver Integration

**Duration**: 3-4 days **Priority**: Critical **Dependencies**: Phase 0 complete

### Overview

Create Python solver module for swap validation using OR-Tools CP-SAT. This
solver receives constraint data and swap request, returns validation result with
minimal disruption solution.

### Task 3.1: Create Swap Solver Module

**File**: `packages/solver/swap_solver.py`

**Description**: Standalone Python module for swap constraint validation.

**Implementation**:

```python
from ortools.sat.python import cp_model
from pydantic import BaseModel
from typing import List, Dict, Optional
import json
import sys

class SwapRequest(BaseModel):
    timetable_id: int
    source_slot: Dict[str, any]  # {classId, day, period}
    target_slot: Dict[str, any]  # {classId, day, period}

class ConstraintViolation(BaseModel):
    type: str
    severity: str  # 'hard' or 'soft'
    message: str
    details: Dict[str, any]

class LessonMove(BaseModel):
    class_id: str
    subject_id: str
    teacher_id: str
    room_id: str
    from_day: str
    from_period: int
    to_day: str
    to_period: int

class SwapResolution(BaseModel):
    is_valid: bool
    can_proceed_with_warning: bool
    errors: List[ConstraintViolation]
    warnings: List[ConstraintViolation]
    affected_lessons: List[LessonMove]
    total_moves: int

class SwapSolver:
    def __init__(self, constraint_data: Dict):
        self.teachers = constraint_data['teachers']
        self.subjects = constraint_data['subjects']
        self.rooms = constraint_data['rooms']
        self.assignments = constraint_data['assignments']
        self.timetable = constraint_data['timetableData']

    def validate_swap(self, swap_request: SwapRequest) -> SwapResolution:
        """
        Validates a swap operation and finds minimal disruption solution
        """
        errors = []
        warnings = []
        affected_lessons = []

        # Get lessons at source and target slots
        source_lesson = self._get_lesson_at_slot(
            swap_request.source_slot['classId'],
            swap_request.source_slot['day'],
            swap_request.source_slot['period']
        )

        target_lesson = self._get_lesson_at_slot(
            swap_request.target_slot['classId'],
            swap_request.target_slot['day'],
            swap_request.target_slot['period']
        )

        # Check hard constraints
        teacher_conflicts = self._check_teacher_conflicts(
            source_lesson, target_lesson, swap_request
        )
        errors.extend(teacher_conflicts)

        room_conflicts = self._check_room_conflicts(
            source_lesson, target_lesson, swap_request
        )
        errors.extend(room_conflicts)

        room_type_issues = self._check_room_type_requirements(
            source_lesson, target_lesson, swap_request
        )
        errors.extend(room_type_issues)

        # Check soft constraints
        consecutive_issues = self._check_consecutive_periods(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(consecutive_issues)

        difficult_afternoon = self._check_difficult_subject_timing(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(difficult_afternoon)

        teacher_preference = self._check_teacher_preferences(
            source_lesson, target_lesson, swap_request
        )
        warnings.extend(teacher_preference)

        # If no hard constraints violated, find minimal disruption solution
        if len(errors) == 0:
            affected_lessons = self._find_minimal_disruption_solution(
                source_lesson, target_lesson, swap_request
            )

        return SwapResolution(
            is_valid=len(errors) == 0,
            can_proceed_with_warning=len(errors) == 0 and len(warnings) > 0,
            errors=errors,
            warnings=warnings,
            affected_lessons=affected_lessons,
            total_moves=len(affected_lessons)
        )

    def _find_minimal_disruption_solution(
        self, source_lesson, target_lesson, swap_request
    ) -> List[LessonMove]:
        """
        Uses CP-SAT to find minimal number of lesson moves
        """
        model = cp_model.CpModel()

        # Create variables for each lesson's potential new position
        # Objective: minimize number of lessons moved

        # Add constraints:
        # 1. No teacher double-booking
        # 2. No room double-booking
        # 3. Room type requirements met
        # 4. Teacher availability respected

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0  # 10 second timeout

        status = solver.Solve(model)

        if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
            # Extract solution
            moves = []
            # TODO: Extract lesson moves from solution
            return moves
        else:
            # No solution found - should not happen if validation passed
            return []

    def _get_lesson_at_slot(self, class_id, day, period):
        """Find lesson at specific slot"""
        for lesson in self.timetable['lessons']:
            if (lesson['classId'] == class_id and
                lesson['day'] == day and
                lesson['periodIndex'] == period):
                return lesson
        return None

    def _check_teacher_conflicts(self, source, target, request):
        """Check if teacher would be double-booked"""
        violations = []
        # Implementation
        return violations

    def _check_room_conflicts(self, source, target, request):
        """Check if room would be double-booked"""
        violations = []
        # Implementation
        return violations

    def _check_room_type_requirements(self, source, target, request):
        """Check if room type matches subject requirements"""
        violations = []
        # Implementation
        return violations

    def _check_consecutive_periods(self, source, target, request):
        """Check if teacher exceeds max consecutive periods"""
        violations = []
        # Implementation
        return violations

    def _check_difficult_subject_timing(self, source, target, request):
        """Check if difficult subject scheduled in afternoon"""
        violations = []
        # Implementation
        return violations

    def _check_teacher_preferences(self, source, target, request):
        """Check if swap violates teacher time preferences"""
        violations = []
        # Implementation
        return violations

def main():
    """
    Entry point for swap solver
    Reads JSON from stdin, writes result to stdout
    """
    try:
        input_data = json.loads(sys.stdin.read())

        swap_request = SwapRequest(**input_data['swapRequest'])
        constraint_data = input_data['constraintData']

        solver = SwapSolver(constraint_data)
        result = solver.validate_swap(swap_request)

        print(json.dumps(result.dict()))
        sys.exit(0)

    except Exception as e:
        error_result = {
            'is_valid': False,
            'can_proceed_with_warning': False,
            'errors': [{
                'type': 'SOLVER_ERROR',
                'severity': 'hard',
                'message': str(e),
                'details': {}
            }],
            'warnings': [],
            'affected_lessons': [],
            'total_moves': 0
        }
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == '__main__':
    main()
```

**Acceptance Criteria**:

- Reads JSON from stdin
- Validates all hard constraints
- Checks all soft constraints
- Finds minimal disruption solution using CP-SAT
- Returns structured JSON result
- 10-second timeout enforced
- Error handling for invalid input

**Estimated Time**: 12-16 hours

### Task 3.2: Create SwapSolverService in API

**File**: `packages/api/src/services/SwapSolverService.ts`

**Description**: Node.js service to invoke Python swap solver via child process.

**Implementation**:

```typescript
import { spawn } from 'child_process';
import path from 'path';
import { swapConstraintGatherer } from './SwapConstraintGatherer';

export interface SwapValidationRequest {
  timetableId: number;
  sourceSlot: {
    classId: string;
    day: string;
    period: number;
  };
  targetSlot: {
    classId: string;
    day: string;
    period: number;
  };
}

export interface SwapValidationResponse {
  isValid: boolean;
  canProceedWithWarning: boolean;
  errors: ConstraintViolation[];
  warnings: ConstraintViolation[];
  affectedLessons: LessonMove[];
  totalMoves: number;
}

export class SwapSolverService {
  private pythonPath: string;
  private solverPath: string;

  constructor() {
    this.pythonPath = path.join(__dirname, '../../solver/.venv/bin/python');
    this.solverPath = path.join(__dirname, '../../solver/swap_solver.py');
  }

  async validateSwap(
    request: SwapValidationRequest
  ): Promise<SwapValidationResponse> {
    // Gather constraint data
    const constraintData = await swapConstraintGatherer.gatherConstraints(
      request.timetableId
    );

    // Prepare input for Python solver
    const solverInput = {
      swapRequest: request,
      constraintData,
    };

    // Spawn Python process
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.solverPath]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch (error) {
            reject(
              new Error(`Failed to parse solver output: ${error.message}`)
            );
          }
        } else {
          reject(new Error(`Solver failed with code ${code}: ${stderr}`));
        }
      });

      python.on('error', (error) => {
        reject(new Error(`Failed to spawn solver: ${error.message}`));
      });

      // Write input to stdin
      python.stdin.write(JSON.stringify(solverInput));
      python.stdin.end();

      // Timeout after 15 seconds
      setTimeout(() => {
        python.kill();
        reject(new Error('Solver timeout after 15 seconds'));
      }, 15000);
    });
  }
}

export const swapSolverService = new SwapSolverService();
```

**Acceptance Criteria**:

- Spawns Python process correctly
- Passes constraint data to solver
- Parses solver output
- Handles timeouts (15s)
- Error handling for solver failures
- Singleton instance exported

**Estimated Time**: 4-6 hours

### Task 3.3: Update Swap API Endpoint

**File**: `packages/api/src/routes/swap.routes.ts`

**Changes**: Update `/api/swap/validate` to use SwapSolverService

```typescript
router.post('/validate', async (req, res) => {
  try {
    const swapRequest = validateSwapRequest(req.body);

    const result = await swapSolverService.validateSwap(swapRequest);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

**Acceptance Criteria**:

- Endpoint returns validation result
- Error handling for solver failures
- Response time <10s for typical swaps

**Estimated Time**: 2-3 hours

### Task 3.4: Python Solver Tests

**File**: `packages/solver/tests/test_swap_solver.py`

**Test Cases**:

1. Simple two-way swap (no conflicts)
2. Teacher conflict detection
3. Room conflict detection
4. Room type mismatch
5. Consecutive period violations
6. Difficult subject timing
7. Teacher preference violations
8. Cascading swap (3+ lessons affected)
9. Invalid input handling
10. Timeout scenarios

**Acceptance Criteria**:

- All test cases pass
- Edge cases covered
- Performance benchmarks included

**Estimated Time**: 6-8 hours

---

## Phase 4: Frontend Swap UI Components

**Duration**: 2-3 days **Priority**: High **Dependencies**: Phase 2, Phase 3
complete

### Overview

Build React components for swap confirmation dialog and affected lessons
display.

### Task 4.1: Create SwapConfirmationDialog Component

**File**:
`packages/web/src/features/schedule/components/swap/SwapConfirmationDialog.tsx`

**Description**: Dialog showing swap validation results with affected lessons.

**Implementation**:

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface SwapConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validationResult: SwapValidationResponse | null;
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

export function SwapConfirmationDialog({
  open,
  onOpenChange,
  validationResult,
  onConfirm,
  onCancel,
  isExecuting,
}: SwapConfirmationDialogProps) {
  const { t } = useTranslation();

  if (!validationResult) return null;

  const { isValid, canProceedWithWarning, errors, warnings, affectedLessons, totalMoves } = validationResult;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isValid
              ? t('swap.dialog.title.valid', 'تأیید تبادل')
              : t('swap.dialog.title.invalid', 'تبادل غیرممکن است')
            }
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Status */}
          {isValid ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                {t('swap.dialog.valid', 'این تبادل قابل اجرا است')}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {t('swap.dialog.invalid', 'این تبادل به دلیل محدودیت‌های زیر امکان‌پذیر نیست')}
              </AlertDescription>
            </Alert>
          )}

          {/* Hard Constraint Errors */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-destructive">
                {t('swap.dialog.errors', 'خطاها')}
              </h3>
              {errors.map((error, idx) => (
                <Alert key={idx} variant="destructive">
                  <AlertDescription>{error.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Soft Constraint Warnings */}
          {warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-warning">
                {t('swap.dialog.warnings', 'هشدارها')}
              </h3>
              {warnings.map((warning, idx) => (
                <Alert key={idx}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{warning.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {/* Affected Lessons */}
          {isValid && affectedLessons.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold">
                {t('swap.dialog.affected', 'دروس تحت تأثیر')} ({totalMoves})
              </h3>
              <div className="border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 text-right">{t('swap.table.class', 'کلاس')}</th>
                      <th className="p-2 text-right">{t('swap.table.subject', 'درس')}</th>
                      <th className="p-2 text-right">{t('swap.table.from', 'از')}</th>
                      <th className="p-2 text-right">{t('swap.table.to', 'به')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affectedLessons.map((lesson, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-2">{lesson.class_id}</td>
                        <td className="p-2">{lesson.subject_id}</td>
                        <td className="p-2">
                          {lesson.from_day} - {t('period', 'پریود')} {lesson.from_period}
                        </td>
                        <td className="p-2">
                          {lesson.to_day} - {t('period', 'پریود')} {lesson.to_period}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isExecuting}>
            {t('common.cancel', 'لغو')}
          </Button>
          {isValid && (
            <Button onClick={onConfirm} disabled={isExecuting}>
              {isExecuting
                ? t('swap.executing', 'در حال اجرا...')
                : t('swap.confirm', 'تأیید تبادل')
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Acceptance Criteria**:

- Shows validation status (valid/invalid)
- Displays all errors and warnings
- Lists affected lessons in table
- Confirm/Cancel buttons
- Loading state during execution
- RTL layout support
- Farsi translations

**Estimated Time**: 6-8 hours

### Task 4.2: Create useSwapValidation Hook

**File**: `packages/web/src/features/schedule/hooks/useSwapValidation.ts`

**Description**: React hook for swap validation API calls.

**Implementation**:

```typescript
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SwapValidationRequest {
  timetableId: number;
  sourceSlot: {
    classId: string;
    day: string;
    period: number;
  };
  targetSlot: {
    classId: string;
    day: string;
    period: number;
  };
}

export function useSwapValidation() {
  return useMutation({
    mutationFn: async (request: SwapValidationRequest) => {
      const response = await api.post('/swap/validate', request);
      return response.data.result;
    },
    onError: (error) => {
      console.error('Swap validation failed:', error);
    },
  });
}
```

**Acceptance Criteria**:

- TanStack Query mutation
- Error handling
- TypeScript types
- Loading states

**Estimated Time**: 2-3 hours

### Task 4.3: Integrate Swap Dialog with Grid

**File**: `packages/web/src/features/schedule/components/grid/ScheduleGrid.tsx`

**Changes**:

- Add swap dialog state
- Trigger validation on drop
- Show dialog with results
- Handle confirm/cancel actions

**Acceptance Criteria**:

- Dialog opens on drop
- Validation triggered automatically
- User can confirm or cancel
- Loading states shown

**Estimated Time**: 4-5 hours

---

## Phase 5: Swap Execution & State Management

**Duration**: 2-3 days **Priority**: High **Dependencies**: Phase 4 complete

### Overview

Implement swap execution logic, update schedule state, and integrate with
undo/redo system.

### Task 5.1: Extend scheduleStore for Cascading Swaps

**File**: `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Changes**:

- Update `executeSwap` to handle multiple lesson moves
- Track all affected lessons in SwapAction
- Update indexes for all moved lessons
- Maintain undo/redo compatibility

**Implementation**:

```typescript
/**
 * Executes a validated cascading swap operation
 * Handles multiple lesson moves from solver resolution
 */
executeCascadingSwap: (affectedLessons: LessonMove[]) => {
  logger.info('Executing cascading swap', {
    totalMoves: affectedLessons.length
  });

  set((state) => {
    // Create SwapAction with all affected lessons
    const swapAction: SwapAction = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'swap',
      before: {
        lessons: affectedLessons.map(move => {
          const lesson = state.lessons.find(l =>
            l.classId === move.class_id &&
            l.day === move.from_day &&
            l.periodIndex === move.from_period
          );
          return lesson ? { ...lesson } : null;
        }).filter(Boolean),
      },
      after: {
        lessons: affectedLessons.map(move => {
          const lesson = state.lessons.find(l =>
            l.classId === move.class_id &&
            l.day === move.from_day &&
            l.periodIndex === move.from_period
          );
          return lesson ? {
            ...lesson,
            day: move.to_day,
            periodIndex: move.to_period,
          } : null;
        }).filter(Boolean),
      },
    };

    // Update all affected lessons
    const updatedLessons = state.lessons.map((lesson) => {
      const move = affectedLessons.find(m =>
        m.class_id === lesson.classId &&
        m.from_day === lesson.day &&
        m.from_period === lesson.periodIndex
      );

      if (move) {
        return {
          ...lesson,
          day: move.to_day,
          periodIndex: move.to_period,
        };
      }

      return lesson;
    });

    state.lessons = updatedLessons;
    state.indexes = buildIndexes(updatedLessons);

    // Push to undoStack with limit enforcement
    if (state.undoStack.length >= UNDO_STACK_LIMIT) {
      state.undoStack.shift();
    }
    state.undoStack.push(swapAction);

    // Clear redoStack
    state.redoStack = [];

    // Reset interaction state
    state.interactionMode = 'idle';
    state.selectedLesson = null;
  });

  logger.info('Cascading swap executed successfully');
},
```

**Acceptance Criteria**:

- Handles multiple lesson moves
- Updates all affected lessons atomically
- Maintains index consistency
- Undo/redo works for cascading swaps
- No race conditions

**Estimated Time**: 4-6 hours

### Task 5.2: Update Undo/Redo for Cascading Swaps

**File**: `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Changes**:

- Update `undo()` to restore multiple lessons
- Update `redo()` to reapply multiple lessons
- Ensure atomic operations

**Acceptance Criteria**:

- Undo restores all affected lessons
- Redo reapplies all affected lessons
- No partial state updates
- Performance acceptable for 10+ lesson moves

**Estimated Time**: 3-4 hours

### Task 5.3: Create useSwapExecution Hook

**File**: `packages/web/src/features/schedule/hooks/useSwapExecution.ts`

**Description**: Hook to execute validated swaps and update store.

**Implementation**:

```typescript
import { useScheduleStore } from '../stores/scheduleStore';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useSwapExecution() {
  const { t } = useTranslation();
  const executeCascadingSwap = useScheduleStore(
    (state) => state.executeCascadingSwap
  );

  const executeSwap = async (affectedLessons: LessonMove[]) => {
    try {
      // Execute swap in store
      executeCascadingSwap(affectedLessons);

      // Show success toast
      toast.success(t('swap.success', 'تبادل با موفقیت انجام شد'), {
        description: t(
          'swap.success.description',
          `${affectedLessons.length} درس جابجا شد`
        ),
      });

      return { success: true };
    } catch (error) {
      toast.error(t('swap.error', 'خطا در انجام تبادل'), {
        description: error.message,
      });

      return { success: false, error };
    }
  };

  return { executeSwap };
}
```

**Acceptance Criteria**:

- Executes swap via store action
- Shows success/error toasts
- Error handling
- TypeScript types

**Estimated Time**: 2-3 hours

### Task 5.4: Integrate Execution with Dialog

**File**:
`packages/web/src/features/schedule/components/swap/SwapConfirmationDialog.tsx`

**Changes**:

- Call useSwapExecution on confirm
- Handle execution errors
- Close dialog on success
- Show loading state

**Acceptance Criteria**:

- Confirm button executes swap
- Dialog closes on success
- Errors shown to user
- Loading state during execution

**Estimated Time**: 2-3 hours

---

## Phase 6: Undo/Redo UI Integration

**Duration**: 1-2 days **Priority**: Medium **Dependencies**: Phase 5 complete

### Overview

Add undo/redo buttons to schedule view and integrate with keyboard shortcuts.

### Task 6.1: Create UndoRedoToolbar Component

**File**:
`packages/web/src/features/schedule/components/toolbar/UndoRedoToolbar.tsx`

**Implementation**:

```typescript
import { Button } from '@/components/ui/button';
import { Undo2, Redo2 } from 'lucide-react';
import { useScheduleStore } from '../../stores/scheduleStore';
import { getCanUndo, getCanRedo } from '../../stores/scheduleStore';
import { useTranslation } from 'react-i18next';

export function UndoRedoToolbar() {
  const { t } = useTranslation();
  const undo = useScheduleStore(state => state.undo);
  const redo = useScheduleStore(state => state.redo);
  const canUndo = useScheduleStore(getCanUndo);
  const canRedo = useScheduleStore(getCanRedo);

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={undo}
        disabled={!canUndo}
        title={t('schedule.undo', 'بازگشت')}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={redo}
        disabled={!canRedo}
        title={t('schedule.redo', 'جلو')}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

**Acceptance Criteria**:

- Buttons enabled/disabled based on stack state
- Icons clear and intuitive
- Tooltips in Farsi
- RTL layout support

**Estimated Time**: 2-3 hours

### Task 6.2: Add Keyboard Shortcuts

**File**: `packages/web/src/features/schedule/hooks/useScheduleKeyboard.ts`

**Implementation**:

```typescript
import { useEffect } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import { getCanUndo, getCanRedo } from '../stores/scheduleStore';

export function useScheduleKeyboard() {
  const undo = useScheduleStore((state) => state.undo);
  const redo = useScheduleStore((state) => state.redo);
  const canUndo = useScheduleStore(getCanUndo);
  const canRedo = useScheduleStore(getCanRedo);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
      }

      // Ctrl+Shift+Z or Cmd+Shift+Z for redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        if (canRedo) redo();
      }

      // Ctrl+Y or Cmd+Y for redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        if (canRedo) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
```

**Acceptance Criteria**:

- Ctrl+Z / Cmd+Z for undo
- Ctrl+Shift+Z / Cmd+Shift+Z for redo
- Ctrl+Y / Cmd+Y for redo (alternative)
- Works across all schedule views
- No conflicts with browser shortcuts

**Estimated Time**: 2-3 hours

### Task 6.3: Integrate Toolbar with Views

**Files**:

- `packages/web/src/features/schedule/components/views/ClassScheduleView.tsx`
- `packages/web/src/features/schedule/components/views/TeacherScheduleView.tsx`

**Changes**:

- Add UndoRedoToolbar to view header
- Add useScheduleKeyboard hook
- Position toolbar appropriately

**Acceptance Criteria**:

- Toolbar visible in both views
- Keyboard shortcuts active
- No layout issues

**Estimated Time**: 2-3 hours

---

## Phase 7: Persistence & Auto-Save

**Duration**: 1-2 days **Priority**: Medium **Dependencies**: Phase 5 complete

### Overview

Implement in-memory state with localStorage backup and explicit save to
database.

### Task 7.1: Implement localStorage Backup

**File**: `packages/web/src/features/schedule/utils/scheduleStorage.ts`

**Implementation**:

```typescript
import type { ScheduledLesson } from '../types';

const STORAGE_KEY_PREFIX = 'maktab_schedule_';

export interface StoredScheduleState {
  scheduleId: number;
  lessons: ScheduledLesson[];
  timestamp: number;
}

export class ScheduleStorage {
  /**
   * Save schedule state to localStorage
   */
  static save(scheduleId: number, lessons: ScheduledLesson[]): void {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      const state: StoredScheduleState = {
        scheduleId,
        lessons,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Load schedule state from localStorage
   */
  static load(scheduleId: number): StoredScheduleState | null {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      const stored = localStorage.getItem(key);
      if (!stored) return null;

      const state: StoredScheduleState = JSON.parse(stored);

      // Check if stored data is less than 24 hours old
      const age = Date.now() - state.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        this.clear(scheduleId);
        return null;
      }

      return state;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear stored state for a schedule
   */
  static clear(scheduleId: number): void {
    try {
      const key = `${STORAGE_KEY_PREFIX}${scheduleId}`;
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  /**
   * Check if there's unsaved data in localStorage
   */
  static hasUnsavedData(scheduleId: number): boolean {
    const stored = this.load(scheduleId);
    return stored !== null;
  }
}
```

**Acceptance Criteria**:

- Saves to localStorage every 30 seconds
- Loads on schedule mount
- Clears on explicit save
- 24-hour expiration
- Error handling for quota exceeded

**Estimated Time**: 3-4 hours

### Task 7.2: Add Auto-Save Hook

**File**: `packages/web/src/features/schedule/hooks/useAutoSave.ts`

**Implementation**:

```typescript
import { useEffect, useRef } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import { ScheduleStorage } from '../utils/scheduleStorage';

const AUTO_SAVE_INTERVAL = 30000; // 30 seconds

export function useAutoSave() {
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const lessons = useScheduleStore((state) => state.lessons);
  const hasUnsavedChanges = useScheduleStore(
    (state) => state.undoStack.length > 0
  );

  const intervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!scheduleId || !hasUnsavedChanges) {
      return;
    }

    // Save immediately on first change
    ScheduleStorage.save(scheduleId, lessons);

    // Set up interval for subsequent saves
    intervalRef.current = setInterval(() => {
      if (hasUnsavedChanges) {
        ScheduleStorage.save(scheduleId, lessons);
      }
    }, AUTO_SAVE_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [scheduleId, lessons, hasUnsavedChanges]);
}
```

**Acceptance Criteria**:

- Saves every 30 seconds when changes exist
- Immediate save on first change
- Cleans up interval on unmount
- No saves when no changes

**Estimated Time**: 2-3 hours

### Task 7.3: Implement Explicit Save

**File**: `packages/web/src/features/schedule/hooks/useSaveSchedule.ts`

**Implementation**:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useScheduleStore } from '../stores/scheduleStore';
import { ScheduleStorage } from '../utils/scheduleStorage';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

export function useSaveSchedule() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const scheduleId = useScheduleStore((state) => state.scheduleId);
  const lessons = useScheduleStore((state) => state.lessons);
  const markAsSaved = useScheduleStore((state) => state.markAsSaved);

  return useMutation({
    mutationFn: async () => {
      if (!scheduleId) {
        throw new Error('No schedule loaded');
      }

      // Save to database
      const response = await api.put(`/timetables/${scheduleId}`, {
        data: JSON.stringify({ lessons }),
      });

      return response.data;
    },
    onSuccess: () => {
      // Mark as saved in store
      markAsSaved();

      // Clear localStorage backup
      if (scheduleId) {
        ScheduleStorage.clear(scheduleId);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['timetables'] });

      // Show success toast
      toast.success(t('schedule.save.success', 'جدول زمانی ذخیره شد'));
    },
    onError: (error) => {
      toast.error(t('schedule.save.error', 'خطا در ذخیره جدول زمانی'), {
        description: error.message,
      });
    },
  });
}
```

**Acceptance Criteria**:

- Saves to database via API
- Clears localStorage on success
- Updates store state (markAsSaved)
- Invalidates queries
- Shows success/error toasts

**Estimated Time**: 3-4 hours

### Task 7.4: Add Save Button to Toolbar

**File**:
`packages/web/src/features/schedule/components/toolbar/ScheduleToolbar.tsx`

**Implementation**:

```typescript
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { useSaveSchedule } from '../../hooks/useSaveSchedule';
import { useScheduleStore } from '../../stores/scheduleStore';
import { getHasUnsavedChanges } from '../../stores/scheduleStore';
import { useTranslation } from 'react-i18next';

export function ScheduleToolbar() {
  const { t } = useTranslation();
  const { mutate: save, isPending } = useSaveSchedule();
  const hasUnsavedChanges = useScheduleStore(getHasUnsavedChanges);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={hasUnsavedChanges ? 'default' : 'outline'}
        size="sm"
        onClick={() => save()}
        disabled={!hasUnsavedChanges || isPending}
      >
        <Save className="h-4 w-4 ml-2" />
        {isPending
          ? t('schedule.saving', 'در حال ذخیره...')
          : t('schedule.save', 'ذخیره')
        }
      </Button>

      {hasUnsavedChanges && (
        <span className="text-sm text-muted-foreground">
          {t('schedule.unsaved', 'تغییرات ذخیره نشده')}
        </span>
      )}
    </div>
  );
}
```

**Acceptance Criteria**:

- Button shows unsaved state
- Disabled when no changes
- Loading state during save
- Farsi labels

**Estimated Time**: 2-3 hours

---

## Phase 8: Testing & Polish

**Duration**: 2-3 days **Priority**: High **Dependencies**: All previous phases
complete

### Overview

Comprehensive testing, bug fixes, performance optimization, and UI polish.

### Task 8.1: Integration Testing

**Description**: End-to-end testing of swap functionality

**Test Scenarios**:

1. Simple two-way swap (no conflicts)
2. Swap with teacher conflict (blocked)
3. Swap with room conflict (blocked)
4. Swap with soft warnings (proceed with confirmation)
5. Cascading swap (3+ lessons affected)
6. Undo/redo cascading swap
7. Save after multiple swaps
8. Load from localStorage after browser refresh
9. Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
10. Multiple swaps in sequence

**Acceptance Criteria**:

- All scenarios pass
- No console errors
- Performance acceptable
- UI responsive

**Estimated Time**: 8-10 hours

### Task 8.2: Performance Optimization

**Focus Areas**:

1. Constraint data caching effectiveness
2. Grid rendering performance (React.memo)
3. Index update performance
4. Solver timeout handling
5. Large schedule handling (50+ classes)

**Acceptance Criteria**:

- Constraint gathering <100ms (first), <1ms (cached)
- Swap validation <10s for typical cases
- Grid renders without lag
- No memory leaks

**Estimated Time**: 6-8 hours

### Task 8.3: UI Polish & Accessibility

**Tasks**:

1. Farsi translations complete
2. RTL layout verified
3. Keyboard navigation working
4. Focus indicators visible
5. Color contrast meets WCAG AA
6. Loading states consistent
7. Error messages clear

**Acceptance Criteria**:

- All text in Farsi
- RTL layout correct
- Keyboard accessible
- WCAG AA compliant

**Estimated Time**: 6-8 hours

### Task 8.4: Documentation

**Files to Create/Update**:

1. `docs/SWAP_SYSTEM_GUIDE.md` - User guide for swap feature
2. `docs/SWAP_ARCHITECTURE.md` - Technical architecture doc
3. `packages/solver/README.md` - Solver usage guide
4. API endpoint documentation
5. Component prop documentation

**Acceptance Criteria**:

- User guide complete
- Architecture documented
- API docs updated
- Code comments added

**Estimated Time**: 4-6 hours

---

## Risk Mitigation

### High-Risk Areas

1. **Solver Performance**
   - Risk: Solver timeout on complex swaps
   - Mitigation: 10-second timeout, fallback to simple validation
   - Contingency: Implement heuristic-based validation as backup

2. **Constraint Data Accuracy**
   - Risk: Missing or incorrect constraint data
   - Mitigation: Comprehensive validation, default values
   - Contingency: Manual constraint override UI

3. **State Consistency**
   - Risk: Race conditions in concurrent swaps
   - Mitigation: Lock mechanism, atomic updates
   - Contingency: State reconciliation on error

4. **Browser Storage Limits**
   - Risk: localStorage quota exceeded
   - Mitigation: 24-hour expiration, compression
   - Contingency: Disable auto-save, prompt explicit save

### Medium-Risk Areas

1. **Undo/Redo Complexity**
   - Risk: Incorrect state restoration
   - Mitigation: Comprehensive tests, immutable updates
   - Contingency: Limit undo stack size

2. **UI Performance**
   - Risk: Grid lag with large schedules
   - Mitigation: React.memo, virtualization if needed
   - Contingency: Pagination or filtering

---

## Success Metrics

### Performance Targets

- Constraint gathering: <100ms (first request), <1ms (cached)
- Swap validation: <10s for 95% of cases
- Grid rendering: <100ms for 50-class schedule
- Undo/redo: <50ms for any operation

### Quality Targets

- Test coverage: >85%
- Zero critical bugs in production
- <5% swap validation failures
- User satisfaction: >4/5 rating

### Adoption Targets

- 80% of users try swap feature within first week
- 50% of users use swap regularly
- <10% support tickets related to swaps

---

## Timeline Summary

| Phase                         | Duration       | Dependencies | Risk   |
| ----------------------------- | -------------- | ------------ | ------ |
| Phase 0: Constraint Gathering | 2-3 days       | None         | Low    |
| Phase 1: Grid Refactoring     | 2-3 days       | None         | Low    |
| Phase 2: Drag-Drop Update     | 1-2 days       | Phase 1      | Low    |
| Phase 3: Solver Integration   | 3-4 days       | Phase 0      | High   |
| Phase 4: Swap UI Components   | 2-3 days       | Phase 2, 3   | Medium |
| Phase 5: Execution & State    | 2-3 days       | Phase 4      | Medium |
| Phase 6: Undo/Redo UI         | 1-2 days       | Phase 5      | Low    |
| Phase 7: Persistence          | 1-2 days       | Phase 5      | Low    |
| Phase 8: Testing & Polish     | 2-3 days       | All          | Medium |
| **Total**                     | **12-16 days** |              |        |

---

## Next Steps

1. **Review & Approval**: Review this plan with stakeholders
2. **Environment Setup**: Ensure Python environment and OR-Tools installed
3. **Phase 0 Start**: Begin with constraint gathering infrastructure
4. **Daily Standups**: Track progress and blockers
5. **Weekly Demos**: Show progress to stakeholders

---

## Appendix A: File Structure

```
packages/
├── api/
│   └── src/
│       ├── routes/
│       │   └── swap.routes.ts (NEW)
│       ├── schemas/
│       │   └── swap.schema.ts (NEW)
│       └── services/
│           ├── SwapConstraintCache.ts (NEW)
│           ├── SwapConstraintGatherer.ts (NEW)
│           └── SwapSolverService.ts (NEW)
├── solver/
│   ├── swap_solver.py (NEW)
│   └── tests/
│       └── test_swap_solver.py (NEW)
└── web/
    └── src/
        └── features/
            └── schedule/
                ├── components/
                │   ├── grid/
                │   │   ├── ScheduleGrid.tsx (MODIFIED)
                │   │   ├── ScheduleCell.tsx (MODIFIED)
                │   │   ├── DraggableCell.tsx (MODIFIED)
                │   │   └── DroppableCell.tsx (MODIFIED)
                │   ├── swap/
                │   │   └── SwapConfirmationDialog.tsx (NEW)
                │   └── toolbar/
                │       ├── UndoRedoToolbar.tsx (NEW)
                │       └── ScheduleToolbar.tsx (NEW)
                ├── hooks/
                │   ├── useSwapValidation.ts (NEW)
                │   ├── useSwapExecution.ts (NEW)
                │   ├── useAutoSave.ts (NEW)
                │   ├── useSaveSchedule.ts (NEW)
                │   ├── useScheduleKeyboard.ts (NEW)
                │   └── useDragDrop.ts (MODIFIED)
                ├── stores/
                │   └── scheduleStore.ts (MODIFIED)
                ├── types.ts (MODIFIED)
                └── utils/
                    └── scheduleStorage.ts (NEW)
```

---

## Appendix B: API Endpoints

### POST /api/swap/validate

**Request**:

```json
{
  "timetableId": 123,
  "sourceSlot": {
    "classId": "7A",
    "day": "Monday",
    "period": 1
  },
  "targetSlot": {
    "classId": "7A",
    "day": "Saturday",
    "period": 6
  }
}
```

**Response**:

```json
{
  "success": true,
  "result": {
    "isValid": true,
    "canProceedWithWarning": true,
    "errors": [],
    "warnings": [
      {
        "type": "DIFFICULT_AFTERNOON",
        "severity": "soft",
        "message": "درس ریاضی در بعدازظهر قرار دارد",
        "details": {
          "subjectName": "ریاضی"
        }
      }
    ],
    "affectedLessons": [
      {
        "class_id": "7A",
        "subject_id": "math",
        "teacher_id": "T001",
        "room_id": "R101",
        "from_day": "Monday",
        "from_period": 1,
        "to_day": "Saturday",
        "to_period": 6
      }
    ],
    "totalMoves": 1
  }
}
```

---

**End of Document**
