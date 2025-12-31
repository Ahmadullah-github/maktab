# Design Document: Routing & Navigation

## Overview

This design implements a comprehensive routing and navigation system for the
Maktab frontend application. The system replaces the current tab-based
navigation with URL-based routing using TanStack Router's file-based routing
pattern. The Sidebar component will be updated to use TanStack Router's `<Link>`
component for navigation, enabling proper URL updates, browser history support,
and active state management.

## Architecture

The routing system follows TanStack Router's file-based routing convention where
route files in `src/routes/` automatically generate route definitions. The
architecture consists of:

```
┌─────────────────────────────────────────────────────────────┐
│                      __root.tsx                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              MainLayout                              │   │
│  │  ┌─────────┐  ┌──────────────────────────────────┐  │   │
│  │  │ Sidebar │  │         <Outlet />                │  │   │
│  │  │ (Links) │  │  (renders active route component) │  │   │
│  │  └─────────┘  └──────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Route Structure

```
routes/
├── __root.tsx          # Root layout with MainLayout
├── index.tsx           # Redirect to /dashboard
├── dashboard.tsx       # Dashboard page
├── school-settings.tsx # School settings page
├── periods.tsx         # Periods management
├── rooms.tsx           # Rooms management
├── teachers.tsx        # Teachers management
├── subjects.tsx        # Subjects management
├── classes.tsx         # Classes management (existing feature)
├── constraints.tsx     # Constraints configuration
├── schedule-dashboard.tsx  # Schedule overview
├── classes-schedule.tsx    # Class timetables
├── teachers-schedule.tsx   # Teacher timetables
├── guidance.tsx        # Help/guidance
├── about.tsx           # About page
├── settings.tsx        # App settings
└── logout.tsx          # Logout/license page
```

## Components and Interfaces

### Route File Pattern

Each route file follows TanStack Router's `createFileRoute` pattern:

```typescript
// Example: routes/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '@/features/dashboard';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});
```

### Sidebar Navigation Interface

```typescript
interface NavItem {
  id: string;
  path: string; // Route path for Link component
  titleKey: string; // i18n translation key
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  id: string;
  labelKey?: string; // Optional section label (i18n key)
  items: NavItem[];
}
```

### Placeholder Page Component Interface

```typescript
interface PlaceholderPageProps {
  titleKey: string; // i18n key for page title
  icon: React.ComponentType<{ className?: string }>;
}
```

### MainLayout Update

The MainLayout component will be modified to:

1. Remove `<Workspace />` component
2. Render `<Outlet />` from TanStack Router in the main content area
3. Keep Header and Sidebar structure intact

```typescript
// MainLayout structure
<div className="flex flex-col h-screen">
  <Header />
  <div className="flex-1 flex overflow-hidden">
    <Sidebar />
    <main className="flex-1 flex flex-col min-w-0">
      <Outlet />  {/* Route content renders here */}
    </main>
  </div>
