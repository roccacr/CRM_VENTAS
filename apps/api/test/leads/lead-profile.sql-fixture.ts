import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { leadStatements } from "../../migrations/schema-only/202610230031_leads_domain.js";
import { leadProfilePermissionMigration } from "../../migrations/schema-only/202611020060_lead_profile_permission.js";
import type { CrmDatabase } from "../../src/database/database.types.js";

export const PROFILE_NATIVE_ID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const legacyLeadText = "idnetsuite_lead id_admin_lead id_rol_lead idproyecto_lead idsubsidaria_lead idestadointeresado_lead idcampana_lead idreferencia_lead id_corredor nombre_lead email_lead telefono_lead codigo_lead empresa_lead proyecto_lead subsidiaria_lead moneda_lead segimineto_lead campana_lead custentityaccion_campana referencia_lead estadointeresado_lead comentario_lead accion_lead".split(" ");
const legacyExtraText =
    "cedula_lead Nacionalidad_lead Estado_ciLead Edad_lead Profesion_lead Hijos_lead TelefonoAlternatovo_lead Direccion Corredor_lead nombre_extra_lead cedula_extra_lead profesion_extra_lead estado_civil_extra_lead telefono_extra_lead nacionalidad_extra_lead email_extra_lead lugar_residencia_extra_lead info_extra_ingresos info_extra_MotivoCompra info_extra_MomentodeCompra info_extra_Trabajo info_extra_leadcol info_extra_OrigenFondo info_extra_ZonaRecidencia info_extra_PerfilClienteComprador".split(
        " ",
    );
const textColumns = (columns: string[]) => columns.map((column) => `\`${column}\` VARCHAR(1000) NULL`).join(",");

