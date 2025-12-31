/**
 * Property-based tests for Excel Generation Service
 *
 * **Feature: schedule-phase5, Property 6: Excel RTL Configuration**
 * **Validates: Requirements 6.1**
 */

import ExcelJS from 'exceljs';
import * as fc from 'fast-check';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplaySettings, ExcelGenerationService, ScheduleData } from '../excelGeneration.service';

// Helper to load Excel buffer with proper type casting
async function loadExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  // Cast to any to avoid type incompatibility between Node Buffer and ExcelJS Buffer
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

describe('Excel Generation Service Property Tests', () => {
  let service: ExcelGenerationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExcelGenerationService();
  });

  // Generator for valid schedule data with unique names
  const scheduleDataArb = (index: number) =>
    fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 25 }).map((s) => {
        const trimmed = s.trim();
        return trimmed.length > 0 ? `${trimmed}-${index}` : `Schedule-${index}`;
      }),
      type: fc.constantFrom('class' as const, 'teacher' as const),
      targetId: fc.string({ minLength: 1, maxLength: 20 }),
      timetableData: fc.constant({}), // Empty timetable for RTL testing
    });

  // Generator for array of schedules with unique names
  const schedulesArrayArb = (minLength: number, maxLength: number) =>
    fc
      .integer({ min: minLength, max: maxLength })
      .chain((length) => fc.tuple(...Array.from({ length }, (_, i) => scheduleDataArb(i))));

  // Generator for display settings
  const displaySettingsArb: fc.Arbitrary<DisplaySettings> = fc.record({
    showSubjectName: fc.boolean(),
    showTeacherName: fc.boolean(),
    showRoomName: fc.boolean(),
    cellSize: fc.constantFrom('compact' as const, 'normal' as const, 'large' as const),
    fontSize: fc.constantFrom('sm' as const, 'md' as const, 'lg' as const),
    colorBy: fc.constantFrom('none' as const, 'subject' as const, 'teacher' as const),
  });

  // Generator for language
  const languageArb = fc.constantFrom('fa' as const, 'en' as const);

  /**
   * **Feature: schedule-phase5, Property 6: Excel RTL Configuration**
   * **Validates: Requirements 6.1**
   *
   * For any Excel export, the generated file SHALL have
   * worksheet.views[0].rightToLeft set to true.
   */
  describe('Property 6: Excel RTL Configuration', () => {
    it('should set rightToLeft=true for all worksheets regardless of language', async () => {
      await fc.assert(
        fc.asyncProperty(
          schedulesArrayArb(1, 3),
          languageArb,
          displaySettingsArb,
          async (schedules, language, displaySettings) => {
            // Generate Excel file
            const buffer = await service.generateExcel({
              schedules: schedules as ScheduleData[],
              language,
              displaySettings,
            });

            // Parse the generated Excel file
            const workbook = await loadExcelBuffer(buffer);

            // Verify each worksheet has RTL configuration
            workbook.eachSheet((worksheet) => {
              expect(worksheet.views).toBeDefined();
              expect(worksheet.views.length).toBeGreaterThan(0);
              expect(worksheet.views[0].rightToLeft).toBe(true);
            });

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);

    it('should create one worksheet per schedule', async () => {
      await fc.assert(
        fc.asyncProperty(
          schedulesArrayArb(1, 5),
          languageArb,
          displaySettingsArb,
          async (schedules, language, displaySettings) => {
            // Generate Excel file
            const buffer = await service.generateExcel({
              schedules: schedules as ScheduleData[],
              language,
              displaySettings,
            });

            // Parse the generated Excel file
            const workbook = await loadExcelBuffer(buffer);

            // Verify worksheet count matches schedule count
            expect(workbook.worksheets.length).toBe(schedules.length);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);

    it('should preserve RTL configuration after worksheet styling', async () => {
      await fc.assert(
        fc.asyncProperty(
          scheduleDataArb(0),
          languageArb,
          displaySettingsArb,
          async (schedule, language, displaySettings) => {
            // Generate Excel file with single schedule
            const buffer = await service.generateExcel({
              schedules: [schedule as ScheduleData],
              language,
              displaySettings,
            });

            // Parse the generated Excel file
            const workbook = await loadExcelBuffer(buffer);

            const worksheet = workbook.worksheets[0];

            // Verify RTL is still set after all styling operations
            expect(worksheet.views[0].rightToLeft).toBe(true);

            // Verify frozen rows are also set (styling was applied)
            // Cast to any to access frozen view properties
            const view = worksheet.views[0] as any;
            expect(view.state).toBe('frozen');
            expect(view.ySplit).toBe(3);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });

  /**
   * Additional property tests for Excel generation
   */
  describe('Excel Generation Additional Properties', () => {
    it('should generate valid Excel buffer for any valid input', async () => {
      await fc.assert(
        fc.asyncProperty(
          schedulesArrayArb(1, 2),
          languageArb,
          displaySettingsArb,
          async (schedules, language, displaySettings) => {
            // Generate Excel file
            const buffer = await service.generateExcel({
              schedules: schedules as ScheduleData[],
              language,
              displaySettings,
            });

            // Verify buffer is valid
            expect(buffer).toBeInstanceOf(Buffer);
            expect(buffer.length).toBeGreaterThan(0);

            // Verify it can be parsed as valid Excel
            const workbook = await loadExcelBuffer(buffer);
            expect(workbook.worksheets.length).toBeGreaterThan(0);

            return true;
          }
        ),
        { numRuns: 30 }
      );
    }, 30000);

    it('should sanitize worksheet names to be Excel-compatible', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate names with potentially problematic characters
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => ({
            id: 1,
            name: s.length > 0 ? s : 'default',
            type: 'class' as const,
            targetId: '1',
            timetableData: {},
          })),
          languageArb,
          displaySettingsArb,
          async (schedule, language, displaySettings) => {
            // Skip empty names
            if (!schedule.name || schedule.name.trim().length === 0) {
              schedule.name = 'default';
            }

            // Generate Excel file
            const buffer = await service.generateExcel({
              schedules: [schedule as ScheduleData],
              language,
              displaySettings,
            });

            // Parse the generated Excel file
            const workbook = await loadExcelBuffer(buffer);

            // Verify worksheet was created with valid name
            expect(workbook.worksheets.length).toBe(1);
            const worksheetName = workbook.worksheets[0].name;

            // Excel worksheet name constraints:
            // - Max 31 characters
            // - Cannot contain: \ / * ? : [ ]
            expect(worksheetName.length).toBeLessThanOrEqual(31);
            expect(worksheetName).not.toMatch(/[\\/*?:\[\]]/);

            return true;
          }
        ),
        { numRuns: 50 }
      );
    }, 30000);
  });
});
