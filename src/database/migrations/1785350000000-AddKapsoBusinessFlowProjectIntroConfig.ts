import { MigrationInterface, QueryRunner } from "typeorm";

const TABLE_NAME = "kapso_business_flow_projects";

export class AddKapsoBusinessFlowProjectIntroConfig1785350000000 implements MigrationInterface {
  name = "AddKapsoBusinessFlowProjectIntroConfig1785350000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await this.columnExists(queryRunner, "intro_message_template"))) {
      await queryRunner.query(`
        ALTER TABLE ${TABLE_NAME}
        ADD COLUMN intro_message_template TEXT NULL AFTER enabled
      `);
    }

    if (!(await this.columnExists(queryRunner, "intro_options_json"))) {
      await queryRunner.query(`
        ALTER TABLE ${TABLE_NAME}
        ADD COLUMN intro_options_json TEXT NULL AFTER intro_message_template
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.columnExists(queryRunner, "intro_options_json")) {
      await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN intro_options_json`);
    }

    if (await this.columnExists(queryRunner, "intro_message_template")) {
      await queryRunner.query(`ALTER TABLE ${TABLE_NAME} DROP COLUMN intro_message_template`);
    }
  }

  private async columnExists(queryRunner: QueryRunner, columnName: string): Promise<boolean> {
    const rows = (await queryRunner.query(
      `
        SELECT COUNT(*) AS total
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?
          AND COLUMN_NAME = ?
      `,
      [TABLE_NAME, columnName],
    )) as Array<{ total: number | string }>;

    return Number(rows[0]?.total ?? 0) > 0;
  }
}
