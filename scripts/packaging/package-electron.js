const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const releaseStagingPath = path.join(projectRoot, '.release-staging');
const nativeModulePath = path.join(
  projectRoot,
  'node_modules',
  'better-sqlite3',
  'build',
  'Release',
  'better_sqlite3.node'
);
const nativeModuleMetadataPath = path.join(path.dirname(nativeModulePath), '.forge-meta');
const electronBuilderCli = require.resolve('electron-builder/out/cli/cli.js', {
  paths: [projectRoot],
});

if (!fs.existsSync(nativeModulePath)) {
  throw new Error(
    `Native better-sqlite3 module not found at ${nativeModulePath}. Run npm install first.`
  );
}

const backupDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-native-module-'));
const backupPath = path.join(backupDirectory, 'better_sqlite3.node');
fs.copyFileSync(nativeModulePath, backupPath);
// A prior packaging run may leave Electron ABI metadata beside the restored
// Node binary. Removing it makes @electron/rebuild compile instead of trusting
// a stale ABI marker.
fs.rmSync(nativeModuleMetadataPath, { force: true });
fs.rmSync(releaseStagingPath, { force: true, recursive: true });

let result;
try {
  const builderArguments = [...process.argv.slice(2)];
  const releaseVersion = process.env.MAKTAB_RELEASE_VERSION;
  const publisher = process.env.MAKTAB_AUTHENTICODE_PUBLISHER;
  if (releaseVersion) builderArguments.push(`--config.extraMetadata.version=${releaseVersion}`);
  if (process.env.MAKTAB_SIGNING_MODE) builderArguments.push('--config.win.forceCodeSigning=true');
  if (process.env.MAKTAB_SIGNING_MODE === 'azure') {
    builderArguments.push(
      '--config.win.signtoolOptions=null',
      `--config.win.azureSignOptions.publisherName=${publisher}`,
      `--config.win.azureSignOptions.endpoint=${process.env.MAKTAB_AZURE_SIGNING_ENDPOINT}`,
      `--config.win.azureSignOptions.certificateProfileName=${process.env.MAKTAB_AZURE_CERTIFICATE_PROFILE}`,
      `--config.win.azureSignOptions.codeSigningAccountName=${process.env.MAKTAB_AZURE_CODE_SIGNING_ACCOUNT}`,
      '--config.win.azureSignOptions.fileDigest=SHA256',
      '--config.win.azureSignOptions.timestampDigest=SHA256',
      '--config.win.azureSignOptions.timestampRfc3161=http://timestamp.acs.microsoft.com'
    );
  } else if (publisher) {
    builderArguments.push(`--config.win.signtoolOptions.publisherName=${publisher}`);
  }
  result = spawnSync(process.execPath, [electronBuilderCli, ...builderArguments], {
    cwd: projectRoot,
    env: {
      ...process.env,
      MAKTAB_UPDATE_CHANNEL: process.env.MAKTAB_RELEASE_CHANNEL === 'stable' ? 'latest' : 'pilot',
    },
    stdio: 'inherit',
  });
} finally {
  // electron-builder may hard-link the rebuilt binary into app.asar.unpacked.
  // Replace the project copy instead of overwriting that shared inode.
  fs.rmSync(nativeModulePath, { force: true });
  fs.copyFileSync(backupPath, nativeModulePath);
  fs.rmSync(nativeModuleMetadataPath, { force: true });
  fs.rmSync(backupDirectory, { force: true, recursive: true });
}

if (result.error) throw result.error;
if (result.signal) {
  console.error(`electron-builder terminated by signal ${result.signal}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
