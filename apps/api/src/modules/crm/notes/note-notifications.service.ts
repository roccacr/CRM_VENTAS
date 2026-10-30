import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { z } from "zod";

import { IdentityService } from "../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
import { type NoteNotification, notificationReadAllSchema, notificationsListSchema } from "./note-notifications.contract.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { noteIdSchema } from "./notes.contract.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** Authentication supplies the recipient. Current note authorization protects lists, counts and writes. */
@Injectable()
export class NoteNotificationsService {
    /** Injects the native dependencies with explicit Nest tokens. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NoteNotificationsRepository) private readonly repository: NoteNotificationsRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Filtering precedes pagination and badge calculation so revoked metadata never leaks. */
    async list(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = this.parse(notificationsListSchema, input);
        const observedAt = new Date().toISOString();
        const items = await this.authorized(profile, observedAt);
        const selected = items.filter((item) => query.filter === "all" || (query.filter === "unread" ? item.readAt === null : item.kind === "mention"));
        return { schemaVersion: 1, items: selected.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: { number: query.page, size: query.pageSize, total: selected.length }, unreadCount: items.filter((item) => item.readAt === null).length, observedAt };
    }
    /** Exact count shares the same current authorization path as the list. */
    async unreadCount(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        const items = await this.authorized(profile, new Date().toISOString());
        return { count: items.filter((item) => item.readAt === null).length };
    }
    /** Explicit individual acknowledgement is idempotent; unknown and revoked IDs are indistinguishable. */
    async read(session: string | undefined, id: string) {
        const profile = await this.identity.getCurrentUser(session);
        this.parse(noteIdSchema, id);
        const through = new Date().toISOString();
        const items = await this.authorized(profile, through);
        if (!items.some((item) => item.id === id)) throw new NotFoundException("Notificacion disponible no encontrada.");
        await this.repository.markRead(profile.user.publicId, [id], through);
        this.signal.notify();
        return { ok: true };
    }
    /** Snapshot cutoff prevents a read-all request from acknowledging future events. */
    async readAll(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const { through } = this.parse(notificationReadAllSchema, input);
        if (Date.parse(through) > Date.now()) throw new BadRequestException("El corte de lectura no puede ser futuro.");
        const items = await this.authorized(profile, through);
        await this.repository.markRead(
            profile.user.publicId,
            items.map((item) => item.id),
            through,
        );
        this.signal.notify();
        return { ok: true };
    }
    private async authorized(profile: IdentityAuthorizationProfile, through: string): Promise<NoteNotification[]> {
        // The current request already validated this profile; reuse it, never cache it across requests.
        const candidates = await this.repository.candidates(profile.user.publicId, through);
        const allowed = new Map<string, boolean>();
        const result: NoteNotification[] = [];
        for (const item of candidates) {
            if (!allowed.has(item.noteId)) allowed.set(item.noteId, Boolean(await this.collaboration.authorizeProfileRead(profile, item.noteId)));
            if (allowed.get(item.noteId)) result.push(item);
        }
        return result;
    }
    private parse<T>(schema: z.ZodType<T>, input: unknown): T {
        const result = schema.safeParse(input);
        if (!result.success) throw new BadRequestException("Solicitud de notificaciones invalida.");
        return result.data;
    }
}
