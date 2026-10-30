import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const modules = ["formalizacion", "mercadeo", "ventas", "contabilidad"] as const;
const moduleColors: Readonly<Record<string, string>> = { formalizacion: "#496180", mercadeo: "#7c4a9e", ventas: "#147849", contabilidad: "#a86308" };
const tables = ["crm_calendar_event", "conf_calendar_event_type", "sec_org_unit", "sec_role", "sec_role_module", "sec_permission", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"];
const additions = [
    { table: "crm_calendar_event", name: "details_calendar_event", type: "json", comment: "Detalles opcionales por modulo; referencias libres sin FK ni inferencia de identidad" },
    { table: "crm_calendar_event", name: "legacy_calendar_id_calendar_event", type: "int", comment: "Alias legacy opcional y unico reservado para conciliacion futura; sin copiar eventos" },
    { table: "conf_calendar_event_type", name: "form_key_calendar_event_type", type: "varchar(100)", comment: "Clave persistida del formulario por tipo; modulo.general.v1 para la configuracion inicial" },
] as const;
type Column = { table_name: string; column_name: string; column_type: string; is_nullable: string; column_default: string | null; extra: string; column_comment: string };
type Index = { index_name: string; non_unique: number; seq_in_index: number; column_name: string; sub_part: number | null };
type Module = { id: number; code: string; status: string; deleted: Date | null };
type Role = { id: number; code: string; status: string; deleted: Date | null };
type Grant = { role: number; code: string; status: string };
type EventType = { id: number; module: number; moduleCode: string; code: string; formKey: string | null; status: string };
const permissionDefinitions = modules.flatMap((module) => ["read", "create", "update"].map((action) => ({ code: `${module}.calendar.${action}`, module, action, description: ({ read: "Permite consultar el calendario del modulo con autorizacion vigente.", create: "Permite crear eventos en el calendario del modulo con origen e identidad explicitos.", update: "Permite actualizar eventos del calendario de origen con autorizacion y version vigentes." } as Record<string, string>)[action] })));

/** DDL is outside identity DML because MySQL ALTER TABLE implicitly commits. */
async function assertNativeSchema(db: Kysely<unknown>): Promise<void> {
    const destination = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name;
    if (destination !== "CRM_THINK_V2") throw new Error("Global calendar requires CRM_THINK_V2");
    const inventory = (await sql<{ table_name: string; table_type: string; engine: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(db)).rows;
    if (inventory.length !== tables.length || !tables.every((name) => inventory.some((t) => t.table_name === name && t.table_type === "BASE TABLE" && t.engine === "InnoDB"))) throw new Error("Global calendar requires native InnoDB calendar/security tables");
}

/** Existing columns must match the additive contract; nullable form key is a recoverable expansion. */
function validateColumn(column: Column, definition: (typeof additions)[number]): void {
    const nullable = definition.name === "form_key_calendar_event_type" ? ["YES", "NO"] : ["YES"];
    const valid = [column.column_type.replace(/^int\(\d+\)$/, "int") === definition.type, nullable.includes(column.is_nullable), column.column_default === null, column.extra === "", column.column_comment === definition.comment];
    if (!valid.every(Boolean)) throw new Error("Global calendar column drift requires reconciliation");
}

/** Confirm the existing module/date access path and the single-column unique future alias. */
function planIndexes(indexes: Index[]): string[] {
    const access = indexes.filter((i) => i.index_name === "ix_calendar_event_module_time");
    const expected = ["origin_module_id_calendar_event", "deleted_at_calendar_event", "starts_at_calendar_event", "id_calendar_event"];
    if (access.length !== 4 || !access.every((i, n) => i.column_name === expected[n] && i.seq_in_index === n + 1 && i.non_unique === 1 && i.sub_part === null)) throw new Error("Global calendar module/date index drift");
    const alias = indexes.filter((i) => i.index_name === "uq_calendar_event_legacy");
    if (!alias.length) return ["ALTER TABLE crm_calendar_event ADD UNIQUE KEY uq_calendar_event_legacy (legacy_calendar_id_calendar_event)"];
    if (alias.length !== 1 || !alias.every((i) => i.column_name === "legacy_calendar_id_calendar_event" && i.seq_in_index === 1 && i.non_unique === 0 && i.sub_part === null)) throw new Error("Global calendar legacy alias index drift");
    return [];
}

/** Read-only plan; partial additive DDL is adopted only after checking its exact shape. */
export async function planGlobalCalendarSchema(db: Kysely<unknown>): Promise<string[]> {
    await assertNativeSchema(db);
    const columns = (
        await sql<Column>`SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable,COLUMN_DEFAULT AS column_default,EXTRA AS extra,COLUMN_COMMENT AS column_comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='crm_calendar_event' AND COLUMN_NAME IN ('details_calendar_event','legacy_calendar_id_calendar_event')) OR (TABLE_NAME='conf_calendar_event_type' AND COLUMN_NAME='form_key_calendar_event_type'))`.execute(
            db,
        )
    ).rows;
    const statements: string[] = [];
    for (const definition of additions) {
        const found = columns.filter((c) => c.table_name === definition.table && c.column_name === definition.name);
        if (found.length > 1) throw new Error("Duplicate global calendar column metadata");
        if (found[0]) validateColumn(found[0], definition);
        else statements.push(`ALTER TABLE ${definition.table} ADD COLUMN ${definition.name} ${definition.type.toUpperCase()} NULL COMMENT '${definition.comment}'`);
    }
    const indexes = (await sql<Index>`SELECT INDEX_NAME AS index_name,NON_UNIQUE AS non_unique,SEQ_IN_INDEX AS seq_in_index,COLUMN_NAME AS column_name,SUB_PART AS sub_part FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_calendar_event' AND INDEX_NAME IN ('ix_calendar_event_module_time','uq_calendar_event_legacy') ORDER BY INDEX_NAME,SEQ_IN_INDEX`.execute(db)).rows;
    return [...statements, ...planIndexes(indexes)];
}

/** Permission descriptions are independently managed; preserve the existing Mercadeo read definition. */
async function readPermissionPlan(tx: Kysely<unknown>) {
    const permissions = (await sql<{ code: string; module: string; action: string; status: string }>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(permissionDefinitions.map((p) => p.code))}) FOR UPDATE`.execute(tx)).rows;
    for (const definition of permissionDefinitions) {
        const matching = permissions.filter((p) => p.code === definition.code);
        if (matching.length > 1 || matching.some((p) => p.module !== definition.module || p.action !== definition.action || p.status !== "active")) throw new Error("Global calendar permission conflict requires reconciliation");
    }
    return permissionDefinitions.filter((p) => !permissions.some((existing) => existing.code === p.code));
}

/** Only known business roles and the editable general template, intersected with active module ceilings. */
async function readGrantPlan(tx: Kysely<unknown>, active: Module[]) {
    const allowed: Record<string, readonly string[]> = { formalizacion: ["formalizacion", "jefe_formalizaciones"], mercadeo: ["mercadeo", "jefe_mercadeo"], ventas: ["ventas"], contabilidad: ["contabilidad"] };
    const roles = (await sql<Role>`SELECT id_role AS id,code_role AS code,status_role AS status,deleted_at_role AS deleted FROM sec_role WHERE code_role IN (${sql.join([...Object.values(allowed).flat(), "jefe_general"])}) FOR UPDATE`.execute(tx)).rows;
    const mappings = (await sql<{ role: number; module: number; status: string }>`SELECT role_id_role_module AS role,org_unit_id_role_module AS module,status_role_module AS status FROM sec_role_module FOR UPDATE`.execute(tx)).rows;
    const grants = (await sql<Grant>`SELECT rp.role_id_role_permission AS role,p.code_permission AS code,rp.status_role_permission AS status FROM sec_role_permission rp JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission IN (${sql.join(permissionDefinitions.map((p) => p.code))}) FOR UPDATE`.execute(tx)).rows;
    const missing: { role: number; code: string }[] = [];
    for (const role of roles.filter((r) => r.status === "active" && r.deleted === null)) {
        const eligible = active.filter((m) => (role.code === "jefe_general" || allowed[m.code]?.includes(role.code)) && mappings.some((c) => c.role === role.id && c.module === m.id && c.status === "active"));
        const eligiblePermissions = permissionDefinitions.filter((p) => eligible.some((m) => m.code === p.module));
        // Any prior grant, including inactive, is intentional history. Never silently restore it.
        missing.push(...eligiblePermissions.filter((p) => !grants.some((g) => g.role === role.id && g.code === p.code)).map((p) => ({ role: role.id, code: p.code })));
    }
    return { missing, before: grants };
}

/** Existing custom type names, colors and nonempty form keys remain configurable and untouched. */
async function readTypePlan(tx: Kysely<unknown>, active: Module[]) {
    const types = (await sql<EventType>`SELECT t.id_calendar_event_type AS id,t.module_id_calendar_event_type AS module,o.code_org_unit AS moduleCode,t.code_calendar_event_type AS code,t.form_key_calendar_event_type AS formKey,t.status_calendar_event_type AS status FROM conf_calendar_event_type t JOIN sec_org_unit o ON o.id_org_unit=t.module_id_calendar_event_type FOR UPDATE`.execute(tx)).rows;
    const backfill = types.filter((t) => !t.formKey).map((t) => ({ id: t.id, key: `${t.moduleCode}.general.v1` }));
    if (backfill.some((t) => t.key.length > 100 || !/^[a-z][a-z0-9_]*\.general\.v1$/.test(t.key))) throw new Error("Calendar type form module requires explicit reconciliation");
    const missing = active.filter((m) => !types.some((t) => t.module === m.id && t.code === "general"));
    return { backfill, missing };
}

/** All configuration/grants, version invalidation and security audit commit together. */
async function configureCalendar(tx: Kysely<unknown>): Promise<void> {
    const moduleRows = (await sql<Module>`SELECT id_org_unit AS id,code_org_unit AS code,status_org_unit AS status,deleted_at_org_unit AS deleted FROM sec_org_unit WHERE code_org_unit IN (${sql.join(modules)}) FOR UPDATE`.execute(tx)).rows;
    const active = moduleRows.filter((m) => m.status === "active" && m.deleted === null);
    const permissions = await readPermissionPlan(tx);
    const grants = await readGrantPlan(tx, active);
    const types = await readTypePlan(tx, active);
    if (![permissions.length, grants.missing.length, types.missing.length, types.backfill.length].some(Boolean)) return;
    const actor = (
        await sql<{
            id: number;
            publicId: string;
            name: string;
        }>`SELECT u.id_user AS id,u.public_id_user AS publicId,u.display_name_user AS name FROM sec_user u JOIN sec_user_role ur ON ur.user_id_user_role=u.id_user JOIN sec_role r ON r.id_role=ur.role_id_user_role WHERE r.code_role='owner' AND r.status_role='active' AND r.deleted_at_role IS NULL AND ur.status_user_role='active' AND ur.revoked_at_user_role IS NULL AND u.status_user='active' AND u.deleted_at_user IS NULL ORDER BY u.id_user LIMIT 1 FOR UPDATE`.execute(tx)
    ).rows[0];
    if (!actor) throw new Error("Global calendar requires Owner audit attribution");
    for (const p of permissions) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${p.code},${p.module},${p.action},${p.description},'active')`.execute(tx);
    for (const m of types.missing) await sql`INSERT INTO conf_calendar_event_type (public_id_calendar_event_type,module_id_calendar_event_type,code_calendar_event_type,form_key_calendar_event_type,name_calendar_event_type,color_calendar_event_type,status_calendar_event_type) VALUES (${ulid()},${m.id},${"general"},${`${m.code}.general.v1`},'Evento',${moduleColors[m.code]},'active')`.execute(tx);
    for (const t of types.backfill) await sql`UPDATE conf_calendar_event_type SET form_key_calendar_event_type=${t.key} WHERE id_calendar_event_type=${t.id} AND (form_key_calendar_event_type IS NULL OR form_key_calendar_event_type='')`.execute(tx);
    for (const grant of grants.missing) await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission) SELECT ${grant.role},id_permission,'active' FROM sec_permission WHERE code_permission=${grant.code}`.execute(tx);
    // Match 049: inherited Owner/general-template access can change outside directly assigned roles.
    await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
    await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,actor_user_id_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced',${actor.id},'Calendario compartido configurado por modulo.','Tipos generales y permisos autorizados; techos, revocaciones y denegaciones individuales conservados.',${JSON.stringify({ migration: globalCalendarMigration.name, moduleCode: "administration", sectionCode: "roles", actor: { publicId: actor.publicId, name: actor.name }, changeSet: { version: 1, entity: "role", recordId: "global-calendar", action: "update", before: { grants: grants.before }, after: { addedGrants: grants.missing, createdPermissions: permissions.map((p) => p.code), createdTypeModules: types.missing.map((m) => m.code), formKeys: types.backfill } } })})`.execute(
        tx,
    );
}

/** Native additive schema plus real editable configuration; never writes event/business records. */
export const globalCalendarMigration = {
    name: "202610280051_global_calendar",
    async up(db: Kysely<unknown>): Promise<void> {
        for (const statement of await planGlobalCalendarSchema(db)) await sql.raw(statement).execute(db);
        await db.transaction().execute(configureCalendar);
        const column = (await sql<Column>`SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable,COLUMN_DEFAULT AS column_default,EXTRA AS extra,COLUMN_COMMENT AS column_comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='conf_calendar_event_type' AND COLUMN_NAME='form_key_calendar_event_type'`.execute(db)).rows.find((c) => c.column_name === "form_key_calendar_event_type");
        if (column?.is_nullable === "NO") return;
        await sql`ALTER TABLE conf_calendar_event_type MODIFY COLUMN form_key_calendar_event_type VARCHAR(100) NOT NULL COMMENT 'Clave persistida del formulario por tipo; modulo.general.v1 para la configuracion inicial'`.execute(db);
    },
};
