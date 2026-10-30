/**
 * Registro de ejecucion en NetSuite. Nunca recibe solicitudes, respuestas ni errores crudos.
 *
 * @NApiVersion 2.1
 */
define(["N/log"], (log) => {
    "use strict";

    // Actualizar al preparar una nueva entrega del conjunto de scripts.
    const SCRIPT_VERSION = "2026.10.28.5";

    /** Un fallo del logger no debe interrumpir una consulta ni cambiar su respuesta. */
    function executionLog(level, title, details) {
        try {
            log[level]({ title, details: { ...details, scriptVersion: SCRIPT_VERSION } });
        } catch {
            // No recurrir a otro logger: evitamos fallos en cadena y duplicar registros.
        }
    }

    return Object.freeze({ executionLog });
});
