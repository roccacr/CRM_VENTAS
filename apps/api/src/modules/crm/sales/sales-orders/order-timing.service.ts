import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationStages } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import { formalizationPermissionScope } from "./follow-up.service.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { orderTimingIdentity, orderTimingQuery, type TimingOrder } from "./order-timing.contract.js";
import { ORDER_TIMING_LEGACY_READER, type OrderTimingLegacyReader } from "./order-timing.port.js";
import { OrderTimingRepository } from "./order-timing.repository.js";

/** Reads one authoritative order's visit history, with the same visibility gates as follow-up. */
@Injectable()
export class OrderTimingService {
    /** Uses one shared read-only snapshot, not a query/connection per history row. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(OrderTimingRepository) private readonly repository: OrderTimingRepository,
        @Inject(ORDER_TIMING_LEGACY_READER) private readonly legacy: OrderTimingLegacyReader,
        @Inject(HomeSummaryRepository) private readonly snapshot: HomeSummaryRepository,
    ) {}
    /** Source-specific identities and pagination are validated before SQL. */
    async read(session: string | undefined, identity: unknown, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Permiso insuficiente para consultar tiempos de Formalizacion.");
        const target = orderTimingIdentity.safeParse(identity);
        const query = orderTimingQuery.safeParse(input);
        if (!target.success || !query.success) throw new BadRequestException("Identidad o paginacion de tiempos invalida.");
        const stages = formalizationPermissionScope(profile, "formalizacion.home.stages.read");
        const approvals = formalizationPermissionScope(profile, "formalizacion.home.approvals.read");
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
                this.assertVisible(order, profile.user.publicId, stages, approvals);
                const page = { offset: (query.data.page - 1) * query.data.pageSize, limit: query.data.pageSize };
                const data = source === "native" ? await this.repository.read(tx, order.id, page) : await this.legacy.read(tx, order.id, page);
                return { schemaVersion: 1 as const, observedAt: new Date().toISOString(), order: { source, id: order.publicId }, page: { number: query.data.page, size: query.data.pageSize, total: data.total, totalPages: Math.ceil(data.total / query.data.pageSize) }, summary: data.summary, items: data.items };
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible consultar los tiempos de la orden.");
        }
    }
    /** Authorization is enforced for the resource before any history projection or aggregate. */
    private assertVisible(order: TimingOrder, actor: string, stages: { ownOnly: boolean }, approvals: { allowed: boolean; ownOnly: boolean }): void {
        if (stages.ownOnly && order.ownerId !== actor) throw new ForbiddenException("La orden esta fuera de su alcance.");
        if (order.pendingApproval && (!approvals.allowed || (approvals.ownOnly && order.ownerId !== actor))) throw new ForbiddenException("Permiso de aprobaciones insuficiente.");
    }
}