const securityStatements = [
    "CREATE TABLE IF NOT EXISTS sec_user (id_user BIGINT UNSIGNED PRIMARY KEY,public_id_user VARCHAR(26),display_name_user VARCHAR(100),status_user VARCHAR(20),permission_version_user INT NOT NULL DEFAULT 1,deleted_at_user DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS sec_role (id_role BIGINT UNSIGNED PRIMARY KEY,code_role VARCHAR(50) UNIQUE,status_role VARCHAR(20),deleted_at_role DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS sec_user_role (user_id_user_role BIGINT UNSIGNED,role_id_user_role BIGINT UNSIGNED,status_user_role VARCHAR(20),revoked_at_user_role DATETIME NULL,PRIMARY KEY(user_id_user_role,role_id_user_role)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS sec_permission (id_permission BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,code_permission VARCHAR(100) UNIQUE,module_code_permission VARCHAR(50),action_code_permission VARCHAR(50),description_permission VARCHAR(250),status_permission VARCHAR(20)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS sec_role_permission (role_id_role_permission BIGINT UNSIGNED,permission_id_role_permission BIGINT UNSIGNED,status_role_permission VARCHAR(20),PRIMARY KEY(role_id_role_permission,permission_id_role_permission)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS sec_user_permission_override (user_id_user_permission_override BIGINT UNSIGNED,permission_id_user_permission_override BIGINT UNSIGNED,effect_user_permission_override VARCHAR(10),PRIMARY KEY(user_id_user_permission_override,permission_id_user_permission_override)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS audit_security_event (id_security_event BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,public_id_security_event VARCHAR(26),event_type_security_event VARCHAR(100),actor_user_id_security_event BIGINT UNSIGNED,summary_security_event TEXT,reason_security_event TEXT,metadata_security_event JSON) ENGINE=InnoDB",
];
const contextStatements = [
    `CREATE TABLE IF NOT EXISTS \`crmdatabase-api\`.estimaciones (id_estimacion BIGINT PRIMARY KEY,idLead_est BIGINT,${textColumns("idEstimacion_est tranid_est idOportunidad_est idExpediente_est nombreLead_est idAdmin_est idsubsidiaria namesubsi_est caduca chek_est status creado_est pre_reserva pre_caida montoTotal_est envioPreReserva envioPreReservaCaida fechaClienteComprobante_est".split(" "))}) ENGINE=InnoDB`,

    `CREATE TABLE IF NOT EXISTS \`crmdatabase-api\`.oportunidades (id_oport BIGINT PRIMARY KEY,entity_oport BIGINT,${textColumns("id_oportunidad_oport tranid_oport entityname_oport employee_oport salesrep_oport companyid_oport credholdentity_oport exp_custbody38_oport entitystatus_oport forecasttype_oport probability_oport expectedclosedate_oport custbody76_oport custbody75_oport rangelow_oport rangehigh_oport projectedtotal_oport subsidiary_oport subsidiaria_oport memo_oport fecha_creada_oport update_fecha_oport fecha_menos_probable_oport motivo_inactivacion_oport fecha_inactivacion_oport id_usuario_inactivo_oport tipo_actor_inactivacion_oport fuente_inactivacion_oport detalle_inactivacion_oport fecha_reactivacion_oport id_usuario_reactivo_oport tipo_actor_reactivacion_oport fuente_reactivacion_oport detalle_reactivacion_oport duracion_ultima_inactividad_seg_oport estatus_oport chek_oport fecha_Condicion Motico_Condicion id_valor_opt nota_opt custbody13 chek2_oport".split(" "))}) ENGINE=InnoDB`,

    "CREATE TABLE IF NOT EXISTS audit_record (id_record VARCHAR(26) PRIMARY KEY,entity_type_record VARCHAR(30),source_schema_record VARCHAR(100),source_table_record VARCHAR(100),source_id_record VARCHAR(100)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS audit_record_event (id_record_event VARCHAR(26) PRIMARY KEY,record_id_record_event VARCHAR(26),action_record_event VARCHAR(100),after_record_event JSON NULL,actor_snapshot_record_event JSON NULL,snapshot_scope_record_event VARCHAR(30),occurred_at_record_event DATETIME,recorded_at_record_event DATETIME,reason_record_event TEXT NULL) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS int_lead_history_link (lead_id_lead_history_link BIGINT UNSIGNED,record_id_lead_history_link VARCHAR(26)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS int_lead_history_entry (source_entry_id_lead_history_entry BIGINT,source_lead_reference_lead_history_entry VARCHAR(100),event_id_lead_history_entry VARCHAR(26),resolution_lead_history_entry VARCHAR(20)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS crm_lead_activity (id_lead_activity BIGINT UNSIGNED PRIMARY KEY,lead_id_lead_activity BIGINT UNSIGNED,reason_code_lead_activity VARCHAR(80)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS crm_sales_order (id_sales_order BIGINT UNSIGNED PRIMARY KEY,public_id_sales_order VARCHAR(26),native_code_sales_order VARCHAR(50),id_old_produccion_sales_order BIGINT NULL UNIQUE,lead_id_sales_order BIGINT UNSIGNED NULL,status_sales_order VARCHAR(20),transaction_date_sales_order DATE,currency_code_sales_order CHAR(3),sale_price_sales_order DECIMAL(19,4),deleted_at_sales_order DATETIME NULL) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS `crmdatabase-api`.admins (idnetsuite_admin BIGINT PRIMARY KEY,name_admin VARCHAR(100)) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS `crmdatabase-api`.caidas (id_caida INT PRIMARY KEY,nombre_caida VARCHAR(100)) ENGINE=InnoDB",
    `CREATE TABLE IF NOT EXISTS \`crmdatabase-api\`.leads (id_lead BIGINT UNSIGNED PRIMARY KEY,idinterno_lead BIGINT UNSIGNED UNIQUE,id_empleado_lead BIGINT,id_Caida INT,estado_lead INT,valor_segimineto_lead INT,contribucion_lead INT,actualizadaaccion_lead DATETIME,seguimiento_calendar INT,whatsapp_template_contact_sent INT,creado_lead DATETIME,actualizado_lead DATETIME,${textColumns(legacyLeadText)}) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS \`crmdatabase-api\`.info_extra_lead (id_Info_lead BIGINT NULL,id_lead_fk BIGINT UNSIGNED PRIMARY KEY,${textColumns(legacyExtraText)}) ENGINE=InnoDB`,
    "CREATE TABLE IF NOT EXISTS `crmdatabase-api`.bitacoras (id_bitacora_bit BIGINT PRIMARY KEY,id_lead_bit BIGINT,id_admin_bit BIGINT,id_caida_bit INT,detalle_bit TEXT,tipo_documento_bit VARCHAR(100),estado_bit VARCHAR(100),fecha_creado_bit DATETIME) ENGINE=InnoDB",
    "CREATE TABLE IF NOT EXISTS `crmdatabase-api`.ordenventa (id_ov BIGINT PRIMARY KEY,id_ov_lead BIGINT,id_ov_tranid VARCHAR(50),status_ov INT,trandate_ov DATE,prec_venta_ov DECIMAL(19,4)) ENGINE=InnoDB",
];

