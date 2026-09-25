import { z } from "zod";

// ============================================================================
// Esquemas compartidos para configuracion MySQL.
//
// Runtime y migrador deben validar TLS/base con la misma regla. Este archivo
// evita que cada entrada lea DB_* a su manera y apague seguridad por accidente.
// ============================================================================

const LOCAL_DATABASE_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);

/** Rango valido para puertos TCP configurables. */
export const tcpPortSchema = z.coerce.number().int().min(1).max(65535);

/**
 * Booleano de entorno expresado como texto.
 *
 * Las variables de entorno llegan como strings. Mantener este transform
 * centralizado evita que cada consumidor invente su propia lectura de `"true"`.
 */
export const booleanEnvSchema = (defaultValue: "true" | "false") =>
    z
        .enum(["true", "false"])
        .default(defaultValue)
        .transform((value) => value === "true");

/**
 * Indica si el host de MySQL es local y puede operar sin TLS en desarrollo.
 */
export const isLocalDatabaseHost = (host: string): boolean => LOCAL_DATABASE_HOSTS.has(host.trim().toLowerCase());

export interface DatabaseTlsValidationInput {
    DB_HOST: string;
    DB_SSL: boolean;
    DB_SSL_CA?: string | undefined;
}

/**
 * Agrega errores de TLS MySQL a un schema Zod sin duplicar mensajes.
 *
 * Reglas:
 * - una CA solo tiene sentido si TLS esta encendido;
 * - cualquier host remoto debe exigir TLS.
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
