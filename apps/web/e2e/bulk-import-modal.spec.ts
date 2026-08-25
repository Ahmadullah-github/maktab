import { expect, test } from '@playwright/test';

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
      response.url().includes('/local-api/v1/teachers/bulk') && response.request().method() === 'POST'
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
