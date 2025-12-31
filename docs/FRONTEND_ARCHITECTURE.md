# Maktab Frontend Architecture

> System architecture document for the Maktab school timetable application frontend.

---

## Technology Stack

| Category | Choice | Version | Purpose |
|----------|--------|---------|---------|
| Framework | React + Vite | 19.2.3 / 7.3.0 | UI framework with fast dev server |
| Desktop Shell | electron-vite | 5.0.0 | Electron integration with Vite |
| Routing | TanStack Router | 1.141.6 | Type-safe file-based routing |
| Server State | TanStack Query | 5.90.12 | API data fetching, caching, sync |
| Client State | Zustand | 5.0.9 | Lightweight global state management |
| Forms | React Hook Form + Zod | 7.68.0 / 4.2.1 | Performant forms with schema validation |
| UI Components | shadcn/ui | latest | Customizable, accessible components |
| Styling | Tailwind CSS | 4.1.18 | Utility-first CSS (RTL-first approach) |
| Scheduling Grid | @dnd-kit/core + sortable | 6.3.1 / 10.0.0 | Drag-and-drop timetable editing |
| Validation | Zod | 4.2.1 | Runtime schema validation |
| Internationalization | react-i18next | 16.5.0 | Multi-language support |

### Dependencies

```bash
# Production
npm install react@19.2.3 react-dom@19.2.3 @tanstack/react-router@1.141.6 @tanstack/react-query@5.90.12 zustand@5.0.9 react-hook-form@7.68.0 zod@4.2.1 @hookform/resolvers@5.2.2 tailwindcss@4.1.18 postcss@8.5.6 autoprefixer@10.4.23 @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0 @dnd-kit/utilities@3.2.2 react-i18next@16.5.0 i18next@25.7.3 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.4.0 lucide-react@0.561.0 @radix-ui/react-slot@1.2.4

# Development
npm install -D @vitejs/plugin-react@5.1.2 vite@7.3.0 electron-vite@5.0.0 typescript@5.9.3 @types/react@19.2.7 @types/react-dom@19.2.3 @tanstack/router-devtools@1.141.6 @tanstack/react-query-devtools@5.91.1 tailwindcss-rtl@0.9.0
```

---

## Design Principles

### RTL-First Development

The application is designed RTL-first for Persian/Dari as the primary language.

**HTML Root Configuration:**
```html
<html lang="fa" dir="rtl">
```

**Tailwind Logical Properties (v4+):**
| Use This | Instead Of | Behavior |
|----------|------------|----------|
| `ms-4` | `ml-4` | margin-start (right in RTL) |
| `me-4` | `mr-4` | margin-end (left in RTL) |
| `ps-4` | `pl-4` | padding-start |
| `pe-4` | `pr-4` | padding-end |
| `start-0` | `left-0` | inset-inline-start |
| `end-0` | `right-0` | inset-inline-end |
| `text-start` | `text-left` | text-align: start |

**Additional RTL Plugin:** `tailwindcss-rtl` for explicit `rtl:` and `ltr:` variants when needed.

---

## Typography

### Font Stack

| Font | Usage | Script |
|------|-------|--------|
| **Vazirmatn** | Primary UI text | Persian/Arabic |
| **Inter** | Latin text, English UI | Latin |
| **JetBrains Mono** | Code, data tables, monospace | All |

### Font Loading Strategy

Self-hosted fonts for offline Electron support:
```
packages/web/
├── public/
│   └── fonts/
│       ├── vazirmatn/
│       │   ├── Vazirmatn-Regular.woff2
│       │   ├── Vazirmatn-Medium.woff2
│       │   └── Vazirmatn-Bold.woff2
│       ├── inter/
│       │   └── Inter-Variable.woff2
│       └── jetbrains-mono/
│           └── JetBrainsMono-Variable.woff2
```

---

## Numeral System

Context-aware numeral display:

