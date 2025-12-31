/**
 * Electron Preload Script
 * Exposes safe APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require("electron");

// Log that preload script is loaded
console.log("[Preload] Preload script loaded");

// Valid IPC channels
const validChannels = [
  "save-pdf-dialog",
  "save-pdf-file",
  "open-pdf",
  "get-machine-id",
  "get-short-machine-id",
];

// Expose protected methods that allow the renderer process
// to use Electron APIs safely
contextBridge.exposeInMainWorld("electron", {
  // Check if running in Electron
  isElectron: true,
  
  // PDF Export APIs
  ipcRenderer: {
    // Invoke IPC handlers for PDF operations
    invoke: (channel, payload) => {
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, payload);
      }
      console.warn("[Preload] Invalid channel:", channel);
      return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    },
  },
  
  // Machine ID APIs
  machineId: {
    /**
     * Get the full hardware-based machine ID
     * @returns {Promise<{status: string, machineId?: string, message?: string}>}
     */
    get: () => ipcRenderer.invoke("get-machine-id"),
    
    /**
     * Get the short format machine ID (XXXX-XXXX-XXXX)
     * Suitable for SMS/phone communication
     * @returns {Promise<{status: string, machineId?: string, message?: string}>}
     */
    getShort: () => ipcRenderer.invoke("get-short-machine-id"),
  },
});

// Log that contextBridge is set up
console.log("[Preload] contextBridge.exposeInMainWorld completed");

