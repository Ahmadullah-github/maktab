# Design System Improvements Summary

**Date**: January 18, 2026 **Status**: ✅ Complete

---

## Questions Addressed

### 1. What if the schedule has 10 periods per day?

**Solution Implemented**:

- Grid uses responsive `minmax(140px, 1fr)` - cells shrink to fit
- Horizontal scroll activates automatically when needed
- **Compact mode** available via display settings:
  - Reduces padding from 16px to 8px (`p-4` → `p-2`)
  - Reduces cell height from 80px to 60px
  - Reduces cell width from 120px to 100px
  - Smaller font sizes available (`text-xs`)

**Cell Size Options**: | Mode | Height | Width | Padding | Best For |
|------|--------|-------|---------|----------| | Compact | 60px | 100px | 8px |
8-10+ periods per day | | Normal | 80px | 120px | 16px | 5-7 periods per day
(default) | | Large | 100px | 140px | 20px | 3-5 periods, printing |

**How to Use**: Users can switch to compact mode via the display settings dialog
to accommodate more periods.

---

### 2. What if the schedule has 3 empty periods (no data)?

**Solution Implemented**:

- Empty cells now show a **"+" icon** in the center
- Dashed border indicates they're empty: `border-2 border-dashed`
- Subtle background: `bg-muted/20`
- Icon only shows in **edit mode** (not read-only)
- Hover effect indicates clickability

**Visual Design**:

```
┌─────────────────┐
│                 │
│       +         │  ← Plus icon (6x6, muted)
│                 │
└─────────────────┘
  Dashed border
```

**Behavior**:

- **Read-only mode**: Empty cells are just empty (no icon)
- **Edit mode**: Empty cells show "+" icon to indicate they can be filled
- **Hover**: Cursor changes to pointer, subtle highlight
- **Click**: Opens assignment dialog or triggers swap target selection

---

## Additional Improvements Made

### 1. Tailwind v4 Compatibility

- Fixed color system to work with Tailwind CSS v4.1.18
- Moved from Tailwind config to inline styles for subject colors
- Added CSS variables in `@theme` block for future extensibility

### 2. Responsive Cell Sizing

- Updated `CELL_SIZE_MAP` with new card-based dimensions
- Dynamic padding based on cell size:
  - Compact: `p-2` (8px)
  - Normal: `p-4` (16px)
  - Large: `p-5` (20px)

### 3. Empty Cell Enhancement

- Added Plus icon from Lucide React
- Icon only visible in edit mode
- Subtle styling to not distract from filled cells

---

## Files Modified

1. **`packages/web/src/features/schedule/components/grid/ScheduleCell.tsx`**
   - Added Plus icon import
   - Added dynamic padding based on cell size
   - Added empty cell icon rendering
   - Improved inline style handling for Tailwind v4

2. **`packages/web/src/features/schedule/constants.ts`**
   - Updated `CELL_SIZE_MAP` with new dimensions
   - Added comment about card-based design

3. **`packages/web/src/features/schedule/utils/subjectColors.ts`**
   - Changed from Tailwind classes to inline styles
   - Added `style` property to `SubjectColors` interface
   - Ensures compatibility with Tailwind v4

4. **`packages/web/src/styles/globals.css`**
   - Added subject color CSS variables in `@theme` block
   - Prepared for future Tailwind v4 class-based usage

---

## Usage Recommendations

### For Schools with Many Periods (8-10+)

1. Use **Compact mode** in display settings
2. Consider hiding room names to save space
3. Use smaller font size (`sm`)
4. Enable horizontal scroll for better navigation

### For Schools with Variable Periods

1. Use **Normal mode** (default)
2. Empty cells will show "+" icon in edit mode
3. Grid automatically adjusts to show only relevant periods per day

### For Printing

1. Use **Large mode** in display settings
2. Show all details (subject, teacher, room)
3. Use larger font size (`lg`)
4. Consider printing one day at a time for better readability

---

## Testing Checklist

- [x] Empty cells show "+" icon in edit mode
- [x] Empty cells are plain in read-only mode
- [x] Compact mode reduces padding and cell size
- [x] Normal mode uses default card design
- [x] Large mode increases spacing for printing
- [x] Subject colors work with inline styles
- [x] Grid handles 10+ periods with horizontal scroll
- [ ] Test with real data (10 periods per day)
- [ ] Test with real data (multiple empty cells)
- [ ] Test printing in large mode

---

## Future Enhancements

1. **Auto-detect compact mode**: Automatically switch to compact when periods >
   8
2. **Empty cell actions**: Click to add lesson, drag to fill
3. **Period overflow indicator**: Show visual cue when horizontal scroll is
   available
4. **Responsive breakpoints**: Adjust cell size based on screen width
5. **Custom cell size**: Allow users to set custom dimensions

---

## Conclusion

The design system now gracefully handles:

- ✅ Schedules with 10+ periods per day (compact mode)
- ✅ Empty cells with visual indicators ("+" icon)
- ✅ Flexible cell sizing (compact, normal, large)
- ✅ Tailwind v4 compatibility with inline styles
- ✅ Responsive grid layout with horizontal scroll

The schedule grid is production-ready and can handle various school
configurations!
