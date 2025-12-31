# Naqsh UI - Repository Structure & Technical Context
### نقش یو‌آی - ساختار مخزن و زمینه فنی

> Technical reference for the Naqsh UI design system repository structure, packages, and development workflow.

---

## Table of Contents

1. [Repository Overview](#1-repository-overview)
2. [Directory Structure](#2-directory-structure)
3. [Packages](#3-packages)
4. [Documentation Structure](#4-documentation-structure)
5. [Development Setup](#5-development-setup)
6. [Build & Release](#6-build--release)
7. [Contributing Guidelines](#7-contributing-guidelines)

---

## 1. Repository Overview

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | React 18+ | Component library |
| **Language** | TypeScript | Type safety |
| **Styling** | CSS Variables + Tailwind CSS | Theming & utilities |
| **Build** | Vite / tsup | Fast builds, tree-shaking |
| **Documentation** | Nextra / Storybook | Docs site & component playground |
| **Testing** | Vitest + Testing Library | Unit & integration tests |
| **CLI** | Node.js | Component installation tool |
| **Package Manager** | pnpm | Monorepo workspace management |

### Monorepo Structure

```
naqsh-ui/
├── docs/                 # Documentation markdown files
├── packages/             # NPM packages
│   ├── core/             # Base styles, CSS variables
│   ├── components/       # React components
│   ├── hooks/            # React hooks
│   ├── utils/            # Utility functions
│   └── cli/              # CLI tool (npx naqsh-ui add)
├── examples/             # Example projects
├── scripts/              # Build & release scripts
└── .github/              # GitHub Actions, templates
```

---

## 2. Directory Structure

### Complete Repository Tree

```
naqsh-ui/
│
├── docs/
│   ├── 01-introduction/
│   │   ├── getting-started.md      # Quick start guide
│   │   ├── installation.md         # Installation methods
│   │   ├── why-naqsh.md            # Value proposition
│   │   └── philosophy.md           # Design philosophy
│   │
│   ├── 02-foundations/
│   │   ├── design-principles.md    # Core design principles
│   │   ├── colors.md               # Color system & tokens
│   │   ├── typography.md           # Font families, scale
│   │   ├── spacing.md              # Spacing scale & usage
│   │   ├── shadows.md              # Shadow tokens
│   │   ├── borders-radius.md       # Border radius tokens
│   │   ├── icons.md                # Icon guidelines
│   │   └── motion.md               # Animation & transitions
│   │
│   ├── 03-localization/
│   │   ├── rtl-support.md          # RTL-first approach
│   │   ├── bidirectional-text.md   # Mixed direction text
│   │   ├── jalali-calendar.md      # Shamsi calendar integration
│   │   ├── number-formats.md       # Persian/Western numerals
│   │   ├── phone-formats.md        # Afghan phone validation
│   │   ├── currency-formats.md     # AFN currency formatting
│   │   └── afghan-validations.md   # Tazkira, postal codes
│   │
│   ├── 04-components/
│   │   ├── overview.md             # Component architecture
│   │   ├── primitives/
│   │   │   ├── button.md
│   │   │   ├── input.md
│   │   │   ├── textarea.md
│   │   │   ├── select.md
│   │   │   ├── checkbox.md
│   │   │   ├── radio.md
│   │   │   ├── switch.md
│   │   │   ├── slider.md
│   │   │   └── toggle.md
│   │   ├── layout/
│   │   │   ├── container.md
│   │   │   ├── stack.md
│   │   │   ├── grid.md
│   │   │   ├── divider.md
│   │   │   └── aspect-ratio.md
│   │   ├── data-display/
│   │   │   ├── card.md
│   │   │   ├── table.md
│   │   │   ├── badge.md
│   │   │   ├── avatar.md
│   │   │   ├── tooltip.md
│   │   │   └── data-list.md
│   │   ├── feedback/
│   │   │   ├── alert.md
│   │   │   ├── toast.md
│   │   │   ├── progress.md
│   │   │   ├── spinner.md
│   │   │   ├── skeleton.md
│   │   │   └── empty-state.md
│   │   ├── overlay/
│   │   │   ├── modal.md
│   │   │   ├── drawer.md
│   │   │   ├── popover.md
│   │   │   ├── dropdown.md
│   │   │   └── context-menu.md
│   │   ├── navigation/
│   │   │   ├── tabs.md
│   │   │   ├── breadcrumb.md
│   │   │   ├── pagination.md
│   │   │   ├── stepper.md
│   │   │   └── sidebar.md
│   │   └── forms/
│   │       ├── form.md
│   │       ├── form-field.md
│   │       ├── date-picker.md      # Jalali + Gregorian
│   │       ├── time-picker.md
│   │       ├── file-upload.md
│   │       ├── phone-input.md      # Afghan format
│   │       ├── tazkira-input.md    # National ID
│   │       └── currency-input.md   # Afghani (AFN)
│   │
│   ├── 05-blocks/
│   │   ├── overview.md             # What are blocks
│   │   ├── authentication/
│   │   │   ├── login-form.md
│   │   │   ├── register-form.md
│   │   │   ├── forgot-password.md
│   │   │   └── otp-verification.md
│   │   ├── dashboard/
│   │   │   ├── stats-cards.md
│   │   │   ├── charts-section.md
│   │   │   ├── recent-activity.md
│   │   │   └── quick-actions.md
│   │   ├── data-management/
│   │   │   ├── data-table.md
│   │   │   ├── filters-panel.md
│   │   │   ├── bulk-actions.md
│   │   │   └── import-export.md
│   │   ├── settings/
│   │   │   ├── profile-form.md
│   │   │   ├── preferences.md
│   │   │   └── notifications.md
│   │   └── common/
│   │       ├── header.md
│   │       ├── footer.md
│   │       ├── sidebar-nav.md
│   │       └── command-palette.md
│   │
│   ├── 06-templates/
│   │   ├── overview.md             # Template usage
│   │   ├── dashboard-template.md
│   │   ├── auth-template.md
│   │   ├── settings-template.md
│   │   ├── landing-page.md
│   │   └── error-pages.md
│   │
│   ├── 07-patterns/
│   │   ├── form-patterns.md        # Form best practices
│   │   ├── table-patterns.md       # Data table patterns
│   │   ├── error-handling.md       # Error UI patterns
│   │   ├── loading-states.md       # Loading indicators
│   │   ├── empty-states.md         # No data states
│   │   └── responsive-patterns.md  # Responsive design
│   │
│   ├── 08-accessibility/
│   │   ├── overview.md             # A11y commitment
│   │   ├── keyboard-navigation.md  # Keyboard support
│   │   ├── screen-readers.md       # ARIA, landmarks
│   │   ├── color-contrast.md       # WCAG contrast
│   │   └── focus-management.md     # Focus handling
│   │
│   └── 09-theming/
│       ├── overview.md             # Theming system
│       ├── css-variables.md        # All CSS variables
│       ├── dark-mode.md            # Dark theme setup
│       ├── custom-themes.md        # Creating themes
│       └── brand-customization.md  # Brand adaptation
│
├── packages/
│   ├── core/                       # @naqsh-ui/core
│   ├── components/                 # @naqsh-ui/components
│   ├── hooks/                      # @naqsh-ui/hooks
│   ├── utils/                      # @naqsh-ui/utils
│   └── cli/                        # naqsh-ui (CLI)
│
├── examples/
│   ├── nextjs/                     # Next.js 14 example
│   ├── vite-react/                 # Vite + React example
│   └── remix/                      # Remix example
│
├── scripts/
│   ├── build.ts                    # Build all packages
│   ├── release.ts                  # Version & publish
│   └── generate-docs.ts            # Generate API docs
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                  # CI pipeline
│   │   ├── release.yml             # Release automation
│   │   └── docs.yml                # Docs deployment
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── package.json                    # Root package.json
├── pnpm-workspace.yaml             # Workspace config
├── tsconfig.json                   # Base TS config
├── turbo.json                      # Turborepo config
└── README.md                       # Project README
```

---

## 3. Packages

### Package Overview

| Package | NPM Name | Description |
|---------|----------|-------------|
| `core` | `@naqsh-ui/core` | CSS variables, base styles, reset |
| `components` | `@naqsh-ui/components` | React components |
| `hooks` | `@naqsh-ui/hooks` | React hooks (useTheme, useRTL, etc.) |
| `utils` | `@naqsh-ui/utils` | Utility functions (date, validation) |
| `cli` | `naqsh-ui` | CLI tool for adding components |

---

### @naqsh-ui/core

Base styles and CSS variables.

```
packages/core/
├── src/
│   ├── styles/
│   │   ├── reset.css           # CSS reset
│   │   ├── variables.css       # All CSS variables
│   │   ├── typography.css      # Font imports, text styles
│   │   ├── utilities.css       # Utility classes
│   │   └── index.css           # Main entry
│   └── index.ts                # JS exports (if any)
├── package.json
├── tsconfig.json
└── README.md
```

**package.json:**
```json
{
  "name": "@naqsh-ui/core",
  "version": "1.0.0",
  "main": "dist/index.css",
  "files": ["dist"],
  "sideEffects": ["*.css"],
  "peerDependencies": {}
}
```

---

### @naqsh-ui/components

React component library.

```
packages/components/
├── src/
│   ├── primitives/
│   │   ├── button/
│   │   │   ├── button.tsx
│   │   │   ├── button.styles.css
│   │   │   ├── button.test.tsx
│   │   │   └── index.ts
│   │   ├── input/
│   │   ├── select/
│   │   └── ...
│   ├── layout/
│   │   ├── container/
│   │   ├── stack/
│   │   ├── grid/
│   │   └── ...
│   ├── data-display/
│   ├── feedback/
│   ├── overlay/
│   ├── navigation/
│   ├── forms/
│   ├── provider/
│   │   └── naqsh-provider.tsx  # Root provider
│   └── index.ts                # All exports
├── package.json
├── tsconfig.json
└── README.md
```

**package.json:**
```json
{
  "name": "@naqsh-ui/components",
  "version": "1.0.0",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./button": {
      "import": "./dist/button.mjs",
      "require": "./dist/button.js",
      "types": "./dist/button.d.ts"
    }
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "dependencies": {
    "@naqsh-ui/core": "workspace:*",
    "@naqsh-ui/hooks": "workspace:*",
    "@naqsh-ui/utils": "workspace:*"
  }
}
```

**Component File Structure:**
```typescript
// packages/components/src/primitives/button/button.tsx

import { forwardRef } from 'react';
import { cn } from '@naqsh-ui/utils';
import './button.styles.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'naqsh-button',
          `naqsh-button--${variant}`,
          `naqsh-button--${size}`,
          loading && 'naqsh-button--loading',
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <span className="naqsh-button__spinner" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

---

### @naqsh-ui/hooks

React hooks for common functionality.

```
packages/hooks/
├── src/
│   ├── use-theme.ts            # Theme management
│   ├── use-direction.ts        # RTL/LTR direction
│   ├── use-locale.ts           # Locale management
│   ├── use-media-query.ts      # Responsive hooks
│   ├── use-disclosure.ts       # Open/close state
│   ├── use-click-outside.ts    # Click outside detection
│   ├── use-keyboard.ts         # Keyboard shortcuts
│   ├── use-focus-trap.ts       # Focus trapping
│   ├── use-jalali-date.ts      # Jalali date utilities
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Example Hook:**
```typescript
// packages/hooks/src/use-theme.ts

import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

export function useTheme(defaultTheme: Theme = 'system') {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = localStorage.getItem('naqsh-theme') as Theme | null;
    if (stored) setThemeState(stored);
  }, []);

  useEffect(() => {
    const resolved = theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;
    
    setResolvedTheme(resolved);
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('naqsh-theme', theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  return { theme, resolvedTheme, setTheme, toggleTheme };
}
```

---

### @naqsh-ui/utils

Utility functions for dates, validation, formatting.

```
packages/utils/
├── src/
│   ├── cn.ts                   # Class name merger (clsx + twMerge)
│   ├── date/
│   │   ├── jalali.ts           # Jalali calendar utilities
│   │   ├── format.ts           # Date formatting
│   │   └── index.ts
│   ├── validation/
│   │   ├── phone.ts            # Afghan phone validation
│   │   ├── tazkira.ts          # National ID validation
│   │   ├── postal.ts           # Postal code validation
│   │   └── index.ts
│   ├── format/
│   │   ├── currency.ts         # Currency formatting
│   │   ├── numbers.ts          # Persian numerals
│   │   └── index.ts
│   ├── rtl/
│   │   ├── direction.ts        # Direction utilities
│   │   └── index.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

**Example Utilities:**
```typescript
// packages/utils/src/format/numbers.ts

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
const WESTERN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function toPersianNumerals(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[parseInt(d)]);
}

export function toWesternNumerals(input: string): string {
  return input.replace(/[۰-۹]/g, (d) => WESTERN_DIGITS[PERSIAN_DIGITS.indexOf(d)]);
}

export function formatNumber(
  num: number,
  options: { locale?: 'fa' | 'en'; separator?: string } = {}
): string {
  const { locale = 'fa', separator = '،' } = options;
  const formatted = num.toLocaleString('en-US').replace(/,/g, separator);
  return locale === 'fa' ? toPersianNumerals(formatted) : formatted;
}
```

```typescript
// packages/utils/src/validation/phone.ts

export const AFGHAN_PHONE_REGEX = /^07[0-9]{8}$/;
export const AFGHAN_PHONE_PREFIXES = ['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'];

export function isValidAfghanPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '');
  return AFGHAN_PHONE_REGEX.test(cleaned);
}

export function formatAfghanPhone(phone: string): string {
  const cleaned = phone.replace(/[\s-]/g, '');
  if (cleaned.length !== 10) return phone;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
}
```

---

### naqsh-ui (CLI)

Command-line tool for adding components (like shadcn).

```
packages/cli/
├── src/
│   ├── commands/
│   │   ├── init.ts             # Initialize project
│   │   ├── add.ts              # Add components
│   │   └── diff.ts             # Show component changes
│   ├── utils/
│   │   ├── get-config.ts       # Read naqsh.config.js
│   │   ├── get-components.ts   # Fetch component registry
│   │   └── transform.ts        # Transform component code
│   └── index.ts
├── bin/
│   └── naqsh-ui.js             # CLI entry point
├── package.json
├── tsconfig.json
└── README.md
```

**CLI Usage:**
```bash
# Initialize Naqsh UI in a project
npx naqsh-ui init

# Add specific components
npx naqsh-ui add button
npx naqsh-ui add input select checkbox

# Add all components
npx naqsh-ui add --all

# Show what would change
npx naqsh-ui diff button
```

**naqsh.config.js (generated by init):**
```javascript
module.exports = {
  // Where to put components
  componentsDir: './src/components/ui',
  
  // Styling approach
  style: 'css', // or 'tailwind'
  
  // Default direction
  direction: 'rtl',
  
  // Default locale
  locale: 'fa-AF',
  
  // TypeScript
  typescript: true,
  
  // Aliases
  aliases: {
    components: '@/components',
    utils: '@/lib/utils',
  },
};
```

---

## 4. Documentation Structure

### Documentation Site

The docs folder contains markdown files that power the documentation website (built with Nextra or similar).

### File Naming Convention

```
docs/
├── 01-introduction/          # Numbered for ordering
│   ├── getting-started.md    # Kebab-case filenames
│   └── _meta.json            # Navigation metadata
```

**_meta.json example:**
```json
{
  "getting-started": "شروع کار",
  "installation": "نصب",
  "why-naqsh": "چرا نقش؟",
  "philosophy": "فلسفه طراحی"
}
```

### Documentation Page Template

Each component documentation follows this structure:

```markdown
---
title: Button
description: دکمه برای انجام عملیات
---

# Button (دکمه)

دکمه‌ها برای انجام عملیات و ارسال فرم‌ها استفاده می‌شوند.

## نصب

\`\`\`bash
npx naqsh-ui add button
\`\`\`

## استفاده

\`\`\`tsx
import { Button } from '@/components/ui/button';

export function Example() {
  return <Button>کلیک کنید</Button>;
}
\`\`\`

## انواع (Variants)

### پیش‌فرض (Default)
\`\`\`tsx
<Button variant="default">دکمه اصلی</Button>
\`\`\`

### خطی (Outline)
\`\`\`tsx
<Button variant="outline">دکمه خطی</Button>
\`\`\`

## اندازه‌ها (Sizes)

| Size | Height | Usage |
|------|--------|-------|
| sm | 32px | فرم‌های فشرده |
| md | 40px | پیش‌فرض |
| lg | 48px | دکمه‌های برجسته |

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| variant | string | 'default' | نوع دکمه |
| size | string | 'md' | اندازه دکمه |
| disabled | boolean | false | غیرفعال |
| loading | boolean | false | در حال بارگذاری |

## دسترسی‌پذیری

- پشتیبانی کامل از کیبورد
- برچسب‌های ARIA مناسب
- نشانگر فوکوس واضح

## RTL

دکمه به صورت خودکار در RTL کار می‌کند:
- آیکون‌ها در سمت صحیح قرار می‌گیرند
- انیمیشن‌ها معکوس می‌شوند
```

---

## 5. Development Setup

### Prerequisites

- Node.js 18+
- pnpm 8+
- Git

### Initial Setup

```bash
# Clone repository
git clone https://github.com/aza-tech/naqsh-ui.git
cd naqsh-ui

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development
pnpm dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development mode |
| `pnpm build` | Build all packages |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | TypeScript type checking |
| `pnpm docs:dev` | Start docs site locally |
| `pnpm docs:build` | Build docs site |
| `pnpm changeset` | Create a changeset |
| `pnpm release` | Publish packages |

### Root package.json

```json
{
  "name": "naqsh-ui",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "docs:dev": "pnpm --filter docs dev",
    "docs:build": "pnpm --filter docs build",
    "changeset": "changeset",
    "release": "pnpm build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
  - 'examples/*'
  - 'docs'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### TypeScript Configuration

**tsconfig.json (root):**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "jsx": "react-jsx",
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  }
}
```

---

## 6. Build & Release

### Build Process

Each package uses `tsup` for building:

```typescript
// packages/components/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/*/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: true,
  clean: true,
  external: ['react', 'react-dom'],
});
```

### Versioning with Changesets

```bash
# Create a changeset
pnpm changeset

# Version packages
pnpm changeset version

# Publish to npm
pnpm release
```

### Release Workflow

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      
      - name: Create Release PR or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

---

## 7. Contributing Guidelines

### Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/description` | `feat/date-picker-jalali` |
| Bug Fix | `fix/description` | `fix/button-rtl-icon` |
| Docs | `docs/description` | `docs/button-examples` |
| Refactor | `refactor/description` | `refactor/hooks-structure` |

### Commit Convention

Follow Conventional Commits:

```
feat(button): add loading state
fix(input): correct RTL placeholder alignment
docs(readme): update installation instructions
chore(deps): update dependencies
```

### Pull Request Process

1. Create feature branch from `main`
2. Make changes with tests
3. Run `pnpm lint && pnpm test && pnpm typecheck`
4. Create changeset: `pnpm changeset`
5. Open PR with description
6. Wait for review and CI
7. Squash and merge

### Component Contribution Checklist

- [ ] Component follows naming convention
- [ ] TypeScript types are complete
- [ ] RTL support is implemented
- [ ] Accessibility requirements met
- [ ] Tests written (unit + a11y)
- [ ] Documentation page created
- [ ] Storybook stories added
- [ ] Changeset created

---

## Appendix: Example Projects

### Next.js Example

```
examples/nextjs/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   └── ui/                 # Naqsh UI components
├── lib/
│   └── utils.ts
├── naqsh.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

### Vite + React Example

```
examples/vite-react/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   └── components/
│       └── ui/
├── naqsh.config.js
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Related Documents

- [NAQSH-UI-DESIGN-SYSTEM.md](./NAQSH-UI-DESIGN-SYSTEM.md) - Complete design system specification
- Component API documentation (in `/docs/04-components/`)
- Accessibility guidelines (in `/docs/08-accessibility/`)

---

## License

MIT License - See LICENSE file for details.

---

*AZA Tech (آزا تک) - Building the future of Afghan software development.*
