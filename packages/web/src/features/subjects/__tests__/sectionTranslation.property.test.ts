/**
 * Property-based tests for section translation
 *
 * **Feature: subjects-feature, Property 7: Section Translation Mapping**
 * **Validates: Requirements 8.4**
 *
 * *For any* section value (PRIMARY, MIDDLE, HIGH), the translation function
 * should consistently return the corresponding Farsi label (ابتدایی, متوسطه, لیسه).
 */

import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Section } from '../types';
import {
  getSectionLabel,
  hasValidTranslation,
  SECTION_LABELS,
  VALID_SECTIONS,
} from '../utils/sectionTranslation';

/**
 * Arbitrary generator for valid section values
 */
const sectionArb: fc.Arbitrary<Section> = fc.constantFrom('PRIMARY', 'MIDDLE', 'HIGH', '' as const);

/**
 * Arbitrary generator for non-empty section values (excluding empty string)
 */
const nonEmptySectionArb: fc.Arbitrary<'PRIMARY' | 'MIDDLE' | 'HIGH'> = fc.constantFrom(
  'PRIMARY',
  'MIDDLE',
  'HIGH'
);

describe('Section Translation Property Tests', () => {
  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * Every valid section should have a non-empty translation
   */
  it('Property 7: Every valid section has a non-empty translation', () => {
    fc.assert(
      fc.property(nonEmptySectionArb, (section) => {
        const label = getSectionLabel(section);
        return label !== '' && label !== '—' && label.length > 0;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * Translation should be deterministic - same input always produces same output
   */
  it('Property 7: Translation is deterministic', () => {
    fc.assert(
      fc.property(sectionArb, (section) => {
        const label1 = getSectionLabel(section);
        const label2 = getSectionLabel(section);
        return label1 === label2;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * Different sections should have different translations (bijective mapping)
   */
  it('Property 7: Different sections have different translations', () => {
    fc.assert(
      fc.property(nonEmptySectionArb, nonEmptySectionArb, (section1, section2) => {
        // If sections are different, their translations should be different
        if (section1 !== section2) {
          const label1 = getSectionLabel(section1);
          const label2 = getSectionLabel(section2);
          return label1 !== label2;
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * All valid sections should have valid translations
   */
  it('Property 7: All valid sections have valid translations', () => {
    fc.assert(
      fc.property(sectionArb, (section) => {
        return hasValidTranslation(section);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * Translation should return expected Farsi labels
   */
  it('Property 7: Translations match expected Farsi labels', () => {
    // Verify specific mappings
    expect(getSectionLabel('PRIMARY')).toBe('ابتدایی');
    expect(getSectionLabel('MIDDLE')).toBe('متوسطه');
    expect(getSectionLabel('HIGH')).toBe('لیسه');
    expect(getSectionLabel('')).toBe('—');
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * SECTION_LABELS constant should contain all valid sections
   */
  it('Property 7: SECTION_LABELS contains all valid sections', () => {
    fc.assert(
      fc.property(sectionArb, (section) => {
        return section in SECTION_LABELS;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * VALID_SECTIONS array should contain all section values
   */
  it('Property 7: VALID_SECTIONS contains all section values', () => {
    fc.assert(
      fc.property(sectionArb, (section) => {
        return VALID_SECTIONS.includes(section);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: subjects-feature, Property 7: Section Translation Mapping**
   * **Validates: Requirements 8.4**
   *
   * Translation labels should be Farsi strings (contain Farsi characters or dash)
   */
  it('Property 7: Translation labels are Farsi strings or dash', () => {
    // Farsi Unicode range: \u0600-\u06FF (Arabic script used for Farsi)
    const farsiOrDashRegex = /^[\u0600-\u06FF]+$|^—$/;

    fc.assert(
      fc.property(sectionArb, (section) => {
        const label = getSectionLabel(section);
        return farsiOrDashRegex.test(label);
      }),
      { numRuns: 100 }
    );
  });
});
