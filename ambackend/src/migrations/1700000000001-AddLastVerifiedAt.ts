import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLastVerifiedAt1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tokens" ADD COLUMN "last_verified_at" TIMESTAMP`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tokens" DROP COLUMN "last_verified_at"`,
    );
  }
}
