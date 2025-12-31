/**
 * Export request validation schemas
 * Requirements: 2.1, 8.1, 10.1, 10.2
 */

import { z } from 'zod';

/**
 * Display settings schema
 */
export const displaySettingsSchema = z.object({
  showSubjectName: z.boolean().default(true),
  showTeacherName: z.boolean().default(true),
  showRoomName: z.boolean().default(true),
  cellSize: z.enum(['compact', 'normal', 'large']).default('normal'),
  fontSize: z.enum(['sm', 'md', 'lg']).default('md'),
  colorBy: z.enum(['none', 'subject', 'teacher']).default('none'),
});

/**
 * Export request schema
 * Requirements: 2.1, 8.1, 10.1, 10.2
 */
export const exportRequestSchema = z.object({
  scheduleId: z.number().int().positive(),
  format: z.enum(['pdf', 'excel']).default('pdf'),
  scope: z.enum(['current', 'all-classes', 'all-teachers']).default('current'),
  targetType: z.enum(['class', 'teacher']),
  targetId: z.string().optional(),
  language: z.enum(['fa', 'en']).default('fa'),
  displaySettings: displaySettingsSchema,
  includeAnalysis: z.boolean().optional().default(false),
});

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type DisplaySettings = z.infer<typeof displaySettingsSchema>;
