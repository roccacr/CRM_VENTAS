import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { z } from "zod";

import { IdentityService } from "../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
import { type NoteNotification, notificationReadAllSchema, notificationsListSchema } from "./note-notifications.contract.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { noteIdSchema } from "./notes.contract.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** La autenticación dice quién es el destinatario. La autorización actual de la nota protege listas, conteos y escrituras. */
@Injectable()
export class NoteNotificationsService {
    /** Dependencias nativas con tokens explícitos. */
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NoteNotificationsRepository) private readonly repository: NoteNotificationsRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** El filtro va antes de paginar y de calcular la insignia. Un metadato revocado no se cuela. */
    async list(session: string | undefined, input: unknown) {
        const profile = await this.identity.getCurrentUser(session);
        const query = this.parse(notificationsListSchema, input);
        const observedAt = new Date().toISOString();
        const items = await this.authorized(profile, observedAt);
        const selected = items.filter((item) => query.filter === "all" || (query.filter === "unread" ? item.readAt === null : item.kind === "mention"));
        return { schemaVersion: 1, items: selected.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), page: { number: query.page, size: query.pageSize, total: selected.length }, unreadCount: items.filter((item) => item.readAt === null).length, observedAt };
    }
    /** El conteo exacto usa el mismo camino de autorización actual que la lista. */
    async unreadCount(session: string | undefined) {
        const profile = await this.identity.getCurrentUser(session);
        const items = await this.authorized(profile, new Date().toISOString());
        return { count: items.filter((item) => item.readAt === null).length };
    }
    /** El acuse individual es idempotente. Un id desconocido y uno revocado se responden igual. */
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
    /** El corte de la foto evita que marcar todo leído acuse eventos que todavía no existían. */
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
        // Esta petición ya validó el perfil. Se reutiliza aquí y no se guarda para otra petición.
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
