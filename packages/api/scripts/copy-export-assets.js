const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../assets/fonts');
const destination = path.resolve(__dirname, '../dist/assets/fonts');

if (!fs.existsSync(source)) {
  throw new Error(`PDF font assets are missing: ${source}`);
}

fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true, force: true });
