/**
 * Solver Service for Python solver integration
 * @module services/solver
 *
 * Requirements: 3.3, 8.1, 8.2, 8.5, 12.3
 * - Route handler SHALL delegate to SolverService class
 * - System SHALL queue request or return "busy" when another is running
 * - System SHALL enforce configurable timeout
 * - System SHALL write to temp file for large datasets
 */

import { ChildProcess, spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  DEFAULT_SOLVER_TIMEOUT_MS,
  ERROR_CODES,
  SOLVER_EXE_NAME,
  SOLVER_MAX_STDIN_SIZE_BYTES,
  SOLVER_SCRIPT_NAME,
} from '../constants';
import { ParsedError, parseSolverError } from '../utils/errorParser';
import { logger } from '../utils/logger';

/**
 * Affected entity in an error or suggestion
 * Requirements: 1.2
 */
export interface AffectedEntity {
  entity_type: string; // "teacher", "class", "room", "subject"
  entity_id: string;
  entity_name: string;
}

/**
 * Detailed error information from the solver
 * Requirements: 1.2, 1.3
 */
export interface SolverErrorDetail {
  error_code: string;
  severity: 'error' | 'warning' | 'info';
  message_key: string;
  message_farsi: string;
  message_english: string;
  affected_entities: AffectedEntity[];
  context: Record<string, any>;
}

/**
 * Quality score breakdown components
 * Requirements: 4.2
 */
export interface QualityBreakdown {
  teacher_gaps: { count: number; penalty: number; details: any[] };
  afternoon_difficult_subjects: { count: number; penalty: number; details: any[] };
  same_day_subject_repetition: { count: number; penalty: number; details: any[] };
  teacher_load_balance: { count: number; penalty: number; details: any[] };
}

export interface ObjectiveResult {
  key: string;
  strength: number;
  violation_units: number;
  opportunity_units: number;
  satisfaction_percent: number;
  affected_entities: AffectedEntity[];
}

/**
 * Suggestion for improving timetable quality
 * Requirements: 4.3, 4.4
 */
export interface Suggestion {
  suggestion_code: string;
  message_key: string;
  message_params: Record<string, unknown>;
  message_farsi: string;
  message_english: string;
  affected_entities: AffectedEntity[];
  expected_improvement: number;
}

/**
 * Quality score for a generated timetable
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */
export interface QualityScore {
  overall: number; // 0-100
  breakdown: QualityBreakdown;
  objective_results: ObjectiveResult[];
  suggestions: Suggestion[];
}

/**
 * Metadata about solver execution
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export interface SolverResponseMetadata {
  solve_time_seconds?: number;
  strategy_selected?: string;
  strategy_reason?: string;
  strategy_overridden?: boolean;
  total_lessons?: number;
  optimization_preferences_revision?: number;
  enabled_objectives?: string[];
}

/**
 * Standardized response from the solver
 * Requirements: 1.1
 */
export interface SolverResponse {
  status: 'success' | 'partial' | 'failed';
  data: any | null;
  errors: SolverErrorDetail[];
  warnings: SolverErrorDetail[];
  quality_score: QualityScore | null;
  metadata: SolverResponseMetadata;
}

/**
 * Pre-solve analysis result
 * Requirements: 3.1, 3.2, 3.3
 */
export interface PreSolveResult {
  can_proceed: boolean;
  errors: SolverErrorDetail[];
  warnings: SolverErrorDetail[];
  suggestions: Suggestion[];
  analysis_time_ms: number;
}

/**
 * Result type from solver execution
 * Now uses the standardized SolverResponse format
 * Requirements: 1.1, 1.4
 */
export type SolverResult = SolverResponse;

/**
 * Extended error interface for solver errors
 */
export interface SolverError extends Error {
  /** Friendly message safe to send to clients */
  clientMessage?: string;
  /** Error code for programmatic handling */
  code?: string;
  /** Structured error information from parser */
  parsedError?: ParsedError;
}

/**
 * Options for solver execution
 */
export interface SolverOptions {
  /** Timeout in milliseconds (default: 15 minutes) */
  timeoutMs?: number;
}

export type SolverPhase =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'validation'
  | 'modelBuilding'
  | 'solvingPhase1'
  | 'solvingPhase2'
  | 'formatting'
  | 'saving'
  | 'cancelling';

export type SolverProgressStage = Exclude<
  SolverPhase,
  'idle' | 'preparing' | 'analyzing' | 'saving' | 'cancelling'
>;

export type SolverRunOutcome = 'success' | 'partial' | 'failed' | 'cancelled';

