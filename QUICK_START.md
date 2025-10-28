# Quick Start Guide - Continuing Development

## Current Status: Phase 1 Complete ✅

### What's Done
- ✅ Enhanced wizard UI with animations and progress tracking
- ✅ Multilingual support (English/Dari) with RTL layout
- ✅ School Info Step with validation
- ✅ Periods Step with dynamic calculations and break periods
- ✅ Rooms Step with database integration
- ✅ Classes Step with statistics
- ✅ Subjects Step with real data (no mock data)
- ✅ Wizard step order optimized
- ✅ Language switcher in header

### Files to Know

#### Critical Files
1. `packages/web/src/pages/Wizard.tsx` - Main wizard orchestrator
2. `packages/web/src/components/wizard/wizard-container.tsx` - Wizard UI
3. `packages/web/src/hooks/useLanguage.ts` - Language management
4. `packages/web/src/components/wizard/steps/` - All step components

#### Key Stores (Zustand)
- `packages/web/src/stores/useWizardStore.ts` - Wizard state
- `packages/web/src/stores/useRoomStore.ts` - Rooms
- `packages/web/src/stores/useClassStore.ts` - Classes
- `packages/web/src/stores/useSubjectStore.ts` - Subjects
- `packages/web/src/stores/useTeacherStore.ts` - Teachers

#### Backend Services
- `packages/api/src/database/databaseService.ts` - Database operations
- `packages/api/src/entity/` - TypeORM entities
- `packages/api/schema.ts` - Zod validation schemas

### Next Steps (Priority Order)

#### 1. Teachers Step (HIGH PRIORITY)
**File**: `packages/web/src/components/wizard/steps/teachers-step.tsx`
**What to do**:
- Build table-based UI like other steps
- Add availability matrix (7x10 grid)
- Add subject selection (multi-select)
- Add time preferences (Morning/Afternoon/None)
- Add capacity limits (max periods per week/day)
- Use same patterns as Rooms/Classes steps

#### 2. Constraints Step (MEDIUM PRIORITY)
**File**: `packages/web/src/components/wizard/steps/constraints-step.tsx`
**What to do**:
- Create sliders for constraint weights (0-1.0)
- Hard constraints: checkboxes
- Soft constraints: sliders with labels
- Add description for each constraint
- Show validation status

#### 3. Review Step (HIGH PRIORITY)
**File**: `packages/web/src/components/wizard/steps/review-step.tsx`
**What to do**:
- Display data summary from all steps
- Show validation status
- List any conflicts or issues
- Add "Generate Timetable" button
- Show loading state during generation

### Development Commands

```bash
# Start everything
npm run dev

# Frontend only (packages/web)
cd packages/web && npm run dev

# Backend only (packages/api)
cd packages/api && npm run dev
```

### Important Patterns to Follow

#### Adding RTL Support
```tsx
import { useLanguage } from "@/hooks/useLanguage";

function MyComponent() {
  const { isRTL, t } = useLanguage();
  
  return (
    <div dir={isRTL ? "rtl" : "ltr"}>
      <Button className={cn("ml-2", isRTL && "ml-0 mr-2")}>
        {t.wizard.next}
      </Button>
    </div>
  );
}
```

#### Table-Based Step Pattern
```tsx
// 1. State with empty rows
const [items, setItems] = useState([]);
useEffect(() => {
  if (items.length === 0) {
    setItems(Array.from({ length: 3 }, (_, i) => ({
      id: `temp-${i}`,
      // default fields
    })));
  }
}, []);

// 2. Row-level handlers
const handleFieldChange = (id, field, value) => {
  setItems(items.map(item => 
    item.id === id ? { ...item, [field]: value } : item
  ));
};

// 3. Save handler
const handleSave = async (item) => {
  // Validation
  // Save to backend
  // Toast notification
};

// 4. Render table
<table>
  <tbody>
    {items.map(item => (
      <tr key={item.id}>
        {/* Editable cells */}
      </tr>
    ))}
  </tbody>
</table>
```

#### Using Zustand Store
```tsx
import { useRoomStore } from "@/stores/useRoomStore";

function MyComponent() {
  const { rooms, addRoom, updateRoom, deleteRoom } = useRoomStore();
  
  const handleSave = async (room) => {
    const saved = await addRoom(room);
    if (saved) toast.success("Saved!");
  };
}
```

### Testing Checklist

Before committing:
- [ ] Test in both English and Dari
- [ ] Verify RTL layout works
- [ ] Check responsive design (mobile/tablet)
- [ ] Test form validation
- [ ] Check auto-save functionality
- [ ] Verify error handling
- [ ] Test with empty state
- [ ] Check console for errors

### Common Issues & Solutions

#### Issue: RTL not working
**Solution**: Add `dir={isRTL ? "rtl" : "ltr"}` to container elements

#### Issue: Mock data showing
**Solution**: Ensure all data comes from `dataService` methods

#### Issue: Validation errors persist
**Solution**: Call `setValidationErrors([])` in onUpdate handlers

#### Issue: Data not persisting
**Solution**: Check Zustand store save methods and API endpoints

### Quick Reference: Wizard Steps Order

1. School Info (`school-info`)
2. Periods (`periods`)
3. Rooms (`rooms`) ⚠️ Must be before Subjects
4. Classes (`classes`)
5. Subjects (`subjects`) - Uses room types from step 3
6. Teachers (`teachers`) - Needs subjects from step 5
7. Constraints (`constraints`)
8. Review (`review`)

### API Endpoints Reference

```typescript
// Rooms
GET    /api/rooms
POST   /api/rooms
PUT    /api/rooms/:id
DELETE /api/rooms/:id

// Subjects
GET    /api/subjects
POST   /api/subjects
PUT    /api/subjects/:id
DELETE /api/subjects/:id

// Classes
GET    /api/classes
POST   /api/classes
PUT    /api/classes/:id
DELETE /api/classes/:id

// Teachers
GET    /api/teachers
POST   /api/teachers
PUT    /api/teachers/:id
DELETE /api/teachers/:id

// Wizard
GET    /api/wizard/:id/steps/:stepKey
POST   /api/wizard/:id/steps/:stepKey
GET    /api/wizard/:id/steps

// Generation
POST   /api/generate
```

### Tips for New Developers

1. **Start with Wizard.tsx** - Understand the flow
2. **Look at existing steps** - Rooms/Classes are good templates
3. **Follow patterns** - Consistency is key
4. **Test often** - Check both languages
5. **Check console** - Many errors show there first
6. **Use DevTools** - React DevTools and Network tab

### Helpful Resources

- **Tailwind CSS**: https://tailwindcss.com/docs
- **Radix UI**: https://www.radix-ui.com/
- **Zustand**: https://github.com/pmndrs/zustand
- **Zod**: https://zod.dev/
- **TypeORM**: https://typeorm.io/

### Getting Help

1. Check existing similar components
2. Look at the database schema
3. Review validation schemas
4. Check store implementations
5. Review this document
6. Check PROJECT_SUMMARY.md

---

**Happy Coding!** 🚀
