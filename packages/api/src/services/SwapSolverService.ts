import { spawn } from 'child_process';
import path from 'path';
import type { SwapRequest, SwapValidationResponse } from '../schemas/swap.schema';
import { logger } from '../utils/logger';
import { SwapConstraintGatherer } from './SwapConstraintGatherer';

export class SwapSolverService {
  private pythonPath: string;
  private solverPath: string;

  constructor(private readonly constraintGatherer: SwapConstraintGatherer) {
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
    const gatheredConstraintData = await this.constraintGatherer.gatherConstraints(
      request.timetableId
    );
    const constraintData = {
      teachers: gatheredConstraintData.teachers,
      subjects: gatheredConstraintData.subjects,
      rooms: gatheredConstraintData.rooms,
      classes: gatheredConstraintData.classes,
      assignments:
        gatheredConstraintData.scheduledLessons ??
        gatheredConstraintData.timetableData?.lessons ??
        [],
      timetableData: gatheredConstraintData.timetableData,
      config: gatheredConstraintData.config,
    };

    // Prepare input for Python solver
    const solverInput = {
      swapRequest: {
        timetable_id: request.timetableId,
        source_slot: request.sourceSlot,
        target_slot: request.targetSlot,
      },
      constraintData,
    };

    // Spawn Python process
    return new Promise((resolve, reject) => {
      const python = spawn(this.pythonPath, [this.solverPath]);
      let settled = false;

      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      const settle = (callback: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        callback();
      };

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
            settle(() => resolve(result));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error(
              'Failed to parse solver output',
              error instanceof Error ? error : new Error(errorMessage)
            );
            settle(() => reject(new Error(`Failed to parse solver output: ${errorMessage}`)));
          }
        } else {
          logger.error('Solver process failed', new Error(`Exit code ${code}: ${stderr}`));
          settle(() => reject(new Error(`Solver failed with code ${code}: ${stderr}`)));
        }
      });

      python.on('error', (error) => {
        logger.error('Failed to spawn solver process', error);
        settle(() => reject(new Error(`Failed to spawn solver: ${error.message}`)));
      });

      // Write input to stdin
      python.stdin.write(JSON.stringify(solverInput));
      python.stdin.end();

      // Timeout after 15 seconds
      timeoutHandle = setTimeout(() => {
        python.kill();
        logger.error('Solver timeout', new Error('Timeout after 15 seconds'));
        settle(() => reject(new Error('Solver timeout after 15 seconds')));
      }, 15000);
    });
  }
}
