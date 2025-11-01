import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { parseSolverError, ParsedError } from './src/utils/errorParser';

type SolverResult = any;

interface SolverError extends Error {
  clientMessage?: string; // friendly message you can send to clients
  code?: string | number;
  parsedError?: ParsedError; // structured error information
}

const runPythonSolver = (data: any, opts?: { timeoutMs?: number }): Promise<SolverResult> => {
  const timeoutMs = opts?.timeoutMs ?? 120_000; // default 2 minutes

  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const isProduction = process.env.NODE_ENV === 'production';

        // Allow override via env variable (useful for packaging)
        const envSolverPath = process.env.SOLVER_PATH?.trim();

        // Resolve solver dir & script robustly from repo layout
        // Try multiple possible locations to find the solver directory
        let repoSolverDir: string;
        
        // Method 1: From compiled location (packages/api/dist)
        const fromCompiled = path.resolve(__dirname, '../../../', 'packages', 'solver');
        
        // Method 2: From current working directory (if running from project root)
        const fromCwd = path.resolve(process.cwd(), 'packages', 'solver');
        
        // Method 3: From current working directory's parent (if running from packages/api)
        const fromCwdParent = path.resolve(process.cwd(), '..', 'solver');
        
        // Check which path actually exists
        console.log('[GEN] Trying solver paths:');
        console.log('[GEN]  1. From compiled:', fromCompiled);
        console.log('[GEN]  2. From CWD:', fromCwd);
        console.log('[GEN]  3. From CWD parent:', fromCwdParent);
        
        if (fs.existsSync(path.join(fromCompiled, 'solver_enhanced.py'))) {
          repoSolverDir = fromCompiled;
          console.log('[GEN] Using path 1 (from compiled location)');
        } else if (fs.existsSync(path.join(fromCwd, 'solver_enhanced.py'))) {
          repoSolverDir = fromCwd;
          console.log('[GEN] Using path 2 (from CWD)');
        } else if (fs.existsSync(path.join(fromCwdParent, 'solver_enhanced.py'))) {
          repoSolverDir = fromCwdParent;
          console.log('[GEN] Using path 3 (from CWD parent)');
        } else {
          // Fallback to the original method
          repoSolverDir = fromCompiled;
          console.log('[GEN] Using fallback path (from compiled location)');
        }
        let solverDir: string;
        let solverScript: string;
        let pythonCommand: string;

        if (envSolverPath) {
          // If user provided a direct solver path it may be absolute (exe or py).
          solverScript = envSolverPath;
          solverDir = path.dirname(envSolverPath);
          // Choose pythonCommand only if the env path is a .py script; otherwise we treat it as executable.
          pythonCommand = path.extname(solverScript).toLowerCase() === '.py' ? (process.platform === 'win32' ? 'python' : 'python3') : solverScript;
          console.log('[GEN] SOLVER_PATH override detected:', solverScript);
        } else if (isProduction) {
          solverDir = repoSolverDir;
          solverScript = path.join(solverDir, 'solver_enhanced.exe'); // packaged exe expected
          pythonCommand = solverScript;
          console.log(`[GEN] Production mode — expecting executable at: ${solverScript}`);
        } else {
          solverDir = repoSolverDir;
          solverScript = path.join(solverDir, 'solver_enhanced.py');
          // Pick python command candidates; we will attempt to use the first that spawns successfully
          pythonCommand = process.platform === 'win32' ? 'python' : 'python3';
          console.log(`[GEN] Development mode — expected script: ${solverScript}`);
        }

        // Helpful debug info
        console.log('[GEN] __dirname =', __dirname);
        console.log('[GEN] process.cwd() =', process.cwd());
        console.log('[GEN] resolved solverDir =', solverDir);
        console.log('[GEN] resolved solverScript =', solverScript);

        if (!fs.existsSync(solverScript)) {
          const errMsg = `Python solver not found at: ${solverScript}`;
          const e = new Error(errMsg) as SolverError;
          e.clientMessage = 'Timetable solver is not available on the server (server configuration error).';
          e.code = 'SOLVER_NOT_FOUND';
          return reject(e);
        }

        // If we're referencing a .py file, ensure that a python binary is available (best-effort)
        let finalCmd = pythonCommand;
        let args: string[] = [];
        if (!isProduction && path.extname(solverScript).toLowerCase() === '.py') {
          // Try to find a working python candidate from a list (non-blocking: we attempt spawn and detect errors)
          const candidates = process.platform === 'win32' ? ['python', 'py', 'python3'] : ['python3', 'python'];
          let candidateFound = false;
          for (const cand of candidates) {
            try {
              // try spawn with version check (synchronously would hang — use a small async check with timeout)
              // We'll perform a lightweight spawn and immediately close it; if spawn throws ENOENT it will be caught.
              const check = spawn(cand, ['-V']);
              check.on('error', () => { /* ignore */ });
              // If spawn succeeded, use this candidate (we don't wait for output here)
              candidateFound = true;
              finalCmd = cand;
              break;
            } catch (err) {
              // try next candidate
            }
          }
          if (!candidateFound) {
            // fallback to the default already set (may produce ENOENT later)
            finalCmd = pythonCommand;
          }
          args = [solverScript];
        } else if (!isProduction) {
          // if SOLVER_PATH pointed to .exe or similar, or if pythonCommand is an exe, keep empty args
          args = path.extname(solverScript).toLowerCase() === '.py' ? [solverScript] : [];
          finalCmd = path.extname(solverScript).toLowerCase() === '.py' ? finalCmd : solverScript;
        } else {
          // production exe — run it directly (no args)
          args = [];
          finalCmd = solverScript;
        }

        console.log('[GEN] Final spawn command:', finalCmd, args.join(' '));
        console.log('[GEN] spawn cwd:', solverDir);

        // spawn with env to ensure unbuffered stdout from Python
        const proc = spawn(finalCmd, args, {
          cwd: solverDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        let stdoutBuf = '';
        let stderrBuf = '';
        let finished = false;

        const timeout = setTimeout(() => {
          if (!finished) {
            try { proc.kill('SIGKILL'); } catch (_) {}
            finished = true;
            const e = new Error(`Python solver timed out after ${timeoutMs}ms`) as SolverError;
            e.clientMessage = 'Timetable generation timed out. Try again or check server logs.';
            e.code = 'SOLVER_TIMEOUT';
            return reject(e);
          }
        }, timeoutMs);

        proc.stdin.on('error', (err) => {
          // ignore EPIPE when process closes early
          console.warn('[GEN] proc.stdin error:', err && (err as Error).message);
        });

        // send data to solver
        try {
          proc.stdin.write(JSON.stringify(data));
          proc.stdin.end();
        } catch (err) {
          console.error('[GEN] Failed to write to solver stdin:', (err as Error).message);
        }

        proc.stdout.on('data', (chunk: Buffer) => {
          const s = chunk.toString();
          stdoutBuf += s;
          console.log('[GEN][PY STDOUT]:', s.replace(/\n/g, '\\n'));
        });

        proc.stderr.on('data', (chunk: Buffer) => {
          const s = chunk.toString();
          stderrBuf += s;
          console.error('[GEN][PY STDERR]:', s.replace(/\n/g, '\\n'));
        });

        proc.on('error', (err: Error) => {
          clearTimeout(timeout);
          finished = true;
          console.error('[GEN] Failed to start solver process:', err.message);
          const e = new Error(`Failed to start solver process: ${err.message}`) as SolverError;
          e.clientMessage = 'Internal server error while starting timetable solver (server misconfiguration).';
          e.code = 'SOLVER_SPAWN_ERROR';
          return reject(e);
        });

        proc.on('close', (code) => {
          clearTimeout(timeout);
          finished = true;
          console.log(`[GEN] Solver process exited with code: ${code}`);
          // Prefer stderr for human-readable logs; but treat non-zero as failure
          if (code !== 0) {
            const e = new Error(`Python solver failed (exit code ${code}). stderr: ${stderrBuf || stdoutBuf}`) as SolverError;
            e.clientMessage = 'Timetable solver failed to generate a timetable (solver runtime error). Check input or server logs.';
            e.code = 'SOLVER_RUNTIME_ERROR';
            
            // Try to parse structured error from stderr
            const parsedError = parseSolverError(stderrBuf || stdoutBuf);
            if (parsedError) {
              e.parsedError = parsedError;
              // Update client message with more specific information if available
              if (parsedError.details) {
                e.clientMessage = parsedError.details;
              }
            }
            
            // include captured stderr for server logs (don't leak raw tracebacks to clients)
            console.error('[GEN] Solver stderr:', stderrBuf);
            return reject(e);
          }

          const outTrim = stdoutBuf.trim();
          if (!outTrim) {
            const e = new Error('Python solver returned empty output.') as SolverError;
            e.clientMessage = 'Timetable solver returned no result.';
            e.code = 'SOLVER_EMPTY_OUTPUT';
            e.clientMessage = 'Timetable solver returned no result. Check server logs or try again.';
            return reject(e);
          }

          // Try direct parse. If it fails, fallback to extract last JSON block.
          try {
            const parsed = JSON.parse(outTrim);
            return resolve(parsed);
          } catch (parseErr) {
            // Fallback: find last {...} or [...] block in output
            const jsonMatch = outTrim.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
            if (jsonMatch && jsonMatch[1]) {
              try {
                const parsed = JSON.parse(jsonMatch[1]);
                console.warn('[GEN] Parsed JSON from trailing block (fallback).');
                return resolve(parsed);
              } catch (innerErr) {
                const e = new Error(`Failed to parse JSON output from solver. Error: ${(innerErr as Error).message}`) as SolverError;
                e.clientMessage = 'Timetable solver returned an unreadable result.';
                e.code = 'SOLVER_PARSE_ERROR';
                console.error('[GEN] Full solver stdout:', outTrim);
                console.error('[GEN] Full solver stderr:', stderrBuf);
                return reject(e);
              }
            } else {
              const e = new Error(`Failed to parse Python output: ${(parseErr as Error).message}`) as SolverError;
              e.clientMessage = 'Timetable solver returned invalid output.';
              e.code = 'SOLVER_PARSE_ERROR_NO_JSON';
              console.error('[GEN] Full solver stdout:', outTrim);
              console.error('[GEN] Full solver stderr:', stderrBuf);
              return reject(e);
            }
          }
        });

      } catch (outerErr) {
        const e = outerErr as SolverError;
        e.clientMessage = 'Internal server error while preparing solver.';
        e.code = 'SOLVER_INTERNAL';
        return reject(e);
      }
    })();
  });
};

export { runPythonSolver };
