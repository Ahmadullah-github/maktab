const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function defaultPackageDirectory() {
  if (process.platform === 'win32') return path.join(projectRoot, 'dist-electron', 'win-unpacked');
  if (process.platform === 'darwin') return path.join(projectRoot, 'dist-electron', 'mac', 'Maktab Timetable.app');
  return path.join(projectRoot, 'dist-electron', 'linux-unpacked');
}

function findExecutable(packageDirectory) {
  if (process.platform === 'darwin') return path.join(packageDirectory, 'Contents', 'MacOS', 'Maktab Timetable');
  const candidates = fs.readdirSync(packageDirectory, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile()) return false;
      if (process.platform === 'win32') return entry.name.endsWith('.exe') && !/^unins/i.test(entry.name);
      return Boolean(fs.statSync(path.join(packageDirectory, entry.name)).mode & 0o111);
    })
    .sort((left, right) => (
      fs.statSync(path.join(packageDirectory, right.name)).size
      - fs.statSync(path.join(packageDirectory, left.name)).size
    ));
  assert.ok(candidates[0], `Packaged executable was not found in ${packageDirectory}`);
  return path.join(packageDirectory, candidates[0].name);
}

function containsDatabase(directory) {
  if (!fs.existsSync(directory)) return false;
  return fs.readdirSync(directory, { withFileTypes: true }).some((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return containsDatabase(entryPath);
    return entry.isFile() && entry.name === 'timetable.db';
  });
}

function mutateLastByte(filePath) {
  const descriptor = fs.openSync(filePath, 'r+');
  try {
    const size = fs.fstatSync(descriptor).size;
    assert.ok(size > 0, `Cannot tamper with empty file: ${filePath}`);
    const byte = Buffer.alloc(1);
    fs.readSync(descriptor, byte, 0, 1, size - 1);
    byte[0] = 255 - byte[0];
    fs.writeSync(descriptor, byte, 0, 1, size - 1);
  } finally {
    fs.closeSync(descriptor);
  }
}

async function stopProcess(child) {
  if (child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGKILL');
  }
  await new Promise((resolve) => child.once('exit', resolve));
}

async function assertRefusesStartup(packageDirectory, profileDirectory) {
  const environment = { ...process.env, LOG_LEVEL: 'error' };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  if (process.platform === 'win32') {
    environment.APPDATA = profileDirectory;
    environment.LOCALAPPDATA = profileDirectory;
  } else {
    environment.XDG_CONFIG_HOME = profileDirectory;
  }
  const child = spawn(
    findExecutable(packageDirectory),
    process.platform === 'linux' ? ['--no-sandbox'] : [],
    { env: environment, stdio: 'ignore', windowsHide: true }
  );
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 15_000)),
  ]);
  await stopProcess(child);
  assert.equal(containsDatabase(profileDirectory), false, 'Tampered package reached normal database startup');
}

async function main() {
  const sourcePackage = defaultPackageDirectory();
  assert.ok(fs.existsSync(sourcePackage), `Packaged desktop directory does not exist: ${sourcePackage}`);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-tamper-'));
  const packageDirectory = path.join(temporaryRoot, 'package');
  try {
    fs.cpSync(sourcePackage, packageDirectory, { recursive: true });
    const resourcesPath = process.platform === 'darwin'
      ? path.join(packageDirectory, 'Contents', 'Resources')
      : path.join(packageDirectory, 'resources');
    const targets = [
      ['app.asar', path.join(resourcesPath, 'app.asar')],
      ['solver', path.join(resourcesPath, 'solver', process.platform === 'win32' ? 'solver.exe' : 'solver')],
      [
        'better-sqlite3',
        path.join(
          resourcesPath,
          'app.asar.unpacked',
          'node_modules',
          'better-sqlite3',
          'build',
          'Release',
          'better_sqlite3.node'
        ),
      ],
    ];
    for (const [name, target] of targets) {
      assert.ok(fs.existsSync(target), `Packaged tamper target is missing: ${target}`);
      const original = fs.readFileSync(target);
      mutateLastByte(target);
      await assertRefusesStartup(packageDirectory, path.join(temporaryRoot, `profile-${name}`));
      fs.writeFileSync(target, original);
      console.log(`Tampered ${name} refused normal startup.`);
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
