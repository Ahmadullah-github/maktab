import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ClassGroup } from '../entity/ClassGroup';
import { Teacher } from '../entity/Teacher';
import { Timetable } from '../entity/Timetable';
import { AnalysisGenerationService } from './analysisGeneration.service';
import { ExcelGenerationService } from './excelGeneration.service';
import { FileCleanupService } from './fileCleanup.service';
import { PDFGenerationService } from './pdfGeneration.service';

/**
 * Export format options
 */
export type ExportFormat = 'pdf' | 'excel';

/**
 * Export scope options
 */
export type ExportScope = 'current' | 'all-classes' | 'all-teachers';

/**
 * Export language options
 */
export type ExportLanguage = 'fa' | 'en';

/**
 * Display settings for export
 */
export interface DisplaySettings {
  showSubjectName: boolean;
  showTeacherName: boolean;
  showRoomName: boolean;
  cellSize: 'compact' | 'normal' | 'large';
  fontSize: 'sm' | 'md' | 'lg';
  colorBy: 'none' | 'subject' | 'teacher';
}

/**
 * Export request payload
 * Requirements: 2.1, 8.1
 */
export interface ExportRequest {
  scheduleId: number;
  format: ExportFormat;
  scope: ExportScope;
  targetType: 'class' | 'teacher';
  targetId?: string;
  language: ExportLanguage;
  displaySettings: DisplaySettings;
  includeAnalysis?: boolean;
}

/**
 * Export response from backend
 * Requirements: 2.1, 8.2, 8.4
 */
export interface ExportResponse {
  success: boolean;
  downloadUrl: string;
  filename: string;
  expiresAt: string;
  fileSize: number;
  pageCount?: number;
}

/**
 * Export job response for batch operations
 * Requirements: 4.1
 */
export interface ExportJobResponse {
  jobId: string;
  status: 'started' | 'in_progress' | 'completed' | 'failed';
  downloadUrl?: string;
  filename?: string;
  expiresAt?: string;
  fileSize?: number;
  pageCount?: number;
}

/**
 * Export progress information for batch operations
 * Requirements: 4.1, 4.2
 */
export interface ExportProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
  message: string;
}

/**
 * Schedule data structure for export
 */
export interface ScheduleData {
  id: number;
  name: string;
  type: 'class' | 'teacher';
  targetId: string;
  timetableData: any; // Parsed JSON from Timetable.data
}

/**
 * Main export service orchestrator
 * Requirements: 2.1, 8.3, 8.5
 *
 * Handles export request processing, temporary file management,
 * and coordination between PDF/Excel generation services
 */
export class ExportService {
  private readonly tempDir: string;
  private readonly downloadBaseUrl: string;
  private readonly urlExpirationHours: number = 1;

  constructor(
    private readonly pdfService: PDFGenerationService,
    private readonly excelService: ExcelGenerationService,
    private readonly analysisService: AnalysisGenerationService,
    private readonly fileCleanupService: FileCleanupService,
    tempDir: string = './temp/exports',
    downloadBaseUrl: string = '/api/export/download'
  ) {
    this.tempDir = tempDir;
    this.downloadBaseUrl = downloadBaseUrl;
    this.ensureTempDirectory();
  }

