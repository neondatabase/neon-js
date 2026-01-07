import { test, expect } from '@playwright/test';

test('example app loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/neon-js/i);
});
