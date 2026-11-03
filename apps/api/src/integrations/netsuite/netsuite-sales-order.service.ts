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
import { NetsuiteOrderEventService } from "./netsuite-order-event.service.js";
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
            const raw = await this.client.readSalesOrderSnapshot(resolved.netsuiteId);
            const metadata = z.looseObject({ sourceModifiedAt: z.iso.datetime(), snapshotReadStartedAt: z.iso.datetime(), snapshotReadCompletedAt: z.iso.datetime() }).safeParse(raw);
            if (!metadata.success) throw new BadGatewayException("Actualiza la libreria NetSuite: no devolvio una lectura verificada para sincronizar.");
            const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt, ...snapshot } = metadata.data;
            const envelope = { schemaVersion: 2, source: { system: "netsuite", ...context }, event: { recordType: "salesorder", netsuiteId: resolved.netsuiteId, eventType: "edit", eventId: randomUUID(), observedAt: new Date().toISOString(), sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt }, snapshot };
            const parsed = (context.environment === "production" ? productionOrderEvent : persistedOrderEvent).safeParse(envelope);
            if (!parsed.success || parsed.data.snapshot.data.fields.crm_sync_projection !== 1) throw new BadGatewayException("NetSuite no devolvio la proyeccion completa y valida de esta orden.");
            const result = await this.events.receive(parsed.data, {
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
