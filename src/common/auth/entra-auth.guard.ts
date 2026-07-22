/**
 * Guard global de autenticación y autorización vía Microsoft Entra ID.
 *
 * Intercepta cada request (salvo rutas `@Public`) para exigir Bearer token,
 * resolver el usuario CRM y, si aplica, validar roles antes de llegar al handler.
 */
import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";

import { IS_PUBLIC_ROUTE, REQUIRED_CRM_ROLES } from "./auth.decorators";
import { AuthenticatedCrmUser } from "./auth.types";
import { EntraAuthService } from "./entra-auth.service";

/**
 * Request Express enriquecido con el usuario CRM autenticado.
 *
 * Permite tipar `request.user` tras un `canActivate` exitoso sin casts dispersos.
 */
type AuthenticatedRequest = Request & {
  user?: AuthenticatedCrmUser;
};

/**
 * Guard Nest que aplica autenticación Entra y roles CRM por metadata.
 *
 * Se registra como `APP_GUARD` para cubrir toda la API por defecto y reducir
 * el riesgo de endpoints internos expuestos sin autenticación.
 */
@Injectable()
export class EntraAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entraAuthService: EntraAuthService,
  ) {}

  /**
   * Decide si el request puede continuar hacia el controlador.
   *
   * Omite validación en rutas públicas; en el resto autentica el Bearer,
   * aplica roles requeridos y adjunta el usuario al request para el handler.
   *
   * @param context - Contexto de ejecución Nest (HTTP)
   * @returns `true` si la ruta es pública o el usuario está autorizado
   * @throws {UnauthorizedException} Si falta o es inválido el token Bearer
   * @throws {ForbiddenException} Si el rol CRM no está en la lista requerida
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const user = await this.entraAuthService.authenticate(token);
    const requiredRoles = this.reflector.getAllAndOverride<number[]>(REQUIRED_CRM_ROLES, [context.getHandler(), context.getClass()]) ?? [];

    if (requiredRoles.length > 0 && !requiredRoles.includes(user.roleId)) {
      throw new ForbiddenException("La cuenta autenticada no tiene permisos para esta operación.");
    }

    request.user = user;
    return true;
  }

  /**
   * Extrae el access token del header `Authorization: Bearer <token>`.
   *
   * @param request - Request HTTP entrante
   * @returns Token Bearer sin el esquema
   * @throws {UnauthorizedException} Si el esquema o el token están ausentes
   */
  private extractBearerToken(request: Request): string {
    const [scheme, token] = request.headers.authorization?.trim().split(/\s+/) ?? [];

    if (scheme?.toLowerCase() !== "bearer" || !token) {
      throw new UnauthorizedException("Debe enviar un access token Bearer.");
    }

    return token;
  }
}
