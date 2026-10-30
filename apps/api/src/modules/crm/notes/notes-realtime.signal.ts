import { Injectable, Logger } from "@nestjs/common";
/** Post-commit optimization only. Durable polling remains the recovery authority. */
@Injectable()
export class NotesRealtimeSignal {
    private readonly logger = new Logger(NotesRealtimeSignal.name);
    private readonly listeners = new Set<() => void | Promise<void>>();
    /** Both notification and realtime workers subscribe without a circular dependency. */
    subscribe(listener: () => void | Promise<void>): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /** Call only after the mutation transaction resolves successfully. */
    notify(): void {
        for (const listener of this.listeners) {
            try {
                const completion = listener();
                if (completion)
                    void completion.catch(() => {
                        this.logger.warn("Notes post-commit wake failed");
                    });
            } catch {
                this.logger.warn("Notes post-commit wake failed");
            }
        }
    }
}
