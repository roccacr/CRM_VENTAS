import "dotenv/config";

import { readFile } from "node:fs/promises";

import type { ExecuteValues, RowDataPacket } from "mysql2";
import { createPool, type Pool, type PoolOptions } from "mysql2/promise";
import { ulid } from "ulid";

import { normalizeCaseInsensitiveIdentifier } from "../src/common/security/identifier-normalization.js";
import { APPROVED_DATABASE_NAME } from "../src/config/product.constants.js";

const LEGACY_SOURCE_TABLE = "`crmdatabase-api`.admins";
const LEGACY_CRM_SYSTEM = "legacy_crm";
const NETSUITE_SYSTEM = "netsuite";
const DEFAULT_ORG_UNIT_CODE = "ventas";
const DEFAULT_ROLE_CODE = "vendedor";

interface LegacyAdminRow extends RowDataPacket {
    date_created_admin: Date | null;
    date_update_admin: Date | null;
    email_admin: string | null;
    id_admin: number;
    id_rol_admin: number | null;
    idnetsuite_admin: number | null;
    name_admin: string | null;
    status_admin: number;
}

interface SerializedLegacyAdminRow {
    date_created_admin: string | null;
    date_update_admin: string | null;
    email_admin: string | null;
    id_admin: number;
    id_rol_admin: number | null;
    idnetsuite_admin: number | null;
    name_admin: string | null;
    status_admin: number;
}

interface IdRow extends RowDataPacket {
    id: number;
}

const readRequiredEnv = (key: string): string => {
    const value = process.env[key];

    if (!value) {
        throw new Error(`${key} es requerido para importar admins legacy.`);
    }

    return value;
};

const readOptionalEnv = (key: string): string | undefined => {
    const value = process.env[key];
    return value && value.length > 0 ? value : undefined;
};

const readBooleanEnv = (key: string): boolean => process.env[key] === "true";

const buildPoolOptions = async (input: { database: string; password: string; user: string }): Promise<PoolOptions> => {
    const sslCaPath = readOptionalEnv("DB_SSL_CA");

    return {
        database: input.database,
        host: readRequiredEnv("DB_HOST"),
        password: input.password,
        port: Number(process.env.DB_PORT ?? 3306),
        user: input.user,
        waitForConnections: true,
        connectionLimit: 2,
        ...(readBooleanEnv("DB_SSL")
            ? {
                  ssl: sslCaPath ? { ca: await readFile(sslCaPath, "utf8") } : {},
              }
            : {}),
    };
};

const createNewCrmPool = async (): Promise<Pool> => {
    const dbName = readRequiredEnv("DB_NAME");

    if (dbName !== APPROVED_DATABASE_NAME) {
        throw new Error(`DB_NAME debe ser ${APPROVED_DATABASE_NAME} para importar usuarios.`);
    }

    return createPool(
        await buildPoolOptions({
            database: dbName,
            password: process.env.DB_PASSWORD ?? "",
            user: readRequiredEnv("DB_USER"),
        }),
    );
};

const createLegacyPool = async (): Promise<Pool> =>
    createPool(
        await buildPoolOptions({
            database: readRequiredEnv("LEGACY_CRM_DB_NAME"),
            password: process.env.LEGACY_CRM_DB_PASSWORD ?? "",
            user: readRequiredEnv("LEGACY_CRM_DB_USER"),
        }),
    );

const readLegacyAdmins = async (legacyPool: Pool): Promise<LegacyAdminRow[]> => {
    const [rows] = await legacyPool.query<LegacyAdminRow[]>(`
        SELECT
            id_admin,
            idnetsuite_admin,
            id_rol_admin,
            name_admin,
            email_admin,
            status_admin,
            date_created_admin,
            date_update_admin
        FROM ${LEGACY_SOURCE_TABLE}
        WHERE email_admin IS NOT NULL
          AND TRIM(email_admin) <> ''
        ORDER BY id_admin
    `);

    return rows;
};

const parseLegacyDate = (value: string | null): Date | null => (value ? new Date(value) : null);

const readLegacyAdminsFromJson = async (path: string): Promise<LegacyAdminRow[]> => {
    const raw = await readFile(path, "utf8");
    const admins = JSON.parse(raw) as SerializedLegacyAdminRow[];

    return admins.map(
        (admin) =>
            ({
                ...admin,
                date_created_admin: parseLegacyDate(admin.date_created_admin),
                date_update_admin: parseLegacyDate(admin.date_update_admin),
            }) as LegacyAdminRow,
    );
};

