/**
 * DTO para actualizar solo el estado de una integración admin-Kapso.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Type } from "class-transformer";
import { IsIn } from "class-validator";

// ============================================================================
// DTO
// ============================================================================

/** Body puntual para activar o desactivar una relacion existente. */
export class UpdateAdminKapsoIntegrationStatusDto {
  /** Estado lógico: 0 inactivo, 1 activo. */
  @Type(() => Number)
  @IsIn([0, 1])
  status!: 0 | 1;
}
