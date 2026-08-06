import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddIntroInteractiveMessageIdToLeadExecutions1785960000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!table) {
      return;
    }

    if (!table.findColumnByName("intro_interactive_message_id")) {
      await queryRunner.addColumn(
        "kapso_lead_flow_executions",
        new TableColumn({
          name: "intro_interactive_message_id",
          type: "varchar",
          length: "250",
          isNullable: true,
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!refreshedTable?.indices.some((index) => index.name === "idx_kapso_lead_flow_intro_interactive_lookup")) {
      await queryRunner.createIndex(
        "kapso_lead_flow_executions",
        new TableIndex({
          name: "idx_kapso_lead_flow_intro_interactive_lookup",
          columnNames: ["phone_number_id", "intro_interactive_message_id", "execution_status"],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("kapso_lead_flow_executions");

    if (!table) {
      return;
    }

    if (table.indices.some((index) => index.name === "idx_kapso_lead_flow_intro_interactive_lookup")) {
      await queryRunner.dropIndex("kapso_lead_flow_executions", "idx_kapso_lead_flow_intro_interactive_lookup");
    }

    const refreshedTable = await queryRunner.getTable("kapso_lead_flow_executions");

    if (refreshedTable?.findColumnByName("intro_interactive_message_id")) {
      await queryRunner.dropColumn("kapso_lead_flow_executions", "intro_interactive_message_id");
    }
  }
}
