/**
 * Registro de ejecucion en NetSuite con N/log.
 * No hace: nunca recibe solicitudes, respuestas ni errores crudos; quien llama pasa solo metadatos.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["N/log"], (log) => {
    "use strict";

    // Version unica del conjunto de scripts. Actualizar al preparar cada entrega: la lee el empaquetador.
    const SCRIPT_VERSION = "2026.10.30.4";

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
});
