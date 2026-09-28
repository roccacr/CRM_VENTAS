import { type Kysely, sql } from "kysely";

// ============================================================================
// Migracion schema-only idempotente para preparar login real.
//
// Este archivo NO ejecuta inserts, NO crea usuarios y NO toca otra base. Solo
// aplica la evolucion estructural documentada en SQL/003 cuando el runner
// schema-only fue autorizado explicitamente.
// ============================================================================

interface InformationSchemaCount {
    found_count: number;
}

interface SchemaColumnDefinition {
    column: string;
    definition: string;
    table: string;
}

interface SchemaIndexDefinition {
    definition: string;
    index: string;
    table: string;
}

const SESSION_TOKEN_HASH_COLUMN: SchemaColumnDefinition = {
    table: "sec_auth_session",
    column: "token_hash_auth_session",
    definition: "ALTER TABLE sec_auth_session ADD COLUMN token_hash_auth_session VARCHAR(255) NULL COMMENT 'Hash HMAC del token opaco de sesion; nunca almacena el token plano.' AFTER public_id_auth_session",
};

const AUTH_IDENTITY_LOCKOUT_COLUMNS: SchemaColumnDefinition[] = [
    {
        table: "sec_auth_identity",
        column: "failed_login_count_auth_identity",
        definition: "ALTER TABLE sec_auth_identity ADD COLUMN failed_login_count_auth_identity INT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Contador persistente de intentos fallidos de login local.' AFTER password_hash_auth_identity",
    },
    {
        table: "sec_auth_identity",
        column: "locked_until_auth_identity",
        definition: "ALTER TABLE sec_auth_identity ADD COLUMN locked_until_auth_identity DATETIME(3) NULL COMMENT 'Fecha y hora hasta la que queda bloqueada temporalmente la identidad local.' AFTER failed_login_count_auth_identity",
    },
    {
        table: "sec_auth_identity",
        column: "last_failed_login_at_auth_identity",
        definition: "ALTER TABLE sec_auth_identity ADD COLUMN last_failed_login_at_auth_identity DATETIME(3) NULL COMMENT 'Ultima fecha y hora de intento fallido de login local.' AFTER locked_until_auth_identity",
    },
];

const RESET_ACTIVE_KEY_COLUMN: SchemaColumnDefinition = {
    table: "sec_local_password_reset_token",
    column: "active_key_local_password_reset_token",
    definition: "ALTER TABLE sec_local_password_reset_token ADD COLUMN active_key_local_password_reset_token TINYINT AS (CASE WHEN status_local_password_reset_token = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo un token activo por identidad y conservar historicos usados, revocados o expirados.' AFTER user_agent_local_password_reset_token",
};

const SESSION_TOKEN_HASH_INDEX: SchemaIndexDefinition = {
    table: "sec_auth_session",
    index: "uq_sec_auth_session_token_hash",
    definition: "ALTER TABLE sec_auth_session ADD UNIQUE KEY uq_sec_auth_session_token_hash (token_hash_auth_session)",
};

const RESET_ACTIVE_TOKEN_INDEX: SchemaIndexDefinition = {
    table: "sec_local_password_reset_token",
    index: "uq_sec_local_password_reset_active",
    definition: "ALTER TABLE sec_local_password_reset_token ADD UNIQUE KEY uq_sec_local_password_reset_active (auth_identity_id_local_password_reset_token, active_key_local_password_reset_token)",
};

const LOCAL_PASSWORD_RESET_TABLE = `
CREATE TABLE IF NOT EXISTS sec_local_password_reset_token (
  id_local_password_reset_token BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del token de activacion/reset local.',
  auth_identity_id_local_password_reset_token BIGINT UNSIGNED NOT NULL COMMENT 'Identidad local que solicito activacion o reset de clave.',
  token_hash_local_password_reset_token VARCHAR(255) NOT NULL COMMENT 'Hash HMAC del token opaco de reset; nunca almacena el token plano.',
  status_local_password_reset_token VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del token: active, used, revoked o expired.',
  requested_at_local_password_reset_token DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora de solicitud del token.',
  expires_at_local_password_reset_token DATETIME(3) NOT NULL COMMENT 'Fecha y hora de expiracion del token.',
  used_at_local_password_reset_token DATETIME(3) NULL COMMENT 'Fecha y hora en que el token fue consumido correctamente.',
  revoked_at_local_password_reset_token DATETIME(3) NULL COMMENT 'Fecha y hora de revocacion manual o automatica del token.',
  ip_address_local_password_reset_token VARCHAR(80) NULL COMMENT 'Direccion IP desde donde se pidio el reset.',
  user_agent_local_password_reset_token VARCHAR(500) NULL COMMENT 'User agent desde donde se pidio el reset.',
  active_key_local_password_reset_token TINYINT AS (CASE WHEN status_local_password_reset_token = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Clave generada para permitir solo un token activo por identidad y conservar historicos usados, revocados o expirados.',
  PRIMARY KEY (id_local_password_reset_token),
  UNIQUE KEY uq_sec_local_password_reset_token_hash (token_hash_local_password_reset_token),
  UNIQUE KEY uq_sec_local_password_reset_active (auth_identity_id_local_password_reset_token, active_key_local_password_reset_token),
  KEY ix_sec_local_password_reset_identity_status (auth_identity_id_local_password_reset_token, status_local_password_reset_token),
  KEY ix_sec_local_password_reset_expires_at (expires_at_local_password_reset_token),
  CONSTRAINT fk_sec_local_password_reset_identity FOREIGN KEY (auth_identity_id_local_password_reset_token) REFERENCES sec_auth_identity (id_auth_identity) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Tokens opacos hasheados para activacion y reset de login local.'
`;

