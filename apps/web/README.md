# Maktab Web Frontend

Frontend application for the Maktab timetable scheduling system.

## Technology Stack

- **React 19.2.3** - UI framework
- **Vite 7.3.0** - Build tool and dev server
- **TanStack Router 1.141.6** - Type-safe file-based routing
- **TanStack Query 5.90.12** - Server state management
- **Zustand 5.0.9** - Client state management
- **Tailwind CSS 4.1.18** - Utility-first CSS (RTL-first)
- **React Hook Form + Zod** - Form validation
- **@dnd-kit** - Drag-and-drop for schedule editing
- **react-i18next** - Internationalization

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_VERSION=1.0.0
```

## Project Structure

```
src/
├── components/        # Reusable UI components
│   ├── ui/           # shadcn/ui components
│   ├── layout/       # Shell, Sidebar, Header
│   └── schedule/     # Schedule grid components
├── features/         # Feature modules
│   ├── teachers/
│   ├── classes/
│   ├── subjects/
│   ├── rooms/
│   ├── timetable/
│   └── wizard/
├── hooks/            # Custom React hooks
├── lib/              # Utilities and API client
├── routes/           # TanStack Router routes
├── stores/           # Zustand stores
├── schemas/          # Zod validation schemas
├── i18n/             # Translation files
├── styles/           # Global styles
└── types/            # TypeScript types
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Type check without emitting

### Code Style

- Follow `.cursorrules` for AI-assisted development
- Use Prettier for formatting (auto-format on save)
- Follow ESLint rules
- Use RTL-first approach (logical properties in Tailwind)

### Path Aliases

Use path aliases for cleaner imports:

```typescript
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { api } from '@/lib/api';
```

## RTL Support

The application is RTL-first for Persian/Dari:

- Use logical properties: `ms-4`, `me-4`, `text-start`, etc.
- Never use `left-*`, `right-*`, `ml-*`, `mr-*` for layout
- HTML root has `dir="rtl"` and `lang="fa"`

## API Integration

The API client is configured in `src/lib/api.ts`. Use TanStack Query for data
fetching:

```typescript
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const { data, isLoading } = useQuery({
  queryKey: ['teachers'],
  queryFn: () => api.teachers.list(),
});
```

## Building

```bash
npm run build
```

Output will be in the `dist/` directory.

## License

MIT
