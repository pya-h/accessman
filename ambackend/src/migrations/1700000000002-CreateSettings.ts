import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettings1700000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "settings" (
        "id" INTEGER PRIMARY KEY DEFAULT 1,
        "code_length" INTEGER NOT NULL DEFAULT 4,
        "prefix_app_name" BOOLEAN NOT NULL DEFAULT false,
        "include_numbers" BOOLEAN NOT NULL DEFAULT true,
        "letter_case" VARCHAR(10) NOT NULL DEFAULT 'lower',
        "include_special" BOOLEAN NOT NULL DEFAULT false,
        "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT "CHK_settings_singleton" CHECK ("id" = 1)
      )
    `);

    await queryRunner.query(
      `INSERT INTO "settings" ("id") VALUES (1) ON CONFLICT DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "settings"`);
  }
}
