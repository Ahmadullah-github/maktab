const fs = require('fs');
const os = require('os');
const path = require('path');
const { stagingRoot } = require('./release-inputs');

function pruneTree(root) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (/^(?:test|tests|__tests__)$/.test(entry.name)) {
        fs.rmSync(entryPath, { recursive: true, force: true });
      } else {
        pruneTree(entryPath);
      }
    } else if (/\.(?:map|tsbuildinfo)$/.test(entry.name)) {
      fs.rmSync(entryPath, { force: true });
    }
  }
}

exports.default = async function afterPack(context) {
  const resourcesPath = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const asarPath = path.join(resourcesPath, 'app.asar');
  if (!fs.existsSync(asarPath)) throw new Error(`Packaged ASAR is missing: ${asarPath}`);
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-asar-prune-'));
  const extracted = path.join(temporaryDirectory, 'app');
  const replacement = path.join(temporaryDirectory, 'app.asar');
  try {
    const asar = await import('@electron/asar');
    asar.extractAll(asarPath, extracted);
    pruneTree(extracted);
    await asar.createPackageWithOptions(extracted, replacement, {
      unpack: '**/*.node',
    });
    fs.copyFileSync(replacement, `${asarPath}.next`);
    fs.renameSync(`${asarPath}.next`, asarPath);
    const unpackedPath = `${asarPath}.unpacked`;
    fs.rmSync(unpackedPath, { recursive: true, force: true });
    const repackedUnpacked = `${replacement}.unpacked`;
    if (fs.existsSync(repackedUnpacked)) fs.renameSync(repackedUnpacked, unpackedPath);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
};
