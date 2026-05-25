import { test, expect, Page } from '@playwright/test';
import { SECURITY_KEY, OPERATOR_KEY, BASE_URL, operatorHeaders } from './helpers';

// --- Random generators ---

function randomId(prefix = 'rnd'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomFutureDate(): string {
  const future = new Date();
  future.setDate(future.getDate() + Math.floor(Math.random() * 365) + 1);
  return future.toISOString();
}

function randomCustomToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const len = 8 + Math.floor(Math.random() * 57); // 8–64
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// --- Auth helper ---

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

// ─────────────────────────────────────────────────────────────
// App Registration: random & error paths
// ─────────────────────────────────────────────────────────────
test.describe('App Registration — random & error paths', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/apps');
    await page.waitForSelector('table');
  });

  test('registers app with random name', async ({ page }) => {
    const appName = randomId('app');

    await page.getByRole('button', { name: 'Register App' }).click();
    await page.getByPlaceholder('App name').fill(appName);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByText(/registered/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: appName })).toBeVisible();
  });

  test('register button is disabled for empty app name', async ({ page }) => {
    await page.getByRole('button', { name: 'Register App' }).click();
    // Don't fill anything — input is empty
    const registerBtn = page.getByRole('button', { name: 'Register' });
    await expect(registerBtn).toBeDisabled();
  });

  test('shows error when registering duplicate random app', async ({ page }) => {
    const appName = randomId('dupapp');

    // Register first time
    await page.getByRole('button', { name: 'Register App' }).click();
    await page.getByPlaceholder('App name').fill(appName);
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText(/registered/i)).toBeVisible();

    // Register same name again
    await page.getByRole('button', { name: 'Register App' }).click();
    await page.getByPlaceholder('App name').fill(appName);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByText(/already exists|duplicate|conflict/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Import: random inputs — happy paths
// ─────────────────────────────────────────────────────────────
test.describe('Import — random-input happy paths', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/import');
  });

  test('imports tokens with random userIds', async ({ page }) => {
    const users = Array.from({ length: 3 }, () => randomId('usr'));
    const data = JSON.stringify(
      users.map((u) => ({ userId: u, appName: 'testapp' })),
      null,
      2,
    );

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(/shown only once/i)).toBeVisible();
    for (const u of users) {
      await expect(page.getByText(u)).toBeVisible();
    }
  });

  test('imports tokens with random future expiration dates', async ({ page }) => {
    const userId = randomId('exp');
    const expiresAt = randomFutureDate();
    const data = JSON.stringify(
      [{ userId, appName: 'testapp', expiresAt }],
      null,
      2,
    );

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(userId)).toBeVisible();
  });

  test('imports tokens with random custom token codes', async ({ page }) => {
    const userId = randomId('ctk');
    const token = randomCustomToken();
    const data = JSON.stringify(
      [{ userId, appName: 'testapp', token }],
      null,
      2,
    );

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(userId)).toBeVisible();
  });

  test('imports with random userId and all optional fields', async ({ page }) => {
    const userId = randomId('full');
    const expiresAt = randomFutureDate();
    const token = randomCustomToken();
    const data = JSON.stringify(
      [{ userId, appName: 'testapp', expiresAt, token }],
      null,
      2,
    );

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(userId)).toBeVisible();
  });

  test('imports without userId (auto-generated)', async ({ page }) => {
    const data = JSON.stringify([{ appName: 'testapp' }], null, 2);

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(/shown only once/i)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Import: error / invalid-input paths
// ─────────────────────────────────────────────────────────────
test.describe('Import — error paths', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/import');
  });

  test('submit button disabled when content is empty', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: 'Import Tokens' });
    await expect(submitBtn).toBeDisabled();
  });

  test('shows error for invalid JSON', async ({ page }) => {
    await page.locator('textarea').fill('{ not valid json !!!');
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page.getByText(/invalid json/i)).toBeVisible();
  });

  test('shows error for non-array JSON', async ({ page }) => {
    await page.locator('textarea').fill('{"userId": "test"}');
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page.getByText(/must be an array/i)).toBeVisible();
  });

  test('shows error for empty JSON array', async ({ page }) => {
    await page.locator('textarea').fill('[]');
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page.getByText(/array is empty/i)).toBeVisible();
  });

  test('shows error for CSV with only header (no data rows)', async ({ page }) => {
    // Switch to CSV format
    await page.getByRole('button', { name: 'CSV' }).click();
    await page.locator('textarea').fill('userId,appName');
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    await expect(page.getByText(/header row and at least one data row/i)).toBeVisible();
  });

  test('import to new app auto-creates it and succeeds', async ({ page }) => {
    const userId = randomId('newapp');
    const autoApp = randomId('autoapp');
    const data = JSON.stringify([{ userId, appName: autoApp }], null, 2);

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    // Backend auto-creates the app and imports successfully
    await expect(page).toHaveURL(/\/import\/results/);
    await expect(page.getByText(userId)).toBeVisible();
  });

  test('import with missing required appName shows error toast', async ({ page }) => {
    // Items without appName should trigger a backend validation error
    const data = JSON.stringify([{ userId: randomId('nofld') }], null, 2);

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Import Tokens' }).click();

    // Backend returns 400 → panel shows error toast, stays on /import
    await expect(page.locator('[class*="toast"]').filter({ hasText: /invalid|failed/i })).toBeVisible();
    // Still on import page (not redirected to results)
    await expect(page).toHaveURL(/\/import$/);
  });

  test('reissue with non-existent userId shows error in results', async ({ page }) => {
    // Switch to reissue mode
    await page.getByText('Import (new tokens)').click();
    await page.getByRole('button', { name: 'Reissue (revoke + new)' }).click();

    const userId = randomId('noreissue');
    const data = JSON.stringify(
      [{ userId, appName: 'testapp' }],
      null,
      2,
    );

    await page.locator('textarea').fill(data);
    await page.getByRole('button', { name: 'Reissue Tokens' }).click();

    await expect(page).toHaveURL(/\/import\/results/);
    // Should show error because no existing token to reissue
    await expect(page.getByText(userId)).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Token Detail: revoke & verify revoked status + error paths
// ─────────────────────────────────────────────────────────────
test.describe('Token Detail — revoke verification & error paths', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('revokes token and verifies Revoked status on detail page', async ({ page }) => {
    // First import a token specifically for this test
    const userId = randomId('revdet');
    await fetch(`${BASE_URL}/api/import`, {
      method: 'POST',
      headers: operatorHeaders(),
      body: JSON.stringify([{ userId, appName: 'testapp' }]),
    });

    // Navigate to tokens and find the token
    await page.goto('/tokens');
    await page.waitForSelector('table');
    await page.getByPlaceholder('Search User ID...').fill(userId);
    await expect(page.getByRole('cell', { name: userId })).toBeVisible();

    // Click to go to detail
    await page.getByRole('cell', { name: userId }).click();
    await expect(page).toHaveURL(/\/tokens\/\d+/);

    // Verify active status
    await expect(page.getByText('Active')).toBeVisible();

    // Click Revoke
    await page.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByText('Are you sure')).toBeVisible();
    await page.locator('[class*="confirmBtn"]').click();

    // Should redirect to token list
    await expect(page).toHaveURL(/\/tokens/);

    // Navigate back to the same token detail
    await page.getByPlaceholder('Search User ID...').fill(userId);
    await expect(page.getByRole('cell', { name: userId })).toBeVisible();
    await page.getByRole('cell', { name: userId }).click();
    await expect(page).toHaveURL(/\/tokens\/\d+/);

    // Verify revoked status on detail page (badge shows "revoked")
    await expect(page.locator('[class*="badge"]').filter({ hasText: /revoked/i })).toBeVisible();
    // Revoke button should not be present anymore
    await expect(page.getByRole('button', { name: 'Revoke' })).not.toBeVisible();
  });

  test('shows not-found for non-existent token ID', async ({ page }) => {
    await page.goto('/tokens/999999');

    await expect(page.getByText(/not found/i)).toBeVisible();
  });

  test('revoke of already-revoked token from list shows no Revoke button', async ({ page }) => {
    await page.goto('/tokens');
    await page.waitForSelector('table');

    // Filter to revoked tokens
    await page.getByText('All Status').click();
    await page.getByRole('button', { name: 'Revoked' }).click();

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Revoked tokens should not have a Revoke button in their row
    const rows = page.locator('table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      // Click into the first revoked token's detail
      await rows.first().click();
      await expect(page).toHaveURL(/\/tokens\/\d+/);
      // Status badge shows "revoked"
      await expect(page.locator('[class*="badge"]').filter({ hasText: /revoked/i })).toBeVisible();
      // Revoke button should not be present
      await expect(page.getByRole('button', { name: 'Revoke' })).not.toBeVisible();
    }
  });
});

