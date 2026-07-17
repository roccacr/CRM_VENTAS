// ============================================================================
// IMPORTS
// ============================================================================

import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from "typeorm";

// ============================================================================
// MIGRACION
// ============================================================================

/**
 * Crea las tablas que permiten tratar Kapso como flujos de negocio configurables.
 *
 * El flujo inicial queda sembrado para que la API pueda validar proyectos,
 * template aprobado, ejecuciones por lead y adjuntos de intro por proyecto.
 */
export class CreateKapsoBusinessFlowTables1752750000000 implements MigrationInterface {
  name = "CreateKapsoBusinessFlowTables1752750000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.createBusinessFlowsTable(queryRunner);
    await this.createTemplateCatalogTable(queryRunner);
    await this.createBusinessFlowProjectsTable(queryRunner);
    await this.createBusinessFlowStepsTable(queryRunner);
    await this.createLeadFlowExecutionsTable(queryRunner);
    await this.createFlowProjectMediaTable(queryRunner);
    await this.seedInitialLeadFlow(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("kapso_flow_project_media", true);
    await queryRunner.dropTable("kapso_lead_flow_executions", true);
    await queryRunner.dropTable("kapso_business_flow_steps", true);
    await queryRunner.dropTable("kapso_business_flow_projects", true);
    await queryRunner.dropTable("kapso_template_catalog", true);
    await queryRunner.dropTable("kapso_business_flows", true);
  }