  /**
   * Main export orchestration method
   * Requirements: 2.1, 8.3, 8.5
   */
  async exportSchedule(request: ExportRequest): Promise<ExportResponse> {
    try {
      // Validate batch size limit (max 50 schedules)
      // Requirements: 3.5
      if (request.scope !== 'current') {
        const scheduleCount = await this.getScheduleCount(request.scope);
        if (scheduleCount > 50) {
          throw new Error('Batch export limited to maximum 50 schedules');
        }
      }

      // Fetch schedule data based on scope
      const schedules = await this.fetchScheduleData(request);

      // Generate analysis summary for batch exports
      let analysisSummary = null;
      if (request.includeAnalysis && schedules.length > 1) {
        analysisSummary = await this.analysisService.generateAnalysisSummary(schedules);
      }

      // Generate file based on format
      let fileBuffer: Buffer;
      let pageCount: number | undefined;

      if (request.format === 'pdf') {
        fileBuffer = await this.pdfService.generatePDF({
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
          includeAnalysis: request.includeAnalysis || false,
          analysisSummary: analysisSummary || undefined,
        });
        // For batch exports, page count = schedules + 1 analysis page
        pageCount = schedules.length + (analysisSummary ? 1 : 0);
      } else {
        fileBuffer = await this.excelService.generateExcel({
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
        });
      }

      // Generate filename following convention
      // Requirements: 2.5, 8.4
      const filename = this.generateFilename(request, schedules);

      // Save file to temporary directory
      const fileId = uuidv4();
      const filePath = path.join(this.tempDir, `${fileId}_${filename}`);

      // Ensure temp directory exists before writing
      await this.ensureTempDirectory();
      await fs.writeFile(filePath, fileBuffer);

      // Create download URL with expiration
      const downloadToken = uuidv4();
      const expiresAt = new Date(Date.now() + this.urlExpirationHours * 60 * 60 * 1000);
      const downloadUrl = `${this.downloadBaseUrl}/${downloadToken}`;

      // Schedule file cleanup
      await this.fileCleanupService.scheduleCleanup(filePath, expiresAt);

      // Store download token mapping (in production, use Redis or database)
      await this.storeDownloadMapping(downloadToken, filePath, expiresAt);

      return {
        success: true,
        downloadUrl,
        filename,
        expiresAt: expiresAt.toISOString(),
        fileSize: fileBuffer.length,
        pageCount,
      };
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get count of schedules for batch export validation
   * Requirements: 3.5
   */
  private async getScheduleCount(scope: ExportScope): Promise<number> {
    if (scope === 'all-classes') {
      return await ClassGroup.count({ where: { isDeleted: false } });
    } else if (scope === 'all-teachers') {
      return await Teacher.count({ where: { isDeleted: false } });
    }
    return 1;
  }

  /**
   * Fetch schedule data based on export scope
   * Requirements: 2.1, 3.1, 3.2
   */
  private async fetchScheduleData(request: ExportRequest): Promise<ScheduleData[]> {
    const schedules: ScheduleData[] = [];

    if (request.scope === 'current') {
      // Single schedule export
      const timetable = await Timetable.findOne({
        where: { id: request.scheduleId, isDeleted: false },
      });

      if (!timetable) {
        throw new Error('Schedule not found');
      }

      schedules.push({
        id: timetable.id,
        name: timetable.name,
        type: request.targetType,
        targetId: request.targetId || '',
        timetableData: JSON.parse(timetable.data || '{}'),
      });
    } else if (request.scope === 'all-classes') {
      // Batch export for all classes
      const classes = await ClassGroup.find({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      });

      for (const classGroup of classes) {
        // Find timetable for this class (simplified - in real implementation,
        // you'd need to match based on the timetable structure)
        const timetable = await Timetable.findOne({
          where: { isDeleted: false },
        });

        if (timetable) {
          schedules.push({
            id: classGroup.id,
            name: classGroup.name,
            type: 'class',
            targetId: classGroup.id.toString(),
            timetableData: JSON.parse(timetable.data || '{}'),
          });
        }
      }
    } else if (request.scope === 'all-teachers') {
      // Batch export for all teachers
      const teachers = await Teacher.find({
        where: { isDeleted: false },
        order: { fullName: 'ASC' },
      });

      for (const teacher of teachers) {
        // Find timetable for this teacher
        const timetable = await Timetable.findOne({
          where: { isDeleted: false },
        });

        if (timetable) {
          schedules.push({
            id: teacher.id,
            name: teacher.fullName,
            type: 'teacher',
            targetId: teacher.id.toString(),
            timetableData: JSON.parse(timetable.data || '{}'),
          });
        }
      }
    }

    return schedules;
  }

  /**
   * Generate filename following naming convention
   * Requirements: 2.5, 8.4
   * Pattern: schedule_{scope-prefix}{type}_{name}_{lang}_{date}.{ext}
   */
  private generateFilename(request: ExportRequest, schedules: ScheduleData[]): string {
    const date = new Date().toISOString().split('T')[0];
    const scopePrefix = request.scope === 'current' ? '' : 'all-';
    const extension = request.format === 'pdf' ? 'pdf' : 'xlsx';

    let name: string;
    if (request.scope === 'current' && schedules.length > 0) {
      // Use the actual schedule name, sanitized
      name = this.sanitizeFilename(schedules[0].name);
    } else {
      // Use generic name for batch exports
      name = 'school';
    }

    return `schedule_${scopePrefix}${request.targetType}_${name}_${request.language}_${date}.${extension}`;
  }

  /**
   * Sanitize filename by removing invalid characters
   */
  private sanitizeFilename(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u200C\u200D-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  /**
   * Ensure temporary directory exists
   */
  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.access(this.tempDir);
    } catch {
      await fs.mkdir(this.tempDir, { recursive: true });
    }
  }

  /**
   * Store download token mapping (simplified implementation)
   * In production, use Redis or database
   * Requirements: 8.3
   */
  private async storeDownloadMapping(
    token: string,
    filePath: string,
    expiresAt: Date
  ): Promise<void> {
    // This is a simplified implementation
    // In production, store in Redis or database with TTL
    const mapping = {
      token,
      filePath,
      expiresAt: expiresAt.toISOString(),
    };

    const mappingPath = path.join(this.tempDir, `${token}.json`);
    await fs.writeFile(mappingPath, JSON.stringify(mapping));
  }

  /**
   * Retrieve file path from download token
   * Requirements: 8.3
   */
  async getFilePathFromToken(token: string): Promise<string | null> {
    try {
      const mappingPath = path.join(this.tempDir, `${token}.json`);
      const mappingData = await fs.readFile(mappingPath, 'utf-8');
      const mapping = JSON.parse(mappingData);

      // Check if token has expired
      const expiresAt = new Date(mapping.expiresAt);
      if (new Date() > expiresAt) {
        // Clean up expired mapping
        await fs.unlink(mappingPath).catch(() => {});
        return null;
      }

      return mapping.filePath;
    } catch {
      return null;
    }
  }

  /**
   * Start a batch export operation with job tracking
   * Returns a job ID for progress polling
   * Requirements: 4.1, 4.2
   */
  async startBatchExport(request: ExportRequest): Promise<ExportJobResponse> {
    const jobTracker = getJobTracker();

    // Validate batch size limit (max 50 schedules)
    // Requirements: 3.5
    const scheduleCount = await this.getScheduleCount(request.scope);
    if (scheduleCount > 50) {
      throw new Error('Batch export limited to maximum 50 schedules');
    }

    // Create job for tracking
    const jobId = jobTracker.createJob({
      total: scheduleCount,
      message: 'Preparing export...',
    });

    // Start async export process
    this.processBatchExport(jobId, request).catch((error) => {
      console.error('Batch export failed:', error);
      jobTracker.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
    });

    return {
      jobId,
      status: 'started',
    };
  }

  /**
   * Process batch export asynchronously with progress updates
   * Requirements: 4.1, 4.2
   */
  private async processBatchExport(jobId: string, request: ExportRequest): Promise<void> {
    const jobTracker = getJobTracker();

    try {
      // Check for cancellation
      if (jobTracker.isJobCancelled(jobId)) {
        return;
      }

      // Update status to generating
      jobTracker.updateJob(jobId, {
        status: 'generating',
        message: 'Fetching schedule data...',
      });

      // Fetch schedule data based on scope
      const schedules = await this.fetchScheduleData(request);

      // Check for cancellation
      if (jobTracker.isJobCancelled(jobId)) {
        return;
      }

      // Update total count based on actual schedules
      jobTracker.updateJob(jobId, {
        total: schedules.length,
        current: 0,
      });

      // Generate analysis summary for batch exports
      let analysisSummary = null;
      if (request.includeAnalysis && schedules.length > 1) {
        jobTracker.updateJob(jobId, {
          message: 'Generating analysis summary...',
        });
        analysisSummary = await this.analysisService.generateAnalysisSummary(schedules);
      }

      // Check for cancellation
      if (jobTracker.isJobCancelled(jobId)) {
        return;
      }

      // Generate file based on format with progress updates
      let fileBuffer: Buffer;
      let pageCount: number | undefined;

      if (request.format === 'pdf') {
        // Update progress for each schedule during PDF generation
        for (let i = 0; i < schedules.length; i++) {
          if (jobTracker.isJobCancelled(jobId)) {
            return;
          }
          jobTracker.updateJob(jobId, {
            current: i + 1,
            message: `Generating ${i + 1} of ${schedules.length}...`,
          });
        }

        fileBuffer = await this.pdfService.generatePDF({
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
          includeAnalysis: request.includeAnalysis || false,
          analysisSummary: analysisSummary || undefined,
        });
        pageCount = schedules.length + (analysisSummary ? 1 : 0);
      } else {
        // Update progress for Excel generation
        for (let i = 0; i < schedules.length; i++) {
          if (jobTracker.isJobCancelled(jobId)) {
            return;
          }
          jobTracker.updateJob(jobId, {
            current: i + 1,
            message: `Generating ${i + 1} of ${schedules.length}...`,
          });
        }

        fileBuffer = await this.excelService.generateExcel({
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
        });
      }

      // Check for cancellation
      if (jobTracker.isJobCancelled(jobId)) {
        return;
      }

      // Update status to finalizing
      jobTracker.updateJob(jobId, {
        status: 'finalizing',
        message: 'Saving file...',
      });

      // Generate filename following convention
      const filename = this.generateFilename(request, schedules);

      // Save file to temporary directory
      const fileId = uuidv4();
      const filePath = path.join(this.tempDir, `${fileId}_${filename}`);

      await this.ensureTempDirectory();
      await fs.writeFile(filePath, fileBuffer);

      // Create download URL with expiration
      const downloadToken = uuidv4();
      const expiresAt = new Date(Date.now() + this.urlExpirationHours * 60 * 60 * 1000);
      const downloadUrl = `${this.downloadBaseUrl}/${downloadToken}`;

      // Schedule file cleanup
      await this.fileCleanupService.scheduleCleanup(filePath, expiresAt);

      // Store download token mapping
      await this.storeDownloadMapping(downloadToken, filePath, expiresAt);

      // Mark job as complete
      jobTracker.completeJob(jobId, downloadUrl, filename, fileBuffer.length, expiresAt, pageCount);
    } catch (error) {
      console.error('Batch export processing failed:', error);
      jobTracker.failJob(jobId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Cancel an ongoing batch export
   * Requirements: 4.3
   */
  cancelBatchExport(jobId: string): boolean {
    const jobTracker = getJobTracker();
    return jobTracker.cancelJob(jobId);
  }

  /**
   * Get progress of a batch export job
   * Requirements: 4.1, 4.2
   */
  getBatchExportProgress(jobId: string): ExportProgress | null {
    const jobTracker = getJobTracker();
    return jobTracker.getProgress(jobId);
  }

  /**
   * Get full job information including download URL
   * Requirements: 4.1
   */
  getBatchExportJob(jobId: string): ExportJobResponse | null {
    const jobTracker = getJobTracker();
    const job = jobTracker.getJob(jobId);

    if (!job) {
      return null;
    }

    const statusMap: Record<string, 'started' | 'in_progress' | 'completed' | 'failed'> = {
      preparing: 'started',
      generating: 'in_progress',
      finalizing: 'in_progress',
      complete: 'completed',
      error: 'failed',
      cancelled: 'failed',
    };

    return {
      jobId: job.jobId,
      status: statusMap[job.progress.status] || 'in_progress',
      downloadUrl: job.downloadUrl,
      filename: job.filename,
      expiresAt: job.expiresAt?.toISOString(),
      fileSize: job.fileSize,
      pageCount: job.pageCount,
    };
  }
}
