#!/usr/bin/env node
// Tests verify and metadata endpoints using tokens generated during manual testing.
// Uses native fetch (Node 18+). No external dependencies.
//
// Usage:
//   node devkit/test-verify-metadata.js
//
// Expects the server running at localhost:3000 with the default dev .env keys.

const BASE = 'http://localhost:3000/api';
const SECURITY_KEY = 'your-shared-security-key-here';

// Tokens from manual testing (specs/res/ files)
const TOKENS = {
  // Active auto-generated tokens
  aliceTrading: 'trading-bot_7dbd307bc1f9bf8bc992f8caf9f788a6cc43bc2f93ba1cd2d57314f449c9742a',
  bobTrading: 'trading-bot_04f886760be49cb1fb92545d7d19352593e95e836af5ac0b5626256a8d5c3c96',
  charlieAnalytics: 'analytics-dash_b029c81b6f724b921709cafdade8a116051f878b9b0c600925b6b49897ac69b3',
  frankNotify: 'notification-svc_4b0d08d5bff59012cac7dfef5bc14f25668e71ba30a27015e4180a0424445926',
  judyPipeline: 'data-pipeline_a2890c9d67e6740b992d36641f249a8ffe5353e07ab1e52ff12918df2dc2ac9b',
  ivanOracle: 'pm-oracle_2bd7a0f912cdc8dfad20e06b44ed974ccb25c6dc4c84a8ddf332c044a8d25247',

  // Active custom tokens
  custBobDash: 'analytics-dash_BobDashboardToken99',
  custCharlieOracle: 'pm-oracle_CharlieOracleAccess',
  custAliceReissued: 'trading-bot_ReissuedAliceKey02',
  custEveGateway: 'auth-gateway_EveGatewayPassKey',

  // Expired token
  expired1: 'trading-bot_211ad43e482f179e7a72e802272157ca64cb7a851daddbec820faa0f161a4e1d',

  // Revoked token (bob's original before reissue)
  revokedBob: 'trading-bot_0c5f047fcf559073319b9cbf2ec5aa3be5a04551202ea4f3f95892805a9fbb3e',
};

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

async function api(method, path, body, appName) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Security': SECURITY_KEY,
    'X-App-Name': appName,
  };
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}

async function verify(token, appName) {
  return api('POST', '/tokens/verify', { token }, appName);
}

async function updateMetadata(token, metadata, appName) {
  return api('PATCH', '/tokens/metadata', { token, metadata }, appName);
}

// ─── Test suites ────────────────────────────────────────────

async function testVerifyActive() {
  console.log('\n--- Verify Active Tokens ---');

  const cases = [
    { name: 'alice (trading-bot, auto)', token: TOKENS.aliceTrading, app: 'trading-bot', userId: 'alice' },
    { name: 'bob (trading-bot, reissued)', token: TOKENS.bobTrading, app: 'trading-bot', userId: 'bob' },
    { name: 'charlie (analytics-dash, reissued)', token: TOKENS.charlieAnalytics, app: 'analytics-dash', userId: 'charlie' },
    { name: 'frank (notification-svc)', token: TOKENS.frankNotify, app: 'notification-svc', userId: 'frank' },
    { name: 'judy (data-pipeline)', token: TOKENS.judyPipeline, app: 'data-pipeline', userId: 'judy' },
    { name: 'ivan (pm-oracle, reimported)', token: TOKENS.ivanOracle, app: 'pm-oracle', userId: 'ivan' },
    { name: 'cust-bob (analytics-dash, custom)', token: TOKENS.custBobDash, app: 'analytics-dash', userId: 'cust-bob' },
    { name: 'cust-charlie (pm-oracle, custom)', token: TOKENS.custCharlieOracle, app: 'pm-oracle', userId: 'cust-charlie' },
    { name: 'cust-alice (trading-bot, reissued custom)', token: TOKENS.custAliceReissued, app: 'trading-bot', userId: 'cust-alice' },
    { name: 'cust-eve (auth-gateway, custom)', token: TOKENS.custEveGateway, app: 'auth-gateway', userId: 'cust-eve' },
  ];

  for (const c of cases) {
    const { data } = await verify(c.token, c.app);
    assert(data.valid === true, `${c.name} → valid`);
    assert(data.userId === c.userId, `${c.name} → userId=${c.userId}`);
    assert(data.appName === c.app, `${c.name} → appName=${c.app}`);
  }
}

