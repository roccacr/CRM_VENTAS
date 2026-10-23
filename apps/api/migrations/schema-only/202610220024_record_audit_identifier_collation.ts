import { type Kysely, sql } from "kysely";

import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

const identityFields = ["source_schema_record", "entity_type_record", "source_table_record", "source_id_record"];
const expectedColumns = [
    ["audit_record", "source_schema_record", 64, "Esquema de origen al identificar el registro; CRM_THINK_V2 o crmdatabase-api"],
    ["audit_record", "entity_type_record", 64, "Tipo canonico del registro; sales_order, lead u otra entidad autorizada"],
    ["audit_record", "source_table_record", 64, "Tabla fisica original; referencia logica sin FK a la tabla comercial"],
    ["audit_record", "source_id_record", 191, "Clave primaria original como texto; no es el ID del proveedor ERP"],
    ["audit_record_event", "operation_id_record_event", 100, "Clave idempotente por registro; reintentos deben comparar el contenido completo"],
] as const;

// Static reviewed DDL: never derive identifiers or definitions from database metadata.
// Event source text keeps its original collation. Resolve identity through the ASCII record FK;
// future source-text joins need explicit comparison semantics or canonical resolution.
const statements = [
    `ALTER TABLE audit_record
    MODIFY COLUMN source_schema_record VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'Esquema de origen al identificar el registro; CRM_THINK_V2 o crmdatabase-api',
    MODIFY COLUMN entity_type_record VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'Tipo canonico del registro; sales_order, lead u otra entidad autorizada',
    MODIFY COLUMN source_table_record VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'Tabla fisica original; referencia logica sin FK a la tabla comercial',
    MODIFY COLUMN source_id_record VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'Clave primaria original como texto; no es el ID del proveedor ERP'`,
    `ALTER TABLE audit_record_event
    MODIFY COLUMN operation_id_record_event VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT 'Clave idempotente por registro; reintentos deben comparar el contenido completo'`,
];

const expectedIndexes = [...identityFields.map((column_name, index) => ({ table_name: "audit_record", index_name: "uq_audit_record_identity", column_name, seq_in_index: index + 1, non_unique: 0, sub_part: null })), ...["record_id_record_event", "operation_id_record_event"].map((column_name, index) => ({ table_name: "audit_record_event", index_name: "uq_audit_record_event_operation", column_name, seq_in_index: index + 1, non_unique: 0, sub_part: null }))];

/** Validate the complete bounded inventory before issuing either ALTER. */
const assertMetadata = (rows: Record<string, unknown>[], expected: Record<string, unknown>[], message: string): void => {
    if (rows.length !== expected.length || !expected.every((definition) => rows.some((row) => Object.entries(definition).every(([key, value]) => row[key] === value)))) throw new Error(message);
};

/** Corrects audit identifier comparisons without changing the applied 023 artifact. */
export const recordAuditIdentifierCollationMigration = {
    name: "202610220024_record_audit_identifier_collation",
    async up(db: Kysely<unknown>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== APPROVED_DATABASE_NAME) throw new Error("Record audit identifier correction requires CRM_THINK_V2");
        const collation = await sql<Record<string, unknown>>`SELECT COLLATION_NAME AS collation_name, CHARACTER_SET_NAME AS character_set_name, PAD_ATTRIBUTE AS pad_attribute FROM information_schema.COLLATIONS WHERE COLLATION_NAME = 'utf8mb4_0900_bin'`.execute(db);
        assertMetadata(collation.rows, [{ collation_name: "utf8mb4_0900_bin", character_set_name: "utf8mb4", pad_attribute: "NO PAD" }], "Record audit identifiers require utf8mb4_0900_bin with NO PAD support");
        const tables = await sql<Record<string, unknown>>`SELECT TABLE_NAME AS table_name, TABLE_TYPE AS table_type, ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('audit_record', 'audit_record_event')`.execute(db);
        assertMetadata(
            tables.rows,
            ["audit_record", "audit_record_event"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" })),
            "Incompatible audit tables; DBA reconciliation required",
        );
        const columns = await sql<
            Record<string, unknown>
        >`SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name, DATA_TYPE AS data_type, CHARACTER_MAXIMUM_LENGTH AS character_maximum_length, IS_NULLABLE AS is_nullable, CHARACTER_SET_NAME AS character_set_name, COLLATION_NAME AS collation_name, COLUMN_DEFAULT AS column_default, EXTRA AS extra, COLUMN_COMMENT AS column_comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'audit_record' AND COLUMN_NAME IN ('source_schema_record', 'entity_type_record', 'source_table_record', 'source_id_record')) OR (TABLE_NAME = 'audit_record_event' AND COLUMN_NAME = 'operation_id_record_event'))`.execute(
            db,
        );
        assertMetadata(
            columns.rows,
            expectedColumns.map(([table_name, column_name, character_maximum_length, column_comment]) => ({ table_name, column_name, character_maximum_length, column_comment, data_type: "varchar", is_nullable: "NO", character_set_name: "utf8mb4", collation_name: "utf8mb4_bin", column_default: null, extra: "" })),
            "Incompatible audit identifier columns; DBA reconciliation required",
        );
        const indexes = await sql<Record<string, unknown>>`SELECT TABLE_NAME AS table_name, INDEX_NAME AS index_name, COLUMN_NAME AS column_name, SEQ_IN_INDEX AS seq_in_index, NON_UNIQUE AS non_unique, SUB_PART AS sub_part FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND ((TABLE_NAME = 'audit_record' AND INDEX_NAME = 'uq_audit_record_identity') OR (TABLE_NAME = 'audit_record_event' AND INDEX_NAME = 'uq_audit_record_event_operation'))`.execute(db);
        assertMetadata(indexes.rows, expectedIndexes, "Incompatible audit unique indexes; DBA reconciliation required");
        // MySQL DDL commits independently. On either failure, stop for DBA reconciliation; never undo or retry automatically.
        for (const statement of statements) await sql.raw(statement).execute(db);
    },
};
