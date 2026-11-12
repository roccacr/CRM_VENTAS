import { BadGatewayException, BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import { canReadFormalizationOrder } from "../../common/security/route-permission.js";
import { captureIntegrationAuditActor } from "../../modules/crm/audit/audit-actor.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { formalizationPermissionScope } from "../../modules/crm/sales/sales-orders/follow-up.service.js";
import { assertFormalizationOrderReadable } from "../../modules/crm/sales/sales-orders/formalization-read.policy.js";
import { orderTimingIdentity, type TimingOrder } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { type PersistedOrderEvent, verifiedOrderEventFromSnapshot } from "./netsuite-order-event.contract.js";
import { readOrderRelationValues } from "./netsuite-order-event.mapper.js";
import type { ManualOrderSynchronization } from "./netsuite-order-event.repository.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";
import { reconcileImportRelations } from "./netsuite-order-import.relations.js";
import { NetsuiteRestletClient } from "./netsuite-restlet.client.js";

/**
 * Lecturas autorizadas y sincronizacion hacia la base. Este servicio no escribe en el ERP.
 * La foto de la orden se suelta antes de llamar a NetSuite.
 */
@Injectable()
export class NetsuiteSalesOrderService {
    /** Identidad, base, RESTlet y el escritor durable. Ninguno se llama al construir. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NetsuiteOrderRepository) private readonly repository: NetsuiteOrderRepository,
        @Inject(NetsuiteRestletClient) private readonly client: NetsuiteRestletClient,
        @Inject(NetsuiteOrderEventService) private readonly events: NetsuiteOrderEventService,
    ) {}
    /** Resuelve la orden en la base y despues lee el proveedor. El JSON externo no se persiste. */
    async read(session: string | undefined, input: unknown) {
        const resolved = await this.authorized(session, input, (target, check) => this.repository.resolve(target, check, true), true);
        // La foto de la base se suelta antes de la llamada externa.
        const data = await this.client.readSalesOrder(resolved.netsuiteId);
        return { schemaVersion: 1 as const, order: resolved, data };
    }
    /** Misma autoridad que la lectura del proveedor, sin salir a NetSuite. Un query extra se rechaza. */
    async readDatabase(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(
            session,
            input,
            (target, check) => {
                const parsed = z
                    .object({ historyCursor: z.string().max(2048).optional() })
                    .strict()
                    .safeParse(query);
                if (!parsed.success) throw new BadRequestException("Filtros de historial invalidos.");
                return this.repository.readDatabase(target, check, parsed.data.historyCursor);
            },
            true,
        );
    }
    /** La bitacora usa el permiso de la orden. El adendum entra solo si ese permiso de lectura esta concedido. */
    async readHistory(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(
            session,
            input,
            (target, check, profile) => {
                const parsed = z
                    .object({ cursor: z.string().min(1).max(2048).optional() })
                    .strict()
                    .safeParse(query);
                if (!parsed.success) throw new BadRequestException("Filtros de bitácora inválidos.");
                return this.repository.readHistory(target, check, parsed.data.cursor, formalizationPermissionScope(profile, "formalizacion.orders.addendum.read").allowed);
            },
            true,
        );
    }
    /** Consultar el ambiente admite inactivas; mostrarlo no habilita su sincronización ni llama a NetSuite. */
    async synchronizationContext(session: string | undefined, input: unknown) {
        return this.authorized(
            session,
            input,
            async (target, check, profile) => {
                const availability = { active: false };
                await this.repository.resolve(
                    target,
                    (order) => {
                        check(order);
                        availability.active = order.active;
                    },
                    true,
                );
                const context = this.client.integrationContext();
                const allowed = formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed;
                return { ...context, canSynchronize: availability.active && allowed && this.events.synchronizationEnabled(context.environment) };
            },
            true,
        );
    }
    /** Lee la foto verificada y la aplica con el mismo escritor que el webhook. El navegador no manda campos. Si el permiso cambia durante la lectura, no se escribe. */
    async synchronize(session: string | undefined, input: unknown) {
        return this.authorized(session, input, async (target, check, profile) => {
            if (!formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed) throw new ForbiddenException("No tiene permiso para sincronizar esta orden.");
            const context = this.client.integrationContext();
            if (!this.events.synchronizationEnabled(context.environment)) throw new ServiceUnavailableException("Sincronizacion deshabilitada para este ambiente y base de datos.");
            const resolved = await this.repository.resolve(target, check);
            const event = await this.verifiedEvent(resolved.netsuiteId, context);
            const result = await this.events.receive(event, {
                authorize: async (tx, destination) => {
                    const current = await this.identity.getCurrentUser(session);
                    if (current.user.publicId !== profile.user.publicId || !canReadFormalizationOrder(current) || !formalizationPermissionScope(current, "formalizacion.orders.stage.update").allowed) throw new ForbiddenException("La autorizacion cambio durante la consulta; recarga la orden.");
                    return this.repository.authorizeSynchronization(tx, {
                        target,
                        netsuiteId: resolved.netsuiteId,
                        destination,
                        check: (order) => {
                            assertFormalizationOrderReadable(current, order);
                        },
                        profile: current,
                    });
                },
            });
            return { ...result, environment: context.environment };
        });
    }
    /** El navegador solo indica el número; la cuenta, el ID y los campos vienen del servidor. */
    async importOrder(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        assertImportAccess(profile);
        const parsed = z
            .strictObject({
                tranid: z
                    .string()
                    .trim()
                    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/),
            })
            .safeParse(input);
        if (!parsed.success) throw new BadRequestException("Indica el número exacto de la orden.");
        const tranid = parsed.data.tranid.toUpperCase();
        return this.executeImport(tranid, async () => {
            const current = await this.identity.getCurrentUser(session);
            if (current.user.publicId !== profile.user.publicId) throw new ForbiddenException("La autorización cambió durante la consulta.");
            assertImportAccess(current);
            return current;
        });
    }

    /** La cola reutiliza la extraccion. El actor ya viene resuelto y se vuelve a bloquear dentro de la transaccion. */
    async executeQueuedImport(tranid: string, actor: Parameters<NetsuiteOrderRepository["captureSynchronizationActor"]>[1]) {
        return this.executeImport(tranid, () => Promise.resolve(actor), true);
    }

    /** Una entrega autenticada puede recuperar una orden ausente con una foto fresca del mismo entorno y cuenta. */
    async executeEventImport(request: { netsuiteId: string; accountId: string; environment: "production" | "sandbox" }) {
        const context = this.client.integrationContext();
        if (context.accountId !== request.accountId || context.environment !== request.environment) throw new ForbiddenException("La importación automática pertenece a otro entorno de NetSuite.");
        if (!this.events.synchronizationEnabled(context.environment)) throw new ServiceUnavailableException("Importación NetSuite deshabilitada para este ambiente.");
        const event = await this.verifiedEvent(request.netsuiteId, context);
        return this.applyImport(
            event,
            () =>
                Promise.resolve(
                    captureIntegrationAuditActor({
                        publicId: "integration:netsuite:" + context.accountId,
                        name: "NetSuite " + context.environment + " automatic import",
                    }),
                ),
            true,
            true,
        );
    }

    /** El numero del snapshot tiene que ser el pedido. La cola crea alias ERP faltantes, nunca usuarios ni asignaciones de responsables. */
    private async executeImport(tranid: string, actor: () => Promise<Parameters<NetsuiteOrderRepository["captureSynchronizationActor"]>[1]>, queued = false): Promise<{ result: "applied" | "unchanged" | "not_found"; tranid: string; warning?: string }> {
        const context = this.client.integrationContext();
        if (!this.events.synchronizationEnabled(context.environment)) throw new ServiceUnavailableException("Importación NetSuite deshabilitada para este ambiente.");
        const netsuiteId = await this.client.findSalesOrderByTranId(tranid);
        const event = await this.verifiedEvent(netsuiteId, context);
        const number = event.snapshot.data.fields.initialtranid;
        if (typeof number !== "string" || number.trim().toUpperCase() !== tranid) throw new BadGatewayException("NetSuite devolvió una orden distinta a la solicitada.");
        const current = await actor();
        return this.applyImport(event, (tx) => this.repository.captureSynchronizationActor(tx, current), queued);
    }

    private async applyImport(event: PersistedOrderEvent, authorize: ManualOrderSynchronization["authorize"], queued: boolean, importIfMissing = false): Promise<{ result: "applied" | "unchanged" | "not_found"; tranid: string; warning?: string }> {
        const number = event.snapshot.data.fields.initialtranid;
        if (typeof number !== "string" || !number.trim() || number.trim().length > 180) throw new BadGatewayException("NetSuite no confirmó el número de orden.");
        const tranid = number.trim().toUpperCase();
        const fields = event.snapshot.data.fields;
        const dependencies = queued ? await this.readMissingImportRelations(fields) : {};
        const result = await this.events.receive(event, {
            importTranid: tranid,
            importIfMissing,
            authorize: async (tx, destination) => {
                const authorized = await authorize(tx, destination);
                if (queued && destination.destination === "native") await reconcileImportRelations(tx, { fields, orderId: destination.id, netsuiteId: event.event.netsuiteId, operationId: event.event.eventId, ...dependencies });
                return authorized;
            },
        });
        return { result: result.result, tranid };
    }

    private async readMissingImportRelations(fields: Record<string, unknown>) {
        const { entity, subsidiary, custbody38 } = readOrderRelationValues(fields);
        const [customer, subsidiaryName, unit] = await Promise.all([entity && (await this.repository.importNeedsRelation("lead", entity)) ? this.client.readImportCustomer(entity) : undefined, subsidiary && (await this.repository.importNeedsRelation("subsidiary", subsidiary)) ? this.client.readImportRelation("subsidiary", subsidiary) : undefined, this.readMissingImportUnit(custbody38)]);
        return { customer, subsidiaryName, unit };
    }

    private async readMissingImportUnit(id: string | null | undefined) {
        if (id && (await this.repository.importNeedsRelation("unit_file", id))) return this.client.readImportUnit(id);
        return undefined;
    }

    /** La foto tiene que traer las tres marcas de tiempo y `crm_sync_projection=1`. Si no, no se sincroniza contra una libreria vieja. */
    private async verifiedEvent(netsuiteId: string, context: ReturnType<NetsuiteRestletClient["integrationContext"]>) {
        const raw = await this.client.readSalesOrderSnapshot(netsuiteId);
        return verifiedOrderEventFromSnapshot(raw, netsuiteId, context);
    }

    private async authorized<T>(session: string | undefined, input: unknown, read: (target: { source: "native" | "legacy"; id: string }, check: (order: TimingOrder) => void, profile: IdentityProfile) => Promise<T>, includeInactive = false): Promise<T> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("Permiso insuficiente para consultar la orden.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden invalida.");
        return read(
            target.data,
            (order) => {
                assertFormalizationOrderReadable(profile, order, includeInactive);
            },
            profile,
        );
    }
}

function assertImportAccess(profile: IdentityProfile): void {
    if (!canReadFormalizationOrder(profile) || !formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed) throw new ForbiddenException("No tiene permiso para extraer órdenes.");
}
