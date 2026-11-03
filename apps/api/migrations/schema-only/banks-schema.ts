import { type Kysely, sql } from "kysely";

/** DDL único: ambos destinos tienen exactamente el mismo contrato, con PK/FK locales. */
export const bankTableDefinitions = [
    {
        name: "crm_bank",
        ddl: `CREATE TABLE crm_bank (
 id_bank BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno local del banco.',
 public_id_bank CHAR(26) NOT NULL COMMENT 'Identificador publico ULID compartido entre fuentes.',
 name_bank VARCHAR(250) NOT NULL COMMENT 'Nombre unico del banco sin distinguir mayusculas.',
 status_bank VARCHAR(8) NOT NULL DEFAULT 'active' COMMENT 'Estado operativo activo o inactivo del banco.',
 version_bank INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version para control de concurrencia optimista.',
 created_at_bank DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC de creacion del banco.',
 updated_at_bank DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC de ultima modificacion del banco.',
 PRIMARY KEY (id_bank),
 UNIQUE KEY uq_crm_bank_public_id (public_id_bank),
 UNIQUE KEY uq_crm_bank_name (name_bank),
 CONSTRAINT ck_crm_bank_status CHECK (status_bank IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Catalogo compartido de bancos.'`,
    },
    {
        name: "crm_bank_advisor",
        ddl: `CREATE TABLE crm_bank_advisor (
 id_bank_advisor BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno local del ejecutivo bancario.',
 public_id_bank_advisor CHAR(26) NOT NULL COMMENT 'Identificador publico ULID compartido entre fuentes.',
 bank_id_bank_advisor BIGINT UNSIGNED NOT NULL COMMENT 'Banco asociado mediante su identificador local.',
 name_bank_advisor VARCHAR(250) NOT NULL COMMENT 'Nombre completo del ejecutivo bancario.',
 email_bank_advisor VARCHAR(254) NOT NULL COMMENT 'Correo unico del ejecutivo dentro de su banco.',
 phone_bank_advisor VARCHAR(40) NOT NULL COMMENT 'Telefono de contacto del ejecutivo.',
 area_bank_advisor VARCHAR(120) NOT NULL COMMENT 'Area de atencion del ejecutivo bancario.',
 status_bank_advisor VARCHAR(8) NOT NULL DEFAULT 'active' COMMENT 'Estado operativo activo o inactivo del ejecutivo.',
 version_bank_advisor INT UNSIGNED NOT NULL DEFAULT 1 COMMENT 'Version para control de concurrencia optimista.',
 created_at_bank_advisor DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC de creacion del ejecutivo.',
 updated_at_bank_advisor DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha UTC de ultima modificacion del ejecutivo.',
 PRIMARY KEY (id_bank_advisor),
 UNIQUE KEY uq_crm_bank_advisor_public_id (public_id_bank_advisor),
 UNIQUE KEY uq_crm_bank_advisor_email (bank_id_bank_advisor,email_bank_advisor),
 KEY ix_crm_bank_advisor_search (bank_id_bank_advisor,status_bank_advisor,name_bank_advisor,id_bank_advisor),
 CONSTRAINT fk_crm_bank_advisor_bank FOREIGN KEY (bank_id_bank_advisor) REFERENCES crm_bank (id_bank) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT ck_crm_bank_advisor_status CHECK (status_bank_advisor IN ('active','inactive'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Ejecutivos bancarios por banco.'`,
    },
] as const;

/** Normaliza exclusivamente diferencias de representación de SHOW CREATE de MySQL 8. */
export function normalizeBankDdl(ddl: string): string {
    return ddl
        .replace(/DEFAULT\s+'1'/gi, "DEFAULT 1")
        .split(/('(?:''|[^'])*')/)
        .map((token, index) =>
            index % 2
                ? token
                : token
                      .replace(/AUTO_INCREMENT=\d+/gi, "")
                      .replace(/_utf8mb4/gi, "")
                      .replace(/\b(?:bigint|int)\(\d+\)/gi, (type) => type.slice(0, type.indexOf("(")))
                      .replace(/\bON (?:DELETE|UPDATE) RESTRICT\b/gi, "")
                      .replace(/`/g, "")
                      .replace(/[\s()]/g, "")
                      .toLowerCase(),
        )
        .join("");
}

/** SHOW CREATE cubre columnas, defaults, comentarios, indices, FK y CHECK enforced. */
async function assertExistingBankTable(db: Kysely<unknown>, definition: (typeof bankTableDefinitions)[number], table: { table_type: string; engine: string; collation: string }): Promise<void> {
    if (table.table_type !== "BASE TABLE" || table.engine !== "InnoDB" || table.collation !== "utf8mb4_unicode_ci") throw new Error(`Banks schema drift: ${definition.name}`);
    const result = await sql<Record<string, unknown>>`SHOW CREATE TABLE ${sql.id(definition.name)}`.execute(db);
    const actual = result.rows[0]?.["Create Table"];
    if (typeof actual !== "string" || normalizeBankDdl(actual) !== normalizeBankDdl(definition.ddl)) throw new Error(`Banks schema drift: ${definition.name}; reconcile explicitly before retry`);
}

/** Windows pliega nombres de esquema; Linux sensible a mayusculas exige el nombre exacto. */
export async function assertBankSchemaDestination(db: Kysely<unknown>, schema: "CRM_THINK_V2" | "crmdatabase-api"): Promise<void> {
    const destination = (await sql<{ name: string; fold_names: number }>`SELECT DATABASE() AS name,@@lower_case_table_names AS fold_names`.execute(db)).rows[0];
    if (destination?.name === schema) return;
    if (destination?.fold_names && destination.name.toLowerCase() === schema.toLowerCase()) return;
    throw new Error("Banks schema destination mismatch");
}

/** Preflight de TODAS las tablas antes de crear ninguna; nunca adopta drift ni vistas. */
export async function planBankTables(db: Kysely<unknown>, schema: "CRM_THINK_V2" | "crmdatabase-api"): Promise<string[]> {
    await assertBankSchemaDestination(db, schema);
    const existing = (await sql<{ table_name: string; table_type: string; engine: string; collation: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('crm_bank','crm_bank_advisor')`.execute(db)).rows;
    const statements: string[] = [];
    for (const definition of bankTableDefinitions) {
        const table = existing.find((candidate) => candidate.table_name === definition.name);
        if (!table) {
            statements.push(definition.ddl);
            continue;
        }
        await assertExistingBankTable(db, definition, table);
    }
    return statements;
}
