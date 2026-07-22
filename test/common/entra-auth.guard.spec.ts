import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { IS_PUBLIC_ROUTE, REQUIRED_CRM_ROLES } from "../../src/common/auth/auth.decorators";
import { EntraAuthGuard } from "../../src/common/auth/entra-auth.guard";
import { EntraAuthService } from "../../src/common/auth/entra-auth.service";

const CRM_ADMIN = {
  idAdmin: 10,
  idNetSuiteAdmin: 2146844,
  roleId: 1,
  email: "admin@roccacr.com",
  name: "CRM Admin",
  entraObjectId: "entra-object-id",
};

const createContext = (authorization?: string) => {
  const request = {
    headers: authorization ? { authorization } : {},
  };

  const context = {
    getClass: jest.fn(),
    getHandler: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return { context, request };
};

describe("EntraAuthGuard", () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  };
  const authServiceMock = {
    authenticate: jest.fn(),
  };
  const guard = new EntraAuthGuard(reflectorMock as unknown as Reflector, authServiceMock as unknown as EntraAuthService);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("permite rutas declaradas publicas sin exigir token", async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => key === IS_PUBLIC_ROUTE);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authServiceMock.authenticate).not.toHaveBeenCalled();
  });

  it("rechaza rutas privadas cuando falta Authorization Bearer", async () => {
    reflectorMock.getAllAndOverride.mockReturnValue(undefined);
    const { context } = createContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authServiceMock.authenticate).not.toHaveBeenCalled();
  });

  it("autentica y adjunta al usuario CRM cuando cumple el rol requerido", async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_ROUTE) return false;
      if (key === REQUIRED_CRM_ROLES) return [1];
      return undefined;
    });
    authServiceMock.authenticate.mockResolvedValue(CRM_ADMIN);
    const { context, request } = createContext("Bearer entra-access-token");

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authServiceMock.authenticate).toHaveBeenCalledWith("entra-access-token");
    expect(request).toMatchObject({ user: CRM_ADMIN });
  });

  it("rechaza con 403 a un usuario autenticado sin el rol CRM requerido", async () => {
    reflectorMock.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_ROUTE) return false;
      if (key === REQUIRED_CRM_ROLES) return [1];
      return undefined;
    });
    authServiceMock.authenticate.mockResolvedValue({ ...CRM_ADMIN, roleId: 2 });
    const { context } = createContext("Bearer entra-access-token");

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
