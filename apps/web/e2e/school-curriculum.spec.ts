import { expect, test, type APIRequestContext } from '@playwright/test';

async function enableMiddleGrades(request: APIRequestContext) {
  const response = await request.get('/local-api/v1/config/school-config');
  expect(response.ok()).toBeTruthy();
  const config = await response.json();
  const update = await request.patch('/local-api/v1/config/school-config/general', {
    data: {
      schoolId: config.schoolId,
      revision: config.revision,
      schoolName: config.schoolName,
      enablePrimary: true,
      enableMiddle: true,
      enableHigh: false,
      daysOfWeek: config.daysOfWeek,
      schoolStartTime: config.schoolStartTime,
      timezone: config.timezone,
      ramadanModeEnabled: config.ramadanModeEnabled,
      ramadanPeriodDuration: config.ramadanPeriodDuration,
      lowResourceMode: config.lowResourceMode,
    },
  });
  expect(update.ok()).toBeTruthy();
}

test.describe.serial('school curriculum end-to-end', () => {
  test('preserves grade drafts, guards navigation, previews, and applies exact class synchronization', async ({
    page,
    request,
  }) => {
    await enableMiddleGrades(request);
    const classResponse = await request.post('/local-api/v1/classes', {
      data: { name: 'Grade 7 Browser A', displayName: 'صنف ۷ الف', grade: 7 },
    });
    expect(classResponse.status()).toBe(201);
    const classGroup = await classResponse.json();

    await page.goto('/school-curriculum');
    await expect(page.getByRole('heading', { name: /School Curriculum|برنامه درسی مکتب/ })).toBeVisible();
    await expect(page.locator('[dir="rtl"]').first()).toBeVisible();
    await page.getByRole('tab', { name: /Grade 7|صنف 7/ }).click();

    await page.locator('textarea').fill('ترکی\tTurkish\tTR7\t2\tfalse\tnormal');
    await page.getByRole('button', { name: /Add pasted rows|افزودن ردیف‌های چسپانده‌شده/ }).click();
    await expect(page.getByLabel('نام ردیف 1')).toHaveValue('ترکی');

    await page.getByRole('tab', { name: /Grade 8|صنف 8/ }).click();
    await page.getByRole('tab', { name: /Grade 7|صنف 7/ }).click();
    await expect(page.getByLabel('کد ردیف 1')).toHaveValue('TR7');

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.dismiss();
    });
    await page.locator('a[href="/subjects"]').first().click();
    await expect(page).toHaveURL(/\/school-curriculum$/);

    await page.getByText('صنف ۷ الف').click();
    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/local-api/v1/curriculum/plan/preview') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Review and apply|مرور و اعمال/ }).click();
    expect((await previewResponse).status()).toBe(200);
    await expect(page.getByRole('dialog').getByText('ترکی')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Grade 7 Browser A')).toBeVisible();

    const applyResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/local-api/v1/curriculum/plan/apply') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Apply reviewed changes|اعمال تأییدشده/ }).click();
    expect((await applyResponse).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const plan = await (await request.get('/local-api/v1/curriculum/plan')).json();
    expect(plan.grades.find((entry: { grade: number }) => entry.grade === 7).items).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'ترکی', code: 'TR7', weeklyPeriods: 2 })])
    );
    const persistedClass = await (await request.get(`/local-api/v1/classes/${classGroup.id}`)).json();
    expect(persistedClass.subjectRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ periodsPerWeek: 2 })])
    );
  });

  test('keeps template changes draft-only until Apply and recovers from a changed preview', async ({
    page,
    request,
  }) => {
    await page.goto('/school-curriculum');
    await page.getByRole('tab', { name: /Grade 8|صنف 8/ }).click();
    page.once('dialog', async (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Use Afghanistan template|استفاده از قالب افغانستان/ }).click();
    await expect(page.getByLabel('نام ردیف 1', { exact: true })).not.toHaveValue('');

    const beforePreview = await (await request.get('/local-api/v1/curriculum/plan')).json();
    expect(beforePreview.grades.find((entry: { grade: number }) => entry.grade === 8).items).toEqual([]);

    await page.getByRole('button', { name: /Review and apply|مرور و اعمال/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const externalClass = await request.post('/local-api/v1/classes', {
      data: { name: 'Grade 8 Concurrent', grade: 8 },
    });
    expect(externalClass.status()).toBe(201);

    const changedApply = page.waitForResponse(
      (response) =>
        response.url().includes('/local-api/v1/curriculum/plan/apply') &&
        response.request().method() === 'POST'
    );
    await page.getByRole('button', { name: /Apply reviewed changes|اعمال تأییدشده/ }).click();
    expect((await changedApply).status()).toBe(409);
    await expect(page.getByText(/Preview is stale|پیش‌نمایش کهنه شد/)).toBeVisible();
  });
});
