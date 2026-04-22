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

/**
 * Navigate to account settings page
 */
export async function navigateToAccountSettings(page: Page): Promise<void> {
  await page.goto('/account/settings');
  await expect(page).toHaveURL('/account/settings');
}

/**
 * Update user name in account settings
 */
export async function updateUserName(page: Page, newName: string): Promise<void> {
  // Better Auth UI uses heading "Name" followed by input with specific placeholder text
  // The input field already contains "Test User" - select all and replace
  const nameInput = page.locator('input[value="Test User"]').first();

  // Triple-click to select all text, then type to replace
  await nameInput.click({ clickCount: 3 });
  await nameInput.fill(newName);

  // Click the Save button for the Name section
  await page.getByRole('button', { name: /save/i }).first().click();

  // Wait for success indication
  await page.waitForTimeout(1000);
}

/**
 * Navigate to organization settings page
 */
export async function navigateToOrganizationSettings(page: Page): Promise<void> {
  await page.goto('/organization/settings');
  await expect(page).toHaveURL('/organization/settings');
}

/**
 * Create a new note
 */
export async function createNote(page: Page, noteTitle: string): Promise<void> {
  await page.getByPlaceholder(/add a quick note/i).fill(noteTitle);

  // Click the add button (Plus icon)
  await page.locator('button[type="submit"]').click();

  // Wait for note to be added
  await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5_000 });
}

/**
 * Delete a note by title
 */
export async function deleteNote(page: Page, noteTitle: string): Promise<void> {
  // Find the note item and hover to show delete button
  const noteItem = page.locator('.group.flex').filter({ hasText: noteTitle });
  await noteItem.hover();

  // Click the delete button (Trash icon)
  await noteItem.getByRole('button').last().click();

  // Wait for note to be removed
  await expect(noteItem).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Verify note exists in the list
 */
export async function expectNoteExists(page: Page, noteTitle: string): Promise<void> {
  await expect(page.getByText(noteTitle)).toBeVisible({ timeout: 5_000 });
}

/**
 * Verify note does not exist in the list
 */
export async function expectNoteNotExists(page: Page, noteTitle: string): Promise<void> {
  await expect(page.getByText(noteTitle)).not.toBeVisible({ timeout: 5_000 });
}
