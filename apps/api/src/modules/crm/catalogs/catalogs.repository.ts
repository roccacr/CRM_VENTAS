/**
 * Persistencia de `crm_catalog_item` y sus referencias.
 *
 * Varios catálogos comparten estas tablas y se distinguen por
 * `catalog_code_catalog_item`. Proyectos no: tiene agregado propio y esta
 * clase lo rechaza para no escribirlo en la tabla genérica. Alta, edición,
 * estado y auditoría van en la misma transacción.
 */
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Kysely } from "kysely";
import { ulid } from "ulid";

import { DatabaseService } from "../../../database/database.service.js";
import type { CrmDatabase } from "../../../database/database.types.js";
import { SecurityAuditService } from "../audit/security-audit.service.js";
import { ACTIVE_STATUS } from "../identity/identity-repository.shared.js";
import { type CatalogRouteCode, type CatalogStatus, findCatalogDefinition } from "./catalogs.constants.js";
import type { CatalogExternalReference, CatalogExternalReferenceInput, CatalogItem, CatalogItemsResponse, CatalogMutationInput, CatalogStatusMutationInput } from "./catalogs.types.js";

/** Estado que limpia la fecha de inactivación al reactivar. */
const INACTIVE_STATUS = "inactive";
/** Página cuando el cliente no pide un tamaño. */
const DEFAULT_LIMIT = 100;
/** Tope para no devolver el catálogo completo en una sola respuesta. */
const MAX_LIMIT = 200;

/** Conexión o transacción. Las lecturas de mutación usan la transacción para ver lo que todavía no se confirmó. */
type CatalogExecutor = Pick<Kysely<CrmDatabase>, "deleteFrom" | "insertInto" | "selectFrom" | "transaction" | "updateTable">;

/** Fila viva de `crm_catalog_item`. El id interno no sale en la respuesta pública. */
interface CatalogItemRow {
    detail: string | null;
    id: number;
    name: string;
    nativeCode: string;
    publicId: string;
    status: CatalogStatus;
    updatedAt: Date | string;
}

/** Referencia activa unida al nombre del sistema externo. */
interface ExternalReferenceRow {
    catalogItemId: number;
    externalId: string;
    status: string;
    systemCode: string;
    systemName: string;
}

/** Id interno del usuario que firma la auditoría. El público no se guarda en la fila del catálogo. */
interface ActorRow {
    id: number;
}

/** Fecha del contrato. MySQL puede devolver `Date` o texto según el driver. */
const toIsoString = (value: Date | string): string => (value instanceof Date ? value.toISOString() : new Date(value).toISOString());
/** Omite IP o user agent vacíos para no guardar campos de auditoría en blanco. */
const auditRequestContext = (input: { readonly ipAddress?: string | undefined; readonly userAgent?: string | undefined }): { readonly ipAddress?: string; readonly userAgent?: string } => ({
    ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    ...(input.userAgent ? { userAgent: input.userAgent } : {}),
});

/** Límite de la consulta. El caso de uso ya validó el query; esta segunda revisión cubre llamadas internas. */
const normalizeLimit = (limit?: number): number => {
    if (limit === undefined) {
        return DEFAULT_LIMIT;
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
        throw new BadRequestException("Límite de catálogos inválido.");
    }

    return limit;
};

@Injectable()
export class CatalogsRepository {
    /**
     * @param database - Base del CRM nuevo
     * @param audit - Evento que debe revertirse si la mutación falla
     */
    constructor(
        @Inject(DatabaseService) private readonly database: DatabaseService,
        @Inject(SecurityAuditService) private readonly audit: SecurityAuditService,
    ) {}

    /**
     * Lista un catálogo compartido.
     *
     * Proyectos se rechaza para no devolverlos como si vivieran en `crm_catalog_item`.
     */
    async listCatalogItems(input: { catalogCode: CatalogRouteCode; limit?: number; offset?: number; search?: string; status?: CatalogStatus }): Promise<CatalogItemsResponse> {
        if (input.catalogCode === "projects") throw new BadRequestException("Use the Projects module.");
        return this.listSharedCatalogItems(input);
    }

