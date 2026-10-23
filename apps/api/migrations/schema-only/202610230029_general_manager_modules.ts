import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const migrationName = "202610230029_general_manager_modules";
const operationalCodes = ["ventas", "mercadeo", "formalizacion", "contabilidad"];
const identityTables = ["sec_role", "sec_org_unit", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "sec_user_permission_override", "audit_security_event"];
type Column = { name: string; type: string; nullable: string; defaultValue: string | null; extra: string; comment: string; collation: string | null };
type Role = { id: number; code: string; name: string; status: string; deleted: Date | null; roleMode: string; permissionMode: string };
type Module = { id: number; code: string; status: string; deleted: Date | null };
type Mapping = { roleId: number; moduleId: number; status: string };

/** Read metadata before adopting existing DDL; no best-effort repair of a conflicting schema. */
async function readColumns(db: Kysely<unknown>, table: string): Promise<Column[]> {
    return (
        await sql<Column>`SELECT COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,EXTRA AS extra,COLUMN_COMMENT AS comment,COLLATION_NAME AS collation
        FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}
        ${table === "sec_role" ? sql`AND COLUMN_NAME='permission_inheritance_mode_role'` : sql``} ORDER BY ORDINAL_POSITION`.execute(db)
    ).rows;
}

/** Timestamp expressions are equivalent with or without metadata's outer parentheses. */
function normalizedDefault(value: string | null): string | null {
    return value?.toLowerCase().replace(/^\((.*)\)$/, "$1") ?? null;
}

/** Exact five-column shape, including defaults, nullability, comments and generated/update behavior. */
async function validateMappingTable(db: Kysely<unknown>, collation: string): Promise<void> {
    const columns = await readColumns(db, "sec_role_module");
    const expected = [
        ["role_id_role_module", "bigint unsigned", null],
        ["org_unit_id_role_module", "bigint unsigned", null],
        ["status_role_module", "varchar(30)", "active"],
        ["created_at_role_module", "datetime(3)", "utc_timestamp(3)"],
        ["updated_at_role_module", "datetime(3)", "utc_timestamp(3)"],
    ] as const;
    if (
        columns.length !== expected.length ||
        expected.some(([name, type, defaultValue], i) => {
            const column = columns[i];
            if (!column) return true;
            return ![column.name === name, column.type === type, column.nullable === "NO", normalizedDefault(column.defaultValue) === defaultValue, Boolean(column.comment), ["", "DEFAULT_GENERATED"].includes(column.extra), column.collation === (type === "varchar(30)" ? collation : null)].every(Boolean);
        })
    )
        throw new Error("Role module columns conflict with the agreed schema");
    await validateMappingIndexes(db);
    await validateMappingKeys(db);
}

/** Require the agreed primary and covering index, without extra uniqueness constraints. */
async function validateMappingIndexes(db: Kysely<unknown>): Promise<void> {
    const indexes = (
        await sql<{ name: string; nonUnique: number; position: number; column: string; prefix: number | null; type: string; visible: string }>`SELECT INDEX_NAME AS name,NON_UNIQUE AS nonUnique,SEQ_IN_INDEX AS position,COLUMN_NAME AS 'column',SUB_PART AS prefix,INDEX_TYPE AS type,IS_VISIBLE AS visible
        FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sec_role_module' ORDER BY INDEX_NAME,SEQ_IN_INDEX`.execute(db)
    ).rows;
    if (indexes.some((index) => ![index.prefix === null, index.type === "BTREE", index.visible === "YES"].every(Boolean))) throw new Error("Role module indexes conflict with the agreed schema");
    const primary = indexes.filter((index) => index.name === "PRIMARY");
    const covering = indexes.filter((index) => index.name === "ix_sec_role_module_org_status");
    if (indexes.length !== 5 || primary.length !== 2 || primary.some((index, i) => index.nonUnique !== 0 || index.position !== i + 1 || index.column !== ["role_id_role_module", "org_unit_id_role_module"][i]) || covering.length !== 3 || covering.some((index, i) => index.nonUnique !== 1 || index.position !== i + 1 || index.column !== ["org_unit_id_role_module", "status_role_module", "role_id_role_module"][i])) throw new Error("Role module indexes conflict with the agreed schema");
}

