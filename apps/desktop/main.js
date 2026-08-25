const { app, BrowserWindow, ipcMain, dialog, safeStorage, session, utilityProcess } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { getRuntimeInfo } = require('./runtime');
const { registerIpc } = require('./ipc');
const { LicenseManager } = require('./license');
const { BackupManager } = require('./backup');
const { DiagnosticsManager } = require('./diagnostics');
const { UpdateManager } = require('./update');
const { parseApiProcessMessage } = require('./process-messages');
const { verifyPackagedComponents } = require('./resource-integrity');
const { isAllowedRendererNavigation, verifySafeStorage } = require('./security');

const DEVELOPMENT_WEB_URL = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173';
const DEVELOPMENT_API_HEALTH_URL = process.env.ELECTRON_API_HEALTH_URL || 'http://127.0.0.1:4000/local-api/v1/health/ready';
const STARTUP_TIMEOUT_MS = 90_000;
const SHUTDOWN_TIMEOUT_MS = 8_000;

let apiProcess = null;
let apiBaseUrl = null;
let apiSessionToken = null;
let mainWindow = null;
let rendererOrigin = null;
let isQuitting = false;
let crashRestarts = 0;
let startupStage = 'initializing';
let licenseManager = null;
let apiReadiness = null;
let securityStatus = Object.freeze({ safeStorage: 'not-applicable' });
const intentionalApiStops = new WeakSet();

const hasInstanceLock = app.requestSingleInstanceLock();
if (!hasInstanceLock) app.quit();

function requestJson(url, token, timeoutMs = 2_000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, {
      timeout: timeoutMs,
      headers: token ? { 'X-Maktab-Local-Token': token } : {},
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Readiness returned HTTP ${response.statusCode || 'unknown'}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch { reject(new Error('Readiness returned invalid JSON')); }
      });
    });
    request.once('error', reject);
    request.once('timeout', () => request.destroy(new Error('Readiness request timed out')));
  });
}

async function waitForReadiness(url, token, expectedBuildId, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastError = new Error('Readiness has not responded');
  while (Date.now() < deadline) {
    try {
      const ready = await requestJson(url, token);
      if (ready.status !== 'ready' || ready.protocolVersion !== 1) throw new Error('Incompatible local API protocol');
      if (expectedBuildId && ready.buildId !== expectedBuildId) throw new Error('Local API build does not match the desktop build');
      if (ready.database?.status !== 'ok' || ready.solver?.status !== 'ok') throw new Error('Local components are not ready');
      return ready;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`Startup timed out during ${startupStage}: ${lastError.message}`);
}

async function waitForUrl(url, timeoutMs = STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.get(url, { timeout: 1500 }, (response) => {
          response.resume();
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 400) resolve();
          else reject(new Error(`HTTP ${response.statusCode || 'unknown'}`));
        });
        request.once('error', reject);
        request.once('timeout', () => request.destroy(new Error('request timed out')));
      });
      return;
    } catch { await new Promise((resolve) => setTimeout(resolve, 250)); }
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function configureSession(origin) {
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const target = new URL(details.url);
    if (apiSessionToken && target.origin === origin && target.pathname.startsWith('/local-api/v1')) {
      details.requestHeaders['X-Maktab-Local-Token'] = apiSessionToken;
      details.requestHeaders['X-Correlation-ID'] = crypto.randomUUID();
    }
    callback({ requestHeaders: details.requestHeaders });
  });
}

async function runPackagedPdfProbe(win) {
  const configuredPath = process.env.MAKTAB_PACKAGED_SMOKE_PDF_PATH;
  if (!app.isPackaged || !configuredPath) return;
  const outputPath = path.resolve(configuredPath);
  const temporaryRoot = path.resolve(app.getPath('temp'));
  const relativePath = path.relative(temporaryRoot, outputPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Packaged PDF smoke output must be inside the OS temporary directory');
  }
  const pdf = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  fs.writeFileSync(outputPath, pdf, { flag: 'w', mode: 0o600 });
}

