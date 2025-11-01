<!-- 7da3fb80-691b-411e-8610-8ea6247a74be 2b398033-c624-4c16-8844-814b1cade2a5 -->
# Fix Subjects Step: Add/Edit/Delete/Save-All with Backend Integration

We will fix the subjects step so edit/delete/save-all work reliably, add the ability to create new subjects, and ensure all changes persist to the backend. We will also prevent API flooding by saving only dirty items, with optional per-grade saves.

## Frontend Changes

- Repair missing state for dialogs in `subjects-step.tsx` and wire edit/delete actions
- Add an Add Subject dialog to create a subject for a chosen grade
- Normalize subject IDs and remove brittle `startsWith` checks
- Update save logic to persist only dirty rows; add per-grade Save
- Show accurate button states and counts; keep optimistic UI with error rollback

## Backend Changes

- Verify/create Subject CRUD in API service and server routing
- Ensure database service serializes/updates subject fields used by the UI (name, code, periodsPerWeek, requiredRoomType, isDifficult, grade)

## Files

- `packages/web/src/components/wizard/steps/subjects-step.tsx`
- `packages/web/src/components/wizard/steps/subjects/SubjectEditDialog.tsx`
- `packages/web/src/components/wizard/steps/subjects/SubjectDeleteConfirm.tsx`
- `packages/web/src/components/wizard/steps/subjects/SubjectAddDialog.tsx` (new)
- `packages/web/src/lib/dataService.ts` (Subject CRUD)
- `packages/api/src/server.ts` (Subject routes)
- `packages/api/src/database/databaseService.ts` (Subject CRUD)

## Acceptance

- Edit/Delete open dialogs and persist; no `setEditingSubject`/`setDeletingSubject` reference errors
- Can add a new subject for a grade; shows immediately and saves to DB
- Save All/Save Grade persist only changed/new items; no flooding
- No `startsWith` errors; IDs handled safely

### To-dos

- [ ] Add SchoolConfig entity and CRUD endpoints
- [ ] Add section field to Subject; indexes and filters
- [ ] Add section, grade, sectionIndex, displayName to ClassGroup
- [ ] Add destructive reset endpoint/CLI with confirmation
- [ ] Create School Setup wizard step and persist config
- [ ] Filter Subjects step to enabled sections/grades; Save All
- [ ] Implement section-aware Quick Setup and validation
- [ ] Filter teacher subject expertise to enabled sections
- [ ] Update auto-assign to use grade→section mapping
- [ ] Add global checks blocking generation until valid