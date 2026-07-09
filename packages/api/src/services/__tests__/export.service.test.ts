/**
 * Unit tests for Export Service
 * Requirements: 2.1, 8.3, 8.5
 */

import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClassGroup } from '../../entity/ClassGroup';
import { Room } from '../../entity/Room';
import { Subject } from '../../entity/Subject';
import { Teacher } from '../../entity/Teacher';
import { Timetable } from '../../entity/Timetable';
import { AnalysisSummary } from '../analysisGeneration.service';
import { ExportRequest, ExportService } from '../export.service';

// In-memory SQLite database for testing
let dataSource: DataSource;

// Mock services
const mockPDFService = {
  generatePDF: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
};

const mockExcelService = {
  generateExcel: vi.fn().mockResolvedValue(Buffer.from('mock-excel-content')),
};

const mockAnalysisService = {
  generateAnalysisSummary: vi.fn(),
};

const mockFileCleanupService = {
  scheduleCleanup: vi.fn().mockResolvedValue(undefined),
  cleanupExpiredFiles: vi.fn().mockResolvedValue(undefined),
  createArchive: vi.fn().mockResolvedValue(Buffer.from('mock-archive')),
};

describe('Export Service Unit Tests', () => {
  let exportService: ExportService;

  beforeAll(async () => {
    // Create in-memory SQLite database for testing
    dataSource = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: [ClassGroup, Teacher, Subject, Room, Timetable],
      synchronize: true,
      logging: false,
    });

    await dataSource.initialize();

    // Create export service with mocked dependencies
    exportService = new ExportService(
      mockPDFService as any,
      mockExcelService as any,
      mockAnalysisService as any,
      mockFileCleanupService as any,
      './temp/test-exports',
      '/api/test/download'
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all entities before each test
    await dataSource.getRepository(ClassGroup).clear();
    await dataSource.getRepository(Teacher).clear();
    await dataSource.getRepository(Subject).clear();
    await dataSource.getRepository(Room).clear();
    await dataSource.getRepository(Timetable).clear();

    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Export Orchestration Logic', () => {
    it('should export single PDF schedule successfully', async () => {
      // Create test data
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      const result = await exportService.exportSchedule(exportRequest);

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('/api/test/download/');
      expect(result.filename).toMatch(/^schedule_class_.*\.pdf$/);
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.expiresAt).toBeDefined();
      expect(result.pageCount).toBe(1);

      // Verify PDF service was called
      expect(mockPDFService.generatePDF).toHaveBeenCalledWith({
        schedules: expect.any(Array),
        language: 'fa',
        displaySettings: exportRequest.displaySettings,
        includeAnalysis: false,
        analysisSummary: undefined,
      });

      // Verify file cleanup was scheduled
      expect(mockFileCleanupService.scheduleCleanup).toHaveBeenCalled();
    });

    it('should export single Excel schedule successfully', async () => {
      // Create test data
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'excel',
        scope: 'current',
        targetType: 'teacher',
        targetId: '1',
        language: 'en',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: false,
          showRoomName: true,
          cellSize: 'compact',
          fontSize: 'sm',
          colorBy: 'subject',
        },
      };

      const result = await exportService.exportSchedule(exportRequest);

      expect(result.success).toBe(true);
      expect(result.downloadUrl).toContain('/api/test/download/');
      expect(result.filename).toMatch(/^schedule_teacher_.*\.xlsx$/);
      expect(result.fileSize).toBeGreaterThan(0);
      expect(result.pageCount).toBeUndefined(); // Excel doesn't have page count

      // Verify Excel service was called
      expect(mockExcelService.generateExcel).toHaveBeenCalledWith({
        schedules: expect.any(Array),
        language: 'en',
        displaySettings: exportRequest.displaySettings,
      });
    });

    it('should handle batch export with analysis', async () => {
      // Create test data
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      // Create multiple classes
      for (let i = 0; i < 3; i++) {
        const classGroup = new ClassGroup();
        classGroup.name = `Class ${i + 1}`;
        await dataSource.getRepository(ClassGroup).save(classGroup);
      }

      const mockAnalysisSummary: AnalysisSummary = {
        totalClasses: 3,
        totalTeachers: 5,
        totalSubjects: 8,
        totalRooms: 6,
        utilizationRate: 85,
        conflictCount: 0,
        generatedAt: new Date().toISOString(),
        schoolName: 'Test School',
      };

      mockAnalysisService.generateAnalysisSummary.mockResolvedValue(mockAnalysisSummary);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'all-classes',
        targetType: 'class',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
        includeAnalysis: true,
      };

      const result = await exportService.exportSchedule(exportRequest);

      expect(result.success).toBe(true);
      expect(result.pageCount).toBe(4); // 3 classes + 1 analysis page

      // Verify analysis service was called
      expect(mockAnalysisService.generateAnalysisSummary).toHaveBeenCalled();

      // Verify PDF service was called with analysis
      expect(mockPDFService.generatePDF).toHaveBeenCalledWith({
        schedules: expect.any(Array),
        language: 'fa',
        displaySettings: exportRequest.displaySettings,
        includeAnalysis: true,
        analysisSummary: mockAnalysisSummary,
      });
    });
  });

  describe('File Management and Cleanup', () => {
    it('should schedule file cleanup after export', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      await exportService.exportSchedule(exportRequest);

      // Verify cleanup was scheduled
      expect(mockFileCleanupService.scheduleCleanup).toHaveBeenCalledWith(
        expect.stringContaining('schedule_class_'),
        expect.any(Date)
      );
    });

    it('should generate correct filename for different scenarios', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Class 10-A';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'excel',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'en',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      const result = await exportService.exportSchedule(exportRequest);

      // Verify filename follows convention: schedule_{type}_{name}_{lang}_{date}.{ext}
      expect(result.filename).toMatch(
        /^schedule_class_test-class-10-a_en_\d{4}-\d{2}-\d{2}\.xlsx$/
      );
    });

    it('should set correct expiration time (1 hour)', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      const beforeExport = new Date();
      const result = await exportService.exportSchedule(exportRequest);
      const afterExport = new Date();

      const expiresAt = new Date(result.expiresAt);
      const expectedMinExpiration = new Date(beforeExport.getTime() + 60 * 60 * 1000);
      const expectedMaxExpiration = new Date(afterExport.getTime() + 60 * 60 * 1000);

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMinExpiration.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMaxExpiration.getTime());
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle missing timetable gracefully', async () => {
      const exportRequest: ExportRequest = {
        scheduleId: 999, // Non-existent ID
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      await expect(exportService.exportSchedule(exportRequest)).rejects.toThrow(
        'Schedule not found'
      );
    });

    it('should enforce batch size limit (50 schedules)', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      // Create 51 classes (exceeds limit)
      for (let i = 0; i < 51; i++) {
        const classGroup = new ClassGroup();
        classGroup.name = `Class ${i + 1}`;
        await dataSource.getRepository(ClassGroup).save(classGroup);
      }

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'all-classes',
        targetType: 'class',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      await expect(exportService.exportSchedule(exportRequest)).rejects.toThrow(
        'maximum 50 schedules'
      );
    });

    it('should handle PDF generation failure', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      // Mock PDF service to throw error
      mockPDFService.generatePDF.mockRejectedValueOnce(new Error('PDF generation failed'));

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      await expect(exportService.exportSchedule(exportRequest)).rejects.toThrow(
        'Export failed: PDF generation failed'
      );
    });

    it('should handle Excel generation failure', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      // Mock Excel service to throw error
      mockExcelService.generateExcel.mockRejectedValueOnce(new Error('Excel generation failed'));

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'excel',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      await expect(exportService.exportSchedule(exportRequest)).rejects.toThrow(
        'Export failed: Excel generation failed'
      );
    });

    it('should handle analysis generation failure gracefully', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      // Create multiple classes for batch export
      for (let i = 0; i < 2; i++) {
        const classGroup = new ClassGroup();
        classGroup.name = `Class ${i + 1}`;
        await dataSource.getRepository(ClassGroup).save(classGroup);
      }

      // Mock analysis service to throw error
      mockAnalysisService.generateAnalysisSummary.mockRejectedValueOnce(
        new Error('Analysis failed')
      );

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'all-classes',
        targetType: 'class',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
        includeAnalysis: true,
      };

      await expect(exportService.exportSchedule(exportRequest)).rejects.toThrow(
        'Export failed: Analysis failed'
      );
    });
  });

  describe('Download Token Management', () => {
    it('should retrieve file path from valid token', async () => {
      const timetable = new Timetable();
      timetable.name = 'Test Timetable';
      timetable.data = JSON.stringify({ test: 'data' });
      await dataSource.getRepository(Timetable).save(timetable);

      const exportRequest: ExportRequest = {
        scheduleId: timetable.id,
        format: 'pdf',
        scope: 'current',
        targetType: 'class',
        targetId: '1',
        language: 'fa',
        displaySettings: {
          showSubjectName: true,
          showTeacherName: true,
          showRoomName: true,
          cellSize: 'normal',
          fontSize: 'md',
          colorBy: 'none',
        },
      };

      const result = await exportService.exportSchedule(exportRequest);

      // Extract token from download URL
      const token = result.downloadUrl.split('/').pop();
      expect(token).toBeDefined();

      // Should be able to retrieve file path (simplified test)
      const filePath = await exportService.getFilePathFromToken(token!);
      expect(filePath).toContain('schedule_class_');
    });

    it('should return null for invalid token', async () => {
      const filePath = await exportService.getFilePathFromToken('invalid-token');
      expect(filePath).toBeNull();
    });
  });
});
