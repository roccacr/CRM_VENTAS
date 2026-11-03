/**
 * Transporte de eventos a desarrollo local; la API v2 confirma persistencia durable. Sin
 * reintentos automaticos. Nunca lanza: devuelve { status, delivered } para que quien llama solo registre metadatos.
 * No hace: no sabe como leer ni mapear una entidad (lo aporta cada modulo) ni persiste una cola de envio.
 * Limite conocido: https.post es sincrono y corre durante el guardado (10 unidades); Oracle recomienda mover
 * llamadas externas a un script programado cuando se requiera produccion con recuperacion.
 * Archivador: /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_EnviarEvento.js
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["N/https", "N/runtime", "N/crypto/random", "./SS2_1_LIB_CRM_Entorno"], (
    https,
    runtime,
    random,
    environment,
) => {
    "use strict";

    const { isAuthorizedSandbox } = environment;

    // Host por defecto del tunel de desarrollo; se sustituye con el parametro opcional custscript_crm_event_url.
    const DEFAULT_ORIGIN = "https://nontransgressively-sequential-leif.ngrok-free.dev";
    const URL_PARAMETER = "custscript_crm_event_url";
    const LOCAL_PATH = "/integrations/netsuite/local/";
    // El parametro solo aporta el host; se acepta tambien una URL completa antigua (<host>/.../order-events).
    const ALLOWED_PARAMETER =
        /^(https:\/\/[a-z0-9-]+\.ngrok-free\.dev)(\/integrations\/netsuite\/local\/[a-z]+(?:-[a-z]+)*-events)?$/;
    // Cada modulo declara su endpoint ("order-events", "lead-events"...); nunca viene del registro ni del usuario.
    const ENDPOINT_NAME = /^[a-z]+(?:-[a-z]+)*-events$/;
    // TEMPORAL Sandbox: clave directa; sustituir por API Secret al cerrar la prueba.
    const SECRET_ID = "eea21f021a387ac684ab2518529115e3005ef90aec870f55548038650bb9fd0f";
    const SCHEMA_VERSION = 2;
    const MAX_BODY_BYTES = 500000;
    // Largo maximo (UTF-16) de cada texto que acepta el receptor. No se trunca informacion de negocio: se bloquea.
    const MAX_VALUE_LENGTH = 16000;

    /**
     * @param {{recordType: string, netsuiteId: string, eventType: string}} event Evento ya validado.
     * @param {function(string): {status: number}} readSnapshot Lectura del snapshot del registro por ID,
     *        ya en la forma que espera el receptor.
     * @param {string} endpoint Endpoint del receptor propio del modulo, p. ej. "order-events".
     * @returns {{status: string, delivered: boolean}} `delivered` solo es true con status "received_local".
     */
    function sendRecordEvent(event, readSnapshot, endpoint) {
        try {
            if (!isAuthorizedSandbox()) return blocked("environment_blocked");
            // URL administrada, nunca tomada de los campos o del usuario que edito el registro.
            const url = resolveUrl(endpoint);
            if (url === null) return blocked("destination_blocked");
            // TEMPORAL: token local directo, solo Sandbox; sustituir por API Secret tras la prueba.
            const authorization = https.createSecureString({ input: "Bearer " + SECRET_ID });
            return deliverObservation(url, authorization, event, readSnapshot);
        } catch (error) {
            // El guardado ya ocurrio; no lanzar ni fingir que se reintentara automaticamente.
            const safe =
                error &&
                ["source_version_unavailable", "source_flags_unavailable", "snapshot_changed"].includes(error.message);
            return blocked(safe ? error.message : "delivery_failed");
        }
    }

    /** Un conflicto exige una lectura nueva; nunca reenviar contenido viejo con una marca de tiempo nueva. */
    function deliverObservation(url, authorization, event, readSnapshot) {
        let result = blocked("snapshot_conflict");
        for (let attempt = 0; attempt < 2; attempt++) {
            result = sendSnapshot(url, authorization, event, readSnapshot);
            if (result.status !== "snapshot_conflict") return result;
        }
        return result;
    }

    function sendSnapshot(url, authorization, event, readSnapshot) {
        const versionedEvent = { ...event, eventId: random.generateUUID(), observedAt: new Date().toISOString() };
        const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt, ...snapshot } = readSnapshot(
            event.netsuiteId,
        );
        Object.assign(versionedEvent, { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt });
        if (snapshot.status !== 200) return blocked("snapshot_failed");
        if (hasOversizedValue(snapshot)) return blocked("value_too_long");
        const body = buildBody(versionedEvent, snapshot);
        if (byteLength(body) > MAX_BODY_BYTES) return blocked("payload_too_large");
        return deliver(url, body, authorization, versionedEvent);
    }

    /** Resultado de un envio que no se completo. */
    function blocked(status) {
        return { status, delivered: false };
    }

    /** URL final = host administrado + ruta local + endpoint del modulo; null si algo no es valido. */
    function resolveUrl(endpoint) {
        if (typeof endpoint !== "string" || !ENDPOINT_NAME.test(endpoint)) return null;
        const configured = runtime.getCurrentScript().getParameter({ name: URL_PARAMETER }) || DEFAULT_ORIGIN;
        const match = ALLOWED_PARAMETER.exec(configured);
        return match ? match[1] + LOCAL_PATH + endpoint : null;
    }

    /** Cuerpo JSON cerrado: nunca el record crudo ni el secreto. */
    function buildBody(event, snapshot) {
        return JSON.stringify({
            schemaVersion: SCHEMA_VERSION,
            source: { system: "netsuite", accountId: runtime.accountId, environment: "sandbox" },
            // UTC ISO a proposito: es un instante de maquina, no una fecha de negocio de la cuenta.
            event,
            snapshot,
        });
    }

    /** Confirma persistencia solo si HTTP y recibo coinciden con el evento enviado. */
    function deliver(url, body, authorization, event) {
        const response = postWithRetry({
            url,
            body,
            headers: {
                Authorization: authorization,
                "Content-Type": "application/json",
                "ngrok-skip-browser-warning": "true",
            },
        });
        if (Number(response.code) === 409) return blocked("snapshot_conflict");
        if (Number(response.code) !== 200) return blocked("receiver_rejected");
        if (!isMatchingReceipt(JSON.parse(response.body), event)) return blocked("receipt_invalid");
        return { status: "received_local", delivered: true };
    }

    /** Un solo reintento inmediato para red/5xx; conserva cuerpo y UUID para un COMMIT de resultado incierto. */
    function postWithRetry(request) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = https.post(request);
                if (Number(response.code) < 500 || attempt === 1) return response;
            } catch (error) {
                if (attempt === 1) throw error;
            }
        }
        throw new Error("delivery_failed");
    }

    /** El recibo acredita COMMIT y los mismos IDs de orden y evento; una mera recepcion v1 no basta. */
    function isMatchingReceipt(receipt, event) {
        return (
            Boolean(receipt) &&
            receipt.schemaVersion === SCHEMA_VERSION &&
            receipt.received === true &&
            receipt.persisted === true &&
            receipt.eventId === event.eventId &&
            receipt.netsuiteId === event.netsuiteId
        );
    }

    /** true si algun texto del snapshot, a cualquier profundidad, supera el largo que acepta el receptor. */
    function hasOversizedValue(value) {
        if (typeof value === "string") return value.length > MAX_VALUE_LENGTH;
        if (value === null || typeof value !== "object") return false;
        return Object.values(value).some(hasOversizedValue);
    }

    /** Bytes UTF-8 del cuerpo (no caracteres), sin depender de TextEncoder. */
    function byteLength(text) {
        return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, "x").length;
    }

    return Object.freeze({ sendRecordEvent });
});
