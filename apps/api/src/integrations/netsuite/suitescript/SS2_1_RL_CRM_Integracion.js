/**
 * CRM_v2 - RESTlet de integracion entre el CRM, su API y NetSuite.
 * Es SOLO el punto de entrada: valida entorno, elige el modulo y registra el resultado.
 * No hace: no contiene logica de negocio ni lee/escribe records (eso vive en lib/ y modules/).
 *
 * Contrato:
 *   GET ?module=salesOrders&id=123  -> lee una orden de venta (allowlist de campos)
 *   PUT { module: 'salesOrders', action: 'approveFormalization', id } -> aprueba Formalizacion
 *
 * Las respuestas incluyen un status de aplicacion. El CRM debe comprobar tambien el HTTP:
 * NetSuite puede rechazar la peticion antes de ejecutar el script. Una excepcion inesperada nunca escapa:
 * se responde { status: 500, error: { code: "UNEXPECTED_ERROR" } }.
 *
 * Seguridad que este conjunto de archivos garantiza:
 *   1. Solo corre en la Sandbox autorizada.
 *   2. Solo despacha modulos registrados (nada de eval / imports dinamicos).
 *   3. Solo expone campos de la allowlist y siempre como escalares.
 *   4. Nunca registra ni devuelve el mensaje de error del proveedor (puede traer datos personales).
 *
 * Despliegue: el mapa de archivos y los pasos de carga estan en README.md. Las dependencias usan rutas
 * absolutas porque esta entrada vive en /SuiteScripts/ y el resto en /SuiteScripts/CRM TINK/.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define([
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Entorno",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Respuestas",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Validacion",
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Logs",
    "/SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta",
    "/SuiteScripts/CRM TINK/modules/02_leads/SS2_1_LIB_CRM_Leads",
    "/SuiteScripts/CRM TINK/modules/03_estimates/SS2_1_LIB_CRM_Estimaciones",
], (environment, responses, validation, logging, salesOrders, leads, estimates) => {
    "use strict";

    const { SANDBOX_ACCOUNT, isAuthorizedSandbox } = environment;
    const { fail, notImplemented } = responses;
    const { hasOwn, isValidId } = validation;
    const { executionLog } = logging;

    /** Registro cerrado de modulos: solo estos nombres pueden despacharse. */
    const MODULES = Object.freeze({ salesOrders, leads, estimates });

    /** "a, b o c" a partir del registro, para que agregar un modulo no obligue a editar el mensaje. */
    const MODULE_NAMES = Object.keys(MODULES)
        .join(", ")
        .replace(/, ([^,]*)$/, " o $1");

    /**
     * Metodos que NetSuite invoca. Siempre devuelven una respuesta de aplicacion; nunca lanzan.
     * @param {object} [request] GET: parametros de la URL. PUT: cuerpo JSON ya parseado.
     * @returns {{status: number, data?: object, error?: {code: string, message: string}}}
     */
    function get(request) {
        return execute("get", request);
    }

    /** @see get */
    function put(request) {
        return execute("put", request);
    }

    /** Despacha y emite UNA entrada de log; una excepcion inesperada se vuelve 500 JSON. */
    function execute(method, request) {
        const startedAt = Date.now();
        let context = { module: "invalid", action: method };
        try {
            context = buildLogContext(method, request);
            const response = dispatch(method, request);
            logResult(context, response, startedAt);
            return response;
        } catch {
            executionLog("error", "CRM_v2_bad_flow: resultado", {
                ...context,
                status: 500,
                code: "UNEXPECTED_ERROR",
                durationMs: Date.now() - startedAt,
            });
            return fail(500, "UNEXPECTED_ERROR", "Error inesperado al procesar la solicitud.");
        }
    }

    /** Valida entorno y modulo, y delega en el metodo (get/put) del modulo. */
    function dispatch(method, request) {
        // 1. Candado de entorno: evita que el script responda si se despliega en produccion por error.
        if (!isAuthorizedSandbox()) {
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

    /** Devuelve el nombre del modulo solicitado solo si la peticion es un objeto y el modulo existe. */
    function requestedModule(request) {
        const isRequestObject = request !== null && typeof request === "object" && !Array.isArray(request);
        const moduleName = isRequestObject && hasOwn(request, "module") ? request.module : undefined;
        return typeof moduleName === "string" && hasOwn(MODULES, moduleName) ? moduleName : undefined;
    }

    /** Solo modulos registrados y con ID validado: nunca se registra texto libre de la solicitud. */
    function buildLogContext(method, request) {
        const moduleName = requestedModule(request) ?? "invalid";
        const context = { module: moduleName, action: method };
        if (moduleName !== "invalid" && isValidId(request)) context.netsuiteId = request.id;
        return context;
    }

    /** Diagnostico sin solicitudes, respuestas ni errores crudos del proveedor. */
    function logResult(context, response, startedAt) {
        const details = { ...context, status: response.status, durationMs: Date.now() - startedAt };
        if (response.error) details.code = response.error.code;
        executionLog(response.status >= 500 ? "error" : "debug", "CRM_v2_good_flow: resultado", details);
    }

    return { get, put };
});
