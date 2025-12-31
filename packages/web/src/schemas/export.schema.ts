import { z } from 'zod';

/**
 * Export format options
 */
export const ExportFormatEnum = z.enum(['pdf', 'excel']);
export type ExportFormat = z.infer<typeof ExportFormatEnum>;

/**
 * Export scope options
 */
export const ExportScopeEnum = z.enum(['current', 'all-classes', 'all-teachers']);
export type ExportScope = z.infer<typeof ExportScopeEnum>;

/**
 * Export language options
 */
export const ExportLanguageEnum = z.enum(['fa', 'en']);
export type ExportLanguage = z.infer<typeof ExportLanguageEnum>;

/**
 * Zod schema for export form validation
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export const exportFormSchema = z.object({
  format: ExportFormatEnum.default('pdf'),
  scope: ExportScopeEnum.default('current'),
  language: ExportLanguageEnum.default('fa'),
  // Display settings will be integrated from Phase 4
  showTeacherName: z.boolean().default(true),
  showRoomName: z.boolean().default(true),
  colorBy: z.enum(['none', 'subject', 'teacher']).default('none'),
});

export type ExportFormValues = z.infer<typeof exportFormSchema>;

/**
 * Export request payload for API
 */
export interface ExportRequest {
  scheduleId: number;
  format: ExportFormat;
  scope: ExportScope;
  targetType: 'class' | 'teacher';
  targetId?: string;
  language: ExportLanguage;
  displaySettings: {
    showSubjectName: boolean;
    showTeacherName: boolean;
    showRoomName: boolean;
    cellSize: 'compact' | 'normal' | 'large';
    fontSize: 'sm' | 'md' | 'lg';
    colorBy: 'none' | 'subject' | 'teacher';
  };
  includeAnalysis?: boolean;
}

/**
 * Export response from backend
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
 * Export progress information
 */
export interface ExportProgress {
  current: number;
  total: number;
  status: 'preparing' | 'generating' | 'finalizing' | 'complete' | 'error';
  message: string;
}
