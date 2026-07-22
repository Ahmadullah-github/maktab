import * as fs from 'fs/promises';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ClassGroup } from '../entity/ClassGroup';
import { Room } from '../entity/Room';
import { Subject } from '../entity/Subject';
import { Teacher } from '../entity/Teacher';
import { Timetable } from '../entity/Timetable';
import { SchoolProfile } from '../entity/SchoolProfile';
import { ExportBranding } from '../types/exportBranding.types';
import { AnalysisGenerationService } from './analysisGeneration.service';
import { ExcelGenerationService } from './excelGeneration.service';
import { ExportError, ExportErrorHandler } from './exportError.service';
import {
  filterTimetableForTarget,
  normalizeTimetableForExport,
  resolveTargetName,
} from './exportTimetableNormalizer';
import { FileCleanupService } from './fileCleanup.service';
import { getJobTracker } from './jobTracker.service';
import { PDFGenerationService } from './pdfGeneration.service';
import {
  isSchoolLogoMimeType,
  SchoolLogoStorageService,
} from './schoolLogoStorage.service';

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
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error' | 'cancelled';
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
  classTeacherName?: string | null;
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
  private ministryLogoPromise: Promise<string> | null = null;

  constructor(
    private readonly dataSource: DataSource,
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
          throw ExportErrorHandler.batchLimitError(scheduleCount);
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
      let branding: ExportBranding;
      try {
        branding = await this.getExportBranding(request.language, true);
      } catch (error) {
        throw this.asGenerationError(error, request.format, schedules.length, request.language);
      }

      if (request.format === 'pdf') {
        const pdfOptions = {
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
          includeAnalysis: request.includeAnalysis || false,
          analysisSummary: analysisSummary || undefined,
          branding,
        };
        try {
          fileBuffer = await this.pdfService.generatePDF(pdfOptions);
        } catch (error) {
          throw this.asGenerationError(error, 'pdf', schedules.length, request.language);
        }
        pageCount = this.pdfService.getExpectedPageCount(pdfOptions);
      } else {
        try {
          fileBuffer = await this.excelService.generateExcel({
            schedules,
            language: request.language,
            displaySettings: request.displaySettings,
            branding,
          });
        } catch (error) {
          throw this.asGenerationError(error, 'excel', schedules.length, request.language);
        }
      }

      // Generate filename following convention
      // Requirements: 2.5, 8.4
      const filename = this.generateFilename(request, schedules);

      // Save file to temporary directory
      const fileId = uuidv4();
      const filePath = path.join(this.tempDir, `${fileId}_${filename}`);

      // Ensure temp directory exists before writing
      try {
        await this.ensureTempDirectory();
        await fs.writeFile(filePath, fileBuffer);
      } catch (error) {
        throw ExportErrorHandler.fileWriteError(
          error instanceof Error ? error : new Error(String(error)),
          filePath
        );
      }

      // Create download URL with expiration
      const downloadToken = uuidv4();
      const expiresAt = new Date(Date.now() + this.urlExpirationHours * 60 * 60 * 1000);
      const downloadUrl = `${this.downloadBaseUrl}/${downloadToken}`;

      // Schedule file cleanup
      try {
        await this.fileCleanupService.scheduleCleanup(filePath, expiresAt);
        // Store download token mapping (in production, use Redis or database)
        await this.storeDownloadMapping(downloadToken, filePath, expiresAt);
      } catch (error) {
        throw ExportErrorHandler.fileWriteError(
          error instanceof Error ? error : new Error(String(error)),
          filePath
        );
      }

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
      throw ExportErrorHandler.wrapError(error);
    }
  }

  /**
   * Get count of schedules for batch export validation
   * Requirements: 3.5
   */
  private async getScheduleCount(scope: ExportScope): Promise<number> {
    if (scope === 'all-classes') {
      return this.dataSource.getRepository(ClassGroup).count({ where: { isDeleted: false } });
    } else if (scope === 'all-teachers') {
      return this.dataSource.getRepository(Teacher).count({ where: { isDeleted: false } });
    }
    return 1;
  }

  /**
   * Fetch schedule data based on export scope
   * Requirements: 2.1, 3.1, 3.2
   */
  private async fetchScheduleData(request: ExportRequest): Promise<ScheduleData[]> {
    const timetable = await this.dataSource.getRepository(Timetable).findOne({
      where: { id: request.scheduleId, isDeleted: false },
    });

    if (!timetable) {
      throw ExportErrorHandler.scheduleNotFoundError(request.scheduleId);
    }

    const lookups = await this.getEntityNameLookups();
    const normalizedTimetable = normalizeTimetableForExport(timetable.data, lookups);

    if (request.scope === 'current') {
      if (!request.targetId) {
        throw ExportErrorHandler.validationError('targetId is required for a current export', {
          field: 'targetId',
        });
      }
      const targetNames =
        request.targetType === 'class' ? lookups.classNames : lookups.teacherNames;
      if (!targetNames.has(request.targetId)) {
        throw ExportErrorHandler.validationError(`${request.targetType} target was not found`, {
          field: 'targetId',
        });
      }

      const scopedTimetable = filterTimetableForTarget(
        normalizedTimetable,
        request.targetType,
        request.targetId
      );

      return [
        {
          id: timetable.id,
          name: resolveTargetName(
            normalizedTimetable,
            request.targetType,
            request.targetId,
            timetable.name
          ),
          type: request.targetType,
          targetId: request.targetId,
          classTeacherName:
            request.targetType === 'class'
              ? (lookups.classTeacherNames.get(request.targetId) ?? null)
              : null,
          timetableData: scopedTimetable,
        },
      ];
    }

    const schedules: ScheduleData[] = [];

    if (request.scope === 'all-classes') {
      const classes = await this.dataSource.getRepository(ClassGroup).find({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      });

      for (const classGroup of classes) {
        schedules.push({
          id: classGroup.id,
          name: classGroup.name,
          type: 'class',
          targetId: classGroup.id.toString(),
          classTeacherName: lookups.classTeacherNames.get(classGroup.id.toString()) ?? null,
          timetableData: filterTimetableForTarget(
            normalizedTimetable,
            'class',
            classGroup.id.toString()
          ),
        });
      }
    } else if (request.scope === 'all-teachers') {
      const teachers = await this.dataSource.getRepository(Teacher).find({
        where: { isDeleted: false },
        order: { fullName: 'ASC' },
      });

      for (const teacher of teachers) {
        schedules.push({
          id: teacher.id,
          name: teacher.fullName,
          type: 'teacher',
          targetId: teacher.id.toString(),
          classTeacherName: null,
          timetableData: filterTimetableForTarget(
            normalizedTimetable,
            'teacher',
            teacher.id.toString()
          ),
        });
      }
    }

    return schedules;
  }

  private async getEntityNameLookups(): Promise<{
    classNames: Map<string, string>;
    teacherNames: Map<string, string>;
    subjectNames: Map<string, string>;
    roomNames: Map<string, string>;
    classTeacherNames: Map<string, string | null>;
  }> {
    const [classes, teachers, subjects, rooms] = await Promise.all([
      this.dataSource.getRepository(ClassGroup).find({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      }),
      this.dataSource.getRepository(Teacher).find({
        where: { isDeleted: false },
        order: { fullName: 'ASC' },
      }),
      this.dataSource.getRepository(Subject).find({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      }),
      this.dataSource.getRepository(Room).find({
        where: { isDeleted: false },
        order: { name: 'ASC' },
      }),
    ]);

    const teacherNames = new Map(
      teachers.map((teacher) => [teacher.id.toString(), teacher.fullName])
    );

    return {
      classNames: new Map(classes.map((classGroup) => [classGroup.id.toString(), classGroup.name])),
      teacherNames,
      subjectNames: new Map(subjects.map((subject) => [subject.id.toString(), subject.name])),
      roomNames: new Map(rooms.map((room) => [room.id.toString(), room.name])),
      classTeacherNames: new Map(
        classes.map((classGroup) => [
          classGroup.id.toString(),
          classGroup.classTeacherId
            ? (teacherNames.get(classGroup.classTeacherId.toString()) ?? null)
            : null,
        ])
      ),
    };
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
    await this.fileCleanupService.scheduleCleanup(mappingPath, expiresAt);
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
      throw ExportErrorHandler.batchLimitError(scheduleCount);
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
      let branding: ExportBranding;
      try {
        branding = await this.getExportBranding(request.language, true);
      } catch (error) {
        throw this.asGenerationError(error, request.format, schedules.length, request.language);
      }

      if (request.format === 'pdf') {
        jobTracker.updateJob(jobId, {
          current: 0,
          message: 'Generating PDF...',
        });

        const pdfOptions = {
          schedules,
          language: request.language,
          displaySettings: request.displaySettings,
          includeAnalysis: request.includeAnalysis || false,
          analysisSummary: analysisSummary || undefined,
          branding,
        };
        try {
          fileBuffer = await this.pdfService.generatePDF(pdfOptions);
        } catch (error) {
          throw this.asGenerationError(error, 'pdf', schedules.length, request.language);
        }
        pageCount = this.pdfService.getExpectedPageCount(pdfOptions);
      } else {
        jobTracker.updateJob(jobId, {
          current: 0,
          message: 'Generating Excel workbook...',
        });

        try {
          fileBuffer = await this.excelService.generateExcel({
            schedules,
            language: request.language,
            displaySettings: request.displaySettings,
            branding,
          });
        } catch (error) {
          throw this.asGenerationError(error, 'excel', schedules.length, request.language);
        }
      }

      jobTracker.updateJob(jobId, {
        current: schedules.length,
        message: 'Export content generated',
      });

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

      try {
        await this.ensureTempDirectory();
        await fs.writeFile(filePath, fileBuffer);
      } catch (error) {
        throw ExportErrorHandler.fileWriteError(
          error instanceof Error ? error : new Error(String(error)),
          filePath
        );
      }

      // Create download URL with expiration
      const downloadToken = uuidv4();
      const expiresAt = new Date(Date.now() + this.urlExpirationHours * 60 * 60 * 1000);
      const downloadUrl = `${this.downloadBaseUrl}/${downloadToken}`;

      // Schedule file cleanup
      try {
        await this.fileCleanupService.scheduleCleanup(filePath, expiresAt);
        // Store download token mapping
        await this.storeDownloadMapping(downloadToken, filePath, expiresAt);
      } catch (error) {
        throw ExportErrorHandler.fileWriteError(
          error instanceof Error ? error : new Error(String(error)),
          filePath
        );
      }

      // Mark job as complete
      jobTracker.completeJob(jobId, downloadUrl, filename, fileBuffer.length, expiresAt, pageCount);
    } catch (error) {
      console.error('Batch export processing failed:', error);
      const exportError = ExportErrorHandler.wrapError(error);
      jobTracker.failJob(jobId, exportError.getLocalizedMessage(request.language));
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

  private async getExportBranding(
    language: ExportLanguage,
    includeMinistryLogo: boolean
  ): Promise<ExportBranding> {
    const profile = await this.dataSource.getRepository(SchoolProfile).findOne({ where: { id: 1 } });
    if (!profile) {
      throw ExportErrorHandler.validationError(
        'School profile must be configured before exporting schedules',
        { field: 'schoolProfile' }
      );
    }

    const schoolName =
      language === 'fa'
        ? profile.nameFa || profile.officialName
        : profile.nameEn || profile.officialName;
    const branding: ExportBranding = {
      schoolName,
      generatedAt: new Date().toISOString(),
      address: profile.address || undefined,
      website: profile.website || undefined,
    };

    if (includeMinistryLogo) {
      branding.ministryLogoBase64 = await this.getMinistryLogoBase64();
      branding.ministryLogoMimeType = 'image/png';
    }

    if (profile.logoFileName && profile.logoMimeType && isSchoolLogoMimeType(profile.logoMimeType)) {
      try {
        const bytes = await new SchoolLogoStorageService(this.dataSource).read(profile.logoFileName);
        branding.logoBase64 = bytes.toString('base64');
        branding.logoMimeType = profile.logoMimeType;
      } catch (error) {
        console.warn('School logo could not be included in export:', error);
      }
    }

    return branding;
  }

  private asGenerationError(
    error: unknown,
    format: ExportFormat,
    scheduleCount: number,
    language: ExportLanguage
  ): ExportError {
    if (error instanceof ExportError) return error;
    const originalError = error instanceof Error ? error : new Error(String(error));
    const details = { scheduleCount, language, stage: 'generation' };
    return format === 'pdf'
      ? ExportErrorHandler.pdfGenerationError(originalError, details)
      : ExportErrorHandler.excelGenerationError(originalError, details);
  }

  private async getMinistryLogoBase64(): Promise<string> {
    if (!this.ministryLogoPromise) {
      this.ministryLogoPromise = this.loadMinistryLogoBase64();
    }
    return this.ministryLogoPromise;
  }

  private async loadMinistryLogoBase64(): Promise<string> {
    const configuredWebDist = process.env.WEB_DIST_PATH;
    const candidates = [
      configuredWebDist ? path.join(configuredWebDist, 'photo', 'images.png') : null,
      path.resolve(process.cwd(), '../web/public/photo/images.png'),
      path.resolve(process.cwd(), 'packages/web/public/photo/images.png'),
      path.resolve(__dirname, '../../../web/public/photo/images.png'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        const bytes = await fs.readFile(candidate);
        const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
        if (bytes.length >= pngSignature.length && bytes.subarray(0, 8).equals(pngSignature)) {
          return bytes.toString('base64');
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn('Could not read Ministry of Education logo:', error);
        }
      }
    }

    throw new Error(
      'Ministry of Education logo is missing. Expected photo/images.png in the web public or built assets.'
    );
  }
}