  private async createBusinessFlowsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_business_flows")) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_business_flows",
        columns: [
          { name: "id_kapso_business_flow", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "flow_uuid", type: "varchar", length: "36", isNullable: false },
          { name: "flow_code", type: "varchar", length: "100", isNullable: false },
          { name: "flow_name", type: "varchar", length: "250", isNullable: false },
          { name: "description", type: "text", isNullable: true },
          { name: "status", type: "varchar", length: "50", default: "'draft'", isNullable: false },
          { name: "enabled", type: "tinyint", width: 1, default: "1", isNullable: false },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [
          { name: "uq_kapso_business_flows_uuid", columnNames: ["flow_uuid"] },
          { name: "uq_kapso_business_flows_code", columnNames: ["flow_code"] },
        ],
      }),
    );
  }

  private async createTemplateCatalogTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_template_catalog")) {
      const table = await queryRunner.getTable("kapso_template_catalog");

      if (table) {
        const missingColumns = [
          new TableColumn({ name: "template_reference", type: "varchar", length: "100", isNullable: true }),
          new TableColumn({ name: "template_status", type: "varchar", length: "50", default: "'submitted'", isNullable: false }),
          new TableColumn({ name: "template_preview", type: "text", isNullable: true }),
          new TableColumn({ name: "raw_payload_json", type: "json", isNullable: true }),
        ].filter((column) => !table.findColumnByName(column.name));

        if (missingColumns.length > 0) {
          await queryRunner.addColumns("kapso_template_catalog", missingColumns);
        }
      }

      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_template_catalog",
        columns: [
          { name: "id_kapso_template_catalog", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "action_code", type: "varchar", length: "100", isNullable: false },
          { name: "template_name", type: "varchar", length: "250", isNullable: false },
          { name: "template_external_id", type: "varchar", length: "100", isNullable: true },
          { name: "template_reference", type: "varchar", length: "100", isNullable: true },
          { name: "template_language", type: "varchar", length: "20", isNullable: false },
          { name: "template_category", type: "varchar", length: "50", isNullable: false },
          { name: "template_status", type: "varchar", length: "50", default: "'submitted'", isNullable: false },
          { name: "template_preview", type: "text", isNullable: true },
          { name: "parameter_count", type: "int", default: "0", isNullable: false },
          { name: "parameter_mapping_json", type: "json", isNullable: true },
          { name: "raw_payload_json", type: "json", isNullable: true },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [{ name: "uq_kapso_template_catalog_action", columnNames: ["action_code"] }],
      }),
    );
  }

  private async createBusinessFlowProjectsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_business_flow_projects")) {
      const table = await queryRunner.getTable("kapso_business_flow_projects");

      if (table) {
        if (table.findColumnByName("id_kapso_business_flow") && !table.findColumnByName("id_kapso_business_flow")?.isNullable) {
          await queryRunner.query("ALTER TABLE kapso_business_flow_projects MODIFY COLUMN id_kapso_business_flow int NULL");
        }

        const missingColumns = [
          new TableColumn({ name: "flow_uuid", type: "varchar", length: "36", isNullable: true }),
          new TableColumn({ name: "id_proyecto_netsuite", type: "int", isNullable: true }),
        ].filter((column) => !table.findColumnByName(column.name));

        if (missingColumns.length > 0) {
          await queryRunner.addColumns("kapso_business_flow_projects", missingColumns);
        }
      }

      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_business_flow_projects",
        columns: [
          { name: "id_kapso_business_flow_project", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "flow_uuid", type: "varchar", length: "36", isNullable: false },
          { name: "id_proyecto", type: "int", isNullable: true },
          { name: "id_proyecto_netsuite", type: "int", isNullable: false },
          { name: "project_name", type: "varchar", length: "250", isNullable: true },
          { name: "enabled", type: "tinyint", width: 1, default: "1", isNullable: false },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [{ name: "uq_kapso_business_flow_projects_flow_project", columnNames: ["flow_uuid", "id_proyecto_netsuite"] }],
      }),
    );
  }

  private async createBusinessFlowStepsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_business_flow_steps")) {
      const table = await queryRunner.getTable("kapso_business_flow_steps");

      if (table) {
        if (table.findColumnByName("id_kapso_business_flow") && !table.findColumnByName("id_kapso_business_flow")?.isNullable) {
          await queryRunner.query("ALTER TABLE kapso_business_flow_steps MODIFY COLUMN id_kapso_business_flow int NULL");
        }

        if (table.findColumnByName("action_code") && !table.findColumnByName("action_code")?.isNullable) {
          await queryRunner.query("ALTER TABLE kapso_business_flow_steps MODIFY COLUMN action_code varchar(90) NULL");
        }

        const missingColumns = [
          new TableColumn({ name: "flow_uuid", type: "varchar", length: "36", isNullable: true }),
          new TableColumn({ name: "step_name", type: "varchar", length: "250", isNullable: true }),
          new TableColumn({ name: "step_type", type: "varchar", length: "50", isNullable: true }),
          new TableColumn({ name: "template_action_code", type: "varchar", length: "100", isNullable: true }),
          new TableColumn({ name: "sort_order", type: "int", default: "0", isNullable: false }),
        ].filter((column) => !table.findColumnByName(column.name));

        if (missingColumns.length > 0) {
          await queryRunner.addColumns("kapso_business_flow_steps", missingColumns);
        }
      }

      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_business_flow_steps",
        columns: [
          { name: "id_kapso_business_flow_step", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "flow_uuid", type: "varchar", length: "36", isNullable: false },
          { name: "step_code", type: "varchar", length: "100", isNullable: false },
          { name: "step_name", type: "varchar", length: "250", isNullable: false },
          { name: "step_type", type: "varchar", length: "50", isNullable: false },
          { name: "template_action_code", type: "varchar", length: "100", isNullable: true },
          { name: "sort_order", type: "int", default: "0", isNullable: false },
          { name: "enabled", type: "tinyint", width: 1, default: "1", isNullable: false },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [{ name: "uq_kapso_business_flow_steps_flow_step", columnNames: ["flow_uuid", "step_code"] }],
      }),
    );
  }

  private async createLeadFlowExecutionsTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_lead_flow_executions")) {
      const table = await queryRunner.getTable("kapso_lead_flow_executions");

      if (table && !table.findColumnByName("id_proyecto_netsuite")) {
        await queryRunner.addColumn(
          "kapso_lead_flow_executions",
          new TableColumn({ name: "id_proyecto_netsuite", type: "int", isNullable: true }),
        );
      }

      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_lead_flow_executions",
        columns: [
          { name: "id_kapso_lead_flow_execution", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "flow_uuid", type: "varchar", length: "36", isNullable: false },
          { name: "idinterno_lead", type: "int", isNullable: false },
          { name: "idnetsuite_admin", type: "int", isNullable: true },
          { name: "id_proyecto_netsuite", type: "int", isNullable: true },
          { name: "phone_number_id", type: "varchar", length: "100", isNullable: false },
          { name: "lead_phone_number", type: "varchar", length: "50", isNullable: false },
          { name: "execution_status", type: "varchar", length: "80", isNullable: false },
          { name: "initial_template_sent_at", type: "timestamp", isNullable: true },
          { name: "last_response_json", type: "json", isNullable: true },
          { name: "last_response_at", type: "timestamp", isNullable: true },
          { name: "completed_at", type: "timestamp", isNullable: true },
          { name: "failure_reason", type: "text", isNullable: true },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [{ name: "uq_kapso_lead_flow_executions_once", columnNames: ["flow_uuid", "idinterno_lead"] }],
      }),
    );

    await queryRunner.createIndex(
      "kapso_lead_flow_executions",
      new TableIndex({
        name: "idx_kapso_lead_flow_executions_response_lookup",
        columnNames: ["phone_number_id", "lead_phone_number", "execution_status"],
      }),
    );
  }

  private async createFlowProjectMediaTable(queryRunner: QueryRunner) {
    if (await queryRunner.hasTable("kapso_flow_project_media")) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: "kapso_flow_project_media",
        columns: [
          { name: "id_kapso_flow_project_media", type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
          { name: "flow_uuid", type: "varchar", length: "36", isNullable: false },
          { name: "id_proyecto_netsuite", type: "int", isNullable: false },
          { name: "step_code", type: "varchar", length: "100", default: "'intro'", isNullable: false },
          { name: "media_type", type: "varchar", length: "30", isNullable: false },
          { name: "original_name", type: "varchar", length: "255", isNullable: false },
          { name: "stored_filename", type: "varchar", length: "255", isNullable: false },
          { name: "relative_path", type: "varchar", length: "500", isNullable: false },
          { name: "public_url", type: "varchar", length: "1000", isNullable: false },
          { name: "mime_type", type: "varchar", length: "150", isNullable: false },
          { name: "file_size", type: "int", isNullable: false },
          { name: "sort_order", type: "int", default: "0", isNullable: false },
          { name: "status", type: "tinyint", width: 1, default: "1", isNullable: false },
          { name: "created_at", type: "timestamp", default: "CURRENT_TIMESTAMP", isNullable: false },
          { name: "updated_at", type: "timestamp", default: "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", isNullable: false },
        ],
        uniques: [{ name: "uq_kapso_flow_project_media_filename", columnNames: ["stored_filename"] }],
      }),
    );

    await queryRunner.createIndex(
      "kapso_flow_project_media",
      new TableIndex({
        name: "idx_kapso_flow_project_media_flow_project",
        columnNames: ["flow_uuid", "id_proyecto_netsuite", "step_code", "status"],
      }),
    );
  }

  private async seedInitialLeadFlow(queryRunner: QueryRunner) {
    await queryRunner.query(
      `
        INSERT INTO kapso_business_flows (
          flow_uuid,
          flow_code,
          flow_name,
          description,
          status,
          enabled
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          flow_name = VALUES(flow_name),
          description = VALUES(description),
          status = VALUES(status),
          enabled = VALUES(enabled)
      `,
      [
        "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        "lead_initial_contact",
        "Saludo inicial y seguimiento de leads",
        "Flujo comercial inicial para saludar, validar autorizacion e iniciar envio de informacion por proyecto.",
        "draft",
        1,
      ],
    );

    await queryRunner.query(
      `
        INSERT INTO kapso_template_catalog (
          action_code,
          template_name,
          template_external_id,
          template_reference,
          template_language,
          template_category,
          template_status,
          template_preview,
          parameter_count,
          parameter_mapping_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          template_name = VALUES(template_name),
          template_external_id = VALUES(template_external_id),
          template_reference = VALUES(template_reference),
          template_status = VALUES(template_status),
          template_preview = VALUES(template_preview),
          parameter_count = VALUES(parameter_count),
          parameter_mapping_json = VALUES(parameter_mapping_json)
      `,
      [
        "lead_initial_greeting",
        "saludo",
        "1004936342403599",
        "4108dccb",
        "es_ES",
        "MARKETING",
        "approved",
        "Hola {{1}}, soy {{2}}, asesor de {{3}}. Vi que pediste informacion del proyecto.",
        3,
        JSON.stringify([
          { index: 1, source: "lead", field: "nombre_lead" },
          { index: 2, source: "admin", field: "name_admin" },
          { index: 3, source: "lead", field: "proyecto_lead" },
        ]),
      ],
    );

    await queryRunner.query(
      `
        INSERT INTO kapso_business_flow_steps (
          flow_uuid,
          step_code,
          step_name,
          step_type,
          template_action_code,
          sort_order,
          enabled
        ) VALUES
          (?, ?, ?, ?, ?, ?, ?),
          (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          step_name = VALUES(step_name),
          step_type = VALUES(step_type),
          template_action_code = VALUES(template_action_code),
          sort_order = VALUES(sort_order),
          enabled = VALUES(enabled)
      `,
      [
        "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        "saludo",
        "Saludo inicial",
        "template",
        "lead_initial_greeting",
        1,
        1,
        "94d5c3b8-4b43-4c28-8c76-3d9eaf70ad01",
        "intro",
        "Intro con informacion del proyecto",
        "session_message",
        null,
        2,
        1,
      ],
    );
  }
}
