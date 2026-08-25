const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

const MAX_BUNDLE_BYTES = 25 * 1024 * 1024;
const MAX_AGE_MS = 7 * 86_400_000;

function redact(text) {
  return text
    .replace(/(authorization|refresh[_ -]?token|license[_ -]?key|password)["'=:\s]+[^\s,"}]+/gi, '$1=[REDACTED]')
    .replace(/[A-Za-z]:\\Users\\[^\\\s]+/gi, '%USERPROFILE%')
    .replace(/\/home\/[^/\s]+/g, '/home/[USER]');
}

class DiagnosticsManager {
  constructor({ app, dialog, runtimeInfo, getReadiness, getLicenseStatus, getSecurityStatus }) {
    this.app = app; this.dialog = dialog; this.runtime = runtimeInfo;
    this.getReadiness = getReadiness; this.getLicenseStatus = getLicenseStatus;
    this.getSecurityStatus = getSecurityStatus;
  }

  getStatus() {
    const ready = this.getReadiness();
    return {
      runtime: this.runtime,
      components: ready ? { database: ready.database, solver: ready.solver, licenseVerifier: ready.licenseVerifier } : { status: 'starting' },
      license: this.getLicenseStatus(),
      security: this.getSecurityStatus(),
    };
  }

  async exportBundle() {
    const selected = await this.dialog.showSaveDialog({ title: 'Export redacted Maktab support bundle', defaultPath: `maktab-support-${new Date().toISOString().slice(0, 10)}.zip`, filters: [{ name: 'ZIP', extensions: ['zip'] }] });
    if (selected.canceled || !selected.filePath) return { canceled: true };
    const zip = new AdmZip();
    zip.addFile('diagnostics.json', Buffer.from(JSON.stringify(this.getStatus(), null, 2)));
    const directory = path.join(this.app.getPath('userData'), 'logs');
    let includedBytes = 0;
    if (fs.existsSync(directory)) {
      for (const name of fs.readdirSync(directory).filter((value) => /^[A-Za-z0-9._-]+\.log(?:\.\d+)?$/.test(value))) {
        const file = path.join(directory, name);
        const stat = fs.statSync(file);
        if (Date.now() - stat.mtimeMs > MAX_AGE_MS || includedBytes + stat.size > MAX_BUNDLE_BYTES) continue;
        const content = Buffer.from(redact(fs.readFileSync(file, 'utf8')));
        includedBytes += content.length;
        zip.addFile(`logs/${name}`, content);
      }
    }
    const temporary = `${selected.filePath}.tmp`;
    await fs.promises.writeFile(temporary, zip.toBuffer(), { mode: 0o600 });
    await fs.promises.rename(temporary, selected.filePath);
    return { canceled: false, fileName: path.basename(selected.filePath), bytes: includedBytes };
  }
}

module.exports = { DiagnosticsManager, redact };
