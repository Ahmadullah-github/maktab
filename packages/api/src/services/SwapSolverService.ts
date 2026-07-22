import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { TimetableRevisionConflictError } from '../database/repositories/timetable.repository';
import {
  swapValidationResponseSchema,
  type SwapRequest,
  type SwapValidationResponse,
} from '../schemas/swap.schema';
import { logger } from '../utils/logger';
import { SwapConstraintGatherer } from './SwapConstraintGatherer';

type DraftLesson = SwapRequest['draftLessons'][number];

export class InvalidTimetableDraftError extends Error {
  readonly code = 'INVALID_TIMETABLE_DRAFT';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidTimetableDraftError';
  }
}

interface SolverCommand {
  command: string;
  args: string[];
  cwd: string;
}

interface PreparedConstraintData {
  teachers: unknown[];
  subjects: unknown[];
  rooms: unknown[];
  classes: unknown[];
  assignments: Array<Record<string, unknown>>;
  fixedLessons: Array<Record<string, unknown>>;
  timetableData: Record<string, unknown>;
  config: Record<string, unknown>;
}

function normalizedTeacherIds(lesson: { teacherIds?: unknown; teacherId?: unknown }): string[] {
  const ids = Array.isArray(lesson.teacherIds)
    ? lesson.teacherIds.map(String)
    : lesson.teacherId != null
      ? [String(lesson.teacherId)]
      : [];
  return [...new Set(ids)].sort();
}

function lessonIdentity(lesson: Record<string, unknown>): string {
  return JSON.stringify([
    String(lesson.classId ?? ''),
    String(lesson.subjectId ?? ''),
    normalizedTeacherIds(lesson),
    lesson.roomId == null ? null : String(lesson.roomId),
    lesson.isFixed === true,
  ]);
}

function identityCounts(lessons: Array<Record<string, unknown>>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const lesson of lessons) {
    const identity = lessonIdentity(lesson);
    counts.set(identity, (counts.get(identity) ?? 0) + 1);
  }
  return counts;
}

function assertSameLessonIdentities(
  persistedLessons: Array<Record<string, unknown>>,
  draftLessons: Array<Record<string, unknown>>
): void {
  const persisted = identityCounts(persistedLessons);
  const draft = identityCounts(draftLessons);

  if (persisted.size !== draft.size || persistedLessons.length !== draftLessons.length) {
    throw new InvalidTimetableDraftError(
      'The draft does not contain the same lessons as the persisted timetable revision.'
    );
  }

  for (const [identity, count] of persisted) {
    if (draft.get(identity) !== count) {
      throw new InvalidTimetableDraftError(
        'The draft changed lesson identity data. Reload the timetable and retry the swap.'
      );
    }
  }
}

function normalizeDraftLesson(lesson: DraftLesson): Record<string, unknown> {
  const raw = lesson as DraftLesson & { duration?: unknown };
  const teacherIds = normalizedTeacherIds(lesson as unknown as Record<string, unknown>);
  return {
    classId: String(lesson.classId),
    subjectId: String(lesson.subjectId),
    teacherId: teacherIds[0],
    teacherIds,
    roomId: lesson.roomId == null ? null : String(lesson.roomId),
    day: lesson.day,
    periodIndex: lesson.periodIndex,
    duration:
      Number.isInteger(Number(raw.duration)) && Number(raw.duration) > 0
        ? Number(raw.duration)
        : 1,
    isFixed: lesson.isFixed === true,
  };
}

export class SwapSolverService {
  constructor(private readonly constraintGatherer: SwapConstraintGatherer) {}

  async validateSwap(request: SwapRequest): Promise<SwapValidationResponse> {
    logger.info('Swap validation requested', {
      timetableId: request.timetableId,
      expectedRevision: request.expectedRevision,
      sourceSlot: request.sourceSlot,
      targetSlot: request.targetSlot,
    });

    const constraintData = await this.prepareConstraintData(
      request.timetableId,
      request.expectedRevision,
      request.draftLessons
    );

    return this.runSolver({
      operation: 'validate_swap',
      swapRequest: {
        timetable_id: request.timetableId,
        source_slot: request.sourceSlot,
        target_slot: request.targetSlot,
      },
      constraintData,
    });
  }

  async validateSchedule(
    timetableId: number,
    expectedRevision: number,
    draftLessons: DraftLesson[]
  ): Promise<SwapValidationResponse> {
    const constraintData = await this.prepareConstraintData(
      timetableId,
      expectedRevision,
      draftLessons
    );
    return this.runSolver({
      operation: 'validate_schedule',
      constraintData,
    });
  }

