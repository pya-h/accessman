import { test, expect, Page } from '@playwright/test';
import { SECURITY_KEY, OPERATOR_KEY } from './helpers';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(
    ([sk, ok]) => {
      sessionStorage.setItem('am_security_key', sk);
      sessionStorage.setItem('am_operator_key', ok);
    },
    [SECURITY_KEY, OPERATOR_KEY],
  );
}

test.describe('App List Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/apps');
    await page.waitForSelector('table');
  });

  test('renders app table with seeded apps', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'testapp' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'otherapp' })).toBeVisible();
  });

  test('registers a new app', async ({ page }) => {
    await page.getByRole('button', { name: 'Register App' }).click();
    await page.getByPlaceholder('App name').fill('newapp-pw');
    await page.getByRole('button', { name: 'Register' }).click();

    // Success toast
    await expect(page.getByText(/registered/i)).toBeVisible();
    // App appears in table
    await expect(page.getByRole('cell', { name: 'newapp-pw' })).toBeVisible();
  });

  test('shows error on duplicate app name', async ({ page }) => {
    await page.getByRole('button', { name: 'Register App' }).click();
    await page.getByPlaceholder('App name').fill('testapp');
    await page.getByRole('button', { name: 'Register' }).click();

    // Error toast
    await expect(page.getByText(/already exists|duplicate|conflict/i)).toBeVisible();
  });
});
