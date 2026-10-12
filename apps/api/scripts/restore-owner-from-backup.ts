import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { type Connection, createConnection, type RowDataPacket } from "mysql2/promise";

import { splitSqlStatements, stripLineComments } from "../migrations/schema-only/202609250001_identity_schema.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

const OWNER_EMAIL = "rzuniga@roccacr.com";
// Approved pre-reset artifact only. Never execute arbitrary SQL backups as bootstrap input.
const APPROVED_BACKUP_SHA256 = "d8f88f5185a3df9f1e099a0d8533cfeab2a329edcf19648138c019d913ec2096";
const TABLES = ["sec_user", "sec_auth_identity", "sec_role", "sec_permission", "sec_org_unit"] as const;
type RecoveryTable = (typeof TABLES)[number];
type RecoveryValue = string | number | null | Date;
type RecoveryRow = Record<string, RecoveryValue>;
type RecoveryRows = Record<RecoveryTable, RecoveryRow[]>;

/** Restore identity, not sessions, external-provider tokens, other users or business data. */
export const selectOwnerRecoveryRows = (snapshot: RecoveryRows): RecoveryRows => {
    const users = snapshot.sec_user.filter((row) => row.normalized_email_user === OWNER_EMAIL);
    const roles = snapshot.sec_role.filter((row) => row.code_role === "owner" && row.status_role === "active");
    if (users.length !== 1 || roles.length !== 1) throw new Error("Recovery requires exactly one Roberto identity and one active Owner role");
    const identities = snapshot.sec_auth_identity.filter((row) => row.user_id_auth_identity === users[0]?.id_user);
    if (identities.length === 0) throw new Error("Owner authentication identity missing");
    return {
        sec_user: users,
        sec_auth_identity: identities,
        sec_role: roles,
        sec_permission: snapshot.sec_permission.filter((row) => row.status_permission === "active"),
        sec_org_unit: snapshot.sec_org_unit.filter((row) => row.status_org_unit === "active"),
    };
};

const loadSnapshot = async (connection: Connection, backup: Buffer): Promise<RecoveryRows> => {
    const snapshot: RecoveryRows = { sec_user: [], sec_auth_identity: [], sec_role: [], sec_permission: [], sec_org_unit: [] };
    for (const statement of splitSqlStatements(stripLineComments(backup.toString("utf8")))) {
        const match = /^INSERT INTO `CRM_THINK_V2`\.`(sec_user|sec_auth_identity|sec_role|sec_permission|sec_org_unit)` \(([^)]+)\) VALUES \(([\s\S]*)\)$/.exec(statement);
        if (!match?.[2] || !match[3]) continue;
        const table = match[1] as RecoveryTable;
        const columns = match[2].split(",").map((column) => column.trim().replaceAll("`", ""));
        // Decode literals from the checksum-pinned snapshot; no backup DDL/DML is executed.
        const [values] = await connection.query<RowDataPacket[]>({ sql: `SELECT ${match[3]}`, rowsAsArray: true });
        const row = values[0] as unknown as RecoveryValue[];
        if (row.length !== columns.length) throw new Error("Invalid backup row");
        snapshot[table].push(Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])));
    }
    return selectOwnerRecoveryRows(snapshot);
};

const assertEmptyIdentity = async (connection: Connection): Promise<void> => {
    for (const table of TABLES) {
        const [rows] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${table}\``);
        if (Number(rows[0]?.count) !== 0) throw new Error("Recovery requires empty identity configuration");
    }
};

