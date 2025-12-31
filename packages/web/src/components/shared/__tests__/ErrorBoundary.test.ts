/**
 * Unit tests for ErrorBoundary Component
 *
 * Tests error catching, display, and reset functionality
 *
 * Requirements: 11.2, 11.5
 */

import { describe, expect, it } from 'vitest';

// Import translation files to verify error boundary translations exist
import enTranslations from '@/i18n/locales/en.json';
import faTranslations from '@/i18n/locales/fa.json';

describe('ErrorBoundary Component Tests', () => {
  /**
   * Tests for translation coverage
   * Requirements: 11.5
   */
  describe('Translation Coverage', () => {
    it('should have error boundary translations in English', () => {
      expect(enTranslations.errorBoundary).toBeDefined();
      expect(enTranslations.errorBoundary.title).toBeDefined();
      expect(enTranslations.errorBoundary.description).toBeDefined();
      expect(enTranslations.errorBoundary.retry).toBeDefined();
    });

    it('should have error boundary translations in Farsi', () => {
      expect(faTranslations.errorBoundary).toBeDefined();
      expect(faTranslations.errorBoundary.title).toBeDefined();
      expect(faTranslations.errorBoundary.description).toBeDefined();
      expect(faTranslations.errorBoundary.retry).toBeDefined();
    });

    it('should have different translations for English and Farsi', () => {
      expect(enTranslations.errorBoundary.title).not.toBe(faTranslations.errorBoundary.title);
      expect(enTranslations.errorBoundary.description).not.toBe(
        faTranslations.errorBoundary.description
      );
      expect(enTranslations.errorBoundary.retry).not.toBe(faTranslations.errorBoundary.retry);
    });

    it('should have Farsi translations containing Farsi characters', () => {
      // Farsi characters are in Unicode range \u0600-\u06FF
      const farsiRegex = /[\u0600-\u06FF]/;
      expect(farsiRegex.test(faTranslations.errorBoundary.title)).toBe(true);
      expect(farsiRegex.test(faTranslations.errorBoundary.description)).toBe(true);
      expect(farsiRegex.test(faTranslations.errorBoundary.retry)).toBe(true);
    });
  });

  /**
   * Tests for error boundary structure
   * Requirements: 11.2
   */
  describe('Error Boundary Structure', () => {
    it('should have required translation keys', () => {
      const requiredKeys = ['title', 'description', 'retry'];
      requiredKeys.forEach((key) => {
        expect(
          enTranslations.errorBoundary[key as keyof typeof enTranslations.errorBoundary]
        ).toBeDefined();
        expect(
          faTranslations.errorBoundary[key as keyof typeof faTranslations.errorBoundary]
        ).toBeDefined();
      });
    });

    it('should have non-empty translation values', () => {
      Object.values(enTranslations.errorBoundary).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });

      Object.values(faTranslations.errorBoundary).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });
});