function createWindow(rendererUrl) {
  rendererOrigin = new URL(rendererUrl).origin;
  configureSession(rendererOrigin);
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  mainWindow = win;
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  win.on('unresponsive', () => console.error('[electron] Renderer is unresponsive'));
  win.webContents.on('render-process-gone', (_event, details) => console.error('[electron] Renderer exited', details.reason));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedRendererNavigation(targetUrl, rendererOrigin)) event.preventDefault();
  });
  win.webContents.once('did-finish-load', () => {
    void runPackagedPdfProbe(win).catch((error) => console.error('[electron] Packaged PDF smoke probe failed', error));
  });
  void win.loadURL(rendererUrl);
  if (!app.isPackaged && process.env.MAKTAB_OPEN_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });
  return win;
}

function packagedPaths() {
  return {
    server: path.join(app.getAppPath(), 'services', 'local-api', 'dist', 'server.js'),
    web: path.join(app.getAppPath(), 'apps', 'web', 'dist'),
    solver: path.join(process.resourcesPath, 'solver', process.platform === 'win32' ? 'solver.exe' : 'solver'),
  };
}

async function startProductionApi(runtimeInfo) {
  const paths = packagedPaths();
  for (const required of [paths.server, path.join(paths.web, 'index.html'), paths.solver]) {
    if (!fs.existsSync(required)) throw new Error(`Required packaged component is missing: ${required}`);
  }
  await verifyPackagedComponents({ resourcesPath: process.resourcesPath, platform: process.platform });
  apiSessionToken = crypto.randomBytes(32).toString('base64url');
  return new Promise((resolve, reject) => {
    let settled = false;
    let ready = false;
    const finishError = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    const timer = setTimeout(() => finishError(new Error(`Startup timed out during ${startupStage}`)), STARTUP_TIMEOUT_MS);
    const childEnvironment = {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0',
      DATABASE_PATH: path.join(app.getPath('userData'), 'timetable.db'), WEB_DIST_PATH: paths.web,
      SOLVER_PATH: paths.solver, LOCAL_API_SESSION_TOKEN: apiSessionToken,
      MAKTAB_BUILD_ID: runtimeInfo.buildId, MAKTAB_APP_VERSION: runtimeInfo.appVersion,
      ...licenseManager.childEnvironment(),
      MAKTAB_LOG_DIRECTORY: path.join(app.getPath('userData'), 'logs'),
      MAKTAB_RECOVERY_DIRECTORY: path.join(app.getPath('userData'), 'recovery'),
    };
    delete childEnvironment.ELECTRON_RUN_AS_NODE;
    delete childEnvironment.NODE_OPTIONS;
    let child;
    try {
      child = utilityProcess.fork(paths.server, [], {
        env: childEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
        serviceName: 'Maktab Local API',
      });
    } catch (error) {
      finishError(error);
      return;
    }
    apiProcess = child;
    child.stdout?.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
    child.stderr?.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
    child.on('message', async (message) => {
      const parsed = parseApiProcessMessage(message);
      if (!parsed) return;
      if (parsed.type === 'api-startup-progress') startupStage = parsed.stage;
      if (parsed.type === 'api-error') finishError(new Error(parsed.message || 'Local API startup failed'));
      if (parsed.type === 'api-ready') {
        if (parsed.buildId !== runtimeInfo.buildId) return finishError(new Error('Local API compatibility check failed'));
        const baseUrl = `http://127.0.0.1:${parsed.port}`;
        try {
          apiReadiness = await waitForReadiness(`${baseUrl}/local-api/v1/health/ready`, apiSessionToken, runtimeInfo.buildId);
          if (settled) return;
          settled = true; ready = true; clearTimeout(timer); apiBaseUrl = baseUrl; resolve(baseUrl);
        } catch (error) { finishError(error); }
      }
    });
    child.once('exit', () => {
      if (apiProcess === child) apiProcess = null;
      if (intentionalApiStops.delete(child)) return;
      if (!ready) return finishError(new Error(`Local API exited during ${startupStage}`));
      if (!isQuitting && crashRestarts < 1) {
        crashRestarts += 1;
        void recoverAfterApiCrash();
      } else if (!isQuitting) {
        dialog.showErrorBox('Local service stopped', 'The local service stopped repeatedly. Your database was preserved.');
        app.quit();
      }
    });
  });
}

