import { type Kysely, sql } from "kysely";

// ============================================================================
// Migracion schema-only idempotente para Microsoft OIDC.
//
// No inserta datos y no toca ninguna base externa. Solo prepara CRM_THINK_V2
// para persistir cache MSAL cifrada, foto cacheada y proveedor de sesion.
// ============================================================================

interface InformationSchemaCount {
    found_count: number;
}

interface SchemaColumnDefinition {
    column: string;
    definition: string;
    table: string;
}

const SESSION_PROVIDER_COLUMN: SchemaColumnDefinition = {
    table: "sec_auth_session",
    column: "provider_code_auth_session",
    definition: "ALTER TABLE sec_auth_session ADD COLUMN provider_code_auth_session VARCHAR(40) NOT NULL DEFAULT 'local' COMMENT 'Proveedor que origino la sesion CRM: local o microsoft.' AFTER auth_identity_id_auth_session",
};

const MICROSOFT_ACCOUNT_TABLE = `
CREATE TABLE IF NOT EXISTS sec_microsoft_account (
  id_microsoft_account BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno del estado Microsoft asociado a una identidad CRM.',
  auth_identity_id_microsoft_account BIGINT UNSIGNED NOT NULL COMMENT 'Identidad CRM del proveedor Microsoft.',
  home_account_id_microsoft_account VARCHAR(255) NOT NULL COMMENT 'homeAccountId MSAL; identifica la cuenta dentro del cache Microsoft.',
  tenant_id_microsoft_account VARCHAR(100) NOT NULL COMMENT 'Tenant Microsoft asociado a la cuenta.',
  oid_microsoft_account VARCHAR(100) NOT NULL COMMENT 'Object ID o localAccountId devuelto por Microsoft.',
  subject_microsoft_account VARCHAR(255) NOT NULL COMMENT 'Subject canonico usado para enlazar Microsoft con la identidad CRM.',
  cache_ciphertext_microsoft_account MEDIUMTEXT NOT NULL COMMENT 'Cache MSAL cifrada con AES-256-GCM; puede contener refresh tokens Microsoft protegidos.',
  cache_iv_microsoft_account VARCHAR(64) NOT NULL COMMENT 'IV base64 usado para cifrar la cache MSAL.',
  cache_tag_microsoft_account VARCHAR(64) NOT NULL COMMENT 'Tag GCM base64 usado para autenticar la cache MSAL.',
  cache_key_version_microsoft_account SMALLINT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version de llave usada para cifrar la cache MSAL.',
  cache_synced_at_microsoft_account DATETIME(3) NOT NULL COMMENT 'Fecha y hora de ultima escritura de cache MSAL cifrada.',
  graph_synced_at_microsoft_account DATETIME(3) NULL COMMENT 'Fecha y hora de ultima sincronizacion Graph.',
  interaction_required_at_microsoft_account DATETIME(3) NULL COMMENT 'Fecha y hora en que MSAL indico que requiere login interactivo de nuevo.',
  last_silent_token_at_microsoft_account DATETIME(3) NULL COMMENT 'Fecha y hora de ultima renovacion silenciosa exitosa.',
  status_microsoft_account VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del enlace Microsoft: active, inactive o revoked.',
  created_at_microsoft_account DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion del enlace Microsoft.',
  updated_at_microsoft_account DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha de ultima actualizacion del enlace Microsoft.',
  PRIMARY KEY (id_microsoft_account),
  UNIQUE KEY uq_sec_microsoft_account_identity (auth_identity_id_microsoft_account),
  UNIQUE KEY uq_sec_microsoft_account_home_tenant (home_account_id_microsoft_account, tenant_id_microsoft_account),
  KEY ix_sec_microsoft_account_subject (tenant_id_microsoft_account, subject_microsoft_account),
  KEY ix_sec_microsoft_account_status (status_microsoft_account),
  CONSTRAINT fk_sec_microsoft_account_identity FOREIGN KEY (auth_identity_id_microsoft_account) REFERENCES sec_auth_identity (id_auth_identity) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Metadata Microsoft segura y cache MSAL cifrada por identidad.'
`;

