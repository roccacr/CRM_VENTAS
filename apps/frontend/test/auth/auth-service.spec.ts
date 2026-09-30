import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApiUrl } from "../../src/config/frontend-env";

const anonymousSession = {
    authenticated: false,
    csrfToken: "fresh-csrf",
    session: null,
    user: null,
};

const createJsonResponse = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
        headers: {
            "content-type": "application/json",
        },
        status,
    });

const getRequestPath = (input: RequestInfo | URL): string => {
    if (typeof input === "string") {
        return new URL(input).pathname;
    }

    if (input instanceof URL) {
        return input.pathname;
    }

    return new URL(input.url).pathname;
};

describe("auth-service", () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.cookie = "crm_csrf=; Max-Age=0; path=/";
    });

    it("prepara CSRF antes de iniciar Microsoft cuando el token todavia no existe en memoria", async () => {
        const authorizationUrl = "https://login.microsoftonline.com/test/oauth2/v2.0/authorize";
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/microsoft/start" && init?.method === "POST") {
                const headers = new Headers(init.headers);

                return headers.get("X-CRM-CSRF-Token") === "fresh-csrf" ? createJsonResponse({ authorizationUrl }) : createJsonResponse({ message: "CSRF requerido" }, 403);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        vi.stubGlobal("fetch", fetchMock);
        const { startMicrosoftLogin } = await import("../../src/services/auth/auth-service");

        await expect(startMicrosoftLogin()).resolves.toBe(authorizationUrl);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            buildApiUrl("/identity/session"),
            expect.objectContaining({
                credentials: "include",
                method: "GET",
            }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            buildApiUrl("/identity/microsoft/start"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
    });

    it("prepara CSRF antes del login local sin leer cookies del documento", async () => {
        const authenticatedSession = {
            ...anonymousSession,
            authenticated: true,
            csrfToken: "rotated-csrf",
            session: {
                expiresAt: "2026-09-29T22:00:00.000Z",
                expiresInSeconds: 28_800,
                permissionVersion: 1,
                publicId: "ses_001",
                status: "active",
            },
            user: {
                displayName: "Roberto Carlos",
                email: "roberto@roccacr.com",
                permissionVersion: 1,
                profileImageUrl: null,
                publicId: "usr_001",
                status: "active",
            },
        };
        const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
            const path = getRequestPath(input);

            if (path === "/identity/session") {
                return createJsonResponse(anonymousSession);
            }

            if (path === "/identity/local/login" && init?.method === "POST") {
                const headers = new Headers(init.headers);

                return headers.get("X-CRM-CSRF-Token") === "fresh-csrf" ? createJsonResponse(authenticatedSession) : createJsonResponse({ message: "CSRF requerido" }, 403);
            }

            return createJsonResponse({ message: `Ruta no mockeada: ${path}` }, 404);
        });

        vi.stubGlobal("fetch", fetchMock);
        const { loginWithLocalCredentials } = await import("../../src/services/auth/auth-service");

        await expect(loginWithLocalCredentials({ email: "roberto@roccacr.com", password: "PasswordSeguro123!" })).resolves.toEqual(authenticatedSession);
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            buildApiUrl("/identity/session"),
            expect.objectContaining({
                credentials: "include",
                method: "GET",
            }),
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            buildApiUrl("/identity/local/login"),
            expect.objectContaining({
                credentials: "include",
                method: "POST",
            }),
        );
    });
});
