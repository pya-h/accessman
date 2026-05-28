import { test, expect, Page } from '@playwright/test';
import { SECURITY_KEY, OPERATOR_KEY, BASE_URL, operatorHeaders } from './helpers';

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

async function importToken(userId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/import`, {
    method: 'POST',
    headers: operatorHeaders(),
    body: JSON.stringify([{ userId, appName: 'testapp' }]),
  });
  const data = await res.json();
  return data.imported[0].token;
}

test.describe('Verify Page', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/verify');
  });

  test('verifies a valid token and shows result fields', async ({ page }) => {
    const userId = `vrf-${Date.now().toString(36)}`;
    const token = await importToken(userId);

    await page.getByText('Select app...').click();
    await page.getByRole('button', { name: 'testapp' }).click();
    await page.getByPlaceholder(/paste the raw token/i).fill(token);
    await page.getByRole('button', { name: 'Verify Token' }).click();

    await expect(page.getByText('Valid', { exact: true })).toBeVisible();
    await expect(page.getByText(userId)).toBeVisible();
  });

  test('shows invalid result for an unknown token', async ({ page }) => {
    await page.getByText('Select app...').click();
    await page.getByRole('button', { name: 'testapp' }).click();
    await page.getByPlaceholder(/paste the raw token/i).fill('nonexistent-token-xyz');
    await page.getByRole('button', { name: 'Verify Token' }).click();

    await expect(page.getByText('Invalid', { exact: true })).toBeVisible();
    await expect(page.getByText('not_found')).toBeVisible();
  });

  test('verify button is disabled until app and token are provided', async ({ page }) => {
    const btn = page.getByRole('button', { name: 'Verify Token' });
    await expect(btn).toBeDisabled();

    await page.getByText('Select app...').click();
    await page.getByRole('button', { name: 'testapp' }).click();
    await page.getByPlaceholder(/paste the raw token/i).fill('abcd');
    await expect(btn).toBeEnabled();
  });
});
