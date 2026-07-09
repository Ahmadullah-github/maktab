import { describe, expect, it } from 'vitest';
import { parseSolverProgressUpdate } from '../solver.service';

describe('SolverService progress parsing', () => {
  it('parses structured progress updates from solver stderr', () => {
    const parsed = parseSolverProgressUpdate(
      JSON.stringify({
        type: 'progress',
        stage: 'solvingPhase1',
        stageFarsi: 'در حال حل (مرحله ۱)...',
        percentComplete: 42,
        estimatedSecondsRemaining: 18,
      })
    );

    expect(parsed).toEqual({
      type: 'progress',
      stage: 'solvingPhase1',
      stageFarsi: 'در حال حل (مرحله ۱)...',
      percentComplete: 42,
      estimatedSecondsRemaining: 18,
    });
  });

  it('ignores non-progress log lines', () => {
    expect(parseSolverProgressUpdate('plain text log line')).toBeNull();
    expect(parseSolverProgressUpdate(JSON.stringify({ type: 'info', message: 'hello' }))).toBeNull();
  });
});
