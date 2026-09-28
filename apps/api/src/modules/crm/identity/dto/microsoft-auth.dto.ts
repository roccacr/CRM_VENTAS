import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Query del callback OIDC autorizado por Microsoft.
 */
export class MicrosoftCallbackDto {
    @IsString()
    @IsNotEmpty()
    code!: string;

    @IsString()
    @IsNotEmpty()
    state!: string;

    @IsString()
    @IsOptional()
    session_state?: string;

    @IsString()
    @IsOptional()
    client_info?: string;
}
