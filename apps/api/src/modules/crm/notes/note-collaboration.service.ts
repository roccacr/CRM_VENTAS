import { BadRequestException, ConflictException, ForbiddenException, HttpException, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import { CATALOG_CONTEXT_MODULES } from "../catalogs/catalogs.constants.js";
import { IdentityService } from "../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { IdentityProfileRepository } from "../identity/identity-profile.repository.js";
import { OrderTimingService } from "../sales/sales-orders/order-timing.service.js";
import { type CollaborationCommand, collaborationInboxSchema, collaborationSearchSchema, collaborationThreadSchema, editReplySchema, followingSchema, locationsSchema, mentionsSchema, participantsSchema, replySchema, withdrawReplySchema } from "./note-collaboration.contract.js";
import { type CollaborationNote, NoteCollaborationRepository } from "./note-collaboration.repository.js";
import type { NoteRelatedSummary } from "./note-related-records.contract.js";
import { NoteRelatedRecordsService } from "./note-related-records.service.js";
import { listNotesSchema, type NoteContext, noteIdSchema } from "./notes.contract.js";
import { canUseCollaboration, canUseNotes, type NoteAction, type NoteModule } from "./notes.permissions.js";
import { presentNote } from "./notes.service.js";
import { authorizeNoteView, noteHomeViewCode } from "./notes-context.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** Explicit invitations grant conversation access; linked resources are authorized separately. */
@Injectable()
export class NoteCollaborationService {
    /** Injects existing authorization and native persistence collaborators. */
    // Explicit signal dependency wakes delivery only after the command commits.
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(IdentityProfileRepository) private readonly profiles: IdentityProfileRepository,
        @Inject(NoteCollaborationRepository) private readonly repository: NoteCollaborationRepository,
        @Inject(OrderTimingService) private readonly timing: OrderTimingService,
        @Inject(NotesRealtimeSignal) private readonly realtime: NotesRealtimeSignal,
        @Inject(NoteRelatedRecordsService) private readonly related: NoteRelatedRecordsService,
    ) {}
    /** Consumer facade returns references only and fails closed for revoked, inactive or unauthorized recipients. */
    async authorizeUserRead(userPublicId: string, noteId: string) {
        const profile = await this.profiles.findAuthorizationByUserPublicId(userPublicId);
        if (!profile) return null;
        return this.authorizeProfileRead(profile, noteId);
    }
    /** Rechecks a server-derived profile without constructing a login session. */
    async authorizeProfileRead(profile: IdentityAuthorizationProfile, noteId: string) {
        try {
            const state = await this.load(profile, noteId);
            return { noteId: state.note.publicId, moduleCode: state.note.moduleCode, context: await this.visibleContext(profile, state) };
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404, 409, 503].includes(error.getStatus())) return null;
            throw error;
        }
    }
    /** Note-only ACL for reminders/counts; record resolution must not delay personal collaboration. */
    async authorizeProfileNoteAccess(profile: IdentityAuthorizationProfile, noteId: string) {
        try {
            const state = await this.load(profile, noteId);
            return { noteId: state.note.publicId, moduleCode: state.note.moduleCode };
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404, 409].includes(error.getStatus())) return null;
            throw error;
        }
    }
    /** Resolves the live native account before note-only scheduled delivery. */
    async authorizeUserNoteAccess(userPublicId: string, noteId: string) {
        const profile = await this.profiles.findAuthorizationByUserPublicId(userPublicId);
        return profile ? this.authorizeProfileNoteAccess(profile, noteId) : null;
    }
    /** Returns only currently authorized notes in the requested inbox. */
    async inbox(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = this.parse(collaborationInboxSchema, input);
        const page = await this.repository.inboxPage(
            profile.user.publicId,
            query,
            CATALOG_CONTEXT_MODULES.filter((module) => canUseCollaboration(profile, module, "read", true)),
        );
        const authorized: CollaborationNote[] = [];
        for (const { id } of page.items) {
            try {
                authorized.push(await this.load(profile, id));
            } catch (error) {
                if (!(error instanceof HttpException) || ![403, 404, 409].includes(error.getStatus())) throw error;
            }
        }
        const related = await this.related.summariesForNotes(
            profile,
            authorized.map((state) => state.note),
        );
        return { schemaVersion: 1 as const, items: await Promise.all(authorized.map((state) => this.present(profile, state, related.get(state.note.publicId) ?? []))), page: { number: query.page, size: query.pageSize, total: Math.max(0, page.total - page.items.length + authorized.length) } };
    }
    /** Complete author filter options without disclosing unrelated directory accounts. */
    async inboxAuthors(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        const modules = CATALOG_CONTEXT_MODULES.filter((module) => canUseCollaboration(profile, module, "read", true));
        return { schemaVersion: 1 as const, items: await this.repository.inboxAuthors(profile.user.publicId, modules) };
    }
    /** Loads one authorized conversation with a bounded reply page. */
    async thread(session: string | undefined, id: string, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = this.parse(collaborationThreadSchema, input);
        const state = await this.load(profile, id);
        const replies = await this.repository.replies(state.note, query.replyPage);
        return {
            schemaVersion: 1 as const,
            note: await this.present(profile, state),
            collaborationVersion: state.collaborationVersion,
            participants: state.participants.filter((p) => p.userId !== state.note.authorPublicId).map(({ following: _following, active: _active, ...p }) => p),
            mentions: await this.repository.mentions(state.note.internalId, null),
            replies: replies.items.map((r) => ({
                id: r.id,
                author: { publicId: r.authorPublicId, displayName: r.authorName },
                text: r.text,
                version: r.version,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
                withdrawn: Boolean(r.withdrawn),
                mentionUserIds: r.mentionUserIds,
                canEdit: !r.withdrawn && r.authorPublicId === profile.user.publicId && this.allowed(profile, state, "edit_reply_own"),
                canWithdraw: !r.withdrawn && r.authorPublicId === profile.user.publicId && this.allowed(profile, state, "withdraw_reply_own"),
            })),
            replyPage: { number: query.replyPage, size: 25, total: replies.total },
            following: state.participants.find((p) => p.userId === profile.user.publicId)?.following ?? true,
        };
    }
    /** Visible history is metadata only and follows the current note ACL. */
    async activity(session: string | undefined, id: string, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const state = await this.load(profile, id);
        const query = this.parse(z.object({ page: collaborationInboxSchema.shape.page }).strict(), input);
        const result = await this.repository.activity(state.note, query.page, profile.user.publicId);
        return {
            schemaVersion: 1 as const,
            page: result.page,
            items: result.items.map((row) => {
                const raw: unknown = typeof row.actor === "string" ? JSON.parse(row.actor) : row.actor;
                const actor = z.object({ publicId: noteIdSchema, name: z.string() }).safeParse(raw);
                const actions: Record<string, string> = {
                    create: "Nota creada",
                    update: "Nota editada",
                    open: "Nota reabierta",
                    completed: "Nota completada",
                    archived: "Nota archivada",
                    participants: "Personas invitadas actualizadas",
                    mentions: "Menciones actualizadas",
                    reply: "Comentario publicado",
                    editReply: "Comentario editado",
                    withdrawReply: "Comentario retirado",
                    following: "Preferencia de avisos actualizada",
                    locations: "Ubicaciones actualizadas",
                    relatedRecords: "Registros relacionados actualizados",
                    task: "Responsable o vencimiento actualizado",
                    reminder: "Recordatorio personal actualizado",
                };
                const action = row.command ?? (row.action === "state_change" ? (row.status ?? row.action) : row.action);
                return { id: row.id, action, actor: actor.success ? { publicId: actor.data.publicId, displayName: actor.data.name } : null, createdAt: row.createdAt, details: actions[action] ?? "Seguimiento actualizado" };
            }),
        };
    }
    /** Additional Homes are display references, independently checked for each viewer. */
    async locations(session: string | undefined, id: string) {
        const profile = await this.identity.getCurrentUser(session);
        const state = await this.load(profile, id);
        const availableLocations = this.availableLocations(profile);
        const locations = (await this.repository.locations(state.note.internalId)).filter((location) => availableLocations.some((candidate) => candidate.moduleCode === location.moduleCode && candidate.code === location.code));
        return { schemaVersion: 1 as const, version: state.collaborationVersion, locations, availableLocations, canManage: state.note.authorPublicId === profile.user.publicId && this.allowed(profile, state, "share_own") };
    }
    private availableLocations(profile: IdentityAuthorizationProfile) {
        return CATALOG_CONTEXT_MODULES.flatMap((moduleCode) => {
            if (!canUseNotes(profile, moduleCode, "read")) return [];
            try {
                authorizeNoteView(profile, moduleCode, noteHomeViewCode(moduleCode));
                return [{ moduleCode, code: noteHomeViewCode(moduleCode) }];
            } catch (error) {
                if (error instanceof HttpException && [400, 403].includes(error.getStatus())) return [];
                throw error;
            }
        });
    }
    /** One versioned command changes references, never copies the note or grants record access. */
    async replaceLocations(session: string | undefined, id: string, input: unknown) {
        const command = this.parse(locationsSchema, input);
        if (command.locations.some((location) => location.code !== noteHomeViewCode(location.moduleCode))) throw new BadRequestException("Solo se admiten Homes registrados.");
        return this.mutate(session, id, { ...command, kind: "locations" });
    }
    /** Lists eligible recipients after owner sharing authorization. */
    async eligibleUsers(session: string | undefined, id: string, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const state = await this.load(profile, id);
        this.assertOwner(profile, state);
        this.require(profile, state, "share_own");
        const query = this.parse(collaborationSearchSchema, input);
        return this.directory(profile, state.note.moduleCode, query);
    }
    /** Validates prospective note context before listing eligible recipients. */
    async eligibleDraftUsers(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const raw = this.parse(z.object({ moduleCode: z.unknown(), contextType: z.unknown().optional(), viewCode: z.unknown().optional(), recordSource: z.unknown().optional(), recordId: z.unknown().optional(), search: z.string().trim().max(100).default(""), page: collaborationSearchSchema.shape.page }).strict(), input);
        const { search, page, ...filter } = raw;
        const query = this.parse(listNotesSchema, filter);
        const context: NoteContext = query.contextType === "personal" ? { kind: "personal" } : query.contextType === "sales_order" && query.recordId ? { kind: "sales_order", source: query.recordSource ?? "native", id: query.recordId } : { kind: "view", ...(query.viewCode ? { code: query.viewCode } : {}) };
        if (!canUseNotes(profile, query.moduleCode, "share_own") || !canUseNotes(profile, query.moduleCode, "create")) throw new ForbiddenException();
        await this.context(profile, query.moduleCode, context);
        return this.directory(profile, query.moduleCode, { search, page });
    }
    private async directory(actor: IdentityAuthorizationProfile, module: NoteModule, query: z.infer<typeof collaborationSearchSchema>) {
        const items: Array<{ publicId: string; displayName: string; status?: "active" | "inactive" | "pending" }> = [];
        const candidates = await this.repository.directory(query.search, query.page);
        for (const candidate of candidates.slice(0, 100)) {
            if (candidate.publicId === actor.user.publicId) continue;
            if (candidate.status === "inactive" || candidate.status === "pending") {
                items.push(candidate);
                continue;
            }
            const profile = await this.profiles.findAuthorizationByUserPublicId(candidate.publicId);
            if (!profile) continue;
            if (canUseCollaboration(profile, module, "read", true)) items.push(candidate);
        }
        return { items, hasMore: candidates.length > 100 };
    }
    /** Replaces explicit participants using optimistic collaboration concurrency. */
    async participants(session: string | undefined, id: string, input: unknown) {
        return this.mutate(session, id, { ...this.parse(participantsSchema, input), kind: "participants" });
    }
    /** Loads or changes structured mentions within the authorized conversation. */
    async mentions(session: string | undefined, id: string, input: unknown) {
        return this.mutate(session, id, { ...this.parse(mentionsSchema, input), kind: "mentions" });
    }
    /** Publishes an attributed reply after checking current reply access. */
    async reply(session: string | undefined, id: string, input: unknown) {
        return this.mutate(session, id, { ...this.parse(replySchema, input), kind: "reply" });
    }
    /** Edits only the caller authored reply with its expected version. */
    async editReply(session: string | undefined, id: string, replyId: string, input: unknown) {
        this.parse(noteIdSchema, replyId);
        return this.mutate(session, id, { ...this.parse(editReplySchema, input), kind: "editReply", replyId });
    }
    /** Withdraws only the caller authored reply without deleting attribution. */
    async withdrawReply(session: string | undefined, id: string, replyId: string, input: unknown) {
        this.parse(noteIdSchema, replyId);
        return this.mutate(session, id, { ...this.parse(withdrawReplySchema, input), kind: "withdrawReply", replyId });
    }
    /** Updates only the authenticated caller following preference. */
    async following(session: string | undefined, id: string, input: unknown) {
        return this.mutate(session, id, { ...this.parse(followingSchema, input), kind: "following" });
    }
    private async mutate(session: string | undefined, id: string, input: CollaborationCommand) {
        const profile = await this.identity.getCurrentUser(session);
        const command: CollaborationCommand = input.kind === "locations" ? { ...input, editableModules: this.availableLocations(profile).map((location) => location.moduleCode) } : input;
        this.parse(noteIdSchema, id);
        const result = await this.repository.command(profile.user.publicId, id, command, async (state, _tx, phase) => {
            this.require(profile, state, "read");
            this.authorizeCommand(profile, state, command, phase === "write");
            if (phase === "write") {
                await this.authorizeTargets(state, command);
                if (command.kind === "locations") for (const location of command.locations) await this.context(profile, location.moduleCode, { kind: "view", code: location.code });
            }
        });
        if (command.kind !== "following") this.realtime.notify();
        return result;
    }
    private authorizeCommand(profile: IdentityAuthorizationProfile, state: CollaborationNote, command: CollaborationCommand, validateState: boolean) {
        if (command.kind === "participants" || command.kind === "mentions" || command.kind === "locations") {
            this.assertOwner(profile, state);
            this.require(profile, state, "share_own");
        }
        if (command.kind === "reply") this.authorizeReply(profile, state, validateState);
        if (command.kind === "editReply") this.require(profile, state, "edit_reply_own");
        if (command.kind === "withdrawReply") this.require(profile, state, "withdraw_reply_own");
    }
    private authorizeReply(profile: IdentityAuthorizationProfile, state: CollaborationNote, validateState: boolean) {
        this.require(profile, state, "reply");
        if (validateState && state.note.status !== "open") throw new ConflictException("Solo se responde a notas abiertas.");
        if (profile.user.publicId !== state.note.authorPublicId && !state.participants.some((p) => p.userId === profile.user.publicId && p.access === "reply")) throw new ForbiddenException("Acceso de solo lectura.");
    }
    private async authorizeTargets(state: CollaborationNote, command: CollaborationCommand) {
        if (command.kind === "participants")
            for (const target of command.participants) {
                if (target.userId === state.note.authorPublicId) throw new BadRequestException("El autor no es un participante invitado.");
                await this.authorizeTarget(state, target.userId);
            }
        await this.authorizeMentions(state, command);
    }
    private async authorizeMentions(state: CollaborationNote, command: CollaborationCommand) {
        const mentions = command.kind === "mentions" ? command.userIds : "mentionUserIds" in command ? command.mentionUserIds : [];
        for (const userId of mentions) {
            if (userId !== state.note.authorPublicId && !state.participants.some((p) => p.userId === userId)) throw new ForbiddenException("Solo se menciona al autor o participantes activos.");
            await this.authorizeTarget(state, userId);
        }
    }
    private async authorizeTarget(state: CollaborationNote, userId: string) {
        const target = await this.profiles.findAuthorizationByUserPublicId(userId);
        if (target) {
            if (!canUseCollaboration(target, state.note.moduleCode, "read", true)) throw new ForbiddenException("Destinatario no elegible.");
            return;
        }
        const status = await this.repository.recipientStatus(userId);
        if (status !== "inactive" && status !== "pending") throw new ForbiddenException("Destinatario no elegible.");
    }

    private async load(profile: IdentityAuthorizationProfile, id: string) {
        this.parse(noteIdSchema, id);
        const state = await this.repository.load(profile.user.publicId, id);
        this.require(profile, state, "read");
        return state;
    }
    /** Invitation reveals conversation only; the original resource remains independently protected. */
    private async visibleContext(profile: IdentityAuthorizationProfile, state: CollaborationNote): Promise<NoteContext | null> {
        try {
            await this.context(profile, state.note.moduleCode, state.context);
            return state.context;
        } catch (error) {
            if (error instanceof HttpException && [400, 403, 404, 409, 503].includes(error.getStatus())) return null;
            throw error;
        }
    }
    private async context(profile: IdentityAuthorizationProfile, module: NoteModule, context: NoteContext) {
        if (context.kind === "personal") return;
        if (context.kind === "view") {
            if (!canUseNotes(profile, module, "read")) throw new ForbiddenException();
            authorizeNoteView(profile, module, context.code ?? noteHomeViewCode(module));
            return;
        }
        await this.orderContext(profile, context);
    }
    private async orderContext(profile: IdentityAuthorizationProfile, context: Extract<NoteContext, { kind: "sales_order" }>) {
        const result = await this.timing.authorizeForProfile(profile, { source: context.source, id: context.id }, { page: 1, pageSize: 1 });
        if (result.order.source !== context.source || result.order.id !== (context.source === "legacy" ? `legacy:${context.id}` : context.id)) await this.related.resourceAliases(profile, { ...context, kind: "sales_order" });
    }
    private allowed(profile: IdentityAuthorizationProfile, state: CollaborationNote, action: NoteAction) {
        return canUseCollaboration(profile, state.note.moduleCode, action, action === "read" || profile.user.publicId !== state.note.authorPublicId);
    }
    private require(profile: IdentityAuthorizationProfile, state: CollaborationNote, action: NoteAction) {
        if (!this.allowed(profile, state, action)) throw new ForbiddenException("Permiso de notas insuficiente.");
    }
    private assertOwner(profile: IdentityAuthorizationProfile, state: CollaborationNote) {
        if (profile.user.publicId !== state.note.authorPublicId) throw new ForbiddenException("Solo el autor comparte la nota.");
    }
    private async present(profile: IdentityAuthorizationProfile, state: CollaborationNote, relatedRecords?: NoteRelatedSummary[]) {
        const own = profile.user.publicId === state.note.authorPublicId;
        const base = presentNote(profile, state.note);
        return {
            ...base,
            relatedRecords: relatedRecords ?? (await this.related.summariesForNotes(profile, [state.note])).get(state.note.publicId) ?? [],
            myPlacements: await this.repository.placement(profile.user.publicId, state.note),
            moduleCode: state.note.moduleCode,
            context: await this.visibleContext(profile, state),
            capabilities: { ...base.capabilities, canShare: own && this.allowed(profile, state, "share_own"), canReply: state.note.status === "open" && this.allowed(profile, state, "reply") && (own || state.participants.some((p) => p.userId === profile.user.publicId && p.access === "reply")), canMention: own && this.allowed(profile, state, "share_own") },
        };
    }
    private parse<T>(schema: z.ZodType<T>, input: unknown): T {
        const parsed = schema.safeParse(input);
        if (!parsed.success) throw new BadRequestException("Solicitud de colaboracion invalida.");
        return parsed.data;
    }
}
