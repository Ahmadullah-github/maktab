# Phase 4: Developer Tools - COMPLETE ✅

**Date:** January 19, 2026 **Status:** Performance monitoring and debug tools
implemented **Time:** Completed in single session

---

## 🎯 Objectives

Implement developer tools for monitoring performance and debugging schedule
state during development.

---

## ✅ Components Implemented (2/2)

### 1. Performance Monitoring Hook ✅

**File:** `packages/web/src/features/schedule/hooks/useSchedulePerformance.ts`

**Purpose:** Tracks and warns about slow operations in schedule rendering.

**Features:**

- Monitors enrichment, index building, and render times
- Configurable performance thresholds
- Automatic warnings when thresholds exceeded
- Only active in development mode by default
- Helper functions for measuring sync/async operations

**Usage:**

```typescript
import { useSchedulePerformance, measureTime } from '@/features/schedule/hooks';

function MyComponent() {
  const metricsRef = useSchedulePerformance(lessons.length);

  // Measure operation time
  measureTime(
    () => {
      enrichLessons(lessons);
    },
    (time) => {
      metricsRef.current.enrichmentTime = time;
    }
  );
}
```

**Default Thresholds:**

- Enrichment: 100ms
- Index Building: 50ms
- Rendering: 200ms

**Warning Output:**

```
⚠️ Slow enrichment detected
  time: 125.43ms
  lessonCount: 500
  threshold: 100ms
  recommendation: Consider optimizing enrichment logic or reducing lesson count
```

---

### 2. Debug Panel Component ✅

**File:**
`packages/web/src/features/schedule/components/debug/ScheduleDebugPanel.tsx`

**Purpose:** Visual debug panel for inspecting schedule state in real-time.

**Features:**

- Only renders in development mode
- Fixed position overlay (configurable)
- Collapsible for minimal interference
- Shows all key state metrics
- Real-time updates from store
- Color-coded status badges
- Can be hidden/shown dynamically

**State Sections:**

1. **Schedule Info** - ID, name, loading state
2. **Lessons Info** - Raw, enriched, original counts
3. **Metadata Info** - Classes, teachers, subjects, rooms counts
4. **Indexes Info** - All index sizes (regular + enriched)
5. **Interaction State** - Mode, locked, focused, selected
6. **Edit State** - Undo/redo stacks, last saved time
7. **Display Settings** - Cell size, font size, color mode
8. **Error State** - Current error (if any)

**Usage:**

```typescript
import { ScheduleDebugPanel } from '@/features/schedule/components/grid';

function MySchedulePage() {
  return (
    <>
      <ScheduleGrid {...props} />

      {/* Debug panel - only shows in development */}
      <ScheduleDebugPanel />
    </>
  );
}
```

**Props:**

```typescript
interface ScheduleDebugPanelProps {
  /** Whether to show the panel (default: true in development) */
  show?: boolean;

  /** Custom position (default: bottom-right) */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

  /** Whether panel starts collapsed */
  defaultCollapsed?: boolean;
}
```

---

## 📁 Files Created

### Created (4 files)

1. **packages/web/src/features/schedule/hooks/useSchedulePerformance.ts** (180
   lines)
   - Performance monitoring hook
   - Configurable thresholds
   - Helper functions for time measurement

2. **packages/web/src/features/schedule/components/debug/ScheduleDebugPanel.tsx**
   (320 lines)
   - Visual debug panel component
   - Real-time state inspection
   - Collapsible UI

3. **packages/web/src/features/schedule/components/debug/index.ts** (7 lines)
   - Debug components exports

4. **PHASE_4_COMPLETE.md** (this file)
   - Phase 4 documentation

### Modified (2 files)

1. **packages/web/src/features/schedule/hooks/index.ts**
   - Added `useSchedulePerformance` export
   - Added helper functions exports

2. **packages/web/src/features/schedule/components/grid/index.ts**
   - Added `ScheduleDebugPanel` export

---

## 🎨 Visual Design

### Debug Panel Layout

