import { Type } from "class-transformer";
import { IsInt, IsString, Min } from "class-validator";

/** Body para cambiar el admin de una asignacion existente. */
export class KapsoAdminAssignmentBodyDto {
    @Type(() => Number)
    @IsInt()
    @Min(1)
    readonly idnetsuiteAdmin!: number;
}

/** Body para crear la relacion integracion Kapso → admin CRM. */
export class CreateKapsoAdminAssignmentBodyDto extends KapsoAdminAssignmentBodyDto {
    @IsString()
    readonly kapsoIntegracionNumeroWhatsappId!: string;
}
