const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Installed update E2E is restricted to disposable GitHub Windows runners');
}
const root = path.resolve(__dirname, '..', '..');
const baseDirectory = path.join(root, 'release-pair', 'v1.0.0');
const targetDirectory = path.join(root, 'release-pair', 'v1.0.1');
const baseDescriptor = JSON.parse(fs.readFileSync(path.join(baseDirectory, 'release-descriptor.json')));
const targetDescriptor = JSON.parse(fs.readFileSync(path.join(targetDirectory, 'release-descriptor.json')));
const scenarioPath = path.join(targetDirectory, 'acceptance-scenario.txt');

function setScenario(name) {
  fs.writeFileSync(scenarioPath, `${name}\n`);
}

function findInstalledExecutable() {
  const programs = path.join(process.env.LOCALAPPDATA, 'Programs');
  const pending = [programs];
  while (pending.length) {
    const directory = pending.pop();
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.name === 'Maktab Timetable.exe') return entryPath;
    }
  }
  throw new Error('Installed Maktab executable was not found');
}

async function launch(executable) {
  const child = spawn(executable, ['--remote-debugging-port=0'], {
    env: { ...process.env, LOG_LEVEL: 'error' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`DevTools startup timed out\n${output}`)), 90_000);
    const consume = (chunk) => {
      output = `${output}${chunk}`.slice(-16_384);
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    };
    child.stdout.on('data', consume); child.stderr.on('data', consume);
    child.once('error', reject); child.once('exit', (code) => reject(new Error(`Application exited early (${code})\n${output}`)));
  });
  const browser = await chromium.connectOverCDP(endpoint, { timeout: 90_000 });
  const context = browser.contexts()[0]; const page = context.pages()[0] || await context.waitForEvent('page');
  await page.waitForLoadState('domcontentloaded');
  return { child, browser, page };
}

async function stop(instance) {
  await instance.browser.close().catch(() => {});
  if (instance.child.exitCode === null) {
    await Promise.race([
      new Promise((resolve) => instance.child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 10_000)),
    ]);
  }
  if (instance.child.exitCode === null) {
    spawnSync('taskkill', ['/pid', String(instance.child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  }
}

async function seedMarker(page) {
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/school-curriculum`);
  await page.getByRole('heading', { name: /School Curriculum|برنامه درسی مکتب/ }).waitFor();
  await page.locator('textarea').fill('آزمایش بروزرسانی\tUpdate Evidence\tUPD1\t2\tfalse\tnormal');
  await page.getByRole('button', { name: /Add pasted rows|افزودن ردیف‌های چسپانده‌شده/ }).click();
  await page.getByRole('button', { name: /Review and apply|مرور و اعمال/ }).click();
  await page.getByRole('button', { name: /Apply reviewed changes|اعمال تأییدشده/ }).click();
  await assertMarker(page);
}

async function assertMarker(page) {
  const plan = await page.evaluate(async () => (await fetch('/local-api/v1/curriculum/plan')).json());
  assert.ok(plan.grades.some((grade) => grade.items.some((item) => item.code === 'UPD1')));
}

async function main() {
  const server = spawn(process.execPath, ['scripts/packaging/internal-update-server.js', targetDirectory], {
    cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'inherit'], windowsHide: true,
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Internal update server did not start')), 20_000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('INTERNAL_UPDATE_SERVER_READY')) { clearTimeout(timer); resolve(); }
    });
    server.once('exit', (code) => reject(new Error(`Internal update server exited (${code})`)));
  });
  let instance;
  try {
    setScenario('normal');
    const install = spawnSync(path.join(baseDirectory, baseDescriptor.artifact.filename), ['/S'], {
      windowsHide: true, stdio: 'inherit', timeout: 120_000,
    });
    assert.equal(install.status, 0, 'Base installer failed');
    const executable = findInstalledExecutable();
    instance = await launch(executable);
    const baseRuntime = await instance.page.evaluate(() => window.maktab.runtime.get());
    assert.equal(baseRuntime.ok, true); assert.equal(baseRuntime.value.buildId, baseDescriptor.build_id);
    const qaLicense = fs.readFileSync(
      path.join(root, 'release-pair', 'acceptance-server', 'internal-qa-license.txt'), 'utf8'
    ).trim();
    const activated = await instance.page.evaluate((key) => window.maktab.license.activate(key), qaLicense);
    assert.equal(activated.ok, true); assert.equal(activated.value.state, 'active');
    const activationId = activated.value.activationId;
    await seedMarker(instance.page);
    await stop(instance); instance = await launch(executable);
    const restartedLicense = await instance.page.evaluate(() => window.maktab.license.getStatus());
    assert.equal(restartedLicense.ok, true); assert.equal(restartedLicense.value.state, 'active');
    assert.equal(restartedLicense.value.activationId, activationId);
    await assertMarker(instance.page);
    setScenario('wrong-publisher');
    const wrongPublisher = await instance.page.evaluate(() => window.maktab.updates.check());
    assert.equal(wrongPublisher.ok, false); assert.equal(wrongPublisher.error.code, 'UPDATE_CHECK_FAILED');
    setScenario('tampered-manifest');
    const tamperedManifest = await instance.page.evaluate(() => window.maktab.updates.check());
    assert.equal(tamperedManifest.ok, false); assert.equal(tamperedManifest.error.code, 'UPDATE_CHECK_FAILED');
    setScenario('normal');
    const checked = await instance.page.evaluate(() => window.maktab.updates.check());
    assert.equal(checked.ok, true); assert.equal(checked.value.available.buildId, targetDescriptor.build_id);
    setScenario('corrupt-artifact');
    const corruptDownload = await instance.page.evaluate(() => window.maktab.updates.download());
    assert.equal(corruptDownload.ok, false); assert.equal(corruptDownload.error.code, 'UPDATE_DOWNLOAD_FAILED');
    setScenario('normal');
    const retryCheck = await instance.page.evaluate(() => window.maktab.updates.check());
    assert.equal(retryCheck.ok, true); assert.equal(retryCheck.value.available.buildId, targetDescriptor.build_id);
    const downloaded = await instance.page.evaluate(() => window.maktab.updates.download());
    assert.equal(downloaded.ok, true); assert.equal(downloaded.value.state, 'downloaded');
    const installing = await instance.page.evaluate(() => window.maktab.updates.install());
    assert.deepEqual(installing, { ok: true, value: { installing: true } });
    await new Promise((resolve) => setTimeout(resolve, 45_000));
    await stop(instance); instance = null;
    const target = await launch(executable);
    instance = target;
    const targetRuntime = await target.page.evaluate(() => window.maktab.runtime.get());
    assert.equal(targetRuntime.ok, true); assert.equal(targetRuntime.value.buildId, targetDescriptor.build_id);
    const targetLicense = await target.page.evaluate(() => window.maktab.license.getStatus());
    assert.equal(targetLicense.ok, true); assert.equal(targetLicense.value.state, 'active');
    assert.equal(targetLicense.value.activationId, activationId);
    await assertMarker(target.page);
    console.log(`Installed update verified: ${baseDescriptor.build_id} -> ${targetDescriptor.build_id}`);
  } finally {
    setScenario('normal');
    if (instance) await stop(instance);
    if (server.exitCode === null) server.kill();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
