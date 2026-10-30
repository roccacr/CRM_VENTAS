import { randomUUID } from "node:crypto";

import { type ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { FastifyReply } from "fastify";

import { FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE, SERVICE_UNAVAILABLE_RESPONSE } from "../http-error.responses.js";

const SAFE_DIAGNOSTIC_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ENOTFOUND", "EPIPE", "PROTOCOL_CONNECTION_LOST", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT", "ER_BAD_FIELD_ERROR", "ER_NO_SUCH_TABLE", "ER_PARSE_ERROR", "ER_CON_COUNT_ERROR", "ER_DUP_ENTRY"]);

/** Fixed technical categories only: never serialize the original error, SQL, stack or message. */
function safeDiagnostic(exception: unknown) {
    const source = exception instanceof Error && exception.cause instanceof Error ? exception.cause : exception;
    const code: unknown = source instanceof Error ? Reflect.get(source, "code") : undefined;
    return { error_code: typeof code === "string" && SAFE_DIAGNOSTIC_CODES.has(code) ? code : "unclassified", error_class: source instanceof TypeError ? "type_error" : source instanceof HttpException ? "http_error" : "server_error" };
}

/** A temporary dependency outage is unavailable; unknown server failures retain their existing status. */
function safeServerStatus(status: number, code: string): number {
    if (["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(code)) return 503;
    return Number.isInteger(status) && status >= 500 && status <= 599 ? status : 500;
}

/** Only an exact internal recovery code can select a predefined public 503 body. */
function unavailableBody(exception: HttpException) {
    const body = exception.getResponse();
    if (typeof body === "object" && "code" in body && body.code === FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE.code) return FORMALIZATION_APPROVAL_RECONCILIATION_RESPONSE;
    return SERVICE_UNAVAILABLE_RESPONSE;
}

/** Preserves client-error contracts while suppressing server exception details and raw logging. */
@Catch()
export class SanitizedErrorFilter extends BaseExceptionFilter<unknown> {
    private readonly safeLogger = new Logger(SanitizedErrorFilter.name);

    /** Uses framework normalization for 4xx; every 5xx body and log is constructed from safe fields. */
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

    private normalizeException(exception: unknown): HttpException {
        if (exception instanceof HttpException) return exception;
        if (this.isHttpError(exception)) return new HttpException({ statusCode: exception.statusCode, message: exception.message }, exception.statusCode);
        return new HttpException("Internal server error", 500);
    }
}
