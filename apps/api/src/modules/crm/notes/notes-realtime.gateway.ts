import { Inject, Logger, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type OnGatewayConnection, type OnGatewayInit, WebSocketGateway } from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-streams-adapter";
import { createClient } from "redis";
import type { Namespace, Socket } from "socket.io";
import { ulid } from "ulid";

import { NoteCollaborationService } from "./note-collaboration.service.js";
import { NotesRealtimeAuth, type NotesRealtimeIdentity } from "./notes-realtime.auth.js";
import { type NotesRealtimeActivity, notesRealtimeActivitySchema, notesRealtimeSubscriptionSchema } from "./notes-realtime.contract.js";
import { NotesRealtimeEventsRepository } from "./notes-realtime.repository.js";
interface Connection {
    socket: Socket;
    identity: NotesRealtimeIdentity;
    notes: Set<string>;
    window: number;
    messages: number;
    expiry: ReturnType<typeof setTimeout>;
}
type Ack = (result: { ok: boolean; code?: string }) => void;
/** Solo señales de metadatos autenticadas. Los handlers crudos usan la frontera BFF del socket. Los APP_GUARD solo de HTTP no cubren Engine.IO. */
@WebSocketGateway({ namespace: "/notes", transports: ["websocket"], maxHttpBufferSize: 4096, connectionStateRecovery: undefined })
export class NotesRealtimeGateway implements OnGatewayInit<Namespace>, OnGatewayConnection<Socket>, OnModuleDestroy {
    private readonly logger = new Logger(NotesRealtimeGateway.name);
    private readonly connections = new Map<string, Connection>();
    private namespace: Namespace | undefined;
    private timer: ReturnType<typeof setInterval> | undefined;
    private redis: ReturnType<typeof createClient> | undefined;
    private ready = false;
    /** Reutiliza la identidad, la autorización de la nota y la configuración ya validada. */
    constructor(
        @Inject(NotesRealtimeAuth) private readonly auth: NotesRealtimeAuth,
        @Inject(NoteCollaborationService) private readonly collaboration: NoteCollaborationService,
        @Inject(NotesRealtimeEventsRepository) private readonly repository: NotesRealtimeEventsRepository,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}
    /** Redis Streams, si está, reenvía metadatos a los pares. Cada par autoriza sus sesiones locales antes de emitir al cliente. */
    async afterInit(namespace: Namespace): Promise<void> {
        this.namespace = namespace;
        namespace.use((socket, next) => {
            void this.accept(socket).then(
                () => {
                    next();
                },
                () => {
                    next(new Error("Notes connection unavailable"));
                },
            );
        });
        namespace.on("notes.activity", (userId: string, activity: unknown, ack: unknown) => {
            const parsed = notesRealtimeActivitySchema.safeParse(activity);
            if (!parsed.success || typeof userId !== "string" || typeof ack !== "function") return;
            void this.publishLocal(userId, parsed.data).then(
                () => {
                    (ack as () => void)();
                },
                () => {
                    this.logger.warn("Peer realtime publication failed");
                },
            );
        });
        if (!this.config.get<boolean>("NOTES_REALTIME_ENABLED", true)) return;
        if (this.config.get<string>("NOTES_REALTIME_TOPOLOGY", "single") === "redis-streams") {
            if (!(await this.configureRedis(namespace))) return;
        }
        this.ready = true;
        this.timer = setInterval(() => {
            void this.revalidate();
        }, 10000);
        this.timer.unref();
    }
    private async configureRedis(namespace: Namespace): Promise<boolean> {
        try {
            const url = this.config.getOrThrow<string>("NOTES_REALTIME_REDIS_URL");
            this.redis = createClient({ url, socket: { connectTimeout: 5000, reconnectStrategy: (attempt) => Math.min(1000 * (attempt + 1), 10000) } });
            this.redis.on("error", () => {
                this.logger.warn("Notes realtime Redis unavailable");
            });
            await this.redis.connect();
            namespace.server.adapter(createAdapter(this.redis, { streamName: "crm:notes:activity:v1", channelPrefix: "crm:notes:activity:v1", maxLen: 10000 }));
            return true;
        } catch {
            this.logger.warn("Notes realtime multi-instance adapter unavailable; transport remains closed");
            return false;
        }
    }
    private async accept(socket: Socket): Promise<void> {
        if (!this.ready || !(await this.repository.schemaReady()) || this.connections.size >= 1000) throw new Error("Unavailable");
        const identity = await this.auth.authenticate(socket);
        if (this.connections.size >= 1000 || [...this.connections.values()].filter((c) => c.identity.userId === identity.userId).length >= 8) throw new Error("Connection limit");
        const expiry = setTimeout(() => socket.disconnect(true), Math.max(1, identity.expiresAt - Date.now()));
        expiry.unref();
        this.connections.set(socket.id, { socket, identity, notes: new Set(), window: Date.now(), messages: 0, expiry });
        socket.once("disconnect", () => {
            clearTimeout(expiry);
            this.connections.delete(socket.id);
        });
    }
    /** La entrada del cliente no elige la sala del destinatario ni trae mensajes que escriban contenido. */
    handleConnection(socket: Socket): void {
        if (!this.connections.has(socket.id)) {
            socket.disconnect(true);
            return;
        }
        socket.on("subscribe", (input: unknown, ack: unknown) => {
            void this.subscription(socket, input, true).then((result) => {
                if (typeof ack === "function") (ack as Ack)(result);
            });
        });
        socket.on("unsubscribe", (input: unknown, ack: unknown) => {
            void this.subscription(socket, input, false).then((result) => {
                if (typeof ack === "function") (ack as Ack)(result);
            });
        });
        const activity: NotesRealtimeActivity = { schemaVersion: 1, eventId: ulid(), kind: "sync.required", occurredAt: new Date().toISOString() };
        socket.emit("activity", activity);
    }
    private async subscription(socket: Socket, input: unknown, subscribe: boolean): Promise<{ ok: boolean; code?: string }> {
        const connection = this.connections.get(socket.id);
        if (!connection) return { ok: false, code: "unavailable" };
        if (Date.now() - connection.window >= 60000) {
            connection.window = Date.now();
            connection.messages = 0;
        }
        if (++connection.messages > 60) return { ok: false, code: "rate_limited" };
        const parsed = notesRealtimeSubscriptionSchema.safeParse(input);
        if (!parsed.success) return { ok: false, code: "invalid_request" };
        return this.authorizeSubscription(connection, parsed.data.noteId, subscribe);
    }
    private async authorizeSubscription(connection: Connection, noteId: string, subscribe: boolean): Promise<{ ok: boolean; code?: string }> {
        try {
            const current = await this.currentIdentity(connection);
            if (!subscribe) {
                connection.notes.delete(noteId);
                return { ok: true };
            }
            if (connection.notes.size >= 50 && !connection.notes.has(noteId)) return { ok: false, code: "limit" };
            if (!(await this.collaboration.authorizeUserRead(current.userId, noteId))) return { ok: false, code: "unavailable" };
            connection.notes.add(noteId);
            return { ok: true };
        } catch {
            connection.socket.disconnect(true);
            return { ok: false, code: "unavailable" };
        }
    }
    /** Todos los dispositivos del usuario reciben las invalidaciones autorizadas. Una sala de Redis no es prueba de permiso. */
    async publish(userId: string, activity: NotesRealtimeActivity): Promise<void> {
        if (!this.ready) throw new Error("Realtime unavailable");
        const parsed = notesRealtimeActivitySchema.parse(activity);
        if (this.redis) {
            if (!this.redis.isReady) throw new Error("Realtime adapter unavailable");
            await this.namespace?.serverSideEmitWithAck("notes.activity", userId, parsed);
        }
        await this.publishLocal(userId, parsed);
    }
    private async publishLocal(userId: string, activity: NotesRealtimeActivity): Promise<void> {
        const sessions = new Map<string, Promise<NotesRealtimeIdentity>>();
        const candidates = [...this.connections.values()].filter((connection) => connection.identity.userId === userId);
        // Hay tope de ocho sockets por usuario. La reutilización vale solo dentro de esta publicación, no entre eventos ni sesiones.
        const live = await Promise.all(
            candidates.map(async (connection) => {
                let current = sessions.get(connection.identity.sessionToken);
                if (!current) {
                    current = this.currentIdentity(connection);
                    sessions.set(connection.identity.sessionToken, current);
                }
                try {
                    await current;
                    return connection;
                } catch {
                    connection.socket.disconnect(true);
                    return null;
                }
            }),
        );
        if (!live.some(Boolean) || !(await this.authorizeActivity(userId, activity))) return;
        for (const connection of live) {
            if (!connection?.socket.connected) continue;
            if (activity.kind === "note.access_revoked" && activity.noteId) connection.notes.delete(activity.noteId);
            connection.socket.emit("activity", activity);
        }
    }
    private async currentIdentity(connection: Connection): Promise<NotesRealtimeIdentity> {
        const current = await this.auth.current(connection.identity.sessionToken);
        if (current.userId !== connection.identity.userId) throw new Error("Identity changed");
        return current;
    }
    private async authorizeActivity(userId: string, activity: NotesRealtimeActivity): Promise<boolean> {
        if (!activity.noteId) return activity.kind !== "notification.created";
        const allowed = Boolean(await this.collaboration.authorizeUserRead(userId, activity.noteId));
        if (activity.kind === "note.access_revoked") {
            if (allowed) return false;
            return true;
        }
        if (!allowed) return false;
        if (activity.kind !== "notification.created") return true;
        if (!activity.notificationId) return false;
        return this.repository.notificationActive(userId, activity.notificationId, activity.noteId);
    }
    /** Respaldo para un cambio externo de permiso o de sesión, además de la comprobación por mensaje y por publicación. */
    async revalidate(): Promise<void> {
        for (const connection of this.connections.values()) {
            try {
                const current = await this.currentIdentity(connection);
                await this.revalidateNotes(connection, current.userId);
            } catch {
                connection.socket.disconnect(true);
            }
        }
    }
    private async revalidateNotes(connection: Connection, userId: string): Promise<void> {
        for (const noteId of connection.notes) {
            if (await this.collaboration.authorizeUserRead(userId, noteId)) continue;
            connection.notes.delete(noteId);
            connection.socket.emit("activity", { schemaVersion: 1, eventId: ulid(), kind: "note.access_revoked", occurredAt: new Date().toISOString(), noteId });
        }
    }
    /** El cierre ordenado deja las filas durables pendientes para un proceso posterior. */
    async onModuleDestroy(): Promise<void> {
        this.ready = false;
        if (this.timer) clearInterval(this.timer);
        for (const c of this.connections.values()) c.socket.disconnect(true);
        if (this.redis?.isOpen) await this.redis.quit();
    }
}
