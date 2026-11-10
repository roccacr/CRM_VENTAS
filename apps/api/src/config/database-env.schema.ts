import { z } from "zod";

/**
 * Reglas MySQL compartidas por el runtime y el migrador.
 *
 * Las dos entradas tienen que aceptar o rechazar el mismo host, puerto y TLS.
 * Si cada una lee `DB_*` por su cuenta, una puede quedar en claro mientras la
 * otra exige certificado.
 */

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** Puerto TCP real. Cero y los valores por encima de 65535 no son un default usable. */
export const tcpPortSchema = z.coerce.number().int().min(1).max(65535);

/**
 * Booleano de entorno. Solo acepta los textos `true` y `false`: `1`, `yes` o
 * `TRUE` no se coerccionan a encendido. El default lo elige cada variable; no
 * hay un default global que deje una compuerta abierta.
 */
export const booleanEnvSchema = (defaultValue: "true" | "false") =>
    z
        .enum(["true", "false"])
        .default(defaultValue)
        .transform((value) => value === "true");

/**
 * Host de loopback por nombre exacto, ya recortado y en minusculas. No resuelve
 * DNS: un nombre que apunte a 127.0.0.1 sigue siendo remoto para esta regla.
 */
export const isLocalDatabaseHost = (host: string): boolean => LOCAL_DATABASE_HOSTS.has(host.trim().toLowerCase());

export interface DatabaseTlsValidationInput {
    DB_HOST: string;
    DB_SSL: boolean;
    DB_SSL_CA?: string | undefined;
}

/**
 * TLS de MySQL, en el mismo schema que el resto del entorno.
 *
 * Una CA con `DB_SSL` apagado pareceria cifrado y viajaria en claro. Un host
 * que no es loopback no puede arrancar sin TLS: el default `false` solo cubre
 * la base local.
 */
export const addDatabaseTlsIssues = (config: DatabaseTlsValidationInput, context: z.RefinementCtx): void => {
    if (config.DB_SSL_CA && !config.DB_SSL) {
        context.addIssue({
            code: "custom",
            message: "DB_SSL_CA solo se permite cuando DB_SSL=true.",
            path: ["DB_SSL_CA"],
        });
    }

    if (!config.DB_SSL && !isLocalDatabaseHost(config.DB_HOST)) {
        context.addIssue({
            code: "custom",
            message: "DB_SSL debe ser true cuando DB_HOST no sea local.",
            path: ["DB_SSL"],
        });
    }
};
