import { expect, test } from '@playwright/test';

test('curriculum sync releases the dropdown and dialog pointer lock', async ({ page }) => {
  await page.goto('/subjects');

  await page.getByRole('button', { name: /Curriculum|نصاب تعلیمی/i }).click();
  await page.getByText(/Insert Curriculum|درج نصاب تعلیمی/i, { exact: true }).click();
  await page.getByRole('button', { name: /Grade 7|صنف 7/i }).click();

  const syncResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/subjects/curriculum/sync') &&
      response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Insert Subjects|درج مضامین/i }).click();

  expect((await syncResponse).status()).toBe(200);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).pointerEvents))
    .toBe('auto');
  await expect(page.getByRole('button', { name: /Add New Subject|افزودن مضمون جدید/i })).toBeEnabled();
});

test('teacher bulk import closes its sheet and leaves the page interactive', async ({ page }) => {
  await page.goto('/teachers');

  await page.getByRole('button', { name: /Bulk import|وارد کردن گروهی/i }).click();
  await page.getByRole('button', { name: /Copy and paste|کپی و پیست/i }).click();
  await page
    .locator('textarea')
    .fill(['Freeze Verify Alpha', 'Freeze Verify Beta', 'Freeze Verify Gamma'].join('\n'));
  await page.getByRole('button', { name: /Preview|پیش‌نمایش/i }).click();

  const importResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/teachers/bulk') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Import|وارد کردن/i }).last().click();

  expect((await importResponse).status()).toBe(201);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).pointerEvents))
    .toBe('auto');
  await expect(page.getByText('Freeze Verify Alpha')).toBeVisible();
  await expect(page.getByRole('button', { name: /New Teacher|استاد جدید/i })).toBeEnabled();
});