```
┌─────────────────────────────────────┐
│ 🐛 Schedule Debug        [Unsaved]  │ ← Header with status
│                          [▼] [×]    │ ← Collapse/Close buttons
├─────────────────────────────────────┤
│ SCHEDULE                            │
│ ID: 123                             │
│ Name: Morning Schedule              │
│ Loading: No                         │
├─────────────────────────────────────┤
│ LESSONS                             │
│ Raw: 150                            │
│ Enriched: 150                       │
│ Original: 150                       │
│ Enrichment: 100.0%                  │
├─────────────────────────────────────┤
│ METADATA                            │
│ Classes: 12                         │
│ Teachers: 25                        │
│ Subjects: 15                        │
│ Rooms: 20                           │
├─────────────────────────────────────┤
│ INDEXES                             │
│ By Slot: 90                         │
│ By Class: 12                        │
│ By Teacher: 25                      │
│ By Room: 20                         │
│ Enriched (Class): 150               │
│ Enriched (Slot): 90                 │
├─────────────────────────────────────┤
│ INTERACTION                         │
│ Mode: idle                          │
│ Locked: No                          │
│ Focused: Saturday-0                 │
│ Selected: None                      │
├─────────────────────────────────────┤
│ EDIT STATE                          │
│ Undo Stack: 3                       │
│ Redo Stack: 0                       │
│ Last Saved: 10:30:45 AM             │
├─────────────────────────────────────┤
│ DISPLAY                             │
│ Cell Size: normal                   │
│ Font Size: medium                   │
│ Color By: subject                   │
└─────────────────────────────────────┘
```

---

## 🔧 Integration Examples

### Example 1: Basic Usage

```typescript
// packages/web/src/routes/teachers-schedule.tsx

import { ScheduleDebugPanel } from '@/features/schedule/components/grid';
import { TeacherScheduleView } from '@/features/schedule/components/views';

function TeachersSchedulePage() {
  return (
    <div className="relative">
      <TeacherScheduleView />

      {/* Debug panel - automatically hidden in production */}
      <ScheduleDebugPanel />
    </div>
  );
}
```

### Example 2: Custom Position

```typescript
// Position at top-left instead of bottom-right
<ScheduleDebugPanel position="top-left" />
```

### Example 3: Start Collapsed

```typescript
// Start collapsed to minimize interference
<ScheduleDebugPanel defaultCollapsed={true} />
```

### Example 4: Conditional Display

```typescript
// Only show when debugging specific feature
const [showDebug, setShowDebug] = useState(false);

<ScheduleDebugPanel show={showDebug} />
```

### Example 5: Performance Monitoring

```typescript
import { useSchedulePerformance, measureTime } from '@/features/schedule/hooks';
import { useScheduleStore } from '@/features/schedule/stores/scheduleStore';

function ScheduleLoader() {
  const metricsRef = useSchedulePerformance(lessons.length);
  const loadSchedule = useScheduleStore((state) => state.loadSchedule);

  const handleLoad = async (scheduleId: number) => {
    // Measure load time
    measureTime(() => {
      loadSchedule(scheduleId, name, normalized);
    }, (time) => {
      metricsRef.current.enrichmentTime = time;
      console.log(`Schedule loaded in ${time.toFixed(2)}ms`);
    });
  };

  return <button onClick={() => handleLoad(123)}>Load Schedule</button>;
}
```

### Example 6: Custom Thresholds

```typescript
// Use stricter thresholds for performance-critical views
const metricsRef = useSchedulePerformance(
  lessons.length,
  true, // enabled
  {
    enrichment: 50, // 50ms instead of 100ms
    indexBuild: 25, // 25ms instead of 50ms
    render: 100, // 100ms instead of 200ms
  }
);
```

---

## 🧪 Testing

### Manual Testing Checklist

#### Debug Panel

- [x] Panel renders in development mode
- [x] Panel hidden in production mode
- [x] Collapse/expand functionality works
- [x] Close button hides panel
- [x] All state sections display correctly
- [x] Real-time updates when state changes
- [x] Position prop works (all 4 corners)
- [x] Badges show correct colors
- [x] Scrolling works for long content

#### Performance Hook

- [x] Warnings logged when thresholds exceeded
- [x] No warnings when under thresholds
- [x] Custom thresholds work
- [x] Disabled in production by default
- [x] Helper functions measure time correctly
- [x] Async measurement works

---

## 📊 Benefits

### For Developers

1. **Faster Debugging**
   - Instant visibility into schedule state
   - No need to add console.logs
   - Real-time updates as state changes

2. **Performance Insights**
   - Automatic warnings for slow operations
   - Clear recommendations for optimization
   - Helps identify bottlenecks quickly

3. **Better Understanding**
   - See exactly what's in the store
   - Understand data flow
   - Verify enrichment completeness

4. **Reduced Context Switching**
   - No need to open DevTools
   - No need to inspect Redux/Zustand
   - Everything visible in UI

### For QA/Testing

1. **Easier Bug Reports**
   - Screenshot includes state info
   - Can verify data integrity
   - Can see interaction mode

2. **Faster Reproduction**
   - See exact state when bug occurs
   - Verify undo/redo stack
   - Check if data is loaded

---

## 🎯 Use Cases

### Use Case 1: Performance Regression Detection

**Scenario:** After adding a new feature, schedule loading feels slower.

**Solution:**

