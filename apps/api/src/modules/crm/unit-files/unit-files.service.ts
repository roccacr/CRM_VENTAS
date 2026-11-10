import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from "@nestjs/common";

import { IdentityService } from "../identity/identity.service.js";
import { decodeUnitCursor, encodeUnitCursor, mergeUnitFacets, type UnitFacetFilter, type UnitFilter, unitFilterKey, type UnitOptionFilter, type UnitPage } from "./unit-files.contract.js";
import { UnitFilesRepository } from "./unit-files.repository.js";
import { UNIT_FILES_LEGACY, type UnitFilesLegacy, type UnitSeekRow } from "./unit-files-legacy.port.js";

/**
 * El cursor siguiente sale de la última fila devuelta, no de la fila de adelanto.
 * Si la página sigue dentro de lo nativo, la fase queda `native`. Si ya entra lo viejo, pasa a `legacy`.
 */
function pageResult(rows: UnitSeekRow[], limit: number, nativeCount: number, cursor: { key: string; phase: string }): UnitPage {
    const selected = rows.slice(0, limit);
    const last = selected.at(-1);
    const phase = cursor.phase === "native" && selected.length <= nativeCount ? "native" : "legacy";
    const hasNext = rows.length > limit;
    return { items: selected.map((row) => row.item), pagination: { limit, returned: selected.length, hasNext, nextCursor: hasNext && last ? encodeUnitCursor({ key: cursor.key, phase, after: last.position }) : null } };
}

/**
 * Lector autenticado, primero nativo. Si el puerto viejo falta o está apagado, la lectura nativa sigue.
 * El alcance por usuario y proyecto todavía no es un control de acceso: filtrar o comprobar que el proyecto existe es una restricción de búsqueda.
 */
@Injectable()
export class UnitFilesService {
    /** La sesión entra por identidad. El CRM viejo solo llega por el puerto opcional. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(UnitFilesRepository) private readonly repository: UnitFilesRepository,
        @Optional() @Inject(UNIT_FILES_LEGACY) private readonly legacy?: UnitFilesLegacy,
    ) {}

    /**
     * El código es `${module}.catalog_file.read`. Hace falta un allow y un deny gana.
     * Un Owner activo se salta solo la membresía de la unidad. No se salta el permiso.
     */
    private async authorize(session: string | undefined, moduleCode: string): Promise<void> {
        const profile = await this.identity.getCurrentUser(session);
        const owner = profile.roles.some((role) => role.code === "owner" && role.status === "active");
        const permission = `${moduleCode}.catalog_file.read`;
        const active = profile.orgUnits.some((unit) => unit.code === moduleCode && unit.status === "active");
        const allowed = profile.permissions.some((entry) => entry.code === permission && entry.effect === "allow");
        const denied = profile.permissions.some((entry) => entry.code === permission && entry.effect === "deny");
        if ((!owner && !active) || !allowed || denied) throw new ForbiddenException("Permiso insuficiente.");
    }

    /** Las opciones de proyecto no consultan unidades. */
    async projects(session: string | undefined, moduleCode: string) {
        await this.authorize(session, moduleCode);
        return { items: (await this.repository.projects()).map(({ id, name }) => ({ id, name })) };
    }

    /**
     * Une las dos fuentes, quita duplicados y ordena en binario para poder continuar la lista.
     * Si algún id pedido no existe, responde que el proyecto no está. Eso no autoriza el proyecto.
     */
    async options(session: string | undefined, filter: UnitOptionFilter) {
        await this.authorize(session, filter.moduleCode);
        const projects = await this.repository.projects(filter.projectIds);
        if (projects.length !== filter.projectIds.length) throw new NotFoundException("Proyecto CRM no encontrado.");
        const native = await this.repository.options(filter, filter.limit + 1);
        const legacy = this.legacy?.enabled() ? await this.legacy.options(filter, filter.limit + 1) : [];
        // Las dos fuentes vienen ordenadas en binario. El conjunto acotado evita repetir un valor en la página.
        const all = [...new Set([...native, ...legacy])].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
        const items = all.slice(0, filter.limit);
        const hasNext = all.length > filter.limit;
        return { items, hasNext, nextAfter: hasNext ? (items.at(-1) ?? null) : null };
    }

    /**
     * Los agregados usan la misma autorización. Lo viejo entra solo si el puerto está activo y expone `facets`.
     * La suma supone que esa página vieja no trae filas ya migradas.
     */
    async facets(session: string | undefined, filter: UnitFacetFilter) {
        await this.authorize(session, filter.moduleCode);
        const projects = await this.repository.projects(filter.projectIds);
        if (projects.length !== filter.projectIds.length) throw new NotFoundException("Proyecto CRM no encontrado.");
        const native = await this.repository.facets(filter, filter.limit + 1);
        const legacy = this.legacy?.enabled() && this.legacy.facets ? await this.legacy.facets(filter, filter.limit + 1) : [];
        return mergeUnitFacets([...native, ...legacy], filter.limit);
    }

    /**
     * La página es por clave, primero nativa, con una fila de adelanto.
     * Lo viejo completa solo el espacio que falta y recibe los proyectos nativos para no repetir lo ya migrado.
     */
    async list(session: string | undefined, filter: UnitFilter): Promise<UnitPage> {
        await this.authorize(session, filter.moduleCode);
        const key = unitFilterKey(filter);
        const cursor = decodeUnitCursor(filter.cursor, key);
        const projects = await this.repository.projects(filter.projectIds);
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

    /**
     * `legacy:unit-files:N` abre el nativo si ya hay reemplazo. Un entero que no es seguro cae en la identidad nativa y se rechaza.
     * Si el reemplazo existe y su detalle no, no se rellena con el CRM viejo.
     */
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
