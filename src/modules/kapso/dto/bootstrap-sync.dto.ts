/**
 * DTO opcional del bootstrap de sincronización Kapso.
 *
 * Body de POST /kapso/bootstrap/sync para decidir si se asegura el webhook
 * de plataforma a nivel proyecto.
 */

// ============================================================================
// IMPORTS
// ============================================================================

// Validadores usados por Nest al parsear el body del endpoint manual de bootstrap.
import { IsBoolean, IsOptional } from "class-validator";

// ============================================================================
// DTO
// ============================================================================

/**
 * Body opcional para `POST /kapso/bootstrap/sync`.
 * Permite decidir si el bootstrap también debe garantizar el webhook global
 * de plataforma antes de sincronizar los números remotos.
 */
export class BootstrapSyncDto {
  /**
   * Si es true (default), garantiza el webhook de plataforma a nivel proyecto
   * antes de listar y sincronizar los números.
   */
  @IsOptional()
  @IsBoolean()
  ensureProjectWebhook?: boolean;
}
