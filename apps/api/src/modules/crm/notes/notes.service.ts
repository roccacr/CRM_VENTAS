import { BadRequestException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { z } from "zod";

import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityProfile } from "../identity/identity.types.js";
import { OrderTimingService } from "../sales/sales-orders/order-timing.service.js";
import { NoteRelatedRecordsService } from "./note-related-records.service.js";
import { createNoteSchema, editNoteSchema, listNotesSchema, type NoteAccess, type NoteContext, noteIdSchema, type NoteLifecycle, noteReadSchema, type NoteRecord, noteStateSchema, placementSchema } from "./notes.contract.js";
import { canUseCollaboration, canUseNotes, type NoteAction, type NoteModule, notesReadOwnOnly } from "./notes.permissions.js";
import { NotesRepository } from "./notes.repository.js";
import { authorizeNoteView, normalizeNoteContext, noteHomeViewCode } from "./notes-context.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";

/** Native stage2 commands. Shared editing, replies and deliveries are deliberately absent. */
@Injectable()
export class NotesService {
    /** Injects existing identity, native persistence and authorized order-context reads. */
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NotesRepository) private readonly repository: NotesRepository,
        @Inject(OrderTimingService) private readonly timing: OrderTimingService,
        @Inject(NotesRealtimeSignal) private readonly realtime: NotesRealtimeSignal,
        @Inject(NoteRelatedRecordsService) private readonly related: NoteRelatedRecordsService,
    ) {}

    /** Authorizes a single context before returning bounded notes and own placements. */
    async list(session: string | undefined, input: unknown) {
        const profile = await this.authorize(session, input, "read");
        const query = this.parse(listNotesSchema, input);
        const access = this.access(profile, query.moduleCode);
        const requested: NoteContext = query.contextType === "sales_order" && query.recordId ? { kind: "sales_order", source: query.recordSource ?? "native", id: query.recordId } : query.contextType === "personal" ? { kind: "personal" } : { kind: "view", ...(query.viewCode ? { code: query.viewCode } : {}) };
        await this.authorizeContext(session, query.moduleCode, requested, profile);
        const context = normalizeNoteContext(query.moduleCode, requested);
        const modules = CATALOG_CONTEXT_MODULES.filter((module) => canUseCollaboration(profile, module, "read", true));
        const aliases = context.kind === "sales_order" ? await this.related.resourceAliases(profile, { ...context, kind: "sales_order" }) : [];
        const data = await this.repository.list(access, query, context, modules, aliases);
        const placements = await this.repository.placements(access, data.items);
        const related = await this.related.summariesForNotes(profile, data.items);
        data.items.forEach((note) => {
            if (!canUseCollaboration(profile, note.moduleCode, "read", true)) throw new NotFoundException("Nota disponible no encontrada.");
        });
        return { schemaVersion: 1, page: { number: query.page, size: query.pageSize, total: data.total }, items: data.items.map((note) => ({ ...presentNote(profile, note), myPlacements: placements.get(note.publicId) ?? [], relatedRecords: related.get(note.publicId) ?? [] })) };
    }

    /** Rechecks the persisted module and context before exposing any private content. */
    async read(session: string | undefined, id: string, input: unknown) {
        const { profile, access, note, context } = await this.load(session, id, input);
        const related = await this.related.summariesForNotes(profile, [note]);
        return { schemaVersion: 1, note: { ...presentNote(profile, note), context, myPlacements: await this.repository.placement(access, note), relatedRecords: related.get(note.publicId) ?? [] } };
    }

    /** Returns only the metadata audit of a note the current user may still read. */
    async history(session: string | undefined, id: string, input: unknown) {
        const { note, profile } = await this.load(session, id, input);
        return { schemaVersion: 1, contentRestorationAvailable: false, items: await this.repository.history(note, profile.user.publicId) };
    }

    /** Creates an author-owned private note; stage4 sharing fields are rejected. */
    async create(session: string | undefined, input: unknown) {
        const profile = await this.authorize(session, input, "create");
        const command = this.parse(createNoteSchema, input);
        await this.authorizeContext(session, command.moduleCode, command.context, profile);
        command.context = normalizeNoteContext(command.moduleCode, command.context);
        await this.related.authorizeReferences(profile, command.relatedRecords ?? []);
        const guard = async () => {
            const current = await this.identity.getCurrentUser(session);
            if (!canUseNotes(current, command.moduleCode, "read") || !canUseNotes(current, command.moduleCode, "create")) throw new ForbiddenException("Permiso de notas insuficiente.");
            await this.related.authorizeReferences(current, command.relatedRecords ?? []);
            const references = command.relatedRecords ?? [];
            if (command.context.kind !== "sales_order") return references;
            const aliases = await this.related.resourceAliases(current, { kind: "sales_order", source: command.context.source, id: command.context.id });
            return references.filter((reference) => !aliases.some((alias) => alias.kind === reference.kind && alias.source === reference.source && alias.id === reference.id));
        };
        const result = command.relatedRecords?.length ? await this.repository.create(this.access(profile, command.moduleCode), command, command.context, guard) : await this.repository.create(this.access(profile, command.moduleCode), command, command.context);
        this.realtime.notify();
        return result;
    }

    /** Checks live permission and immutable author before the transactional command. */
    async edit(session: string | undefined, id: string, input: unknown) {
        const profile = await this.authorize(session, input, "edit_own");
        const command = this.parse(editNoteSchema, input);
        const { access, note } = await this.loadWithProfile(session, id, profile, { moduleCode: command.moduleCode, resolveContext: false });
        this.assertAuthor(profile, note);
        const result = await this.repository.edit(access, id, command);
        this.realtime.notify();
        return result;
    }

    /** Completes, reopens or archives only the original author's note. */
    async lifecycle(session: string | undefined, id: string, input: unknown, action: NoteLifecycle) {
        const profile = await this.authorize(session, input, action === "archive" ? "archive_own" : "resolve_own");
        const command = this.parse(noteStateSchema, input);
        const { access, note } = await this.loadWithProfile(session, id, profile, { moduleCode: command.moduleCode, resolveContext: false });
        this.assertAuthor(profile, note);
        const result = await this.repository.lifecycle(access, id, command, action);
        this.realtime.notify();
        return result;
    }

    /** Changes the caller's layout without changing authorship or content. */
    async move(session: string | undefined, id: string, input: unknown) {
        const command = this.parse(placementSchema, input);
        const { access } = await this.load(session, id, { moduleCode: command.moduleCode }, false);
        return this.repository.move(access, id, command);
    }

    private parse<T>(schema: z.ZodType<T>, input: unknown): T {
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Solicitud de notas invalida.");
        return parsed.data;
    }
    private async authorize(session: string | undefined, input: unknown, action: NoteAction): Promise<IdentityProfile> {
        const profile = await this.identity.getCurrentUser(session);
        const moduleCode = input && typeof input === "object" && Object.hasOwn(input, "moduleCode") ? (Reflect.get(input, "moduleCode") as unknown) : undefined;
        if (!canUseNotes(profile, moduleCode, "read") || !canUseNotes(profile, moduleCode, action)) throw new ForbiddenException("Permiso de notas insuficiente.");
        return profile;
    }
    private access(profile: IdentityProfile, moduleCode: NoteModule): NoteAccess {
        return { actorPublicId: profile.user.publicId, moduleCode, ownOnly: notesReadOwnOnly(profile, moduleCode) };
    }
    private async load(session: string | undefined, id: string, input: unknown, resolveContext = true) {
        const profile = await this.identity.getCurrentUser(session);
        const query = this.parse(noteReadSchema, input);
        if (!canUseCollaboration(profile, query.moduleCode, "read", true)) throw new ForbiddenException("Permiso de notas insuficiente.");
        return { profile, ...(await this.loadWithProfile(session, id, profile, { moduleCode: query.moduleCode, resolveContext })) };
    }
    private async loadWithProfile(session: string | undefined, id: string, profile: IdentityProfile, options: { moduleCode: NoteModule; resolveContext?: boolean }) {
        const { moduleCode, resolveContext = true } = options;
        this.parse(noteIdSchema, id);
        const access = this.access(profile, moduleCode);
        const note = await this.repository.find(access, id);
        this.assertModule(note, access);
        const context = await this.repository.context(note);
        if (!resolveContext) return { access, note, context: null };
        try {
            await this.authorizeContext(session, moduleCode, context, profile);
            return { access, note, context };
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404, 409, 503].includes(error.getStatus())) return { access, note, context: null };
            throw error;
        }
    }
    private assertModule(note: NoteRecord, access: NoteAccess): void {
        if (note.moduleCode !== access.moduleCode) throw new NotFoundException("Nota disponible no encontrada.");
    }
    private assertAuthor(profile: IdentityProfile, note: NoteRecord): void {
        if (note.authorPublicId !== profile.user.publicId) throw new ForbiddenException("Solo el autor puede modificar la nota.");
    }
    private async authorizeContext(session: string | undefined, moduleCode: NoteModule, context: NoteContext, profile: IdentityProfile): Promise<void> {
        if (context.kind === "personal") return;
        if (context.kind === "view") {
            authorizeNoteView(profile, moduleCode, context.code ?? noteHomeViewCode(moduleCode));
            return;
        }
        const response = await this.timing.read(session, { source: context.source, id: context.id }, { page: 1, pageSize: 1 });
        if (response.order.source !== context.source || response.order.id !== (context.source === "legacy" ? `legacy:${context.id}` : context.id)) await this.related.resourceAliases(profile, { ...context, kind: "sales_order" });
    }
}

/** Presents authorized note content; callers must enforce note ACL and redact linked resources separately. */
export function presentNote(profile: Pick<IdentityProfile, "user" | "permissions">, n: NoteRecord) {
    const own = n.authorPublicId === profile.user.publicId;
    const allowed = (action: NoteAction) => own && canUseNotes(profile, n.moduleCode, action);
    return {
        id: n.publicId,
        moduleCode: n.moduleCode,
        author: { publicId: n.authorPublicId, displayName: n.authorName },
        title: n.title,
        content: { format: "plain_text", text: n.text },
        color: n.color,
        priority: n.priority,
        visibility: n.visibility,
        status: n.status,
        version: n.version,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
        completedAt: n.completedAt,
        archivedAt: n.archivedAt,
        capabilities: { canEdit: n.status === "open" && allowed("edit_own"), canComplete: n.status === "open" && allowed("resolve_own"), canReopen: n.status === "completed" && allowed("resolve_own"), canArchive: n.status !== "archived" && allowed("archive_own"), canMove: n.status === "open" && canUseCollaboration(profile, n.moduleCode, "read", true), canShare: false, canReply: false },
    };
}