| Context | Numeral System | Example |
|---------|----------------|---------|
| Persian/Dari UI | Eastern Arabic | ۰۱۲۳۴۵۶۷۸۹ |
| English UI | Western | 0123456789 |
| Data tables | Contextual (user preference) | Configurable |
| Code/Technical | Western | Always 0-9 |

---

## Calendar System

### Supported Calendars

| Calendar | Name | Primary Use |
|----------|------|-------------|
| **Jalali (Shamsi)** | Afghan Solar | Default for Afghan users |
| **Qamari (Hijri)** | Islamic Lunar | Religious dates |
| **Gregorian** | Western | International compatibility |

### Afghan Jalali Month Names

| # | Persian | Romanized |
|---|---------|-----------|
| 1 | حمل | Hamal |
| 2 | ثور | Sawr |
| 3 | جوزا | Jawza |
| 4 | سرطان | Saratan |
| 5 | اسد | Asad |
| 6 | سنبله | Sonbola |
| 7 | میزان | Mizan |
| 8 | عقرب | Aqrab |
| 9 | قوس | Qaws |
| 10 | جدی | Jadi |
| 11 | دلو | Dalw |
| 12 | حوت | Hoot |

### Date Formats

| Format | Example (Jalali) |
|--------|------------------|
| Short | ۱۴۰۳/۱۰/۲۹ |
| Medium | ۲۹ جدی ۱۴۰۳ |
| Long | ۲۹ جدی ۱۴۰۳ هجری شمسی |
| Relative | ۲ روز پیش |

### Implementation
- **date-fns-jalali** for date manipulation
- Custom Afghan locale file for month names

---

## Color System (Naqsh Design System)

### CSS Variables (HSL Format for shadcn/ui)

```css
:root {
  /* Primary */
  --primary: 210 100% 20%;           /* #003366 */
  --primary-foreground: 0 0% 100%;   /* white */
  --primary-hover: 210 100% 13%;     /* #002244 */
  --primary-light: 210 43% 93%;      /* #E6EEF5 */

  /* Secondary */
  --secondary: 215 14% 47%;          /* #64748B */
  --secondary-foreground: 0 0% 100%;
  --secondary-hover: 215 19% 35%;    /* #475569 */
  --secondary-light: 210 40% 96%;    /* #F1F5F9 */

  /* Neutrals */
  --background: 40 33% 96%;          /* #F9F7F2 */
  --foreground: 0 0% 10%;            /* #1A1A1A */
  --card: 0 0% 100%;                 /* #FFFFFF */
  --card-foreground: 0 0% 10%;
  --muted: 210 40% 96%;
  --muted-foreground: 220 9% 46%;    /* #6B7280 */
  --border: 214 32% 91%;             /* #E2E8F0 */
  --input: 214 32% 91%;
  --ring: 210 100% 20%;

  /* Semantic */
  --success: 160 84% 39%;            /* #10B981 */
  --success-light: 152 81% 90%;      /* #D1FAE5 */
  --destructive: 0 84% 50%;          /* #DC2626 */
  --destructive-light: 0 93% 94%;    /* #FEE2E2 */
  --warning: 38 92% 50%;             /* #F59E0B */
  --warning-light: 48 96% 89%;       /* #FEF3C7 */
  --info: 199 89% 48%;               /* #0EA5E9 */
  --info-light: 204 94% 94%;         /* #E0F2FE */

  /* Border Radius */
  --radius: 0.5rem;
}

[data-theme="dark"] {
  --background: 222 47% 11%;         /* #0F172A */
  --foreground: 210 40% 98%;         /* #F8FAFC */
  --card: 217 33% 17%;               /* #1E293B */
  --card-foreground: 210 40% 98%;
  --border: 217 19% 27%;             /* #334155 */
  --muted-foreground: 215 20% 65%;   /* #94A3B8 */
  --input: 217 19% 27%;
}
```

### Color Mapping to shadcn/ui