/** Nunca carga .env: exige loopback, puerto propio y datadir efímero previamente verificado. */
export async function createProfileSqlFixture(): Promise<Kysely<CrmDatabase>> {
    const admin = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", connectionLimit: 1 }) }) });
    try {
        const server = (await sql<{ directory: string; port: number }>`SELECT @@datadir AS directory,@@port AS port`.execute(admin)).rows[0];
        if (server?.port !== 3311 || !server.directory.replaceAll("\\", "/").includes("/lead-profile-acceptance-20261102/data-sensitive/")) throw new Error("La prueba exige su instancia SQL local dedicada.");
        await sql`CREATE DATABASE IF NOT EXISTS CRM_THINK_V2`.execute(admin);
        await sql`CREATE DATABASE IF NOT EXISTS ${sql.id("crmdatabase-api")}`.execute(admin);
    } finally {
        await admin.destroy();
    }
    const db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", database: "CRM_THINK_V2", connectionLimit: 4 }) }) });
    try {
        await createTables(db);
        await seedRecords(db);
        return db;
    } catch (error) {
        await db.destroy();
        throw error;
    }
}

async function createTables(db: Kysely<CrmDatabase>) {
    for (const statement of securityStatements) await sql.raw(statement).execute(db);
    for (const entity of ["project", "campaign", "subsidiary", "broker"]) await sql.raw(`CREATE TABLE IF NOT EXISTS crm_${entity} (id_${entity} BIGINT UNSIGNED PRIMARY KEY,name_${entity} VARCHAR(100)) ENGINE=InnoDB`).execute(db);
    await sql`CREATE TABLE IF NOT EXISTS int_external_system (id_external_system BIGINT UNSIGNED PRIMARY KEY,code_external_system VARCHAR(50),status_external_system VARCHAR(20)) ENGINE=InnoDB`.execute(db);
    // Se usa el DDL nativo existente, incluidas sus FK, en vez de inventar el esquema del lead.
    for (const statement of leadStatements) await sql.raw(statement).execute(db);
    for (const statement of contextStatements) await sql.raw(statement).execute(db);
}

