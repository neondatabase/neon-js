import { test, expect } from '@playwright/test';

/**
 * Data API E2E Tests
 *
 * Tests the data API functionality with authentication:
 * 1. Create a todo as authenticated user
 * 2. Mark todo as public
 * 3. Verify anonymous users can see public todos
 */

// Generate unique test user and todo for each test run
const testUser = {
  name: 'Data Test User',
  email: `data-test-${Date.now()}-${Math.random().toString(36).slice(7)}@example.com`,
  password: 'TestPassword123!',
};

const uniqueTodoTitle = `E2E Test Todo ${Date.now()}`;

test.describe('Data API', () => {
  test('authenticated user creates public todo visible to anonymous users', async ({
    page,
  }) => {
    // ============================================
    // STEP 1: Register and login
    // ============================================
    await test.step('Register new user', async () => {
      await page.goto('/auth/sign-up');
      await expect(page.locator('form')).toBeVisible();

      await page.getByLabel(/name/i).fill(testUser.name);
      await page.getByLabel(/email/i).fill(testUser.email);
      await page.getByLabel(/password/i).fill(testUser.password);
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL('/dashboard', { timeout: 15_000 });
    });

    // ============================================
    // STEP 2: Create a new todo
    // ============================================
    await test.step('Create new todo', async () => {
      // Wait for the add form to be visible
      const addInput = page.getByPlaceholder('What needs to be done?');
      await expect(addInput).toBeVisible({ timeout: 10_000 });

      // Fill in the todo title
      await addInput.fill(uniqueTodoTitle);

      // Click the add button
      await page.getByRole('button', { name: '+ Add' }).click();

      // Verify the todo appears in the list
      await expect(page.getByText(uniqueTodoTitle)).toBeVisible({
        timeout: 5000,
      });
    });

    // ============================================
    // STEP 3: Mark todo as public
    // ============================================
    await test.step('Mark todo as public', async () => {
      // Find the todo item and click the public toggle button (🔒 -> 🌐)
      // The button is in the same container as the todo title
      const todoItem = page.locator('div').filter({ hasText: uniqueTodoTitle });

      // Click the private/public toggle button (shows 🔒 when private)
      await todoItem.getByRole('button', { name: '🔒' }).click();

      // Verify it now shows the public icon 🌐
      await expect(todoItem.getByRole('button', { name: '🌐' })).toBeVisible();
    });

    // ============================================
    // STEP 4: Logout
    // ============================================
    await test.step('Logout', async () => {
      await page.locator('[data-slot="avatar"]').first().click();
      await page.getByRole('menuitem', { name: 'Sign Out' }).click();

      await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible({
        timeout: 10_000,
      });
    });

    // ============================================
    // STEP 5: Visit dashboard as anonymous user
    // ============================================
    await test.step('Visit dashboard as anonymous user', async () => {
      // Navigate to dashboard without logging in
      await page.goto('/dashboard');

      // Should see the guest banner indicating anonymous access
      await expect(page.getByText('Viewing Public Tasks')).toBeVisible({
        timeout: 10_000,
      });
    });

    // ============================================
    // STEP 6: Verify public todo is visible to anonymous user
    // ============================================
    await test.step('Verify public todo is visible to anonymous user', async () => {
      // The public todo we just created should be visible
      await expect(page.getByText(uniqueTodoTitle)).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
