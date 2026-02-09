# UI Enhancement & Cascading Swap Implementation

**Project:** Maktab - School Timetable Management System **Feature:** Schedule
View Refactoring & Intelligent Swap System **Date:** January 2026 **Status:**
Architecture Design Complete - Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Requirements Specification](#requirements-specification)
4. [Architecture Design](#architecture-design)
5. [Data Structures](#data-structures)
6. [Component Design](#component-design)
7. [Implementation Plan](#implementation-plan)
8. [Performance Considerations](#performance-considerations)
9. [Testing Strategy](#testing-strategy)
10. [Appendix](#appendix)

---

## Executive Summary

### Problem Statement

The current schedule view system requires enhancement to support:

1. **Grid Layout Transpose**: Change from days-as-rows to days-as-columns
2. **Cascading Swap System**: Intelligent lesson swapping with conflict
   resolution
3. **Performance Optimization**: Handle large schedules (50+ classes, 2,100+
   lessons)
4. **Real-time Conflict Detection**: Validate swaps before execution

### Solution Overview

Implement a **hybrid architecture** combining:

- **Frontend**: React-based UI with in-memory state management
- **Backend**: Node.js API orchestrating solver calls
- **Solver**: Python OR-Tools CP-SAT for constraint satisfaction
- **Caching**: In-memory optimization with localStorage backup

### Key Features

✅ **Cascading Swap Resolution**: Automatically resolve multi-lesson moves ✅
**Minimal Disruption**: Optimize for fewest lessons moved ✅ **Conflict
Prevention**: Block invalid swaps, show detailed reasons ✅ **Undo/Redo**: Full
history tracking for compound actions ✅ **Performance**: <10s resolution for
50-class schedules

---

## Current System Analysis

### Existing Architecture

```
Component Hierarchy:
├── ClassScheduleView / TeacherScheduleView
│   ├── ScheduleGrid (Main grid component)
│   │   ├── DraggableCell (Drag source)
│   │   │   └── ScheduleCell (Visual cell)
│   │   ├── DroppableCell (Drop target)
│   │   └── Dialogs (SwapWarning, SwapBlocked)
│   └── Navigation (CategoryAccordion, TeacherTabs)
```

### Current Grid Layout

**Days as Rows (Current)**

```
         Period 1  Period 2  Period 3  ...
Saturday   [cell]   [cell]    [cell]
Sunday     [cell]   [cell]    [cell]
Monday     [cell]   [cell]    [cell]
```

### Current Swap Logic

**Simple Two-Way Exchange**

```typescript
Slot A: Lesson 1 ⟷ Slot B: Lesson 2
Result: 2 lessons swapped
```

### Limitations

❌ **No cascading swaps**: Can only swap two lessons directly ❌ **No conflict
resolution**: Blocks swap if any conflict exists ❌ **Limited validation**: Only
checks immediate conflicts ❌ **Performance bottlenecks**: Validates all 2,100
slots on selection

---

## Requirements Specification

### Functional Requirements

#### FR-1: Grid Layout Transpose

**Priority:** High **Description:** Change grid layout from days-as-rows to
days-as-columns

**Acceptance Criteria:**

- Days displayed as column headers
- Periods displayed as row headers
- All existing functionality preserved
- Keyboard navigation updated for new layout

#### FR-2: Cascading Swap System

**Priority:** Critical **Description:** Enable intelligent multi-lesson swaps
with automatic conflict resolution

**Acceptance Criteria:**

- User can drag any lesson to any slot
- System calculates all required moves to resolve conflicts
- Shows detailed preview of all changes before execution
- Blocks swap if no valid resolution exists
- Minimizes number of lessons moved

#### FR-3: Swap Mode Toggle

**Priority:** High **Description:** Separate viewing mode from editing mode

**Acceptance Criteria:**

- Button to enable/disable swap mode
- Read-only grid in viewing mode
- Interactive grid in swap mode
- Visual indicator of current mode

#### FR-4: Conflict Resolution Dialog

**Priority:** Critical **Description:** Show detailed preview of all changes
before applying swap

**Acceptance Criteria:**

- Lists all lessons that will move
- Shows before/after positions for each lesson
- Displays affected classes and teachers
- Summary statistics (total moves, affected entities)
- Accept/Reject buttons

#### FR-5: Undo/Redo for Cascading Swaps

**Priority:** High **Description:** Support undo/redo for compound swap actions

**Acceptance Criteria:**

- Undo reverts all moves in a cascade
- Redo reapplies all moves
- History stack limit of 50 actions
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)

#### FR-6: In-Memory State Management

**Priority:** High **Description:** Keep all changes in memory until explicit
save

**Acceptance Criteria:**

- No database writes during swaps
- Auto-save to localStorage every 30 seconds
- Explicit "Save" button to persist to database
- Unsaved changes indicator

### Non-Functional Requirements

#### NFR-1: Performance

- Swap resolution: <10 seconds for 50-class schedules
- UI responsiveness: <100ms for user interactions
- Memory usage: <500MB for large schedules

#### NFR-2: Usability

- Persian (Farsi) UI text
- RTL layout support
- Clear visual feedback during operations
- Accessible keyboard navigation

#### NFR-3: Reliability

- Atomic operations (all-or-nothing swaps)
- Data consistency validation
- Error recovery mechanisms
- Graceful degradation on solver timeout

---

## Architecture Design

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                         │
├─────────────────────────────────────────────────────────────────┤
│  1. User drags lesson → drops on target                         │
│  2. Show loading indicator                                       │
│  3. Send swap request to API                                     │
│  4. Receive resolution proposal                                  │
│  5. Show confirmation dialog with all changes                    │
│  6. User accepts → Apply changes + Update store                  │
│  7. User rejects → Cancel, no changes                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓ HTTP POST
┌─────────────────────────────────────────────────────────────────┐
│                      API (Node.js/Express)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Receive swap request                                         │
│  2. Load current schedule from memory/cache                      │
│  3. Call Python solver with swap constraint                      │
│  4. Return resolution proposal                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ stdin/stdout
┌─────────────────────────────────────────────────────────────────┐
│                   SOLVER (Python OR-Tools)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Receive: current schedule + swap request                     │
│  2. Create constraint problem:                                   │
│     - Fix all lessons except those involved in swap              │
│     - Add constraint: source lesson → target slot                │
│     - Minimize: number of lessons moved                          │
│  3. Solve with CP-SAT                                            │
│  4. Return: list of all required moves OR "impossible"           │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**

- React 18.3 with TypeScript
- Zustand (state management)
- dnd-kit (drag and drop)
- TanStack Query (API calls)
- Shadcn/ui (UI components)

**Backend:**

- Node.js with Express 5.x
- TypeScript
- Child process for Python solver

**Solver:**

- Python 3.x
- Google OR-Tools CP-SAT
- Pydantic v2 (validation)

### State Management Strategy

**In-Memory First Approach**

```typescript
interface ScheduleState {
  // Core data
  scheduleId: number | null;
  lessons: ScheduledLesson[];
  indexes: ScheduleIndexes;

  // Swap state
  swapMode: 'viewing' | 'swapping';
  swapInProgress: boolean;
  pendingResolution: SwapResolution | null;

  // Edit history
  editHistory: CascadeSwapAction[];
  historyIndex: number;
  maxHistorySize: 50;

  // Persistence
  lastSavedAt: Date | null;
  hasUnsavedChanges: boolean;
}
```

**Benefits:**

- ✅ Fast: No database round-trips
- ✅ Atomic: All changes applied together
- ✅ Undo/Redo: Easy with history stack
- ✅ Performance: No DB writes until save

**Persistence Strategy:**

- Auto-save to localStorage every 30 seconds (backup)
- Explicit "Save" button for database persistence
- Clear localStorage on successful save

---

## Data Structures

### Swap Request (Frontend → API)

```typescript
interface SwapRequest {
  scheduleId: number;
  sourceLesson: {
    classId: string;
    day: DayOfWeek;
    period: number;
  };
  targetSlot: {
    day: DayOfWeek;
    period: number;
  };
  currentSchedule: ScheduledLesson[];
}
```

### Swap Resolution (API → Frontend)

```typescript
interface SwapResolution {
  success: boolean;

  // If successful
  moves?: LessonMove[];
  affectedClasses: string[];
  affectedTeachers: string[];
  summary: {
    totalMoves: number;
    primaryMove: LessonMove;
    cascadingMoves: LessonMove[];
  };

  // If failed
  reason?: string;
  conflicts?: ConflictDetail[];
}

interface LessonMove {
  lesson: ScheduledLesson;
  from: { day: DayOfWeek; period: number };
  to: { day: DayOfWeek; period: number };
  reason: 'primary' | 'displaced' | 'cascade';
  affectsClasses: string[];
  affectsTeachers: string[];
}

interface ConflictDetail {
  type: 'teacher_conflict' | 'room_conflict' | 'no_valid_slot';
  message: string;
  messageFa: string;
  involvedLessons: ScheduledLesson[];
}
```

### Compound Action (Undo/Redo)

```typescript
interface CascadeSwapAction {
  id: string;
  timestamp: number;
  type: 'cascade_swap';
  moves: LessonMove[];
  before: ScheduledLesson[]; // Snapshot of affected lessons before
  after: ScheduledLesson[]; // Snapshot of affected lessons after
}
```

---

## Component Design

### New Components

#### 1. SwapModeToggle

**Location:**
`packages/web/src/features/schedule/components/swap/SwapModeToggle.tsx`

**Purpose:** Toggle between viewing and swapping modes

**Props:**

```typescript
interface SwapModeToggleProps {
  // No props - reads from store
}
```

**Features:**

- Shows current mode (viewing/swapping)
- Displays unsaved changes badge
- Keyboard shortcut hint

#### 2. SwapConfirmationDialog

**Location:**
`packages/web/src/features/schedule/components/swap/SwapConfirmationDialog.tsx`

**Purpose:** Show detailed preview of all changes before applying

**Props:**

```typescript
interface SwapConfirmationDialogProps {
  open: boolean;
  resolution: SwapResolution;
  onConfirm: () => void;
  onReject: () => void;
}
```

**Features:**

- Summary cards (total moves, affected classes, affected teachers)
- Primary move highlighted
- Cascading moves list
- Scrollable content
- Accept/Reject buttons

#### 3. SwapLoadingOverlay

**Location:**
`packages/web/src/features/schedule/components/swap/SwapLoadingOverlay.tsx`

**Purpose:** Show loading state during solver execution

**Props:**

```typescript
interface SwapLoadingOverlayProps {
  visible: boolean;
  message?: string;
}
```

**Features:**

- Spinner animation
- Progress message
- Timeout warning (if >5 seconds)

#### 4. SwapFailedDialog

**Location:**
`packages/web/src/features/schedule/components/swap/SwapFailedDialog.tsx`

**Purpose:** Show why swap failed with detailed conflicts

**Props:**

```typescript
interface SwapFailedDialogProps {
  open: boolean;
  reason: string;
  conflicts: ConflictDetail[];
  onClose: () => void;
}
```

**Features:**

- Error icon
- Failure reason in Farsi
- List of conflicts
- Suggestions (if available)

#### 5. MoveCard

**Location:** `packages/web/src/features/schedule/components/swap/MoveCard.tsx`

**Purpose:** Display a single lesson move

**Props:**

```typescript
interface MoveCardProps {
  move: LessonMove;
  variant?: 'primary' | 'cascade';
}
```

**Features:**

- Lesson details (subject, class, teacher)
- Before/after positions
- Visual arrow indicator
- Affected entities

#### 6. AffectedEntitiesSummary

**Location:**
`packages/web/src/features/schedule/components/swap/AffectedEntitiesSummary.tsx`

**Purpose:** Summary of affected classes and teachers

**Props:**

```typescript
interface AffectedEntitiesSummaryProps {
  classes: string[];
  teachers: string[];
}
```

**Features:**

- Class list with badges
- Teacher list with badges
- Expandable if many entities

### Modified Components

#### ScheduleGrid

**Changes:**

- Transpose grid layout (days as columns)
- Add swap mode support
- Connect to swap resolution API
- Show loading overlay during resolution

#### ClassScheduleView

**Changes:**

- Add SwapModeToggle button
- Add SwapConfirmationDialog
- Add SwapFailedDialog
- Wire up swap flow

#### scheduleStore

**Changes:**

- Add swap state fields
- Add swap actions
- Extend undo/redo for cascade swaps
- Add in-memory caching

---

## Implementation Plan

### Phase 1: Python Solver Enhancement (3-5 days)

**Goal:** Create swap resolution solver using OR-Tools CP-SAT

#### Task 1.1: Create Swap Resolver Module

**File:** `packages/solver/swap_resolver.py`

**Subtasks:**

- [ ] Create `SwapRequest` Pydantic model
- [ ] Create `SwapResolution` Pydantic model
- [ ] Create `LessonMove` Pydantic model
- [ ] Implement `resolve_swap()` function skeleton

**Acceptance Criteria:**

- Models validate correctly
- Function accepts request and returns resolution
- Basic structure in place

#### Task 1.2: Implement CP-SAT Model

**File:** `packages/solver/swap_resolver.py`

**Subtasks:**

- [ ] Create variables for each lesson's position
- [ ] Add hard constraint: source lesson → target slot
- [ ] Add teacher conflict constraints
- [ ] Add room conflict constraints
- [ ] Add class conflict constraints
- [ ] Implement minimal disruption objective

**Acceptance Criteria:**

- Model compiles without errors
- Constraints prevent invalid solutions
- Objective minimizes moves

#### Task 1.3: Implement Solution Extraction

**File:** `packages/solver/swap_resolver.py`

**Subtasks:**

- [ ] Extract lesson positions from solver
- [ ] Identify which lessons moved
- [ ] Classify moves (primary/cascade)
- [ ] Build LessonMove objects
- [ ] Calculate affected entities

**Acceptance Criteria:**

- Returns correct list of moves
- Classifies moves correctly
- Identifies all affected entities

#### Task 1.4: Implement Conflict Analysis

**File:** `packages/solver/utils/conflict_analyzer.py`

**Subtasks:**

- [ ] Analyze why solver failed
- [ ] Identify conflicting constraints
- [ ] Generate user-friendly error messages
- [ ] Translate messages to Farsi

**Acceptance Criteria:**

- Returns detailed conflict information
- Messages are clear and actionable
- Farsi translations are accurate

#### Task 1.5: Performance Optimization

**File:** `packages/solver/swap_resolver.py`

**Subtasks:**

- [ ] Add 10-second timeout
- [ ] Implement early termination
- [ ] Add warm start hints
- [ ] Profile with large schedules

**Acceptance Criteria:**

- Solves 50-class schedule in <10s
- Handles timeout gracefully
- Returns feasible solution quickly

#### Task 1.6: Unit Testing

**File:** `packages/solver/tests/test_swap_resolver.py`

**Subtasks:**

- [ ] Test simple 2-lesson swap
- [ ] Test cascading swap (3+ lessons)
- [ ] Test impossible swap
- [ ] Test teacher conflicts
- [ ] Test room conflicts
- [ ] Test performance with large data

**Acceptance Criteria:**

- All tests pass
- Edge cases covered
- Performance benchmarks met

---

### Phase 2: API Integration (2-3 days)

**Goal:** Create API endpoint to call Python solver

#### Task 2.1: Create Swap Service

**File:** `packages/api/src/services/SwapSolverService.ts`

**Subtasks:**

- [ ] Create `SwapSolverService` class
- [ ] Implement `resolveSwap()` method
- [ ] Handle Python process spawning
- [ ] Parse solver output
- [ ] Handle errors and timeouts

**Acceptance Criteria:**

- Service calls Python solver correctly
- Parses JSON response
- Handles errors gracefully

#### Task 2.2: Create API Route

**File:** `packages/api/src/routes/swap.routes.ts`

**Subtasks:**

- [ ] Create `/api/swap/resolve` POST endpoint
- [ ] Add request validation (Zod schema)
- [ ] Call SwapSolverService
- [ ] Return SwapResolution
- [ ] Add error handling

**Acceptance Criteria:**

- Endpoint accepts valid requests
- Returns correct response format
- Handles errors with proper status codes

#### Task 2.3: Add Zod Schemas

**File:** `packages/api/src/schemas/swap.schema.ts`

**Subtasks:**

- [ ] Create `swapRequestSchema`
- [ ] Create `swapResolutionSchema`
- [ ] Create `lessonMoveSchema`
- [ ] Add validation rules

**Acceptance Criteria:**

- Schemas validate correctly
- Type inference works
- Error messages are clear

#### Task 2.4: Integration Testing

**File:** `packages/api/src/routes/__tests__/swap.routes.test.ts`

**Subtasks:**

- [ ] Test successful swap resolution
- [ ] Test failed swap (conflicts)
- [ ] Test invalid request
- [ ] Test solver timeout
- [ ] Test large schedule

**Acceptance Criteria:**

- All tests pass
- Edge cases covered
- Performance acceptable

---

### Phase 3: Frontend State Management (2-3 days)

**Goal:** Extend Zustand store for swap functionality

#### Task 3.1: Add Swap State

**File:** `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Subtasks:**

- [ ] Add `swapMode` field
- [ ] Add `swapInProgress` field
- [ ] Add `pendingResolution` field
- [ ] Add `editHistory` field
- [ ] Add `historyIndex` field

**Acceptance Criteria:**

- State fields added
- TypeScript types correct
- Initial values set

#### Task 3.2: Add Swap Actions

**File:** `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Subtasks:**

- [ ] Implement `setSwapMode()`
- [ ] Implement `requestSwap()`
- [ ] Implement `applySwapResolution()`
- [ ] Implement `rejectSwapResolution()`

**Acceptance Criteria:**

- Actions update state correctly
- API calls work
- Error handling in place

#### Task 3.3: Extend Undo/Redo

**File:** `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Subtasks:**

- [ ] Modify `undo()` to handle cascade swaps
- [ ] Modify `redo()` to handle cascade swaps
- [ ] Update history stack management
- [ ] Add compound action support

**Acceptance Criteria:**

- Undo reverts all moves in cascade
- Redo reapplies all moves
- History limit enforced

#### Task 3.4: Add Persistence Logic

**File:** `packages/web/src/features/schedule/stores/scheduleStore.ts`

**Subtasks:**

- [ ] Implement auto-save to localStorage
- [ ] Implement explicit save to database
- [ ] Add unsaved changes tracking
- [ ] Add save confirmation

**Acceptance Criteria:**

- Auto-save works every 30s
- Explicit save persists to DB
- Unsaved indicator accurate

#### Task 3.5: Unit Testing

**File:**
`packages/web/src/features/schedule/__tests__/scheduleStore.swap.test.ts`

**Subtasks:**

- [ ] Test swap mode toggle
- [ ] Test swap resolution application
- [ ] Test undo/redo with cascades
- [ ] Test persistence logic

**Acceptance Criteria:**

- All tests pass
- State transitions correct
- Edge cases covered

---

### Phase 4: UI Components (3-4 days)

**Goal:** Create all swap-related UI components

#### Task 4.1: SwapModeToggle

**File:**
`packages/web/src/features/schedule/components/swap/SwapModeToggle.tsx`

**Subtasks:**

- [ ] Create component structure
- [ ] Connect to store
- [ ] Add button styling
- [ ] Add unsaved changes badge
- [ ] Add keyboard shortcut hint

**Acceptance Criteria:**

- Toggles swap mode
- Shows current state
- Displays unsaved count

#### Task 4.2: SwapConfirmationDialog

**File:**
`packages/web/src/features/schedule/components/swap/SwapConfirmationDialog.tsx`

**Subtasks:**

- [ ] Create dialog structure
- [ ] Add summary cards
- [ ] Add moves list
- [ ] Add scrollable content
- [ ] Add accept/reject buttons
- [ ] Style with Farsi text

**Acceptance Criteria:**

- Shows all move details
- Scrollable for long lists
- Buttons work correctly
- RTL layout correct

#### Task 4.3: MoveCard

**File:** `packages/web/src/features/schedule/components/swap/MoveCard.tsx`

**Subtasks:**

- [ ] Create card structure
- [ ] Display lesson details
- [ ] Show before/after positions
- [ ] Add visual arrow
- [ ] Add affected entities

**Acceptance Criteria:**

- Displays all information
- Visual hierarchy clear
- Responsive layout

#### Task 4.4: SwapLoadingOverlay

**File:**
`packages/web/src/features/schedule/components/swap/SwapLoadingOverlay.tsx`

**Subtasks:**

- [ ] Create overlay structure
- [ ] Add spinner animation
- [ ] Add progress message
- [ ] Add timeout warning

**Acceptance Criteria:**

- Shows during solver call
- Blocks interaction
- Timeout warning appears

#### Task 4.5: SwapFailedDialog

**File:**
`packages/web/src/features/schedule/components/swap/SwapFailedDialog.tsx`

**Subtasks:**

- [ ] Create dialog structure
- [ ] Display error reason
- [ ] List conflicts
- [ ] Add suggestions (if available)
- [ ] Style with error theme

**Acceptance Criteria:**

- Shows failure reason
- Lists all conflicts
- Farsi text correct

#### Task 4.6: AffectedEntitiesSummary

**File:**
`packages/web/src/features/schedule/components/swap/AffectedEntitiesSummary.tsx`

**Subtasks:**

- [ ] Create summary structure
- [ ] Display class list
- [ ] Display teacher list
- [ ] Add expandable sections

**Acceptance Criteria:**

- Shows all affected entities
- Expandable for long lists
- Clear visual design

---

### Phase 5: Grid Layout Transpose (1-2 days)

**Goal:** Change grid from days-as-rows to days-as-columns

#### Task 5.1: Update Grid Template

**File:** `packages/web/src/features/schedule/components/grid/ScheduleGrid.tsx`

**Subtasks:**

- [ ] Change CSS grid template
- [ ] Swap iteration order (periods outer, days inner)
- [ ] Update header rendering
- [ ] Update cell rendering

**Acceptance Criteria:**

- Days are columns
- Periods are rows
- All cells render correctly

#### Task 5.2: Update Keyboard Navigation

**File:** `packages/web/src/features/schedule/hooks/useKeyboardNavigation.ts`

**Subtasks:**

- [ ] Update arrow key mappings
- [ ] Update navigation logic
- [ ] Test all directions

**Acceptance Criteria:**

- Arrow keys work correctly
- Navigation wraps properly
- Focus indicator correct

#### Task 5.3: Update Styling

**File:** `packages/web/src/features/schedule/components/grid/ScheduleGrid.tsx`

**Subtasks:**

- [ ] Update sticky headers
- [ ] Update cell sizing
- [ ] Update responsive behavior

**Acceptance Criteria:**

- Headers stick correctly
- Cells size properly
- Scrolling works smoothly

---

### Phase 6: Integration & Testing (2-3 days)

**Goal:** Connect all pieces and test end-to-end

#### Task 6.1: Wire Up Swap Flow

**File:**
`packages/web/src/features/schedule/components/views/ClassScheduleView.tsx`

**Subtasks:**

- [ ] Add SwapModeToggle to header
- [ ] Connect drag-drop to swap API
- [ ] Show loading overlay during resolution
- [ ] Show confirmation dialog on success
- [ ] Show failure dialog on error

**Acceptance Criteria:**

- Full flow works end-to-end
- All dialogs appear correctly
- Error handling works

#### Task 6.2: Add API Hook

**File:** `packages/web/src/features/schedule/hooks/useSwapResolution.ts`

**Subtasks:**

- [ ] Create `useSwapResolution` hook
- [ ] Use TanStack Query for API call
- [ ] Handle loading state
- [ ] Handle error state
- [ ] Add retry logic

**Acceptance Criteria:**

- Hook calls API correctly
- Loading state managed
- Errors handled gracefully

#### Task 6.3: Integration Testing

**File:**
`packages/web/src/features/schedule/__tests__/swap-integration.test.tsx`

**Subtasks:**

- [ ] Test full swap flow
- [ ] Test undo/redo
- [ ] Test save/load
- [ ] Test error scenarios

**Acceptance Criteria:**

- All integration tests pass
- User flows work correctly
- Edge cases handled

#### Task 6.4: Performance Testing

**File:**
`packages/web/src/features/schedule/__tests__/swap-performance.test.ts`

**Subtasks:**

- [ ] Test with 10-class schedule
- [ ] Test with 30-class schedule
- [ ] Test with 50-class schedule
- [ ] Measure solver time
- [ ] Measure UI responsiveness

**Acceptance Criteria:**

- 50-class schedule resolves in <10s
- UI remains responsive
- Memory usage acceptable

---

### Phase 7: Polish & Documentation (1-2 days)

**Goal:** Final refinements and documentation

#### Task 7.1: UI/UX Refinements

**Subtasks:**

- [ ] Add loading animations
- [ ] Improve error messages
- [ ] Add tooltips
- [ ] Add keyboard shortcuts
- [ ] Improve accessibility

**Acceptance Criteria:**

- Smooth animations
- Clear error messages
- Keyboard accessible
- ARIA labels correct

#### Task 7.2: Documentation

**File:** `docs/SWAP_SYSTEM.md`

**Subtasks:**

- [ ] Document swap algorithm
- [ ] Document API endpoints
- [ ] Document component usage
- [ ] Add troubleshooting guide

**Acceptance Criteria:**

- Complete documentation
- Code examples included
- Troubleshooting guide helpful

#### Task 7.3: User Guide

**File:** `docs/USER_GUIDE_SWAP.md`

**Subtasks:**

- [ ] Write user guide in Farsi
- [ ] Add screenshots
- [ ] Add step-by-step instructions
- [ ] Add FAQ section

**Acceptance Criteria:**

- Clear instructions
- Screenshots helpful
- FAQ covers common issues

---

## Performance Considerations

### Solver Performance

**Expected Solve Times** (based on OR-Tools benchmarks):

- Small schedule (10 classes): 0.5-2 seconds
- Medium schedule (30 classes): 1-5 seconds
- Large schedule (50 classes): 2-10 seconds
- Very large (100 classes): 5-30 seconds

**Optimization Strategies:**

1. **Timeout**: 10 seconds maximum
2. **Early Termination**: Accept first feasible solution
3. **Warm Start**: Use current positions as hints
4. **Incremental**: Only re-solve affected subset

### Frontend Performance

**Caching Strategy:**

```typescript
const swapCache = new Map<string, SwapResolution>();

function getCacheKey(source: LessonIdentifier, target: SlotIdentifier): string {
  return `${source.classId}-${source.day}-${source.period}-${target.day}-${target.period}`;
}

// Cache resolution for 5 minutes
const cachedResolution = swapCache.get(cacheKey);
if (cachedResolution && Date.now() - cachedResolution.timestamp < 300000) {
  return cachedResolution;
}
```

**Memory Management:**

- Limit undo stack to 50 actions
- Clear cache on schedule change
- Use localStorage for backup only

### Database Performance

**Write Strategy:**

- No writes during swaps
- Batch write on explicit save
- Use transactions for atomicity

---

## Testing Strategy

### Unit Tests

**Solver Tests:**

- Simple 2-lesson swap
- Cascading swap (3+ lessons)
- Impossible swap scenarios
- Teacher conflict detection
- Room conflict detection
- Performance benchmarks

**Store Tests:**

- Swap mode toggle
- Resolution application
- Undo/redo with cascades
- Persistence logic
- History management

**Component Tests:**

- SwapModeToggle rendering
- Dialog interactions
- MoveCard display
- Loading states
- Error states

### Integration Tests

**End-to-End Flows:**

- Complete swap flow (drag → resolve → confirm → apply)
- Undo/redo flow
- Save/load flow
- Error recovery flow

**Performance Tests:**

- Large schedule handling (50+ classes)
- Solver timeout handling
- Memory usage monitoring
- UI responsiveness

### User Acceptance Testing

**Test Scenarios:**

1. Simple swap (2 lessons)
2. Cascading swap (5+ lessons)
3. Impossible swap (blocked)
4. Undo/redo multiple swaps
5. Save and reload schedule

---

## Appendix

### File Structure

```
packages/
├── solver/
│   ├── swap_resolver.py          # NEW: Swap resolution solver
│   ├── models/
│   │   └── swap_models.py        # NEW: Pydantic models for swap
│   └── utils/
│       └── conflict_analyzer.py  # NEW: Analyze why swap failed
│
├── api/
│   ├── src/
│   │   ├── routes/
│   │   │   └── swap.routes.ts    # NEW: /api/swap/resolve endpoint
│   │   ├── services/
│   │   │   └── SwapSolverService.ts  # NEW: Calls Python solver
│   │   └── schemas/
│   │       └── swap.schema.ts    # NEW: Zod schemas for swap
│
└── web/
    └── src/
        └── features/
            └── schedule/
                ├── components/
                │   ├── swap/              # NEW: Swap UI components
                │   │   ├── SwapModeToggle.tsx
                │   │   ├── SwapConfirmationDialog.tsx
                │   │   ├── SwapLoadingOverlay.tsx
                │   │   ├── SwapFailedDialog.tsx
                │   │   ├── MoveCard.tsx
                │   │   └── AffectedEntitiesSummary.tsx
                │   └── grid/
                │       └── ScheduleGrid.tsx   # MODIFY: Transpose layout
                ├── hooks/
                │   └── useSwapResolution.ts  # NEW: Hook for swap API
                ├── stores/
                │   └── scheduleStore.ts   # MODIFY: Add swap state
                └── types.ts               # MODIFY: Add swap types
```

### API Endpoints

#### POST /api/swap/resolve

**Request:**

```json
{
  "scheduleId": 123,
  "sourceLesson": {
    "classId": "7A",
    "day": "Monday",
    "period": 0
  },
  "targetSlot": {
    "day": "Saturday",
    "period": 5
  },
  "currentSchedule": [...]
}
```

**Response (Success):**

```json
{
  "success": true,
  "moves": [
    {
      "lesson": {...},
      "from": {"day": "Monday", "period": 0},
      "to": {"day": "Saturday", "period": 5},
      "reason": "primary"
    },
    {
      "lesson": {...},
      "from": {"day": "Saturday", "period": 5},
      "to": {"day": "Tuesday", "period": 2},
      "reason": "cascade"
    }
  ],
  "affectedClasses": ["7A", "8B"],
  "affectedTeachers": ["Shafiq", "Satar"],
  "summary": {
    "totalMoves": 2,
    "primaryMove": {...},
    "cascadingMoves": [...]
  }
}
```

**Response (Failure):**

```json
{
  "success": false,
  "reason": "No valid resolution found",
  "conflicts": [
    {
      "type": "teacher_conflict",
      "message": "Teacher Shafiq is already teaching Class 8B at this time",
      "messageFa": "معلم شفیق در این زمان صنف ۸ب را تدریس می‌کند",
      "involvedLessons": [...]
    }
  ]
}
```

### Keyboard Shortcuts

| Shortcut     | Action           |
| ------------ | ---------------- |
| `Ctrl+Z`     | Undo last swap   |
| `Ctrl+Y`     | Redo last swap   |
| `Ctrl+S`     | Save schedule    |
| `Esc`        | Cancel swap mode |
| `Arrow Keys` | Navigate grid    |

### Glossary

**Cascading Swap**: A swap operation that requires moving multiple lessons to
resolve conflicts

**Minimal Disruption**: Optimization objective to minimize the number of lessons
moved

**Compound Action**: A single undo/redo action that contains multiple lesson
moves

**Constraint Satisfaction**: Mathematical approach to finding valid solutions
that satisfy all constraints

**CP-SAT**: Constraint Programming - Satisfiability solver from Google OR-Tools

---

## Timeline Summary

| Phase                    | Duration | Dependencies |
| ------------------------ | -------- | ------------ |
| Phase 1: Python Solver   | 3-5 days | None         |
| Phase 2: API Integration | 2-3 days | Phase 1      |
| Phase 3: Frontend State  | 2-3 days | Phase 2      |
| Phase 4: UI Components   | 3-4 days | Phase 3      |
| Phase 5: Grid Transpose  | 1-2 days | Phase 4      |
| Phase 6: Integration     | 2-3 days | Phase 5      |
| Phase 7: Polish          | 1-2 days | Phase 6      |

**Total Estimated Time: 14-22 days**

---

## Success Criteria

✅ **Functional:**

- User can swap any lesson to any slot
- System resolves all conflicts automatically
- Shows detailed preview before applying
- Blocks impossible swaps with clear reasons
- Undo/redo works for all swaps
- Changes persist to database on save

✅ **Performance:**

- Swap resolution: <10 seconds for 50-class schedules
- UI responsiveness: <100ms for interactions
- Memory usage: <500MB for large schedules

✅ **Quality:**

- All unit tests pass
- All integration tests pass
- User acceptance tests pass
- Documentation complete
- Code reviewed and approved

---

**Document Version:** 1.0 **Last Updated:** January 2026 **Status:** Ready for
Implementation

---

## Constraint Data Requirements for Swap Solver

### Overview

The swap solver needs comprehensive constraint data to validate and resolve
swaps. This data comes from the database and must be included in the swap
request.

### Required Constraint Data

#### 1. Teacher Constraints

**Database Tables:**

- `teachers` table
- `teacher_availability` table (if exists)
- `teacher_preferences` table (if exists)

**Data Structure:**

```typescript
interface TeacherConstraintData {
  teacherId: string;
  teacherName: string;

  // Availability per day/period
  availability: {
    [day in DayOfWeek]: boolean[]; // Array of booleans for each period
  };

  // Preferences
  timePreference?: 'Morning' | 'Afternoon' | 'None';
  maxConsecutivePeriods?: number;
  maxPeriodsPerDay?: number;
  maxPeriodsPerWeek: number;

  // Subjects this teacher can teach
  qualifiedSubjects: string[];
  primarySubjects: string[];

  // Current assignments (from schedule)
  currentAssignments: {
    day: DayOfWeek;
    period: number;
    classId: string;
    subjectId: string;
  }[];
}
```

**Example from your data:**

```json
{
  "teacherId": "21",
  "teacherName": "احمد",
  "availability": {
    "Saturday": [true, true, true, true, true, true],
    "Sunday": [true, true, true, true, true, true],
    "Monday": [true, true, true, true, true, true],
    "Tuesday": [true, true, true, true, true, true],
    "Wednesday": [true, true, true, true, true, true],
    "Thursday": [true, true, true, true, true, true]
  },
  "maxPeriodsPerWeek": 35,
  "qualifiedSubjects": ["43", "57", "71"],
  "primarySubjects": ["43", "57", "71"]
}
```

#### 2. Class Constraints

**Database Tables:**

- `classes` table
- `class_requirements` table (if exists)

**Data Structure:**

```typescript
interface ClassConstraintData {
  classId: string;
  className: string;
  gradeLevel: number;

  // Schedule constraints
  requiredSubjects: {
    subjectId: string;
    periodsPerWeek: number;
    requiresLab?: boolean;
    preferredTimeOfDay?: 'Morning' | 'Afternoon';
  }[];

  // Single teacher mode
  singleTeacherMode: boolean;
  classTeacherId?: string;

  // Current assignments (from schedule)
  currentAssignments: {
    day: DayOfWeek;
    period: number;
    subjectId: string;
    teacherId: string;
    roomId: string;
  }[];
}
```

**Example from your data:**

```json
{
  "classId": "7",
  "className": "صنف-7-الف",
  "gradeLevel": 7,
  "singleTeacherMode": false,
  "requiredSubjects": [
    { "subjectId": "43", "periodsPerWeek": 6 },
    { "subjectId": "44", "periodsPerWeek": 6 },
    { "subjectId": "45", "periodsPerWeek": 6 }
  ]
}
```

#### 3. Room Constraints

**Database Tables:**

- `rooms` table
- `room_types` table (if exists)

**Data Structure:**

```typescript
interface RoomConstraintData {
  roomId: string;
  roomName: string;
  roomType: 'normal' | 'lab' | 'computer_lab' | 'science_lab' | 'gym';
  capacity: number;

  // Availability
  isAvailable: boolean;
  unavailableSlots?: {
    day: DayOfWeek;
    period: number;
  }[];

  // Current assignments (from schedule)
  currentAssignments: {
    day: DayOfWeek;
    period: number;
    classId: string;
    subjectId: string;
  }[];
}
```

**Example:**

```json
{
  "roomId": "11",
  "roomName": "اتاق-11",
  "roomType": "normal",
  "capacity": 35,
  "isAvailable": true
}
```

#### 4. Subject Constraints

**Database Tables:**

- `subjects` table
- `subject_requirements` table (if exists)

**Data Structure:**

```typescript
interface SubjectConstraintData {
  subjectId: string;
  subjectName: string;

  // Room requirements
  requiresLab: boolean;
  requiredRoomType?: 'lab' | 'computer_lab' | 'science_lab' | 'gym';

  // Difficulty (for afternoon constraint)
  isDifficult: boolean; // Math, Science, etc.

  // Qualified teachers
  qualifiedTeachers: string[];
}
```

**Example:**

```json
{
  "subjectId": "43",
  "subjectName": "ریاضی",
  "requiresLab": false,
  "isDifficult": true,
  "qualifiedTeachers": ["21"]
}
```

---

### Data Flow: Database → Swap Solver

#### Step 1: Frontend Prepares Swap Request

```typescript
// In SwapConfirmationDialog or useDragDrop hook
const prepareSwapRequest = async (
  sourceLesson: ScheduledLesson,
  targetSlot: { day: DayOfWeek; period: number }
): Promise<SwapRequest> => {
  // Get current schedule from store
  const currentSchedule = useScheduleStore.getState().lessons;

  // Fetch constraint data from API
  const constraintData = await api.getConstraintData(scheduleId);

  return {
    scheduleId,
    sourceLesson: {
      classId: sourceLesson.classId,
      day: sourceLesson.day,
      period: sourceLesson.periodIndex,
    },
    targetSlot,
    currentSchedule,
    constraintData, // NEW: Include all constraint data
  };
};
```

#### Step 2: API Endpoint Receives Request

```typescript
// packages/api/src/routes/swap.routes.ts
router.post('/swap/resolve', async (req, res) => {
  const {
    scheduleId,
    sourceLesson,
    targetSlot,
    currentSchedule,
    constraintData,
  } = req.body;

  // If constraint data not provided, fetch from database
  let constraints = constraintData;
  if (!constraints) {
    constraints = await ConstraintService.getConstraintData(scheduleId);
  }

  // Call Python solver with all data
  const resolution = await SwapSolverService.resolveSwap({
    currentSchedule,
    sourceLesson,
    targetSlot,
    constraints, // Pass to solver
  });

  res.json(resolution);
});
```

#### Step 3: API Fetches Constraint Data from Database

```typescript
// packages/api/src/services/ConstraintService.ts
export class ConstraintService {
  static async getConstraintData(scheduleId: number): Promise<ConstraintData> {
    // Fetch timetable to get associated IDs
    const timetable = await TimetableRepository.findById(scheduleId);
    const scheduleData = JSON.parse(timetable.data);

    // Extract unique IDs
    const teacherIds = new Set<string>();
    const classIds = new Set<string>();
    const subjectIds = new Set<string>();
    const roomIds = new Set<string>();

    for (const lesson of scheduleData.schedule) {
      classIds.add(lesson.classId);
      subjectIds.add(lesson.subjectId);
      lesson.teacherIds.forEach((id) => teacherIds.add(id));
      if (lesson.roomId) roomIds.add(lesson.roomId);
    }

    // Fetch constraint data from database
    const teachers = await TeacherRepository.findByIds(Array.from(teacherIds));
    const classes = await ClassRepository.findByIds(Array.from(classIds));
    const subjects = await SubjectRepository.findByIds(Array.from(subjectIds));
    const rooms = await RoomRepository.findByIds(Array.from(roomIds));

    // Transform to constraint data format
    return {
      teachers: teachers.map((t) =>
        transformTeacherToConstraint(t, scheduleData)
      ),
      classes: classes.map((c) => transformClassToConstraint(c, scheduleData)),
      subjects: subjects.map((s) => transformSubjectToConstraint(s)),
      rooms: rooms.map((r) => transformRoomToConstraint(r, scheduleData)),
      periodConfiguration: scheduleData.metadata.periodConfiguration,
    };
  }

  private static transformTeacherToConstraint(
    teacher: Teacher,
    scheduleData: any
  ): TeacherConstraintData {
    // Build availability map (default: all available)
    const availability: Record<DayOfWeek, boolean[]> = {};
    const days = scheduleData.metadata.periodConfiguration.daysOfWeek;
    const periodsPerDay =
      scheduleData.metadata.periodConfiguration.periodsPerDayMap;

    for (const day of days) {
      const periods = periodsPerDay[day];
      availability[day] = Array(periods).fill(true);
    }

    // If teacher has availability data in DB, override defaults
    if (teacher.availability) {
      // Parse JSON availability from database
      const dbAvailability = JSON.parse(teacher.availability);
      Object.assign(availability, dbAvailability);
    }

    // Extract current assignments from schedule
    const currentAssignments = scheduleData.schedule
      .filter((lesson) => lesson.teacherIds.includes(teacher.id))
      .map((lesson) => ({
        day: lesson.day,
        period: lesson.periodIndex,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
      }));

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      availability,
      timePreference: teacher.timePreference || 'None',
      maxConsecutivePeriods: teacher.maxConsecutivePeriods || 4,
      maxPeriodsPerDay: teacher.maxPeriodsPerDay || 7,
      maxPeriodsPerWeek: teacher.maxPeriodsPerWeek || 35,
      qualifiedSubjects: JSON.parse(teacher.subjects || '[]'),
      primarySubjects: JSON.parse(teacher.subjects || '[]'),
      currentAssignments,
    };
  }

  // Similar transformations for classes, subjects, rooms...
}
```

#### Step 4: Python Solver Uses Constraint Data

```python
# packages/solver/swap_resolver.py

from typing import Dict, List
from pydantic import BaseModel

class TeacherConstraint(BaseModel):
    teacher_id: str
    teacher_name: str
    availability: Dict[str, List[bool]]
    time_preference: str
    max_consecutive_periods: int
    max_periods_per_day: int
    max_periods_per_week: int
    qualified_subjects: List[str]
    current_assignments: List[Dict]

class ConstraintData(BaseModel):
    teachers: List[TeacherConstraint]
    classes: List[ClassConstraint]
    subjects: List[SubjectConstraint]
    rooms: List[RoomConstraint]
    period_configuration: Dict

class SwapRequest(BaseModel):
    current_schedule: List[ScheduledLesson]
    source_lesson: LessonIdentifier
    target_slot: SlotIdentifier
    constraints: ConstraintData  # NEW: Constraint data

def resolve_swap(request: SwapRequest) -> SwapResolution:
    """
    Resolve swap using constraint data
    """
    model = cp_model.CpModel()

    # Build constraint maps for fast lookup
    teacher_constraints = {t.teacher_id: t for t in request.constraints.teachers}
    subject_constraints = {s.subject_id: s for s in request.constraints.subjects}
    room_constraints = {r.room_id: r for r in request.constraints.rooms}

    # Create variables for each lesson's position
    lesson_vars = {}
    for lesson in request.current_schedule:
        day_var = model.NewIntVar(0, 5, f'day_{lesson.class_id}_{lesson.subject_id}')
        period_var = model.NewIntVar(0, 7, f'period_{lesson.class_id}_{lesson.subject_id}')
        lesson_vars[lesson.id] = (day_var, period_var)

    # Hard constraint: Source lesson MUST go to target slot
    source_id = get_lesson_id(request.source_lesson)
    source_day, source_period = lesson_vars[source_id]
    model.Add(source_day == day_to_int(request.target_slot.day))
    model.Add(source_period == request.target_slot.period)

    # Constraint: Teacher availability
    for lesson in request.current_schedule:
        teacher_id = lesson.teacher_ids[0]  # Assuming single teacher
        teacher = teacher_constraints.get(teacher_id)

        if teacher:
            day_var, period_var = lesson_vars[lesson.id]

            # For each day/period combination
            for day_idx, day_name in enumerate(request.constraints.period_configuration['daysOfWeek']):
                periods_this_day = request.constraints.period_configuration['periodsPerDayMap'][day_name]
                availability_this_day = teacher.availability.get(day_name, [])

                for period_idx in range(periods_this_day):
                    # If teacher not available at this slot, prevent assignment
                    if period_idx < len(availability_this_day) and not availability_this_day[period_idx]:
                        # Create boolean: is lesson at this slot?
                        b_at_slot = model.NewBoolVar(f'at_{lesson.id}_{day_idx}_{period_idx}')
                        model.Add(day_var == day_idx).OnlyEnforceIf(b_at_slot)
                        model.Add(period_var == period_idx).OnlyEnforceIf(b_at_slot)

                        # Prevent this assignment
                        model.Add(b_at_slot == 0)

    # Constraint: No teacher conflicts (teacher can't be in two places)
    for teacher_id in teacher_constraints:
        lessons_by_teacher = [l for l in request.current_schedule if teacher_id in l.teacher_ids]

        for i, lesson1 in enumerate(lessons_by_teacher):
            for lesson2 in lessons_by_teacher[i+1:]:
                day1, period1 = lesson_vars[lesson1.id]
                day2, period2 = lesson_vars[lesson2.id]

                # Prevent same day AND same period
                b_same_day = model.NewBoolVar(f'same_day_{lesson1.id}_{lesson2.id}')
                model.Add(day1 == day2).OnlyEnforceIf(b_same_day)
                model.Add(day1 != day2).OnlyEnforceIf(b_same_day.Not())

                b_same_period = model.NewBoolVar(f'same_period_{lesson1.id}_{lesson2.id}')
                model.Add(period1 == period2).OnlyEnforceIf(b_same_period)
                model.Add(period1 != period2).OnlyEnforceIf(b_same_period.Not())

                # At least one must be false
                model.AddBoolOr([b_same_day.Not(), b_same_period.Not()])

    # Constraint: Room conflicts (room can't host two classes)
    for room_id in room_constraints:
        lessons_in_room = [l for l in request.current_schedule if l.room_id == room_id]

        # Similar logic to teacher conflicts
        for i, lesson1 in enumerate(lessons_in_room):
            for lesson2 in lessons_in_room[i+1:]:
                day1, period1 = lesson_vars[lesson1.id]
                day2, period2 = lesson_vars[lesson2.id]

                b_same_day = model.NewBoolVar(f'room_same_day_{lesson1.id}_{lesson2.id}')
                model.Add(day1 == day2).OnlyEnforceIf(b_same_day)

                b_same_period = model.NewBoolVar(f'room_same_period_{lesson1.id}_{lesson2.id}')
                model.Add(period1 == period2).OnlyEnforceIf(b_same_period)

                model.AddBoolOr([b_same_day.Not(), b_same_period.Not()])

    # Constraint: Subject-room type matching
    for lesson in request.current_schedule:
        subject = subject_constraints.get(lesson.subject_id)
        room = room_constraints.get(lesson.room_id)

        if subject and room and subject.requires_lab:
            # If subject requires lab, room must be a lab
            if room.room_type not in ['lab', 'computer_lab', 'science_lab']:
                # This lesson cannot stay in this room
                # Must be moved to a different room (handled by room reassignment logic)
                pass

    # Soft constraint: Teacher time preferences
    preference_violations = []
    for lesson in request.current_schedule:
        teacher_id = lesson.teacher_ids[0]
        teacher = teacher_constraints.get(teacher_id)

        if teacher and teacher.time_preference != 'None':
            day_var, period_var = lesson_vars[lesson.id]

            # Define morning/afternoon threshold (e.g., period 3)
            morning_threshold = 3

            if teacher.time_preference == 'Morning':
                # Prefer period < 3
                violation = model.NewBoolVar(f'pref_violation_{lesson.id}')
                model.Add(period_var >= morning_threshold).OnlyEnforceIf(violation)
                model.Add(period_var < morning_threshold).OnlyEnforceIf(violation.Not())
                preference_violations.append(violation)

            elif teacher.time_preference == 'Afternoon':
                # Prefer period >= 3
                violation = model.NewBoolVar(f'pref_violation_{lesson.id}')
                model.Add(period_var < morning_threshold).OnlyEnforceIf(violation)
                model.Add(period_var >= morning_threshold).OnlyEnforceIf(violation.Not())
                preference_violations.append(violation)

    # Objective: Minimize moves + preference violations
    move_indicators = []
    for lesson in request.current_schedule:
        day_var, period_var = lesson_vars[lesson.id]

        moved = model.NewBoolVar(f'moved_{lesson.id}')

        day_changed = model.NewBoolVar(f'day_changed_{lesson.id}')
        model.Add(day_var != day_to_int(lesson.day)).OnlyEnforceIf(day_changed)

        period_changed = model.NewBoolVar(f'period_changed_{lesson.id}')
        model.Add(period_var != lesson.period_index).OnlyEnforceIf(period_changed)

        model.AddBoolOr([day_changed, period_changed]).OnlyEnforceIf(moved)
        move_indicators.append(moved)

    # Weighted objective: moves are more important than preferences
    model.Minimize(
        10 * sum(move_indicators) +  # Weight: 10 per move
        1 * sum(preference_violations)  # Weight: 1 per preference violation
    )

    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0

    status = solver.Solve(model)

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        # Extract solution
        moves = extract_moves(request.current_schedule, lesson_vars, solver)
        return SwapResolution(
            success=True,
            moves=moves,
            affected_classes=get_affected_classes(moves),
            affected_teachers=get_affected_teachers(moves),
            summary=build_summary(moves)
        )
    else:
        # No solution - analyze conflicts
        conflicts = analyze_conflicts(request, model, solver)
        return SwapResolution(
            success=False,
            reason='No valid resolution found',
            conflicts=conflicts
        )
```

---

### API Endpoint for Constraint Data

#### New Endpoint: GET /api/schedules/:id/constraints

```typescript
// packages/api/src/routes/schedule.routes.ts
router.get('/schedules/:id/constraints', async (req, res) => {
  const scheduleId = parseInt(req.params.id);

  try {
    const constraints = await ConstraintService.getConstraintData(scheduleId);
    res.json(constraints);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch constraint data',
      message: error.message,
    });
  }
});
```

---

### Frontend Integration

#### Fetch Constraints on Schedule Load

```typescript
// packages/web/src/features/schedule/hooks/useScheduleConstraints.ts
export function useScheduleConstraints(scheduleId: number | null) {
  return useQuery({
    queryKey: ['schedule-constraints', scheduleId],
    queryFn: () => api.getScheduleConstraints(scheduleId!),
    enabled: scheduleId !== null,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// In ClassScheduleView.tsx
const { data: constraints } = useScheduleConstraints(scheduleId);

// Pass to swap request
const handleSwap = async (source, target) => {
  const resolution = await api.resolveSwap({
    scheduleId,
    sourceLesson: source,
    targetSlot: target,
    currentSchedule: lessons,
    constraintData: constraints, // Include constraints
  });
};
```

---

### Database Schema Requirements

To support all constraints, ensure these tables/columns exist:

#### Teachers Table

```sql
ALTER TABLE teachers ADD COLUMN availability TEXT; -- JSON: {day: [bool]}
ALTER TABLE teachers ADD COLUMN time_preference VARCHAR(20); -- 'Morning'|'Afternoon'|'None'
ALTER TABLE teachers ADD COLUMN max_consecutive_periods INT DEFAULT 4;
ALTER TABLE teachers ADD COLUMN max_periods_per_day INT DEFAULT 7;
```

#### Subjects Table

```sql
ALTER TABLE subjects ADD COLUMN requires_lab BOOLEAN DEFAULT FALSE;
ALTER TABLE subjects ADD COLUMN required_room_type VARCHAR(50); -- 'lab'|'computer_lab'|etc
ALTER TABLE subjects ADD COLUMN is_difficult BOOLEAN DEFAULT FALSE;
```

#### Rooms Table

```sql
ALTER TABLE rooms ADD COLUMN room_type VARCHAR(50) DEFAULT 'normal';
ALTER TABLE rooms ADD COLUMN capacity INT DEFAULT 30;
ALTER TABLE rooms ADD COLUMN is_available BOOLEAN DEFAULT TRUE;
```

---

### Summary: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  1. User initiates swap                                          │
│  2. Fetch constraint data (cached)                               │
│  3. Prepare swap request with constraints                        │
│  4. Send to API                                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/swap/resolve
                             │ {schedule, source, target, constraints}
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                         API                                      │
│  1. Receive request                                              │
│  2. If constraints missing, fetch from DB                        │
│  3. Transform to solver format                                   │
│  4. Call Python solver                                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdin: JSON
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    PYTHON SOLVER                                 │
│  1. Parse constraint data                                        │
│  2. Build CP-SAT model with constraints:                         │
│     - Teacher availability                                       │
│     - Teacher conflicts                                          │
│     - Room conflicts                                             │
│     - Subject-room matching                                      │
│     - Time preferences (soft)                                    │
│  3. Solve with minimal disruption objective                      │
│  4. Return moves or conflicts                                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ stdout: JSON
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                         API                                      │
│  Return resolution to frontend                                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  Show confirmation dialog with all changes                       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Implementation Checklist Update

Add to **Phase 1: Python Solver Enhancement**:

#### Task 1.7: Constraint Data Integration

**File:** `packages/solver/swap_resolver.py`

**Subtasks:**

- [ ] Create `ConstraintData` Pydantic model
- [ ] Create `TeacherConstraint` model
- [ ] Create `ClassConstraint` model
- [ ] Create `SubjectConstraint` model
- [ ] Create `RoomConstraint` model
- [ ] Update `SwapRequest` to include `constraints`
- [ ] Implement teacher availability constraints
- [ ] Implement teacher conflict constraints
- [ ] Implement room conflict constraints
- [ ] Implement subject-room matching constraints
- [ ] Implement time preference constraints (soft)
- [ ] Test with real constraint data

**Acceptance Criteria:**

- All constraint types enforced
- Solver respects teacher availability
- No teacher/room conflicts in solution
- Preferences considered in optimization

Add to **Phase 2: API Integration**:

#### Task 2.5: Constraint Data Service

**File:** `packages/api/src/services/ConstraintService.ts`

**Subtasks:**

- [ ] Create `ConstraintService` class
- [ ] Implement `getConstraintData()` method
- [ ] Implement `transformTeacherToConstraint()`
- [ ] Implement `transformClassToConstraint()`
- [ ] Implement `transformSubjectToConstraint()`
- [ ] Implement `transformRoomToConstraint()`
- [ ] Add caching for constraint data
- [ ] Create `/api/schedules/:id/constraints` endpoint

**Acceptance Criteria:**

- Fetches all constraint data from database
- Transforms to solver format correctly
- Caches for performance
- Endpoint returns complete constraint data

---

**Document Updated:** January 2026 **Version:** 1.1 - Added Constraint Data
Requirements
