/**
 * Section translation utilities
 *
 * Provides functions for translating section values to Farsi labels
 *
 * Requirements: 8.4
 */

import type { Section } from '../types';

/**
 * Section to Farsi label mapping
 * - PRIMARY: ابتدایی (grades 1-6)
 * - MIDDLE: متوسطه (grades 7-9)
 * - HIGH: لیسه (grades 10-12)
 */
export const SECTION_LABELS: Record<Section, string> = {
  PRIMARY: 'ابتدایی',
  MIDDLE: 'متوسطه',
  HIGH: 'لیسه',
  '': '—',
};

/**
 * Translates a section value to its Farsi label
 *
 * @param section - The section value to translate
 * @returns The Farsi label for the section
 *
 * Requirements: 8.4
 */
export function getSectionLabel(section: Section): string {
  return SECTION_LABELS[section] ?? '—';
}

/**
 * All valid section values that have translations
 */
export const VALID_SECTIONS: Section[] = ['PRIMARY', 'MIDDLE', 'HIGH', ''];

/**
 * Checks if a section value has a valid translation
 *
 * @param section - The section value to check
 * @returns True if the section has a valid translation
 */
export function hasValidTranslation(section: Section): boolean {
  return section in SECTION_LABELS;
}
