/**
 * Tests for Bilingual Support Analyzer
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeBilingualSupport,
  generateBilingualFindings,
  extractBilingualPairs
} from '../bilingual-analyzer';
import { FindingCategory, Severity } from '../../analysis-types';

describe('Bilingual Analyzer', () => {
  const mockEnTranslations = {
    school: {
      name: 'School Name',
      description: 'School Description'
    }
  };

  const mockFaTranslations = {
    school: {
      name: 'نام مکتب',
      description: 'توضیحات مکتب'
    }
  };

  describe('analyzeBilingualSupport', () => {
    it('should detect missing RTL handling', () => {
      const content = `
        export function TestComponent() {
          return <div className="text-left">Content</div>;
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content);

      expect(analysis.rtlHandling.length).toBeGreaterThan(0);
      expect(analysis.rtlHandling.some(issue => issue.includes('No RTL direction handling'))).toBe(true);
    });

    it('should detect RTL handling when present', () => {
      const content = `
        export function TestComponent() {
          const { isRTL } = useLanguageCtx();
          return <div dir={isRTL ? "rtl" : "ltr"}>Content</div>;
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content);

      expect(analysis.rtlHandling.length).toBe(0);
    });

    it('should detect hardcoded directional spacing', () => {
      const content = `
        export function TestComponent() {
          const { isRTL } = useLanguageCtx();
          return (
            <div dir={isRTL ? "rtl" : "ltr"}>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
              <div className="ml-4 mr-2 pl-3 pr-1">Content</div>
            </div>
          );
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content);

      expect(analysis.rtlHandling.some(issue => issue.includes('left/right spacing'))).toBe(true);
    });

    it('should detect missing translations', () => {
      const content = `
        export function TestComponent() {
          const { t } = useLanguageCtx();
          return <div>{t.school.name} {t.school.missingKey}</div>;
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content, mockEnTranslations, mockFaTranslations);

      expect(analysis.translationGaps.length).toBeGreaterThan(0);
      expect(analysis.translationGaps.some(issue => issue.includes('missingKey'))).toBe(true);
    });

    it('should detect hardcoded English text', () => {
      const content = `
        export function TestComponent() {
          return <div>Hardcoded English Text Here</div>;
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content, mockEnTranslations, mockFaTranslations);

      expect(analysis.translationGaps.some(issue => issue.includes('hardcoded English text'))).toBe(true);
    });

    it('should detect missing numeral localization', () => {
      const content = `
        export function TestComponent() {
          return (
            <div>
              <span>123</span>
              <span>456</span>
              <span>789</span>
              <span>1011</span>
            </div>
          );
        }
      `;

      const analysis = analyzeBilingualSupport('test.tsx', content);

      expect(analysis.numeralLocalization.some(issue => issue.includes('hardcoded number'))).toBe(true);
    });
  });

  describe('generateBilingualFindings', () => {
    it('should generate findings for RTL issues', () => {
      const analysis = {
        rtlHandling: ['No RTL direction handling detected in test.tsx'],
        translationGaps: [],
        fontLoading: [],
        numeralLocalization: []
      };

      const findings = generateBilingualFindings('test-step', 'test.tsx', analysis);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe(FindingCategory.Bilingual);
      expect(findings[0].severity).toBe(Severity.High);
      expect(findings[0].title).toContain('RTL');
    });

    it('should generate findings for translation gaps', () => {
      const analysis = {
        rtlHandling: [],
        translationGaps: ['Translation key "test.key" missing in Persian translations'],
        fontLoading: [],
        numeralLocalization: []
      };

      const findings = generateBilingualFindings('test-step', 'test.tsx', analysis);

      expect(findings.length).toBeGreaterThan(0);
      expect(findings[0].category).toBe(FindingCategory.Bilingual);
      expect(findings[0].title).toContain('translation');
    });

    it('should include code snippets in findings', () => {
      const analysis = {
        rtlHandling: ['No RTL direction handling detected in test.tsx'],
        translationGaps: [],
        fontLoading: [],
        numeralLocalization: []
      };

      const findings = generateBilingualFindings('test-step', 'test.tsx', analysis);

      expect(findings[0].codeSnippet).toBeDefined();
      expect(findings[0].codeSnippet).toContain('isRTL');
    });
  });

  describe('extractBilingualPairs', () => {
    it('should extract bilingual text pairs', () => {
      const content = `
        export function TestComponent() {
          const { t } = useLanguageCtx();
          return <div>{t.school.name}</div>;
        }
      `;

      const pairs = extractBilingualPairs(content, mockEnTranslations, mockFaTranslations);

      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0].en).toBe('School Name');
      expect(pairs[0].fa).toBe('نام مکتب');
    });

    it('should handle multiple translation keys', () => {
      const content = `
        export function TestComponent() {
          const { t } = useLanguageCtx();
          return (
            <div>
              <span>{t.school.name}</span>
              <span>{t.school.description}</span>
            </div>
          );
        }
      `;

      const pairs = extractBilingualPairs(content, mockEnTranslations, mockFaTranslations);

      expect(pairs.length).toBe(2);
      expect(pairs.some(p => p.en === 'School Name')).toBe(true);
      expect(pairs.some(p => p.en === 'School Description')).toBe(true);
    });
  });
});
