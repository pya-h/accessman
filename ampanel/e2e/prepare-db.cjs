/**
 * Prepares the test database: syncs schema, cleans data, inserts admin app.
 *
 * Run from the ambackend directory (so require('typeorm') resolves correctly):
 *   NODE_PATH=node_modules node ../ampanel/e2e/prepare-db.cjs
 *
 * Env: DATABASE_URL must point to the test database.
 */
const { DataSource } = require('typeorm');
const path = require('path');

const BACKEND_DIST = path.resolve(__dirname, '../../ambackend/dist');
const ADMIN_APP = process.env.ADMIN_APP_NAME || 'am-panel';

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: true,
    entities: [path.join(BACKEND_DIST, '**/*.entity.js')],
  });

  await ds.initialize();
  await ds.query('DELETE FROM "tokens"');
  await ds.query('DELETE FROM "apps"');
  // Reset token-generation settings to defaults (SettingsService recreates the
  // singleton row on first access) so each run starts from a known baseline.
  await ds.query('DELETE FROM "settings"');
  await ds.query(
    `INSERT INTO "apps" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
    [ADMIN_APP],
  );
  await ds.destroy();
  console.log('[prepare-db] Database ready');
}

main().catch((e) => {
  console.error('[prepare-db] Failed:', e.message);
  process.exit(1);
});
