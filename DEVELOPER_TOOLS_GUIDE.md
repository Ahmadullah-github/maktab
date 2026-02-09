# Developer Tools Guide

Quick reference for using Phase 4 developer tools in the schedule feature.

---

## 🐛 Debug Panel

### Quick Start

Add to any schedule page:

```typescript
import { ScheduleDebugPanel } from '@/features/schedule/components/grid';

function MySchedulePage() {
  return (
    <>
      <ScheduleGrid {...props} />
      <ScheduleDebugPanel />
    </>
  );
}
```

### Keyboard Shortcuts

- **Toggle Collapse:** Click the chevron icon
- **Close Panel:** Click the X icon
- **Reopen:** Refresh page (panel shows by default in dev)

### What to Check When...

#### Lessons Not Showing

1. Check **Lessons** section:
   - Raw count should match expected
   - Enriched count should equal raw count
   - Enrichment should be 100%

2. Check **Indexes** section:
   - By Slot should have entries
   - Enriched indexes should match lesson count

#### Undo/Redo Not Working

1. Check **Edit State** section:
   - Undo Stack should increase after edits
   - Redo Stack should increase after undo
   - Last Saved should update after save

#### Performance Issues

1. Check **Lessons** section:
   - High lesson count (>500) may be slow
   - Enrichment rate should be 100%

2. Use performance hook (see below)

#### Teacher View Issues

1. Check **Metadata** section:
   - Teachers count should match expected
   - Classes count should be correct

2. Check **Interaction** section:
   - Mode should be appropriate
   - Selected lesson should show when clicked

---

## ⚡ Performance Monitoring

### Quick Start

Add to component that loads schedules:

```typescript
import { useSchedulePerformance, measureTime } from '@/features/schedule/hooks';

function ScheduleLoader() {
  const metricsRef = useSchedulePerformance(lessons.length);

  const handleLoad = () => {
    measureTime(
      () => {
        // Your load logic
        loadSchedule(id, name, data);
      },
      (time) => {
        metricsRef.current.enrichmentTime = time;
      }
    );
  };
}
```

### Understanding Warnings

#### ⚠️ Slow enrichment detected

**Meaning:** Enriching lessons took longer than 100ms

**Solutions:**

- Reduce lesson count
- Check for expensive operations in enrichment
- Verify metadata maps are populated

#### ⚠️ Slow index building detected

**Meaning:** Building indexes took longer than 50ms

**Solutions:**

- Reduce lesson count
- Check index structure
- Verify no duplicate work

#### ⚠️ Slow rendering detected

**Meaning:** Rendering took longer than 200ms

**Solutions:**

- Use React.memo on components
- Reduce re-renders
- Check for expensive calculations in render
- Consider virtualization for large grids

### Custom Thresholds

For performance-critical views:

```typescript
const metricsRef = useSchedulePerformance(lessons.length, true, {
  enrichment: 50, // Stricter: 50ms
  indexBuild: 25, // Stricter: 25ms
  render: 100, // Stricter: 100ms
});
```

---

## 🎯 Common Debugging Scenarios

### Scenario 1: "Schedule loads but shows empty"

**Steps:**

1. Open Debug Panel
2. Check Lessons section:
   - If Raw = 0: Data not loaded from API
   - If Raw > 0, Enriched = 0: Enrichment failed
   - If Enriched > 0: Check view scope/filters

3. Check Indexes section:
   - If all 0: Index building failed
   - If some > 0: Partial indexing issue

**Solution:** Check console for errors, verify API response

---

### Scenario 2: "Performance degraded after changes"

**Steps:**

1. Add performance hook to component
2. Make the change
3. Check console for warnings
4. Compare times before/after

**Solution:** Optimize the slow operation identified

---

### Scenario 3: "Undo not working"

**Steps:**

1. Open Debug Panel
2. Make an edit
3. Check Edit State section:
   - Undo Stack should increase
   - If not: Action not being recorded

**Solution:** Verify action is dispatched to store

---

### Scenario 4: "Teacher view shows wrong data"

**Steps:**

1. Open Debug Panel
2. Check Metadata section:
   - Verify teacher count
3. Check Interaction section:
   - Verify viewScope = 'teacher'
   - Verify viewId matches teacher ID

**Solution:** Check view scope validation

---

## 💡 Pro Tips

### Tip 1: Screenshot with State

When reporting bugs, include debug panel in screenshot. It shows:

- Exact state when bug occurred
- Data counts for verification
- Interaction mode and selection

### Tip 2: Monitor During Development

Keep debug panel open while developing:

- Instant feedback on state changes
- Catch issues immediately
- Verify data integrity in real-time

### Tip 3: Performance Baseline

Before optimizing:

1. Add performance hook
2. Record baseline times
3. Make optimization
4. Compare new times
5. Verify improvement

### Tip 4: State Snapshots

When debugging complex issues:

1. Open debug panel
2. Take screenshot at each step
3. Compare state changes
4. Identify where it breaks

---

## 🚫 Common Mistakes

### Mistake 1: Leaving Debug Panel in Production

**Problem:** Panel visible to users

**Solution:** Panel auto-hides in production, but verify:

```typescript
// Don't do this:
<ScheduleDebugPanel show={true} />

// Do this (respects NODE_ENV):
<ScheduleDebugPanel />
```

### Mistake 2: Not Updating Metrics

**Problem:** Performance warnings not showing

**Solution:** Update metrics ref after operations:

```typescript
measureTime(
  () => {
    enrichLessons(lessons);
  },
  (time) => {
    metricsRef.current.enrichmentTime = time; // Don't forget this!
  }
);
```

### Mistake 3: Ignoring Warnings

**Problem:** Performance degrades over time

**Solution:** Address warnings immediately:

- Investigate root cause
- Optimize or refactor
- Re-test to verify fix

---

## 📞 Getting Help

### If Debug Panel Not Showing

1. Verify `NODE_ENV === 'development'`
2. Check browser console for errors
3. Verify component is imported correctly
4. Try explicit `show={true}` prop

### If Performance Warnings Not Showing

1. Verify hook is called
2. Check metrics ref is updated
3. Verify thresholds are exceeded
4. Check console for warnings

### If State Looks Wrong

1. Verify store is populated
2. Check API response in Network tab
3. Verify transformation logic
4. Check enrichment function

---

## 🎓 Learning Resources

### Understanding the Store

- Read: `packages/web/src/features/schedule/stores/scheduleStore.ts`
- Focus on: `enrichLessons()`, `buildEnrichedIndexes()`

### Understanding Enrichment

- Read: `PHASE_1_COMPLETE.md`
- Focus on: Type system and enrichment strategy

### Understanding Performance

- Read: `PHASE_3_COMPLETE.md`
- Focus on: Performance metrics and improvements

---

## ✅ Quick Checklist

Before reporting a bug:

- [ ] Debug panel shows expected data counts
- [ ] Enrichment is 100%
- [ ] Indexes are populated
- [ ] No console errors
- [ ] Screenshot includes debug panel

Before optimizing:

- [ ] Performance hook added
- [ ] Baseline times recorded
- [ ] Thresholds appropriate
- [ ] Warnings logged

Before committing:

- [ ] Debug panel removed from production code (or uses default props)
- [ ] Performance hooks only in dev-specific code
- [ ] No console.logs left behind
- [ ] TypeScript checks pass

---

**Quick Links:**

- [Phase 4 Complete Documentation](./PHASE_4_COMPLETE.md)
- [Implementation Complete](./IMPLEMENTATION_COMPLETE.md)
- [Phase 1-3 Documentation](./PHASE_1_COMPLETE.md)
