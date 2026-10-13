import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

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
