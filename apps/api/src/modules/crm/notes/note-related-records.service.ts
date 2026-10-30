import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import { IdentityService } from "../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { type CollaborationNote, NoteCollaborationRepository } from "./note-collaboration.repository.js";
import { type NoteRelatedReference, type NoteRelatedSummary, relatedOptionsQuerySchema, relatedRecordsSchema } from "./note-related-records.contract.js";
import { noteRelatedRecordKey, NoteRelatedRecordsRepository } from "./note-related-records.repository.js";
import { NoteRelatedRecordsResolver } from "./note-related-records.resolver.js";
import { noteIdSchema, type NoteRecord } from "./notes.contract.js";
import { canUseCollaboration, canUseNotes } from "./notes.permissions.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";

const replaceSchema = z.object({ operationId: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), expectedCollaborationVersion: z.number().int().min(1).max(4294967294), relatedRecords: relatedRecordsSchema }).strict();

/** Note access and resource access remain separate throughout search, mutation and presentation. */
@Injectable()
export class NoteRelatedRecordsService {
    /** Reuses identity, audited collaboration commands, batched links and source readers. */
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NoteCollaborationRepository) private readonly collaboration: NoteCollaborationRepository,
        @Inject(NoteRelatedRecordsRepository) private readonly repository: NoteRelatedRecordsRepository,
        @Inject(NoteRelatedRecordsResolver) private readonly resolver: NoteRelatedRecordsResolver,
        @Inject(NotesRealtimeSignal) private readonly realtime: NotesRealtimeSignal,
    ) {}

    /** Searches only when the actor can create or edit their own notes in the requested module. */
    async options(session: string | undefined, input: unknown) {
        const query = this.parse(relatedOptionsQuerySchema, input);
        const profile = await this.identity.getCurrentUser(session);
        if (!canUseNotes(profile, query.moduleCode, "read") || (!canUseNotes(profile, query.moduleCode, "create") && !canUseNotes(profile, query.moduleCode, "edit_own"))) throw new ForbiddenException("Permiso de notas insuficiente.");
        return this.resolver.search(profile, query.moduleCode, query.kind, query.search, query.page);
    }

    /** Reads the conversation independently of the linked business record's accessibility. */
    async read(session: string | undefined, id: string) {
        const profile = await this.identity.getCurrentUser(session);
        const state = await this.load(profile, id);
        const items = (await this.summariesForNotes(profile, [state.note])).get(state.note.publicId) ?? [];
        return { schemaVersion: 1 as const, version: state.collaborationVersion, items, canManage: this.canManage(profile, state) };
    }

    /** Revalidates each selected target; confidential/unavailable references cannot be attached. */
    async authorizeReferences(profile: IdentityAuthorizationProfile, references: readonly NoteRelatedReference[]): Promise<NoteRelatedSummary[]> {
        if (!references.length) return [];
        const summaries = await this.resolver.resolveMany(profile, [...references]);
        if (summaries.some((item) => item.unavailable)) throw new ServiceUnavailableException("No se pudieron comprobar todos los registros.");
        if (summaries.some((item) => item.restricted || !item.reference)) throw new ForbiddenException("Uno de los registros no esta disponible para vincular.");
        const keys = summaries.map((item) => item.reference && noteRelatedRecordKey(item.reference));
        if (new Set(keys).size !== keys.length) throw new BadRequestException("El mismo registro se selecciono mas de una vez.");
        return summaries;
    }

    /** Confirmed aliases let source-specific URLs find one note without rewriting persisted links. */
    async resourceAliases(profile: IdentityAuthorizationProfile, reference: NoteRelatedReference): Promise<NoteRelatedReference[]> {
        return (await this.resolver.resolve(profile, reference)).aliases;
    }

    /** One reference read and one batched authorization pass per note page, rather than a request per chip. */
    async summariesForNotes(profile: IdentityAuthorizationProfile, notes: readonly NoteRecord[]): Promise<Map<string, NoteRelatedSummary[]>> {
        const stored = await this.repository.referencesForNotes(notes);
        const references = new Map<string, NoteRelatedReference>();
        for (const rows of stored.values()) for (const row of rows) references.set(noteRelatedRecordKey(row.reference), row.reference);
        const keys = [...references.keys()];
        const summaries: NoteRelatedSummary[] = [];
        const unique = [...references.values()];
        for (let offset = 0; offset < unique.length; offset += 500) summaries.push(...(await this.resolver.resolveMany(profile, unique.slice(offset, offset + 500))));
        const byKey = new Map(keys.map((key, index) => [key, summaries[index]]));
        return new Map(
            notes.map((note) => {
                const result = new Map<string, NoteRelatedSummary>();
                for (const row of stored.get(note.internalId) ?? []) {
                    const summary = byKey.get(noteRelatedRecordKey(row.reference));
                    if (!summary) throw new ServiceUnavailableException("Resumen de registros incompleto.");
                    const key = noteRelatedRecordKey(summary.reference ?? row.reference);
                    const previous = result.get(key);
                    result.set(key, { ...summary, primary: row.primary || previous?.primary === true });
                }
                return [note.publicId, [...result.values()]];
            }),
        );
    }

    /** Keeps the immutable primary context and inaccessible secondary relations when replacing visible links. */
    async replace(session: string | undefined, id: string, input: unknown) {
        this.parse(noteIdSchema, id);
        const body = this.parse(replaceSchema, input);
        const profile = await this.identity.getCurrentUser(session);
        const command = { ...body, kind: "relatedRecords" as const, preservedLinkIds: [] as number[], persistedRelatedRecords: [...body.relatedRecords] };
        const result = await this.collaboration.command(profile.user.publicId, id, command, async (state, tx, phase) => {
            const current = await this.identity.getCurrentUser(session);
            if (!canUseCollaboration(current, state.note.moduleCode, "read", true)) throw new ForbiddenException("Nota no disponible.");
            if (phase !== "write") return;
            if (!this.canManage(current, state)) throw new ForbiddenException("Solo el autor con permiso puede modificar vinculos de una nota pendiente.");
            const selected = await this.authorizeReferences(current, command.relatedRecords);
            const existing = (await this.repository.referencesForNotes([state.note], tx)).get(state.note.internalId) ?? [];
            const summaries = await this.resolver.resolveMany(
                current,
                existing.map((row) => row.reference),
            );
            if (summaries.some((summary) => summary.unavailable)) throw new ServiceUnavailableException("No se pudieron comprobar los vinculos existentes.");
            command.preservedLinkIds = existing.filter((row, index) => !row.primary && summaries[index]?.restricted).map((row) => row.linkId);
            const primaryKeys = new Set(summaries.flatMap((summary, index) => (existing[index]?.primary && summary.reference ? [noteRelatedRecordKey(summary.reference)] : [])));
            // Canonical aliases of the immutable principal are not additional links; keep the original client payload for receipt hashing.
            command.persistedRelatedRecords = command.relatedRecords.filter((_reference, index) => {
                const canonical = selected[index]?.reference;
                return !canonical || !primaryKeys.has(noteRelatedRecordKey(canonical));
            });
        });
        this.realtime.notify();
        return result;
    }

    private async load(profile: IdentityAuthorizationProfile, id: string) {
        this.parse(noteIdSchema, id);
        const state = await this.collaboration.load(profile.user.publicId, id);
        if (!canUseCollaboration(profile, state.note.moduleCode, "read", true)) throw new ForbiddenException("Nota no disponible.");
        return state;
    }
    private canManage(profile: IdentityAuthorizationProfile, state: CollaborationNote): boolean {
        return state.note.status === "open" && profile.user.publicId === state.note.authorPublicId && canUseCollaboration(profile, state.note.moduleCode, "edit_own", false);
    }
    private parse<T>(schema: z.ZodType<T>, input: unknown): T {
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Solicitud de registros relacionados invalida.");
        return parsed.data;
    }
}
