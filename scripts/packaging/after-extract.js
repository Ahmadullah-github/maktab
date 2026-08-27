const crypto = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { desktopStaging } = require('./release-inputs');

const projectRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(desktopStaging, 'component-integrity.json');

function digest(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Integrity input is missing: ${filePath}`);
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

exports.default = async function afterExtract(context) {
  fs.mkdirSync(desktopStaging, { recursive: true });
  const platform = context.electronPlatformName;
  const solverName = platform === 'win32' ? 'solver.exe' : 'solver';
  const solverSource = path.join(projectRoot, 'services', 'timetable-solver', 'dist', solverName);
  const nativeSource = path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  const releaseConfig = JSON.parse(fs.readFileSync(path.join(desktopStaging, 'release-config.json'), 'utf8'));
  const commitDate = spawnSync('git', ['show', '-s', '--format=%cI', releaseConfig.commitSha], {
    cwd: projectRoot, encoding: 'utf8',
  });
  const generatedAt = commitDate.stdout?.trim();
  if (commitDate.status !== 0 || !generatedAt || Number.isNaN(Date.parse(generatedAt))) {
    throw new Error('Could not derive deterministic component manifest timestamp');
  }
  const manifest = {
    schemaVersion: 1,
    platform,
    generatedAt,
    components: {
      betterSqlite3: {
        relativePath: 'app.asar.unpacked/node_modules/better-sqlite3/build/Release/better_sqlite3.node',
        sha256: digest(nativeSource),
      },
      solver: {
        relativePath: `solver/${solverName}`,
        sha256: digest(solverSource),
      },
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
};
