import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign } from "jsonwebtoken";
import { DataSource } from "typeorm";

import { EntraAuthService } from "../../src/common/auth/entra-auth.service";

describe("EntraAuthService", () => {
  const config: Record<string, unknown> = {
    "security.entraTenantId": "52d206d1-13b5-4260-a65c-0b0cac860b1d",
    "security.entraAudiences": ["5bdec38b-68b4-488a-a361-c9df7cd2fe3a", "api://5bdec38b-68b4-488a-a361-c9df7cd2fe3a"],
    "security.entraAudience": "5bdec38b-68b4-488a-a361-c9df7cd2fe3a",
    "security.entraIssuer": "https://login.microsoftonline.com/52d206d1-13b5-4260-a65c-0b0cac860b1d/v2.0",
    "security.entraRequiredScope": "Kapso.Access",
    "security.entraAllowedClientIds": ["5bdec38b-68b4-488a-a361-c9df7cd2fe3a"],
    "security.entraJwksUri": "https://login.microsoftonline.com/test/discovery/v2.0/keys",
    "security.crmJwtSecret": "crm-test-secret",
  };
  const configServiceMock = {
    get: jest.fn((key: string, fallback?: unknown) => config[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      const value = config[key];

      if (value === undefined) throw new Error(`Missing test config ${key}`);
      return value;
    }),
  };
  const dataSourceMock = {
    query: jest.fn(),
  };
  const service = new EntraAuthService(configServiceMock as unknown as ConfigService, dataSourceMock as unknown as DataSource);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mapea un token Entra valido a un usuario CRM activo", async () => {
    jest.spyOn(service as never, "verifyAccessToken" as never).mockResolvedValue({
      oid: "entra-object-id",
      preferred_username: "Admin@RoccaCR.com",
    } as never);
    dataSourceMock.query.mockResolvedValue([
      {
        idAdmin: 10,
        idNetSuiteAdmin: 2146844,
        roleId: 1,
        emailAdmin: "admin@roccacr.com",
        nameAdmin: "CRM Admin",
      },
    ]);

    await expect(service.authenticate("valid-token")).resolves.toEqual({
      idAdmin: 10,
      idNetSuiteAdmin: 2146844,
      roleId: 1,
      email: "admin@roccacr.com",
      name: "CRM Admin",
      entraObjectId: "entra-object-id",
      authSource: "entra",
    });
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining("admin.status_admin = 1"), ["admin@roccacr.com"]);
  });

  it("rechaza una identidad Entra que no corresponde a un usuario CRM activo", async () => {
    jest.spyOn(service as never, "verifyAccessToken" as never).mockResolvedValue({
      preferred_username: "unknown@roccacr.com",
    } as never);
    dataSourceMock.query.mockResolvedValue([]);

    await expect(service.authenticate("valid-token")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("mapea un token de sesion CRM vigente a un usuario CRM activo", async () => {
    const token = sign(
      {
        data: {
          id: 10,
          name_admin: "CRM Admin",
          email: "Admin@RoccaCR.com",
        },
      },
      "crm-test-secret",
      { expiresIn: "5h" },
    );
    dataSourceMock.query.mockResolvedValue([
      {
        idAdmin: 10,
        idNetSuiteAdmin: 2146844,
        roleId: 1,
        emailAdmin: "admin@roccacr.com",
        nameAdmin: "CRM Admin",
      },
    ]);

    await expect(service.authenticate(token)).resolves.toEqual({
      idAdmin: 10,
      idNetSuiteAdmin: 2146844,
      roleId: 1,
      email: "admin@roccacr.com",
      name: "CRM Admin",
      entraObjectId: null,
      authSource: "crm",
    });
    expect(dataSourceMock.query).toHaveBeenCalledWith(expect.stringContaining("admin.token_admin = ?"), ["admin@roccacr.com", token]);
  });

  it("rechaza un token de sesion CRM que ya no coincide con admins.token_admin", async () => {
    const token = sign(
      {
        data: {
          id: 10,
          name_admin: "CRM Admin",
          email: "admin@roccacr.com",
        },
      },
      "crm-test-secret",
      { expiresIn: "5h" },
    );
    dataSourceMock.query.mockResolvedValue([]);

    await expect(service.authenticate(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
