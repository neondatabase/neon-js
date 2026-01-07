import { test, expect } from '@playwright/test';

/**
 * Auth Flow E2E Tests
 *
 * Tests the complete authentication flow:
 * 1. Register a new user
 * 2. Login with that user
 * 3. Logout
 */

// Generate unique test user credentials for each test run
const testUser = {
  name: 'Test User',
  email: `test-${Date.now()}-${Math.random().toString(36).slice(7)}@example.com`,
  password: 'TestPassword123!',
};

test.describe('Auth Flow', () => {
  test('complete registration, login, and logout flow', async ({ page }) => {
    // ============================================
    // STEP 1: Register a new user
    // ============================================
    await test.step('Register new user', async () => {
      // Navigate to sign-up page
      await page.goto('/auth/sign-up');

      // Wait for the form to load
      await expect(page.locator('form')).toBeVisible();

      // Fill in the registration form
      // The form fields are: name, email, password (based on providers.tsx config)
      await page.getByLabel(/name/i).fill(testUser.name);
      await page.getByLabel(/email/i).fill(testUser.email);
      await page.getByLabel(/password/i).fill(testUser.password);

      // Submit the form - use type="submit" for consistency
      await page.locator('button[type="submit"]').click();

      // Wait for redirect to dashboard (configured in providers.tsx redirectTo)
      await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
    });

    // ============================================
    // STEP 2: Verify logged in state
    // ============================================
    await test.step('Verify logged in after registration', async () => {
      // The UserButton should be visible in the header when logged in
      await expect(page.locator('[data-slot="avatar"]').first()).toBeVisible({
        timeout: 10_000,
      });
    });

    // ============================================
    // STEP 3: Logout
    // ============================================
    await test.step('Logout', async () => {
      // Click on the user button to open dropdown
      await page.locator('[data-slot="avatar"]').first().click();

      // Wait for dropdown to appear and click sign out
      await page.getByRole('menuitem', { name: 'Sign Out' }).click();

      // Wait for sign-out to complete - should see Sign In link
      await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible({
        timeout: 10_000,
      });
    });

    // ============================================
    // STEP 4: Login with the same user
    // ============================================
    await test.step('Login with registered user', async () => {
      // Navigate to sign-in page
      await page.goto('/auth/sign-in');

      // Wait for the form to load
      await expect(page.locator('form')).toBeVisible();

      // Fill in the login form
      await page.getByLabel(/email/i).fill(testUser.email);
      await page.getByLabel(/password/i).fill(testUser.password);

      // Submit the form - use type="submit" to be specific (avoid social login buttons)
      await page.locator('button[type="submit"]').click();

      // Wait for redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
    });

    // ============================================
    // STEP 5: Verify logged in state after login
    // ============================================
    await test.step('Verify logged in after login', async () => {
      // The UserButton should be visible again
      await expect(page.locator('[data-slot="avatar"]').first()).toBeVisible({
        timeout: 10_000,
      });
    });

    // ============================================
    // STEP 6: Final logout
    // ============================================
    await test.step('Final logout', async () => {
      // Click on the user button to open dropdown
      await page.locator('[data-slot="avatar"]').first().click();

      // Wait for dropdown and click sign out
      await page.getByRole('menuitem', { name: 'Sign Out' }).click();

      // Verify logged out - should see Sign In link
      await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
