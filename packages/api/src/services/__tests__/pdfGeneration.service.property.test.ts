/**
 * Property-based tests for PDF Generation Service
 *
 * **Feature: schedule-phase5, Property 5: RTL Layout Application**
 * **Validates: Requirements 5.2**
 *
 * **Feature: schedule-phase5, Property 11: Font Embedding Verification**
 * **Validates: Requirements 5.1**
 *
 * **Feature: schedule-phase5, Property 12: Color Coding Preservation**
 * **Validates: Requirements 7.4**
 */

import * as fc from 'fast-check';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PDFGenerationService,
  type DisplaySettings,
  type PDFGenerationOptions,
  type ScheduleData,
} from '../pdfGeneration.service';

describe('PDF Generation Service Property Tests', () => {
  let pdfService: PDFGenerationService;

  const defaultDisplaySettings: DisplaySettings = {
    showSubjectName: true,
    showTeacherName: true,
    showRoomName: true,
    cellSize: 'normal',
    fontSize: 'md',
    colorBy: 'none',
  };

  const createMockSchedule = (
    id: number,
    name: string,
    type: 'class' | 'teacher'
  ): ScheduleData => ({
    id,
    name,
    type,
    targetId: `${type}_${id}`,
    timetableData: {
      '0': {
        '1': {
          subjectName: 'Math',
          teacherName: 'Teacher A',
          roomName: 'Room 1',
          subjectId: `s${id}_1`,
          teacherId: `t${id}_1`,
          roomId: 'r1',
        },
      },
    },
  });

  beforeEach(() => {
    pdfService = new PDFGenerationService();
  });

  /**
   * **Feature: schedule-phase5, Property 5: RTL Layout Application**
   * **Validates: Requirements 5.2**
   *
   * For any Persian (fa) language export, the generated HTML SHALL have:
   * - dir="rtl" attribute on the html element
   * - RTL-specific CSS styles applied
   * - Proper text alignment for RTL content
   */
  describe('Property 5: RTL Layout Application', () => {
    it('should apply RTL layout for Persian language exports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('fa', 'en'),
          fc.integer({ min: 1, max: 5 }),
          async (language, scheduleCount) => {
            const schedules = Array.from({ length: scheduleCount }, (_, i) =>
              createMockSchedule(i + 1, `Schedule ${i + 1}`, 'class')
            );

            const options: PDFGenerationOptions = {
              schedules,
              language: language as 'fa' | 'en',
              displaySettings: defaultDisplaySettings,
              includeAnalysis: false,
            };

            const htmlContent = await (pdfService as any).generateHTMLContent(options);

            if (language === 'fa') {
              // Persian should have RTL direction
              expect(htmlContent).toContain('dir="rtl"');
              expect(htmlContent).toContain('lang="fa"');
              // CSS should include RTL-specific styles
              expect(htmlContent).toContain('direction: rtl');
            } else {
              // English should have LTR direction
              expect(htmlContent).toContain('dir="ltr"');
              expect(htmlContent).toContain('lang="en"');
              // CSS should include LTR-specific styles
              expect(htmlContent).toContain('direction: ltr');
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should apply correct text alignment based on language direction', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('fa', 'en'), async (language) => {
          const options: PDFGenerationOptions = {
            schedules: [createMockSchedule(1, 'Test', 'class')],
            language: language as 'fa' | 'en',
            displaySettings: defaultDisplaySettings,
            includeAnalysis: false,
          };

          const htmlContent = await (pdfService as any).generateHTMLContent(options);

          if (language === 'fa') {
            // RTL text alignment
            expect(htmlContent).toContain('text-align: right');
          } else {
            // LTR text alignment
            expect(htmlContent).toContain('text-align: left');
          }

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should use appropriate font family for each language', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('fa', 'en'), async (language) => {
          const options: PDFGenerationOptions = {
            schedules: [createMockSchedule(1, 'Test', 'class')],
            language: language as 'fa' | 'en',
            displaySettings: defaultDisplaySettings,
            includeAnalysis: false,
          };

          const htmlContent = await (pdfService as any).generateHTMLContent(options);

          if (language === 'fa') {
            // Persian should use Vazirmatn font
            expect(htmlContent).toContain('Vazirmatn');
          }

          // Both should have a font-family defined
          expect(htmlContent).toContain('font-family:');

          return true;
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * **Feature: schedule-phase5, Property 11: Font Embedding Verification**
   * **Validates: Requirements 5.1**
   *
   * For any PDF export with Persian content, the Vazirmatn font SHALL be
   * embedded or referenced in the generated HTML/CSS.
   */
  describe('Property 11: Font Embedding Verification', () => {
    it('should include font-face declaration for Persian exports', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 3 }),
          fc.constantFrom('sm', 'md', 'lg'),
          async (scheduleCount, fontSize) => {
            const schedules = Array.from({ length: scheduleCount }, (_, i) =>
              createMockSchedule(i + 1, `کلاس ${i + 1}`, 'class')
            );

            const displaySettings: DisplaySettings = {
              ...defaultDisplaySettings,
              fontSize: fontSize as 'sm' | 'md' | 'lg',
            };

            const options: PDFGenerationOptions = {
              schedules,
              language: 'fa',
              displaySettings,
              includeAnalysis: false,
            };

            const htmlContent = await (pdfService as any).generateHTMLContent(options);

            // Should include @font-face declaration
            expect(htmlContent).toContain('@font-face');
            expect(htmlContent).toContain("font-family: 'Vazirmatn'");

            return true;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should handle font loading gracefully with fallback', async () => {
      // Test that font loading doesn't throw errors
      const fontBase64 = await (pdfService as any).getFontBase64();

      // Should return a string (either base64 font data or empty for fallback)
      expect(typeof fontBase64).toBe('string');
    });

    it('should include font display swap for better loading', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const htmlContent = await (pdfService as any).generateHTMLContent(options);

      // Should include font-display: swap for better UX
      expect(htmlContent).toContain('font-display: swap');
    });
  });

  /**
   * **Feature: schedule-phase5, Property 12: Color Coding Preservation**
   * **Validates: Requirements 7.4**
   *
   * For any export with color coding enabled, the same subject/teacher SHALL
   * always receive the same color class across all schedule pages.
   */
  describe('Property 12: Color Coding Preservation', () => {
    it('should assign consistent colors to same subjects across pages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
          async (subjectIds) => {
            const colorMap = new Map<string, string>();

            for (const subjectId of subjectIds) {
              const cellData = { subjectId, teacherId: 'teacher_1' };

              // Get color class multiple times for same subject
              const colorClass1 = (pdfService as any).getCellColorClass(cellData, 'subject');
              const colorClass2 = (pdfService as any).getCellColorClass(cellData, 'subject');

              // Same subject should always get same color
              expect(colorClass1).toBe(colorClass2);

              // Store for cross-subject comparison
              if (colorMap.has(subjectId)) {
                expect(colorMap.get(subjectId)).toBe(colorClass1);
              } else {
                colorMap.set(subjectId, colorClass1);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should assign consistent colors to same teachers across pages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 2, maxLength: 10 }),
          async (teacherIds) => {
            const colorMap = new Map<string, string>();

            for (const teacherId of teacherIds) {
              const cellData = { subjectId: 'subject_1', teacherId };

              // Get color class multiple times for same teacher
              const colorClass1 = (pdfService as any).getCellColorClass(cellData, 'teacher');
              const colorClass2 = (pdfService as any).getCellColorClass(cellData, 'teacher');

              // Same teacher should always get same color
              expect(colorClass1).toBe(colorClass2);

              // Store for cross-teacher comparison
              if (colorMap.has(teacherId)) {
                expect(colorMap.get(teacherId)).toBe(colorClass1);
              } else {
                colorMap.set(teacherId, colorClass1);
              }
            }

            return true;
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should generate valid color class names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('subject', 'teacher'),
          async (id, colorBy) => {
            const cellData =
              colorBy === 'subject'
                ? { subjectId: id, teacherId: 'teacher_1' }
                : { subjectId: 'subject_1', teacherId: id };

            const colorClass = (pdfService as any).getCellColorClass(cellData, colorBy);

            // Should match pattern color-N where N is 0-19
            expect(colorClass).toMatch(/^color-\d+$/);

            // Extract the number and verify it's in valid range
            const colorIndex = parseInt(colorClass.replace('color-', ''), 10);
            expect(colorIndex).toBeGreaterThanOrEqual(0);
            expect(colorIndex).toBeLessThan(20);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should return empty string when colorBy is none', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (subjectId, teacherId) => {
            const cellData = { subjectId, teacherId };
            const colorClass = (pdfService as any).getCellColorClass(cellData, 'none');

            expect(colorClass).toBe('');

            return true;
          }
        ),
        { numRuns: 15 }
      );
    });

    it('should generate color styles in CSS when colorBy is enabled', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constantFrom('subject', 'teacher'), async (colorBy) => {
          const displaySettings: DisplaySettings = {
            ...defaultDisplaySettings,
            colorBy: colorBy as 'none' | 'subject' | 'teacher',
          };

          const options: PDFGenerationOptions = {
            schedules: [createMockSchedule(1, 'Test', 'class')],
            language: 'fa',
            displaySettings,
            includeAnalysis: false,
          };

          const htmlContent = await (pdfService as any).generateHTMLContent(options);

          // Should include color class definitions
          expect(htmlContent).toContain('.color-0');
          expect(htmlContent).toContain('background-color:');

          return true;
        }),
        { numRuns: 10 }
      );
    });

    it('should not generate color styles when colorBy is none', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        colorBy: 'none',
      };

      const colorStyles = (pdfService as any).generateColorStyles('none');

      // Should return empty string for no color coding
      expect(colorStyles).toBe('');
    });
  });
});
