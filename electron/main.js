const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const path = require("path");
const { getMachineId, getShortMachineId } = require("./machineId");

const DEVELOPMENT_WEB_URL =
  process.env.ELECTRON_START_URL || "http://127.0.0.1:5173";
const DEVELOPMENT_API_HEALTH_URL =
  process.env.ELECTRON_API_HEALTH_URL || "http://127.0.0.1:4000/api/health";
const STARTUP_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;

let apiProcess = null;
let apiBaseUrl = null;
let mainWindow = null;
let isQuitting = false;

function waitForUrl(url, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, { timeout: 1_500 }, (response) => {
        const isReady =
          response.statusCode && response.statusCode >= 200 && response.statusCode < 400;
        response.resume();

        if (isReady) {
          resolve();
          return;
        }

        retry(`HTTP ${response.statusCode || "unknown"}`);
      });

      request.on("error", (error) => retry(error.message));
      request.on("timeout", () => {
        request.destroy();
        retry("request timed out");
      });
    };

    const retry = (reason) => {
      if (Date.now() >= deadline) {
        reject(new Error(`Timed out waiting for ${url}: ${reason}`));
        return;
      }
      setTimeout(attempt, 250);
    };

    attempt();
  });
}

function createWindow(rendererUrl) {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow = win;
  win.on("closed", () => {
    if (mainWindow === win) mainWindow = null;
  });

  win.loadURL(rendererUrl).catch((error) => {
    console.error("[electron] Failed to load renderer", error);
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
}

function getPackagedSolverPath() {
  const executableName = process.platform === "win32" ? "solver.exe" : "solver";
  return path.join(process.resourcesPath, "solver", executableName);
}

function startProductionApi() {
  const serverPath = path.join(app.getAppPath(), "packages", "api", "dist", "server.js");
  const webDistPath = path.join(app.getAppPath(), "packages", "web", "dist");
  const solverPath = getPackagedSolverPath();

  if (!fs.existsSync(serverPath)) {
    return Promise.reject(new Error(`Packaged API entrypoint not found: ${serverPath}`));
  }
  if (!fs.existsSync(path.join(webDistPath, "index.html"))) {
    return Promise.reject(new Error(`Packaged web assets not found: ${webDistPath}`));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let ready = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      reject(error);
    };
    const startupTimer = setTimeout(() => {
      fail(new Error("The local API did not become ready before the startup timeout."));
    }, STARTUP_TIMEOUT_MS);

    const env = {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOST: "127.0.0.1",
      PORT: "0",
      DATABASE_PATH: path.join(app.getPath("userData"), "timetable.db"),
      WEB_DIST_PATH: webDistPath,
    };

    if (fs.existsSync(solverPath)) {
      env.SOLVER_PATH = solverPath;
    }

    const child = spawn(process.execPath, [serverPath], {
      env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    apiProcess = child;

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[api] ${chunk}`);
    });
    child.stderr.on("data", (chunk) => {
      process.stderr.write(`[api] ${chunk}`);
    });

    child.once("error", fail);
    child.on("message", async (message) => {
      if (!message || typeof message !== "object") return;

      if (message.type === "api-error") {
        fail(new Error(message.message || "The local API failed to start."));
        return;
      }

      if (message.type === "api-ready" && Number.isInteger(message.port)) {
        const baseUrl = `http://127.0.0.1:${message.port}`;
        try {
          await waitForUrl(`${baseUrl}/api/health`);
          if (settled) return;
          settled = true;
          ready = true;
          clearTimeout(startupTimer);
          apiBaseUrl = baseUrl;
          resolve(baseUrl);
        } catch (error) {
          fail(error);
        }
      }
    });

    child.once("exit", (code, signal) => {
      const wasActiveProcess = apiProcess === child;
      if (wasActiveProcess) apiProcess = null;

      if (!ready) {
        fail(
          new Error(
            `The local API exited during startup (code=${code ?? "none"}, signal=${signal ?? "none"}).`
          )
        );
        return;
      }

      if (!isQuitting && wasActiveProcess) {
        dialog.showErrorBox(
          "Local API stopped",
          "The application service stopped unexpectedly. The desktop application will now close."
        );
        app.quit();
      }
    });
  });
}

async function stopProductionApi() {
  const child = apiProcess;
  apiProcess = null;
  apiBaseUrl = null;

  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  await new Promise((resolve) => {
    let finished = false;
    const complete = () => {
      if (finished) return;
      finished = true;
      clearTimeout(forceTimer);
      resolve();
    };
    const forceTimer = setTimeout(() => {
      child.kill("SIGKILL");
      complete();
    }, SHUTDOWN_TIMEOUT_MS);

    child.once("exit", complete);
    child.kill("SIGTERM");
  });
}

async function startApplication() {
  try {
    let rendererUrl;
    if (app.isPackaged) {
      rendererUrl = await startProductionApi();
    } else {
      await Promise.all([
        waitForUrl(DEVELOPMENT_WEB_URL),
        waitForUrl(DEVELOPMENT_API_HEALTH_URL),
      ]);
      rendererUrl = DEVELOPMENT_WEB_URL;
    }

    createWindow(rendererUrl);
  } catch (error) {
    await stopProductionApi();
    if (isQuitting) return;

    const message = error instanceof Error ? error.message : String(error);
    const { response } = await dialog.showMessageBox({
      type: "error",
      title: "Application startup failed",
      message: "The desktop application could not start its local services.",
      detail: message,
      buttons: ["Retry", "Quit"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });

    if (response === 0) {
      await startApplication();
    } else {
      app.quit();
    }
  }
}

app.whenReady().then(() => {
  void startApplication();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length > 0) return;

    const rendererUrl = app.isPackaged ? apiBaseUrl : DEVELOPMENT_WEB_URL;
    if (rendererUrl) createWindow(rendererUrl);
    else void startApplication();
  });
});

app.on("before-quit", (event) => {
  if (!apiProcess || isQuitting) return;

  event.preventDefault();
  isQuitting = true;
  void stopProductionApi().finally(() => app.quit());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
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
    await fs.promises.writeFile(filePath, buffer);

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

// ============================================
// Machine ID Functionality
// ============================================

// IPC Handler: Get full machine ID
ipcMain.handle("get-machine-id", async () => {
  try {
    const machineId = await getMachineId();
    return {
      status: "success",
      machineId,
    };
  } catch (error) {
    console.error("[Get Machine ID] Error:", error);
    return {
      status: "error",
      message: error.message || "Failed to get machine ID",
    };
  }
});

// IPC Handler: Get short format machine ID (XXXX-XXXX-XXXX)
ipcMain.handle("get-short-machine-id", async () => {
  try {
    const shortMachineId = await getShortMachineId();
    return {
      status: "success",
      machineId: shortMachineId,
    };
  } catch (error) {
    console.error("[Get Short Machine ID] Error:", error);
    return {
      status: "error",
      message: error.message || "Failed to get short machine ID",
    };
  }
});
