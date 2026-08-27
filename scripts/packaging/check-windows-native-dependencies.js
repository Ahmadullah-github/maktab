const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const lock = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package-lock.json'), 'utf8'));
const packages = lock.packages || {};
const windowsX64Packages = new Set();
const missingLockEntries = [];

for (const [owner, metadata] of Object.entries(packages)) {
  for (const [name, version] of Object.entries(metadata.optionalDependencies || {})) {
    if (!/win32.*x64|x64.*win32/i.test(name)) continue;
    windowsX64Packages.add(name);
    if (!packages[`node_modules/${name}`]) {
      missingLockEntries.push(`${name}@${version} (required by ${owner || '(root)'})`);
    }
  }
}

if (missingLockEntries.length > 0) {
  throw new Error(
    `package-lock.json is missing Windows x64 optional dependencies:\n${missingLockEntries.join('\n')}`
  );
}

if (process.platform === 'win32' && process.arch === 'x64') {
  const missingInstalls = [];
  for (const name of windowsX64Packages) {
    // Some platform packages (notably @esbuild/win32-x64) expose only a
    // binary and therefore cannot be resolved as a JavaScript module.
    if (!fs.existsSync(path.join(projectRoot, 'node_modules', name, 'package.json'))) {
      missingInstalls.push(name);
    }
  }
  if (missingInstalls.length > 0) {
    throw new Error(`Windows x64 native dependencies were not installed: ${missingInstalls.join(', ')}`);
  }
}

console.log(
  `Validated ${windowsX64Packages.size} Windows x64 native optional dependency lock entries.`
);
