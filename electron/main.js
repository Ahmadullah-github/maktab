const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs").promises;

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // In development we expect the frontend dev server to be running on 5173
  const isDev =
    process.env.NODE_ENV === "development" || !!process.env.ELECTRON_START_URL;
  const devUrl = process.env.ELECTRON_START_URL || "http://localhost:5173";

  // Helper that checks whether the dev server responds (so Electron can auto-detect dev mode)
  function probeUrl(url, timeout = 1500) {
    return new Promise((resolve) => {
      try {
        const http = url.startsWith("https")
          ? require("https")
          : require("http");
        const req = http.get(url, { timeout }, (res) => {
          const ok =
            res.statusCode && res.statusCode >= 200 && res.statusCode < 400;
          res.resume();
          resolve(Boolean(ok));
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => {
          req.abort();
          resolve(false);
        });
      } catch (e) {
        resolve(false);
      }
    });
  }

  console.log(
    "[electron] NODE_ENV=",
    process.env.NODE_ENV,
    "ELECTRON_START_URL=",
    process.env.ELECTRON_START_URL
  );

  // If NODE_ENV set to development or an explicit start URL exists, prefer that.
  // Otherwise probe the dev URL — if it responds, load it. If not, fall back to the
  // built index.html (production).
  if (isDev) {
    console.log("[electron] loading dev URL (env):", devUrl);
    win
      .loadURL(devUrl)
      .then(() => {
        console.log("[electron] loaded dev URL");
        try {
          win.webContents.openDevTools({ mode: "detach" });
        } catch (e) {
          /* ignore */
        }
      })
      .catch((err) => console.error("[electron] Failed to load dev URL", err));
  } else {
    probeUrl(devUrl).then((available) => {
      if (available) {
        console.log(
          "[electron] dev server detected at",
          devUrl,
          "- loading it"
        );
        win
          .loadURL(devUrl)
          .then(() => {
            console.log("[electron] loaded dev URL");
            try {
              win.webContents.openDevTools({ mode: "detach" });
            } catch (e) {
              /* ignore */
            }
          })
          .catch((err) =>
            console.error("[electron] Failed to load dev URL", err)
          );
      } else {
        const indexPath = path.join(
          __dirname,
          "..",
          "packages",
          "web",
          "dist",
          "index.html"
        );
        console.log(
          "[electron] dev server not detected; loading file:",
          indexPath
        );
        win.loadFile(indexPath).catch((err) => {
          console.error("[electron] Failed to load file:", err);
        });
      }
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ============================================
// PDF Export Functionality
// ============================================

// PDF Export is now handled in the renderer process using jsPDF
// No complex IPC handlers needed - only save dialog and open file handlers

// IPC Handlers
// ============================================

// IPC Handler: Save PDF dialog
ipcMain.handle("save-pdf-dialog", async (event, options) => {
  try {
    const { filename = "timetable.pdf", defaultPath = filename } = options || {};
    
    const result = await dialog.showSaveDialog({
      title: "Save PDF",
      defaultPath: defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    return {
      canceled: result.canceled || false,
      filePath: result.filePath || null,
    };
  } catch (error) {
    console.error("[Save PDF Dialog] Error:", error);
    return {
      canceled: true,
      filePath: null,
      error: error.message || "Failed to show save dialog",
    };
  }
});

// IPC Handler: Save PDF file
ipcMain.handle("save-pdf-file", async (event, options) => {
  try {
    const { path: filePath, data } = options || {};
    
    if (!filePath || !data) {
      throw new Error("Invalid file path or data");
    }

    // Convert buffer data to Buffer if needed
    // In Electron, data comes as ArrayBuffer or Uint8Array from renderer
    let buffer;
    if (Buffer.isBuffer(data)) {
      buffer = data;
    } else if (data instanceof Uint8Array) {
      buffer = Buffer.from(data);
    } else if (data instanceof ArrayBuffer) {
      buffer = Buffer.from(data);
    } else if (Array.isArray(data)) {
      buffer = Buffer.from(data);
    } else {
      throw new Error("Invalid data format");
    }
    
    // Write PDF to disk
    await fs.writeFile(filePath, buffer);
    
    return {
      status: "success",
      message: "PDF saved successfully",
      path: filePath,
    };
  } catch (error) {
    console.error("[Save PDF File] Error:", error);
    return {
      status: "error",
      message: error.message || "Failed to save PDF",
    };
  }
});

// IPC Handler: Open PDF file with default application
ipcMain.handle("open-pdf", async (event, filePath) => {
  try {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("Invalid file path");
    }

    // Check if file exists
    const fsSync = require("fs");
    if (!fsSync.existsSync(filePath)) {
      throw new Error("PDF file not found");
    }

    // Open PDF with default application
    await shell.openPath(filePath);
    
    return {
      status: "success",
      message: "PDF opened successfully",
    };
  } catch (error) {
    console.error("[Open PDF] Error:", error);
    return {
      status: "error",
      message: error.message || "Failed to open PDF",
    };
  }
});
