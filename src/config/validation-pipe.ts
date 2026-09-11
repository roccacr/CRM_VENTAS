import { ValidationPipe } from "@nestjs/common";

/**
 * Pipe global de input.
 *
 * `whitelist` + `forbidNonWhitelisted`: el CRM no puede colar campos extra.
 * `transform`: DTOs (`@Type(() => Number)`) llegan ya coerceados al service.
 */
export const GLOBAL_VALIDATION_PIPE = new ValidationPipe({
    forbidNonWhitelisted: true,
    transform: true,
    whitelist: true,
});
