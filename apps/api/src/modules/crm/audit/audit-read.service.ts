import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { isValid } from "ulid";
import { z } from "zod";

import { CATALOG_DEFINITIONS } from "../catalogs/catalogs.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import { buildAuditChangeSet } from "./audit-change-set.js";
import { buildAuditReadContext } from "./audit-read.context.js";
import { AUDIT_MODULES, type AuditQueryDto, decodeAuditCursor, encodeAuditCursor } from "./audit-read.contract.js";
import { AuditReadRepository } from "./audit-read.repository.js";

const changeSetSchema = z.object({ version: z.literal(1), entity: z.string().min(1), recordId: z.string().min(1), action: z.enum(["create", "update", "deactivate", "reactivate", "delete"]), before: z.record(z.string(), z.unknown()).nullable(), after: z.record(z.string(), z.unknown()).nullable() });

/** Old/malformed events have no comparison; safe snapshots cannot expose arbitrary JSON. */
function safeChangeSet(value: unknown) {
    try {
        const parsed = changeSetSchema.safeParse(typeof value === "string" ? JSON.parse(value) : value);
        if (!parsed.success) return null;
        return buildAuditChangeSet(parsed.data);
    } catch {
        return null;
    }
}

/** Authenticated scope-first access to immutable, paginated audit history. */
@Injectable()
export class AuditReadService {
    /** Identity authorization is reused without exposing audit writes. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(AuditReadRepository) private readonly repository: AuditReadRepository,
    ) {}
    private async authorize(token: string | undefined): Promise<void> {
        const profile = await this.identity.getCurrentUser(token);
        if (profile.roles.some((role) => role.code === "owner" && role.status === "active")) return;
        if (!profile.permissions.some((permission) => permission.code === "role.assign" && permission.effect === "allow")) throw new ForbiddenException("Permiso insuficiente.");
    }
    /** Authorization precedes lookup; explicit response fields exclude metadata and network identifiers. */
    async detail(token: string | undefined, publicId: string) {
        await this.authorize(token);
        if (!isValid(publicId)) throw new BadRequestException("Identificador de evento inválido.");
        const row = await this.repository.detail(publicId);
        if (!row) throw new NotFoundException("Evento no encontrado.");
        return { publicId: row.publicId, eventType: row.eventType, summary: row.summary, reason: row.reason, actorName: row.actorName, targetName: row.targetName, createdAt: new Date(row.createdAt).toISOString(), ...buildAuditReadContext(row), changeSet: safeChangeSet(row.changeSet) };
    }
    /** Only static navigation choices are returned; this does not query log rows. */
    async options(token: string | undefined) {
        await this.authorize(token);
        return { modules: AUDIT_MODULES, catalogs: CATALOG_DEFINITIONS.map((catalog) => ({ code: catalog.routeCode, name: catalog.label })) };
    }
    /** Scope validation precedes SQL; historic missing context remains explicitly unknown. */
    async list(token: string | undefined, query: AuditQueryDto) {
        await this.authorize(token);
        const module = AUDIT_MODULES.find((item) => item.code === query.moduleCode);
        if (!module?.sections.some((section) => section.code === query.sectionCode) || (query.catalogCode && query.sectionCode !== "catalogs")) throw new BadRequestException("Sección inválida para el módulo.");
        const rows = await this.repository.list(query, decodeAuditCursor(query));
        const items = rows.slice(0, query.limit).map((row) => ({ publicId: row.publicId, eventType: row.eventType, summary: row.summary, reason: row.reason, actorName: row.actorName, targetName: row.targetName, createdAt: new Date(row.createdAt).toISOString(), ...buildAuditReadContext(row) }));
        const last = rows[Math.min(rows.length, query.limit) - 1];
        const hasNext = rows.length > query.limit;
        return { items, pagination: { limit: query.limit, returned: items.length, hasNext, nextCursor: hasNext && last ? encodeAuditCursor(query, last.id) : null } };
    }
}