</div>
```

## Data Models

### Navigation Configuration

```typescript
const navigationConfig: NavSection[] = [
  {
    id: 'main',
    items: [
      {
        id: 'dashboard',
        path: '/dashboard',
        titleKey: 'sidebar.dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'entities',
    labelKey: 'sidebar.entities',
    items: [
      {
        id: 'school-settings',
        path: '/school-settings',
        titleKey: 'sidebar.schoolSettings',
        icon: School,
      },
      {
        id: 'periods',
        path: '/periods',
        titleKey: 'sidebar.periods',
        icon: Clock,
      },
      {
        id: 'rooms',
        path: '/rooms',
        titleKey: 'sidebar.rooms',
        icon: Building2,
      },
      {
        id: 'teachers',
        path: '/teachers',
        titleKey: 'sidebar.teachers',
        icon: Users,
      },
      {
        id: 'subjects',
        path: '/subjects',
        titleKey: 'sidebar.subjects',
        icon: BookOpen,
      },
      {
        id: 'classes',
        path: '/classes',
        titleKey: 'sidebar.classes',
        icon: GraduationCap,
      },
      {
        id: 'constraints',
        path: '/constraints',
        titleKey: 'sidebar.constraints',
        icon: SlidersHorizontal,
      },
    ],
  },
  {
    id: 'schedule',
    labelKey: 'sidebar.schedule',
    items: [
      {
        id: 'schedule-dashboard',
        path: '/schedule-dashboard',
        titleKey: 'sidebar.scheduleDashboard',
        icon: CalendarDays,
      },
      {
        id: 'classes-schedule',
        path: '/classes-schedule',
        titleKey: 'sidebar.classesSchedule',
        icon: CalendarCheck,
      },
      {
        id: 'teachers-schedule',
        path: '/teachers-schedule',
        titleKey: 'sidebar.teachersSchedule',
        icon: CalendarClock,
      },
    ],
  },
  {
    id: 'footer',
    items: [
      {
        id: 'guidance',
        path: '/guidance',
        titleKey: 'sidebar.guidance',
        icon: HelpCircle,
      },
      { id: 'about', path: '/about', titleKey: 'sidebar.about', icon: Info },
      {
        id: 'settings',
        path: '/settings',
        titleKey: 'sidebar.settings',
        icon: Settings,
      },
      {
        id: 'logout',
        path: '/logout',
        titleKey: 'sidebar.logout',
        icon: LogOut,
      },
    ],
  },
];
```

### i18n Keys Addition

```json
{
  "nav": {
    "dashboard": "داشبورد",
    "entities": "اطلاعات",
    "schoolSettings": "تنظیم مکتب",
    "periods": "ساعات درسی",
    "rooms": "اتاق‌ها",
    "teachers": "معلمین",
    "subjects": "مضامین",
    "classes": "صنوف",
    "constraints": "تنظیم محدودیت‌ها",
    "schedule": "تقسیم اوقات",
    "scheduleDashboard": "داشبورد تقسیم اوقات",
    "classesSchedule": "تقسیم اوقات صنوف",
    "teachersSchedule": "تقسیم اوقات معلمین",
    "guidance": "رهنمایی",
    "about": "درباره",
    "settings": "تنظیمات",
    "logout": "خارج شدن"
  },
  "placeholder": {
    "underDevelopment": "در حال توسعه...",
    "pageTitle": "{{title}}"
  }
}
```

## Correctness Properties

_A property is a characteristic or behavior that should hold true across all
valid executions of a system-essentially, a formal statement about what the
system should do. Properties serve as the bridge between human-readable
specifications and machine-verifiable correctness guarantees._

### Property 1: Root path redirect

_For any_ navigation to the root path `/`, the router SHALL redirect to
`/dashboard` and render the DashboardPage component. **Validates: Requirements
1.1, 1.2, 1.3**

### Property 2: Route-to-component mapping

_For any_ valid route path in the application, navigating to that path SHALL
render the corresponding page component as defined in the route configuration.
**Validates: Requirements 2.1-2.15**

### Property 3: Sidebar click navigation

_For any_ clickable navigation item in the sidebar, clicking that item SHALL
navigate to its corresponding route path and update the browser URL.
**Validates: Requirements 4.1, 4.2**

### Property 4: Active route highlighting

_For any_ active route, the sidebar SHALL highlight the corresponding navigation
item, and when navigating to a different route, the highlight SHALL move to the
new active item. **Validates: Requirements 5.1, 5.3**

### Property 5: Placeholder page consistency

_For any_ placeholder page, the page SHALL display a Farsi title, the "در حال
توسعه..." message, a relevant icon, and follow a consistent layout pattern.
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 6: Route content rendering

_For any_ route change, the MainLayout's Outlet SHALL render the new page
component corresponding to the active route. **Validates: Requirements 8.3**

### Property 7: Keyboard navigation activation

_For any_ focused sidebar navigation item, pressing Enter SHALL navigate to the
corresponding route. **Validates: Requirements 9.2**

## Error Handling

### Invalid Routes

- When a user navigates to an undefined route, the router should display a 404
  page or redirect to dashboard
- The application should gracefully handle navigation errors without crashing

### Missing Translations

- If an i18n key is missing, the system should fall back to the key name
- Console warnings should be logged for missing translations in development mode

### Component Loading Errors

- If a page component fails to load, display an error boundary with a
  user-friendly message
- Provide a "retry" or "go back" option

## Testing Strategy

### Dual Testing Approach

The testing strategy employs both unit tests and property-based tests to ensure
comprehensive coverage:

#### Unit Tests

- Verify individual route files export correct route configurations
- Test Sidebar component renders all navigation items
- Test placeholder page component renders required elements
- Test MainLayout renders Outlet component

#### Property-Based Testing

**Library**: Vitest with `fast-check` for property-based testing

**Configuration**: Each property test runs a minimum of 100 iterations.

**Property Tests**:

1. **Route mapping property test**
   - Generate random valid route paths from the route configuration
   - Verify each path renders the expected component
   - Tag:
     `**Feature: routing-navigation, Property 2: Route-to-component mapping**`

2. **Sidebar navigation property test**
   - Generate random navigation item selections
   - Verify clicking navigates to the correct path
   - Tag:
     `**Feature: routing-navigation, Property 3: Sidebar click navigation**`

3. **Active state property test**
   - Generate random route navigation sequences
   - Verify active state always matches current route
   - Tag:
     `**Feature: routing-navigation, Property 4: Active route highlighting**`

4. **Placeholder consistency property test**
   - For all placeholder pages, verify required elements are present
   - Tag:
     `**Feature: routing-navigation, Property 5: Placeholder page consistency**`

5. **Keyboard activation property test**
   - Generate random focused nav items
   - Verify Enter key triggers navigation
   - Tag:
     `**Feature: routing-navigation, Property 7: Keyboard navigation activation**`

### Integration Tests

- Test full navigation flow from sidebar click to page render
- Test browser back/forward button integration
- Test redirect from root path to dashboard
