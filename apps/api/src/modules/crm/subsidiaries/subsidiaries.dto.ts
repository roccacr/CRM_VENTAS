import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { CreateCatalogItemDto } from "../catalogs/dto/catalog-items.dto.js";

/**
 * Conserva la validación compartida y sustituye el nombre.
 * El cuerpo de catálogo corta en 180. Aquí el nombre va de 2 a 250, ya recortado.
 */
export class CreateSubsidiaryDto extends OmitType(CreateCatalogItemDto, ["name"] as const) {
    @ApiProperty({ description: "Nombre visible de la subsidiaria.", maxLength: 250 })
    @Transform(({ value }: { readonly value: unknown }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @MinLength(2)
    @MaxLength(250)
    name!: string;
}

/** La edición exige los mismos campos y el mismo motivo de auditoría que el alta. */
export class UpdateSubsidiaryDto extends CreateSubsidiaryDto {}
