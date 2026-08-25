const { readdirSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

const repositoryRoot = join(__dirname, '..');
const desktopDirectory = join(repositoryRoot, 'apps', 'desktop');
const desktopFiles = readdirSync(desktopDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => join(desktopDirectory, entry.name))
  .sort();

if (desktopFiles.length === 0) {
  console.error('No desktop JavaScript files found to validate.');
  process.exit(1);
}

for (const file of desktopFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });

  if (result.error) {
    console.error(`Unable to validate ${relative(repositoryRoot, file)}: ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Validated ${desktopFiles.length} desktop JavaScript files.`);
