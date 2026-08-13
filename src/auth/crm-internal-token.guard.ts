import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { timingSafeEqualUtf8 } from '../common/crypto/timing-safe-equal';

/** Request HTTP mínimo (solo headers). */
type RequestWithHeaders = {
  readonly headers: Record<string, string | string[] | undefined>;
};

/** Primer valor de un header que puede llegar como string o string[]. */
function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Auth servicio-a-servicio del CRM.
 * Acepta `Authorization: Bearer` o `x-crm-api-token`.
 */
@Injectable()
export class CrmInternalTokenGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expectedToken = this.configService.get<string>('CRM_API_INTERNAL_TOKEN');
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

  /** Extrae token de Bearer o del header dedicado. */
  private readToken(headers: RequestWithHeaders['headers']): string | undefined {
    const authorization = firstHeaderValue(headers.authorization);
    if (authorization?.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length).trim();
    }

    return firstHeaderValue(headers['x-crm-api-token'])?.trim();
  }
}
