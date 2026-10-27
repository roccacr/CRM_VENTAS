import { pathToFileURL } from "node:url";

import { type Connection, createConnection, type RowDataPacket } from "mysql2/promise";

import { APPROVED_DATABASE_NAME } from "../src/config/product.constants.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

// Explicit owner authorization: retain ALL users and access configuration, not just Owner.
const preservedTables = ["conf_schema_migration", "int_external_system", "int_user_external_identity", "sec_auth_identity", "sec_microsoft_account", "sec_org_unit", "sec_permission", "sec_role", "sec_role_module", "sec_role_permission", "sec_user", "sec_user_org_unit", "sec_user_permission_override", "sec_user_profile_image", "sec_user_role"] as const;
const clearTables = [
    "audit_lead_status_event",
    "audit_record",
    "audit_record_event",
    "audit_sales_order_approval_event",
    "audit_sales_order_change",
    "audit_sales_order_state_event",
    "audit_security_event",
    "conf_action_reason",
    "conf_action_reason_action",
    "conf_action_reason_status",
    "conf_calendar_event_type",
    "conf_lead_action_type",
    "conf_lead_interest",
    "conf_lead_source",
    "conf_lead_status",
    "conf_sales_order_approval_type",
    "conf_sales_order_state",
    "crm_broker",
    "crm_broker_external_reference",
    "crm_calendar_appointment",
    "crm_calendar_event",
    "crm_calendar_event_link",
    "crm_calendar_notification",
    "crm_calendar_participant",
    "crm_campaign",
    "crm_campaign_external_reference",
    "crm_catalog_item",
    "crm_catalog_item_external_reference",
    "crm_class",
    "crm_class_external_reference",
    "crm_contact",
    "crm_lead",
    "crm_lead_activity",
    "crm_lead_external_reference",
    "crm_location",
    "crm_location_external_reference",
    "crm_project",
    "crm_project_external_reference",
    "crm_sales_order",
    "crm_sales_order_approval",
    "crm_sales_order_external_reference",
    "crm_subsidiary",
    "crm_subsidiary_external_reference",
    "crm_unit_file",
    "crm_unit_file_external_reference",
    "int_calendar_connection",
    "int_calendar_event_sync",
    "int_lead_history_entry",
    "int_lead_history_link",
    "int_sales_order_source_snapshot",
    "sec_auth_session",
    "sec_local_password_reset_token",
    "sec_refresh_token",
] as const;
const lockName = "crm_think_v2_schema_migration";
type Counts = Record<string, number>;
interface CleanupPlan {
    preserve: string[];
    clear: string[];
}
interface ForeignKey extends RowDataPacket {
    tableSchema: string;
    tableName: string;
    name: string;
    columnName: string;
    ordinal: number;
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
}

/** Both connection configuration and server-selected database must match exactly. */
export function assertCleanupTarget(target: string | undefined, foreignKeys: readonly { tableSchema: string; referencedSchema: string }[]): void {
    if (target !== APPROVED_DATABASE_NAME) throw new Error("Cleanup is restricted to the exact CRM_THINK_V2 schema");
    if (foreignKeys.some((key) => key.tableSchema !== APPROVED_DATABASE_NAME || key.referencedSchema !== APPROVED_DATABASE_NAME)) throw new Error("Cross-schema foreign keys forbid native cleanup");
}

/** Every dynamic identifier comes from reviewed metadata, never from CLI input. */
function identifier(name: string): string {
    if (!/^[a-z][a-z0-9_]*$/.test(name)) throw new Error("Unexpected SQL identifier");
    return `\`${name}\``;
}

/** Destructive statements always include the literal approved schema. */
export function qualifiedTable(table: string): string {
    return `\`${APPROVED_DATABASE_NAME}\`.${identifier(table)}`;
}

/** New security tables require review; a naming convention alone must never erase identity configuration. */
export function buildCleanupPlan(tables: readonly string[]): CleanupPlan {
    const preserve: string[] = [];
    const clear: string[] = [];
    for (const table of new Set(tables)) {
        identifier(table);
        if ((preservedTables as readonly string[]).includes(table)) preserve.push(table);
        else if ((clearTables as readonly string[]).includes(table)) clear.push(table);
        else throw new Error("Unreviewed native table blocks cleanup");
    }
    return { preserve: preserve.sort(), clear: clear.sort() };
}

