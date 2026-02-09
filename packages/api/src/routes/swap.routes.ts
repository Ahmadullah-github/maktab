/**
 * Swap Routes
 *
 * API endpoints for validating and executing lesson swaps.
 *
 * Requirements: Phase 3
 * - POST /api/swap/validate - Validate a swap operation
 * - POST /api/swap/execute - Execute a validated swap
 */

import { Request, Response, Router } from 'express';
import { validateSwapRequest } from '../schemas/swap.schema';
import { swapSolverService } from '../services/SwapSolverService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/swap/validate
 *
 * Validates a swap operation without executing it.
 * Checks all constraints and returns validation result.
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const swapRequest = validateSwapRequest(req.body);

    // Validate swap using Python solver
    const result = await swapSolverService.validateSwap(swapRequest);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const err = error instanceof Error ? error : new Error(errorMessage);

    // Distinguish between validation errors and system errors
    if (error instanceof Error) {
      // Check if it's a validation error (Zod)
      if (error.name === 'ZodError') {
        logger.warn('Invalid swap request', { error: errorMessage });
        return res.status(400).json({
          success: false,
          error: 'Invalid request format',
          details: errorMessage,
        });
      }

      // Check if it's a solver timeout
      if (errorMessage.includes('timeout')) {
        logger.error('Swap validation timeout', err);
        return res.status(504).json({
          success: false,
          error: 'Validation timeout',
          details: errorMessage,
        });
      }

      // Check if it's a timetable not found error
      if (errorMessage.includes('not found')) {
        logger.warn('Timetable not found', { error: errorMessage });
        return res.status(404).json({
          success: false,
          error: 'Timetable not found',
          details: errorMessage,
        });
      }
    }

    // Generic system error
    logger.error('Swap validation failed', err);
    res.status(500).json({
      success: false,
      error: 'System error during validation',
      details: errorMessage,
    });
  }
});

/**
 * POST /api/swap/execute
 *
 * Executes a validated swap operation.
 * Updates the timetable with the swapped lessons.
 *
 * TODO: Implement swap execution logic
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const swapRequest = validateSwapRequest(req.body);

    // First validate the swap
    const validationResult = await swapSolverService.validateSwap(swapRequest);

    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Swap validation failed',
        validationResult,
      });
    }

    // TODO: Execute the swap (update database)
    // This will be implemented in a later phase

    res.json({
      success: true,
      message: 'Swap execution not yet implemented',
      validationResult,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Swap execution failed', error instanceof Error ? error : new Error(errorMessage));

    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

export default router;
