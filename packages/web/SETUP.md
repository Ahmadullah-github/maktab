# Frontend Setup Instructions

## Quick Start

1. **Install Dependencies**

   ```bash
   cd packages/web
   npm install
   ```

2. **Set Up Environment Variables**

   ```bash
   cp .env.example .env
   # Edit .env if needed (defaults should work)
   ```

3. **Generate TanStack Router Route Tree**

   ```bash
   # This will be done automatically by TanStack Router
   # But you can run manually if needed:
   npx @tanstack/router-cli generate
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:5173`

## What's Already Set Up

✅ **Configuration Files**

- `package.json` - All dependencies configured
- `tsconfig.json` - TypeScript with path aliases
- `vite.config.ts` - Vite with React plugin
- `tailwind.config.ts` - Tailwind CSS 4 with Naqsh design system
- `.eslintrc.json` - ESLint for React/TypeScript
- `.prettierrc.json` - Code formatting (inherited from root)

✅ **Project Structure**

- Basic directory structure created
- Route files (`__root.tsx`, `index.tsx`)
- Core utilities (`lib/utils.ts`, `lib/api.ts`)
- UI store (`stores/uiStore.ts`)
- i18n setup (`i18n/index.ts`)
- Global styles with Naqsh design system

✅ **Core Features**

- TanStack Router configured
- TanStack Query configured
- Zustand store setup
- Basic Button component (shadcn/ui pattern)
- RTL-first HTML structure

## Next Steps

### 1. Install Dependencies

```bash
cd packages/web
npm install
```

### 2. Add Fonts (Optional but Recommended)

Place font files in `public/fonts/`:

```
public/fonts/
├── vazirmatn/
│   ├── Vazirmatn-Regular.woff2
│   ├── Vazirmatn-Medium.woff2
│   └── Vazirmatn-Bold.woff2
├── inter/
│   └── Inter-Variable.woff2
└── jetbrains-mono/
    └── JetBrainsMono-Variable.woff2
```

Fonts are already configured in `src/styles/globals.css`. If you don't add
fonts, the browser will use fallbacks.

### 3. Generate Route Tree

TanStack Router will auto-generate `src/routeTree.gen.ts` on first run. If you
need to generate manually:

```bash
npx @tanstack/router-cli generate
```

### 4. Start Building Features

Now you can start building:

- Feature modules in `src/features/`
- Layout components in `src/components/layout/`
- Schedule components in `src/components/schedule/`
- Custom hooks in `src/hooks/`

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing types:

1. Make sure `npm install` completed successfully
2. Restart TypeScript server: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"

### Vite Not Starting

- Check that port 5173 is available
- Verify Node.js version is 18+
- Check for syntax errors in config files

### Tailwind Not Working

- Ensure `tailwindcss` is installed
- Check `tailwind.config.ts` exists
- Verify `postcss.config.js` exists
- Check that `globals.css` imports Tailwind directives

### TanStack Router Errors

- Route tree will be auto-generated on first run
- If you see route errors, run: `npx @tanstack/router-cli generate`

## Development Workflow

1. **Create a new route:**

   - Add file in `src/routes/` (e.g., `src/routes/about.tsx`)
   - Route tree auto-generates
   - Access at `/about`

2. **Create a feature:**

   - Create directory in `src/features/` (e.g., `src/features/teachers/`)
   - Add components, hooks, types, etc.
   - Import using `@/features/teachers/...`

3. **Add a UI component:**

   - Use shadcn/ui pattern (see `src/components/ui/button.tsx`)
   - Place in `src/components/ui/`
   - Export from `src/components/ui/index.ts` (create if needed)

4. **Use API:**

   - Import from `@/lib/api`
   - Use with TanStack Query:

   ```typescript
   import { useQuery } from '@tanstack/react-query';
   import { api } from '@/lib/api';

   const { data } = useQuery({
     queryKey: ['teachers'],
     queryFn: () => api.teachers.list(),
   });
   ```

## Testing

When you're ready to add tests:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

## Building for Production

```bash
npm run build
```

Output will be in `dist/` directory, ready for Electron packaging.
