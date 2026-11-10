import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** Solo la campana interna. La puerta de migración y los lotes acotados, sin montarse, protegen el arranque y el cierre. */
@Injectable()
export class NoteNotificationsWorker implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | undefined;
    private unsubscribe: (() => void) | undefined;
    private busy = false;
    private stopped = false;
    private readonly logger = new Logger(NoteNotificationsWorker.name);
    /** Dependencias nativas con tokens explícitos. */
    constructor(
        @Inject(NoteNotificationsRepository) private readonly repository: NoteNotificationsRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Los temporizadores no retienen el proceso. La entrega no arranca hasta que los esquemas 044 y 046 están registrados. */
    onModuleInit(): void {
        this.unsubscribe = this.signal.subscribe(() => {
            void this.tick();
        });
        this.timer = setInterval(() => {
            void this.tick();
        }, 5000);
        this.timer.unref();
    }
    /** Al cerrar el módulo deja de reclamar sobres y suelta el temporizador. */
    onModuleDestroy(): void {
        this.stopped = true;
        this.unsubscribe?.();
        if (this.timer) clearInterval(this.timer);
    }
    /** Como máximo diez sobres por ciclo. Uno fallido conserva un reintento durable acotado. */
    async tick(): Promise<void> {
        if (this.busy || this.stopped) return;
        this.busy = true;
        try {
            if (!(await this.repository.schemaReady())) return;
            await this.deliverBatch();
        } catch {
            this.logger.warn("Internal note notification polling unavailable");
        } finally {
            this.busy = false;
        }
    }
    private async deliverBatch(): Promise<void> {
        for (let i = 0; i < 10 && !this.stopped; i++) {
            const event = await this.repository.claim();
            if (!event) return;
            try {
                await this.repository.deliver(event, (userId, noteId) => this.collaboration.authorizeUserRead(userId, noteId));
                this.signal.notify();
            } catch {
                await this.repository.retry(event);
            }
        }
    }
}