async function seedRecords(db: Kysely<CrmDatabase>) {
    await sql`INSERT IGNORE INTO sec_user (id_user,public_id_user,display_name_user,status_user) VALUES (1,'owner-test','Owner de prueba','active'),(2,'role-test','Rol de prueba','active'),(3,'direct-test','Persona de prueba','active'),(4,'without-test','Sin permiso','active'),(5,'deny-test','Deny de prueba','active')`.execute(db);
    await sql`INSERT IGNORE INTO sec_role VALUES (1,'owner','active',NULL),(2,'formalizacion','active',NULL),(3,'jefe_formalizaciones','active',NULL),(4,'jefe_general','active',NULL)`.execute(db);
    await sql`INSERT IGNORE INTO sec_user_role VALUES (1,1,'active',NULL),(2,2,'active',NULL),(5,2,'active',NULL)`.execute(db);
    await leadProfilePermissionMigration.up(db as unknown as Kysely<unknown>);
    await sql`INSERT IGNORE INTO sec_user_permission_override SELECT 3,id_permission,'allow' FROM sec_permission WHERE code_permission='lead.profile.read'`.execute(db);
    await sql`INSERT IGNORE INTO sec_user_permission_override SELECT 5,id_permission,'deny' FROM sec_permission WHERE code_permission='lead.profile.read'`.execute(db);
    for (const entity of ["project", "campaign", "subsidiary", "broker"]) await sql.raw(`INSERT IGNORE INTO crm_${entity} VALUES (1,'${entity} de prueba')`).execute(db);
    await sql`INSERT IGNORE INTO int_external_system VALUES (1,'netsuite','active')`.execute(db);
    await sql`INSERT IGNORE INTO conf_lead_status (code_lead_status,name_lead_status,display_order_lead_status) VALUES ('interested','Interesado',1)`.execute(db);
    await sql`INSERT IGNORE INTO conf_lead_source (code_lead_source,name_lead_source) VALUES ('manual','Manual')`.execute(db);
    await sql`INSERT IGNORE INTO crm_contact (id_contact,public_id_contact,full_name_contact,email_contact,phone_contact,country_code_contact) VALUES (1,'01ARZ3NDEKTSV4RRFFQ69G5FAA','Nombre nativo',NULL,'22220000','CR')`.execute(db);
    await sql`INSERT IGNORE INTO crm_lead (id_lead,public_id_lead,primary_contact_id_lead,owner_user_id_lead,project_id_lead,campaign_id_lead,subsidiary_id_lead,broker_id_lead,source_code_lead,status_code_lead) VALUES (1,${PROFILE_NATIVE_ID},1,2,1,1,1,1,'manual','interested')`.execute(db);
    await sql`INSERT IGNORE INTO crm_lead_external_reference (lead_id_lead_external_reference,external_system_id_lead_external_reference,external_id_lead_external_reference) VALUES (1,1,'400')`.execute(db);
    await seedLegacyAndHistory(db);
}

async function seedLegacyAndHistory(db: Kysely<CrmDatabase>) {
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.leads")} (id_lead,idinterno_lead,id_empleado_lead,estado_lead,nombre_lead,email_lead,telefono_lead,creado_lead,actualizado_lead,contribucion_lead) VALUES (11,300,70,1,'Solo legacy','solo@example.test','11110000','2026-01-01','2026-01-01',10),(12,400,70,1,'Nombre anterior','anterior@example.test','11112222','2026-01-01','2026-01-01',20)`.execute(db);
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.info_extra_lead")} (id_lead_fk,Nacionalidad_lead,Profesion_lead) VALUES (300,'CR','Profesión legacy'),(400,'CR','Profesión complementaria')`.execute(db);
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.admins")} VALUES (70,'Actor legacy')`.execute(db);
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.caidas")} VALUES (1,'Seguimiento de prueba')`.execute(db);
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.bitacoras")} VALUES (1,300,70,1,'Historia legacy pura','Seguimiento','Interesado','2026-01-02'),(2,400,70,1,'Historia legacy vinculada','Seguimiento','Interesado','2026-01-02')`.execute(db);
    await sql`INSERT IGNORE INTO audit_record VALUES ('record-native','lead','CRM_THINK_V2','crm_lead','1'),('record-legacy','lead','crmdatabase-api','leads','12')`.execute(db);
    await sql`INSERT IGNORE INTO audit_record_event VALUES ('native-event','record-native','lead.updated',NULL,${JSON.stringify({ name: "Actor nativo" })},'complete','2026-02-01','2026-02-01','Historia nativa')`.execute(db);
    await sql`INSERT IGNORE INTO ${sql.table("crmdatabase-api.ordenventa")} VALUES (101,300,'OV-LEGACY',1,'2026-01-03',100),(102,400,'OV-ANTERIOR',1,'2026-01-03',200),(103,400,'OV-PUENTE',1,'2026-01-04',300)`.execute(db);
    await sql`INSERT IGNORE INTO crm_sales_order VALUES (1,'01ARZ3NDEKTSV4RRFFQ69G5FAB','OV-NATIVA',102,1,'active','2026-02-03','USD',250,NULL),(2,'01ARZ3NDEKTSV4RRFFQ69G5FAC','OV-NATIVA-PUENTE',103,NULL,'active','2026-02-04','USD',350,NULL)`.execute(db);
}
