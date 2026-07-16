// ============================================================================
// IMPORTS
// ============================================================================

import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

// ============================================================================
// HELPERS
// ============================================================================

const toTrimmedString = ({ value }: { value: unknown }) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

// ============================================================================
// DTO
// ============================================================================

/** Query params soportados por los listados del modulo admin–Kapso. */
export class ListAdminKapsoIntegrationsDto {
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  idnetsuiteAdmin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  kapsoPhoneNumberId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  status?: 0 | 1;

  @IsOptional()
  @Type(() => Number)
  @IsIn([0, 1])
  includeInactive?: 0 | 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;

  @IsOptional()
  @Transform(toTrimmedString)
  @IsIn(["createdAt", "updatedAt", "administratorName", "displayPhoneNumber", "status"])
  sortBy?: "createdAt" | "updatedAt" | "administratorName" | "displayPhoneNumber" | "status" = "updatedAt";

  @IsOptional()
  @Transform(toTrimmedString)
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}
