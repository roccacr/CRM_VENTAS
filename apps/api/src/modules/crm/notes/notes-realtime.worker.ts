import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { NotesRealtimeGateway } from "./notes-realtime.gateway.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
import { NotesRealtimeSignal } from "./notes-realtime.signal.js";
/** Publicador durable con arrendamiento. Un paquete perdido se reconcilia por REST. Una caída puede repetir el mismo `eventId`. */
@Injectable()
export class NotesRealtimeWorker implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NotesRealtimeWorker.name);
    private busy = false;
    private stopped = false;
    private timer: ReturnType<typeof setInterval> | undefined;
    private unsubscribe: (() => void) | undefined;
    /** Publica lo ya confirmado. No abre ni cambia la transacción del comando. */
    constructor(
        @Inject(NotesRealtimeEventsRepository) private readonly repository: NotesRealtimeEventsRepository,
        @Inject(NotesRealtimeGateway) private readonly gateway: NotesRealtimeGateway,
        @Inject(NotesRealtimeSignal) private readonly signal: NotesRealtimeSignal,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}
    /** El rescate corre cada segundo y no bloquea la mutación HTTP. Si el tiempo real está apagado, no arranca. */
    onModuleInit(): void {
        if (!this.config.get<boolean>("NOTES_REALTIME_ENABLED", true)) return;
        this.unsubscribe = this.signal.subscribe(() => {
            void this.tick();
        });
        this.timer = setInterval(() => {
            void this.tick();
        }, 1000);
        this.timer.unref();
    }
    /** Deja de tomar arrendamientos nuevos y suelta el temporizador. Una publicación ya empezada puede terminar. */
    onModuleDestroy(): void {
        this.stopped = true;
        this.unsubscribe?.();
        if (this.timer) clearInterval(this.timer);
    }
    /** Un ciclo no se monta sobre otro. Si el esquema no está listo, no publica. */
    async tick(): Promise<void> {
        if (this.busy || this.stopped) return;
        this.busy = true;
        try {
            if (!(await this.repository.schemaReady())) return;
            await this.publishBatch();
        } catch {
            this.logger.warn("Notes realtime publication unavailable");
        } finally {
            this.busy = false;
        }
    }
    private async publishBatch(): Promise<void> {
        for (let i = 0; i < 50 && !this.stopped; i++) {
            const event = await this.repository.claim();
            if (!event) return;
            try {
                await this.gateway.publish(event.recipientUserId, event.activity);
                await this.repository.complete(event);
            } catch {
                await this.repository.retry(event);
            }
        }
    }
}
