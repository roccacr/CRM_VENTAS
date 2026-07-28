import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddInitialTemplateMessageIdToLeadExecutions1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!table) {
      return;
    }

    if (!table.findColumnByName("initial_template_message_id")) {
      await queryRunner.addColumn(
        "kapso_lead_flow_executions",
        new TableColumn({
          name: "initial_template_message_id",
          type: "varchar",
          length: "250",
          isNullable: true,
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!refreshedTable?.indices.some((index) => index.name === "idx_kapso_lead_flow_executions_message_lookup")) {
      await queryRunner.createIndex(
        "kapso_lead_flow_executions",
        new TableIndex({
          name: "idx_kapso_lead_flow_executions_message_lookup",
          columnNames: ["phone_number_id", "initial_template_message_id", "execution_status"],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!table) {
      return;
    }

    if (table.indices.some((index) => index.name === "idx_kapso_lead_flow_executions_message_lookup")) {
      await queryRunner.dropIndex("kapso_lead_flow_executions", "idx_kapso_lead_flow_executions_message_lookup");
    }

    const refreshedTable = await queryRunner.getTable("kapso_lead_flow_executions");

    if (refreshedTable?.findColumnByName("initial_template_message_id")) {
      await queryRunner.dropColumn("kapso_lead_flow_executions", "initial_template_message_id");
    }
  }
}
