/**
 * Namespace de configuración del cliente Redis / BullMQ.
 *
 * Centraliza host, DB, TLS y password bajo la clave `redis` para colas y
 * caché, de forma que el bootstrap de Bull no dependa de env sueltas.
 */
import { registerAs } from "@nestjs/config";

/**
 * Registra el bloque `redis` en ConfigModule.
 *
 * `password` queda `undefined` cuando está vacío para no forzar AUTH en
 * instancias locales sin contraseña; `tls` se activa solo con `"true"`.
 */
export default registerAs("redis", () => ({
  host: process.env.REDIS_HOST ?? "127.0.0.1",
  port: Number(process.env.REDIS_PORT ?? 6379),
  // Vacío → undefined: evita enviar password vacío a Redis sin AUTH.
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB ?? 0),
  tls: process.env.REDIS_TLS === "true",
}));
