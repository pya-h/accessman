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

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
  });

  test('switches to dark theme', async ({ page }) => {
    await page.getByRole('button', { name: 'Dark' }).click();

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('dark');
  });

  test('switches to light theme', async ({ page }) => {
    await page.getByRole('button', { name: 'Light' }).click();

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('light');
  });

  test('changes font size', async ({ page }) => {
    await page.getByRole('button', { name: /Large \(16px\)/ }).click();

    const fontSize = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--font-size-base'),
    );
    expect(fontSize).toBe('16px');
  });

  test('changes table density', async ({ page }) => {
    await page.getByRole('button', { name: 'Compact' }).click();

    const density = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--table-density'),
    );
    expect(density).toBe('6px');
  });

  test('shows token generation settings and updates them', async ({ page }) => {
    // Access code length input is present with a numeric value in range
    const codeLength = page.locator('input[type="number"]');
    await expect(codeLength).toBeVisible();
    expect(Number(await codeLength.inputValue())).toBeGreaterThanOrEqual(4);

    // Letter case uses distinct labels — switch to Upper, expect a toast, restore
    await page.getByRole('button', { name: 'Upper', exact: true }).click();
    await expect(
      page.locator('[class*="toast"]').filter({ hasText: /updated/i }).first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Lower', exact: true }).click();

    // Off/On appears in several fields, so scope the prefix toggle to its field
    const prefixField = page
      .getByText('Prefix App Name', { exact: true })
      .locator('xpath=..');
    await prefixField.getByRole('button', { name: 'On', exact: true }).click();
    await expect(
      page.locator('[class*="toast"]').filter({ hasText: /updated/i }).first(),
    ).toBeVisible();
    await prefixField.getByRole('button', { name: 'Off', exact: true }).click();
  });

  test('settings persist after reload', async ({ page }) => {
    await page.getByRole('button', { name: 'Dark' }).click();
    await page.getByRole('button', { name: /Large \(16px\)/ }).click();

    await page.reload();

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('dark');

    const fontSize = await page.evaluate(() =>
      document.documentElement.style.getPropertyValue('--font-size-base'),
    );
    expect(fontSize).toBe('16px');
  });
});
