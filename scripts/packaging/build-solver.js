const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const solverRoot = path.join(root, 'services', 'timetable-solver');
const entrypoint = path.join(solverRoot, 'solver.py');
const distPath = path.join(solverRoot, 'dist');
const workPath = path.join(root, '.cache', 'pyinstaller');
const specPath = path.join(workPath, 'spec');
const workspaceVenvPython =
  process.platform === 'win32'
    ? path.join(root, '.venv', 'Scripts', 'python.exe')
    : path.join(root, '.venv', 'bin', 'python');
const python =
  process.env.PYTHON ||
  (fs.existsSync(workspaceVenvPython) ? workspaceVenvPython : 'python3');

if (!fs.existsSync(entrypoint)) {
  throw new Error(`Solver entrypoint not found: ${entrypoint}`);
}

fs.rmSync(distPath, { recursive: true, force: true });
fs.mkdirSync(distPath, { recursive: true });
fs.mkdirSync(specPath, { recursive: true });

const result = spawnSync(
  python,
  [
    '-m',
    'PyInstaller',
    '--noconfirm',
    '--clean',
    '--onefile',
    '--name',
    'solver',
    '--distpath',
    distPath,
    '--workpath',
    workPath,
    '--specpath',
    specPath,
    entrypoint,
  ],
  {
    cwd: solverRoot,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: 'inherit',
  }
);

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(
    'Solver packaging failed. Run `uv sync --all-packages --all-groups` and retry.'
  );
}

const artifact = path.join(distPath, process.platform === 'win32' ? 'solver.exe' : 'solver');
if (!fs.existsSync(artifact)) {
  throw new Error(`Solver packager did not produce ${artifact}`);
}

console.log(`Solver artifact created: ${artifact}`);
