import { BadRequestException } from "@nestjs/common";
import { sql, type Transaction } from "kysely";

import type { CrmDatabase } from "../../../database/database.types.js";
import type { AuditActorSnapshot } from "./audit-actor.js";
import { getRecordAuditSourceChange } from "./audit-change-set.js";
import type { RecordAuditService } from "./record-audit.service.js";
import type { SecurityAuditEvent } from "./security-audit.service.js";

/** El cambio tiene que haber sido armado en el servidor. El cliente no llena este tipo. */
type SourceChange = NonNullable<ReturnType<typeof getRecordAuditSourceChange>>;
/** Tabla, llave y columna de busqueda fijas. Esos nombres son los unicos que llegan al SQL. */
type Definition = readonly [string, string, string];
/** Codigo de catalogo a tabla fisica, para bloquear la fila real y leer su id. */
const catalogTables: Record<string, Definition> = {
    projects: ["crm_project", "id_project", "public_id_project"],
    campaigns: ["crm_campaign", "id_campaign", "public_id_campaign"],
    classes: ["crm_class", "id_class", "public_id_class"],
    locations: ["crm_location", "id_location", "public_id_location"],
    subsidiaries: ["crm_subsidiary", "id_subsidiary", "public_id_subsidiary"],
    brokers: ["crm_broker", "id_broker", "public_id_broker"],
    files: ["crm_catalog_item", "id_catalog_item", "public_id_catalog_item"],
};
/** Desactivar, reactivar y borrar son cambio de estado. No se registran como borrado fisico. */
const actions = { create: "create", update: "update", deactivate: "state_change", reactivate: "state_change", delete: "state_change" } as const;

/** Fuera del registro no hay tabla. `hasOwn` evita que una clave del prototipo elija una. */
function catalogDefinition(code: unknown): Definition {
    if (typeof code !== "string" || !Object.hasOwn(catalogTables, code)) throw new BadRequestException("Unsupported commercial audit entity");
    return catalogTables[code] as Definition;
}

/** Banco, asesor, catalogo, usuario o rol. Otra entidad no se audita por este puente. */
function businessDefinition(change: SourceChange, catalogCode: unknown): Definition {
    switch (change.entity) {
        case "bank":
            return ["crm_bank", "id_bank", "public_id_bank"];
        case "bank_advisor":
            return ["crm_bank_advisor", "id_bank_advisor", "public_id_bank_advisor"];
        case "catalog":
            return catalogDefinition(catalogCode);
        case "user":
            return ["sec_user", "id_user", "public_id_user"];
        case "role":
            return ["sec_role", "id_role", "code_role"];
        default:
            throw new BadRequestException("Unsupported commercial audit entity");
    }
}

/** El id canonico sale de la fila bloqueada. Cero o dos filas no sirven, y el id tiene que ser un entero positivo. */
async function resolveSource(tx: Transaction<CrmDatabase>, change: SourceChange, catalogCode: unknown) {
    const [table, primaryKey, lookup] = businessDefinition(change, catalogCode);
    // Los identificadores salen del registro, no del texto de la peticion.
    const identity = await sql<{ id: string }>`SELECT CAST(${sql.ref(primaryKey)} AS CHAR) AS id FROM ${sql.table(table)} WHERE ${sql.ref(lookup)} = ${change.recordId} FOR UPDATE`.execute(tx);
    if (identity.rows.length !== 1) throw new BadRequestException("Audit source record is unavailable");
    const id = identity.rows[0]?.id;
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) throw new BadRequestException("Audit source identity is invalid");
    return { schema: "CRM_THINK_V2" as const, entity: change.entity, table, id };
}

/** IP y agente se recortan al ancho de la columna para no tumbar la transaccion. */
const networkContext = (event: SecurityAuditEvent) => ({ ipAddress: event.ipAddress?.slice(0, 80), userAgent: event.userAgent?.slice(0, 500) });

/** El snapshot administrativo es parcial. No es una imagen para restaurar el registro. */
export async function appendSecurityBusinessChange(records: RecordAuditService, tx: Transaction<CrmDatabase>, context: { event: SecurityAuditEvent; actor: AuditActorSnapshot; operationId: string }): Promise<void> {
    const { event, actor, operationId } = context;
    const change = getRecordAuditSourceChange(event.metadata?.changeSet);
    if (!change) throw new BadRequestException("Commercial audit requires a server-built changeset");
    const source = await resolveSource(tx, change, event.metadata?.catalogCode);
    await records.append(tx, {
        source,
        actor,
        action: actions[change.action],
        module: typeof event.metadata?.moduleCode === "string" ? event.metadata.moduleCode : "administration",
        before: change.before,
        after: change.after,
        allowedFields: Object.keys({ ...change.before, ...change.after }),
        operationId,
        correlationId: operationId,
        reason: event.reason ?? null,
        snapshotScope: "partial",
        ...networkContext(event),
    });
}
