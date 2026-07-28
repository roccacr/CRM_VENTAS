/**
 * Namespace de configuracion del cliente Redis / BullMQ.
 *
 * El modo normal del API es `KAPSO_JOBS_DRIVER=local`, por lo que no se abre
 * conexion Redis. Redis solo se activa si se cambia explicitamente a `bullmq`
 * para coordinar varias replicas del mismo servicio.
 */
import { registerAs } from "@nestjs/config";

function getRedisUrl(): URL | undefined {
  const rawUrl = process.env.REDIS_URL?.trim();

  return rawUrl ? new URL(rawUrl) : undefined;
}

function decodeRedisCredential(value: string | undefined): string | undefined {
  return value ? decodeURIComponent(value) : undefined;
}

/**
 * Registra el bloque `redis` en ConfigModule.
 *
 * `REDIS_URL` tiene prioridad sobre las variables separadas para evitar
 * configuraciones partidas entre host, password, TLS y DB.
 */
export default registerAs("redis", () => {
  const redisUrl = getRedisUrl();
  const redisUrlDb = redisUrl?.pathname.replace("/", "");
  const jobsDriver = (process.env.KAPSO_JOBS_DRIVER ?? "local").trim().toLowerCase();

  return {
    enabled: jobsDriver === "bullmq",
    host: redisUrl?.hostname ?? process.env.REDIS_HOST,
    port: Number(redisUrl?.port || process.env.REDIS_PORT || 6379),
    username: decodeRedisCredential(redisUrl?.username),
    // Vacio -> undefined: evita enviar password vacio a Redis sin AUTH.
    password: decodeRedisCredential(redisUrl?.password) ?? (process.env.REDIS_PASSWORD || undefined),
    db: Number(redisUrlDb || process.env.REDIS_DB || 0),
    tls: redisUrl?.protocol === "rediss:" || process.env.REDIS_TLS === "true",
  };
});
