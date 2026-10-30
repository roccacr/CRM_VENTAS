import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
it("gets a fresh cookie-bound handshake proof with credentials and rejects an old account response", async () => {
    let release: (response: Response) => void = () => {};
    const stale = new Promise<Response>((resolve) => {
        release = resolve;
    });
    let sessionCalls = 0;
    const fetch = vi.fn((input: string) => (new URL(input).pathname === "/identity/session" ? (++sessionCalls === 1 ? Promise.resolve(json({ csrfToken: "first" })) : stale) : Promise.resolve(json({ csrfToken: "new-account" }))));
    vi.stubGlobal("fetch", fetch);
    const { getAuthenticatedCsrfToken, apiRequest } = await import("../../src/services/api/api-client");
    expect(await getAuthenticatedCsrfToken()).toBe("first");
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "include", cache: "no-store" }));
    const old = getAuthenticatedCsrfToken();
    const rejection = expect(old).rejects.toMatchObject({ status: 409 });
    await apiRequest("/identity/local/login", { method: "POST", retryOnUnauthorized: false });
    release(json({ csrfToken: "old-account" }));
    await rejection;
});
