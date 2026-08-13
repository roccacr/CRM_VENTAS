import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CrmInternalTokenGuard } from '../src/auth/crm-internal-token.guard';

const createContext = (headers: Record<string, string | undefined>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  }) as ExecutionContext;

const createConfig = (token: string | undefined): ConfigService =>
  ({ get: () => token }) as unknown as ConfigService;

describe('CrmInternalTokenGuard', () => {
  it('allows requests with a valid Bearer token', () => {
    const guard = new CrmInternalTokenGuard(createConfig('crm-token'));

    expect(guard.canActivate(createContext({ authorization: 'Bearer crm-token' }))).toBe(true);
  });

  it('allows requests with a valid x-crm-api-token header', () => {
    const guard = new CrmInternalTokenGuard(createConfig('crm-token'));

    expect(guard.canActivate(createContext({ 'x-crm-api-token': 'crm-token' }))).toBe(true);
  });

  it('rejects requests without token', () => {
    const guard = new CrmInternalTokenGuard(createConfig('crm-token'));

    expect(() => guard.canActivate(createContext({}))).toThrow(UnauthorizedException);
  });

  it('rejects requests with an invalid token', () => {
    const guard = new CrmInternalTokenGuard(createConfig('crm-token'));

    expect(() => guard.canActivate(createContext({ authorization: 'Bearer wrong' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('fails closed when CRM_API_INTERNAL_TOKEN is not configured', () => {
    const guard = new CrmInternalTokenGuard(createConfig(undefined));

    expect(() => guard.canActivate(createContext({ authorization: 'Bearer crm-token' }))).toThrow(
      ServiceUnavailableException,
    );
  });
});
