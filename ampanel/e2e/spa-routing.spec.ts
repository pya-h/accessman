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

test.describe('SPA Routing (Served Mode)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('direct navigation to /tokens works', async ({ page }) => {
    await page.goto('/tokens');
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();
  });

  test('direct navigation to /apps works', async ({ page }) => {
    await page.goto('/apps');
    await expect(page.getByRole('heading', { name: 'Apps' })).toBeVisible();
  });

  test('direct navigation to /settings works', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('direct navigation to /import works', async ({ page }) => {
    await page.goto('/import');
    await expect(page.getByRole('heading', { name: 'Import Tokens' })).toBeVisible();
  });

  test('unknown route falls back to token list', async ({ page }) => {
    await page.goto('/nonexistent-route');
    // Default route renders token list
    await expect(page.getByRole('heading', { name: 'Tokens' })).toBeVisible();
  });

  test('API calls use relative /api/ paths (no CORS)', async ({ page }) => {
    await page.goto('/tokens');

    // Intercept API call and verify it uses relative path
    const [apiRequest] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/tokens')),
      page.reload(),
    ]);

    expect(apiRequest.url()).toContain('/api/tokens');
    expect(apiRequest.url()).not.toContain('localhost:5173');
  });
});

test.describe('Responsive Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('mobile viewport shows bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tokens');

    // Bottom nav should be visible
    const bottomNav = page.locator('nav').last();
    await expect(bottomNav).toBeVisible();
  });

  test('tablet viewport has collapsible sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/tokens');

    // Toggle button should be visible
    const toggleBtn = page.getByLabel('Toggle menu');
    await expect(toggleBtn).toBeVisible();
  });

  test('tables scroll horizontally on small viewports', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tokens');
    await page.waitForSelector('table');

    const tableWrapper = page.locator('table').first();
    await expect(tableWrapper).toBeVisible();
  });
});
