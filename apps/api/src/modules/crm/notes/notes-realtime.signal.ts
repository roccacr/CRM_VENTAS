import { Injectable, Logger } from "@nestjs/common";
/** Aviso posterior al commit. La recuperación sigue siendo el sondeo durable. */
@Injectable()
export class NotesRealtimeSignal {
    private readonly logger = new Logger(NotesRealtimeSignal.name);
    private readonly listeners = new Set<() => void | Promise<void>>();
    /** La campana y el tiempo real se suscriben aquí, sin depender uno del otro en el arranque. */
    subscribe(listener: () => void | Promise<void>): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    /** Se llama solo después de que la transacción de la mutación confirmó. Un fallo del aviso no revierte el cambio. */
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
