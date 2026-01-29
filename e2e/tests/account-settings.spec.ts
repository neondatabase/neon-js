import { test, expect } from '@playwright/test';
import {
  createTestUser,
  registerUser,
  loginUser,
  logoutUser,
  navigateToAccountSettings,
  updateUserName,
  type TestUser,
} from './helpers';

test.describe('Account Settings', () => {
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    // Create and register a new user for each test
    testUser = createTestUser('account-settings');
    await registerUser(page, testUser);
  });

  test('should update user name in account settings', async ({ page }) => {
    // Navigate to account settings
    await navigateToAccountSettings(page);

    // Update user name
    const newName = 'Updated Test User';
    await updateUserName(page, newName);

    // Verify name update in the UI (check in header or dashboard)
    await page.goto('/dashboard');
    await expect(page.getByText(newName).first()).toBeVisible({ timeout: 10_000 });

    // Logout and login again to verify persistence
    await logoutUser(page);
    await loginUser(page, testUser);

    // Verify name persists after re-login
    await page.goto('/dashboard');
    await expect(page.getByText(newName).first()).toBeVisible({ timeout: 10_000 });
  });

  test('should display current user information in settings', async ({ page }) => {
    // Navigate to account settings
    await navigateToAccountSettings(page);

    // Verify that the form is pre-filled with current user data
    const nameInput = page.locator('input[value="Test User"]').first();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue(testUser.name);
  });

  test('should allow navigation to different account sections', async ({ page }) => {
    // Test navigation to profile page
    await page.goto('/account/profile');
    await expect(page).toHaveURL('/account/profile');

    // Test navigation to security page
    await page.goto('/account/security');
    await expect(page).toHaveURL('/account/security');

    // Test navigation back to settings
    await navigateToAccountSettings(page);
  });
});
