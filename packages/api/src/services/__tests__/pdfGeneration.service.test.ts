/**
 * Unit tests for PDF Generation Service
 * Requirements: 3.1, 3.2, 3.4, 7.2, 7.4
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  PDFGenerationService,
  type AnalysisSummary,
  type DisplaySettings,
  type PDFGenerationOptions,
  type ScheduleData,
} from '../pdfGeneration.service';

describe('PDF Generation Service Unit Tests', () => {
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
          subjectId: 's1',
          teacherId: 't1',
          roomId: 'r1',
        },
        '2': {
          subjectName: 'Science',
          teacherName: 'Teacher B',
          roomName: 'Room 2',
          subjectId: 's2',
          teacherId: 't2',
          roomId: 'r2',
        },
      },
      '1': {
        '1': {
          subjectName: 'English',
          teacherName: 'Teacher C',
          roomName: 'Room 3',
          subjectId: 's3',
          teacherId: 't3',
          roomId: 'r3',
        },
      },
    },
  });

  const createMockAnalysisSummary = (): AnalysisSummary => ({
    totalClasses: 10,
    totalTeachers: 15,
    totalSubjects: 12,
    totalRooms: 8,
    utilizationRate: 85,
    conflictCount: 2,
    generatedAt: new Date().toISOString(),
    schoolName: 'Test School',
  });

  beforeEach(() => {
    pdfService = new PDFGenerationService();
  });

  describe('Display Settings Integration', () => {
    it('should create PDF service instance', () => {
      expect(pdfService).toBeDefined();
    });

    it('should generate cell content with teacher name when showTeacherName is true', () => {
      const cellData = {
        subjectName: 'Mathematics',
        teacherName: 'Ahmad',
        roomName: 'Room 101',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(
        cellData,
        defaultDisplaySettings,
        'fa'
      );

      expect(result).toContain('Mathematics');
      expect(result).toContain('Ahmad');
      expect(result).toContain('Room 101');
      expect(result).toContain('class="teacher-name"');
      expect(result).toContain('class="room-name"');
    });

    it('should exclude teacher name when showTeacherName is false', () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        showTeacherName: false,
      };

      const cellData = {
        subjectName: 'Mathematics',
        teacherName: 'Ahmad',
        roomName: 'Room 101',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(cellData, displaySettings, 'fa');

      expect(result).toContain('Mathematics');
      expect(result).not.toContain('Ahmad');
      expect(result).toContain('Room 101');
      expect(result).not.toContain('class="teacher-name"');
      expect(result).toContain('class="room-name"');
    });

    it('should exclude room name when showRoomName is false', () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        showRoomName: false,
      };

      const cellData = {
        subjectName: 'Mathematics',
        teacherName: 'Ahmad',
        roomName: 'Room 101',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(cellData, displaySettings, 'fa');

      expect(result).toContain('Mathematics');
      expect(result).toContain('Ahmad');
      expect(result).not.toContain('Room 101');
      expect(result).toContain('class="teacher-name"');
      expect(result).not.toContain('class="room-name"');
    });
  });

  describe('Batch PDF Generation - Requirements 3.1, 3.2, 3.4', () => {
    it('should calculate correct page count for batch export with analysis', () => {
      const schedules = [
        createMockSchedule(1, 'Class A', 'class'),
        createMockSchedule(2, 'Class B', 'class'),
        createMockSchedule(3, 'Class C', 'class'),
      ];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const pageCount = pdfService.getExpectedPageCount(options);

      // 3 schedule pages + 1 analysis page = 4 pages
      expect(pageCount).toBe(4);
    });

    it('should calculate correct page count for batch export without analysis', () => {
      const schedules = [
        createMockSchedule(1, 'Class A', 'class'),
        createMockSchedule(2, 'Class B', 'class'),
      ];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const pageCount = pdfService.getExpectedPageCount(options);

      // 2 schedule pages, no analysis page
      expect(pageCount).toBe(2);
    });

    it('should not include analysis page for single schedule export', () => {
      const schedules = [createMockSchedule(1, 'Class A', 'class')];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const pageCount = pdfService.getExpectedPageCount(options);

      // Single schedule = 1 page, no analysis even if requested
      expect(pageCount).toBe(1);
    });

    it('should generate analysis page with correct structure for Persian', () => {
      const summary = createMockAnalysisSummary();
      const result = (pdfService as any).generateAnalysisPage(summary, 'fa', 5);

      // Check Persian labels
      expect(result).toContain('خلاصه تحلیل برنامه درسی');
      expect(result).toContain('آمار مدرسه');
      expect(result).toContain('تعداد کل کلاس‌ها');
      expect(result).toContain('تعداد کل اساتید');
      expect(result).toContain('نرخ استفاده');
      expect(result).toContain('تعداد برنامه‌های شامل');

      // Check values
      expect(result).toContain('10'); // totalClasses
      expect(result).toContain('15'); // totalTeachers
      expect(result).toContain('5'); // scheduleCount
      expect(result).toContain('Test School');
    });

    it('should generate analysis page with correct structure for English', () => {
      const summary = createMockAnalysisSummary();
      const result = (pdfService as any).generateAnalysisPage(summary, 'en', 3);

      // Check English labels
      expect(result).toContain('Schedule Analysis Summary');
      expect(result).toContain('School Statistics');
      expect(result).toContain('Total Classes');
      expect(result).toContain('Total Teachers');
      expect(result).toContain('Utilization Rate');
      expect(result).toContain('Schedules Included');

      // Check values
      expect(result).toContain('10');
      expect(result).toContain('15');
      expect(result).toContain('3');
    });

    it('should generate schedule page with correct title for class type', () => {
      const schedule = createMockSchedule(1, 'Grade 10A', 'class');
      const result = (pdfService as any).generateSchedulePage(
        schedule,
        defaultDisplaySettings,
        'fa'
      );

      expect(result).toContain('برنامه درسی کلاس Grade 10A');
      expect(result).toContain('class="schedule-table"');
    });

    it('should generate schedule page with correct title for teacher type', () => {
      const schedule = createMockSchedule(1, 'Ahmad Teacher', 'teacher');
      const result = (pdfService as any).generateSchedulePage(
        schedule,
        defaultDisplaySettings,
        'fa'
      );

      expect(result).toContain('برنامه درسی استاد Ahmad Teacher');
    });

    it('should generate schedule page in English', () => {
      const schedule = createMockSchedule(1, 'Grade 10A', 'class');
      const result = (pdfService as any).generateSchedulePage(
        schedule,
        defaultDisplaySettings,
        'en'
      );

      expect(result).toContain('Class Grade 10A Schedule');
    });
  });

  describe('Page Numbering and Headers - Requirement 3.2', () => {
    it('should generate header template for Persian', () => {
      const result = (pdfService as any).generateHeaderTemplate('fa');

      expect(result).toContain('برنامه درسی مکتب');
      expect(result).toContain('text-align: center');
    });

    it('should generate header template for English', () => {
      const result = (pdfService as any).generateHeaderTemplate('en');

      expect(result).toContain('Maktab Schedule');
    });

    it('should generate footer template with page numbering for Persian', () => {
      const result = (pdfService as any).generateFooterTemplate('fa');

      expect(result).toContain('صفحه');
      expect(result).toContain('از');
      expect(result).toContain('class="pageNumber"');
      expect(result).toContain('class="totalPages"');
    });

    it('should generate footer template with page numbering for English', () => {
      const result = (pdfService as any).generateFooterTemplate('en');

      expect(result).toContain('Page');
      expect(result).toContain('of');
      expect(result).toContain('class="pageNumber"');
      expect(result).toContain('class="totalPages"');
    });
  });

  describe('Color Coding - Requirement 7.4', () => {
    it('should generate color class for subject-based coloring', () => {
      const cellData = { subjectId: 'math_1', teacherId: 'teacher_1' };
      const result = (pdfService as any).getCellColorClass(cellData, 'subject');

      expect(result).toMatch(/^color-\d+$/);
    });

    it('should generate color class for teacher-based coloring', () => {
      const cellData = { subjectId: 'math_1', teacherId: 'teacher_1' };
      const result = (pdfService as any).getCellColorClass(cellData, 'teacher');

      expect(result).toMatch(/^color-\d+$/);
    });

    it('should return empty string when colorBy is none', () => {
      const cellData = { subjectId: 'math_1', teacherId: 'teacher_1' };
      const result = (pdfService as any).getCellColorClass(cellData, 'none');

      expect(result).toBe('');
    });

    it('should generate consistent color for same subject', () => {
      const cellData = { subjectId: 'math_1', teacherId: 'teacher_1' };
      const result1 = (pdfService as any).getCellColorClass(cellData, 'subject');
      const result2 = (pdfService as any).getCellColorClass(cellData, 'subject');

      expect(result1).toBe(result2);
    });
  });

  describe('HTML Content Generation', () => {
    it('should generate HTML with RTL direction for Persian', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('lang="fa"');
      expect(result).toContain('dir="rtl"');
    });

    it('should generate HTML with LTR direction for English', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'en',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('lang="en"');
      expect(result).toContain('dir="ltr"');
    });

    it('should include page breaks between schedules', async () => {
      const options: PDFGenerationOptions = {
        schedules: [
          createMockSchedule(1, 'Class A', 'class'),
          createMockSchedule(2, 'Class B', 'class'),
        ],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('class="page-break"');
    });

    it('should include analysis page before schedules in batch export', async () => {
      const options: PDFGenerationOptions = {
        schedules: [
          createMockSchedule(1, 'Class A', 'class'),
          createMockSchedule(2, 'Class B', 'class'),
        ],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Analysis page should appear before schedule pages
      const analysisIndex = result.indexOf('analysis-page');
      const scheduleIndex = result.indexOf('schedule-page');

      expect(analysisIndex).toBeGreaterThan(-1);
      expect(scheduleIndex).toBeGreaterThan(-1);
      expect(analysisIndex).toBeLessThan(scheduleIndex);
    });
  });

  describe('Utilization Rate Display', () => {
    it('should display utilization rate correctly when value is percentage (0-100)', () => {
      const summary = { ...createMockAnalysisSummary(), utilizationRate: 85 };
      const result = (pdfService as any).generateAnalysisPage(summary, 'en', 3);

      expect(result).toContain('85%');
    });

    it('should display utilization rate correctly when value is decimal (0-1)', () => {
      const summary = { ...createMockAnalysisSummary(), utilizationRate: 0.85 };
      const result = (pdfService as any).generateAnalysisPage(summary, 'en', 3);

      expect(result).toContain('85%');
    });
  });

  describe('Conflict Warning Display', () => {
    it('should add warning class when conflicts exist', () => {
      const summary = { ...createMockAnalysisSummary(), conflictCount: 5 };
      const result = (pdfService as any).generateAnalysisPage(summary, 'en', 3);

      expect(result).toContain('conflict-warning');
    });

    it('should not add warning class when no conflicts', () => {
      const summary = { ...createMockAnalysisSummary(), conflictCount: 0 };
      const result = (pdfService as any).generateAnalysisPage(summary, 'en', 3);

      expect(result).not.toContain('conflict-warning');
    });
  });

  /**
   * PDF Creation with Various Settings - Requirements 5.1, 5.2, 5.3, 7.4
   */
  describe('PDF Creation with Various Settings', () => {
    it('should apply compact cell size settings', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        cellSize: 'compact',
      };

      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Should generate valid HTML
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html');
    });

    it('should apply large cell size settings', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        cellSize: 'large',
      };

      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should apply small font size', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        fontSize: 'sm',
      };

      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Small font size should be 12px
      expect(result).toContain('font-size: 12px');
    });

    it('should apply large font size', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        fontSize: 'lg',
      };

      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Large font size should be 16px
      expect(result).toContain('font-size: 16px');
    });

    it('should apply medium font size by default', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Medium font size should be 14px
      expect(result).toContain('font-size: 14px');
    });

    it('should hide both teacher and room names when disabled', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        showTeacherName: false,
        showRoomName: false,
      };

      const cellData = {
        subjectName: 'Mathematics',
        teacherName: 'Ahmad',
        roomName: 'Room 101',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(cellData, displaySettings, 'fa');

      expect(result).toContain('Mathematics');
      expect(result).not.toContain('Ahmad');
      expect(result).not.toContain('Room 101');
    });

    it('should handle empty cell data gracefully', () => {
      const result = (pdfService as any).generateCellContent(null, defaultDisplaySettings, 'fa');

      expect(result).toContain('class="cell-content"');
      expect(result).not.toContain('class="subject-name"');
    });

    it('should handle cell data with missing subject name', () => {
      const cellData = {
        subjectName: '',
        teacherName: 'Ahmad',
        roomName: 'Room 101',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(
        cellData,
        defaultDisplaySettings,
        'fa'
      );

      expect(result).toContain('class="cell-content"');
    });
  });

  /**
   * Font Embedding and RTL Layout - Requirements 5.1, 5.2
   */
  describe('Font Embedding and RTL Layout', () => {
    it('should include @font-face declaration for Vazirmatn', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('@font-face');
      expect(result).toContain("font-family: 'Vazirmatn'");
    });

    it('should include font-display: swap for better loading', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('font-display: swap');
    });

    it('should set RTL direction in CSS for Persian', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('direction: rtl');
    });

    it('should set LTR direction in CSS for English', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'en',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('direction: ltr');
    });

    it('should use Vazirmatn font family for Persian content', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain("'Vazirmatn'");
    });

    it('should use Arial font family for English content', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'en',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      expect(result).toContain('Arial, sans-serif');
    });

    it('should handle font loading gracefully with fallback', async () => {
      const fontBase64 = await (pdfService as any).getFontBase64();

      // Should return a string (either base64 data or empty for fallback)
      expect(typeof fontBase64).toBe('string');
    });

    it('should get system font fallback when font file is missing', () => {
      const fallback = (pdfService as any).getSystemFontFallback();

      // Should return empty string to use CSS fallback
      expect(fallback).toBe('');
    });
  });

  /**
   * Batch PDF Structure and Content - Requirements 3.1, 3.2, 3.4
   */
  describe('Batch PDF Structure and Content', () => {
    it('should generate correct number of schedule pages', async () => {
      const schedules = [
        createMockSchedule(1, 'Class A', 'class'),
        createMockSchedule(2, 'Class B', 'class'),
        createMockSchedule(3, 'Class C', 'class'),
      ];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Count schedule pages
      const schedulePageCount = (result.match(/class="page schedule-page"/g) || []).length;
      expect(schedulePageCount).toBe(3);
    });

    it('should include analysis page at the beginning for batch exports', async () => {
      const schedules = [
        createMockSchedule(1, 'Class A', 'class'),
        createMockSchedule(2, 'Class B', 'class'),
      ];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Analysis page should come first
      const analysisIndex = result.indexOf('analysis-page');
      const firstScheduleIndex = result.indexOf('schedule-page');

      expect(analysisIndex).toBeLessThan(firstScheduleIndex);
    });

    it('should not include analysis page for single schedule', async () => {
      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Class A', 'class')],
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Should not contain analysis page content (the actual div with analysis content)
      // The CSS classes may still be defined, but the actual analysis page div should not exist
      expect(result).not.toContain('خلاصه تحلیل برنامه درسی'); // Persian analysis title
      expect(result).not.toContain('آمار مدرسه'); // School stats section
    });

    it('should include page breaks between all pages', async () => {
      const schedules = [
        createMockSchedule(1, 'Class A', 'class'),
        createMockSchedule(2, 'Class B', 'class'),
        createMockSchedule(3, 'Class C', 'class'),
      ];

      const options: PDFGenerationOptions = {
        schedules,
        language: 'fa',
        displaySettings: defaultDisplaySettings,
        includeAnalysis: true,
        analysisSummary: createMockAnalysisSummary(),
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Should have page breaks (N-1 breaks for N pages, plus 1 after analysis)
      const pageBreakCount = (result.match(/class="page-break"/g) || []).length;
      expect(pageBreakCount).toBeGreaterThanOrEqual(3);
    });

    it('should generate schedule table with correct day headers for Persian', () => {
      const schedule = createMockSchedule(1, 'Test', 'class');
      const result = (pdfService as any).generateScheduleTable(
        schedule,
        defaultDisplaySettings,
        'fa'
      );

      // Check Persian day names
      expect(result).toContain('شنبه');
      expect(result).toContain('یکشنبه');
      expect(result).toContain('دوشنبه');
    });

    it('should generate schedule table with correct day headers for English', () => {
      const schedule = createMockSchedule(1, 'Test', 'class');
      const result = (pdfService as any).generateScheduleTable(
        schedule,
        defaultDisplaySettings,
        'en'
      );

      // Check English day names
      expect(result).toContain('Saturday');
      expect(result).toContain('Sunday');
      expect(result).toContain('Monday');
    });

    it('should generate schedule table with period rows', () => {
      const schedule = createMockSchedule(1, 'Test', 'class');
      const result = (pdfService as any).generateScheduleTable(
        schedule,
        defaultDisplaySettings,
        'fa'
      );

      // Check period labels
      expect(result).toContain('ساعت 1');
      expect(result).toContain('ساعت 2');
    });

    it('should apply color coding to schedule cells', async () => {
      const displaySettings: DisplaySettings = {
        ...defaultDisplaySettings,
        colorBy: 'subject',
      };

      const options: PDFGenerationOptions = {
        schedules: [createMockSchedule(1, 'Test', 'class')],
        language: 'fa',
        displaySettings,
        includeAnalysis: false,
      };

      const result = await (pdfService as any).generateHTMLContent(options);

      // Should include color class definitions
      expect(result).toContain('.color-0');
      expect(result).toContain('background-color:');
    });

    it('should escape HTML in cell content to prevent XSS', () => {
      const cellData = {
        subjectName: '<script>alert("xss")</script>',
        teacherName: 'Teacher & Co.',
        roomName: 'Room "101"',
        subjectId: 'math_1',
        teacherId: 'teacher_1',
      };

      const result = (pdfService as any).generateCellContent(
        cellData,
        defaultDisplaySettings,
        'fa'
      );

      // Should escape HTML entities
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&amp;');
      expect(result).toContain('&quot;');
    });

    it('should darken colors correctly for borders', () => {
      const originalColor = '#fef3c7';
      const darkenedColor = (pdfService as any).darkenColor(originalColor, 0.2);

      // Should return a valid hex color
      expect(darkenedColor).toMatch(/^#[0-9a-f]{6}$/i);

      // Should be darker (lower RGB values)
      const originalR = parseInt(originalColor.slice(1, 3), 16);
      const darkenedR = parseInt(darkenedColor.slice(1, 3), 16);
      expect(darkenedR).toBeLessThan(originalR);
    });

    it('should hash strings to consistent color indices', () => {
      const str1 = 'math_subject';
      const str2 = 'math_subject';
      const str3 = 'science_subject';

      const index1 = (pdfService as any).hashStringToIndex(str1, 20);
      const index2 = (pdfService as any).hashStringToIndex(str2, 20);
      const index3 = (pdfService as any).hashStringToIndex(str3, 20);

      // Same string should produce same index
      expect(index1).toBe(index2);

      // Index should be within range
      expect(index1).toBeGreaterThanOrEqual(0);
      expect(index1).toBeLessThan(20);
      expect(index3).toBeGreaterThanOrEqual(0);
      expect(index3).toBeLessThan(20);
    });
  });

  /**
   * Batch PDF Generation Method - Requirements 3.1, 3.4
   */
  describe('Batch PDF Generation Method', () => {
    it('should have generateBatchPDF method', () => {
      expect(typeof pdfService.generateBatchPDF).toBe('function');
    });

    it('should have getExpectedPageCount method', () => {
      expect(typeof pdfService.getExpectedPageCount).toBe('function');
    });

    it('should calculate page count correctly for various scenarios', () => {
      // Single schedule
      expect(
        pdfService.getExpectedPageCount({
          schedules: [createMockSchedule(1, 'A', 'class')],
          language: 'fa',
          displaySettings: defaultDisplaySettings,
          includeAnalysis: true,
          analysisSummary: createMockAnalysisSummary(),
        })
      ).toBe(1);

      // Multiple schedules with analysis
      expect(
        pdfService.getExpectedPageCount({
          schedules: [createMockSchedule(1, 'A', 'class'), createMockSchedule(2, 'B', 'class')],
          language: 'fa',
          displaySettings: defaultDisplaySettings,
          includeAnalysis: true,
          analysisSummary: createMockAnalysisSummary(),
        })
      ).toBe(3);

      // Multiple schedules without analysis
      expect(
        pdfService.getExpectedPageCount({
          schedules: [createMockSchedule(1, 'A', 'class'), createMockSchedule(2, 'B', 'class')],
          language: 'fa',
          displaySettings: defaultDisplaySettings,
          includeAnalysis: false,
        })
      ).toBe(2);
    });
  });

  /**
   * Cleanup Method
   */
  describe('Cleanup', () => {
    it('should have cleanup method', () => {
      expect(typeof pdfService.cleanup).toBe('function');
    });

    it('should cleanup without errors', async () => {
      await expect(pdfService.cleanup()).resolves.not.toThrow();
    });
  });
});
