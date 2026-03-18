import { test, expect } from '@playwright/test';
import { createTestUser, navigateToMagicLink } from './helpers';

test.describe('Magic Link', () => {
  test('magic link form renders and sends link', async ({ page }) => {
    const testUser = createTestUser('magic');

    await test.step('Navigate to magic link page', async () => {
      await navigateToMagicLink(page);
    });

    await test.step('Verify form elements', async () => {
      await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /send magic link/i })).toBeVisible();
    });

    await test.step('Submit email', async () => {
      await page.getByRole('textbox', { name: /email/i }).fill(testUser.email);
      await page.getByRole('button', { name: /send magic link/i }).click();
    });

    await test.step('Verify magic link was sent', async () => {
      // After backend processes, UI should show confirmation
      await expect(page.getByRole('button', { name: /send magic link/i })).toBeDisabled({ timeout: 10_000 });
    });
  });
});
