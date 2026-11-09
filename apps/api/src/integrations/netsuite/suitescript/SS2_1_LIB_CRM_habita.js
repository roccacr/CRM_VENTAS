/**
 * CRM TINK LIB - Consolidacion de los 16 modulos originales.
 * API publica: espacios de nombres; ver CRM TINK LIB - Guia.md.
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

        function isAuthorizedEnvironment() {
            const configuredAccount = runtime.getCurrentScript().getParameter({ name: ACCOUNT_PARAMETER });
            // Temporary defaults by environment; a configured deployment value always takes precedence.
            const missingAccount =
                configuredAccount === null || configuredAccount === undefined || configuredAccount === "";
            const environmentName = getEnvironmentName();
            const parameter =
                missingAccount && environmentName !== null ? DEFAULT_ACCOUNTS[environmentName] : configuredAccount;
            // Integer deployment parameters are valid too; never coerce arbitrary objects/booleans.
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

        // Configurar cuenta autorizada, URL base y API Secret en cada deployment.
        const URL_PARAMETER = "custscript_crm_event_url";
        const SECRET_PARAMETER = "custscript_crm_event_secret_id";
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
                // URL y secreto administrados en el deployment, nunca tomados del registro o del usuario.
                const url = resolveUrl(endpoint);
                if (url === null) return blocked("destination_blocked");
                const secretId = runtime.getCurrentScript().getParameter({ name: SECRET_PARAMETER });
                if (typeof secretId !== "string" || !SECRET_ID_PATTERN.test(secretId))
                    return blocked("configuration_missing");
                const authorization = https.createSecureString({ input: "Bearer {" + secretId + "}" });
                return deliverObservation(url, authorization, event, readSnapshot);
            } catch (error) {
                // El guardado ya ocurrio; no lanzar ni fingir que se reintentara automaticamente.
                const safe =
                    error &&
                    ["source_version_unavailable", "source_flags_unavailable", "snapshot_changed"].includes(
                        error.message,
                    );
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

        /** URL final = URL base administrada + endpoint del modulo; null si algo no es valido. */
        function resolveUrl(endpoint) {
            if (typeof endpoint !== "string" || !ENDPOINT_NAME.test(endpoint)) return null;
            const configured = runtime.getCurrentScript().getParameter({ name: URL_PARAMETER });
            if (typeof configured !== "string" || !ALLOWED_BASE_URL.test(configured)) return null;
            return configured.replace(/\/+$/, "") + "/" + endpoint;
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
    })(ns1, ns0, ns2, environment);

    // Origen: lib/SS2_1_LIB_CRM_Logs.js
    const logging = ((log) => {
        "use strict";

        // Version unica del conjunto de scripts. Actualizar al preparar cada entrega: la lee el empaquetador.
        const SCRIPT_VERSION = "2026.11.03.7";

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

        /** Solo metadatos cerrados: no loguear el record, datos personales, credenciales ni errores crudos. */
        function logOutcome(moduleCode, event, result) {
            const level = result.delivered || result.status === "module_pending" ? "debug" : "error";
            executionLog(level, "CRM_v2: registro guardado", {
                ...event,
                module: moduleCode,
                status: result.status,
                delivered: result.delivered === true,
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
                custbody_ix_comision_pagada custbody_entrega_de_llaves custbody274 custbody_cuotas_pagadas custbody_mezzanine_verifica
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
            eventOwner: { sublist: "salesteam", field: "employee" },

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
                // An unreadable field must not become an explicit empty value and erase CRM funds.
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
                // El legado usa el primer integrante de salesteam; salesrep no es su fuente de id_ov_admin.
                const team = SCHEMA.eventOwner;
                const owner =
                    order.getSublists().includes(team.sublist) && order.getLineCount({ sublistId: team.sublist }) > 0
                        ? order.getSublistValue({ sublistId: team.sublist, fieldId: team.field, line: 0 })
                        : null;
                projection = {
                    ...mapFields(SCHEMA.eventValues, readValue),
                    crm_owner_employee: owner === null ? null : String(owner),
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
                ns7.initiate({
                    recordType: RECORD_TYPES.SALES_ORDER,
                    recordId: id,
                    workflowId: "customworkflow219",
                });
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
            get: (request) =>
                readById(
                    request,
                    request?.action === "syncSnapshot"
                        ? (id) => salesOrderEvents.readEventSnapshot(id)
                        : getSalesOrderById,
                    ERRORS,
                ),
            put: (request) => runAction(request, { approveFormalization }),
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

        return Object.freeze({ get: notImplemented, put: notImplemented });
    })(responses);

    // Origen: modules/03_estimates/SS2_1_LIB_CRM_Estimaciones.js
    const estimates = ((responses) => {
        "use strict";

        const { notImplemented } = responses;

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
