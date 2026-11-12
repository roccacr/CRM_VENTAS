import { createHash } from "node:crypto";

import { BadRequestException, ConflictException, HttpException, Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { isNetsuiteEventReceiverEnabled } from "../../common/security/local-service-token.guard.js";
import { type PersistedOrderEvent, persistedOrderEvent, productionOrderEvent } from "./netsuite-order-event.contract.js";
import { calendarDate, mapOrderFields, mapOrderFlags, NETSUITE_DELIVERY_DATE_FIELD, readOrderRelationValues } from "./netsuite-order-event.mapper.js";
import { type ManualOrderSynchronization, NetsuiteOrderEventRepository, OrderEventPersistenceError } from "./netsuite-order-event.repository.js";

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
const MAX_EVENT_CLOCK_SKEW_MS = 60_000;

/** Una fecha futura de mas de 60 segundos se rechaza. Si no, un reloj adelantado dejaria viejas las lecturas siguientes. */
export function assertCursorTimestamps(event: PersistedOrderEvent["event"]): void {
    const latest = Date.now() + MAX_EVENT_CLOCK_SKEW_MS;
    const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt } = event;
    const timestamps = [sourceModifiedAt, ...(snapshotReadStartedAt === undefined ? [] : [snapshotReadStartedAt]), ...(snapshotReadCompletedAt === undefined ? [] : [snapshotReadCompletedAt])];
    if (!timestamps.every((value) => Date.parse(value) <= latest)) throw new BadRequestException("Fecha de revisión o lectura NetSuite inválida o adelantada.");
}

/** Orquesta el contrato durable; la respuesta positiva siempre ocurre despues del COMMIT. */
@Injectable()
export class NetsuiteOrderEventService {
    private readonly logger = new Logger(NetsuiteOrderEventService.name);
    /** Mantiene el permiso de persistencia separado de la recepcion historica v1. */
    constructor(
        @Inject(NetsuiteOrderEventRepository) private readonly repository: NetsuiteOrderEventRepository,
        @Inject(ConfigService) private readonly config: ConfigService,
    ) {}

    /** Un fallo se puede reenviar con el mismo UUID y el mismo cuerpo. Una lectura vieja es 409 y exige consultar NetSuite de nuevo. La respuesta positiva sale despues del commit. */
    async receive(event: PersistedOrderEvent, manual?: ManualOrderSynchronization) {
        this.assertPersistenceEnabled(event);
        assertCursorTimestamps(event.event);
        const identity = { payloadHash: digest(event), snapshotHash: "" };
        try {
            identity.snapshotHash = orderSnapshotHash(event.snapshot.data.fields);
            const result = await this.repository.apply(event, identity, manual);
            if (result.result === "stale") throw new ConflictException("Evento anterior o ambiguo; consultar NetSuite antes de reenviar.");
            this.logger.log({ event: "netsuite_order_event_completed", eventId: event.event.eventId, netsuiteId: event.event.netsuiteId, result: result.result, destination: result.destination, duplicate: result.duplicate });
            return { schemaVersion: 2, received: true, persisted: result.result !== "not_found", netsuiteId: event.event.netsuiteId, eventId: event.event.eventId, result: result.result, destination: result.destination, duplicate: result.duplicate, ...(manual ? { changes: result.changes.length } : {}) };
        } catch (error) {
            return this.recordFailure(event, identity, error);
        }
    }

    /** El receptor y la bandera de persistencia tienen que estar encendidos. Apagado tambien bloquea la escritura manual sobre esta base. */
    synchronizationEnabled(environment: "production" | "sandbox"): boolean {
        const prefix = environment === "production" ? "NETSUITE_PRODUCTION_EVENTS" : "NETSUITE_LOCAL_EVENTS";
        return isNetsuiteEventReceiverEnabled(this.config, environment) && this.config.get<boolean>(prefix + "_PERSIST") === true;
    }
    /** Quien llama directo pasa por la misma cuenta y el mismo ambiente que el HTTP. */
    private assertPersistenceEnabled(event: PersistedOrderEvent): void {
        const production = event.source.environment === "production";
        const source = production ? productionOrderEvent.shape.source : persistedOrderEvent.shape.source;
        if (!source.safeParse(event.source).success) throw new ServiceUnavailableException("Origen NetSuite incompatible.");
        const prefix = production ? "NETSUITE_PRODUCTION_EVENTS" : "NETSUITE_LOCAL_EVENTS";
        if (!isNetsuiteEventReceiverEnabled(this.config, event.source.environment) || this.config.get<boolean>(prefix + "_PERSIST") !== true) throw new ServiceUnavailableException("Persistencia NetSuite deshabilitada.");
    }

    private async recordFailure(event: PersistedOrderEvent, identity: { payloadHash: string; snapshotHash: string }, error: unknown): Promise<never> {
        // Otra transaccion guarda la evidencia aunque la comercial haya vuelto atras. El log, si esa tambien falla, lleva ids y hash, no el snapshot.
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

/** Huella canónica compartida por sincronización completa y lectura parcial de Reserva Aplicada. */
export function orderSnapshotHash(fields: PersistedOrderEvent["snapshot"]["data"]["fields"]): string {
    const relations = readOrderRelationValues(fields);
    const direct = [...mapOrderFlags(fields, "native", {}), ...mapOrderFields(fields, "native", {})].map(({ field, after }) => ({ field, after }));
    // Ausente conserva el valor. Nulo explicito lo limpia. No pueden compartir hash.
    if (fields.crm_sync_projection === 1 && Object.hasOwn(fields, "custbody37") && !direct.some(({ field }) => field === "custbody37")) direct.push({ field: "custbody37", after: null });
    const deliveryField = NETSUITE_DELIVERY_DATE_FIELD;
    if (Object.hasOwn(fields, deliveryField)) direct.push({ field: deliveryField, after: calendarDate(fields[deliveryField]) });
    return digest(fields.crm_sync_projection === 1 ? { direct, relations } : direct);
}
