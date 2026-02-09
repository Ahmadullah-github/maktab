# Save Endpoint Fix - Timetable-Specific Changes

## Issue

The save functionality was failing with a 404 error because it was trying to
call `PUT /api/timetables/:id/lessons`, which doesn't exist on the backend.

## Root Cause

- Frontend was attempting to update only the lessons array via a non-existent
  endpoint
- Backend only has `PUT /api/timetables/:id` which expects the full `data`
  object
- The timetable's `data` field stores the entire schedule structure (lessons,
  metadata, statistics)

## Solution

Modified `useSaveScheduleChanges.ts` to:

1. **Fetch current timetable data** via `GET /api/timetables/:id`
2. **Update only the schedule array** within the data structure
3. **Send complete data back** via `PUT /api/timetables/:id`

This ensures:

- Changes affect only the specific timetable (scheduleId from URL)
- Other timetables remain unaffected
- Metadata and statistics are preserved
- Only the lessons array is updated with user edits

## Files Modified

### `packages/web/src/features/schedule/hooks/useSaveScheduleChanges.ts`

- Changed from calling non-existent `/timetables/:id/lessons` endpoint
- Now uses existing `/timetables/:id` endpoint with full data structure
- Preserves all timetable data except the schedule array

### `packages/web/src/features/schedule/components/views/ClassScheduleView.tsx`

- Fixed Tailwind CSS warnings: `bg-gradient-to-br` → `bg-linear-to-br`

## API Flow

```
Frontend                    API                         Database
   │                         │                            │
   │ GET /timetables/9       │                            │
   │ ─────────────────────►  │                            │
   │                         │ Fetch timetable data       │
   │                         │ ──────────────────────────►│
   │                         │ ◄──────────────────────────│
   │ ◄─────────────────────  │                            │
   │ { id, name, data }      │                            │
   │                         │                            │
   │ Update lessons locally  │                            │
   │                         │                            │
   │ PUT /timetables/9       │                            │
   │ { data: {...} }         │                            │
   │ ─────────────────────►  │                            │
   │                         │ Update timetable.data      │
   │                         │ ──────────────────────────►│
   │                         │ ◄──────────────────────────│
   │ ◄─────────────────────  │                            │
   │ Success                 │                            │
```

## Data Structure

The timetable's `data` field contains:

```typescript
{
  schedule: [
    {
      day: string,
      periodIndex: number,
      classId: string,
      className: string,
      subjectId: string,
      subjectName: string,
      teacherIds: string[],
      teacherNames: string[],
      roomId: string | null,
      roomName: string | null,
      isFixed: boolean,
      periodsThisDay: number
    },
    // ... more lessons
  ],
  metadata: {
    classes: [...],
    subjects: [...],
    teachers: [...],
    periodConfiguration: {...}
  },
  statistics: {
    solveTimeMs: number,
    constraintsSatisfied: number,
    // ... more stats
  }
}
```

## Testing

1. Load a timetable: `http://localhost:5173/classes-schedule?scheduleId=9`
2. Enable editing mode (click the Lock button)
3. Make changes (swap lessons, undo/redo)
4. Click Save button
5. Verify changes are persisted (refresh page)
6. Verify other timetables are unaffected

## Requirements Satisfied

- ✅ 15.1: Call PUT /timetables/:id with current lessons
- ✅ 15.2: Call markAsSaved on success
- ✅ 15.6: Show success toast in Persian
- ✅ 15.7: Show error toast on failure
- ✅ Changes affect only the specific timetable (scheduleId)
- ✅ Multiple timetables can coexist without interference