const USER_PROFILE_IMAGE_TABLE = `
CREATE TABLE IF NOT EXISTS sec_user_profile_image (
  id_user_profile_image BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la imagen de perfil cacheada.',
  user_id_user_profile_image BIGINT UNSIGNED NOT NULL COMMENT 'Usuario canonico CRM al que pertenece la imagen.',
  provider_code_user_profile_image VARCHAR(40) NOT NULL COMMENT 'Proveedor origen de la imagen: microsoft u otro futuro.',
  source_subject_user_profile_image VARCHAR(255) NULL COMMENT 'Subject externo origen de la imagen, sin usarlo como ID canonico publico.',
  mime_type_user_profile_image VARCHAR(100) NOT NULL COMMENT 'MIME type de la imagen cacheada.',
  image_sha256_user_profile_image CHAR(64) NOT NULL COMMENT 'SHA-256 de la imagen para detectar cambios sin exponer contenido.',
  image_bytes_user_profile_image MEDIUMBLOB NOT NULL COMMENT 'Contenido binario cacheado de foto de perfil.',
  public_url_user_profile_image VARCHAR(500) NOT NULL COMMENT 'URL interna segura que el frontend puede usar como profileImageUrl.',
  fetched_at_user_profile_image DATETIME(3) NOT NULL COMMENT 'Fecha y hora en que se obtuvo la imagen del proveedor.',
  expires_at_user_profile_image DATETIME(3) NULL COMMENT 'Fecha opcional de expiracion del cache de imagen.',
  status_user_profile_image VARCHAR(40) NOT NULL DEFAULT 'active' COMMENT 'Estado del cache: active, inactive o revoked.',
  active_key_user_profile_image TINYINT AS (CASE WHEN status_user_profile_image = 'active' THEN 1 ELSE NULL END) STORED COMMENT 'Permite una imagen activa por usuario/proveedor y multiples historicos inactivos.',
  created_at_user_profile_image DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha de creacion del cache de imagen.',
  updated_at_user_profile_image DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT 'Fecha de ultima actualizacion del cache de imagen.',
  PRIMARY KEY (id_user_profile_image),
  UNIQUE KEY uq_sec_user_profile_image_active (user_id_user_profile_image, provider_code_user_profile_image, active_key_user_profile_image),
  KEY ix_sec_user_profile_image_user_status (user_id_user_profile_image, status_user_profile_image),
  CONSTRAINT fk_sec_user_profile_image_user FOREIGN KEY (user_id_user_profile_image) REFERENCES sec_user (id_user) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci
  COMMENT='Cache interno de imagen de perfil de usuario sin depender del token Microsoft en el frontend.'
`;

const hasTable = async (db: Kysely<unknown>, tableName: string): Promise<boolean> => {
    const result = await sql<InformationSchemaCount>`
        SELECT COUNT(*) AS found_count
        FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ${tableName}
    `.execute(db);

    return (result.rows[0]?.found_count ?? 0) > 0;
};

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

const executeSchemaStatement = async (db: Kysely<unknown>, statement: string): Promise<void> => {
    await sql.raw(statement).execute(db);
};

const addColumnIfMissing = async (db: Kysely<unknown>, columnDefinition: SchemaColumnDefinition): Promise<void> => {
    if (await hasColumn(db, columnDefinition.table, columnDefinition.column)) {
        return;
    }

    await executeSchemaStatement(db, columnDefinition.definition);
};

const createTableIfMissing = async (db: Kysely<unknown>, tableName: string, statement: string): Promise<void> => {
    if (await hasTable(db, tableName)) {
        return;
    }

    await executeSchemaStatement(db, statement);
};

export const identityMicrosoftSessionMigration = {
    name: "202609280004_identity_microsoft_session",
    async up(db: Kysely<unknown>): Promise<void> {
        await addColumnIfMissing(db, SESSION_PROVIDER_COLUMN);
        await createTableIfMissing(db, "sec_microsoft_account", MICROSOFT_ACCOUNT_TABLE);
        await createTableIfMissing(db, "sec_user_profile_image", USER_PROFILE_IMAGE_TABLE);
    },
};
