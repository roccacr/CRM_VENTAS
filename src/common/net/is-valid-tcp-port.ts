/** Inclusive: 1 es un puerto usable; 0 es "cualquier puerto" y no sirve para bind explicito. */
const MIN_TCP_PORT = 1;
const MAX_TCP_PORT = 65535;

/**
 * Valida que el valor sea un puerto TCP usable (entero, 1–65535).
 *
 * Fuente unica: `app-config` (`PORT`) y `mysql-env` (`MYSQL_PORT`) deben usar
 * esto. Un truthy-check (`"abc"`) no basta — `Number("abc")` es `NaN`.
 *
 * @param port - Numero ya coerceado (no el string crudo del env)
 */
export function isValidTcpPort(port: number): boolean {
    return Number.isInteger(port) && port >= MIN_TCP_PORT && port <= MAX_TCP_PORT;
}

/**
 * Parsea un string a puerto TCP valido.
 *
 * @param port - Valor crudo de env (`MYSQL_PORT`, etc.)
 * @returns El puerto, o `undefined` si no es un entero en rango 1–65535
 */
export function parseTcpPort(port: string): number | undefined {
    const parsed = Number(port);
    return isValidTcpPort(parsed) ? parsed : undefined;
}
