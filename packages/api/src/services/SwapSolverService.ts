import { spawn } from 'child_process';
import path from 'path';
import type { SwapRequest, SwapValidationResponse } from '../schemas/swap.schema';
import { logger } from '../utils/logger';
import { swapConstraintGatherer } from './SwapConstraintGatherer';

export class SwapSolverService {
  private pythonPath: string;
  private solverPath: string;

  constructor() {
    // Use the same Python environment as main solver
    this.pythonPath = path.join(__dirname, '../../../solver/.venv/bin/python');
    this.solverPath = path.join(__dirname, '../../../solver/swap_solver.py');
  }

  async validateSwap(request: SwapRequest): Promise<SwapValidationResponse> {
    logger.info('Swap validation requested', {
      timetableId: request.timetableId,
      sourceSlot: request.sourceSlot,
      targetSlot: request.targetSlot,
    });

    // Gather constraint data
    const constraintData = await swapConstraintGatherer.gatherConstraints(request.timetableId);

    // Prepare input for Python solver
    const solverInput = {
      swapRequest: request,
      constraintData,
    };

    // Spawn Python process
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.solverPath]);

      let stdout = '';
      let stderr = '';

      python.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      python.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          try {
            const pythonResult = JSON.parse(stdout);

            // Transform snake_case to camelCase for TypeScript
            const result: SwapValidationResponse = {
              isValid: pythonResult.is_valid,
              canProceedWithWarning: pythonResult.can_proceed_with_warning,
              errors: pythonResult.errors || [],
              warnings: pythonResult.warnings || [],
              affectedLessons: (pythonResult.affected_lessons || []).map((lesson: any) => ({
                classId: lesson.class_id,
                subjectId: lesson.subject_id,
                teacherId: lesson.teacher_id,
                roomId: lesson.room_id,
                fromDay: lesson.from_day,
                fromPeriod: lesson.from_period,
                toDay: lesson.to_day,
                toPeriod: lesson.to_period,
              })),
              totalMoves: pythonResult.total_moves || 0,
            };

            logger.info('Swap validation completed', {
              isValid: result.isValid,
              errors: result.errors.length,
              warnings: result.warnings.length,
              totalMoves: result.totalMoves,
            });
            resolve(result);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(
              'Failed to parse solver output',
              error instanceof Error ? error : new Error(errorMessage)
            );
            reject(new Error(`Failed to parse solver output: ${errorMessage}`));
          }
        } else {
          logger.error('Solver process failed', new Error(`Exit code ${code}: ${stderr}`));
          reject(new Error(`Solver failed with code ${code}: ${stderr}`));
        }
      });

      python.on('error', (error) => {
        logger.error('Failed to spawn solver process', error);
        reject(new Error(`Failed to spawn solver: ${error.message}`));
      });

      // Write input to stdin
      python.stdin.write(JSON.stringify(solverInput));
      python.stdin.end();

      // Timeout after 15 seconds
      setTimeout(() => {
        python.kill();
        logger.error('Solver timeout', new Error('Timeout after 15 seconds'));
        reject(new Error('Solver timeout after 15 seconds'));
      }, 15000);
    });
  }
}

export const swapSolverService = new SwapSolverService();
