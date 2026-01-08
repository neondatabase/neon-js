import { test } from '@playwright/test';
import {
  createTestUser,
  registerUser,
  loginUser,
  logoutUser,
  expectLoggedIn,
} from './helpers';

test.describe('Auth Flow', () => {
  test('complete registration, login, and logout flow', async ({ page }) => {
    const testUser = createTestUser('auth');

    await test.step('Register new user', async () => {
      await registerUser(page, testUser);
    });

    await test.step('Verify logged in after registration', async () => {
      await expectLoggedIn(page);
    });

    await test.step('Logout', async () => {
      await logoutUser(page);
    });

    await test.step('Login with registered user', async () => {
      await loginUser(page, testUser);
    });

    await test.step('Verify logged in after login', async () => {
      await expectLoggedIn(page);
    });

    await test.step('Final logout', async () => {
      await logoutUser(page);
    });
  });
});
