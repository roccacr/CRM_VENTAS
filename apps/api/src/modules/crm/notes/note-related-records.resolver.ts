import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";

import { canReadFormalizationOrder } from "../../../common/security/route-permission.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { type NoteRelatedOptions, type NoteRelatedReference, type NoteRelatedResolution, type NoteRelatedSummary, relatedOptionsQuerySchema, relatedReferenceSchema } from "./note-related-records.contract.js";
import { NoteRelatedRecordsReader, type RelatedResourceAccess, type RelatedResourceRow } from "./note-related-records.reader.js";
import { canUseNotes, type NoteModule } from "./notes.permissions.js";

type Result = { resolution: NoteRelatedResolution; row: RelatedResourceRow } | { error: HttpException };
const key = (reference: NoteRelatedReference) => JSON.stringify([reference.kind, reference.source, reference.id]);
const unavailable = () => new ServiceUnavailableException("No se pudieron consultar todos los registros relacionados.");
function retainDomainFailure(error: unknown): void {
    if (error instanceof HttpException && error.getStatus() !== 503) throw error;
}
function access(profile: IdentityAuthorizationProfile, kind: NoteRelatedReference["kind"]): RelatedResourceAccess {
    if (profile.user.status !== "active") throw new ForbiddenException("Registro no disponible.");
    const orders = canReadFormalizationOrder(profile);
    if (kind === "sales_order") {
        if (!orders) throw new ForbiddenException("Sin permiso para consultar órdenes.");
        return { actor: profile.user.publicId, all: true, own: false, orders: true };
    }
    const entries = profile.permissions.filter((permission) => permission.code === "lead.read");
    if (entries.some((permission) => permission.effect === "deny")) throw new ForbiddenException("Sin permiso para consultar clientes.");
    const grants = entries.filter((permission) => permission.effect === "allow" && ["self", "assigned", "own_area", "own_area_and_children", "all_areas"].includes(permission.scope));
    if (!grants.length && !orders) throw new ForbiddenException("Sin permiso para consultar clientes.");
    // Area hierarchy is not a customer grant: without an existing area resolver, remain owner-scoped.
    return { actor: profile.user.publicId, all: grants.some((permission) => permission.scope === "all_areas"), own: grants.length > 0, orders };
}
function assertReadable(profile: IdentityAuthorizationProfile, row: RelatedResourceRow): void {
    const scope = access(profile, row.reference.kind);
    if (!row.active) throw new NotFoundException("Registro disponible no encontrado.");
    if (scope.all) return;
    if (scope.own && row.ownerId === scope.actor) return;
    if (!scope.orders) throw new ForbiddenException("Sin permiso para consultar este cliente.");
    if (row.orderEvidenceUnavailable) throw unavailable();
    if (!row.hasOrder) throw new ForbiddenException("Sin permiso para consultar este cliente.");
}
function indexRows(rows: readonly RelatedResourceRow[]): Map<string, RelatedResourceRow> {
    const result = new Map<string, RelatedResourceRow>();
    for (const row of rows) {
        for (const alias of row.aliases) {
            const previous = result.get(key(alias));
            if (previous && key(previous.reference) !== key(row.reference)) throw new ConflictException("Correspondencia de registro ambigua.");
            result.set(key(alias), row);
        }
    }
    return result;
}
function summary(row: RelatedResourceRow): NoteRelatedSummary {
    const query = new URLSearchParams({ orderSource: row.reference.source, orderId: row.reference.id });
    return { kind: row.reference.kind, reference: row.reference, label: row.label, description: row.description, url: row.reference.kind === "sales_order" ? `/home/formalization?${query.toString()}` : null, restricted: false };
}
function restricted(reference: NoteRelatedReference, error: HttpException): NoteRelatedSummary {
    return { kind: reference.kind, label: null, description: null, url: null, restricted: true, ...(error.getStatus() === 503 ? { unavailable: true } : {}) };
}