/** A preserved user/configuration row must never become orphaned by this operation. */
export function assertPreservedDependencies(plan: CleanupPlan, keys: readonly { tableName: string; referencedTable: string }[]): void {
    if (keys.some((key) => plan.preserve.includes(key.tableName) && plan.clear.includes(key.referencedTable))) throw new Error("Preserved configuration depends on a table scheduled for clearing");
}

/** Verification must account for every table, including unchanged user/access counts. */
export function validateCleanupCounts(plan: CleanupPlan, before: Counts, after: Counts): void {
    for (const table of plan.preserve) if (!Number.isSafeInteger(before[table]) || after[table] !== before[table]) throw new Error("Preserved table count changed");
    for (const table of plan.clear) if (after[table] !== 0) throw new Error("A cleared table is not empty");
}

async function tableCounts(connection: Connection, tables: readonly string[]): Promise<Counts> {
    const counts: Counts = {};
    for (const table of tables) {
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${qualifiedTable(table)}`);
        const total = Number(rows[0]?.total);
        if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid native table count");
        counts[table] = total;
    }
    return counts;
}

/** Re-enabling FK checks does not validate existing rows in MySQL; explicitly check every native FK. */
async function verifyForeignKeys(connection: Connection, keys: readonly ForeignKey[]): Promise<void> {
    const grouped = new Map<string, ForeignKey[]>();
    for (const key of keys) {
        const group = `${key.tableName}:${key.name}`;
        grouped.set(group, [...(grouped.get(group) ?? []), key]);
    }
    for (const group of grouped.values()) {
        const first = group[0];
        if (!first) throw new Error("Empty foreign key definition");
        const join = group.map((key) => `c.${identifier(key.columnName)}=p.${identifier(key.referencedColumn)}`).join(" AND ");
        const required = group.map((key) => `c.${identifier(key.columnName)} IS NOT NULL`).join(" AND ");
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${qualifiedTable(first.tableName)} c LEFT JOIN ${qualifiedTable(first.referencedTable)} p ON ${join} WHERE ${required} AND p.${identifier(first.referencedColumn)} IS NULL`);
        if (Number(rows[0]?.total) !== 0) throw new Error("Foreign key verification failed");
    }
}

async function inspect(connection: Connection) {
    const [target] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name");
    assertCleanupTarget(target[0]?.name as string | undefined, []);
    const [keys] = await connection.execute<ForeignKey[]>("SELECT TABLE_SCHEMA AS tableSchema,TABLE_NAME AS tableName,CONSTRAINT_NAME AS name,COLUMN_NAME AS columnName,ORDINAL_POSITION AS ordinal,REFERENCED_TABLE_SCHEMA AS referencedSchema,REFERENCED_TABLE_NAME AS referencedTable,REFERENCED_COLUMN_NAME AS referencedColumn FROM information_schema.KEY_COLUMN_USAGE WHERE (TABLE_SCHEMA=? OR REFERENCED_TABLE_SCHEMA=?) AND REFERENCED_TABLE_SCHEMA IS NOT NULL", [
        APPROVED_DATABASE_NAME,
        APPROVED_DATABASE_NAME,
    ]);
    assertCleanupTarget(target[0]?.name as string | undefined, keys);
    const [tables] = await connection.execute<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME", [APPROVED_DATABASE_NAME]);
    const names = tables.map((table) => String(table.name));
    if (names.length !== preservedTables.length + clearTables.length || ![...preservedTables, ...clearTables].every((table) => names.includes(table))) throw new Error("Native inventory differs from the explicitly reviewed 68 tables");
    const [events] = await connection.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM information_schema.EVENTS WHERE EVENT_SCHEMA=? AND STATUS='ENABLED'", [APPROVED_DATABASE_NAME]);
    if (Number(events[0]?.total) !== 0) throw new Error("Active database events must be reviewed before cleanup");
    const plan = buildCleanupPlan(names);
    assertPreservedDependencies(plan, keys);
    return { plan, keys, before: await tableCounts(connection, names) };
}

