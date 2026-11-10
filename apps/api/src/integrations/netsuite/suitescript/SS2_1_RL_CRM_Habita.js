/**
 * Versión: 2026.11.10.3 — Delegación de consultas de importación a la librería.
 *
 * RESTlet que usa la API de Habita para consultar registros de NetSuite y
 * solicitar la aprobación de Formalización de una orden. Este archivo es la
 * entrada del deployment. No escribe en la base de Habita ni administra su cola.
 *
 * Cómo está organizado
 *   1. NetSuite llama a get() o put().
 *   2. execute() mide la duración, llama al despachador y registra el resultado.
 *   3. dispatch() verifica cuenta y entorno, valida el módulo y elige la acción.
 *   4. La librería valida los parámetros de cada acción y ejecuta la operación.
 *
 * Operaciones que usa Habita
 *   GET  module=salesOrders&id=123
 *        Devuelve la ficha de la orden por su ID interno.
 *   GET  module=salesOrders&action=syncSnapshot&id=123
 *        Devuelve la captura que usa la API para sincronizar la orden.
 *   GET  module=salesOrders&action=findByTranId&tranid=BC448
 *        Convierte el número visible de la orden en su ID interno.
 *   GET  module=leads&action=importCustomer&id=2034401
 *        Lee los campos permitidos de un cliente por su ID interno.
 *   GET  module=salesOrders&action=importRelation&kind=subsidiary&id=13
 *        Lee el nombre de la subsidiaria. Con kind=user lee el correo del empleado.
 *   PUT  {"module":"salesOrders","action":"approveFormalization","id":"123"}
 *        Delega la aprobación de Formalización a la librería.
 *
 * Contrato de respuesta y diagnóstico
 *   Revisar el estado HTTP y el campo status del JSON. NetSuite puede rechazar
 *   la solicitud antes de ejecutar este archivo. Cuando falla una operación
 *   dentro del RESTlet, error.code permite distinguir el motivo. Si falla de
 *   forma inesperada, execute() devuelve UNEXPECTED_ERROR con status 500.
 *   Los logs contienen método, módulo, ID interno validado si lo hay, estado,
 *   duración y código de error cuando corresponde. No incluyen el contenido
 *   de la solicitud, datos del cliente ni el mensaje crudo de NetSuite.
 *
 * Cómo ampliar el archivo
 *   Si se añade un módulo, registrarlo en MODULES. Las acciones se implementan
 *   en el módulo correspondiente de la librería, donde también se validan sus
 *   parámetros y se definen los campos permitidos.
 *   Actualizar el contrato de arriba y las pruebas de netsuite-restlet.spec.ts.
 *
 * Dependencias del deployment
 *   /SuiteScripts/SS2_1_LIB_CRM_habita.js aporta validaciones, respuestas, logs
 *   y módulos, incluidas las consultas puntuales de importación.
 *
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */
define(["/SuiteScripts/SS2_1_LIB_CRM_habita"], (crm) => {
    "use strict";

    const { environment, responses, validation, logging, salesOrders, leads, estimates } = crm;
    const { fail, notImplemented } = responses;
    const { hasOwn, isValidId } = validation;
    const { executionLog } = logging;

    /** Registro cerrado de módulos. Estar aquí no implica que todas sus
     * operaciones estén implementadas. La librería define sus respuestas. */
    const MODULES = Object.freeze({ salesOrders, leads, estimates });

    /** Construye el listado para INVALID_MODULE a partir del mismo registro que valida la solicitud. */
    const MODULE_NAMES = Object.keys(MODULES)
        .join(", ")
        .replace(/, ([^,]*)$/, " o $1");

    /**
     * Entrada de lectura que invoca NetSuite.
     * @param {object} [request] Parámetros de la URL ya interpretados por NetSuite.
     * @returns {{status: number, data?: object, error?: {code: string, message: string}}}
     */
    function get(request) {
        return execute("get", request);
    }

    /**
     * Entrada de actualización que invoca NetSuite.
     * @param {object} [request] Cuerpo JSON ya interpretado por NetSuite.
     * @returns {{status: number, data?: object, error?: {code: string, message: string}}}
     */
    function put(request) {
        return execute("put", request);
    }

    /**
     * Ejecuta la solicitud y registra su resultado sin propagar el error original.
     * @param {"get" | "put"} method Método de entrada.
     * @param {*} request Datos recibidos de NetSuite, todavía sin validar.
     * @returns {object} Respuesta de aplicación. Un fallo inesperado devuelve status 500.
     */
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

    /**
     * Aplica los controles en orden. Primero autoriza el deployment, luego
     * valida el módulo y, por último, selecciona la operación.
     * @param {"get" | "put"} method Método de entrada.
     * @param {*} request Parámetros o cuerpo sin validar.
     * @returns {object} Respuesta de la consulta local o del módulo de la librería.
     */
    function dispatch(method, request) {
        // 1. Candado de cuenta y entorno, configurados por deployment.
        if (!environment.isAuthorizedEnvironment()) {
            return fail(
                403,
                "ENVIRONMENT_NOT_AUTHORIZED",
                "El deployment no esta autorizado para esta cuenta o entorno.",
            );
        }

        // 2. Sin solicitud: se conserva la respuesta historica (501).
        if (request === undefined) return notImplemented();

        // 3. Solo objetos (no null ni arreglos) con un "module" propio y registrado.
        const moduleName = requestedModule(request);
        if (moduleName === undefined)
            return fail(400, "INVALID_MODULE", `Selecciona un modulo valido: ${MODULE_NAMES}.`);

        return MODULES[moduleName][method](request);
    }

    /**
     * Acepta únicamente un módulo registrado que sea propiedad del objeto recibido.
     * @param {*} request Entrada sin validar.
     * @returns {string | undefined} Nombre permitido o undefined si no es válido.
     */
    function requestedModule(request) {
        const isRequestObject = request !== null && typeof request === "object" && !Array.isArray(request);
        const moduleName = isRequestObject && hasOwn(request, "module") ? request.module : undefined;
        return typeof moduleName === "string" && hasOwn(MODULES, moduleName) ? moduleName : undefined;
    }

    /**
     * Construye metadatos seguros antes de ejecutar una operación.
     * action registra el método de entrada, no el valor libre de request.action.
     * @param {"get" | "put"} method Método de entrada.
     * @param {*} request Solicitud sin validar.
     * @returns {object} Módulo, método e ID interno si pasa la validación.
     */
    function buildLogContext(method, request) {
        const moduleName = requestedModule(request) ?? "invalid";
        const context = { module: moduleName, action: method };
        if (moduleName !== "invalid" && isValidId(request)) context.netsuiteId = request.id;
        return context;
    }

    /**
     * Registra el resultado esperado. Los estados de aplicación 500 o superiores
     * se marcan como error. Los demás se registran a nivel debug.
     * @param {object} context Metadatos seguros de buildLogContext().
     * @param {object} response Respuesta de aplicación.
     * @param {number} startedAt Instante de inicio en milisegundos.
     */
    function logResult(context, response, startedAt) {
        const details = { ...context, status: response.status, durationMs: Date.now() - startedAt };
        if (response.error) details.code = response.error.code;
        executionLog(response.status >= 500 ? "error" : "debug", "CRM_v2_good_flow: resultado", details);
    }

    return { get, put };
});
