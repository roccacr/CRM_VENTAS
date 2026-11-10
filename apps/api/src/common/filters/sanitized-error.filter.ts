import { randomUUID } from "node:crypto";

import { type ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { FastifyReply } from "fastify";

import { FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE, SERVICE_UNAVAILABLE_RESPONSE } from "../http-error.responses.js";

/**
 * Filtro global de excepciones HTTP, registrado en `configureHttpApp`.
 *
 * Separa dos contratos que no se pueden mezclar:
 * - 4xx: el dominio ya publico un cuerpo deliberado (validacion, autorizacion,
 *   conflicto). Se delega a Nest para no romper clientes ni pruebas.
 * - 5xx: el cuerpo y el log se reconstruyen aqui. El cliente no recibe mensaje,
 *   SQL, stack ni la excepcion original: eso filtra esquema, datos de negocio
 *   y rutas internas.
 *
 * El `correlation_id` lo emite el servidor. Copiar un id enviado por el cliente
 * permitiria envenenar la correlacion de logs. La cabecera `x-correlation-id`
 * es la unica referencia que el cliente puede citar en soporte.
 *
 * Los hooks de Fastify que responden antes de entrar a Nest no pasan por este
 * filtro y deben reutilizar las mismas constantes de `http-error.responses`.
 */

/**
 * Lista cerrada de codigos de Node y del driver MySQL que se pueden registrar.
 * Cualquier otro `error.code` colapsa a `unclassified`: el codigo crudo del
 * motor puede contener SQL o estado interno, y el log no es un canal seguro
 * para eso.
 */
const SAFE_DIAGNOSTIC_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "PROTOCOL_CONNECTION_LOST", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE", "ER_PARSE_ERROR", "ER_CON_COUNT_ERROR", "ER_DUP_ENTRY"]);

/**
 * Categoria tecnica para el log, nunca el error serializado.
 *
 * Lee `cause` cuando el fallo viene envuelto: los adapters ocultan el error
 * del driver y el codigo vive en la causa, no en el wrapper. `code` no forma
 * parte del tipo `Error`; se lee por reflexion y solo sobrevive si es un
 * string de la lista. Hay que llamarla con la excepcion original: normalizar
 * antes perderia el codigo del driver.
 */
function safeDiagnostic(exception: unknown) {
    const source = exception instanceof Error && exception.cause instanceof Error ? exception.cause : exception;
    const code: unknown = source instanceof Error ? Reflect.get(source, "code") : undefined;
    return { error_code: typeof code === "string" && SAFE_DIAGNOSTIC_CODES.has(code) ? code : "unclassified", error_class: source instanceof TypeError ? "type_error" : source instanceof HttpException ? "http_error" : "server_error" };
}

/**
 * Una caida transitoria de red o del pool se publica como 503 para que el
 * cliente pueda reintentar. ENOTFOUND, EPIPE y los ER_* no prometen
 * recuperacion inmediata y conservan su 5xx. Un status fuera de 500-599
 * no debe salir de este camino: se normaliza a 500.
 */
function safeServerStatus(status: number, code: string): number {
    if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(code)) return 503;
    return Number.isInteger(status) && status >= 500 && status <= 599 ? status : 500;
}

/**
 * El 503 publico es siempre una constante congelada, nunca el cuerpo lanzado.
 * Solo el codigo interno exacto de reconciliacion selecciona el mensaje que
 * pide repetir la misma operacion: NetSuite pudo confirmar la aprobacion y el
 * CRM aun no persistirla. Un 503 que imite ese codigo, o que le agregue
 * campos, cae en el cuerpo generico.
 */
function unavailableBody(exception: HttpException) {
    const body = exception.getResponse();
    if (typeof body === "object" && "code" in body && body.code === FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE.code) return FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE;
    return SERVICE_UNAVAILABLE_RESPONSE;
}

/** Conserva el contrato 4xx y sustituye todo 5xx por un cuerpo y un log opacos. */
@Catch()
export class SanitizedErrorFilter extends BaseExceptionFilter<unknown> {
    private readonly safeLogger = new Logger(SanitizedErrorFilter.name);

    /**
     * El 4xx usa la normalizacion del framework. En 5xx se responde con una
     * `HttpException` nueva para reutilizar el render de Nest sin dejar pasar
     * la excepcion original. La cabecera solo se escribe si la respuesta sigue
     * abierta: un hook previo pudo cerrarla y un segundo write fallaria.
     */
    override catch(exception: unknown, host: ArgumentsHost): void {
        const normalized = this.normalizeException(exception);
        const status = normalized.getStatus();
        if (status >= 400 && status < 500) {
            super.catch(normalized, host);
            return;
        }

        const diagnostic = safeDiagnostic(exception);
        const statusCode = safeServerStatus(status, diagnostic.error_code);
        const correlationId = randomUUID();
        const response = host.switchToHttp().getResponse<FastifyReply>();
        if (!response.sent) response.header("x-correlation-id", correlationId);
        this.safeLogger.error({ correlation_id: correlationId, statusCode, ...diagnostic });
        const body = statusCode === 503 ? unavailableBody(normalized) : { statusCode, message: "Internal server error" };
        super.catch(new HttpException(body, statusCode), host);
    }

    /**
     * Unifica la entrada solo para leer el status. `HttpException` se conserva.
     * Los errores HTTP de Fastify (`http-errors`) traen `statusCode`; su mensaje
     * puede salir en un 4xx porque ese camino no se sanitiza. Lo demas nace
     * como 500 opaco: el mensaje original no entra al cuerpo.
     */
    private normalizeException(exception: unknown): HttpException {
        if (exception instanceof HttpException) return exception;
        if (this.isHttpError(exception)) return new HttpException({ statusCode: exception.statusCode, message: exception.message }, exception.statusCode);
        return new HttpException("Internal server error", 500);
    }
}
