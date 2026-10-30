/**
 * Validacion y despacho compartidos de afterSubmit. No lee ni escribe datos comerciales.
 * Archivador: /SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Eventos.js
 * @NApiVersion 2.1
 */
define(["N/runtime", "./SS2_1_LIB_CRM_Validacion", "./SS2_1_LIB_CRM_Logs"], (runtime, validation, logging) => {
    "use strict";

    // Delete requiere su propio contrato; nunca intentar cargar un registro ya eliminado.
    const savedEvents = new Set(["create", "edit", "xedit", "approve", "cancel", "reject"]);

    /** Un fallo de observacion posterior al guardado no debe lanzar un error al usuario. */
    function afterSubmit(context, modules) {
        if (runtime.accountId !== "4552704_SB1" || runtime.envType !== runtime.EnvType.SANDBOX) return;
        try {
            const record = context?.newRecord;
            if (!record || !savedEvents.has(context.type) || !Object.hasOwn(modules, record.type)) return;
            const id = String(record.id ?? "");
            if (!validation.isValidId({ id })) return;
            const module = modules[record.type];
            const event = { recordType: record.type, netsuiteId: id, eventType: context.type };
            const result =
                typeof module.afterSubmit === "function"
                    ? module.afterSubmit(event)
                    : { status: "module_pending", delivered: false };
            // Solo metadatos cerrados: no loguear el record, datos personales, credenciales ni errores crudos.
            logging.executionLog(
                result.delivered || result.status === "module_pending" ? "debug" : "error",
                "CRM_v2: registro guardado",
                {
                    ...event,
                    module: module.code,
                    status: result.status,
                    delivered: result.delivered === true,
                    userEventVersion: "2026.10.30.2",
                },
            );
        } catch {
            logging.executionLog("error", "CRM_v2: evento no procesado", {
                code: "USER_EVENT_FAILED",
                delivered: false,
                userEventVersion: "2026.10.30.2",
            });
        }
    }

    return Object.freeze({ afterSubmit });
});
