import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NoteNotificationsRepository } from "./note-notifications.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** Internal bell only. The migration gate and non-overlapping bounded batches protect startup and shutdown. */
@Injectable()
export class NoteNotificationsWorker implements OnModuleInit, OnModuleDestroy {
    private timer: ReturnType<typeof setInterval> | undefined;
    private unsubscribe: (() => void) | undefined;
    private busy = false;
    private stopped = false;
    private readonly logger = new Logger(NoteNotificationsWorker.name);
    /** Injects the native dependencies with explicit Nest tokens. */
    constructor(
        @Inject(NoteNotificationsRepository) private readonly repository: NoteNotificationsRepository,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
    ) {}
    /** Timers are unrefed and never start delivery until schemas044/046 are registered. */
    onModuleInit(): void {
        this.unsubscribe = this.signal.subscribe(() => {
            void this.tick();
        });
        this.timer = setInterval(() => {
            void this.tick();
        }, 5000);
        this.timer.unref();
    }
    /** Prevents new claims and releases the polling timer on module shutdown. */
    onModuleDestroy(): void {
        this.stopped = true;
        this.unsubscribe?.();
        if (this.timer) clearInterval(this.timer);
    }
    /** At most ten envelopes per cycle; each failed envelope retains a bounded durable retry. */
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
