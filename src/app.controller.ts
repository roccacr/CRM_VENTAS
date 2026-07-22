/**
 * Controlador raíz de salud y descubrimiento básico de la API.
 *
 * Expone endpoints públicos livianos para balanceadores y monitoreo, sin
 * pasar por autenticación Entra ni throttling agresivo en `/health`.
 */
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SkipThrottle } from "@nestjs/throttler";

import { Public } from "./common/auth/auth.decorators";

/**
 * Respuesta del endpoint raíz: confirma que la API está viva y su versión.
 */
interface RootResponse {
  ok: true;
  message: string;
  version: string;
}

/**
 * Respuesta mínima de health check para probes de infraestructura.
 */
interface HealthResponse {
  ok: true;
  status: string;
}

/** Mensaje fijo del GET `/` orientado a operadores del CRM. */
const ROOT_MESSAGE = "API Kapso CRM lista para sincronizar proyectos, clientes y numeros.";

/**
 * Endpoints públicos de estado de la aplicación.
 *
 * Marcado `@Public` a nivel de clase porque estos paths no deben exigir
 * Bearer token (load balancers y uptime checks no envían JWT).
 */
@Controller()
@Public()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Devuelve un mensaje de bienvenida y la versión empaquetada.
   *
   * Sirve como smoke test manual y como señal de que ConfigModule resolvió
   * `app.version` correctamente tras el arranque.
   *
   * @returns Payload con `ok`, mensaje y versión
   */
  @Get()
  getRoot(): RootResponse {
    return {
      ok: true,
      message: ROOT_MESSAGE,
      version: this.configService.getOrThrow<string>("app.version"),
    };
  }

  /**
   * Health check liviano para probes de orquestación.
   *
   * `@SkipThrottle` evita falsos negativos cuando el balanceador consulta
   * el endpoint con alta frecuencia.
   *
   * @returns Estado `up` si el proceso Nest responde
   */
  @Get("health")
  @SkipThrottle()
  getHealth(): HealthResponse {
    return {
      ok: true,
      status: "up",
    };
  }
}
