import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { CreateCatalogItemDto } from "../catalogs/dto/catalog-items.dto.js";

/** Preserves shared validation except the verified Subsidiaries name limit. */
export class CreateSubsidiaryDto extends OmitType(CreateCatalogItemDto, ["name"] as const) {
    @ApiProperty({ description: "Nombre visible de la subsidiaria.", maxLength: 250 })
    @Transform(({ value }: { readonly value: unknown }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @MinLength(2)
    @MaxLength(250)
    name!: string;
}

/** Updates retain the same required fields and audit reason as creation. */
export class UpdateSubsidiaryDto extends CreateSubsidiaryDto {}
