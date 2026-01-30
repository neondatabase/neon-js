import { test, expect } from '@playwright/test';
import {
  createTestUser,
  registerUser,
  createNote,
  deleteNote,
  expectNoteExists,
  expectNoteNotExists,
  type TestUser,
} from './helpers';

test.describe('Notes', () => {
  let testUser: TestUser;

  test.beforeEach(async ({ page }) => {
    // Create and register a new user for each test
    testUser = createTestUser('notes');
    await registerUser(page, testUser);
  });

  test('should display empty state when no notes exist', async ({ page }) => {
    // Navigate to notes page
    await page.goto('/notes');
    await expect(page).toHaveURL('/notes');

    // Verify empty state is displayed
    await expect(page.getByText(/no notes yet/i)).toBeVisible({ timeout: 5_000 });
  });

  test('should create and display notes', async ({ page }) => {
    // Navigate to notes page
    await page.goto('/notes');

    // Create two notes
    const note1Title = `Test Note 1 - ${Date.now()}`;
    const note2Title = `Test Note 2 - ${Date.now()}`;

    await createNote(page, note1Title);
    await createNote(page, note2Title);

    // Verify both notes appear in the list
    await expectNoteExists(page, note1Title);
    await expectNoteExists(page, note2Title);

    // Verify empty state is no longer visible
    await expect(page.getByText(/no notes yet/i)).not.toBeVisible();
  });

  test('should delete notes', async ({ page }) => {
    // Navigate to notes page
    await page.goto('/notes');

    // Create two notes
    const note1Title = `Test Note 1 - ${Date.now()}`;
    const note2Title = `Test Note 2 - ${Date.now()}`;

    await createNote(page, note1Title);
    await createNote(page, note2Title);

    // Delete the first note
    await deleteNote(page, note1Title);

    // Verify first note is deleted
    await expectNoteNotExists(page, note1Title);

    // Verify second note still exists
    await expectNoteExists(page, note2Title);
  });

  test('should persist notes after page reload', async ({ page }) => {
    // Navigate to notes page
    await page.goto('/notes');

    // Create a note
    const noteTitle = `Persistent Note - ${Date.now()}`;
    await createNote(page, noteTitle);

    // Verify note exists
    await expectNoteExists(page, noteTitle);

    // Reload the page
    await page.reload();

    // Verify note still exists after reload
    await expectNoteExists(page, noteTitle);
  });

  test('should handle multiple note operations in sequence', async ({ page }) => {
    // Navigate to notes page
    await page.goto('/notes');

    // Verify empty state
    await expect(page.getByText(/no notes yet/i)).toBeVisible({ timeout: 5_000 });

    // Create first note
    const note1Title = `Note 1 - ${Date.now()}`;
    await createNote(page, note1Title);
    await expectNoteExists(page, note1Title);

    // Create second note
    const note2Title = `Note 2 - ${Date.now()}`;
    await createNote(page, note2Title);
    await expectNoteExists(page, note2Title);

    // Delete first note
    await deleteNote(page, note1Title);
    await expectNoteNotExists(page, note1Title);

    // Verify second note still exists
    await expectNoteExists(page, note2Title);

    // Delete second note
    await deleteNote(page, note2Title);
    await expectNoteNotExists(page, note2Title);

    // Verify empty state is shown again
    await expect(page.getByText(/no notes yet/i)).toBeVisible({ timeout: 5_000 });
  });
});
