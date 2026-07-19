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
export const exportRequestSchema = z
  .object({
    scheduleId: z.number().int().positive(),
    format: z.enum(['pdf', 'excel']).default('pdf'),
    scope: z.enum(['current', 'all-classes', 'all-teachers']).default('current'),
    targetType: z.enum(['class', 'teacher']),
    targetId: z.string().trim().regex(/^\d+$/, 'targetId must be a numeric entity ID').optional(),
    language: z.enum(['fa', 'en']).default('fa'),
    displaySettings: displaySettingsSchema,
    includeAnalysis: z.boolean().optional().default(false),
  })
  .superRefine((request, context) => {
    if (request.scope === 'current' && !request.targetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetId'],
        message: 'targetId is required when scope is current',
      });
    }
    if (request.scope === 'all-classes' && request.targetType !== 'class') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetType'],
        message: 'all-classes scope requires class targetType',
      });
    }
    if (request.scope === 'all-teachers' && request.targetType !== 'teacher') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetType'],
        message: 'all-teachers scope requires teacher targetType',
      });
    }
  });

export type ExportRequest = z.infer<typeof exportRequestSchema>;
export type DisplaySettings = z.infer<typeof displaySettingsSchema>;
