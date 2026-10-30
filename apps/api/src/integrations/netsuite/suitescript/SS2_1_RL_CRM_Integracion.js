/**
 * CRM_v2 - RESTlet de integracion entre el CRM, su API y NetSuite.
 * Este archivo es SOLO el punto de entrada: valida entorno, elige el modulo y registra el resultado.
 *
 * Contrato:
 *   GET ?module=salesOrders&id=123  -> lee una orden de venta (allowlist de campos)
 *   PUT { module: 'salesOrders', action: 'approveFormalization', id } -> aprueba Formalizacion
 *
 * Las respuestas devueltas por este script incluyen un status de aplicacion.
 * El CRM debe comprobar tambien el HTTP: NetSuite puede rechazar la peticion antes de ejecutarlo.
 *
 * Reglas de seguridad que este conjunto de archivos garantiza:
 *   1. Solo corre en la Sandbox autorizada.
 *   2. Solo despacha modulos registrados (nada de eval / imports dinamicos).
 *   3. Solo expone campos de la allowlist y siempre como escalares.
 *   4. Nunca registra ni devuelve el mensaje de error del proveedor (puede traer datos personales).
 *
 * Mapa de archivos en el Archivador de NetSuite (rutas absolutas, no rutas locales).
 * Acceso: Documentos > Archivos > Archivador > SuiteScripts.
 * RL identifica la entrada RESTlet; LIB identifica modulos de apoyo SuiteScript 2.1.
 *
 *   /SuiteScripts/SS2_1_RL_CRM_Integracion.js
 *     Entrada del RESTlet: Sandbox, enrutamiento y log final.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Respuestas.js
 *     Respuestas comunes: ok, fail y notImplemented.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Validacion.js
 *     Validacion de propiedades propias e ID.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Campos.js
 *     Mapeo de campos y sublistas a JSON escalar.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Registros.js
 *     Acceso a N/record y N/search durante las acciones.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_ErroresProveedor.js
 *     Traduccion de errores de NetSuite a respuestas saneadas.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_ConsultarPorId.js
 *     Flujo comun de GET por ID.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_EjecutarAccion.js
 *     Flujo comun de PUT por accion.
 *   /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Logs.js
 *     Registro de ejecucion con N/log.
 *   /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta.js
 *     Ensambla las acciones de ordenes de venta.
 *   /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_Campos.js
 *     Esquema de campos de lectura de ordenes de venta.
 *   /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_Errores.js
 *     Errores de lectura de ordenes de venta.
 *   /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_ConsultarPorId.js
 *     GET: consultar orden de venta por ID.
 *   /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_AprobarFormalizacion.js
 *     PUT: aprobar Formalizacion.
 *   /SuiteScripts/CRM TINK/modules/02_leads/SS2_1_LIB_CRM_Leads.js
 *     Modulo de leads reservado (501).
 *   /SuiteScripts/CRM TINK/modules/03_estimates/SS2_1_LIB_CRM_Estimaciones.js
 *     Modulo de estimaciones reservado (501).
 *
 * Recorrido de una consulta:  GET -> execute -> dispatch -> modulo.get -> readById -> lectura -> JSON.
 * Recorrido de una accion:    PUT -> execute -> dispatch -> modulo.put -> runAction -> aprobacion -> JSON.
 *
 * Despliegue: vincular esta entrada al RESTlet y subir lib/ y modules/ a /SuiteScripts/CRM TINK/.
 * La entrada puede permanecer en /SuiteScripts/: sus dependencias usan rutas absolutas.
 * Conservar las subcarpetas; actualizar acciones existentes no requiere modificar esta entrada.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define([
    "N/runtime",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Respuestas",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Validacion",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Logs",
    "/SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta",
    "/SuiteScripts/CRM TINK/modules/02_leads/SS2_1_LIB_CRM_Leads",
    "/SuiteScripts/CRM TINK/modules/03_estimates/SS2_1_LIB_CRM_Estimaciones",
], (runtime, responses, validation, logging, salesOrders, leads, estimates) => {
    "use strict";

    const { fail, notImplemented } = responses;
    const { hasOwn, isValidId } = validation;
    const { executionLog } = logging;

    /** Unica cuenta donde este script puede responder. */
    const SANDBOX_ACCOUNT = "4552704_SB1";

    /** Registro cerrado de modulos: solo estos nombres pueden despacharse. */
    const MODULES = Object.freeze({ salesOrders, leads, estimates });

    /** "a, b o c" a partir del registro, para que agregar un modulo no obligue a editar el mensaje. */
    const MODULE_NAMES = Object.keys(MODULES)
        .join(", ")
        .replace(/, ([^,]*)$/, " o $1");

    /** Devuelve el nombre del modulo solicitado solo si la peticion es un objeto y el modulo existe. */
    function requestedModule(request) {
        const isRequestObject = request !== null && typeof request === "object" && !Array.isArray(request);
        const moduleName = isRequestObject && hasOwn(request, "module") ? request.module : undefined;
        return typeof moduleName === "string" && hasOwn(MODULES, moduleName) ? moduleName : undefined;
    }

    /** Valida entorno y modulo, y delega en el metodo (get/put) del modulo. */
    function dispatch(method, request) {
        // 1. Candado de entorno: evita que el script responda si se despliega en produccion por error.
        if (runtime.accountId !== SANDBOX_ACCOUNT || runtime.envType !== runtime.EnvType.SANDBOX) {
            return fail(403, "SANDBOX_REQUIRED", `Disponible solamente en Sandbox ${SANDBOX_ACCOUNT}.`);
        }

        // 2. Sin solicitud: se conserva la respuesta historica (501).
        if (request === undefined) return notImplemented();

        // 3. Solo objetos (no null ni arreglos) con un "module" propio y registrado.
        const moduleName = requestedModule(request);
        if (moduleName === undefined)
            return fail(400, "INVALID_MODULE", `Selecciona un modulo valido: ${MODULE_NAMES}.`);

        return MODULES[moduleName][method](request);
    }

    /** Diagnostico en NetSuite sin solicitudes, respuestas ni errores crudos del proveedor. Emite una sola entrada. */
    function execute(method, request) {
        const startedAt = Date.now();
        const moduleName = requestedModule(request) ?? "invalid";
        const context = { module: moduleName, action: method };
        // Solo modulos registrados y con ID validado: nunca se registra texto libre de la solicitud.
        if (moduleName !== "invalid" && isValidId(request)) context.netsuiteId = request.id;
        try {
            const response = dispatch(method, request);
            const details = { ...context, status: response.status, durationMs: Date.now() - startedAt };
            if (response.error) details.code = response.error.code;
            executionLog(response.status >= 500 ? "error" : "debug", "CRM_v2_good_flow: resultado", details);
            return response;
        } catch (error) {
            executionLog("error", "CRM_v2_bad_flow: resultado", {
                ...context,
                status: 500,
                code: "UNEXPECTED_ERROR",
                durationMs: Date.now() - startedAt,
            });
            throw error;
        }
    }

    return {
        get: (request) => execute("get", request), // NetSuite entrega los parametros de la URL
        put: (request) => execute("put", request), // NetSuite entrega el cuerpo JSON ya parseado
    };
});
