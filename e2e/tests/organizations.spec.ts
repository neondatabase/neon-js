import { test, expect } from '@playwright/test';
import {
  createTestUser,
  registerUser,
  navigateToOrganizationSettings,
  type TestUser,
} from './helpers';

test.describe('Organizations', () => {
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    // Create and register a new user for each test
    testUser = createTestUser('org');
    await registerUser(page, testUser);
  });

  test('should navigate to organization settings page', async ({ page }) => {
    // Navigate to organization settings
    await navigateToOrganizationSettings(page);

    // Verify we're on the organization settings page
    await expect(page).toHaveURL('/organization/settings');

    // Verify organization-related content is visible
    await expect(page.getByText(/organization/i).first()).toBeVisible();
  });

  test('should navigate to organization members page', async ({ page }) => {
    // Navigate to organization members page
    await page.goto('/organization/members');
    await expect(page).toHaveURL('/organization/members');

    // Verify members page content is visible
    await expect(page.getByText(/member/i).first()).toBeVisible();
  });

  test('should navigate between organization pages', async ({ page }) => {
    // Navigate to organization settings
    await page.goto('/organization/settings');
    await expect(page).toHaveURL('/organization/settings');

    // Navigate to members page
    await page.goto('/organization/members');
    await expect(page).toHaveURL('/organization/members');

    // Navigate to teams page
    await page.goto('/organization/teams');
    await expect(page).toHaveURL('/organization/teams');

    // Navigate to API keys page
    await page.goto('/organization/api-keys');
    await expect(page).toHaveURL('/organization/api-keys');
  });
});