| shadcn Variable | Naqsh Value | Usage |
|-----------------|-------------|-------|
| `--background` | naqsh-background | Page background |
| `--foreground` | naqsh-text | Primary text |
| `--primary` | naqsh-primary | Buttons, links, accents |
| `--secondary` | naqsh-secondary | Secondary actions |
| `--muted` | naqsh-secondary-light | Disabled, subtle backgrounds |
| `--destructive` | naqsh-error | Delete, error states |
| `--border` | naqsh-border | Borders, dividers |
| `--card` | naqsh-surface | Card backgrounds |

---

## Internationalization (i18n)

### Language Support Roadmap

| Phase | Language | Direction | Status |
|-------|----------|-----------|--------|
| 1 | Persian/Dari (fa) | RTL | Primary |
| 1 | English (en) | LTR | Secondary |
| 2 | Pashto (ps) | RTL | Planned |

### Implementation
- **react-i18next** for translation management
- Namespace-based organization (common, teachers, timetable, etc.)
- Direction switching via `dir` attribute on `<html>`

### Translation File Structure
```
packages/web/
├── src/
│   └── i18n/
│       ├── locales/
│       │   ├── fa/
│       │   │   ├── common.json
│       │   │   ├── teachers.json
│       │   │   ├── timetable.json
│       │   │   └── ...
│       │   ├── en/
│       │   │   └── ...
│       │   └── ps/
│       │       └── ...
│       └── index.ts
```

---

## Scheduling Grid Architecture

### Interactive Timetable Editor

The core feature is a drag-and-drop timetable editor with real-time constraint validation.

### Component Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  ScheduleBoard (DndContext provider)                        │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │ ClassGrid     │ │ ClassGrid     │ │ ClassGrid     │     │
│  │ (Class 10A)   │ │ (Class 10B)   │ │ (Class 10C)   │     │
│  │ ┌───┬───┬───┐ │ │ ┌───┬───┬───┐ │ │ ┌───┬───┬───┐ │     │
│  │ │   │   │   │ │ │ │   │   │   │ │ │ │   │   │   │ │     │
│  │ ├───┼───┼───┤ │ │ ├───┼───┼───┤ │ │ ├───┼───┼───┤ │     │
│  │ │ ● │   │ ● │ │ │ │   │ ● │   │ │ │ │   │   │ ● │ │     │
│  │ └───┴───┴───┘ │ │ └───┴───┴───┘ │ │ └───┴───┴───┘ │     │
│  └───────────────┘ └───────────────┘ └───────────────┘     │
│                                                             │
│  ● = Draggable LessonCard                                  │
│  Each cell = Droppable TimeSlot with validation state      │
└─────────────────────────────────────────────────────────────┘
```

### Drag & Drop Library: @dnd-kit

| Feature | Benefit |
|---------|---------|
| Multiple drop zones | Support 10+ class grids simultaneously |
| Collision detection | Accurate slot targeting |
| Accessibility | Keyboard navigation support |
| Sensors | Mouse, touch, keyboard input |
| Animations | Smooth drag feedback |

### Real-Time Validation Flow

```
User drags lesson
       │
       ▼
onDragStart → Highlight valid drop zones
       │
       ▼
onDragOver → Validate against constraints:
       │     • Teacher conflicts (same time, different class)
       │     • Room conflicts (same room, same time)
       │     • Consecutive period rules
       │     • Max periods per day per subject
       │     • Teacher availability
       │
       ▼
Visual Feedback:
  🟢 Green  = Valid drop zone
  🟡 Yellow = Warning (soft constraint)
  🔴 Red    = Blocked (hard constraint)
       │
       ▼
