/**
 * DTO para crear o actualizar la asignación admin CRM a un número Kapso.
 */

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
  /** Identificador lógico del administrador en NetSuite/CRM. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  idnetsuiteAdmin!: number;

  /** PK local del número en kapso_phone_numbers. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  kapsoPhoneNumberId!: number;

  /** Estado de la integración: 0 inactivo, 1 activo. */
  @Type(() => Number)
  @IsIn([0, 1])
  status!: 0 | 1;
}
