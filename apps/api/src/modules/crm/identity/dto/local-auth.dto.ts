import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import { transformCaseInsensitiveIdentifier } from "../../../../common/security/identifier-normalization.js";

/** Longitud maxima tecnica de un correo segun el estandar usado por clientes y servidores modernos. */
const MAX_EMAIL_LENGTH = 254;

/** Longitud minima aprobada para claves locales del CRM. */
const MIN_LOCAL_PASSWORD_LENGTH = 12;

/** Longitud maxima para evitar payloads excesivos antes del hashing de password. */
const MAX_LOCAL_PASSWORD_LENGTH = 128;

/** Longitud minima de token opaco de activacion/reset local. */
const MIN_LOCAL_RESET_TOKEN_LENGTH = 32;

/** Longitud maxima para evitar payloads abusivos en tokens opacos. */
const MAX_LOCAL_RESET_TOKEN_LENGTH = 256;

/**
 * Body de request para login local.
 *
 * Login local es una ruta alternativa, no la primaria. El endpoint queda
 * preparado pero deshabilitado hasta implementar hashing, activacion y rate
 * limiting completos.
 */
export class LocalLoginDto {
    @ApiProperty({ description: "Correo canonico del usuario CRM.", example: "usuario@roccacr.com", maxLength: MAX_EMAIL_LENGTH })
    @Transform(transformCaseInsensitiveIdentifier)
    @IsEmail()
    @MaxLength(MAX_EMAIL_LENGTH)
    email!: string;

    @ApiProperty({ description: "Clave local del usuario cuando el login local este activado.", minLength: MIN_LOCAL_PASSWORD_LENGTH, maxLength: MAX_LOCAL_PASSWORD_LENGTH })
    @IsString()
    @MinLength(MIN_LOCAL_PASSWORD_LENGTH)
    @MaxLength(MAX_LOCAL_PASSWORD_LENGTH)
    password!: string;
}

/**
 * Body de request para activacion/reset de password local.
 */
export class RequestLocalResetDto {
    @ApiProperty({
        description: "Correo que recibira el flujo seguro de activacion/reset.",
        example: "usuario@roccacr.com",
        maxLength: MAX_EMAIL_LENGTH,
    })
    @Transform(transformCaseInsensitiveIdentifier)
    @IsEmail()
    @MaxLength(MAX_EMAIL_LENGTH)
    email!: string;
}

/**
 * Body de request para completar activacion/reset de password local.
 */
export class CompleteLocalResetDto {
    @ApiProperty({ description: "Token opaco emitido por el backend para activar o resetear la clave local.", minLength: MIN_LOCAL_RESET_TOKEN_LENGTH, maxLength: MAX_LOCAL_RESET_TOKEN_LENGTH })
    @IsString()
    @MinLength(MIN_LOCAL_RESET_TOKEN_LENGTH)
    @MaxLength(MAX_LOCAL_RESET_TOKEN_LENGTH)
    resetToken!: string;

    @ApiProperty({ description: "Nueva clave local. Nunca se guarda en texto plano.", minLength: MIN_LOCAL_PASSWORD_LENGTH, maxLength: MAX_LOCAL_PASSWORD_LENGTH })
    @IsString()
    @MinLength(MIN_LOCAL_PASSWORD_LENGTH)
    @MaxLength(MAX_LOCAL_PASSWORD_LENGTH)
    newPassword!: string;
}
