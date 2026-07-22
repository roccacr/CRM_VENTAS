/**
 * DTO de query params para listar integraciones admin-Kapso.
 *
 * Filtros, paginación y orden del listado administrativo.
 */

// ============================================================================
// IMPORTS
// ============================================================================

import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

// ============================================================================
// HELPERS
// ============================================================================

/** Normaliza strings vacíos a undefined para no filtrar por basura. */
const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

// ============================================================================
// DTO
// ============================================================================

/** Query params soportados por los listados del modulo admin–Kapso. */
export class ListAdminKapsoIntegrationsDto {
  /** Texto libre (nombre admin, teléfono, etc.). */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  search?: string;

  /** Filtra por administrador NetSuite. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idnetsuiteAdmin?: number;

  /** Filtra por PK local del número Kapso. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  kapsoPhoneNumberId?: number;

  /** Filtra por estado: 0 inactivo, 1 activo. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: 0 | 1;

  /** Si es 1, incluye relaciones inactivas en el resultado. */
  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  includeInactive?: 0 | 1;

  /** Página 1-based (por defecto 1). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /** Tamaño de página (1–100, por defecto 10). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  /** Campo de ordenación permitido. */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsIn(["createdAt", "updatedAt", "administratorName", "displayPhoneNumber", "status"])
  sortBy?: "createdAt" | "updatedAt" | "administratorName" | "displayPhoneNumber" | "status" = "updatedAt";

  /** Dirección de orden: ascendente o descendente. */
  @IsOptional()
  @Transform(toTrimmedString)
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}
