import { expect, test, type APIRequestContext } from '@playwright/test';

const categorySwitchName = /Enable Category-Based Periods|فعال‌سازی ساعات بر اساس دسته‌بندی/;
const prayerSwitchName = /Enable Prayer Breaks|فعال‌سازی تفریح نماز/;
const saveName = /Save Changes|ذخیره تغییرات/;

async function useOnlyHighSchool(request: APIRequestContext) {
  const response = await request.get('/api/config/school-config');
  expect(response.ok()).toBeTruthy();
  const config = await response.json();
  const update = await request.patch('/api/config/school-config/general', {
    data: {
      schoolId: config.schoolId,
      revision: config.revision,
      schoolName: config.schoolName,
      enablePrimary: false,
      enableMiddle: false,
      enableHigh: true,
      daysOfWeek: config.daysOfWeek,
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,
      ramadanModeEnabled: config.ramadanModeEnabled,
      ramadanPeriodDuration: config.ramadanPeriodDuration,
      enableMinistryValidation: config.enableMinistryValidation,
      ministryValidationMode: config.ministryValidationMode,
      customCurriculumMode: config.customCurriculumMode,
      lowResourceMode: config.lowResourceMode,
    },
  });
  expect(update.ok()).toBeTruthy();
}

test.describe.serial('period structure end-to-end', () => {
  test('supports and persists category mode with one enabled category', async ({
    page,
    request,
  }) => {
    await useOnlyHighSchool(request);
    await page.goto('/periods');

    const categorySwitch = page.getByRole('switch', { name: categorySwitchName });
    await expect(categorySwitch).toBeVisible();
    await categorySwitch.click();
    await expect(categorySwitch).toBeChecked();
    await expect(page.locator('table input[type="number"]')).toHaveCount(6);

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes('/api/config/school-config/periods') &&
        response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: saveName }).click();
    expect((await saved).status()).toBe(200);

    await page.reload();
    await expect(page.getByRole('switch', { name: categorySwitchName })).toBeChecked();
  });

  test('disabled invalid prayer fields cannot block saving or leak stale data', async ({
    page,
    request,
  }) => {
    await page.goto('/periods');
    const prayerSwitch = page.getByRole('switch', { name: prayerSwitchName });
    await prayerSwitch.click();
    await page.getByRole('button', { name: /Add Prayer Break|افزودن تفریح نماز/ }).click();
    await page.locator('input[id^="prayer-"][id$="-duration"]').first().fill('1');
    await prayerSwitch.click();
    await expect(page.locator('input[id^="prayer-"]')).toHaveCount(0);
    await page.getByRole('button', { name: /Increase periods|افزایش تعداد ساعات/ }).click();

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes('/api/config/school-config/periods') &&
        response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: saveName }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByText('undefined')).toHaveCount(0);

    const persisted = await (await request.get('/api/config/school-config')).json();
    expect(persisted.prayerBreaksEnabled).toBe(false);
    expect(persisted.prayerBreaks).toEqual([]);
  });

  test('dirty navigation is confirmed and Enter submits the form', async ({ page }) => {
    await page.goto('/periods');
    const categoryInput = page.locator('table input[type="number"]').first();
    await categoryInput.fill('5');

    await page.locator('a[href="/rooms"]').first().click();
    await expect(
      page
        .getByRole('alertdialog')
        .getByRole('heading', { name: /Unsaved Changes|تغییرات ذخیره نشده/ })
    ).toBeVisible();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /Stay on page|ماندن در صفحه/ })
      .click();
    await expect(page).toHaveURL(/\/periods$/);

    const saved = page.waitForResponse(
      (response) =>
        response.url().includes('/api/config/school-config/periods') &&
        response.request().method() === 'PATCH'
    );
    await categoryInput.press('Enter');
    expect((await saved).status()).toBe(200);

    await categoryInput.fill('6');
    await page.locator('a[href="/rooms"]').first().click();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: /Leave without saving|خروج بدون ذخیره/ })
      .click();
    await expect(page).toHaveURL(/\/rooms$/);
  });

  test('a revision conflict preserves local edits until the user loads the latest data', async ({
    page,
    request,
  }) => {
    await page.goto('/periods');
    const categoryInput = page.locator('table input[type="number"]').first();
    await categoryInput.fill('4');

    const config = await (await request.get('/api/config/school-config')).json();
    const persistedCategoryValue = config.categoryPeriodsMap.High.Saturday;
    const externalUpdate = await request.patch('/api/config/school-config/periods', {
      data: {
        schoolId: config.schoolId,
        revision: config.revision,
        defaultPeriodsPerDay: config.defaultPeriodsPerDay,
        periodDuration: config.periodDuration === 45 ? 50 : 45,
        dynamicPeriodsEnabled: config.dynamicPeriodsEnabled,
        periodsPerDayMap: config.periodsPerDayMap,
        categoryPeriodsEnabled: config.categoryPeriodsEnabled,
        categoryPeriodsMap: config.categoryPeriodsMap,
        breakPeriods: config.breakPeriods,
        breakPeriodsByDay: config.breakPeriodsByDay,
        prayerBreaksEnabled: config.prayerBreaksEnabled,
        prayerBreaks: config.prayerBreaks,
      },
    });
    expect(externalUpdate.status()).toBe(200);

    const conflict = page.waitForResponse(
      (response) =>
        response.url().includes('/api/config/school-config/periods') &&
        response.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: saveName }).click();
    expect((await conflict).status()).toBe(409);

    await expect(
      page.getByText(/Newer settings are available|تنظیمات جدیدتری موجود است/)
    ).toBeVisible();
    await expect(categoryInput).toHaveValue('4');
    await page.getByRole('button', { name: /Load latest settings|بارگذاری آخرین تنظیمات/ }).click();
    await expect(categoryInput).toHaveValue(String(persistedCategoryValue));
  });
});