const getRequiredId = async (pool: Pool, sql: string, values: readonly ExecuteValues[]): Promise<number> => {
    const [rows] = await pool.execute<IdRow[]>(sql, [...values]);
    const id = rows[0]?.id;

    if (!id) {
        throw new Error(`No se encontro referencia requerida para import: ${sql}`);
    }

    return id;
};

const ensureExternalSystems = async (pool: Pool): Promise<void> => {
    await pool.execute(
        `
        INSERT INTO int_external_system (code_external_system, name_external_system, status_external_system)
        VALUES
            (?, ?, 'active'),
            (?, ?, 'active')
        ON DUPLICATE KEY UPDATE
            name_external_system = VALUES(name_external_system),
            status_external_system = VALUES(status_external_system)
    `,
        [LEGACY_CRM_SYSTEM, "CRM Legacy", NETSUITE_SYSTEM, "NetSuite"],
    );
};

const upsertUser = async (pool: Pool, admin: LegacyAdminRow): Promise<number> => {
    const email = admin.email_admin?.trim();
    const name = admin.name_admin?.trim() || email;

    if (!email || !name) {
        throw new Error(`Admin legacy ${String(admin.id_admin)} no tiene correo/nombre valido.`);
    }

    await pool.execute(
        `
        INSERT INTO sec_user (
            public_id_user,
            email_user,
            normalized_email_user,
            display_name_user,
            status_user,
            created_at_user,
            updated_at_user
        )
        VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP(3)), COALESCE(?, CURRENT_TIMESTAMP(3)))
        ON DUPLICATE KEY UPDATE
            email_user = VALUES(email_user),
            display_name_user = VALUES(display_name_user),
            status_user = VALUES(status_user),
            updated_at_user = VALUES(updated_at_user)
    `,
        [ulid(), email, normalizeCaseInsensitiveIdentifier(email), name, admin.status_admin === 1 ? "active" : "inactive", admin.date_created_admin, admin.date_update_admin],
    );

    return getRequiredId(pool, "SELECT id_user AS id FROM sec_user WHERE normalized_email_user = ?", [normalizeCaseInsensitiveIdentifier(email)]);
};

const ensurePendingLocalIdentity = async (pool: Pool, admin: LegacyAdminRow, userId: number): Promise<void> => {
    const email = admin.email_admin?.trim();

    if (!email) {
        return;
    }

    await pool.execute(
        `
        INSERT INTO sec_auth_identity (
            user_id_auth_identity,
            provider_code_auth_identity,
            provider_subject_auth_identity,
            email_auth_identity,
            normalized_email_auth_identity,
            password_hash_auth_identity,
            status_auth_identity,
            created_at_auth_identity,
            updated_at_auth_identity
        )
        VALUES (?, 'local', NULL, ?, ?, NULL, 'pending', COALESCE(?, CURRENT_TIMESTAMP(3)), COALESCE(?, CURRENT_TIMESTAMP(3)))
        ON DUPLICATE KEY UPDATE
            email_auth_identity = VALUES(email_auth_identity),
            status_auth_identity = IF(status_auth_identity = 'active', status_auth_identity, VALUES(status_auth_identity)),
            updated_at_auth_identity = VALUES(updated_at_auth_identity)
    `,
        [userId, email, normalizeCaseInsensitiveIdentifier(email), admin.date_created_admin, admin.date_update_admin],
    );
};

const ensureRole = async (pool: Pool, admin: LegacyAdminRow, userId: number): Promise<void> => {
    const roleId = await getRequiredId(pool, "SELECT id_role AS id FROM sec_role WHERE code_role = ? AND status_role = 'active'", [DEFAULT_ROLE_CODE]);

    await pool.execute(
        `
        INSERT INTO sec_user_role (user_id_user_role, role_id_user_role, status_user_role, assigned_at_user_role)
        VALUES (?, ?, 'active', COALESCE(?, CURRENT_TIMESTAMP(3)))
        ON DUPLICATE KEY UPDATE
            status_user_role = VALUES(status_user_role)
    `,
        [userId, roleId, admin.date_created_admin],
    );
};

