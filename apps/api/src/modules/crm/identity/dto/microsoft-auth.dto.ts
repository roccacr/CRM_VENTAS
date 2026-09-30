import { IsNotEmpty, IsOptional, IsString } from "class-validator";

/**
 * Query del callback OIDC autorizado por Microsoft.
 */
export class MicrosoftCallbackDto {
    @IsString()
    @IsNotEmpty()
    @IsOptional()
    code?: string;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    state?: string;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    error?: string;

    @IsString()
    @IsNotEmpty()
    @IsOptional()
    error_description?: string;

    @IsString()
    @IsOptional()
    session_state?: string;

    @IsString()
    @IsOptional()
    client_info?: string;
}
