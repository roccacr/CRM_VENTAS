import { config as loadDotenv } from "dotenv";
import { Connection, createConnection } from "mysql2/promise";
import { DataSource } from "typeorm";

import { AddKapsoSetupLinkAudits1751391600000 } from "../../src/database/migrations/1751391600000-AddKapsoSetupLinkAudits";
import { CreateKapsoCoreTables1751391000000 } from "../../src/database/migrations/1751391000000-CreateKapsoCoreTables";
import { ConsolidateKapsoIntoPhoneNumbers1752108000000 } from "../../src/database/migrations/1752108000000-ConsolidateKapsoIntoPhoneNumbers";
import { CreateAdminKapsoIntegrationsTable1752200400000 } from "../../src/database/migrations/1752200400000-CreateAdminKapsoIntegrationsTable";
import { CreateKapsoBusinessFlowTables1752750000000 } from "../../src/database/migrations/1752750000000-CreateKapsoBusinessFlowTables";
import { DeduplicateKapsoTemplateCatalog1752860000000 } from "../../src/database/migrations/1752860000000-DeduplicateKapsoTemplateCatalog";
import { CreateKapsoWebhookReceipts1784690000000 } from "../../src/database/migrations/1784690000000-CreateKapsoWebhookReceipts";
import { AdminKapsoIntegrationEntity } from "../../src/modules/kapso/entities/admin-kapso-integration.entity";
import { KapsoPhoneNumberEntity } from "../../src/modules/kapso/entities/kapso-phone-number.entity";

loadDotenv({ quiet: true });

const SAFE_DATABASE_PREFIX = "api_kapso_it_";

export type MysqlTestDatabase = {
  dataSource: DataSource;
  databaseName: string;
  destroy: () => Promise<void>;
};

export async function createCrmFixtureTables(dataSource: DataSource): Promise<void> {
  await dataSource.query(`
    CREATE TABLE admins (
      id_admin int NOT NULL AUTO_INCREMENT,
      idnetsuite_admin int NULL,
      id_rol_admin int NOT NULL DEFAULT 1,
      email_admin varchar(255) NOT NULL,
      name_admin varchar(255) NOT NULL,
      status_admin tinyint(1) NOT NULL DEFAULT 1,
      token_admin text NULL,
      PRIMARY KEY (id_admin),
      INDEX idx_test_admins_netsuite (idnetsuite_admin),
      UNIQUE KEY uq_test_admins_email (email_admin)
    ) ENGINE=InnoDB
  `);
  await dataSource.query(`
    CREATE TABLE proyectos (
      id_proyecto int NOT NULL AUTO_INCREMENT,
      id_ProNetsuite int NULL,
      Nombre_proyecto varchar(255) NOT NULL,
      estado_proyecto tinyint(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (id_proyecto),
      INDEX idx_test_proyectos_netsuite (id_ProNetsuite)
    ) ENGINE=InnoDB
  `);
  await dataSource.query(`
    CREATE TABLE leads (
      id_lead int NOT NULL AUTO_INCREMENT,
      idinterno_lead int NOT NULL,
      id_empleado_lead int NULL,
      telefono_lead varchar(80) NULL,
      idproyecto_lead int NULL,
      proyecto_lead varchar(255) NULL,
      nombre_lead varchar(255) NULL,
      segimineto_lead varchar(80) NOT NULL,
      whatsapp_template_contact_sent int NOT NULL DEFAULT 2,
      estado_lead tinyint(1) NOT NULL DEFAULT 1,
      id_Caida int NULL,
      accion_lead int NULL,
      actualizadaaccion_lead varchar(30) NULL,
      PRIMARY KEY (id_lead),
      UNIQUE KEY uq_test_leads_internal (idinterno_lead)
    ) ENGINE=InnoDB
  `);
  await dataSource.query(`
    CREATE TABLE bitacoras (
      id_bitacora int NOT NULL AUTO_INCREMENT,
      id_lead_bit int NOT NULL,
      id_admin_bit int NOT NULL,
      id_caida_bit int NULL,
      detalle_bit varchar(500) NOT NULL,
      tipo_documento_bit varchar(80) NOT NULL,
      estado_bit varchar(120) NOT NULL,
      estado_lead tinyint(1) NOT NULL,
      fech_seg_bit varchar(30) NOT NULL,
      PRIMARY KEY (id_bitacora)
    ) ENGINE=InnoDB
  `);
}

export async function createMysqlTestDatabase(): Promise<MysqlTestDatabase> {
  const databaseName = `${SAFE_DATABASE_PREFIX}${process.pid}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  assertSafeDatabaseName(databaseName);

  const admin = await createAdminConnection();
  await admin.query(`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

  const dataSource = new DataSource({
    type: "mysql",
    host: readEnv("MYSQL_HOST", "localhost"),
    port: Number(readEnv("MYSQL_PORT", "3306")),
    username: readEnv("MYSQL_USER", "root"),
    password: readEnv("MYSQL_PASSWORD", ""),
    database: databaseName,
    entities: [AdminKapsoIntegrationEntity, KapsoPhoneNumberEntity],
    migrations: [
      CreateKapsoCoreTables1751391000000,
      AddKapsoSetupLinkAudits1751391600000,
      ConsolidateKapsoIntoPhoneNumbers1752108000000,
      CreateAdminKapsoIntegrationsTable1752200400000,
      CreateKapsoBusinessFlowTables1752750000000,
      DeduplicateKapsoTemplateCatalog1752860000000,
      CreateKapsoWebhookReceipts1784690000000,
    ],
    migrationsTableName: "typeorm_migrations",
    migrationsTransactionMode: "none",
    synchronize: false,
    timezone: "Z",
  });

  try {
    await dataSource.initialize();
    return {
      dataSource,
      databaseName,
      destroy: async () => destroyMysqlTestDatabase(dataSource, admin, databaseName),
    };
  } catch (error) {
    await dropDatabase(admin, databaseName);
    await admin.end();
    throw error;
  }
}

async function createAdminConnection(): Promise<Connection> {
  return createConnection({
    host: readEnv("MYSQL_HOST", "localhost"),
    port: Number(readEnv("MYSQL_PORT", "3306")),
    user: readEnv("MYSQL_USER", "root"),
    password: readEnv("MYSQL_PASSWORD", ""),
  });
}

async function destroyMysqlTestDatabase(dataSource: DataSource, admin: Connection, databaseName: string): Promise<void> {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }

  await dropDatabase(admin, databaseName);
  await admin.end();
}

async function dropDatabase(admin: Connection, databaseName: string): Promise<void> {
  assertSafeDatabaseName(databaseName);
  await admin.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
}

function assertSafeDatabaseName(databaseName: string): void {
  if (!new RegExp(`^${SAFE_DATABASE_PREFIX}[a-zA-Z0-9_]+$`).test(databaseName)) {
    throw new Error(`Unsafe integration database name: ${databaseName}`);
  }
}

/** Quita comillas accidentales de `.env` (`MYSQL_HOST="host"`). */
function readEnv(name: string, fallback: string): string {
  const raw = process.env[name] ?? fallback;
  return raw.trim().replace(/^['"]|['"]$/g, "");
}
