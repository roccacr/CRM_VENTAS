/**
 * Cuerpos 503 que el cliente puede recibir. Estan congelados: quien los lanza
 * no puede agregar campos, y un consumidor no puede mutar el objeto compartido
 * y cambiar el contrato de la peticion siguiente.
 *
 * El filtro global solo deja salir estas constantes. Cualquier otro 503, aunque
 * traiga mensaje o un codigo parecido, se sustituye por el cuerpo generico. Los
 * hooks de Fastify que responden antes de Nest no pasan por ese filtro y tienen
 * que importar la misma constante, no reescribir el JSON.
 */

/**
 * Indisponibilidad sin diagnostico. Lo usan el readiness, el filtro de
 * excepciones y las respuestas tempranas del BFF. No dice si fallo MySQL, un
 * proveedor o el pool: el cuerpo no sirve para reconocer la dependencia.
 */
export const SERVICE_UNAVAILABLE_RESPONSE = Object.freeze({ statusCode: 503, error: "Service Unavailable", message: "Servicio no disponible." });

/**
 * Reconciliacion de una aprobacion ya confirmada en NetSuite.
 *
 * El ERP no entra en la transaccion de MySQL. Si NetSuite confirmo y el commit
 * local no cerro, el cliente debe repetir la misma operacion: el reintento
 * reconoce la confirmacion y termina la persistencia. No es una indisponibilidad
 * generica ni una autorizacion para iniciar otra aprobacion.
 *
 * El selector publico es `code`. El filtro compara ese valor exacto y responde
 * este objeto, nunca el cuerpo lanzado. El mensaje no lleva id de orden, id de
 * NetSuite ni la causa del fallo local.
 */
export const FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE = Object.freeze({
    statusCode: 503,
    error: "Service Unavailable",
    code: "FORMALIZATION_APPROVAL_RECONCILIATION_REQUIRED",
    message: "NetSuite confirmó la aprobación, pero falta sincronizar el CRM. Reintenta la misma operación.",
});
