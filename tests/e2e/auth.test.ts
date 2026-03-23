import { test, expect } from '@playwright/test';

test('login page shows email form', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await expect(page.getByLabel(/email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
});

test('submitting login shows confirmation message', async ({ page }) => {
  await page.goto('/auth/login');
  await page.getByLabel(/email/i).fill('test@example.com');
  await page.getByRole('button', { name: /send magic link/i }).click();
  await expect(page.getByText(/check your email/i)).toBeVisible();
});
