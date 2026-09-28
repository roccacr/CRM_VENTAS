import { BadRequestException, ConflictException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { IdentityAuditRecorder } from "../../src/modules/crm/identity/identity-audit-recorder.service.js";
import type { IdentityMicrosoftSessionService } from "../../src/modules/crm/identity/identity-microsoft-session.service.js";
import type { IdentityTokenService } from "../../src/modules/crm/identity/identity-token.service.js";

/**
 * Crea el servicio de identidad con dobles mínimos.
 *
 * El objetivo de estas pruebas no es abrir MySQL: es fijar decisiones de
 * seguridad del caso de uso antes de que exista frontend.
 */
const createIdentityService = () => {
    const audit = {
        recordLocalIdentityLocked: vi.fn().mockResolvedValue(undefined),
        recordLocalLoginFailure: vi.fn().mockResolvedValue(undefined),
        recordLocalLoginSucceeded: vi.fn().mockResolvedValue(undefined),
        recordLocalResetRequested: vi.fn().mockResolvedValue(undefined),
        recordMicrosoftInteractionRequired: vi.fn().mockResolvedValue(undefined),
        recordMicrosoftLoginSucceeded: vi.fn().mockResolvedValue(undefined),
        recordRefreshReuse: vi.fn().mockResolvedValue(undefined),
        recordRefreshRotated: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdentityAuditRecorder;
    const repository = {
        createLocalPasswordResetToken: vi.fn().mockResolvedValue(undefined),
        createSession: vi.fn().mockResolvedValue(undefined),
        completeLocalPasswordReset: vi.fn().mockResolvedValue({ status: "completed", userId: 20 }),
        findActiveLocalIdentity: vi.fn().mockResolvedValue(null),
        findActiveMicrosoftIdentity: vi.fn().mockResolvedValue(null),
        findBySessionTokenHash: vi.fn().mockResolvedValue(createProfile()),
        findProfileImageBySessionTokenHash: vi.fn().mockResolvedValue(null),
        findMicrosoftAccountCache: vi.fn().mockResolvedValue(null),
        findResettableLocalIdentity: vi.fn().mockResolvedValue(null),
        hasUsableLocalPasswordResetToken: vi.fn().mockResolvedValue(true),
        markMicrosoftInteractionRequiredAndRevokeSessions: vi.fn().mockResolvedValue(undefined),
        recordFailedLocalLogin: vi.fn().mockResolvedValue({ failedLoginCount: 1, lockedUntil: null }),
        recordSuccessfulLocalLogin: vi.fn().mockResolvedValue(undefined),
        rotateRefreshSession: vi.fn(),
        saveMicrosoftAccount: vi.fn().mockResolvedValue(undefined),
        updateMicrosoftCache: vi.fn().mockResolvedValue(undefined),
    } as unknown as IdentityRepository;
    const tokens = {
        hashToken: vi.fn().mockReturnValue("reset-token-hash"),
        issueInitialTokens: vi.fn(),
        issueLocalResetToken: vi.fn().mockReturnValue({
            resetToken: "reset-token-no-se-devuelve",
            resetTokenExpiresAt: new Date(Date.now() + 60_000),
            resetTokenHash: "reset-token-hash",
        }),
        issueSessionToken: vi.fn(),
        rotateRefreshToken: vi.fn(),
    } as unknown as IdentityTokenService;
    const microsoftSession = {
        completeCallback: vi.fn(),
        renewSilentToken: vi.fn(),
        startLogin: vi.fn().mockResolvedValue({
            authorizationUrl: "https://login.microsoftonline.com/tenant/oauth2/v2.0/authorize?state=estado",
            challengeCookie: "challenge.firma",
            challengeExpiresAt: new Date(Date.now() + 60_000),
        }),
    } as unknown as IdentityMicrosoftSessionService;

    return {
        audit: audit as unknown as {
            recordLocalIdentityLocked: ReturnType<typeof vi.fn>;
            recordLocalLoginFailure: ReturnType<typeof vi.fn>;
            recordLocalLoginSucceeded: ReturnType<typeof vi.fn>;
            recordLocalResetRequested: ReturnType<typeof vi.fn>;
            recordMicrosoftInteractionRequired: ReturnType<typeof vi.fn>;
            recordMicrosoftLoginSucceeded: ReturnType<typeof vi.fn>;
            recordRefreshReuse: ReturnType<typeof vi.fn>;
            recordRefreshRotated: ReturnType<typeof vi.fn>;
        },
        microsoftSession: microsoftSession as unknown as {
            completeCallback: ReturnType<typeof vi.fn>;
            renewSilentToken: ReturnType<typeof vi.fn>;
            startLogin: ReturnType<typeof vi.fn>;
        },
        repository: repository as unknown as {
            createLocalPasswordResetToken: ReturnType<typeof vi.fn>;
            createSession: ReturnType<typeof vi.fn>;
            completeLocalPasswordReset: ReturnType<typeof vi.fn>;
            findActiveLocalIdentity: ReturnType<typeof vi.fn>;
            findActiveMicrosoftIdentity: ReturnType<typeof vi.fn>;
            findBySessionTokenHash: ReturnType<typeof vi.fn>;
            findProfileImageBySessionTokenHash: ReturnType<typeof vi.fn>;
            findMicrosoftAccountCache: ReturnType<typeof vi.fn>;
            findResettableLocalIdentity: ReturnType<typeof vi.fn>;
            hasUsableLocalPasswordResetToken: ReturnType<typeof vi.fn>;
            markMicrosoftInteractionRequiredAndRevokeSessions: ReturnType<typeof vi.fn>;
            recordFailedLocalLogin: ReturnType<typeof vi.fn>;
            recordSuccessfulLocalLogin: ReturnType<typeof vi.fn>;
            rotateRefreshSession: ReturnType<typeof vi.fn>;
            saveMicrosoftAccount: ReturnType<typeof vi.fn>;
            updateMicrosoftCache: ReturnType<typeof vi.fn>;
        },
        service: new IdentityService(repository, tokens, audit, microsoftSession),
        tokens: tokens as unknown as {
            hashToken: ReturnType<typeof vi.fn>;
            issueInitialTokens: ReturnType<typeof vi.fn>;
            issueLocalResetToken: ReturnType<typeof vi.fn>;
            issueSessionToken: ReturnType<typeof vi.fn>;
            rotateRefreshToken: ReturnType<typeof vi.fn>;
        },
    };
};

/**
 * Perfil minimo autenticado para pruebas de casos de uso.
 */
const createProfile = (): IdentityProfile => ({
    auth: {
        availableProviders: ["microsoft", "local"],
        currentProvider: "local",
        localStatus: "active",
        microsoft: null,
        primaryProvider: "microsoft",
    },
    orgUnits: [],
    permissions: [],
    roles: [],
    session: {
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        expiresInSeconds: 60,
        permissionVersion: 1,
        publicId: "session-public-id",
        status: "active",
    },
    user: {
        displayName: "Usuario Prueba",
        email: "usuario@roccacr.com",
        permissionVersion: 1,
        profileImageUrl: null,
        publicId: "user-public-id",
        status: "active",
    },
});

describe("IdentityService", () => {
    it("rechaza refresh sin cookie opaca", async () => {
        const { service } = createIdentityService();

        await expect(service.refresh()).rejects.toThrow(UnauthorizedException);
    });

    it("inicia Microsoft delegando PKCE/state/nonce al colaborador Microsoft", async () => {
        const { microsoftSession, service } = createIdentityService();

        const result = await service.startMicrosoftLogin();

        expect(microsoftSession.startLogin).toHaveBeenCalledTimes(1);
        expect(result.authorizationUrl).toContain("state=estado");
        expect(result.challengeCookie).toBe("challenge.firma");
        expect(result.challengeExpiresAt).toBeInstanceOf(Date);
    });

    it("completa Microsoft solo si existe identidad CRM y guarda cache cifrada", async () => {
        const { audit, microsoftSession, repository, service, tokens } = createIdentityService();
        microsoftSession.completeCallback.mockResolvedValue({
            account: {
                displayName: "Roberto",
                email: "roberto@roccacr.com",
                homeAccountId: "home.tenant",
                msalCacheSerialized: '{"cache":true}',
                oid: "oid",
                profilePhoto: {
                    bytes: Buffer.from("foto"),
                    mimeType: "image/jpeg",
                },
                subject: "oid",
                tenantId: "tenant",
            },
            encryptedCache: {
                ciphertext: "cipher",
                iv: "iv",
                keyVersion: 1,
                tag: "tag",
            },
        });
        repository.findActiveMicrosoftIdentity.mockResolvedValue({ authIdentityId: 30, permissionVersion: 7, userId: 20 });
        tokens.issueInitialTokens.mockReturnValue({
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "family",
            refreshToken: "refresh",
            refreshTokenHash: "refresh-hash",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionToken: "session",
            sessionTokenHash: "session-hash",
        });

        await service.completeMicrosoftCallback({
            challengeCookie: "challenge.firma",
            code: "codigo",
            ipAddress: "127.0.0.1",
            state: "estado",
            userAgent: "vitest",
        });

        expect(repository.saveMicrosoftAccount).toHaveBeenCalledWith(
            expect.objectContaining({
                authIdentityId: 30,
                cache: {
                    ciphertext: "cipher",
                    iv: "iv",
                    keyVersion: 1,
                    tag: "tag",
                },
                homeAccountId: "home.tenant",
                subject: "oid",
                tenantId: "tenant",
            }),
        );
        expect(repository.createSession).toHaveBeenCalledWith(expect.objectContaining({ providerCode: "microsoft", userId: 20 }));
        expect(audit.recordMicrosoftLoginSucceeded).toHaveBeenCalledWith(20, "127.0.0.1", "vitest");
    });

    it("revoca sesiones CRM si Microsoft exige login interactivo durante refresh", async () => {
        const { audit, microsoftSession, repository, service, tokens } = createIdentityService();
        repository.rotateRefreshSession.mockResolvedValue({
            authIdentityId: 30,
            providerCode: "microsoft",
            sessionPublicId: "session-public-id",
            status: "rotated",
            userId: 20,
        });
        repository.findMicrosoftAccountCache.mockResolvedValue({
            authIdentityId: 30,
            cache: {
                ciphertext: "cipher",
                iv: "iv",
                keyVersion: 1,
                tag: "tag",
            },
            homeAccountId: "home.tenant",
        });
        microsoftSession.renewSilentToken.mockResolvedValue(null);
        tokens.issueSessionToken.mockReturnValue({
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionToken: "next-session",
            sessionTokenHash: "next-session-hash",
        });
        tokens.rotateRefreshToken.mockReturnValue({
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshToken: "next-refresh",
            refreshTokenHash: "next-refresh-hash",
        });

        await expect(service.refresh("refresh", "127.0.0.1", "vitest")).rejects.toThrow(UnauthorizedException);

        expect(repository.markMicrosoftInteractionRequiredAndRevokeSessions).toHaveBeenCalledWith(30, 20);
        expect(audit.recordMicrosoftInteractionRequired).toHaveBeenCalledWith(20, "127.0.0.1", "vitest");
    });

    it("responde 409 cuando la version de permisos de la sesion quedo obsoleta", async () => {
        const { service, repository } = createIdentityService();
        repository.findBySessionTokenHash.mockResolvedValue({
            ...createProfile(),
            session: {
                ...createProfile().session,
                permissionVersion: 1,
            },
            user: {
                ...createProfile().user,
                permissionVersion: 2,
            },
        });

        await expect(service.getCurrentUser("session-token")).rejects.toThrow(ConflictException);
    });

    it("audita reuso de refresh y no emite sesion nueva", async () => {
        const { audit, repository, service, tokens } = createIdentityService();
        repository.rotateRefreshSession.mockResolvedValue({
            sessionPublicId: "session-public-id",
            status: "reused",
            userId: 20,
        });
        tokens.issueSessionToken.mockReturnValue({
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionToken: "next-session-token",
            sessionTokenHash: "next-session-hash",
        });
        tokens.rotateRefreshToken.mockReturnValue({
            refreshExpiresAt: new Date(Date.now() + 120_000),
            refreshToken: "next-refresh-token",
            refreshTokenHash: "next-refresh-hash",
        });

        await expect(service.refresh("current-refresh-token", "127.0.0.1", "vitest")).rejects.toThrow(UnauthorizedException);

        expect(audit.recordRefreshReuse).toHaveBeenCalledWith(20, "session-public-id", "127.0.0.1", "vitest");
        expect(repository.createSession).not.toHaveBeenCalled();
    });

    it("lee la foto cacheada del usuario autenticado por hash de sesion", async () => {
        const { repository, service, tokens } = createIdentityService();
        repository.findProfileImageBySessionTokenHash.mockResolvedValue({
            bytes: Buffer.from("foto"),
            mimeType: "image/jpeg",
        });

        const result = await service.getCurrentUserProfileImage("session-token");

        expect(tokens.hashToken).toHaveBeenCalledWith("session-token");
        expect(repository.findProfileImageBySessionTokenHash).toHaveBeenCalledWith("reset-token-hash");
        expect(result?.mimeType).toBe("image/jpeg");
    });

    it("audita la solicitud de reset local usando correo normalizado", async () => {
        const { audit, service } = createIdentityService();

        await service.requestLocalReset({ email: " Usuario@RoccaCR.com " }, "127.0.0.1", "vitest");

        expect(audit.recordLocalResetRequested).toHaveBeenCalledWith("usuario@roccacr.com", "127.0.0.1", "vitest");
    });

    it("crea token hasheado de reset cuando la identidad local existe y no devuelve el token plano", async () => {
        const { repository, service } = createIdentityService();
        repository.findResettableLocalIdentity.mockResolvedValue({
            authIdentityId: 10,
            userId: 20,
        });

        const result = await service.requestLocalReset({ email: "usuario@roccacr.com" }, "127.0.0.1", "vitest");

        expect(result).toEqual({ accepted: true });
        const resetTokenInput = repository.createLocalPasswordResetToken.mock.calls[0]?.[0] as { expiresAt: unknown };

        expect(resetTokenInput.expiresAt).toBeInstanceOf(Date);
        expect(repository.createLocalPasswordResetToken).toHaveBeenCalledWith({
            authIdentityId: 10,
            expiresAt: resetTokenInput.expiresAt,
            ipAddress: "127.0.0.1",
            tokenHash: "reset-token-hash",
            userAgent: "vitest",
        });
        expect(JSON.stringify(result)).not.toContain("reset-token-no-se-devuelve");
    });

    it("rechaza login local bloqueado con respuesta neutral sin crear sesion", async () => {
        const { repository, service } = createIdentityService();
        repository.findActiveLocalIdentity.mockResolvedValue({
            authIdentityId: 10,
            failedLoginCount: 5,
            lockedUntil: new Date(Date.now() + 60_000),
            passwordHash: "$argon2id$v=19$m=19456,p=1,t=2$x4LIsYBb4u+XOPFMuBxIRw$mDnYVwKK/1vyxZmiLGl14UGszNfdgkG5b3ToVx0YB94",
            permissionVersion: 1,
            userId: 20,
        });

        await expect(service.localLogin({ email: "usuario@roccacr.com", password: "Clave temporal segura" }, "127.0.0.1", "vitest")).rejects.toThrow(UnauthorizedException);

        expect(repository.createSession).not.toHaveBeenCalled();
        expect(repository.recordSuccessfulLocalLogin).not.toHaveBeenCalled();
    });

    it("delega el incremento atomico del contador fallido al repositorio", async () => {
        const { audit, repository, service } = createIdentityService();
        repository.findActiveLocalIdentity.mockResolvedValue({
            authIdentityId: 10,
            failedLoginCount: 4,
            lockedUntil: null,
            passwordHash: "$argon2id$v=19$m=19456,p=1,t=2$x4LIsYBb4u+XOPFMuBxIRw$mDnYVwKK/1vyxZmiLGl14UGszNfdgkG5b3ToVx0YB94",
            permissionVersion: 1,
            userId: 20,
        });
        repository.recordFailedLocalLogin.mockResolvedValue({
            failedLoginCount: 5,
            lockedUntil: new Date(Date.now() + 60_000),
        });

        await expect(service.localLogin({ email: "usuario@roccacr.com", password: "clave-incorrecta" }, "127.0.0.1", "vitest")).rejects.toThrow(UnauthorizedException);

        expect(repository.recordFailedLocalLogin).toHaveBeenCalledWith(10, 5, expect.any(Date));
        expect(audit.recordLocalIdentityLocked).toHaveBeenCalledWith(expect.objectContaining({ failedLoginCount: 5, userId: 20 }));
    });

    it("rechaza claves locales comunes antes de guardar un nuevo hash", async () => {
        const { repository, service } = createIdentityService();

        await expect(service.completeLocalReset({ resetToken: "r".repeat(43), newPassword: "password123" }, "127.0.0.1", "vitest")).rejects.toThrow(BadRequestException);

        expect(repository.completeLocalPasswordReset).not.toHaveBeenCalled();
    });

    it("rechaza reset local con token inexistente antes de actualizar la clave", async () => {
        const { repository, service, tokens } = createIdentityService();
        repository.hasUsableLocalPasswordResetToken.mockResolvedValue(false);

        await expect(service.completeLocalReset({ resetToken: "r".repeat(43), newPassword: "Clave temporal segura" }, "127.0.0.1", "vitest")).rejects.toThrow(UnauthorizedException);

        expect(tokens.hashToken).toHaveBeenCalledWith("r".repeat(43));
        expect(repository.completeLocalPasswordReset).not.toHaveBeenCalled();
    });

    it("audita la rotacion de refresh con el usuario canonico asociado", async () => {
        const { audit, repository, service, tokens } = createIdentityService();
        repository.rotateRefreshSession.mockResolvedValue({
            authIdentityId: 10,
            providerCode: "local",
            sessionPublicId: "session-public-id",
            status: "rotated",
            userId: 20,
        });
        tokens.issueSessionToken.mockReturnValue({
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionToken: "next-session-token",
            sessionTokenHash: "next-session-hash",
        });
        tokens.rotateRefreshToken.mockReturnValue({
            refreshExpiresAt: new Date(Date.now() + 120_000),
            refreshToken: "next-refresh-token",
            refreshTokenHash: "next-refresh-hash",
        });

        await service.refresh("current-refresh-token", "127.0.0.1", "vitest");

        expect(audit.recordRefreshRotated).toHaveBeenCalledWith(20, "session-public-id", "127.0.0.1", "vitest");
    });
});