onDragEnd → Apply change or show error toast
```

### Validation Strategy

| Type | Implementation | Speed |
|------|----------------|-------|
| Real-time (drag) | TypeScript constraint checker | Instant |
| Final (save) | API validation endpoint | ~100ms |

---

## Project Structure

```
packages/web/
├── public/
│   └── fonts/                    # Self-hosted fonts
│       ├── vazirmatn/
│       ├── inter/
│       └── jetbrains-mono/
├── src/
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components
│   │   ├── layout/               # Shell, Sidebar, Header
│   │   └── schedule/             # Custom grid components
│   │       ├── ScheduleBoard.tsx
│   │       ├── ClassGrid.tsx
│   │       ├── TimeSlot.tsx
│   │       └── LessonCard.tsx
│   ├── features/                 # Feature modules
│   │   ├── teachers/
│   │   ├── classes/
│   │   ├── subjects/
│   │   ├── rooms/
│   │   ├── timetable/
│   │   └── wizard/
│   ├── hooks/                    # Custom React hooks
│   │   ├── useScheduleValidation.ts
│   │   └── useNumeral.ts
│   ├── lib/
│   │   ├── api.ts                # TanStack Query API client
│   │   ├── validation.ts         # Constraint validation logic
│   │   ├── date.ts               # Jalali date utilities
│   │   └── utils.ts              # General utilities
│   ├── stores/                   # Zustand stores
│   │   ├── scheduleStore.ts
│   │   └── uiStore.ts
│   ├── schemas/                  # Zod schemas
│   ├── routes/                   # TanStack Router routes
│   ├── i18n/                     # Translations
│   │   └── locales/
│   │       ├── fa/
│   │       ├── en/
│   │       └── ps/
│   ├── styles/
│   │   └── globals.css           # Tailwind + CSS variables
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── vite.config.ts
```

---

## State Management Strategy

### Division of Concerns

| State Type | Tool | Examples |
|------------|------|----------|
| Server State | TanStack Query | Teachers, classes, saved timetables |
| UI State | Zustand | Sidebar open, active tab, theme |
| Form State | React Hook Form | Input values, validation errors |
| Drag State | @dnd-kit | Active drag item, drop targets |

### Zustand Store Pattern

```typescript
// Example: UI Store
interface UIStore {
  sidebarOpen: boolean;
  theme: 'light' | 'dark';
  language: 'fa' | 'en' | 'ps';
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'fa' | 'en' | 'ps') => void;
}
```

---

## API Integration

### TanStack Query Configuration

- **Stale time:** 5 minutes for reference data (teachers, subjects)
- **Cache time:** 30 minutes
- **Retry:** 3 attempts with exponential backoff
- **Refetch on window focus:** Enabled

### API Client Structure

```typescript
// Base configuration
const api = {
  teachers: {
    list: () => fetch('/api/teachers'),
    get: (id: number) => fetch(`/api/teachers/${id}`),
    create: (data: TeacherInput) => fetch('/api/teachers', { method: 'POST', body: data }),
    update: (id: number, data: TeacherInput) => fetch(`/api/teachers/${id}`, { method: 'PUT', body: data }),
    delete: (id: number) => fetch(`/api/teachers/${id}`, { method: 'DELETE' }),
  },
  // ... other resources
};
```

---

## Electron Integration

### electron-vite Setup

- Main process: `electron/main.js`
- Preload: `electron/preload.js`
- Renderer: `packages/web/` (Vite dev server in development)

### IPC Communication

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `get-machine-id` | Renderer → Main | License validation |
| `app-version` | Renderer → Main | Display version |
| `open-external` | Renderer → Main | Open URLs in browser |

---

## Build & Development

### Commands

```bash
# Development (all packages)
npm run dev

# Build frontend only
npm run build:web

# Build for distribution
npm run dist
```

### Environment Variables

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_VERSION=$npm_package_version
```

---

## Performance Considerations

1. **Code Splitting:** Route-based lazy loading via TanStack Router
2. **Font Loading:** `font-display: swap` for non-blocking render
3. **Query Caching:** Aggressive caching for reference data
4. **Virtual Scrolling:** For large teacher/class lists (if needed)
5. **Memoization:** React.memo for grid cells to prevent re-renders during drag

---

## Accessibility

- **Keyboard Navigation:** Full support via @dnd-kit and Radix UI
- **Screen Readers:** ARIA labels in Persian/English
- **Focus Management:** Visible focus indicators
- **Color Contrast:** WCAG AA compliant color combinations
- **RTL Support:** Native bidirectional text handling

---

*Document Version: 1.1*
*Last Updated: December 2025*
