const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require('playwright');

const workspaceRoot = path.resolve(__dirname, '../../..');

function packageDirectory() {
  if (process.platform === 'win32') return path.join(workspaceRoot, 'dist-electron', 'win-unpacked');
  if (process.platform === 'darwin') return path.join(workspaceRoot, 'dist-electron', 'mac', 'Maktab Timetable.app');
  return path.join(workspaceRoot, 'dist-electron', 'linux-unpacked');
}

function executablePath() {
  const directory = packageDirectory();
  if (process.platform === 'darwin') return path.join(directory, 'Contents', 'MacOS', 'Maktab Timetable');
  const entry = fs.readdirSync(directory, { withFileTypes: true })
    .filter((candidate) => {
      if (!candidate.isFile()) return false;
      if (process.platform === 'win32') return candidate.name.endsWith('.exe') && !/^unins/i.test(candidate.name);
      return Boolean(fs.statSync(path.join(directory, candidate.name)).mode & 0o111);
    })
    .sort((left, right) => (
      fs.statSync(path.join(directory, right.name)).size
      - fs.statSync(path.join(directory, left.name)).size
    ))[0];
  assert.ok(entry, `Packaged Electron executable not found in ${directory}`);
  return path.join(directory, entry.name);
}

function launchEnvironment(profileDirectory) {
  const environment = {
    ...process.env,
    MAKTAB_PLATFORM_API_URL: 'https://platform.invalid/api/v1',
    MAKTAB_PACKAGED_SMOKE_PDF_PATH: path.join(profileDirectory, 'packaged-smoke.pdf'),
    LOG_LEVEL: 'error',
  };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  if (process.platform === 'win32') {
    environment.APPDATA = profileDirectory;
    environment.LOCALAPPDATA = profileDirectory;
  } else {
    environment.XDG_CONFIG_HOME = profileDirectory;
  }
  return environment;
}

async function waitForPdf(profileDirectory) {
  const pdfPath = path.join(profileDirectory, 'packaged-smoke.pdf');
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const size = fs.statSync(pdfPath).size;
      if (size > 1_000) return size;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Packaged Electron did not produce the PDF smoke artifact');
}

async function launch(profileDirectory) {
  const child = spawn(
    executablePath(),
    ['--remote-debugging-port=0', ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
    {
      env: launchEnvironment(profileDirectory),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );
  let output = '';
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for DevTools endpoint.\n${output}`)), 90_000);
    const readOutput = (chunk) => {
      output = `${output}${chunk}`.slice(-16_384);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve(match[1]);
    };
    child.stdout.on('data', readOutput);
    child.stderr.on('data', readOutput);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Packaged Electron exited before DevTools was ready (${code}).\n${output}`));
    });
  });
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 90_000 });
  const context = browser.contexts()[0];
  assert.ok(context, 'Packaged Electron did not expose a browser context');
  const page = context.pages()[0] || await context.waitForEvent('page', { timeout: 90_000 });
  return {
    browser,
    child,
    context,
    page,
    async close() {
      await page.close({ runBeforeUnload: true }).catch(() => {});
      await browser.close().catch(() => {});
      if (child.exitCode !== null) return;
      const exited = await Promise.race([
        new Promise((resolve) => child.once('exit', () => resolve(true))),
        new Promise((resolve) => setTimeout(() => resolve(false), 10_000)),
      ]);
      if (!exited) child.kill();
    },
  };
}

async function assertPersistedPlan(page) {
  const plan = await page.evaluate(async () => {
    const response = await fetch('/local-api/v1/curriculum/plan');
    if (!response.ok) throw new Error(`Plan request failed (${response.status})`);
    return response.json();
  });
  assert.ok(plan.grades.some((grade) => grade.items.some((item) => item.code === 'ELEC1' && item.weeklyPeriods === 2)));
}

async function main() {
  const profileDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'maktab-electron-curriculum-'));
  let electronApp;
  try {
    electronApp = await launch(profileDirectory);
    const page = electronApp.page;
    await page.waitForLoadState('domcontentloaded');
    assert.equal(await page.evaluate(() => typeof window.maktab?.runtime?.get === 'function'), true);

    const diagnostics = await page.evaluate(() => window.maktab.diagnostics.getStatus());
    assert.equal(diagnostics.ok, true);
    assert.equal(diagnostics.value.components.database.status, 'ok');
    assert.equal(diagnostics.value.components.solver.status, 'ok');
    assert.match(diagnostics.value.components.solver.sha256, /^[a-f0-9]{64}$/);
    assert.equal(diagnostics.value.security.safeStorage, process.platform === 'win32' ? 'ok' : 'not-applicable');

    const policyViolations = [];
    page.on('console', (message) => {
      if (/content security policy/i.test(message.text())) {
        policyViolations.push({ text: message.text(), location: message.location() });
      }
    });
    const responsePromise = page.waitForResponse((response) => response.request().isNavigationRequest() && response.url() === page.url());
    await page.reload({ waitUntil: 'domcontentloaded' });
    const documentResponse = await responsePromise;
    const csp = documentResponse.headers()['content-security-policy'];
    assert.match(csp, /script-src 'self'/);
    assert.doesNotMatch(csp, /script-src[^;]*unsafe-inline/);
    assert.deepEqual(
      policyViolations,
      [],
      `Inline style elements: ${JSON.stringify(await page.locator('style').allTextContents())}`
    );

    assert.equal(electronApp.context.pages().length, 1);
    await page.evaluate(() => window.open('https://example.com', '_blank'));
    await page.waitForTimeout(250);
    assert.equal(electronApp.context.pages().length, 1);

    const origin = new URL(page.url()).origin;
    await page.goto(`${origin}/school-curriculum`);
    await page.getByRole('heading', { name: /School Curriculum|برنامه درسی مکتب/ }).waitFor();
    await page.locator('textarea').fill('مضمون الکترون\tElectron Subject\tELEC1\t2\tfalse\tnormal');
    await page.getByRole('button', { name: /Add pasted rows|افزودن ردیف‌های چسپانده‌شده/ }).click();
    const previewResponse = page.waitForResponse((response) => response.url().includes('/local-api/v1/curriculum/plan/preview'));
    await page.getByRole('button', { name: /Review and apply|مرور و اعمال/ }).click();
    assert.equal((await previewResponse).status(), 200);
    const applyResponse = page.waitForResponse((response) => response.url().includes('/local-api/v1/curriculum/plan/apply'));
    await page.getByRole('button', { name: /Apply reviewed changes|اعمال تأییدشده/ }).click();
    assert.equal((await applyResponse).status(), 200);
    await assertPersistedPlan(page);

    const pdfBytes = await waitForPdf(profileDirectory);
    assert.ok(pdfBytes > 1_000, 'Packaged Chromium did not render a usable PDF');
    assert.deepEqual(policyViolations, [], 'Renderer produced a CSP violation during the packaged workflow');

    await electronApp.close(); electronApp = null;
    electronApp = await launch(profileDirectory);
    const restartedPage = electronApp.page;
    await restartedPage.waitForLoadState('domcontentloaded');
    await assertPersistedPlan(restartedPage);
  } finally {
    if (electronApp) await electronApp.close();
    fs.rmSync(profileDirectory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
