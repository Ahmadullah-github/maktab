# Intelligent Subject Color System

## Overview

The schedule grid now uses an intelligent per-subject color system that
provides:

- **Distinct colors** for each subject (16+ predefined + 20 auto-generated)
- **Consistent colors** across sessions (same subject = same color)
- **Automatic color generation** for new/unknown subjects
- **WCAG AA accessibility** (all colors meet contrast standards)

## Predefined Subject Colors

### Math & Sciences

| Subject           | Color   | HSL           |
| ----------------- | ------- | ------------- |
| ریاضی / Math      | Blue    | 217, 91%, 90% |
| فزیک / Physics    | Purple  | 280, 67%, 90% |
| کیمیا / Chemistry | Amber   | 38, 92%, 90%  |
| بیولوژی / Biology | Emerald | 142, 71%, 90% |

### Languages

| Subject           | Color  | HSL           |
| ----------------- | ------ | ------------- |
| انگلیسی / English | Cyan   | 189, 94%, 90% |
| دری / Dari        | Rose   | 350, 89%, 90% |
| پشتو / Pashto     | Indigo | 239, 84%, 90% |
| عربی / Arabic     | Teal   | 173, 80%, 90% |

### Social Studies

| Subject             | Color    | HSL           |
| ------------------- | -------- | ------------- |
| تاریخ / History     | Orange   | 25, 95%, 90%  |
| جغرافیه / Geography | Pink     | 330, 81%, 90% |
| اجتماعی / Social    | Sky Blue | 200, 98%, 90% |

### PE & Arts

| Subject           | Color   | HSL           |
| ----------------- | ------- | ------------- |
| ورزش / Sport / PE | Lime    | 84, 81%, 90%  |
| هنر / Art         | Violet  | 262, 83%, 90% |
| موسیقی / Music    | Fuchsia | 291, 64%, 90% |

### Other

| Subject            | Color      | HSL           |
| ------------------ | ---------- | ------------- |
| دین / Religion     | Yellow     | 45, 93%, 90%  |
| کمپیوتر / Computer | Light Blue | 207, 90%, 90% |

## Auto-Generated Colors

For subjects not in the predefined list, the system automatically generates a
color using:

1. **Hash algorithm** - Consistent color for same subject name
2. **Curated palette** - 20 distinct, accessible colors
3. **Fallback matching** - Partial name matching (e.g., "ریاضی پیشرفته" matches
   "ریاضی")

### Auto-Color Palette

- Mint, Coral, Purple-Blue, Red-Orange, Turquoise
- Magenta, Yellow-Green, Blue-Violet, Peach, Sea Green
- Hot Pink, Chartreuse, Periwinkle, Burnt Orange, Aqua
- Orchid, Spring Green, Cornflower, Tomato, Medium Aquamarine

## How It Works

### Color Selection Logic

```
1. Check exact match in predefined colors
2. Check partial match (substring)
3. Generate from auto-color palette using hash
```

### Example

- "ریاضی" → Blue (predefined)
- "ریاضی پیشرفته" → Blue (partial match)
- "علوم اجتماعی" → Sky Blue (partial match with "اجتماعی")
- "نجوم" (Astronomy) → Auto-generated (e.g., Mint)

## Adding New Predefined Colors

To add a new subject to the predefined list, edit:
`packages/web/src/features/schedule/utils/subjectColors.ts`

```typescript
const SUBJECT_COLOR_MAP: Record<string, [string, string, string]> = {
  // Add new entry:
  subject_name: ['H, S%, L%', 'H, S%, L%', 'H, S%, L%'],
  //               ↑ background  ↑ border    ↑ text
};
```

### Color Guidelines

- **Background**: Lightness 88-92% (very light)
- **Border**: Lightness 45-60% (medium)
- **Text**: Lightness 25-30% (dark, readable)
- **Saturation**: 70-95% (vibrant but not overwhelming)

## Benefits

✅ **Visual Clarity** - Each subject is instantly recognizable ✅
**Consistency** - Same subject always has same color ✅ **Scalability** -
Supports unlimited subjects ✅ **Accessibility** - All colors meet WCAG AA
standards ✅ **No Configuration** - Works automatically for new subjects
