import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Creates the `customers` table — one row per registered person. Idempotent
 * (IF NOT EXISTS) so it is safe on an already-provisioned DB. `gen_random_uuid()`
 * is built into Postgres 13+, so no extension is required.
 */
export class CreateCustomers1784736000000 implements MigrationInterface {
  name = "CreateCustomers1784736000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "birthday" date NOT NULL,
        "phone" text,
        "email" text,
        "consent" boolean NOT NULL,
        "social" jsonb NOT NULL DEFAULT '{}',
        "guardian_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_customers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_customers_guardian" FOREIGN KEY ("guardian_id")
          REFERENCES "customers" ("id") ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
