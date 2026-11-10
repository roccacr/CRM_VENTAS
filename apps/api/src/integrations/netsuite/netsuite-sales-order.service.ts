import { randomUUID } from "node:crypto";

import { BadGatewayException, BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import { canReadFormalizationOrder } from "../../common/security/route-permission.js";
import { IdentityService } from "../../modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../modules/crm/identity/identity.types.js";
import { formalizationPermissionScope } from "../../modules/crm/sales/sales-orders/follow-up.service.js";
import { assertFormalizationOrderReadable } from "../../modules/crm/sales/sales-orders/formalization-read.policy.js";
import { orderTimingIdentity, type TimingOrder } from "../../modules/crm/sales/sales-orders/order-timing.contract.js";
import { NetsuiteOrderRepository } from "./netsuite-order.repository.js";
import { persistedOrderEvent, productionOrderEvent } from "./netsuite-order-event.contract.js";
import { readOrderRelationValues } from "./netsuite-order-event.mapper.js";
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";
import { reconcileImportRelations } from "./netsuite-order-import.relations.js";
import { NetsuiteRestletClient } from "./netsuite-restlet.client.js";

/** Authorized provider reads and manual database synchronization; never updates ERP records. */
@Injectable()
export class NetsuiteSalesOrderService {
    /**
     *
     */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NetsuiteOrderRepository) private readonly repository: NetsuiteOrderRepository,
        @Inject(NetsuiteRestletClient) private readonly client: NetsuiteRestletClient,
        @Inject(NetsuiteOrderEventService) private readonly events: NetsuiteOrderEventService,
    ) {}
    /**
     *
     */
    async read(session: string | undefined, input: unknown) {
        const resolved = await this.authorized(session, input, (target, check) => this.repository.resolve(target, check));
        // Release the database snapshot before the external request.
        const data = await this.client.readSalesOrder(resolved.netsuiteId);
        return { schemaVersion: 1 as const, order: resolved, data };
    }
    /** Same role, deny and resource checks as the provider read, with no external request. */
    async readDatabase(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(session, input, (target, check) => {
            const parsed = z
                .object({ historyCursor: z.string().max(2048).optional() })
                .strict()
                .safeParse(query);
            if (!parsed.success) throw new BadRequestException("Filtros de historial invalidos.");
            return this.repository.readDatabase(target, check, parsed.data.historyCursor);
        });
    }
    /** Read-only audit timeline shares the independent order permission and active-record gate. */
    async readHistory(session: string | undefined, input: unknown, query: unknown = {}) {
        return this.authorized(session, input, (target, check, profile) => {
            const parsed = z
                .object({ cursor: z.string().min(1).max(2048).optional() })
                .strict()
                .safeParse(query);
            if (!parsed.success) throw new BadRequestException("Filtros de bitácora inválidos.");
            return this.repository.readHistory(target, check, parsed.data.cursor, formalizationPermissionScope(profile, "formalizacion.orders.addendum.read").allowed);
        });
    }
    /** Metadata is available even if the provider is down; it never contacts NetSuite. */
    async synchronizationContext(session: string | undefined, input: unknown) {
        return this.authorized(session, input, async (target, check, profile) => {
            await this.repository.resolve(target, check);
            const context = this.client.integrationContext();
            const allowed = formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed;
            return { ...context, canSynchronize: allowed && this.events.synchronizationEnabled(context.environment) };
        });
    }
    /** Pull from the provider, then apply the same field matrix and transactional writer as events. */
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

    /**
     *
     */
    async executeQueuedImport(tranid: string, actor: Parameters<NetsuiteOrderRepository["captureSynchronizationActor"]>[1]) {
        return this.executeImport(tranid, () => Promise.resolve(actor), true);
    }

    private async executeImport(tranid: string, actor: () => Promise<Parameters<NetsuiteOrderRepository["captureSynchronizationActor"]>[1]>, queued = false) {
        const context = this.client.integrationContext();
        if (!this.events.synchronizationEnabled(context.environment)) throw new ServiceUnavailableException("Importación NetSuite deshabilitada para este ambiente.");
        const netsuiteId = await this.client.findSalesOrderByTranId(tranid);
        const event = await this.verifiedEvent(netsuiteId, context);
        const number = event.snapshot.data.fields.initialtranid;
        if (typeof number !== "string" || number.trim().toUpperCase() !== tranid) throw new BadGatewayException("NetSuite devolvió una orden distinta a la solicitada.");
        const current = await actor();
        const fields = event.snapshot.data.fields;
        const dependencies = queued ? await this.readMissingImportRelations(fields) : {};
        const outcome = { ownerLinked: true };
        const result = await this.events.receive(event, {
            importTranid: tranid,
            allowUnlinkedOwner: queued,
            authorize: async (tx, destination) => {
                const authorized = await this.repository.captureSynchronizationActor(tx, current);
                if (queued) outcome.ownerLinked = await reconcileImportRelations(tx, { fields, orderId: destination.id, netsuiteId, operationId: event.event.eventId, ...dependencies });
                return authorized;
            },
        });
        return { result: result.result, tranid, ...(outcome.ownerLinked ? {} : { warning: "Orden guardada sin responsable: falta vincular su cuenta." }) };
    }

    private async readMissingImportRelations(fields: Record<string, unknown>) {
        const { entity, subsidiary, crm_owner_employee, custbody38 } = readOrderRelationValues(fields);
        const [customer, subsidiaryName, ownerEmail, unit] = await Promise.all([
            entity && (await this.repository.importNeedsRelation("lead", entity)) ? this.client.readImportCustomer(entity) : undefined,
            subsidiary && (await this.repository.importNeedsRelation("subsidiary", subsidiary)) ? this.client.readImportRelation("subsidiary", subsidiary) : undefined,
            crm_owner_employee && (await this.repository.importNeedsRelation("user", crm_owner_employee)) ? this.client.readImportRelation("user", crm_owner_employee) : undefined,
            this.readMissingImportUnit(custbody38),
        ]);
        return { customer, subsidiaryName, ownerEmail, unit };
    }

    private async readMissingImportUnit(id: string | null | undefined) {
        if (id && (await this.repository.importNeedsRelation("unit_file", id))) return this.client.readImportUnit(id);
        return undefined;
    }

    private async verifiedEvent(netsuiteId: string, context: ReturnType<NetsuiteRestletClient["integrationContext"]>) {
        const raw = await this.client.readSalesOrderSnapshot(netsuiteId);
        const metadata = z.looseObject({ sourceModifiedAt: z.iso.datetime(), snapshotReadStartedAt: z.iso.datetime(), snapshotReadCompletedAt: z.iso.datetime() }).safeParse(raw);
        if (!metadata.success) throw new BadGatewayException("Actualiza la libreria NetSuite: no devolvio una lectura verificada para sincronizar.");
        const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt, ...snapshot } = metadata.data;
        const envelope = { schemaVersion: 2, source: { system: "netsuite", ...context }, event: { recordType: "salesorder", netsuiteId: netsuiteId, eventType: "edit", eventId: randomUUID(), observedAt: new Date().toISOString(), sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt }, snapshot };
        const parsed = (context.environment === "production" ? productionOrderEvent : persistedOrderEvent).safeParse(envelope);
        if (!parsed.success || parsed.data.snapshot.data.fields.crm_sync_projection !== 1) throw new BadGatewayException("NetSuite no devolvio la proyeccion completa y valida de esta orden.");
        return parsed.data;
    }

    private async authorized<T>(session: string | undefined, input: unknown, read: (target: { source: "native" | "legacy"; id: string }, check: (order: TimingOrder) => void, profile: IdentityProfile) => Promise<T>): Promise<T> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("Permiso insuficiente para consultar la orden.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden invalida.");
        return read(
            target.data,
            (order) => {
                assertFormalizationOrderReadable(profile, order);
            },
            profile,
        );
    }
}

function assertImportAccess(profile: IdentityProfile): void {
    if (!canReadFormalizationOrder(profile) || !formalizationPermissionScope(profile, "formalizacion.orders.stage.update").allowed) throw new ForbiddenException("No tiene permiso para extraer órdenes.");
}
