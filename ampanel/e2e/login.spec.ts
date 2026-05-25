import { test, expect } from '@playwright/test';
import { SECURITY_KEY, OPERATOR_KEY } from './helpers';

test.describe('Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all storage so we start fresh
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('AccessMan Panel')).toBeVisible();
    await expect(page.getByLabel('Security Key')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.getByLabel('Security Key').fill('wrong-key');
    await page.getByLabel('Operator Key').fill('wrong-key');
    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.locator('[class*="error"]')).toBeVisible();
  });

  test('logs in with valid credentials and redirects to /tokens', async ({ page }) => {
    await page.getByLabel('Security Key').fill(SECURITY_KEY);
    await page.getByLabel('Operator Key').fill(OPERATOR_KEY);
    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page).toHaveURL(/\/tokens/);
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();
  });

  test('session persists on page reload', async ({ page }) => {
    // Login
    await page.getByLabel('Security Key').fill(SECURITY_KEY);
    await page.getByLabel('Operator Key').fill(OPERATOR_KEY);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page).toHaveURL(/\/tokens/);

    // Reload
    await page.reload();
    await expect(page).toHaveURL(/\/tokens/);
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();
  });

  test('logout redirects to /login', async ({ page }) => {
    // Login first
    await page.getByLabel('Security Key').fill(SECURITY_KEY);
    await page.getByLabel('Operator Key').fill(OPERATOR_KEY);
    await page.getByRole('button', { name: 'Connect' }).click();
    await expect(page).toHaveURL(/\/tokens/);

    // Logout
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByLabel('Security Key')).toBeVisible();
  });
});
