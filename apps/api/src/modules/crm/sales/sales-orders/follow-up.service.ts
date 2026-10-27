import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationStages } from "../../../../common/security/route-permission.js";
import { IdentityService } from "../../identity/identity.service.js";
import type { IdentityProfile } from "../../identity/identity.types.js";
import { emptyFollowUpSource, type FollowUpAccess, followUpQuery, followUpQueues, type FollowUpResponse, presentFollowUpRow } from "./follow-up.contract.js";
import { FOLLOW_UP_LEGACY_READER, type FollowUpLegacyReader } from "./follow-up.port.js";
import { FollowUpRepository } from "./follow-up.repository.js";
import { HomeSummaryRepository } from "./home-summary.repository.js";
import { aggregateNumber } from "./home-summary.types.js";

/** Area scopes are module-wide here, matching Home banners; self/assigned grants stay owner-only. */
export function formalizationPermissionScope(profile: IdentityProfile, code: string): { allowed: boolean; ownOnly: boolean } {
    const grants = profile.permissions.filter((permission) => permission.code === code);
    const allows = grants.filter((grant) => grant.effect === "allow");
    if (!allows.length || grants.some((grant) => grant.effect === "deny")) return { allowed: false, ownOnly: true };
    if (allows.some((grant) => !["self", "assigned", "own_area", "own_area_and_children", "all_areas"].includes(grant.scope))) throw new ForbiddenException("Alcance de Formalizacion no reconocido.");
    return { allowed: true, ownOnly: allows.every((grant) => grant.scope === "self" || grant.scope === "assigned") };
}

/** A single global JSON, never copied orders or cached counts. */
@Injectable()
export class FollowUpService {
    /** Separates authorization, native projection and the optional legacy adapter. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(FollowUpRepository) private readonly repository: FollowUpRepository,
        @Inject(FOLLOW_UP_LEGACY_READER) private readonly legacy: FollowUpLegacyReader,
        @Inject(HomeSummaryRepository) private readonly snapshot: HomeSummaryRepository,
    ) {}
    /** Validates both role and live permissions before consulting either source. */
    async list(session: string | undefined, input: unknown): Promise<FollowUpResponse> {
        const profile = await this.identity.getCurrentUser(session);
        if (!canReadFormalizationStages(profile)) throw new ForbiddenException("Se requiere Formalizacion y permiso de lectura de etapas.");
        const parsed = followUpQuery.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Filtros de seguimiento invalidos.");
        const query = parsed.data;
        const stages = formalizationPermissionScope(profile, "formalizacion.home.stages.read");
        const approvals = formalizationPermissionScope(profile, "formalizacion.home.approvals.read");
        if (query.queue === "approvals" && !approvals.allowed) throw new ForbiddenException("No tiene permiso para consultar aprobaciones.");
        const access: FollowUpAccess = { approvals: approvals.allowed, actorId: profile.user.publicId, ownOnly: stages.ownOnly, approvalOwnOnly: approvals.ownOnly };
        const now = new Date();
        const year = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Costa_Rica", year: "numeric" }).format(now));
        const period = { start: new Date(Date.UTC(year, 0, 1, 6)).toISOString().slice(0, 23).replace("T", " "), endExclusive: new Date(Date.UTC(year + 1, 0, 1, 6)).toISOString().slice(0, 23).replace("T", " ") };
        const offset = (query.page - 1) * query.pageSize;
        try {
            return await this.snapshot.readSnapshot(async (tx) => {
                const native = await this.repository.read(tx, { ...query, offset, limit: query.pageSize }, period, access);
                const enabled = this.legacy.enabled();
                const legacy = enabled ? await this.legacy.read(tx, { ...query, offset: Math.max(0, offset - native.total), limit: query.pageSize - native.items.length }, period, access) : emptyFollowUpSource();
                const total = aggregateNumber(native.total + legacy.total);
                const counts = Object.fromEntries(followUpQueues.map((queue) => [queue, aggregateNumber(native.counts[queue] + legacy.counts[queue])])) as FollowUpResponse["counts"];
                const projects = [...new Map([...legacy.projects, ...native.projects].map((project) => [project.id, project])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
                return { schemaVersion: 1, observedAt: now.toISOString(), filters: { search: query.search, projectId: query.projectId, queue: query.queue }, page: { number: query.page, size: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) }, counts, projects, items: [...native.items, ...legacy.items].map((row) => presentFollowUpRow(row, now)), sources: { native: { total: native.total }, legacy: { total: legacy.total, enabled } } };
            });
        } catch {
            throw new ServiceUnavailableException("No fue posible consultar el seguimiento de Formalizacion.");
        }
    }
}
