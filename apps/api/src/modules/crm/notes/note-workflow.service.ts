import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { z } from "zod";

import { IdentityService } from "../identity/identity.service.js";
import type { IdentityAuthorizationProfile } from "../identity/identity.types.js";
import { NoteCollaborationRepository } from "./note-collaboration.repository.js";
import { NoteCollaborationService } from "./note-collaboration.service.js";
import { reminderSchema, taskSchema, type WorkflowCommand, workflowOverviewSchema } from "./note-workflow.contract.js";
import { NoteWorkflowRepository } from "./note-workflow.repository.js";
import { noteIdSchema } from "./notes.contract.js";
import { canUseCollaboration } from "./notes.permissions.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";

/** Workflow reads and commands reuse live note permissions and invitation ACL. */
@Injectable()
export class NoteWorkflowService {
    /** Injects native identity, collaboration, transactional persistence and delivery signals. */
    // eslint-disable-next-line max-params
    constructor(
        @Inject(IdentityService) private readonly identity: IdentityService,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NoteCollaborationRepository) private readonly notes: NoteCollaborationRepository,
        @Inject(NoteWorkflowRepository) private readonly repository: NoteWorkflowRepository,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Returns workflow state only to a current authorized reader. */
    async read(session: string | undefined, id: string) {
        const profile = await this.profile(session, id);
        const state = await this.notes.load(profile.user.publicId, id);
        const result = await this.repository.read(profile.user.publicId, state);
        return { ...result, canManage: result.canManage && canUseCollaboration(profile, state.note.moduleCode, "edit_own", false) };
    }
    /** Only the immutable note author may change task assignment or its due date. */
    async task(session: string | undefined, id: string, body: unknown) {
        return this.command(session, id, { ...this.parse(taskSchema, body), kind: "task" });
    }
    /** Each reader owns an independent persisted reminder, including snooze and cancellation. */
    async reminder(session: string | undefined, id: string, body: unknown) {
        return this.command(session, id, { ...this.parse(reminderSchema, body), kind: "reminder" });
    }
    private async command(session: string | undefined, id: string, command: WorkflowCommand) {
        const profile = await this.profile(session, id);
        let canManage = false;
        const result = await this.repository.command(profile.user.publicId, id, command, async (state) => {
            await this.authorize(profile, state.note.publicId);
            canManage = state.note.authorPublicId === profile.user.publicId && state.note.status === "open" && canUseCollaboration(profile, state.note.moduleCode, "edit_own", false);
            if (command.kind === "task" && state.note.authorPublicId !== profile.user.publicId) throw new ForbiddenException("Solo el autor modifica la tarea.");
            if (command.kind === "task" && !canUseCollaboration(profile, state.note.moduleCode, "edit_own", false)) throw new ForbiddenException("Permiso de edicion insuficiente.");
        });
        this.signal.notify();
        return { ...result, canManage };
    }
    /** Counts only current authorized assigned open tasks; truncation is explicit rather than misleading. */
    async overview(session: string | undefined, query: unknown = {}) {
        const { timeZone } = this.parse(workflowOverviewSchema, query);
        const profile = await this.identity.getCurrentUser(session);
        if (!(await this.repository.schemaReady())) throw new ServiceUnavailableException();
        const candidates = await this.repository.overviewIds(profile.user.publicId);
        const now = new Date().toISOString();
        const date = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
        const today = date.format(new Date(now));
        const counts = { assigned: 0, dueToday: 0, overdue: 0 };
        for (const row of candidates.slice(0, 1000)) {
            if (!(await this.collaboration.authorizeProfileNoteAccess(profile, row.id))) continue;
            counts.assigned += row.explicitAssigned;
            if (!row.dueAt) continue;
            if (date.format(new Date(row.dueAt)) === today) counts.dueToday++;
            if (Date.parse(row.dueAt) < Date.parse(now)) counts.overdue++;
        }
        return { schemaVersion: 1 as const, counts, truncated: candidates.length > 1000, timeZone };
    }
    private async profile(session: string | undefined, id: string) {
        this.parse(noteIdSchema, id);
        const profile = await this.identity.getCurrentUser(session);
        if (!(await this.repository.schemaReady())) throw new ServiceUnavailableException("Flujo de notas no disponible.");
        await this.authorize(profile, id);
        return profile;
    }
    private async authorize(profile: IdentityAuthorizationProfile, id: string) {
        if (!(await this.collaboration.authorizeProfileNoteAccess(profile, id))) throw new ForbiddenException("Nota no disponible.");
    }
    private parse<T>(schema: z.ZodType<T>, body: unknown): T {
        const result = schema.safeParse(body);
        if (!result.success) throw new BadRequestException("Solicitud de tarea o recordatorio invalida.");
        return result.data;
    }
}
