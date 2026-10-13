import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import { IdentityService } from "../identity/identity.service.js";
import { decodeUnitCursor, encodeUnitCursor, mergeUnitFacets, type UnitFacetFilter, type UnitFilter, unitFilterKey, type UnitOptionFilter, type UnitPage } from "./unit-files.contract.js";
import { UnitFilesRepository } from "./unit-files.repository.js";
import { UNIT_FILES_LEGACY, type UnitFilesLegacy, type UnitSeekRow } from "./unit-files-legacy.port.js";

/** Encodes the source of the final returned row, never the look-ahead row. */
function pageResult(rows: UnitSeekRow[], limit: number, nativeCount: number, cursor: { key: string; phase: string }): UnitPage {
    const selected = rows.slice(0, limit);
    const last = selected.at(-1);
    const phase = cursor.phase === "native" && selected.length <= nativeCount ? "native" : "legacy";
    const hasNext = rows.length > limit;
    return { items: selected.map((row) => row.item), pagination: { limit, returned: selected.length, hasNext, nextCursor: hasNext && last ? encodeUnitCursor({ key: cursor.key, phase, after: last.position }) : null } };
}

/** Authenticated native-first reader. Missing/disabled legacy never blocks native operation. */
@Injectable()
export class UnitFilesService {
    /** Reuses session authorization and injects legacy only through the optional port. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(UnitFilesRepository) private readonly repository: UnitFilesRepository,
        @Optional() @Inject(UNIT_FILES_LEGACY) private readonly legacy?: UnitFilesLegacy,
    ) {}

    private async authorize(session: string | undefined, moduleCode: string): Promise<void> {
        const profile = await this.identity.getCurrentUser(session);
        if (profile.roles.some((role) => role.code === "owner" && role.status === "active")) return;
        const permission = `${moduleCode}.catalog_file.read`;
        const active = profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active");
        const allowed = profile.permissions.some((entry) => entry.code === permission && entry.effect === "allow");
        const denied = profile.permissions.some((entry) => entry.code === permission && entry.effect === "deny");
        if (!active || !allowed || denied) throw new ForbiddenException("Permiso insuficiente.");
    }

    /** No inventory query is performed for project options. */
    async projects(session: string | undefined, moduleCode: string) {
        await this.authorize(session, moduleCode);
        return { items: (await this.repository.projects()).map(({ id, name }) => ({ id, name })) };
    }

    /** A bounded, binary-ordered union supports distinct choice continuation across both sources. */
    async options(session: string | undefined, filter: UnitOptionFilter) {
        await this.authorize(session, filter.moduleCode);
        const projects = (await this.repository.projects()).filter((project) => filter.projectIds.includes(project.id));
        if (projects.length !== filter.projectIds.length) throw new NotFoundException("Proyecto CRM no encontrado.");
        const native = await this.repository.options(filter, filter.limit + 1);
        const legacy = this.legacy?.enabled() ? await this.legacy.options(filter, filter.limit + 1) : [];
        // Both SQL sources use binary ordering; the bounded union keeps duplicates out of pagination.
        const all = [...new Set([...native, ...legacy])].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
        const items = all.slice(0, filter.limit);
        const hasNext = all.length > filter.limit;
        return { items, hasNext, nextAfter: hasNext ? (items.at(-1) ?? null) : null };
    }

    /** Aggregated choices share authorization, native precedence and the global legacy gate. */
    async facets(session: string | undefined, filter: UnitFacetFilter) {
        await this.authorize(session, filter.moduleCode);
        const projects = (await this.repository.projects()).filter((project) => filter.projectIds.includes(project.id));
        if (projects.length !== filter.projectIds.length) throw new NotFoundException("Proyecto CRM no encontrado.");
        const native = await this.repository.facets(filter, filter.limit + 1);
        const legacy = this.legacy?.enabled() && this.legacy.facets ? await this.legacy.facets(filter, filter.limit + 1) : [];
        return mergeUnitFacets([...native, ...legacy], filter.limit);
    }

    /** Native-first keyset paging with one look-ahead row and bounded legacy anti-join. */
    async list(session: string | undefined, filter: UnitFilter): Promise<UnitPage> {
        await this.authorize(session, filter.moduleCode);
        const key = unitFilterKey(filter);
        const cursor = decodeUnitCursor(filter.cursor, key);
        const projects = (await this.repository.projects()).filter((project) => filter.projectIds.includes(project.id));
        if (projects.length !== filter.projectIds.length) throw new NotFoundException("Proyecto CRM no encontrado.");
        let rows: UnitSeekRow[] = [];
        let nativeCount = 0;
        if (cursor.phase === "native") {
            rows = await this.repository.list(filter, cursor.after, filter.limit + 1);
            nativeCount = rows.length;
        }
        if (rows.length <= filter.limit && this.legacy?.enabled()) {
            rows.push(...(await this.legacy.list(filter, projects, cursor.phase === "legacy" ? cursor.after : 0, filter.limit + 1 - rows.length)));
        }
        return pageResult(rows, filter.limit, nativeCount, cursor);
    }

    /** Native replacement wins even when the incoming link still uses a legacy identity. */
    async detail(session: string | undefined, id: string, moduleCode: string) {
        await this.authorize(session, moduleCode);
        const match = /^legacy:unit-files:([1-9]\d*)$/.exec(id);
        let item;
        if (match && Number.isSafeInteger(Number(match[1]))) {
            const legacyId = Number(match[1]);
            const promoted = await this.repository.findPromotedId(legacyId);
            item = promoted ? await this.repository.detail(promoted) : await this.readLegacyDetail(legacyId);
        } else {
            item = await this.repository.detail(id);
        }
        if (!item) throw new NotFoundException("Expediente no encontrado o proyecto pendiente de conciliacion.");
        return item;
    }

    private async readLegacyDetail(id: number) {
        return this.legacy?.enabled() ? this.legacy.detail(id) : null;
    }
}
