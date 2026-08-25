/**
 * Color utilities for schedule cell color coding
 * Provides consistent, accessible color generation for entities
 *
 * Requirements: 3.2, 3.3, 3.5
 */

/**
 * Simple hash function for strings
 * Produces a consistent numeric hash for any string input
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Convert HSL values to hex color string
 * @param h - Hue (0-360)
 * @param s - Saturation (0-100)
 * @param l - Lightness (0-100)
 * @returns Hex color string (e.g., "#ff5733")
 */
function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r = 0,
    g = 0,
    b = 0;

  if (h >= 0 && h < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (h >= 60 && h < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (h >= 120 && h < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (h >= 180 && h < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (h >= 240 && h < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }

  const toHex = (n: number): string => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Parse a hex color string to RGB values
 * @param hex - Hex color string (e.g., "#ff5733" or "ff5733")
 * @returns RGB object with r, g, b values (0-255)
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  };
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG 2.1 formula
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns Relative luminance (0-1)
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Based on WCAG 2.1 formula
 * @param color1 - First hex color
 * @param color2 - Second hex color
 * @returns Contrast ratio (1-21)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const l1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Generate a consistent color for an entity ID
 * Uses hash-based color generation for consistency
 *
 * Algorithm:
 * 1. Hash the entity ID to a number
 * 2. Map to HSL color space with:
 *    - Hue: 0-360 based on hash
 *    - Saturation: 65-75% for vibrancy
 *    - Lightness: 75-85% for good contrast with dark text
 * 3. Convert to hex color
 *
 * @param entityId - The entity identifier (subject ID or teacher ID)
 * @returns Hex color string (e.g., "#a8d5ba")
 *
 * Requirements: 3.2, 3.3
 */
export function generateEntityColor(entityId: string): string {
  const hash = hashString(entityId);

  // Map hash to HSL values
  const hue = hash % 360;
  const saturation = 65 + (hash % 11); // 65-75%
  const lightness = 75 + (hash % 11); // 75-85%

  return hslToHex(hue, saturation, lightness);
}

/**
 * Check if a color has sufficient contrast with white text
 * Returns true if contrast ratio >= 4.5:1 (WCAG AA standard)
 *
 * @param backgroundColor - Hex color string
 * @returns true if the color has good contrast with white text
 *
 * Requirements: 3.5
 */
export function hasGoodContrast(backgroundColor: string): boolean {
  const WHITE = '#ffffff';
  const contrastRatio = getContrastRatio(backgroundColor, WHITE);
  return contrastRatio >= 4.5;
}

/**
 * Get the appropriate text color (black or white) for a background
 * Chooses the color with better contrast
 *
 * @param backgroundColor - Hex color string
 * @returns "#000000" for dark text or "#ffffff" for light text
 *
 * Requirements: 3.5
 */
export function getContrastTextColor(backgroundColor: string): string {
  const BLACK = '#000000';
  const WHITE = '#ffffff';

  const contrastWithBlack = getContrastRatio(backgroundColor, BLACK);
  const contrastWithWhite = getContrastRatio(backgroundColor, WHITE);

  // Return the color with better contrast
  return contrastWithBlack > contrastWithWhite ? BLACK : WHITE;
}

/**
 * Get the lightness value from a hex color
 * Useful for testing that generated colors are in the expected range
 *
 * @param hex - Hex color string
 * @returns Lightness value (0-100)
 */
export function getColorLightness(hex: string): number {
  const rgb = hexToRgb(hex);

  // Convert RGB to HSL lightness
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  return ((max + min) / 2) * 100;
}