async function stopProductionApi() {
  const child = apiProcess;
  apiProcess = null; apiBaseUrl = null; apiSessionToken = null;
  apiReadiness = null;
  if (!child) return;
  intentionalApiStops.add(child);
  await new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; clearTimeout(timer); resolve(); };
    const timer = setTimeout(() => {
      if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
      else child.kill();
      finish();
    }, SHUTDOWN_TIMEOUT_MS);
    child.once('exit', finish);
    try { child.postMessage({ type: 'api-shutdown' }); } catch { child.kill(); }
  });
}

async function recoverAfterApiCrash() {
  if (mainWindow) mainWindow.hide();
  try {
    const base = await startProductionApi(getRuntimeInfo(app));
    if (mainWindow) { rendererOrigin = new URL(base).origin; await mainWindow.loadURL(base); mainWindow.show(); }
  } catch (error) {
    dialog.showErrorBox('Recovery failed', error.message);
    app.quit();
  }
}

async function startApplication() {
  const runtimeInfo = getRuntimeInfo(app);
  try {
    let rendererUrl;
    if (app.isPackaged) rendererUrl = await startProductionApi(runtimeInfo);
    else {
      await Promise.all([
        waitForReadiness(DEVELOPMENT_API_HEALTH_URL, null, null),
        waitForUrl(DEVELOPMENT_WEB_URL),
      ]);
      rendererUrl = DEVELOPMENT_WEB_URL;
    }
    createWindow(rendererUrl);
  } catch (error) {
    await stopProductionApi();
    const { response } = await dialog.showMessageBox({
      type: 'error', title: 'Application startup failed',
      message: 'Maktab Timetable could not start its local services.', detail: error.message,
      buttons: ['Retry', 'Quit'], defaultId: 0, cancelId: 1, noLink: true,
    });
    if (response === 0) void startApplication(); else app.quit();
  }
}

if (hasInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show(); mainWindow.focus();
  });
  app.whenReady().then(async () => {
    try {
      const runtimeInfo = getRuntimeInfo(app);
      if (app.isPackaged && process.platform === 'win32') securityStatus = verifySafeStorage(safeStorage);
      licenseManager = new LicenseManager(app, runtimeInfo);
      await licenseManager.initialize();
      const backupManager = new BackupManager({
        app, dialog, runtimeInfo,
        getCurrentSchema: () => apiReadiness?.database?.schema || {
          migrationId: 0,
          migrationName: 'unversioned',
          ordinal: apiReadiness?.database?.schemaVersion || 0,
        },
        createRecoveryPoint: async () => {
          if (!apiBaseUrl || !apiSessionToken) throw new Error('Local API is not ready');
          const response = await fetch(`${apiBaseUrl}/local-api/v1/data-safety/recovery-point`, { method: 'POST', headers: { 'X-Maktab-Local-Token': apiSessionToken, 'X-Correlation-ID': crypto.randomUUID() } });
          const payload = await response.json();
          if (!response.ok || !/^[A-Za-z0-9._-]+$/.test(payload.id || '')) throw new Error('Could not create a consistent recovery point');
          return path.join(app.getPath('userData'), 'recovery', payload.id);
        },
        stopApi: stopProductionApi,
        startApi: async () => {
          const base = await startProductionApi(runtimeInfo);
          if (mainWindow) { rendererOrigin = new URL(base).origin; await mainWindow.loadURL(base); mainWindow.show(); }
        },
      });
      await backupManager.reconcileInterruptedRestore();
      const diagnosticsManager = new DiagnosticsManager({ app, dialog, runtimeInfo, getReadiness: () => apiReadiness, getLicenseStatus: () => licenseManager.publicStatus(), getSecurityStatus: () => securityStatus });
      const updateManager = new UpdateManager({ app, runtimeInfo, createPreUpdateBackup: async () => backupManager.createRecoveryPoint() });
      registerIpc({ app, ipcMain, dialog, runtimeInfo, licenseManager, backupManager, diagnosticsManager, updateManager, getMainWindow: () => mainWindow, getRendererOrigin: () => rendererOrigin });
      await startApplication();
    } catch (error) {
      dialog.showErrorBox('Security initialization failed', error.message);
      app.quit();
    }
  });
}

app.on('before-quit', (event) => {
  if (!apiProcess || isQuitting) return;
  event.preventDefault(); isQuitting = true;
  void stopProductionApi().finally(() => app.quit());
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
