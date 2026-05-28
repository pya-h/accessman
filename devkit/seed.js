#!/usr/bin/env node
// Database seed script for AccessMan.
// Populates the database with realistic apps, tokens, and metadata.
// Exercises all import approaches, metadata CRUD, verify, list, detail, and revoke.
// Uses native fetch (Node 18+). No external dependencies.
//
// Usage:
//   node devkit/seed.js
//   # or from ambackend/
//   npm run seed
//
// Reads config from devkit/.env (or env vars). Expects the server running.

const { readFileSync } = require('fs');
const { resolve } = require('path');

// ── Load devkit/.env ────────────────────────────────────────
try {
  const envPath = resolve(__dirname, '.env');
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const BASE = process.env.HOST || 'http://localhost:3000/api';
const SECURITY_KEY = process.env.SECURITY_KEY || 'your-shared-security-key-here';
const OPERATOR_KEY = process.env.OPERATOR_KEY || 'your-operator-level-key-here';
const ADMIN_APP = process.env.ADMIN_APP_NAME || 'am-panel';
const SEED_TOKEN_COUNT = parseInt(process.env.SEED_TOKEN_COUNT || '50', 10);
const SEED_APP_COUNT = parseInt(process.env.SEED_APP_COUNT || '8', 10);

// ── Helpers ─────────────────────────────────────────────────

function tier2Headers(contentType = 'application/json') {
  return {
    'Content-Type': contentType,
    'X-Security': SECURITY_KEY,
    'X-App-Name': ADMIN_APP,
    'X-Operator-Key': OPERATOR_KEY,
  };
}

function tier1Headers(appName) {
  return {
    'Content-Type': 'application/json',
    'X-Security': SECURITY_KEY,
    'X-App-Name': appName,
  };
}

async function api(method, path, body, headers) {
  const opts = { method, headers };
  if (body !== null && body !== undefined) {
    opts.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function futureDate(daysMin, daysMax) {
  const ms = Date.now() + randInt(daysMin, daysMax) * 86400000;
  return new Date(ms).toISOString();
}

function pastDate(daysMin, daysMax) {
  const ms = Date.now() - randInt(daysMin, daysMax) * 86400000;
  return new Date(ms).toISOString();
}

// ── Realistic data pools ────────────────────────────────────

const APP_POOL = [
  'trading-platform',
  'analytics-dashboard',
  'mobile-app',
  'partner-portal',
  'internal-tools',
  'customer-support',
  'notification-service',
  'billing-portal',
  'content-cms',
  'developer-api',
  'hr-system',
  'inventory-tracker',
];

const FIRST_NAMES = [
  'alice', 'bob', 'charlie', 'diana', 'evan', 'fiona', 'george', 'hannah',
  'ivan', 'julia', 'karl', 'luna', 'max', 'nora', 'oscar', 'petra',
  'quinn', 'rosa', 'sam', 'tina', 'ulrich', 'vera', 'walter', 'xena',
];

const DEPARTMENTS = ['engineering', 'marketing', 'sales', 'finance', 'operations', 'support', 'design', 'product'];
const ROLES = ['viewer', 'editor', 'admin', 'analyst', 'manager', 'operator'];
const TIERS = ['free', 'starter', 'professional', 'enterprise'];
const PLATFORMS = ['ios', 'android', 'web', 'desktop'];
const REGIONS = ['us-east', 'us-west', 'eu-central', 'ap-southeast'];

function generateUserId(index) {
  const patterns = [
    () => `user-${String(index).padStart(4, '0')}`,
    () => `org-${pick(['acme', 'globex', 'initech', 'umbrella', 'stark', 'wayne'])}-${pick(FIRST_NAMES)}`,
    () => `${pick(FIRST_NAMES)}.${pick(['smith', 'jones', 'lee', 'chen', 'garcia', 'mueller'])}`,
    () => `svc-${pick(['worker', 'cron', 'pipeline', 'bot', 'sync'])}-${randInt(1, 99)}`,
    () => `team-${pick(DEPARTMENTS)}-${randInt(1, 20)}`,
  ];
  return pick(patterns)();
}

function generateMetadata(appName) {
  const generators = {
    'trading-platform': () => ({
      role: pick(['trader', 'broker', 'auditor']),
      tier: pick(TIERS),
      dailyLimit: pick([1000, 5000, 25000, 50000, 100000]),
      region: pick(REGIONS),
    }),
    'analytics-dashboard': () => ({
      department: pick(DEPARTMENTS),
      accessLevel: pick(['read-only', 'read-write', 'full']),
      dashboards: Array.from({ length: randInt(1, 4) }, () => pick(['revenue', 'users', 'churn', 'funnel', 'cohorts'])),
    }),
    'mobile-app': () => ({
      platform: pick(PLATFORMS),
      appVersion: `${randInt(1, 5)}.${randInt(0, 9)}.${randInt(0, 20)}`,
      pushEnabled: Math.random() > 0.3,
      deviceId: `dev-${randInt(10000, 99999)}`,
    }),
    'partner-portal': () => ({
      company: pick(['Acme Corp', 'Globex Inc', 'Initech Ltd', 'Umbrella Co', 'Stark Industries']),
      partnerTier: pick(['bronze', 'silver', 'gold', 'platinum']),
      contractExpiry: futureDate(30, 365),
    }),
    'internal-tools': () => ({
      department: pick(DEPARTMENTS),
      role: pick(ROLES),
      vpnRequired: Math.random() > 0.5,
    }),
    'customer-support': () => ({
      queue: pick(['general', 'billing', 'technical', 'escalation']),
      maxConcurrentTickets: pick([5, 10, 15, 20]),
      shiftHours: pick(['9-17', '17-01', '01-09']),
    }),
    'notification-service': () => ({
      channels: Array.from({ length: randInt(1, 3) }, () => pick(['email', 'sms', 'push', 'webhook', 'slack'])),
      rateLimit: pick([100, 500, 1000, 5000]),
      priority: pick(['low', 'normal', 'high', 'critical']),
    }),
    'billing-portal': () => ({
      plan: pick(TIERS),
      currency: pick(['USD', 'EUR', 'GBP']),
      invoiceAccess: Math.random() > 0.3,
      paymentMethods: randInt(1, 4),
    }),
    'content-cms': () => ({
      role: pick(['author', 'editor', 'reviewer', 'publisher']),
      categories: Array.from({ length: randInt(1, 3) }, () => pick(['blog', 'docs', 'changelog', 'guides', 'faq'])),
      canPublish: Math.random() > 0.5,
    }),
    'developer-api': () => ({
      tier: pick(TIERS),
      rateLimit: pick([100, 1000, 10000, 50000]),
      scopes: Array.from({ length: randInt(1, 4) }, () => pick(['read', 'write', 'admin', 'webhooks', 'analytics'])),
      sandboxMode: Math.random() > 0.7,
    }),
  };
  const gen = generators[appName];
  return gen ? gen() : { role: pick(ROLES), notes: `Auto-generated for ${appName}` };
}

// ── Seed logic ──────────────────────────────────────────────

let stats = { apps: 0, tokens: 0, metadata: 0, verified: 0, revoked: 0, reissued: 0, errors: 0 };

// Select which apps to use
const appsToUse = APP_POOL.slice(0, Math.min(SEED_APP_COUNT, APP_POOL.length));

// Distribute tokens across apps
function buildImportItems() {
  const items = [];
  const usedIds = new Set();
  for (let i = 0; i < SEED_TOKEN_COUNT; i++) {
    let userId;
    // Ensure unique userId per run
    do { userId = generateUserId(i); } while (usedIds.has(userId));
    usedIds.add(userId);
    const appName = appsToUse[i % appsToUse.length];
    const item = { userId, appName };
    // ~20% get an expiry date
    if (Math.random() < 0.2) {
      item.expiresAt = futureDate(30, 365);
    }
    // ~5% get a past expiry (will be expired on verify)
    if (Math.random() < 0.05) {
      item.expiresAt = pastDate(1, 30);
    }
    items.push(item);
  }
  return items;
}

// Build items for per-app import
function buildPerAppItems(count) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const item = { userId: `perapp-${pick(FIRST_NAMES)}-${randInt(100, 999)}` };
    if (Math.random() < 0.3) {
      item.expiresAt = futureDate(60, 180);
    }
    items.push(item);
  }
  return items;
}

// Build CSV string for CSV import
function buildCsvPayload(appName, count) {
  let csv = 'userId,appName,expiresAt\n';
  for (let i = 0; i < count; i++) {
    const userId = `csv-${pick(FIRST_NAMES)}-${randInt(1000, 9999)}`;
    const expires = Math.random() < 0.3 ? futureDate(30, 180) : '';
    csv += `${userId},${appName},${expires}\n`;
  }
  return csv;
}

// Build items with custom tokens.
// Custom tokens are arbitrary codes (4–64 chars) — no app-name prefix required.
function buildCustomTokenItems(appName) {
  const codes = ['AbCdEfGh12345678', 'MySecretToken9999', 'Partner_Key_00001', 'LongCustomCodeHere01234567890123'];
  return codes.map((code, i) => ({
    userId: `custom-user-${i + 1}`,
    appName,
    token: code,
  }));
}

async function main() {
  console.log('AccessMan Seed Script');
  console.log('=====================');
  console.log(`Server:     ${BASE}`);
  console.log(`Target:     ${SEED_TOKEN_COUNT} tokens across ${SEED_APP_COUNT} apps`);
  console.log();

  // ── 0. Configure token generation settings ─────────────
  // Widen the generated-code length so seeding many tokens never runs out of
  // unique short codes, and exercise the GET/PATCH /settings endpoints.
  console.log('--- Phase 0: Token Generation Settings ---');
  const { data: before } = await api('GET', '/settings', null, tier2Headers());
  console.log(`  Current: codeLength=${before.codeLength}, prefixAppName=${before.prefixAppName}`);
  const { status: setStatus, data: after } = await api(
    'PATCH', '/settings', { codeLength: 12, prefixAppName: false }, tier2Headers(),
  );
  console.log(`  Updated (status ${setStatus}): codeLength=${after.codeLength}, prefixAppName=${after.prefixAppName}`);

  // ── 1. Register apps if needed ──────────────────────────
  console.log('--- Phase 1: Register Apps ---');

  const { data: existingApps } = await api('GET', '/apps', null, tier2Headers());
  const existingNames = new Set((existingApps || []).map((a) => a.name));
  console.log(`  Existing apps: ${existingNames.size} (${[...existingNames].join(', ') || 'none'})`);

  let registeredCount = 0;
  for (const name of appsToUse) {
    if (!existingNames.has(name)) {
      const { status } = await api('POST', '/apps', { name }, tier2Headers());
      if (status === 201) {
        registeredCount++;
        existingNames.add(name);
      } else {
        console.log(`  WARN: Failed to register "${name}" (status ${status})`);
      }
    }
  }
  // If we still need more apps beyond what tokens will auto-create, register them
  const extraAppsNeeded = SEED_APP_COUNT - existingNames.size;
  for (let i = 0; i < extraAppsNeeded; i++) {
    const name = APP_POOL[existingNames.size + i] || `extra-app-${i + 1}`;
    if (!existingNames.has(name)) {
      const { status } = await api('POST', '/apps', { name }, tier2Headers());
      if (status === 201) {
        registeredCount++;
        existingNames.add(name);
      }
    }
  }
  stats.apps = registeredCount;
  console.log(`  Registered ${registeredCount} new apps`);

  // ── 2. Bulk JSON import (POST /api/import) ──────────────
  console.log('\n--- Phase 2: Bulk JSON Import (POST /api/import) ---');

  const bulkItems = buildImportItems();
  const { status: bulkStatus, data: bulkData } = await api('POST', '/import', bulkItems, tier2Headers());
  const bulkImported = bulkData.imported || [];
  const bulkErrors = bulkData.errors || [];
  stats.tokens += bulkImported.length;
  stats.errors += bulkErrors.length;
  console.log(`  Status: ${bulkStatus}`);
  console.log(`  Imported: ${bulkImported.length}, Errors: ${bulkErrors.length}`);
  if (bulkErrors.length > 0) {
    console.log(`  First error: ${JSON.stringify(bulkErrors[0])}`);
  }

  // Keep some tokens for later operations
  const tokenMap = {};
  for (const item of bulkImported) {
    if (!tokenMap[item.appName]) tokenMap[item.appName] = [];
    tokenMap[item.appName].push(item);
  }

  // ── 3. Per-app import (POST /api/import/:appName) ───────
  console.log('\n--- Phase 3: Per-App Import (POST /api/import/:appName) ---');

  const perAppTarget = appsToUse[0];
  const perAppItems = buildPerAppItems(5);
  const { status: paStatus, data: paData } = await api(
    'POST', `/import/${perAppTarget}`, perAppItems, tier2Headers(),
  );
  const paImported = paData.imported || [];
  stats.tokens += paImported.length;
  console.log(`  App: ${perAppTarget}`);
  console.log(`  Status: ${paStatus}, Imported: ${paImported.length}`);

  if (!tokenMap[perAppTarget]) tokenMap[perAppTarget] = [];
  for (const item of paImported) tokenMap[perAppTarget].push(item);

  // ── 4. CSV import (POST /api/import, text/csv) ──────────
  console.log('\n--- Phase 4: CSV Import (POST /api/import) ---');

  const csvAppTarget = appsToUse[1] || appsToUse[0];
  const csvPayload = buildCsvPayload(csvAppTarget, 5);
  const { status: csvStatus, data: csvData } = await api(
    'POST', '/import', csvPayload, tier2Headers('text/csv'),
  );
  const csvImported = csvData.imported || [];
  stats.tokens += csvImported.length;
  console.log(`  App: ${csvAppTarget}`);
  console.log(`  Status: ${csvStatus}, Imported: ${csvImported.length}`);

  if (!tokenMap[csvAppTarget]) tokenMap[csvAppTarget] = [];
  for (const item of csvImported) tokenMap[csvAppTarget].push(item);

  // ── 5. Custom token import ──────────────────────────────
  console.log('\n--- Phase 5: Custom Token Import (POST /api/import) ---');

  const customAppTarget = appsToUse[2] || appsToUse[0];
  const customItems = buildCustomTokenItems(customAppTarget);
  const { status: ctStatus, data: ctData } = await api(
    'POST', '/import', customItems, tier2Headers(),
  );
  const ctImported = ctData.imported || [];
  const ctErrors = ctData.errors || [];
  stats.tokens += ctImported.length;
  stats.errors += ctErrors.length;
  console.log(`  App: ${customAppTarget}`);
  console.log(`  Status: ${ctStatus}, Imported: ${ctImported.length}, Errors: ${ctErrors.length}`);

  if (!tokenMap[customAppTarget]) tokenMap[customAppTarget] = [];
  for (const item of ctImported) tokenMap[customAppTarget].push(item);

  // ── 6. Set metadata on tokens ───────────────────────────
  console.log('\n--- Phase 6: Set Metadata (PATCH /api/tokens/metadata) ---');

  for (const [appName, tokens] of Object.entries(tokenMap)) {
    // Set metadata on ~60% of tokens
    const toMeta = tokens.filter(() => Math.random() < 0.6);
    for (const t of toMeta) {
      const metadata = generateMetadata(appName);
      const { status } = await api(
        'PATCH', '/tokens/metadata',
        { token: t.token, metadata },
        tier1Headers(appName),
      );
      if (status === 200) stats.metadata++;
    }
  }
  console.log(`  Metadata set on ${stats.metadata} tokens`);

  // ── 7. Verify tokens and update metadata ────────────────
  console.log('\n--- Phase 7: Verify + Increment Metadata ---');

  for (const [appName, tokens] of Object.entries(tokenMap)) {
    // Verify ~40% of tokens
    const toVerify = tokens.filter(() => Math.random() < 0.4);
    for (const t of toVerify) {
      const { data: verifyResult } = await api(
        'POST', '/tokens/verify',
        { token: t.token },
        tier1Headers(appName),
      );
      if (verifyResult.valid) {
        stats.verified++;
        // Increment a "verifyCount" field in metadata
        const meta = verifyResult.metadata || {};
        meta.verifyCount = (meta.verifyCount || 0) + 1;
        meta.lastSeedVerify = new Date().toISOString();
        await api(
          'PATCH', '/tokens/metadata',
          { token: t.token, metadata: meta },
          tier1Headers(appName),
        );
      }
    }
  }
  console.log(`  Verified ${stats.verified} tokens (metadata incremented)`);

  // ── 8. List tokens with filters ─────────────────────────
  console.log('\n--- Phase 8: List & Filter Tokens (GET /api/tokens) ---');

  const queries = [
    { label: 'page 1, limit 10', qs: '?page=1&limit=10' },
    { label: `filter by app "${appsToUse[0]}"`, qs: `?appName=${appsToUse[0]}&limit=5` },
    { label: 'sort by userId DESC', qs: '?sortBy=userId&sortOrder=DESC&limit=5' },
    { label: 'status=active', qs: '?status=active&limit=5' },
    { label: 'status=all (includes revoked/expired)', qs: '?status=all&limit=5' },
  ];
  for (const q of queries) {
    const { status, data } = await api('GET', `/tokens${q.qs}`, null, tier2Headers());
    const count = data.data ? data.data.length : 0;
    const total = data.total || '?';
    console.log(`  ${q.label}: status=${status}, returned=${count}, total=${total}`);
  }

  // ── 9. Token detail (GET /api/tokens/:id) ───────────────
  console.log('\n--- Phase 9: Token Detail (GET /api/tokens/:id) ---');

  const { data: firstPage } = await api('GET', '/tokens?limit=3', null, tier2Headers());
  const detailTokens = firstPage.data || [];
  for (const t of detailTokens.slice(0, 3)) {
    const { status, data } = await api('GET', `/tokens/${t.id}`, null, tier2Headers());
    console.log(`  Token #${t.id}: status=${status}, userId=${data.userId}, app=${data.app?.name || '?'}`);
  }

  // ── 10. Revoke some tokens ──────────────────────────────
  console.log('\n--- Phase 10: Revoke Tokens (POST /api/tokens/:id/revoke) ---');

  // Revoke 3 tokens from the list
  const toRevoke = detailTokens.slice(0, 3);
  for (const t of toRevoke) {
    const { status } = await api('POST', `/tokens/${t.id}/revoke`, {}, tier2Headers());
    if (status === 200) stats.revoked++;
    console.log(`  Revoke token #${t.id}: status=${status}`);
  }

  // ── 11. Reissue tokens (POST /api/import/reissue) ───────
  console.log('\n--- Phase 11: Reissue Tokens (POST /api/import/reissue) ---');

  // Reissue for users whose tokens we just revoked
  const reissueItems = toRevoke.map((t) => ({
    userId: t.userId,
    appName: t.app?.name || appsToUse[0],
  }));
  const { status: riStatus, data: riData } = await api(
    'POST', '/import/reissue', reissueItems, tier2Headers(),
  );
  const riImported = riData.imported || [];
  stats.reissued = riImported.length;
  stats.tokens += riImported.length;
  console.log(`  Status: ${riStatus}, Reissued: ${riImported.length}`);

  // Verify a reissued token works
  if (riImported.length > 0) {
    const ri = riImported[0];
    const { data: riVerify } = await api(
      'POST', '/tokens/verify',
      { token: ri.token },
      tier1Headers(ri.appName),
    );
    console.log(`  Verify reissued token: valid=${riVerify.valid}`);
  }

  // ── 12. Verify revoked token is rejected ────────────────
  console.log('\n--- Phase 12: Verify Revoked Token ---');

  if (bulkImported.length > 0) {
    // The first bulk token should have been revoked in phase 10
    // Use the list to find a revoked one
    const { data: revokedList } = await api(
      'GET', '/tokens?status=revoked&limit=1', null, tier2Headers(),
    );
    if (revokedList.data && revokedList.data.length > 0) {
      const revToken = revokedList.data[0];
      console.log(`  Found revoked token #${revToken.id} (userId: ${revToken.userId})`);
      console.log(`  (Cannot verify raw token for revoked — raw is only returned at creation)`);
    } else {
      console.log('  No revoked tokens found in listing');
    }
  }

  // ── 13. List apps ───────────────────────────────────────
  console.log('\n--- Phase 13: List Apps (GET /api/apps) ---');

  const { data: finalApps } = await api('GET', '/apps', null, tier2Headers());
  console.log(`  Total apps: ${finalApps.length}`);
  for (const app of finalApps) {
    console.log(`    - ${app.name} (id: ${app.id}, active: ${app.isActive})`);
  }

  // ── Summary ─────────────────────────────────────────────
  console.log('\n=====================');
  console.log('Seed Summary');
  console.log('=====================');
  console.log(`  Apps registered:      ${stats.apps}`);
  console.log(`  Tokens created:       ${stats.tokens}`);
  console.log(`  Metadata set:         ${stats.metadata}`);
  console.log(`  Tokens verified:      ${stats.verified}`);
  console.log(`  Tokens revoked:       ${stats.revoked}`);
  console.log(`  Tokens reissued:      ${stats.reissued}`);
  console.log(`  Import errors:        ${stats.errors}`);
  console.log(`  Total apps in DB:     ${finalApps.length}`);
  console.log();
  console.log('Done.');
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