export interface SolverProgressUpdate {
  type: 'progress';
  stage: SolverProgressStage;
  stageFarsi: string;
  percentComplete: number;
  estimatedSecondsRemaining?: number | null;
}

export interface SolverLastRun {
  outcome: SolverRunOutcome;
  finishedAt: Date;
  messageFarsi?: string;
  messageEnglish?: string;
  timetableId?: number;
}

/**
 * Status of the solver service
 */
export interface SolverStatus {
  /** Whether a generation lifecycle is currently running */
  isRunning: boolean;
  /** Process ID of the running solver (if any) */
  processId?: number;
  /** Timestamp when the current solve started */
  startedAt?: Date;
  /** Current lifecycle phase */
  phase: SolverPhase;
  /** Localized phase description */
  phaseFarsi?: string;
  /** Strategy chosen for the current run */
  strategy?: string;
  /** Determinate progress when emitted by solver */
  percentComplete?: number;
  /** Estimated remaining seconds when available */
  estimatedSecondsRemaining?: number;
  /** Whether the current phase can still be cancelled */
  canCancel: boolean;
  /** Summary of the last terminal run outcome */
  lastRun?: SolverLastRun;
}
export function parseSolverProgressUpdate(line: string): SolverProgressUpdate | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    if (
      parsed.type !== 'progress' ||
      typeof parsed.stage !== 'string' ||
      typeof parsed.stageFarsi !== 'string' ||
      typeof parsed.percentComplete !== 'number'
    ) {
      return null;
    }

    if (
      parsed.stage !== 'validation' &&
      parsed.stage !== 'modelBuilding' &&
      parsed.stage !== 'solvingPhase1' &&
      parsed.stage !== 'solvingPhase2' &&
      parsed.stage !== 'formatting'
    ) {
      return null;
    }

    return {
      type: 'progress',
      stage: parsed.stage,
      stageFarsi: parsed.stageFarsi,
      percentComplete: parsed.percentComplete,
      estimatedSecondsRemaining:
        typeof parsed.estimatedSecondsRemaining === 'number'
          ? parsed.estimatedSecondsRemaining
          : null,
    };
  } catch {
    return null;
  }
}

function isStructuredSolverResponse(value: unknown): value is SolverResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SolverResponse>;
  return (
    (candidate.status === 'success' ||
      candidate.status === 'partial' ||
      candidate.status === 'failed') &&
    Array.isArray(candidate.errors) &&
    Array.isArray(candidate.warnings) &&
    'data' in candidate
  );
}

/**
 * SolverService handles Python solver integration with singleton pattern
 * and concurrent request management.
 *
 * Features:
 * - Singleton pattern for consistent state management
 * - Concurrent request tracking (only one solve at a time)
 * - Configurable timeout
 * - Large data file handling (writes to temp file for payloads > 1MB)
 * - Automatic temp file cleanup
 */
export class SolverService {
  private static instance: SolverService | null = null;

  /** Flag indicating if a generation lifecycle is currently running */
  private _isRunning: boolean = false;

  /** Current running process (if any) */
  private currentProcess: ChildProcess | null = null;

  /** Process ID of the running solver */
  private currentProcessId: number | undefined = undefined;

  /** Timestamp when the current solve started */
  private solveStartedAt: Date | undefined = undefined;

  /** Temp file path for current solve (if using file-based input) */
  private currentTempFile: string | null = null;

  /** Shared status phase for the current run */
  private currentPhase: SolverPhase = 'idle';

  /** Localized phase text */
  private currentPhaseFarsi: string | undefined = undefined;

  /** Current selected strategy */
  private currentStrategy: string | undefined = undefined;

  /** Current shared progress percentage */
  private currentPercentComplete: number | undefined = undefined;

  /** Current estimated seconds remaining */
  private currentEstimatedSecondsRemaining: number | undefined = undefined;

  /** Whether the current lifecycle can still be cancelled */
  private currentCanCancel: boolean = false;

  /** Whether cancellation has been requested */
  private cancelRequested: boolean = false;

  /** The most recent terminal run result */
  private lastRun: SolverLastRun | undefined = undefined;

  /** Buffer for parsing line-oriented stderr progress events */
  private stderrLineBuffer: string = '';

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance of SolverService
   */
  static getInstance(): SolverService {
    if (!SolverService.instance) {
      SolverService.instance = new SolverService();
    }
    return SolverService.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (SolverService.instance) {
      SolverService.instance.resetRunState();
    }
    SolverService.instance = null;
  }