/** Reject cascading or cross-schema relationships when adopting an existing table. */
async function validateMappingKeys(db: Kysely<unknown>): Promise<void> {
    const keys = (
        await sql<{ column: string; table: string; target: string; schema: string; updateRule: string; deleteRule: string }>`SELECT k.COLUMN_NAME AS 'column',k.REFERENCED_TABLE_NAME AS 'table',k.REFERENCED_COLUMN_NAME AS target,k.REFERENCED_TABLE_SCHEMA AS 'schema',r.UPDATE_RULE AS updateRule,r.DELETE_RULE AS deleteRule
        FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME
        WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME='sec_role_module' AND k.REFERENCED_TABLE_NAME IS NOT NULL`.execute(db)
    ).rows;
    if (
        keys.length !== 2 ||
        ![
            ["role_id_role_module", "sec_role", "id_role"],
            ["org_unit_id_role_module", "sec_org_unit", "id_org_unit"],
        ].every(([column, table, target]) => keys.some((key) => key.column === column && key.table === table && key.target === target && key.schema === "CRM_THINK_V2" && key.updateRule === "RESTRICT" && key.deleteRule === "RESTRICT"))
    )
        throw new Error("Role module foreign keys conflict with the agreed schema");
}

/** Scope DDL to the native database and retain its configured utf8mb4 collation. */
async function readNativeCollation(db: Kysely<unknown>): Promise<string> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0];
    if (destination?.name !== "CRM_THINK_V2") throw new Error("General manager modules require CRM_THINK_V2");
    const collation = (await sql<{ collation: string }>`SELECT DEFAULT_COLLATION_NAME AS collation FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=DATABASE()`.execute(db)).rows[0]?.collation;
    if (!collation || !/^utf8mb4_[a-z0-9_]+$/.test(collation)) throw new Error("General manager modules require a compatible utf8mb4 database collation");
    return collation;
}

/** Existing policy columns must be neutral by default and structurally compatible. */
function validatePolicyColumn(columns: Column[], collation: string): void {
    const column = columns[0];
    if (column && ![columns.length === 1, column.type === "enum('assigned','selected_modules')", column.nullable === "NO", column.defaultValue === "assigned", column.extra === "", Boolean(column.comment), column.collation === collation].every(Boolean)) throw new Error("Permission inheritance column conflicts with existing schema");
}