    /** Filtra por código, estado y texto. La búsqueda también mira ids externos que no estén archivados. */
    private async listSharedCatalogItems(input: { catalogCode: CatalogRouteCode; limit?: number; offset?: number; search?: string; status?: CatalogStatus }): Promise<CatalogItemsResponse> {
        const definition = findCatalogDefinition(input.catalogCode);

        if (!definition) {
            throw new BadRequestException("Catálogo no soportado.");
        }

        let query = this.database.db.selectFrom("crm_catalog_item as item").select(["item.detail_catalog_item as detail", "item.id_catalog_item as id", "item.name_catalog_item as name", "item.native_code_catalog_item as nativeCode", "item.public_id_catalog_item as publicId", "item.status_catalog_item as status", "item.updated_at_catalog_item as updatedAt"]).where("item.catalog_code_catalog_item", "=", input.catalogCode).where("item.deleted_at_catalog_item", "is", null);

        if (input.status) {
            query = query.where("item.status_catalog_item", "=", input.status);
        }

        if (input.search) {
            const pattern = `%${input.search}%`;
            query = query.where((expression) =>
                expression.or([
                    expression("item.name_catalog_item", "like", pattern),
                    expression("item.detail_catalog_item", "like", pattern),
                    expression.exists(expression.selectFrom("crm_catalog_item_external_reference as reference").select("reference.id_catalog_item_external_reference").whereRef("reference.catalog_item_id_catalog_item_external_reference", "=", "item.id_catalog_item").where("reference.deleted_at_catalog_item_external_reference", "is", null).where("reference.external_id_catalog_item_external_reference", "like", pattern)),
                ]),
            );
        }

        const offset = input.offset ?? 0;
        if (!Number.isInteger(offset) || offset < 0 || offset > 2147483647) throw new BadRequestException("Desplazamiento de catálogo inválido.");
        const count = await query
            .clearSelect()
            .select((expression) => expression.fn.countAll<number | string>().as("total"))
            .executeTakeFirstOrThrow();
        const rows = (await query.orderBy("item.name_catalog_item", "asc").orderBy("item.id_catalog_item", "asc").offset(offset).limit(normalizeLimit(input.limit)).execute()) as CatalogItemRow[];
        const referencesByItem = await this.findExternalReferencesByItemIds(rows.map((row) => row.id));

        return {
            catalog: {
                code: definition.routeCode,
                label: definition.label,
                moduleCode: definition.moduleCode,
            },
            items: rows.map((row) => this.mapCatalogItem(row, referencesByItem.get(row.id) ?? [])),
            total: Number(count.total),
        };
    }

