/**
 * E2E Tests for AccessMan
 *
 * Prerequisites:
 * - PostgreSQL running locally
 * - Database "accessman_test" must exist:
 *     CREATE DATABASE accessman_test;
 *
 * Run: npm run test:e2e
 */
import { createHash, randomBytes, randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppsModule } from '../src/apps/apps.module';
import { TokensModule } from '../src/tokens/tokens.module';
import { ImportModule } from '../src/import/import.module';
import { AppEntity } from '../src/apps/app.entity';
import { TokenEntity } from '../src/tokens/token.entity';
import securityConfig from '../src/config/security.config';
import tokenConfig from '../src/config/token.config';

const SECURITY_KEY = 'test-security-key-e2e-12345';
const OPERATOR_KEY = 'test-operator-key-e2e-12345';
const ADMIN_APP = 'am-panel';

jest.setTimeout(30000);

describe('AccessMan E2E', () => {
  let app: NestFastifyApplication;
  let dataSource: DataSource;

  const operatorHeaders = {
    'x-security': SECURITY_KEY,
    'x-app-name': ADMIN_APP,
    'x-operator-key': OPERATOR_KEY,
  };

  function tier1Headers(appName: string) {
    return {
      'x-security': SECURITY_KEY,
      'x-app-name': appName,
    };
  }

  async function cleanDb() {
    await dataSource.query('DELETE FROM "tokens"');
    await dataSource.query('DELETE FROM "apps"');
  }

  async function seedAdminApp() {
    await dataSource.query(
      `INSERT INTO "apps" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
      [ADMIN_APP],
    );
  }

  async function importToken(userId: string, appName: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/import',
      headers: { ...operatorHeaders, 'content-type': 'application/json' },
      payload: [{ userId, appName }],
    });
    const body = JSON.parse(res.payload);
    return body.imported[0].token;
  }

  beforeAll(async () => {
    process.env.SECURITY_KEY = SECURITY_KEY;
    process.env.OPERATOR_KEY = OPERATOR_KEY;
    process.env.ADMIN_APP_NAME = ADMIN_APP;
    process.env.DEFAULT_TOKEN_EXPIRY_DAYS = '365';

    const moduleFixture = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [securityConfig, tokenConfig],
        }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url:
            process.env.DATABASE_TEST_URL ||
            'postgresql://postgres:postgres@localhost:5432/accessman_test',
          entities: [AppEntity, TokenEntity],
          synchronize: true,
          dropSchema: true,
        }),
        AppsModule,
        TokensModule,
        ImportModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );

    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');

    app
      .getHttpAdapter()
      .getInstance()
      .addContentTypeParser(
        'text/csv',
        { parseAs: 'string' },
        (_req: any, body: string, done: (err: null, body: string) => void) => {
          done(null, body);
        },
      );

    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Security Guards ────────────────────────────────────────────────

  describe('Security Guards', () => {
    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('no X-Security header → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: { 'x-app-name': ADMIN_APP },
        payload: { token: 'x', userId: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('wrong X-Security value → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: { 'x-security': 'wrong-key', 'x-app-name': ADMIN_APP },
        payload: { token: 'x', userId: 'x' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('unregistered app name → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: {
          'x-security': SECURITY_KEY,
          'x-app-name': 'nonexistent-app',
        },
        payload: { token: 'x', userId: 'x' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('inactive app → 403', async () => {
      await dataSource.query(
        `INSERT INTO "apps" ("name", "is_active") VALUES ('inactive-app', false) ON CONFLICT DO NOTHING`,
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: {
          'x-security': SECURITY_KEY,
          'x-app-name': 'inactive-app',
        },
        payload: { token: 'x', userId: 'x' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('operator endpoint without X-Operator-Key → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: tier1Headers(ADMIN_APP),
        payload: [{ userId: 'u', appName: 'a' }],
      });
      expect(res.statusCode).toBe(403);
    });

    it('operator endpoint with wrong X-Operator-Key → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: {
          ...tier1Headers(ADMIN_APP),
          'x-operator-key': 'wrong-op-key',
        },
        payload: [{ userId: 'u', appName: 'a' }],
      });
      expect(res.statusCode).toBe(403);
    });

    it('operator endpoint with non-admin app name → 403', async () => {
      // Create a non-admin app
      await dataSource.query(
        `INSERT INTO "apps" ("name") VALUES ('regular-app') ON CONFLICT DO NOTHING`,
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: {
          'x-security': SECURITY_KEY,
          'x-app-name': 'regular-app',
          'x-operator-key': OPERATOR_KEY,
        },
        payload: [{ userId: 'u', appName: 'a' }],
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /api/import ───────────────────────────────────────────────

  describe('POST /api/import', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('JSON body → successful import with tokens returned', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [
          { userId: 'user1', appName: 'testapp' },
          { userId: 'user2', appName: 'testapp' },
        ],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(2);
      expect(body.errors).toHaveLength(0);
      expect(body.imported[0].token).toMatch(/^testapp_[0-9a-f]{64}$/);
      expect(body.imported[0].userId).toBe('user1');
    });

    it('CSV body → successful import', async () => {
      const csv = 'userId,appName\nuser1,csvapp\nuser2,csvapp';
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'text/csv' },
        payload: csv,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(2);
    });

    it('duplicate userId+appName (active) → in errors[]', async () => {
      // First import
      await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'dupapp' }],
      });

      // Second import — same user+app
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'dupapp' }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(0);
      expect(body.errors).toHaveLength(1);
      expect(body.errors[0].reason).toContain('already exists');
    });

    it('duplicate userId+appName (revoked) → new token issued', async () => {
      // Import
      const token = await importToken('user1', 'revapp');

      // Revoke by setting revokedAt directly
      const hash = createHash('sha256').update(token).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "revoked_at" = NOW() WHERE "token_hash" = $1`,
        [hash],
      );

      // Re-import same user+app
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'revapp' }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.errors).toHaveLength(0);

      // Verify revoked token is still in DB
      const tokens = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1'`,
      );
      expect(tokens).toHaveLength(2); // revoked + new active
      expect(tokens.filter((t: any) => t.revoked_at !== null)).toHaveLength(1);
      expect(tokens.filter((t: any) => t.revoked_at === null)).toHaveLength(1);
    });

    it('invalid body format → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: { userId: 'user1', appName: 'app' }, // not an array
      });

      expect(res.statusCode).toBe(400);
    });

    it('missing operator headers → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: tier1Headers(ADMIN_APP),
        payload: [{ userId: 'user1', appName: 'app' }],
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /api/import/:appName ──────────────────────────────────────

  describe('POST /api/import/:appName', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('valid per-app import → appName inferred from URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/perapp',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1' }, { userId: 'user2' }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(2);
      expect(body.imported[0].appName).toBe('perapp');
      expect(body.imported[0].token).toMatch(/^perapp_/);
    });

    it('invalid items → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/perapp',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: '' }], // empty userId
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/import/reissue ───────────────────────────────────────

  describe('POST /api/import/reissue', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('active token exists → old revoked, new issued', async () => {
      // Import first
      const oldToken = await importToken('user1', 'reapp');

      // Reissue
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'reapp' }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      const newToken = body.imported[0].token;
      expect(newToken).not.toBe(oldToken);

      // Verify old token is revoked
      const hash = createHash('sha256').update(oldToken).digest('hex');
      const oldRecord = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "token_hash" = $1`,
        [hash],
      );
      expect(oldRecord[0].revoked_at).not.toBeNull();
    });

    it('no existing token → normal import', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'newuser', appName: 'reapp' }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.errors).toHaveLength(0);
    });

    it('invalid items → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: '' }], // missing appName, empty userId
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── POST /api/tokens/verify ────────────────────────────────────────

  describe('POST /api/tokens/verify', () => {
    let rawToken: string;
    const testApp = 'verifyapp';

    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
      rawToken = await importToken('user1', testApp);
    });

    it('valid token + userId → 200 with token details', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: rawToken, userId: 'user1' },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(true);
      expect(body.userId).toBe('user1');
      expect(body.appName).toBe(testApp);
      expect(body.metadata).toEqual({});
      expect(body.expiresAt).toBeDefined();
    });

    it('wrong userId → valid: false', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: rawToken, userId: 'wrong-user' },
      });

      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('not_found');
    });

    it('expired token → valid: false, reason: expired', async () => {
      // Import a token then expire it
      const expToken = await importToken('expuser', testApp);
      const hash = createHash('sha256').update(expToken).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "expires_at" = '2020-01-01' WHERE "token_hash" = $1`,
        [hash],
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: expToken, userId: 'expuser' },
      });

      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('expired');
    });

    it('revoked token → valid: false, reason: revoked', async () => {
      const revToken = await importToken('revuser', testApp);
      const hash = createHash('sha256').update(revToken).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "revoked_at" = NOW() WHERE "token_hash" = $1`,
        [hash],
      );

      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: revToken, userId: 'revuser' },
      });

      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('revoked');
    });

    it('non-existent token → valid: false, reason: not_found', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: {
          token: `${testApp}_${'a'.repeat(64)}`,
          userId: 'user1',
        },
      });

      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('not_found');
    });

    it('missing body fields → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: 'x' }, // missing userId
      });

      expect(res.statusCode).toBe(400);
    });

    it('missing security headers → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        payload: { token: rawToken, userId: 'user1' },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── PATCH /api/tokens/metadata ─────────────────────────────────────

  describe('PATCH /api/tokens/metadata', () => {
    let rawToken: string;
    const testApp = 'metaapp';

    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
      rawToken = await importToken('user1', testApp);
    });

    it('valid token + metadata → 200 success', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers(testApp),
        payload: { token: rawToken, metadata: { plan: 'pro' } },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
    });

    it('metadata is replaced on re-verification', async () => {
      // Verify to check metadata
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(testApp),
        payload: { token: rawToken, userId: 'user1' },
      });

      const body = JSON.parse(res.payload);
      expect(body.metadata).toEqual({ plan: 'pro' });
    });

    it('revoked token → rejected', async () => {
      const revToken = await importToken('revmeta', testApp);
      const hash = createHash('sha256').update(revToken).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "revoked_at" = NOW() WHERE "token_hash" = $1`,
        [hash],
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers(testApp),
        payload: { token: revToken, metadata: { x: 1 } },
      });

      expect(res.statusCode).toBe(400);
    });

    it('expired token → rejected', async () => {
      const expToken = await importToken('expmeta', testApp);
      const hash = createHash('sha256').update(expToken).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "expires_at" = '2020-01-01' WHERE "token_hash" = $1`,
        [hash],
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers(testApp),
        payload: { token: expToken, metadata: { x: 1 } },
      });

      expect(res.statusCode).toBe(400);
    });

    it('missing body fields → 400', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers(testApp),
        payload: { token: rawToken }, // missing metadata
      });

      expect(res.statusCode).toBe(400);
    });

    it('missing security headers → 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        payload: { token: rawToken, metadata: {} },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ─── GET /api/apps ─────────────────────────────────────────────────

  describe('GET /api/apps', () => {
    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
      // Import tokens to auto-register apps
      await importToken('user1', 'alpha-app');
      await importToken('user2', 'beta-app');
    });

    it('returns list of apps including auto-registered', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/apps',
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toBeInstanceOf(Array);
      const names = body.map((a: any) => a.name);
      expect(names).toContain('alpha-app');
      expect(names).toContain('beta-app');
      expect(names).toContain(ADMIN_APP);
    });

    it('without operator headers → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/apps',
        headers: tier1Headers(ADMIN_APP),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /api/apps ────────────────────────────────────────────────

  describe('POST /api/apps', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('creates a new app successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apps',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: { name: 'brand-new-app' },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.name).toBe('brand-new-app');
      expect(body.id).toBeDefined();
      expect(body.isActive).toBe(true);
    });

    it('duplicate name → 409', async () => {
      // Create first
      await app.inject({
        method: 'POST',
        url: '/api/apps',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: { name: 'dup-app' },
      });

      // Create duplicate
      const res = await app.inject({
        method: 'POST',
        url: '/api/apps',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: { name: 'dup-app' },
      });

      expect(res.statusCode).toBe(409);
    });

    it('missing name → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apps',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('without operator headers → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apps',
        headers: tier1Headers(ADMIN_APP),
        payload: { name: 'test' },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET /api/tokens (admin list) ─────────────────────────────────

  describe('GET /api/tokens', () => {
    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
      await importToken('user1', 'listapp');
      await importToken('user2', 'listapp');
      await importToken('user3', 'otherapp');
    });

    it('returns paginated list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens',
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data).toBeInstanceOf(Array);
      expect(body.total).toBe(3);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(50);
    });

    it('filter by appName', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?appName=listapp',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.total).toBe(2);
      body.data.forEach((t: any) => expect(t.app.name).toBe('listapp'));
    });

    it('filter by userId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?userId=user3',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.total).toBe(1);
      expect(body.data[0].userId).toBe('user3');
    });

    it('filter by status=active', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?status=active',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.total).toBe(3);
    });

    it('pagination works', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?page=1&limit=2',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(2);
      expect(body.total).toBe(3);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(2);
    });

    it('without operator headers → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens',
        headers: tier1Headers(ADMIN_APP),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET /api/tokens/:id ──────────────────────────────────────────

  describe('GET /api/tokens/:id', () => {
    let tokenId: number;

    beforeAll(async () => {
      await cleanDb();
      await seedAdminApp();
      await importToken('user1', 'detailapp');

      const rows = await dataSource.query(
        `SELECT id FROM "tokens" WHERE "user_id" = 'user1' LIMIT 1`,
      );
      tokenId = rows[0].id;
    });

    it('returns token detail with computed status', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tokens/${tokenId}`,
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.id).toBe(tokenId);
      expect(body.status).toBe('active');
      expect(body.userId).toBe('user1');
      expect(body.app.name).toBe('detailapp');
      expect(body.tokenPrefix).toBeDefined();
    });

    it('non-existent id → 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens/999999',
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(404);
    });

    it('without operator headers → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/tokens/${tokenId}`,
        headers: tier1Headers(ADMIN_APP),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── POST /api/tokens/:id/revoke ──────────────────────────────────

  describe('POST /api/tokens/:id/revoke', () => {
    let tokenId: number;
    let rawToken: string;

    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
      rawToken = await importToken('user1', 'revokeapp');

      const rows = await dataSource.query(
        `SELECT id FROM "tokens" WHERE "user_id" = 'user1' LIMIT 1`,
      );
      tokenId = rows[0].id;
    });

    it('revokes an active token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/tokens/${tokenId}/revoke`,
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.revokedAt).toBeDefined();

      // Verify token no longer valid
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('revokeapp'),
        payload: { token: rawToken, userId: 'user1' },
      });
      const verifyBody = JSON.parse(verifyRes.payload);
      expect(verifyBody.valid).toBe(false);
      expect(verifyBody.reason).toBe('revoked');
    });

    it('already revoked → 400', async () => {
      // Revoke first
      await app.inject({
        method: 'POST',
        url: `/api/tokens/${tokenId}/revoke`,
        headers: operatorHeaders,
      });

      // Revoke again
      const res = await app.inject({
        method: 'POST',
        url: `/api/tokens/${tokenId}/revoke`,
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(400);
    });

    it('non-existent token → 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/999999/revoke',
        headers: operatorHeaders,
      });

      expect(res.statusCode).toBe(404);
    });

    it('without operator headers → 403', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/tokens/${tokenId}/revoke`,
        headers: tier1Headers(ADMIN_APP),
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── Custom Token Import ────────────────────────────────────────────

  describe('Custom Token Import', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('import with custom token via JSON → token is returned and verifiable', async () => {
      const customToken = 'mtapp_CustomToken12345678';
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'mtapp', token: customToken }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.imported[0].token).toBe(customToken);

      // Verify it works
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('mtapp'),
        payload: { token: customToken, userId: 'user1' },
      });
      const verifyBody = JSON.parse(verifyRes.payload);
      expect(verifyBody.valid).toBe(true);
      expect(verifyBody.userId).toBe('user1');
    });

    it('import with custom token via CSV → token works', async () => {
      const customToken = 'csvmt_CustomCSVToken1234';
      const csv = `userId,appName,token\nuser1,csvmt,${customToken}`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'text/csv' },
        payload: csv,
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.imported[0].token).toBe(customToken);

      // Verify
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('csvmt'),
        payload: { token: customToken, userId: 'user1' },
      });
      expect(JSON.parse(verifyRes.payload).valid).toBe(true);
    });

    it('per-app import with custom token → prefix must match URL appName', async () => {
      const customToken = 'permt_ValidPerAppToken1';
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/permt',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', token: customToken }],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.imported[0].token).toBe(customToken);

      // Mismatched prefix
      const badRes = await app.inject({
        method: 'POST',
        url: '/api/import/permt',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user2', token: 'wrongapp_SomeToken123' }],
      });
      const badBody = JSON.parse(badRes.payload);
      expect(badBody.errors).toHaveLength(1);
      expect(badBody.errors[0].reason).toContain('does not match');
    });

    it('reissue with custom token → old revoked, new custom token verifiable', async () => {
      const oldToken = await importToken('user1', 'reimt');

      const customToken = 'reimt_ReissueCustomTok1';
      const res = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [
          { userId: 'user1', appName: 'reimt', token: customToken },
        ],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      expect(body.imported[0].token).toBe(customToken);

      // Old token is revoked
      const oldRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('reimt'),
        payload: { token: oldToken, userId: 'user1' },
      });
      expect(JSON.parse(oldRes.payload).valid).toBe(false);

      // New custom token works
      const newRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('reimt'),
        payload: { token: customToken, userId: 'user1' },
      });
      expect(JSON.parse(newRes.payload).valid).toBe(true);
    });

    it('invalid custom token format → proper error response', async () => {
      // Too short code
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'fmtapp', token: 'fmtapp_short' }],
      });
      const body1 = JSON.parse(res1.payload);
      expect(body1.errors).toHaveLength(1);
      expect(body1.errors[0].reason).toContain('8-64 characters');

      // Wrong prefix
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user2', appName: 'fmtapp', token: 'wrong_ValidCode1234' }],
      });
      const body2 = JSON.parse(res2.payload);
      expect(body2.errors).toHaveLength(1);
      expect(body2.errors[0].reason).toContain('does not match');
    });

    it('duplicate custom token → proper error response', async () => {
      const customToken = 'dupmt_DuplicateCustomTok';

      // First import succeeds
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'dupmt', token: customToken }],
      });
      expect(JSON.parse(res1.payload).imported).toHaveLength(1);

      // Same token for different user → hash collision
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user2', appName: 'dupmt', token: customToken }],
      });
      const body2 = JSON.parse(res2.payload);
      expect(body2.errors).toHaveLength(1);
      expect(body2.errors[0].reason).toContain('duplicate token');
    });

    it('custom token visible in operator listing', async () => {
      const customToken = 'listmt_OperatorListToken';
      await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'listmt', token: customToken }],
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?appName=listmt',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].tokenPrefix).toBe('listmt_Operator');
      expect(body.data[0].userId).toBe('user1');
    });
  });

  // ─── Dynamic Inputs ───────────────────────────────────────────────

  describe('Dynamic Inputs', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('full lifecycle with random userId, appName, expiresAt, and metadata', async () => {
      const randApp = `dyn-${randomBytes(6).toString('hex')}`;
      const randUser = randomUUID();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 365) + 30);
      const expiresAt = futureDate.toISOString();
      const randMeta = { tag: randomBytes(4).toString('hex'), score: Math.floor(Math.random() * 1000) };

      // Import
      const importRes = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: randUser, appName: randApp, expiresAt }],
      });

      expect(importRes.statusCode).toBe(201);
      const importBody = JSON.parse(importRes.payload);
      expect(importBody.imported).toHaveLength(1);
      const rawToken = importBody.imported[0].token;
      expect(rawToken).toMatch(new RegExp(`^${randApp}_[0-9a-f]{64}$`));

      // Verify
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(randApp),
        payload: { token: rawToken, userId: randUser },
      });
      const verifyBody = JSON.parse(verifyRes.payload);
      expect(verifyBody.valid).toBe(true);
      expect(verifyBody.userId).toBe(randUser);
      expect(verifyBody.appName).toBe(randApp);

      // Update metadata
      const metaRes = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers(randApp),
        payload: { token: rawToken, metadata: randMeta },
      });
      expect(metaRes.statusCode).toBe(200);

      // Verify metadata persisted
      const verifyMeta = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(randApp),
        payload: { token: rawToken, userId: randUser },
      });
      expect(JSON.parse(verifyMeta.payload).metadata).toEqual(randMeta);

      // Reissue
      const reissueRes = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: randUser, appName: randApp }],
      });
      expect(reissueRes.statusCode).toBe(201);
      const newToken = JSON.parse(reissueRes.payload).imported[0].token;
      expect(newToken).not.toBe(rawToken);

      // Old token revoked
      const oldRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(randApp),
        payload: { token: rawToken, userId: randUser },
      });
      expect(JSON.parse(oldRes.payload).reason).toBe('revoked');

      // New token valid
      const newRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers(randApp),
        payload: { token: newToken, userId: randUser },
      });
      expect(JSON.parse(newRes.payload).valid).toBe(true);
    });
  });

  // ─── Edge Cases (Phase 7) ──────────────────────────────────────────

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('import with past expiresAt → verification returns expired', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [
          { userId: 'pastuser', appName: 'pastapp', expiresAt: '2020-01-01' },
        ],
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);
      const rawToken = body.imported[0].token;

      // Verify returns expired
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('pastapp'),
        payload: { token: rawToken, userId: 'pastuser' },
      });
      const verifyBody = JSON.parse(verifyRes.payload);
      expect(verifyBody.valid).toBe(false);
      expect(verifyBody.reason).toBe('expired');
    });

    it('expired token appears in GET /tokens with status=expired', async () => {
      // Import with past date
      await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [
          { userId: 'explist', appName: 'explistapp', expiresAt: '2020-01-01' },
        ],
      });

      // Get token id
      const rows = await dataSource.query(
        `SELECT id FROM "tokens" WHERE "user_id" = 'explist' LIMIT 1`,
      );
      const tokenId = rows[0].id;

      // GET /tokens/:id shows status=expired
      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/tokens/${tokenId}`,
        headers: operatorHeaders,
      });
      const detail = JSON.parse(detailRes.payload);
      expect(detail.status).toBe('expired');

      // GET /tokens?status=expired includes this token
      const listRes = await app.inject({
        method: 'GET',
        url: '/api/tokens?status=expired',
        headers: operatorHeaders,
      });
      const list = JSON.parse(listRes.payload);
      expect(list.total).toBeGreaterThanOrEqual(1);
      expect(list.data.some((t: any) => t.id === tokenId)).toBe(true);
    });

    it('token prefix mismatch → not_found on verify', async () => {
      const rawToken = await importToken('user1', 'realapp');

      // Verify via a different app name
      await dataSource.query(
        `INSERT INTO "apps" ("name") VALUES ('otherapp') ON CONFLICT DO NOTHING`,
      );
      const res = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('otherapp'),
        payload: { token: rawToken, userId: 'user1' },
      });

      const body = JSON.parse(res.payload);
      expect(body.valid).toBe(false);
      expect(body.reason).toBe('not_found');
    });

    it('import without expiresAt → default expiry applied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'defuser', appName: 'defapp' }],
      });

      const body = JSON.parse(res.payload);
      const expiresAt = new Date(body.imported[0].expiresAt);
      const now = new Date();

      // DEFAULT_TOKEN_EXPIRY_DAYS is set to 365 in beforeAll
      const diffDays = (expiresAt.getTime() - now.getTime()) / (1000 * 86400);
      expect(diffDays).toBeGreaterThan(363);
      expect(diffDays).toBeLessThan(366);
    });

    it('token_prefix is visible in GET /tokens responses', async () => {
      await importToken('prefuser', 'prefapp');

      const res = await app.inject({
        method: 'GET',
        url: '/api/tokens?appName=prefapp',
        headers: operatorHeaders,
      });

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(1);
      expect(body.data[0].tokenPrefix).toMatch(/^prefapp_[0-9a-f]{8}$/);
    });

    it('metadata update on non-existent token → 404', async () => {
      await dataSource.query(
        `INSERT INTO "apps" ("name") VALUES ('metanf') ON CONFLICT DO NOTHING`,
      );

      const res = await app.inject({
        method: 'PATCH',
        url: '/api/tokens/metadata',
        headers: tier1Headers('metanf'),
        payload: {
          token: `metanf_${'a'.repeat(64)}`,
          metadata: { x: 1 },
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('import with missing appName field → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1' }], // missing appName
      });

      expect(res.statusCode).toBe(400);
    });

    it('import with missing userId field → 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ appName: 'someapp' }], // missing userId
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── Uniqueness Enforcement (E2E) ──────────────────────────────────

  describe('Uniqueness Enforcement', () => {
    beforeEach(async () => {
      await cleanDb();
      await seedAdminApp();
    });

    it('import → re-import same user+app → rejected; DB has exactly 1 non-revoked token', async () => {
      await importToken('user1', 'uniapp');

      // Second import should fail
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'uniapp' }],
      });

      const body = JSON.parse(res.payload);
      expect(body.errors).toHaveLength(1);
      expect(body.imported).toHaveLength(0);

      // DB check: exactly 1 non-revoked token
      const tokens = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1' AND "revoked_at" IS NULL`,
      );
      expect(tokens).toHaveLength(1);
    });

    it('import → revoke → re-import → succeeds; DB has 1 revoked + 1 active', async () => {
      const token = await importToken('user1', 'uniapp2');

      // Revoke
      const hash = createHash('sha256').update(token).digest('hex');
      await dataSource.query(
        `UPDATE "tokens" SET "revoked_at" = NOW() WHERE "token_hash" = $1`,
        [hash],
      );

      // Re-import
      const res = await app.inject({
        method: 'POST',
        url: '/api/import',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'uniapp2' }],
      });

      const body = JSON.parse(res.payload);
      expect(body.imported).toHaveLength(1);

      // DB: 1 revoked + 1 active
      const allTokens = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1'`,
      );
      expect(allTokens).toHaveLength(2);
      expect(allTokens.filter((t: any) => t.revoked_at !== null)).toHaveLength(
        1,
      );
      expect(allTokens.filter((t: any) => t.revoked_at === null)).toHaveLength(
        1,
      );
    });

    it('import → reissue → DB has 1 revoked + 1 active; old fails, new passes verification', async () => {
      const oldToken = await importToken('user1', 'uniapp3');

      // Reissue
      const reissueRes = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'uniapp3' }],
      });
      const newToken = JSON.parse(reissueRes.payload).imported[0].token;

      // DB: 1 revoked + 1 active
      const allTokens = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1'`,
      );
      expect(allTokens).toHaveLength(2);
      expect(allTokens.filter((t: any) => t.revoked_at !== null)).toHaveLength(
        1,
      );
      expect(allTokens.filter((t: any) => t.revoked_at === null)).toHaveLength(
        1,
      );

      // Old token fails verification
      const oldRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('uniapp3'),
        payload: { token: oldToken, userId: 'user1' },
      });
      expect(JSON.parse(oldRes.payload).valid).toBe(false);

      // New token passes verification
      const newRes = await app.inject({
        method: 'POST',
        url: '/api/tokens/verify',
        headers: tier1Headers('uniapp3'),
        payload: { token: newToken, userId: 'user1' },
      });
      expect(JSON.parse(newRes.payload).valid).toBe(true);
    });

    it('multiple reissues → only 1 non-revoked token per user+app at each step', async () => {
      const token1 = await importToken('user1', 'uniapp4');

      // First reissue
      const res1 = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'uniapp4' }],
      });
      const token2 = JSON.parse(res1.payload).imported[0].token;

      // Check: 1 active, 1 revoked
      let active = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1' AND "revoked_at" IS NULL`,
      );
      expect(active).toHaveLength(1);

      // Second reissue
      const res2 = await app.inject({
        method: 'POST',
        url: '/api/import/reissue',
        headers: { ...operatorHeaders, 'content-type': 'application/json' },
        payload: [{ userId: 'user1', appName: 'uniapp4' }],
      });
      const token3 = JSON.parse(res2.payload).imported[0].token;

      // Check: still 1 active, now 2 revoked
      active = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1' AND "revoked_at" IS NULL`,
      );
      expect(active).toHaveLength(1);

      const all = await dataSource.query(
        `SELECT * FROM "tokens" WHERE "user_id" = 'user1'`,
      );
      expect(all).toHaveLength(3); // 2 revoked + 1 active

      // Only the latest token verifies
      for (const [tok, expected] of [
        [token1, false],
        [token2, false],
        [token3, true],
      ] as const) {
        const vRes = await app.inject({
          method: 'POST',
          url: '/api/tokens/verify',
          headers: tier1Headers('uniapp4'),
          payload: { token: tok, userId: 'user1' },
        });
        expect(JSON.parse(vRes.payload).valid).toBe(expected);
      }
    });
  });
});
