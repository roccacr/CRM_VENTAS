import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NoteWorkflowRepository } from "./note-workflow.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";

/** La agenda durable en UTC sigue con el navegador cerrado y recupera arrendamientos vencidos. */
@Injectable()
export class NoteWorkflowWorker implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | undefined;
    private unsubscribe: (() => void) | undefined;
    private busy = false;
    private stopped = false;
    private readonly logger = new Logger(NoteWorkflowWorker.name);
    /** Antes de cada entrega programada usa la fachada de autorización de la nota. */
    constructor(
        @Inject(NoteWorkflowRepository) private readonly repository: NoteWorkflowRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Arranca un sondeo acotado. El libro del esquema sigue siendo la puerta de activación. */
    onModuleInit(): void {
        this.unsubscribe = this.signal.subscribe(() => {
            void this.tick();
        });
        this.timer = setInterval(() => {
            void this.tick();
        }, 5000);
        this.timer.unref();
    }
    /** Deja de tomar arrendamientos nuevos y suelta los recursos de agenda de este proceso. */
    onModuleDestroy(): void {
        this.stopped = true;
        this.unsubscribe?.();
        if (this.timer) clearInterval(this.timer);
    }
    /** Procesa como máximo diez agendas y no monta un ciclo sobre el anterior. */
    async tick(): Promise<void> {
        if (this.busy || this.stopped) return;
        this.busy = true;
        try {
            if (await this.repository.schemaReady()) await this.batch();
        } catch {
            this.logger.warn("Note workflow polling unavailable");
        } finally {
            this.busy = false;
        }
    }
    private async batch() {
        for (let i = 0; i < 10 && !this.stopped; i++) {
            const event = await this.repository.claim();
            if (!event) return;
            try {
                await this.repository.deliver(event, (user, note) => this.collaboration.authorizeUserNoteAccess(user, note));
                this.signal.notify();
            } catch {
                await this.repository.retry(event);
            }
        }
    }
}