async function testVerifyInvalid() {
  console.log('\n--- Verify Invalid Tokens ---');

  // Expired
  const { data: expired } = await verify(TOKENS.expired1, 'trading-bot');
  assert(expired.valid === false, 'expired token → not valid');
  assert(expired.reason === 'expired', 'expired token → reason=expired');

  // Revoked
  const { data: revoked } = await verify(TOKENS.revokedBob, 'trading-bot');
  assert(revoked.valid === false, 'revoked token → not valid');
  assert(revoked.reason === 'revoked', 'revoked token → reason=revoked');

  // Nonexistent
  const fakeToken = 'trading-bot_0000000000000000000000000000000000000000000000000000000000000000';
  const { data: notFound } = await verify(fakeToken, 'trading-bot');
  assert(notFound.valid === false, 'fake token → not valid');
  assert(notFound.reason === 'not_found', 'fake token → reason=not_found');

  // Wrong app (token is trading-bot, verify as analytics-dash)
  const { data: wrongApp } = await verify(TOKENS.aliceTrading, 'analytics-dash');
  assert(wrongApp.valid === false, 'wrong app → not valid');
  assert(wrongApp.reason === 'not_found', 'wrong app → reason=not_found');
}

async function testMetadataUpdate() {
  console.log('\n--- Metadata Update ---');

  // Set metadata on judy's data-pipeline token
  const meta1 = { role: 'analyst', permissions: ['read', 'export'], dailyLimit: 1000 };
  const { data: up1 } = await updateMetadata(TOKENS.judyPipeline, meta1, 'data-pipeline');
  assert(up1.success === true, 'judy metadata update → success');

  // Verify it comes back
  const { data: v1 } = await verify(TOKENS.judyPipeline, 'data-pipeline');
  assert(v1.valid === true, 'judy verify after metadata → valid');
  assert(v1.metadata.role === 'analyst', 'judy metadata → role=analyst');
  assert(Array.isArray(v1.metadata.permissions), 'judy metadata → permissions is array');
  assert(v1.metadata.dailyLimit === 1000, 'judy metadata → dailyLimit=1000');

  // Overwrite (full replace)
  const meta2 = { role: 'senior-analyst', upgraded: true };
  const { data: up2 } = await updateMetadata(TOKENS.judyPipeline, meta2, 'data-pipeline');
  assert(up2.success === true, 'judy metadata overwrite → success');

  const { data: v2 } = await verify(TOKENS.judyPipeline, 'data-pipeline');
  assert(v2.metadata.role === 'senior-analyst', 'judy metadata after overwrite → role changed');
  assert(v2.metadata.upgraded === true, 'judy metadata after overwrite → upgraded=true');
  assert(v2.metadata.permissions === undefined, 'judy metadata after overwrite → permissions gone (full replace)');

  // Set metadata on custom token
  const custMeta = { plan: 'enterprise', seats: 25 };
  const { data: up3 } = await updateMetadata(TOKENS.custBobDash, custMeta, 'analytics-dash');
  assert(up3.success === true, 'cust-bob metadata update → success');

  const { data: v3 } = await verify(TOKENS.custBobDash, 'analytics-dash');
  assert(v3.metadata.plan === 'enterprise', 'cust-bob metadata → plan=enterprise');
  assert(v3.metadata.seats === 25, 'cust-bob metadata → seats=25');

  // Set empty metadata (reset)
  const { data: up4 } = await updateMetadata(TOKENS.custEveGateway, {}, 'auth-gateway');
  assert(up4.success === true, 'cust-eve empty metadata → success');
  const { data: v4 } = await verify(TOKENS.custEveGateway, 'auth-gateway');
  assert(Object.keys(v4.metadata).length === 0, 'cust-eve metadata → empty object');
}

async function testMetadataReject() {
  console.log('\n--- Metadata Rejection ---');

  // Expired token
  const { status: s1 } = await updateMetadata(TOKENS.expired1, { x: 1 }, 'trading-bot');
  assert(s1 === 400, 'metadata on expired token → 400');

  // Revoked token
  const { status: s2 } = await updateMetadata(TOKENS.revokedBob, { x: 1 }, 'trading-bot');
  assert(s2 === 400, 'metadata on revoked token → 400');

  // Wrong app
  const { status: s3, data: d3 } = await updateMetadata(TOKENS.aliceTrading, { x: 1 }, 'analytics-dash');
  assert(s3 === 400 || s3 === 404, `metadata wrong app → ${s3} (rejected)`);
}

async function testLastVerifiedAt() {
  console.log('\n--- lastVerifiedAt Update ---');

  // Verify frank's token twice, check that the operator detail shows lastVerifiedAt
  await verify(TOKENS.frankNotify, 'notification-svc');
  await verify(TOKENS.frankNotify, 'notification-svc');

  // Check via operator endpoint (requires tier 2 headers)
  const res = await fetch(`${BASE}/tokens?userId=frank&appName=notification-svc`, {
    headers: {
      'X-Security': SECURITY_KEY,
      'X-App-Name': 'am-panel',
      'X-Operator-Key': 'your-operator-level-key-here',
    },
  });
  const { data } = await res.json();
  const token = data[0];
  assert(token.lastVerifiedAt !== null, `frank lastVerifiedAt is set: ${token.lastVerifiedAt}`);
}

// ─── Main ───────────────────────────────────────────────────

async function main() {
  console.log('AccessMan Verify & Metadata Test Script');
  console.log('=======================================');

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
