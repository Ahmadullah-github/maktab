/**
 * Subject Color Mapping Utility
 * Intelligent per-subject color system with STRONG VISUAL DISTINCTION
 *
 * Philosophy:
 * - Hue family separation (no neighbors on color wheel)
 * - Mix of cool/warm/neutral tones
 * - Strong base colors with lighter backgrounds
 * - Professional, scannable at a glance
 */

/**
 * Base color definitions for subjects
 * Format: [Hue, Saturation, Lightness] for the BORDER (identity color)
 *
 * Strategy:
 * - Hue: Spread across full spectrum with ≥40° separation
 * - Saturation: 45-90% (strong, not pastel)
 * - Lightness: 38-48% (medium, visible borders)
 */
type HSL = [number, number, number];

const SUBJECT_BASE_COLORS: Record<string, HSL> = {
  // Sciences - Cool Blues, Warm Orange, Green
  ریاضی: [215, 85, 45], // Deep Blue
  math: [215, 85, 45],
  mathematics: [215, 85, 45],

  فزیک: [245, 75, 42], // Indigo (distinct from blue)
  physics: [245, 75, 42],

  کیمیا: [28, 90, 48], // Strong Orange
  chemistry: [28, 90, 48],

  بیولوژی: [145, 65, 42], // Green
  biology: [145, 65, 42],

  // Languages - Diverse spectrum
  انگلیسی: [190, 85, 40], // Teal
  english: [190, 85, 40],

  دری: [350, 70, 45], // Crimson
  dari: [350, 70, 45],

  پشتو: [225, 70, 38], // Navy
  pashto: [225, 70, 38],

  عربی: [95, 45, 42], // Olive
  arabic: [95, 45, 42],

  // Social Studies - Warm tones
  تاریخ: [18, 85, 45], // Burnt Orange
  history: [18, 85, 45],

  جغرافیه: [32, 45, 40], // Earth Brown
  جغرافیا: [32, 45, 40],
  geography: [32, 45, 40],

  اجتماعی: [200, 80, 42], // Sky Blue
  social: [200, 80, 42],

  // Tech - Cyan
  کمپیوتر: [205, 90, 42], // Cyan Blue
  computer: [205, 90, 42],
  it: [205, 90, 42],

  // Arts - Purple/Magenta
  هنر: [275, 65, 45], // Purple
  art: [275, 65, 45],
  arts: [275, 65, 45],

  موسیقی: [305, 70, 45], // Magenta
  music: [305, 70, 45],

  // Religion - Gold
  دین: [48, 90, 45], // Gold
  religion: [48, 90, 45],
  islamic: [48, 90, 45],

  // Sport - Lime
  ورزش: [88, 80, 42], // Lime
  'تربیت بدنی': [88, 80, 42],
  sport: [88, 80, 42],
  pe: [88, 80, 42],
  physical: [88, 80, 42],
};

/**
 * Auto-generated color palette for unknown subjects
 * 20 distinct colors spread across hue spectrum
 */
const AUTO_COLOR_BASE: HSL[] = [
  [160, 70, 42], // Mint
  [15, 85, 45], // Red-Orange
  [270, 65, 42], // Purple-Blue
  [340, 75, 45], // Coral
  [195, 85, 40], // Turquoise
  [310, 65, 45], // Magenta
  [100, 65, 42], // Yellow-Green
  [260, 60, 40], // Blue-Violet
  [35, 85, 45], // Peach
  [155, 70, 40], // Sea Green
  [320, 70, 45], // Hot Pink
  [75, 60, 42], // Chartreuse
  [250, 75, 42], // Periwinkle
  [20, 88, 45], // Burnt Orange
  [185, 80, 40], // Aqua
  [300, 65, 45], // Orchid
  [90, 70, 40], // Spring Green
  [230, 70, 42], // Cornflower
  [10, 82, 45], // Tomato
  [165, 75, 40], // Medium Aquamarine
];

/**
 * Derive display colors from base HSL
 * - Background: Lighter version (88% lightness)
 * - Border: Base color (identity)
 * - Text: Always pure black for consistency (no auto-switching)
 */
function deriveColors([h, s, l]: HSL): { bg: string; border: string; text: string } {
  return {
    bg: `hsl(${h} ${s}% 88%)`,
    border: `hsl(${h} ${s}% ${l}%)`,
    text: 'hsl(0 0% 0%)', // Pure black for all subjects
  };
}

/**
 * Simple hash function for consistent color assignment
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Get base color for a subject
 * Returns HSL triplet for the identity color
 */
function getSubjectBaseColor(subjectName: string): HSL {
  const normalized = subjectName.toLowerCase().trim();

  // Check predefined colors first
  if (SUBJECT_BASE_COLORS[normalized]) {
    return SUBJECT_BASE_COLORS[normalized];
  }

  // Check if any predefined key is contained in the subject name
  for (const [key, color] of Object.entries(SUBJECT_BASE_COLORS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return color;
    }
  }

  // Generate color from palette using hash
  const hash = hashString(normalized);
  const colorIndex = hash % AUTO_COLOR_BASE.length;
  return AUTO_COLOR_BASE[colorIndex];
}

/**
 * Color configuration for subjects
 * Returns inline styles for background, border, and text colors
 */
export interface SubjectColors {
  bg: string;
  border: string;
  text: string;
  style: React.CSSProperties;
}

/**
 * Gets color styles for a subject
 * Uses predefined colors for common subjects, auto-generates for new ones
 *
 * @param subjectName - The name of the subject (English or Dari/Farsi)
 * @returns Object with inline styles for background, border, and text colors
 *
 * Features:
 * - STRONG visual distinction (no "pink soup")
 * - Consistent colors (same subject = same color)
 * - Pure black text for all subjects (no auto-switching)
 * - Professional appearance
 * - Automatic for new subjects
 */
export function getSubjectColors(subjectName: string): SubjectColors {
  const baseColor = getSubjectBaseColor(subjectName);
  const colors = deriveColors(baseColor);

  return {
    bg: '',
    border: '',
    text: '',
    style: {
      backgroundColor: colors.bg,
      borderColor: colors.border,
      color: colors.text,
      fontWeight: '700', // Full weight (bold) for subject names
    },
  };
}
