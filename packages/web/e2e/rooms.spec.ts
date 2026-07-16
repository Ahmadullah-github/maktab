import { expect, test } from '@playwright/test';

const selectAllName = /common\.selectAll|Select all|انتخاب همه/i;
const searchPlaceholder = /Search room name|جستجو در نام اتاق/i;

test('renders custom room types and scopes select-all to filtered rows', async ({
  page,
  request,
}) => {
  const marker = 'Robotics E2E';
  const typeResponse = await request.post('/api/room-types', {
    data: {
      value: 'robotics_e2e',
      labelFa: marker,
      labelEn: marker,
      icon: 'Beaker',
    },
  });
  expect(typeResponse.status()).toBe(201);

  for (const name of ['E2E Alpha Room', 'E2E Beta Room']) {
    const roomResponse = await request.post('/api/rooms', {
      data: {
        name,
        capacity: 24,
        type: 'robotics_e2e',
        features: [],
        unavailable: [],
      },
    });
    expect(roomResponse.status()).toBe(201);
  }

  await page.goto('/rooms');
  await expect(page.getByText('E2E Alpha Room')).toBeVisible();
  await expect(page.getByText('E2E Beta Room')).toBeVisible();
  await expect(page.getByText(marker).first()).toBeVisible();

  const search = page.getByPlaceholder(searchPlaceholder);
  const selectAll = page.getByRole('checkbox', { name: selectAllName });

  await search.fill('Alpha');
  await expect(page.getByText('E2E Beta Room')).toHaveCount(0);
  await selectAll.click();
  await expect(selectAll).toBeChecked();

  await search.fill('Beta');
  await expect(page.getByText('E2E Alpha Room')).toHaveCount(0);
  await expect(page.getByText('E2E Beta Room')).toBeVisible();
  await expect(selectAll).not.toBeChecked();
  await selectAll.click();
  await expect(selectAll).toBeChecked();

  await search.fill('');
  await expect(page.getByText('E2E Alpha Room')).toBeVisible();
  await expect(page.getByText('E2E Beta Room')).toBeVisible();
  await expect(selectAll).toBeChecked();
});
