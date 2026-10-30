/**
 * Validacion y despacho compartidos de afterSubmit. Nunca lanza: un fallo posterior al guardado
 * no debe llegar al usuario que guardo el registro.
 * No hace: no lee ni escribe datos comerciales, ni conoce el transporte; cada modulo aporta su afterSubmit.
 * Archivador: /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Eventos.js
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["./SS2_1_LIB_CRM_Entorno", "./SS2_1_LIB_CRM_Validacion", "./SS2_1_LIB_CRM_Logs"], (
    environment,
    validation,
    logging,
) => {
    "use strict";

    const { isAuthorizedSandbox } = environment;
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
            if (!isAuthorizedSandbox()) return;
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
});