const insertRecoveryRow = async (connection: Connection, table: RecoveryTable, original: RecoveryRow, ownerId: RecoveryValue): Promise<void> => {
    const row = { ...original };
    // Actor references from the snapshot can point to excluded users. Keep only self references.
    for (const column of Object.keys(row)) {
        if (column.includes("_by_user_id_") && row[column] !== ownerId) row[column] = null;
    }
    if (table === "sec_user") {
        row.status_user = "active";
        row.deleted_at_user = null;
    }
    const columns = Object.keys(row);
    await connection.execute(`INSERT INTO \`${table}\` (${columns.map((column) => `\`${column}\``).join(",")}) VALUES (${columns.map(() => "?").join(",")})`, Object.values(row));
};

const insertRecoveryRows = async (connection: Connection, selected: RecoveryRows): Promise<void> => {
    const ownerId = selected.sec_user[0]?.id_user ?? null;
    const roleId = selected.sec_role[0]?.id_role ?? null;
    for (const table of ["sec_user", "sec_role", "sec_permission", "sec_org_unit", "sec_auth_identity"] as const) {
        for (const row of selected[table]) await insertRecoveryRow(connection, table, row, ownerId);
    }
    await connection.execute("INSERT INTO sec_user_role (user_id_user_role, role_id_user_role, status_user_role, assigned_at_user_role, assigned_by_user_id_user_role) VALUES (?, ?, 'active', CURRENT_TIMESTAMP(3), ?)", [ownerId, roleId, ownerId]);
    await connection.execute("INSERT INTO sec_role_permission (role_id_role_permission, permission_id_role_permission, status_role_permission, created_at_role_permission) SELECT ?, id_permission, 'active', CURRENT_TIMESTAMP(3) FROM sec_permission WHERE status_permission = 'active'", [roleId]);
    await connection.execute("INSERT INTO sec_user_org_unit (user_id_user_org_unit, org_unit_id_user_org_unit, membership_code_user_org_unit, scope_code_user_org_unit, status_user_org_unit, assigned_at_user_org_unit, assigned_by_user_id_user_org_unit) SELECT ?, id_org_unit, 'member', 'all_areas', 'active', CURRENT_TIMESTAMP(3), ? FROM sec_org_unit WHERE status_org_unit = 'active'", [ownerId, ownerId]);
};

const prepareRecovery = async (): Promise<{ backup: Buffer; connection: Connection }> => {
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    if (process.env.OWNER_RECOVERY_CONFIRM !== OWNER_EMAIL || !process.env.OWNER_RECOVERY_BACKUP) throw new Error("Explicit owner and backup confirmation required");
    const backup = await readFile(process.env.OWNER_RECOVERY_BACKUP);
    if (createHash("sha256").update(backup).digest("hex") !== APPROVED_BACKUP_SHA256) throw new Error("Backup checksum does not match approved recovery artifact");
    const connection = await createConnection(buildMysqlPoolOptions({ database: env.DB_NAME, host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) }));
    return { backup, connection };
};

const run = async (): Promise<void> => {
    const { backup, connection } = await prepareRecovery();
    let stage = "target";
    try {
        const [database] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name");
        if (database[0]?.name !== "CRM_THINK_V2") throw new Error("Unexpected target database");
        stage = "snapshot";
        const selected = await loadSnapshot(connection, backup);
        stage = "empty-check";
        await connection.beginTransaction();
        await assertEmptyIdentity(connection);
        stage = "insert";
        await insertRecoveryRows(connection, selected);
        stage = "commit";
        await connection.commit();
        console.log(JSON.stringify({ database: "CRM_THINK_V2", owner: OWNER_EMAIL, users: 1, roles: 1, identities: selected.sec_auth_identity.length, permissions: selected.sec_permission.length, modules: selected.sec_org_unit.length, businessRowsInserted: 0 }));
    } catch (error) {
        await connection.rollback();
        // Driver errors can contain SQL with password hashes; never print the original exception.
        const code = typeof error === "object" && error !== null && "code" in error ? String(error.code).replaceAll(/[^A-Z_0-9]/g, "") : "PRECONDITION";
        console.error(JSON.stringify({ stage, code }));
        process.exitCode = 1;
    } finally {
        await connection.end();
    }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
    void run().catch(() => {
        console.error("Owner recovery failed. Verify target, confirmation, checksum and empty identity tables.");
        process.exitCode = 1;
    });
}
