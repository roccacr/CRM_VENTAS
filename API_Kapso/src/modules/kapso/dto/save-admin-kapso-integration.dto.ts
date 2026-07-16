// ============================================================================
// IMPORTS
// ============================================================================

import { Type } from "class-transformer";
import { IsIn, IsInt, Min } from "class-validator";

// ============================================================================
// DTO
// ============================================================================

/** Body compartido por create/update de relaciones admin–Kapso. */
export class SaveAdminKapsoIntegrationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idnetsuiteAdmin!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  kapsoPhoneNumberId!: number;

  @Type(() => Number)
  @IsIn([0, 1])
  status!: 0 | 1;
}
