/**
 * Versión: 2026.11.13.1 — Diagnóstico por etapa de fallos del webhook; conserva autenticación y reglas vigentes.
 * CRM TINK LIB - Consolidacion de los 16 modulos originales.
 * API pública por módulos. salesOrders.get atiende la ficha, el snapshot y
 * las consultas findByTranId e importRelation. leads.get atiende importCustomer.
 * Cada consulta de importación define los campos que puede devolver.
 * Version unificada para Produccion y Sandbox; cuenta autorizada y custbody37 validados.
 * Uso de servidor; conserva las restricciones y configuracion originales.
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["N/runtime", "N/https", "N/crypto/random", "N/log", "N/record", "N/search", "N/format", "N/workflow"], (
    ns0,
    ns1,
    ns2,
    ns3,
    ns4,
    ns5,
    ns6,
    ns7,
) => {
    "use strict";

    // Origen: lib/SS2_1_LIB_CRM_Campos.js
    const fields = (() => {
        "use strict";

        /**
         * Convierte "a b c" en { a: "a", b: "b", c: "c" } ({ campoRespuesta: campoNetSuite }).
         * @param {string} list IDs de campo separados por espacios o saltos de linea.
         * @returns {Object<string, string>} Mapa congelado.
         */
        function fieldMap(list) {
            return Object.freeze(
                Object.fromEntries(
                    list
                        .trim()
                        .split(/\s+/)
                        .map((id) => [id, id]),
                ),
            );
        }

        /**
         * Aplica un lector a cada campo del mapa.
         * @param {Object<string, string>} map { campoRespuesta: campoNetSuite }.
         * @param {function(string): *} read Lector de un campo por ID.
         * @returns {Object<string, (string|boolean|null)>} { campoRespuesta: escalar }.
         */
        function mapFields(map, read) {
            return Object.fromEntries(Object.entries(map).map(([key, fieldId]) => [key, scalar(read(fieldId))]));
        }

        /**
         * Lector de cuerpo con valor crudo (getValue): montos, IDs y banderas.
         * @param {object} rec Record de NetSuite.
         * @returns {function(string): *} Lector por ID de campo.
         */
        function bodyValue(rec) {
            return (fieldId) => rec.getValue({ fieldId });
        }

        /**
         * Lector de cuerpo con valor formateado (getText): fechas, porcentajes y listas.
         * @param {object} rec Record de NetSuite.
         * @returns {function(string): *} Lector por ID de campo.
         */
        function bodyText(rec) {
            return (fieldId) => rec.getText({ fieldId });
        }

        /**
         * Lee una sublista como { "line 1": {...}, "line 2": {...} } (formato que consume el CRM).
         * @param {object} rec Record de NetSuite.
         * @param {string} sublistId ID de la sublista.
         * @param {{texts?: Object<string, string>, values?: Object<string, string>}} schema Campos por lectura getSublistText/Value.
         * @param {number} maxLines Tope de lineas; cada modulo decide su respuesta si se supera.
         * @returns {?Object<string, object>} Lineas, o null si supera maxLines (sin leer ninguna).
         * @throws {Error} "Invalid line count" si NetSuite devuelve un conteo que no es entero >= 0.
         */
        function readSublist(rec, sublistId, { texts = {}, values = {} }, maxLines) {
            const count = rec.getLineCount({ sublistId });
            // NetSuite devuelve -1 si la sublista no existe; cualquier valor no entero tambien es invalido.
            if (!Number.isInteger(count) || count < 0) throw new Error("Invalid line count");
            if (count > maxLines) return null;

            const lines = {};
            for (let line = 0; line < count; line++) {
                lines[`line ${line + 1}`] = {
                    ...mapFields(texts, (fieldId) => rec.getSublistText({ sublistId, fieldId, line })),
                    ...mapFields(values, (fieldId) => rec.getSublistValue({ sublistId, fieldId, line })),
                };
            }
            return lines;
        }

        /**
         * Normaliza a escalar serializable. Objetos, fechas, arrays y numeros no finitos -> null,
         * para que nunca se filtre la estructura interna del record. Los numeros salen como string (conversion del Number ya recibido).
         */
        function scalar(value) {
            if (typeof value === "string" || typeof value === "boolean") return value;
            return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
        }

        return Object.freeze({ fieldMap, mapFields, bodyValue, bodyText, readSublist });
    })();

    // Origen: lib/SS2_1_LIB_CRM_Respuestas.js
    const responses = (() => {
        "use strict";

        /**
         * Error de aplicacion.
         * @param {number} status Codigo de aplicacion (400, 404, 409, 502...).
         * @param {string} code Codigo estable y legible por maquina.
         * @param {string} message Mensaje saneado, sin texto del proveedor.
         * @returns {{status: number, error: {code: string, message: string}}}
         */
        function fail(status, code, message) {
            return { status, error: { code, message } };
        }

        /**
         * Exito de aplicacion (status 200).
         * @param {object} data Carga util serializable.
         * @returns {{status: number, data: object}}
         */
        function ok(data) {
            return { status: 200, data };
        }

        /**
         * Respuesta de los modulos reservados que aun no tienen operaciones.
         * @returns {{status: number, error: {code: string, message: string}}} 501 NOT_IMPLEMENTED.
         */
        function notImplemented() {
            return fail(501, "NOT_IMPLEMENTED", "Estructura creada. Operacion pendiente de implementar.");
        }

        return Object.freeze({ fail, ok, notImplemented });
    })();

    // Origen: lib/SS2_1_LIB_CRM_Validacion.js
    const validation = ((responses) => {
        "use strict";

        const { fail } = responses;

        // Maximo 15 digitos: es el limite del receptor de eventos y cabe siempre en un entero seguro.
        const CANONICAL_ID = /^[1-9]\d{0,14}$/;

        /**
         * Evita leer propiedades heredadas del prototipo (proteccion ante prototype pollution).
         * @param {object} obj Objeto a inspeccionar.
         * @param {string} key Propiedad buscada.
         * @returns {boolean} true solo si la propiedad es propia.
         */
        function hasOwn(obj, key) {
            return Object.prototype.hasOwnProperty.call(obj, key);
        }

        /**
         * ID interno positivo, como string decimal canonico de hasta 15 digitos.
         * @param {object} request Solicitud ya validada como objeto.
         * @returns {boolean} true si `request.id` es un ID interno valido.
         */
        function isValidId(request) {
            const id = hasOwn(request, "id") ? request.id : undefined;
            return typeof id === "string" && CANONICAL_ID.test(id);
        }

        /**
         * Respuesta estandar para un ID invalido.
         * @param {object} request Solicitud ya validada como objeto.
         * @returns {?{status: number, error: object}} 400 INVALID_ID, o null si el ID es valido.
         */
        function invalidIdResponse(request) {
            return isValidId(request) ? null : fail(400, "INVALID_ID", "Indica un ID interno positivo de NetSuite.");
        }

        return Object.freeze({ hasOwn, isValidId, invalidIdResponse });
    })(responses);

    // Origen: lib/SS2_1_LIB_CRM_ErroresProveedor.js
    const providerErrors = ((responses) => {
        "use strict";

        const { fail } = responses;

        /** Codigos de SuiteScriptError (error.name) que significan "no existe" en lugar de "fallo". */
        const NOT_FOUND_ERRORS = Object.freeze(["RCRD_DSNT_EXIST"]);

        /**
         * @param {*} error Excepcion capturada (cualquier valor).
         * @param {{notFound: {code: string, message: string}, readFailed: {code: string, message: string}}} errors
         *        Errores propios del modulo.
         * @returns {{status: number, error: {code: string, message: string}}} 404 si el registro no existe; 502 en
         *          cualquier otro caso.
         */
        function providerError(error, errors) {
            const notFound = Boolean(error) && NOT_FOUND_ERRORS.includes(error.name);
            const { code, message } = notFound ? errors.notFound : errors.readFailed;
            return fail(notFound ? 404 : 502, code, message);
        }

        return Object.freeze({ providerError });
    })(responses);

    // Origen: lib/SS2_1_LIB_CRM_ConsultarPorId.js
    const readByIdFlow = ((validation, providerErrors) => {
        "use strict";

        const { invalidIdResponse } = validation;
        const { providerError } = providerErrors;

        /**
         * @param {object} request Solicitud ya validada como objeto por el enrutador.
         * @param {function(string): object} read Lectura propia del modulo; puede lanzar errores del proveedor.
         * @param {{notFound: object, readFailed: object}} errors Errores de lectura propios del modulo.
         * @returns {object} Respuesta de aplicacion (ok o fail); nunca lanza errores del proveedor.
         */
        function readById(request, read, errors) {
            const invalid = invalidIdResponse(request);
            if (invalid) return invalid;
            try {
                return read(request.id);
            } catch (error) {
                return providerError(error, errors);
            }
        }

        return Object.freeze({ readById });
    })(validation, providerErrors);

    // Origen: lib/SS2_1_LIB_CRM_EjecutarAccion.js
    const runActionFlow = ((responses, validation) => {
        "use strict";

        const { fail, notImplemented } = responses;
        const { hasOwn, invalidIdResponse } = validation;

        /** Claves permitidas en el cuerpo de un PUT. Cualquier otra se rechaza. */
        const PUT_ALLOWED_KEYS = Object.freeze(["module", "action", "id"]);

        /**
         * El orden de validacion es parte del contrato con el CRM:
         * sin action -> 501; action desconocida -> 400; claves extra -> 400; ID invalido -> 400.
         *
         * @param {object} request Solicitud ya validada como objeto por el enrutador.
         * @param {Object<string, function(string): object>} actions Acciones del modulo por nombre.
         * @returns {object} Respuesta de aplicacion (ok o fail).
         */
        function runAction(request, actions) {
            if (!hasOwn(request, "action")) return notImplemented();

            if (typeof request.action !== "string" || !hasOwn(actions, request.action))
                return fail(400, "INVALID_ACTION", "Selecciona una accion valida.");

            if (Object.keys(request).some((key) => !PUT_ALLOWED_KEYS.includes(key)))
                return fail(400, "INVALID_REQUEST", "Solo se permiten module, action e id.");
            const invalid = invalidIdResponse(request);
            if (invalid) return invalid;
            return actions[request.action](request.id);
        }

        return Object.freeze({ runAction });
    })(responses, validation);

    // Origen: lib/SS2_1_LIB_CRM_Entorno.js
    const environment = ((runtime) => {
        "use strict";

        const ACCOUNT_PARAMETER = "custscript_crm_account_id";
        const DEFAULT_ACCOUNTS = Object.freeze({ production: "4552704", sandbox: "4552704_SB1" });

        /** Solo se permiten cuentas de produccion y sandbox; otros tipos de cuenta permanecen bloqueados. */
        function getEnvironmentName() {
            if (runtime.envType === runtime.EnvType.SANDBOX) return "sandbox";
            if (runtime.envType === runtime.EnvType.PRODUCTION) return "production";
            return null;
        }

        /** La cuenta del parametro tiene que ser exactamente runtime.accountId. Si el parametro falta, produccion usa 4552704 y sandbox 4552704_SB1. Otro tipo de cuenta queda bloqueado. */
        function isAuthorizedEnvironment() {
            const configuredAccount = runtime.getCurrentScript().getParameter({ name: ACCOUNT_PARAMETER });
            // Si el despliegue trae cuenta, esa gana. El respaldo solo entra cuando el parametro es null, undefined o vacio.
            const missingAccount =
                configuredAccount === null || configuredAccount === undefined || configuredAccount === "";
            const environmentName = getEnvironmentName();
            const parameter =
                missingAccount && environmentName !== null ? DEFAULT_ACCOUNTS[environmentName] : configuredAccount;
            // Un entero seguro tambien vale y se vuelve texto. Un objeto o un booleano no se convierte y no autoriza.
            const accountId =
                typeof parameter === "number" && Number.isSafeInteger(parameter) ? String(parameter) : parameter;
            return getEnvironmentName() !== null && typeof accountId === "string" && accountId === runtime.accountId;
        }

        return Object.freeze({ getEnvironmentName, isAuthorizedEnvironment });
    })(ns0);

    // Origen: lib/SS2_1_LIB_CRM_EnviarEvento.js
    const delivery = ((https, runtime, random, environment) => {
        "use strict";

        const { getEnvironmentName, isAuthorizedEnvironment } = environment;

        // Producción usa la credencial fija del receptor oficial; otros destinos usan el API Secret del deployment.
        const URL_PARAMETER = "custscript_crm_event_url";
        const SECRET_PARAMETER = "custscript_crm_event_secret_id";
        const PRODUCTION_EVENT_BASE_URL = "https://api-habita.rdghub.com/integrations/netsuite/production";
        const ALLOWED_BASE_URL =
            /^https:\/\/(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?::\d{1,5})?(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\/?$/i;
        const ENDPOINT_NAME = /^[a-z]+(?:-[a-z]+)*-events$/;
        const SECRET_ID_PATTERN = /^custsecret_[a-z0-9_]+$/i;
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
                if (!isAuthorizedEnvironment()) return blocked("environment_blocked");
                // La URL se resuelve por deployment y respaldo oficial; nunca desde datos del registro.
                const url = resolveUrl(endpoint);
                if (url === null) return blocked("destination_blocked");
                // Credencial fija acordada con NETSUITE_PRODUCTION_EVENTS_SECRET de Ubuntu.
                // REGLA OPERATIVA: clave fija; no rota automáticamente.
                // No cambiar, rotar, quitar ni sustituir por custsecret en mantenimiento o despliegues.
                // Solo cambiar con autorización explícita del propietario y actualización coordinada de ambos extremos.
                // Autenticación confirmada el 11/11/2026: OV 8584742 respondió import_queued (v2026.11.11.3).
                // Ese recibo confirma encolado; no acredita que la importación haya terminado.
                // Limitada a esta cuenta y al receptor oficial; nunca registrar su valor.
                if (
                    getEnvironmentName() === "production" &&
                    runtime.accountId === "4552704" &&
                    url === PRODUCTION_EVENT_BASE_URL + "/" + endpoint
                ) {
                    return deliverObservation(
                        url,
                        https.createSecureString({
                            input: "Bearer 0247f2b0f157a2299fe33f262c31437703166fa6e20336b38580f1f81e3989b4",
                        }),
                        event,
                        readSnapshot,
                    );
                }
                const configuredSecretId = runtime.getCurrentScript().getParameter({ name: SECRET_PARAMETER });
                const secretId =
                    typeof configuredSecretId === "string" ? configuredSecretId.trim() : configuredSecretId;
                if (typeof secretId !== "string" || !SECRET_ID_PATTERN.test(secretId)) {
                    return blocked("configuration_missing");
                }
                const authorization = https.createSecureString({ input: "Bearer {" + secretId + "}" });
                return deliverObservation(url, authorization, event, readSnapshot);
            } catch (error) {
                // El guardado ya ocurrio; no lanzar ni fingir que se reintentara automaticamente.
                if (error && error.crmTransportCode) {
                    return {
                        ...blocked("delivery_failed"),
                        failureStage: error.crmFailureStage || "http_request",
                        errorCode: error.crmTransportCode,
                        transportCode: error.crmTransportCode,
                        failureReason: error.crmTransportReason,
                    };
                }
                const safe =
                    error &&
                    ["source_version_unavailable", "source_flags_unavailable", "snapshot_changed"].includes(
                        error.message,
                    );
                return {
                    ...blocked(safe ? error.message : "delivery_failed"),
                    failureStage: error?.crmFailureStage || "configuration",
                    errorCode: error?.crmErrorCode || "UNCLASSIFIED",
                    failureReason: error?.crmFailureStage
                        ? "exception_in_" + error.crmFailureStage
                        : "configuration_exception",
                };
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

        /** Cada intento lee de nuevo y lleva un UUID nuevo. Las tres marcas de tiempo salen de la foto y entran al evento, no al snapshot. */
        function sendSnapshot(url, authorization, event, readSnapshot) {
            const versionedEvent = {
                ...event,
                eventId: atStage("event_prepare", () => random.generateUUID()),
                observedAt: new Date().toISOString(),
            };
            const { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt, ...snapshot } = atStage(
                "snapshot_read",
                () => readSnapshot(event.netsuiteId),
            );
            Object.assign(versionedEvent, { sourceModifiedAt, snapshotReadStartedAt, snapshotReadCompletedAt });
            if (snapshot.status !== 200) return blocked("snapshot_failed");
            if (atStage("payload_build", () => hasOversizedValue(snapshot))) return blocked("value_too_long");
            const body = atStage("payload_build", () => buildBody(versionedEvent, snapshot));
            if (atStage("payload_build", () => byteLength(body)) > MAX_BODY_BYTES) return blocked("payload_too_large");
            return deliver(url, body, authorization, versionedEvent);
        }

        /** Resultado de un envio que no se completo. */
        function blocked(status) {
            return {
                status,
                delivered: false,
                failureStage:
                    status.startsWith("snapshot") ||
                    status === "source_flags_unavailable" ||
                    status === "source_version_unavailable"
                        ? "snapshot_read"
                        : status === "receiver_rejected" || status === "delivery_failed"
                          ? "http_request"
                          : status === "receipt_invalid"
                            ? "receipt_validation"
                            : status === "payload_too_large" || status === "value_too_long"
                              ? "payload_build"
                              : "configuration",
                failureReason: status,
            };
        }

        /** Conserva etapa y códigos conocidos, nunca mensajes crudos que puedan contener secretos o datos personales. */
        function atStage(stage, action) {
            try {
                return action();
            } catch (error) {
                const wrapped = new Error(
                    ["source_version_unavailable", "source_flags_unavailable", "snapshot_changed"].includes(
                        error?.message,
                    )
                        ? error.message
                        : "delivery_failed",
                );
                wrapped.crmFailureStage = stage;
                const known = [
                    "SSS_USAGE_LIMIT_EXCEEDED",
                    "RCRD_DSNT_EXIST",
                    "INSUFFICIENT_PERMISSION",
                    "SSS_PERMISSION_VIOLATION",
                    "SSS_INVALID_SRCH_COL",
                    "SSS_INVALID_SRCH_FILTER",
                    "SSS_MISSING_REQD_ARGUMENT",
                    "SSS_INVALID_API_USAGE",
                    "SSS_REQUEST_TIME_EXCEEDED",
                    "SSS_CONNECTION_TIME_OUT",
                    "SSS_CONNECTION_CLOSED",
                    "SSS_INVALID_HOST_CERT",
                    "SSS_UNKNOWN_HOST",
                    "SSS_INVALID_URL",
                    "SSS_REQUEST_LOOP_DETECTED",
                ];
                wrapped.crmErrorCode = known.includes(error?.name)
                    ? error.name
                    : known.includes(error?.code)
                      ? error.code
                      : error?.name === "SyntaxError"
                        ? "INVALID_JSON_RESPONSE"
                        : "UNCLASSIFIED";
                if (error?.crmTransportCode) {
                    wrapped.crmTransportCode = error.crmTransportCode;
                    wrapped.crmTransportReason = error.crmTransportReason;
                }
                throw wrapped;
            }
        }

        /** URL final = URL base administrada + endpoint del modulo; null si algo no es valido. */
        function resolveUrl(endpoint) {
            if (typeof endpoint !== "string" || !ENDPOINT_NAME.test(endpoint)) return null;
            const configured = runtime.getCurrentScript().getParameter({ name: URL_PARAMETER });
            if (configured !== null && configured !== undefined && typeof configured !== "string") return null;
            let baseUrl = configured?.trim() ?? "";
            // Respaldo temporal para esta cuenta; el parámetro del despliegue tiene prioridad.
            if (baseUrl === "" && getEnvironmentName() === "production" && runtime.accountId === "4552704") {
                baseUrl = PRODUCTION_EVENT_BASE_URL;
            }
            if (!ALLOWED_BASE_URL.test(baseUrl)) return null;
            const url = baseUrl.replace(/\/+$/, "");
            // Si el despliegue ya incluye la ruta de este módulo, no volver a agregarla.
            const suffix = "/" + endpoint;
            return url.endsWith(suffix) && url.indexOf("/", "https://".length) !== -1 ? url : url + suffix;
        }

        /** Cuerpo JSON cerrado: nunca el record crudo ni el secreto. */
        function buildBody(event, snapshot) {
            return JSON.stringify({
                schemaVersion: SCHEMA_VERSION,
                source: { system: "netsuite", accountId: runtime.accountId, environment: getEnvironmentName() },
                // UTC ISO a proposito: es un instante de maquina, no una fecha de negocio de la cuenta.
                event,
                snapshot,
            });
        }

        /** Confirma persistencia solo si HTTP y recibo coinciden con el evento enviado. */
        function deliver(url, body, authorization, event) {
            const response = atStage("http_request", () =>
                postWithRetry({
                    url,
                    body,
                    headers: {
                        Authorization: authorization,
                        "Content-Type": "application/json",
                        "ngrok-skip-browser-warning": "true",
                    },
                }),
            );
            if (Number(response.code) === 409) return blocked("snapshot_conflict");
            if (Number(response.code) !== 200) {
                const httpStatus = Number(response.code);
                // No copiar el cuerpo: puede contener datos personales, HTML del proxy o credenciales.
                const failureReason =
                    {
                        400: "invalid_payload",
                        401: "authentication_rejected",
                        403: "access_rejected",
                        404: "endpoint_not_found",
                        413: "payload_too_large",
                        429: "rate_limited",
                    }[httpStatus] || (httpStatus >= 500 ? "receiver_unavailable" : "unexpected_http_status");
                return { ...blocked("receiver_rejected"), httpStatus, failureReason };
            }
            const receipt = atStage("receipt_validation", () => JSON.parse(response.body));
            if (!isMatchingReceipt(receipt, event))
                return {
                    ...blocked("receipt_invalid"),
                    httpStatus: 200,
                    failureReason: receiptFailureReason(receipt, event),
                };
            return { status: receipt.importQueued === true ? "import_queued" : "received_local", delivered: true };
        }

        /** Un solo reintento inmediato para red o HTTP 500 o mas. Un 4xx, incluido el 409, vuelve en el primer intento. El cuerpo y el UUID no cambian en ese reintento. */
        function postWithRetry(request) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const response = https.post(request);
                    if (Number(response.code) < 500 || attempt === 1) return response;
                } catch (error) {
                    if (attempt === 1) {
                        // Solo códigos cerrados del proveedor; mensajes y cuerpos pueden contener secretos o datos personales.
                        const reasons = {
                            SSS_REQUEST_TIME_EXCEEDED: "timeout",
                            SSS_CONNECTION_TIME_OUT: "timeout",
                            SSS_CONNECTION_CLOSED: "connection_closed",
                            SSS_INVALID_HOST_CERT: "tls_error",
                            SSS_UNKNOWN_HOST: "dns_error",
                            SSS_INVALID_URL: "invalid_url",
                            SSS_REQUEST_LOOP_DETECTED: "request_loop",
                        };
                        const code = error && (typeof reasons[error.name] === "string" ? error.name : error.code);
                        const failure = new Error("delivery_failed");
                        failure.crmTransportCode = typeof reasons[code] === "string" ? code : "UNCLASSIFIED";
                        failure.crmTransportReason =
                            typeof reasons[code] === "string" ? reasons[code] : "transport_error";
                        throw failure;
                    }
                }
            }
            throw new Error("delivery_failed");
        }

        /** Acredita COMMIT de la edición o de la solicitud de importación. En cola aún no equivale a orden creada. */
        function isMatchingReceipt(receipt, event) {
            return receiptFailureReason(receipt, event) === null;
        }

        /** El primer incumplimiento identifica el contrato rechazado sin publicar el cuerpo de respuesta. */
        function receiptFailureReason(receipt, event) {
            if (!receipt) return "receipt_missing";
            if (receipt.schemaVersion !== SCHEMA_VERSION) return "receipt_schema_mismatch";
            if (receipt.received !== true) return "receipt_not_received";
            if (!(
                receipt.persisted === true ||
                (receipt.persisted === false && receipt.result === "not_found" && receipt.importQueued === true)
            ))
                return "receipt_persistence_unconfirmed";
            if (receipt.eventId !== event.eventId) return "receipt_event_id_mismatch";
            if (receipt.netsuiteId !== event.netsuiteId) return "receipt_order_id_mismatch";
            return null;
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
    })(ns1, ns0, ns2, environment);

    // Origen: lib/SS2_1_LIB_CRM_Logs.js
    const logging = ((log) => {
        "use strict";

        // Version unica del conjunto de scripts. Actualizar al preparar cada entrega: la lee el empaquetador.
        const SCRIPT_VERSION = "2026.11.13.1";

        /**
         * Un fallo del logger no debe interrumpir una consulta ni cambiar su respuesta.
         * @param {"debug"|"audit"|"error"} level Nivel de N/log: debug desarrollo, audit negocio, error fallos.
         * @param {string} title Titulo corto y fijo (sirve para filtrar).
         * @param {object} details Solo metadatos saneados; se agrega `scriptVersion`.
         * @returns {void}
         */
        function executionLog(level, title, details) {
            try {
                log[level]({ title, details: { ...details, scriptVersion: SCRIPT_VERSION } });
            } catch {
                // No recurrir a otro logger: evitamos fallos en cadena y duplicar registros.
            }
        }

        return Object.freeze({ executionLog });
    })(ns3);

    // Origen: lib/SS2_1_LIB_CRM_Eventos.js
    const events = ((environment, validation, logging) => {
        "use strict";

        const { isAuthorizedEnvironment } = environment;
        const { hasOwn, isValidId } = validation;
        const { executionLog } = logging;

        // Delete requiere su propio contrato; nunca intentar cargar un registro ya eliminado.
        const SAVED_EVENTS = Object.freeze(["create", "edit", "xedit", "approve", "cancel", "reject"]);

        /**
         * @param {{newRecord?: {type: string, id: *}, type?: string}} context Contexto de NetSuite.
         * @param {Object<string, {code: string, afterSubmit?: function(object): {status: string, delivered: boolean}}>} modules
         *        Registro cerrado por tipo de registro; sin afterSubmit el modulo se reporta como pendiente.
         * @returns {void}
         */
        function afterSubmit(context, modules) {
            try {
                if (!isAuthorizedEnvironment()) return;
                const event = toSavedEvent(context, modules);
                if (event === null) return;
                const handler = modules[event.recordType];
                const result =
                    typeof handler.afterSubmit === "function"
                        ? handler.afterSubmit(event)
                        : { status: "module_pending", delivered: false };
                logOutcome(handler.code, event, result);
            } catch {
                executionLog("error", "CRM_v2: evento no procesado", { code: "USER_EVENT_FAILED", delivered: false });
            }
        }

        /** Evento normalizado { recordType, netsuiteId, eventType }, o null si no hay nada que procesar. */
        function toSavedEvent(context, modules) {
            const record = context?.newRecord;
            if (!record || !SAVED_EVENTS.includes(context.type) || !hasOwn(modules, record.type)) return null;
            const netsuiteId = String(record.id ?? "");
            if (!isValidId({ id: netsuiteId })) return null;
            return { recordType: record.type, netsuiteId, eventType: context.type };
        }

        /** Mensajes operativos de vocabulario cerrado: una causa desconocida nunca se presenta como confirmada. */
        function failureGuidance(result) {
            const byReason = {
                authentication_rejected: [
                    "La API rechazó la autenticación (HTTP 401).",
                    "Verificar que la credencial configurada coincida en NetSuite y API; no rotarla automáticamente.",
                ],
                access_rejected: [
                    "La API denegó el acceso (HTTP 403).",
                    "Revisar cuenta, ambiente y habilitación del receptor en la API.",
                ],
                invalid_payload: [
                    "La API rechazó la estructura o valores del evento (HTTP 400).",
                    "Revisar el error de validación del receptor para esta orden y hora.",
                ],
                receiver_unavailable: [
                    "El receptor devolvió un error de servidor.",
                    "Revisar salud y logs de API/proxy; consultar la orden antes de reenviar.",
                ],
                endpoint_not_found: [
                    "El destino HTTP no encontró el endpoint.",
                    "Verificar URL y ruta del receptor desplegado.",
                ],
                rate_limited: [
                    "El receptor limitó la frecuencia de solicitudes.",
                    "Esperar y reenviar con control de frecuencia.",
                ],
                timeout: [
                    "NetSuite agotó el tiempo de espera del envío.",
                    "Comprobar si la API recibió esta orden antes de reintentar: el resultado puede ser incierto.",
                ],
                dns_error: ["NetSuite no resolvió el dominio del receptor.", "Revisar el dominio y su resolución DNS."],
                tls_error: [
                    "NetSuite rechazó el certificado HTTPS.",
                    "Revisar vigencia y cadena del certificado; no desactivar su validación.",
                ],
                connection_closed: [
                    "La conexión HTTP se cerró sin confirmación.",
                    "Revisar proxy/API y confirmar persistencia antes de reenviar.",
                ],
                receipt_persistence_unconfirmed: [
                    "La API respondió, pero no confirmó persistencia ni importación en cola.",
                    "Revisar result=not_found y el encolado automático para este tipo de evento.",
                ],
                receipt_schema_mismatch: [
                    "La versión del recibo de API no coincide con la esperada.",
                    "Comparar el contrato desplegado de API y librería NetSuite.",
                ],
                receipt_event_id_mismatch: [
                    "El recibo corresponde a otro evento.",
                    "Revisar correlación eventId en API/proxy; no asumir guardado.",
                ],
                receipt_order_id_mismatch: [
                    "El recibo corresponde a otra orden.",
                    "Revisar correlación netsuiteId en el receptor.",
                ],
                snapshot_conflict: [
                    "La orden cambió durante la sincronización.",
                    "Consultar una foto nueva de NetSuite antes de reenviar.",
                ],
            };
            const byCode = {
                SSS_USAGE_LIMIT_EXCEEDED: [
                    "NetSuite agotó las unidades de ejecución del script.",
                    "Revisar consumo de gobernanza en la etapa indicada.",
                ],
                RCRD_DSNT_EXIST: [
                    "NetSuite no encontró el registro requerido.",
                    "Verificar existencia, tipo e ID del registro usado en la etapa indicada.",
                ],
                INSUFFICIENT_PERMISSION: [
                    "El rol de ejecución no tiene acceso al registro u operación.",
                    "Revisar permisos del despliegue y del registro.",
                ],
                SSS_PERMISSION_VIOLATION: [
                    "NetSuite denegó la operación por permisos.",
                    "Revisar el rol de ejecución del despliegue.",
                ],
                INVALID_JSON_RESPONSE: [
                    "El receptor respondió un cuerpo que no es JSON válido.",
                    "Revisar proxy y endpoint: puede haberse recibido HTML en vez del recibo de API.",
                ],
            };
            const byStage = {
                snapshot_read: [
                    "No se pudo completar la lectura de la orden; la causa exacta no fue informada con un código reconocido.",
                    "Revisar logs de ejecución y permisos de lectura en NetSuite; usar el errorCode si está disponible.",
                ],
                http_request: [
                    "Falló el envío HTTP sin una causa reconocida.",
                    "Revisar conectividad y logs del receptor por orden y hora; confirmar resultado antes de reintentar.",
                ],
                receipt_validation: [
                    "La respuesta del receptor no confirmó correctamente el evento.",
                    "Revisar el contrato de respuesta y la bitácora de API; no asumir que no se guardó.",
                ],
                payload_build: [
                    "No se pudo preparar el payload de sincronización.",
                    "Revisar tipos, tamaño y campos del snapshot.",
                ],
                configuration: [
                    "No se pudo completar la configuración del envío.",
                    "Revisar ambiente, URL y configuración del despliegue sin publicar credenciales.",
                ],
            };
            const guidance = byReason[result.failureReason] ||
                byCode[result.errorCode] ||
                byStage[result.failureStage] || [
                    "Evento sin confirmación; causa exacta no disponible.",
                    "Revisar la etapa y los logs del evento en NetSuite y API.",
                ];
            return { failureDescription: guidance[0], recommendedAction: guidance[1], outcome: "unconfirmed" };
        }

        /** Solo metadatos cerrados: no loguear el record, datos personales, credenciales ni errores crudos. */
        function logOutcome(moduleCode, event, result) {
            const level = result.delivered || result.status === "module_pending" ? "debug" : "error";
            executionLog(level, "CRM_v2: registro guardado", {
                ...event,
                module: moduleCode,
                status: result.status,
                delivered: result.delivered === true,
                ...(!result.delivered && result.status !== "module_pending"
                    ? {
                          failureStage: result.failureStage || "event_dispatch",
                          failureReason: result.failureReason || result.status,
                          errorCode: result.errorCode || result.transportCode || "NOT_PROVIDED",
                          ...failureGuidance(result),
                      }
                    : {}),
                ...(result.transportCode
                    ? { transportCode: result.transportCode, failureReason: result.failureReason }
                    : {}),
                ...(Number.isInteger(result.httpStatus)
                    ? { httpStatus: result.httpStatus, failureReason: result.failureReason }
                    : {}),
            });
        }

        return Object.freeze({ afterSubmit });
    })(environment, validation, logging);

    // Origen: lib/SS2_1_LIB_CRM_Registros.js
    const records = ((record, search) => {
        "use strict";

        // NetSuite evalua define antes de habilitar N/record, incluso su enum Type.
        // Los identificadores de tipo son constantes de texto; las llamadas API quedan dentro de las funciones.
        const RECORD_TYPES = Object.freeze({ SALES_ORDER: "salesorder" });

        /**
         * Carga un record completo en modo estandar. Es la operacion mas costosa (10 unidades en transacciones):
         * usarla solo si se necesitan sublistas o muchos campos.
         * @param {string} type Tipo de record (ver RECORD_TYPES).
         * @param {string} id ID interno ya validado.
         * @returns {object} Record de NetSuite.
         * @throws {SuiteScriptError} Errores del proveedor; para un ID inexistente se espera RCRD_DSNT_EXIST.
         */
        function loadRecord(type, id) {
            return record.load({ type, id, isDynamic: false });
        }

        /**
         * Lee solo los campos pedidos sin cargar el record completo (1 unidad). Las casillas devuelven boolean.
         * @param {string} type Tipo de record.
         * @param {string} id ID interno ya validado.
         * @param {string[]} fieldIds IDs de los campos a leer.
         * @returns {Object<string, *>} Valores por ID de campo.
         * @throws {SuiteScriptError} Errores del proveedor; para un ID inexistente se espera RCRD_DSNT_EXIST
         *         (pendiente de comprobar con un ID inexistente en Sandbox).
         */
        function lookupFlags(type, id, fieldIds) {
            return search.lookupFields({ type, id, columns: fieldIds });
        }

        /**
         * Activa UNA casilla sin tocar otros campos. enableSourcing false evita recalcular datos de origen;
         * ignoreMandatoryFields false respeta las reglas de la cuenta.
         * @param {string} type Tipo de record.
         * @param {string} id ID interno ya validado.
         * @param {string} fieldId Casilla a activar.
         * @returns {void}
         * @throws {SuiteScriptError} Si la escritura falla; el resultado puede ser desconocido.
         */
        function writeFlag(type, id, fieldId) {
            record.submitFields({
                type,
                id,
                values: { [fieldId]: true },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: false,
                },
            });
        }

        return Object.freeze({ RECORD_TYPES, loadRecord, lookupFlags, writeFlag });
    })(ns4, ns5);

    // Origen: modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_Campos.js
    const salesOrderFields = ((fields) => {
        "use strict";

        const { fieldMap } = fields;

        /** Congela el esquema completo: nadie debe poder alterar la allowlist en tiempo de ejecucion. */
        function deepFreeze(value) {
            Object.values(value).forEach((child) => {
                if (child !== null && typeof child === "object") deepFreeze(child);
            });
            return Object.freeze(value);
        }

        return deepFreeze({
            // Aprobacion de Formalizacion: unica casilla que se escribe y las que se consultan antes de escribir.
            approval: {
                approvalField: "custbodyid_firma_rc", // Aprobacion de Formalizacion.
                cancelledField: "custbody43", // Orden caida.
                prerequisiteFields: ["custbody_aprueba_jefe_ventas", "custbodyid_firma_rocca"], // Jefatura de Ventas y Desarrollador.
            },

            // Montos, IDs y banderas: valor crudo.
            bodyValues: {
                ...fieldMap(`
                memo custbody116 custbody_ix_total_amount custbody36 custbody13 custbody22 custbody15
                custbody219 custbody16 custbody35 custbody46 custbody47 custbodyix_salesorder_cashback
                custbody17 custbody18 custbody19 custbody21 custbody71 exchangerate
                custbody_ov_cargos_adicionales custbody132 custbody52 custbody39 custbody185 custbody188
                custbody189 custbody207 custbody191 custbody190 custbody_ix_salesorder_monto_prima
                custbodyix_salesorder_hito1 custbody_ix_salesorder_hito2 custbody_ix_salesorder_hito3
                custbody_ix_salesorder_hito4 custbody_ix_salesorder_hito5 custbody_ix_salesorder_hito6
                custbody_i_amount_hitos custbody211 custbody_total_hitos_amount subtotal taxtotal
                giftcertapplied total custbody90 custbody51 custbody91 custbody105 custbody43 custbody103
                custbody_ix_comision_pagada custbody_entrega_de_llaves custbody274 custbody_cuotas_pagadas custbody209 custbody_mezzanine_verifica
                custbody_aprueba_jefe_ventas custbodyid_firma_rc custbodyid_firma_rocca custbody74 custbody73 custbody37
                custbody141 custbody157
            `),
                initialtranid: "tranid", // Alias que consume el frontend; el campo real es tranid.
            },

            // Fechas y porcentajes: texto, para respetar el formato configurado en NetSuite.
            bodyTexts: {
                ...fieldMap(`
                trandate custbody68 saleseffectivedate custbodytpv_vigencia_garantia custbody114
                custbody140 custbody208 custbody206 custbody14 custbody20 custbody60 custbody62
                custbody63 custbody64 custbody65 custbody66 custbody67
            `),
                currencyname: "currency",
            },
            // Solo eventos: IDs ERP para conciliar relaciones; nunca copiar a PK/FK propias sin resolverlas.
            eventValues: fieldMap("entity custbody38 subsidiary opportunity"),

            // Alias en la raiz de la respuesta que el CRM consume por nombre (listas -> texto visible).
            rootTexts: {
                Expediente: "custbody38",
                UNIDAD: "custbodyix_exp_ligado_num_unid",
                cli: "entity",
                Subsidaria: "subsidiary",
                Departamento: "department",
                Clase: "class",
                Ubi: "location",
                Oportunidad: "opportunity",
                CREADO: "createdfrom",
                vendedor: "salesrep",
                socio: "partner",
                CAMPANA: "leadsource",
                METODO_PAGO: "custbody75",
                FONDOS: "custbody37",
                MOTIVO_CANCE: "custbody115",
            },

            // Sublista "item".
            itemLines: {
                texts: { item_display: "item", custcolfecha_pago_proyectado: "custcolfecha_pago_proyectado" },
                values: fieldMap("quantity description rate amount grossamt"),
            },
        });
    })(fields);

    // Consultas puntuales del importador. El RESTlet delega en salesOrders.get o leads.get.
    const importQueries = ((search, record, responses, validation) => {
        const { fail } = responses;
        const { isValidId } = validation;

        /**
         * Busca el número exacto en las cabeceras de órdenes de venta.
         * mainline=T evita contar las líneas de una misma orden como coincidencias.
         * Dos resultados bastan para detectar un número ambiguo.
         * @param {*} value Número visible recibido en tranid.
         * @returns {object} ID interno y número visible, o un error 400, 404 o 409.
         */
        function findSalesOrderByTranId(value) {
            const tranid = typeof value === "string" ? value.trim() : "";
            if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,59}$/.test(tranid)) {
                return fail(400, "INVALID_TRANID", "Numero de orden invalido.");
            }
            const matches = search
                .create({
                    type: search.Type.SALES_ORDER,
                    filters: [["mainline", "is", "T"], "and", ["tranid", "is", tranid]],
                    columns: ["internalid", "tranid"],
                })
                .run()
                .getRange({ start: 0, end: 2 });
            if (matches.length === 0) return fail(404, "SALES_ORDER_NOT_FOUND", "La orden de venta no existe.");
            if (matches.length > 1)
                return fail(409, "SALES_ORDER_AMBIGUOUS", "El numero corresponde a mas de una orden.");
            return responses.ok({ id: String(matches[0].id), tranid: matches[0].getValue({ name: "tranid" }) });
        }

        /**
         * Normaliza una selección simple sin convertir objetos vacíos a "undefined".
         * Una selección ambigua o inválida no permite elegir otra campaña de respaldo.
         * @param {*} value Valor devuelto por lookupFields.
         * @returns {?object} ID y etiqueta del mismo campo, o marca de formato inválido.
         */
        function customerCampaign(value) {
            const values = Array.isArray(value) ? value : [value];
            if (values.length > 1) return { invalid: true };
            const selected = values[0];
            if (selected === null || selected === undefined || selected === "") return null;
            const rawId = typeof selected === "object" ? selected.value : selected;
            const id =
                typeof rawId === "string"
                    ? rawId.trim()
                    : typeof rawId === "number" && Number.isSafeInteger(rawId)
                      ? String(rawId)
                      : "";
            if (!/^-?[1-9]\d{0,14}$/.test(id)) return { invalid: true };
            return { id, name: typeof selected.text === "string" ? selected.text.trim() || null : null };
        }

        /**
         * Lee solo los campos que Habita usa para conciliar al cliente.
         * Campaña de Marketing es custentity_ix_campanademarketing; leadsource
         * se conserva solo como respaldo cuando el campo personalizado está vacío.
         * @param {object} request Solicitud con el ID interno de NetSuite.
         * @returns {object} Ficha mínima del cliente o error de validación.
         */
        function importCustomer(request) {
            if (!isValidId(request)) return fail(400, "INVALID_ID", "Se requiere el ID interno del cliente.");
            const fields = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: request.id,
                columns: [
                    "firstname",
                    "lastname",
                    "companyname",
                    "email",
                    "phone",
                    "custentity_ix_campanademarketing",
                    "leadsource",
                ],
            });
            const campaign =
                customerCampaign(fields.custentity_ix_campanademarketing) ?? customerCampaign(fields.leadsource);
            if (campaign?.invalid)
                return fail(
                    502,
                    "CUSTOMER_CAMPAIGN_INVALID",
                    "La campaña del cliente no devolvió una selección simple con ID válido.",
                );
            const fullName =
                [fields.firstname, fields.lastname]
                    .map((value) => (typeof value === "string" ? value.trim() : ""))
                    .filter(Boolean)
                    .join(" ") || (typeof fields.companyname === "string" ? fields.companyname.trim() : "");
            return responses.ok({
                id: String(request.id),
                fullName,
                company: fields.companyname || null,
                email: fields.email || null,
                phone: fields.phone || null,
                campaign: campaign?.id ?? null,
                campaignName: campaign?.name ?? null,
            });
        }

        /**
         * Resuelve una relación a partir de su ID interno. Cada tipo permite
         * consultar solo los campos usados para conciliar la relación.
         * @param {object} request Solicitud con id y kind.
         * @returns {object} ID y valor consultado, o error de validación.
         */
        function importRelation(request) {
            if (!isValidId(request)) return fail(400, "INVALID_ID", "Se requiere un ID interno válido.");
            if (request.kind === "subsidiary") {
                const fields = search.lookupFields({ type: search.Type.SUBSIDIARY, id: request.id, columns: ["name"] });
                return responses.ok({ id: String(request.id), value: fields.name || null });
            }
            if (request.kind === "user") {
                const fields = search.lookupFields({ type: search.Type.EMPLOYEE, id: request.id, columns: ["email"] });
                return responses.ok({ id: String(request.id), value: fields.email || null });
            }
            if (request.kind === "unitFile") {
                const unit = record.load({ type: "customrecord_ix_record_exp_unidades", id: request.id });
                // getValue devuelve el ID del proyecto. getText devolvería su etiqueta.
                const projectId = unit.getValue({ fieldId: "custrecord_163_csegix_proyectos" });
                const code = unit.getValue({ fieldId: "name" });
                return responses.ok({
                    id: String(request.id),
                    code: String(code || ""),
                    projectId: String(projectId || ""),
                    projectName: unit.getText({ fieldId: "custrecord_163_csegix_proyectos" }) || null,
                });
            }
            return fail(400, "INVALID_RELATION", "Tipo de relación no permitido.");
        }

        return Object.freeze({ findSalesOrderByTranId, importCustomer, importRelation });
    })(ns5, ns4, responses, validation);

    // Origen: modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta.js
    const salesOrders = ((responses, fields, records, providerErrors, readByIdFlow, runActionFlow, SCHEMA) => {
        "use strict";

        const { fail, ok } = responses;
        const { mapFields, bodyValue, bodyText, readSublist } = fields;
        const { RECORD_TYPES, loadRecord, lookupFlags } = records;
        const { providerError } = providerErrors;
        const { readById } = readByIdFlow;
        const { runAction } = runActionFlow;

        /** Errores de esta entidad (los consume providerError). */
        const ERRORS = Object.freeze({
            notFound: Object.freeze({ code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." }),
            readFailed: Object.freeze({
                code: "SALES_ORDER_READ_ERROR",
                message: "No se pudo consultar la orden de venta.",
            }),
        });

        /** Limita procesamiento y tamano de respuesta, no el costo inicial de record.load. */
        const MAX_ITEM_LINES = 1000;

        const { approvalField, cancelledField, prerequisiteFields } = SCHEMA.approval;
        const FIELDS_TO_CHECK = Object.freeze([cancelledField, ...prerequisiteFields, approvalField]);
        const UNKNOWN_OUTCOME_MESSAGE = "Resultado de aprobacion desconocido; consulta NetSuite antes de reintentar.";
        const STATE_CHANGED_MESSAGE =
            "Las aprobaciones de la orden cambiaron durante la operacion; consulta NetSuite antes de reintentar.";

        /**
         * GET: lee una orden de venta con la allowlist del esquema (1 record.load).
         *
         * @param {string} id ID interno de NetSuite ya validado.
         * @returns {object} 200 con campos y lineas, o 422 si supera el limite de lineas.
         * @throws {SuiteScriptError} Errores del proveedor (p. ej. RCRD_DSNT_EXIST); readById los traduce.
         */
        function getSalesOrderById(id, eventProjection = false) {
            const order = loadRecord(RECORD_TYPES.SALES_ORDER, id);

            // Si excede el limite de lineas se corta antes de construir el resto de la respuesta.
            const items = readSublist(order, "item", SCHEMA.itemLines, MAX_ITEM_LINES);
            if (items === null)
                return fail(422, "ITEM_LINE_LIMIT_EXCEEDED", `La orden supera el limite de ${MAX_ITEM_LINES} lineas.`);

            // Los lectores se crean una sola vez y se reutilizan en cada mapa.
            const readBodyValue = bodyValue(order);
            const readValue = (fieldId) => {
                const value = readBodyValue(fieldId);
                // custbody37 solo acepta vacio, 1 o 2. Otro valor no se manda como vacio: borraria los fondos ya guardados en el CRM.
                if (fieldId === "custbody37" && ![null, "", 1, "1", 2, "2"].includes(value))
                    throw new Error("purchase_funds_unavailable");
                return value;
            };
            const readText = bodyText(order);
            let projection = {};
            if (eventProjection) {
                // DATE representa calendario del record, no un instante UTC ni texto dependiente de preferencias.
                const date = readValue("trandate");
                if (!date || typeof date.getTime !== "function" || !Number.isFinite(date.getTime()))
                    throw new Error("transaction_date_unavailable");
                // El responsable pertenece a Habita: no leer ni enviar empleados para sincronizar una orden.
                // Si el campo no esta en el record, no se envia y el CRM conserva la fecha. Null o vacio la limpia. Una fecha valida usa el calendario local del record, no UTC. Otro valor se omite.
                const deliveryField = "custbody_fecha_unidad_entregada";
                const delivery =
                    typeof order.getFields === "function" && order.getFields().includes(deliveryField)
                        ? readValue(deliveryField)
                        : undefined;
                const deliveryProjection =
                    delivery instanceof Date && Number.isFinite(delivery.getTime())
                        ? {
                              [deliveryField]: [
                                  delivery.getFullYear(),
                                  String(delivery.getMonth() + 1).padStart(2, "0"),
                                  String(delivery.getDate()).padStart(2, "0"),
                              ].join("-"),
                          }
                        : delivery === null || delivery === ""
                          ? { [deliveryField]: null }
                          : {};
                projection = {
                    ...mapFields(SCHEMA.eventValues, readValue),
                    ...deliveryProjection,
                    crm_sync_projection: 1,
                    crm_transaction_date: [
                        date.getFullYear(),
                        String(date.getMonth() + 1).padStart(2, "0"),
                        String(date.getDate()).padStart(2, "0"),
                    ].join("-"),
                };
            }

            return {
                ...ok({
                    type: RECORD_TYPES.SALES_ORDER,
                    id,
                    fields: {
                        ...mapFields(SCHEMA.bodyValues, readValue),
                        ...mapFields(SCHEMA.bodyTexts, readText),
                        ...projection,
                    },
                    sublists: { item: items },
                }),
                MOTIVO_COMPRA: null, // Fuente aun no confirmada por el propietario del proceso.
                ...mapFields(SCHEMA.rootTexts, readText),
            };
        }

        /**
         * PUT approveFormalization: dispara el workflow de aprobacion en Sandbox o Produccion autorizados.
         * El CRM exige formalizacion.orders.approve antes del PUT; NetSuite valida su rol de integracion.
         * Solo una relectura confirmada permite que el CRM guarde la aprobacion en su BD autoritativa.
         * Antes de escribir un error es de lectura (404/502); desde la escritura cualquier fallo es "desconocido"
         * (502) porque el workflow o la relectura pueden fallar despues de ejecutar acciones.
         *
         * @param {string} id ID interno de NetSuite ya validado.
         * @returns {object} 200 aprobada (o ya aprobada), 409 si no cumple reglas, error de lectura previa (404/502),
         *                   502 si el resultado de la escritura no se pudo confirmar.
         */
        function approveFormalization(id) {
            let flags;
            try {
                // lookupFields cuesta 1 unidad; record.load, 10 en transacciones. Con un ID inexistente se espera RCRD_DSNT_EXIST (pendiente de comprobar en Sandbox).
                flags = lookupFlags(RECORD_TYPES.SALES_ORDER, id, FIELDS_TO_CHECK);
            } catch (error) {
                return providerError(error, ERRORS);
            }

            // Comparacion estricta: solo el boolean `true` cuenta como aprobado.
            if (flags[cancelledField] === true) return fail(409, "SALES_ORDER_CANCELLED", "La orden esta caida.");
            // Idempotencia: si ya estaba aprobada no se escribe nada.
            if (flags[approvalField] === true) return approvedResponse(id, true);
            if (!prerequisiteFields.every((field) => flags[field] === true))
                return fail(
                    409,
                    "APPROVAL_PREREQUISITES_REQUIRED",
                    "Se requieren las aprobaciones de Jefatura de Ventas y Desarrollador.",
                );

            return initiateAndConfirm(id);
        }

        /**
         * Dispara el flujo corporativo y relee TODAS las casillas (1 unidad) para confirmar. No hay una operacion
         * condicional, asi que no hay atomicidad: la relectura detecta que otro escritor cambio los requisitos o marco la
         * orden como caida entre la validacion y la escritura, y entonces no se confirma el exito.
         * La confirmacion exige evidencia completa: caida === false y requisitos === true; un valor omitido no basta.
         * Desde aqui un fallo puede haber persistido el cambio.
         */
        function initiateAndConfirm(id) {
            let phase = "initiate";
            try {
                // El workflow corporativo es el único escritor del cheque y de sus acciones asociadas.
                // Sus acciones son de Entrada: iniciar el flujo, no simular un botón de una instancia existente.
                // Nunca reintentar automáticamente: el flujo también envía correos y genera cuotas.
                executeWorkflow(id, { workflowId: "customworkflow219" });
                phase = "verify";
                const confirmed = lookupFlags(RECORD_TYPES.SALES_ORDER, id, FIELDS_TO_CHECK);
                if (confirmed[approvalField] !== true)
                    return fail(502, "FORMALIZATION_APPROVAL_UNCONFIRMED", UNKNOWN_OUTCOME_MESSAGE);
                if (
                    confirmed[cancelledField] !== false ||
                    !prerequisiteFields.every((field) => confirmed[field] === true)
                )
                    return fail(409, "APPROVAL_STATE_CHANGED", STATE_CHANGED_MESSAGE);
                return approvedResponse(id, false);
            } catch (error) {
                // Conservar solo el identificador técnico: mensajes/stack del proveedor pueden contener datos privados.
                const name = error && error.name;
                const providerCode =
                    typeof name === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(name)
                        ? name
                        : "UNCLASSIFIED_PROVIDER_ERROR";
                logging.executionLog("error", "CRM: diagnostico aprobacion workflow", {
                    phase,
                    providerCode,
                    netsuiteId: id,
                    workflowId: "customworkflow219",
                    stateId: "workflowstate2778",
                });
                return fail(502, "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN", UNKNOWN_OUTCOME_MESSAGE);
            }
        }

        /** Un estado explícito usa trigger; initiate conserva exactamente la llamada histórica de aprobación. */
        function executeWorkflow(id, definition) {
            const options = { recordType: RECORD_TYPES.SALES_ORDER, recordId: id, ...definition };
            return definition.stateId ? ns7.trigger(options) : ns7.initiate(options);
        }

        /** La API Habita reserva durablemente la ejecución antes del PUT; aquí nunca se reintenta ni hay fallback. */
        function transferUnit(id) {
            const definition = { workflowId: "customworkflow220", stateId: "workflowstate2780" };
            const required = [cancelledField, approvalField];
            let flags;
            try {
                flags = lookupFlags(RECORD_TYPES.SALES_ORDER, id, required);
            } catch (error) {
                return providerError(error, ERRORS);
            }
            if (flags[cancelledField] !== false || flags[approvalField] !== true)
                return fail(
                    409,
                    "UNIT_TRANSFER_PREREQUISITES_REQUIRED",
                    "La orden debe estar activa y aprobada por Formalizacion.",
                );
            try {
                const instanceId = executeWorkflow(id, definition);
                if (!/^[1-9][0-9]*$/.test(String(instanceId))) throw new Error("unconfirmed_instance");
                const confirmed = lookupFlags(RECORD_TYPES.SALES_ORDER, id, required);
                if (confirmed[cancelledField] !== false || confirmed[approvalField] !== true)
                    return fail(
                        502,
                        "UNIT_TRANSFER_OUTCOME_UNKNOWN",
                        "El flujo no pudo confirmarse; requiere conciliacion.",
                    );
                return ok({
                    type: RECORD_TYPES.SALES_ORDER,
                    id,
                    action: "transferUnit",
                    ...definition,
                    executed: true,
                    instanceId: String(instanceId),
                });
            } catch {
                logging.executionLog("error", "CRM: flujo Unidad traspasada no confirmado", {
                    netsuiteId: id,
                    ...definition,
                });
                return fail(
                    502,
                    "UNIT_TRANSFER_OUTCOME_UNKNOWN",
                    "El flujo no pudo confirmarse; requiere conciliacion.",
                );
            }
        }

        /** Confirmacion que consume NestJS (el CRM exige exactamente esta forma). */
        function approvedResponse(id, alreadyApproved) {
            return ok({
                type: RECORD_TYPES.SALES_ORDER,
                id,
                approval: "formalization",
                approved: true,
                alreadyApproved,
            });
        }

        return Object.freeze({
            // findByTranId e importRelation no cargan la ficha. syncSnapshot pide la foto de evento. Lo demas es la lectura por id.
            get: (request) => {
                if (request?.action === "findByTranId") return importQueries.findSalesOrderByTranId(request.tranid);
                if (request?.action === "importRelation") return importQueries.importRelation(request);
                return readById(
                    request,
                    request?.action === "syncSnapshot"
                        ? (id) => salesOrderEvents.readEventSnapshot(id)
                        : getSalesOrderById,
                    ERRORS,
                );
            },
            put: (request) => runAction(request, { approveFormalization, transferUnit }),
            // Lo consume NotificarCambio para construir el snapshot del evento.
            getSalesOrderById,
            getSalesOrderEventById: (id) => getSalesOrderById(id, true),
        });
    })(responses, fields, records, providerErrors, readByIdFlow, runActionFlow, salesOrderFields);

    // Origen: modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js
    const salesOrderEvents = ((search, format, delivery, salesOrders) => {
        "use strict";

        // Receptor propio de esta entidad. Un modulo nuevo (leads...) declara el suyo, p. ej. "lead-events".
        const ENDPOINT = "order-events";
        const FLAGS = [
            "custbody90",
            "custbody51",
            "custbody91",
            "custbody105",
            "custbody43",
            "custbody103",
            "custbody_ix_comision_pagada",
            "custbody_entrega_de_llaves",
            "custbody274",
            "custbody_cuotas_pagadas",
            "custbody209",
        ];

        /** La fecha es columna de busqueda Transaction, no campo documentado de record.load(SalesOrder). */
        function sourceVersion(id) {
            const values = search.lookupFields({ type: "salesorder", id, columns: ["lastmodifieddate", ...FLAGS] });
            // parse respeta las preferencias del mismo usuario/contexto que produjo el texto; no imponer UTC.
            const date = format.parse({ value: values.lastmodifieddate, type: format.Type.DATETIME });
            if (!date || typeof date.getTime !== "function" || !Number.isFinite(date.getTime()))
                throw new Error("source_version_unavailable");
            if (!FLAGS.every((field) => typeof values[field] === "boolean"))
                throw new Error("source_flags_unavailable");
            return { modifiedAt: date.toISOString(), flags: FLAGS.map((field) => values[field]) };
        }

        /**
         * @param {{recordType: string, netsuiteId: string, eventType: string}} event Evento ya validado.
         * @returns {{status: string, delivered: boolean}} Resultado del envio; nunca lanza.
         */
        function afterSubmit(event) {
            return delivery.sendRecordEvent(event, readEventSnapshot, ENDPOINT);
        }

        /**
         * El GET entrega las lineas como { "line 1": {...} } (contrato del CRM) pero el receptor de eventos espera
         * un arreglo; solo el envio adapta la forma, el GET conserva la suya.
         *
         * @param {string} id ID interno ya validado.
         * @returns {object} Snapshot con `sublists.item` como arreglo, o la respuesta de error del GET sin cambios.
         * @throws {SuiteScriptError} Errores del proveedor; EnviarEvento los convierte en delivery_failed.
         */
        function readEventSnapshot(id) {
            const snapshotReadStartedAt = new Date().toISOString();
            const before = sourceVersion(id);
            const snapshot = salesOrders.getSalesOrderEventById(id);
            if (snapshot.status !== 200) return snapshot;
            // La marca del proveedor pierde segundos en esta cuenta: cotejar tambien todos los valores y lineas.
            const confirmed = salesOrders.getSalesOrderEventById(id);
            const after = sourceVersion(id);
            const snapshotFlags = FLAGS.map((field) => snapshot.data.fields[field]);
            if (
                JSON.stringify(snapshot) !== JSON.stringify(confirmed) ||
                before.modifiedAt !== after.modifiedAt ||
                JSON.stringify(before.flags) !== JSON.stringify(after.flags) ||
                JSON.stringify(snapshotFlags) !== JSON.stringify(after.flags)
            )
                throw new Error("snapshot_changed");
            const { sublists } = snapshot.data;
            return {
                ...snapshot,
                sourceModifiedAt: after.modifiedAt,
                snapshotReadStartedAt,
                snapshotReadCompletedAt: new Date().toISOString(),
                data: { ...snapshot.data, sublists: { ...sublists, item: Object.values(sublists.item) } },
            };
        }

        return Object.freeze({ afterSubmit, readEventSnapshot });
    })(ns5, ns6, delivery, salesOrders);

    // Origen: modules/02_leads/SS2_1_LIB_CRM_Leads.js
    const leads = ((responses) => {
        "use strict";

        const { notImplemented } = responses;

        // Solo importCustomer esta activo. Cualquier otra lectura o escritura responde 501.
        return Object.freeze({
            get: (request) =>
                request?.action === "importCustomer" ? importQueries.importCustomer(request) : notImplemented(),
            put: notImplemented,
        });
    })(responses);

    // Origen: modules/03_estimates/SS2_1_LIB_CRM_Estimaciones.js
    const estimates = ((responses) => {
        "use strict";

        const { notImplemented } = responses;

        // Estimaciones siguen reservadas: lectura y escritura responden 501.
        return Object.freeze({ get: notImplemented, put: notImplemented });
    })(responses);

    return Object.freeze({
        fields,
        responses,
        validation,
        providerErrors,
        readByIdFlow,
        runActionFlow,
        environment,
        delivery,
        logging,
        events,
        records,
        salesOrderFields,
        salesOrders,
        salesOrderEvents,
        leads,
        estimates,
    });
});
