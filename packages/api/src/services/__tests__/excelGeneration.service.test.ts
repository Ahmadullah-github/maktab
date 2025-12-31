/**
 * Unit tests for Excel Generation Service
 *
 * Tests Excel file creation and formatting, RTL configuration,
 * data mapping, and multi-worksheet functionality.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.5
 */

import ExcelJS from 'exceljs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisplaySettings, ExcelGenerationService, ScheduleData } from '../excelGeneration.service';

// Helper to load Excel buffer
async function loadExcelBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  return workbook;
}

describe('ExcelGenerationService', () => {
  let service: ExcelGenerationService;

  const defaultDisplaySettings: DisplaySettings = {
    showSubjectName: true,
    showTeacherName: true,
    showRoomName: true,
    cellSize: 'normal',
    fontSize: 'md',
    colorBy: 'none',
  };

  const createScheduleData = (overrides: Partial<ScheduleData> = {}): ScheduleData => ({
    id: 1,
    name: 'Test Schedule',
    type: 'class',
    targetId: '1',
    timetableData: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExcelGenerationService();
  });

  describe('generateExcel', () => {
    it('should generate a valid Excel buffer', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should create workbook with correct metadata', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      expect(workbook.creator).toBe('Maktab Schedule System');
      expect(workbook.created).toBeInstanceOf(Date);
    });
  });

  describe('RTL Configuration - Requirements 6.1', () => {
    it('should set rightToLeft=true for Persian language', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      expect(worksheet.views[0].rightToLeft).toBe(true);
    });

    it('should set rightToLeft=true for English language as well', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      // RTL is always set for proper Persian support
      expect(worksheet.views[0].rightToLeft).toBe(true);
    });
  });

  describe('Header Formatting - Requirements 6.2', () => {
    it('should include styled headers with Persian day names', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      // Check header row (row 3)
      const headerRow = worksheet.getRow(3);
      expect(headerRow.getCell(1).value).toBe('زمان');
      expect(headerRow.getCell(2).value).toBe('شنبه');
    });

    it('should include styled headers with English day names', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      // Check header row (row 3)
      const headerRow = worksheet.getRow(3);
      expect(headerRow.getCell(1).value).toBe('Time');
      expect(headerRow.getCell(2).value).toBe('Saturday');
    });

    it('should apply header cell styling', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      const headerCell = worksheet.getRow(3).getCell(1);
      expect(headerCell.font?.bold).toBe(true);
      expect(headerCell.fill?.type).toBe('pattern');
    });
  });

  describe('Multi-worksheet Support - Requirements 6.3', () => {
    it('should create one worksheet per schedule', async () => {
      const schedules = [
        createScheduleData({ name: 'Class 10A' }),
        createScheduleData({ id: 2, name: 'Class 10B' }),
        createScheduleData({ id: 3, name: 'Class 10C' }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      expect(workbook.worksheets.length).toBe(3);
    });

    it('should name worksheets based on schedule names', async () => {
      const schedules = [
        createScheduleData({ name: 'Class 10A' }),
        createScheduleData({ id: 2, name: 'Class 10B' }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      expect(workbook.worksheets[0].name).toBe('Class 10A');
      expect(workbook.worksheets[1].name).toBe('Class 10B');
    });

    it('should handle duplicate worksheet names', async () => {
      const schedules = [
        createScheduleData({ name: 'Class A' }),
        createScheduleData({ id: 2, name: 'Class A' }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      expect(workbook.worksheets.length).toBe(2);
      // Second worksheet should have a unique name
      expect(workbook.worksheets[1].name).not.toBe(workbook.worksheets[0].name);
    });
  });

  describe('Cell Structure - Requirements 6.5', () => {
    it('should preserve grid structure with 8 periods and 6 days', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      // Check that we have 8 period rows (rows 4-11)
      for (let period = 1; period <= 8; period++) {
        const row = worksheet.getRow(period + 3);
        expect(row.getCell(1).value).toBe(`ساعت ${period}`);
      }
    });

    it('should apply cell borders', async () => {
      const schedules = [createScheduleData()];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];

      const dataCell = worksheet.getRow(4).getCell(2);
      expect(dataCell.border).toBeDefined();
    });
  });

  describe('Display Settings Integration - Requirements 7.2', () => {
    it('should include teacher name when showTeacherName is true', async () => {
      const schedules = [
        createScheduleData({
          timetableData: {
            lessons: [
              {
                day: 0,
                periodIndex: 1,
                subjectName: 'Math',
                teacherNames: ['Mr. Smith'],
                roomName: 'Room 101',
              },
            ],
          },
        }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: { ...defaultDisplaySettings, showTeacherName: true },
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];
      const cellValue = worksheet.getRow(4).getCell(2).value as string;

      expect(cellValue).toContain('Mr. Smith');
    });

    it('should exclude teacher name when showTeacherName is false', async () => {
      const schedules = [
        createScheduleData({
          timetableData: {
            lessons: [
              {
                day: 0,
                periodIndex: 1,
                subjectName: 'Math',
                teacherNames: ['Mr. Smith'],
                roomName: 'Room 101',
              },
            ],
          },
        }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: { ...defaultDisplaySettings, showTeacherName: false },
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];
      const cellValue = worksheet.getRow(4).getCell(2).value as string;

      expect(cellValue).not.toContain('Mr. Smith');
    });

    it('should exclude room name when showRoomName is false', async () => {
      const schedules = [
        createScheduleData({
          timetableData: {
            lessons: [
              {
                day: 0,
                periodIndex: 1,
                subjectName: 'Math',
                teacherNames: ['Mr. Smith'],
                roomName: 'Room 101',
              },
            ],
          },
        }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: { ...defaultDisplaySettings, showRoomName: false },
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];
      const cellValue = worksheet.getRow(4).getCell(2).value as string;

      expect(cellValue).not.toContain('Room 101');
    });
  });

  describe('Worksheet Name Sanitization', () => {
    it('should sanitize names with invalid characters', async () => {
      const schedules = [createScheduleData({ name: 'Class/10:A*B?C[D]E\\F' })];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheetName = workbook.worksheets[0].name;

      expect(worksheetName).not.toMatch(/[\\/*?:\[\]]/);
    });

    it('should truncate names longer than 31 characters', async () => {
      const schedules = [
        createScheduleData({ name: 'This is a very long worksheet name that exceeds the limit' }),
      ];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheetName = workbook.worksheets[0].name;

      expect(worksheetName.length).toBeLessThanOrEqual(31);
    });

    it('should handle names starting with single quote', async () => {
      const schedules = [createScheduleData({ name: "'Test Class" })];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheetName = workbook.worksheets[0].name;

      expect(worksheetName).not.toMatch(/^'/);
    });

    it('should use default name for empty names', async () => {
      const schedules = [createScheduleData({ name: '' })];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheetName = workbook.worksheets[0].name;

      expect(worksheetName).toBe('Sheet');
    });
  });

  describe('Title Row', () => {
    it('should include title with class type in Persian', async () => {
      const schedules = [createScheduleData({ name: 'Class 10A', type: 'class' })];

      const buffer = await service.generateExcel({
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];
      const titleCell = worksheet.getCell('A1');

      expect(titleCell.value).toContain('کلاس');
      expect(titleCell.value).toContain('Class 10A');
    });

    it('should include title with teacher type in English', async () => {
      const schedules = [createScheduleData({ name: 'Mr. Smith', type: 'teacher' })];

      const buffer = await service.generateExcel({
        schedules,
        language: 'en',
        displaySettings: defaultDisplaySettings,
      });

      const workbook = await loadExcelBuffer(buffer);
      const worksheet = workbook.worksheets[0];
      const titleCell = worksheet.getCell('A1');

      expect(titleCell.value).toContain('Teacher');
      expect(titleCell.value).toContain('Mr. Smith');
    });
  });
});