    /**
     * Inserta el valor, sus referencias y la auditoría.
     *
     * El ULID es la identidad pública. El código nativo solo la repite con el prefijo del catálogo.
     */
    async createCatalogItem(input: CatalogMutationInput): Promise<CatalogItem> {
        if (input.catalogCode === "projects") throw new BadRequestException("Use the Projects module.");
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            await this.assertExternalReferencesAreAvailable(transaction, input.catalogCode, input.externalReferences);
            const now = new Date();
            const publicId = ulid();
            const nativeCode = `${input.catalogCode}_${publicId.toLowerCase()}`;

            const result = await transaction
                .insertInto("crm_catalog_item")
                .values({
                    catalog_code_catalog_item: input.catalogCode,
                    created_at_catalog_item: now,
                    created_by_user_id_catalog_item: actor.id,
                    detail_catalog_item: input.detail ?? null,
                    name_catalog_item: input.name,
                    native_code_catalog_item: nativeCode,
                    public_id_catalog_item: publicId,
                    status_catalog_item: ACTIVE_STATUS,
                    updated_at_catalog_item: now,
                    updated_by_user_id_catalog_item: actor.id,
                })
                .executeTakeFirstOrThrow();

            const itemId = Number(result.insertId);
            await this.insertExternalReferences(transaction, itemId, input.catalogCode, input.externalReferences, now);
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "catalog_item_created",
                    metadata: { catalogCode: input.catalogCode, externalReferences: input.externalReferences.map((reference) => reference.systemCode) },
                    reason: input.reason,
                    summary: `Valor de catálogo ${input.name} creado.`,
                    ...auditRequestContext(input),
                },
                transaction,
            );

            const item = await this.findCatalogItemByPublicId(transaction, input.catalogCode, publicId);
            if (!item) {
                throw new BadRequestException("No se pudo leer el catálogo creado.");
            }

            return item;
        });
    }

    /**
     * Actualiza nombre y detalle, y deja activas solo las referencias recibidas.
     *
     * Las que salen del cuerpo se archivan. No se borran, porque la clave única incluye filas archivadas.
     */
    async updateCatalogItem(itemPublicId: string, input: CatalogMutationInput): Promise<CatalogItem | null> {
        if (input.catalogCode === "projects") throw new BadRequestException("Use the Projects module.");
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const current = await this.findCatalogItemRowByPublicId(transaction, input.catalogCode, itemPublicId);

            if (!current) {
                return null;
            }

            await this.assertExternalReferencesAreAvailable(transaction, input.catalogCode, input.externalReferences, current.id);
            const now = new Date();
            await transaction
                .updateTable("crm_catalog_item")
                .set({
                    detail_catalog_item: input.detail ?? null,
                    name_catalog_item: input.name,
                    updated_at_catalog_item: now,
                    updated_by_user_id_catalog_item: actor.id,
                })
                .where("id_catalog_item", "=", current.id)
                .executeTakeFirst();
            await this.replaceExternalReferences(transaction, current.id, input.catalogCode, input.externalReferences, now);
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "catalog_item_updated",
                    metadata: { catalogCode: input.catalogCode, itemPublicId },
                    reason: input.reason,
                    summary: `Valor de catálogo ${input.name} actualizado.`,
                    ...auditRequestContext(input),
                },
                transaction,
            );

            return this.findCatalogItemByPublicId(transaction, input.catalogCode, itemPublicId);
        });
    }

    /**
     * Cambia el estado sin tocar las referencias.
     *
     * Inactivar guarda actor y fecha. Reactivar los limpia para no dejar un cierre vigente.
     */
    async updateCatalogItemStatus(input: CatalogStatusMutationInput): Promise<CatalogItem | null> {
        if (input.catalogCode === "projects") throw new BadRequestException("Use the Projects module.");
        return this.database.db.transaction().execute(async (transaction) => {
            const actor = await this.readActor(transaction, input.actorPublicId);
            const current = await this.findCatalogItemRowByPublicId(transaction, input.catalogCode, input.itemPublicId);

            if (!current) {
                return null;
            }

            const now = new Date();
            await transaction
                .updateTable("crm_catalog_item")
                .set({
                    inactivated_at_catalog_item: input.status === INACTIVE_STATUS ? now : null,
                    inactivated_by_user_id_catalog_item: input.status === INACTIVE_STATUS ? actor.id : null,
                    status_catalog_item: input.status,
                    updated_at_catalog_item: now,
                    updated_by_user_id_catalog_item: actor.id,
                })
                .where("id_catalog_item", "=", current.id)
                .executeTakeFirst();
            await this.audit.record(
                {
                    actorUserId: actor.id,
                    eventType: "catalog_item_status_changed",
                    metadata: { catalogCode: input.catalogCode, nextStatus: input.status, previousStatus: current.status },
                    reason: input.reason,
                    summary: `Valor de catálogo ${current.name} marcado como ${input.status}.`,
                    ...auditRequestContext(input),
                },
                transaction,
            );

            return this.findCatalogItemByPublicId(transaction, input.catalogCode, input.itemPublicId);
        });
    }

    /** Resuelve al usuario vivo de la sesión. Un actor borrado no administra catálogos. */
    private async readActor(executor: CatalogExecutor, actorPublicId: string): Promise<ActorRow> {
        const actor = await executor.selectFrom("sec_user").select("id_user as id").where("public_id_user", "=", actorPublicId).where("deleted_at_user", "is", null).executeTakeFirst();

        if (!actor) {
            throw new BadRequestException("Actor no disponible para administrar catálogos.");
        }

        return actor;
    }

    /**
     * Comprueba sistemas activos y que el id externo no sea de otro valor del mismo catálogo.
     *
     * `excludedItemId` permite conservar las referencias que ya pertenecen al valor que se edita.
     */
    private async assertExternalReferencesAreAvailable(executor: CatalogExecutor, catalogCode: CatalogRouteCode, references: readonly CatalogExternalReferenceInput[], excludedItemId?: number): Promise<void> {
        const seen = new Set<string>();

        for (const reference of references) {
            const key = `${reference.systemCode}:${reference.externalId}`;

            if (seen.has(key)) {
                throw new ConflictException("Hay referencias externas duplicadas en el formulario.");
            }

            seen.add(key);
            const system = await executor.selectFrom("int_external_system").select("id_external_system as id").where("code_external_system", "=", reference.systemCode).where("status_external_system", "=", ACTIVE_STATUS).executeTakeFirst();

            if (!system) {
                throw new BadRequestException(`Sistema externo no configurado: ${reference.systemCode}.`);
            }

            const existing = await executor.selectFrom("crm_catalog_item_external_reference").select(["catalog_item_id_catalog_item_external_reference as itemId"]).where("catalog_code_catalog_item_external_reference", "=", catalogCode).where("external_system_id_catalog_item_external_reference", "=", system.id).where("external_id_catalog_item_external_reference", "=", reference.externalId).executeTakeFirst();

            if (existing && existing.itemId !== excludedItemId) {
                throw new ConflictException("Una referencia externa ya pertenece a otro valor del catálogo.");
            }
        }
    }

    /** Archiva las referencias que este reemplazo no conservó. */
    // eslint-disable-next-line max-params -- Operacion transaccional local; agruparlo agregaria un tipo sin reutilizacion real.
    private async replaceExternalReferences(executor: CatalogExecutor, itemId: number, catalogCode: CatalogRouteCode, references: readonly CatalogExternalReferenceInput[], now: Date): Promise<void> {
        const retainedIds = await this.insertExternalReferences(executor, itemId, catalogCode, references, now);
        let removed = executor.updateTable("crm_catalog_item_external_reference").set({ deleted_at_catalog_item_external_reference: now, status_catalog_item_external_reference: INACTIVE_STATUS, updated_at_catalog_item_external_reference: now }).where("catalog_item_id_catalog_item_external_reference", "=", itemId).where("deleted_at_catalog_item_external_reference", "is", null);
        if (retainedIds.length > 0) {
            removed = removed.where("id_catalog_item_external_reference", "not in", retainedIds);
        }
        await removed.execute();
    }

    /**
     * Inserta o reactiva cada referencia.
     *
     * La clave única incluye filas archivadas, así que una referencia vieja del mismo valor se restaura en lugar de insertarse de nuevo.
     */
    // eslint-disable-next-line max-params -- Operacion transaccional local; los parametros describen el mismo write atomico.
    private async insertExternalReferences(executor: CatalogExecutor, itemId: number, catalogCode: CatalogRouteCode, references: readonly CatalogExternalReferenceInput[], now: Date): Promise<number[]> {
        const retainedIds: number[] = [];
        for (const reference of references) {
            const system = await executor.selectFrom("int_external_system").select("id_external_system as id").where("code_external_system", "=", reference.systemCode).where("status_external_system", "=", ACTIVE_STATUS).executeTakeFirstOrThrow();
            // La clave única incluye filas archivadas: se reactivan en lugar de volver a insertarlas.
            const existing = await executor
                .selectFrom("crm_catalog_item_external_reference")
                .select(["id_catalog_item_external_reference as id", "catalog_item_id_catalog_item_external_reference as itemId", "deleted_at_catalog_item_external_reference as deletedAt", "status_catalog_item_external_reference as status"])
                .where("catalog_code_catalog_item_external_reference", "=", catalogCode)
                .where("external_system_id_catalog_item_external_reference", "=", system.id)
                .where("external_id_catalog_item_external_reference", "=", reference.externalId)
                .executeTakeFirst();
            if (existing) {
                if (existing.itemId !== itemId) {
                    throw new ConflictException("Una referencia externa ya pertenece a otro valor del catálogo.");
                }
                if (existing.deletedAt !== null || existing.status !== ACTIVE_STATUS) {
                    await executor.updateTable("crm_catalog_item_external_reference").set({ deleted_at_catalog_item_external_reference: null, status_catalog_item_external_reference: ACTIVE_STATUS, updated_at_catalog_item_external_reference: now }).where("id_catalog_item_external_reference", "=", existing.id).execute();
                }
                retainedIds.push(existing.id);
                continue;
            }
            const result = await executor
                .insertInto("crm_catalog_item_external_reference")
                .values({
                    catalog_code_catalog_item_external_reference: catalogCode,
                    catalog_item_id_catalog_item_external_reference: itemId,
                    created_at_catalog_item_external_reference: now,
                    external_id_catalog_item_external_reference: reference.externalId,
                    external_system_id_catalog_item_external_reference: system.id,
                    status_catalog_item_external_reference: ACTIVE_STATUS,
                    updated_at_catalog_item_external_reference: now,
                })
                .executeTakeFirstOrThrow()
                .catch((error: unknown) => {
                    // Otra transacción pudo tomar la clave después de la comprobación previa.
                    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
                        throw new ConflictException("Una referencia externa ya pertenece a otro valor del catálogo.");
                    }
                    throw error;
                });
            retainedIds.push(Number(result.insertId));
        }
        return retainedIds;
    }

    /** Lee el valor y sus referencias dentro del ejecutor de la transacción. */
    private async findCatalogItemByPublicId(executor: CatalogExecutor, catalogCode: CatalogRouteCode, publicId: string): Promise<CatalogItem | null> {
        const row = await this.findCatalogItemRowByPublicId(executor, catalogCode, publicId);

        if (!row) {
            return null;
        }

        const references = await this.findExternalReferencesByItemIds([row.id], executor);
        return this.mapCatalogItem(row, references.get(row.id) ?? []);
    }

    /** Bloquea la fila viva. El código de catálogo evita editar un valor de otro catálogo con el mismo público. */
    private async findCatalogItemRowByPublicId(executor: CatalogExecutor, catalogCode: CatalogRouteCode, publicId: string): Promise<CatalogItemRow | null> {
        const row = await executor.selectFrom("crm_catalog_item").select(["detail_catalog_item as detail", "id_catalog_item as id", "name_catalog_item as name", "native_code_catalog_item as nativeCode", "public_id_catalog_item as publicId", "status_catalog_item as status", "updated_at_catalog_item as updatedAt"]).where("catalog_code_catalog_item", "=", catalogCode).where("public_id_catalog_item", "=", publicId).where("deleted_at_catalog_item", "is", null).forUpdate().executeTakeFirst();

        return (row as CatalogItemRow | undefined) ?? null;
    }

    /** Referencias activas de varios valores, en una sola consulta, para no leerlas fila por fila. */
    private async findExternalReferencesByItemIds(itemIds: readonly number[], executor: CatalogExecutor = this.database.db): Promise<Map<number, ExternalReferenceRow[]>> {
        if (itemIds.length === 0) {
            return new Map();
        }

        const rows = (await executor
            .selectFrom("crm_catalog_item_external_reference as reference")
            .innerJoin("int_external_system as system", "system.id_external_system", "reference.external_system_id_catalog_item_external_reference")
            .select(["reference.catalog_item_id_catalog_item_external_reference as catalogItemId", "reference.external_id_catalog_item_external_reference as externalId", "reference.status_catalog_item_external_reference as status", "system.code_external_system as systemCode", "system.name_external_system as systemName"])
            .where("reference.catalog_item_id_catalog_item_external_reference", "in", [...itemIds])
            .where("reference.deleted_at_catalog_item_external_reference", "is", null)
            .orderBy("system.code_external_system", "asc")
            .execute()) as ExternalReferenceRow[];

        const grouped = new Map<number, ExternalReferenceRow[]>();

        for (const row of rows) {
            grouped.set(row.catalogItemId, [...(grouped.get(row.catalogItemId) ?? []), row]);
        }

        return grouped;
    }

    /** Arma el contrato público. El id interno de la fila no se copia. */
    private mapCatalogItem(row: CatalogItemRow, externalReferences: readonly CatalogExternalReference[]): CatalogItem {
        return {
            detail: row.detail,
            externalReferences,
            name: row.name,
            nativeCode: row.nativeCode,
            publicId: row.publicId,
            status: row.status,
            updatedAt: toIsoString(row.updatedAt),
        };
    }
}
