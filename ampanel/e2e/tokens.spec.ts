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

test.describe('Token List Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/tokens');
    // Wait for table to load
    await page.waitForSelector('table');
  });

  test('renders token table with seeded data', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'user-001' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'user-002' })).toBeVisible();
  });

  test('filters by app name', async ({ page }) => {
    // Open app filter dropdown and select "otherapp"
    await page.getByText('All Apps').click();
    await page.getByRole('button', { name: 'otherapp' }).click();

    // Should show otherapp tokens
    await expect(page.getByRole('cell', { name: 'user-005' })).toBeVisible();
    // Should not show testapp tokens
    await expect(page.getByRole('cell', { name: 'user-001' })).not.toBeVisible();
  });

  test('filters by status', async ({ page }) => {
    // Open status filter and select "Expired"
    await page.getByText('All Status').click();
    await page.getByRole('button', { name: 'Expired' }).click();

    await expect(page.getByRole('cell', { name: 'user-expired' })).toBeVisible();
    // Active users should not be visible
    await expect(page.getByRole('cell', { name: 'user-002' })).not.toBeVisible();
  });

  test('searches by userId', async ({ page }) => {
    await page.getByPlaceholder('Search User ID...').fill('user-004');

    // Wait for debounce + refetch
    await expect(page.getByRole('cell', { name: 'user-004' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'user-001' })).not.toBeVisible();
  });

  test('searches by token prefix', async ({ page }) => {
    // Get a token prefix from the table first
    const prefixCell = page.locator('table td').filter({ hasText: /^testapp_/ }).first();
    const prefix = await prefixCell.textContent();

    if (prefix) {
      await page.getByPlaceholder('Search Token Prefix...').fill(prefix.slice(0, 12));
      await expect(page.locator('table').getByText(prefix)).toBeVisible();
    }
  });

  test('navigates to token detail on row click', async ({ page }) => {
    await page.getByRole('cell', { name: 'user-001' }).click();

    await expect(page).toHaveURL(/\/tokens\/\d+/);
    await expect(page.getByText('Token #')).toBeVisible();
  });
});

test.describe('Token Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renders all token fields', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForSelector('table');
    await page.getByRole('cell', { name: 'user-001' }).click();
    await expect(page).toHaveURL(/\/tokens\/\d+/);

    // Verify key fields
    await expect(page.getByText('User ID')).toBeVisible();
    await expect(page.getByText('App Name')).toBeVisible();
    await expect(page.getByText('Token Prefix')).toBeVisible();
    await expect(page.getByText('Status')).toBeVisible();
    await expect(page.getByText('Created At')).toBeVisible();
  });

  test('renders metadata section', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForSelector('table');
    await page.getByRole('cell', { name: 'user-001' }).click();

    await expect(page.getByText('Metadata')).toBeVisible();
    // user-001 has metadata { role: 'admin', tier: 'premium' }
    await expect(page.getByText('role')).toBeVisible();
    await expect(page.getByText('admin')).toBeVisible();
  });

  test('revokes a token from detail page', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForSelector('table');
    await page.getByRole('cell', { name: 'user-revoke' }).click();
    await expect(page).toHaveURL(/\/tokens\/\d+/);

    // Click revoke button
    await page.getByRole('button', { name: 'Revoke' }).click();

    // Confirm in modal
    await expect(page.getByText('Are you sure')).toBeVisible();
    await page.locator('[class*="confirmBtn"]').click();

    // Should redirect to token list
    await expect(page).toHaveURL(/\/tokens/);
  });

  test('navigates back to token list', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForSelector('table');
    await page.getByRole('cell', { name: 'user-002' }).click();
    await expect(page).toHaveURL(/\/tokens\/\d+/);

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page).toHaveURL(/\/tokens/);
  });
});