/** Expand independently of DML: default assigned and an empty relation confer no access. */
async function ensureSchema(db: Kysely<unknown>): Promise<void> {
    const collation = await readNativeCollation(db);
    const tables = (
        await sql<{ name: string; engine: string; collation: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME IN (${sql.join([...identityTables, "sec_role_module"])})`.execute(db)
    ).rows;
    if (![identityTables.every((name) => tables.some((table) => table.name === name)), tables.every((table) => table.engine === "InnoDB")].every(Boolean)) throw new Error("General manager modules require InnoDB identity/audit tables");
    const mappingTable = tables.find((table) => table.name === "sec_role_module");
    if (mappingTable && mappingTable.collation !== collation) throw new Error("Role module table collation conflicts with database");
    const columns = await readColumns(db, "sec_role");
    const column = columns[0];
    validatePolicyColumn(columns, collation);
    if (mappingTable) await validateMappingTable(db, collation);
    await sql`SET SESSION lock_wait_timeout=5`.execute(db);
    if (!column)
        await sql`ALTER TABLE sec_role ADD COLUMN permission_inheritance_mode_role ENUM('assigned','selected_modules') NOT NULL DEFAULT 'assigned'
        COMMENT 'Permisos asignados o heredados solo de los modulos operativos seleccionados; no asigna roles a usuarios', ALGORITHM=INSTANT`.execute(db);
    if (!mappingTable)
        await sql`CREATE TABLE sec_role_module (
        role_id_role_module BIGINT UNSIGNED NOT NULL COMMENT 'Rol cuyo techo de acceso se limita a este modulo',
        org_unit_id_role_module BIGINT UNSIGNED NOT NULL COMMENT 'Modulo operativo seleccionado para el rol; no es asignacion de usuario',
        status_role_module VARCHAR(30) NOT NULL DEFAULT 'active' COMMENT 'Vigencia del techo de modulo; inactive conserva la revocacion',
        created_at_role_module DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Fecha de creacion de la seleccion; UTC',
        updated_at_role_module DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)) COMMENT 'Ultima modificacion de la seleccion; UTC',
        PRIMARY KEY (role_id_role_module,org_unit_id_role_module),
        KEY ix_sec_role_module_org_status (org_unit_id_role_module,status_role_module,role_id_role_module),
        CONSTRAINT fk_sec_role_module_role FOREIGN KEY (role_id_role_module) REFERENCES sec_role(id_role) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT fk_sec_role_module_org FOREIGN KEY (org_unit_id_role_module) REFERENCES sec_org_unit(id_org_unit) ON DELETE RESTRICT ON UPDATE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE ${sql.raw(collation)}`.execute(db);
}

/** Require an effective administrative capability and preserve time-bound direct denies. */
async function migrationActor(tx: Kysely<unknown>) {
    const actor = (
        await sql<{ id: number; publicId: string; name: string }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name
        FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role owner ON owner.id_role=ur.role_id_user_role
        WHERE owner.code_role='owner' AND owner.status_role='active' AND owner.deleted_at_role IS NULL
          AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL
          AND NOT EXISTS (SELECT 1 FROM sec_user_permission_override o JOIN sec_permission p ON p.id_permission=o.permission_id_user_permission_override
            WHERE o.user_id_user_permission_override=u.id_user AND p.code_permission='role.assign' AND p.status_permission='active'
              AND o.effect_user_permission_override='deny' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
              AND o.starts_at_user_permission_override<=UTC_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>UTC_TIMESTAMP(3)))
          AND EXISTS (SELECT 1 FROM sec_permission p WHERE p.code_permission='role.assign' AND p.status_permission='active' AND (
            EXISTS (SELECT 1 FROM sec_role_permission rp JOIN sec_role r ON r.id_role=rp.role_id_role_permission
              WHERE rp.permission_id_role_permission=p.id_permission AND rp.status_role_permission='active' AND r.status_role='active' AND r.deleted_at_role IS NULL
                AND (r.id_role=owner.id_role OR owner.role_inheritance_mode_role='all_active_roles'))
            OR EXISTS (SELECT 1 FROM sec_user_permission_override o WHERE o.user_id_user_permission_override=u.id_user AND o.permission_id_user_permission_override=p.id_permission
              AND o.effect_user_permission_override='allow' AND o.status_user_permission_override='active' AND o.revoked_at_user_permission_override IS NULL
              AND o.starts_at_user_permission_override<=UTC_TIMESTAMP(3) AND (o.ends_at_user_permission_override IS NULL OR o.ends_at_user_permission_override>UTC_TIMESTAMP(3)))))
        ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("General manager modules require an active capable Owner without a role.assign deny");
    return actor;
}

/** Only explicit known operational mappings; no generic supervisor or guessed area expansion. */
function expectedMappings(roles: Role[], modules: Module[]): Mapping[] {
    const result: Mapping[] = [];
    for (const module of modules.filter((entry) => operationalCodes.includes(entry.code) && entry.status === "active" && entry.deleted === null)) {
        const chiefCodes: Record<string, string[]> = { formalizacion: ["jefe_formalizaciones"], mercadeo: ["jefe_mercadeo"] };
        const codes = [module.code, ...(chiefCodes[module.code] ?? [])];
        for (const code of codes) {
            const role = roles.find((entry) => entry.code === code);
            if (!role) continue;
            if (![role.status === "active", role.deleted === null, role.roleMode === "assigned"].every(Boolean)) throw new Error("Operational role conflicts with module ceiling; explicit reconciliation required");
            result.push({ roleId: role.id, moduleId: module.id, status: "active" });
        }
    }
    return result.sort((a, b) => a.roleId - b.roleId || a.moduleId - b.moduleId);
}

/** Stable role snapshots keep audit independent from subsequent writes. */
async function readRoles(tx: Kysely<unknown>): Promise<Role[]> {
    return (await sql<Role>`SELECT id_role AS id,code_role AS code,name_role AS name,status_role AS status,deleted_at_role AS deleted,role_inheritance_mode_role AS roleMode,permission_inheritance_mode_role AS permissionMode FROM sec_role ORDER BY id_role FOR UPDATE`.execute(tx)).rows;
}

/** Create only the unassigned business role; never reactivate or reinterpret a conflict. */
async function ensureManager(tx: Kysely<unknown>, roles: Role[], applied: boolean): Promise<Role> {
    const manager = roles.find((role) => role.code === "jefe_general");
    if (manager) {
        if (![manager.status === "active", manager.deleted === null, manager.name === "Jefe General", manager.roleMode === "assigned", ["assigned", "selected_modules"].includes(manager.permissionMode)].every(Boolean)) throw new Error("Jefe General conflicts with existing configuration");
        return manager;
    }
    if (applied) throw new Error("Previously audited manager is missing; explicit reconciliation required");
    await sql`INSERT INTO sec_role (code_role,name_role,description_role,status_role) VALUES ('jefe_general','Jefe General','Perfil dinamico limitado a los modulos operativos seleccionados; sin administracion automatica.','active')`.execute(tx);
    const created = (await readRoles(tx)).find((role) => role.code === "jefe_general");
    if (!created) throw new Error("Jefe General was not created");
    roles.push(created);
    return created;
}

/** Active existing ceilings must agree; inactive mappings are deliberate revocations. */
function missingMappings(mappings: Mapping[], expected: Mapping[], targeted: Set<number>): Mapping[] {
    if (mappings.some((mapping) => targeted.has(mapping.roleId) && (mapping.status !== "active" || !expected.some((entry) => entry.roleId === mapping.roleId && entry.moduleId === mapping.moduleId)))) throw new Error("Module mapping was revoked or conflicts; explicit reconciliation required");
    return expected.filter((entry) => !mappings.some((mapping) => mapping.roleId === entry.roleId && mapping.moduleId === entry.moduleId));
}

/** Identity only: schema expansion is inert; policy, maps, versions and one audit event commit atomically. */
export const generalManagerModulesMigration = {
    name: migrationName,
    async up(db: Kysely<unknown>): Promise<void> {
        await ensureSchema(db);
        await db.transaction().execute(async (tx) => {
            const actor = await migrationActor(tx);
            const roles = await readRoles(tx);
            const modules = (await sql<Module>`SELECT id_org_unit AS id,code_org_unit AS code,status_org_unit AS status,deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit IN (${sql.join(operationalCodes)}) ORDER BY id_org_unit FOR UPDATE`.execute(tx)).rows;
            const mappings = (await sql<Mapping>`SELECT role_id_role_module AS roleId,org_unit_id_role_module AS moduleId,status_role_module AS status FROM sec_role_module ORDER BY role_id_role_module,org_unit_id_role_module FOR UPDATE`.execute(tx)).rows;
            const before = { roles: structuredClone(roles), mappings: structuredClone(mappings) };
            const applied = (await sql<{ id: number }>`SELECT id_security_event AS id FROM audit_security_event WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event,'$.migration'))=${migrationName} LIMIT 1`.execute(tx)).rows.length > 0;
            const manager = await ensureManager(tx, roles, applied);
            // General manager follows each user's selected modules dynamically, without a static role ceiling.
            const expected = expectedMappings(roles, modules);
            const targeted = new Set(expected.map((mapping) => mapping.roleId));
            targeted.add(manager.id);
            const missing = missingMappings(mappings, expected, targeted);
            if (applied) {
                if (manager.permissionMode !== "selected_modules" || missing.length) throw new Error("Previously audited module policy changed; explicit reconciliation required");
                return;
            }
            if (manager.permissionMode !== "selected_modules") await sql`UPDATE sec_role SET permission_inheritance_mode_role='selected_modules',updated_at_role=UTC_TIMESTAMP(3) WHERE id_role=${manager.id}`.execute(tx);
            for (const mapping of missing) await sql`INSERT INTO sec_role_module (role_id_role_module,org_unit_id_role_module,status_role_module) VALUES (${mapping.roleId},${mapping.moduleId},'active')`.execute(tx);
            await sql`UPDATE sec_user u SET permission_version_user=permission_version_user+1 WHERE EXISTS (
                SELECT 1 FROM sec_user_role ur JOIN sec_role r ON r.id_role=ur.role_id_user_role
                WHERE ur.user_id_user_role=u.id_user AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND r.status_role='active' AND r.deleted_at_role IS NULL
                AND (r.id_role IN (${sql.join([...targeted])}) OR r.code_role='owner' OR r.role_inheritance_mode_role='all_active_roles'))`.execute(tx);
            const after = { roles: await readRoles(tx), mappings: [...mappings, ...missing].sort((a, b) => a.roleId - b.roleId || a.moduleId - b.moduleId) };
            await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event)
                VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Politica de Jefe General y techos operativos por rol registrados.','Modulos seleccionados autorizados por el propietario; sin asignar usuarios ni permisos administrativos.',
                ${JSON.stringify({ migration: migrationName, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, directAssignmentsChanged: false, directOverridesChanged: false, changeSet: { version: 1, entity: "role", recordId: "jefe_general", action: "update", before, after } })})`.execute(tx);
        });
    },
};
