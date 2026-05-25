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
