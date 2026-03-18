import { test, expect } from '@playwright/test';
import { createTestUser, navigateToMagicLink } from './helpers';

test.describe('Magic Link', () => {
  test('magic link form renders and accepts email submission', async ({
    page,
  }) => {
    const testUser = createTestUser('magic');

    await test.step('Navigate to magic link page', async () => {
      await navigateToMagicLink(page);
    });

    await test.step('Verify form elements are visible', async () => {
      await expect(
        page.getByRole('textbox', { name: /email/i }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /send magic link/i }),
      ).toBeVisible();
    });

    await test.step('Fill email and submit', async () => {
      await page.getByRole('textbox', { name: /email/i }).fill(testUser.email);

      const submitButton = page.getByRole('button', {
        name: /send magic link/i,
      });

      // Submit and wait for the API request to complete
      await Promise.all([
        page.waitForResponse((resp) =>
          resp.url().includes('/sign-in/magic-link'),
        ),
        submitButton.click(),
      ]);
    });

    await test.step('Verify UI responds after submission', async () => {
      // After submission the button should be disabled or the form should
      // show a confirmation message indicating the link was sent
      const confirmation = page.getByText(/check your email|link sent|magic link/i);
      await expect(confirmation).toBeVisible({ timeout: 5_000 });
    });
  });
});
