import { createHash } from "node:crypto";

import { ConflictException, HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import type { PersistedOrderEvent } from "./netsuite-order-event.contract.js";
import { mapOrderFields, mapOrderFlags, readOrderRelationValues } from "./netsuite-order-event.mapper.js";
import { NetsuiteOrderEventRepository, OrderEventPersistenceError } from "./netsuite-order-event.repository.js";

/** Hash estable ante cambios en el orden de claves JSON, sin registrar datos personales en consola. */
function canonical(value: unknown): string {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value !== null && typeof value === "object")
        return (
            "{" +
            Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, child]) => JSON.stringify(key) + ":" + canonical(child))
                .join(",") +
            "}"
        );
    return JSON.stringify(value);
}
const digest = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");

/** Orquesta el contrato durable; la respuesta positiva siempre ocurre despues del COMMIT. */
@Injectable()
export class NetsuiteOrderEventService {
    private readonly logger = new Logger(NetsuiteOrderEventService.name);
    /** Mantiene el permiso de persistencia separado de la recepcion historica v1. */
    constructor(
        @Inject(NetsuiteOrderEventRepository) private readonly repository: NetsuiteOrderEventRepository,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /** Los eventos fallidos se pueden reenviar con el mismo UUID y payload. */
    async receive(event: PersistedOrderEvent) {
        if (this.config.get<boolean>("NETSUITE_LOCAL_EVENTS_PERSIST") !== true) throw new ServiceUnavailableException("Persistencia local NetSuite deshabilitada.");
        const identity = { payloadHash: digest(event), snapshotHash: "" };
        try {
            const fields = event.snapshot.data.fields;
            const relations = readOrderRelationValues(fields);
            const direct = [...mapOrderFlags(fields, "native", {}), ...mapOrderFields(fields, "native", {})].map(({ field, after }) => ({ field, after }));
            identity.snapshotHash = digest(fields.crm_sync_projection === 1 ? { direct, relations } : direct);
            const result = await this.repository.apply(event, identity);
            if (result.result === "stale") throw new ConflictException("Evento anterior o ambiguo; consultar NetSuite antes de reenviar.");
            this.logger.log({ event: "netsuite_order_event_completed", eventId: event.event.eventId, netsuiteId: event.event.netsuiteId, result: result.result, destination: result.destination, duplicate: result.duplicate });
            return { schemaVersion: 2, received: true, persisted: result.result !== "not_found", netsuiteId: event.event.netsuiteId, eventId: event.event.eventId, result: result.result, destination: result.destination, duplicate: result.duplicate };
        } catch (error) {
            return this.recordFailure(event, identity, error);
        }
    }

    private async recordFailure(event: PersistedOrderEvent, identity: { payloadHash: string; snapshotHash: string }, error: unknown): Promise<never> {
        // Una transaccion independiente deja evidencia aun despues del rollback comercial.
        const original = error instanceof OrderEventPersistenceError ? error.original : error;
        const message = original instanceof HttpException ? original.message : "Fallo al actualizar la orden o confirmar su bitacora.";
        const context = error instanceof OrderEventPersistenceError ? error.context : undefined;
        try {
            await this.repository.recordError(event, identity, message, context);
        } catch {
            this.logger.error({ event: "netsuite_order_audit_failed", eventId: event.event.eventId, netsuiteId: event.event.netsuiteId, error: message, payloadHash: identity.payloadHash, destination: context?.destination ?? null });
        }
        if (original instanceof HttpException) throw original;
        throw new ServiceUnavailableException(message);
    }
}
