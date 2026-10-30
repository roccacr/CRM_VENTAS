/**
 * Entrada global de eventos guardados del CRM. Solo enruta; la logica vive en lib y en cada modulo.
 * No hace: no modifica registros ni crea una cola. El API confirma recepcion sin persistencia; no hay reintentos.
 * Archivador: /SuiteScripts/SS2_1_UE_CRM_CambiosRegistros.js
 * Crear un despliegue por tipo de registro. Las ordenes envian su snapshot a desarrollo local solo en Sandbox.
 *
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define([
    "/SuiteScripts/CRM TINK/lib/SS2_1_LIB_CRM_Eventos",
    "/SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio",
    "/SuiteScripts/CRM TINK/modules/02_leads/SS2_1_LIB_CRM_Leads",
    "/SuiteScripts/CRM TINK/modules/03_estimates/SS2_1_LIB_CRM_Estimaciones",
], (events, salesOrders, leads, estimates) => {
    "use strict";

    // Registro cerrado. Los modulos reservados no se presentan como sincronizados.
    const MODULES = Object.freeze({
        salesorder: { code: "salesOrders", afterSubmit: salesOrders.afterSubmit },
        lead: { code: "leads", afterSubmit: leads.afterSubmit },
        estimate: { code: "estimates", afterSubmit: estimates.afterSubmit },
        // Partner no acredita todavia el tipo real del catalogo de corredores de esta cuenta.
        partner: { code: "brokers" },
    });

    /**
     * Se ejecuta despues de guardar el registro. Nunca lanza: un fallo de observacion no debe romper el guardado.
     * @param {{type: string, newRecord: {type: string, id: *}}} context Contexto de NetSuite.
     * @returns {void}
     */
    function afterSubmit(context) {
        events.afterSubmit(context, MODULES);
    }

    return { afterSubmit };
});
