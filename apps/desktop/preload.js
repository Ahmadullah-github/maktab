const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld('maktab', Object.freeze({
  runtime: Object.freeze({ get: () => invoke('runtime:get') }),
  license: Object.freeze({
    getStatus: () => invoke('license:get-status'),
    activate: (licenseKey) => invoke('license:activate', { licenseKey }),
    refresh: () => invoke('license:refresh'),
    deactivate: () => invoke('license:deactivate'),
  }),
  documents: Object.freeze({
    savePdf: (options) => invoke('documents:save-pdf', options),
    print: () => invoke('documents:print'),
  }),
  diagnostics: Object.freeze({
    getStatus: () => invoke('diagnostics:get-status'),
    exportSupportBundle: () => invoke('diagnostics:export-support-bundle'),
  }),
  data: Object.freeze({
    createBackup: (passphrase) => invoke('data:create-backup', { passphrase }),
    inspectBackup: (passphrase) => invoke('data:inspect-backup', { passphrase }),
    restoreBackup: (handle, passphrase) => invoke('data:restore-backup', { handle, passphrase }),
  }),
  updates: Object.freeze({
    getStatus: () => invoke('updates:get-status'),
    check: () => invoke('updates:check'),
    download: () => invoke('updates:download'),
    cancel: () => invoke('updates:cancel'),
    install: () => invoke('updates:install'),
  }),
}));
