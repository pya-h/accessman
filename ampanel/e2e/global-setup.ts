import { execSync, spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  PORT, BASE_URL, SECURITY_KEY, OPERATOR_KEY,
  ADMIN_APP_NAME, PID_FILE, TEST_DB_URL, operatorHeaders,
} from './helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BACKEND_DIR = resolve(__dirname, '../../ambackend');
const PANEL_DIR = resolve(__dirname, '..');

async function waitForServer(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/apps`, {
        headers: operatorHeaders(),
      });
      if (res.ok) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function seedData(): Promise<void> {
  const headers = operatorHeaders();

  // Create test apps
  for (const name of ['testapp', 'otherapp']) {
    await fetch(`${BASE_URL}/api/apps`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name }),
    });
  }

  // Import tokens for testapp (including one expired and one for revoke tests)
  const testappTokens = [
    { userId: 'user-001', appName: 'testapp' },
    { userId: 'user-002', appName: 'testapp' },
    { userId: 'user-003', appName: 'testapp' },
    { userId: 'user-004', appName: 'testapp' },
    { userId: 'user-expired', appName: 'testapp', expiresAt: '2020-01-01T00:00:00Z' },
    { userId: 'user-revoke', appName: 'testapp' },
  ];

  const importRes = await fetch(`${BASE_URL}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify(testappTokens),
  });
  const importData = await importRes.json();

  // Update metadata on user-001's token using the raw token
  const user001Token = importData.imported?.find(
    (t: { userId: string }) => t.userId === 'user-001',
  );
  if (user001Token) {
    await fetch(`${BASE_URL}/api/tokens/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Security': SECURITY_KEY,
        'X-App-Name': 'testapp',
      },
      body: JSON.stringify({
        token: user001Token.token,
        metadata: { role: 'admin', tier: 'premium' },
      }),
    });
  }

  // Import tokens for otherapp
  await fetch(`${BASE_URL}/api/import`, {
    method: 'POST',
    headers,
    body: JSON.stringify([
      { userId: 'user-005', appName: 'otherapp' },
      { userId: 'user-006', appName: 'otherapp' },
    ]),
  });
}

export default async function globalSetup(): Promise<void> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: TEST_DB_URL,
    SECURITY_KEY,
    OPERATOR_KEY,
    ADMIN_APP_NAME,
  };

  // 1. Build panel → backend/public
  console.log('[setup] Building panel...');
  execSync('npm run push', { cwd: PANEL_DIR, stdio: 'pipe' });

  // 2. Build backend
  console.log('[setup] Building backend...');
  execSync('npm run build', { cwd: BACKEND_DIR, stdio: 'pipe' });

  // 3. Prepare database (sync schema + clean + insert admin app)
  console.log('[setup] Preparing database...');
  execSync(`node ${resolve(__dirname, 'prepare-db.cjs')}`, {
    cwd: BACKEND_DIR,
    env: { ...env, NODE_PATH: resolve(BACKEND_DIR, 'node_modules') },
    stdio: 'inherit',
  });

  // 4. Start backend server
  console.log(`[setup] Starting server on port ${PORT}...`);
  const server = spawn('node', ['dist/main.js'], {
    cwd: BACKEND_DIR,
    env,
    stdio: 'pipe',
    detached: true,
  });

  server.unref();
  writeFileSync(PID_FILE, String(server.pid));

  // 5. Wait for readiness
  await waitForServer();
  console.log('[setup] Server is ready');

  // 6. Seed test data
  console.log('[setup] Seeding test data...');
  await seedData();
  console.log('[setup] Setup complete');
}
