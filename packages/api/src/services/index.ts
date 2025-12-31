/**
 * Service exports for the API package
 * @module services
 */

export * from './auditService';
// Export licenseService but exclude ContactInfo (use configurationService's version)
export * from './class.service';
export * from './configurationService';
export { LicenseService, LicenseStatus, RequestTemplate } from './licenseService';
export * from './room.service';
export * from './solver.service';
export * from './subject.service';
export * from './teacher.service';
export * from './timetable.service';

// Export services (Phase 5)
export { AnalysisGenerationService, type AnalysisSummary } from './analysisGeneration.service';
export { ExcelGenerationService, type ExcelGenerationOptions } from './excelGeneration.service';
// Export ScheduleData from analysisGeneration (canonical source)
export type { ScheduleData } from './analysisGeneration.service';
export { ExportService } from './export.service';
export type {
  ExportJobResponse,
  ExportProgress,
  ExportRequest,
  ExportResponse,
} from './export.service';
export {
  DEFAULT_RETRY_CONFIG,
  ExportError,
  ExportErrorHandler,
  ExportErrorType,
  withRetry,
  withTimeout,
} from './exportError.service';
export type { RetryConfig } from './exportError.service';
export { getJobTracker, JobTrackerService, resetJobTracker } from './jobTracker.service';
export type { CreateJobOptions, JobInfo, JobStatus, UpdateJobOptions } from './jobTracker.service';
export { PDFGenerationService } from './pdfGeneration.service';
export type { PDFGenerationOptions } from './pdfGeneration.service';
