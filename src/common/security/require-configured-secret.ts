import { ServiceUnavailableException } from "@nestjs/common";

/**
 * Fail-closed para secretos de servidor.
 *
 * Politica unica del proyecto:
 *   - Secreto ausente o `""` en el server → 503 (misconfiguracion).
 *   - Nunca 401 en ese caso: 401 significa "cliente invalido", no "ops olvido el env".
 *
 * Usar en `assertInternalToken`, `assertWebhookSignature` y cualquier borde
 * que dependa de un secret inyectado por `ConfigService`.
 *
 * @param value - Valor leido del env (puede ser `undefined` o `""`)
 * @param label - Texto para el mensaje (ej. `CRM internal token`)
 * @returns El mismo `value` ya garantizado como string no vacio
 * @throws {ServiceUnavailableException} Si el secreto no esta configurado
 */
export function requireConfiguredSecret(value: string | undefined, label: string): string {
    if (!value) {
        throw new ServiceUnavailableException(`${label} is not configured`);
    }

    return value;
}
