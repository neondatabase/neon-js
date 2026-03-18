import { test, expect } from '@playwright/test';

test.describe('Magic Link', () => {
  test('should render magic link form', async ({ page }) => {
    await page.goto('/auth/magic-link');

    // Verify the form renders with expected elements
    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /send magic link/i }),
    ).toBeVisible();
    await expect(page.getByText(/magic link/i)).toBeVisible();
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
    await expect(
      page.getByRole('textbox', { name: /email/i }),
    ).toBeVisible();

    await page
      .getByRole('textbox', { name: /email/i })
      .fill('test-magic-link-api@example.com');
    await page.getByRole('button', { name: /send magic link/i }).click();

    // Wait for the request to be made
    await page.waitForTimeout(3000);

    // Verify the API request was attempted (regardless of backend response)
    expect(magicLinkRequest).not.toBeNull();
    expect(magicLinkRequest!.method).toBe('POST');
    expect(magicLinkRequest!.postData).toContain(
      'test-magic-link-api@example.com',
    );
  });
});
