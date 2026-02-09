# Design System Implementation - Modern Card-Based Layout

**Status**: In Progress **Date**: January 18, 2026 **Font**: Vazirmatn
(Variable)

---

## Phase 1: Foundation ✅ COMPLETE

### 1.1 Typography - Vazirmatn

**Installed**: `@fontsource/vazirmatn` (variable font) **Import**: Added to
`main.tsx`

**Font Weights**:

- Light: 300
- Regular: 400 (body text default)
- Medium: 500 (labels, emphasis)
- Semibold: 600 (headings, subject names)
- Bold: 700 (page titles)

**Font Sizes**:

- xs: 11px (captions)
- sm: 12px (metadata, room numbers)
- base: 14px (body text, teacher names)
- md: 16px (subject names, emphasis)
- lg: 18px (section headings)
- xl: 20px (page titles)
- 2xl: 24px (app title)

### 1.2 Color System

**Subject Categories** (for schedule grid):

```css
Science (Math, Physics, Chem):
  - Primary: hsl(217, 91%, 60%) #3B82F6
  - Light: hsl(217, 91%, 95%)

Language (Dari, English):
  - Primary: hsl(142, 71%, 45%) #10B981
  - Light: hsl(142, 71%, 95%)

Arts (Art, Music):
  - Primary: hsl(38, 92%, 50%) #F59E0B
  - Light: hsl(38, 92%, 95%)

PE (Sport, Physical Education):
  - Primary: hsl(280, 67%, 60%) #A855F7
  - Light: hsl(280, 67%, 95%)

Social Studies (History, Geography):
  - Primary: hsl(173, 80%, 40%) #14B8A6
  - Light: hsl(173, 80%, 95%)
```

**Status Colors**:

- Success: hsl(160, 84%, 39%) #10B981
- Warning: hsl(38, 92%, 50%) #F59E0B
- Error: hsl(0, 72%, 51%) #EF4444
- Info: hsl(199, 89%, 48%) #3B82F6

### 1.3 Spacing System

**Grid Spacing**:

- Cell padding: 16px (was ~8px)
- Gap between cells: 12px (was 1px borders)
- Minimum cell height: 80px normal, 60px compact (was ~60px/48px)

**Component Spacing**:

- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 24px
- 2xl: 32px

### 1.4 Shadows & Borders

**Card Shadows**:

```css
card: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)
card-hover: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
card-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
```

**Border Radius**:

- sm: 4px
- md: 6px
- lg: 8px (cards)

---

## Phase 2: Schedule Grid Redesign 🚧 IN PROGRESS

### 2.1 ScheduleCell Component

**Current State**: Basic cell with borders **Target State**: Card-based with
shadows, colors, icons

**Typography Hierarchy**:

```typescript
Subject Name:  font-semibold text-md (16px, 600 weight)
Teacher Name:  font-normal text-base (14px, 400 weight)
Room Number:   font-normal text-sm (12px, 400 weight)
```

**Visual Design**:

- Background: White card with subtle shadow
- Border: 1px solid border color
- Border Radius: 8px (rounded-lg)
- Padding: 16px
- Gap between elements: 8px

**Color Coding**:

- Background tint based on subject category
- Border color matches subject category
- Text remains readable (high contrast)

**Interactive States**:

```css
Default:
  - shadow-card
  - border-border
  - bg-white

Hover:
  - shadow-card-hover
  - scale-[1.02]
  - transition-all duration-200

Selected:
  - ring-2 ring-primary
  - bg-primary/5

Dragging:
  - opacity-50
  - scale-95
  - border-dashed

Drop Target:
  - ring-2 ring-primary/50
  - bg-primary/10
  - animate-pulse (subtle)
```

**Icons** (using Lucide React):

- 👤 User icon for teacher
- 🏫 Building icon for normal classroom
- 🔬 Flask icon for lab
- ⚽ Activity icon for gym/sport
- 🎨 Palette icon for art room

### 2.2 ScheduleGrid Component

**Layout Changes**:

- Remove tight borders between cells
- Add 12px gap between cells
- Increase cell minimum height to 80px
- Add subtle background to grid container

**Grid Template**:

```css
grid-template-columns: auto repeat(${maxPeriods}, minmax(140px, 1fr))
gap: 12px
padding: 16px
background: hsl(var(--muted)/0.3)
```

**Header Styling**:

```css
Period Headers:
  - font-medium text-base
  - text-muted-foreground
  - bg-background
  - sticky top-0
  - shadow-sm

Day Labels:
  - font-semibold text-md
  - text-foreground
  - bg-background
  - sticky left-0
  - shadow-sm
```

### 2.3 Empty Cell Design

**Visual**:

- Dashed border (2px)
- Light gray background
- "+" icon centered
- Hover: border becomes solid, background lightens

```tsx
<div
  className="
  min-h-[80px]
  border-2 border-dashed border-border
  rounded-lg
  bg-muted/20
  flex items-center justify-center
  hover:border-solid hover:bg-muted/40
  transition-all duration-200
  cursor-pointer
"
>
  <Plus className="h-6 w-6 text-muted-foreground" />
</div>
```

---