  /**
   * Check if the solver is currently running
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the current status of the solver service
   */
  getStatus(): SolverStatus {
    return {
      isRunning: this._isRunning,
      processId: this.currentProcessId,
      startedAt: this.solveStartedAt,
      phase: this.currentPhase,
      phaseFarsi: this.currentPhaseFarsi,
      strategy: this.currentStrategy,
      percentComplete: this.currentPercentComplete,
      estimatedSecondsRemaining: this.currentEstimatedSecondsRemaining,
      canCancel: this.currentCanCancel,
      lastRun: this.lastRun,
    };
  }

  private cleanupTempFile(): void {
    // Clean up temp file if exists
    if (this.currentTempFile) {
      try {
        if (fs.existsSync(this.currentTempFile)) {
          fs.unlinkSync(this.currentTempFile);
          logger.debug('SolverService: Cleaned up temp file', { path: this.currentTempFile });
        }
      } catch (err) {
        logger.warn('SolverService: Failed to clean up temp file', {
          path: this.currentTempFile,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      this.currentTempFile = null;
    }
  }

  private clearCurrentProcess(): void {
    this.currentProcess = null;
    this.currentProcessId = undefined;
    this.stderrLineBuffer = '';
  }

  private terminateCurrentProcess(): void {
    if (this.currentProcess) {
      try {
        this.currentProcess.kill('SIGKILL');
      } catch (_) {
        // Ignore errors when killing process
      }
    }
  }

  private resetRunState(): void {
    this.cleanupTempFile();
    this.terminateCurrentProcess();
    this.clearCurrentProcess();
    this._isRunning = false;
    this.solveStartedAt = undefined;
    this.currentPhase = 'idle';
    this.currentPhaseFarsi = undefined;
    this.currentStrategy = undefined;
    this.currentPercentComplete = undefined;
    this.currentEstimatedSecondsRemaining = undefined;
    this.currentCanCancel = false;
    this.cancelRequested = false;
  }

  private updatePhase(
    phase: SolverPhase,
    options?: {
      phaseFarsi?: string;
      canCancel?: boolean;
      percentComplete?: number;
      estimatedSecondsRemaining?: number | null;
    }
  ): void {
    this.currentPhase = phase;
    if (options?.phaseFarsi !== undefined) {
      this.currentPhaseFarsi = options.phaseFarsi;
    }
    if (options?.canCancel !== undefined) {
      this.currentCanCancel = options.canCancel;
    }
    if (options?.percentComplete !== undefined) {
      this.currentPercentComplete = options.percentComplete;
    }
    if (options?.estimatedSecondsRemaining !== undefined) {
      this.currentEstimatedSecondsRemaining =
        options.estimatedSecondsRemaining === null ? undefined : options.estimatedSecondsRemaining;
    }
  }

  beginRun(strategy?: string): SolverStatus {
    if (this._isRunning) {
      const error = new Error('Solver is currently busy processing another request') as SolverError;
      error.clientMessage =
        'Timetable generation is already in progress. Please wait for it to complete.';
      error.code = ERROR_CODES.SOLVER_BUSY;
      logger.warn('SolverService: Rejected request - solver busy', {
        currentProcessId: this.currentProcessId,
        startedAt: this.solveStartedAt,
        phase: this.currentPhase,
      });
      throw error;
    }

    this.resetRunState();
    this._isRunning = true;
    this.solveStartedAt = new Date();
    this.currentStrategy = strategy;
    this.lastRun = undefined;
    this.updatePhase('preparing', {
      phaseFarsi: 'در حال آماده‌سازی داده‌ها...',
      canCancel: true,
      percentComplete: undefined,
      estimatedSecondsRemaining: undefined,
    });

    return this.getStatus();
  }

  setPreparingPhase(messageFarsi: string = 'در حال آماده‌سازی داده‌ها...'): void {
    this.updatePhase('preparing', {
      phaseFarsi: messageFarsi,
      canCancel: true,
      percentComplete: undefined,
      estimatedSecondsRemaining: undefined,
    });
  }

  setSavingPhase(): void {
    this.updatePhase('saving', {
      phaseFarsi: 'در حال ذخیره جدول زمانی...',
      canCancel: false,
      percentComplete: 100,
      estimatedSecondsRemaining: 0,
    });
  }

  requestCancel(): boolean {
    if (!this._isRunning || !this.currentCanCancel) {
      return false;
    }

    this.cancelRequested = true;
    this.updatePhase('cancelling', {
      phaseFarsi: 'در حال لغو تولید جدول زمانی...',
      canCancel: false,
    });
    this.terminateCurrentProcess();
    logger.info('SolverService: Cancellation requested', {
      phase: this.currentPhase,
      processId: this.currentProcessId,
    });
    return true;
  }

  throwIfCancellationRequested(): void {
    if (this.cancelRequested) {
      throw this.createCancelledError();
    }
  }

  finishRun(lastRun?: SolverLastRun): void {
    this.cleanupTempFile();
    this.terminateCurrentProcess();
    this.clearCurrentProcess();
    this._isRunning = false;
    this.solveStartedAt = undefined;
    this.currentPhase = 'idle';
    this.currentPhaseFarsi = undefined;
    this.currentStrategy = undefined;
    this.currentPercentComplete = undefined;
    this.currentEstimatedSecondsRemaining = undefined;
    this.currentCanCancel = false;
    this.cancelRequested = false;
    if (lastRun) {
      this.lastRun = lastRun;
    }
  }

  private createCancelledError(): SolverError {
    const error = new Error('Timetable generation was cancelled') as SolverError;
    error.clientMessage = 'Timetable generation was cancelled.';
    error.code = ERROR_CODES.SOLVER_CANCELLED;
    return error;
  }

  private handleSolverProgressUpdate(progress: SolverProgressUpdate): void {
    this.updatePhase(progress.stage, {
      phaseFarsi: progress.stageFarsi,
      canCancel: true,
      percentComplete: progress.percentComplete,
      estimatedSecondsRemaining: progress.estimatedSecondsRemaining ?? null,
    });
  }

  private consumeStderrChunk(chunk: string): string {
    this.stderrLineBuffer += chunk;
    const lines = this.stderrLineBuffer.split(/\r?\n/);
    this.stderrLineBuffer = lines.pop() ?? '';

    const nonProgressLines: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      const progress = parseSolverProgressUpdate(trimmed);
      if (progress) {
        this.handleSolverProgressUpdate(progress);
        continue;
      }

      nonProgressLines.push(line);
    }

    return nonProgressLines.length > 0 ? `${nonProgressLines.join('\n')}\n` : '';
  }

  private flushStderrRemainder(): string {
    if (!this.stderrLineBuffer.trim()) {
      this.stderrLineBuffer = '';
      return '';
    }

    const remainder = this.stderrLineBuffer;
    this.stderrLineBuffer = '';
    const progress = parseSolverProgressUpdate(remainder.trim());
    if (progress) {
      this.handleSolverProgressUpdate(progress);
      return '';
    }

    return remainder;
  }

  /**
   * Resolve the solver script path
   * Tries multiple possible locations to find the solver directory
   */
  private resolveSolverPath(): {
    solverDir: string;
    solverScript: string;
    pythonCommand: string;
    args: string[];
  } {
    const isProduction = process.env.NODE_ENV === 'production';
    const envSolverPath = process.env.SOLVER_PATH?.trim();

    // Try multiple possible locations to find the solver directory
    const fromCompiled = path.resolve(__dirname, '../../../', 'packages', 'solver');
    const fromCwd = path.resolve(process.cwd(), 'packages', 'solver');
    const fromCwdParent = path.resolve(process.cwd(), '..', 'solver');

    logger.debug('SolverService: Trying solver paths', {
      fromCompiled,
      fromCwd,
      fromCwdParent,
    });

    let repoSolverDir: string;
    if (fs.existsSync(path.join(fromCompiled, SOLVER_SCRIPT_NAME))) {
      repoSolverDir = fromCompiled;
      logger.debug('SolverService: Using path from compiled location');
    } else if (fs.existsSync(path.join(fromCwd, SOLVER_SCRIPT_NAME))) {
      repoSolverDir = fromCwd;
      logger.debug('SolverService: Using path from CWD');
    } else if (fs.existsSync(path.join(fromCwdParent, SOLVER_SCRIPT_NAME))) {
      repoSolverDir = fromCwdParent;
      logger.debug('SolverService: Using path from CWD parent');
    } else {
      repoSolverDir = fromCompiled;
      logger.debug('SolverService: Using fallback path');
    }

    let solverDir: string;
    let solverScript: string;
    let pythonCommand: string;
    let args: string[] = [];

    if (envSolverPath) {
      // User provided a direct solver path
      solverScript = envSolverPath;
      solverDir = path.dirname(envSolverPath);
      const isPyScript = path.extname(solverScript).toLowerCase() === '.py';
      pythonCommand = isPyScript
        ? process.platform === 'win32'
          ? 'python'
          : 'python3'
        : solverScript;
      args = isPyScript ? [solverScript] : [];
      logger.info('SolverService: SOLVER_PATH override detected', { solverScript });
    } else if (isProduction) {
      solverDir = repoSolverDir;
      solverScript = path.join(solverDir, SOLVER_EXE_NAME);
      pythonCommand = solverScript;
      args = [];
      logger.info('SolverService: Production mode', { solverScript });
    } else {
      solverDir = repoSolverDir;
      solverScript = path.join(solverDir, SOLVER_SCRIPT_NAME);
      pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
      args = [solverScript];
      logger.info('SolverService: Development mode', { solverScript });
    }

    return { solverDir, solverScript, pythonCommand, args };
  }

  /**
   * Find a working Python command
   * Prefers the solver's virtual environment if it exists
   */
  private findPythonCommand(solverDir: string): string {
    // First, try the venv Python in the solver directory
    const venvPython =
      process.platform === 'win32'
        ? path.join(solverDir, '.venv', 'Scripts', 'python.exe')
        : path.join(solverDir, '.venv', 'bin', 'python');

    if (fs.existsSync(venvPython)) {
      logger.info('SolverService: Using venv Python', { path: venvPython });
      return venvPython;
    }

    // Fallback to system Python
    const candidates =
      process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];

    for (const cand of candidates) {
      try {
        const check = spawn(cand, ['-V']);
        check.on('error', () => {
          /* ignore */
        });
        return cand;
      } catch (_) {
        // Try next candidate
      }
    }

    // Fallback to default
    return process.platform === 'win32' ? 'python' : 'python3';
  }

  /**
   * Write data to a temp file for large payloads
   * Returns the temp file path
   */
  private writeToTempFile(data: any): string {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `solver-input-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(data), 'utf-8');
    logger.info('SolverService: Wrote data to temp file', {
      path: tempFile,
      size: fs.statSync(tempFile).size,
    });
    return tempFile;
  }

  /**
   * Run the Python solver with the given data
   *
   * @param data - Input data for the solver
   * @param opts - Solver options (timeout, etc.)
   * @returns Promise resolving to solver result
   * @throws SolverError if solver fails or is busy
   *
   * Requirements: 8.1, 8.2, 8.5
   * - Returns SOLVER_BUSY (503) when another request is in progress
   * - Enforces configurable timeout
   * - Writes to temp file for large datasets
   */
  async runSolver(data: any, opts?: SolverOptions): Promise<SolverResult> {
    const ownsLifecycle = !this._isRunning;
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_SOLVER_TIMEOUT_MS;

    try {
      if (ownsLifecycle) {
        this.beginRun();
      }
      this.throwIfCancellationRequested();
      return await this.executeSolver(data, timeoutMs);
    } finally {
      if (ownsLifecycle) {
        this.finishRun();
      }
    }
  }

  /**
   * Run pre-solve analysis without generating a timetable
   *
   * @param data - Input data for analysis
   * @returns Promise resolving to PreSolveResult
   * @throws SolverError if analysis fails
   *
   * Requirements: 3.6
   * - Spawns solver with --analyze-only flag
   * - Returns PreSolveResult with can_proceed, errors, warnings, suggestions
   */
  async runPreSolveAnalysis(data: any): Promise<PreSolveResult> {
    const timeoutMs = 10000; // 10 second timeout for analysis (should be fast)
    const ownsLifecycle = !this._isRunning;

    if (ownsLifecycle) {
      this.beginRun();
    }

    return new Promise((resolve, reject) => {
      const finalizeStandalone = () => {
        if (ownsLifecycle) {
          this.finishRun();
        }
      };

      try {
        this.throwIfCancellationRequested();
        this.updatePhase('analyzing', {
          phaseFarsi: 'در حال تحلیل پیش از تولید...',
          canCancel: true,
          percentComplete: undefined,
          estimatedSecondsRemaining: undefined,
        });

        const { solverDir, solverScript, pythonCommand, args } = this.resolveSolverPath();

        // Verify solver script exists
        if (!fs.existsSync(solverScript)) {
          const error = new Error(`Python solver not found at: ${solverScript}`) as SolverError;
          error.clientMessage =
            'Timetable solver is not available on the server (server configuration error).';
          error.code = ERROR_CODES.SOLVER_NOT_FOUND;
          finalizeStandalone();
          return reject(error);
        }

        // Add --analyze-only flag
        const finalArgs = [...args, '--analyze-only'];

        // Find working Python command in development mode
        let finalCmd = pythonCommand;
        const isProduction = process.env.NODE_ENV === 'production';
        if (!isProduction && path.extname(solverScript).toLowerCase() === '.py') {
          finalCmd = this.findPythonCommand(solverDir);
        }

        logger.info('SolverService: Spawning pre-solve analysis', {
          command: finalCmd,
          args: finalArgs,
          cwd: solverDir,
        });

        // Spawn the solver process
        const proc = spawn(finalCmd, finalArgs, {
          cwd: solverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        this.currentProcess = proc;
        this.currentProcessId = proc.pid;
        this.stderrLineBuffer = '';

        logger.info('SolverService: Pre-solve analysis process started', { pid: proc.pid });

        let stdoutBuf = '';
        let stderrBuf = '';
        let finished = false;

        // Set up timeout
        const timeout = setTimeout(() => {
          if (!finished) {
            try {
              proc.kill('SIGKILL');
            } catch (_) {}
            finished = true;
            const error = new Error(
              `Pre-solve analysis timed out after ${timeoutMs}ms`
            ) as SolverError;
            error.clientMessage = 'Pre-solve analysis timed out.';
            error.code = ERROR_CODES.SOLVER_TIMEOUT;
            logger.error('SolverService: Pre-solve analysis timed out', undefined, {
              timeoutMs,
              pid: proc.pid,
            });
            finalizeStandalone();
            return reject(error);
          }
        }, timeoutMs);

        // Handle stdin errors
        proc.stdin.on('error', (err) => {
          logger.warn('SolverService: stdin error during analysis', { error: err.message });
        });

        // Send data to solver via stdin
        try {
          proc.stdin.write(JSON.stringify(data));
          proc.stdin.end();
        } catch (err) {
          logger.error(
            'SolverService: Failed to write to stdin during analysis',
            err instanceof Error ? err : new Error(String(err))
          );
        }

        // Collect stdout
        proc.stdout.on('data', (chunk: Buffer) => {
          stdoutBuf += chunk.toString();
        });

        // Collect stderr
        proc.stderr.on('data', (chunk: Buffer) => {
          stderrBuf += this.consumeStderrChunk(chunk.toString());
        });

        // Handle spawn errors
        proc.on('error', (err: Error) => {
          clearTimeout(timeout);
          finished = true;
          this.clearCurrentProcess();
          logger.error('SolverService: Failed to start pre-solve analysis process', err);
          const error = new Error(
            `Failed to start pre-solve analysis: ${err.message}`
          ) as SolverError;
          error.clientMessage = 'Internal server error while starting pre-solve analysis.';
          error.code = ERROR_CODES.SOLVER_SPAWN_ERROR;
          finalizeStandalone();
          return reject(error);
        });

        // Handle process completion
        proc.on('close', (code) => {
          clearTimeout(timeout);
          finished = true;
          stderrBuf += this.flushStderrRemainder();
          this.clearCurrentProcess();
          logger.info('SolverService: Pre-solve analysis process exited', { code, pid: proc.pid });

          if (this.cancelRequested) {
            finalizeStandalone();
            return reject(this.createCancelledError());
          }

          // Parse output (even if exit code is non-zero, we might have valid analysis)
          const outTrim = stdoutBuf.trim();
          if (!outTrim) {
            const error = new Error('Pre-solve analysis returned empty output.') as SolverError;
            error.clientMessage = 'Pre-solve analysis returned no result.';
            error.code = ERROR_CODES.SOLVER_EMPTY_OUTPUT;
            finalizeStandalone();
            return reject(error);
          }

          try {
            const parsed = JSON.parse(outTrim) as PreSolveResult;
            logger.info('SolverService: Pre-solve analysis completed', {
              can_proceed: parsed.can_proceed,
              errors_count: parsed.errors?.length || 0,
              warnings_count: parsed.warnings?.length || 0,
            });
            finalizeStandalone();
            return resolve(parsed);
          } catch (parseErr) {
            const error = new Error(
              `Failed to parse pre-solve analysis output: ${(parseErr as Error).message}`
            ) as SolverError;
            error.clientMessage = 'Pre-solve analysis returned invalid output.';
            error.code = ERROR_CODES.SOLVER_PARSE_ERROR;
            logger.error('SolverService: Failed to parse pre-solve analysis output', undefined, {
              stdout: outTrim,
              stderr: stderrBuf,
            });
            finalizeStandalone();
            return reject(error);
          }
        });
      } catch (outerErr) {
        const error = outerErr as SolverError;
        error.clientMessage = 'Internal server error while preparing pre-solve analysis.';
        error.code = ERROR_CODES.INTERNAL_ERROR;
        finalizeStandalone();
        return reject(error);
      }
    });
  }

  /**
   * Internal method to execute the solver process
   */
  private executeSolver(data: any, timeoutMs: number): Promise<SolverResult> {
    return new Promise((resolve, reject) => {
      try {
        this.throwIfCancellationRequested();
        const { solverDir, solverScript, pythonCommand, args } = this.resolveSolverPath();

        // Verify solver script exists
        if (!fs.existsSync(solverScript)) {
          const error = new Error(`Python solver not found at: ${solverScript}`) as SolverError;
          error.clientMessage =
            'Timetable solver is not available on the server (server configuration error).';
          error.code = ERROR_CODES.SOLVER_NOT_FOUND;
          return reject(error);
        }

        // Determine if we need to use file-based input for large data
        const dataJson = JSON.stringify(data);
        const dataSize = Buffer.byteLength(dataJson, 'utf-8');
        const useFileInput = dataSize > SOLVER_MAX_STDIN_SIZE_BYTES;

        let finalArgs = [...args];
        if (useFileInput) {
          // Write data to temp file and pass path as argument
          this.currentTempFile = this.writeToTempFile(data);
          finalArgs.push('--input-file', this.currentTempFile);
          logger.info('SolverService: Using file-based input', {
            dataSize,
            threshold: SOLVER_MAX_STDIN_SIZE_BYTES,
          });
        }

        // Find working Python command in development mode
        let finalCmd = pythonCommand;
        const isProduction = process.env.NODE_ENV === 'production';
        if (!isProduction && path.extname(solverScript).toLowerCase() === '.py') {
          finalCmd = this.findPythonCommand(solverDir);
        }

        logger.info('SolverService: Spawning solver process', {
          command: finalCmd,
          args: finalArgs,
          cwd: solverDir,
          timeoutMs,
          useFileInput,
        });

        // Spawn the solver process
        const proc = spawn(finalCmd, finalArgs, {
          cwd: solverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONUNBUFFERED: '1' },
        });

        this.currentProcess = proc;
        this.currentProcessId = proc.pid;
        this.stderrLineBuffer = '';

        logger.info('SolverService: Solver process started', { pid: proc.pid });

        let stdoutBuf = '';
        let stderrBuf = '';
        let finished = false;

        // Set up timeout
        const timeout = setTimeout(() => {
          if (!finished) {
            try {
              proc.kill('SIGKILL');
            } catch (_) {}
            finished = true;
            const error = new Error(`Python solver timed out after ${timeoutMs}ms`) as SolverError;
            error.clientMessage = 'Timetable generation timed out. Try again or check server logs.';
            error.code = ERROR_CODES.SOLVER_TIMEOUT;
            this.clearCurrentProcess();
            this.cleanupTempFile();
            logger.error('SolverService: Solver timed out', undefined, {
              timeoutMs,
              pid: proc.pid,
            });
            return reject(error);
          }
        }, timeoutMs);

        // Handle stdin errors
        proc.stdin.on('error', (err) => {
          logger.warn('SolverService: stdin error', { error: err.message });
        });

        // Send data to solver via stdin (if not using file input)
        if (!useFileInput) {
          try {
            proc.stdin.write(dataJson);
            proc.stdin.end();
          } catch (err) {
            logger.error(
              'SolverService: Failed to write to stdin',
              err instanceof Error ? err : new Error(String(err))
            );
          }
        } else {
          // Close stdin immediately when using file input
          proc.stdin.end();
        }

        // Collect stdout
        proc.stdout.on('data', (chunk: Buffer) => {
          const s = chunk.toString();
          stdoutBuf += s;
          logger.debug('SolverService: stdout', { data: s.replace(/\n/g, '\\n') });
        });

        // Collect stderr
        proc.stderr.on('data', (chunk: Buffer) => {
          const s = chunk.toString();
          stderrBuf += this.consumeStderrChunk(s);
          logger.debug('SolverService: stderr', { data: s.replace(/\n/g, '\\n') });
        });

        // Handle spawn errors
        proc.on('error', (err: Error) => {
          clearTimeout(timeout);
          finished = true;
          this.clearCurrentProcess();
          this.cleanupTempFile();
          logger.error('SolverService: Failed to start solver process', err);
          const error = new Error(`Failed to start solver process: ${err.message}`) as SolverError;
          error.clientMessage =
            'Internal server error while starting timetable solver (server misconfiguration).';
          error.code = ERROR_CODES.SOLVER_SPAWN_ERROR;
          return reject(error);
        });

        // Handle process completion
        proc.on('close', (code) => {
          clearTimeout(timeout);
          finished = true;
          stderrBuf += this.flushStderrRemainder();
          this.clearCurrentProcess();
          this.cleanupTempFile();
          logger.info('SolverService: Solver process exited', { code, pid: proc.pid });

          if (this.cancelRequested) {
            return reject(this.createCancelledError());
          }

          if (code !== 0) {
            // First, try to parse structured error response from stdout
            // The solver now outputs a proper SolverResponse JSON to stdout even on error
            const outTrim = stdoutBuf.trim();
            if (outTrim) {
              try {
                const parsed = JSON.parse(outTrim);
                if (isStructuredSolverResponse(parsed)) {
                  logger.info('SolverService: Parsed structured error response from stdout');
                  return resolve(parsed);
                }
              } catch (parseErr) {
                logger.debug('SolverService: Could not parse stdout as JSON', {
                  error: (parseErr as Error).message,
                });
              }
            }

            // Fallback to old error handling
            const error = new Error(
              `Python solver failed (exit code ${code}). stderr: ${stderrBuf || stdoutBuf}`
            ) as SolverError;
            error.clientMessage =
              'Timetable solver failed to generate a timetable (solver runtime error). Check input or server logs.';
            error.code = ERROR_CODES.SOLVER_RUNTIME_ERROR;

            // Try to parse structured error from stderr
            const parsedError = parseSolverError(stderrBuf || stdoutBuf);
            if (parsedError) {
              error.parsedError = parsedError;
              if (parsedError.details) {
                error.clientMessage = parsedError.details;
              }
            }

            logger.error('SolverService: Solver failed', undefined, {
              code,
              stderr: stderrBuf,
              stdout: stdoutBuf,
              parsedError,
            });

            // Log full stderr for debugging
            if (stderrBuf) {
              console.error('=== FULL PYTHON STDERR ===');
              console.error(stderrBuf);
              console.error('=== END STDERR ===');
            }

            return reject(error);
          }

          // Parse output
          const outTrim = stdoutBuf.trim();

          // Log stderr even on success (exit code 0) for debugging
          if (stderrBuf && stderrBuf.trim()) {
            console.error('=== PYTHON STDERR (exit code 0) ===');
            console.error(stderrBuf);
            console.error('=== END STDERR ===');
          }

          if (!outTrim) {
            const error = new Error('Python solver returned empty output.') as SolverError;
            error.clientMessage =
              'Timetable solver returned no result. Check server logs or try again.';
            error.code = ERROR_CODES.SOLVER_EMPTY_OUTPUT;
            return reject(error);
          }

          // Try direct JSON parse
          try {
            const parsed = JSON.parse(outTrim);
            logger.info('SolverService: Solver completed successfully');
            return resolve(parsed);
          } catch (parseErr) {
            // Fallback: find last JSON block in output
            const jsonMatch = outTrim.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                logger.warn('SolverService: Parsed JSON from trailing block (fallback)');
                return resolve(parsed);
              } catch (innerErr) {
                const error = new Error(
                  `Failed to parse JSON output from solver. Error: ${(innerErr as Error).message}`
                ) as SolverError;
                error.clientMessage = 'Timetable solver returned an unreadable result.';
                error.code = ERROR_CODES.SOLVER_PARSE_ERROR;
                logger.error('SolverService: Failed to parse solver output', undefined, {
                  stdout: outTrim,
                  stderr: stderrBuf,
                });
                return reject(error);
              }
            } else {
              const error = new Error(
                `Failed to parse Python output: ${(parseErr as Error).message}`
              ) as SolverError;
              error.clientMessage = 'Timetable solver returned invalid output.';
              error.code = ERROR_CODES.SOLVER_PARSE_ERROR;
              logger.error('SolverService: No valid JSON in solver output', undefined, {
                stdout: outTrim,
                stderr: stderrBuf,
              });
              return reject(error);
            }
          }
        });
      } catch (outerErr) {
        this.clearCurrentProcess();
        this.cleanupTempFile();
        const error = outerErr as SolverError;
        error.clientMessage = 'Internal server error while preparing solver.';
        error.code = ERROR_CODES.INTERNAL_ERROR;
        return reject(error);
      }
    });
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use SolverService.getInstance().runSolver() instead
 */
export const runPythonSolver = (
  data: any,
  opts?: { timeoutMs?: number }
): Promise<SolverResult> => {
  return SolverService.getInstance().runSolver(data, opts);
};
