import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

it.each([401, 409])("does not replay an old mutation rejected with %s under a new session", async (status) => {
    let releaseMutation!: (response: Response) => void;
    const pendingMutation = new Promise<Response>((resolve) => {
        releaseMutation = resolve;
    });
    let mutationCalls = 0;
    const fetch = vi.fn((input: string) => {
        const path = new URL(input).pathname;
        if (path === "/record") return ++mutationCalls === 1 ? pendingMutation : json({ replayed: true });
        return json({ csrfToken: "fixture" });
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    try {
        const mutation = apiRequest("/record", { method: "PUT", body: { action: "old-user-action" } });
        await vi.waitFor(() => {
            expect(mutationCalls).toBe(1);
        });
        await apiRequest("/identity/logout", { method: "POST", retryOnUnauthorized: false });
        await apiRequest("/identity/local/login", { method: "POST", retryOnUnauthorized: false });
        const assertion = expect(mutation).rejects.toMatchObject({ status });
        releaseMutation(json({ message: "La sesion requiere revalidacion de permisos." }, status));
        await assertion;
        expect(mutationCalls).toBe(1);
        expect(fetch.mock.calls.some(([input]) => new URL(input).pathname === "/identity/refresh")).toBe(false);
        expect(listener).not.toHaveBeenCalled();
    } finally {
        unsubscribe();
    }
});

it.each([200, 401])("does not publish old refresh %s after logout and a new login", async (status) => {
    let releaseOldRefresh!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => {
        releaseOldRefresh = resolve;
    });
    const fetch = vi.fn((input: string) => {
        const path = new URL(input).pathname;
        if (path === "/identity/refresh") return oldResponse;
        if (path === "/identity/local/login") return json({ csrfToken: "new-login" });
        if (path === "/identity/session") return json({ csrfToken: "initial" });
        return json({ current: true });
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    const oldRefresh = refreshAuthenticatedSession().catch((error: unknown) => error);
    await vi.waitFor(() => {
        expect(fetch.mock.calls.some(([input]) => new URL(input).pathname === "/identity/refresh")).toBe(true);
    });
    await apiRequest("/identity/logout", { method: "POST", retryOnUnauthorized: false });
    await apiRequest("/identity/local/login", { method: "POST", retryOnUnauthorized: false });
    releaseOldRefresh(json({ csrfToken: "old-refresh" }, status));
    await oldRefresh;
    expect(listener).not.toHaveBeenCalled();
    await expect(apiRequest("/identity/me")).resolves.toEqual({ current: true });
    await apiRequest("/probe", { method: "POST" });
    const init = vi.mocked(globalThis.fetch).mock.calls.at(-1)?.[1];
    expect(new Headers(init?.headers).get("X-CRM-CSRF-Token")).toBe("new-login");
    unsubscribe();
});

it.each([200, 401])("keeps new generation single-flight when old refresh %s finishes", async (status) => {
    const releases: Array<(response: Response) => void> = [];
    const fetch = vi.fn((input: string) => {
        const path = new URL(input).pathname;
        if (path === "/identity/refresh")
            return new Promise<Response>((resolve) => {
                releases.push(resolve);
            });
        return json({ csrfToken: "fixture" });
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    const oldRefresh = refreshAuthenticatedSession().catch((error: unknown) => error);
    await vi.waitFor(() => {
        expect(releases).toHaveLength(1);
    });
    await apiRequest("/identity/logout", { method: "POST", retryOnUnauthorized: false });
    await apiRequest("/identity/local/login", { method: "POST", retryOnUnauthorized: false });
    const newRefresh = refreshAuthenticatedSession();
    await vi.waitFor(() => {
        expect(releases).toHaveLength(2);
    });
    releases[0]?.(json({}, status));
    await oldRefresh;
    expect(listener).not.toHaveBeenCalled();
    const joinedRefresh = refreshAuthenticatedSession();
    await Promise.resolve();
    expect(releases).toHaveLength(2);
    releases[1]?.(json({ csrfToken: "new-refresh" }));
    await Promise.all([newRefresh, joinedRefresh]);
    expect(listener).toHaveBeenCalledExactlyOnceWith("refreshed");
    unsubscribe();
});

it.each([
    { status: 200, path: "/identity/refresh" },
    { status: 401, path: "/identity/refresh" },
    { status: 200, path: "/identity/logout" },
])("rejects an administrative profile older than $path outcome $status", async ({ status, path: invalidationPath }) => {
    let releaseProfile!: (response: Response) => void;
    const pendingProfile = new Promise<Response>((resolve) => {
        releaseProfile = resolve;
    });
    const fetch = vi.fn((input: string) => {
        const path = new URL(input).pathname;
        if (path === "/identity/me") return pendingProfile;
        if (path === "/identity/session") return json({ csrfToken: "fixture" });
        return json({}, status);
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession } = await import("../../src/services/api/api-client");
    const profileResult = apiRequest("/identity/me");
    const assertion = expect(profileResult).rejects.toMatchObject({ status: 409 });
    const invalidation = invalidationPath === "/identity/refresh" ? refreshAuthenticatedSession() : apiRequest(invalidationPath, { method: "POST", retryOnUnauthorized: false });
    await invalidation.catch((error: unknown) => {
        if (status !== 401) throw error;
    });
    releaseProfile(json({ permissions: ["old-grant"] }));
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(3);
});

it("notifies once for a shared successful refresh and unsubscribes consumers", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({ csrfToken: "fixture" }))
        .mockResolvedValueOnce(json({ csrfToken: "renewed" }))
        .mockResolvedValueOnce(json({ csrfToken: "next" }));
    vi.stubGlobal("fetch", fetch);
    const { refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    await Promise.all([refreshAuthenticatedSession(), refreshAuthenticatedSession()]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    unsubscribe();
    await refreshAuthenticatedSession();
    expect(listener).toHaveBeenCalledTimes(1);
});

it("publishes rejection once when rotation fails with 401", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({ csrfToken: "fixture" }))
        .mockResolvedValueOnce(json({ message: "expired" }, 401));
    vi.stubGlobal("fetch", fetch);
    const { refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    await expect(refreshAuthenticatedSession()).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledExactlyOnceWith("rejected");
    unsubscribe();
});

it("does not renew or repeat a permission change rejected by business protection", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({ csrfToken: "fixture" }))
        .mockResolvedValueOnce(json({ message: "Owner no puede denegarse permisos directos a si mismo." }, 409));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await expect(apiRequest("/identity/users/actor/access", { method: "PUT", body: {} })).rejects.toMatchObject({ status: 409, message: "Owner no puede denegarse permisos directos a si mismo." });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/identity/refresh"))).toBe(false);
});

it("still renews once for the API's explicit obsolete-permissions response", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({ message: "La sesion requiere revalidacion de permisos." }, 409))
        .mockResolvedValueOnce(json({ csrfToken: "fixture" }))
        .mockResolvedValueOnce(json({ csrfToken: "renewed" }))
        .mockResolvedValueOnce(json({ updated: true }));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await expect(apiRequest("/identity/roles/security-catalog")).resolves.toEqual({ updated: true });
    expect(fetch).toHaveBeenCalledTimes(4);
});

it("does not replay mutations after a connection reset with an unknown outcome", async () => {
    const fetch = vi
        .fn()
        .mockResolvedValueOnce(json({ csrfToken: "fixture" }))
        .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await expect(apiRequest("/identity/users/actor/access", { method: "PUT", body: {} })).rejects.toThrow("Failed to fetch");
    expect(fetch).toHaveBeenCalledTimes(2);
});
