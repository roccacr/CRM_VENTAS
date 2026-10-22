import { randomUUID } from "node:crypto";

import { type ArgumentsHost, Catch, HttpException, Logger } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import type { FastifyReply } from "fastify";

import { SERVICE_UNAVAILABLE_RESPONSE } from "../http-error.responses.js";

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

        const statusCode = Number.isInteger(status) && status >= 500 && status <= 599 ? status : 500;
        const correlationId = randomUUID();
        const response = host.switchToHttp().getResponse<FastifyReply>();
        if (!response.sent) response.header("x-correlation-id", correlationId);
        this.safeLogger.error({ correlation_id: correlationId, statusCode });
        const body = statusCode === 503 ? SERVICE_UNAVAILABLE_RESPONSE : { statusCode, message: "Internal server error" };
        super.catch(new HttpException(body, statusCode), host);
    }

    private normalizeException(exception: unknown): HttpException {
        if (exception instanceof HttpException) return exception;
        if (this.isHttpError(exception)) return new HttpException({ statusCode: exception.statusCode, message: exception.message }, exception.statusCode);
        return new HttpException("Internal server error", 500);
    }
}
