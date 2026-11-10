import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationOrder } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../../identity/identity.types.js";
import { assertFormalizationOrderReadable } from "./formalization-read.policy.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { orderTimingIdentity, orderTimingQuery } from "./order-timing.contract.js";
import { ORDER_TIMING_LEGACY_READER, type OrderTimingLegacyReader } from "./order-timing.port.js";
import { OrderTimingRepository } from "./order-timing.repository.js";

/** Lee la historia de visitas de una orden con autoridad. El permiso de detalle de la orden es independiente. */
@Injectable()
export class OrderTimingService {
    /** Usa una foto compartida de solo lectura. No abre una consulta ni una conexión por fila de historia. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(OrderTimingRepository) private readonly repository: OrderTimingRepository,
        @Inject(ORDER_TIMING_LEGACY_READER) private readonly legacy: OrderTimingLegacyReader,
        @Inject(HomeSummaryRepository) private readonly snapshot: HomeSummaryRepository,
    ) {}
    /** La identidad de cada fuente y la paginación se validan antes del SQL. */
    async read(session: string | undefined, identity: unknown, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        return this.authorizeForProfile(profile, identity, input);
    }
    /** Reutiliza las mismas puertas vivas del recurso para un perfil de destino armado en el servidor. */
    async authorizeForProfile(profile: IdentityAuthorizationProfile, identity: unknown, input: unknown) {
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("Permiso insuficiente para consultar tiempos de Formalizacion.");
        const target = orderTimingIdentity.safeParse(identity);
        const query = orderTimingQuery.safeParse(input);
        if (!target.success || !query.success) throw new BadRequestException("Identidad o paginacion de tiempos invalida.");
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                let source: "native" | "legacy" = "native";
                let order = await this.repository.find(tx, target.data.source, target.data.id);
                if (!order && target.data.source === "legacy") {
                    if (!this.legacy.enabled()) throw new ServiceUnavailableException("Fuente antigua no disponible.");
                    source = "legacy";
                    order = await this.legacy.find(tx, target.data.id);
                }
                if (!order || !order.active) throw new NotFoundException("Orden disponible no encontrada.");
                assertFormalizationOrderReadable(profile, order);
                const page = { offset: (query.data.page - 1) * query.data.pageSize, limit: query.data.pageSize };
                const data = source === "native" ? await this.repository.read(tx, order.id, page) : await this.legacy.read(tx, order.id, page);
                return { schemaVersion: 1 as const, observedAt: new Date().toISOString(), order: { source, id: order.publicId }, page: { number: query.data.page, size: query.data.pageSize, total: data.total, totalPages: Math.ceil(data.total / query.data.pageSize) }, summary: data.summary, items: data.items };
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible consultar los tiempos de la orden.");
        }
    }
}
