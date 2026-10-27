import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

it.each([200, 401])("resynchronizes cached CSRF after rejection and renewal returns %s", async (refreshStatus) => {
    let currentProof = "session-bound-proof";
    let authenticated = false;
    const requests: string[] = [];
    const fetch = vi.fn((input: string, init?: RequestInit) => {
        const path = new URL(input).pathname;
        requests.push(path);
        if (path === "/identity/session") return Promise.resolve(json({ authenticated, csrfToken: currentProof }));
        if (path === "/identity/refresh") {
            if (new Headers(init?.headers).get("X-CRM-CSRF-Token") !== currentProof) return Promise.resolve(json({ message: "CSRF rejected" }, 403));
            authenticated = refreshStatus === 200;
            return Promise.resolve(json(authenticated ? { csrfToken: "rotated-proof" } : { message: "expired" }, refreshStatus));
        }
        return Promise.resolve(json(authenticated ? { total: 186 } : { message: "expired" }, authenticated ? 200 : 401));
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    currentProof = "current-cookie-proof";
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    try {
        const result = apiRequest("/formalization/home/summary");
        if (refreshStatus === 200) await expect(result).resolves.toEqual({ total: 186 });
        else await expect(result).rejects.toMatchObject({ status: 401 });
        expect(requests.slice(0, 5)).toEqual(["/identity/session", "/formalization/home/summary", "/identity/refresh", "/identity/session", "/identity/refresh"]);
        expect(listener).toHaveBeenCalledExactlyOnceWith(refreshStatus === 200 ? "refreshed" : "rejected");
    } finally {
        unsubscribe();
    }
});

it("stops after one CSRF recovery when refresh remains forbidden", async () => {
    const fetch = vi.fn((input: string) => Promise.resolve(new URL(input).pathname === "/identity/session" ? json({ csrfToken: "current" }) : json({}, 403)));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    try {
        await expect(refreshAuthenticatedSession()).rejects.toMatchObject({ status: 403 });
        expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === "/identity/refresh")).toHaveLength(2);
        expect(listener).not.toHaveBeenCalled();
    } finally {
        unsubscribe();
    }
});

it("shares CSRF revalidation and rotation for simultaneous expired banner requests", async () => {
    let currentProof = "old-proof";
    let authenticated = false;
    const fetch = vi.fn((input: string, init?: RequestInit) => {
        const path = new URL(input).pathname;
        if (path === "/identity/session") return Promise.resolve(json({ csrfToken: currentProof }));
        if (path === "/identity/refresh") {
            if (new Headers(init?.headers).get("X-CRM-CSRF-Token") !== currentProof) return Promise.resolve(json({}, 403));
            authenticated = true;
            return Promise.resolve(json({ csrfToken: "renewed" }));
        }
        return Promise.resolve(json(authenticated ? { count: 1 } : {}, authenticated ? 200 : 401));
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    currentProof = "new-proof";
    await expect(Promise.all([apiRequest("/formalization/approvals/summary"), apiRequest("/formalization/home/summary")])).resolves.toEqual([{ count: 1 }, { count: 1 }]);
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === "/identity/session")).toHaveLength(2);
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === "/identity/refresh")).toHaveLength(2);
});

it("does not rotate or overwrite the new login proof when an older CSRF preflight resolves late", async () => {
    let preflights = 0;
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
        release = resolve;
    });
    const fetch = vi.fn((input: string) => {
        const path = new URL(input).pathname;
        if (path === "/identity/session") return ++preflights === 1 ? Promise.resolve(json({ csrfToken: "initial" })) : pending;
        if (path === "/identity/local/login") return Promise.resolve(json({ csrfToken: "new-login-proof" }));
        if (path === "/identity/refresh") return Promise.resolve(json({}, 403));
        return Promise.resolve(json({ csrfToken: "other-proof" }));
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const stale = refreshAuthenticatedSession().catch((error: unknown) => error);
    await vi.waitFor(() => {
        expect(preflights).toBe(2);
    });
    await apiRequest("/identity/local/login", { method: "POST", retryOnUnauthorized: false });
    release(json({ csrfToken: "old-proof" }));
    await expect(stale).resolves.toMatchObject({ status: 409 });
    expect(fetch.mock.calls.filter(([url]) => new URL(url).pathname === "/identity/refresh")).toHaveLength(1);
    await apiRequest("/probe", { method: "POST" });
    const init = vi.mocked(globalThis.fetch).mock.calls.at(-1)?.[1];
    expect(new Headers(init?.headers).get("X-CRM-CSRF-Token")).toBe("new-login-proof");
});

it.each([403, 503])("does not rotate or log out after CSRF preflight fails with %s", async (status) => {
    let calls = 0;
    const paths: string[] = [];
    const fetch = vi.fn((input: string) => {
        paths.push(new URL(input).pathname);
        if (new URL(input).pathname === "/identity/refresh") return Promise.resolve(json({}, 403));
        return Promise.resolve(++calls === 1 ? json({ csrfToken: "initial" }) : json({}, status));
    });
    vi.stubGlobal("fetch", fetch);
    const { apiRequest, refreshAuthenticatedSession, subscribeToSessionRefresh } = await import("../../src/services/api/api-client");
    await apiRequest("/identity/session");
    const listener = vi.fn();
    const unsubscribe = subscribeToSessionRefresh(listener);
    try {
        await expect(refreshAuthenticatedSession()).rejects.toMatchObject({ status });
        expect(fetch.mock.calls).toHaveLength(3);
        expect(paths.filter((path) => path === "/identity/refresh")).toHaveLength(1);
        expect(listener).not.toHaveBeenCalled();
    } finally {
        unsubscribe();
    }
});
