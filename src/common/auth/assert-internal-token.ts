import { UnauthorizedException } from "@nestjs/common";

import { timingSafeEqualUtf8 } from "../crypto/timing-safe-equal";
import { requireConfiguredSecret } from "../security/require-configured-secret";

/**
 * Entrada de la politica de token interno, ya desacoplada de Nest HTTP.
 * El guard solo traduce `ConfigService` + headers a estos tres campos.
 */
export type AssertInternalTokenInput = {
    /** Valor crudo de la env var; `requireConfiguredSecret` decide si es 503. */
    readonly expectedToken: string | undefined;
    /** Token parseado del request; `undefined` si Bearer y header vinieron vacios. */
    readonly receivedToken: string | undefined;
    /** Label para el mensaje (ej. `CRM`). No viaja en logs de secretos. */
    readonly serviceLabel: string;
};

/**
 * Politica unica de token interno servicio-a-servicio.
 *
 * Fail-closed, en este orden:
 *   1. Secreto ausente o `""` en el server → 503 (misconfig de ops, no del cliente).
 *   2. Token ausente o distinto → 401.
 *
 * La comparacion es timing-safe para no filtrar el secreto por tiempo de
 * respuesta. `===` quedaria prohibido en este borde.
 *
 * @throws {ServiceUnavailableException} Si el server no tiene el token configurado
 * @throws {UnauthorizedException} Si el cliente no presento un token valido
 */
export function assertInternalToken(input: AssertInternalTokenInput): void {
    const expectedToken = requireConfiguredSecret(input.expectedToken, `${input.serviceLabel} internal token`);

    if (!isMatchingInternalToken(input.receivedToken, expectedToken)) {
        throw new UnauthorizedException(`Invalid ${input.serviceLabel} internal token`);
    }
}

/**
 * `false` si no hubo token o no coincide. El early-return por ausencia es
 * intencional: no hay secreto del cliente que filtrar cuando el header no vino.
 */
function isMatchingInternalToken(receivedToken: string | undefined, expectedToken: string): boolean {
    if (!receivedToken) {
        return false;
    }

    return timingSafeEqualUtf8(receivedToken, expectedToken);
}
