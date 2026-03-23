import { test, expect } from '@playwright/test';

test('create club page redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/clubs/new');
  await expect(page).toHaveURL(/\/auth\/login/);
});
