// ============================================================================
// IMPORTS
// ============================================================================

// Decoradores HTTP basicos para exponer el endpoint raiz y el health check.
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

// ============================================================================
// TIPOS DE RESPUESTA
// ============================================================================

/** Contrato del endpoint raiz usado como respuesta de bienvenida de la API. */
interface RootResponse {
  ok: true;
  message: string;
  version: string;
}

/** Contrato minimo del endpoint de health para probes y monitoreo. */
interface HealthResponse {
  ok: true;
  status: string;
}

// ============================================================================
// CONSTANTES DE PRESENTACION
// ============================================================================

/** Mensaje fijo que identifica rapidamente para que sirve esta API. */
const ROOT_MESSAGE = "API Kapso CRM lista para sincronizar proyectos, clientes y numeros.";

// ============================================================================
// CONTROLADOR
// ============================================================================

/**
 * Controlador raiz de la aplicacion.
 *
 * Mantiene endpoints pequenos y estables para:
 * - comprobar disponibilidad general;
 * - exponer la version desplegada;
 * - dar un probe simple a balanceadores y monitoreo.
 */
@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  // --------------------------------------------------------------------------
  // ENDPOINTS PUBLICOS
  // --------------------------------------------------------------------------

  /**
   * GET /{apiPrefix}/
   * Devuelve una respuesta simple de disponibilidad y version.
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
   * GET /{apiPrefix}/health
   * Probe ligero para verificar que el proceso HTTP sigue levantado.
   */
  @Get("health")
  getHealth(): HealthResponse {
    return {
      ok: true,
      status: "up",
    };
  }
}
