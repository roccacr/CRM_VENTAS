import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { timingSafeEqualUtf8 } from '../common/crypto/timing-safe-equal';

const BEARER_PREFIX = 'Bearer ';
const CRM_API_TOKEN_HEADER = 'x-crm-api-token';
const CRM_INTERNAL_TOKEN_ENV = 'CRM_API_INTERNAL_TOKEN';

/** Request HTTP mínimo (solo headers) para no acoplar el guard a Express. */
type RequestWithHeaders = {
  readonly headers: Record<string, string | string[] | undefined>;
};

/**
 * Primer valor usable de un header HTTP.
 * Express puede entregar string | string[]; un truthy-check sobre el array
 * no garantiza un token — hay que tomar el primer elemento.
 */
function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Auth servicio-a-servicio CRM ↔ API Kapso.
 *
 * Fuentes de token (en este orden):
 *   1. Authorization: Bearer <token>
 *   2. Header x-crm-api-token
 *
 * Falla cerrada: sin CRM_API_INTERNAL_TOKEN configurado → 503 (no 401),
 * para no confundir "secret ausente en el server" con "cliente no autenticado".
 */
@Injectable()
export class CrmInternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.configService.get<string>(CRM_INTERNAL_TOKEN_ENV);

    // "" también es inválido: Boolean("") sería false, pero get puede devolver ""
    if (!expectedToken) {
      throw new ServiceUnavailableException('CRM internal token is not configured');
    }

    const { headers } = context.switchToHttp().getRequest<RequestWithHeaders>();
    const token = this.readToken(headers);

    if (!token || !timingSafeEqualUtf8(token, expectedToken)) {
      throw new UnauthorizedException('Invalid CRM internal token');
    }

    return true;
  }

  /** Extrae y limpia el token; undefined si no hay valor usable. */
  private readToken(headers: RequestWithHeaders['headers']): string | undefined {
    const authorization = firstHeaderValue(headers.authorization);

    if (authorization?.startsWith(BEARER_PREFIX)) {
      const bearerToken = authorization.slice(BEARER_PREFIX.length).trim();
      return bearerToken.length > 0 ? bearerToken : undefined;
    }

    const headerToken = firstHeaderValue(headers[CRM_API_TOKEN_HEADER])?.trim();
    return headerToken && headerToken.length > 0 ? headerToken : undefined;
  }
}