  private async prepareConstraintData(
    timetableId: number,
    expectedRevision: number,
    draftLessons: DraftLesson[]
  ): Promise<PreparedConstraintData> {
    const gathered = await this.constraintGatherer.gatherConstraints(timetableId);
    if (gathered.timetableData.revision !== expectedRevision) {
      throw new TimetableRevisionConflictError(gathered.timetableData.revision);
    }

    const persistedLessons = gathered.timetableData.lessons.map(
      (lesson) => lesson as unknown as Record<string, unknown>
    );
    const rawDraftLessons = draftLessons.map(
      (lesson) => lesson as unknown as Record<string, unknown>
    );
    assertSameLessonIdentities(persistedLessons, rawDraftLessons);

    const normalizedDraft = draftLessons.map(normalizeDraftLesson);
    return {
      teachers: gathered.teachers,
      subjects: gathered.subjects,
      rooms: gathered.rooms,
      classes: gathered.classes,
      assignments: normalizedDraft,
      fixedLessons: persistedLessons.filter((lesson) => lesson.isFixed === true),
      timetableData: {
        ...gathered.timetableData,
        lessons: normalizedDraft,
      },
      config: gathered.config,
    };
  }

  private resolveSolverCommand(): SolverCommand {
    const packagedSolver = process.env.SOLVER_PATH?.trim();
    if (packagedSolver) {
      if (!fs.existsSync(packagedSolver)) {
        throw new Error(`Packaged solver not found: ${packagedSolver}`);
      }
      const isPythonScript = path.extname(packagedSolver).toLowerCase() === '.py';
      const solverRoot = path.dirname(packagedSolver);
      const virtualEnvPython =
        process.platform === 'win32'
          ? path.join(solverRoot, '.venv', 'Scripts', 'python.exe')
          : path.join(solverRoot, '.venv', 'bin', 'python');
      return {
        command: isPythonScript
          ? fs.existsSync(virtualEnvPython)
            ? virtualEnvPython
            : process.platform === 'win32'
              ? 'python'
              : 'python3'
          : packagedSolver,
        args: isPythonScript ? [packagedSolver, '--swap'] : ['--swap'],
        cwd: solverRoot,
      };
    }

    const candidates = [
      path.resolve(__dirname, '../../../solver'),
      path.resolve(__dirname, '../../../packages/solver'),
      path.resolve(process.cwd(), 'packages/solver'),
      path.resolve(process.cwd(), '../solver'),
    ];
    const solverRoot = candidates.find((candidate) =>
      fs.existsSync(path.join(candidate, 'swap_solver.py'))
    );
    if (!solverRoot) {
      throw new Error('Swap solver entrypoint was not found');
    }

    const virtualEnvPython =
      process.platform === 'win32'
        ? path.join(solverRoot, '.venv', 'Scripts', 'python.exe')
        : path.join(solverRoot, '.venv', 'bin', 'python');
    const python = fs.existsSync(virtualEnvPython)
      ? virtualEnvPython
      : process.platform === 'win32'
        ? 'python'
        : 'python3';

    return {
      command: python,
      args: [path.join(solverRoot, 'swap_solver.py')],
      cwd: solverRoot,
    };
  }

  private runSolver(input: Record<string, unknown>): Promise<SwapValidationResponse> {
    const solver = this.resolveSolverCommand();

    return new Promise((resolve, reject) => {
      const child = spawn(solver.command, solver.args, {
        cwd: solver.cwd,
        windowsHide: true,
      });
      let settled = false;
      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      const settle = (callback: () => void) => {
        if (settled) return;
        settled = true;
        if (timeoutHandle) clearTimeout(timeoutHandle);
        callback();
      };

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          logger.error('Swap solver process failed', new Error(`Exit code ${code}: ${stderr}`));
          settle(() => reject(new Error(`Swap solver failed with code ${code}: ${stderr}`)));
          return;
        }

        try {
          const pythonResult = JSON.parse(stdout);
          const result = swapValidationResponseSchema.parse({
            isValid: pythonResult.is_valid,
            canProceedWithWarning: pythonResult.can_proceed_with_warning,
            errors: pythonResult.errors || [],
            warnings: pythonResult.warnings || [],
            affectedLessons: (pythonResult.affected_lessons || []).map(
              (lesson: Record<string, unknown>) => ({
                classId: lesson.class_id,
                subjectId: lesson.subject_id,
                teacherId: lesson.teacher_id,
                teacherIds: lesson.teacher_ids ?? [lesson.teacher_id],
                roomId: lesson.room_id ?? null,
                fromDay: lesson.from_day,
                fromPeriod: lesson.from_period,
                toDay: lesson.to_day,
                toPeriod: lesson.to_period,
                isFixed: lesson.is_fixed === true,
              })
            ),
            totalMoves: pythonResult.total_moves || 0,
          });

          logger.info('Swap solver validation completed', {
            isValid: result.isValid,
            errors: result.errors.length,
            warnings: result.warnings.length,
            totalMoves: result.totalMoves,
          });
          settle(() => resolve(result));
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger.error('Failed to parse swap solver output', new Error(message), { stdout, stderr });
          settle(() => reject(new Error(`Failed to parse swap solver output: ${message}`)));
        }
      });

      child.on('error', (error) => {
        logger.error('Failed to spawn swap solver process', error);
        settle(() => reject(new Error(`Failed to spawn swap solver: ${error.message}`)));
      });

      child.stdin.write(JSON.stringify(input));
      child.stdin.end();

      timeoutHandle = setTimeout(() => {
        child.kill();
        logger.error('Swap solver timeout', new Error('Timeout after 15 seconds'));
        settle(() => reject(new Error('Swap solver timeout after 15 seconds')));
      }, 15_000);
    });
  }
}