/** Default is read-only. Apply is irreversible and must be invoked manually after explicit owner approval. */
async function runCleanup(connection: Connection, apply: boolean): Promise<void> {
    let locked = false;
    let tablesLocked = false;
    try {
        const [lock] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?,30) AS acquired", [lockName]);
        if (Number(lock[0]?.acquired) !== 1) throw new Error("Native migration lock unavailable");
        locked = true;
        const { plan, keys, before: inspectedBefore } = await inspect(connection);
        let before = inspectedBefore;
        if (!apply) {
            console.log(JSON.stringify({ target: APPROVED_DATABASE_NAME, apply: false, preserved: plan.preserve.map((table) => ({ table, rows: before[table] })), cleared: plan.clear.map((table) => ({ table, rows: before[table] })) }));
            return;
        }
        await verifyForeignKeys(connection, keys);
        await connection.query("SET SESSION lock_wait_timeout=5");
        // Native WRITE locks also block clients whose default schema is different.
        await connection.query(`LOCK TABLES ${[...plan.preserve, ...plan.clear].map((table) => `${qualifiedTable(table)} WRITE`).join(",")}`);
        tablesLocked = true;
        before = await tableCounts(connection, [...plan.preserve, ...plan.clear]);
        // TRUNCATE preserves table definitions/triggers and does not fire DELETE triggers.
        // This is a narrowly authorized maintenance exception, never an API audit bypass.
        await connection.query("SET SESSION FOREIGN_KEY_CHECKS=0");
        try {
            for (const table of plan.clear) await connection.query(`TRUNCATE TABLE ${qualifiedTable(table)}`);
        } finally {
            await connection.query("SET SESSION FOREIGN_KEY_CHECKS=1");
        }
        const after = await tableCounts(connection, [...plan.preserve, ...plan.clear]);
        validateCleanupCounts(plan, before, after);
        await connection.query("UNLOCK TABLES");
        tablesLocked = false;
        await verifyForeignKeys(connection, keys);
        console.log(
            JSON.stringify({
                target: APPROVED_DATABASE_NAME,
                apply: true,
                backupCreated: false,
                tablesCleared: plan.clear.length,
                rowsRemoved: plan.clear.reduce((sum, table) => sum + Number(before[table]), 0),
                usersPreserved: after.sec_user,
                rolesPreserved: after.sec_role,
                permissionsPreserved: after.sec_permission,
                verification: { emptyTables: plan.clear.every((table) => after[table] === 0), preservedCountsUnchanged: true, foreignKeysValid: true },
                preserved: plan.preserve.map((table) => ({ table, rows: after[table] })),
            }),
        );
    } finally {
        if (tablesLocked) await connection.query("UNLOCK TABLES");
        if (locked) await connection.execute("SELECT RELEASE_LOCK(?)", [lockName]);
    }
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length > 1 || (args.length === 1 && args[0] !== `--apply=${APPROVED_DATABASE_NAME}`)) throw new Error("Only an empty dry-run or exact --apply=CRM_THINK_V2 is allowed");
    await import("dotenv/config");
    assertCleanupTarget(process.env.DB_NAME, []);
    const env = readSchemaMigrationEnv({ ...process.env, MIGRATION_CONFIRM_SCHEMA_ONLY: APPROVED_DATABASE_NAME });
    const connection = await createConnection(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: APPROVED_DATABASE_NAME, connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) }));
    try {
        await runCleanup(connection, args.length === 1);
    } finally {
        await connection.end();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    void main().catch((error: unknown) => {
        // Never print driver exceptions: they may include SQL, identifiers or credentials.
        const code = error && typeof error === "object" && "code" in error ? String(error.code).replace(/[^A-Z0-9_]/g, "") : "PRECONDITION";
        const message = code === "PRECONDITION" && error instanceof Error ? error.message : "Database operation failed";
        console.error(JSON.stringify({ target: APPROVED_DATABASE_NAME, code, message }));
        process.exitCode = 1;
    });
}