const ensureOrgUnit = async (pool: Pool, admin: LegacyAdminRow, userId: number): Promise<void> => {
    const orgUnitId = await getRequiredId(pool, "SELECT id_org_unit AS id FROM sec_org_unit WHERE code_org_unit = ? AND status_org_unit = 'active'", [DEFAULT_ORG_UNIT_CODE]);

    await pool.execute(
        `
        INSERT INTO sec_user_org_unit (
            user_id_user_org_unit,
            org_unit_id_user_org_unit,
            membership_code_user_org_unit,
            scope_code_user_org_unit,
            status_user_org_unit,
            assigned_at_user_org_unit
        )
        VALUES (?, ?, 'member', 'all_areas', 'active', COALESCE(?, CURRENT_TIMESTAMP(3)))
        ON DUPLICATE KEY UPDATE
            status_user_org_unit = VALUES(status_user_org_unit)
    `,
        [userId, orgUnitId, admin.date_created_admin],
    );
};

interface ExternalIdentityInput {
    externalUserId: string;
    externalUsername: string | null;
    metadata: object;
    systemCode: string;
    userId: number;
}

const ensureExternalIdentity = async (pool: Pool, input: ExternalIdentityInput): Promise<void> => {
    const systemId = await getRequiredId(pool, "SELECT id_external_system AS id FROM int_external_system WHERE code_external_system = ?", [input.systemCode]);

    await pool.execute(
        `
        INSERT INTO int_user_external_identity (
            user_id_user_external_identity,
            external_system_id_user_external_identity,
            external_user_id_user_external_identity,
            external_username_user_external_identity,
            status_user_external_identity,
            metadata_user_external_identity
        )
        VALUES (?, ?, ?, ?, 'active', CAST(? AS JSON))
        ON DUPLICATE KEY UPDATE
            user_id_user_external_identity = VALUES(user_id_user_external_identity),
            external_username_user_external_identity = VALUES(external_username_user_external_identity),
            status_user_external_identity = VALUES(status_user_external_identity),
            metadata_user_external_identity = VALUES(metadata_user_external_identity)
    `,
        [input.userId, systemId, input.externalUserId, input.externalUsername, JSON.stringify(input.metadata)],
    );
};

const importAdmin = async (pool: Pool, admin: LegacyAdminRow): Promise<void> => {
    const userId = await upsertUser(pool, admin);

    await ensurePendingLocalIdentity(pool, admin, userId);
    await ensureRole(pool, admin, userId);
    await ensureOrgUnit(pool, admin, userId);
    await ensureExternalIdentity(pool, {
        externalUserId: String(admin.id_admin),
        externalUsername: admin.email_admin?.trim() ?? null,
        metadata: {
            legacyRoleId: admin.id_rol_admin,
            legacyStatus: admin.status_admin,
        },
        systemCode: LEGACY_CRM_SYSTEM,
        userId,
    });

    if (admin.idnetsuite_admin) {
        await ensureExternalIdentity(pool, {
            externalUserId: String(admin.idnetsuite_admin),
            externalUsername: admin.email_admin?.trim() ?? null,
            metadata: {
                source: LEGACY_CRM_SYSTEM,
            },
            systemCode: NETSUITE_SYSTEM,
            userId,
        });
    }
};

const run = async (): Promise<void> => {
    const legacyAdminsJsonPath = readOptionalEnv("LEGACY_ADMINS_JSON_PATH");
    const newPool = await createNewCrmPool();
    let legacyPool: Pool | undefined;

    try {
        let admins: LegacyAdminRow[];

        if (legacyAdminsJsonPath) {
            admins = await readLegacyAdminsFromJson(legacyAdminsJsonPath);
        } else {
            legacyPool = await createLegacyPool();
            admins = await readLegacyAdmins(legacyPool);
        }

        await newPool.query("START TRANSACTION");
        await ensureExternalSystems(newPool);

        for (const admin of admins) {
            await importAdmin(newPool, admin);
        }

        await newPool.query("COMMIT");
        console.log(`Importados/actualizados ${String(admins.length)} admins legacy sin copiar claves.`);
    } catch (error) {
        await newPool.query("ROLLBACK").catch(() => undefined);
        throw error;
    } finally {
        await Promise.all([newPool.end(), legacyPool?.end()]);
    }
};

void run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Fallo importando admins legacy: ${message}`);
    process.exit(1);
});
