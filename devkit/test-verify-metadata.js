#!/usr/bin/env node
// Self-provisioning test for verify, metadata, and lastVerifiedAt endpoints.
// Creates its own tokens via the import API, then tests against them.
// Uses native fetch (Node 18+). No external dependencies.
//
// Usage:
//   node devkit/test-verify-metadata.js
//
// Reads config from devkit/.env (or env vars). Expects the server running.

const { readFileSync } = require('fs');
const { resolve } = require('path');

// Load devkit/.env if present
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

// Unique prefix so tests don't collide with existing data
const RUN_ID = `vm-${Date.now().toString(36)}`;
const APP_NAME = `${RUN_ID}-app`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${message}`);
  } else {
    failed++;
    console.error(`  FAIL: ${message}`);
  }
}

// Tier 1 headers (verify, metadata)
function tier1Headers(appName) {
  return {
    'Content-Type': 'application/json',
    'X-Security': SECURITY_KEY,
    'X-App-Name': appName,
  };
}

// Tier 2 headers (operator endpoints)
function tier2Headers() {
  return {
    'Content-Type': 'application/json',
    'X-Security': SECURITY_KEY,
    'X-App-Name': ADMIN_APP,
    'X-Operator-Key': OPERATOR_KEY,
  };
}

async function api(method, path, body, headers) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function verify(token, appName) {
  return api('POST', '/tokens/verify', { token }, tier1Headers(appName));
}

async function updateMetadata(token, metadata, appName) {
  return api('PATCH', '/tokens/metadata', { token, metadata }, tier1Headers(appName));
}

// ─── Setup: provision test tokens ──────────────────────────

const TOKENS = {};

async function setup() {
  console.log(`\n--- Setup (run: ${RUN_ID}) ---`);

  // Import tokens: active, with-expiry, custom, and one to revoke later
  const pastDate = new Date(Date.now() - 86400000).toISOString(); // yesterday
  const futureDate = new Date(Date.now() + 86400000 * 365).toISOString(); // +1 year

  const items = [
    { userId: `${RUN_ID}-alice`, appName: APP_NAME },
    { userId: `${RUN_ID}-bob`, appName: APP_NAME, expiresAt: futureDate },
    { userId: `${RUN_ID}-charlie`, appName: APP_NAME, token: `${APP_NAME}_CustomCharlie01` },
    { userId: `${RUN_ID}-expired`, appName: APP_NAME, expiresAt: pastDate },
    { userId: `${RUN_ID}-revokeme`, appName: APP_NAME },
    { userId: `${RUN_ID}-frank`, appName: APP_NAME },
    { userId: `${RUN_ID}-meta`, appName: APP_NAME },
  ];

  const { status, data } = await api('POST', '/import', items, tier2Headers());
  if (status !== 201 || !data.imported) {
    console.error('Setup failed: could not import tokens', status, data);
    process.exit(1);
  }

  // Map userId → raw token
  for (const item of data.imported) {
    const shortId = item.userId.replace(`${RUN_ID}-`, '');
    TOKENS[shortId] = item.token;
  }

  // Revoke the revokeme token
  const listRes = await api(
    'GET',
    `/tokens?userId=${RUN_ID}-revokeme&appName=${APP_NAME}`,
    null,
    tier2Headers(),
  );
  if (listRes.data.data && listRes.data.data.length > 0) {
    const tokenId = listRes.data.data[0].id;
    await api('POST', `/tokens/${tokenId}/revoke`, {}, tier2Headers());
  }

  const names = Object.keys(TOKENS);
  console.log(`  Provisioned ${names.length} tokens: ${names.join(', ')}`);
  assert(names.length === items.length, `all ${items.length} tokens imported`);
}

// ─── Test suites ────────────────────────────────────────────

async function testVerifyActive() {
  console.log('\n--- Verify Active Tokens ---');

  for (const [name, userId] of [
    ['alice', `${RUN_ID}-alice`],
    ['bob', `${RUN_ID}-bob`],
    ['charlie', `${RUN_ID}-charlie`],
  ]) {
    const { data } = await verify(TOKENS[name], APP_NAME);
    assert(data.valid === true, `${name} → valid`);
    assert(data.userId === userId, `${name} → userId=${userId}`);
    assert(data.appName === APP_NAME, `${name} → appName=${APP_NAME}`);
  }
}

async function testVerifyInvalid() {
  console.log('\n--- Verify Invalid Tokens ---');

  // Expired
  const { data: expired } = await verify(TOKENS.expired, APP_NAME);
  assert(expired.valid === false, 'expired token → not valid');
  assert(expired.reason === 'expired', 'expired token → reason=expired');

  // Revoked
  const { data: revoked } = await verify(TOKENS.revokeme, APP_NAME);
  assert(revoked.valid === false, 'revoked token → not valid');
  assert(revoked.reason === 'revoked', 'revoked token → reason=revoked');

  // Nonexistent
  const fakeToken = `${APP_NAME}_0000000000000000000000000000000000000000000000000000000000000000`;
  const { data: notFound } = await verify(fakeToken, APP_NAME);
  assert(notFound.valid === false, 'fake token → not valid');
  assert(notFound.reason === 'not_found', 'fake token → reason=not_found');

  // Wrong app (guard rejects with 403 before reaching verify logic)
  const { status: wrongAppStatus } = await verify(TOKENS.alice, 'nonexistent-app');
  assert(wrongAppStatus === 403, `wrong app → 403 (got ${wrongAppStatus})`);
}

async function testMetadataUpdate() {
  console.log('\n--- Metadata Update ---');

  // Set metadata
  const meta1 = { role: 'analyst', permissions: ['read', 'export'], dailyLimit: 1000 };
  const { data: up1 } = await updateMetadata(TOKENS.meta, meta1, APP_NAME);
  assert(up1.success === true, 'metadata update → success');

  // Verify it comes back
  const { data: v1 } = await verify(TOKENS.meta, APP_NAME);
  assert(v1.valid === true, 'verify after metadata → valid');
  assert(v1.metadata.role === 'analyst', 'metadata → role=analyst');
  assert(Array.isArray(v1.metadata.permissions), 'metadata → permissions is array');
  assert(v1.metadata.dailyLimit === 1000, 'metadata → dailyLimit=1000');

  // Overwrite (full replace)
  const meta2 = { role: 'senior-analyst', upgraded: true };
  const { data: up2 } = await updateMetadata(TOKENS.meta, meta2, APP_NAME);
  assert(up2.success === true, 'metadata overwrite → success');

  const { data: v2 } = await verify(TOKENS.meta, APP_NAME);
  assert(v2.metadata.role === 'senior-analyst', 'after overwrite → role changed');
  assert(v2.metadata.upgraded === true, 'after overwrite → upgraded=true');
  assert(v2.metadata.permissions === undefined, 'after overwrite → permissions gone (full replace)');

  // Set metadata on custom token
  const custMeta = { plan: 'enterprise', seats: 25 };
  const { data: up3 } = await updateMetadata(TOKENS.charlie, custMeta, APP_NAME);
  assert(up3.success === true, 'custom token metadata → success');

  const { data: v3 } = await verify(TOKENS.charlie, APP_NAME);
  assert(v3.metadata.plan === 'enterprise', 'custom token → plan=enterprise');
  assert(v3.metadata.seats === 25, 'custom token → seats=25');

  // Set empty metadata (reset)
  const { data: up4 } = await updateMetadata(TOKENS.alice, {}, APP_NAME);
  assert(up4.success === true, 'empty metadata → success');
  const { data: v4 } = await verify(TOKENS.alice, APP_NAME);
  assert(Object.keys(v4.metadata).length === 0, 'empty metadata → empty object');
}

async function testMetadataReject() {
  console.log('\n--- Metadata Rejection ---');

  // Expired token
  const { status: s1 } = await updateMetadata(TOKENS.expired, { x: 1 }, APP_NAME);
  assert(s1 === 400, `metadata on expired token → ${s1} (expected 400)`);

  // Revoked token
  const { status: s2 } = await updateMetadata(TOKENS.revokeme, { x: 1 }, APP_NAME);
  assert(s2 === 400, `metadata on revoked token → ${s2} (expected 400)`);

  // Wrong app (guard rejects with 403)
  const { status: s3 } = await updateMetadata(TOKENS.alice, { x: 1 }, 'nonexistent-app');
  assert(s3 === 403, `metadata wrong app → ${s3} (expected 403)`);
}

async function testLastVerifiedAt() {
  console.log('\n--- lastVerifiedAt Update ---');

  // Verify frank's token twice
  const v1 = await verify(TOKENS.frank, APP_NAME);
  assert(v1.data.valid === true, 'frank verify 1 → valid');
  const v2 = await verify(TOKENS.frank, APP_NAME);
  assert(v2.data.valid === true, 'frank verify 2 → valid');

  // Check via operator list endpoint
  const listRes = await api(
    'GET',
    `/tokens?userId=${RUN_ID}-frank&appName=${APP_NAME}`,
    null,
    tier2Headers(),
  );
  const token = listRes.data.data[0];
  assert(token.lastVerifiedAt !== null, `frank lastVerifiedAt is set: ${token.lastVerifiedAt}`);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('AccessMan Verify & Metadata Test Script');
  console.log('=======================================');
  console.log(`Server: ${BASE}`);

  await setup();
  await testVerifyActive();
  await testVerifyInvalid();
  await testMetadataUpdate();
  await testMetadataReject();
  await testLastVerifiedAt();

  console.log('\n=======================================');
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
