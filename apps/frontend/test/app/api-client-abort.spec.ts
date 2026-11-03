import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });

it("no consulta ni escribe cuando el formulario ya se canceló", async () => {
    const fetch = vi.fn(() => Promise.resolve(json({})));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    const controller = new AbortController();
    controller.abort();
    await expect(apiRequest("/catalogs/banks/items", { method: "POST", body: {}, signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).not.toHaveBeenCalled();
});

it("cancelar durante CSRF impide el POST posterior sin cancelar la prueba compartida", async () => {
    let release!: (response: Response) => void;
    const pending = new Promise<Response>((resolve) => {
        release = resolve;
    });
    const fetch = vi.fn((input: string) => (new URL(input).pathname === "/identity/session" ? pending : Promise.resolve(json({ saved: true }))));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    const controller = new AbortController();
    const result = apiRequest("/catalogs/banks/items", { method: "POST", body: {}, signal: controller.signal });
    await vi.waitFor(() => {
        expect(fetch).toHaveBeenCalledOnce();
    });
    controller.abort();
    release(json({ csrfToken: "proof" }));
    await expect(result).rejects.toMatchObject({ name: "AbortError" });
    expect(fetch).toHaveBeenCalledOnce();
});

it("transfiere AbortSignal a fetch para cancelar la petición en vuelo", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json({ ok: true })));
    vi.stubGlobal("fetch", fetch);
    const { apiRequest } = await import("../../src/services/api/api-client");
    const controller = new AbortController();
    await apiRequest("/catalogs/banks/items", { signal: controller.signal });
    expect(fetch.mock.calls[0]?.[1]).toMatchObject({ signal: controller.signal });
});
