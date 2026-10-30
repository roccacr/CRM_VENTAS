import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NoteWorkflowRepository } from "./note-workflow.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";

/** Durable UTC scheduling works while browsers are offline and recovers expired process leases. */
@Injectable()
export class NoteWorkflowWorker implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | undefined;
    private unsubscribe: (() => void) | undefined;
    private busy = false;
    private stopped = false;
    private readonly logger = new Logger(NoteWorkflowWorker.name);
    /** Uses the existing note authorization facade before every scheduled delivery. */
    constructor(
        @Inject(NoteWorkflowRepository) private readonly repository: NoteWorkflowRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Starts a bounded poll; the schema ledger remains the activation gate. */
    onModuleInit(): void {
        this.unsubscribe = this.signal.subscribe(() => {
            void this.tick();
        });
        this.timer = setInterval(() => {
            void this.tick();
        }, 5000);
        this.timer.unref();
    }
    /** Stops new leases and releases all process-local scheduling resources. */
    onModuleDestroy(): void {
        this.stopped = true;
        this.unsubscribe?.();
        if (this.timer) clearInterval(this.timer);
    }
    /** Processes at most ten schedules without overlapping a prior cycle. */
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