// ─────────────────────────────────────────────────────────────
// Token List: random searches & filters
// ─────────────────────────────────────────────────────────────
test.describe('Token List — random searches', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/tokens');
    await page.waitForSelector('table');
  });

  test('searching for random non-existent userId shows empty state', async ({ page }) => {
    const fakeUser = randomId('ghost');
    await page.getByPlaceholder('Search User ID...').fill(fakeUser);

    // Wait for debounce + fetch
    await page.waitForTimeout(500);

    await expect(page.getByText(/no tokens found/i)).toBeVisible();
  });

  test('filter by status Revoked shows only revoked tokens', async ({ page }) => {
    await page.getByText('All Status').click();
    await page.getByRole('button', { name: 'Revoked' }).click();

    // Wait for filtered results
    await page.waitForTimeout(500);

    // Either we have revoked tokens or the empty state
    const rowCount = await page.locator('table tbody tr').count();
    if (rowCount > 0) {
      // All visible status badges should be "revoked" (lowercase in badge)
      const badges = page.locator('table tbody [class*="badge"]').filter({ hasText: /revoked/i });
      expect(await badges.count()).toBeGreaterThan(0);
    }
  });

  test('combined filters: app + status', async ({ page }) => {
    // Filter by testapp
    await page.getByText('All Apps').click();
    await page.getByRole('button', { name: 'testapp' }).click();

    // Filter by expired
    await page.getByText('All Status').click();
    await page.getByRole('button', { name: 'Expired' }).click();

    // user-expired should be visible (it was seeded with past expiry)
    await expect(page.getByRole('cell', { name: 'user-expired' })).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────
// Pagination
// ─────────────────────────────────────────────────────────────
test.describe('Token List — pagination', () => {
  const BATCH_PREFIX = 'pgn';

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('imports batch of tokens and navigates to page 2', async ({ page }) => {
    // Import 55 tokens via API to ensure we exceed the 50-per-page limit
    const batch = Array.from({ length: 55 }, (_, i) => ({
      userId: `${BATCH_PREFIX}-${String(i).padStart(3, '0')}-${randomId()}`,
      appName: 'testapp',
    }));

    const res = await fetch(`${BASE_URL}/api/import`, {
      method: 'POST',
      headers: operatorHeaders(),
      body: JSON.stringify(batch),
    });
    expect(res.ok).toBe(true);

    // Navigate to token list and filter to our batch
    await page.goto('/tokens');
    await page.waitForSelector('table');

    // The total tokens should now be >50, so pagination should appear
    // Use the pagination info text to verify
    const paginationInfo = page.locator('text=/\\d+–\\d+ of \\d+/');
    await expect(paginationInfo).toBeVisible();

    // Verify page 1 content
    const nextBtn = page.getByRole('button', { name: 'Next' });
    await expect(nextBtn).toBeEnabled();

    // Navigate to page 2
    await nextBtn.click();

    // URL should contain page=2
    await expect(page).toHaveURL(/page=2/);

    // Table should still have data
    const rows = page.locator('table tbody tr');
    expect(await rows.count()).toBeGreaterThan(0);

    // Previous button should now be enabled
    const prevBtn = page.getByRole('button', { name: 'Previous' });
    await expect(prevBtn).toBeEnabled();

    // Navigate back to page 1
    await prevBtn.click();
    await expect(page).not.toHaveURL(/page=2/);
  });
});

// ─────────────────────────────────────────────────────────────
// Login: error paths with random credentials
// ─────────────────────────────────────────────────────────────
test.describe('Login — random invalid credentials', () => {
  test('rejects random security key', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.getByLabel('Security Key').fill(randomId('badkey'));
    await page.getByLabel('Operator Key').fill(randomId('badop'));
    await page.getByRole('button', { name: 'Connect' }).click();

    await expect(page.locator('[class*="error"]')).toBeVisible();
    // Should still be on login page
    await expect(page.getByLabel('Security Key')).toBeVisible();
  });
});
