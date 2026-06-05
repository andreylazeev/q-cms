import { expect, test } from '@playwright/test';

/**
 * Smoke test for the login flow. We don't have a real API running in
 * CI for the admin app, so the test verifies the static UI:
 *   - the form is reachable
 *   - it has the expected fields
 *   - submitting with empty inputs surfaces a validation error
 */
test.describe('login page', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
    await expect(page.getByTestId('login-email')).toBeVisible();
    await expect(page.getByTestId('login-password')).toBeVisible();
    await expect(page.getByTestId('login-submit')).toBeVisible();
  });

  test('rejects empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('login-submit').click();
    // The browser-native `required` attribute should prevent submit
    // and keep us on /login.
    await expect(page).toHaveURL(/\/login$/);
  });
});
