import { ApiProperty, OmitType } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

import { CreateCatalogItemDto } from "../catalogs/dto/catalog-items.dto.js";

/** Misma validación del catálogo, salvo el nombre: el compartido corta en 180 y la columna del corredor admite 250. Se recorta y exige al menos 2. */
export class CreateBrokerDto extends OmitType(CreateCatalogItemDto, ["name"] as const) {
    @ApiProperty({ description: "Nombre visible del corredor.", maxLength: 250 })
    @Transform(({ value }: { readonly value: unknown }) => (typeof value === "string" ? value.trim() : value))
    @IsString()
    @MinLength(2)
    @MaxLength(250)
    name!: string;
}

/** Editar exige los mismos campos y el mismo motivo que el alta. No hay un cuerpo que mueva solo el nombre. */
export class UpdateBrokerDto extends CreateBrokerDto {}
