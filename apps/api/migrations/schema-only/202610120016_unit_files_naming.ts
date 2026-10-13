import { type Kysely, sql } from "kysely";

// Frozen historical mapping: do not import mutable runtime contracts into a migration.
const businessFields = [
    "code",
    "projectNameSnapshot",
    "housingType",
    "lotArea",
    "sourceStatus",
    "advertisedSalePrice",
    "habitableArea",
    "totalArea",
    "approximateMaintenanceFee",
    "unitPlans",
    "estimatedDelivery",
    "storageArea",
    "mezzanineArea",
    "balconyArea",
    "groundFloorArea",
    "upperFloorArea",
    "extensionArea",
    "terraceArea",
    "pricePerSquareMeter",
    "thirdLevelBasementArea",
    "approximateParkingArea",
    "externalGardenArea",
    "slopedGardenArea",
    "openCommonArea",
    "minimumSalePrice",
    "modifiedAt",
    "cronValue",
];

async function rename<DB>(db: Kysely<DB>, table: string, fields: [string, string][]): Promise<void> {
    const result = await sql<{ name: string }>`SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}`.execute(db);
    const names = new Set(result.rows.map((row) => row.name));
    const changes = fields.filter(([old]) => names.has(old)).map(([old, current]) => sql`RENAME COLUMN ${sql.id(old)} TO ${sql.id(current)}`);
    if (changes.length) await sql`ALTER TABLE ${sql.id(table)} ${sql.join(changes)}`.execute(db);
}
/** Data-preserving names-only correction; never alters legacy schema or inserts business data. */
export const unitFilesNamingMigration = {
    name: "202610120016_unit_files_naming",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const identity = await sql<{ db: string }>`SELECT DATABASE() AS db`.execute(db);
        if (identity.rows[0]?.db !== "CRM_THINK_V2") throw new Error("Unit Files migration requires CRM_THINK_V2");
        await rename(
            db,
            "crm_unit_file",
            businessFields.map((field) => [field, `${field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_unit_file`]),
        );
        await rename(db, "crm_unit_file_external_reference", [
            ["unit_file_id", "unit_file_id_unit_file_external_reference"],
            ["external_system_id", "external_system_id_unit_file_external_reference"],
            ["external_id", "external_id_unit_file_external_reference"],
            ["status", "status_unit_file_external_reference"],
            ["created_at", "created_at_unit_file_external_reference"],
            ["updated_at", "updated_at_unit_file_external_reference"],
        ]);
    },
};