/**
 * Consulta existencia de una tabla en la base actualmente seleccionada.
 */
const hasTable = async (db: Kysely<unknown>, tableName: string): Promise<boolean> => {
    const result = await sql<InformationSchemaCount>`
        SELECT COUNT(*) AS found_count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
    `.execute(db);

    return (result.rows[0]?.found_count ?? 0) > 0;
};

/**
 * Consulta existencia de una columna sin depender de errores de ALTER TABLE.
 */
const hasColumn = async (db: Kysely<unknown>, tableName: string, columnName: string): Promise<boolean> => {
    const result = await sql<InformationSchemaCount>`
        SELECT COUNT(*) AS found_count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
          AND COLUMN_NAME = ${columnName}
    `.execute(db);

    return (result.rows[0]?.found_count ?? 0) > 0;
};

/**
 * Consulta existencia de un indice para poder re-ejecutar la migracion.
 */
const hasIndex = async (db: Kysely<unknown>, tableName: string, indexName: string): Promise<boolean> => {
    const result = await sql<InformationSchemaCount>`
        SELECT COUNT(*) AS found_count
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
          AND INDEX_NAME = ${indexName}
    `.execute(db);

    return (result.rows[0]?.found_count ?? 0) > 0;
};

/**
 * Aplica una sentencia DDL fija ya revisada por arquitectura.
 */
const executeSchemaStatement = async (db: Kysely<unknown>, statement: string): Promise<void> => {
    await sql.raw(statement).execute(db);
};

/**
 * Agrega una columna solo si falta.
 */
const addColumnIfMissing = async (db: Kysely<unknown>, columnDefinition: SchemaColumnDefinition): Promise<void> => {
    if (await hasColumn(db, columnDefinition.table, columnDefinition.column)) {
        return;
    }

    await executeSchemaStatement(db, columnDefinition.definition);
};

/**
 * Agrega un indice solo si falta.
 */
const addIndexIfMissing = async (db: Kysely<unknown>, indexDefinition: SchemaIndexDefinition): Promise<void> => {
    if (await hasIndex(db, indexDefinition.table, indexDefinition.index)) {
        return;
    }

    await executeSchemaStatement(db, indexDefinition.definition);
};

/**
 * Crea o completa la estructura de reset local de forma re-ejecutable.
 */
const ensureLocalPasswordResetTable = async (db: Kysely<unknown>): Promise<void> => {
    if (!(await hasTable(db, "sec_local_password_reset_token"))) {
        await executeSchemaStatement(db, LOCAL_PASSWORD_RESET_TABLE);
        return;
    }

    await addColumnIfMissing(db, RESET_ACTIVE_KEY_COLUMN);
    await addIndexIfMissing(db, RESET_ACTIVE_TOKEN_INDEX);
};

/**
 * Migracion de login readiness. Es idempotente por chequeos de metadata, no por
 * confiar en que MySQL ignore errores de ALTER TABLE.
 */
export const identityLoginReadinessMigration = {
    name: "202609250003_identity_login_readiness",
    async up(db: Kysely<unknown>): Promise<void> {
        await addColumnIfMissing(db, SESSION_TOKEN_HASH_COLUMN);
        await addIndexIfMissing(db, SESSION_TOKEN_HASH_INDEX);

        for (const column of AUTH_IDENTITY_LOCKOUT_COLUMNS) {
            await addColumnIfMissing(db, column);
        }

        await ensureLocalPasswordResetTable(db);
    },
};
