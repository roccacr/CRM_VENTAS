/**
 * Error tipado de configuracion (borde env/URL).
 *
 * Distingue "falta o es invalida la config" de fallos de runtime. Subclases
 * (`AppConfigError`, `MysqlConfigError`) solo fijan el `name` para logs:
 * el catcher no necesita un `instanceof` por cada feature.
 *
 * No es un `HttpException`: se lanza en bootstrap, no en un request.
 */
export class ConfigError extends Error {
    constructor(message: string, name = "ConfigError") {
        super(message);
        this.name = name;
    }
}
