import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1700000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "apps" (
        "id" SERIAL PRIMARY KEY,
        "name" VARCHAR(100) NOT NULL UNIQUE,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tokens" (
        "id" SERIAL PRIMARY KEY,
        "user_id" VARCHAR(128) NOT NULL,
        "app_id" INTEGER NOT NULL REFERENCES "apps"("id"),
        "token_hash" VARCHAR(64) NOT NULL UNIQUE,
        "token_prefix" VARCHAR(120) NOT NULL,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "expires_at" TIMESTAMP,
        "revoked_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_tokens_app_id" ON "tokens" ("app_id")`,
    );

    const adminAppName = process.env.ADMIN_APP_NAME || 'am-panel';
    await queryRunner.query(
      `INSERT INTO "apps" ("name") VALUES ($1) ON CONFLICT DO NOTHING`,
      [adminAppName],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "tokens"`);
    await queryRunner.query(`DROP TABLE "apps"`);
  }
}
