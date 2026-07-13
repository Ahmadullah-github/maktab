const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const nativeModulePath = path.join(
  projectRoot,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const backupPath = `${nativeModulePath}.node-runtime-backup`;
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js', {
  paths: [projectRoot],
});

if (!fs.existsSync(nativeModulePath)) {
  throw new Error(
    `Native better-sqlite3 module not found at ${nativeModulePath}. Run npm install first.`
  );
}

fs.copyFileSync(nativeModulePath, backupPath);

let result;
try {
  result = spawnSync(process.execPath, [electronBuilderCli, ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit',
  });
} finally {
  fs.copyFileSync(backupPath, nativeModulePath);
  fs.rmSync(backupPath, { force: true });
}

if (result.error) throw result.error;
if (result.signal) {
  console.error(`electron-builder terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
