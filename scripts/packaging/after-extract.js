const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(projectRoot, 'apps', 'desktop', 'component-integrity.json');

function digest(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Integrity input is missing: ${filePath}`);
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

exports.default = async function afterExtract(context) {
  const platform = context.electronPlatformName;
  const solverName = platform === 'win32' ? 'solver.exe' : 'solver';
  const solverSource = path.join(projectRoot, 'services', 'timetable-solver', 'dist', solverName);
  const nativeSource = path.join(projectRoot, 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  const manifest = {
    schemaVersion: 1,
    platform,
    generatedAt: new Date().toISOString(),
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
