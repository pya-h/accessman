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

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/import');
  });

  test('imports tokens via JSON paste', async ({ page }) => {
    const importData = JSON.stringify([
      { userId: 'import-u1', appName: 'testapp' },
      { userId: 'import-u2', appName: 'testapp' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    // Should redirect to results page
    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(/shown only once/i)).toBeVisible();
    await expect(page.getByText('import-u1')).toBeVisible();
    await expect(page.getByText('import-u2')).toBeVisible();
  });

  test('copies all tokens from results', async ({ page, context }) => {
    // Grant clipboard permission
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    const importData = JSON.stringify([
      { userId: 'copy-u1', appName: 'testapp' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Import Tokens' }).click();
    await expect(page).toHaveURL(/\/import\/results/);

    await page.getByRole('button', { name: 'Copy All Tokens' }).click();

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('copy-u1');
  });

  test('downloads CSV from results', async ({ page }) => {
    const importData = JSON.stringify([
      { userId: 'csv-u1', appName: 'testapp' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Import Tokens' }).click();
    await expect(page).toHaveURL(/\/import\/results/);

    // Listen for download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);

    expect(download.suggestedFilename()).toBe('imported-tokens.csv');
  });

  test('format template updates when format changes', async ({ page }) => {
    await expect(page.getByText('Input Template')).toBeVisible();

    // Switch to CSV
    await page.getByRole('button', { name: 'CSV' }).click();
    // CSV template shows header row comment
    await expect(page.getByText('// Header row')).toBeVisible();

    // Switch back to JSON
    await page.getByRole('button', { name: 'JSON' }).click();
    // JSON template shows quoted keys — header row comment is gone
    await expect(page.getByText('// Header row')).not.toBeVisible();
  });

  test('single app scope imports correctly', async ({ page }) => {
    // Switch to single app
    await page.getByText('All apps (per-row)').click();
    await page.getByRole('button', { name: 'Single app' }).click();

    // Select testapp
    await page.getByText('Select app...').click();
    await page.getByRole('button', { name: 'testapp' }).click();

    const importData = JSON.stringify([
      { userId: 'single-u1' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText('single-u1')).toBeVisible();
  });

  test('reissue mode works', async ({ page }) => {
    // Switch to reissue mode
    await page.getByText('Import (new tokens)').click();
    await page.getByRole('button', { name: 'Reissue (revoke + new)' }).click();

    const importData = JSON.stringify([
      { userId: 'user-003', appName: 'testapp' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Reissue Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText('user-003')).toBeVisible();
  });

  test('navigates back to import from results', async ({ page }) => {
    const importData = JSON.stringify([
      { userId: 'nav-u1', appName: 'testapp' },
    ], null, 2);

    await page.locator('textarea').fill(importData);
    await page.getByRole('button', { name: 'Import Tokens' }).click();
    await expect(page).toHaveURL(/\/import\/results/);

    await page.getByRole('button', { name: 'New Import' }).click();
    await expect(page).toHaveURL(/\/import$/);
  });
});
