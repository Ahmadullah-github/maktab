const fs = require('fs');
const path = require('path');
const { IPC_CONTRACTS, IpcContractError, newCorrelationId } = require('./ipc-contracts');

class IpcBoundaryError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'IpcBoundaryError';
    this.code = code;
    this.retryable = retryable;
  }
}

const PUBLIC_MESSAGES = Object.freeze({
  IPC_INVALID_PAYLOAD: 'The desktop request is invalid.',
  IPC_UNTRUSTED_SENDER: 'The desktop request was denied.',
  IPC_INVALID_RESPONSE: 'The desktop operation returned an invalid response.',
  IPC_WINDOW_UNAVAILABLE: 'The application window is temporarily unavailable.',
});

function success(value) { return { ok: true, value }; }
function failure(code, correlationId, retryable = false) {
  return {
    ok: false,
    error: {
      code,
      message: PUBLIC_MESSAGES[code] || 'The desktop operation could not be completed.',
      retryable,
      correlationId,
    },
  };
}

function registerIpc({ ipcMain, dialog, getMainWindow, getRendererOrigin, runtimeInfo, licenseManager, backupManager, diagnosticsManager, updateManager }) {
  const assertTrustedSender = (event) => {
    const win = getMainWindow();
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame) {
      throw new IpcBoundaryError('IPC_UNTRUSTED_SENDER', 'IPC sender is not the active Maktab main frame');
    }
    let senderOrigin;
    try { senderOrigin = new URL(event.senderFrame.url).origin; } catch {
      throw new IpcBoundaryError('IPC_UNTRUSTED_SENDER', 'IPC sender URL is invalid');
    }
    if (senderOrigin !== getRendererOrigin()) {
      throw new IpcBoundaryError('IPC_UNTRUSTED_SENDER', 'IPC sender origin is not trusted');
    }
  };

  const handle = (channel, handler) => {
    const contract = IPC_CONTRACTS[channel];
    if (!contract) throw new Error(`IPC contract is missing for ${channel}`);
    ipcMain.handle(channel, async (event, payload) => {
      const correlationId = newCorrelationId();
      try {
        assertTrustedSender(event);
        const request = contract.parseRequest(payload);
        const value = await handler(request);
        try {
          contract.parseResponse(value);
        } catch (error) {
          if (error instanceof IpcContractError) throw new IpcBoundaryError('IPC_INVALID_RESPONSE', error.message);
          throw error;
        }
        return success(value);
      } catch (error) {
        let code = contract.failureCode;
        let retryable = false;
        if (error instanceof IpcContractError) code = 'IPC_INVALID_PAYLOAD';
        if (error instanceof IpcBoundaryError) { code = error.code; retryable = error.retryable; }
        else if (error && error.retryable === true) retryable = true;
        console.error(`[ipc] ${correlationId} ${channel}`, error);
        return failure(code, correlationId, retryable);
      }
    });
  };

  const requireWindow = () => {
    const win = getMainWindow();
    if (!win) throw new IpcBoundaryError('IPC_WINDOW_UNAVAILABLE', 'Application window is unavailable', true);
    return win;
  };

  handle('runtime:get', async () => runtimeInfo);
  handle('documents:save-pdf', async (options) => {
    const suggestedName = options?.suggestedName || 'maktab-timetable.pdf';
    const result = await dialog.showSaveDialog({
      title: 'Save timetable PDF',
      defaultPath: suggestedName.endsWith('.pdf') ? suggestedName : `${suggestedName}.pdf`,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const pdf = await requireWindow().webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
    await fs.promises.writeFile(result.filePath, pdf, { flag: 'wx' }).catch(async (error) => {
      if (error.code !== 'EEXIST') throw error;
      await fs.promises.writeFile(result.filePath, pdf);
    });
    return { canceled: false, filePath: path.basename(result.filePath) };
  });
  handle('documents:print', async () => {
    const win = requireWindow();
    await new Promise((resolve, reject) => {
      win.webContents.print({ printBackground: true }, (printed, reason) => {
        if (!printed && reason !== 'Print job canceled') reject(new Error(reason));
        else resolve();
      });
    });
    return { printed: true };
  });
  handle('diagnostics:get-status', async () => diagnosticsManager.getStatus());
  handle('diagnostics:export-support-bundle', async () => diagnosticsManager.exportBundle());
  handle('data:create-backup', async (payload) => backupManager.create(payload.passphrase));
  handle('data:inspect-backup', async (payload) => backupManager.selectAndInspect(payload.passphrase));
  handle('data:restore-backup', async (payload) => backupManager.restoreHandle(payload.handle, payload.passphrase));
  handle('license:get-status', async () => licenseManager.publicStatus());
  handle('license:activate', async (payload) => licenseManager.activate(payload.licenseKey));
  handle('license:refresh', async () => licenseManager.refresh());
  handle('license:deactivate', async () => licenseManager.deactivate());
  handle('updates:get-status', async () => updateManager.getStatus());
  handle('updates:check', async () => updateManager.check());
  handle('updates:download', async () => updateManager.download());
  handle('updates:cancel', async () => updateManager.cancel());
  handle('updates:install', async () => updateManager.install());
}

module.exports = { IpcBoundaryError, registerIpc };