```typescript
const metricsRef = useSchedulePerformance(lessons.length);

// Warnings will automatically log if thresholds exceeded
// ⚠️ Slow enrichment detected: 125ms (threshold: 100ms)
```

### Use Case 2: State Debugging

**Scenario:** Undo/redo not working as expected.

**Solution:** Open debug panel and check:

- Undo Stack size
- Redo Stack size
- Last saved time
- Current interaction mode

### Use Case 3: Data Integrity Verification

**Scenario:** Some lessons not showing in teacher view.

**Solution:** Check debug panel:

- Raw lessons count vs enriched count
- Enrichment percentage (should be 100%)
- Index sizes (should match lesson count)

### Use Case 4: Memory Leak Detection

**Scenario:** App getting slower over time.

**Solution:** Monitor debug panel over time:

- Check if undo stack growing unbounded
- Verify indexes not accumulating
- Watch memory usage in DevTools

---

## 🚀 Future Enhancements (Optional)

### Potential Additions

1. **Performance Graph**
   - Line chart showing render times over time
   - Identify performance trends
   - Export data for analysis

2. **State History**
   - Timeline of state changes
   - Ability to replay changes
   - Export state snapshots

3. **Network Monitor**
   - Track API calls
   - Show request/response times
   - Highlight failed requests

4. **Action Logger**
   - Log all store actions
   - Show action payloads
   - Filter by action type

5. **Memory Profiler**
   - Track memory usage
   - Identify memory leaks
   - Show object retention

---

## 📝 Best Practices

### When to Use Debug Panel

✅ **DO use when:**

- Developing new features
- Debugging state issues
- Verifying data integrity
- Testing performance
- Investigating bugs

❌ **DON'T use when:**

- In production builds (automatically disabled)
- Recording demos/screenshots for users
- Performance testing (adds overhead)

### When to Use Performance Hook

✅ **DO use when:**

- Optimizing performance
- Benchmarking changes
- Identifying bottlenecks
- Testing with large datasets

❌ **DON'T use when:**

- In production (disabled by default)
- Not actively optimizing
- Thresholds not relevant to your use case

---

## 🔒 Security & Privacy

### Production Safety

- Debug panel **never renders** in production
- Performance monitoring **disabled** in production
- No sensitive data logged to console
- No performance overhead in production builds

### Development Safety

- All data stays in browser
- No external logging services
- No data sent to servers
- Safe to use with real data

---

## 📚 Documentation

### API Reference

#### useSchedulePerformance

```typescript
function useSchedulePerformance(
  lessonCount: number,
  enabled?: boolean,
  thresholds?: PerformanceThresholds
): React.MutableRefObject<PerformanceMetrics>;
```

**Parameters:**

- `lessonCount` - Number of lessons being rendered
- `enabled` - Whether monitoring is enabled (default: development mode)
- `thresholds` - Custom performance thresholds (optional)

**Returns:** Ref to metrics object for updating

#### measureTime

```typescript
function measureTime(
  operation: () => void,
  callback: (time: number) => void
): void;
```

**Parameters:**

- `operation` - Function to measure
- `callback` - Called with elapsed time in ms

#### measureTimeAsync

```typescript
async function measureTimeAsync(
  operation: () => Promise<void>,
  callback: (time: number) => void
): Promise<void>;
```

**Parameters:**

- `operation` - Async function to measure
- `callback` - Called with elapsed time in ms

#### ScheduleDebugPanel

```typescript
function ScheduleDebugPanel(props: ScheduleDebugPanelProps): JSX.Element | null;
```

**Props:**

- `show` - Whether to show panel (default: true in dev)
- `position` - Panel position (default: 'bottom-right')
- `defaultCollapsed` - Start collapsed (default: false)

---

## ✅ Completion Checklist

- [x] Performance monitoring hook implemented
- [x] Debug panel component implemented
- [x] Helper functions for time measurement
- [x] TypeScript types defined
- [x] Exports added to index files
- [x] Documentation created
- [x] Usage examples provided
- [x] Best practices documented
- [x] No TypeScript errors
- [x] Production-safe (auto-disabled)

---

## 📊 Summary

Phase 4 successfully implemented developer tools for monitoring and debugging
schedule rendering:

- **Performance Hook** - Automatic warnings for slow operations
- **Debug Panel** - Visual inspection of schedule state
- **Helper Functions** - Easy time measurement utilities
- **Production Safe** - Automatically disabled in production
- **Zero Overhead** - No impact on production performance

These tools will significantly improve developer productivity and make debugging
schedule issues much faster and easier.

---

**Status:** ✅ COMPLETE **Next Steps:** Optional - Implement advanced features
(virtual scrolling, lazy loading, etc.)

🎉 All core schedule rendering improvements complete!
