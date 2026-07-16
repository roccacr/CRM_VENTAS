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
  @Type(() => Number)
  @IsIn([0, 1])
  status!: 0 | 1;
}
