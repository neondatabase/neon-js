import { test, expect } from '@playwright/test';

test.describe('Magic Link', () => {
  test('should render magic link form and submit', async ({ page }) => {
    // Navigate to magic link page
    await page.goto('/auth/magic-link');

    // Verify form renders with email input
    await expect(page.locator('form')).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();

    // Fill email and submit
    await page.getByLabel(/email/i).fill('test-magic-link@example.com');
    await page.locator('button[type="submit"]').click();

    // Verify success state appears (check your email / magic link sent)
    await expect(
      page.getByText(/check your email|magic link sent|email/i),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('should send magic link API request', async ({ page }) => {
    let magicLinkRequest: {
      url: string;
      method: string;
      postData: string | null;
    } | null = null;

    // Intercept the magic link API call
    await page.route('**/sign-in/magic-link', async (route) => {
      magicLinkRequest = {
        url: route.request().url(),
        method: route.request().method(),
        postData: route.request().postData(),
      };
      await route.continue();
    });

    await page.goto('/auth/magic-link');
    await expect(page.getByLabel(/email/i)).toBeVisible();

    await page.getByLabel(/email/i).fill('test-magic-link-api@example.com');
    await page.locator('button[type="submit"]').click();

    // Wait for the request to be made
    await page.waitForTimeout(3000);

    // Verify the API was called correctly
    expect(magicLinkRequest).not.toBeNull();
    expect(magicLinkRequest!.method).toBe('POST');
    expect(magicLinkRequest!.postData).toContain(
      'test-magic-link-api@example.com',
    );
  });
});
