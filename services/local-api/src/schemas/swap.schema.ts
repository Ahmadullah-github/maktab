/**
 * Zod validation schemas for swap operations
 *
 * Defines request/response schemas for swap validation and execution endpoints.
 *
 * Requirements: Phase 0.3
 * - Validate swap request structure
 * - Type-safe request/response handling
 * - Clear error messages for invalid requests
 */

import { z } from 'zod';

/**
 * Schema for a slot position in the schedule
 * Identifies a specific time slot by class, day, and period
 */
export const slotSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  day: z.enum(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']),
  period: z.number().int().min(0, 'Period must be non-negative'),
});

/**
 * Schema for swap validation request
 * Specifies source and target slots for the swap operation
 */
export const swapRequestSchema = z
  .object({
    timetableId: z.number().int().positive('Timetable ID must be positive'),
    sourceSlot: slotSchema,
    targetSlot: slotSchema,
  })
  .refine(
    (data) => {
      // Ensure source and target are different slots
      const sameClass = data.sourceSlot.classId === data.targetSlot.classId;
      const sameDay = data.sourceSlot.day === data.targetSlot.day;
      const samePeriod = data.sourceSlot.period === data.targetSlot.period;

      return !(sameClass && sameDay && samePeriod);
    },
    {
      message: 'Source and target slots must be different',
      path: ['targetSlot'],
    }
  );

/**
 * Schema for constraint violation
 * Represents a single constraint that was violated
 */
export const constraintViolationSchema = z.object({
  type: z.string(),
  severity: z.enum(['hard', 'soft']),
  message: z.string(),
  message_farsi: z.string().optional(),
  details: z.record(z.string(), z.any()),
});

/**
 * Schema for lesson move
 * Represents a single lesson being moved as part of the swap
 */
export const lessonMoveSchema = z.object({
  classId: z.string(),
  subjectId: z.string(),
  teacherId: z.string(),
  teacherIds: z.array(z.string()).min(1),
  roomId: z.string().nullable(),
  fromDay: z.string(),
  fromPeriod: z.number(),
  toDay: z.string(),
  toPeriod: z.number(),
});

/**
 * Schema for swap validation response
 * Contains validation result and affected lessons
 */
export const swapValidationResponseSchema = z.object({
  isValid: z.boolean(),
  canProceedWithWarning: z.boolean(),
  errors: z.array(constraintViolationSchema),
  warnings: z.array(constraintViolationSchema),
  affectedLessons: z.array(lessonMoveSchema),
  totalMoves: z.number().int().min(0),
});

/**
 * TypeScript types inferred from schemas
 */
export type SlotPosition = z.infer<typeof slotSchema>;
export type SwapRequest = z.infer<typeof swapRequestSchema>;
export type ConstraintViolation = z.infer<typeof constraintViolationSchema>;
export type LessonMove = z.infer<typeof lessonMoveSchema>;
export type SwapValidationResponse = z.infer<typeof swapValidationResponseSchema>;

/**
 * Validate swap request data
 *
 * @param data - Unknown data to validate
 * @returns Validated SwapRequest
 * @throws ZodError if validation fails
 */
export function validateSwapRequest(data: unknown): SwapRequest {
  return swapRequestSchema.parse(data);
}

/**
 * Safe validation with error handling
 *
 * @param data - Unknown data to validate
 * @returns Success result with data or error result with issues
 */
export function safeValidateSwapRequest(data: unknown): {
  success: boolean;
  data?: SwapRequest;
  error?: z.ZodError;
} {
  const result = swapRequestSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, error: result.error };
  }
}
