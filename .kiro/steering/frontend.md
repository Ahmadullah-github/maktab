# Frontend Architecture

## Technology Stack

- Framework: React 18.3 with TypeScript
- Build: Vite 7.x
- Routing: TanStack Router (file-based routing)
- State: Zustand (global), TanStack Query (server state)
- Forms: React Hook Form + Zod validation
- UI: Shadcn/ui (New York style) + Radix primitives
- Styling: Tailwind CSS 4.x with RTL support
- i18n: i18next + react-i18next

## Project Structure

```
packages/web/src/
├── components/
│   ├── ui/              # Shadcn/ui primitives (Button, Input, Dialog, etc.)
│   ├── layout/          # App shell components (Sidebar, Header)
│   └── schedule/        # Timetable-specific components
├── features/            # Feature modules (domain-driven)
│   ├── classes/         # Class management
│   ├── teachers/        # Teacher management
│   ├── dashboard/       # Dashboard views
│   ├── school-config/   # School configuration
│   └── workspace/       # Workspace management
├── hooks/               # Custom React hooks
├── lib/
│   ├── api.ts           # API client (fetch wrapper)
│   └── utils.ts         # Utility functions (cn, etc.)
├── routes/              # TanStack Router pages
├── schemas/             # Zod validation schemas
├── stores/              # Zustand stores
├── styles/              # Global CSS (Tailwind)
├── types/               # TypeScript type definitions
└── i18n/                # Internationalization
    └── locales/         # Translation files (fa, en)
```

## Feature Module Pattern

Each feature in `features/` follows this structure:

```
features/[feature-name]/
├── components/          # Feature-specific components
├── hooks/               # Feature-specific hooks (queries, mutations)
├── api.ts               # API functions for this feature
├── types.ts             # TypeScript types
└── index.ts             # Public exports
```

## Key Patterns

### API Integration with TanStack Query

```typescript
// In feature hooks
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useTeachers() {
  return useQuery({
    queryKey: ['teachers'],
    queryFn: () => api.teachers.list(),
  });
}

export function useCreateTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.teachers.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });
}
```

### Form Handling

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { teacherSchema, type TeacherFormData } from '@/schemas/teacher.schema';

const form = useForm<TeacherFormData>({
  resolver: zodResolver(teacherSchema),
  defaultValues: { name: '', subjects: [] },
});
```

### Global State (Zustand)

```typescript
// stores/uiStore.ts
import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

## RTL & Localization

- Default direction: RTL (Dari/Farsi)
- Use logical CSS properties (`margin-inline-start`, not `margin-left`)
- Tailwind RTL plugin: `tailwindcss-rtl`
- Font stack: Vazirmatn (Farsi) + Inter (Latin)
- All user-facing strings in translation files

## Component Guidelines

### Shadcn/ui Usage

- Components live in `components/ui/`
- Add via: `npx shadcn@latest add [component]`
- Customize via CSS variables in `globals.css`
- Use `cn()` utility for conditional classes

### Accessibility

- All interactive elements keyboard-navigable
- ARIA labels for icon-only buttons
- Focus indicators visible
- Color contrast 4.5:1 minimum

## File Naming Conventions

- Components: PascalCase (`TeacherCard.tsx`)
- Hooks: camelCase with `use` prefix (`useTeachers.ts`)
- Utils/helpers: camelCase (`formatDate.ts`)
- Types: PascalCase (`Teacher.ts` or inline)
- Schemas: camelCase with `.schema` suffix (`teacher.schema.ts`)
