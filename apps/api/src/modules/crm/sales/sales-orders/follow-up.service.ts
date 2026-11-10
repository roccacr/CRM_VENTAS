import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import { canReadFormalizationOrder, canReadFormalizationQueue, canReadFormalizationStages, formalizationReadAccess } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityProfile } from "../../identity/identity.types.js";
import { type FollowUpAccess, type FollowUpDatabaseRow, followUpQuery, type FollowUpResponse, presentFollowUpRow } from "./follow-up.contract.js";
import { FOLLOW_UP_LEGACY_READER, type FollowUpLegacyReader } from "./follow-up.port.js";
import { FollowUpRepository } from "./follow-up.repository.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { orderTimingIdentity } from "./order-timing.contract.js";
import type { ProjectDistributionResponse } from "./project-distribution.contract.js";

/** El permiso de la acción de formalización cubre el módulo aunque el metadato de alcance no esté soportado. Un deny sigue ganando. */
export function formalizationPermissionScope(profile: Pick<IdentityProfile, "permissions">, code: string): { allowed: boolean; ownOnly: boolean } {
    const grants = profile.permissions.filter((permission) => permission.code === code);
    const allows = grants.filter((grant) => grant.effect === "allow");
    if (!allows.length || grants.some((grant) => grant.effect === "deny")) return { allowed: false, ownOnly: true };
    if (allows.some((grant) => !["self", "assigned", "own_area", "own_area_and_children", "all_areas"].includes(grant.scope))) throw new ForbiddenException("Alcance de Formalizacion no reconocido.");
    return { allowed: true, ownOnly: false };
}

/** Sin el permiso propio se conserva la orden en sus bandejas habituales, pero no se expone el marcador. */
function visibleAddendum(row: FollowUpDatabaseRow, allowed: boolean): FollowUpDatabaseRow {
    if (allowed) return row;
    const { addendumStatus: _hidden, ...visible } = row;
    return visible;
}

/** Un solo JSON global. No copia órdenes ni usa conteos cacheados. */
@Injectable()
export class FollowUpService {
    /** Separa la autorización, la proyección nativa y el adaptador viejo opcional. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(FollowUpRepository) private readonly repository: FollowUpRepository,
        @Inject(FOLLOW_UP_LEGACY_READER) private readonly legacy: FollowUpLegacyReader,
        @Inject(HomeSummaryRepository) private readonly snapshot: HomeSummaryRepository,
    ) {}
    /** Restaura un solo registro activo con autoridad. Las listas y los resúmenes del banner conservan permisos distintos. */
    async record(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationOrder(profile)) throw new ForbiddenException("No tiene permiso para consultar esta orden.");
        const target = orderTimingIdentity.safeParse(input);
        if (!target.success) throw new BadRequestException("Identidad de orden invalida.");
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period = { start: `${String(year)}-01-01 06:00:00.000`, endExclusive: `${String(year + 1)}-01-01 06:00:00.000` };
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                const native = await this.repository.findRecordAuthority(tx, target.data.source, target.data.id);
                let row: FollowUpDatabaseRow | undefined;
                if (native) {
                    if (!native.active) throw new NotFoundException("Orden disponible no encontrada.");
                    row = await this.repository.readRecord(tx, native.publicId, period);
                } else {
                    if (target.data.source === "native") throw new NotFoundException("Orden disponible no encontrada.");
                    if (!this.legacy.enabled()) throw new ServiceUnavailableException("Fuente antigua no disponible.");
                    row = await this.legacy.readRecord(tx, target.data.id, period);
                }
                if (!row) throw new NotFoundException("Orden disponible no encontrada.");
                return presentFollowUpRow(visibleAddendum(row, formalizationPermissionScope(profile, "formalizacion.orders.addendum.read").allowed), now);
            });
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new ServiceUnavailableException("No fue posible consultar la orden de Formalizacion.");
        }
    }
    /** Membresías globales del banner ya autorizadas. No dependen de la búsqueda, la selección ni la página de la lista. */
    async projectDistribution(session: string | undefined, input: unknown): Promise<ProjectDistributionResponse> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere Formalizacion y permiso de lectura de etapas.");
        if (!z.object({}).strict().safeParse(input).success) throw new BadRequestException("La distribucion no admite filtros.");
        const queues = formalizationReadAccess(profile);
        const access: FollowUpAccess = { queues, approvals: queues.approvals, actorId: profile.user.publicId, ownOnly: false, approvalOwnOnly: false };
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period = { start: `${String(year)}-01-01 06:00:00.000`, endExclusive: `${String(year + 1)}-01-01 06:00:00.000` };
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                const result = await this.repository.projectDistribution(tx, period, { access, ...(this.legacy.enabled() ? { legacy: this.legacy.projection(period) } : {}) });
                return { schemaVersion: 1, observedAt: now.toISOString(), ...result };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar la distribucion por proyecto.");
        }
    }
    /** Valida el rol y el permiso vivo antes de consultar cualquiera de las dos fuentes. */
    async list(session: string | undefined, input: unknown): Promise<FollowUpResponse> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere Formalizacion y permiso de lectura de etapas.");
        const parsed = followUpQuery.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Filtros de seguimiento invalidos.");
        const query = parsed.data;
        const queues = formalizationReadAccess(profile);
        if (![...(query.queues ?? []), query.queue].every((queue) => canReadFormalizationQueue(profile, queue))) throw new ForbiddenException("No tiene permiso para consultar esta categoria.");
        const canReadOrder = canReadFormalizationOrder(profile);
        const access: FollowUpAccess = { finiquito: canReadOrder, exactOrderSearch: canReadOrder, queues, approvals: queues.approvals, actorId: profile.user.publicId, ownOnly: false, approvalOwnOnly: false };
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period = { start: new Date(Date.UTC(year, 0, 1, 6)).toISOString().slice(0, 23).replace("T", " "), endExclusive: new Date(Date.UTC(year + 1, 0, 1, 6)).toISOString().slice(0, 23).replace("T", " ") };
        const offset = (query.page - 1) * query.pageSize;
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                const enabled = this.legacy.enabled();
                const result = await this.repository.readCombined(tx, { ...query, offset, limit: query.pageSize }, period, { access, ...(enabled ? { legacy: this.legacy.projection(period) } : {}) });
                const { total, counts } = result;
                counts.bankInProgress = queues.bank ? (counts.bankInProgress ?? 0) : 0;
                const projects = result.projects.sort((a, b) => a.name.localeCompare(b.name, "es"));
                return {
                    schemaVersion: 1,
                    observedAt: now.toISOString(),
                    filters: { search: query.search, projectId: query.projectId, queue: query.queue, projectIds: query.projectIds, queues: query.queues, bankStages: query.bankStages },
                    page: { number: query.page, size: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
                    counts,
                    projects,
                    items: result.items.map((row) => presentFollowUpRow(visibleAddendum(row, queues.addendum), now)),
                    sources: { native: { total: result.sourceTotals.native }, legacy: { total: result.sourceTotals.legacy, enabled } },
                };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar el seguimiento de Formalizacion.");
        }
    }
}
