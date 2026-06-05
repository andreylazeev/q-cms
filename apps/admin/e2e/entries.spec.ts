import { expect, test } from '@playwright/test';

/**
 * CRUD smoke test for the entries page. We seed localStorage with a
 * synthetic auth payload so the dashboard shell's redirect doesn't
 * kick in, then walk through the new-entry form.
 */
test.describe('entries CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'q-cms-admin:auth',
        JSON.stringify({
          token: 'stub-token',
          user: { id: '00000000-0000-0000-0000-000000000001', email: 'tester@example.com' },
        }),
      );
    });
  });

  test('new entry form is reachable from a collection', async ({ page }) => {
    await page.goto('/collections/article');
    await expect(page.getByTestId('entries-page')).toBeVisible();
    await page.getByTestId('new-entry-button').click();
    await expect(page).toHaveURL(/\/collections\/article\/new$/);
    await expect(page.getByTestId('new-entry-form')).toBeVisible();
  });

  test('the new entry form rejects missing required fields', async ({ page }) => {
    await page.goto('/collections/article/new');
    await page.getByRole('button', { name: 'Create' }).click();
    // The title input has `required`, so the form should not POST and
    // we should remain on the same page.
    await expect(page).toHaveURL(/\/collections\/article\/new$/);
  });
});
