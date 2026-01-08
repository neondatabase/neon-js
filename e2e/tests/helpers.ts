import { expect, type Page } from '@playwright/test';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

/**
 * Generate unique test user credentials
 */
export function createTestUser(prefix = 'test'): TestUser {
  return {
    name: 'Test User',
    email: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(7)}@example.com`,
    password: 'TestPassword123!',
  };
}

/**
 * Register a new user and wait for redirect to dashboard
 */
export async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/sign-up');
  await expect(page.locator('form')).toBeVisible();

  await page.getByLabel(/name/i).fill(user.name);
  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
}

/**
 * Login with existing user credentials
 */
export async function loginUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/auth/sign-in');
  await expect(page.locator('form')).toBeVisible();

  await page.getByLabel(/email/i).fill(user.email);
  await page.getByLabel(/password/i).fill(user.password);
  await page.locator('button[type="submit"]').click();

  await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
}

/**
 * Logout the current user via the avatar dropdown
 */
export async function logoutUser(page: Page): Promise<void> {
  await page.locator('[data-slot="avatar"]').first().click();
  await page.getByRole('menuitem', { name: 'Sign Out' }).click();

  await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Verify user is logged in (avatar visible)
 */
export async function expectLoggedIn(page: Page): Promise<void> {
  await expect(page.locator('[data-slot="avatar"]').first()).toBeVisible({
    timeout: 10_000,
  });
}