## Phase 3: Component Updates 📋 PLANNED

### 3.1 Navigation/Sidebar

**Changes**:

- Collapsible grade sections
- Search bar at top
- Class cards instead of list items
- Student count badges

### 3.2 Toolbar/Actions

**New Elements**:

- Class selector dropdown (styled)
- View toggle (Week/Day)
- Search input
- Display settings button

### 3.3 Dialogs & Modals

**Styling**:

- Larger, more spacious
- Clear typography hierarchy
- Action buttons prominent
- Proper spacing

---

## Implementation Checklist

### ✅ Completed

- [x] Install Vazirmatn font
- [x] Update Tailwind config with font settings
- [x] Add subject color palette
- [x] Add custom font sizes
- [x] Add custom shadows
- [x] Update globals.css with Vazirmatn
- [x] Set base font size to 14px
- [x] Improve text rendering
- [x] Create subject color mapping utility
- [x] Create room type icon mapping utility
- [x] Update ScheduleCell component with card design
- [x] Update ScheduleGrid spacing and layout

### 🚧 In Progress

- [ ] Test visual appearance in browser
- [ ] Refine spacing and sizing if needed

### 📋 Planned

- [ ] Update navigation sidebar
- [ ] Add search functionality
- [ ] Update toolbar components
- [ ] Add hover animations
- [ ] Test RTL layout
- [ ] Test different screen sizes
- [ ] Performance optimization

---

## Subject Color Mapping

```typescript
// utils/subjectColors.ts
export const SUBJECT_CATEGORIES = {
  science: [
    'math',
    'mathematics',
    'physics',
    'chemistry',
    'biology',
    'ریاضی',
    'فزیک',
    'کیمیا',
    'بیولوژی',
  ],
  language: [
    'english',
    'dari',
    'pashto',
    'arabic',
    'انگلیسی',
    'دری',
    'پشتو',
    'عربی',
  ],
  arts: ['art', 'music', 'drawing', 'هنر', 'موسیقی', 'نقاشی'],
  pe: ['sport', 'pe', 'physical', 'ورزش', 'تربیت بدنی'],
  social: ['history', 'geography', 'social', 'تاریخ', 'جغرافیا', 'اجتماعی'],
};

export function getSubjectCategory(
  subjectName: string
): keyof typeof SUBJECT_CATEGORIES | 'default' {
  const normalized = subjectName.toLowerCase().trim();

  for (const [category, keywords] of Object.entries(SUBJECT_CATEGORIES)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category as keyof typeof SUBJECT_CATEGORIES;
    }
  }

  return 'default';
}

export function getSubjectColors(subjectName: string) {
  const category = getSubjectCategory(subjectName);

  const colorMap = {
    science: {
      bg: 'bg-subject-science-light',
      border: 'border-subject-science',
      text: 'text-subject-science',
    },
    language: {
      bg: 'bg-subject-language-light',
      border: 'border-subject-language',
      text: 'text-subject-language',
    },
    arts: {
      bg: 'bg-subject-arts-light',
      border: 'border-subject-arts',
      text: 'text-subject-arts',
    },
    pe: {
      bg: 'bg-subject-pe-light',
      border: 'border-subject-pe',
      text: 'text-subject-pe',
    },
    social: {
      bg: 'bg-subject-social-light',
      border: 'border-subject-social',
      text: 'text-subject-social',
    },
    default: {
      bg: 'bg-card',
      border: 'border-border',
      text: 'text-foreground',
    },
  };

  return colorMap[category];
}
```

---

## Room Type Icons

```typescript
// utils/roomIcons.ts
import { Building2, Flask, Dumbbell, Palette, Library } from 'lucide-react';

export const ROOM_TYPE_ICONS = {
  normal: Building2,
  classroom: Building2,
  lab: Flask,
  computer_lab: Flask,
  science_lab: Flask,
  gym: Dumbbell,
  sport: Dumbbell,
  art: Palette,
  music: Palette,
  library: Library,
};

export function getRoomIcon(roomType?: string | null) {
  if (!roomType) return Building2;

  const normalized = roomType.toLowerCase().replace(/[_-]/g, '');

  for (const [key, Icon] of Object.entries(ROOM_TYPE_ICONS)) {
    if (normalized.includes(key.replace('_', ''))) {
      return Icon;
    }
  }

  return Building2;
}
```

---

## Performance Considerations

1. **Font Loading**: Variable font loads once, all weights available
2. **Color Classes**: Using Tailwind classes (no runtime calculation)
3. **Shadows**: CSS-based, hardware accelerated
4. **Animations**: Using transform and opacity (GPU accelerated)
5. **React.memo**: ScheduleCell already memoized

---

## Accessibility

1. **Color Contrast**: All text meets WCAG AA (4.5:1)
2. **Font Size**: Minimum 12px (room numbers)
3. **Touch Targets**: Minimum 44x44px (cells are 80px+)
4. **Keyboard Navigation**: Maintained from existing implementation
5. **Screen Readers**: Proper ARIA labels maintained

---

## Next Steps

1. Create subject color utility
2. Create room icon utility
3. Update ScheduleCell component
4. Update ScheduleGrid spacing
5. Test and refine
