const fs = require('fs');
const path = require('path');

exports.default = async function afterPack() {
  const desktopDirectory = path.resolve(__dirname, '..', '..', 'apps', 'desktop');
  for (const name of ['component-integrity.json', 'license-public-keys.json', 'update-public-keys.json']) {
    fs.rmSync(path.join(desktopDirectory, name), { force: true });
  }
};
