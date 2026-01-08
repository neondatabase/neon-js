import { test, expect } from '@playwright/test';
import { createTestUser, registerUser, logoutUser } from './helpers';

test.describe('Data API', () => {
  test('authenticated user creates public todo visible to anonymous users', async ({
    page,
  }) => {
    const testUser = createTestUser('data');
    const uniqueTodoTitle = `E2E Test Todo ${Date.now()}`;

    await test.step('Register new user', async () => {
      await registerUser(page, testUser);
    });

    await test.step('Create new todo', async () => {
      const addInput = page.getByPlaceholder('What needs to be done?');
      await expect(addInput).toBeVisible({ timeout: 10_000 });

      await addInput.fill(uniqueTodoTitle);
      await page.getByRole('button', { name: '+ Add' }).click();

      await expect(page.getByText(uniqueTodoTitle)).toBeVisible({
        timeout: 5000,
      });
    });

    await test.step('Mark todo as public', async () => {
      const todoItem = page.locator('div').filter({ hasText: uniqueTodoTitle });
      await todoItem.getByRole('button', { name: '🔒' }).click();
      await expect(todoItem.getByRole('button', { name: '🌐' })).toBeVisible();
    });

    await test.step('Logout', async () => {
      await logoutUser(page);
    });

    await test.step('Visit dashboard as anonymous user', async () => {
      await page.goto('/dashboard');
      await expect(page.getByText('Viewing Public Tasks')).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step('Verify public todo is visible to anonymous user', async () => {
      await expect(page.getByText(uniqueTodoTitle)).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
