const fs = require('fs');
const path = require('path');
const { normalizeAsarEntry } = require('./asar-path');
const { stagingRoot } = require('./release-inputs');

exports.default = async function afterPack(context) {
  const resourcesPath = context.electronPlatformName === 'darwin'
    ? path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  const asarPath = path.join(resourcesPath, 'app.asar');
  if (!fs.existsSync(asarPath)) throw new Error(`Packaged ASAR is missing: ${asarPath}`);
  try {
    const asar = await import('@electron/asar');
    const forbidden = asar.listPackage(asarPath).map(normalizeAsarEntry).filter((entry) => (
      /\.(?:map|tsbuildinfo)$/i.test(entry)
      || /(?:^|\/)(?:test|tests|__tests__)(?:\/|$)/i.test(entry)
    ));
    if (forbidden.length > 0) {
      throw new Error(`Forbidden development files were packaged: ${forbidden.slice(0, 20).join(', ')}`);
    }
  } finally {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  }
};
