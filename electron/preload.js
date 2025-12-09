/**
 * Electron Preload Script
 * Exposes safe APIs to renderer process
 */

const { contextBridge, ipcRenderer } = require("electron");

// Log that preload script is loaded
console.log("[Preload] Preload script loaded");

// Expose protected methods that allow the renderer process
// to use Electron APIs safely
contextBridge.exposeInMainWorld("electron", {
  // Check if running in Electron
  isElectron: true,
  
  // PDF Export APIs
  ipcRenderer: {
    // Invoke IPC handlers for PDF operations
    invoke: (channel, payload) => {
      const validChannels = ["save-pdf-dialog", "save-pdf-file", "open-pdf"];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, payload);
      }
      console.warn("[Preload] Invalid channel:", channel);
      return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
    },
  },
});

// Log that contextBridge is set up
console.log("[Preload] contextBridge.exposeInMainWorld completed");

