import { test, expect } from '@playwright/test';

test('non-admin cannot access admin routes', async ({ page }) => {
  // Unauthenticated access → redirects through [club] layout → login
  await page.goto('/test-club/admin/members');
  await expect(page).toHaveURL(/\/auth\/login/);
});
