import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";

const stage = "bank_management_in_progress";
const permission = `formalizacion.orders.stage.${stage}`;
const sourcePermission = "formalizacion.orders.stage.bank_management";
const targets = {
    native: { database: "CRM_THINK_V2", table: "crm_sales_order", column: "purchase_funds_origin_sales_order" },
    legacy: { database: "crmdatabase-api", table: "ordenventa", column: "origen_fondos_compra_ov" },
} as const;

type FundsColumn = { type: string; nullable: string; defaultValue: string | null };
type PermissionDefinition = { id: number; code: string; module: string; action: string; status: string };

function assertFundsColumn(existing: FundsColumn): void {
    if (existing.type !== "enum('own_funds','bank_financing')" || existing.nullable !== "YES" || ![null, "NULL"].includes(existing.defaultValue)) throw new Error("Purchase funds column drift");
}

function assertPermission(definition: PermissionDefinition | undefined, action: string): asserts definition is PermissionDefinition {
    if (!definition || definition.module !== "formalizacion" || definition.action !== action || definition.status !== "active") throw new Error("Bank management permission unavailable or drifted");
}

async function assertInnoDbTable(db: Kysely<unknown>, table: string): Promise<void> {
    const metadata = (await sql<{ engine: string; kind: string }>`SELECT ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table}`.execute(db)).rows[0];
    if (metadata?.engine !== "InnoDB" || metadata.kind !== "BASE TABLE") throw new Error("Purchase funds requires InnoDB table");
}

/** Ambos catálogos son necesarios: las visitas legacy tienen FK hacia su propio catálogo. */
export async function planBankingInProgressStage(db: Kysely<unknown>, source: "native" | "legacy"): Promise<string[]> {
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== targets[source].database) throw new Error("Banking stage destination mismatch");
    await assertInnoDbTable(db, "conf_sales_order_state");
    const rows = (await sql<{ code: string; name: string; position: number }>`SELECT code_sales_order_state AS code,name_sales_order_state AS name,display_order_sales_order_state AS position FROM conf_sales_order_state WHERE code_sales_order_state IN ('bank_management','bank_management_in_progress') FOR UPDATE`.execute(db)).rows;
    const current = rows.find((row) => row.code === stage);
    if (current) {
        if (current.name !== "Gestión bancaria en proceso") throw new Error("Bank in progress stage drift");
        return [];
    }
    const before = rows.find((row) => row.code === "bank_management");
    if (!before || !Number.isInteger(before.position) || before.position >= 65535) throw new Error("Bank management stage unavailable");
    return [`UPDATE conf_sales_order_state SET display_order_sales_order_state=display_order_sales_order_state+1 WHERE display_order_sales_order_state>${String(before.position)}`, `INSERT INTO conf_sales_order_state (code_sales_order_state,name_sales_order_state,display_order_sales_order_state) VALUES ('bank_management_in_progress','Gestión bancaria en proceso',${String(before.position + 1)})`];
}

/** Agrega una elección explícita; NULL conserva las órdenes existentes sin inventar su origen. */
export async function planPurchaseFundsColumn(db: Kysely<unknown>, source: "native" | "legacy"): Promise<string[]> {
    const { database, table, column } = targets[source];
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== database) throw new Error("Purchase funds destination mismatch");
    await assertInnoDbTable(db, table);
    const existing = (await sql<FundsColumn>`SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} AND COLUMN_NAME=${column}`.execute(db)).rows[0];
    if (existing) {
        assertFundsColumn(existing);
        return [];
    }
    return [`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ENUM('own_funds','bank_financing') NULL DEFAULT NULL COMMENT 'Origen de fondos elegido en CRM; NULL exige seleccion explicita', ALGORITHM=INSTANT`];
}

/** El permiso nuevo hereda también revocaciones, ventanas y denegaciones; nunca amplía el acceso anterior. */
async function addBankingPermission(tx: Kysely<unknown>): Promise<void> {
    const definitions = (await sql<PermissionDefinition>`SELECT id_permission AS id,code_permission AS code,module_code_permission AS module,action_code_permission AS action,status_permission AS status FROM sec_permission WHERE code_permission IN (${sourcePermission},${permission}) FOR UPDATE`.execute(tx)).rows;
    const previous = definitions.find((row) => row.code === sourcePermission);
    assertPermission(previous, "bank_management");
    const existing = definitions.find((row) => row.code === permission);
    if (existing) {
        assertPermission(existing, stage);
        return;
    }
    await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission},'formalizacion',${stage},'Pasar a Gestión bancaria en proceso','active')`.execute(tx);
    const target = (await sql<{ id: number }>`SELECT id_permission AS id FROM sec_permission WHERE code_permission=${permission}`.execute(tx)).rows[0];
    if (!target) throw new Error("Bank in progress permission not created");
    await sql`INSERT INTO sec_role_permission (role_id_role_permission,permission_id_role_permission,status_role_permission,created_at_role_permission) SELECT role_id_role_permission,${target.id},status_role_permission,created_at_role_permission FROM sec_role_permission WHERE permission_id_role_permission=${previous.id}`.execute(tx);
    await sql`INSERT INTO sec_user_permission_override (user_id_user_permission_override,permission_id_user_permission_override,effect_user_permission_override,reason_user_permission_override,status_user_permission_override,starts_at_user_permission_override,ends_at_user_permission_override,created_by_user_id_user_permission_override,created_at_user_permission_override,revoked_by_user_id_user_permission_override,revoked_at_user_permission_override) SELECT user_id_user_permission_override,${target.id},effect_user_permission_override,reason_user_permission_override,status_user_permission_override,starts_at_user_permission_override,ends_at_user_permission_override,created_by_user_id_user_permission_override,created_at_user_permission_override,revoked_by_user_id_user_permission_override,revoked_at_user_permission_override FROM sec_user_permission_override WHERE permission_id_user_permission_override=${previous.id}`.execute(
        tx,
    );
    await sql`UPDATE sec_user SET permission_version_user=permission_version_user+1 WHERE status_user='active' AND deleted_at_user IS NULL`.execute(tx);
    await sql`INSERT INTO audit_security_event (public_id_security_event,event_type_security_event,summary_security_event,reason_security_event,metadata_security_event) VALUES (${ulid()},'role_permissions_replaced','Permiso de Gestión bancaria en proceso creado.','Ampliación de Formalización aprobada por el propietario; configuración bancaria y denegaciones preservadas.',${JSON.stringify({ migration: formalizationPurchaseFundsMigration.name, sourcePermission, targetPermission: permission })})`.execute(
        tx,
    );
}

/** Nativa únicamente; la columna legacy se aplica con el CLI separado y aprobación expresa. */
export const formalizationPurchaseFundsMigration = {
    name: "202611020062_formalization_purchase_funds",
    async up(db: Kysely<unknown>): Promise<void> {
        const statements = await planPurchaseFundsColumn(db, "native");
        // MySQL confirma DDL implícitamente: solo los catálogos/permisos comparten transacción.
        for (const statement of statements) await sql.raw(statement).execute(db);
        await db.transaction().execute(async (tx) => {
            for (const statement of await planBankingInProgressStage(tx, "native")) await sql.raw(statement).execute(tx);
            await addBankingPermission(tx);
        });
    },
};
