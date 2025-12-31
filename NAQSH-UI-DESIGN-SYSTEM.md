# Naqsh UI Design System
### نقش یو‌آی - سیستم طراحی

> The first RTL-first, Afghan-localized design system for React applications.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Philosophy & Principles](#2-philosophy--principles)
3. [Brand Foundation](#3-brand-foundation)
4. [Color System](#4-color-system)
5. [Typography](#5-typography)
6. [Spacing & Layout](#6-spacing--layout)
7. [RTL & Localization](#7-rtl--localization)
8. [Components](#8-components)
9. [Blocks & Templates](#9-blocks--templates)
10. [Accessibility](#10-accessibility)
11. [Theming](#11-theming)
12. [Usage Guidelines](#12-usage-guidelines)

---

## 1. Introduction

### What is Naqsh UI?

**Naqsh UI** (نقش یو‌آی) is an open-source design system and React component library built specifically for RTL-first applications. The name "Naqsh" (نقش) means "pattern" or "design" in Dari/Farsi, reflecting our commitment to beautiful, culturally-aware design patterns.

### Why Naqsh UI?

| Problem | Naqsh UI Solution |
|---------|-------------------|
| Most UI libraries treat RTL as an afterthought | RTL-first architecture from the ground up |
| No support for Jalali (Shamsi) calendar | Native Jalali calendar with full localization |
| Generic validations don't fit Afghan formats | Built-in Afghan phone, Tazkira, currency validations |
| Typography optimized for Latin scripts | Vazirmatn + Inter pairing for perfect Dari/English |
| Western-centric design patterns | Culturally appropriate for Afghan/Central Asian users |

### Who is it for?

- Developers building applications for Afghan users
- Teams needing proper RTL support for Dari, Pashto, Arabic, Farsi, Urdu
- Organizations requiring Jalali calendar integration
- Anyone wanting a modern, accessible component library with RTL excellence

### Created By

**AZA Tech** (آزا تک) - An Afghan software company dedicated to digital transformation.

- Ahmadullah Ahmadi (Team Leader)
- Ahmad Zobeen Farahmand (Developer)

---

## 2. Philosophy & Principles

### Core Philosophy

> "Design for the people who have been overlooked by global design systems."

Naqsh UI exists because millions of users in Afghanistan, Iran, and the broader Persian-speaking world deserve interfaces that feel native to them—not adapted Western designs.

### Design Principles

#### 1. RTL-First, Not RTL-Adapted
Every component is designed with RTL as the primary direction. LTR support is added, not the other way around. This ensures:
- Natural text flow in Dari/Pashto
- Correct icon mirroring
- Proper form field alignment
- Intuitive navigation patterns

#### 2. Culturally Authentic
We incorporate Afghan design sensibilities:
- Geometric patterns inspired by Afghan art and architecture
- Color choices reflecting Afghan identity (Lapis Blue, Emerald)
- Respect for local conventions and expectations

#### 3. Accessibility Without Compromise
Every component meets WCAG 2.1 AA standards:
- Minimum 4.5:1 contrast ratio for text
- Full keyboard navigation
- Screen reader compatibility
- Focus indicators that work in both RTL and LTR

#### 4. Developer Experience
Inspired by Shadcn UI's approach:
- Copy-paste components (you own the code)
- Fully customizable with CSS variables
- TypeScript-first with complete type definitions
- Minimal dependencies

#### 5. Performance Matters
- Tree-shakeable components
- No runtime CSS-in-JS overhead
- Optimized bundle sizes
- Lazy-loading support for heavy components

#### 6. Honest & Trustworthy
As representatives of Afghan software development:
- Clear documentation
- No hidden behaviors
- Predictable APIs
- Transparent about limitations

---

## 3. Brand Foundation

### Brand Identity

| Attribute | Value |
|-----------|-------|
| **Name** | Naqsh UI (نقش یو‌آی) |
| **Tagline** | "RTL-First Design System" |
| **Parent Company** | AZA Tech (آزا تک) |
| **Mission** | Empower developers to build beautiful, accessible applications for RTL-speaking communities |

### Brand Values

1. **Authenticity** - True to Afghan and Persian design heritage
2. **Inclusivity** - Designed for users often overlooked by global tech
3. **Quality** - Enterprise-grade components, open-source spirit
4. **Community** - Built by Afghans, for the world

### Logo Guidelines

The Naqsh UI logo combines:
- Abstract geometric form inspired by Islamic geometric patterns
- Clean, modern execution suitable for digital products
- Works in both colored and monochrome versions
- Minimum clear space: 1x the height of the logomark

**Logo Variations:**
- Full logo (symbol + wordmark)
- Symbol only (for favicons, app icons)
- Wordmark only (for documentation headers)

### Voice & Tone

When writing documentation, error messages, or UI copy:
- **Clear**: Use simple, direct language
- **Helpful**: Guide users toward solutions
- **Respectful**: Never condescending or overly technical
- **Bilingual-aware**: Consider that users may switch between Dari and English

---

## 4. Color System

### Philosophy

Our color palette draws from Afghan cultural identity:
- **Lapis Blue**: Afghanistan's precious stone, symbolizing trust and depth
- **Afghan Emerald**: Growth, prosperity, and the Afghan flag
- **Paper**: Warm, inviting backgrounds that reduce eye strain
- **Ink**: High-contrast text for maximum readability

### Primary Palette

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--naqsh-primary` | Lapis Blue | `#003366` | 0, 51, 102 | Brand identity, headers, primary buttons, links |
| `--naqsh-primary-hover` | Lapis Dark | `#002244` | 0, 34, 68 | Hover states for primary elements |
| `--naqsh-primary-light` | Lapis Light | `#E6EEF5` | 230, 238, 245 | Primary backgrounds, selected states |

### Secondary Palette

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--naqsh-secondary` | Slate | `#64748B` | 100, 116, 139 | Secondary text, icons, borders |
| `--naqsh-secondary-hover` | Slate Dark | `#475569` | 71, 85, 105 | Hover states |
| `--naqsh-secondary-light` | Slate Light | `#F1F5F9` | 241, 245, 249 | Secondary backgrounds |

### Neutral Palette

| Token | Name | Hex | RGB | Usage |
|-------|------|-----|-----|-------|
| `--naqsh-background` | Paper | `#F9F7F2` | 249, 247, 242 | Main UI background |
| `--naqsh-surface` | White | `#FFFFFF` | 255, 255, 255 | Cards, modals, elevated surfaces |
| `--naqsh-border` | Border | `#E2E8F0` | 226, 232, 240 | Dividers, input borders |
| `--naqsh-text` | Ink | `#1A1A1A` | 26, 26, 26 | Primary text |
| `--naqsh-text-muted` | Ink Muted | `#6B7280` | 107, 114, 128 | Secondary text, placeholders |

### Semantic Colors

| Token | Name | Hex | Usage |
|-------|------|-----|-------|
| `--naqsh-success` | Emerald | `#10B981` | Success states, confirmations, positive actions |
| `--naqsh-success-light` | Emerald Light | `#D1FAE5` | Success backgrounds |
| `--naqsh-error` | Red | `#DC2626` | Errors, destructive actions, validation failures |
| `--naqsh-error-light` | Red Light | `#FEE2E2` | Error backgrounds |
| `--naqsh-warning` | Amber | `#F59E0B` | Warnings, cautions, pending states |
| `--naqsh-warning-light` | Amber Light | `#FEF3C7` | Warning backgrounds |
| `--naqsh-info` | Sky | `#0EA5E9` | Information, tips, neutral highlights |
| `--naqsh-info-light` | Sky Light | `#E0F2FE` | Info backgrounds |

### Dark Mode Palette

| Token | Light Value | Dark Value |
|-------|-------------|------------|
| `--naqsh-background` | `#F9F7F2` | `#0F172A` |
| `--naqsh-surface` | `#FFFFFF` | `#1E293B` |
| `--naqsh-border` | `#E2E8F0` | `#334155` |
| `--naqsh-text` | `#1A1A1A` | `#F8FAFC` |
| `--naqsh-text-muted` | `#6B7280` | `#94A3B8` |

### Color Usage Rules

1. **Never use pure black (#000000)** - Use Ink (#1A1A1A) for softer contrast
2. **Never use pure white (#FFFFFF) for backgrounds** - Use Paper (#F9F7F2) for warmth
3. **Maintain 4.5:1 contrast ratio** for all text on backgrounds
4. **Use semantic colors consistently** - Red always means error/danger
5. **Limit accent colors** - Don't use more than 2 accent colors per screen

### CSS Variables Implementation

```css
:root {
  /* Primary */
  --naqsh-primary: #003366;
  --naqsh-primary-hover: #002244;
  --naqsh-primary-light: #E6EEF5;
  
  /* Secondary */
  --naqsh-secondary: #64748B;
  --naqsh-secondary-hover: #475569;
  --naqsh-secondary-light: #F1F5F9;
  
  /* Neutrals */
  --naqsh-background: #F9F7F2;
  --naqsh-surface: #FFFFFF;
  --naqsh-border: #E2E8F0;
  --naqsh-text: #1A1A1A;
  --naqsh-text-muted: #6B7280;
  
  /* Semantic */
  --naqsh-success: #10B981;
  --naqsh-success-light: #D1FAE5;
  --naqsh-error: #DC2626;
  --naqsh-error-light: #FEE2E2;
  --naqsh-warning: #F59E0B;
  --naqsh-warning-light: #FEF3C7;
  --naqsh-info: #0EA5E9;
  --naqsh-info-light: #E0F2FE;
}

[data-theme="dark"] {
  --naqsh-background: #0F172A;
  --naqsh-surface: #1E293B;
  --naqsh-border: #334155;
  --naqsh-text: #F8FAFC;
  --naqsh-text-muted: #94A3B8;
}
```

---

## 5. Typography

### Philosophy

Typography in Naqsh UI serves two masters: beautiful Dari/Pashto text and clean English interfaces. We've carefully selected fonts that:
- Render perfectly in RTL and LTR
- Share similar x-heights for visual harmony
- Are optimized for screen readability
- Are open-source and freely available

### Font Families

#### Primary: Vazirmatn (Dari/Pashto/Arabic/Farsi)

**Why Vazirmatn?**
- Modern Naskh style optimized for screens
- Variable font with multiple weights
- Excellent Persian/Arabic character support
- Open-source (OFL license)
- Active development and maintenance

```css
--naqsh-font-farsi: 'Vazirmatn', system-ui, sans-serif;
```

#### Secondary: Inter (English/Latin)

**Why Inter?**
- Designed specifically for computer screens
- Similar x-height to Vazirmatn (harmonious pairing)
- Excellent legibility at small sizes
- Variable font with full weight range
- Open-source (OFL license)

```css
--naqsh-font-latin: 'Inter', system-ui, sans-serif;
```

#### Monospace: JetBrains Mono (Code/Data)

**Why JetBrains Mono?**
- Clear distinction between similar characters (0/O, 1/l/I)
- Ligature support for code
- Works well with both RTL and LTR content
- Open-source

```css
--naqsh-font-mono: 'JetBrains Mono', 'Courier New', monospace;
```

### Type Scale

Based on a 1.25 ratio (Major Third) for harmonious scaling:

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| `--naqsh-text-xs` | 12px / 0.75rem | 1.5 | 400 | Captions, labels, helper text |
| `--naqsh-text-sm` | 14px / 0.875rem | 1.5 | 400 | Secondary text, table cells |
| `--naqsh-text-base` | 16px / 1rem | 1.6 | 400 | Body text, paragraphs |
| `--naqsh-text-lg` | 18px / 1.125rem | 1.5 | 400 | Lead paragraphs, emphasis |
| `--naqsh-text-xl` | 20px / 1.25rem | 1.4 | 500 | Card titles, section headers |
| `--naqsh-text-2xl` | 24px / 1.5rem | 1.3 | 600 | Page section titles |
| `--naqsh-text-3xl` | 30px / 1.875rem | 1.3 | 600 | Page titles |
| `--naqsh-text-4xl` | 36px / 2.25rem | 1.2 | 700 | Hero titles |
| `--naqsh-text-5xl` | 48px / 3rem | 1.1 | 700 | Display, marketing |

### Font Weights

| Token | Weight | Usage |
|-------|--------|-------|
| `--naqsh-font-normal` | 400 | Body text, paragraphs |
| `--naqsh-font-medium` | 500 | Emphasis, labels, buttons |
| `--naqsh-font-semibold` | 600 | Headings, important text |
| `--naqsh-font-bold` | 700 | Strong emphasis, titles |

### Line Heights

| Token | Value | Usage |
|-------|-------|-------|
| `--naqsh-leading-none` | 1 | Single-line text, badges |
| `--naqsh-leading-tight` | 1.25 | Headings |
| `--naqsh-leading-normal` | 1.5 | UI text, labels |
| `--naqsh-leading-relaxed` | 1.6 | Body text, paragraphs |
| `--naqsh-leading-loose` | 1.75 | Long-form reading |

### Letter Spacing

| Token | Value | Usage |
|-------|-------|-------|
| `--naqsh-tracking-tight` | -0.025em | Large headings |
| `--naqsh-tracking-normal` | 0 | Body text |
| `--naqsh-tracking-wide` | 0.025em | Uppercase labels, buttons |

### Typography Rules

1. **Base font size is 16px** - Never go below 14px for readable text
2. **Dari/Pashto text needs more line-height** - Use 1.6-1.8 for body text
3. **Don't mix fonts unnecessarily** - Vazirmatn for RTL, Inter for LTR
4. **Limit heading levels** - Use maximum 3-4 levels per page
5. **Persian numerals are optional** - Support both ۱۲۳ and 123

### Bilingual Text Handling

When mixing Dari and English in the same interface:

```css
/* Auto-detect and apply correct font */
.naqsh-text {
  font-family: var(--naqsh-font-farsi), var(--naqsh-font-latin), system-ui;
}

/* Force specific language */
.naqsh-text-fa { font-family: var(--naqsh-font-farsi); }
.naqsh-text-en { font-family: var(--naqsh-font-latin); }
```

### CSS Variables Implementation

```css
:root {
  /* Font Families */
  --naqsh-font-farsi: 'Vazirmatn', system-ui, sans-serif;
  --naqsh-font-latin: 'Inter', system-ui, sans-serif;
  --naqsh-font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  /* Font Sizes */
  --naqsh-text-xs: 0.75rem;
  --naqsh-text-sm: 0.875rem;
  --naqsh-text-base: 1rem;
  --naqsh-text-lg: 1.125rem;
  --naqsh-text-xl: 1.25rem;
  --naqsh-text-2xl: 1.5rem;
  --naqsh-text-3xl: 1.875rem;
  --naqsh-text-4xl: 2.25rem;
  --naqsh-text-5xl: 3rem;
  
  /* Font Weights */
  --naqsh-font-normal: 400;
  --naqsh-font-medium: 500;
  --naqsh-font-semibold: 600;
  --naqsh-font-bold: 700;
  
  /* Line Heights */
  --naqsh-leading-none: 1;
  --naqsh-leading-tight: 1.25;
  --naqsh-leading-normal: 1.5;
  --naqsh-leading-relaxed: 1.6;
  --naqsh-leading-loose: 1.75;
}
```

---

## 6. Spacing & Layout

### Philosophy

Consistent spacing creates visual rhythm and hierarchy. Naqsh UI uses an 8px base unit system that scales predictably and works well with both RTL and LTR layouts.

### Spacing Scale

Based on 4px increments (with 8px as the primary unit):

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--naqsh-space-0` | 0 | 0px | Reset spacing |
| `--naqsh-space-0.5` | 0.125rem | 2px | Micro adjustments |
| `--naqsh-space-1` | 0.25rem | 4px | Tight spacing, icon gaps |
| `--naqsh-space-2` | 0.5rem | 8px | Default small spacing |
| `--naqsh-space-3` | 0.75rem | 12px | Compact component padding |
| `--naqsh-space-4` | 1rem | 16px | Default component padding |
| `--naqsh-space-5` | 1.25rem | 20px | Medium spacing |
| `--naqsh-space-6` | 1.5rem | 24px | Section spacing |
| `--naqsh-space-8` | 2rem | 32px | Large section spacing |
| `--naqsh-space-10` | 2.5rem | 40px | Page section gaps |
| `--naqsh-space-12` | 3rem | 48px | Major section breaks |
| `--naqsh-space-16` | 4rem | 64px | Page-level spacing |
| `--naqsh-space-20` | 5rem | 80px | Hero sections |
| `--naqsh-space-24` | 6rem | 96px | Large hero spacing |

### Component Spacing Guidelines

| Component Type | Padding | Gap |
|----------------|---------|-----|
| Button (sm) | `space-2 space-3` | - |
| Button (md) | `space-2 space-4` | - |
| Button (lg) | `space-3 space-6` | - |
| Input | `space-2 space-3` | - |
| Card | `space-4` to `space-6` | - |
| Modal | `space-6` | `space-4` |
| Form fields | - | `space-4` |
| Section | `space-8` to `space-12` | `space-6` |

### Layout System

#### Container Widths

| Token | Max Width | Usage |
|-------|-----------|-------|
| `--naqsh-container-sm` | 640px | Narrow content, forms |
| `--naqsh-container-md` | 768px | Medium content |
| `--naqsh-container-lg` | 1024px | Standard content |
| `--naqsh-container-xl` | 1280px | Wide content |
| `--naqsh-container-2xl` | 1536px | Full-width dashboards |

#### Breakpoints

| Token | Value | Target |
|-------|-------|--------|
| `--naqsh-screen-sm` | 640px | Large phones |
| `--naqsh-screen-md` | 768px | Tablets |
| `--naqsh-screen-lg` | 1024px | Small laptops |
| `--naqsh-screen-xl` | 1280px | Desktops |
| `--naqsh-screen-2xl` | 1536px | Large screens |

### Grid System

12-column grid with responsive gutters:

```css
.naqsh-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--naqsh-space-4);
}

/* Responsive gaps */
@media (min-width: 768px) {
  .naqsh-grid { gap: var(--naqsh-space-6); }
}

@media (min-width: 1024px) {
  .naqsh-grid { gap: var(--naqsh-space-8); }
}
```

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--naqsh-radius-none` | 0 | Sharp corners |
| `--naqsh-radius-sm` | 0.25rem (4px) | Subtle rounding |
| `--naqsh-radius-md` | 0.375rem (6px) | Default for inputs, buttons |
| `--naqsh-radius-lg` | 0.5rem (8px) | Cards, modals |
| `--naqsh-radius-xl` | 0.75rem (12px) | Large cards |
| `--naqsh-radius-2xl` | 1rem (16px) | Hero sections |
| `--naqsh-radius-full` | 9999px | Pills, avatars |

### Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--naqsh-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle elevation |
| `--naqsh-shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | Cards, dropdowns |
| `--naqsh-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, popovers |
| `--naqsh-shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Dialogs |

### Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--naqsh-z-base` | 0 | Default |
| `--naqsh-z-dropdown` | 100 | Dropdowns, selects |
| `--naqsh-z-sticky` | 200 | Sticky headers |
| `--naqsh-z-overlay` | 300 | Overlays, backdrops |
| `--naqsh-z-modal` | 400 | Modals, dialogs |
| `--naqsh-z-popover` | 500 | Popovers, tooltips |
| `--naqsh-z-toast` | 600 | Toast notifications |

---

## 7. RTL & Localization

### Philosophy

Naqsh UI is **RTL-first**. This means:
- Components are designed for RTL, then adapted for LTR
- All directional properties use logical properties (start/end, not left/right)
- Icons that imply direction are automatically mirrored
- Testing happens in RTL first

### RTL-First Approach

#### Logical Properties (CSS)

**Always use logical properties instead of physical:**

| ❌ Don't Use | ✅ Use Instead |
|-------------|----------------|
| `margin-left` | `margin-inline-start` |
| `margin-right` | `margin-inline-end` |
| `padding-left` | `padding-inline-start` |
| `padding-right` | `padding-inline-end` |
| `text-align: left` | `text-align: start` |
| `text-align: right` | `text-align: end` |
| `left: 0` | `inset-inline-start: 0` |
| `right: 0` | `inset-inline-end: 0` |
| `border-left` | `border-inline-start` |
| `border-right` | `border-inline-end` |

#### Direction Setup

```css
/* RTL (default for Naqsh UI) */
html[dir="rtl"] {
  direction: rtl;
  font-family: var(--naqsh-font-farsi), var(--naqsh-font-latin);
}

/* LTR */
html[dir="ltr"] {
  direction: ltr;
  font-family: var(--naqsh-font-latin), var(--naqsh-font-farsi);
}
```

### Icon Mirroring

Icons that imply direction should be mirrored in RTL:

**Icons to Mirror:**
- Arrows (→ becomes ←)
- Chevrons (navigation)
- Back/Forward
- Reply/Forward (email)
- Undo/Redo
- Text alignment icons
- List indent/outdent

**Icons NOT to Mirror:**
- Checkmarks ✓
- X/Close ✕
- Plus/Minus
- Search magnifying glass
- Clock/Time
- Media controls (play/pause)
- Question mark

```css
/* Auto-mirror directional icons */
[dir="rtl"] .naqsh-icon-mirror {
  transform: scaleX(-1);
}
```

### Jalali (Shamsi) Calendar

Naqsh UI provides native Jalali calendar support:

#### Date Formats

| Format | Example (Jalali) | Example (Gregorian) |
|--------|------------------|---------------------|
| Short | ۱۴۰۳/۰۹/۲۱ | 2024/12/11 |
| Medium | ۲۱ آذر ۱۴۰۳ | Dec 11, 2024 |
| Long | ۲۱ آذر ۱۴۰۳ هجری شمسی | December 11, 2024 |
| Relative | ۲ روز پیش | 2 days ago |

#### Month Names (Dari/Farsi)

| # | Dari Name | Transliteration |
|---|-----------|-----------------|
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

#### Week Start

- Afghan calendar: Week starts on **Saturday** (شنبه)
- Configure per locale if needed

### Number Formats

#### Persian Numerals

Support both Western (0-9) and Persian (۰-۹) numerals:

| Western | Persian |
|---------|---------|
| 0 | ۰ |
| 1 | ۱ |
| 2 | ۲ |
| 3 | ۳ |
| 4 | ۴ |
| 5 | ۵ |
| 6 | ۶ |
| 7 | ۷ |
| 8 | ۸ |
| 9 | ۹ |

```typescript
// Utility function
function toPersianNumerals(num: number | string): string {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/[0-9]/g, (d) => persianDigits[parseInt(d)]);
}
```

#### Currency Format

| Currency | Format | Example |
|----------|--------|---------|
| Afghani (AFN) | `X افغانی` or `X ؋` | ۱۲۳،۴۵۶ افغانی |
| USD | `$X` | $123,456 |

### Afghan-Specific Validations

#### Phone Numbers

Afghan phone numbers format: `07XX XXX XXXX`

```typescript
const afghanPhoneRegex = /^07[0-9]{8}$/;

// Valid examples:
// 0700123456
// 0799876543
```

#### Tazkira (National ID)

Afghan Tazkira format varies by province. Basic validation:

```typescript
// Tazkira can be numeric or alphanumeric depending on type
const tazkiraRegex = /^[0-9]{1,10}$/; // Simplified
```

#### Postal Codes

Afghanistan uses 4-digit postal codes:

```typescript
const afghanPostalRegex = /^[0-9]{4}$/;
```

### Supported Languages

| Language | Code | Direction | Priority |
|----------|------|-----------|----------|
| Dari (Farsi) | `fa-AF` | RTL | Primary |
| Pashto | `ps` | RTL | Secondary |
| English | `en` | LTR | Tertiary |

### Bidirectional Text Handling

When mixing RTL and LTR text:

```css
/* Isolate embedded opposite-direction text */
.naqsh-bdi {
  unicode-bidi: isolate;
}

/* For user-generated content */
.naqsh-user-content {
  unicode-bidi: plaintext;
}
```

---

## 8. Components

### Component Architecture

Naqsh UI components follow these principles:

1. **Composable**: Small, focused components that combine into complex UIs
2. **Accessible**: WCAG 2.1 AA compliant out of the box
3. **Customizable**: CSS variables for theming, className for overrides
4. **Type-safe**: Full TypeScript definitions
5. **RTL-ready**: Works in both directions without extra configuration

### Component Categories

#### Primitives (Base Components)

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Button` | Primary action trigger | Icon position flips |
| `Input` | Text input field | Text alignment, placeholder |
| `Textarea` | Multi-line text input | Scrollbar position |
| `Select` | Dropdown selection | Dropdown opens correctly |
| `Checkbox` | Boolean selection | Check position |
| `Radio` | Single selection from group | Indicator position |
| `Switch` | Toggle on/off | Slides opposite direction |
| `Slider` | Range selection | Track direction reverses |
| `Toggle` | Button-style toggle | - |

#### Layout Components

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Container` | Max-width wrapper | - |
| `Stack` | Vertical/horizontal stack | Flex direction |
| `Grid` | CSS Grid wrapper | - |
| `Divider` | Visual separator | - |
| `AspectRatio` | Maintain aspect ratio | - |
| `Spacer` | Flexible space | - |

#### Data Display

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Card` | Content container | - |
| `Table` | Data table | Column alignment |
| `Badge` | Status indicator | - |
| `Avatar` | User image/initials | - |
| `Tooltip` | Hover information | Position flips |
| `DataList` | Key-value pairs | Label alignment |
| `Stat` | Statistic display | - |

#### Feedback

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Alert` | Important messages | Icon position |
| `Toast` | Temporary notifications | Position, animation |
| `Progress` | Progress indicator | Fill direction |
| `Spinner` | Loading indicator | - |
| `Skeleton` | Loading placeholder | - |
| `EmptyState` | No data state | - |

#### Overlay

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Modal` | Dialog window | Close button position |
| `Drawer` | Slide-out panel | Slide direction |
| `Popover` | Floating content | Position calculation |
| `Dropdown` | Dropdown menu | Menu alignment |
| `ContextMenu` | Right-click menu | Position |

#### Navigation

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Tabs` | Tab navigation | Tab order |
| `Breadcrumb` | Path navigation | Separator direction |
| `Pagination` | Page navigation | Arrow direction |
| `Stepper` | Multi-step progress | Step order |
| `Sidebar` | Side navigation | Position |
| `Navbar` | Top navigation | Item order |

#### Forms

| Component | Description | RTL Considerations |
|-----------|-------------|-------------------|
| `Form` | Form wrapper | - |
| `FormField` | Label + input + error | Label position |
| `DatePicker` | Date selection (Jalali/Gregorian) | Calendar layout |
| `TimePicker` | Time selection | - |
| `FileUpload` | File input | Button position |
| `PhoneInput` | Afghan phone format | - |
| `TazkiraInput` | National ID input | - |
| `CurrencyInput` | Money input (AFN) | Symbol position |

### Component API Pattern

Every component follows this consistent API pattern:

```typescript
interface ComponentProps {
  // Variants
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  
  // States
  disabled?: boolean;
  loading?: boolean;
  
  // Styling
  className?: string;
  style?: React.CSSProperties;
  
  // Accessibility
  'aria-label'?: string;
  'aria-describedby'?: string;
  
  // Children
  children?: React.ReactNode;
}
```

### Component Variants

#### Button Variants

| Variant | Usage | Visual |
|---------|-------|--------|
| `default` | Primary actions | Solid Lapis Blue |
| `secondary` | Secondary actions | Solid Slate |
| `outline` | Tertiary actions | Border only |
| `ghost` | Subtle actions | No background |
| `destructive` | Dangerous actions | Solid Red |
| `link` | Navigation | Underlined text |

#### Size Scale

| Size | Height | Font Size | Padding |
|------|--------|-----------|---------|
| `sm` | 32px | 14px | 8px 12px |
| `md` | 40px | 16px | 8px 16px |
| `lg` | 48px | 18px | 12px 24px |

### Component States

All interactive components support these states:

| State | Description | Visual Treatment |
|-------|-------------|------------------|
| Default | Normal state | Base styling |
| Hover | Mouse over | Darker/lighter background |
| Focus | Keyboard focus | Focus ring (2px offset) |
| Active | Being clicked | Slightly darker |
| Disabled | Not interactive | 50% opacity, no pointer |
| Loading | Processing | Spinner, disabled |
| Error | Validation failed | Red border, error message |

### Focus Management

```css
/* Focus ring for keyboard navigation */
.naqsh-focus-ring:focus-visible {
  outline: 2px solid var(--naqsh-primary);
  outline-offset: 2px;
}

/* Remove default outline */
.naqsh-focus-ring:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 9. Blocks & Templates

### What are Blocks?

Blocks are pre-built combinations of components that solve common UI patterns. They're larger than components but smaller than full pages.

### Block Categories

#### Authentication Blocks

| Block | Description | Components Used |
|-------|-------------|-----------------|
| `LoginForm` | Email/password login | Input, Button, Form, Link |
| `RegisterForm` | User registration | Input, Select, Button, Form |
| `ForgotPassword` | Password reset request | Input, Button, Form |
| `OTPVerification` | Code verification | Input (OTP style), Button |
| `PasswordStrength` | Password requirements | Progress, List |

#### Dashboard Blocks

| Block | Description | Components Used |
|-------|-------------|-----------------|
| `StatsCards` | Key metrics display | Card, Stat, Icon |
| `RecentActivity` | Activity feed | Card, Avatar, List |
| `QuickActions` | Common action buttons | Card, Button, Icon |
| `ChartCard` | Chart with header | Card, Chart component |
| `WelcomeBanner` | User greeting | Card, Avatar, Text |

#### Data Management Blocks

| Block | Description | Components Used |
|-------|-------------|-----------------|
| `DataTable` | Full-featured table | Table, Pagination, Checkbox |
| `FilterPanel` | Search and filters | Input, Select, Button, DatePicker |
| `BulkActions` | Multi-select actions | Checkbox, Button, Dropdown |
| `ImportExport` | Data import/export | Button, Modal, FileUpload |
| `SearchBar` | Global search | Input, Button, Dropdown |

#### Settings Blocks

| Block | Description | Components Used |
|-------|-------------|-----------------|
| `ProfileForm` | User profile editing | Input, Avatar, Button, Form |
| `PreferencesPanel` | User preferences | Switch, Select, Radio |
| `NotificationSettings` | Notification controls | Switch, Checkbox, Card |
| `SecuritySettings` | Password, 2FA | Input, Button, Switch |

#### Common Blocks

| Block | Description | Components Used |
|-------|-------------|-----------------|
| `Header` | App header | Navbar, Avatar, Dropdown |
| `Sidebar` | Navigation sidebar | Nav, Link, Icon, Divider |
| `Footer` | App footer | Link, Text, Divider |
| `CommandPalette` | Keyboard command menu | Modal, Input, List |
| `EmptyState` | No data placeholder | Icon, Text, Button |
| `ErrorBoundary` | Error display | Card, Button, Text |

### Templates

Templates are full-page layouts combining multiple blocks.

#### Available Templates

| Template | Description | Blocks Used |
|----------|-------------|-------------|
| `DashboardTemplate` | Main app dashboard | Header, Sidebar, StatsCards, RecentActivity |
| `AuthTemplate` | Login/register pages | LoginForm or RegisterForm, centered layout |
| `SettingsTemplate` | Settings pages | Header, Sidebar, ProfileForm, tabs |
| `DataTemplate` | Data management | Header, Sidebar, DataTable, FilterPanel |
| `LandingTemplate` | Marketing page | Hero, Features, CTA sections |
| `ErrorTemplate` | Error pages (404, 500) | ErrorBoundary, centered layout |

### Template Structure

```
┌─────────────────────────────────────────────────┐
│                    Header                        │
├──────────┬──────────────────────────────────────┤
│          │                                       │
│          │                                       │
│ Sidebar  │            Main Content               │
│          │                                       │
│          │                                       │
│          │                                       │
├──────────┴──────────────────────────────────────┤
│                    Footer (optional)             │
└─────────────────────────────────────────────────┘
```

### RTL Template Considerations

In RTL mode:
- Sidebar appears on the **right** side
- Content flows from **right to left**
- Navigation items reverse order
- Icons mirror where appropriate

```css
/* RTL sidebar positioning */
[dir="rtl"] .naqsh-layout {
  grid-template-areas: 
    "header header"
    "content sidebar";
}

[dir="ltr"] .naqsh-layout {
  grid-template-areas: 
    "header header"
    "sidebar content";
}
```

---

## 10. Accessibility

### Commitment

Naqsh UI is committed to WCAG 2.1 Level AA compliance. Every component is built with accessibility as a core requirement, not an afterthought.

### Core Principles

#### 1. Perceivable

| Requirement | Implementation |
|-------------|----------------|
| Text alternatives | All images have alt text, icons have aria-labels |
| Captions | Video/audio content includes captions |
| Color contrast | Minimum 4.5:1 for text, 3:1 for large text |
| Resize | Content readable at 200% zoom |
| Color independence | Information not conveyed by color alone |

#### 2. Operable

| Requirement | Implementation |
|-------------|----------------|
| Keyboard accessible | All functionality available via keyboard |
| Focus visible | Clear focus indicators on all interactive elements |
| Skip links | Skip to main content link provided |
| No time limits | Or adjustable/extendable when necessary |
| No seizure triggers | No flashing content >3 times/second |

#### 3. Understandable

| Requirement | Implementation |
|-------------|----------------|
| Language declared | `lang` attribute on html element |
| Predictable | Consistent navigation and identification |
| Input assistance | Clear labels, error messages, suggestions |
| Error prevention | Confirmation for destructive actions |

#### 4. Robust

| Requirement | Implementation |
|-------------|----------------|
| Valid HTML | Semantic, valid markup |
| ARIA support | Proper ARIA roles, states, properties |
| Compatible | Works with assistive technologies |

### Keyboard Navigation

#### Focus Order

Focus order follows logical reading order (RTL-aware):
1. Skip link (hidden until focused)
2. Header navigation
3. Sidebar (if present)
4. Main content
5. Footer

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Tab` | Move to next focusable element |
| `Shift + Tab` | Move to previous focusable element |
| `Enter` / `Space` | Activate button/link |
| `Escape` | Close modal/dropdown |
| `Arrow keys` | Navigate within components (menus, tabs) |
| `Home` / `End` | Jump to first/last item |

### Focus Indicators

```css
/* Visible focus ring */
:focus-visible {
  outline: 2px solid var(--naqsh-primary);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (forced-colors: active) {
  :focus-visible {
    outline: 3px solid CanvasText;
  }
}
```

### Screen Reader Support

#### ARIA Landmarks

```html
<header role="banner">...</header>
<nav role="navigation" aria-label="Main">...</nav>
<main role="main">...</main>
<aside role="complementary">...</aside>
<footer role="contentinfo">...</footer>
```

#### Live Regions

For dynamic content updates:

```html
<!-- Polite: announced when user is idle -->
<div aria-live="polite" aria-atomic="true">
  <!-- Toast messages -->
</div>

<!-- Assertive: announced immediately -->
<div aria-live="assertive" aria-atomic="true">
  <!-- Error messages -->
</div>
```

### Color Contrast Requirements

| Element | Minimum Ratio | Naqsh UI Compliance |
|---------|---------------|---------------------|
| Normal text | 4.5:1 | ✅ Ink on Paper = 12.5:1 |
| Large text (18px+) | 3:1 | ✅ All headings pass |
| UI components | 3:1 | ✅ All borders, icons pass |
| Focus indicators | 3:1 | ✅ Primary on Paper = 8.2:1 |

### Form Accessibility

```html
<!-- Proper form field structure -->
<div class="naqsh-form-field">
  <label for="email" id="email-label">
    ایمیل
    <span class="naqsh-required" aria-hidden="true">*</span>
  </label>
  <input 
    type="email" 
    id="email"
    aria-labelledby="email-label"
    aria-describedby="email-hint email-error"
    aria-required="true"
    aria-invalid="false"
  />
  <span id="email-hint" class="naqsh-hint">
    ایمیل معتبر وارد کنید
  </span>
  <span id="email-error" class="naqsh-error" role="alert">
    <!-- Error message appears here -->
  </span>
</div>
```

### RTL Accessibility Considerations

1. **Screen readers**: Properly announce RTL text direction
2. **Focus order**: Follows visual RTL order
3. **Arrow keys**: Reversed for RTL navigation
4. **Landmarks**: Same structure, RTL-aware positioning

### Testing Checklist

- [ ] Keyboard-only navigation works
- [ ] Screen reader announces content correctly
- [ ] Focus indicators are visible
- [ ] Color contrast passes WCAG AA
- [ ] Forms have proper labels and error messages
- [ ] Dynamic content updates are announced
- [ ] Works at 200% zoom
- [ ] Works in high contrast mode
- [ ] RTL navigation is logical

---

## 11. Theming

### Theme Architecture

Naqsh UI uses CSS custom properties (variables) for theming, enabling:
- Runtime theme switching
- No build step required for theme changes
- Easy customization per project
- Dark mode support

### Default Themes

#### Light Theme (Default)

```css
:root, [data-theme="light"] {
  /* Colors */
  --naqsh-primary: #003366;
  --naqsh-primary-hover: #002244;
  --naqsh-primary-light: #E6EEF5;
  --naqsh-secondary: #64748B;
  --naqsh-background: #F9F7F2;
  --naqsh-surface: #FFFFFF;
  --naqsh-border: #E2E8F0;
  --naqsh-text: #1A1A1A;
  --naqsh-text-muted: #6B7280;
  
  /* Semantic */
  --naqsh-success: #10B981;
  --naqsh-error: #DC2626;
  --naqsh-warning: #F59E0B;
  --naqsh-info: #0EA5E9;
}
```

#### Dark Theme

```css
[data-theme="dark"] {
  /* Colors */
  --naqsh-primary: #60A5FA;
  --naqsh-primary-hover: #93C5FD;
  --naqsh-primary-light: #1E3A5F;
  --naqsh-secondary: #94A3B8;
  --naqsh-background: #0F172A;
  --naqsh-surface: #1E293B;
  --naqsh-border: #334155;
  --naqsh-text: #F8FAFC;
  --naqsh-text-muted: #94A3B8;
  
  /* Semantic */
  --naqsh-success: #34D399;
  --naqsh-error: #F87171;
  --naqsh-warning: #FBBF24;
  --naqsh-info: #38BDF8;
}
```

### Theme Switching

```typescript
// React hook for theme management
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('naqsh-theme');
    
    if (savedTheme) {
      setTheme(savedTheme as 'light' | 'dark');
    } else if (prefersDark) {
      setTheme('dark');
    }
  }, []);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('naqsh-theme', theme);
  }, [theme]);
  
  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  
  return { theme, setTheme, toggleTheme };
}
```

### Custom Theming

#### Creating a Custom Theme

```css
/* Custom brand theme */
[data-theme="custom-brand"] {
  --naqsh-primary: #7C3AED;        /* Purple */
  --naqsh-primary-hover: #6D28D9;
  --naqsh-primary-light: #EDE9FE;
  --naqsh-background: #FAFAFA;
  --naqsh-surface: #FFFFFF;
  /* ... other overrides */
}
```

#### Per-Component Theming

```css
/* Override specific component */
.my-special-button {
  --naqsh-primary: #059669;
  --naqsh-primary-hover: #047857;
}
```

### Theme Tokens Reference

| Category | Tokens |
|----------|--------|
| **Brand** | `--naqsh-primary`, `--naqsh-primary-hover`, `--naqsh-primary-light`, `--naqsh-secondary` |
| **Background** | `--naqsh-background`, `--naqsh-surface` |
| **Text** | `--naqsh-text`, `--naqsh-text-muted` |
| **Border** | `--naqsh-border` |
| **Semantic** | `--naqsh-success`, `--naqsh-error`, `--naqsh-warning`, `--naqsh-info` |
| **Semantic Light** | `--naqsh-success-light`, `--naqsh-error-light`, `--naqsh-warning-light`, `--naqsh-info-light` |

### System Preference Detection

```css
/* Automatic dark mode based on system preference */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Dark theme variables */
  }
}
```

### Theme Provider (React)

```tsx
interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: 'light' | 'dark' | 'system';
  storageKey?: string;
}

const ThemeContext = createContext<{
  theme: string;
  setTheme: (theme: string) => void;
}>({
  theme: 'light',
  setTheme: () => {},
});

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'naqsh-theme' 
}: ThemeProviderProps) {
  // Implementation
}

export const useTheme = () => useContext(ThemeContext);
```

---

## 12. Usage Guidelines

### Installation

```bash
# Using npm
npm install naqsh-ui

# Using yarn
yarn add naqsh-ui

# Using pnpm
pnpm add naqsh-ui
```

### Quick Start

```tsx
// 1. Import styles
import 'naqsh-ui/styles.css';

// 2. Wrap your app with providers
import { NaqshProvider } from 'naqsh-ui';

function App() {
  return (
    <NaqshProvider 
      direction="rtl" 
      locale="fa-AF"
      theme="light"
    >
      <YourApp />
    </NaqshProvider>
  );
}

// 3. Use components
import { Button, Input, Card } from 'naqsh-ui';

function MyComponent() {
  return (
    <Card>
      <Input label="نام" placeholder="نام خود را وارد کنید" />
      <Button>ثبت</Button>
    </Card>
  );
}
```

### Project Structure Recommendation

```
src/
├── components/
│   ├── ui/              # Naqsh UI components (copied/customized)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── ...
│   └── custom/          # Your custom components
├── styles/
│   ├── globals.css      # Global styles + Naqsh imports
│   └── theme.css        # Theme customizations
├── lib/
│   └── utils.ts         # Utility functions
└── ...
```

### Customization Approaches

#### 1. CSS Variables (Recommended)

Override theme tokens in your CSS:

```css
/* styles/theme.css */
:root {
  --naqsh-primary: #your-brand-color;
  --naqsh-font-farsi: 'Your-Farsi-Font', var(--naqsh-font-farsi);
}
```

#### 2. Component Props

Use built-in variant and size props:

```tsx
<Button variant="outline" size="lg">
  دکمه بزرگ
</Button>
```

#### 3. className Override

Add custom classes for specific styling:

```tsx
<Button className="my-custom-button">
  دکمه سفارشی
</Button>
```

#### 4. Copy & Modify (Shadcn Style)

Copy component source code and modify directly:

```bash
npx naqsh-ui add button
# Copies button.tsx to your components/ui folder
```

### Best Practices

#### Do's ✅

| Practice | Example |
|----------|---------|
| Use semantic colors | `variant="destructive"` for delete buttons |
| Provide labels | Always include `label` prop on form inputs |
| Use RTL-aware spacing | `margin-inline-start` not `margin-left` |
| Test in both directions | Verify UI works in RTL and LTR |
| Include aria labels | `aria-label="بستن"` for icon-only buttons |
| Use proper heading hierarchy | h1 → h2 → h3, don't skip levels |

#### Don'ts ❌

| Avoid | Why |
|-------|-----|
| Hardcoded colors | Breaks theming and dark mode |
| Physical CSS properties | Breaks RTL support |
| Missing form labels | Accessibility violation |
| Inline styles for theming | Hard to maintain |
| Skipping focus states | Keyboard users can't navigate |
| Using color alone for meaning | Color-blind users affected |

### RTL Development Workflow

1. **Start in RTL**: Develop with `dir="rtl"` first
2. **Use logical properties**: `start/end` instead of `left/right`
3. **Test icon mirroring**: Verify directional icons flip correctly
4. **Check text alignment**: Ensure text aligns naturally
5. **Verify LTR**: Switch to `dir="ltr"` and confirm everything works

### Performance Tips

1. **Import only what you need**:
```tsx
// ✅ Good - tree-shakeable
import { Button } from 'naqsh-ui/button';

// ❌ Avoid - imports everything
import { Button } from 'naqsh-ui';
```

2. **Lazy load heavy components**:
```tsx
const DatePicker = lazy(() => import('naqsh-ui/date-picker'));
```

3. **Use CSS variables**: No runtime overhead for theming

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Fonts not loading | Ensure Vazirmatn and Inter are imported |
| RTL not working | Check `dir="rtl"` on html element |
| Dark mode flicker | Use `data-theme` attribute, not class |
| Focus ring not visible | Check if styles are being overridden |
| Jalali calendar wrong | Verify locale is set to `fa-AF` |

---

## Appendix A: Complete CSS Variables Reference

```css
:root {
  /* ==================== COLORS ==================== */
  
  /* Primary */
  --naqsh-primary: #003366;
  --naqsh-primary-hover: #002244;
  --naqsh-primary-light: #E6EEF5;
  --naqsh-primary-foreground: #FFFFFF;
  
  /* Secondary */
  --naqsh-secondary: #64748B;
  --naqsh-secondary-hover: #475569;
  --naqsh-secondary-light: #F1F5F9;
  --naqsh-secondary-foreground: #FFFFFF;
  
  /* Neutrals */
  --naqsh-background: #F9F7F2;
  --naqsh-surface: #FFFFFF;
  --naqsh-border: #E2E8F0;
  --naqsh-ring: #003366;
  
  /* Text */
  --naqsh-text: #1A1A1A;
  --naqsh-text-muted: #6B7280;
  --naqsh-text-placeholder: #9CA3AF;
  
  /* Semantic */
  --naqsh-success: #10B981;
  --naqsh-success-light: #D1FAE5;
  --naqsh-success-foreground: #FFFFFF;
  
  --naqsh-error: #DC2626;
  --naqsh-error-light: #FEE2E2;
  --naqsh-error-foreground: #FFFFFF;
  
  --naqsh-warning: #F59E0B;
  --naqsh-warning-light: #FEF3C7;
  --naqsh-warning-foreground: #1A1A1A;
  
  --naqsh-info: #0EA5E9;
  --naqsh-info-light: #E0F2FE;
  --naqsh-info-foreground: #FFFFFF;
  
  /* ==================== TYPOGRAPHY ==================== */
  
  /* Font Families */
  --naqsh-font-farsi: 'Vazirmatn', system-ui, sans-serif;
  --naqsh-font-latin: 'Inter', system-ui, sans-serif;
  --naqsh-font-mono: 'JetBrains Mono', 'Courier New', monospace;
  
  /* Font Sizes */
  --naqsh-text-xs: 0.75rem;     /* 12px */
  --naqsh-text-sm: 0.875rem;    /* 14px */
  --naqsh-text-base: 1rem;      /* 16px */
  --naqsh-text-lg: 1.125rem;    /* 18px */
  --naqsh-text-xl: 1.25rem;     /* 20px */
  --naqsh-text-2xl: 1.5rem;     /* 24px */
  --naqsh-text-3xl: 1.875rem;   /* 30px */
  --naqsh-text-4xl: 2.25rem;    /* 36px */
  --naqsh-text-5xl: 3rem;       /* 48px */
  
  /* Font Weights */
  --naqsh-font-normal: 400;
  --naqsh-font-medium: 500;
  --naqsh-font-semibold: 600;
  --naqsh-font-bold: 700;
  
  /* Line Heights */
  --naqsh-leading-none: 1;
  --naqsh-leading-tight: 1.25;
  --naqsh-leading-normal: 1.5;
  --naqsh-leading-relaxed: 1.6;
  --naqsh-leading-loose: 1.75;
  
  /* Letter Spacing */
  --naqsh-tracking-tight: -0.025em;
  --naqsh-tracking-normal: 0;
  --naqsh-tracking-wide: 0.025em;
  
  /* ==================== SPACING ==================== */
  
  --naqsh-space-0: 0;
  --naqsh-space-0-5: 0.125rem;  /* 2px */
  --naqsh-space-1: 0.25rem;     /* 4px */
  --naqsh-space-2: 0.5rem;      /* 8px */
  --naqsh-space-3: 0.75rem;     /* 12px */
  --naqsh-space-4: 1rem;        /* 16px */
  --naqsh-space-5: 1.25rem;     /* 20px */
  --naqsh-space-6: 1.5rem;      /* 24px */
  --naqsh-space-8: 2rem;        /* 32px */
  --naqsh-space-10: 2.5rem;     /* 40px */
  --naqsh-space-12: 3rem;       /* 48px */
  --naqsh-space-16: 4rem;       /* 64px */
  --naqsh-space-20: 5rem;       /* 80px */
  --naqsh-space-24: 6rem;       /* 96px */
  
  /* ==================== LAYOUT ==================== */
  
  /* Container Widths */
  --naqsh-container-sm: 640px;
  --naqsh-container-md: 768px;
  --naqsh-container-lg: 1024px;
  --naqsh-container-xl: 1280px;
  --naqsh-container-2xl: 1536px;
  
  /* ==================== BORDERS ==================== */
  
  /* Border Radius */
  --naqsh-radius-none: 0;
  --naqsh-radius-sm: 0.25rem;   /* 4px */
  --naqsh-radius-md: 0.375rem;  /* 6px */
  --naqsh-radius-lg: 0.5rem;    /* 8px */
  --naqsh-radius-xl: 0.75rem;   /* 12px */
  --naqsh-radius-2xl: 1rem;     /* 16px */
  --naqsh-radius-full: 9999px;
  
  /* Border Widths */
  --naqsh-border-width: 1px;
  --naqsh-border-width-2: 2px;
  
  /* ==================== SHADOWS ==================== */
  
  --naqsh-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --naqsh-shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --naqsh-shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.05);
  --naqsh-shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
  
  /* ==================== Z-INDEX ==================== */
  
  --naqsh-z-base: 0;
  --naqsh-z-dropdown: 100;
  --naqsh-z-sticky: 200;
  --naqsh-z-overlay: 300;
  --naqsh-z-modal: 400;
  --naqsh-z-popover: 500;
  --naqsh-z-toast: 600;
  
  /* ==================== TRANSITIONS ==================== */
  
  --naqsh-transition-fast: 150ms;
  --naqsh-transition-normal: 200ms;
  --naqsh-transition-slow: 300ms;
  --naqsh-ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --naqsh-ease-in: cubic-bezier(0.4, 0, 1, 1);
  --naqsh-ease-out: cubic-bezier(0, 0, 0.2, 1);
  --naqsh-ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
}
```

---

## Appendix B: Figma/Design Tool Setup

### Color Styles

Create these color styles in your design tool:

```
Primary/Default     → #003366
Primary/Hover       → #002244
Primary/Light       → #E6EEF5

Secondary/Default   → #64748B
Secondary/Hover     → #475569
Secondary/Light     → #F1F5F9

Neutral/Background  → #F9F7F2
Neutral/Surface     → #FFFFFF
Neutral/Border      → #E2E8F0
Neutral/Text        → #1A1A1A
Neutral/Text Muted  → #6B7280

Semantic/Success    → #10B981
Semantic/Error      → #DC2626
Semantic/Warning    → #F59E0B
Semantic/Info       → #0EA5E9
```

### Text Styles

```
Heading/H1    → Vazirmatn Bold 48px/1.1
Heading/H2    → Vazirmatn Bold 36px/1.2
Heading/H3    → Vazirmatn SemiBold 30px/1.3
Heading/H4    → Vazirmatn SemiBold 24px/1.3
Heading/H5    → Vazirmatn Medium 20px/1.4

Body/Large    → Vazirmatn Regular 18px/1.5
Body/Default  → Vazirmatn Regular 16px/1.6
Body/Small    → Vazirmatn Regular 14px/1.5

Label/Default → Vazirmatn Medium 14px/1.5
Label/Small   → Vazirmatn Medium 12px/1.5

Code/Default  → JetBrains Mono Regular 14px/1.5
```

### Spacing Tokens

```
space-1  → 4px
space-2  → 8px
space-3  → 12px
space-4  → 16px
space-6  → 24px
space-8  → 32px
space-12 → 48px
space-16 → 64px
```

---

## Appendix C: Changelog

### Version 1.0.0 (Initial Release)

- Core design tokens (colors, typography, spacing)
- RTL-first architecture
- Jalali calendar support
- Afghan-specific validations
- 40+ base components
- 15+ blocks
- 6 templates
- Light and dark themes
- Full accessibility compliance

---

## License

Naqsh UI is open-source software licensed under the MIT License.

---

## Credits

Created with ❤️ by **AZA Tech** (آزا تک)

- Ahmadullah Ahmadi - Team Leader
- Ahmad Zobeen Farahmand - Developer

For Afghanistan 🇦🇫 and the world.

---

*"نقش" - Patterns that connect cultures through code.*