/** Resolves source-qualified business references without granting access through notes or reports. */
@Injectable()
export class NoteRelatedRecordsResolver {
    /** Uses bounded, read-only source adapters; all authorization remains here. */
    constructor(@Inject(NoteRelatedRecordsReader) private readonly reader: NoteRelatedRecordsReader) {}
    /** Validation for a command is strict: forbidden, missing and unavailable records never become links. */
    async resolve(profile: IdentityAuthorizationProfile, reference: NoteRelatedReference): Promise<NoteRelatedResolution> {
        const [result] = await this.resolveBatch(profile, this.references([reference]));
        if (!result) throw new NotFoundException("Registro disponible no encontrado.");
        if ("error" in result) throw result.error;
        return result.resolution;
    }
    /** List rendering redacts references themselves; batch source reads avoid per-card SQL. */
    async resolveMany(profile: IdentityAuthorizationProfile, references: readonly NoteRelatedReference[]): Promise<NoteRelatedSummary[]> {
        const parsed = this.references(references);
        const results = await this.resolveBatch(profile, parsed);
        return results.map((result, index) => {
            if (!("error" in result)) return result.resolution.summary;
            if (![403, 404, 503].includes(result.error.getStatus())) throw result.error;
            const reference = parsed[index];
            if (!reference) throw new BadRequestException("Identidad de registro inválida.");
            return restricted(reference, result.error);
        });
    }
    /** Search uses native-first pagination and exposes partial legacy availability explicitly. */
    // eslint-disable-next-line max-params
    async search(profile: IdentityAuthorizationProfile, moduleCode: NoteModule, kind: NoteRelatedReference["kind"], search: string, page: number): Promise<NoteRelatedOptions> {
        const parsed = relatedOptionsQuerySchema.safeParse({ moduleCode, kind, search, page });
        if (!parsed.success) throw new BadRequestException("Búsqueda de registros inválida.");
        if (!canUseNotes(profile, moduleCode, "read")) throw new ForbiddenException("Sin permiso para consultar notas.");
        const scope = access(profile, kind);
        const offset = (page - 1) * 25;
        const native = await this.reader.searchNative(kind, parsed.data.search, offset, 26, scope).catch((error: unknown) => {
            if (error instanceof HttpException) throw error;
            throw unavailable();
        });
        const selected = native.rows.slice(0, 25);
        let partial = false;
        let hasMore = native.total > offset + 25;
        if (!hasMore && this.reader.legacyEnabled()) {
            try {
                const legacy = await this.reader.searchLegacy(kind, parsed.data.search, Math.max(0, offset - native.total), 26 - selected.length, scope);
                selected.push(...legacy.rows.slice(0, 25 - selected.length));
                hasMore = native.total + legacy.total > offset + 25;
                partial = false;
            } catch (error) {
                retainDomainFailure(error);
                partial = true;
            }
        }
        const resolutions = selected.map((row) => {
            assertReadable(profile, row);
            return { row, resolution: { summary: summary(row), aliases: row.aliases } };
        });
        await this.decorateOrders(profile, resolutions);
        return { schemaVersion: 1, items: resolutions.map((item) => item.resolution.summary), page: { number: page, size: 25 }, hasMore, partial };
    }
    private references(references: readonly NoteRelatedReference[]): NoteRelatedReference[] {
        if (references.length > 500) throw new BadRequestException("Demasiados vínculos para consultar.");
        return references.map((reference) => {
            const parsed = relatedReferenceSchema.safeParse(reference);
            if (!parsed.success) throw new BadRequestException("Identidad de registro inválida.");
            return parsed.data;
        });
    }
    private async load(references: readonly NoteRelatedReference[], profile: IdentityAuthorizationProfile) {
        if (!references.length) return { rows: new Map<string, RelatedResourceRow>(), legacyUnavailable: false };
        let native: RelatedResourceRow[];
        try {
            native = await this.reader.readNative(references);
        } catch (error) {
            if (error instanceof ConflictException) throw error;
            throw unavailable();
        }
        const rows = indexRows(native);
        const missing = references.filter((reference) => reference.source === "legacy" && !rows.has(key(reference)));
        const legacyUnavailable = await this.loadLegacy(missing, rows);
        await this.orderEvidence(profile, rows);
        return { rows, legacyUnavailable };
    }
    private async orderEvidence(profile: IdentityAuthorizationProfile, rows: Map<string, RelatedResourceRow>) {
        if (!canReadFormalizationOrder(profile) || !this.reader.legacyEnabled()) return;
        const candidates = Array.from(new Set(rows.values())).filter((row) => row.reference.kind === "lead" && row.reference.source === "native" && row.active && !row.hasOrder && row.aliases.some((alias) => alias.source === "legacy"));
        if (!candidates.length) return;
        try {
            const ids = new Set(await this.reader.legacyOrderClients(candidates.flatMap((row) => row.aliases)));
            for (const row of candidates) row.hasOrder = row.aliases.some((alias) => alias.source === "legacy" && ids.has(alias.id));
        } catch (error) {
            retainDomainFailure(error);
            for (const row of candidates) row.orderEvidenceUnavailable = true;
        }
    }
    private async loadLegacy(missing: readonly NoteRelatedReference[], rows: Map<string, RelatedResourceRow>) {
        if (!missing.length) return false;
        if (!this.reader.legacyEnabled()) return true;
        try {
            for (const [identity, row] of indexRows(await this.reader.readLegacy(missing))) rows.set(identity, row);
            return false;
        } catch (error) {
            if (error instanceof ConflictException) throw error;
            return true;
        }
    }
    private async resolveBatch(profile: IdentityAuthorizationProfile, references: readonly NoteRelatedReference[], suggestions = true): Promise<Result[]> {
        const errors = new Map<string, HttpException>();
        const authorized = references.filter((reference) => {
            try {
                access(profile, reference.kind);
                return true;
            } catch (error) {
                if (!(error instanceof HttpException)) throw error;
                errors.set(key(reference), error);
                return false;
            }
        });
        let loaded: Awaited<ReturnType<NoteRelatedRecordsResolver["load"]>>;
        try {
            loaded = await this.load(authorized, profile);
        } catch (error) {
            if (!(error instanceof HttpException)) throw error;
            return references.map((reference) => ({ error: errors.get(key(reference)) ?? error }));
        }
        const results = references.map((reference): Result => {
            const denied = errors.get(key(reference));
            if (denied) return { error: denied };
            const row = loaded.rows.get(key(reference));
            if (!row) return { error: reference.source === "legacy" && loaded.legacyUnavailable ? unavailable() : new NotFoundException("Registro disponible no encontrado.") };
            try {
                assertReadable(profile, row);
                return { row, resolution: { summary: summary(row), aliases: row.aliases } };
            } catch (error) {
                if (!(error instanceof HttpException)) throw error;
                return { error };
            }
        });
        if (suggestions) await this.decorateOrders(profile, results);
        return results;
    }
    private async decorateOrders(profile: IdentityAuthorizationProfile, results: Result[]) {
        const candidates = results.flatMap((result) => ("row" in result && result.row.relatedLead ? [{ reference: result.row.relatedLead, result }] : []));
        if (!candidates.length) return;
        const related = await this.resolveBatch(
            profile,
            candidates.map((candidate) => candidate.reference),
            false,
        );
        for (const [index, candidate] of candidates.entries()) {
            const lead = related[index];
            if (!lead || "error" in lead) continue;
            const item = lead.resolution.summary;
            if (item.reference && item.label) candidate.result.resolution.summary.relatedLead = { reference: item.reference, label: item.label, description: item.description };
        }
    }
}
